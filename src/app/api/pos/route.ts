import { NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import {
  CartItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PosExpense,
  PosOrderType,
  PosShift,
  Product,
  VipMember,
} from '@/types/store';
import {
  calculateVipCashback,
  getProductCostForWeight,
} from '@/lib/pricing';
import { validateEgyptianPhone } from '@/lib/validation';
import { getSafeImageUrl } from '@/lib/defaults';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';
import { sendStoreTelegramAlert, type LowStockAlertItem } from '@/lib/telegram';
import { reverseOrderEffects, reapplyOrderEffects } from '@/lib/order-reversal';

export const dynamic = 'force-dynamic';

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
  const exp = Number(shift.expenses ?? shift.expensesTotal ?? 0);
  return Math.max(0, Math.round((starting + cash + settledCod - exp) * 100) / 100);
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
    const rawActiveShift = rawShifts.find((s) => s.status === 'open') || rawShifts[0] || null;

    const allOrders = db.orders || [];
    const rawRecentPosOrders = allOrders
      .filter((o) => o.orderSource === 'pos' || o.orderNumber?.startsWith('POS-'))
      .slice(0, 200);
    const rawOnlineQueueOrders = allOrders
      .filter((o) => o.orderSource !== 'pos' && !o.orderNumber?.startsWith('POS-'))
      .slice(0, 200);

    return NextResponse.json({
      activeShift: canSeeProfits ? rawActiveShift : sanitizeShiftForCashier(rawActiveShift),
      posShifts: canSeeProfits
        ? rawShifts
        : rawShifts.map((s) => sanitizeShiftForCashier(s)!),
      posExpenses,
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
      if (!Array.isArray(db.vipMembers)) db.vipMembers = [];
      if (!Array.isArray(db.orders)) db.orders = [];

    // 1. OPEN NEW SHIFT
    if (action === 'open_shift') {
      const cashierName = (
        body.cashierName ||
        auth.displayName ||
        auth.username ||
        'كاشير فرع بني مزار'
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

      // Close any existing open shift first
      for (const s of db.posShifts) {
        if (s.status === 'open') {
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
        id: `shift-${Date.now()}`,
        shiftNumber: `SHIFT-${shiftNum}`,
        cashierId,
        cashierName,
        shiftPeriod,
        status: 'open',
        startingCash,
        openingCash,
        cashSales: 0,
        cashSalesTotal: 0,
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
      return NextResponse.json({
        success: true,
        activeShift: canSeeProfits ? newShift : sanitizeShiftForCashier(newShift),
      });
    }

    // 2. CLOSE ACTIVE SHIFT (Z-REPORT & RECONCILIATION)
    if (action === 'close_shift') {
      const activeShift = db.posShifts.find((s) => s.status === 'open');
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
      const variance = Math.round(actualCash - expectedCash);

      activeShift.status = 'closed';
      activeShift.endTime = new Date().toISOString();
      activeShift.closedAt = activeShift.endTime;
      activeShift.actualCash = actualCash;
      activeShift.actualClosingCash = actualCash;
      activeShift.variance = variance;
      activeShift.cashDifference = variance;

      // Telegram Z-Report Notification Trigger (non-blocking)
      sendStoreTelegramAlert(db.settings, 'z_report', activeShift).catch((e: any) =>
        console.error('Telegram Z-Report error:', e)
      );
      if (body.notes) {
        activeShift.notes = body.notes.trim();
      }

      return NextResponse.json({
        success: true,
        closedShift: canSeeProfits ? activeShift : sanitizeShiftForCashier(activeShift),
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

      const activeShift = db.posShifts.find((s) => s.status === 'open');
      const newExpense: PosExpense = {
        id: `exp-${Date.now()}`,
        shiftId: activeShift?.id,
        title,
        amount,
        category: body.category || 'other',
        createdBy: auth.displayName || auth.username || 'كاشير فرع بني مزار',
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
      if (status === 'delivered' && !order.deliveredAt) {
        order.deliveredAt = new Date().toISOString();
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
      const activeShift = db.posShifts.find((s) => s.status === 'open');
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

    // 4.5 SYNC OFFLINE INVOICES QUEUE (POS EMERGENCY OFFLINE MODE)
    if (action === 'sync_offline_invoices' || action === 'sync_offline_queue') {
      const incomingInvoices = Array.isArray(body.invoices) ? body.invoices : [];
      if (incomingInvoices.length === 0) {
        return NextResponse.json({ success: true, syncedCount: 0, syncedOrders: [] });
      }

      const syncedOrders: Order[] = [];
      const crossedLowStockAlerts: LowStockAlertItem[] = [];
      const activeShift = db.posShifts.find((s) => s.status === 'open');

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
          cashierId: auth.username || auth.staffId || activeShift?.cashierId || 'cashier_pos',
          cashierName: inv.cashierName || auth.displayName || activeShift?.cashierName || 'كاشير فرع بني مزار',
          shiftId: activeShift?.id,
          customerName: inv.customerName || 'عميل فرع بني مزار المباشر',
          customerPhone: inv.customerPhone || '01000000000',
          governorate: 'مركز بني مزار — فرع مسجد الزراعيين',
          address: inv.address || 'استلام فوري من كاشير المحل (أمام مسجد الزراعيين)',
          notes: inv.notes ? `[مزامنة طوارئ أوفلاين] ${inv.notes}` : '[مزامنة طوارئ أوفلاين]',
          deliveryMethod: inv.posOrderType === 'phone_delivery' ? 'bandar_fast' : 'store_pickup',
          items: verifiedItems,
          subtotal: inv.subtotal || subtotal,
          shippingCost: inv.shippingCost || 0,
          discountAmount: inv.discountAmount || 0,
          vipRedeemedAmount: inv.vipRedeemedAmount || 0,
          vipWalletRedeemed: inv.vipWalletRedeemed || 0,
          vipCashbackEarned: inv.vipCashbackEarned || 0,
          total: finalTotal,
          cashTendered: inv.cashTendered || finalTotal,
          changeDue: inv.changeDue || 0,
          rawCostTotal,
          netProfitEgp,
          paymentMethod,
          paymentReference: inv.paymentReference,
          status: 'delivered',
          createdAt: inv.createdAt || new Date().toISOString(),
        };

        // Stock depletion
        for (const item of verifiedItems) {
          const qty = item.quantity || 1;
          const prod = db.products.find((p) => p.id === item.productId);
          if (prod) {
            const matchedW = prod.weights?.find((w) => w.id === item.weightId || w.label === item.weightLabel);
            const grams = item.customWeightGrams || matchedW?.weightGrams || matchedW?.grams || 250;
            const consumedKg = (grams * qty) / 1000;
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
            return NextResponse.json(
              {
                error: `عذراً، الصنف «${prod.name}» نافد تماماً من صوامع الفرع (الرصيد: 0 كجم). يرجى مراجعة الرف أو تفعيل التجاوز الإداري.`,
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
          const matchedW = prod.weights?.find((w) => w.id === item.weightId);
          const grams = matchedW?.weightGrams || matchedW?.grams || 250;
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

    const discountAmount = Math.max(
      0,
      Math.min(subtotal, Math.round(Number(body.discountAmount) || 0))
    );
    const shippingCost = Math.max(0, Math.round(Number(body.shippingCost) || 0));
    const totalBeforeWallet = Math.max(0, subtotal - discountAmount + shippingCost);

    // Optional Customer & VIP Wallet Integration
    let customerPhone = (body.customerPhone || '').trim();
    let customerName = (body.customerName || 'عميل فرع بني مزار المباشر').trim();
    let vipWalletRedeemed = 0;
    let vipCashbackEarned = 0;
    let updatedVipMember: VipMember | null = null;

    if (customerPhone) {
      const phoneCheck = validateEgyptianPhone(customerPhone);
      if (phoneCheck.isValid) {
        customerPhone = phoneCheck.normalized;
      }

      let memberIdx = db.vipMembers.findIndex((m) => m.phone === customerPhone);
      if (memberIdx === -1 && phoneCheck.isValid) {
        // Auto-enroll customer at POS counter
        const newMember: VipMember = {
          id: `vip-${Date.now()}`,
          membershipCode: `HAFSA-VIP-${customerPhone.slice(-4)}`,
          qrCodeValue: `HAFSA-VIP-${customerPhone}`,
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

        if (body.useVipWallet && currentBal > 0) {
          vipWalletRedeemed = Math.min(currentBal, totalBeforeWallet);
        }

        const netAfterWallet = Math.max(0, totalBeforeWallet - vipWalletRedeemed);
        const eligibleForCashback = Math.max(0, subtotal - discountAmount - vipWalletRedeemed);
        vipCashbackEarned = calculateVipCashback(
          eligibleForCashback,
          db.settings.vipMinOrderForCashback || 150,
          db.settings.vipCashbackPercent || 5
        );

        const invoiceNumPreview = `POS-${Math.floor(1000 + Math.random() * 9000)}`;
        const newBalance = currentBal - vipWalletRedeemed + vipCashbackEarned;
        member.pointsBalance = newBalance;
        member.walletBalance = newBalance;
        member.totalSpent += netAfterWallet;
        member.ordersCount += 1;
        if (customerName && customerName !== 'عميل فرع بني مزار المباشر') {
          member.name = customerName;
          member.customerName = customerName;
        }
        if (member.totalSpent >= 1500) {
          member.tier = 'Royal Platinum';
        }

        if (vipWalletRedeemed > 0) {
          member.transactions.unshift({
            id: `tx-pos-red-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'cashier_debit',
            amount: vipWalletRedeemed,
            amountEgp: vipWalletRedeemed,
            orderNumber: invoiceNumPreview,
            description: `خصم رصيد محفظة VIP على كاشير المحل (${invoiceNumPreview})`,
          });
        }

        if (vipCashbackEarned > 0) {
          member.transactions.unshift({
            id: `tx-pos-earn-${Date.now() + 1}`,
            date: new Date().toISOString(),
            type: 'cashier_credit',
            amount: vipCashbackEarned,
            amountEgp: vipCashbackEarned,
            orderNumber: invoiceNumPreview,
            description: `إضافة 5% كاش باك فوري من كاشير المحل (${invoiceNumPreview})`,
          });
        }

        updatedVipMember = member;
      }
    }

    const finalTotal = Math.max(0, totalBeforeWallet - vipWalletRedeemed);
    const paymentMethod: PaymentMethod = body.paymentMethod || 'cod';
    const cashTendered =
      paymentMethod === 'cod'
        ? Math.max(finalTotal, Math.round(Number(body.cashTendered) || finalTotal))
        : finalTotal;
    const changeDue = Math.max(0, cashTendered - finalTotal);
    const netProfitEgp = Math.round(finalTotal - shippingCost - rawCostTotal);

    const posOrderType: PosOrderType = body.posOrderType || 'counter_takeaway';
    const chairNumber = body.chairNumber ? (Number(body.chairNumber) as 1 | 2 | 3 | 4) : undefined;
    const activeShift = db.posShifts.find((s) => s.status === 'open');
    const orderNumber = `POS-${Math.floor(1000 + Math.random() * 9000)}`;

    const addressLabel =
      posOrderType === 'glass_bar_dine_in'
        ? `البار الزجاجي داخل المحل — كرسي رقم ${chairNumber || 1}`
        : posOrderType === 'phone_delivery'
          ? body.address || 'توصيل دليفري سريع — بندر بني مزار'
          : 'استلام فوري من كاشير المحل (أمام مسجد الزراعيين)';

    const createdOrder: Order = {
      id: `pos-ord-${Date.now()}`,
      orderNumber,
      orderSource: 'pos',
      posOrderType,
      chairNumber,
      cashierId: auth.username || auth.staffId || activeShift?.cashierId || 'cashier_pos',
      cashierName:
        body.cashierName ||
        auth.displayName ||
        activeShift?.cashierName ||
        auth.username ||
        'كاشير فرع بني مزار',
      shiftId: activeShift?.id,
      customerName,
      customerPhone: customerPhone || '01000000000',
      governorate: 'مركز بني مزار — فرع مسجد الزراعيين',
      address: addressLabel,
      notes: body.notes?.trim() || undefined,
      deliveryMethod: posOrderType === 'phone_delivery' ? 'bandar_fast' : 'store_pickup',
      items: verifiedItems,
      subtotal,
      shippingCost,
      discountAmount,
      vipRedeemedAmount: vipWalletRedeemed,
      vipWalletRedeemed,
      vipCashbackEarned,
      total: finalTotal,
      cashTendered,
      changeDue,
      rawCostTotal,
      netProfitEgp,
      paymentMethod,
      paymentReference: body.paymentReference?.trim() || undefined,
      status: posOrderType === 'phone_delivery' ? 'roasting_packing' : 'delivered',
      createdAt: new Date().toISOString(),
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
          const matchedW = prod.weights?.find((w) => w.id === item.weightId || w.label === item.weightLabel);
          const grams = item.customWeightGrams || matchedW?.weightGrams || matchedW?.grams || 250;
          const consumedKg = (grams * qty) / 1000;
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

    // Update Active Shift Metrics
    if (activeShift) {
      activeShift.ordersCount += 1;
      activeShift.totalRevenue += finalTotal;
      activeShift.totalRawCost += rawCostTotal;
      activeShift.totalNetProfit += netProfitEgp;
      activeShift.vipRedeemedTotal += vipWalletRedeemed;
      activeShift.vipCashbackIssuedTotal += vipCashbackEarned;

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
