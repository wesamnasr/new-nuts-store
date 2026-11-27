'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Star,
  ShieldCheck,
  Plus,
  Minus,
  CheckCircle2,
  Send,
  Loader2,
  AlertCircle,
  Truck,
  Sparkles,
  Flame,
} from 'lucide-react';
import {
  Product,
  Category,
  WeightVariant,
  RoastOption,
  ProductReview,
} from '@/types/store';
import { useStore } from '@/context/StoreContext';
import {
  getCurrencySymbol,
  getSafeImageUrl,
} from '@/lib/defaults';
import NutritionFactsCard from '@/components/product/NutritionFactsCard';
import ProductAutoSlideshow from '@/modules/catalog/ProductAutoSlideshow';
import ProductBundleCards from '@/modules/catalog/ProductBundleCards';
import {
  ProductComparisonCard,
  CustomerProofGallery,
  ProductFaqAccordion,
} from '@/modules/catalog/ProductConversionSections';
import DirectProductOrderForm from '@/modules/orders/DirectProductOrderForm';
import {
  updateUrlQueryParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';
import {
  getProductPriceForWeight,
  getResolvedProductWeights,
  isUnitProduct,
} from '@/lib/pricing';
import { getFreeShippingThresholdForMethod } from '@/lib/egypt-shipping';
import {
  getProductAdHeadline,
  getProductHighlights,
} from '@/lib/product-conversion-copy';

interface ProductDetailClientProps {
  initialProduct: Product;
  category?: Category;
  relatedProducts: Product[];
}

const RATING_LABELS: Record<number, string> = {
  1: 'سيء',
  2: 'مقبول',
  3: 'جيد',
  4: 'جيد جداً',
  5: 'ممتاز',
};

function pickDefaultLandingWeight(product: Product, weights: WeightVariant[]): WeightVariant {
  if (isUnitProduct(product)) {
    return weights[0];
  }
  const w1000 = weights.find((w) => (w.weightGrams || w.grams) === 1000);
  const w500 = weights.find((w) => (w.weightGrams || w.grams) === 500);
  const w250 = weights.find((w) => (w.weightGrams || w.grams) === 250);
  if (w1000 && w1000.price <= 750) return w1000;
  return w500 || w1000 || w250 || weights[1] || weights[0];
}

export default function ProductDetailClient({
  initialProduct,
  relatedProducts,
}: ProductDetailClientProps) {
  const { showToast, refreshStore, storeData, trackPixelEvent } = useStore();
  const currency = getCurrencySymbol(storeData?.settings);
  const directOrderNameRef = useRef<HTMLInputElement | null>(null);
  const trackedViewContentIdRef = useRef<string | null>(null);
  const [isOrderBoxVisible, setIsOrderBoxVisible] = useState<boolean>(false);

  const [product, setProduct] = useState<Product>(initialProduct);
  const unitMode = isUnitProduct(product);
  const showNutritionSection =
    !unitMode || Boolean(product.caloriesPer100g && product.caloriesPer100g > 0);
  const [reviews, setReviews] = useState<ProductReview[]>(
    initialProduct.reviews || []
  );
  const [averageRating, setAverageRating] = useState<number>(
    initialProduct.rating
  );
  const [reviewsCount, setReviewsCount] = useState<number>(
    (initialProduct.reviews || []).length
  );

  // Sync live product pricing, stock, gallery, and written reviews once client storeData hydrates
  useEffect(() => {
    if (!storeData?.products) return;
    const fresh = storeData.products.find((p) => p.id === initialProduct.id);
    if (!fresh) return;
    setProduct(fresh);
    const freshReviews = Array.isArray(fresh.reviews) ? fresh.reviews : [];
    setReviews(freshReviews);
    setReviewsCount(freshReviews.length);
    if (freshReviews.length > 0) {
      const avg =
        freshReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / freshReviews.length;
      setAverageRating(Math.round(avg * 10) / 10);
    } else {
      setAverageRating(fresh.rating || 5);
    }
  }, [storeData?.products, initialProduct.id]);

  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | undefined>(
    undefined
  );

  const availableWeights = useMemo(
    () => getResolvedProductWeights(product),
    [product]
  );

  const [selectedWeight, setSelectedWeight] = useState<WeightVariant>(() =>
    pickDefaultLandingWeight(initialProduct, getResolvedProductWeights(initialProduct))
  );
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>(
    initialProduct.roastOptions?.[0] || ''
  );

  const allGalleryImages = useMemo(() => {
    const base = getSafeImageUrl(product.image);
    const extras = (product.gallery || [])
      .filter((img) => Boolean(img && img.trim()))
      .map((img) => getSafeImageUrl(img));
    return [base, ...extras.filter((u) => u !== base)];
  }, [product.image, product.gallery]);

  // Hide floating sticky bar cleanly whenever #direct-order-box is visible on screen
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const el = document.getElementById('direct-order-box');
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setIsOrderBoxVisible(Boolean(entries[0]?.isIntersecting));
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useBrowserUrlSync((params) => {
    const wParam = params.get('weight');
    if (wParam) {
      let matchedW = availableWeights.find(
        (w) =>
          w.id === wParam ||
          String(w.weightGrams) === wParam ||
          String(w.grams) === wParam
      );
      if (!matchedW && (wParam === 'w-2000' || wParam === '2000') && !unitMode) {
        const p2000 = getProductPriceForWeight(product, 2000);
        if (p2000 > 0) {
          matchedW = {
            id: 'w-2000',
            label: '2 كجم (2000 جم)',
            weightGrams: 2000,
            grams: 2000,
            price: p2000,
          };
        }
      }
      if (matchedW) {
        setSelectedWeight(matchedW);
      }
    }

    const rParam = params.get('roast');
    if (rParam) {
      const matchedR = product.roastOptions.find((r) => r === rParam);
      if (matchedR) setSelectedRoast(matchedR);
    }

    const imgParam = params.get('img');
    if (imgParam !== null) {
      const idx = Number(imgParam);
      if (!Number.isNaN(idx) && idx >= 0) {
        setSelectedSlideIndex(idx);
      }
    }
  });

  const [quantity, setQuantity] = useState<number>(1);

  // Keep selectedWeight synced if admin updated variant prices live
  useEffect(() => {
    if (!availableWeights.length) return;
    const matched = availableWeights.find((w) => w.id === selectedWeight?.id);
    if (matched && matched.price !== selectedWeight.price) {
      setSelectedWeight(matched);
    }
  }, [availableWeights, selectedWeight]);

  // Fire Meta / TikTok ViewContent standard event once per product page load
  useEffect(() => {
    if (!product?.id || trackedViewContentIdRef.current === product.id) return;
    trackedViewContentIdRef.current = product.id;
    trackPixelEvent('ViewContent', {
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: selectedWeight?.price || product.weights?.[0]?.price || 0,
      currency: 'EGP',
    });
  }, [product?.id, product?.name, product?.weights, selectedWeight?.price, trackPixelEvent]);

  // Review Form States
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const starDistribution = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const rounded = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[rounded] = (counts[rounded] || 0) + 1;
    });
    const total = reviews.length || 1;
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars] || 0,
      percentage: Math.round(((counts[stars] || 0) / total) * 100),
    }));
  }, [reviews]);

  const scrollToDirectOrder = () => {
    const el = document.getElementById('direct-order-box');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        directOrderNameRef.current?.focus();
      }, 350);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!customerName.trim() || customerName.trim().length < 2) {
      setFormError('اسم العميل مطلوب ويجب أن يكون حرفين على الأقل');
      return;
    }
    if (!formRating || formRating < 1 || formRating > 5) {
      setFormError('التقييم يجب أن يكون رقماً بين 1 و 5 نجوم');
      return;
    }
    if (!comment.trim() || comment.trim().length < 3) {
      setFormError('التعليق مطلوب ويجب أن يحتوي على 3 أحرف على الأقل');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          customerName: customerName.trim(),
          rating: formRating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(
          data.error || 'فشل إرسال التقييم، يرجى المحاولة مرة أخرى'
        );
        return;
      }

      if (data.review) {
        setReviews((prev) => [data.review, ...prev]);
      }
      if (typeof data.rating === 'number') {
        setAverageRating(data.rating);
        setProduct((prev) => ({
          ...prev,
          rating: data.rating,
          reviewsCount: data.reviewsCount,
        }));
      }
      if (typeof data.reviewsCount === 'number') {
        setReviewsCount(data.reviewsCount);
      }

      setFormSuccess(
        'شكراً لك! تم إضافة تقييمك بنجاح وتحديث متوسط التقييم فورياً.'
      );
      setCustomerName('');
      setComment('');
      setFormRating(5);
      showToast('تم إضافة تقييمك بنجاح', 'شكراً لمشاركتنا رأيك في منتجاتنا');

      refreshStore();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ في الاتصال بالخادم';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const discountPercent =
    selectedWeight?.originalPrice &&
    selectedWeight.originalPrice > selectedWeight.price
      ? Math.round(
          ((selectedWeight.originalPrice - selectedWeight.price) /
            selectedWeight.originalPrice) *
            100
        )
      : null;

  const govFreeShippingThreshold = getFreeShippingThresholdForMethod(
    'governorate_shipping',
    storeData?.settings
  );
  const adHeadline = getProductAdHeadline(product);
  const highlightBullets = useMemo(() => getProductHighlights(product), [product]);

  return (
    <div className="bg-[#FAF7F2] min-h-screen pb-20 lg:pb-12">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-4 sm:space-y-6">
        {/* Main Single-Focus Conversion Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start">
          {/* Column 1: Multi-Image + Video Slideshow (5 cols, sticky on desktop) */}
          <div className="lg:col-span-5 lg:sticky lg:top-16 space-y-3">
            <ProductAutoSlideshow
              images={allGalleryImages}
              productName={product.name}
              discountPercent={discountPercent}
              badgeText={product.badge}
              originText={product.origin}
              videoUrl={product.videoUrl}
              videoPoster={product.videoPoster}
              selectedIndex={selectedSlideIndex}
              onSelectIndex={(idx) => {
                setSelectedSlideIndex(idx);
                updateUrlQueryParams({ img: idx });
              }}
            />
          </div>

          {/* Column 2: Product Choice + Direct Conversion Order Form (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-[#E8DFD3] p-3.5 sm:p-5 space-y-3.5 shadow-[0_6px_24px_-12px_rgba(35,23,16,0.07)]">
              {/* Rating & Live Availability */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {reviewsCount > 0 && (
                    <div className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-[#5E4D40] tabular-nums bg-[#FAF7F2] px-2.5 py-0.5 rounded-full border border-[#E8DFD3]">
                      <Star className="w-3.5 h-3.5 fill-[#D99B26] text-[#D99B26]" />
                      <span className="font-bold text-[#261A13]">
                        {averageRating.toFixed(1)}
                      </span>
                      <span>({reviewsCount} تقييم)</span>
                    </div>
                  )}
                  <span
                    className={`text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      product.inStock
                        ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                        : 'bg-[#FDF2F0] text-[#B84A39] border border-[#F2D6D0]'
                    }`}
                  >
                    {product.inStock ? 'متوفر طازج وجاهز للشحن النهارده' : 'نفدت الكمية مؤقتاً'}
                  </span>
                </div>

                <h1 className="font-cairo text-lg sm:text-2xl lg:text-[26px] font-extrabold text-[#261A13] leading-snug">
                  {adHeadline}
                </h1>
                {product.subtitle && (
                  <p className="text-[11px] sm:text-sm font-medium text-[#9A6836]">
                    {product.subtitle}
                  </p>
                )}
              </div>

              {/* 3 Compact Scannable Bullets */}
              <div className="grid grid-cols-1 gap-1.5">
                {highlightBullets.map((bullet, idx) => {
                  const IconComp =
                    bullet.icon === 'flame'
                      ? Flame
                      : bullet.icon === 'truck'
                        ? Truck
                        : bullet.icon === 'shield'
                          ? ShieldCheck
                          : Sparkles;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-xl bg-[#FAF7F2] border border-[#EDE5D9] px-2.5 py-2"
                    >
                      <span className="w-6 h-6 rounded-lg bg-white border border-[#E8DFD3] flex items-center justify-center shrink-0 mt-0.5">
                        <IconComp className="w-3.5 h-3.5 text-[#15803D]" />
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-cairo font-extrabold text-[#261A13]">
                          {bullet.title}
                        </div>
                        {bullet.subtitle && (
                          <div className="text-[10px] sm:text-[11px] text-[#5E4D40] leading-snug">
                            {bullet.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step 1: Visual Tiered Bundle Offer Cards */}
              <ProductBundleCards
                product={product}
                availableWeights={availableWeights}
                selectedWeight={selectedWeight}
                onSelectWeight={(w) => {
                  setSelectedWeight(w);
                  updateUrlQueryParams({ weight: w.id });
                }}
                currency={currency}
                freeShippingThreshold={govFreeShippingThreshold}
              />

              {/* Step 2: Compact Roast / Option Selector */}
              {product.roastOptions && product.roastOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#261A13] block">
                    {unitMode ? '٢. اختر النوع / النكهة:' : '٢. اختر درجة التحميص أو الطعم:'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {product.roastOptions.map((roast) => {
                      const isActive = selectedRoast === roast;
                      return (
                        <button
                          key={roast}
                          type="button"
                          onClick={() => {
                            setSelectedRoast(roast);
                            updateUrlQueryParams({ roast });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'bg-[#FFF9EE] text-[#261A13] border-2 border-[#9A6836] font-extrabold shadow-2xs'
                              : 'bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] hover:border-[#C88A4B] hover:bg-white font-medium'
                          }`}
                        >
                          {roast}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Stepper + Single Isolated Emerald Buy CTA */}
              <div className="pt-0.5 flex items-center gap-2">
                <div className="flex items-center justify-between border border-[#E8DFD3] rounded-xl bg-[#FAF7F2] p-0.5 min-h-[44px] w-26 sm:w-28 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 text-[#261A13] hover:bg-white rounded-lg transition cursor-pointer"
                    aria-label="تقليل الكمية"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-extrabold text-[#261A13] text-xs sm:text-sm tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2 text-[#261A13] hover:bg-white rounded-lg transition cursor-pointer"
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!product.inStock}
                  onClick={scrollToDirectOrder}
                  className="flex-1 min-h-[46px] sm:min-h-[50px] py-2.5 px-3 sm:px-4 rounded-xl font-cairo font-extrabold text-xs sm:text-sm bg-[#15803D] hover:bg-[#166534] text-white flex items-center justify-center gap-1.5 shadow-[0_8px_20px_-6px_rgba(21,128,61,0.45)] transition-all duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    اطلب الآن — الدفع عند الاستلام • {selectedWeight.price * quantity} {currency}
                  </span>
                </button>
              </div>
            </div>

            {/* Streamlined 4-Field Direct Order Form */}
            <DirectProductOrderForm
              product={product}
              selectedWeight={selectedWeight}
              selectedRoast={selectedRoast}
              quantity={quantity}
              relatedProducts={relatedProducts}
              nameInputRef={directOrderNameRef}
            />
          </div>
        </div>

        {/* High-Trust Conversion Sections */}
        <ProductComparisonCard product={product} />
        <CustomerProofGallery images={product.proofImages} productName={product.name} />
        <ProductFaqAccordion product={product} settings={storeData?.settings} />

        {/* Nutrition Facts Card */}
        {showNutritionSection && (
          <section id="nutrition">
            <NutritionFactsCard product={product} />
          </section>
        )}

        {/* Customer Reviews Section */}
        <section
          id="reviews"
          className="bg-white rounded-2xl border border-[#E8DFD3] p-3.5 sm:p-6 space-y-4"
        >
          <div className="border-b border-[#F0EAE0] pb-2.5">
            <h2 className="font-cairo text-sm sm:text-lg font-bold text-[#261A13]">
              تقييمات العملاء وتجارب الشراء
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#FAF7F2] p-3 sm:p-4 rounded-2xl border border-[#E8DFD3]">
            <div className="md:col-span-4 text-center md:border-l md:border-[#E8DFD3] md:pl-4 space-y-1">
              <div className="font-cairo text-2xl sm:text-3xl font-extrabold text-[#261A13] tabular-nums">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(averageRating)
                        ? 'fill-[#D99B26] text-[#D99B26]'
                        : 'text-[#D8CFC3]'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] font-medium text-[#6E5D4F] tabular-nums">
                استناداً إلى {reviewsCount} تقييماً
              </div>
            </div>

            <div className="md:col-span-8 space-y-1">
              {starDistribution.map((item) => (
                <div
                  key={item.stars}
                  className="flex items-center gap-2 text-[11px] tabular-nums"
                >
                  <span className="w-11 font-bold text-[#261A13] text-left">
                    {item.stars} نجوم
                  </span>
                  <div className="flex-1 h-2 bg-white border border-[#E8DFD3] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#9A6836] rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="w-6 text-[#6E5D4F] font-medium text-right">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 bg-[#FAF7F2] border border-[#E8DFD3] rounded-2xl p-3.5 sm:p-4 space-y-3 h-fit">
              <h3 className="font-cairo text-xs sm:text-sm font-bold text-[#261A13]">
                أضف تقييمك للمنتج
              </h3>

              {formError && (
                <div className="bg-[#FDF2F0] border border-[#F2D6D0] text-[#B84A39] text-xs font-bold p-2.5 rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-[#F1F7F3] border border-[#D4E6DA] text-[#3B6E4C] text-xs font-bold p-2.5 rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#3B6E4C] shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleReviewSubmit} className="space-y-2.5">
                <div>
                  <label className="text-xs font-bold text-[#261A13] block mb-1">
                    التقييم بالنجوم:
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const isFilled = starVal <= (hoverRating || formRating);
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setFormRating(starVal)}
                          onMouseEnter={() => setHoverRating(starVal)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-0.5 cursor-pointer transition-transform hover:scale-110"
                          title={`${starVal} نجوم`}
                        >
                          <Star
                            className={`w-4 h-4 transition-colors ${
                              isFilled
                                ? 'fill-[#D99B26] text-[#D99B26]'
                                : 'text-[#D8CFC3]'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="text-[11px] font-bold text-[#261A13] mr-2 bg-white px-2 py-0.5 rounded-lg border border-[#E8DFD3]">
                      {RATING_LABELS[hoverRating || formRating] || 'ممتاز'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#261A13] block mb-1">
                    اسمك:
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: أحمد عبد الله"
                    className="w-full px-3 py-2 bg-white border border-[#E8DFD3] focus:border-[#9A6836] rounded-xl text-xs font-medium text-[#261A13] focus:outline-none transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#261A13]">
                      رأيك وتجربتك:
                    </label>
                    <span className="text-[11px] text-[#6E5D4F] tabular-nums">
                      {comment.length} / 500
                    </span>
                  </div>
                  <textarea
                    required
                    rows={3}
                    maxLength={500}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="شاركنا رأيك في جودة المنتج والتغليف وسرعة التوصيل..."
                    className="w-full px-3 py-2 bg-white border border-[#E8DFD3] focus:border-[#9A6836] rounded-xl text-xs font-medium text-[#261A13] focus:outline-none transition resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 px-4 bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] rounded-xl font-cairo text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>إرسال التقييم</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-2.5">
              <h3 className="font-cairo text-xs sm:text-sm font-bold text-[#261A13]">
                قائمة التقييمات ({reviews.length})
              </h3>

              {reviews.length === 0 ? (
                <div className="text-center py-6 px-4 bg-[#FAF7F2] rounded-2xl border border-dashed border-[#E8DFD3] space-y-1">
                  <Star className="w-5 h-5 text-[#9A6836] mx-auto opacity-70" />
                  <p className="text-xs font-bold text-[#261A13]">
                    لا توجد تقييمات مكتوبة لهذا المنتج حتى الآن.
                  </p>
                  <p className="text-[11px] text-[#6E5D4F]">
                    كن أول من يشارك رأيه وتجربته مع هذا الصنف.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#E8DFD3] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-white border border-[#E8DFD3] text-[#9A6836] font-bold text-xs flex items-center justify-center">
                            {rev.customerName ? rev.customerName.trim()[0] : 'ع'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#261A13]">
                                {rev.customerName}
                              </span>
                              {rev.verified && (
                                <span className="text-[10px] text-[#3B6E4C] bg-[#F1F7F3] border border-[#D4E6DA] px-1.5 py-0.5 rounded-lg flex items-center gap-1 font-bold">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-[#3B6E4C]" />
                                  <span>مشتري موثق</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#6E5D4F]">
                              {rev.date}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                s <= rev.rating
                                  ? 'fill-[#D99B26] text-[#D99B26]'
                                  : 'text-[#D8CFC3]'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-[#5E4D40] leading-relaxed">
                        {rev.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Permanent Flush-Bottom Sticky Emerald CTA Bar (auto-hides while #direct-order-box is in view) */}
      {!isOrderBoxVisible && product.inStock && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E8DFD3] px-3 py-2 shadow-[0_-4px_16px_rgba(35,23,16,0.08)]">
          <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[#6E5D4F] truncate">
                {selectedWeight.label} × {quantity}
              </div>
              <div className="font-cairo text-xs font-black text-[#261A13] tabular-nums">
                {selectedWeight.price * quantity} {currency}
              </div>
            </div>
            <button
              type="button"
              onClick={scrollToDirectOrder}
              className="flex-1 max-w-[235px] min-h-[40px] bg-[#15803D] hover:bg-[#166534] text-white rounded-xl font-cairo text-xs font-extrabold flex items-center justify-center gap-1.5 px-3 py-1.5 shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>اطلب الآن — الدفع عند الاستلام</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
