'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Truck,
  Wallet,
  Banknote,
  Smartphone,
  ShieldCheck,
  MessageCircle,
  PackageSearch,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { Order, PaymentMethod } from '@/types/store';
import { validateEgyptianPhone, formatWhatsAppPhone } from '@/lib/validation';
import { getResolvedPageContent, getSafeImageUrl } from '@/lib/defaults';

export default function CheckoutPage() {
  const {
    cart,
    cartSubtotal,
    appliedCoupon,
    applyCouponCode,
    removeCoupon,
    discountAmount,
    clearCart,
    storeData,
  } = useStore();

  const shippingRates = storeData?.shippingRates || [];
  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const freeShippingThreshold = settings?.freeShippingThreshold || 1000;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAltPhone, setCustomerAltPhone] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState(
    shippingRates[0]?.governorate || 'القاهرة والجيزة'
  );
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isGift, setIsGift] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState('');

  const GIFT_PRESET_MESSAGES = [
    'كل عام وأنتم بخير وبصحة وسعادة 🌙✨',
    'هدية محبة وتقدير من القلب 🎁🌰',
    'مبارك النجاح والتميز الدائم 🎉',
    'بالهناء والشفاء مع أطيب تحياتي 🥜',
  ];

  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedRate = useMemo(() => {
    return (
      shippingRates.find((r) => r.governorate === selectedGovernorate) ||
      shippingRates[0] || { price: 50, estimatedDays: '1 - 2 يوم عمل' }
    );
  }, [shippingRates, selectedGovernorate]);

  const isFreeShipping = cartSubtotal >= freeShippingThreshold;
  const shippingCost = isFreeShipping ? 0 : selectedRate.price;
  const finalTotal = Math.max(0, cartSubtotal - discountAmount + shippingCost);

  const handleCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const res = applyCouponCode(couponInput);
    setCouponMsg(res.message);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      setErrorMsg('يرجى ملء الاسم ورقم الهاتف والعنوان بالتفصيل لإتمام الطلب');
      return;
    }

    // Validate Egyptian mobile phone
    const phoneValidation = validateEgyptianPhone(customerPhone);
    if (!phoneValidation.isValid) {
      setErrorMsg(phoneValidation.error || 'يرجى إدخال رقم هاتف مصري صحيح (010، 011، 012، 015) مكون من 11 رقماً');
      return;
    }

    // Validate optional alternate phone if provided
    let normalizedAltPhone = '';
    if (customerAltPhone.trim()) {
      const altPhoneValidation = validateEgyptianPhone(customerAltPhone);
      if (!altPhoneValidation.isValid) {
        setErrorMsg(`رقم الهاتف البديل غير صحيح: ${altPhoneValidation.error}`);
        return;
      }
      normalizedAltPhone = altPhoneValidation.normalized;
    }

    // Verify coupon eligibility dynamically
    if (appliedCoupon && cartSubtotal < appliedCoupon.minOrderAmount) {
      removeCoupon();
      setErrorMsg(
        `تم إلغاء كود الخصم تلقائياً لأن إجمالي السلة (${cartSubtotal} ج.م) أقل من الحد الأدنى (${appliedCoupon.minOrderAmount} ج.م)`
      );
      return;
    }

    if (
      (paymentMethod === 'instapay' || paymentMethod === 'vodafone_cash') &&
      !paymentReference.trim()
    ) {
      setErrorMsg('يرجى كتابة رقم الهاتف المحول منه أو الرقم المرجعي للتحويل');
      return;
    }

    const giftNoteSegment = isGift
      ? `🎁 [طلب هدية فاخرة${giftRecipient.trim() ? ` إلى: ${giftRecipient.trim()}` : ''}${
          giftMessage.trim() ? ` | رسالة البطاقة: "${giftMessage.trim()}"` : ''
        }]`
      : '';
    const combinedNotes = [giftNoteSegment, notes.trim()].filter(Boolean).join(' — ');

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: phoneValidation.normalized,
          customerAltPhone: normalizedAltPhone,
          governorate: selectedGovernorate,
          address: address.trim(),
          notes: combinedNotes,
          items: cart,
          subtotal: cartSubtotal,
          shippingCost,
          discountAmount,
          couponCode: appliedCoupon?.code,
          total: finalTotal,
          paymentMethod,
          paymentReference: paymentReference.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'فشل إرسال الطلب');
      }

      const data = await res.json();
      setCompletedOrder(data.order);
      // Save orderNumber locally on this device for zero-login order tracking & 1-click reorder
      try {
        if (typeof window !== 'undefined' && data.order?.orderNumber) {
          const prevRaw = localStorage.getItem('oasis_recent_orders');
          const prevList: string[] = prevRaw ? JSON.parse(prevRaw) : [];
          const nextList = [
            data.order.orderNumber,
            ...prevList.filter((num) => num !== data.order.orderNumber),
          ].slice(0, 10);
          localStorage.setItem('oasis_recent_orders', JSON.stringify(nextList));
        }
      } catch {
        // Ignore storage errors
      }
      clearCart();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء تسجيل الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  // Order Success View
  if (completedOrder) {
    const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
    const itemsText = completedOrder.items
      .map((i) => {
        let text = `• ${i.productName} (${i.weightLabel} - ${i.roastOption}) × ${i.quantity} = ${
          i.unitPrice * i.quantity
        } ج.م`;
        if (i.isCustomMix && i.customBreakdown && i.customBreakdown.length > 0) {
          const breakdownLines = i.customBreakdown
            .map(
              (b) =>
                `    ▫️ ${b.productName} (${b.roastOption}): ${b.percentage}% (${b.weightGrams}جم - ${b.priceContribution} ج.م)`
            )
            .join('\n');
          text += `\n  *مكونات العلبة المشكلة:*\n${breakdownLines}`;
        }
        return text;
      })
      .join('\n');

    const paymentLabel =
      completedOrder.paymentMethod === 'cod'
        ? 'الدفع عند الاستلام'
        : completedOrder.paymentMethod === 'instapay'
        ? `إنستا باي (${completedOrder.paymentReference})`
        : `فودافون كاش (${completedOrder.paymentReference})`;

    const whatsappMessage = `🥜 *طلب جديد من ${
      settings?.storeName || 'محمصة الواحة الذهبية'
    }*\nرقم الطلب: *${completedOrder.orderNumber}*\nالعميل: ${
      completedOrder.customerName
    }\nالهاتف: ${completedOrder.customerPhone}\nالمحافظة: ${
      completedOrder.governorate
    }\nالعنوان: ${completedOrder.address}\n\n*الأصناف المطلوبة:*\n${itemsText}\n\nالإجمالي النهائي شامل الشحن: *${
      completedOrder.total
    } ج.م*\nطريقة الدفع: ${paymentLabel}`;

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      whatsappMessage
    )}`;

    return (
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-brand-200 shadow-md text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-pistachio-100 text-pistachio-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <span className="bg-amber-100 text-brand-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              تم استلام طلبك بنجاح 🎉
            </span>
            <h1 className="text-lg sm:text-xl font-black text-brand-950">
              شكراً لثقتك يا {completedOrder.customerName}!
            </h1>
          </div>

          {/* Order Number Box */}
          <div className="bg-brand-50 p-3 rounded-xl border border-brand-200 space-y-1 text-right">
            <div className="flex items-center justify-between border-b border-brand-200 pb-1.5">
              <span className="text-[10.5px] font-bold text-brand-700">رقم الطلب للتتبع:</span>
              <span className="text-xs font-black text-brand-950 font-mono bg-white px-2 py-0.5 rounded-lg border border-brand-200">
                {completedOrder.orderNumber}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10.5px] pt-0.5">
              <span className="text-brand-700">المحافظة:</span>
              <span className="font-bold text-brand-950">{completedOrder.governorate}</span>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-brand-700">الإجمالي المطلوب:</span>
              <span className="font-black text-xs text-pistachio-700">
                {completedOrder.total} ج.م
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1.5 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-extrabold py-2 px-3.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition text-[11px]"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white" />
              <span>إرسال فاتورة الطلب عبر واتساب للتأكيد الفوري</span>
            </a>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <Link
                href={`/track-order?q=${completedOrder.orderNumber}`}
                className="bg-brand-900 hover:bg-brand-950 text-white font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 text-[11px] transition"
              >
                <PackageSearch className="w-3.5 h-3.5 text-gold-400" />
                <span>تتبع حالة طلبك</span>
              </Link>

              <Link
                href="/"
                className="bg-brand-100 hover:bg-brand-200 text-brand-950 font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 text-[11px] transition"
              >
                <span>العودة للمتجر</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty Cart Guard
  if (cart.length === 0) {
    return (
      <div className="max-w-sm mx-auto px-4 py-10 text-center space-y-2.5">
        <div className="text-3xl">🥜</div>
        <h1 className="text-base sm:text-lg font-black text-brand-950">سلة المشتريات فارغة</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 bg-brand-900 text-white font-extrabold px-4 py-2 rounded-xl text-[11px]"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة لتسوق المكسرات</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-black text-brand-950">
          {pageContent.checkoutPageTitle}
        </h1>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:text-brand-950"
        >
          <ArrowRight className="w-3 h-3" />
          متابعة التسوق
        </Link>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Right Column: Customer Shipping & Payment Form */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xl text-[11px] font-bold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Step 1: Delivery Info */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-brand-200 shadow-xs space-y-2.5">
            <h2 className="text-xs sm:text-[13px] font-extrabold text-brand-950 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-900 text-gold-400 text-[9.5px] flex items-center justify-center">
                1
              </span>
              بيانات التوصيل
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="الاسم الثلاثي"
                  className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-700"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                  رقم الموبايل *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                  المحافظة *
                </label>
                <select
                  value={selectedGovernorate}
                  onChange={(e) => setSelectedGovernorate(e.target.value)}
                  className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-brand-950 focus:outline-none focus:border-brand-700"
                >
                  {shippingRates.map((rate) => (
                    <option key={rate.id} value={rate.governorate}>
                      {rate.governorate} ({isFreeShipping ? 'شحن مجاني!' : `${rate.price} ج.م`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                  رقم بديل (اختياري)
                </label>
                <input
                  type="tel"
                  value={customerAltPhone}
                  onChange={(e) => setCustomerAltPhone(e.target.value)}
                  placeholder="رقم إضافي للمندوب"
                  className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                العنوان بالتفصيل *
              </label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="المنطقة، الشارع، رقم العقار، الدور، الشقة"
                className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-700"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                ملاحظات التوصيل (اختياري)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات للمندوب أو موعد التوصيل المفضل..."
                className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-700"
              />
            </div>

            {/* Luxury Gift Option Toggle */}
            <div className="pt-2 border-t border-brand-100">
              <button
                type="button"
                onClick={() => setIsGift(!isGift)}
                className={`w-full p-2.5 rounded-xl border text-right transition flex items-center justify-between gap-2 cursor-pointer ${
                  isGift
                    ? 'bg-amber-50 border-gold-500 ring-1 ring-gold-400/30'
                    : 'bg-brand-50/70 border-brand-200 hover:bg-brand-100/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🎁</span>
                  <div>
                    <div className="text-[11px] font-extrabold text-brand-950">
                      إرسال هذا الطلب كهدية فاخرة
                    </div>
                    <div className="text-[9.5px] text-brand-600">
                      إضافة بطاقة إهداء مخصصة وتغليف هدايا مجاناً
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-lg ${
                    isGift
                      ? 'bg-brand-900 text-gold-400'
                      : 'bg-white text-brand-700 border border-brand-200'
                  }`}
                >
                  {isGift ? 'مفعّل ✓' : 'تفعيل'}
                </span>
              </button>

              {isGift && (
                <div className="mt-2 bg-amber-50/60 border border-amber-200 rounded-xl p-2.5 space-y-2">
                  <div>
                    <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                      اسم المُهدى إليه (يُكتب على البطاقة)
                    </label>
                    <input
                      type="text"
                      value={giftRecipient}
                      onChange={(e) => setGiftRecipient(e.target.value)}
                      placeholder="مثال: أ. محمد / العائلة الكريمة..."
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-brand-900 mb-1">
                      رسالة بطاقة الإهداء
                    </label>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {GIFT_PRESET_MESSAGES.map((presetMsg, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setGiftMessage(presetMsg)}
                          className={`text-[9.5px] px-1.5 py-0.5 rounded-md border font-bold transition cursor-pointer ${
                            giftMessage === presetMsg
                              ? 'bg-brand-900 text-gold-400 border-brand-900'
                              : 'bg-white text-brand-800 border-amber-200 hover:bg-amber-100/50'
                          }`}
                        >
                          {presetMsg}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      placeholder="اكتب رسالتك الخاصة أو اختر من الجمل الجاهزة أعلاه..."
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-700"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Payment Method */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-brand-200 shadow-xs space-y-2.5">
            <h2 className="text-xs sm:text-[13px] font-extrabold text-brand-950 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-900 text-gold-400 text-[9.5px] flex items-center justify-center">
                2
              </span>
              طريقة الدفع
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {pageContent.enableCod !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-2.5 rounded-xl border text-right transition flex items-center gap-1.5 ${
                    paymentMethod === 'cod'
                      ? 'bg-brand-900 text-white border-brand-900 shadow-xs'
                      : 'bg-brand-50 text-brand-900 border-brand-200 hover:border-brand-400'
                  }`}
                >
                  <Banknote
                    className={`w-3.5 h-3.5 shrink-0 ${
                      paymentMethod === 'cod' ? 'text-gold-400' : 'text-brand-700'
                    }`}
                  />
                  <span className="font-extrabold text-[11px]">الدفع عند الاستلام</span>
                </button>
              )}

              {pageContent.enableInstapay !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  className={`p-2.5 rounded-xl border text-right transition flex items-center gap-1.5 ${
                    paymentMethod === 'instapay'
                      ? 'bg-brand-900 text-white border-brand-900 shadow-xs'
                      : 'bg-brand-50 text-brand-900 border-brand-200 hover:border-brand-400'
                  }`}
                >
                  <Smartphone
                    className={`w-3.5 h-3.5 shrink-0 ${
                      paymentMethod === 'instapay' ? 'text-gold-400' : 'text-brand-700'
                    }`}
                  />
                  <span className="font-extrabold text-[11px]">إنستا باي (InstaPay)</span>
                </button>
              )}

              {pageContent.enableVodafoneCash !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vodafone_cash')}
                  className={`p-2.5 rounded-xl border text-right transition flex items-center gap-1.5 ${
                    paymentMethod === 'vodafone_cash'
                      ? 'bg-brand-900 text-white border-brand-900 shadow-xs'
                      : 'bg-brand-50 text-brand-900 border-brand-200 hover:border-brand-400'
                  }`}
                >
                  <Wallet
                    className={`w-3.5 h-3.5 shrink-0 ${
                      paymentMethod === 'vodafone_cash' ? 'text-gold-400' : 'text-brand-700'
                    }`}
                  />
                  <span className="font-extrabold text-[11px]">فودافون كاش</span>
                </button>
              )}
            </div>

            {paymentMethod === 'instapay' && (
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl space-y-1.5 text-[11px]">
                <p className="font-extrabold text-brand-950">
                  ⚡ عنوان InstaPay:{' '}
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">
                    {settings?.instapayAddress || 'elwaha.nuts@instapay'}
                  </span>
                </p>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="اسم الحساب المحول منه أو الرقم المرجعي *"
                  className="w-full bg-white border border-brand-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none"
                />
              </div>
            )}

            {paymentMethod === 'vodafone_cash' && (
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl space-y-1.5 text-[11px]">
                <p className="font-extrabold text-brand-950">
                  📱 رقم فودافون كاش:{' '}
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">
                    {settings?.vodafoneCashNumber || '01000000000'}
                  </span>
                </p>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="رقم الموبايل المحول منه *"
                  className="w-full bg-white border border-brand-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Left Column: Order Summary */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-brand-200 shadow-xs sticky top-16 space-y-3">
            <h3 className="text-xs sm:text-[13px] font-extrabold text-brand-950 border-b border-brand-100 pb-1.5">
              ملخص الطلب ({cart.length} أصناف)
            </h3>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pl-1">
              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="flex items-center justify-between gap-2 text-[11px] border-b border-brand-50 pb-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getSafeImageUrl(item.productImage)}
                      alt={item.productName}
                      className="w-9 h-9 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-extrabold text-brand-950 truncate">
                        {item.productName}
                      </p>
                      <p className="text-[9.5px] text-brand-600">
                        {item.weightLabel} • {item.roastOption} × {item.quantity}
                      </p>
                      {item.isCustomMix && item.customBreakdown && (
                        <div className="mt-1 bg-amber-50/90 rounded-md p-1 border border-amber-200/60 space-y-0.5">
                          {item.customBreakdown.map((part, pIdx) => (
                            <div key={pIdx} className="text-[8.5px] text-brand-800 flex justify-between gap-1.5">
                              <span>• {part.productName}</span>
                              <span className="font-semibold text-brand-950">{part.percentage}% ({part.weightGrams}جم)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="font-extrabold text-brand-950 shrink-0">
                    {item.unitPrice * item.quantity} ج.م
                  </span>
                </div>
              ))}
            </div>

            {/* Coupon Code + One-Click Coupon Chips */}
            <div className="space-y-1.5">
              {appliedCoupon ? (
                <div className="bg-pistachio-50 border border-pistachio-200 rounded-xl p-2 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-pistachio-700 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    كود {appliedCoupon.code} (-{discountAmount} ج.م)
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-red-600 font-bold hover:underline cursor-pointer"
                  >
                    إزالة
                  </button>
                </div>
              ) : (
                <>
                  {storeData?.coupons && storeData.coupons.filter((c) => c.active).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9.5px] font-bold text-brand-700">🎟️ كوبونات متاحة:</span>
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
                                setCouponMsg(res.message);
                              }}
                              className={`text-[9.5px] px-1.5 py-0.5 rounded-md border font-extrabold transition cursor-pointer flex items-center gap-1 ${
                                eligible
                                  ? 'bg-pistachio-50 text-pistachio-800 border-pistachio-300 hover:bg-pistachio-100'
                                  : 'bg-brand-50 text-brand-600 border-brand-200 opacity-85'
                              }`}
                            >
                              <span className="font-mono">{c.code}</span>
                              <span className="text-[8.5px] font-bold">
                                {eligible ? '(تطبيق فوري ✨)' : `(باقي ${diff} ج.م)`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="كود الخصم"
                      className="flex-1 bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleCouponSubmit}
                      className="bg-brand-200 hover:bg-brand-300 text-brand-950 font-bold text-[11px] px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      تطبيق
                    </button>
                  </div>
                </>
              )}
              {couponMsg && !appliedCoupon && (
                <p className="text-[9.5px] text-brand-700 mt-1">{couponMsg}</p>
              )}
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-1 text-[11px] border-t border-brand-100 pt-2">
              <div className="flex justify-between text-brand-700">
                <span>المجموع الفرعي:</span>
                <span className="font-bold">{cartSubtotal} ج.م</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-pistachio-700 font-bold">
                  <span>الخصم:</span>
                  <span>- {discountAmount} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-brand-700">
                <span className="flex items-center gap-1">
                  <Truck className="w-3 h-3 text-brand-600" />
                  الشحن ({selectedGovernorate}):
                </span>
                {isFreeShipping ? (
                  <span className="text-pistachio-700 font-extrabold">مجاني 🎉</span>
                ) : (
                  <span className="font-bold">{shippingCost} ج.م</span>
                )}
              </div>

              <div className="flex justify-between text-brand-950 font-black text-sm border-t border-brand-200 pt-1.5 mt-1">
                <span>الإجمالي النهائي:</span>
                <span className="text-pistachio-700">{finalTotal} ج.م</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-l from-brand-800 to-brand-950 hover:from-brand-900 hover:to-brand-950 text-white font-black py-2 px-4 rounded-xl shadow-md transition text-xs disabled:opacity-50"
            >
              {submitting ? 'جاري تسجيل الطلب...' : `تأكيد الطلب • ${finalTotal} ج.م`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
