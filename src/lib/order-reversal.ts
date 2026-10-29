import { DatabaseSchema, Order } from '@/types/store';
import { validateEgyptianPhone } from './validation';

function normalizePhone(phone: string): string {
  const res = validateEgyptianPhone(phone);
  return res.isValid ? res.normalized : phone.trim();
}

function parseGramsFromLabel(label?: string): number {
  if (!label) return 250;
  const normalized = label.trim().toLowerCase();
  if (normalized.includes('كيلو') && !normalized.includes('نصف') && !normalized.includes('ربع')) {
    const match = normalized.match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) * 1000 : 1000;
  }
  if (normalized.includes('نصف كيلو') || normalized.includes('500')) return 500;
  if (normalized.includes('ربع كيلو') || normalized.includes('250')) return 250;
  if (normalized.includes('ثمن كيلو') || normalized.includes('125')) return 125;
  const numMatch = normalized.match(/(\d+)/);
  if (numMatch) {
    const val = Number(numMatch[1]);
    return val <= 10 ? val * 1000 : val;
  }
  return 250;
}

/**
 * Computes the exact stock consumption in kilograms per product ID for a given order.
 */
export function computeOrderStockConsumptionKg(
  db: DatabaseSchema,
  order: Order
): Record<string, number> {
  const consumption: Record<string, number> = {};
  const addKg = (productId: string | undefined, grams: number) => {
    if (!productId || !Number.isFinite(grams) || grams <= 0) return;
    const kg = grams / 1000;
    consumption[productId] = Math.round(((consumption[productId] || 0) + kg) * 1000) / 1000;
  };

  for (const item of order.items || []) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));

    if (item.isPartitionedBox && Array.isArray(item.partitionedSlots)) {
      for (const slot of item.partitionedSlots) {
        const defaultSlotGrams = item.partitionedBoxSize === 'roqan_4' ? 100 : 125;
        const slotGrams =
          Number(slot.slotGrams || (slot as { weightGrams?: number }).weightGrams) > 0
            ? Number(slot.slotGrams || (slot as { weightGrams?: number }).weightGrams)
            : defaultSlotGrams;
        addKg(slot.productId, slotGrams * qty);
      }
      continue;
    }

    if (item.isCustomMix && Array.isArray(item.customBreakdown)) {
      const cap = Number(item.boxCapacityGrams) || 500;
      for (const portion of item.customBreakdown) {
        const portionGrams =
          Number(portion.weightGrams) > 0
            ? Number(portion.weightGrams)
            : (cap * (Number(portion.percentage) || 0)) / 100;
        addKg(portion.productId, portionGrams * qty);
      }
      continue;
    }

    if (item.isCoffeeBlend && item.coffeeBlendSpec) {
      const blendGrams = Number(item.coffeeBlendSpec.weightGrams) || 250;
      const prod = db.products.find(
        (p) => p.id === item.productId || p.categoryId === 'cat-coffee-espresso'
      );
      if (prod) {
        addKg(prod.id, blendGrams * qty);
      }
      continue;
    }

    if (
      (item.isFlashPromo && item.flashPromoId) ||
      (typeof item.productId === 'string' && item.productId.startsWith('flash-promo-'))
    ) {
      const promoId =
        item.flashPromoId ||
        (typeof item.productId === 'string' ? item.productId.replace('flash-promo-', '') : '');
      const promoList = db.flashPromotions || db.promotions || [];
      const promo = promoList.find((fp) => fp.id === promoId);
      if (promo && Array.isArray(promo.items) && promo.items.length > 0) {
        for (const fpItem of promo.items) {
          const itemGrams = (Number(fpItem.weightGrams) || 250) * (Number(fpItem.quantity) || 1);
          addKg(fpItem.productId, itemGrams * qty);
        }
        continue;
      }
    }

    if (item.productId) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (prod) {
        let weightGrams = Number(item.customWeightGrams) || 0;
        if (weightGrams <= 0 && item.weightId) {
          const matchedWeight = prod.weights.find((w) => w.id === item.weightId);
          if (matchedWeight) {
            weightGrams = matchedWeight.weightGrams;
          }
        }
        if (weightGrams <= 0) {
          weightGrams = parseGramsFromLabel(item.weightLabel);
        }
        addKg(prod.id, weightGrams * qty);
      }
    }
  }

  return consumption;
}

/**
 * Atomically reverses stock depletion, VIP wallet redemption/cashback, and coupon usage
 * when an order is cancelled or deleted before cancellation.
 * Safe against double-execution via `order.inventoryReversed`.
 */
export function reverseOrderEffects(db: DatabaseSchema, order: Order): void {
  if (!order || order.inventoryReversed) {
    return;
  }

  // 1. Restore physical product stock
  const consumption = computeOrderStockConsumptionKg(db, order);
  for (const [prodId, consumedKg] of Object.entries(consumption)) {
    const product = db.products.find((p) => p.id === prodId);
    if (product && typeof product.stockKg === 'number') {
      const nextStock = Math.round((product.stockKg + consumedKg) * 1000) / 1000;
      product.stockKg = nextStock;
      if (nextStock > 0) {
        product.inStock = true;
      }
    }
  }

  // 2. Reverse VIP wallet redemption & earned cashback
  const cleanPhone = normalizePhone(order.customerPhone || '');
  if (cleanPhone && Array.isArray(db.vipMembers)) {
    const member = db.vipMembers.find(
      (m) => normalizePhone(m.phone) === cleanPhone
    );
    if (member) {
      const redeemed = Math.max(
        0,
        Number(order.vipWalletRedeemed ?? order.vipRedeemedAmount ?? 0) || 0
      );
      const earned = Math.max(0, Number(order.vipCashbackEarned ?? 0) || 0);
      const currentBal =
        typeof member.pointsBalance === 'number'
          ? member.pointsBalance
          : member.walletBalance || 0;

      const updatedBal = Math.max(
        0,
        Math.round((currentBal + redeemed - earned) * 100) / 100
      );
      member.pointsBalance = updatedBal;
      member.walletBalance = updatedBal;
      member.walletBalanceEgp = updatedBal;
      member.totalSpent = Math.max(
        0,
        Math.round(((member.totalSpent || 0) - (order.total || 0)) * 100) / 100
      );
      member.ordersCount = Math.max(0, (member.ordersCount || 1) - 1);
      member.tier = member.totalSpent >= 2000 ? 'Royal Platinum' : 'Gold VIP';

      if (redeemed > 0 || earned > 0) {
        member.transactions = [
          {
            id: `vip-rev-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'cashier_credit',
            amount: redeemed - earned,
            amountEgp: redeemed - earned,
            orderNumber: order.orderNumber,
            description: `تسوية إلغاء الطلب رقم ${order.orderNumber}`,
          },
          ...(member.transactions || []),
        ];
      }
    }
  }

  // 3. Decrement coupon usage counter if applicable
  if (order.couponCode && Array.isArray(db.coupons)) {
    const coupon = db.coupons.find(
      (c) => c.code.toUpperCase() === order.couponCode!.toUpperCase()
    );
    if (coupon && typeof coupon.usedCount === 'number' && coupon.usedCount > 0) {
      coupon.usedCount = Math.max(0, coupon.usedCount - 1);
    }
  }

  order.inventoryReversed = true;
}

/**
 * Re-applies stock depletion, VIP wallet adjustments, and coupon usage when an admin
 * transitions a previously cancelled order back to an active state.
 */
export function reapplyOrderEffects(
  db: DatabaseSchema,
  order: Order
): { ok: boolean; error?: string } {
  if (!order || !order.inventoryReversed) {
    return { ok: true };
  }

  const consumption = computeOrderStockConsumptionKg(db, order);
  for (const [prodId, requiredKg] of Object.entries(consumption)) {
    const product = db.products.find((p) => p.id === prodId);
    if (product && typeof product.stockKg === 'number') {
      if (product.stockKg < requiredKg) {
        return {
          ok: false,
          error: `لا يمكن إعادة تفعيل الطلب: المخزون الحالي لصنف "${product.name}" (${product.stockKg} كجم) أقل من الكمية المطلوبة (${requiredKg} كجم)`,
        };
      }
    }
  }

  for (const [prodId, requiredKg] of Object.entries(consumption)) {
    const product = db.products.find((p) => p.id === prodId);
    if (product && typeof product.stockKg === 'number') {
      const nextStock = Math.max(
        0,
        Math.round((product.stockKg - requiredKg) * 1000) / 1000
      );
      product.stockKg = nextStock;
      if (nextStock <= 0) {
        product.inStock = false;
      }
    }
  }

  const cleanPhone = normalizePhone(order.customerPhone || '');
  if (cleanPhone && Array.isArray(db.vipMembers)) {
    const member = db.vipMembers.find(
      (m) => normalizePhone(m.phone) === cleanPhone
    );
    if (member) {
      const redeemed = Math.max(
        0,
        Number(order.vipWalletRedeemed ?? order.vipRedeemedAmount ?? 0) || 0
      );
      const earned = Math.max(0, Number(order.vipCashbackEarned ?? 0) || 0);
      const currentBal =
        typeof member.pointsBalance === 'number'
          ? member.pointsBalance
          : member.walletBalance || 0;
      const updatedBal = Math.max(
        0,
        Math.round((currentBal - redeemed + earned) * 100) / 100
      );
      member.pointsBalance = updatedBal;
      member.walletBalance = updatedBal;
      member.walletBalanceEgp = updatedBal;
      member.totalSpent = Math.round(((member.totalSpent || 0) + (order.total || 0)) * 100) / 100;
      member.ordersCount = (member.ordersCount || 0) + 1;
      member.tier = member.totalSpent >= 2000 ? 'Royal Platinum' : 'Gold VIP';
    }
  }

  if (order.couponCode && Array.isArray(db.coupons)) {
    const coupon = db.coupons.find(
      (c) => c.code.toUpperCase() === order.couponCode!.toUpperCase()
    );
    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
    }
  }

  order.inventoryReversed = false;
  return { ok: true };
}
