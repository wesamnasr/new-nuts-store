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
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';

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

export async function GET(request: Request) {
  try {
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول' },
        { status: 401 }
      );
    }

    const dbForGet = await getDbAsync();
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

    const db = await getDbAsync();
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

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول' },
        { status: 401 }
      );
    }

    const dbForGet = await getDbAsync();
    if (
      auth.role === 'supplier' &&
      !hasRolePermission('supplier', 'cashier_portal', dbForGet.settings) &&
      !hasRolePermission('supplier', 'accounting_portal', dbForGet.settings) &&
      !hasRolePermission('supplier', 'operations', dbForGet.settings)
    ) {
      return NextResponse.json(
        { error: 'عزل الأدوار: المورد غير مصرح له بإصدار فواتير الكاشير' },
        { status: 403 }
      );
    }

    if (auth.role === 'accountant' && !hasRolePermission('accountant', 'cashier_portal', dbForGet.settings)) {
      return NextResponse.json(
        { error: 'عزل الأدوار: المحاسب بصلاحية قراءة فقط وممنوع من إصدار فواتير الكاشير' },
        { status: 403 }
      );
    }

    const canSeeProfits =
      auth.isAuthenticated &&
      (auth.role === 'super_admin' || (auth.role as string) === 'admin');

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
      const cashierId = (body.cashierId || (auth as unknown as { username?: string }).username || 'cashier_pos').trim();
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
        cardSales: 0,
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
      await saveDbAsync(db);
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

      const starting = Number(activeShift.startingCash ?? activeShift.openingCash ?? 0);
      const cash = Number(activeShift.cashSales ?? activeShift.cashSalesTotal ?? 0);
      const exp = Number(activeShift.expenses ?? activeShift.expensesTotal ?? 0);
      const expectedCash = Math.max(0, starting + cash - exp);
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
        notes: body.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      db.posExpenses.unshift(newExpense);

      if (activeShift) {
        activeShift.expenses = (activeShift.expenses || 0) + amount;
        activeShift.expensesTotal = (activeShift.expensesTotal || 0) + amount;
        const starting = Number(activeShift.startingCash ?? activeShift.openingCash ?? 0);
        const cash = Number(activeShift.cashSales ?? activeShift.cashSalesTotal ?? 0);
        const exp = Number(activeShift.expenses ?? activeShift.expensesTotal ?? 0);
        activeShift.expectedCash = Math.max(0, starting + cash - exp);
        activeShift.expectedCashInDrawer = activeShift.expectedCash;
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

    // Atomic Stock Depletion for POS Sale
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
        }
      }
    }

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
        activeShift.cashSales = (activeShift.cashSales || 0) + finalTotal;
        activeShift.cashSalesTotal = (activeShift.cashSalesTotal || 0) + finalTotal;
      } else if (paymentMethod === 'vodafone_cash') {
        activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
        activeShift.vodafoneCashTotal += finalTotal;
      } else if (paymentMethod === 'instapay') {
        activeShift.cardSales = (activeShift.cardSales || 0) + finalTotal;
        activeShift.instapayTotal += finalTotal;
      }

      const starting = Number(activeShift.startingCash ?? activeShift.openingCash ?? 0);
      const cash = Number(activeShift.cashSales ?? activeShift.cashSalesTotal ?? 0);
      const exp = Number(activeShift.expenses ?? activeShift.expensesTotal ?? 0);
      activeShift.expectedCash = Math.max(0, starting + cash - exp);
      activeShift.expectedCashInDrawer = activeShift.expectedCash;
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
