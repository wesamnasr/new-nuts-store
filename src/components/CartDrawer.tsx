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
  Coffee,
  Gift,
  Wallet,
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/45 backdrop-blur-xs flex justify-end">
      <div
        className="fixed inset-0"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full sm:max-w-md bg-[#FAF6F0] h-full shadow-2xl flex flex-col justify-between border-r border-[#E8E0D5]">
        {/* Clean Light Drawer Header */}
        <div className="p-4 bg-white border-b border-[#E8E0D5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-cairo text-base font-bold text-[#231710]">
                سلة المشتريات
              </h2>
              <p className="text-xs text-[#6E5D4F]">
                {cart.length === 0
                  ? 'السلة فارغة حالياً'
                  : `${cart.length} أصناف في السلة`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-xl text-[#5C4A3D] hover:bg-[#FAF6F0] border border-transparent hover:border-[#E8E0D5] transition cursor-pointer"
            aria-label="إغلاق السلة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Calm Shipping & Cashback Progress Strip */}
        {cart.length > 0 && (
          <div className="bg-white px-4 py-3 border-b border-[#E8E0D5] space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              {remainingForVip > 0 ? (
                <span className="text-[#5C4A3D] flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span>
                    أضف <strong className="text-[#231710] tabular-nums">{remainingForVip} ج.م</strong> للحصول على 5% كاش باك VIP
                  </span>
                </span>
              ) : remainingForFree > 0 ? (
                <span className="text-[#5C4A3D] flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#3B6E4C]" />
                  <span>
                    أضف <strong className="text-[#231710] tabular-nums">{remainingForFree} ج.م</strong> للتوصيل المجاني
                  </span>
                </span>
              ) : (
                <span className="text-[#3B6E4C] flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مؤهل للتوصيل المجاني + كاش باك +{earnedCashback} ج.م</span>
                </span>
              )}
              <span className="text-[#6E5D4F] tabular-nums text-[11px]">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#FAF6F0] rounded-full overflow-hidden border border-[#E8E0D5]">
              <div
                className="h-full bg-[#231710] transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-14 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#E8E0D5] mx-auto flex items-center justify-center text-[#8A7968]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-cairo text-base font-bold text-[#231710]">
                  سلة المشتريات فارغة
                </h3>
                <p className="text-xs text-[#6E5D4F] max-w-xs mx-auto leading-relaxed">
                  تصفح أصناف البن والمكسرات الطازجة أو صمّم بوكس السهرة الخاص بك.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                <Link
                  href="/shop"
                  onClick={() => setIsCartOpen(false)}
                  className="bg-[#231710] text-[#FAF6F0] px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#362419] transition"
                >
                  تصفح المتجر
                </Link>
                <Link
                  href="/build-box"
                  onClick={() => setIsCartOpen(false)}
                  className="bg-white border border-[#E8E0D5] text-[#231710] px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#F4EFE6] transition"
                >
                  بوكس السهرة
                </Link>
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartItemId}
                className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-2.5"
              >
                <div className="flex gap-3">
                  <div className="w-14 h-14 shrink-0">
                    <img
                      src={getSafeImageUrl(item.productImage)}
                      alt={item.productName}
                      className="w-14 h-14 rounded-xl object-cover bg-[#FAF6F0] border border-[#E8E0D5]"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-cairo text-sm font-bold text-[#231710] truncate">
                        {item.productName}
                      </h4>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="text-[#8A7968] hover:text-[#B83B2B] p-0.5 transition cursor-pointer"
                        title="حذف"
                        aria-label={`حذف ${item.productName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-[11px] bg-[#FAF6F0] text-[#5C4A3D] font-medium px-2 py-0.5 rounded-lg border border-[#E8E0D5]">
                        {item.weightLabel}
                      </span>
                      <span className="text-[11px] bg-[#FAF6F0] text-[#5C4A3D] font-medium px-2 py-0.5 rounded-lg border border-[#E8E0D5]">
                        {item.roastOption}
                      </span>
                    </div>

                    {item.workerNotes && (
                      <p className="text-[11px] text-[#5C4A3D] mt-1.5 bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#E8E0D5]">
                        ملاحظة: {item.workerNotes}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center border border-[#E8E0D5] rounded-xl bg-[#FAF6F0]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="p-1.5 text-[#231710] hover:bg-white rounded-r-xl transition cursor-pointer"
                          aria-label="تقليل الكمية"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-[#231710] tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="p-1.5 text-[#231710] hover:bg-white rounded-l-xl transition cursor-pointer"
                          aria-label="زيادة الكمية"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right tabular-nums">
                        <div className="text-sm font-bold text-[#231710]">
                          {item.unitPrice * item.quantity} ج.م
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Partitioned Box Slots Breakdown */}
                {item.isPartitionedBox &&
                  item.partitionedSlots &&
                  item.partitionedSlots.length > 0 && (
                    <div className="pt-2.5 border-t border-[#F0EAE0] space-y-1.5">
                      <div className="text-[11px] font-bold text-[#5C4A3D] flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>أقسام البوكس ({item.partitionedSlots.length}):</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {item.partitionedSlots.map((slot, sIdx) => (
                          <div
                            key={sIdx}
                            className="text-[11px] bg-[#FAF6F0] px-2 py-1 rounded-lg border border-[#E8E0D5] truncate text-[#231710]"
                          >
                            <span className="text-[#9A6836] font-bold">#{slot.slotIndex}:</span>{' '}
                            {slot.productName} ({slot.roastOption})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Custom Coffee Blend Spec Breakdown */}
                {item.isCoffeeBlend && item.coffeeBlendSpec && (
                  <div className="pt-2.5 border-t border-[#F0EAE0] bg-[#FAF6F0] rounded-xl p-2.5 space-y-1 border">
                    <div className="text-[11px] font-bold text-[#231710] flex items-center gap-1">
                      <Coffee className="w-3.5 h-3.5 text-[#9A6836]" />
                      <span>تفاصيل التوليفة:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#5C4A3D]">
                      {item.coffeeBlendSpec.baristaLabel}
                    </p>
                  </div>
                )}

                {/* Custom Percentage Mix Breakdown */}
                {item.isCustomMix && item.customBreakdown && item.customBreakdown.length > 0 && (
                  <div className="pt-2.5 border-t border-[#F0EAE0] space-y-1.5">
                    <div className="text-[11px] font-bold text-[#5C4A3D]">
                      مكونات العلبة المشكلة:
                    </div>
                    <div className="space-y-1">
                      {item.customBreakdown.map((portion, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex items-center justify-between text-[11px] bg-[#FAF6F0] px-2 py-1 rounded-lg border border-[#E8E0D5]"
                        >
                          <span className="truncate text-[#231710]">
                            {portion.productName} ({portion.roastOption})
                          </span>
                          <span className="font-bold text-[#231710] tabular-nums">
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
          <div className="p-4 bg-white border-t border-[#E8E0D5] space-y-3">
            {/* Coupon Box */}
            <div className="space-y-1.5">
              {appliedCoupon ? (
                <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#3B6E4C] font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    <span>
                      كود الخصم: <strong>{appliedCoupon.code}</strong> (-{discountAmount} ج.م)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-[#B83B2B] font-bold hover:underline cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="لديك كود خصم؟"
                    className="flex-1 text-xs border border-[#E8E0D5] bg-[#FAF6F0] rounded-xl px-3 py-2 focus:outline-none focus:border-[#231710]"
                  />
                  <button
                    type="submit"
                    className="bg-[#FAF6F0] hover:bg-[#F4EFE6] border border-[#E8E0D5] text-[#231710] font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
                  >
                    تطبيق
                  </button>
                </form>
              )}
              {couponFeedback && !appliedCoupon && (
                <p
                  className={`text-xs font-medium ${
                    couponFeedback.type === 'success' ? 'text-[#3B6E4C]' : 'text-[#B83B2B]'
                  }`}
                >
                  {couponFeedback.text}
                </p>
              )}
            </div>

            {/* Totals Summary */}
            <div className="space-y-1.5 text-xs border-t border-[#F0EAE0] pt-2.5 tabular-nums">
              <div className="flex justify-between text-[#6E5D4F]">
                <span>المجموع الفرعي</span>
                <span className="font-bold text-[#231710]">{cartSubtotal} ج.م</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#3B6E4C] font-bold">
                  <span>الخصم</span>
                  <span>- {discountAmount} ج.م</span>
                </div>
              )}
              {earnedCashback > 0 && (
                <div className="flex justify-between text-[#9A6836] font-medium">
                  <span>كاش باك محفظة VIP (5%)</span>
                  <span>+ {earnedCashback} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-[#231710] font-bold text-sm pt-1.5 border-t border-[#F0EAE0]">
                <span>الإجمالي قبل التوصيل</span>
                <span>{netSubtotal} ج.م</span>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <span>إتمام الطلب</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <a
                href={`https://wa.me/${formatWhatsAppPhone(
                  storeData?.settings.whatsappNumber
                )}?text=${encodeURIComponent(
                  `مرحباً محمصة حفصة للبن والمكسرات، أود طلب السلة التالية:\n` +
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
                    `\nالإجمالي قبل التوصيل: ${netSubtotal} ج.م`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-white hover:bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <MessageCircle className="w-4 h-4 text-[#3B6E4C]" />
                <span>طلب سريع عبر واتساب</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
