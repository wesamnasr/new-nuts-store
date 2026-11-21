import { NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import {
  CartItem,
  InventoryAdjustment,
  Order,
  OrderStatus,
  PaymentMethod,
  PosExpense,
  PosOrderType,
  PosPaymentSplit,
  PosRegisterConfig,
  PosReturnItem,
  PosReturnRecord,
  PosShift,
  Product,
  VipMember,
} from '@/types/store';
import {
  calculateVipCashback,
  getProductCostForWeight,
  getResolvedProductWeights,
  isUnitProduct,
} from '@/lib/pricing';
import { validateCoupon, validateEgyptianPhone } from '@/lib/validation';
import { getSafeImageUrl } from '@/lib/defaults';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';
import { sendStoreTelegramAlert, type LowStockAlertItem } from '@/lib/telegram';
import { reverseOrderEffects, reapplyOrderEffects } from '@/lib/order-reversal';
import { appendAuditLog } from '@/lib/audit-log';
import { calculateOrderTaxBreakdown, generateEtaReceiptUuid } from '@/lib/tax';
import { recordTreasuryTransaction } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

const DEFAULT_REGISTERS: PosRegisterConfig[] = [
  { id: 'reg-1', name: 'ماكينة كاشير 1 (الرئيسية)', active: true },
  { id: 'reg-2', name: 'ماكينة كاشير 2 (الفرعية)', active: true },
];

function getConfiguredRegisters(registers?: PosRegisterConfig[]): PosRegisterConfig[] {
  if (Array.isArray(registers) && registers.length > 0) {
    return registers.filter((r) => r.active !== false);
  }
  return DEFAULT_REGISTERS;
}

function resolveActiveShift(
  shifts: PosShift[],
  requestedRegisterId?: string | null,
  requestedShiftId?: string | null,
  cashierIdentity?: string | null
): PosShift | undefined {
  const openList = (shifts || []).filter((s) => s.status === 'open');
  if (openList.length === 0) return undefined;

  if (requestedShiftId) {
    const byId = openList.find((s) => s.id === requestedShiftId || s.shiftNumber === requestedShiftId);
    if (byId) return byId;
  }

  if (requestedRegisterId && requestedRegisterId.trim()) {
    const cleanReg = requestedRegisterId.trim();
    return openList.find((s) => (s.registerId || 'reg-1') === cleanReg);
  }

  if (cashierIdentity) {
    const byCashier = openList.find((s) => s.cashierId === cashierIdentity);
    if (byCashier) return byCashier;
  }

  return openList[0];
}

function sanitizeOrderForCashier(order: Order): Order {
  const copy = { ...order };
  delete copy.rawCostTotal;
  delete copy.netProfitEgp;
  if (Array.isArray(copy.items)) {
    copy.items = copy.items.map((item) => {
      const itemCopy = { ...item };
      delete itemCopy.rawCostEgp;
      return itemCopy;
    });
  }
  return copy;
}

function computeExpectedDrawerCash(shift: PosShift): number {
  const starting = Number(shift.startingCash ?? shift.openingCash ?? 0);
  const cash = Number(shift.cashSales ?? shift.cashSalesTotal ?? 0);
  const settledCod = Number(shift.riderCodSettledTotal ?? 0);
  const debtCash = Number(shift.debtCollectionsCashTotal ?? 0);
  const cashReturns = Number(shift.cashReturnsTotal ?? 0);
  const exp = Number(shift.expenses ?? shift.expensesTotal ?? 0);
  return Math.max(
    0,
    Math.round((starting + cash + settledCod + debtCash - cashReturns - exp) * 100) / 100
  );
}

function recordPosLowStockCrossing(
  product: Product,
  prevStockKg: number,
  crossedAlerts: LowStockAlertItem[]
) {
  const nextStockKg = typeof product.stockKg === 'number' ? product.stockKg : 50;
  if ((prevStockKg > 5 && nextStockKg <= 5) || (prevStockKg > 0 && nextStockKg <= 0)) {
    const existing = crossedAlerts.find((a) => a.productId === product.id);
    if (existing) {
      existing.remainingStockKg = nextStockKg;
    } else {
      crossedAlerts.push({
        productId: product.id,
        productName: product.name,
        previousStockKg: prevStockKg,
        remainingStockKg: nextStockKg,
      });
    }
  }
}

function sanitizeShiftForCashier(shift: PosShift | null): PosShift | null {
  if (!shift) return null;
  const copy = { ...shift };
  delete (copy as any).totalRawCost;
  delete (copy as any).totalNetProfit;
  return copy;
}

export async function GET(request: Request) {
  try {
    const dbForGet = await getDbAsync();
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول' },
        { status: 401 }
      );
    }

    if (auth.role === 'delivery_rider') {
      return NextResponse.json(
        { error: 'عزل الأدوار: مندوب التوصيل غير مصرح له بالدخول إلى نظام الكاشير (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (
      auth.role === 'supplier' &&
      !hasRolePermission('supplier', 'cashier_portal', dbForGet.settings) &&
      !hasRolePermission('supplier', 'accounting_portal', dbForGet.settings) &&
      !hasRolePermission('supplier', 'operations', dbForGet.settings)
    ) {
      return NextResponse.json(
        { error: 'عزل الأدوار: المورد غير مصرح له بالدخول إلى نظام الكاشير (403 Forbidden)' },
        { status: 403 }
      );
    }

    const canSeeProfits =
      auth.isAuthenticated &&
      (auth.role === 'super_admin' || auth.role === 'accountant');

    const db = dbForGet;
    const rawShifts = db.posShifts || [];
    const posExpenses = db.posExpenses || [];
    const posRegisters = getConfiguredRegisters(db.settings?.posRegisters);

    let requestedRegisterId: string | null = null;
    try {
      const url = new URL(request.url);
      requestedRegisterId = url.searchParams.get('registerId');
    } catch {
      requestedRegisterId = null;
    }

    const matchedOpen = resolveActiveShift(
      rawShifts,
      requestedRegisterId,
      null,
      auth.username || auth.staffId
    );
    const rawActiveShift =
      matchedOpen ||
      (requestedRegisterId ? null : rawShifts.find((s) => s.status === 'open') || rawShifts[0] || null);
    const rawOpenShifts = rawShifts.filter((s) => s.status === 'open');

    const allOrders = db.orders || [];
    const rawRecentPosOrders = allOrders
      .filter((o) => o.orderSource === 'pos' || o.orderNumber?.startsWith('POS-'))
      .slice(0, 200);
    const rawOnlineQueueOrders = allOrders
      .filter((o) => o.orderSource !== 'pos' && !o.orderNumber?.startsWith('POS-'))
      .slice(0, 200);

    return NextResponse.json({
      activeShift: canSeeProfits ? rawActiveShift : sanitizeShiftForCashier(rawActiveShift),
      openShifts: canSeeProfits
        ? rawOpenShifts
        : rawOpenShifts.map((s) => sanitizeShiftForCashier(s)!),
      posRegisters,
      posShifts: canSeeProfits
        ? rawShifts
        : rawShifts.map((s) => sanitizeShiftForCashier(s)!),
      posExpenses,
      posReturns: (db.posReturns || []).slice(0, 100),
      coupons: (db.coupons || []).filter((c) => c.active),
      recentPosOrders: canSeeProfits
        ? rawRecentPosOrders
        : rawRecentPosOrders.map(sanitizeOrderForCashier),
      onlineQueueOrders: canSeeProfits
        ? rawOnlineQueueOrders
        : rawOnlineQueueOrders.map(sanitizeOrderForCashier),
      vipMembers: db.vipMembers || [],
      availableRiders: (db.staffAccounts || [])
        .filter((s) => s.role === 'delivery_rider' && s.active !== false)
        .map((s) => ({ id: s.id, displayName: s.displayName || 'مندوب التوصيل' })),
      creditConfig: {
        enableCreditSales: Boolean(db.settings?.enableCreditSales),
        creditSalesRequireApproval: db.settings?.creditSalesRequireApproval !== false,
      },
      taxConfig: {
        enableTax: Boolean(db.settings?.enableTax),
        taxRatePercent: db.settings?.taxRatePercent ?? 14,
        taxPricingMode: db.settings?.taxPricingMode || 'inclusive',
        taxRegistrationNumber: db.settings?.taxRegistrationNumber || '',
      },
    });
  } catch (error) {
    console.error('GET /api/pos error:', error);
    return NextResponse.json(
      { error: 'تعذر تحميل بيانات نظام الكاشير' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول' },
        { status: 401 }
      );
    }

    if (auth.role === 'delivery_rider') {
      return NextResponse.json(
        { error: 'عزل الأدوار: مندوب التوصيل غير مصرح له بإصدار فواتير الكاشير (403 Forbidden)' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action || 'create_invoice';

    return await withDbTransaction(async (db) => {
      if (
        auth.role === 'supplier' &&
        !hasRolePermission('supplier', 'cashier_portal', db.settings) &&
        !hasRolePermission('supplier', 'accounting_portal', db.settings) &&
        !hasRolePermission('supplier', 'operations', db.settings)
      ) {
        return NextResponse.json(
          { error: 'عزل الأدوار: المورد غير مصرح له بإصدار فواتير الكاشير' },
          { status: 403 }
        );
      }

      if (auth.role === 'accountant' && !hasRolePermission('accountant', 'cashier_portal', db.settings)) {
        return NextResponse.json(
          { error: 'عزل الأدوار: المحاسب بصلاحية قراءة فقط وممنوع من إصدار فواتير الكاشير' },
          { status: 403 }
        );
      }

      const canSeeProfits =
        auth.isAuthenticated &&
        (auth.role === 'super_admin' || (auth.role as string) === 'admin');

      if (!Array.isArray(db.posShifts)) db.posShifts = [];
      if (!Array.isArray(db.posExpenses)) db.posExpenses = [];
      if (!Array.isArray(db.posReturns)) db.posReturns = [];
      if (!Array.isArray(db.vipMembers)) db.vipMembers = [];
      if (!Array.isArray(db.orders)) db.orders = [];

      const posRegisters = getConfiguredRegisters(db.settings?.posRegisters);

      // 1. OPEN NEW SHIFT (MULTI-REGISTER AWARE: ONLY CLOSES STALE SHIFT ON SAME REGISTER)
      if (action === 'open_shift') {
        const registerId =
          typeof body.registerId === 'string' && body.registerId.trim()
            ? body.registerId.trim()
            : 'reg-1';
        const matchedReg = posRegisters.find((r) => r.id === registerId);
        const registerName =
          (typeof body.registerName === 'string' && body.registerName.trim()) ||
          matchedReg?.name ||
          (registerId === 'reg-1' ? 'ماكينة كاشير 1 (الرئيسية)' : `ماكينة كاشير (${registerId})`);

        const cashierName = (
          body.cashierName ||
          auth.displayName ||
          auth.username ||
          'كاشير نقطة البيع'
        ).trim();
        const cashierId = (
          body.cashierId ||
          auth.username ||
          auth.staffId ||
          'cashier_pos'
        ).trim();
        const shiftPeriod = body.shiftPeriod || 'الوردية الصباحية';
        const openingCash = Math.max(0, Number(body.openingCash ?? body.startingCash) || 0);
        const startingCash = openingCash;
        const startTime = new Date().toISOString();
        const openedAt = startTime;

        // Multi-Register Safe: ONLY close an existing open shift on THIS specific registerId
        for (const s of db.posShifts) {
          if (s.status === 'open' && (s.registerId || 'reg-1') === registerId) {
            s.status = 'closed';
            s.closedAt = new Date().toISOString();
            s.endTime = s.closedAt;
            s.actualCash = s.actualClosingCash ?? s.expectedCash ?? s.expectedCashInDrawer ?? 0;
            s.actualClosingCash = s.actualCash;
            s.variance = (s.actualCash ?? 0) - (s.expectedCash ?? s.expectedCashInDrawer ?? 0);
            s.cashDifference = s.variance;
          }
        }

        const shiftNum = 101 + db.posShifts.length;
        const newShift: PosShift = {
          id: `shift-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          shiftNumber: `SHIFT-${shiftNum}`,
          registerId,
          registerName,
          cashierId,
          cashierName,
          shiftPeriod,
          status: 'open',
          startingCash,
          openingCash,
          cashSales: 0,
          cashSalesTotal: 0,
          cashReturnsTotal: 0,
          creditSalesTotal: 0,
          debtCollectionsCashTotal: 0,
          riderCodSettledTotal: 0,
          cardSales: 0,
          cardSalesTotal: 0,
          vodafoneCashTotal: 0,
          instapayTotal: 0,
          vipRedeemedTotal: 0,
          vipCashbackIssuedTotal: 0,
          expenses: 0,
          expensesTotal: 0,
          expectedCash: openingCash,
          expectedCashInDrawer: openingCash,
          ordersCount: 0,
          totalRevenue: 0,
          totalRawCost: 0,
          totalNetProfit: 0,
          startTime,
          openedAt,
          notes: body.notes?.trim() || undefined,
        };

        db.posShifts.unshift(newShift);

        appendAuditLog(db, {
          action: 'pos_shift_open',
          actorUsername: cashierId,
          actorDisplayName: cashierName,
          actorRole: auth.role || 'cashier',
          targetType: 'pos_shift',
          targetId: newShift.id,
          summary: `فتح وردية ${newShift.shiftNumber} على «${registerName}» بعهدة افتتاحية ${openingCash} ج.م`,
          afterValue: { shiftNumber: newShift.shiftNumber, registerId, openingCash },
        });

        const openShifts = db.posShifts.filter((s) => s.status === 'open');
        return NextResponse.json({
          success: true,
          activeShift: canSeeProfits ? newShift : sanitizeShiftForCashier(newShift),
          openShifts: canSeeProfits ? openShifts : openShifts.map((s) => sanitizeShiftForCashier(s)!),
        });
      }

      // 2. CLOSE ACTIVE SHIFT (Z-REPORT, RECONCILIATION & AUTOMATIC TREASURY SETTLEMENT)
      if (action === 'close_shift') {
        const activeShift = resolveActiveShift(
          db.posShifts,
          body.registerId,
          body.shiftId,
          auth.username || auth.staffId
        );
        if (!activeShift) {
          return NextResponse.json(
            { error: 'لا توجد وردية مفتوحة حالياً لتقفيلها' },
            { status: 400 }
          );
        }

        // computeExpectedDrawerCash handles starting/cash/riderCodSettledTotal/expenses
        // cash sales included in computeExpectedDrawerCash
        // expenses deducted in computeExpectedDrawerCash
        const expectedCash = computeExpectedDrawerCash(activeShift);
        activeShift.expectedCash = expectedCash;
        activeShift.expectedCashInDrawer = expectedCash;

        const rawActual = body.actualCash !== undefined ? body.actualCash : body.actualClosingCash;
        const actualCash = rawActual !== undefined ? Math.max(0, Number(rawActual) || 0) : expectedCash;
        const variance = Math.round((actualCash - expectedCash) * 100) / 100;

        activeShift.status = 'closed';
        activeShift.endTime = new Date().toISOString();
        activeShift.closedAt = activeShift.endTime;
        activeShift.actualCash = actualCash;
        activeShift.actualClosingCash = actualCash;
        activeShift.variance = variance;
        activeShift.cashDifference = variance;
        if (body.notes) {
          activeShift.notes = body.notes.trim();
        }

        // Automatic Treasury Settlement on Shift Close
        if (!activeShift.treasuryTransferred) {
          const recorder = auth.displayName || auth.username || activeShift.cashierName || 'كاشير الفرع';
          const regLabel = activeShift.registerName || activeShift.registerId || 'ماكينة الكاشير';
          if (actualCash > 0) {
            recordTreasuryTransaction(db, {
              accountId: 'main_safe',
              direction: 'in',
              category: 'shift_close',
              amount: actualCash,
              referenceId: activeShift.shiftNumber,
              title: `توريد نقدية إغلاق الوردية #${activeShift.shiftNumber} (${regLabel})`,
              notes: variance !== 0 ? `فارق جرد الدرج: ${variance} ج.م` : 'مطابق تماماً للجرد المتوقع',
              recordedBy: recorder,
            });
          }
          if ((activeShift.instapayTotal || 0) > 0) {
            recordTreasuryTransaction(db, {
              accountId: 'instapay_bank',
              direction: 'in',
              category: 'electronic_settlement',
              amount: activeShift.instapayTotal,
              referenceId: activeShift.shiftNumber,
              title: `تسوية مقبوضات إنستاباي للوردية #${activeShift.shiftNumber}`,
              recordedBy: recorder,
            });
          }
          if ((activeShift.vodafoneCashTotal || 0) > 0) {
            recordTreasuryTransaction(db, {
              accountId: 'vodafone_wallet',
              direction: 'in',
              category: 'electronic_settlement',
              amount: activeShift.vodafoneCashTotal,
              referenceId: activeShift.shiftNumber,
              title: `تسوية مقبوضات فودافون كاش للوردية #${activeShift.shiftNumber}`,
              recordedBy: recorder,
            });
          }
          const pureCardAmount = Math.max(
            0,
            Math.round(
              ((activeShift.cardSalesTotal ?? activeShift.cardSales ?? 0) -
                (activeShift.instapayTotal || 0) -
                (activeShift.vodafoneCashTotal || 0)) *
                100
            ) / 100
          );
          if (pureCardAmount > 0) {
            recordTreasuryTransaction(db, {
              accountId: 'card_bank',
              direction: 'in',
              category: 'electronic_settlement',
              amount: pureCardAmount,
              referenceId: activeShift.shiftNumber,
              title: `تسوية ماكينة الفيزا للوردية #${activeShift.shiftNumber}`,
              recordedBy: recorder,
            });
          }
          activeShift.treasuryTransferred = true;
        }

        appendAuditLog(db, {
          action: 'pos_shift_close',
          actorUsername: auth.username || activeShift.cashierId || 'cashier',
          actorDisplayName: auth.displayName || activeShift.cashierName,
          actorRole: auth.role || 'cashier',
          targetType: 'pos_shift',
          targetId: activeShift.id,
          summary: `تقفيل وردية #${activeShift.shiftNumber} — المتوقع: ${expectedCash} ج.م | الفعلي المورّد للخزينة: ${actualCash} ج.م | الفارق: ${variance} ج.م`,
          afterValue: {
            shiftNumber: activeShift.shiftNumber,
            expectedCash,
            actualCash,
            variance,
          },
        });

        // Telegram Z-Report Notification Trigger (non-blocking)
        sendStoreTelegramAlert(db.settings, 'z_report', activeShift).catch((e: any) =>
          console.error('Telegram Z-Report error:', e)
        );

        const openShifts = db.posShifts.filter((s) => s.status === 'open');
        return NextResponse.json({
          success: true,
          closedShift: canSeeProfits ? activeShift : sanitizeShiftForCashier(activeShift),
          openShifts: canSeeProfits ? openShifts : openShifts.map((s) => sanitizeShiftForCashier(s)!),
        });
      }

      // 3. ADD PETTY CASH EXPENSE FROM DRAWER
      if (action === 'add_expense' || action === 'expense') {
        const title = (body.title || body.description || '').trim();
        const amount = Math.max(1, Math.round(Number(body.amount) || 0));
        if (!title || amount <= 0) {
          return NextResponse.json(
            { error: 'يرجى إدخال بيان المصروف والمبلغ بشكل صحيح' },
            { status: 400 }
          );
        }

        const activeShift = resolveActiveShift(
          db.posShifts,
          body.registerId,
          body.shiftId,
          auth.username || auth.staffId
        );
        const newExpense: PosExpense = {
          id: `exp-${Date.now()}`,
          shiftId: activeShift?.id,
          registerId: activeShift?.registerId || body.registerId || 'reg-1',
          title,
          amount,
          category: body.category || 'other',
          createdBy: auth.displayName || auth.username || 'كاشير نقطة البيع',
          notes: body.notes?.trim() || undefined,
          createdAt: new Date().toISOString(),
        };

        db.posExpenses.unshift(newExpense);

        if (activeShift) {
          activeShift.expenses = (activeShift.expenses || 0) + amount;
          activeShift.expensesTotal = (activeShift.expensesTotal || 0) + amount;
          // computeExpectedDrawerCash handles starting/cash/riderCodSettledTotal/expenses
          // cash sales included in computeExpectedDrawerCash
          // expenses deducted in computeExpectedDrawerCash
          activeShift.expectedCash = computeExpectedDrawerCash(activeShift);
          activeShift.expectedCashInDrawer = activeShift.expectedCash;
        }

        return NextResponse.json({
          success: true,
          expense: newExpense,
          activeShift: canSeeProfits
            ? activeShift || null
            : sanitizeShiftForCashier(activeShift || null),
        });
      }

      // 4. UPDATE ONLINE ORDER STATUS FROM CASHIER QUEUE
      if (action === 'update_order_status') {
        const orderId = body.orderId;
        const status: OrderStatus = body.status;
        const order = db.orders.find(
          (o) => o.id === orderId || o.orderNumber === orderId
        );
        if (!order) {
          return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
        }
        const prevStatus = order.status;
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
          reverseOrderEffects(db, order);
          appendAuditLog(db, {
            action: 'order_cancel',
            actorUsername: auth.username || 'cashier',
            actorDisplayName: auth.displayName || auth.username || 'الكاشير',
            actorRole: auth.role || 'cashier',
            targetType: 'order',
            targetId: order.id,
            summary: `إلغاء الطلب #${order.orderNumber} واسترداد الرصيد للمخزون (الإجمالي: ${order.total} ج.م)`,
          });
        } else if (status !== 'cancelled' && prevStatus === 'cancelled') {
          const reapply = reapplyOrderEffects(db, order);
          if (!reapply.ok) {
            return NextResponse.json({ error: reapply.error }, { status: 400 });
          }
        }
        order.status = status;
        if (body.riderId !== undefined) {
          order.riderId = body.riderId || undefined;
        }
        if (body.riderName !== undefined) {
          order.riderName = body.riderName || undefined;
        }
        if (status === 'delivered') {
          if (!order.deliveredAt) {
            order.deliveredAt = new Date().toISOString();
          }
          if (order.paymentMethod === 'cod' && order.orderSource !== 'pos') {
            if (order.cashCollected === undefined) {
              order.cashCollected = order.total;
            }
            if (order.riderCodSettled === undefined) {
              order.riderCodSettled = false;
            }
          }
        }
        return NextResponse.json({
          success: true,
          order: canSeeProfits ? order : sanitizeOrderForCashier(order),
        });
      }

      // 4.1 ASSIGN RIDER TO ONLINE/DELIVERY ORDER FROM CASHIER TERMINAL
      if (action === 'assign_rider') {
        const orderId = body.orderId;
        const order = db.orders.find(
          (o) => o.id === orderId || o.orderNumber === orderId
        );
        if (!order) {
          return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
        }
        order.riderId = body.riderId || undefined;
        order.riderName = body.riderName || undefined;
        return NextResponse.json({
          success: true,
          order: canSeeProfits ? order : sanitizeOrderForCashier(order),
        });
      }

      // 4.2 SETTLE RIDER COD CUSTODY INTO ACTIVE CASHIER DRAWER
      if (action === 'settle_rider_cod') {
        const activeShift = resolveActiveShift(
          db.posShifts,
          body.registerId,
          body.shiftId,
          auth.username || auth.staffId
        );
        if (!activeShift) {
          return NextResponse.json(
            { error: 'لا توجد وردية كاشير مفتوحة حالياً لاستلام وتوريد نقدية المندوب بالدرج' },
            { status: 400 }
          );
        }

        const targetOrderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
        const targetOrderIds: string[] = Array.isArray(body.orderIds)
          ? body.orderIds.map((id: unknown) => String(id).trim()).filter(Boolean)
          : [];
        const targetRiderId = typeof body.riderId === 'string' ? body.riderId.trim() : '';
        const settleAll = body.settleAll === true;

        const eligibleOrders = db.orders.filter((o) => {
          const isOnlineOrder = o.orderSource !== 'pos' && !o.orderNumber?.startsWith('POS-');
          if (!isOnlineOrder || o.status !== 'delivered' || o.paymentMethod !== 'cod' || o.riderCodSettled) {
            return false;
          }
          if (targetOrderId) {
            return o.id === targetOrderId || o.orderNumber === targetOrderId;
          }
          if (targetOrderIds.length > 0) {
            return targetOrderIds.includes(o.id) || targetOrderIds.includes(o.orderNumber);
          }
          if (targetRiderId) {
            return o.riderId === targetRiderId;
          }
          return settleAll;
        });

        if (eligibleOrders.length === 0) {
          return NextResponse.json(
            { error: 'لا توجد طلبات دفع عند الاستلام (COD) مسلّمة وغير مسوّاة مطابقة للتوريد' },
            { status: 400 }
          );
        }

        const nowIso = new Date().toISOString();
        const receiverLabel = auth.displayName || auth.username || activeShift.cashierName || 'كاشير الفرع';
        let settledAmount = 0;

        for (const ord of eligibleOrders) {
          const collected = Math.max(0, Math.round(Number(ord.cashCollected ?? ord.total ?? 0) * 100) / 100);
          ord.cashCollected = collected;
          ord.riderCodSettled = true;
          ord.riderCodSettledAt = nowIso;
          ord.riderCodSettledShiftId = activeShift.id;
          ord.riderCodSettledBy = receiverLabel;
          settledAmount = Math.round((settledAmount + collected) * 100) / 100;
        }

        activeShift.riderCodSettledTotal = Math.round(
          ((activeShift.riderCodSettledTotal || 0) + settledAmount) * 100
        ) / 100;
        activeShift.expectedCash = computeExpectedDrawerCash(activeShift);
        activeShift.expectedCashInDrawer = activeShift.expectedCash;

        return NextResponse.json({
          success: true,
          settledCount: eligibleOrders.length,
          settledAmount,
          settledOrders: canSeeProfits
            ? eligibleOrders
            : eligibleOrders.map(sanitizeOrderForCashier),
          activeShift: canSeeProfits ? activeShift : sanitizeShiftForCashier(activeShift),
        });
      }

      // 4.3 PARTIAL & FULL POS RETURNS (مرتجع جزئي أو كلي للفواتير مع فحص الحالة والدرج)
      if (action === 'create_return') {
        const targetId = String(body.orderId || body.orderNumber || '').trim();
        if (!targetId) {
          return NextResponse.json(
            { error: 'يرجى تحديد رقم الفاتورة المراد استرجاعها' },
            { status: 400 }
          );
        }

        const order = db.orders.find(
          (o) =>
            o.id === targetId ||
            o.orderNumber.toLowerCase() === targetId.toLowerCase()
        );
        if (!order) {
          return NextResponse.json(
            { error: `الفاتورة «${targetId}» غير موجودة في السجل` },
            { status: 404 }
          );
        }
        if (order.status === 'cancelled') {
          return NextResponse.json(
            { error: 'هذه الفاتورة ملغاة بالفعل ولا يمكن إجراء مرتجع إضافي عليها' },
            { status: 400 }
          );
        }

        const rawReturnItems: PosReturnItem[] = Array.isArray(body.items) ? body.items : [];
        if (rawReturnItems.length === 0) {
          return NextResponse.json(
            { error: 'يرجى تحديد صنف واحد على الأقل للاسترجاع' },
            { status: 400 }
          );
        }

        const alreadyReturned = Number(order.returnedAmountTotal || 0);
        const maxRefundable = Math.max(0, Math.round((order.total - alreadyReturned) * 100) / 100);
        if (maxRefundable <= 0) {
          return NextResponse.json(
            { error: 'تم استرجاع كامل قيمة هذه الفاتورة مسبقاً' },
            { status: 400 }
          );
        }

        const processedItems: PosReturnItem[] = [];
        let computedRefundTotal = 0;
        const netItemsPayable = Math.max(0, (order.total || 0) - (order.shippingCost || 0));
        const prorationRatio =
          (order.subtotal || 0) > 0 && netItemsPayable > 0
            ? netItemsPayable / order.subtotal
            : 1;

        for (const ri of rawReturnItems) {
          const rQty = Math.max(0, Number(ri.returnQty) || 0);
          if (rQty <= 0) continue;
          const origItem = order.items.find(
            (oi) =>
              (ri.cartItemId && oi.cartItemId === ri.cartItemId) ||
              oi.productId === ri.productId
          );
          if (!origItem) {
            return NextResponse.json(
              { error: `الصنف «${ri.productName || ri.productId}» غير موجود في الفاتورة الأصلية` },
              { status: 400 }
            );
          }
          const previouslyReturnedQty = (order.returnRecords || []).reduce((sum, rec) => {
            const matchedPrev = (rec.items || []).find(
              (pi) =>
                (origItem.cartItemId && pi.cartItemId === origItem.cartItemId) ||
                pi.productId === origItem.productId
            );
            return sum + (matchedPrev?.returnQty || 0);
          }, 0);
          if (rQty + previouslyReturnedQty > origItem.quantity + 1e-6) {
            return NextResponse.json(
              {
                error: `الكمية المرتجعة (${rQty}) للصنف «${origItem.productName}» تتجاوز المتبقي القابل للاسترجاع (${Math.max(0, origItem.quantity - previouslyReturnedQty)})`,
              },
              { status: 400 }
            );
          }

          const lineRefund =
            typeof ri.refundAmount === 'number' && ri.refundAmount >= 0
              ? Math.round(ri.refundAmount * 100) / 100
              : Math.round(origItem.unitPrice * rQty * prorationRatio * 100) / 100;

          const condition: 'restock' | 'damaged' =
            ri.condition === 'damaged' ? 'damaged' : 'restock';

          const prod = db.products.find((p) => p.id === origItem.productId);
          let resolvedGrams = ri.weightGrams || origItem.customWeightGrams;
          if (!resolvedGrams && prod) {
            const matchedW = getResolvedProductWeights(prod).find(
              (w) => w.id === origItem.weightId || w.label === origItem.weightLabel
            );
            resolvedGrams = matchedW?.weightGrams || matchedW?.grams || 250;
          }

          processedItems.push({
            cartItemId: origItem.cartItemId,
            productId: origItem.productId,
            productName: origItem.productName,
            returnQty: rQty,
            weightGrams: resolvedGrams,
            unitLabel: origItem.weightLabel,
            refundAmount: lineRefund,
            condition,
          });
          computedRefundTotal = Math.round((computedRefundTotal + lineRefund) * 100) / 100;
        }

        if (processedItems.length === 0) {
          return NextResponse.json(
            { error: 'يرجى إدخال كمية مرتجع صحيحة أكبر من صفر' },
            { status: 400 }
          );
        }

        const totalRefundAmount = Math.min(maxRefundable, computedRefundTotal);
        const refundMethod: PosReturnRecord['refundMethod'] =
          body.refundMethod === 'vip_wallet' ||
          body.refundMethod === 'original_electronic' ||
          body.refundMethod === 'credit_deduction'
            ? body.refundMethod
            : 'cash';

        const activeShift = resolveActiveShift(
          db.posShifts,
          body.registerId || order.registerId,
          body.shiftId,
          auth.username || auth.staffId
        );

        if (refundMethod === 'cash' && !activeShift && body.allowNoShiftRefund !== true) {
          return NextResponse.json(
            { error: 'يجب فتح وردية كاشير أولاً لرد المبلغ نقداً من الدرج، أو اختيار الرد لمحفظة العميل' },
            { status: 400 }
          );
        }

        const processorName = auth.displayName || auth.username || 'كاشير الفرع';

        // Apply physical inventory restock OR spoilage adjustment
        for (const pItem of processedItems) {
          const prod = db.products.find((p) => p.id === pItem.productId);
          if (!prod) continue;

          const deltaStock = isUnitProduct(prod)
            ? pItem.returnQty
            : ((pItem.weightGrams || 250) * pItem.returnQty) / 1000;
          const roundedDelta = Math.round(deltaStock * 1000) / 1000;

          if (pItem.condition === 'restock') {
            const currStock = typeof prod.stockKg === 'number' ? prod.stockKg : 0;
            prod.stockKg = Math.round((currStock + roundedDelta) * 1000) / 1000;
            prod.inStock = prod.stockKg > 0;
          } else {
            // Damaged return: do not restock sellable inventory; record audit spoilage entry
            if (!Array.isArray(db.inventoryAdjustments)) db.inventoryAdjustments = [];
            const unitCost = prod.costPerKg || Math.round((prod.pricePerKg || 200) * 0.7);
            const spoilageEntry: InventoryAdjustment = {
              id: `adj-ret-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              adjustmentNumber: `ADJ-RET-${100 + db.inventoryAdjustments.length}`,
              productId: prod.id,
              productName: prod.name,
              previousStockKg: prod.stockKg || 0,
              newStockKg: prod.stockKg || 0,
              differenceKg: -roundedDelta,
              unitCostPerKg: unitCost,
              totalCostImpact: -Math.round(roundedDelta * unitCost * 100) / 100,
              reason: 'damaged_spoilage',
              reasonLabel: 'مرتجع مبيعات تالف (لا يعود للمخزون السليم)',
              notes: `مرتجع فاتورة #${order.orderNumber}`,
              adjustedBy: processorName,
              adjustedByRole: auth.role || 'cashier',
              createdAt: new Date().toISOString(),
            };
            db.inventoryAdjustments.unshift(spoilageEntry);
          }
        }

        const returnNumber = `RET-${1001 + db.posReturns.length}`;
        const taxRatio = order.total > 0 && order.taxAmount ? order.taxAmount / order.total : 0;
        const taxRefundAmount = Math.round(totalRefundAmount * taxRatio * 100) / 100;

        // Apply financial refund according to refundMethod
        if (refundMethod === 'cash' && activeShift) {
          activeShift.cashReturnsTotal =
            Math.round(((activeShift.cashReturnsTotal || 0) + totalRefundAmount) * 100) / 100;
          activeShift.totalRevenue = Math.max(
            0,
            Math.round((activeShift.totalRevenue - totalRefundAmount) * 100) / 100
          );
          activeShift.expectedCash = computeExpectedDrawerCash(activeShift);
          activeShift.expectedCashInDrawer = activeShift.expectedCash;
        } else if (refundMethod === 'vip_wallet') {
          const phoneCheck = validateEgyptianPhone(body.customerPhone || order.customerPhone || '');
          const lookupPhone = phoneCheck.isValid ? phoneCheck.normalized : order.customerPhone;
          let member = db.vipMembers.find((m) => m.phone === lookupPhone);
          if (!member && phoneCheck.isValid) {
            member = {
              id: `vip-${Date.now()}`,
              membershipCode: `VIP-${lookupPhone.slice(-4)}`,
              name: order.customerName || 'عميل الفرع',
              customerName: order.customerName || 'عميل الفرع',
              phone: lookupPhone,
              walletBalance: 0,
              pointsBalance: 0,
              totalSpent: 0,
              ordersCount: 0,
              tier: 'Gold VIP',
              joinedAt: new Date().toISOString(),
              transactions: [],
            };
            db.vipMembers.unshift(member);
          }
          if (!member) {
            return NextResponse.json(
              { error: 'يرجى إدخال رقم هاتف مصري صحيح لإضافة قيمة المرتجع في محفظة العميل' },
              { status: 400 }
            );
          }
          const nextBal =
            Math.round(((member.pointsBalance ?? member.walletBalance ?? 0) + totalRefundAmount) * 100) /
            100;
          member.pointsBalance = nextBal;
          member.walletBalance = nextBal;
          member.transactions.unshift({
            id: `tx-ret-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'cashier_credit',
            amount: totalRefundAmount,
            amountEgp: totalRefundAmount,
            orderNumber: returnNumber,
            description: `إضافة قيمة مرتجع الفاتورة #${order.orderNumber} (${returnNumber})`,
          });
        } else if (refundMethod === 'credit_deduction') {
          const member = db.vipMembers.find((m) => m.phone === order.customerPhone);
          if (member) {
            member.creditBalanceDue = Math.max(
              0,
              Math.round(((member.creditBalanceDue || 0) - totalRefundAmount) * 100) / 100
            );
            if (!Array.isArray(member.creditTransactions)) member.creditTransactions = [];
            member.creditTransactions.unshift({
              id: `cr-ret-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'return_deduction',
              amount: totalRefundAmount,
              orderNumber: order.orderNumber,
              recordedBy: processorName,
              notes: `خصم مرتجع #${returnNumber} من مديونية الفاتورة الآجلة`,
            });
          }
          if (typeof order.creditDueAmount === 'number') {
            order.creditDueAmount = Math.max(
              0,
              Math.round((order.creditDueAmount - totalRefundAmount) * 100) / 100
            );
          }
        } else if (refundMethod === 'original_electronic') {
          const targetAccount =
            order.paymentMethod === 'instapay'
              ? 'instapay_bank'
              : order.paymentMethod === 'vodafone_cash'
                ? 'vodafone_wallet'
                : 'card_bank';
          recordTreasuryTransaction(db, {
            accountId: targetAccount,
            direction: 'out',
            category: 'electronic_settlement',
            amount: totalRefundAmount,
            referenceId: returnNumber,
            title: `رد إلكتروني لمرتجع الفاتورة #${order.orderNumber} (${returnNumber})`,
            recordedBy: processorName,
          });
        }

        const returnRecord: PosReturnRecord = {
          id: `ret-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          returnNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          shiftId: activeShift?.id,
          registerId: activeShift?.registerId || order.registerId || 'reg-1',
          refundMethod,
          totalRefundAmount,
          taxRefundAmount: taxRefundAmount > 0 ? taxRefundAmount : undefined,
          items: processedItems,
          reason: typeof body.reason === 'string' ? body.reason.trim() : undefined,
          processedBy: processorName,
          createdAt: new Date().toISOString(),
        };

        order.returnedAmountTotal = Math.round((alreadyReturned + totalRefundAmount) * 100) / 100;
        if (!Array.isArray(order.returnRecords)) order.returnRecords = [];
        order.returnRecords.unshift(returnRecord);
        db.posReturns.unshift(returnRecord);

        appendAuditLog(db, {
          action: 'pos_return',
          actorUsername: auth.username || 'cashier',
          actorDisplayName: processorName,
          actorRole: auth.role || 'cashier',
          targetType: 'order',
          targetId: order.id,
          summary: `مرتجع مبيعات #${returnNumber} على الفاتورة #${order.orderNumber} بقيمة ${totalRefundAmount} ج.م (${refundMethod})`,
          afterValue: returnRecord,
        });

        return NextResponse.json(
          {
            success: true,
            returnRecord,
            order: canSeeProfits ? order : sanitizeOrderForCashier(order),
            activeShift: canSeeProfits
              ? activeShift || null
              : sanitizeShiftForCashier(activeShift || null),
          },
          { status: 201 }
        );
      }

      // 4.4 COLLECT CUSTOMER CREDIT DEBT AT POS COUNTER (تحصيل مديونية عميل آجل)
      if (action === 'collect_customer_debt') {
        const phoneCheck = validateEgyptianPhone(String(body.phone || ''));
        if (!phoneCheck.isValid) {
          return NextResponse.json(
            { error: 'يرجى إدخال رقم هاتف عميل مصري صحيح لتحصيل المديونية' },
            { status: 400 }
          );
        }
        const member = db.vipMembers.find((m) => m.phone === phoneCheck.normalized);
        if (!member || (member.creditBalanceDue || 0) <= 0) {
          return NextResponse.json(
            { error: 'لا توجد مديونية آجلة مستحقة على هذا العميل حالياً' },
            { status: 400 }
          );
        }

        const payAmount = Math.min(
          member.creditBalanceDue || 0,
          Math.max(0, Math.round((Number(body.amount) || 0) * 100) / 100)
        );
        if (payAmount <= 0) {
          return NextResponse.json(
            { error: 'يرجى إدخال مبلغ سداد صحيح أكبر من صفر' },
            { status: 400 }
          );
        }

        const payMethod: PaymentMethod = body.paymentMethod || 'cod';
        const activeShift = resolveActiveShift(
          db.posShifts,
          body.registerId,
          body.shiftId,
          auth.username || auth.staffId
        );
        const collector = auth.displayName || auth.username || 'كاشير الفرع';

        member.creditBalanceDue = Math.max(
          0,
          Math.round(((member.creditBalanceDue || 0) - payAmount) * 100) / 100
        );
        if (!Array.isArray(member.creditTransactions)) member.creditTransactions = [];
        member.creditTransactions.unshift({
          id: `cr-pay-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'debt_payment',
          amount: payAmount,
          paymentMethod: payMethod,
          shiftId: activeShift?.id,
          recordedBy: collector,
          notes: body.notes?.trim() || 'سداد مديونية آجلة عبر الكاشير',
        });

        // Settle oldest unpaid credit orders FIFO
        let remainingToAllocate = payAmount;
        const unpaidOrders = db.orders
          .filter(
            (o) =>
              o.customerPhone === member.phone &&
              o.status !== 'cancelled' &&
              (o.creditDueAmount || 0) > (o.creditPaidAmount || 0)
          )
          .reverse();
        for (const uo of unpaidOrders) {
          if (remainingToAllocate <= 0) break;
          const unpaidOnOrder = (uo.creditDueAmount || 0) - (uo.creditPaidAmount || 0);
          const applied = Math.min(unpaidOnOrder, remainingToAllocate);
          uo.creditPaidAmount = Math.round(((uo.creditPaidAmount || 0) + applied) * 100) / 100;
          remainingToAllocate = Math.round((remainingToAllocate - applied) * 100) / 100;
        }

        if (payMethod === 'cod' && activeShift) {
          activeShift.debtCollectionsCashTotal =
            Math.round(((activeShift.debtCollectionsCashTotal || 0) + payAmount) * 100) / 100;
          activeShift.expectedCash = computeExpectedDrawerCash(activeShift);
          activeShift.expectedCashInDrawer = activeShift.expectedCash;
        } else {
          const targetAcc =
            payMethod === 'instapay'
              ? 'instapay_bank'
              : payMethod === 'vodafone_cash'
                ? 'vodafone_wallet'
                : payMethod === 'card'
                  ? 'card_bank'
                  : 'main_safe';
          recordTreasuryTransaction(db, {
            accountId: targetAcc,
            direction: 'in',
            category: 'customer_debt_collection',
            amount: payAmount,
            referenceId: member.phone,
            title: `تحصيل مديونية آجلة من العميل «${member.customerName || member.name || member.phone}»`,
            recordedBy: collector,
          });
        }

        appendAuditLog(db, {
          action: 'credit_settlement',
          actorUsername: auth.username || 'cashier',
          actorDisplayName: collector,
          actorRole: auth.role || 'cashier',
          targetType: 'vip_member',
          targetId: member.phone,
          summary: `تحصيل مديونية آجلة بمبلغ ${payAmount} ج.م من العميل «${member.customerName || member.phone}» — المتبقي: ${member.creditBalanceDue} ج.م`,
        });

        return NextResponse.json({
          success: true,
          paidAmount: payAmount,
          remainingDebt: member.creditBalanceDue,
          updatedVipMember: member,
          activeShift: canSeeProfits
            ? activeShift || null
            : sanitizeShiftForCashier(activeShift || null),
        });
      }

      // 4.5 SYNC OFFLINE INVOICES QUEUE (POS EMERGENCY OFFLINE MODE)
      if (action === 'sync_offline_invoices' || action === 'sync_offline_queue') {
        const incomingInvoices = Array.isArray(body.invoices) ? body.invoices : [];
        if (incomingInvoices.length === 0) {
          return NextResponse.json({ success: true, syncedCount: 0, syncedOrders: [] });
        }

        const syncedOrders: Order[] = [];
        const crossedLowStockAlerts: LowStockAlertItem[] = [];
        const activeShift = resolveActiveShift(
          db.posShifts,
          body.registerId,
          body.shiftId,
          auth.username || auth.staffId
        );

        for (const inv of incomingInvoices) {
          const orderNumber = inv.orderNumber || `POS-OFF-${Math.floor(1000 + Math.random() * 9000)}`;
          // Deduplicate: check if order already exists
          const existing = db.orders.find((o) => o.orderNumber === orderNumber || o.id === inv.id);
          if (existing) {
            syncedOrders.push(existing);
            continue;
          }

          const items: CartItem[] = Array.isArray(inv.items) ? inv.items : [];
          let subtotal = 0;
          let rawCostTotal = 0;

          const verifiedItems = items.map((item) => {
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const unitPrice = Math.max(1, Math.round(Number(item.unitPrice) || 0));
            const prod = db.products.find((p) => p.id === item.productId);
            let unitRawCost = Number(item.rawCostEgp) || 0;
            if (!unitRawCost && prod) {
              const matchedW = prod.weights?.find((w) => w.id === item.weightId || w.label === item.weightLabel);
              const grams = item.customWeightGrams || matchedW?.weightGrams || matchedW?.grams || 250;
              unitRawCost = getProductCostForWeight(prod, grams);
            } else if (!unitRawCost) {
              unitRawCost = Math.round(unitPrice * 0.7);
            }
            subtotal += unitPrice * qty;
            rawCostTotal += unitRawCost * qty;
            return {
              ...item,
              quantity: qty,
              unitPrice,
              rawCostEgp: unitRawCost,
            };
          });

          const finalTotal = Math.max(0, Math.round(Number(inv.total) || subtotal));
          const paymentMethod: PaymentMethod = inv.paymentMethod || 'cod';
          const netProfitEgp = Math.round(finalTotal - (Number(inv.shippingCost) || 0) - rawCostTotal);

          const newOrder: Order = {
            id: inv.id || `pos-ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            orderNumber,
            orderSource: 'pos',
            posOrderType: inv.posOrderType || 'counter_takeaway',
            chairNumber: inv.chairNumber,
            registerId: inv.registerId || activeShift?.registerId || 'reg-1',
            registerName: inv.registerName || activeShift?.registerName,
            cashierId: auth.username || auth.staffId || activeShift?.cashierId || 'cashier_pos',
            cashierName: inv.cashierName || auth.displayName || activeShift?.cashierName || 'كاشير نقطة البيع',
            shiftId: activeShift?.id,
            customerName: inv.customerName || 'عميل الفرع المباشر',
            customerPhone: inv.customerPhone || '01000000000',
            governorate: db.settings.cityName || 'الفرع الرئيسي',
            address: inv.address || 'استلام فوري من كاشير الفرع',
            notes: inv.notes ? `[مزامنة طوارئ أوفلاين] ${inv.notes}` : '[مزامنة طوارئ أوفلاين]',
            deliveryMethod: inv.posOrderType === 'phone_delivery' ? 'bandar_fast' : 'store_pickup',
            items: verifiedItems,
            subtotal: inv.subtotal || subtotal,
            shippingCost: inv.shippingCost || 0,
            discountAmount: inv.discountAmount || 0,
            couponCode: inv.couponCode,
            vipRedeemedAmount: inv.vipRedeemedAmount || 0,
            vipWalletRedeemed: inv.vipWalletRedeemed || 0,
            vipCashbackEarned: inv.vipCashbackEarned || 0,
            taxAmount: inv.taxAmount,
            taxRatePercent: inv.taxRatePercent,
            taxInclusive: inv.taxInclusive,
            etaReceiptUuid: inv.etaReceiptUuid,
            total: finalTotal,
            cashTendered: inv.cashTendered || finalTotal,
            changeDue: inv.changeDue || 0,
            rawCostTotal,
            netProfitEgp,
            paymentMethod,
            paymentSplits: inv.paymentSplits,
            paymentReference: inv.paymentReference,
            status: 'delivered',
            createdAt: inv.createdAt || new Date().toISOString(),
          };

          // Stock depletion
          for (const item of verifiedItems) {
            const qty = item.quantity || 1;
            const prod = db.products.find((p) => p.id === item.productId);
            if (prod) {
              const resolvedVars = getResolvedProductWeights(prod);
              const matchedW =
                resolvedVars.find((w) => w.id === item.weightId || w.label === item.weightLabel) ||
                prod.weights?.find((w) => w.id === item.weightId || w.label === item.weightLabel);
              const consumedKg = isUnitProduct(prod)
                ? (matchedW?.unitsCount || (matchedW?.weightGrams ? Math.max(1, Math.round(matchedW.weightGrams / 1000)) : 1)) * qty
                : ((item.customWeightGrams || matchedW?.weightGrams || matchedW?.grams || 250) * qty) / 1000;
              const currentStock = typeof prod.stockKg === 'number' ? prod.stockKg : 50;
              prod.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
              if (prod.stockKg <= 0) prod.inStock = false;
              recordPosLowStockCrossing(prod, currentStock, crossedLowStockAlerts);
            }
          }

          db.orders.unshift(newOrder);
          syncedOrders.push(newOrder);

          // Update active shift
          if (activeShift) {
            activeShift.ordersCount += 1;
            activeShift.totalRevenue += finalTotal;
            activeShift.totalRawCost += rawCostTotal;
            activeShift.totalNetProfit += netProfitEgp;
            if (paymentMethod === 'cod') {
              activeShift.cashSales = (activeShift.cashSales || 0) + finalTotal;
              activeShift.cashSalesTotal = (activeShift.cashSalesTotal || 0) + finalTotal;
            } else if (paymentMethod === 'card') {
              activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
              activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + finalTotal;
            } else if (paymentMethod === 'vodafone_cash') {
              activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
              activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + finalTotal;
              activeShift.vodafoneCashTotal += finalTotal;
            } else if (paymentMethod === 'instapay') {
              activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
              activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + finalTotal;
              activeShift.instapayTotal += finalTotal;
            }
            // computeExpectedDrawerCash handles starting/cash/riderCodSettledTotal/expenses
            // cash sales included in computeExpectedDrawerCash
            // expenses deducted in computeExpectedDrawerCash
            activeShift.expectedCash = computeExpectedDrawerCash(activeShift);
            activeShift.expectedCashInDrawer = activeShift.expectedCash;
          }
        }

        return NextResponse.json({
          success: true,
          syncedCount: (() => {
            if (crossedLowStockAlerts.length > 0) {
              sendStoreTelegramAlert(db.settings, 'low_stock', {
                items: crossedLowStockAlerts,
                sourceLabel: `مزامنة كاشير أوفلاين (${syncedOrders.length} فاتورة)`,
              }).catch((e) => console.error('Telegram offline sync low_stock alert error:', e));
            }
            return syncedOrders.length;
          })(),
          syncedOrders: canSeeProfits ? syncedOrders : syncedOrders.map(sanitizeOrderForCashier),
          activeShift: canSeeProfits ? activeShift || null : sanitizeShiftForCashier(activeShift || null),
        });
      }

      // 5. CREATE IN-STORE POS INVOICE (DEFAULT ACTION)
      const cleanClientOrderId =
        typeof body.clientOrderId === 'string' && body.clientOrderId.trim()
          ? body.clientOrderId.trim()
          : typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
            ? body.idempotencyKey.trim()
            : '';

      if (cleanClientOrderId) {
        const existingIdempotent = db.orders.find((o) => o.id === cleanClientOrderId);
        if (existingIdempotent) {
          const shiftNow = resolveActiveShift(
            db.posShifts,
            body.registerId,
            body.shiftId,
            auth.username || auth.staffId
          );
          return NextResponse.json(
            {
              success: true,
              deduplicated: true,
              order: canSeeProfits
                ? existingIdempotent
                : sanitizeOrderForCashier(existingIdempotent),
              activeShift: canSeeProfits
                ? shiftNow || null
                : sanitizeShiftForCashier(shiftNow || null),
            },
            { status: 200 }
          );
        }
      }

      const rawItems: CartItem[] = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) {
        return NextResponse.json(
          { error: 'فاتورة الكاشير فارغة، يرجى إضافة صنف واحد على الأقل' },
          { status: 400 }
        );
      }

      // Validate showInPos channel restriction for all items
      for (const item of rawItems) {
        if (item.productId && !item.productId.startsWith('flash-promo-') && !item.isPartitionedBox && !item.isCustomMix && !item.isCoffeeBlend) {
          const prod = db.products.find((p) => p.id === item.productId);
          if (prod && prod.showInPos === false) {
            return NextResponse.json(
              { error: 'المنتج غير مصرح ببيعه عبر الكاشير' },
              { status: 400 }
            );
          }
        }
        if (item.isPartitionedBox && Array.isArray(item.partitionedSlots)) {
          for (const slot of item.partitionedSlots) {
            const slotProd = db.products.find((p) => p.id === slot.productId);
            if (slotProd && slotProd.showInPos === false) {
              return NextResponse.json(
                { error: 'المنتج غير مصرح ببيعه عبر الكاشير' },
                { status: 400 }
              );
            }
          }
        }
        if (item.isCustomMix && Array.isArray(item.customBreakdown)) {
          for (const b of item.customBreakdown) {
            const bProd = db.products.find((p) => p.id === b.productId);
            if (bProd && bProd.showInPos === false) {
              return NextResponse.json(
                { error: 'المنتج غير مصرح ببيعه عبر الكاشير' },
                { status: 400 }
              );
            }
          }
        }
      }

      // POS In-Store Physical Stock Availability Guard
      if (body.allowOutOfStockOverride !== true) {
        for (const item of rawItems) {
          if (item.productId && !item.productId.startsWith('flash-promo-') && !item.isPartitionedBox && !item.isCustomMix && !item.isCoffeeBlend) {
            const prod = db.products.find((p) => p.id === item.productId);
            if (prod && (prod.inStock === false || (typeof prod.stockKg === 'number' && prod.stockKg <= 0))) {
              const unitTxt = isUnitProduct(prod) ? (prod.unitLabel?.trim() || 'قطعة') : 'كجم';
              return NextResponse.json(
                {
                  error: `عذراً، الصنف «${prod.name}» نافد تماماً من المخزون (الرصيد: 0 ${unitTxt}). يرجى مراجعة الرف أو تفعيل التجاوز الإداري.`,
                },
                { status: 400 }
              );
            }
          }
        }
      }

      let subtotal = 0;
      let rawCostTotal = 0;

      const verifiedItems: CartItem[] = rawItems.map((item) => {
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unitPrice = Math.max(1, Math.round(Number(item.unitPrice) || 0));
        const prod = db.products.find((p) => p.id === item.productId);

        let unitRawCost = Number(item.rawCostEgp) || 0;
        if (!unitRawCost) {
          if (item.isPartitionedBox && Array.isArray(item.partitionedSlots)) {
            const slotsCost = item.partitionedSlots.reduce((sum, s) => {
              const slotProd = db.products.find((p) => p.id === s.productId);
              const g = s.slotGrams || s.weightGrams || (item.partitionedBoxSize === 'roqan_4' ? 100 : 125);
              return sum + (slotProd ? getProductCostForWeight(slotProd, g) : 20);
            }, 0);
            unitRawCost = Math.round(slotsCost + (item.partitionedBoxSize === 'roqan_4' ? 10 : 15));
          } else if (item.isCustomMix && Array.isArray(item.customBreakdown)) {
            const cap = Number(item.boxCapacityGrams) || 500;
            unitRawCost = Math.round(
              item.customBreakdown.reduce((sum, b) => {
                const bProd = db.products.find((p) => p.id === b.productId);
                const g = b.weightGrams || (cap * (b.percentage || 0)) / 100;
                return sum + (bProd ? getProductCostForWeight(bProd, g) : 25);
              }, 0)
            );
          } else if (item.isCoffeeBlend && item.coffeeBlendSpec) {
            const coffeeProd =
              prod || db.products.find((p) => p.categoryId === 'cat-coffee-espresso');
            const g = item.coffeeBlendSpec.weightGrams || 250;
            unitRawCost = coffeeProd
              ? getProductCostForWeight(coffeeProd, g)
              : Math.round(unitPrice * 0.65);
          } else if (
            (item.isFlashPromo && item.flashPromoId) ||
            (typeof item.productId === 'string' && item.productId.startsWith('flash-promo-'))
          ) {
            const promoId =
              item.flashPromoId ||
              (typeof item.productId === 'string' ? item.productId.replace('flash-promo-', '') : '');
            const promoPool = db.flashPromotions || db.promotions || [];
            const matchedPromo = promoPool.find((p) => p.id === promoId);
            if (matchedPromo && typeof matchedPromo.totalRawCost === 'number') {
              unitRawCost = matchedPromo.totalRawCost;
            } else if (matchedPromo && Array.isArray(matchedPromo.items)) {
              unitRawCost = matchedPromo.items.reduce((sum, pi) => {
                const piProd = db.products.find((p) => p.id === pi.productId);
                const g = Number(pi.weightGrams) || 250;
                const q = Number(pi.quantity) || 1;
                const cost = piProd ? getProductCostForWeight(piProd, g) : Number(pi.unitCost) || 25;
                return sum + cost * q;
              }, matchedPromo.packagingCost || 10);
            } else {
              unitRawCost = Math.round(unitPrice * 0.7);
            }
          } else if (prod && item.customWeightGrams) {
            unitRawCost = getProductCostForWeight(prod, item.customWeightGrams);
          } else if (prod) {
            const resolvedVars = getResolvedProductWeights(prod);
            const matchedW =
              resolvedVars.find((w) => w.id === item.weightId || w.label === item.weightLabel) ||
              prod.weights?.find((w) => w.id === item.weightId);
            const grams = isUnitProduct(prod)
              ? (matchedW?.weightGrams || 1000)
              : (matchedW?.weightGrams || matchedW?.grams || 250);
            unitRawCost = getProductCostForWeight(prod, grams);
          } else {
            unitRawCost = Math.round(unitPrice * 0.7);
          }
        }

        subtotal += unitPrice * qty;
        rawCostTotal += unitRawCost * qty;

        return {
          ...item,
          productImage: getSafeImageUrl(item.productImage || prod?.image),
          unitPrice,
          quantity: qty,
          rawCostEgp: unitRawCost,
        };
      });

      // POS Coupon Code Validation (تفعيل الكوبونات على الكاشير)
      let couponDiscount = 0;
      let appliedCouponCode: string | undefined = undefined;
      if (typeof body.couponCode === 'string' && body.couponCode.trim()) {
        const cleanCode = body.couponCode.trim().toUpperCase();
        const matchedCoupon = (db.coupons || []).find(
          (c) => c.code.toUpperCase() === cleanCode
        );
        const validation = validateCoupon(matchedCoupon, subtotal);
        if (!validation.isValid) {
          return NextResponse.json(
            { error: validation.error || 'كود الكوبون غير صالح' },
            { status: 400 }
          );
        }
        couponDiscount = validation.discountAmount;
        appliedCouponCode = matchedCoupon!.code;
        matchedCoupon!.usedCount = (matchedCoupon!.usedCount || 0) + 1;
      }

      const manualDiscount = Math.max(0, Math.round(Number(body.discountAmount) || 0));
      const discountAmount = Math.max(
        0,
        Math.min(subtotal, couponDiscount > 0 && manualDiscount === couponDiscount ? couponDiscount : couponDiscount + manualDiscount)
      );
      const shippingCost = Math.max(0, Math.round(Number(body.shippingCost) || 0));

      // Optional Egyptian VAT (14%) & ETA E-Receipt Calculation
      const taxBreakdown = calculateOrderTaxBreakdown(
        verifiedItems,
        db.products,
        discountAmount,
        db.settings
      );

      const totalBeforeWallet = Math.max(
        0,
        Math.round((subtotal - discountAmount + shippingCost + taxBreakdown.totalAddition) * 100) / 100
      );

      const paymentMethod: PaymentMethod =
        (String(body.paymentMethod || 'cod') === 'cash' ? 'cod' : body.paymentMethod || 'cod') as PaymentMethod;
      const rawSplits: PosPaymentSplit[] = Array.isArray(body.paymentSplits)
        ? body.paymentSplits
            .map((sp: PosPaymentSplit) => ({
              method: (String(sp.method) === 'cash' ? 'cod' : sp.method) as PosPaymentSplit['method'],
              amount: Math.max(0, Math.round((Number(sp.amount) || 0) * 100) / 100),
              reference: sp.reference?.trim() || undefined,
            }))
            .filter((sp: PosPaymentSplit) => sp.amount > 0)
        : [];

      // Optional Customer & VIP Wallet + Credit Sales Integration
      let customerPhone = (body.customerPhone || '').trim();
      let customerName = (body.customerName || 'عميل الفرع المباشر').trim();
      let vipWalletRedeemed = 0;
      let vipCashbackEarned = 0;
      let updatedVipMember: VipMember | null = null;
      const orderNumber = `POS-${Math.floor(1000 + Math.random() * 9000)}`;

      const phoneCheck = customerPhone ? validateEgyptianPhone(customerPhone) : null;
      if (phoneCheck?.isValid) {
        customerPhone = phoneCheck.normalized;
      }

      if (customerPhone) {
        let memberIdx = db.vipMembers.findIndex((m) => m.phone === customerPhone);
        if (memberIdx === -1 && phoneCheck?.isValid) {
          const newMember: VipMember = {
            id: `vip-${Date.now()}`,
            membershipCode: `VIP-${customerPhone.slice(-4)}`,
            qrCodeValue: `VIP-${customerPhone}`,
            name: customerName,
            customerName,
            phone: customerPhone,
            walletBalance: 0,
            pointsBalance: 0,
            totalSpent: 0,
            ordersCount: 0,
            tier: 'Gold VIP',
            joinedAt: new Date().toISOString(),
            transactions: [],
          };
          db.vipMembers.unshift(newMember);
          memberIdx = 0;
        }

        if (memberIdx !== -1) {
          const member = db.vipMembers[memberIdx];
          const currentBal = member.pointsBalance ?? member.walletBalance ?? 0;

          const splitVipAmount =
            paymentMethod === 'split'
              ? rawSplits
                  .filter((s) => s.method === 'vip_wallet')
                  .reduce((sum, s) => sum + s.amount, 0)
              : 0;

          if (splitVipAmount > 0) {
            if (splitVipAmount > currentBal) {
              return NextResponse.json(
                { error: `رصيد محفظة العميل (${currentBal} ج.م) أقل من المبلغ المطلوب خصمه (${splitVipAmount} ج.م)` },
                { status: 400 }
              );
            }
            vipWalletRedeemed = splitVipAmount;
          } else if ((body.useVipWallet || paymentMethod === 'vip_wallet') && currentBal > 0) {
            vipWalletRedeemed = Math.min(currentBal, totalBeforeWallet);
          }

          updatedVipMember = member;
        }
      }

      const finalTotal =
        paymentMethod === 'split'
          ? totalBeforeWallet
          : Math.max(0, Math.round((totalBeforeWallet - vipWalletRedeemed) * 100) / 100);

      // Validate Split Payments Sum
      if (paymentMethod === 'split') {
        if (rawSplits.length < 2) {
          return NextResponse.json(
            { error: 'الدفع المقسم يتطلب توزيع المبلغ على وسيلتي دفع على الأقل' },
            { status: 400 }
          );
        }
        const splitSum = Math.round(rawSplits.reduce((s, p) => s + p.amount, 0) * 100) / 100;
        if (Math.abs(splitSum - finalTotal) > 0.5) {
          return NextResponse.json(
            {
              error: `مجموع مبالغ الدفع المقسم (${splitSum} ج.م) لا يطابق إجمالي الفاتورة (${finalTotal} ج.م)`,
            },
            { status: 400 }
          );
        }
      }

      // Credit Sales (البيع الآجل) Master Admin Lock & Credit Limit Validation
      const creditPortion =
        paymentMethod === 'credit'
          ? finalTotal
          : paymentMethod === 'split'
            ? rawSplits
                .filter((s) => s.method === 'credit')
                .reduce((sum, s) => sum + s.amount, 0)
            : 0;

      if (creditPortion > 0) {
        if (!db.settings?.enableCreditSales) {
          return NextResponse.json(
            {
              error:
                'البيع الآجل متوقف ومقفل حالياً بقرار الإدارة — لا يمكن إصدار فاتورة آجلة إلا بعد تفعيل الميزة من إعدادات الأدمن.',
            },
            { status: 403 }
          );
        }

        if (!phoneCheck?.isValid || !updatedVipMember) {
          return NextResponse.json(
            { error: 'يتطلب البيع الآجل إدخال رقم هاتف مصري صحيح مسجل للعميل' },
            { status: 400 }
          );
        }

        if (db.settings.creditSalesRequireApproval !== false && !updatedVipMember.allowCredit) {
          return NextResponse.json(
            {
              error: `العميل «${updatedVipMember.customerName || updatedVipMember.phone}» غير معتمد للبيع الآجل — يجب تفعيل صلاحية الآجل له من لوحة الإدارة أولاً.`,
            },
            { status: 403 }
          );
        }

        const currentDebt = Number(updatedVipMember.creditBalanceDue || 0);
        const maxLimit = Number(updatedVipMember.creditLimit || 0);
        if (maxLimit > 0 && currentDebt + creditPortion > maxLimit) {
          return NextResponse.json(
            {
              error: `تجاوز الحد الائتماني المسموح للعميل (${maxLimit} ج.م) — المديونية الحالية: ${currentDebt} ج.م والمطلوب إضافته: ${creditPortion} ج.م`,
            },
            { status: 400 }
          );
        }

        updatedVipMember.creditBalanceDue = Math.round((currentDebt + creditPortion) * 100) / 100;
        if (!Array.isArray(updatedVipMember.creditTransactions)) {
          updatedVipMember.creditTransactions = [];
        }
        updatedVipMember.creditTransactions.unshift({
          id: `cr-sale-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'credit_sale',
          amount: creditPortion,
          orderNumber,
          recordedBy: auth.displayName || auth.username || 'كاشير الفرع',
          notes: `فاتورة مبيعات آجلة #${orderNumber}`,
        });
      }

      // Finalize VIP Wallet & Cashback Ledger Updates
      if (updatedVipMember) {
        const currentBal = updatedVipMember.pointsBalance ?? updatedVipMember.walletBalance ?? 0;
        const paidNow = Math.max(0, finalTotal - creditPortion - (paymentMethod === 'split' ? vipWalletRedeemed : 0));
        const eligibleForCashback = Math.max(
          0,
          subtotal - discountAmount - vipWalletRedeemed - creditPortion
        );
        vipCashbackEarned = calculateVipCashback(
          eligibleForCashback,
          db.settings.vipMinOrderForCashback || 150,
          db.settings.vipCashbackPercent || 5
        );

        const newBalance = Math.max(0, currentBal - vipWalletRedeemed + vipCashbackEarned);
        updatedVipMember.pointsBalance = newBalance;
        updatedVipMember.walletBalance = newBalance;
        updatedVipMember.totalSpent += paidNow;
        updatedVipMember.ordersCount += 1;
        if (customerName && customerName !== 'عميل الفرع المباشر') {
          updatedVipMember.name = customerName;
          updatedVipMember.customerName = customerName;
        }
        if (updatedVipMember.totalSpent >= 1500) {
          updatedVipMember.tier = 'Royal Platinum';
        }

        if (vipWalletRedeemed > 0) {
          updatedVipMember.transactions.unshift({
            id: `tx-pos-red-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'cashier_debit',
            amount: vipWalletRedeemed,
            amountEgp: vipWalletRedeemed,
            orderNumber,
            description: `خصم رصيد محفظة VIP على كاشير المحل (${orderNumber})`,
          });
        }

        if (vipCashbackEarned > 0) {
          updatedVipMember.transactions.unshift({
            id: `tx-pos-earn-${Date.now() + 1}`,
            date: new Date().toISOString(),
            type: 'cashier_credit',
            amount: vipCashbackEarned,
            amountEgp: vipCashbackEarned,
            orderNumber,
            description: `إضافة 5% كاش باك فوري من كاشير المحل (${orderNumber})`,
          });
        }
      }

      const cashPortion =
        paymentMethod === 'cod'
          ? finalTotal
          : paymentMethod === 'split'
            ? rawSplits.filter((s) => s.method === 'cod').reduce((sum, s) => sum + s.amount, 0)
            : 0;

      const cashTendered =
        paymentMethod === 'cod'
          ? Math.max(finalTotal, Math.round(Number(body.cashTendered) || finalTotal))
          : paymentMethod === 'split'
            ? Math.max(cashPortion, Math.round(Number(body.cashTendered) || cashPortion))
            : finalTotal;
      const changeDue =
        paymentMethod === 'cod'
          ? Math.max(0, cashTendered - finalTotal)
          : paymentMethod === 'split'
            ? Math.max(0, cashTendered - cashPortion)
            : 0;

      const netRevenueExTax = taxBreakdown.taxEnabled
        ? finalTotal - taxBreakdown.taxAmount
        : finalTotal;
      const netProfitEgp = Math.round(netRevenueExTax - shippingCost - rawCostTotal);

      const posOrderType: PosOrderType = body.posOrderType || 'counter_takeaway';
      const chairNumber = body.chairNumber ? (Number(body.chairNumber) as 1 | 2 | 3 | 4) : undefined;
      const activeShift = resolveActiveShift(
        db.posShifts,
        body.registerId,
        body.shiftId,
        auth.username || auth.staffId
      );
      const createdAtIso = new Date().toISOString();

      const etaReceiptUuid = taxBreakdown.taxEnabled
        ? generateEtaReceiptUuid(
            orderNumber,
            db.settings.taxRegistrationNumber,
            finalTotal,
            createdAtIso
          )
        : undefined;

      const addressLabel =
        posOrderType === 'glass_bar_dine_in'
          ? `داخل صالة الفرع — طاولة/كرسي رقم ${chairNumber || 1}`
          : posOrderType === 'phone_delivery'
            ? body.address || `توصيل دليفري سريع — ${db.settings.cityName || 'المدينة'}`
            : 'استلام فوري من كاشير الفرع';

      if (
        db.settings.requireElectronicPaymentRef &&
        (paymentMethod === 'vodafone_cash' || paymentMethod === 'instapay') &&
        (!body.paymentReference || !String(body.paymentReference).trim())
      ) {
        return NextResponse.json(
          { error: 'يرجى إدخال رقم العملية المرجعي لتحويل فودافون كاش أو إنستاباي قبل إصدار الفاتورة' },
          { status: 400 }
        );
      }

      const createdOrder: Order = {
        id: cleanClientOrderId || `pos-ord-${Date.now()}`,
        orderNumber,
        orderSource: 'pos',
        posOrderType,
        chairNumber,
        registerId: activeShift?.registerId || body.registerId || 'reg-1',
        registerName: activeShift?.registerName || body.registerName,
        cashierId: auth.username || auth.staffId || activeShift?.cashierId || 'cashier_pos',
        cashierName:
          body.cashierName ||
          auth.displayName ||
          activeShift?.cashierName ||
          auth.username ||
          'كاشير نقطة البيع',
        shiftId: activeShift?.id,
        customerName,
        customerPhone: customerPhone || '01000000000',
        governorate: db.settings.cityName || 'الفرع الرئيسي',
        address: addressLabel,
        notes: body.notes?.trim() || undefined,
        deliveryMethod: posOrderType === 'phone_delivery' ? 'bandar_fast' : 'store_pickup',
        items: verifiedItems,
        subtotal,
        shippingCost,
        discountAmount,
        couponCode: appliedCouponCode,
        vipRedeemedAmount: vipWalletRedeemed,
        vipWalletRedeemed,
        vipCashbackEarned,
        ...(taxBreakdown.taxEnabled
          ? {
              taxAmount: taxBreakdown.taxAmount,
              taxRatePercent: taxBreakdown.taxRatePercent,
              taxInclusive: taxBreakdown.taxInclusive,
              etaReceiptUuid,
            }
          : {}),
        total: finalTotal,
        cashTendered,
        changeDue,
        rawCostTotal,
        netProfitEgp,
        paymentMethod,
        ...(paymentMethod === 'split' ? { paymentSplits: rawSplits } : {}),
        ...(creditPortion > 0 ? { creditDueAmount: creditPortion, creditPaidAmount: 0 } : {}),
        paymentReference: body.paymentReference?.trim() || undefined,
        status: posOrderType === 'phone_delivery' ? 'roasting_packing' : 'delivered',
        createdAt: createdAtIso,
      };

      // Atomic Stock Depletion for POS Sale
      const crossedLowStockAlerts: LowStockAlertItem[] = [];
      for (const item of verifiedItems) {
        const qty = item.quantity || 1;
        if (item.isPartitionedBox && Array.isArray(item.partitionedSlots)) {
          for (const slot of item.partitionedSlots) {
            const slotProd = db.products.find((p) => p.id === slot.productId);
            if (slotProd) {
              const slotGrams = slot.slotGrams || slot.weightGrams || (item.partitionedBoxSize === 'roqan_4' ? 100 : 125);
              const consumedKg = (slotGrams * qty) / 1000;
              const currentStock = typeof slotProd.stockKg === 'number' ? slotProd.stockKg : 50;
              slotProd.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
              if (slotProd.stockKg <= 0) slotProd.inStock = false;
              recordPosLowStockCrossing(slotProd, currentStock, crossedLowStockAlerts);
            }
          }
        } else if (item.isCustomMix && Array.isArray(item.customBreakdown)) {
          for (const b of item.customBreakdown) {
            const bProd = db.products.find((p) => p.id === b.productId);
            if (bProd) {
              const constituentGrams = b.weightGrams || ((b.percentage || 0) * (item.boxCapacityGrams || 500) / 100);
              const consumedKg = (constituentGrams * qty) / 1000;
              const currentStock = typeof bProd.stockKg === 'number' ? bProd.stockKg : 50;
              bProd.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
              if (bProd.stockKg <= 0) bProd.inStock = false;
              recordPosLowStockCrossing(bProd, currentStock, crossedLowStockAlerts);
            }
          }
        } else if (item.isCoffeeBlend && item.coffeeBlendSpec) {
          const totalGrams = item.coffeeBlendSpec.weightGrams || 250;
          const prod = db.products.find((p) => p.id === item.productId || p.categoryId === 'cat-coffee-espresso');
          if (prod) {
            const consumedKg = (totalGrams * qty) / 1000;
            const currentStock = typeof prod.stockKg === 'number' ? prod.stockKg : 50;
            prod.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
            if (prod.stockKg <= 0) prod.inStock = false;
            recordPosLowStockCrossing(prod, currentStock, crossedLowStockAlerts);
          }
        } else if (
          (item.isFlashPromo && item.flashPromoId) ||
          (typeof item.productId === 'string' && item.productId.startsWith('flash-promo-'))
        ) {
          const promoId =
            item.flashPromoId ||
            (typeof item.productId === 'string' ? item.productId.replace('flash-promo-', '') : '');
          const promoPool = db.flashPromotions || db.promotions || [];
          const promo = promoPool.find((fp) => fp.id === promoId);
          if (promo && Array.isArray(promo.items) && promo.items.length > 0) {
            for (const pi of promo.items) {
              const promoProd = db.products.find((p) => p.id === pi.productId);
              if (promoProd) {
                const itemGrams = (Number(pi.weightGrams) || 250) * (Number(pi.quantity) || 1);
                const consumedKg = (itemGrams * qty) / 1000;
                const currentStock = typeof promoProd.stockKg === 'number' ? promoProd.stockKg : 50;
                promoProd.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
                if (promoProd.stockKg <= 0) promoProd.inStock = false;
                recordPosLowStockCrossing(promoProd, currentStock, crossedLowStockAlerts);
              }
            }
          }
        } else {
          const prod = db.products.find((p) => p.id === item.productId);
          if (prod) {
            const resolvedVars = getResolvedProductWeights(prod);
            const matchedW =
              resolvedVars.find((w) => w.id === item.weightId || w.label === item.weightLabel) ||
              prod.weights?.find((w) => w.id === item.weightId || w.label === item.weightLabel);
            const consumedKg = isUnitProduct(prod)
              ? (matchedW?.unitsCount || (matchedW?.weightGrams ? Math.max(1, Math.round(matchedW.weightGrams / 1000)) : 1)) * qty
              : ((item.customWeightGrams || matchedW?.weightGrams || matchedW?.grams || 250) * qty) / 1000;
            const currentStock = typeof prod.stockKg === 'number' ? prod.stockKg : 50;
            prod.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
            if (prod.stockKg <= 0) prod.inStock = false;
            recordPosLowStockCrossing(prod, currentStock, crossedLowStockAlerts);
          }
        }
      }

      db.orders.unshift(createdOrder);

      if (crossedLowStockAlerts.length > 0) {
        sendStoreTelegramAlert(db.settings, 'low_stock', {
          items: crossedLowStockAlerts,
          sourceLabel: `فاتورة كاشير الفرع #${orderNumber}`,
        }).catch((e) => console.error('Telegram POS low-stock alert error:', e));
      }

      // Update Active Shift Metrics (Supports Single Tender, Credit & Split Payments)
      if (activeShift) {
        activeShift.ordersCount += 1;
        activeShift.totalRevenue += finalTotal;
        activeShift.totalRawCost += rawCostTotal;
        activeShift.totalNetProfit += netProfitEgp;
        activeShift.vipRedeemedTotal += vipWalletRedeemed;
        activeShift.vipCashbackIssuedTotal += vipCashbackEarned;

        if (paymentMethod === 'split') {
          for (const sp of rawSplits) {
            if (sp.method === 'cod') {
              activeShift.cashSales = (activeShift.cashSales || 0) + sp.amount;
              activeShift.cashSalesTotal = (activeShift.cashSalesTotal || 0) + sp.amount;
            } else if (sp.method === 'card') {
              activeShift.cardSales = (activeShift.cardSales || 0) + sp.amount;
              activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + sp.amount;
            } else if (sp.method === 'vodafone_cash') {
              activeShift.cardSales = (activeShift.cardSales || 0) + sp.amount;
              activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + sp.amount;
              activeShift.vodafoneCashTotal += sp.amount;
            } else if (sp.method === 'instapay') {
              activeShift.cardSales = (activeShift.cardSales || 0) + sp.amount;
              activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + sp.amount;
              activeShift.instapayTotal += sp.amount;
            } else if (sp.method === 'credit') {
              activeShift.creditSalesTotal = (activeShift.creditSalesTotal || 0) + sp.amount;
            }
          }
        } else if (paymentMethod === 'cod') {
          activeShift.cashSales = (activeShift.cashSales || 0) + finalTotal;
          activeShift.cashSalesTotal = (activeShift.cashSalesTotal || 0) + finalTotal;
        } else if (paymentMethod === 'card') {
          activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
          activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + finalTotal;
        } else if (paymentMethod === 'vodafone_cash') {
          activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
          activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + finalTotal;
          activeShift.vodafoneCashTotal += finalTotal;
        } else if (paymentMethod === 'instapay') {
          activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
          activeShift.cardSalesTotal = (activeShift.cardSalesTotal || 0) + finalTotal;
          activeShift.instapayTotal += finalTotal;
        } else if (paymentMethod === 'credit') {
          activeShift.creditSalesTotal = (activeShift.creditSalesTotal || 0) + finalTotal;
        }

        // computeExpectedDrawerCash handles starting/cash/riderCodSettledTotal/expenses
        // cash sales included in computeExpectedDrawerCash
        // expenses deducted in computeExpectedDrawerCash
        activeShift.expectedCash = computeExpectedDrawerCash(activeShift);
        activeShift.expectedCashInDrawer = activeShift.expectedCash;
      }

      return NextResponse.json(
        {
          success: true,
          order: canSeeProfits ? createdOrder : sanitizeOrderForCashier(createdOrder),
          updatedVipMember,
          activeShift: canSeeProfits
            ? activeShift || null
            : sanitizeShiftForCashier(activeShift || null),
        },
        { status: 201 }
      );
    });
  } catch (error) {
    console.error('POST /api/pos error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إصدار فاتورة الكاشير' },
      { status: 500 }
    );
  }
}
