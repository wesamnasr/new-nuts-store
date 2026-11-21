'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Star,
  ShieldCheck,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  ChevronLeft,
  Send,
  Loader2,
  AlertCircle,
  Truck,
  Zap,
  Sparkles,
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
  formatCategoryName,
  getCurrencySymbol,
  getSafeImageUrl,
} from '@/lib/defaults';
import ProductCard from '@/components/ProductCard';
import NutritionFactsCard from '@/components/product/NutritionFactsCard';
import ProductAutoSlideshow from '@/modules/catalog/ProductAutoSlideshow';
import DirectProductOrderForm from '@/modules/orders/DirectProductOrderForm';
import {
  updateUrlQueryParams,
  useBrowserUrlSync,
  buildUrlWithParams,
} from '@/lib/url-sync';
import { getResolvedProductWeights, isUnitProduct } from '@/lib/pricing';

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

export default function ProductDetailClient({
  initialProduct,
  category,
  relatedProducts,
}: ProductDetailClientProps) {
  const { addToCart, showToast, refreshStore, storeData, cartCount } = useStore();
  const currency = getCurrencySymbol(storeData?.settings);
  const directOrderNameRef = useRef<HTMLInputElement | null>(null);

  // Local state for product reviews and rating metrics
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
    initialProduct.reviewsCount
  );

  // Slideshow index state
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | undefined>(
    undefined
  );

  const availableWeights = useMemo(
    () => getResolvedProductWeights(product),
    [product]
  );

  // Variant selector states & Sub-section state synced with URL
  const [selectedWeight, setSelectedWeight] = useState<WeightVariant>(() => {
    const resolved = getResolvedProductWeights(initialProduct);
    return isUnitProduct(initialProduct)
      ? resolved[0]
      : resolved.find((w) => (w.grams || w.weightGrams) === 250) ||
          resolved[1] ||
          resolved[0];
  });
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>(
    initialProduct.roastOptions?.[0] || ''
  );
  const [activeSection, setActiveSection] = useState<
    'all' | 'nutrition' | 'reviews' | 'related'
  >('all');

  const allGalleryImages = useMemo(() => {
    const base = getSafeImageUrl(product.image);
    const extras = (product.gallery || [])
      .filter((img) => Boolean(img && img.trim()))
      .map((img) => getSafeImageUrl(img));
    return [base, ...extras.filter((u) => u !== base)];
  }, [product.image, product.gallery]);

  useBrowserUrlSync((params) => {
    const wParam = params.get('weight');
    if (wParam) {
      const matchedW = availableWeights.find(
        (w) =>
          w.id === wParam ||
          String(w.weightGrams) === wParam ||
          String(w.grams) === wParam
      );
      if (matchedW) setSelectedWeight(matchedW);
    }

    const rParam = params.get('roast');
    if (rParam) {
      const matchedR = product.roastOptions.find((r) => r === rParam);
      if (matchedR) setSelectedRoast(matchedR);
    }

    const imgParam = params.get('img');
    if (imgParam !== null) {
      const idx = Number(imgParam);
      if (!Number.isNaN(idx) && allGalleryImages[idx]) {
        setSelectedSlideIndex(idx);
      }
    }

    const secParam = params.get('section');
    if (
      secParam === 'nutrition' ||
      secParam === 'reviews' ||
      secParam === 'related'
    ) {
      setActiveSection(secParam);
    } else {
      setActiveSection('all');
    }
  });

  const [quantity, setQuantity] = useState<number>(1);
  const [workerNotes, setWorkerNotes] = useState<string>('');
  const [justAdded, setJustAdded] = useState<boolean>(false);

  // Review Form States
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Star Distribution Calculation
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

  const handleAddToCart = () => {
    if (!product.inStock) return;
    addToCart(
      product,
      selectedWeight,
      selectedRoast,
      quantity,
      workerNotes.trim() || undefined
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

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

  const baseWeight = availableWeights[0] || product.weights[0];
  const bulkSavingsEgp =
    !unitMode &&
    baseWeight &&
    selectedWeight &&
    selectedWeight.weightGrams > baseWeight.weightGrams
      ? Math.max(
          0,
          Math.round(
            (baseWeight.price / baseWeight.weightGrams) *
              selectedWeight.weightGrams -
              selectedWeight.price
          )
        )
      : 0;

  return (
    <div className="bg-[#FAF7F2] min-h-screen pb-24 lg:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-[#6E5D4F] overflow-x-auto no-scrollbar whitespace-nowrap">
          <Link href="/" className="hover:text-[#9A6836] transition shrink-0">
            الرئيسية
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 text-[#8A7968] shrink-0" />
          {category && (
            <>
              <Link
                href={`/shop?cat=${category.id}`}
                className="hover:text-[#9A6836] transition shrink-0"
              >
                {formatCategoryName(category.name)}
              </Link>
              <ChevronLeft className="w-3.5 h-3.5 text-[#8A7968] shrink-0" />
            </>
          )}
          <span className="text-[#261A13] font-bold truncate">
            {product.name}
          </span>
        </nav>

        {/* Main Ad-Landing & Product Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left/Right Column 1: Automatic Multi-Image Slideshow (5 cols, sticky on desktop) */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
            <ProductAutoSlideshow
              images={allGalleryImages}
              productName={product.name}
              discountPercent={discountPercent}
              badgeText={product.badge}
              originText={product.origin}
              selectedIndex={selectedSlideIndex}
              onSelectIndex={(idx) => {
                setSelectedSlideIndex(idx);
                updateUrlQueryParams({ img: idx });
              }}
            />

            {/* Quick Quality & Guarantee Strip Under Slideshow */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-[#E8DFD3] bg-white p-2.5 space-y-1 shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#9A6836] mx-auto" />
                <div className="text-[11px] font-bold text-[#261A13]">طازج يومياً</div>
                <div className="text-[10px] text-[#6E5D4F]">تعبئة عند الطلب</div>
              </div>
              <div className="rounded-xl border border-[#E8DFD3] bg-white p-2.5 space-y-1 shadow-2xs">
                <Truck className="w-4 h-4 text-[#9A6836] mx-auto" />
                <div className="text-[11px] font-bold text-[#261A13]">توصيل سريع</div>
                <div className="text-[10px] text-[#6E5D4F]">لباب البيت</div>
              </div>
              <div className="rounded-xl border border-[#E8DFD3] bg-white p-2.5 space-y-1 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-[#3B6E4C] mx-auto" />
                <div className="text-[11px] font-bold text-[#261A13]">ضمان الجودة</div>
                <div className="text-[10px] text-[#6E5D4F]">دفع عند الاستلام</div>
              </div>
            </div>
          </div>

          {/* Column 2: Product Choice + Instant Direct Order Box (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white rounded-2xl border border-[#E8DFD3] p-5 sm:p-6 space-y-5 shadow-[0_6px_24px_-12px_rgba(35,23,16,0.07)]">
              {/* Rating & Title */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {reviewsCount > 0 && (
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-[#5E4D40] tabular-nums bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E8DFD3]">
                      <Star className="w-3.5 h-3.5 fill-[#D99B26] text-[#D99B26]" />
                      <span className="font-bold text-[#261A13]">
                        {averageRating.toFixed(1)}
                      </span>
                      <span>({reviewsCount} تقييم)</span>
                    </div>
                  )}
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      product.inStock
                        ? 'bg-[#F1F7F3] text-[#3B6E4C] border border-[#D4E6DA]'
                        : 'bg-[#FDF2F0] text-[#B84A39] border border-[#F2D6D0]'
                    }`}
                  >
                    {product.inStock ? 'متوفر وجاهز للشحن الفوري' : 'نفدت الكمية مؤقتاً'}
                  </span>
                </div>

                <h1 className="font-cairo text-xl sm:text-2xl lg:text-[28px] font-extrabold text-[#261A13] leading-snug">
                  {product.name}
                </h1>
                {product.subtitle && (
                  <p className="text-xs sm:text-sm font-medium text-[#9A6836]">
                    {product.subtitle}
                  </p>
                )}
              </div>

              {/* Harmonious Price Banner */}
              <div className="bg-[#FAF7F2] border border-[#E8DFD3] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 tabular-nums">
                <div>
                  <span className="text-xs text-[#6E5D4F] font-bold block mb-1">
                    {unitMode
                      ? `سعر العبوة المحددة (${selectedWeight.label})`
                      : `سعر الوزن المحدد (${selectedWeight.label})`}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-cairo text-2xl sm:text-3xl font-black text-[#261A13]">
                      {selectedWeight.price}{' '}
                      <span className="text-base font-bold text-[#9A6836]">
                        {currency}
                      </span>
                    </span>
                    {selectedWeight.originalPrice &&
                      selectedWeight.originalPrice > selectedWeight.price && (
                        <span className="text-sm text-[#8A7968] line-through font-bold">
                          {selectedWeight.originalPrice} {currency}
                        </span>
                      )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {discountPercent && (
                    <span className="bg-[#B84A39] text-[#FAF7F2] text-xs font-extrabold px-3 py-1 rounded-full">
                      وفّر {discountPercent}%
                    </span>
                  )}
                  {bulkSavingsEgp > 0 && (
                    <span className="text-[11px] font-bold text-[#3B6E4C]">
                      توفير إضافي {bulkSavingsEgp} {currency} للحجم الأكبر
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="text-sm text-[#5E4D40] leading-relaxed">
                <p>{product.description}</p>
              </div>

              {/* Step 1: Interactive Weight / Unit Variant Selector (ALL Weights Preserved!) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-extrabold text-[#261A13]">
                    {unitMode
                      ? '١. اختر العبوة / العدد المطلوب:'
                      : '١. اختر الوزن / الكمية المطلوبة:'}
                  </label>
                  <span className="text-[11px] font-bold text-[#9A6836]">
                    متاح جميع الأوزان
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  {availableWeights.map((w) => {
                    const isSelected = selectedWeight.id === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setSelectedWeight(w);
                          updateUrlQueryParams({ weight: w.id });
                        }}
                        className={`py-2.5 px-2 rounded-xl border text-center transition-all duration-200 cursor-pointer tabular-nums ${
                          isSelected
                            ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14] shadow-xs'
                            : 'bg-[#FAF7F2] text-[#261A13] border-[#E8DFD3] hover:border-[#C88A4B] hover:bg-white'
                        }`}
                      >
                        <div className="text-xs font-extrabold">{w.label}</div>
                        <div
                          className={`text-xs font-bold mt-0.5 ${
                            isSelected ? 'text-[#E5B869]' : 'text-[#9A6836]'
                          }`}
                        >
                          {w.price} {currency}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Interactive Roast / Option Selector */}
              {product.roastOptions && product.roastOptions.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-extrabold text-[#261A13] block">
                    {unitMode ? '٢. اختر النوع / النكهة:' : '٢. اختر درجة التحميص / التجهيز:'}
                  </label>
                  <div className="flex flex-wrap gap-2">
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
                          className={`px-3.5 py-2 rounded-xl text-xs border transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14] font-bold'
                              : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3] hover:border-[#C88A4B] hover:bg-white font-medium'
                          }`}
                        >
                          {roast}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity + Worker Notes + Add-to-Cart / Instant Scroll Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-bold text-[#261A13] block">
                    الكمية (عدد الأكياس / العبوات):
                  </label>
                  <div className="flex items-center justify-between border border-[#E8DFD3] rounded-xl bg-[#FAF7F2] p-1 min-h-[44px]">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="p-2 text-[#261A13] hover:bg-white rounded-lg transition cursor-pointer"
                      aria-label="تقليل الكمية"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-4 font-extrabold text-[#261A13] text-sm tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="p-2 text-[#261A13] hover:bg-white rounded-lg transition cursor-pointer"
                      aria-label="زيادة الكمية"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-8 space-y-1.5">
                  <label className="text-xs font-bold text-[#261A13] block">
                    ملاحظة خاصة للتجهيز (اختياري):
                  </label>
                  <input
                    type="text"
                    value={workerNotes}
                    onChange={(e) => setWorkerNotes(e.target.value)}
                    placeholder={
                      unitMode
                        ? 'مثال: تغليف هدية / ملاحظة للتسليم...'
                        : 'مثال: تقسيم الوزن في كيسين / بدون ملح إضافي...'
                    }
                    className="w-full min-h-[44px] bg-[#FAF7F2] border border-[#E8DFD3] focus:border-[#9A6836] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#261A13] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Dual Action Row: Add to Cart (Multi-Product Shopping) + Jump to Instant Order */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  disabled={!product.inStock}
                  onClick={scrollToDirectOrder}
                  className="flex-1 min-h-[48px] py-3 px-4 rounded-xl font-cairo font-extrabold text-xs sm:text-sm bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] flex items-center justify-center gap-2 shadow-xs transition-all duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
                >
                  <Zap className="w-4 h-4 fill-[#E5B869] text-[#E5B869] shrink-0" />
                  <span>
                    اطلب مباشرة من الصفحة • {selectedWeight.price * quantity} {currency}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!product.inStock}
                  onClick={handleAddToCart}
                  className={`min-h-[48px] py-3 px-5 rounded-xl font-cairo font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all duration-200 active:scale-[0.99] cursor-pointer tabular-nums ${
                    !product.inStock
                      ? 'bg-[#F4EFE6] text-[#8A7968] border-[#E8DFD3] cursor-not-allowed'
                      : justAdded
                        ? 'bg-[#3B6E4C] text-white border-[#3B6E4C]'
                        : 'bg-[#FAF7F2] hover:bg-[#F3ECE2] text-[#261A13] border-[#D5C4AE]'
                  }`}
                >
                  {!product.inStock ? (
                    <span>غير متوفر حالياً</span>
                  ) : justAdded ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تمت الإضافة للسلة</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>أضف إلى السلة</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Embedded Self-Contained Direct Order Form (Ad Landing Conversion Engine!) */}
            <DirectProductOrderForm
              product={product}
              selectedWeight={selectedWeight}
              selectedRoast={selectedRoast}
              quantity={quantity}
              workerNotes={workerNotes}
              nameInputRef={directOrderNameRef}
            />
          </div>
        </div>

        {/* Sub-pages / Sections Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-white p-2 rounded-2xl border border-[#E8DFD3]">
          {[
            { id: 'all' as const, label: 'نظرة شاملة' },
            ...(showNutritionSection
              ? [{ id: 'nutrition' as const, label: 'القيمة الغذائية' }]
              : []),
            { id: 'reviews' as const, label: `تقييمات العملاء (${reviewsCount})` },
            ...(relatedProducts.length > 0
              ? [{ id: 'related' as const, label: 'أصناف مشابهة' }]
              : []),
          ].map((tab) => {
            const isActive = activeSection === tab.id;
            const tabHref = buildUrlWithParams(
              `/product/${product.slug || product.id}`,
              {
                weight: selectedWeight.id,
                roast: selectedRoast,
                section: tab.id === 'all' ? null : tab.id,
              }
            );
            return (
              <a
                key={tab.id}
                href={tabHref}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection(tab.id);
                  updateUrlQueryParams({
                    section: tab.id === 'all' ? null : tab.id,
                  });
                }}
                className={`px-4 py-2 rounded-xl text-xs font-cairo font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-[#2C1D14] text-[#FAF7F2]'
                    : 'bg-[#FAF7F2] text-[#5E4D40] hover:text-[#261A13]'
                }`}
              >
                {tab.label}
              </a>
            );
          })}
        </div>

        {/* Luxury Nutrition Facts Card Section */}
        {showNutritionSection &&
          (activeSection === 'all' || activeSection === 'nutrition') && (
            <section id="nutrition" className="pt-1">
              <NutritionFactsCard product={product} />
            </section>
          )}

        {/* Customer Reviews Section */}
        {(activeSection === 'all' || activeSection === 'reviews') && (
          <section
            id="reviews"
            className="bg-white rounded-2xl border border-[#E8DFD3] p-5 sm:p-6 space-y-5"
          >
            <div className="border-b border-[#F0EAE0] pb-3">
              <h2 className="font-cairo text-base sm:text-lg font-bold text-[#261A13]">
                تقييمات العملاء وتجارب الشراء
              </h2>
            </div>

            {/* Reviews Summary & Distribution Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DFD3]">
              <div className="md:col-span-4 text-center md:border-l md:border-[#E8DFD3] md:pl-4 space-y-1.5">
                <div className="font-cairo text-3xl font-extrabold text-[#261A13] tabular-nums">
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
                <div className="text-xs font-medium text-[#6E5D4F] tabular-nums">
                  استناداً إلى {reviewsCount} تقييماً
                </div>
              </div>

              <div className="md:col-span-8 space-y-1.5">
                {starDistribution.map((item) => (
                  <div
                    key={item.stars}
                    className="flex items-center gap-2.5 text-xs tabular-nums"
                  >
                    <span className="w-12 font-bold text-[#261A13] text-left">
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

            {/* Review Submission Form & Existing Reviews Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 bg-[#FAF7F2] border border-[#E8DFD3] rounded-2xl p-4 sm:p-5 space-y-3.5 h-fit">
                <div>
                  <h3 className="font-cairo text-sm font-bold text-[#261A13]">
                    أضف تقييمك للمنتج
                  </h3>
                </div>

                {formError && (
                  <div className="bg-[#FDF2F0] border border-[#F2D6D0] text-[#B84A39] text-xs font-bold p-3 rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="bg-[#F1F7F3] border border-[#D4E6DA] text-[#3B6E4C] text-xs font-bold p-3 rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#3B6E4C] shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#261A13] block mb-1.5">
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
                      <span className="text-xs font-bold text-[#261A13] mr-2 bg-white px-2.5 py-0.5 rounded-lg border border-[#E8DFD3]">
                        {RATING_LABELS[hoverRating || formRating] || 'ممتاز'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#261A13] block mb-1">
                      اسمك الكريم:
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
                      <span className="text-xs text-[#6E5D4F] tabular-nums">
                        {comment.length} / 500 حرف
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
                    className="w-full py-2.5 px-4 bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] rounded-xl font-cairo text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري إرسال تقييمك...</span>
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

              <div className="lg:col-span-7 space-y-3">
                <h3 className="font-cairo text-sm font-bold text-[#261A13]">
                  قائمة التقييمات ({reviews.length})
                </h3>

                {reviews.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-[#FAF7F2] rounded-2xl border border-dashed border-[#E8DFD3] space-y-1.5">
                    <Star className="w-6 h-6 text-[#9A6836] mx-auto opacity-70" />
                    <p className="text-xs font-bold text-[#261A13]">
                      لا توجد تقييمات مكتوبة لهذا المنتج حتى الآن.
                    </p>
                    <p className="text-xs text-[#6E5D4F]">
                      كن أول من يشارك رأيه وتجربته مع هذا الصنف.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E8DFD3] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white border border-[#E8DFD3] text-[#9A6836] font-bold text-xs flex items-center justify-center">
                              {rev.customerName ? rev.customerName.trim()[0] : 'ع'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#261A13]">
                                  {rev.customerName}
                                </span>
                                {rev.verified && (
                                  <span className="text-xs text-[#3B6E4C] bg-[#F1F7F3] border border-[#D4E6DA] px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-[#3B6E4C]" />
                                    <span>مشتري موثق</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-[#6E5D4F]">
                                {rev.date}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= rev.rating
                                    ? 'fill-[#D99B26] text-[#D99B26]'
                                    : 'text-[#D8CFC3]'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-[#5E4D40] leading-relaxed pt-0.5">
                          {rev.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Smart Cross-Sell Recommendation */}
        {relatedProducts.length > 0 &&
          (activeSection === 'all' || activeSection === 'related') && (
            <section id="related" className="space-y-4 pt-2">
              <div className="text-center space-y-1">
                <h2 className="font-cairo text-xl sm:text-2xl font-extrabold text-[#261A13]">
                  أصناف مشابهة قد تعجبك
                </h2>
                <div className="w-14 h-1 bg-gradient-to-r from-[#9A6836] to-[#E5B869] rounded-full mx-auto" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5 pt-2">
                {relatedProducts.map((relProduct) => (
                  <ProductCard key={relProduct.id} product={relProduct} />
                ))}
              </div>
            </section>
          )}
      </div>

      {/* Mobile Ad-Landing Quick-Order Floating Bar (Only when cart is empty so StickyCartBar stays uncluttered) */}
      {cartCount === 0 && product.inStock && (
        <div className="lg:hidden fixed bottom-[58px] inset-x-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E8DFD3] px-3 py-2 shadow-[0_-4px_16px_rgba(35,23,16,0.06)]">
          <div className="flex items-center justify-between gap-2.5 max-w-lg mx-auto">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#6E5D4F] truncate">
                {selectedWeight.label} × {quantity}
              </div>
              <div className="font-cairo text-sm font-black text-[#261A13] tabular-nums">
                {selectedWeight.price * quantity} {currency}
              </div>
            </div>
            <button
              type="button"
              onClick={scrollToDirectOrder}
              className="flex-1 max-w-[230px] min-h-[42px] bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] rounded-xl font-cairo text-xs font-extrabold flex items-center justify-center gap-1.5 px-3 py-2 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-[#E5B869] text-[#E5B869] shrink-0" />
              <span>اطلب الآن مباشرة</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
