'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Tag,
  Globe2,
  Sparkles,
  Clock,
  Warehouse,
} from 'lucide-react';
import {
  CartItem,
  Coupon,
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
  getResolvedDeliveryBatches,
  getResolvedFeatureFlags,
  getResolvedPageContent,
  getResolvedVillageZones,
  getSafeImageUrl,
  stripUiEmojis,
} from '@/lib/defaults';
import { formatWhatsAppPhone, validateCoupon, validateEgyptianPhone } from '@/lib/validation';
import {
  calculateVipCashback,
  getResolvedProductWeights,
  isUnitProduct,
} from '@/lib/pricing';
import { calculateOrderTaxBreakdown } from '@/lib/tax';
import {
  getFreeShippingThresholdForMethod,
  getFulfillmentHubLabel,
  getGovernorateShippingRates,
  resolveOrderFulfillmentHub,
} from '@/lib/egypt-shipping';
import { readBrowserCookie } from '@/components/MarketingPixels';

interface DirectProductOrderFormProps {
  product: Product;
  selectedWeight: WeightVariant;
  selectedRoast: RoastOption;
  quantity: number;
  workerNotes?: string;
  relatedProducts?: Product[];
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  isAdMode?: boolean;
}

const QUICK_CUSTOMER_STORAGE_KEY = 'mizan_quick_customer_v1';

export default function DirectProductOrderForm({
  product,
  selectedWeight,
  selectedRoast,
  quantity,
  workerNotes,
  relatedProducts = [],
  nameInputRef,
  isAdMode = false,
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
  const villageZones = useMemo(() => getResolvedVillageZones(settings), [settings]);
  const deliveryBatches = useMemo(() => getResolvedDeliveryBatches(settings), [settings]);
  const governorateRates = useMemo(
    () => getGovernorateShippingRates(storeData?.shippingRates),
    [storeData?.shippingRates]
  );

  const minOrderVillages = settings?.minOrderVillages || 200;
  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);

  const [customerName, setCustomerName] = useState(activeVipMember?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(activeVipMember?.phone || '');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodType>('governorate_shipping');
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>(
    governorateRates[0]?.governorate || 'القاهرة'
  );
  const [selectedZone, setSelectedZone] = useState<string>(bandarZones[0] || cityName);
  const [selectedVillage, setSelectedVillage] = useState<string>(villageZones[0] || '');
  const [selectedBatchSlot, setSelectedBatchSlot] = useState<string>(deliveryBatches[0] || '');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState('');

  // Influencer / Promo Coupon Support (auto-reads ?coupon=CODE or ?promo=CODE from Ad URLs!)
  const [couponInput, setCouponInput] = useState('');
  const [showCouponBox, setShowCouponBox] = useState(false);
  const [appliedDirectCoupon, setAppliedDirectCoupon] = useState<Coupon | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Optional 1-Click Order Bump to boost AOV & unlock free shipping
  const [includeOrderBump, setIncludeOrderBump] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const initiatedCheckoutRef = useRef(false);
  const [hasManualDeliverySelect, setHasManualDeliverySelect] = useState(false);
  const [showLocalOptionsInAdMode, setShowLocalOptionsInAdMode] = useState(false);
  const [showElectronicPaymentInAdMode, setShowElectronicPaymentInAdMode] = useState(false);
  const [dispatchCutoffText, setDispatchCutoffText] = useState(
    'طلبك بيتجهز ويتحمص طازج ويخرج من أقرب مخزن ليك (أكتوبر أو بني مزار)'
  );
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellError, setUpsellError] = useState<string | null>(null);
  const [upsellSuccessName, setUpsellSuccessName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        hour: 'numeric',
        hour12: false,
      }).format(new Date());
      const cairoHour = Number(hourStr);
      if (Number.isFinite(cairoHour) && cairoHour < 16) {
        setDispatchCutoffText(
          'اطلب قبل الساعة ٤ عصراً ويخرج شحنك النهارده من مخزن أكتوبر أو بني مزار'
        );
      } else {
        setDispatchCutoffText(
          'اطلب دلوقتي ويخرج طلبك طازج في أول شحنة الصبح من مخزن أكتوبر أو بني مزار'
        );
      }
    } catch {
      // Fallback already set
    }
  }, []);

  useEffect(() => {
    if (isAdMode && !hasManualDeliverySelect) {
      setDeliveryMethod('governorate_shipping');
    }
  }, [isAdMode, hasManualDeliverySelect]);

  // Pick one clean complementary in-stock product as an optional 1-click bump
  const bumpCandidate = useMemo(() => {
    const candidate = relatedProducts.find(
      (p) => p.id !== product.id && p.inStock && p.showOnline !== false
    );
    if (!candidate) return null;
    const weights = getResolvedProductWeights(candidate);
    const chosenWeight = isUnitProduct(candidate)
      ? weights[0]
      : weights.find((w) => (w.weightGrams || w.grams) === 250) || weights[0];
    if (!chosenWeight) return null;
    return { product: candidate, weight: chosenWeight };
  }, [relatedProducts, product.id]);

  // Pick one high-converting complementary product for the Thank-You screen (-15% with 0 extra shipping)
  const postUpsellCandidate = useMemo(() => {
    if (!completedOrder) return null;
    const orderedIds = new Set((completedOrder.items || []).map((it) => it.productId));
    const pool = [...relatedProducts, ...(storeData?.products || [])];
    const candidate = pool.find(
      (p) =>
        p.id !== product.id &&
        !orderedIds.has(p.id) &&
        p.inStock &&
        p.showOnline !== false
    );
    if (!candidate) return null;
    const weights = getResolvedProductWeights(candidate);
    const chosenWeight = isUnitProduct(candidate)
      ? weights[0]
      : weights.find((w) => (w.weightGrams || w.grams) === 250) || weights[0];
    if (!chosenWeight) return null;
    const upsellPrice = Math.max(1, Math.round(chosenWeight.price * 0.85));
    return { product: candidate, weight: chosenWeight, upsellPrice };
  }, [completedOrder, relatedProducts, storeData?.products, product.id]);

  // Hydrate saved customer details for repeat one-click ordering
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(QUICK_CUSTOMER_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          name?: string;
          phone?: string;
          address?: string;
          zone?: string;
          governorate?: string;
          deliveryMethod?: DeliveryMethodType;
        };
        if (saved.name && !customerName) setCustomerName(saved.name);
        if (saved.phone && !customerPhone) setCustomerPhone(saved.phone);
        if (saved.address && !address) setAddress(saved.address);
        if (saved.zone) setSelectedZone(saved.zone);
        if (saved.governorate) setSelectedGovernorate(saved.governorate);
        if (
          saved.deliveryMethod &&
          ['governorate_shipping', 'bandar_fast', 'villages_scheduled', 'store_pickup'].includes(
            saved.deliveryMethod
          )
        ) {
          setDeliveryMethod(saved.deliveryMethod);
        }
      }
    } catch {
      // Ignore storage read errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-apply influencer coupon from URL query (?coupon=HAFSA10 or ?promo=HAFSA25)
  useEffect(() => {
    if (typeof window === 'undefined' || !storeData?.coupons?.length) return;
    const params = new URLSearchParams(window.location.search);
    const urlCoupon = (params.get('coupon') || params.get('promo') || '').trim().toUpperCase();
    if (!urlCoupon) return;
    setCouponInput(urlCoupon);
    setShowCouponBox(true);
    const matched = storeData.coupons.find(
      (c) => c.code.toUpperCase() === urlCoupon && c.active
    );
    if (matched) {
      setAppliedDirectCoupon(matched);
      setCouponFeedback({
        type: 'success',
        text: `تم تفعيل كود العرض (${matched.code}): ${stripUiEmojis(matched.description)}`,
      });
    }
  }, [storeData?.coupons]);

  useEffect(() => {
    if (bandarZones.length > 0 && !selectedZone) {
      setSelectedZone(bandarZones[0]);
    }
  }, [bandarZones, selectedZone]);

  useEffect(() => {
    if (villageZones.length > 0 && !selectedVillage) {
      setSelectedVillage(villageZones[0]);
    }
  }, [villageZones, selectedVillage]);

  useEffect(() => {
    if (deliveryBatches.length > 0 && !selectedBatchSlot) {
      setSelectedBatchSlot(deliveryBatches[0]);
    }
  }, [deliveryBatches, selectedBatchSlot]);

  useEffect(() => {
    if (
      governorateRates.length > 0 &&
      !governorateRates.some((r) => r.governorate === selectedGovernorate)
    ) {
      setSelectedGovernorate(governorateRates[0].governorate);
    }
  }, [governorateRates, selectedGovernorate]);

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

  const bumpCartItem: CartItem | null = useMemo(() => {
    if (!includeOrderBump || !bumpCandidate) return null;
    const { product: bp, weight: bw } = bumpCandidate;
    const unitMode = isUnitProduct(bp);
    const grams = bw.weightGrams || bw.grams || (unitMode ? (bw.unitsCount || 1) * 1000 : 250);
    return {
      cartItemId: `bump-${bp.id}-${bw.id}`,
      productId: bp.id,
      productName: bp.name,
      productImage: getSafeImageUrl(bp.image),
      weightId: bw.id,
      weightLabel: bw.label,
      customWeightGrams: unitMode ? undefined : grams,
      roastOption: bp.roastOptions?.[0] || '',
      unitPrice: bw.price,
      quantity: 1,
    };
  }, [includeOrderBump, bumpCandidate]);

  const orderItems = useMemo(
    () => (bumpCartItem ? [directCartItem, bumpCartItem] : [directCartItem]),
    [directCartItem, bumpCartItem]
  );

  const itemSubtotal = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [orderItems]
  );

  const couponValidation = useMemo(() => {
    if (!appliedDirectCoupon) return { isValid: false, discountAmount: 0, message: '' };
    return validateCoupon(appliedDirectCoupon, itemSubtotal);
  }, [appliedDirectCoupon, itemSubtotal]);

  const discountAmount = couponValidation.isValid ? couponValidation.discountAmount : 0;

  const selectedGovRate = useMemo(
    () => governorateRates.find((r) => r.governorate === selectedGovernorate) || governorateRates[0],
    [governorateRates, selectedGovernorate]
  );

  const effectiveFreeShippingThreshold = useMemo(
    () => getFreeShippingThresholdForMethod(deliveryMethod, settings),
    [deliveryMethod, settings]
  );

  const shippingCost = useMemo(() => {
    if (deliveryMethod === 'store_pickup') return 0;
    if (itemSubtotal >= effectiveFreeShippingThreshold) return 0;
    if (deliveryMethod === 'governorate_shipping') {
      return selectedGovRate?.price ?? 65;
    }
    if (deliveryMethod === 'villages_scheduled') {
      return settings?.villagesShippingCost ?? 25;
    }
    return settings?.bandarShippingCost ?? 20;
  }, [
    deliveryMethod,
    itemSubtotal,
    effectiveFreeShippingThreshold,
    selectedGovRate?.price,
    settings?.villagesShippingCost,
    settings?.bandarShippingCost,
  ]);

  const resolvedHub = useMemo(
    () =>
      resolveOrderFulfillmentHub(
        deliveryMethod,
        deliveryMethod === 'governorate_shipping' ? selectedGovernorate : cityName,
        storeData?.shippingRates
      ),
    [deliveryMethod, selectedGovernorate, cityName, storeData?.shippingRates]
  );

  const taxBreakdown = useMemo(
    () =>
      calculateOrderTaxBreakdown(
        orderItems,
        storeData?.products || [product],
        discountAmount,
        settings
      ),
    [orderItems, storeData?.products, product, discountAmount, settings]
  );

  const finalTotal = Math.max(
    0,
    Math.round((itemSubtotal - discountAmount + taxBreakdown.totalAddition + shippingCost) * 100) /
      100
  );

  const expectedCashback = useMemo(
    () =>
      featureFlags.enableVipWallet
        ? calculateVipCashback(
            Math.max(0, itemSubtotal - discountAmount),
            settings?.vipMinOrderForCashback || 150,
            settings?.vipCashbackPercentage || settings?.vipCashbackPercent || 5
          )
        : 0,
    [featureFlags.enableVipWallet, itemSubtotal, discountAmount, settings]
  );

  const remainingForFreeShipping =
    deliveryMethod === 'store_pickup'
      ? 0
      : Math.max(0, effectiveFreeShippingThreshold - itemSubtotal);

  const isVillageBelowMinimum =
    deliveryMethod === 'villages_scheduled' && itemSubtotal < minOrderVillages;

  const markInitiateCheckout = () => {
    if (initiatedCheckoutRef.current) return;
    initiatedCheckoutRef.current = true;
    trackPixelEvent('InitiateCheckout', {
      value: finalTotal,
      currency: 'EGP',
      content_ids: orderItems.map((i) => i.productId),
      content_name: product.name,
      content_type: 'product',
      num_items: orderItems.reduce((s, i) => s + i.quantity, 0),
    });
  };

  const handleApplyDirectCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const matched = (storeData?.coupons || []).find(
      (c) => c.code.toUpperCase() === code && c.active
    );
    if (!matched) {
      setAppliedDirectCoupon(null);
      setCouponFeedback({ type: 'error', text: 'كود الخصم غير صحيح أو منتهي الصلاحية' });
      return;
    }
    const check = validateCoupon(matched, itemSubtotal);
    if (!check.isValid) {
      setAppliedDirectCoupon(matched);
      setCouponFeedback({
        type: 'error',
        text: `الحد الأدنى لتفعيل كود ${matched.code} هو ${matched.minOrderAmount} ${currency} (باقي ${Math.max(0, matched.minOrderAmount - itemSubtotal)} ${currency})`,
      });
      return;
    }
    setAppliedDirectCoupon(matched);
    setCouponFeedback({
      type: 'success',
      text: `تم تطبيق خصم ${check.discountAmount} ${currency} (${stripUiEmojis(matched.description)})`,
    });
  };

  const prefilledWhatsappOrderUrl = useMemo(() => {
    const destLabel =
      deliveryMethod === 'store_pickup'
        ? `استلام من الفرع (${storeAddress})`
        : deliveryMethod === 'governorate_shipping'
          ? `شحن محافظات — ${selectedGovernorate}`
          : deliveryMethod === 'villages_scheduled'
            ? `قرى ${cityName} — ${selectedVillage}`
            : `توصيل فوري داخل ${cityName} — ${selectedZone}`;
    const itemsSummary = orderItems
      .map(
        (it) =>
          `• ${it.productName} (${it.weightLabel}${it.roastOption ? ` - ${it.roastOption}` : ''}) × ${it.quantity} = ${it.unitPrice * it.quantity} ${currency}`
      )
      .join('\n');
    const msg =
      `مرحباً ${storeName}، أرغب في طلب:\n` +
      `${itemsSummary}\n` +
      `التوصيل: ${destLabel}\n` +
      (appliedDirectCoupon && couponValidation.isValid
        ? `كود الخصم: ${appliedDirectCoupon.code} (-${discountAmount} ${currency})\n`
        : '') +
      `الإجمالي التقديري: ${finalTotal} ${currency}` +
      (customerName.trim() ? `\nالاسم: ${customerName.trim()}` : '') +
      (address.trim() ? `\nالعنوان: ${address.trim()}` : '');
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }, [
    deliveryMethod,
    storeAddress,
    selectedGovernorate,
    cityName,
    selectedVillage,
    selectedZone,
    orderItems,
    currency,
    storeName,
    appliedDirectCoupon,
    couponValidation.isValid,
    discountAmount,
    finalTotal,
    customerName,
    address,
    whatsappNumber,
  ]);

  const handleSubmitDirectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.inStock) return;
    setErrorMsg(null);

    const cleanName = customerName.trim();
    if (cleanName.length < 2) {
      setErrorMsg('اكتب اسمك عشان نعرف نوصلك الطلب');
      return;
    }

    const phoneCheck = validateEgyptianPhone(customerPhone);
    if (!phoneCheck.isValid) {
      setErrorMsg(phoneCheck.error || 'اكتب رقم موبايل مصري صحيح مكون من ١١ رقم');
      return;
    }

    if (isVillageBelowMinimum) {
      setErrorMsg(
        `الحد الأدنى لطلبات القرى هو ${minOrderVillages} ${currency} (متبقي ${minOrderVillages - itemSubtotal} ${currency}).`
      );
      return;
    }

    const resolvedAddress =
      deliveryMethod === 'store_pickup'
        ? `استلام مباشر من الفرع (${storeAddress})`
        : deliveryMethod === 'governorate_shipping'
          ? address.trim()
            ? `${selectedGovernorate} — ${address.trim()}`
            : ''
          : deliveryMethod === 'villages_scheduled'
            ? address.trim()
              ? `${selectedVillage} — ${address.trim()}`
              : ''
            : address.trim()
              ? selectedZone
                ? `${selectedZone} — ${address.trim()}`
                : address.trim()
              : '';

    if (!resolvedAddress) {
      setErrorMsg('اكتب العنوان أو الشارع بالتفصيل عشان المندوب يوصلك بسهولة');
      return;
    }

    const resolvedGovernorate =
      deliveryMethod === 'store_pickup'
        ? storeAddress
        : deliveryMethod === 'governorate_shipping'
          ? selectedGovernorate
          : deliveryMethod === 'villages_scheduled'
            ? `${cityName} - ${selectedVillage}`
            : `${cityName} - ${selectedZone}`;

    const metaEventId = `hfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: cleanName,
          customerPhone: phoneCheck.normalized,
          governorate: resolvedGovernorate,
          deliveryMethod,
          villageName: deliveryMethod === 'villages_scheduled' ? selectedVillage : undefined,
          deliveryBatchSlot:
            deliveryMethod === 'villages_scheduled' ? selectedBatchSlot : undefined,
          address: resolvedAddress,
          notes: workerNotes?.trim()
            ? `طلب سريع مباشر من صفحة المنتج • ${workerNotes.trim()}`
            : 'طلب سريع مباشر من صفحة المنتج',
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          couponCode:
            appliedDirectCoupon && couponValidation.isValid
              ? appliedDirectCoupon.code
              : undefined,
          items: orderItems,
          metaEventId,
          fbp: readBrowserCookie('_fbp'),
          fbc: readBrowserCookie('_fbc'),
          eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
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
              governorate: selectedGovernorate,
              deliveryMethod,
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
      trackPixelEvent(
        'Purchase',
        {
          value: createdOrder.total,
          currency: 'EGP',
          content_name: product.name,
          content_ids: orderItems.map((i) => i.productId),
          content_type: 'product',
          num_items: orderItems.reduce((s, i) => s + i.quantity, 0),
          order_number: createdOrder.orderNumber,
        },
        { eventID: createdOrder.metaEventId || metaEventId }
      );
      refreshStore();
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالشبكة، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPostPurchaseUpsell = async () => {
    if (!completedOrder || !postUpsellCandidate || upsellLoading) return;
    setUpsellLoading(true);
    setUpsellError(null);
    try {
      const res = await fetch('/api/orders/upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: completedOrder.id,
          orderNumber: completedOrder.orderNumber,
          customerPhone: completedOrder.customerPhone,
          metaEventId: completedOrder.metaEventId || '',
          productId: postUpsellCandidate.product.id,
          weightId: postUpsellCandidate.weight.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.order) {
        setUpsellError(data.error || 'تعذر إضافة العرض الإضافي حالياً');
        return;
      }
      setCompletedOrder(data.order);
      setUpsellSuccessName(
        `${postUpsellCandidate.product.name} (${postUpsellCandidate.weight.label})`
      );
      showToast(
        'تمت إضافة العرض على نفس الشحنة',
        `بدون أي مصاريف شحن إضافية • الإجمالي الجديد ${data.order.total} ${currency}`
      );
      refreshStore();
    } catch {
      setUpsellError('حدث خطأ في الاتصال، حاول مرة أخرى');
    } finally {
      setUpsellLoading(false);
    }
  };

  if (completedOrder) {
    const hubText = getFulfillmentHubLabel(completedOrder.fulfillmentHub);
    const itemsLines = completedOrder.items
      .map(
        (it) =>
          `• ${it.productName} (${it.weightLabel}${it.roastOption ? ` - ${it.roastOption}` : ''}) × ${it.quantity}`
      )
      .join('\n');
    const waText =
      `*تأكيد طلب مباشر — ${storeName}*\n` +
      `رقم الطلب: *#${completedOrder.orderNumber}*\n` +
      `العميل: ${completedOrder.customerName}\n` +
      `الموبايل: ${completedOrder.customerPhone}\n` +
      `الأصناف:\n${itemsLines}\n` +
      `العنوان: ${completedOrder.address}\n` +
      `مخزن التجهيز: ${hubText}\n` +
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
              جاري تجهيز طلبك من <span className="font-bold text-[#231710]">{hubText}</span> والتواصل معك فوراً لتأكيد التسليم.
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

        {/* Post-Purchase 1-Click Upsell (0 extra shipping) */}
        {upsellSuccessName && (
          <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-3 text-xs font-bold text-[#14532D] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
            <span>
              تمت إضافة {upsellSuccessName} على نفس كرتونتك بدون أي مصاريف شحن زيادة!
            </span>
          </div>
        )}

        {!completedOrder.upsellAdded && postUpsellCandidate && (
          <div className="rounded-2xl border-2 border-dashed border-[#D99B26] bg-[#FFFDF7] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <img
                src={getSafeImageUrl(postUpsellCandidate.product.image)}
                alt={postUpsellCandidate.product.name}
                className="w-14 h-14 rounded-xl object-cover border border-[#E8DFD3] shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  <span>عرض حصري لمرة واحدة قبل تقفيل كرتونتك</span>
                </span>
                <div className="font-cairo text-xs sm:text-sm font-extrabold text-[#261A13]">
                  ضيف {postUpsellCandidate.product.name} ({postUpsellCandidate.weight.label}) بخصم ١٥٪ بدون أي مصاريف شحن زيادة!
                </div>
                <div className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="line-through text-[#8A7968] font-bold">
                    {postUpsellCandidate.weight.price} {currency}
                  </span>
                  <span className="font-cairo font-black text-sm text-[#15803D]">
                    {postUpsellCandidate.upsellPrice} {currency} فقط
                  </span>
                </div>
              </div>
            </div>

            {upsellError && (
              <p className="text-[11px] font-bold text-[#B84A39]">{upsellError}</p>
            )}

            <button
              type="button"
              disabled={upsellLoading}
              onClick={handleAddPostPurchaseUpsell}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-cairo font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50 tabular-nums"
            >
              {upsellLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إضافته على طلبك...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-[#E5B869] text-[#E5B869]" />
                  <span>
                    ضيفه على طلبي دلوقتي (+{postUpsellCandidate.upsellPrice} {currency})
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <a
            href={waConfirmUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-cairo font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition"
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
            onClick={() => {
              setCompletedOrder(null);
              setUpsellSuccessName(null);
              setUpsellError(null);
            }}
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
      <div className="space-y-2.5 border-b border-[#F0EAE0] pb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#8C5828] bg-[#FBF3E4] border border-[#EBD8B8] px-2.5 py-0.5 rounded-full">
              <Zap className="w-3.5 h-3.5 fill-[#D99B26] text-[#9A6836]" />
              <span>طلب سريع في ١٠ ثواني — بدون تسجيل</span>
            </div>
            <h2 className="font-cairo text-base sm:text-lg font-extrabold text-[#261A13]">
              املأ بياناتك واستلم {product.name} لحد باب البيت
            </h2>
          </div>
          <span className="text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>الدفع عند الاستلام بعد المعاينة</span>
          </span>
        </div>

        {/* Real Operational Dispatch Cutoff */}
        <div className="flex items-center gap-2 rounded-xl bg-[#FAF7F2] border border-[#E8DFD3] px-3 py-2 text-[11px] font-bold text-[#5E4D40]">
          <Clock className="w-3.5 h-3.5 text-[#9A6836] shrink-0" />
          <span>{dispatchCutoffText}</span>
        </div>
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
              <span>الاسم *</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              value={customerName}
              onFocus={markInitiateCheckout}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اكتب اسمك (مثلاً: أحمد محمد)"
              className="w-full min-h-[46px] bg-[#FAF7F2] border border-[#E8DFD3] focus:border-[#9A6836] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#261A13] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#261A13] flex items-center gap-1 mb-1">
              <Phone className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>رقم الموبايل (للتأكيد والشحن) *</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              required
              value={customerPhone}
              onFocus={markInitiateCheckout}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="01012345678"
              className="w-full min-h-[46px] bg-[#FAF7F2] border border-[#E8DFD3] focus:border-[#9A6836] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-right text-[#261A13] tabular-nums focus:outline-none transition"
            />
          </div>
        </div>

        {/* 3-Mode Delivery Toggle (Always visible in store mode; collapsed cleanly in Ad Mode until clicked) */}
        {(!isAdMode || showLocalOptionsInAdMode) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setHasManualDeliverySelect(true);
                setDeliveryMethod('governorate_shipping');
              }}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-cairo flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                deliveryMethod === 'governorate_shipping'
                  ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                  : 'bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] hover:border-[#C88A4B] font-bold'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5 shrink-0" />
              <span>شحن لكل محافظات مصر</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHasManualDeliverySelect(true);
                setDeliveryMethod((prev) =>
                  prev === 'villages_scheduled' ? 'villages_scheduled' : 'bandar_fast'
                );
              }}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-cairo flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                deliveryMethod === 'bandar_fast' || deliveryMethod === 'villages_scheduled'
                  ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                  : 'bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] hover:border-[#C88A4B] font-bold'
              }`}
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span>توصيل فوري ({cityName})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHasManualDeliverySelect(true);
                setDeliveryMethod('store_pickup');
              }}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-cairo flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                deliveryMethod === 'store_pickup'
                  ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                  : 'bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] hover:border-[#C88A4B] font-bold'
              }`}
            >
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span>استلام من الفرع (٠ {currency})</span>
            </button>
          </div>
        )}

        {/* Option A: All-Egypt 27 Governorates Selector */}
        {deliveryMethod === 'governorate_shipping' && (
          <div className="space-y-2.5 bg-[#FAF7F2]/80 border border-[#E8DFD3] rounded-xl p-3">
            <div>
              <label className="text-xs font-bold text-[#261A13] flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-1">
                  <Globe2 className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span>المحافظة *</span>
                </span>
                <span className="text-[10px] font-bold text-[#15803D] inline-flex items-center gap-1">
                  <Warehouse className="w-3 h-3" />
                  <span>{getFulfillmentHubLabel(resolvedHub)}</span>
                </span>
              </label>
              <select
                value={selectedGovernorate}
                onChange={(e) => setSelectedGovernorate(e.target.value)}
                className="w-full min-h-[46px] bg-white border border-[#E8DFD3] focus:border-[#9A6836] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#261A13] focus:outline-none"
              >
                {governorateRates.map((rate) => (
                  <option key={rate.id} value={rate.governorate}>
                    {rate.governorate} — {rate.price} {currency} ({rate.estimatedDays})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#261A13] flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#9A6836]" />
                <span>العنوان بالتفصيل *</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الحي والشارع ورقم العمارة أو أقرب علامة مميزة"
                className="w-full min-h-[46px] bg-white border border-[#E8DFD3] focus:border-[#9A6836] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#261A13] focus:outline-none transition"
              />
            </div>

            {isAdMode && !showLocalOptionsInAdMode && (
              <button
                type="button"
                onClick={() => setShowLocalOptionsInAdMode(true)}
                className="text-[11px] font-bold text-[#9A6836] hover:text-[#261A13] underline decoration-dotted cursor-pointer"
              >
                من {cityName} وعايز توصيل فوري في ٣٠ دقيقة أو استلام من الفرع؟ اضغط هنا
              </button>
            )}
          </div>
        )}

        {/* Option B: Local Bani Mazar Fast Bandar OR Scheduled Villages */}
        {(deliveryMethod === 'bandar_fast' || deliveryMethod === 'villages_scheduled') && (
          <div className="space-y-2.5 bg-[#FAF7F2]/80 border border-[#E8DFD3] rounded-xl p-3">
            {featureFlags.enableVillageBatches && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('bandar_fast')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] transition cursor-pointer ${
                    deliveryMethod === 'bandar_fast'
                      ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                      : 'bg-white text-[#5E4D40] border border-[#E8DFD3] font-bold'
                  }`}
                >
                  بندر {cityName} (٣٠–٤٥ دقيقة • {settings?.bandarShippingCost ?? 20} {currency})
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('villages_scheduled')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] transition cursor-pointer ${
                    deliveryMethod === 'villages_scheduled'
                      ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                      : 'bg-white text-[#5E4D40] border border-[#E8DFD3] font-bold'
                  }`}
                >
                  دورية القرى ({settings?.villagesShippingCost ?? 25} {currency})
                </button>
              </div>
            )}

            {deliveryMethod === 'bandar_fast' && bandarZones.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <span className="text-[11px] font-bold text-[#6E5D4F] shrink-0">المنطقة:</span>
                {bandarZones.slice(0, 6).map((zone) => {
                  const active = selectedZone === zone;
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => setSelectedZone(zone)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition cursor-pointer ${
                        active
                          ? 'bg-[#FBF3E4] text-[#8C5828] border-[#D5A76C]'
                          : 'bg-white text-[#5E4D40] border-[#E8DFD3] hover:border-[#C88A4B]'
                      }`}
                    >
                      {zone}
                    </button>
                  );
                })}
              </div>
            )}

            {deliveryMethod === 'villages_scheduled' && (
              <div className="space-y-2">
                {isVillageBelowMinimum && (
                  <div className="bg-[#FDF2F0] border border-[#F2D6D0] text-[#B84A39] text-[11px] font-bold px-3 py-2 rounded-lg">
                    الحد الأدنى لدورية القرى هو {minOrderVillages} {currency} (متبقي{' '}
                    {minOrderVillages - itemSubtotal} {currency}).
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={selectedVillage}
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    className="w-full min-h-[40px] bg-white border border-[#E8DFD3] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#261A13]"
                  >
                    {villageZones.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedBatchSlot}
                    onChange={(e) => setSelectedBatchSlot(e.target.value)}
                    className="w-full min-h-[40px] bg-white border border-[#E8DFD3] rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#261A13]"
                  >
                    {deliveryBatches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
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
                placeholder="مثال: شارع بورسعيد، بجوار مسجد الزراعيين"
                className="w-full min-h-[44px] bg-white border border-[#E8DFD3] focus:border-[#9A6836] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#261A13] focus:outline-none transition"
              />
            </div>
          </div>
        )}

        {/* Optional 1-Click Order Bump */}
        {bumpCandidate && (
          <label
            className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition ${
              includeOrderBump
                ? 'bg-[#F4FBF6] border-[#3B6E4C]'
                : 'bg-[#FFFDF8] border-[#E5C896] hover:border-[#C88A4B]'
            }`}
          >
            <input
              type="checkbox"
              checked={includeOrderBump}
              onChange={(e) => setIncludeOrderBump(e.target.checked)}
              className="w-4 h-4 accent-[#3B6E4C] shrink-0"
            />
            <img
              src={getSafeImageUrl(bumpCandidate.product.image)}
              alt={bumpCandidate.product.name}
              className="w-11 h-11 rounded-lg object-cover border border-[#E8DFD3] shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#8C5828]">
                <Sparkles className="w-3 h-3 text-[#D99B26]" />
                <span>أضف مع طلبك بضغطة واحدة</span>
              </div>
              <div className="text-xs font-bold text-[#261A13] truncate">
                {bumpCandidate.product.name} ({bumpCandidate.weight.label})
              </div>
            </div>
            <span className="font-cairo font-extrabold text-xs text-[#3B6E4C] shrink-0 tabular-nums">
              +{bumpCandidate.weight.price} {currency}
            </span>
          </label>
        )}

        {/* Influencer / Promo Coupon Collapsible Strip */}
        <div className="space-y-1.5">
          {!showCouponBox && !appliedDirectCoupon ? (
            <button
              type="button"
              onClick={() => setShowCouponBox(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#9A6836] hover:text-[#261A13] transition cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>لديك كود خصم من الإعلان أو عرض خاص؟ اضغط هنا</span>
            </button>
          ) : (
            <div className="bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="اكتب كود الخصم هنا (مثال: HAFSA10)"
                  className="flex-1 min-h-[38px] bg-white border border-[#E8DFD3] focus:border-[#9A6836] rounded-lg px-3 py-1.5 text-xs font-bold uppercase text-[#261A13] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyDirectCoupon}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#2C1D14] hover:bg-[#3D291D] text-white text-xs font-cairo font-bold transition cursor-pointer"
                >
                  تطبيق
                </button>
                {appliedDirectCoupon && (
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedDirectCoupon(null);
                      setCouponInput('');
                      setCouponFeedback(null);
                    }}
                    className="text-[11px] font-bold text-[#B84A39] px-2 cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
              </div>
              {couponFeedback && (
                <p
                  className={`text-[11px] font-bold ${
                    couponFeedback.type === 'success' && couponValidation.isValid
                      ? 'text-[#3B6E4C]'
                      : 'text-[#B84A39]'
                  }`}
                >
                  {couponFeedback.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Payment Method Quick Pills (Clean COD default in Ad Mode) */}
        {(pageContent.enableInstapay !== false || pageContent.enableVodafoneCash !== false) && (
          <div className="space-y-2">
            {isAdMode && !showElectronicPaymentInAdMode && paymentMethod === 'cod' ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>طريقة الدفع: الدفع عند الاستلام بعد المعاينة</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowElectronicPaymentInAdMode(true)}
                  className="font-bold text-[#9A6836] hover:text-[#261A13] underline decoration-dotted cursor-pointer"
                >
                  أو الدفع عبر إنستا باي / فودافون كاش
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#6E5D4F]">طريقة الدفع:</span>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer ${
                    paymentMethod === 'cod'
                      ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                      : 'bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] font-bold'
                  }`}
                >
                  الدفع عند الاستلام
                </button>
                {pageContent.enableInstapay !== false && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('instapay')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer ${
                      paymentMethod === 'instapay'
                        ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                        : 'bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] font-bold'
                    }`}
                  >
                    إنستا باي
                  </button>
                )}
                {pageContent.enableVodafoneCash !== false && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('vodafone_cash')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer ${
                      paymentMethod === 'vodafone_cash'
                        ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold'
                        : 'bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] font-bold'
                    }`}
                  >
                    فودافون كاش
                  </button>
                )}
              </div>
            )}

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
          {orderItems.map((it) => (
            <div key={it.cartItemId} className="flex items-center justify-between text-[#5E4D40]">
              <span className="truncate pl-2">
                {it.productName} ({it.weightLabel}) × {it.quantity}
              </span>
              <span className="font-bold text-[#261A13] shrink-0">
                {it.unitPrice * it.quantity} {currency}
              </span>
            </div>
          ))}

          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-[#15803D] font-bold">
              <span>خصم الكوبون ({appliedDirectCoupon?.code})</span>
              <span>
                -{discountAmount} {currency}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-[#5E4D40]">
            <span className="flex items-center gap-1">
              <span>رسوم الشحن والتوصيل</span>
              {deliveryMethod === 'governorate_shipping' && selectedGovRate?.estimatedDays && (
                <span className="text-[10px] text-[#8A7968] inline-flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />({selectedGovRate.estimatedDays})
                </span>
              )}
            </span>
            {shippingCost === 0 ? (
              <span className="font-extrabold text-[#15803D]">مجاني</span>
            ) : (
              <span className="font-bold text-[#261A13]">
                {shippingCost} {currency}
              </span>
            )}
          </div>

          {remainingForFreeShipping > 0 && (
            <div className="text-[11px] text-[#9A6836] font-medium">
              باقي {remainingForFreeShipping} {currency} وتاخد شحن مجاني! (اختار الباقة الأكبر لتوفير الشحن)
            </div>
          )}

          <div className="pt-2 border-t border-[#E8DFD3] flex items-center justify-between">
            <span className="font-cairo font-extrabold text-sm text-[#261A13]">
              الإجمالي المطلوب عند الاستلام
            </span>
            <span className="font-cairo font-extrabold text-lg text-[#261A13]">
              {finalTotal}{' '}
              <span className="text-xs font-bold text-[#9A6836]">{currency}</span>
            </span>
          </div>

          {expectedCashback > 0 && !isAdMode && (
            <div className="text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-lg text-center">
              ستحصل تلقائياً على +{expectedCashback} {currency} كاش باك في محفظة VIP برقم موبايلك!
            </div>
          )}
        </div>

        {/* Isolated Emerald Green Submit CTA + Reassurance Microcopy + Subtle WhatsApp Alternative */}
        <div className="space-y-2.5">
          <button
            type="submit"
            disabled={!product.inStock || isSubmitting || isVillageBelowMinimum}
            className="w-full min-h-[54px] py-3.5 px-5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-cairo font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_10px_24px_-8px_rgba(21,128,61,0.5)] transition-all duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
          >
            {!product.inStock ? (
              <span>غير متوفر بالمخزون حالياً</span>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري تسجيل وتأكيد طلبك...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {paymentMethod === 'cod'
                    ? `أكد طلبك الآن — الدفع عند الاستلام • ${finalTotal} ${currency}`
                    : `أكد طلبك الآن • ${finalTotal} ${currency}`}
                </span>
              </>
            )}
          </button>

          <p className="text-center text-[11px] font-bold text-[#5E4D40] leading-relaxed">
            مش هتدفع مليم غير لما تستلم وتعاين طلبك بنفسك • هنكلمك نأكد العنوان قبل ما الشحنة تخرج
          </p>

          <a
            href={prefilledWhatsappOrderUrl}
            target="_blank"
            rel="noreferrer"
            className={`w-full min-h-[42px] py-2 px-4 rounded-xl border font-cairo font-bold text-xs flex items-center justify-center gap-2 transition ${
              isAdMode
                ? 'bg-white hover:bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3]'
                : 'bg-[#F1F7F3] hover:bg-[#E4F2E8] text-[#2B5A3C] border-[#CBE2D3]'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-[#15803D]" />
            <span>أو اطلب هذا المنتج عبر واتساب بضغطة واحدة</span>
          </a>
        </div>
      </form>
    </div>
  );
}
