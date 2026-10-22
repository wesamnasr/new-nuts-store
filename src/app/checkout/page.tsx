'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Truck,
  Banknote,
  Smartphone,
  MessageCircle,
  PackageSearch,
  Tag,
  Crown,
  Store,
  AlertTriangle,
  MapPin,
  Clock,
  Gift,
  Coffee,
  Printer,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  DeliveryMethodType,
  Order,
  PaymentMethod,
} from '@/types/store';
import { validateEgyptianPhone, formatWhatsAppPhone } from '@/lib/validation';
import {
  BANI_MAZAR_BANDAR_ZONES,
  BANI_MAZAR_VILLAGES,
  VILLAGE_DELIVERY_BATCHES,
  getSafeImageUrl,
} from '@/lib/defaults';
import { calculateVipCashback } from '@/lib/pricing';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';

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
    activeVipMember,
    setActiveVipPhone,
    refreshStore,
    trackPixelEvent,
  } = useStore();

  const settings = storeData?.settings;
  const freeShippingThreshold = settings?.freeShippingThreshold || 300;
  const minOrderVillages = settings?.minOrderVillages || 200;

  // 1. Customer fields
  const [customerName, setCustomerName] = useState(activeVipMember?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(activeVipMember?.phone || '');
  const [customerAltPhone, setCustomerAltPhone] = useState('');

  // 2. Bani Mazar Delivery Method Selector
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodType>('bandar_fast');
  const [bandarZone, setBandarZone] = useState<string>(BANI_MAZAR_BANDAR_ZONES[0]);
  const [villageName, setVillageName] = useState<string>(BANI_MAZAR_VILLAGES[0]);
  const [deliveryBatchSlot, setDeliveryBatchSlot] = useState<string>(
    VILLAGE_DELIVERY_BATCHES[0]
  );
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // 3. Payment & VIP Wallet states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState('');
  const [useVipWallet, setUseVipWallet] = useState<boolean>(false);

  // Coupon & Submission states
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-sync phone with VIP wallet when customer enters 11 digits
  useEffect(() => {
    const clean = customerPhone.replace(/\D/g, '');
    if (clean.length === 11) {
      setActiveVipPhone(clean);
    }
  }, [customerPhone, setActiveVipPhone]);

  // Calculate shipping cost based on deliveryMethod
  const shippingCost = useMemo(() => {
    if (deliveryMethod === 'store_pickup') return 0;
    if (cartSubtotal >= freeShippingThreshold) return 0;
    if (deliveryMethod === 'bandar_fast') {
      return settings?.bandarShippingCost ?? 20;
    }
    if (deliveryMethod === 'villages_scheduled') {
      return settings?.villagesShippingCost ?? 25;
    }
    return 20;
  }, [deliveryMethod, cartSubtotal, freeShippingThreshold, settings]);

  const totalBeforeWallet = Math.max(0, cartSubtotal - discountAmount + shippingCost);

  const vipWalletDiscount = useMemo(() => {
    if (
      (useVipWallet || paymentMethod === 'vip_wallet') &&
      activeVipMember &&
      activeVipMember.pointsBalance > 0
    ) {
      return Math.min(activeVipMember.pointsBalance, totalBeforeWallet);
    }
    return 0;
  }, [useVipWallet, paymentMethod, activeVipMember, totalBeforeWallet]);

  const finalTotal = Math.max(0, totalBeforeWallet - vipWalletDiscount);

  const expectedCashback = useMemo(
    () =>
      calculateVipCashback(
        Math.max(0, cartSubtotal - discountAmount),
        settings?.vipMinOrderForCashback || 150,
        settings?.vipCashbackPercentage || 5
      ),
    [cartSubtotal, discountAmount, settings]
  );

  const isVillageBelowMinimum =
    deliveryMethod === 'villages_scheduled' && cartSubtotal < minOrderVillages;

  const handleCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const res = applyCouponCode(couponInput);
    setCouponMsg(res.message);
  };

  const buildOrderWhatsAppMessage = (order: Order) => {
    const itemsLines = order.items
      .map((item, idx) => {
        if (item.isPartitionedBox && item.partitionedSlots) {
          const slotsDetail = item.partitionedSlots
            .map((s) => `خانة ${s.slotIndex}: ${s.productName} (${s.roastOption})`)
            .join(' + ');
          return `${idx + 1}️⃣ ${item.productName} (${item.quantity} × ${item.unitPrice} ج)\n   - التفاصيل: [${slotsDetail}]`;
        }
        if (item.isCoffeeBlend && item.coffeeBlendSpec) {
          return `${idx + 1}️⃣ ${item.productName} (${item.quantity} × ${item.unitPrice} ج)\n   - ستيكر البارستا: [${item.coffeeBlendSpec.baristaLabel}]`;
        }
        const notesPart = item.workerNotes ? `\n   - ملاحظة للعامل: ${item.workerNotes}` : '';
        return `${idx + 1}️⃣ ${item.productName} — ${item.weightLabel} (${item.roastOption}) × ${
          item.quantity
        } = ${item.unitPrice * item.quantity} ج.م${notesPart}`;
      })
      .join('\n');

    const deliveryDesc =
      order.deliveryMethod === 'store_pickup'
        ? '🏪 استلام سريع من الفرع (أمام مسجد الزراعيين)'
        : order.deliveryMethod === 'villages_scheduled'
          ? `🚐 قرى بني مزار (${order.villageName || ''} — ${order.deliveryBatchSlot || ''})`
          : `🛵 توصيل سريع لبندر بني مزار (${order.governorate})`;

    const payDesc =
      order.paymentMethod === 'cod'
        ? 'كاش عند الاستلام'
        : order.paymentMethod === 'vodafone_cash'
          ? `فودافون كاش (${order.paymentReference || ''})`
          : order.paymentMethod === 'instapay'
            ? `إنستا باي (${order.paymentReference || ''})`
            : 'خصم من محفظة حفصة VIP';

    return (
      `🌟 *طلب جديد — محمصة حفصة للبن والمكسرات* 🌟\n` +
      `رقم الطلب: *#${order.orderNumber}*\n` +
      `👤 العميل: ${order.customerName}\n` +
      `📱 الموبايل: ${order.customerPhone}\n` +
      `📍 الاستلام: ${deliveryDesc}\n` +
      `🏠 العنوان التفصيلي: ${order.address}\n` +
      `--------------------------------\n` +
      `🛒 *الأصناف المطلوبة:*\n${itemsLines}\n` +
      `--------------------------------\n` +
      `💰 المجموع الفرعي: ${order.subtotal} ج.م\n` +
      `🛵 خدمة التوصيل: ${order.shippingCost === 0 ? 'مجاني 🎉' : `${order.shippingCost} ج.م`}\n` +
      (order.discountAmount > 0 ? `🎟️ خصم الكوبون: -${order.discountAmount} ج.م\n` : '') +
      (order.vipWalletRedeemed && order.vipWalletRedeemed > 0
        ? `👑 خصم محفظة VIP: -${order.vipWalletRedeemed} ج.م\n`
        : '') +
      `💎 *الإجمالي النهائي المطلوب: ${order.total} ج.م*\n` +
      `💳 طريقة الدفع: ${payDesc}\n` +
      `👑 كاش باك مضاف لمحفظة حفصة VIP: +${order.vipCashbackEarned || 0} ج.م`
    );
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const resolvedAddress =
      deliveryMethod === 'store_pickup'
        ? address.trim() || 'استلام من فرع بني مزار (أمام مسجد الزراعيين)'
        : address.trim();

    if (!customerName.trim() || !customerPhone.trim() || !resolvedAddress) {
      setErrorMsg('يرجى إدخال الاسم ورقم الموبايل والعنوان بالتفصيل لإتمام الطلب');
      return;
    }

    const phoneValidation = validateEgyptianPhone(customerPhone);
    if (!phoneValidation.isValid) {
      setErrorMsg(
        phoneValidation.error ||
          'يرجى إدخال رقم موبايل مصري صحيح (010، 011، 012، 015) مكون من 11 رقماً'
      );
      return;
    }

    if (isVillageBelowMinimum) {
      setErrorMsg(
        `الحد الأدنى لطلبات قرى مركز بني مزار هو ${minOrderVillages} ج.م لضمان التوصيل في دورة التوزيع المجمعة (متبقي ${
          minOrderVillages - cartSubtotal
        } ج.م).`
      );
      return;
    }

    if (
      (paymentMethod === 'instapay' || paymentMethod === 'vodafone_cash') &&
      !paymentReference.trim()
    ) {
      setErrorMsg('يرجى كتابة رقم الموبايل المحول منه أو الرقم المرجعي للتحويل');
      return;
    }

    const resolvedGovernorate =
      deliveryMethod === 'store_pickup'
        ? 'فرع بني مزار - استلام من المحل'
        : deliveryMethod === 'villages_scheduled'
          ? `قرى بني مزار - ${villageName}`
          : `بندر بني مزار - ${bandarZone}`;

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: phoneValidation.normalized,
          customerAltPhone: customerAltPhone.trim() || undefined,
          governorate: resolvedGovernorate,
          deliveryMethod,
          villageName: deliveryMethod === 'villages_scheduled' ? villageName : undefined,
          deliveryBatchSlot:
            deliveryMethod === 'villages_scheduled' ? deliveryBatchSlot : undefined,
          address: resolvedAddress,
          notes: notes.trim(),
          items: cart,
          subtotal: cartSubtotal,
          shippingCost,
          discountAmount,
          useVipWallet: useVipWallet || paymentMethod === 'vip_wallet',
          couponCode: appliedCoupon?.code,
          total: finalTotal,
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إرسال الطلب');
      }

      setCompletedOrder(data.order);
      trackPixelEvent('Purchase', {
        orderNumber: data.order.orderNumber,
        value: data.order.total,
        currency: 'EGP',
      });

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
        // Ignore storage error
      }

      clearCart();
      await refreshStore();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تسجيل الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  // Order Confirmation View
  if (completedOrder) {
    const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
    const whatsappMessage = buildOrderWhatsAppMessage(completedOrder);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      whatsappMessage
    )}`;

    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-6 border-2 border-[#D4AF37] shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#3B6E4C]/15 text-[#3B6E4C] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="bg-[#D4AF37]/25 text-[#231710] border border-[#D4AF37] text-xs font-black px-3 py-0.5 rounded-full">
              تم تسجيل طلبك بنجاح 🎉
            </span>
            <h1 className="font-cairo text-xl sm:text-2xl font-black text-[#231710] pt-1">
              شكراً لك يا {completedOrder.customerName}!
            </h1>
            <p className="text-xs text-[#6E5D4F]">
              تم إرسال الطلب مباشرة لشاشة التجهيز في فرع بني مزار (أمام مسجد الزراعيين)
            </p>
          </div>

          <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#E6DFD3] space-y-2 text-right text-xs tabular-nums">
            <div className="flex items-center justify-between border-b border-[#E6DFD3] pb-2">
              <span className="font-bold text-[#6E5D4F]">رقم الطلب للتتبع:</span>
              <span className="font-cairo font-black text-sm text-[#231710] bg-white px-2.5 py-0.5 rounded-lg border border-[#D4AF37]">
                {completedOrder.orderNumber}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#6E5D4F]">طريقة الاستلام:</span>
              <span className="font-black text-[#231710]">{completedOrder.governorate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#6E5D4F]">الإجمالي النهائي المطلوب:</span>
              <span className="font-cairo font-black text-base text-[#3B6E4C]">
                {completedOrder.total} ج.م
              </span>
            </div>
            {(completedOrder.vipCashbackEarned || 0) > 0 && (
              <div className="flex items-center justify-between bg-[#D4AF37]/15 p-2 rounded-xl border border-[#D4AF37]/40">
                <span className="font-extrabold text-[#231710] flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-[#C88A4B]" />
                  كاش باك مضاف لمحفظة حفصة VIP:
                </span>
                <span className="font-black text-[#3B6E4C]">
                  +{completedOrder.vipCashbackEarned} ج.م
                </span>
              </div>
            )}
          </div>

          {/* Formatted WhatsApp Message Preview & 1-Click Send */}
          <div className="space-y-2 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 px-4 rounded-2xl bg-[#3B6E4C] hover:opacity-95 text-white font-cairo font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال الفاتورة عبر واتساب</span>
            </a>

            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF6F0] text-[#231710] border-2 border-[#231710] font-cairo font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>عرض الفاتورة</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/track?q=${completedOrder.orderNumber}`}
                className="py-2.5 px-3 rounded-xl bg-[#231710] text-[#D4AF37] font-cairo font-black text-xs flex items-center justify-center gap-1.5"
              >
                <PackageSearch className="w-3.5 h-3.5" />
                <span>تتبع حالة طلبك</span>
              </Link>
              <Link
                href="/vip"
                className="py-2.5 px-3 rounded-xl bg-[#F3ECE1] text-[#231710] border border-[#D4AF37] font-cairo font-black text-xs flex items-center justify-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5 text-[#C88A4B]" />
                <span>محفظة حفصة VIP</span>
              </Link>
            </div>
          </div>
        </div>

        {showReceiptModal && (
          <SupermarketReceiptModal
            order={completedOrder}
            mode="receipt"
            settings={settings}
            onClose={() => setShowReceiptModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] py-6 sm:py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="font-cairo text-2xl sm:text-3xl font-black text-[#231710]">
            إتمام الطلب
          </h1>
          <p className="hidden">
            أكمل بياناتك في خطوة واحدة ليبدأ التحميص والتجهيز الفوري في فرعنا أمام مسجد الزراعيين
          </p>
        </div>

        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-[#E6DFD3] space-y-3">
            <div className="text-3xl">🛒</div>
            <h2 className="font-cairo text-lg font-black text-[#231710]">
              سلة المشتريات فارغة حالياً
            </h2>
            <div className="flex justify-center gap-2 pt-2">
              <Link
                href="/build-box"
                className="bg-[#D4AF37] text-[#231710] px-4 py-2.5 rounded-xl font-cairo font-black text-xs"
              >
                🎁 صمّم بوكس السهرة (125ج)
              </Link>
              <Link
                href="/shop"
                className="bg-[#231710] text-[#FAF6F0] px-4 py-2.5 rounded-xl font-cairo font-black text-xs"
              >
                🥜 تصفح المتجر
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handlePlaceOrder}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Right Form Column (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {errorMsg && (
                <div className="bg-[#B83B2B]/15 border-2 border-[#B83B2B] text-[#B83B2B] p-3.5 rounded-2xl text-xs font-extrabold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Step 1: Customer Data */}
              <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-4">
                <h2 className="font-cairo text-base font-black text-[#231710] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
                    1
                  </span>
                  <span>بيانات العميل</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-extrabold text-[#231710] block mb-1">
                      الاسم بالكامل *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثال: أحمد محمد حسن"
                      className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#C88A4B] rounded-xl px-3.5 py-2.5 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-extrabold text-[#231710] block mb-1">
                      رقم الموبايل (واتساب + محفظة VIP) *
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#C88A4B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-right tabular-nums"
                    />
                  </div>
                </div>

                {activeVipMember && (
                  <div className="bg-[#D4AF37]/15 border border-[#D4AF37] rounded-2xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-[#C88A4B]" />
                      <span className="text-xs font-extrabold text-[#231710]">
                        مرحباً {activeVipMember.customerName}! لديك رصيد محفظة VIP متاح:{' '}
                        <strong className="text-[#3B6E4C]">{activeVipMember.pointsBalance} ج.م</strong>
                      </span>
                    </div>
                    {activeVipMember.pointsBalance > 0 && (
                      <label className="flex items-center gap-1.5 text-xs font-black text-[#231710] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useVipWallet}
                          onChange={(e) => setUseVipWallet(e.target.checked)}
                          className="accent-[#231710] w-4 h-4"
                        />
                        <span>خصم من المحفظة</span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Bani Mazar Delivery Method Selector */}
              <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-4">
                <h2 className="font-cairo text-base font-black text-[#231710] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
                    2
                  </span>
                  <span>طريقة الاستلام والتوصيل</span>
                </h2>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option A: Bandar Fast Delivery */}
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('bandar_fast')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                      deliveryMethod === 'bandar_fast'
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#D4AF37]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-[#D4AF37] shrink-0" />
                      <div>
                        <div className="font-cairo text-xs sm:text-sm font-black">
                          🛵 توصيل سريع لبندر بني مزار (30–45 دقيقة)
                        </div>
                        <div className="hidden">
                          شارع العاشر، بورسعيد، الجمهورية، شرق وغرب المحطة، موقف القيس
                        </div>
                      </div>
                    </div>
                    <span className="font-cairo text-xs font-black text-[#D4AF37] shrink-0 tabular-nums">
                      {cartSubtotal >= freeShippingThreshold ? 'مجاني 🎉' : '20 ج.م'}
                    </span>
                  </button>

                  {/* Option B: Villages Scheduled Batch Delivery */}
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('villages_scheduled')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                      deliveryMethod === 'villages_scheduled'
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#D4AF37]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-[#D4AF37] shrink-0" />
                      <div>
                        <div className="font-cairo text-xs sm:text-sm font-black">
                          🚐 توصيل مجدول لقرى بني مزار (2 ظهراً و8 مساءً)
                        </div>
                        <div className="hidden">
                          القيس، صندفا، بني علي، شلقام، أبشاق، طمبو، الجندية، أبو جرج، البهنسا... (حد أدنى 200 ج.م)
                        </div>
                      </div>
                    </div>
                    <span className="font-cairo text-xs font-black text-[#D4AF37] shrink-0 tabular-nums">
                      {cartSubtotal >= freeShippingThreshold ? 'مجاني 🎉' : '25 ج.م'}
                    </span>
                  </button>

                  {/* Option C: Store Pickup */}
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('store_pickup')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                      deliveryMethod === 'store_pickup'
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#D4AF37]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-[#D4AF37] shrink-0" />
                      <div>
                        <div className="font-cairo text-xs sm:text-sm font-black">
                          🏪 استلام سريع من الفرع — أمام مسجد الزراعيين
                        </div>
                        <div className="hidden">
                          جهّز طلبي آخذُه وأنا معدي بدون انتظار!
                        </div>
                      </div>
                    </div>
                    <span className="font-cairo text-xs font-black text-emerald-400 shrink-0">
                      0 ج.م شحن
                    </span>
                  </button>
                </div>

                {/* Conditional Location Fields */}
                {deliveryMethod === 'bandar_fast' && (
                  <div className="space-y-3 pt-2 border-t border-[#E6DFD3]">
                    <div>
                      <label className="text-xs font-extrabold text-[#231710] block mb-1">
                        المنطقة داخل بندر بني مزار:
                      </label>
                      <select
                        value={bandarZone}
                        onChange={(e) => setBandarZone(e.target.value)}
                        className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2.5 text-xs font-bold"
                      >
                        {BANI_MAZAR_BANDAR_ZONES.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {deliveryMethod === 'villages_scheduled' && (
                  <div className="space-y-3 pt-2 border-t border-[#E6DFD3]">
                    {isVillageBelowMinimum && (
                      <div className="bg-[#B83B2B]/15 border border-[#B83B2B] rounded-xl p-3 text-xs font-extrabold text-[#B83B2B]">
                        ⚠️ تنبيه: الحد الأدنى لطلبات قرى مركز بني مزار هو {minOrderVillages} ج.م
                        (متبقي {minOrderVillages - cartSubtotal} ج.م في السلة).
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-extrabold text-[#231710] block mb-1">
                          اختر القرية التابعة لمركز بني مزار:
                        </label>
                        <select
                          value={villageName}
                          onChange={(e) => setVillageName(e.target.value)}
                          className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2.5 text-xs font-bold"
                        >
                          {BANI_MAZAR_VILLAGES.map((v) => (
                            <option key={v} value={v}>
                              قرية {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-extrabold text-[#231710] block mb-1">
                          اختر دورة التوزيع المجمعة:
                        </label>
                        <select
                          value={deliveryBatchSlot}
                          onChange={(e) => setDeliveryBatchSlot(e.target.value)}
                          className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2.5 text-xs font-bold"
                        >
                          {VILLAGE_DELIVERY_BATCHES.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-extrabold text-[#231710] block mb-1">
                    {deliveryMethod === 'store_pickup'
                      ? 'موعد مرورك لاستلام الطلب من الفرع (اختياري):'
                      : 'العنوان بالتفصيل وأقرب علامة مميزة *'}
                  </label>
                  <input
                    type="text"
                    required={deliveryMethod !== 'store_pickup'}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={
                      deliveryMethod === 'store_pickup'
                        ? 'مثال: سأمر الساعة 9 مساءً لاستلام الطلب جاهزاً'
                        : 'مثال: شارع العاشر بجوار صيدلية... عمارة رقم... الدور...'
                    }
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3.5 py-2.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#231710] block mb-1">
                    ملاحظات إضافية للطلب أو الدليفري (اختياري):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: الاتصال قبل الوصول بـ 5 دقائق..."
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Step 3: Payment Method */}
              <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-4">
                <h2 className="font-cairo text-base font-black text-[#231710] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
                    3
                  </span>
                  <span>وسيلة الدفع</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'cod' as PaymentMethod, label: '💵 الدفع نقداً عند الاستلام (COD)' },
                    { id: 'vodafone_cash' as PaymentMethod, label: '📱 فودافون كاش (Vodafone Cash)' },
                    { id: 'instapay' as PaymentMethod, label: '🏦 إنستا باي (InstaPay)' },
                    { id: 'vip_wallet' as PaymentMethod, label: '👑 خصم من محفظة حفصة VIP' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-3 rounded-2xl border-2 text-right text-xs font-extrabold transition cursor-pointer ${
                        paymentMethod === pm.id
                          ? 'bg-[#231710] text-[#D4AF37] border-[#D4AF37]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>

                {(paymentMethod === 'vodafone_cash' || paymentMethod === 'instapay') && (
                  <div className="bg-[#F3ECE1] p-3.5 rounded-2xl border border-[#D4AF37] space-y-2 text-xs">
                    <p className="font-bold text-[#231710]">
                      {paymentMethod === 'vodafone_cash'
                        ? `حوّل المبلغ إلى رقم فودافون كاش المحل: ${
                            settings?.vodafoneCashNumber || '01000000000'
                          }`
                        : `حوّل المبلغ عبر InstaPay إلى عنوان: ${
                            settings?.instapayAddress || 'hafsa.roastery@instapay'
                          }`}
                    </p>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="اكتب رقم الموبايل المحول منه أو رقم العملية المرجعي *"
                      className="w-full bg-white border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Left Summary Column (5 cols) */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-3xl p-5 border-2 border-[#D4AF37] shadow-xl space-y-4">
              <h3 className="font-cairo text-base font-black text-[#231710] border-b border-[#E6DFD3] pb-3">
                ملخص سلة السهرة ({cart.length} أصناف)
              </h3>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="flex items-start justify-between gap-2 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#E6DFD3] text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-cairo font-black text-[#231710] truncate">
                        {item.productName} × {item.quantity}
                      </div>
                      <div className="text-[10px] text-[#6E5D4F]">
                        {item.weightLabel} • {item.roastOption}
                      </div>
                      {item.isPartitionedBox && item.partitionedSlots && (
                        <div className="text-[9.5px] text-[#C88A4B] font-bold mt-0.5">
                          🎁 {item.partitionedSlots.map((s) => s.productName).join(' + ')}
                        </div>
                      )}
                      {item.isCoffeeBlend && item.coffeeBlendSpec && (
                        <div className="text-[9.5px] text-[#3B6E4C] font-bold mt-0.5">
                          ☕ {item.coffeeBlendSpec.baristaLabel}
                        </div>
                      )}
                    </div>
                    <span className="font-black text-[#231710] shrink-0 tabular-nums">
                      {item.unitPrice * item.quantity} ج.م
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1.5 pt-3 border-t border-[#E6DFD3] text-xs tabular-nums">
                <div className="flex justify-between text-[#6E5D4F]">
                  <span>المجموع الفرعي:</span>
                  <span className="font-extrabold text-[#231710]">{cartSubtotal} ج.م</span>
                </div>
                <div className="flex justify-between text-[#6E5D4F]">
                  <span>خدمة التوصيل ({deliveryMethod === 'store_pickup' ? 'استلام فرع' : 'بني مزار'}):</span>
                  <span className="font-extrabold text-[#3B6E4C]">
                    {shippingCost === 0 ? 'مجاني 🎉' : `${shippingCost} ج.م`}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#3B6E4C] font-extrabold">
                    <span>خصم الكوبون:</span>
                    <span>-{discountAmount} ج.م</span>
                  </div>
                )}
                {vipWalletDiscount > 0 && (
                  <div className="flex justify-between text-[#C88A4B] font-extrabold">
                    <span>خصم رصيد محفظة حفصة VIP:</span>
                    <span>-{vipWalletDiscount} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-cairo font-black text-[#231710] pt-2 border-t border-[#E6DFD3]">
                  <span>الإجمالي النهائي المطلوب:</span>
                  <span className="text-[#3B6E4C]">{finalTotal} ج.م</span>
                </div>
                {expectedCashback > 0 && (
                  <div className="bg-[#D4AF37]/15 border border-[#D4AF37] rounded-xl p-2 text-[11px] font-extrabold text-[#231710] flex items-center justify-between">
                    <span>👑 كاش باك 5% يضاف لمحفظتك فوراً:</span>
                    <span className="text-[#3B6E4C] font-black">+{expectedCashback} ج.م</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || isVillageBelowMinimum}
                className={`w-full py-3.5 px-4 rounded-2xl font-cairo font-black text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                  submitting || isVillageBelowMinimum
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-[#231710] hover:bg-[#3A2519] text-[#D4AF37] border border-[#D4AF37]'
                }`}
              >
                {submitting
                  ? 'جاري تسجيل الطلب وإصدار الفاتورة...'
                  : `تأكيد الطلب الآن (${finalTotal} ج.م)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
