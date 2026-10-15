import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
import { Order, OrderStatus, CartItem, Product } from '@/types/store';
import { validateEgyptianPhone, validateCoupon } from '@/lib/validation';
import { calculateCustomBoxPrice } from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  const db = getDb();
  if (query) {
    const normalized = query.toLowerCase();
    const queryDigits = query.replace(/[\s\-\(\)\+]/g, '');
    const matched = db.orders.filter((o) => {
      const orderNumMatch = o.orderNumber.toLowerCase() === normalized;
      const orderPhoneDigits = o.customerPhone.replace(/[\s\-\(\)\+]/g, '');
      const phoneMatch =
        queryDigits.length >= 8 &&
        (orderPhoneDigits.endsWith(queryDigits) || queryDigits.endsWith(orderPhoneDigits));
      return orderNumMatch || phoneMatch;
    });
    return NextResponse.json({ orders: matched });
  }

  const auth = verifyAdminRequest(request);
  if (auth.isAuthenticated) {
    return NextResponse.json({ orders: db.orders });
  }

  return NextResponse.json({ orders: [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

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

      if (rawItem.isCustomMix) {
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
      } else {
        const dbProduct = db.products.find((p) => p.id === rawItem.productId);
        if (!dbProduct) {
          return NextResponse.json(
            { error: 'أحد الأصناف المطلوبة غير موجود في المتجر' },
            { status: 400 }
          );
        }
        const dbWeight = dbProduct.weights.find((w) => w.id === rawItem.weightId);
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
        });
      }

      serverSubtotal += unitPrice * quantity;
    }

    // 4. Server-side coupon recalculation
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

    // 5. Server-side shipping calculation
    const freeShippingThreshold = db.settings.freeShippingThreshold || 1000;
    let serverShippingCost = 0;

    if (serverSubtotal < freeShippingThreshold) {
      const matchedShipping = db.shippingRates.find(
        (r) => r.governorate === body.governorate
      );
      serverShippingCost = matchedShipping ? matchedShipping.price : (Number(body.shippingCost) || 50);
    }

    // 6. Recalculated total
    const serverTotal = Math.max(0, serverSubtotal - serverDiscountAmount + serverShippingCost);

    // 7. Persist order
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `NUT-${randomNum}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerName: String(body.customerName || '').trim(),
      customerPhone: phoneValidation.normalized,
      customerAltPhone: normalizedAltPhone,
      governorate: String(body.governorate || '').trim(),
      address: String(body.address || '').trim(),
      notes: String(body.notes || '').trim(),
      items: verifiedItems,
      subtotal: serverSubtotal,
      shippingCost: serverShippingCost,
      discountAmount: serverDiscountAmount,
      couponCode: validCouponCode,
      total: serverTotal,
      paymentMethod: body.paymentMethod || 'cod',
      paymentReference: body.paymentReference ? String(body.paymentReference).trim() : undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    db.orders.unshift(newOrder);
    saveDb(db);

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الطلب' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, status, notes } = body as {
      orderId: string;
      status?: OrderStatus;
      notes?: string;
    };

    const db = getDb();
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
    saveDb(db);

    return NextResponse.json({ order: db.orders[orderIndex] });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'فشل تحديث حالة الطلب' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });
    }

    const db = getDb();
    if (orderId === 'all') {
      db.orders = [];
    } else {
      db.orders = db.orders.filter((o) => o.id !== orderId);
    }
    saveDb(db);

    return NextResponse.json({ success: true, orders: db.orders });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'فشل حذف الطلب' }, { status: 500 });
  }
}
