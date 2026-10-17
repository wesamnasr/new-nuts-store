'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Truck,
  Tag,
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  Crown,
  Coffee,
  Gift,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getSafeImageUrl } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';
import { calculateVipCashback } from '@/lib/pricing';

export default function CartDrawer() {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    updateQuantity,
    removeFromCart,
    cartSubtotal,
    appliedCoupon,
    applyCouponCode,
    removeCoupon,
    discountAmount,
    storeData,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isCartOpen) return null;

  const vipMinThreshold = storeData?.settings.vipMinOrderForCashback || 150;
  const freeShippingThreshold = storeData?.settings.freeShippingThreshold || 300;
  const netSubtotal = Math.max(0, cartSubtotal - discountAmount);

  const remainingForVip = Math.max(0, vipMinThreshold - cartSubtotal);
  const remainingForFree = Math.max(0, freeShippingThreshold - cartSubtotal);
  const progressPercent = Math.min(
    100,
    Math.round((cartSubtotal / freeShippingThreshold) * 100)
  );
  const earnedCashback = calculateVipCashback(netSubtotal, vipMinThreshold, 5);

  // Smart recommendation to unlock VIP Cashback or Free Shipping in 1 click
  const upsellSuggestion = (() => {
    if (cart.length === 0 || remainingForFree <= 0 || !storeData?.products) return null;
    const targetAmount = remainingForVip > 0 ? remainingForVip : remainingForFree;
    const inCartIds = new Set(cart.map((c) => c.productId));
    const candidates: Array<{
      product: (typeof storeData.products)[number];
      weight: (typeof storeData.products)[number]['weights'][number];
      notInCart: boolean;
      unlocksImmediately: boolean;
      priceDiff: number;
    }> = [];

    for (const prod of storeData.products) {
      if (!prod.inStock || !prod.weights || prod.weights.length === 0) continue;
      const sortedWeights = [...prod.weights].sort((a, b) => a.price - b.price);
      const unlockingWeight = sortedWeights.find((w) => w.price >= targetAmount);
      const chosenWeight = unlockingWeight || sortedWeights[1] || sortedWeights[0];
      candidates.push({
        product: prod,
        weight: chosenWeight,
        notInCart: !inCartIds.has(prod.id),
        unlocksImmediately: chosenWeight.price >= targetAmount,
        priceDiff: Math.abs(chosenWeight.price - targetAmount),
      });
    }

    candidates.sort((a, b) => {
      if (a.unlocksImmediately !== b.unlocksImmediately) {
        return a.unlocksImmediately ? -1 : 1;
      }
      if (a.notInCart !== b.notInCart) {
        return a.notInCart ? -1 : 1;
      }
      return a.priceDiff - b.priceDiff;
    });

    return candidates[0] || null;
  })();

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const res = applyCouponCode(couponInput);
    setCouponFeedback({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/55 backdrop-blur-xs flex justify-end">
      <div
        className="fixed inset-0"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full sm:max-w-md bg-[#FAF6F0] h-full shadow-2xl flex flex-col justify-between border-r border-[#E6DFD3]">
        {/* Drawer Header */}
        <div className="p-3.5 bg-[#231710] text-[#FAF6F0] border-b border-[#D4AF37]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37] text-[#231710] flex items-center justify-center font-black">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-cairo text-sm font-black text-white">
                سلة مشتريات محمصة حفصة
              </h2>
              <p className="text-[10.5px] text-[#D4AF37]">
                {cart.length === 0
                  ? 'السلة فارغة حالياً'
                  : `لديك ${cart.length} أصناف مختارة بعناية`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 rounded-lg text-[#FAF6F0] hover:bg-white/10 transition cursor-pointer"
            aria-label="إغلاق السلة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Stage Interactive Progress Bar (150 EGP VIP Cashback & 300 EGP Free Delivery) */}
        <div className="bg-[#F3ECE1] px-3.5 py-2.5 border-b border-[#E6DFD3] space-y-2">
          <div>
            <div className="flex items-center justify-between text-[10.5px] font-extrabold mb-1.5">
              {remainingForVip > 0 ? (
                <span className="text-[#231710] flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-[#C88A4B]" />
                  أضف بقيمة{' '}
                  <span className="text-[#B83B2B] font-black tabular-nums">
                    {remainingForVip} ج.م
                  </span>{' '}
                  للحصول على كاش باك 5% في محفظة حفصة VIP!
                </span>
              ) : remainingForFree > 0 ? (
                <span className="text-[#231710] flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-[#3B6E4C]" />
                  كسبت <strong className="text-[#3B6E4C]">+{earnedCashback} ج</strong> كاش باك! أضف{' '}
                  <span className="text-[#3B6E4C] font-black tabular-nums">
                    {remainingForFree} ج.م
                  </span>{' '}
                  للتوصيل المجاني ببني مزار
                </span>
              ) : (
                <span className="text-[#3B6E4C] flex items-center gap-1 font-black">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3B6E4C]" />
                  مبروك! توصيل مجاني داخل بني مزار + كاش باك +{earnedCashback} ج.م في محفظة VIP 🎉
                </span>
              )}
              <span className="text-[#231710] tabular-nums">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-[#E6DFD3] relative">
              <div
                className="h-full bg-gradient-to-l from-[#3B6E4C] to-[#D4AF37] transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-bold text-[#6E5D4F] mt-1 tabular-nums">
              <span>0 ج</span>
              <span className={cartSubtotal >= vipMinThreshold ? 'text-[#3B6E4C] font-black' : ''}>
                👑 150 ج (كاش باك 5%)
              </span>
              <span className={cartSubtotal >= freeShippingThreshold ? 'text-[#3B6E4C] font-black' : ''}>
                🛵 300 ج (توصيل مجاني)
              </span>
            </div>
          </div>

          {upsellSuggestion && (
            <div className="bg-white rounded-xl p-2 border border-[#E6DFD3] flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={getSafeImageUrl(upsellSuggestion.product.image)}
                  alt={upsellSuggestion.product.name}
                  className="w-9 h-9 rounded-lg object-cover border border-[#E6DFD3] shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[9.5px] font-extrabold text-[#3B6E4C]">
                    ✨ مقترح يكمل سهرتك ويفعّل المزايا:
                  </div>
                  <div className="text-[11px] font-black text-[#231710] truncate">
                    {upsellSuggestion.product.name}
                  </div>
                  <div className="text-[9.5px] text-[#6E5D4F] font-bold tabular-nums">
                    {upsellSuggestion.weight.label} •{' '}
                    <span className="text-[#231710] font-black">
                      {upsellSuggestion.weight.price} ج.م
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  addToCart(
                    upsellSuggestion.product,
                    upsellSuggestion.weight,
                    upsellSuggestion.product.roastOptions[0] || 'محمص مملح',
                    1
                  )
                }
                className="bg-[#3B6E4C] hover:opacity-90 text-white text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg shrink-0 flex items-center gap-0.5 transition shadow-2xs cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>أضف</span>
              </button>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {cart.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#F3ECE1] border border-[#E6DFD3] mx-auto flex items-center justify-center text-2xl">
                ☕
              </div>
              <div className="space-y-1">
                <h3 className="font-cairo text-sm font-black text-[#231710]">
                  سلة السهرة فارغة حالياً
                </h3>
                <p className="text-xs text-[#6E5D4F] max-w-xs mx-auto">
                  جرّب تصميم «بوكس الـ 125 جنيه» المقسم أو توليفة قهوتك الخاصة من محمصة حفصة ببني مزار
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Link
                  href="/build-box"
                  onClick={() => setIsCartOpen(false)}
                  className="bg-[#D4AF37] text-[#231710] px-3.5 py-2 rounded-xl text-xs font-black hover:opacity-90 transition"
                >
                  🎁 صمّم بوكس السهرة
                </Link>
                <Link
                  href="/shop"
                  onClick={() => setIsCartOpen(false)}
                  className="bg-[#231710] text-[#FAF6F0] px-3.5 py-2 rounded-xl text-xs font-black hover:opacity-90 transition"
                >
                  🥜 تصفح المتجر
                </Link>
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartItemId}
                className={`bg-white p-2.5 rounded-xl border transition shadow-2xs ${
                  item.isPartitionedBox || item.isCoffeeBlend || item.isCustomMix
                    ? 'border-[#D4AF37] bg-[#FAF6F0]/60'
                    : 'border-[#E6DFD3]'
                }`}
              >
                <div className="flex gap-2.5">
                  <div className="relative w-13 h-13 shrink-0">
                    <img
                      src={getSafeImageUrl(item.productImage)}
                      alt={item.productName}
                      className="w-13 h-13 rounded-xl object-cover bg-[#F3ECE1] border border-[#E6DFD3]"
                    />
                    {(item.isPartitionedBox || item.isCoffeeBlend || item.isCustomMix) && (
                      <span className="absolute -top-1 -right-1 bg-[#231710] text-[#D4AF37] text-[8px] font-black px-1.5 py-0.2 rounded-full shadow border border-[#D4AF37]">
                        خاص ✨
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-cairo text-xs font-black text-[#231710] truncate">
                        {item.productName}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="text-[#B83B2B] hover:opacity-80 p-0.5 transition cursor-pointer"
                        title="حذف"
                        aria-label={`حذف ${item.productName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[9.5px] bg-[#F3ECE1] text-[#231710] font-extrabold px-1.5 py-0.5 rounded-md border border-[#E6DFD3]">
                        {item.weightLabel}
                      </span>
                      <span className="text-[9.5px] bg-[#C88A4B]/15 text-[#231710] font-extrabold px-1.5 py-0.5 rounded-md">
                        {item.roastOption}
                      </span>
                    </div>

                    {item.workerNotes && (
                      <p className="text-[9.5px] text-[#3B6E4C] font-bold mt-1 bg-[#3B6E4C]/10 px-2 py-0.5 rounded">
                        📝 ملاحظة للعامل: {item.workerNotes}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-[#E6DFD3] rounded-lg bg-[#F3ECE1]">
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="p-1 text-[#231710] hover:bg-white rounded-r-lg transition cursor-pointer"
                          aria-label="تقليل الكمية"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-black text-[#231710] tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="p-1 text-[#231710] hover:bg-white rounded-l-lg transition cursor-pointer"
                          aria-label="زيادة الكمية"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right tabular-nums">
                        <div className="text-xs font-black text-[#231710]">
                          {item.unitPrice * item.quantity} ج.م
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-[9px] text-[#6E5D4F]">
                            ({item.unitPrice} ج.م للقطعة)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Partitioned Box Slots Breakdown */}
                {item.isPartitionedBox &&
                  item.partitionedSlots &&
                  item.partitionedSlots.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#E6DFD3] bg-[#F3ECE1]/60 rounded-lg p-2 space-y-1">
                      <div className="text-[9.5px] font-black text-[#231710] flex items-center gap-1">
                        <Gift className="w-3 h-3 text-[#C88A4B]" />
                        <span>خانات البوكس المقسم ({item.partitionedSlots.length} خانات):</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {item.partitionedSlots.map((slot, sIdx) => (
                          <div
                            key={sIdx}
                            className="text-[9px] bg-white px-1.5 py-1 rounded border border-[#E6DFD3] truncate font-bold text-[#231710]"
                          >
                            <span className="text-[#C88A4B] font-black">#{slot.slotIndex}:</span>{' '}
                            {slot.productName} ({slot.roastOption})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Custom Coffee Blend Spec Breakdown */}
                {item.isCoffeeBlend && item.coffeeBlendSpec && (
                  <div className="mt-2 pt-2 border-t border-[#E6DFD3] bg-[#231710] text-[#FAF6F0] rounded-lg p-2 space-y-1">
                    <div className="text-[9.5px] font-black text-[#D4AF37] flex items-center gap-1">
                      <Coffee className="w-3 h-3" />
                      <span>ستيكر البارستا (مطحن حفصة):</span>
                    </div>
                    <p className="text-[9.5px] leading-relaxed text-[#FAF6F0]/90 font-medium">
                      {item.coffeeBlendSpec.baristaLabel}
                    </p>
                  </div>
                )}

                {/* Custom Percentage Mix Breakdown */}
                {item.isCustomMix && item.customBreakdown && item.customBreakdown.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#E6DFD3] bg-[#F3ECE1]/60 rounded-lg p-2 space-y-1">
                    <div className="text-[9.5px] font-black text-[#231710]">
                      🥜 مكونات العلبة المشكلة:
                    </div>
                    <div className="space-y-0.5">
                      {item.customBreakdown.map((portion, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex items-center justify-between text-[9px] bg-white px-1.5 py-0.5 rounded border border-[#E6DFD3]"
                        >
                          <span className="font-bold truncate text-[#231710]">
                            {portion.productName} ({portion.roastOption})
                          </span>
                          <span className="font-black text-[#231710] tabular-nums">
                            {portion.percentage}% ({portion.weightGrams}جم)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer: Coupon & Checkout CTA */}
        {cart.length > 0 && (
          <div className="p-3.5 bg-white border-t border-[#E6DFD3] space-y-2.5">
            {/* Coupon Box */}
            <div className="space-y-1">
              {appliedCoupon ? (
                <div className="bg-[#3B6E4C]/10 border border-[#3B6E4C]/30 rounded-lg p-2 flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-1 text-[#3B6E4C] font-extrabold">
                    <Tag className="w-3.5 h-3.5" />
                    <span>
                      كود مطبق: <strong>{appliedCoupon.code}</strong> (-{discountAmount} ج.م)
                    </span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-[#B83B2B] font-extrabold hover:underline cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <>
                  {storeData?.coupons && storeData.coupons.filter((c) => c.active).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9.5px] font-extrabold text-[#6E5D4F]">
                        🎟️ أكواد خصم حفصة:
                      </span>
                      {storeData.coupons
                        .filter((c) => c.active)
                        .map((c) => {
                          const eligible = cartSubtotal >= c.minOrderAmount;
                          const diff = Math.max(0, c.minOrderAmount - cartSubtotal);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                const res = applyCouponCode(c.code);
                                setCouponFeedback({
                                  type: res.success ? 'success' : 'error',
                                  text: res.message,
                                });
                              }}
                              className={`text-[9.5px] px-2 py-0.5 rounded-md border font-extrabold transition cursor-pointer flex items-center gap-1 ${
                                eligible
                                  ? 'bg-[#3B6E4C]/10 text-[#3B6E4C] border-[#3B6E4C]/40 hover:bg-[#3B6E4C]/20'
                                  : 'bg-[#F3ECE1] text-[#6E5D4F] border-[#E6DFD3]'
                              }`}
                              title={c.description}
                            >
                              <span className="font-mono">{c.code}</span>
                              <span className="text-[8.5px]">
                                {eligible ? '(تفعيل ✨)' : `(باقي ${diff}ج)`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}

                  <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="أدخل كود الخصم (مثال: HAFSA10)"
                      className="flex-1 text-xs border border-[#E6DFD3] bg-[#FAF6F0] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C88A4B]"
                    />
                    <button
                      type="submit"
                      className="bg-[#F3ECE1] hover:bg-[#E6DFD3] text-[#231710] font-extrabold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      تطبيق
                    </button>
                  </form>
                </>
              )}
              {couponFeedback && !appliedCoupon && (
                <p
                  className={`text-[10px] mt-0.5 font-bold ${
                    couponFeedback.type === 'success' ? 'text-[#3B6E4C]' : 'text-[#B83B2B]'
                  }`}
                >
                  {couponFeedback.text}
                </p>
              )}
            </div>

            {/* Totals Summary */}
            <div className="space-y-1 text-xs border-t border-[#E6DFD3] pt-2 tabular-nums">
              <div className="flex justify-between text-[#6E5D4F]">
                <span>المجموع الفرعي:</span>
                <span className="font-extrabold text-[#231710]">{cartSubtotal} ج.م</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#3B6E4C] font-extrabold">
                  <span>قيمة الخصم:</span>
                  <span>- {discountAmount} ج.م</span>
                </div>
              )}
              {earnedCashback > 0 && (
                <div className="flex justify-between text-[#C88A4B] font-extrabold text-[11px]">
                  <span>👑 كاش باك محفظة حفصة VIP (5%):</span>
                  <span>+ {earnedCashback} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-[#231710] font-black text-sm pt-1">
                <span>الإجمالي (قبل التوصيل):</span>
                <span>{netSubtotal} ج.م</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-[#231710] hover:bg-[#3A2519] text-[#FAF6F0] border border-[#D4AF37]/50 py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition"
              >
                <span>إتمام الطلب وتحديد العنوان ببني مزار</span>
                <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
              </Link>

              <a
                href={`https://wa.me/${formatWhatsAppPhone(
                  storeData?.settings.whatsappNumber
                )}?text=${encodeURIComponent(
                  `مرحباً محمصة حفصة للبن والمكسرات ☕🥜، أود طلب السلة التالية:\n` +
                    cart
                      .map((item, idx) =>
                        item.isPartitionedBox && item.partitionedSlots
                          ? `${idx + 1}. ${item.productName} × ${item.quantity} = ${
                              item.unitPrice * item.quantity
                            } ج.م\n   • الخانات: ${item.partitionedSlots
                              .map((s) => `[${s.slotIndex}] ${s.productName} (${s.roastOption})`)
                              .join(' + ')}`
                          : item.isCoffeeBlend && item.coffeeBlendSpec
                            ? `${idx + 1}. ${item.productName} × ${item.quantity} = ${
                                item.unitPrice * item.quantity
                              } ج.م\n   • التوليفة: ${item.coffeeBlendSpec.baristaLabel}`
                            : `${idx + 1}. ${item.productName} (${item.weightLabel} - ${
                                item.roastOption
                              }) × ${item.quantity} = ${item.unitPrice * item.quantity} ج.م`
                      )
                      .join('\n') +
                    `\n💰 الإجمالي قبل التوصيل: ${netSubtotal} ج.م`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#3B6E4C]/10 hover:bg-[#3B6E4C]/20 text-[#3B6E4C] border border-[#3B6E4C]/40 py-2 px-3 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>إرسال السلة مباشرة عبر واتساب الفرع</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
