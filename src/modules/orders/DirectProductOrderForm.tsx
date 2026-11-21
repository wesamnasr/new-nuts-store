'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Phone,
  User,
  MapPin,
  Truck,
  Store,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MessageCircle,
  PackageSearch,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  CartItem,
  DeliveryMethodType,
  Order,
  PaymentMethod,
  Product,
  RoastOption,
  WeightVariant,
} from '@/types/store';
import { useStore } from '@/context/StoreContext';
import {
  getCityName,
  getCurrencySymbol,
  getResolvedBandarZones,
  getResolvedFeatureFlags,
  getResolvedPageContent,
  getSafeImageUrl,
} from '@/lib/defaults';
import { formatWhatsAppPhone, validateEgyptianPhone } from '@/lib/validation';
import { calculateVipCashback, isUnitProduct } from '@/lib/pricing';
import { calculateOrderTaxBreakdown } from '@/lib/tax';

interface DirectProductOrderFormProps {
  product: Product;
  selectedWeight: WeightVariant;
  selectedRoast: RoastOption;
  quantity: number;
  workerNotes?: string;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
}

const QUICK_CUSTOMER_STORAGE_KEY = 'mizan_quick_customer_v1';

export default function DirectProductOrderForm({
  product,
  selectedWeight,
  selectedRoast,
  quantity,
  workerNotes,
  nameInputRef,
}: DirectProductOrderFormProps) {
  const {
    storeData,
    activeVipMember,
    setActiveVipPhone,
    refreshStore,
    showToast,
    trackPixelEvent,
  } = useStore();

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const featureFlags = getResolvedFeatureFlags(settings);
  const currency = getCurrencySymbol(settings);
  const cityName = getCityName(settings);
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const storeAddress = settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة';
  const bandarZones = useMemo(() => getResolvedBandarZones(settings), [settings]);

  const freeShippingThreshold = settings?.freeShippingThreshold || 300;
  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);

  const [customerName, setCustomerName] = useState(activeVipMember?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(activeVipMember?.phone || '');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodType>('bandar_fast');
  const [selectedZone, setSelectedZone] = useState<string>(bandarZones[0] || cityName);
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Hydrate saved customer details for repeat one-click ordering
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(QUICK_CUSTOMER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        name?: string;
        phone?: string;
        address?: string;
        zone?: string;
      };
      if (saved.name && !customerName) setCustomerName(saved.name);
      if (saved.phone && !customerPhone) setCustomerPhone(saved.phone);
      if (saved.address && !address) setAddress(saved.address);
      if (saved.zone) setSelectedZone(saved.zone);
    } catch {
      // Ignore storage read errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bandarZones.length > 0 && !selectedZone) {
      setSelectedZone(bandarZones[0]);
    }
  }, [bandarZones, selectedZone]);

  // Sync VIP lookup automatically when 11 digits are typed
  useEffect(() => {
    const westernDigits = customerPhone
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/\D/g, '');
    if (westernDigits.length === 11 && featureFlags.enableVipWallet) {
      setActiveVipPhone(westernDigits);
    }
  }, [customerPhone, featureFlags.enableVipWallet, setActiveVipPhone]);

  const directCartItem: CartItem = useMemo(() => {
    const unitMode = isUnitProduct(product);
    const grams =
      selectedWeight.weightGrams ||
      selectedWeight.grams ||
      (unitMode ? (selectedWeight.unitsCount || 1) * 1000 : 250);

    return {
      cartItemId: `direct-${product.id}-${selectedWeight.id}-${selectedRoast || 'std'}`,
      productId: product.id,
      productName: product.name,
      productImage: getSafeImageUrl(product.image),
      weightId: selectedWeight.id,
      weightLabel: selectedWeight.label,
      customWeightGrams: unitMode ? undefined : grams,
      roastOption: selectedRoast || '',
      unitPrice: selectedWeight.price,
      quantity: Math.max(1, quantity),
      workerNotes: workerNotes?.trim() || undefined,
    };
  }, [product, selectedWeight, selectedRoast, quantity, workerNotes]);

  const itemSubtotal = directCartItem.unitPrice * directCartItem.quantity;

  const shippingCost = useMemo(() => {
    if (deliveryMethod === 'store_pickup') return 0;
    if (itemSubtotal >= freeShippingThreshold) return 0;
    return settings?.bandarShippingCost ?? 20;
  }, [deliveryMethod, itemSubtotal, freeShippingThreshold, settings?.bandarShippingCost]);

  const taxBreakdown = useMemo(
    () =>
      calculateOrderTaxBreakdown(
        [directCartItem],
        storeData?.products || [product],
        0,
        settings
      ),
    [directCartItem, storeData?.products, product, settings]
  );

  const finalTotal = Math.max(
    0,
    Math.round((itemSubtotal + taxBreakdown.totalAddition + shippingCost) * 100) / 100
  );

  const expectedCashback = useMemo(
    () =>
      featureFlags.enableVipWallet
        ? calculateVipCashback(
            itemSubtotal,
            settings?.vipMinOrderForCashback || 150,
            settings?.vipCashbackPercentage || settings?.vipCashbackPercent || 5
          )
        : 0,
    [featureFlags.enableVipWallet, itemSubtotal, settings]
  );

  const remainingForFreeShipping =
    deliveryMethod === 'store_pickup'
      ? 0
      : Math.max(0, freeShippingThreshold - itemSubtotal);

  const handleSubmitDirectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.inStock) return;
    setErrorMsg(null);

    const cleanName = customerName.trim();
    if (cleanName.length < 2) {
      setErrorMsg('يرجى إدخال الاسم بالكامل لإتمام الطلب السريع');
      return;
    }

    const phoneCheck = validateEgyptianPhone(customerPhone);
    if (!phoneCheck.isValid) {
      setErrorMsg(phoneCheck.error || 'يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم');
      return;
    }

    const resolvedAddress =
      deliveryMethod === 'store_pickup'
        ? `استلام مباشر من الفرع (${storeAddress})`
        : address.trim()
          ? selectedZone
            ? `${selectedZone} — ${address.trim()}`
            : address.trim()
          : '';

    if (!resolvedAddress) {
      setErrorMsg('يرجى كتابة العنوان أو الشارع باختصار لتوصيل الطلب لباب البيت');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: cleanName,
          customerPhone: phoneCheck.normalized,
          governorate:
            deliveryMethod === 'store_pickup'
              ? storeAddress
              : selectedZone || cityName,
          deliveryMethod,
          address: resolvedAddress,
          notes: workerNotes?.trim()
            ? `طلب سريع مباشر من صفحة المنتج • ${workerNotes.trim()}`
            : 'طلب سريع مباشر من صفحة المنتج',
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          items: [directCartItem],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.order) {
        setErrorMsg(data.error || 'تعذر تسجيل الطلب حالياً، يرجى المحاولة مرة أخرى');
        return;
      }

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            QUICK_CUSTOMER_STORAGE_KEY,
            JSON.stringify({
              name: cleanName,
              phone: phoneCheck.normalized,
              address: deliveryMethod === 'store_pickup' ? address : address.trim(),
              zone: selectedZone,
            })
          );
        } catch {
          // Ignore storage write errors
        }
      }

      const createdOrder: Order = data.order;
      setCompletedOrder(createdOrder);
      showToast(
        `تم تأكيد طلبك بنجاح #${createdOrder.orderNumber}`,
        `الإجمالي: ${createdOrder.total} ${currency}`
      );
      trackPixelEvent('Purchase', {
        value: createdOrder.total,
        currency: 'EGP',
        content_name: product.name,
        content_ids: [product.id],
        order_number: createdOrder.orderNumber,
      });
      refreshStore();
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالشبكة، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (completedOrder) {
    const waText =
      `*تأكيد طلب مباشر — ${storeName}*\n` +
      `رقم الطلب: *#${completedOrder.orderNumber}*\n` +
      `العميل: ${completedOrder.customerName}\n` +
      `الموبايل: ${completedOrder.customerPhone}\n` +
      `الصنف: ${product.name} (${selectedWeight.label}${
        selectedRoast ? ` - ${selectedRoast}` : ''
      }) × ${completedOrder.items[0]?.quantity || quantity}\n` +
      `العنوان: ${completedOrder.address}\n` +
      `الإجمالي: *${completedOrder.total} ${currency}*`;
    const waConfirmUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waText)}`;

    return (
      <div
        id="direct-order-box"
        className="rounded-2xl border-2 border-[#3B6E4C] bg-[#F4FBF6] p-5 space-y-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#3B6E4C] text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="inline-block text-[11px] font-extrabold bg-white text-[#3B6E4C] border border-[#3B6E4C]/25 px-2.5 py-0.5 rounded-full">
              تم تسجيل طلبك المباشر بنجاح
            </span>
            <h3 className="font-cairo text-base sm:text-lg font-extrabold text-[#231710]">
              شكراً لك يا {completedOrder.customerName} — رقم طلبك #{completedOrder.orderNumber}
            </h3>
            <p className="text-xs text-[#5C4A3D]">
              جاري تجهيز <span className="font-bold text-[#231710]">{product.name}</span> ({selectedWeight.label}) والتواصل معك فوراً للتسليم.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#D4E8DA] p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs tabular-nums">
          <div>
            <span className="text-[#6E5D4F] block">رقم الطلب</span>
            <span className="font-cairo font-extrabold text-[#9A6836] text-sm">
              #{completedOrder.orderNumber}
            </span>
          </div>
          <div>
            <span className="text-[#6E5D4F] block">الإجمالي شامل الشحن</span>
            <span className="font-cairo font-extrabold text-[#261A13] text-sm">
              {completedOrder.total} {currency}
            </span>
          </div>
          {completedOrder.vipCashbackEarned && completedOrder.vipCashbackEarned > 0 ? (
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[#6E5D4F] block">كاش باك VIP المضاف</span>
              <span className="font-cairo font-extrabold text-[#3B6E4C] text-sm">
                +{completedOrder.vipCashbackEarned} {currency}
              </span>
            </div>
          ) : (
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[#6E5D4F] block">طريقة الدفع</span>
              <span className="font-bold text-[#261A13]">
                {completedOrder.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : 'تحويل إلكتروني'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <a
            href={waConfirmUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-[#3B6E4C] hover:bg-[#315D40] text-white font-cairo font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>إرسال تأكيد سريع عبر واتساب</span>
          </a>

          <Link
            href={`/track?q=${encodeURIComponent(completedOrder.orderNumber)}`}
            className="min-h-[46px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#261A13] border border-[#D4E8DA] font-cairo font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <PackageSearch className="w-4 h-4 text-[#9A6836]" />
            <span>تتبع حالة الطلب</span>
          </Link>

          <button
            type="button"
            onClick={() => setCompletedOrder(null)}
            className="min-h-[46px] py-2.5 px-3.5 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#5E4D40] border border-[#D4E8DA] font-cairo font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>طلب جديد</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="direct-order-box"
      className="rounded-2xl border border-[#E8DFD3] bg-white p-4 sm:p-6 space-y-4 shadow-[0_6px_24px_-12px_rgba(35,23,16,0.08)]"
    >
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EAE0] pb-3">
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#8C5828] bg-[#FBF3E4] border border-[#EBD8B8] px-2.5 py-0.5 rounded-full">
            <Zap className="w-3.5 h-3.5 fill-[#D99B26] text-[#9A6836]" />
            <span>الطلب السريع المباشر بدون مغادرة الصفحة</span>
          </div>
          <h2 className="font-cairo text-base sm:text-lg font-extrabold text-[#261A13]">
            اطلب {product.name} الآن في ١٠ ثوانٍ
          </h2>
        </div>
        <span className="text-[11px] font-bold text-[#3B6E4C] bg-[#F1F7F3] border border-[#D4E6DA] px-2.5 py-1 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>الدفع عند الاستلام متاح</span>
        </span>
      </div>

      {errorMsg && (
        <div className="bg-[#FDF2F0] border border-[#F2D6D0] text-[#B84A39] text-xs font-bold p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmitDirectOrder} className="space-y-3.5">
        {/* Core Simple Inputs: Name + Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-[#261A13] flex items-center gap-1 mb-1">
              <User className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>الاسم بالكامل *</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اكتب اسمك الكريم هنا..."
              className="w-full min-h-[44px] bg-[#FAF7F2] border border-[#E8DFD3] focus:border-[#9A6836] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#261A13] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#261A13] flex items-center gap-1 mb-1">
              <Phone className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>رقم الموبايل (للتأكيد والتوصيل) *</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="01012345678"
              className="w-full min-h-[44px] bg-[#FAF7F2] border border-[#E8DFD3] focus:border-[#9A6836] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-right text-[#261A13] tabular-nums focus:outline-none transition"
            />
          </div>
        </div>

        {/* Delivery Mode Toggle: Home Delivery vs Branch Pickup */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDeliveryMethod('bandar_fast')}
            className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-cairo font-bold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
              deliveryMethod !== 'store_pickup'
                ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14]'
                : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3] hover:border-[#C88A4B]'
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span>توصيل سريع لباب البيت</span>
          </button>

          <button
            type="button"
            onClick={() => setDeliveryMethod('store_pickup')}
            className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-cairo font-bold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
              deliveryMethod === 'store_pickup'
                ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14]'
                : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3] hover:border-[#C88A4B]'
            }`}
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span>استلام من الفرع (بدون شحن)</span>
          </button>
        </div>

        {/* Frictionless Single-Line Address + Quick Zone Chips (shown only for Home Delivery) */}
        {deliveryMethod !== 'store_pickup' && (
          <div className="space-y-2">
            {bandarZones.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <span className="text-[11px] font-bold text-[#6E5D4F] shrink-0">المنطقة:</span>
                {bandarZones.slice(0, 5).map((zone) => {
                  const active = selectedZone === zone;
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => setSelectedZone(zone)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition cursor-pointer ${
                        active
                          ? 'bg-[#FBF3E4] text-[#8C5828] border-[#D5A76C]'
                          : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3] hover:border-[#C88A4B]'
                      }`}
                    >
                      {zone}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[#261A13] flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#9A6836]" />
                <span>العنوان بالتفصيل (الشارع / علامة مميزة) *</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: بندر بني مزار — شارع بورسعيد، بجوار مسجد الزراعيين"
                className="w-full min-h-[44px] bg-[#FAF7F2] border border-[#E8DFD3] focus:border-[#9A6836] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#261A13] focus:outline-none transition"
              />
            </div>
          </div>
        )}

        {/* Payment Method Quick Pills */}
        {(pageContent.enableInstapay !== false || pageContent.enableVodafoneCash !== false) && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#6E5D4F]">طريقة الدفع:</span>
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                  paymentMethod === 'cod'
                    ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14]'
                    : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3]'
                }`}
              >
                الدفع عند الاستلام
              </button>
              {pageContent.enableInstapay !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    paymentMethod === 'instapay'
                      ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14]'
                      : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3]'
                  }`}
                >
                  إنستا باي
                </button>
              )}
              {pageContent.enableVodafoneCash !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vodafone_cash')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    paymentMethod === 'vodafone_cash'
                      ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14]'
                      : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3]'
                  }`}
                >
                  فودافون كاش
                </button>
              )}
            </div>

            {paymentMethod !== 'cod' && (
              <div className="bg-[#FAF7F2] rounded-xl border border-[#E8DFD3] p-2.5 space-y-2 text-xs">
                <p className="text-[#5E4D40]">
                  {paymentMethod === 'instapay'
                    ? `عنوان التحويل عبر إنستا باي: ${settings?.instapayAddress || 'متاح عند التأكيد'}`
                    : `رقم فودافون كاش للتحويل: ${settings?.vodafoneCashNumber || settings?.supportPhone || ''}`}
                </p>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="رقم العملية المرجعي أو آخر 4 أرقام (اختياري)"
                  className="w-full min-h-[38px] bg-white border border-[#E8DFD3] rounded-lg px-3 py-1.5 text-xs text-[#261A13] focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Live Instant Calculation Box */}
        <div className="bg-[#FAF7F2] rounded-xl border border-[#E8DFD3] p-3.5 space-y-2 text-xs tabular-nums">
          <div className="flex items-center justify-between text-[#5E4D40]">
            <span>
              {product.name} ({selectedWeight.label}) × {quantity}
            </span>
            <span className="font-bold text-[#261A13]">
              {itemSubtotal} {currency}
            </span>
          </div>

          <div className="flex items-center justify-between text-[#5E4D40]">
            <span>رسوم التوصيل</span>
            {shippingCost === 0 ? (
              <span className="font-extrabold text-[#3B6E4C]">مجاني</span>
            ) : (
              <span className="font-bold text-[#261A13]">
                {shippingCost} {currency}
              </span>
            )}
          </div>

          {remainingForFreeShipping > 0 && (
            <div className="text-[11px] text-[#9A6836] font-medium">
              أضف منتجات أو زد الكمية بقيمة {remainingForFreeShipping} {currency} للحصول على شحن مجاني!
            </div>
          )}

          <div className="pt-2 border-t border-[#E8DFD3] flex items-center justify-between">
            <span className="font-cairo font-extrabold text-sm text-[#261A13]">
              الإجمالي المطلوب
            </span>
            <span className="font-cairo font-extrabold text-lg text-[#261A13]">
              {finalTotal}{' '}
              <span className="text-xs font-bold text-[#9A6836]">{currency}</span>
            </span>
          </div>

          {expectedCashback > 0 && (
            <div className="text-[11px] font-bold text-[#3B6E4C] bg-[#F1F7F3] border border-[#D4E6DA] px-2.5 py-1 rounded-lg text-center">
              ستحصل تلقائياً على +{expectedCashback} {currency} كاش باك في محفظة VIP برقم موبايلك!
            </div>
          )}
        </div>

        {/* Big High-Converting Submit CTA */}
        <button
          type="submit"
          disabled={!product.inStock || isSubmitting}
          className="w-full min-h-[52px] py-3.5 px-5 rounded-xl bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] font-cairo font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
        >
          {!product.inStock ? (
            <span>غير متوفر بالمخزون حالياً</span>
          ) : isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري تسجيل وتأكيد طلبك الفوري...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-[#E5B869] text-[#E5B869]" />
              <span>
                اطلب الآن مباشرة • {finalTotal} {currency}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
