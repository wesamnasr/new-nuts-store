import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import {
  Order,
  OrderStatus,
  CartItem,
  Product,
  PartitionedBoxSize,
  BoxSlotSelection,
  DeliveryMethodType,
  VipMember,
} from '@/types/store';
import { validateEgyptianPhone, validateCoupon } from '@/lib/validation';
import {
  calculateCustomBoxPrice,
  calculatePartitionedBox,
  calculateCoffeeBlendPrice,
  calculateVipCashback,
} from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function stripOrderCosts(order: Order): Order {
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

function depleteProductStock(product: Product, consumedKg: number) {
  const currentStock = typeof product.stockKg === 'number' ? product.stockKg : 50;
  product.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
  if (product.stockKg <= 0) {
    product.inStock = false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  const db = await getDbAsync();
  if (query) {
    const normalized = query.toLowerCase();
    const queryDigits = query.replace(/[\s\-\(\)\+]/g, '');
    const matched = db.orders
      .filter((o) => {
        const orderNumMatch = o.orderNumber.toLowerCase() === normalized;
        const orderPhoneDigits = o.customerPhone.replace(/[\s\-\(\)\+]/g, '');
        const phoneMatch =
          queryDigits.length >= 8 &&
          (orderPhoneDigits.endsWith(queryDigits) || queryDigits.endsWith(orderPhoneDigits));
        return orderNumMatch || phoneMatch;
      })
      .map(stripOrderCosts);
    return NextResponse.json({ orders: matched });
  }

  const auth = verifyAdminRequest(request);
  if (auth.isAuthenticated) {
    // Role 2: Supplier is isolated from customer orders
    if (
      (auth.role === 'supplier' &&
        !hasRolePermission('supplier', 'orders', db.settings) &&
        !hasRolePermission('supplier', 'accounting_portal', db.settings) &&
        !hasRolePermission('supplier', 'cashier_portal', db.settings) &&
        !hasRolePermission('supplier', 'overview', db.settings)) ||
      auth.role === 'promo_partner'
    ) {
      return NextResponse.json({ orders: [] });
    }
    // Role 3: Cashier sees orders for preparation/delivery without raw cost or net profit
    if (auth.role === 'cashier' || auth.role === 'store_manager') {
      return NextResponse.json({ orders: db.orders.map(stripOrderCosts) });
    }
    // Role 1 (Admin) & Role 4 (Accountant) see full financial order details
    return NextResponse.json({ orders: db.orders });
  }

  return NextResponse.json({ orders: [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDbAsync();

    // 1. Validate required basic fields
    if (!body.customerName?.trim() || !body.customerPhone?.trim() || !body.address?.trim()) {
      return NextResponse.json(
        { error: 'يرجى إكمال جميع بيانات الطلب (الاسم، رقم الهاتف، والعنوان)' },
        { status: 400 }
      );
    }

    // 2. Validate Egyptian phone numbers
    const phoneValidation = validateEgyptianPhone(body.customerPhone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'رقم الهاتف المصري غير صحيح' },
        { status: 400 }
      );
    }

    let normalizedAltPhone = '';
    if (body.customerAltPhone && String(body.customerAltPhone).trim()) {
      const altPhoneValidation = validateEgyptianPhone(String(body.customerAltPhone));
      if (!altPhoneValidation.isValid) {
        return NextResponse.json(
          { error: `رقم الهاتف البديل غير صحيح: ${altPhoneValidation.error}` },
          { status: 400 }
        );
      }
      normalizedAltPhone = altPhoneValidation.normalized;
    }

    const rawItems: CartItem[] = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'سلة المشتريات فارغة' }, { status: 400 });
    }

    // 3. Server-side subtotal recalculation & price integrity
    let serverSubtotal = 0;
    const verifiedItems: CartItem[] = [];

    for (const rawItem of rawItems) {
      const quantity = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));
      let unitPrice = 0;

      // Channel check: direct product reference
      if (rawItem.productId && !rawItem.productId.startsWith('flash-promo-') && !rawItem.isPartitionedBox && !rawItem.isCustomMix && !rawItem.isCoffeeBlend) {
        const directProd = db.products.find((p) => p.id === rawItem.productId);
        if (directProd && directProd.showOnline === false) {
          return NextResponse.json(
            { error: 'المنتج غير متاح للطلب عبر المتجر الإلكتروني' },
            { status: 400 }
          );
        }
      }

      // Case A: Partitioned Box (بوكس روقان 125ج / العيلة 250ج / VIP 450ج)
      if (rawItem.isPartitionedBox) {
        const boxSize = (rawItem.partitionedBoxSize || 'roqan_4') as PartitionedBoxSize;
        const rawSlots: BoxSlotSelection[] = Array.isArray(rawItem.partitionedSlots)
          ? rawItem.partitionedSlots
          : [];

        for (const slot of rawSlots) {
          const slotProd = db.products.find((p) => p.id === slot.productId);
          if (slotProd && slotProd.showOnline === false) {
            return NextResponse.json(
              { error: 'المنتج غير متاح للطلب عبر المتجر الإلكتروني' },
              { status: 400 }
            );
          }
        }

        const verifiedSlots: BoxSlotSelection[] = rawSlots.map((slot, idx) => {
          const dbProduct = db.products.find((p) => p.id === slot.productId);
          if (dbProduct) {
            const pricePerKg =
              dbProduct.pricePerKg ||
              dbProduct.weights.find((w) => w.grams === 1000)?.price ||
              slot.pricePerKg ||
              400;
            const costPerKg = dbProduct.costPerKg || Math.round(pricePerKg * 0.68);
            return {
              slotIndex: slot.slotIndex || idx + 1,
              productId: dbProduct.id,
              productName: dbProduct.name,
              productImage: getSafeImageUrl(dbProduct.image),
              roastOption: slot.roastOption || dbProduct.roastOptions?.[0] || 'محمص مملح',
              slotGrams: slot.slotGrams || (boxSize === 'roqan_4' ? 100 : 125),
              pricePerKg,
              costPerKg,
              isSuperVipItem: Boolean(
                dbProduct.isSuperVipItem ||
                  pricePerKg >= 750 ||
                  dbProduct.name.includes('فستق') ||
                  dbProduct.name.includes('كاجو') ||
                  dbProduct.name.includes('بندق') ||
                  dbProduct.name.includes('عين جمل')
              ),
            };
          }
          return slot;
        });

        const boxCalc = calculatePartitionedBox(boxSize, verifiedSlots);
        if (!boxCalc.isValid) {
          return NextResponse.json(
            { error: boxCalc.error || 'يرجى استكمال جميع خانات البوكس المقسم' },
            { status: 400 }
          );
        }

        unitPrice = boxCalc.finalPrice;
        verifiedItems.push({
          ...rawItem,
          productImage: getSafeImageUrl(
            rawItem.productImage || verifiedSlots[0]?.productImage
          ),
          unitPrice,
          quantity,
          isPartitionedBox: true,
          partitionedBoxSize: boxSize,
          partitionedSlots: verifiedSlots,
        });
      }
      // Case B: Custom Coffee Blend (توليفة البن الخاصة)
      else if (rawItem.isCoffeeBlend && rawItem.coffeeBlendSpec) {
        const spec = rawItem.coffeeBlendSpec;
        const blendCalc = calculateCoffeeBlendPrice({
          brazilianPercent: Number(spec.brazilianPercent || 0),
          indianPercent: Number(spec.indianPercent || 0),
          colombianPercent: Number(spec.colombianPercent || 0),
          habashiPercent: Number(spec.habashiPercent || 0),
          roastLevel: spec.roastLevel || 'وسط (مضبوط)',
          spicing: spec.spicing || 'محوج مخصوص بحبهان وزر ورد',
          grindType: spec.grindType || 'ماكينة تركي ناعم',
          weightGrams: spec.weightGrams || 250,
          customBlendName: spec.customBlendName,
        });

        if (!blendCalc.isValid) {
          return NextResponse.json(
            { error: blendCalc.error || 'نسب توليفة البن غير مكتملة (يجب أن تساوي 100%)' },
            { status: 400 }
          );
        }

        unitPrice = blendCalc.totalPrice;
        verifiedItems.push({
          ...rawItem,
          productImage: getSafeImageUrl(rawItem.productImage),
          unitPrice,
          quantity,
          isCoffeeBlend: true,
          coffeeBlendSpec: blendCalc.spec,
        });
      }
      // Case C: Flash Promotion / 4th Partner Bundle
      else if (
        typeof rawItem.productId === 'string' &&
        rawItem.productId.startsWith('flash-promo-')
      ) {
        const promoId = rawItem.productId.replace('flash-promo-', '');
        const matchedPromo = (db.promotions || []).find((p) => p.id === promoId);
        unitPrice = matchedPromo ? matchedPromo.promoPrice : Math.max(20, Number(rawItem.unitPrice) || 125);
        verifiedItems.push({
          ...rawItem,
          productName: matchedPromo ? matchedPromo.title : rawItem.productName,
          productImage: getSafeImageUrl(matchedPromo?.image || rawItem.productImage),
          unitPrice,
          quantity,
        });
      }
      // Case D: Percentage Custom Mix Box (500g / 1000g / 2000g)
      else if (rawItem.isCustomMix) {
        if (
          !rawItem.boxCapacityGrams ||
          (rawItem.boxCapacityGrams !== 500 &&
            rawItem.boxCapacityGrams !== 1000 &&
            rawItem.boxCapacityGrams !== 2000) ||
          !Array.isArray(rawItem.customBreakdown) ||
          rawItem.customBreakdown.length === 0
        ) {
          return NextResponse.json(
            { error: 'تفاصيل العلبة المشكلة غير صحيحة أو تم التلاعب بها: مواصفات العلبة غير مكتملة' },
            { status: 400 }
          );
        }

        const boxSize = rawItem.boxCapacityGrams as 500 | 1000 | 2000;
        const portions: Array<{ product: Product; percentage: number; roastOption: any }> = [];

        for (const b of rawItem.customBreakdown) {
          const dbProduct = db.products.find((p) => p.id === b.productId);
          if (!dbProduct) {
            return NextResponse.json(
              { error: 'تفاصيل العلبة المشكلة غير صحيحة أو تم التلاعب بها: أحد مكونات العلبة غير موجود في المتجر' },
              { status: 400 }
            );
          }
          if (dbProduct.showOnline === false) {
            return NextResponse.json(
              { error: 'المنتج غير متاح للطلب عبر المتجر الإلكتروني' },
              { status: 400 }
            );
          }
          portions.push({
            product: dbProduct,
            percentage: Number(b.percentage),
            roastOption: b.roastOption,
          });
        }

        const pricingResult = calculateCustomBoxPrice(boxSize, portions);
        if (!pricingResult.isValid) {
          return NextResponse.json(
            { error: 'تفاصيل العلبة المشكلة غير صحيحة أو تم التلاعب بها: ' + (pricingResult.error || 'سعة غير صالحة') },
            { status: 400 }
          );
        }

        unitPrice = pricingResult.totalPrice;

        verifiedItems.push({
          ...rawItem,
          productImage: getSafeImageUrl(rawItem.productImage || pricingResult.breakdown[0]?.productImage),
          unitPrice,
          quantity,
          isCustomMix: true,
          boxCapacityGrams: boxSize,
          customBreakdown: pricingResult.breakdown,
        });
      }
      // Case E: Standard Product with Weight Variant
      else {
        const dbProduct = db.products.find((p) => p.id === rawItem.productId);
        if (!dbProduct) {
          return NextResponse.json(
            { error: 'أحد الأصناف المطلوبة غير موجود في المتجر' },
            { status: 400 }
          );
        }
        if (dbProduct.showOnline === false) {
          return NextResponse.json(
            { error: 'المنتج غير متاح للطلب عبر المتجر الإلكتروني' },
            { status: 400 }
          );
        }
        const dbWeight =
          dbProduct.weights.find((w) => w.id === rawItem.weightId) ||
          dbProduct.weights.find((w) => w.label === rawItem.weightLabel);
        if (!dbWeight) {
          return NextResponse.json(
            { error: 'أحد الأصناف المطلوبة غير موجود في المتجر' },
            { status: 400 }
          );
        }
        unitPrice = dbWeight.price;

        verifiedItems.push({
          ...rawItem,
          productImage: getSafeImageUrl(rawItem.productImage || dbProduct.image),
          unitPrice,
          quantity,
          workerNotes: rawItem.workerNotes ? String(rawItem.workerNotes).trim() : undefined,
        });
      }

      serverSubtotal += unitPrice * quantity;
    }

    // 4. Enforce Bani Mazar Village Minimum Order (200 EGP) when deliveryMethod === 'villages_scheduled'
    const deliveryMethod: DeliveryMethodType | undefined = body.deliveryMethod;
    const minOrderVillages = db.settings.minOrderVillages || 200;

    if (deliveryMethod === 'villages_scheduled' && serverSubtotal < minOrderVillages) {
      return NextResponse.json(
        {
          error: `الحد الأدنى للطلب لقرى مركز بني مزار هو ${minOrderVillages} ج.م لضمان التوصيل في دورة التوزيع المجمعة (متبقي ${minOrderVillages - serverSubtotal} ج.م لإكمال الحد الأدنى).`,
        },
        { status: 400 }
      );
    }

    // 5. Server-side coupon recalculation
    let serverDiscountAmount = 0;
    let validCouponCode: string | undefined = undefined;

    if (body.couponCode && typeof body.couponCode === 'string') {
      const cleanCode = body.couponCode.trim().toUpperCase();
      const matchedCoupon = db.coupons.find(
        (c) => c.code.toUpperCase() === cleanCode && c.active
      );

      if (matchedCoupon) {
        const couponResult = validateCoupon(matchedCoupon, serverSubtotal);
        if (couponResult.isValid) {
          serverDiscountAmount = couponResult.discountAmount;
          validCouponCode = matchedCoupon.code;
        }
      }
    }

    // 6. Server-side shipping calculation
    const freeShippingThreshold = db.settings.freeShippingThreshold || 300;
    let serverShippingCost = 0;

    if (deliveryMethod === 'store_pickup') {
      serverShippingCost = 0;
    } else if (deliveryMethod === 'bandar_fast') {
      serverShippingCost =
        serverSubtotal >= freeShippingThreshold ? 0 : (db.settings.bandarShippingCost ?? 20);
    } else if (deliveryMethod === 'villages_scheduled') {
      serverShippingCost =
        serverSubtotal >= freeShippingThreshold ? 0 : (db.settings.villagesShippingCost ?? 25);
    } else {
      // Legacy governorate fallback
      if (serverSubtotal < freeShippingThreshold) {
        const matchedShipping = db.shippingRates.find(
          (r) => r.governorate === body.governorate
        );
        serverShippingCost = matchedShipping
          ? matchedShipping.price
          : Number(body.shippingCost) || 50;
      }
    }

    // 7. VIP Wallet Redemption & 5% Cashback Calculation
    const normalizedPhone = phoneValidation.normalized;
    if (!Array.isArray(db.vipMembers)) {
      db.vipMembers = [];
    }
    const vipMembers = db.vipMembers;

    let vipMemberIndex = vipMembers.findIndex((m) => m.phone === normalizedPhone);
    let vipWalletRedeemed = 0;
    const totalBeforeWallet = Math.max(0, serverSubtotal - serverDiscountAmount + serverShippingCost);

    if (
      (body.useVipWallet || body.paymentMethod === 'vip_wallet') &&
      vipMemberIndex !== -1 &&
      (vipMembers[vipMemberIndex].pointsBalance ?? vipMembers[vipMemberIndex].walletBalance ?? 0) > 0
    ) {
      vipWalletRedeemed = Math.min(
        vipMembers[vipMemberIndex].pointsBalance ?? vipMembers[vipMemberIndex].walletBalance ?? 0,
        totalBeforeWallet
      );
    }

    const serverTotal = Math.max(0, totalBeforeWallet - vipWalletRedeemed);

    // Calculate 5% VIP cashback on orders >= 150 EGP (after discounts, before shipping)
    const eligibleOrderValue = Math.max(0, serverSubtotal - serverDiscountAmount);
    const vipCashbackEarned = calculateVipCashback(
      eligibleOrderValue,
      db.settings.vipMinOrderForCashback || 150,
      db.settings.vipCashbackPercentage || 5
    );

    // Update or auto-enroll VIP member
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `NUT-${randomNum}`;
    const nowIso = new Date().toISOString();

    if (vipMemberIndex === -1) {
      const newMember: VipMember = {
        phone: normalizedPhone,
        customerName: String(body.customerName || '').trim(),
        pointsBalance: vipCashbackEarned,
        totalSpent: serverTotal,
        ordersCount: 1,
        tier: serverTotal >= 1500 ? 'platinum' : 'gold',
        qrCodeValue: `HAFSA-VIP-${normalizedPhone}`,
        joinedAt: nowIso,
        transactions:
          vipCashbackEarned > 0
            ? [
                {
                  id: `vip-tx-${Date.now()}`,
                  type: 'earned',
                  amountEgp: vipCashbackEarned,
                  orderNumber,
                  description: `كاش باك 5% على الطلب #${orderNumber}`,
                  date: nowIso,
                },
              ]
            : [],
      };
      db.vipMembers.unshift(newMember);
    } else {
      const member = db.vipMembers[vipMemberIndex];
      if (!Array.isArray(member.transactions)) {
        member.transactions = [];
      }
      if (vipWalletRedeemed > 0) {
        member.pointsBalance = Math.max(0, member.pointsBalance - vipWalletRedeemed);
        member.transactions.unshift({
          id: `vip-tx-redeem-${Date.now()}`,
          type: 'redeemed',
          amountEgp: vipWalletRedeemed,
          orderNumber,
          description: `استبدال رصيد من محفظة VIP في الطلب #${orderNumber}`,
          date: nowIso,
        });
      }
      if (vipCashbackEarned > 0) {
        member.pointsBalance += vipCashbackEarned;
        member.transactions.unshift({
          id: `vip-tx-earn-${Date.now() + 1}`,
          type: 'earned',
          amountEgp: vipCashbackEarned,
          orderNumber,
          description: `كاش باك 5% على الطلب #${orderNumber}`,
          date: nowIso,
        });
      }
      member.totalSpent = (member.totalSpent || 0) + serverTotal;
      member.ordersCount = (member.ordersCount || 0) + 1;
      if (member.totalSpent >= 1500) {
        member.tier = 'platinum';
      }
    }

    // 8. Persist order
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerName: String(body.customerName || '').trim(),
      customerPhone: normalizedPhone,
      customerAltPhone: normalizedAltPhone,
      governorate: String(body.governorate || 'بني مزار - البندر').trim(),
      deliveryMethod,
      villageName: body.villageName ? String(body.villageName).trim() : undefined,
      deliveryBatchSlot: body.deliveryBatchSlot ? String(body.deliveryBatchSlot).trim() : undefined,
      address: String(body.address || '').trim(),
      notes: String(body.notes || '').trim(),
      items: verifiedItems,
      subtotal: serverSubtotal,
      shippingCost: serverShippingCost,
      discountAmount: serverDiscountAmount,
      vipWalletRedeemed,
      vipCashbackEarned,
      couponCode: validCouponCode,
      total: serverTotal,
      paymentMethod: body.paymentMethod || 'cod',
      paymentReference: body.paymentReference ? String(body.paymentReference).trim() : undefined,
      status: 'pending',
      createdAt: nowIso,
    };

    // 9. Atomic Stock Depletion across all items
    for (const item of verifiedItems) {
      const qty = item.quantity || 1;
      if (item.isPartitionedBox && Array.isArray(item.partitionedSlots)) {
        for (const slot of item.partitionedSlots) {
          const slotProd = db.products.find((p) => p.id === slot.productId);
          if (slotProd) {
            const slotGrams = slot.slotGrams || slot.weightGrams || (item.partitionedBoxSize === 'roqan_4' ? 100 : 125);
            const consumedKg = (slotGrams * qty) / 1000;
            depleteProductStock(slotProd, consumedKg);
          }
        }
      } else if (item.isCustomMix && Array.isArray(item.customBreakdown)) {
        for (const b of item.customBreakdown) {
          const bProd = db.products.find((p) => p.id === b.productId);
          if (bProd) {
            const constituentGrams = b.weightGrams || ((b.percentage || 0) * (item.boxCapacityGrams || 500) / 100);
            const consumedKg = (constituentGrams * qty) / 1000;
            depleteProductStock(bProd, consumedKg);
          }
        }
      } else if (item.isCoffeeBlend && item.coffeeBlendSpec) {
        const totalGrams = item.coffeeBlendSpec.weightGrams || 250;
        const prod = db.products.find((p) => p.id === item.productId || p.categoryId === 'cat-coffee-espresso');
        if (prod) {
          depleteProductStock(prod, (totalGrams * qty) / 1000);
        }
      } else if (typeof item.productId === 'string' && item.productId.startsWith('flash-promo-')) {
        const promoId = item.productId.replace('flash-promo-', '');
        const promo = (db.promotions || []).find((p) => p.id === promoId);
        if (promo && Array.isArray(promo.items)) {
          for (const pi of promo.items) {
            const promoProd = db.products.find((p) => p.id === pi.productId);
            if (promoProd) {
              const consumedKg = (pi.weightGrams * (pi.quantity || 1) * qty) / 1000;
              depleteProductStock(promoProd, consumedKg);
            }
          }
        }
      } else {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod) {
          const matchedW = prod.weights?.find((w) => w.id === item.weightId || w.label === item.weightLabel);
          const grams = item.customWeightGrams || matchedW?.weightGrams || matchedW?.grams || 250;
          const consumedKg = (grams * qty) / 1000;
          depleteProductStock(prod, consumedKg);
        }
      }
    }

    db.orders.unshift(newOrder);
    await saveDbAsync(db);

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الطلب' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    if (
      (auth.role === 'supplier' && !hasRolePermission('supplier', 'orders', db.settings) && !hasRolePermission('supplier', 'cashier_portal', db.settings)) ||
      (auth.role === 'accountant' && !hasRolePermission('accountant', 'cashier_portal', db.settings)) ||
      auth.role === 'promo_partner'
    ) {
      return NextResponse.json(
        { error: 'عزل الأدوار: هذا الدور غير مصرح له بتعديل حالات الطلبات' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { orderId, status, notes } = body as {
      orderId: string;
      status?: OrderStatus;
      notes?: string;
    };

    const orderIndex = db.orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    if (status) {
      db.orders[orderIndex].status = status;
    }
    if (typeof notes === 'string') {
      db.orders[orderIndex].notes = notes;
    }
    await saveDbAsync(db);

    const returnedOrder =
      auth.role === 'cashier' || auth.role === 'store_manager'
        ? stripOrderCosts(db.orders[orderIndex])
        : db.orders[orderIndex];

    return NextResponse.json({ order: returnedOrder });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'فشل تحديث حالة الطلب' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    // Only Super Admin / Admin can delete orders
    if (auth.role && auth.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'عزل الأدوار: حذف الطلبات متاح للأدمن (المدير) فقط (403 Forbidden)' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });
    }

    if (orderId === 'all') {
      return NextResponse.json({ error: 'غير مسموح بمسح السجل بالكامل' }, { status: 400 });
    } else {
      db.orders = db.orders.filter((o) => o.id !== orderId);
    }
    await saveDbAsync(db);

    return NextResponse.json({ success: true, orders: db.orders });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'فشل حذف الطلب' }, { status: 500 });
  }
}

