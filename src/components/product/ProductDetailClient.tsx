'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Star,
  Flame,
  ShieldCheck,
  MapPin,
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
} from 'lucide-react';
import {
  Product,
  Category,
  WeightVariant,
  RoastOption,
  ProductReview,
} from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { formatCategoryName, getSafeImageUrl } from '@/lib/defaults';
import ProductCard from '@/components/ProductCard';
import NutritionFactsCard from '@/components/product/NutritionFactsCard';
import { updateUrlQueryParams, useBrowserUrlSync, buildUrlWithParams } from '@/lib/url-sync';
import { getResolvedProductWeights } from '@/lib/pricing';

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
  const router = useRouter();
  const { addToCart, showToast, refreshStore } = useStore();

  // Local state for product reviews and rating metrics
  const [product, setProduct] = useState<Product>(initialProduct);
  const [reviews, setReviews] = useState<ProductReview[]>(
    initialProduct.reviews || []
  );
  const [averageRating, setAverageRating] = useState<number>(
    initialProduct.rating
  );
  const [reviewsCount, setReviewsCount] = useState<number>(
    initialProduct.reviewsCount
  );

  // Gallery state
  const [selectedImage, setSelectedImage] = useState<string>(
    getSafeImageUrl(initialProduct.image)
  );

  const availableWeights = useMemo(() => getResolvedProductWeights(product), [product]);

  // Variant selector states & Sub-section state synced with URL
  const [selectedWeight, setSelectedWeight] = useState<WeightVariant>(
    initialProduct.weights[1] || initialProduct.weights[0]
  );
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>(
    initialProduct.roastOptions[0] || 'محمص مملح'
  );
  const [activeSection, setActiveSection] = useState<'all' | 'nutrition' | 'reviews' | 'related'>('all');

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
        (w) => w.id === wParam || String(w.weightGrams) === wParam || String(w.grams) === wParam
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
        setSelectedImage(allGalleryImages[idx]);
      }
    }

    const secParam = params.get('section');
    if (secParam === 'nutrition' || secParam === 'reviews' || secParam === 'related') {
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
    addToCart(product, selectedWeight, selectedRoast, quantity, workerNotes.trim() || undefined);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleFastCheckout = () => {
    if (!product.inStock) return;
    addToCart(product, selectedWeight, selectedRoast, quantity, workerNotes.trim() || undefined);
    showToast(
      `جاري الانتقال لإتمام الطلب فورياً`,
      `${selectedWeight.label} • ${selectedRoast}`
    );
    router.push('/checkout');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Client-side quick checks
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

      // Optimistic / Immediate State Update without page refresh!
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

      // Refresh global store context in background
      refreshStore();
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ في الاتصال بالخادم');
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
    baseWeight && selectedWeight && selectedWeight.weightGrams > baseWeight.weightGrams
      ? Math.max(
          0,
          Math.round(
            (baseWeight.price / baseWeight.weightGrams) * selectedWeight.weightGrams -
              selectedWeight.price
          )
        )
      : 0;

  const servingHint =
    !selectedWeight || selectedWeight.weightGrams <= 300
      ? 'يكفي ٢-٣ أشخاص (حجم شخصي / تجريبي)'
      : selectedWeight.weightGrams <= 600
      ? 'حجم عائلي مثالي (٤-٦ أشخاص) • الأكثر طلباً'
      : selectedWeight.weightGrams <= 1200
      ? 'حجم ضيافة وتوفير (٨-١٢ شخص)'
      : 'حجم توفير عائلي ضخم (٢ كجم) • مناسب للحفلات والولائم';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs font-medium text-[#6E5D4F] overflow-x-auto no-scrollbar whitespace-nowrap">
        <Link href="/" className="hover:text-[#231710] transition shrink-0">
          الرئيسية
        </Link>
        <ChevronLeft className="w-3.5 h-3.5 text-[#8A7968] shrink-0" />
        {category && (
          <>
            <Link
              href={`/shop?cat=${category.id}`}
              className="hover:text-[#231710] transition shrink-0"
            >
              {formatCategoryName(category.name)}
            </Link>
            <ChevronLeft className="w-3.5 h-3.5 text-[#8A7968] shrink-0" />
          </>
        )}
        <span className="text-[#231710] font-bold truncate">
          {product.name}
        </span>
      </nav>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Product Image Gallery Column (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="relative rounded-2xl overflow-hidden bg-[#FAF6F0] border border-[#E8E0D5] aspect-[4/3] group">
            <img
              src={getSafeImageUrl(selectedImage || product.image)}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            {discountPercent && (
              <span className="absolute top-3 right-3 bg-[#B83B2B] text-white text-xs font-bold px-2.5 py-0.5 rounded-lg tabular-nums">
                -{discountPercent}%
              </span>
            )}
            <span className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs text-[#231710] border border-[#E8E0D5] text-xs font-medium px-2.5 py-1 rounded-xl flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#9A6836]" />
              {product.origin}
            </span>
          </div>

          {/* Optional Gallery Thumbnails */}
          {product.gallery && product.gallery.filter((img) => Boolean(img && img.trim())).length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(getSafeImageUrl(product.image));
                  updateUrlQueryParams({ img: 0 });
                }}
                className={`w-12 h-12 rounded-xl overflow-hidden border transition shrink-0 cursor-pointer ${
                  selectedImage === getSafeImageUrl(product.image)
                    ? 'border-[#231710]'
                    : 'border-[#E8E0D5] opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={getSafeImageUrl(product.image)}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </button>
              {product.gallery.filter((img) => Boolean(img && img.trim())).map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedImage(imgUrl);
                    updateUrlQueryParams({ img: idx + 1 });
                  }}
                  className={`w-12 h-12 rounded-xl overflow-hidden border transition shrink-0 cursor-pointer ${
                    selectedImage === imgUrl
                      ? 'border-[#231710]'
                      : 'border-[#E8E0D5] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getSafeImageUrl(imgUrl)}
                    alt={`${product.name} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Purchase Column (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E8E0D5] p-5 sm:p-6 space-y-5">
          <div>
            {reviewsCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <div className="inline-flex items-center gap-1 text-xs font-medium text-[#5C4A3D] tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                  <span className="font-bold text-[#231710]">{averageRating.toFixed(1)}</span>
                  <span>({reviewsCount} تقييم)</span>
                </div>
              </div>
            )}

            <h1 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710] leading-snug">
              {product.name}
            </h1>
          </div>

          {/* Price Display */}
          <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-2xl p-4 flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
            <div>
              <span className="text-xs text-[#6E5D4F] font-medium block mb-1">
                السعر للوزن المحدد ({selectedWeight.label})
              </span>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-cairo text-2xl font-bold text-[#231710]">
                  {selectedWeight.price}
                </span>
                <span className="text-xs font-medium text-[#5C4A3D]">
                  ج.م
                </span>
                {selectedWeight.originalPrice &&
                  selectedWeight.originalPrice > selectedWeight.price && (
                    <span className="text-xs text-[#8A7968] line-through mr-1">
                      {selectedWeight.originalPrice} ج.م
                    </span>
                  )}
              </div>
            </div>
            {discountPercent && (
              <span className="bg-[#B83B2B] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                خصم {discountPercent}%
              </span>
            )}
          </div>

          {/* Description */}
          <div className="text-sm text-[#5C4A3D] leading-relaxed">
            <p>{product.description}</p>
          </div>

          {/* Interactive Weight Variant Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#231710] block">
              اختر الوزن المطلوب:
            </label>
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
                    className={`py-2.5 px-2 rounded-xl border text-center transition cursor-pointer tabular-nums ${
                      isSelected
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:border-[#231710]/30'
                    }`}
                  >
                    <div className="text-xs font-bold">{w.label}</div>
                    <div
                      className={`text-xs font-medium mt-0.5 ${
                        isSelected ? 'text-[#E8E0D5]' : 'text-[#6E5D4F]'
                      }`}
                    >
                      {w.price} ج.م
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Roast Option Selector */}
          {product.roastOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#231710] block">
                درجة التحميص / الطحنة:
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
                      className={`px-3.5 py-2 rounded-xl text-xs border transition cursor-pointer ${
                        isActive
                          ? 'bg-[#231710] text-[#FAF6F0] border-[#231710] font-bold'
                          : 'bg-white text-[#5C4A3D] border-[#E8E0D5] hover:bg-[#FAF6F0] font-medium'
                      }`}
                    >
                      {roast}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Worker Notes Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#231710] block">
              ملاحظات التجهيز (اختياري):
            </label>
            <input
              type="text"
              value={workerNotes}
              onChange={(e) => setWorkerNotes(e.target.value)}
              placeholder="مثال: طحنة ناعمة / تقسيم الوزن في كيسين..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#231710] focus:outline-none transition"
            />
          </div>

          {/* Quantity & Dual Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex items-center justify-between border border-[#E8E0D5] rounded-xl bg-[#FAF6F0] p-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="p-2 text-[#231710] hover:bg-white rounded-lg transition cursor-pointer"
                aria-label="تقليل الكمية"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-4 font-bold text-[#231710] text-sm tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="p-2 text-[#231710] hover:bg-white rounded-lg transition cursor-pointer"
                aria-label="زيادة الكمية"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              disabled={!product.inStock}
              onClick={handleAddToCart}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer tabular-nums ${
                !product.inStock
                  ? 'bg-[#F4EFE6] text-[#8A7968] cursor-not-allowed'
                  : justAdded
                  ? 'bg-[#3B6E4C] text-white'
                  : 'bg-[#231710] hover:bg-[#362419] text-[#FAF6F0]'
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
                  <span>
                    أضف للسلة • {selectedWeight.price * quantity} ج.م
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={!product.inStock}
              onClick={handleFastCheckout}
              className="py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-[#FAF6F0] text-[#231710] border border-[#231710] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>شراء فوري</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-pages / Sections Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-white p-2 rounded-2xl border border-[#E8E0D5]">
        {[
          { id: 'all' as const, label: 'نظرة شاملة' },
          { id: 'nutrition' as const, label: 'القيمة الغذائية' },
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
                  ? 'bg-[#231710] text-[#FAF6F0]'
                  : 'bg-[#FAF6F0] text-[#5C4A3D] hover:text-[#231710]'
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Luxury Nutrition Facts Card Section */}
      {(activeSection === 'all' || activeSection === 'nutrition') && (
        <section id="nutrition" className="pt-1">
          <NutritionFactsCard product={product} />
        </section>
      )}

      {/* Customer Reviews Section */}
      {(activeSection === 'all' || activeSection === 'reviews') && (
      <section id="reviews" className="bg-white rounded-2xl border border-[#E8E0D5] p-5 sm:p-6 space-y-5">
        <div className="border-b border-[#F0EAE0] pb-3">
          <h2 className="font-cairo text-base sm:text-lg font-bold text-[#231710]">
            تقييمات العملاء
          </h2>
        </div>

        {/* Reviews Summary & Distribution Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-[#FAF6F0] p-4 rounded-2xl border border-[#E8E0D5]">
          {/* Big Score Box (4 cols) */}
          <div className="md:col-span-4 text-center md:border-l md:border-[#E8E0D5] md:pl-4 space-y-1.5">
            <div className="font-cairo text-3xl font-bold text-[#231710] tabular-nums">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= Math.round(averageRating)
                      ? 'fill-[#9A6836] text-[#9A6836]'
                      : 'text-[#D8CFC3]'
                  }`}
                />
              ))}
            </div>
            <div className="text-xs font-medium text-[#6E5D4F] tabular-nums">
              استناداً إلى {reviewsCount} تقييماً
            </div>
          </div>

          {/* Distribution Bars (8 cols) */}
          <div className="md:col-span-8 space-y-1.5">
            {starDistribution.map((item) => (
              <div key={item.stars} className="flex items-center gap-2.5 text-xs tabular-nums">
                <span className="w-12 font-bold text-[#231710] text-left">
                  {item.stars} نجوم
                </span>
                <div className="flex-1 h-2 bg-white border border-[#E8E0D5] rounded-full overflow-hidden">
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
          {/* Review Submission Form Column (5 cols) */}
          <div className="lg:col-span-5 bg-[#FAF6F0] border border-[#E8E0D5] rounded-2xl p-4 sm:p-5 space-y-3.5 h-fit">
            <div>
              <h3 className="font-cairo text-sm font-bold text-[#231710]">أضف تقييمك</h3>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-[#B83B2B] text-xs font-bold p-3 rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-[#3B6E4C] text-xs font-bold p-3 rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#3B6E4C] shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleReviewSubmit} className="space-y-3">
              {/* Star Rating Picker */}
              <div>
                <label className="text-xs font-bold text-[#231710] block mb-1.5">
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
                              ? 'fill-[#9A6836] text-[#9A6836]'
                              : 'text-[#D8CFC3]'
                          }`}
                        />
                      </button>
                    );
                  })}
                  <span className="text-xs font-bold text-[#231710] mr-2 bg-white px-2.5 py-0.5 rounded-lg border border-[#E8E0D5]">
                    {RATING_LABELS[hoverRating || formRating] || 'ممتاز'}
                  </span>
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="text-xs font-bold text-[#231710] block mb-1">
                  اسمك الكريم:
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full px-3 py-2 bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl text-xs font-medium text-[#231710] focus:outline-none transition"
                />
              </div>

              {/* Comment Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#231710]">
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
                  placeholder="ما رأيك في القرمشة والتحميص وجودة التغليف؟"
                  className="w-full px-3 py-2 bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl text-xs font-medium text-[#231710] focus:outline-none transition resize-none leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] rounded-xl font-cairo text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
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

          {/* Customer Reviews List Column (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <h3 className="font-cairo text-sm font-bold text-[#231710]">
              قائمة التقييمات ({reviews.length})
            </h3>

            {reviews.length === 0 ? (
              <div className="text-center py-8 px-4 bg-[#FAF6F0] rounded-2xl border border-dashed border-[#E8E0D5] space-y-1.5">
                <Star className="w-6 h-6 text-[#9A6836] mx-auto opacity-60" />
                <p className="text-xs font-bold text-[#231710]">
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
                    className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {/* Name Avatar */}
                        <div className="w-8 h-8 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] font-bold text-xs flex items-center justify-center">
                          {rev.customerName ? rev.customerName.trim()[0] : 'ع'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#231710]">
                              {rev.customerName}
                            </span>
                            {rev.verified && (
                              <span className="text-xs text-[#3B6E4C] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold">
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

                      {/* Stars */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating
                                ? 'fill-[#9A6836] text-[#9A6836]'
                                : 'text-[#D8CFC3]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-[#5C4A3D] leading-relaxed pt-0.5">
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
      {relatedProducts.length > 0 && (activeSection === 'all' || activeSection === 'related') && (
        <section id="related" className="space-y-4 pt-2">
          <div className="border-b border-[#E8E0D5] pb-3">
            <h2 className="font-cairo text-base sm:text-lg font-bold text-[#231710]">
              أصناف مشابهة قد تعجبك
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {relatedProducts.map((relProduct) => (
              <ProductCard key={relProduct.id} product={relProduct} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
