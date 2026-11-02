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
  Lock,
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
  const [vipPin, setVipPin] = useState<string>('');

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
          return `${idx + 1}. ${item.productName} (${item.quantity} × ${item.unitPrice} ج)\n   - التفاصيل: [${slotsDetail}]`;
        }
        if (item.isCoffeeBlend && item.coffeeBlendSpec) {
          return `${idx + 1}. ${item.productName} (${item.quantity} × ${item.unitPrice} ج)\n   - ملصق المطحنة: [${item.coffeeBlendSpec.baristaLabel}]`;
        }
        const notesPart = item.workerNotes ? `\n   - ملاحظة للعامل: ${item.workerNotes}` : '';
        return `${idx + 1}. ${item.productName} — ${item.weightLabel} (${item.roastOption}) × ${
          item.quantity
        } = ${item.unitPrice * item.quantity} ج.م${notesPart}`;
      })
      .join('\n');

    const deliveryDesc =
      order.deliveryMethod === 'store_pickup'
        ? 'استلام سريع من الفرع (أمام مسجد الزراعيين)'
        : order.deliveryMethod === 'villages_scheduled'
          ? `قرى بني مزار (${order.villageName || ''} — ${order.deliveryBatchSlot || ''})`
          : `توصيل سريع لبندر بني مزار (${order.governorate})`;

    const payDesc =
      order.paymentMethod === 'cod'
        ? 'كاش عند الاستلام'
        : order.paymentMethod === 'vodafone_cash'
          ? `فودافون كاش (${order.paymentReference || ''})`
          : order.paymentMethod === 'instapay'
            ? `إنستاباي (${order.paymentReference || ''})`
            : 'خصم من محفظة حفصة VIP';

    return (
      `*طلب جديد — محمصة حفصة للبن والمكسرات*\n` +
      `رقم الطلب: *#${order.orderNumber}*\n` +
      `العميل: ${order.customerName}\n` +
      `الموبايل: ${order.customerPhone}\n` +
      `الاستلام: ${deliveryDesc}\n` +
      `العنوان التفصيلي: ${order.address}\n` +
      `--------------------------------\n` +
      `*الأصناف المطلوبة:*\n${itemsLines}\n` +
      `--------------------------------\n` +
      `المجموع الفرعي: ${order.subtotal} ج.م\n` +
      `خدمة التوصيل: ${order.shippingCost === 0 ? 'مجاني' : `${order.shippingCost} ج.م`}\n` +
      (order.discountAmount > 0 ? `خصم الكوبون: -${order.discountAmount} ج.م\n` : '') +
      (order.vipWalletRedeemed && order.vipWalletRedeemed > 0
        ? `خصم محفظة VIP: -${order.vipWalletRedeemed} ج.م\n`
        : '') +
      `*الإجمالي النهائي المطلوب: ${order.total} ج.م*\n` +
      `طريقة الدفع: ${payDesc}\n` +
      `كاش باك مضاف لمحفظة حفصة VIP: +${order.vipCashbackEarned || 0} ج.م`
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

    if (
      (useVipWallet || paymentMethod === 'vip_wallet') &&
      activeVipMember &&
      activeVipMember.pointsBalance > 0 &&
      (!vipPin.trim() || !/^\d{4}$/.test(vipPin.trim()))
    ) {
      setErrorMsg('يرجى إدخال الرمز السري لمحفظة VIP (4 أرقام عددية) لتأكيد خصم الرصيد');
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
          vipPin: (useVipWallet || paymentMethod === 'vip_wallet') ? vipPin.trim() : undefined,
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
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E0D5] text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF5F0] text-[#3B6E4C] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-[#3B6E4C]">
              تم تسجيل الطلب بنجاح
            </span>
            <h1 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710] pt-1">
              شكراً لك يا {completedOrder.customerName}
            </h1>
            <p className="text-xs text-[#6E5D4F]">
              وصل طلبك لشاشة التجهيز في فرع بني مزار (أمام مسجد الزراعيين)
            </p>
          </div>

          <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#E8E0D5] space-y-2.5 text-right text-xs tabular-nums">
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-2">
              <span className="text-[#6E5D4F]">رقم الطلب</span>
              <span className="font-cairo font-bold text-sm text-[#231710] bg-white px-2.5 py-0.5 rounded-lg border border-[#E8E0D5]">
                {completedOrder.orderNumber}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E5D4F]">طريقة الاستلام</span>
              <span className="font-bold text-[#231710]">{completedOrder.governorate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E5D4F]">الإجمالي النهائي</span>
              <span className="font-cairo font-bold text-base text-[#231710]">
                {completedOrder.total} ج.م
              </span>
            </div>
            {(completedOrder.vipCashbackEarned || 0) > 0 && (
              <div className="flex items-center justify-between bg-[#EEF5F0] p-2.5 rounded-xl border border-[#D4E8DA]">
                <span className="font-bold text-[#2F5A3D]">
                  كاش باك مضاف لمحفظة حفصة VIP:
                </span>
                <span className="font-bold text-[#2F5A3D]">
                  +{completedOrder.vipCashbackEarned} ج.م
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>إرسال تفاصيل الطلب عبر واتساب</span>
            </a>

            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>عرض وطباعة الفاتورة</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href={`/track?q=${completedOrder.orderNumber}`}
                className="py-2.5 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <PackageSearch className="w-3.5 h-3.5" />
                <span>تتبع حالة الطلب</span>
              </Link>
              <Link
                href="/vip"
                className="py-2.5 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>محفظة VIP</span>
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
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      <div className="bg-white border-b border-[#E8E0D5] py-7 px-4 mb-6">
        <div className="max-w-6xl mx-auto">
          <span className="text-xs font-bold text-[#9A6836] block">مراجعة الشحن والدفع</span>
          <h1 className="font-cairo text-2xl sm:text-3xl font-bold text-[#231710]">
            إتمام الطلب
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {cart.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-[#E8E0D5] space-y-4">
            <h2 className="font-cairo text-lg font-bold text-[#231710]">
              سلة المشتريات فارغة حالياً
            </h2>
            <div className="flex justify-center gap-2.5 pt-1">
              <Link
                href="/shop"
                className="bg-[#231710] text-[#FAF6F0] px-5 py-2.5 rounded-xl font-cairo font-bold text-xs"
              >
                تصفح المتجر
              </Link>
              <Link
                href="/build-box"
                className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-5 py-2.5 rounded-xl font-cairo font-bold text-xs"
              >
                بوكس السهرة
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
                <div className="bg-red-50 border border-red-200 text-[#B83B2B] p-4 rounded-xl text-xs font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Step 1: Customer Data */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] space-y-4">
                <h2 className="font-cairo text-base font-bold text-[#231710]">
                  1. بيانات المستلم
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#231710] block mb-1.5">
                      الاسم بالكامل *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثال: أحمد محمد حسن"
                      className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#231710] block mb-1.5">
                      رقم الموبايل (واتساب + محفظة VIP) *
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-medium text-right tabular-nums focus:outline-none transition"
                    />
                  </div>
                </div>

                {activeVipMember && (
                  <>
                    <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#231710]">
                        مرحباً <strong>{activeVipMember.customerName}</strong> — رصيد محفظة VIP المتاح:{' '}
                        <strong className="text-[#3B6E4C]">{activeVipMember.pointsBalance} ج.م</strong>
                      </span>
                      {activeVipMember.pointsBalance > 0 && (
                        <label className="flex items-center gap-1.5 text-xs font-bold text-[#231710] cursor-pointer">
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

                    {(useVipWallet || paymentMethod === 'vip_wallet') && activeVipMember.pointsBalance > 0 && (
                      <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <label className="text-xs font-bold text-[#231710] flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-[#9A6836]" />
                            <span>الرمز السري لمحفظة VIP (4 أرقام) *</span>
                          </label>
                          <span className="text-[11px] text-[#6E5D4F] block">
                            {activeVipMember.hasPin
                              ? 'أدخل رمزك السري الشخصي لتأكيد خصم الرصيد'
                              : 'عيّن رمزك السري (4 أرقام) لأول مرة لتأمين محفظتك'}
                          </span>
                        </div>
                        <input
                          type="password"
                          maxLength={4}
                          inputMode="numeric"
                          pattern="\d{4}"
                          value={vipPin}
                          onChange={(e) => setVipPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                          className="w-28 bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest text-[#231710] focus:outline-none font-bold"
                          required
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Step 2: Delivery Method Selector */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] space-y-4">
                <h2 className="font-cairo text-base font-bold text-[#231710]">
                  2. طريقة الاستلام والتوصيل
                </h2>

                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('bandar_fast')}
                    className={`p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                      deliveryMethod === 'bandar_fast'
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="w-4 h-4 shrink-0" />
                      <span className="font-cairo text-xs sm:text-sm font-bold">
                        توصيل سريع لبندر بني مزار (30–45 دقيقة)
                      </span>
                    </div>
                    <span className="font-cairo text-xs font-bold shrink-0 tabular-nums">
                      {cartSubtotal >= freeShippingThreshold ? 'مجاني' : `${settings?.bandarShippingCost ?? 20} ج.م`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('villages_scheduled')}
                    className={`p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                      deliveryMethod === 'villages_scheduled'
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span className="font-cairo text-xs sm:text-sm font-bold">
                        توصيل مجدول لقرى بني مزار (2 ظهراً و8 مساءً)
                      </span>
                    </div>
                    <span className="font-cairo text-xs font-bold shrink-0 tabular-nums">
                      {cartSubtotal >= freeShippingThreshold ? 'مجاني' : `${settings?.villagesShippingCost ?? 25} ج.م`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('store_pickup')}
                    className={`p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                      deliveryMethod === 'store_pickup'
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Store className="w-4 h-4 shrink-0" />
                      <span className="font-cairo text-xs sm:text-sm font-bold">
                        استلام من الفرع — أمام مسجد الزراعيين
                      </span>
                    </div>
                    <span className="font-cairo text-xs font-bold shrink-0">
                      مجاناً
                    </span>
                  </button>
                </div>

                {deliveryMethod === 'bandar_fast' && (
                  <div className="pt-2 border-t border-[#F0EAE0]">
                    <label className="text-xs font-bold text-[#231710] block mb-1.5">
                      المنطقة داخل بندر بني مزار:
                    </label>
                    <select
                      value={bandarZone}
                      onChange={(e) => setBandarZone(e.target.value)}
                      className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2.5 text-xs font-medium"
                    >
                      {BANI_MAZAR_BANDAR_ZONES.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {deliveryMethod === 'villages_scheduled' && (
                  <div className="space-y-3 pt-2 border-t border-[#F0EAE0]">
                    {isVillageBelowMinimum && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-[#B83B2B]">
                        الحد الأدنى لطلبات قرى مركز بني مزار هو {minOrderVillages} ج.م (متبقي {minOrderVillages - cartSubtotal} ج.م).
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#231710] block mb-1.5">
                          اختر القرية:
                        </label>
                        <select
                          value={villageName}
                          onChange={(e) => setVillageName(e.target.value)}
                          className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2.5 text-xs font-medium"
                        >
                          {BANI_MAZAR_VILLAGES.map((v) => (
                            <option key={v} value={v}>
                              {v.startsWith('قرية') ? v : `قرية ${v}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#231710] block mb-1.5">
                          موعد التوصيل:
                        </label>
                        <select
                          value={deliveryBatchSlot}
                          onChange={(e) => setDeliveryBatchSlot(e.target.value)}
                          className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2.5 text-xs font-medium"
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
                  <label className="text-xs font-bold text-[#231710] block mb-1.5">
                    {deliveryMethod === 'store_pickup'
                      ? 'موعد الاستلام المفضل (اختياري):'
                      : 'العنوان بالتفصيل وأقرب علامة مميزة *'}
                  </label>
                  <input
                    type="text"
                    required={deliveryMethod !== 'store_pickup'}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={
                      deliveryMethod === 'store_pickup'
                        ? 'مثال: الساعة 9 مساءً'
                        : 'الشارع، رقم العمارة، الدور، وأقرب علامة مميزة...'
                    }
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#231710] block mb-1.5">
                    ملاحظات إضافية (اختياري):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: الاتصال قبل الوصول..."
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Step 3: Payment Method */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] space-y-4">
                <h2 className="font-cairo text-base font-bold text-[#231710]">
                  3. وسيلة الدفع
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'cod' as PaymentMethod, label: 'الدفع نقداً عند الاستلام' },
                    { id: 'vodafone_cash' as PaymentMethod, label: 'فودافون كاش' },
                    { id: 'instapay' as PaymentMethod, label: 'إنستا باي (InstaPay)' },
                    { id: 'vip_wallet' as PaymentMethod, label: 'خصم من محفظة حفصة VIP' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-3.5 rounded-xl border text-right text-xs font-bold transition cursor-pointer ${
                        paymentMethod === pm.id
                          ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>

                {(paymentMethod === 'vodafone_cash' || paymentMethod === 'instapay') && (
                  <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#E8E0D5] space-y-2.5 text-xs">
                    <p className="font-bold text-[#231710]">
                      {paymentMethod === 'vodafone_cash'
                        ? `حوّل المبلغ إلى رقم فودافون كاش: ${
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
                      placeholder="اكتب رقم الموبايل المحول منه أو الرقم المرجعي *"
                      className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Left Summary Column (5 cols) */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] space-y-4">
              <h3 className="font-cairo text-base font-bold text-[#231710] border-b border-[#F0EAE0] pb-3">
                ملخص الطلب ({cart.length} أصناف)
              </h3>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="flex items-start justify-between gap-2 bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5] text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-cairo font-bold text-[#231710] truncate">
                        {item.productName} × {item.quantity}
                      </div>
                      <div className="text-[11px] text-[#6E5D4F]">
                        {item.weightLabel} • {item.roastOption}
                      </div>
                      {item.isPartitionedBox && item.partitionedSlots && (
                        <div className="text-[11px] text-[#5C4A3D] mt-0.5">
                          الأقسام: {item.partitionedSlots.map((s) => s.productName).join(' + ')}
                        </div>
                      )}
                      {item.isCoffeeBlend && item.coffeeBlendSpec && (
                        <div className="text-[11px] text-[#5C4A3D] mt-0.5">
                          {item.coffeeBlendSpec.baristaLabel}
                        </div>
                      )}
                      {item.isCustomMix && item.customBreakdown && item.customBreakdown.length > 0 && (
                        <div className="text-[11px] text-[#5C4A3D] mt-0.5 space-y-0.5">
                          <span className="block font-medium">مكونات العلبة المشكلة:</span>
                          <div className="text-[10px] text-[#6E5D4F]">
                            {item.customBreakdown
                              .map((b) => `${b.productName} (${b.roastOption} • ${b.percentage}% • ${b.weightGrams}جم)`)
                              .join(' + ')}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-[#231710] shrink-0 tabular-nums">
                      {item.unitPrice * item.quantity} ج.م
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-3 border-t border-[#F0EAE0] text-xs tabular-nums">
                <div className="flex justify-between text-[#6E5D4F]">
                  <span>المجموع الفرعي</span>
                  <span className="font-bold text-[#231710]">{cartSubtotal} ج.م</span>
                </div>
                <div className="flex justify-between text-[#6E5D4F]">
                  <span>خدمة التوصيل ({deliveryMethod === 'store_pickup' ? 'استلام فرع' : 'بني مزار'})</span>
                  <span className="font-bold text-[#231710]">
                    {shippingCost === 0 ? 'مجاني' : `${shippingCost} ج.م`}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#3B6E4C] font-bold">
                    <span>خصم الكوبون</span>
                    <span>-{discountAmount} ج.م</span>
                  </div>
                )}
                {vipWalletDiscount > 0 && (
                  <div className="flex justify-between text-[#3B6E4C] font-bold">
                    <span>خصم رصيد محفظة VIP</span>
                    <span>-{vipWalletDiscount} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-cairo font-bold text-[#231710] pt-2.5 border-t border-[#F0EAE0]">
                  <span>الإجمالي النهائي</span>
                  <span>{finalTotal} ج.م</span>
                </div>
                {expectedCashback > 0 && (
                  <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-2.5 text-xs font-medium text-[#5C4A3D] flex items-center justify-between">
                    <span>كاش باك 5% يضاف لمحفظتك</span>
                    <span className="text-[#3B6E4C] font-bold">+{expectedCashback} ج.م</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || isVillageBelowMinimum}
                className={`w-full py-3.5 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                  submitting || isVillageBelowMinimum
                    ? 'bg-[#F4EFE6] text-[#8A7968] cursor-not-allowed'
                    : 'bg-[#231710] hover:bg-[#362419] text-[#FAF6F0]'
                }`}
              >
                {submitting
                  ? 'جاري تسجيل الطلب...'
                  : `تأكيد الطلب (${finalTotal} ج.م)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
