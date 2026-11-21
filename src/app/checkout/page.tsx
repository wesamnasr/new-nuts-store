'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Truck,
  MessageCircle,
  PackageSearch,
  Store,
  AlertTriangle,
  Clock,
  Printer,
  Lock,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  DeliveryMethodType,
  Order,
  PaymentMethod,
} from '@/types/store';
import { validateEgyptianPhone, formatWhatsAppPhone } from '@/lib/validation';
import {
  getCityName,
  getCurrencySymbol,
  getResolvedBandarZones,
  getResolvedDeliveryBatches,
  getResolvedFeatureFlags,
  getResolvedVillageZones,
} from '@/lib/defaults';
import { calculateVipCashback } from '@/lib/pricing';
import { calculateOrderTaxBreakdown } from '@/lib/tax';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';

async function compressReceiptImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('ملف الصورة غير مدعوم'));
      img.onload = () => {
        const maxWidth = 900;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', 0.72);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function CheckoutPage() {
  const {
    cart,
    cartSubtotal,
    appliedCoupon,
    discountAmount,
    clearCart,
    storeData,
    activeVipMember,
    setActiveVipPhone,
    refreshStore,
    trackPixelEvent,
  } = useStore();

  const settings = storeData?.settings;
  const featureFlags = getResolvedFeatureFlags(settings);
  const currency = getCurrencySymbol(settings);
  const cityName = getCityName(settings);
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const storeAddress = settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة';
  const bandarZones = useMemo(() => getResolvedBandarZones(settings), [settings]);
  const villageZones = useMemo(() => getResolvedVillageZones(settings), [settings]);
  const deliveryBatches = useMemo(() => getResolvedDeliveryBatches(settings), [settings]);

  const freeShippingThreshold = settings?.freeShippingThreshold || 300;
  const minOrderVillages = settings?.minOrderVillages || 200;

  // 1. Customer fields
  const [customerName, setCustomerName] = useState(activeVipMember?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(activeVipMember?.phone || '');
  const [customerAltPhone] = useState('');

  // 2. Dynamic Regional Delivery Method Selector
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodType>('bandar_fast');
  const [bandarZone, setBandarZone] = useState<string>(bandarZones[0] || '');
  const [villageName, setVillageName] = useState<string>(villageZones[0] || '');
  const [deliveryBatchSlot, setDeliveryBatchSlot] = useState<string>(
    deliveryBatches[0] || ''
  );
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Sync zone defaults when store settings finish loading
  useEffect(() => {
    if (bandarZones.length > 0 && !bandarZones.includes(bandarZone)) {
      setBandarZone(bandarZones[0]);
    }
  }, [bandarZones, bandarZone]);

  useEffect(() => {
    if (villageZones.length > 0 && !villageZones.includes(villageName)) {
      setVillageName(villageZones[0]);
    }
  }, [villageZones, villageName]);

  useEffect(() => {
    if (deliveryBatches.length > 0 && !deliveryBatches.includes(deliveryBatchSlot)) {
      setDeliveryBatchSlot(deliveryBatches[0]);
    }
  }, [deliveryBatches, deliveryBatchSlot]);

  useEffect(() => {
    if (!featureFlags.enableVillageBatches && deliveryMethod === 'villages_scheduled') {
      setDeliveryMethod('bandar_fast');
    }
  }, [featureFlags.enableVillageBatches, deliveryMethod]);

  // 3. Payment & VIP Wallet states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentReceiptImage, setPaymentReceiptImage] = useState<string | null>(null);
  const [compressingReceipt, setCompressingReceipt] = useState(false);
  const [useVipWallet, setUseVipWallet] = useState<boolean>(false);
  const [vipPin, setVipPin] = useState<string>('');

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-sync phone with VIP wallet when customer enters 11 digits
  useEffect(() => {
    const clean = customerPhone.replace(/\D/g, '');
    if (clean.length === 11 && featureFlags.enableVipWallet) {
      setActiveVipPhone(clean);
    }
  }, [customerPhone, setActiveVipPhone, featureFlags.enableVipWallet]);

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

  const taxBreakdown = useMemo(
    () =>
      calculateOrderTaxBreakdown(
        cart,
        storeData?.products || [],
        discountAmount,
        settings
      ),
    [cart, storeData?.products, discountAmount, settings]
  );

  const totalBeforeWallet = Math.max(
    0,
    Math.round((cartSubtotal - discountAmount + taxBreakdown.totalAddition + shippingCost) * 100) /
      100
  );

  const vipWalletDiscount = useMemo(() => {
    if (
      featureFlags.enableVipWallet &&
      (useVipWallet || paymentMethod === 'vip_wallet') &&
      activeVipMember &&
      activeVipMember.pointsBalance > 0
    ) {
      return Math.min(activeVipMember.pointsBalance, totalBeforeWallet);
    }
    return 0;
  }, [featureFlags.enableVipWallet, useVipWallet, paymentMethod, activeVipMember, totalBeforeWallet]);

  const finalTotal = Math.max(
    0,
    Math.round((totalBeforeWallet - vipWalletDiscount) * 100) / 100
  );

  const expectedCashback = useMemo(
    () =>
      featureFlags.enableVipWallet
        ? calculateVipCashback(
            Math.max(0, cartSubtotal - discountAmount),
            settings?.vipMinOrderForCashback || 150,
            settings?.vipCashbackPercentage || settings?.vipCashbackPercent || 5
          )
        : 0,
    [featureFlags.enableVipWallet, cartSubtotal, discountAmount, settings]
  );

  const isVillageBelowMinimum =
    deliveryMethod === 'villages_scheduled' && cartSubtotal < minOrderVillages;

  const buildOrderWhatsAppMessage = (order: Order) => {
    const itemsLines = order.items
      .map((item, idx) => {
        if (item.isPartitionedBox && item.partitionedSlots) {
          const slotsDetail = item.partitionedSlots
            .map((s) => `خانة ${s.slotIndex}: ${s.productName}${s.roastOption ? ` (${s.roastOption})` : ''}`)
            .join(' + ');
          return `${idx + 1}. ${item.productName} (${item.quantity} × ${item.unitPrice} ${currency})\n   - التفاصيل: [${slotsDetail}]`;
        }
        if (item.isCoffeeBlend && item.coffeeBlendSpec) {
          return `${idx + 1}. ${item.productName} (${item.quantity} × ${item.unitPrice} ${currency})\n   - التوليفة: [${item.coffeeBlendSpec.baristaLabel}]`;
        }
        const notesPart = item.workerNotes ? `\n   - ملاحظة التجهيز: ${item.workerNotes}` : '';
        return `${idx + 1}. ${item.productName} — ${item.weightLabel}${item.roastOption ? ` (${item.roastOption})` : ''} × ${
          item.quantity
        } = ${item.unitPrice * item.quantity} ${currency}${notesPart}`;
      })
      .join('\n');

    const deliveryDesc =
      order.deliveryMethod === 'store_pickup'
        ? `استلام سريع من الفرع (${storeAddress})`
        : order.deliveryMethod === 'villages_scheduled'
          ? `توصيل مجدول (${order.villageName || ''} — ${order.deliveryBatchSlot || ''})`
          : `توصيل محلي سريع (${order.governorate})`;

    const payDesc =
      order.paymentMethod === 'cod'
        ? 'كاش عند الاستلام'
        : order.paymentMethod === 'vodafone_cash'
          ? `فودافون كاش (${order.paymentReference || ''})`
          : order.paymentMethod === 'instapay'
            ? `إنستاباي (${order.paymentReference || ''})`
            : 'خصم من محفظة VIP';

    return (
      `*طلب جديد — ${storeName}*\n` +
      `رقم الطلب: *#${order.orderNumber}*\n` +
      `العميل: ${order.customerName}\n` +
      `الموبايل: ${order.customerPhone}\n` +
      `الاستلام: ${deliveryDesc}\n` +
      `العنوان التفصيلي: ${order.address}\n` +
      `--------------------------------\n` +
      `*الأصناف المطلوبة:*\n${itemsLines}\n` +
      `--------------------------------\n` +
      `المجموع الفرعي: ${order.subtotal} ${currency}\n` +
      `خدمة التوصيل: ${order.shippingCost === 0 ? 'مجاني' : `${order.shippingCost} ${currency}`}\n` +
      (order.discountAmount > 0 ? `خصم الكوبون: -${order.discountAmount} ${currency}\n` : '') +
      (order.vipWalletRedeemed && order.vipWalletRedeemed > 0
        ? `خصم محفظة VIP: -${order.vipWalletRedeemed} ${currency}\n`
        : '') +
      `*الإجمالي النهائي المطلوب: ${order.total} ${currency}*\n` +
      `طريقة الدفع: ${payDesc}` +
      (featureFlags.enableVipWallet
        ? `\nكاش باك مضاف لمحفظة VIP: +${order.vipCashbackEarned || 0} ${currency}`
        : '')
    );
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const resolvedAddress =
      deliveryMethod === 'store_pickup'
        ? address.trim() || `استلام من الفرع (${storeAddress})`
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
        `الحد الأدنى لطلبات المناطق الخارجية المجدولة هو ${minOrderVillages} ${currency} (متبقي ${
          minOrderVillages - cartSubtotal
        } ${currency}).`
      );
      return;
    }

    if (
      (paymentMethod === 'instapay' || paymentMethod === 'vodafone_cash') &&
      !paymentReference.trim() &&
      !paymentReceiptImage
    ) {
      setErrorMsg('يرجى كتابة رقم الموبايل المحول منه أو إرفاق صورة إيصال التحويل');
      return;
    }

    if (
      featureFlags.enableVipWallet &&
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
        ? `${cityName} - استلام من الفرع`
        : deliveryMethod === 'villages_scheduled'
          ? `مناطق مجدولة (${cityName}) - ${villageName}`
          : `${cityName} - ${bandarZone}`;

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
          useVipWallet:
            featureFlags.enableVipWallet && (useVipWallet || paymentMethod === 'vip_wallet'),
          vipPin:
            featureFlags.enableVipWallet && (useVipWallet || paymentMethod === 'vip_wallet')
              ? vipPin.trim()
              : undefined,
          couponCode: appliedCoupon?.code,
          total: finalTotal,
          paymentMethod,
          paymentReference:
            paymentReference.trim() ||
            (paymentReceiptImage ? 'مرفق صورة إيصال التحويل' : undefined),
          paymentReceiptImage:
            paymentMethod === 'instapay' || paymentMethod === 'vodafone_cash'
              ? paymentReceiptImage || undefined
              : undefined,
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
              وصل طلبك لشاشة التجهيز في {storeName} ({storeAddress})
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
                {completedOrder.total} {currency}
              </span>
            </div>
            {featureFlags.enableVipWallet && (completedOrder.vipCashbackEarned || 0) > 0 && (
              <div className="flex items-center justify-between bg-[#EEF5F0] p-2.5 rounded-xl border border-[#D4E8DA]">
                <span className="font-bold text-[#2F5A3D]">
                  كاش باك مضاف لمحفظة VIP:
                </span>
                <span className="font-bold text-[#2F5A3D]">
                  +{completedOrder.vipCashbackEarned} {currency}
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

            <div className={`grid ${featureFlags.enableVipWallet ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
              <Link
                href={`/track?q=${completedOrder.orderNumber}`}
                className="py-2.5 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <PackageSearch className="w-3.5 h-3.5" />
                <span>تتبع حالة الطلب</span>
              </Link>
              {featureFlags.enableVipWallet && (
                <Link
                  href="/vip"
                  className="py-2.5 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span>محفظة VIP</span>
                </Link>
              )}
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

  const paymentOptions: Array<{ id: PaymentMethod; label: string }> = [
    { id: 'cod', label: 'الدفع نقداً عند الاستلام' },
    { id: 'vodafone_cash', label: 'فودافون كاش' },
    { id: 'instapay', label: 'إنستا باي (InstaPay)' },
    ...(featureFlags.enableVipWallet
      ? [{ id: 'vip_wallet' as PaymentMethod, label: 'خصم من محفظة VIP' }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      <div className="bg-white border-b border-[#E8E0D5] py-5 sm:py-6 px-4 mb-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#9A6836] block">إتمام الطلب في 3 خطوات</span>
            <h1 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
              مراجعة الشحن والدفع
            </h1>
          </div>
          {cart.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
                <span className="w-5 h-5 rounded-full bg-[#231710] text-white text-[11px] flex items-center justify-center">1</span>
                <span>الاستلام والعنوان</span>
              </span>
              <span className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
                <span className="w-5 h-5 rounded-full bg-[#231710] text-white text-[11px] flex items-center justify-center">2</span>
                <span>الدفع والمحفظة</span>
              </span>
              <span className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
                <span className="w-5 h-5 rounded-full bg-[#231710] text-white text-[11px] flex items-center justify-center">3</span>
                <span>تأكيد الطلب</span>
              </span>
            </div>
          )}
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
                className="min-h-[44px] inline-flex items-center bg-[#231710] text-[#FAF6F0] px-5 py-2.5 rounded-xl font-cairo font-bold text-xs"
              >
                تصفح المتجر
              </Link>
              {featureFlags.enableCustomBoxes && (
                <Link
                  href="/build-box"
                  className="min-h-[44px] inline-flex items-center bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-5 py-2.5 rounded-xl font-cairo font-bold text-xs"
                >
                  {featureFlags.boxesModuleLabel || 'صمّم بوكسك'}
                </Link>
              )}
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

              {/* Step 1: Recipient, Delivery Zone & Address */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] space-y-4">
                <h2 className="font-cairo text-base font-bold text-[#231710] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">1</span>
                  <span>بيانات المستلم ومنطقة التوصيل والعنوان</span>
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
                      className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#231710] block mb-1.5">
                      رقم الموبايل {featureFlags.enableVipWallet ? '(واتساب + محفظة VIP)' : '(للتواصل والواتساب)'} *
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-medium text-right tabular-nums focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F0EAE0] space-y-3">
                  <span className="text-xs font-bold text-[#231710] block">طريقة الاستلام والتوصيل:</span>
                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('bandar_fast')}
                      className={`min-h-[44px] p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                        deliveryMethod === 'bandar_fast'
                          ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Truck className="w-4 h-4 shrink-0" />
                        <span className="font-cairo text-xs sm:text-sm font-bold">
                          توصيل محلي سريع داخل {cityName} (30–45 دقيقة)
                        </span>
                      </div>
                      <span className="font-cairo text-xs font-bold shrink-0 tabular-nums">
                        {cartSubtotal >= freeShippingThreshold
                          ? 'مجاني'
                          : `${settings?.bandarShippingCost ?? 20} ${currency}`}
                      </span>
                    </button>

                    {featureFlags.enableVillageBatches && (
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('villages_scheduled')}
                        className={`min-h-[44px] p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                          deliveryMethod === 'villages_scheduled'
                            ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                            : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span className="font-cairo text-xs sm:text-sm font-bold">
                            توصيل مجدول للمناطق والضواحي الخارجية
                          </span>
                        </div>
                        <span className="font-cairo text-xs font-bold shrink-0 tabular-nums">
                          {cartSubtotal >= freeShippingThreshold
                            ? 'مجاني'
                            : `${settings?.villagesShippingCost ?? 25} ${currency}`}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('store_pickup')}
                      className={`min-h-[44px] p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-3 ${
                        deliveryMethod === 'store_pickup'
                          ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Store className="w-4 h-4 shrink-0" />
                        <span className="font-cairo text-xs sm:text-sm font-bold">
                          استلام مباشر من الفرع ({storeAddress})
                        </span>
                      </div>
                      <span className="font-cairo text-xs font-bold shrink-0">
                        مجاناً
                      </span>
                    </button>
                  </div>
                </div>

                {deliveryMethod === 'bandar_fast' && bandarZones.length > 0 && (
                  <div className="pt-2 border-t border-[#F0EAE0]">
                    <label className="text-xs font-bold text-[#231710] block mb-1.5">
                      المنطقة داخل {cityName}:
                    </label>
                    <select
                      value={bandarZone}
                      onChange={(e) => setBandarZone(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2.5 text-xs font-medium"
                    >
                      {bandarZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {featureFlags.enableVillageBatches && deliveryMethod === 'villages_scheduled' && (
                  <div className="space-y-3 pt-2 border-t border-[#F0EAE0]">
                    {isVillageBelowMinimum && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-[#B83B2B]">
                        الحد الأدنى لطلبات التوصيل المجدول هو {minOrderVillages} {currency} (متبقي {minOrderVillages - cartSubtotal} {currency}).
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#231710] block mb-1.5">
                          اختر المنطقة / القرية:
                        </label>
                        <select
                          value={villageName}
                          onChange={(e) => setVillageName(e.target.value)}
                          className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2.5 text-xs font-medium"
                        >
                          {villageZones.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#231710] block mb-1.5">
                          موعد دورة التوصيل:
                        </label>
                        <select
                          value={deliveryBatchSlot}
                          onChange={(e) => setDeliveryBatchSlot(e.target.value)}
                          className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2.5 text-xs font-medium"
                        >
                          {deliveryBatches.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none transition"
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
                      className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Payment Method & Optional VIP PIN */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] space-y-4">
                <h2 className="font-cairo text-base font-bold text-[#231710] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">2</span>
                  <span>وسيلة الدفع ومحفظة VIP</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {paymentOptions.map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`min-h-[44px] p-3.5 rounded-xl border text-right text-xs font-bold transition cursor-pointer ${
                        paymentMethod === pm.id
                          ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>

                {featureFlags.enableVipWallet && activeVipMember && (
                  <div className="space-y-3 pt-1">
                    <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#231710]">
                        مرحباً <strong>{activeVipMember.customerName}</strong> — رصيد محفظة VIP المتاح:{' '}
                        <strong className="text-[#3B6E4C]">{activeVipMember.pointsBalance} {currency}</strong>
                      </span>
                      {activeVipMember.pointsBalance > 0 && (
                        <label className="min-h-[40px] flex items-center gap-2 text-xs font-bold text-[#231710] cursor-pointer px-2">
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
                          className="w-32 min-h-[44px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest text-[#231710] focus:outline-none font-bold"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}

                {(paymentMethod === 'vodafone_cash' || paymentMethod === 'instapay') && (
                  <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#E8E0D5] space-y-3 text-xs">
                    <p className="font-bold text-[#231710]">
                      {paymentMethod === 'vodafone_cash'
                        ? `حوّل المبلغ إلى رقم فودافون كاش: ${
                            settings?.vodafoneCashNumber || '01107677672'
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
                      className="w-full min-h-[44px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                    />

                    {/* Transfer Receipt Screenshot Upload */}
                    <div className="pt-1 space-y-2">
                      <label className="min-h-[44px] flex items-center justify-between gap-2 bg-white hover:bg-[#FCF9F5] border border-dashed border-[#C5B8A8] rounded-xl px-3.5 py-2.5 cursor-pointer transition">
                        <div className="flex items-center gap-2 text-[#231710] font-bold">
                          <Upload className="w-4 h-4 text-[#9A6836]" />
                          <span>
                            {compressingReceipt
                              ? 'جاري ضغط وإرفاق صورة الإيصال...'
                              : paymentReceiptImage
                                ? 'تغيير صورة إيصال التحويل المرفقة'
                                : 'إرفاق صورة إيصال التحويل (Screenshot)'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6E5D4F]">اختياري للتأكيد الفوري</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCompressingReceipt(true);
                            setErrorMsg(null);
                            try {
                              const compressed = await compressReceiptImageToDataUrl(file);
                              setPaymentReceiptImage(compressed);
                            } catch (err: any) {
                              setErrorMsg(err?.message || 'تعذر معالجة صورة الإيصال');
                            } finally {
                              setCompressingReceipt(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>

                      {paymentReceiptImage && (
                        <div className="bg-white p-2.5 rounded-xl border border-[#E8E0D5] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={paymentReceiptImage}
                              alt="إيصال التحويل"
                              className="w-12 h-12 object-cover rounded-lg border border-[#E8E0D5]"
                            />
                            <div>
                              <span className="text-xs font-bold text-[#3B6E4C] flex items-center gap-1">
                                <ImageIcon className="w-3.5 h-3.5" />
                                تم إرفاق صورة إيصال التحويل بنجاح
                              </span>
                              <span className="text-[11px] text-[#6E5D4F] block">
                                ستظهر الصورة مباشرة لدى الكاشير والإدارة لمراجعة التحويل
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPaymentReceiptImage(null)}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center p-1.5 rounded-lg bg-red-50 text-[#B83B2B] hover:bg-red-100 cursor-pointer"
                            title="حذف الصورة"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Order Confirmation & Summary Column (5 cols) */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] space-y-4">
              <h3 className="font-cairo text-base font-bold text-[#231710] border-b border-[#F0EAE0] pb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">3</span>
                <span>مراجعة وتأكيد الطلب ({cart.length} أصناف)</span>
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
                        {item.weightLabel}
                        {item.roastOption ? ` • ${item.roastOption}` : ''}
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
                          <div className="text-[11px] text-[#6E5D4F]">
                            {item.customBreakdown
                              .map((b) => `${b.productName} (${b.roastOption} • ${b.percentage}% • ${b.weightGrams}جم)`)
                              .join(' + ')}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-[#231710] shrink-0 tabular-nums">
                      {item.unitPrice * item.quantity} {currency}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-3 border-t border-[#F0EAE0] text-xs tabular-nums">
                <div className="flex justify-between text-[#6E5D4F]">
                  <span>المجموع الفرعي</span>
                  <span className="font-bold text-[#231710]">{cartSubtotal} {currency}</span>
                </div>
                <div className="flex justify-between text-[#6E5D4F]">
                  <span>خدمة التوصيل ({deliveryMethod === 'store_pickup' ? 'استلام فرع' : cityName})</span>
                  <span className="font-bold text-[#231710]">
                    {shippingCost === 0 ? 'مجاني' : `${shippingCost} ${currency}`}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#3B6E4C] font-bold">
                    <span>خصم الكوبون</span>
                    <span>-{discountAmount} {currency}</span>
                  </div>
                )}
                {taxBreakdown.taxEnabled && taxBreakdown.taxAmount > 0 && (
                  <div className="flex justify-between text-[#6E5D4F]">
                    <span>
                      ضريبة القيمة المضافة ({taxBreakdown.taxRatePercent}%{' '}
                      {taxBreakdown.taxInclusive ? 'شاملة' : 'مضافة'})
                    </span>
                    <span className="font-bold text-[#231710]">
                      {taxBreakdown.taxInclusive ? '' : '+'}
                      {taxBreakdown.taxAmount} {currency}
                    </span>
                  </div>
                )}
                {vipWalletDiscount > 0 && (
                  <div className="flex justify-between text-[#3B6E4C] font-bold">
                    <span>خصم رصيد محفظة VIP</span>
                    <span>-{vipWalletDiscount} {currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-cairo font-bold text-[#231710] pt-2.5 border-t border-[#F0EAE0]">
                  <span>الإجمالي النهائي</span>
                  <span>{finalTotal} {currency}</span>
                </div>
                {expectedCashback > 0 && (
                  <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-2.5 text-xs font-medium text-[#5C4A3D] flex items-center justify-between">
                    <span>كاش باك {settings?.vipCashbackPercent ?? 5}% يضاف لمحفظتك</span>
                    <span className="text-[#3B6E4C] font-bold">+{expectedCashback} {currency}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || isVillageBelowMinimum}
                className={`w-full min-h-[48px] py-3.5 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                  submitting || isVillageBelowMinimum
                    ? 'bg-[#F4EFE6] text-[#6E5D4F] cursor-not-allowed'
                    : 'bg-[#231710] hover:bg-[#362419] text-[#FAF6F0]'
                }`}
              >
                {submitting
                  ? 'جاري تسجيل الطلب...'
                  : `تأكيد الطلب (${finalTotal} ${currency})`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
