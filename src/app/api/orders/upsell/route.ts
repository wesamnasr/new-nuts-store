import { NextRequest, NextResponse } from 'next/server';
import { withDbTransaction } from '@/lib/db';
import { CartItem, Product } from '@/types/store';
import { validateEgyptianPhone } from '@/lib/validation';
import {
  calculateVipCashback,
  getResolvedProductWeights,
  isUnitProduct,
} from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
import { calculateOrderTaxBreakdown } from '@/lib/tax';
import { calculateOrderCogs, roundCurrency } from '@/lib/financials';
import { sendStoreTelegramAlert, type LowStockAlertItem } from '@/lib/telegram';
import { stripOrderCosts } from '@/lib/order-sanitize';

export const dynamic = 'force-dynamic';

const UPSELL_WINDOW_MS = 15 * 60 * 1000;

function depleteStockAtomic(
  product: Product,
  consumedQty: number,
  crossedAlerts: LowStockAlertItem[]
) {
  const prevStockKg = typeof product.stockKg === 'number' ? product.stockKg : 50;
  product.stockKg = Math.max(0, Math.round((prevStockKg - consumedQty) * 1000) / 1000);
  if (product.stockKg <= 0) {
    product.inStock = false;
  }
  const nextStockKg = product.stockKg;
  if ((prevStockKg > 5 && nextStockKg <= 5) || (prevStockKg > 0 && nextStockKg <= 0)) {
    crossedAlerts.push({
      productId: product.id,
      productName: product.name,
      previousStockKg: prevStockKg,
      remainingStockKg: nextStockKg,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderId = String(body.orderId || '').trim();
    const orderNumber = String(body.orderNumber || '').trim();
    const rawPhone = String(body.customerPhone || '').trim();
    const metaEventId = String(body.metaEventId || '').trim();
    const productId = String(body.productId || '').trim();
    const requestedWeightId = String(body.weightId || '').trim();

    if (!orderId || !orderNumber || !rawPhone || !metaEventId || !productId) {
      return NextResponse.json(
        { error: 'بيانات العرض الإضافي غير مكتملة' },
        { status: 400 }
      );
    }

    const phoneValidation = validateEgyptianPhone(rawPhone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: 'رقم الموبايل غير صحيح' },
        { status: 400 }
      );
    }

    return await withDbTransaction(async (db) => {
      const orderIndex = db.orders.findIndex(
        (o) =>
          o.id === orderId &&
          o.orderNumber === orderNumber &&
          o.customerPhone === phoneValidation.normalized &&
          o.metaEventId === metaEventId
      );

      if (orderIndex === -1) {
        return NextResponse.json(
          { error: 'لم يتم العثور على الطلب أو تعذر التحقق من بياناته' },
          { status: 404 }
        );
      }

      const order = db.orders[orderIndex];

      if (order.status !== 'pending') {
        return NextResponse.json(
          { error: 'لا يمكن تعديل هذا الطلب بعد بدء التجهيز' },
          { status: 400 }
        );
      }

      if (order.upsellAdded) {
        return NextResponse.json(
          { error: 'تمت إضافة العرض الحصري لهذا الطلب بالفعل' },
          { status: 400 }
        );
      }

      const createdAtMs = new Date(order.createdAt).getTime();
      if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > UPSELL_WINDOW_MS) {
        return NextResponse.json(
          { error: 'انتهت مهلة إضافة العرض على نفس الشحنة' },
          { status: 400 }
        );
      }

      const prod = db.products.find((p) => p.id === productId);
      if (!prod || prod.showOnline === false || prod.inStock === false) {
        return NextResponse.json(
          { error: 'عذراً، هذا الصنف الإضافي غير متاح حالياً' },
          { status: 400 }
        );
      }

      const unitMode = isUnitProduct(prod);
      const resolvedWeights = getResolvedProductWeights(prod);
      const matchedWeight =
        resolvedWeights.find((w) => w.id === requestedWeightId) ||
        (!unitMode
          ? resolvedWeights.find((w) => (w.weightGrams || w.grams) === 250)
          : undefined) ||
        resolvedWeights[0];

      if (!matchedWeight) {
        return NextResponse.json(
          { error: 'تعذر تحديد وزن الصنف الإضافي' },
          { status: 400 }
        );
      }

      const consumedQty = unitMode
        ? matchedWeight.unitsCount ||
          (matchedWeight.weightGrams
            ? Math.max(1, Math.round(matchedWeight.weightGrams / 1000))
            : 1)
        : (matchedWeight.weightGrams || matchedWeight.grams || 250) / 1000;

      const availableStock = typeof prod.stockKg === 'number' ? prod.stockKg : 50;
      if (availableStock + 1e-6 < consumedQty) {
        return NextResponse.json(
          { error: `عذراً، الكمية المتاحة حالياً من «${prod.name}» لا تكفي لهذا العرض` },
          { status: 400 }
        );
      }

      const upsellPrice = Math.max(1, Math.round(matchedWeight.price * 0.85));
      const upsellItem: CartItem = {
        cartItemId: `upsell-${prod.id}-${matchedWeight.id}`,
        productId: prod.id,
        productName: `${prod.name} (عرض شاشة الشكر -١٥٪)`,
        productImage: getSafeImageUrl(prod.image),
        weightId: matchedWeight.id,
        weightLabel: matchedWeight.label,
        customWeightGrams: unitMode
          ? undefined
          : matchedWeight.weightGrams || matchedWeight.grams || 250,
        roastOption: prod.roastOptions?.[0] || '',
        unitPrice: upsellPrice,
        quantity: 1,
      };

      const prevCashback = Number(order.vipCashbackEarned) || 0;
      order.items = [...(order.items || []), upsellItem];
      order.subtotal = roundCurrency((Number(order.subtotal) || 0) + upsellPrice);
      // Keep shippingCost unchanged (0 extra shipping!)

      const taxBreakdown = calculateOrderTaxBreakdown(
        order.items,
        db.products,
        Number(order.discountAmount) || 0,
        db.settings
      );

      if (taxBreakdown.taxEnabled) {
        order.taxAmount = taxBreakdown.taxAmount;
        order.taxRatePercent = taxBreakdown.taxRatePercent;
        order.taxInclusive = taxBreakdown.taxInclusive;
      }

      const totalBeforeWallet = Math.max(
        0,
        roundCurrency(
          order.subtotal -
            (Number(order.discountAmount) || 0) +
            taxBreakdown.totalAddition +
            (Number(order.shippingCost) || 0)
        )
      );
      order.total = Math.max(
        0,
        roundCurrency(totalBeforeWallet - (Number(order.vipWalletRedeemed) || 0))
      );

      // Update VIP cashback delta if total increased
      const eligibleValue = Math.max(0, order.subtotal - (Number(order.discountAmount) || 0));
      const newCashback = calculateVipCashback(
        eligibleValue,
        db.settings.vipMinOrderForCashback || 150,
        db.settings.vipCashbackPercentage || 5
      );
      const cashbackDelta = Math.max(0, roundCurrency(newCashback - prevCashback));
      if (cashbackDelta > 0) {
        order.vipCashbackEarned = roundCurrency(prevCashback + cashbackDelta);
        if (!Array.isArray(db.vipMembers)) db.vipMembers = [];
        const member = db.vipMembers.find((m) => m.phone === phoneValidation.normalized);
        if (member) {
          member.pointsBalance = roundCurrency((member.pointsBalance || 0) + cashbackDelta);
          member.totalSpent = roundCurrency((member.totalSpent || 0) + upsellPrice);
          if (!Array.isArray(member.transactions)) member.transactions = [];
          member.transactions.unshift({
            id: `vip-tx-upsell-${Date.now()}`,
            type: 'earned',
            amountEgp: cashbackDelta,
            orderNumber: order.orderNumber,
            description: `كاش باك إضافي لعرض شاشة الشكر على الطلب #${order.orderNumber}`,
            date: new Date().toISOString(),
          });
        }
      }

      const crossedAlerts: LowStockAlertItem[] = [];
      depleteStockAtomic(prod, consumedQty, crossedAlerts);

      const computedCogs = calculateOrderCogs(order, db.products);
      order.rawCostTotal = computedCogs;
      order.netProfitEgp = roundCurrency(order.total - computedCogs);
      order.upsellAdded = true;
      order.notes = [
        order.notes?.trim() || '',
        `+ إضافة عرض شاشة الشكر: ${prod.name} (${matchedWeight.label}) بـ ${upsellPrice} ${db.settings.currencySymbol?.trim() || 'ج.م'}`,
      ]
        .filter(Boolean)
        .join(' • ');

      sendStoreTelegramAlert(db.settings, 'new_order', order).catch((e) =>
        console.error('Telegram upsell notification error:', e)
      );

      if (crossedAlerts.length > 0) {
        sendStoreTelegramAlert(db.settings, 'low_stock', {
          items: crossedAlerts,
          sourceLabel: `إضافة عرض على طلب #${order.orderNumber}`,
        }).catch((e) => console.error('Telegram low-stock upsell alert error:', e));
      }

      return NextResponse.json({
        order: stripOrderCosts(order),
        upsellItem,
      });
    });
  } catch (error) {
    console.error('Error adding order upsell:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إضافة العرض إلى طلبك' },
      { status: 500 }
    );
  }
}
