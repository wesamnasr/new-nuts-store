import { NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import {
  CartItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PosExpense,
  PosOrderType,
  PosShift,
  VipMember,
} from '@/types/store';
import {
  calculateVipCashback,
  getProductCostForWeight,
} from '@/lib/pricing';
import { validateEgyptianPhone } from '@/lib/validation';
import { getSafeImageUrl } from '@/lib/defaults';
import { verifyAdminRequest } from '@/lib/auth';

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

function sanitizeShiftForCashier(shift: PosShift | null): PosShift | null {
  if (!shift) return null;
  const copy = { ...shift };
  delete (copy as any).totalRawCost;
  delete (copy as any).totalNetProfit;
  return copy;
}

export async function GET(request?: Request) {
  try {
    const auth = request
      ? verifyAdminRequest(request)
      : { isAuthenticated: false, role: undefined };

    if (auth.isAuthenticated && auth.role === 'supplier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: المورد غير مصرح له بالدخول إلى نظام الكاشير (403 Forbidden)' },
        { status: 403 }
      );
    }

    const canSeeProfits =
      auth.isAuthenticated &&
      (auth.role === 'super_admin' || auth.role === 'accountant');

    const db = await getDbAsync();
    const rawShifts = db.posShifts || [];
    const posExpenses = db.posExpenses || [];
    const rawActiveShift = rawShifts.find((s) => s.status === 'open') || rawShifts[0] || null;

    const allOrders = db.orders || [];
    const rawRecentPosOrders = allOrders
      .filter((o) => o.orderSource === 'pos' || o.orderNumber?.startsWith('POS-'))
      .slice(0, 40);
    const rawOnlineQueueOrders = allOrders
      .filter((o) => o.orderSource !== 'pos' && !o.orderNumber?.startsWith('POS-'))
      .slice(0, 40);

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
    const auth = verifyAdminRequest(request);
    if (auth.isAuthenticated && auth.role === 'supplier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: المورد غير مصرح له بإصدار فواتير الكاشير (403 Forbidden)' },
        { status: 403 }
      );
    }
    const canSeeProfits =
      auth.isAuthenticated &&
      (auth.role === 'super_admin' || auth.role === 'accountant');

    const body = await request.json();
    const action = body.action || 'create_invoice';
    const db = await getDbAsync();

    if (!Array.isArray(db.posShifts)) db.posShifts = [];
    if (!Array.isArray(db.posExpenses)) db.posExpenses = [];
    if (!Array.isArray(db.vipMembers)) db.vipMembers = [];
    if (!Array.isArray(db.orders)) db.orders = [];

    // 1. OPEN NEW SHIFT
    if (action === 'open_shift') {
      const cashierName = (body.cashierName || 'كاشير فرع بني مزار').trim();
      const shiftPeriod = body.shiftPeriod || 'الوردية الصباحية';
      const openingCash = Math.max(0, Number(body.openingCash) || 0);

      // Close any existing open shift first
      for (const s of db.posShifts) {
        if (s.status === 'open') {
          s.status = 'closed';
          s.closedAt = new Date().toISOString();
          s.actualClosingCash = s.expectedCashInDrawer;
          s.cashDifference = 0;
        }
      }

      const shiftNum = 101 + db.posShifts.length;
      const newShift: PosShift = {
        id: `shift-${Date.now()}`,
        shiftNumber: `SHIFT-${shiftNum}`,
        cashierName,
        shiftPeriod,
        status: 'open',
        openingCash,
        cashSalesTotal: 0,
        vodafoneCashTotal: 0,
        instapayTotal: 0,
        vipRedeemedTotal: 0,
        vipCashbackIssuedTotal: 0,
        expensesTotal: 0,
        expectedCashInDrawer: openingCash,
        ordersCount: 0,
        totalRevenue: 0,
        totalRawCost: 0,
        totalNetProfit: 0,
        openedAt: new Date().toISOString(),
        notes: body.notes?.trim() || undefined,
      };

      db.posShifts.unshift(newShift);
      await saveDbAsync(db);
      return NextResponse.json({
        success: true,
        activeShift: canSeeProfits ? newShift : sanitizeShiftForCashier(newShift),
      });
    }

    // 2. CLOSE ACTIVE SHIFT (Z-REPORT)
    if (action === 'close_shift') {
      const activeShift = db.posShifts.find((s) => s.status === 'open');
      if (!activeShift) {
        return NextResponse.json(
          { error: 'لا توجد وردية مفتوحة حالياً لتقفيلها' },
          { status: 400 }
        );
      }

      const actualClosingCash =
        body.actualClosingCash !== undefined
          ? Math.max(0, Number(body.actualClosingCash) || 0)
          : activeShift.expectedCashInDrawer;

      activeShift.status = 'closed';
      activeShift.closedAt = new Date().toISOString();
      activeShift.actualClosingCash = actualClosingCash;
      activeShift.cashDifference = Math.round(
        actualClosingCash - activeShift.expectedCashInDrawer
      );
      if (body.notes) {
        activeShift.notes = body.notes.trim();
      }

      await saveDbAsync(db);
      return NextResponse.json({
        success: true,
        closedShift: canSeeProfits ? activeShift : sanitizeShiftForCashier(activeShift),
      });
    }

    // 3. ADD PETTY CASH EXPENSE FROM DRAWER
    if (action === 'add_expense') {
      const title = (body.title || '').trim();
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
        notes: body.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      db.posExpenses.unshift(newExpense);

      if (activeShift) {
        activeShift.expensesTotal += amount;
        activeShift.expectedCashInDrawer = Math.max(
          0,
          activeShift.openingCash + activeShift.cashSalesTotal - activeShift.expensesTotal
        );
      }

      await saveDbAsync(db);
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
      order.status = status;
      await saveDbAsync(db);
      return NextResponse.json({
        success: true,
        order: canSeeProfits ? order : sanitizeOrderForCashier(order),
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

    let subtotal = 0;
    let rawCostTotal = 0;

    const verifiedItems: CartItem[] = rawItems.map((item) => {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitPrice = Math.max(1, Math.round(Number(item.unitPrice) || 0));
      const prod = db.products.find((p) => p.id === item.productId);

      let unitRawCost = Number(item.rawCostEgp) || 0;
      if (!unitRawCost) {
        if (prod && item.customWeightGrams) {
          unitRawCost = getProductCostForWeight(prod, item.customWeightGrams);
        } else if (prod) {
          const matchedW = prod.weights.find((w) => w.id === item.weightId);
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
      cashierName: body.cashierName || activeShift?.cashierName || 'كاشير فرع بني مزار',
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

    db.orders.unshift(createdOrder);

    // Update Active Shift Metrics
    if (activeShift) {
      activeShift.ordersCount += 1;
      activeShift.totalRevenue += finalTotal;
      activeShift.totalRawCost += rawCostTotal;
      activeShift.totalNetProfit += netProfitEgp;
      activeShift.vipRedeemedTotal += vipWalletRedeemed;
      activeShift.vipCashbackIssuedTotal += vipCashbackEarned;

      if (paymentMethod === 'cod') {
        activeShift.cashSalesTotal += finalTotal;
      } else if (paymentMethod === 'vodafone_cash') {
        activeShift.vodafoneCashTotal += finalTotal;
      } else if (paymentMethod === 'instapay') {
        activeShift.instapayTotal += finalTotal;
      }

      activeShift.expectedCashInDrawer = Math.max(
        0,
        activeShift.openingCash + activeShift.cashSalesTotal - activeShift.expensesTotal
      );
    }

    await saveDbAsync(db);

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
  } catch (error) {
    console.error('POST /api/pos error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إصدار فاتورة الكاشير' },
      { status: 500 }
    );
  }
}
