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
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getSafeImageUrl } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';

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

  const freeShippingThreshold = storeData?.settings.freeShippingThreshold || 1000;
  const progressPercent = Math.min(100, Math.round((cartSubtotal / freeShippingThreshold) * 100));
  const remainingForFree = Math.max(0, freeShippingThreshold - cartSubtotal);

  // Smart recommendation to unlock Free Shipping in 1 click
  const freeShippingSuggestion = (() => {
    if (cart.length === 0 || remainingForFree <= 0 || !storeData?.products) return null;
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
      const unlockingWeight = sortedWeights.find((w) => w.price >= remainingForFree);
      const chosenWeight = unlockingWeight || sortedWeights[sortedWeights.length - 1];
      candidates.push({
        product: prod,
        weight: chosenWeight,
        notInCart: !inCartIds.has(prod.id),
        unlocksImmediately: chosenWeight.price >= remainingForFree,
        priceDiff: Math.abs(chosenWeight.price - remainingForFree),
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end">
      <div
        className="fixed inset-0"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full sm:max-w-sm bg-brand-50 h-full shadow-2xl flex flex-col justify-between border-r border-brand-200">
        {/* Drawer Header */}
        <div className="p-3 bg-white border-b border-brand-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-900 text-gold-400 flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-brand-950">سلة المشتريات</h2>
              <p className="text-[10px] text-brand-600">
                {cart.length === 0
                  ? 'السلة فارغة حالياً'
                  : `لديك ${cart.length} أصناف مختارة بعناية`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-1 rounded-lg text-brand-700 hover:bg-brand-100 transition"
            aria-label="إغلاق السلة"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Free Shipping Progress Bar + Smart One-Click Upsell */}
        <div className="bg-pistachio-50 px-3 py-2 border-b border-pistachio-100 space-y-1.5">
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
              {remainingForFree > 0 ? (
                <span className="text-brand-900 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-pistachio-600" />
                  أضف <span className="text-pistachio-700 font-extrabold">{remainingForFree} ج.م</span> للحصول على شحن مجاني!
                </span>
              ) : (
                <span className="text-pistachio-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-pistachio-600" />
                  مبروك! طلبك مؤهل للشحن المجاني لجميع المحافظات 🎉
                </span>
              )}
              <span className="text-pistachio-700">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-pistachio-200">
              <div
                className="h-full bg-pistachio-600 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {freeShippingSuggestion && (
            <div className="bg-white/95 rounded-lg p-1.5 border border-pistachio-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <img
                  src={getSafeImageUrl(freeShippingSuggestion.product.image)}
                  alt={freeShippingSuggestion.product.name}
                  className="w-8 h-8 rounded-md object-cover border border-brand-100 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-pistachio-700">
                    {freeShippingSuggestion.unlocksImmediately
                      ? '✨ يفعّل الشحن المجاني فوراً:'
                      : '✨ مقترح لإكمال الشحن المجاني:'}
                  </div>
                  <div className="text-[10px] font-extrabold text-brand-950 truncate">
                    {freeShippingSuggestion.product.name}
                  </div>
                  <div className="text-[9px] text-brand-600 font-bold">
                    {freeShippingSuggestion.weight.label} •{' '}
                    <span className="text-brand-950 font-extrabold">
                      {freeShippingSuggestion.weight.price} ج.م
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  addToCart(
                    freeShippingSuggestion.product,
                    freeShippingSuggestion.weight,
                    freeShippingSuggestion.product.roastOptions[0] || 'محمص مملح',
                    1
                  )
                }
                className="bg-pistachio-600 hover:bg-pistachio-700 text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0 flex items-center gap-0.5 transition shadow-2xs cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>أضف</span>
              </button>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-10 space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-brand-100 mx-auto flex items-center justify-center text-xl">
                🥜
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-extrabold text-brand-950">
                  سلة المشتريات فارغة
                </h3>
                <p className="text-[10px] text-brand-600 max-w-xs mx-auto">
                  تصفح تشكيلتنا الفاخرة من البندق والفستق وعين الجمل وبوكسات المشكل الطازجة
                </p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="bg-brand-900 text-white px-4 py-1.5 rounded-lg text-[11px] font-bold hover:bg-brand-950 transition"
              >
                تصفح المنتجات الآن
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartItemId}
                className={`bg-white p-2 rounded-lg border transition shadow-2xs ${
                  item.isCustomMix ? 'border-amber-300/80 bg-amber-50/20' : 'border-brand-200'
                }`}
              >
                <div className="flex gap-2">
                  <div className="relative w-12 h-12 shrink-0">
                    <img
                      src={getSafeImageUrl(item.productImage)}
                      alt={item.productName}
                      className="w-12 h-12 rounded-md object-cover bg-brand-100 border border-brand-100"
                    />
                    {item.isCustomMix && (
                      <span className="absolute -top-1 -right-1 bg-gradient-to-l from-gold-500 to-amber-400 text-brand-950 text-[7.5px] font-bold px-1 py-0.2 rounded-full shadow border border-white">
                        مخصص ✨
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-[11px] font-extrabold text-brand-950 truncate">
                        {item.productName}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="text-red-500 hover:text-red-700 p-0.5 transition cursor-pointer"
                        title="حذف"
                        aria-label={`حذف ${item.productName}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {item.isCustomMix ? (
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="text-[8.5px] bg-brand-900 text-gold-400 font-bold px-1.5 py-0.2 rounded">
                          سعة {item.boxCapacityGrams ? (item.boxCapacityGrams >= 1000 ? `${item.boxCapacityGrams / 1000} كجم` : `${item.boxCapacityGrams} جم`) : item.weightLabel}
                        </span>
                        <span className="text-[8.5px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded border border-amber-200">
                          {item.customBreakdown?.length || 0} أصناف مختارة
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <span className="text-[9px] bg-brand-100 text-brand-900 font-bold px-1.5 py-0.2 rounded">
                          {item.weightLabel}
                        </span>
                        <span className="text-[9px] bg-amber-100 text-brand-900 font-bold px-1.5 py-0.2 rounded">
                          {item.roastOption}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center border border-brand-200 rounded-md bg-brand-50">
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="p-0.5 text-brand-900 hover:bg-brand-200 rounded-r-md transition cursor-pointer"
                          aria-label="تقليل الكمية"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="px-2 text-[10px] font-extrabold text-brand-950">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="p-0.5 text-brand-900 hover:bg-brand-200 rounded-l-md transition cursor-pointer"
                          aria-label="زيادة الكمية"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] font-extrabold text-brand-950">
                          {item.unitPrice * item.quantity} ج.م
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-[8.5px] text-brand-600">
                            ({item.unitPrice} ج.م للعلبة)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Mix Breakdown List */}
                {item.isCustomMix && item.customBreakdown && item.customBreakdown.length > 0 && (
                  <div className="mt-1.5 pt-1 border-t border-amber-200/60 bg-amber-50/60 rounded-md p-1.5 space-y-1">
                    <div className="text-[9px] font-bold text-brand-900 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-amber-900">
                        <span>🥜</span>
                        <span>مكونات العلبة المشكلة:</span>
                      </span>
                      <span className="text-[8px] font-bold text-pistachio-700 bg-white px-1 py-0.2 rounded border border-pistachio-200">
                        100% مكتمل
                      </span>
                    </div>

                    <div className="space-y-0.5 pt-0.5">
                      {item.customBreakdown.map((portion, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex items-center justify-between text-[9px] text-brand-900 bg-white/80 px-1.5 py-0.5 rounded border border-amber-100"
                        >
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            <span className="w-1 h-1 rounded-full bg-gold-500 shrink-0" />
                            <span className="font-bold truncate text-brand-950">
                              {portion.productName}
                            </span>
                            <span className="text-[8.5px] text-brand-600 font-medium shrink-0">
                              ({portion.roastOption})
                            </span>
                          </div>
                          <div className="shrink-0 font-bold text-[8.5px] text-brand-900 font-mono flex items-center gap-1">
                            <span>{portion.percentage}%</span>
                            <span className="text-brand-600 font-normal">
                              ({portion.weightGrams}جم)
                            </span>
                          </div>
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
          <div className="p-3 bg-white border-t border-brand-200 space-y-2">
            {/* Coupon Box + One-Click Coupon Chips */}
            <div className="space-y-1">
              {appliedCoupon ? (
                <div className="bg-pistachio-50 border border-pistachio-200 rounded-md p-1.5 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1 text-pistachio-700 font-bold">
                    <Tag className="w-3 h-3" />
                    <span>
                      كود مطبق: <strong>{appliedCoupon.code}</strong> (-{discountAmount} ج.م)
                    </span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-red-600 font-bold hover:underline cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <>
                  {/* One-Click Available Coupons */}
                  {storeData?.coupons && storeData.coupons.filter((c) => c.active).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9.5px] font-bold text-brand-700">🎟️ كوبونات سريعة:</span>
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
                              className={`text-[9.5px] px-1.5 py-0.5 rounded border font-bold transition cursor-pointer flex items-center gap-1 ${
                                eligible
                                  ? 'bg-pistachio-50 text-pistachio-800 border-pistachio-300 hover:bg-pistachio-100'
                                  : 'bg-brand-50 text-brand-600 border-brand-200 opacity-85'
                              }`}
                              title={c.description}
                            >
                              <span className="font-mono">{c.code}</span>
                              <span className="text-[8.5px] font-semibold">
                                {eligible ? '(تطبيق ✨)' : `(باقي ${diff} ج.م)`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}

                  <form onSubmit={handleApplyCoupon} className="flex gap-1">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="لديك كود خصم؟ (مثال: OASIS10)"
                      className="flex-1 text-[11px] border border-brand-200 rounded-md px-2 py-1 focus:outline-none focus:border-brand-600"
                    />
                    <button
                      type="submit"
                      className="bg-brand-100 hover:bg-brand-200 text-brand-950 font-bold text-[11px] px-2.5 py-1 rounded-md transition cursor-pointer"
                    >
                      تطبيق
                    </button>
                  </form>
                </>
              )}
              {couponFeedback && !appliedCoupon && (
                <p
                  className={`text-[9.5px] mt-0.5 font-semibold ${
                    couponFeedback.type === 'success' ? 'text-pistachio-700' : 'text-red-600'
                  }`}
                >
                  {couponFeedback.text}
                </p>
              )}
            </div>

            {/* Totals Summary */}
            <div className="space-y-0.5 text-[11px] border-t border-brand-100 pt-1.5">
              <div className="flex justify-between text-brand-700 text-[10px]">
                <span>المجموع الفرعي:</span>
                <span className="font-bold">{cartSubtotal} ج.م</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-pistachio-700 text-[10px] font-bold">
                  <span>قيمة الخصم:</span>
                  <span>- {discountAmount} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-brand-950 font-extrabold text-xs pt-0.5">
                <span>الإجمالي (قبل الشحن):</span>
                <span>{cartSubtotal - discountAmount} ج.م</span>
              </div>
            </div>

            <div className="space-y-1">
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-gradient-to-l from-brand-800 to-brand-950 hover:from-brand-900 hover:to-brand-950 text-white py-2 px-3 rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <span>إتمام الطلب وتحديد العنوان</span>
                <ArrowLeft className="w-3 h-3 text-gold-400" />
              </Link>

              <a
                href={`https://wa.me/${formatWhatsAppPhone(
                  storeData?.settings.whatsappNumber
                )}?text=${encodeURIComponent(
                  `مرحباً محمصة الواحة الذهبية 🌰، أود طلب السلة التالية:\n` +
                    cart
                      .map((item, idx) =>
                        item.isCustomMix && item.customBreakdown
                          ? `${idx + 1}. ${item.productName} (${item.weightLabel}) × ${item.quantity} = ${
                              item.unitPrice * item.quantity
                            } ج.م\n   • المكونات: ${item.customBreakdown
                              .map((b) => `${b.productName} ${b.percentage}% (${b.roastOption})`)
                              .join(' + ')}`
                          : `${idx + 1}. ${item.productName} (${item.weightLabel} - ${
                              item.roastOption
                            }) × ${item.quantity} = ${item.unitPrice * item.quantity} ج.م`
                      )
                      .join('\n') +
                    (appliedCoupon
                      ? `\n🎟️ كود الخصم: ${appliedCoupon.code} (-${discountAmount} ج.م)`
                      : '') +
                    `\n💰 الإجمالي قبل الشحن: ${cartSubtotal - discountAmount} ج.م`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-green-50 hover:bg-green-100 text-green-800 border border-green-300 py-1.5 px-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition"
              >
                <MessageCircle className="w-3 h-3 text-green-600" />
                <span>اطلب السلة سريعاً عبر واتساب</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
