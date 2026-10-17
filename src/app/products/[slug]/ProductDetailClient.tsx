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
  Sparkles,
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
import { getSafeImageUrl } from '@/lib/defaults';
import ProductCard from '@/components/ProductCard';
import NutritionFactsCard from '@/components/product/NutritionFactsCard';

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

  // Variant selector states
  const [selectedWeight, setSelectedWeight] = useState<WeightVariant>(
    initialProduct.weights[1] || initialProduct.weights[0]
  );
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>(
    initialProduct.roastOptions[0] || 'محمص مملح'
  );
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
    showToast(
      `تمت إضافة "${product.name}" إلى السلة`,
      `${selectedWeight.label} • ${selectedRoast} (${quantity})`
    );
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

  const baseWeight = product.weights[0];
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
      : 'حجم ضيافة وتوفير (٨-١٢ شخص)';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 overflow-x-auto no-scrollbar whitespace-nowrap">
        <Link href="/" className="hover:text-brand-950 transition shrink-0">
          الرئيسية
        </Link>
        <ChevronLeft className="w-3 h-3 text-brand-400 shrink-0" />
        {category && (
          <>
            <Link
              href={`/?category=${category.id}`}
              className="hover:text-brand-950 transition shrink-0"
            >
              {category.name}
            </Link>
            <ChevronLeft className="w-3 h-3 text-brand-400 shrink-0" />
          </>
        )}
        <span className="text-brand-950 font-bold truncate">
          {product.name}
        </span>
      </nav>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Product Image Gallery Column (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="relative rounded-xl overflow-hidden bg-brand-100 border border-brand-200/80 shadow-xs h-56 sm:h-64 group">
            <img
              src={getSafeImageUrl(selectedImage || product.image)}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {product.badge && (
              <span className="absolute top-2.5 right-2.5 bg-brand-950/90 backdrop-blur-sm text-gold-400 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                {product.badge}
              </span>
            )}
            <span className="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur-sm text-brand-950 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-brand-600" />
              {product.origin}
            </span>
          </div>

          {/* Optional Gallery Thumbnails */}
          {product.gallery && product.gallery.filter((img) => Boolean(img && img.trim())).length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedImage(getSafeImageUrl(product.image))}
                className={`w-10 h-10 rounded-lg overflow-hidden border transition shrink-0 ${
                  selectedImage === getSafeImageUrl(product.image)
                    ? 'border-brand-900 shadow-2xs scale-105'
                    : 'border-brand-200 hover:border-brand-400 opacity-70 hover:opacity-100'
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
                  onClick={() => setSelectedImage(imgUrl)}
                  className={`w-10 h-10 rounded-lg overflow-hidden border transition shrink-0 ${
                    selectedImage === imgUrl
                      ? 'border-brand-900 shadow-2xs scale-105'
                      : 'border-brand-200 hover:border-brand-400 opacity-70 hover:opacity-100'
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
        <div className="lg:col-span-7 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <Star className="w-2.5 h-2.5 fill-gold-400 text-gold-400" />
                <span>{averageRating.toFixed(1)}</span>
                <span className="text-amber-700 text-[9.5px]">
                  ({reviewsCount} تقييم)
                </span>
              </div>
              <span className="text-[10px] text-brand-600 font-medium">
                كود المنتج: {product.id}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold text-brand-950 leading-tight">
              {product.name}
            </h1>
            <p className="text-[11px] sm:text-xs text-brand-700 font-medium mt-0.5">
              {product.subtitle}
            </p>
          </div>

          {/* Price Display */}
          <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-[10px] text-brand-600 font-bold block mb-0.5">
                السعر للوزن المحدد ({selectedWeight.label}):
              </span>
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-extrabold text-brand-950">
                  {selectedWeight.price}
                </span>
                <span className="text-[11px] font-bold text-brand-800">
                  جنيه مصري
                </span>
                {selectedWeight.originalPrice &&
                  selectedWeight.originalPrice > selectedWeight.price && (
                    <span className="text-[10.5px] text-gray-400 line-through mr-1">
                      {selectedWeight.originalPrice} ج.م
                    </span>
                  )}
              </div>
            </div>
            {discountPercent && (
              <span className="bg-pistachio-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                وفر {discountPercent}%
              </span>
            )}
          </div>

          {/* Description */}
          <div className="text-[11px] sm:text-xs text-brand-800 leading-relaxed">
            <p>{product.description}</p>
          </div>

          {/* Interactive Weight Variant Selector */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-extrabold text-brand-900 block">
              1. اختر الوزن المطلوب (ثمن • ربع • نصف • كيلو):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {product.weights.map((w) => {
                const isSelected = selectedWeight.id === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWeight(w)}
                    className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer tabular-nums ${
                      isSelected
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#D4AF37] shadow-xs'
                        : 'bg-white text-brand-900 border-brand-200 hover:border-[#C88A4B]'
                    }`}
                  >
                    <div className="text-[10.5px] sm:text-[11px] font-extrabold">{w.label}</div>
                    <div
                      className={`text-[10px] font-black mt-0.5 ${
                        isSelected ? 'text-[#D4AF37]' : 'text-brand-600'
                      }`}
                    >
                      {w.price} ج.م
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-[9.5px] sm:text-[10px] bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100">
              <span className="font-semibold text-brand-800">👥 {servingHint}</span>
              {bulkSavingsEgp > 0 && (
                <span className="font-bold text-pistachio-700 bg-pistachio-50 px-1.5 py-0.5 rounded border border-pistachio-200">
                  ✨ أوفر بـ {bulkSavingsEgp} ج.م مقارنة بالحجم الصغير
                </span>
              )}
            </div>
          </div>

          {/* Interactive Roast Option Selector */}
          {product.roastOptions.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10.5px] font-extrabold text-brand-900 block">
                2. درجة التحميص / الملح / الطحنة:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {product.roastOptions.map((roast) => {
                  const isActive = selectedRoast === roast;
                  return (
                    <button
                      key={roast}
                      type="button"
                      onClick={() => setSelectedRoast(roast)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        isActive
                          ? 'bg-[#231710] text-[#D4AF37] border-[#D4AF37] shadow-2xs font-extrabold'
                          : 'bg-white text-brand-700 border-brand-200 hover:bg-brand-50'
                      }`}
                    >
                      {roast}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Worker Notes Field (ملاحظات خاصة للعامل) */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-extrabold text-brand-900 block">
              3. ملاحظات خاصة للعامل في فرع بني مزار (اختياري):
            </label>
            <input
              type="text"
              value={workerNotes}
              onChange={(e) => setWorkerNotes(e.target.value)}
              placeholder="مثال: طحنة ناعمة للكنكة النحاس / تقسيم الوزن في كيسين ربع كيلو..."
              className="w-full bg-white border border-brand-200 focus:border-[#C88A4B] rounded-xl px-3 py-2 text-xs text-brand-950 focus:outline-none"
            />
          </div>

          {/* Freshness & Stock Availability */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#231710] bg-[#D4AF37]/20 border border-[#D4AF37] px-2.5 py-0.5 rounded-full">
              <Flame className="w-3 h-3 text-[#B83B2B]" />
              محمص اليوم طازجاً في فرع بني مزار
            </span>
            {product.inStock ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                متوفر وجاهز للتوصيل الفوري
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                غير متوفر حالياً
              </span>
            )}
          </div>

          {/* Quantity & Dual Action Buttons (Add to Cart & Fast Checkout) */}
          <div className="pt-1 space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Quantity Selector */}
              <div className="flex items-center justify-between border border-brand-300 rounded-lg bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1.5 text-brand-900 hover:bg-brand-100 rounded-md transition"
                  aria-label="تقليل الكمية"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-3 font-extrabold text-brand-950 text-xs">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-1.5 text-brand-900 hover:bg-brand-100 rounded-md transition"
                  aria-label="زيادة الكمية"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                disabled={!product.inStock}
                onClick={handleAddToCart}
                className={`flex-1 py-2 px-3.5 rounded-lg font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 ${
                  !product.inStock
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : justAdded
                    ? 'bg-pistachio-600 text-white'
                    : 'bg-brand-900 hover:bg-brand-950 text-white'
                }`}
              >
                {!product.inStock ? (
                  <span>نفدت الكمية حالياً</span>
                ) : justAdded ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />
                    <span>تمت الإضافة للسلة!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5 text-gold-400" />
                    <span>
                      أضف للسلة • {selectedWeight.price * quantity} ج.م
                    </span>
                  </>
                )}
              </button>

              {/* Fast Checkout ("شراء فوري") Button */}
              <button
                type="button"
                disabled={!product.inStock}
                onClick={handleFastCheckout}
                className="py-2 px-3.5 rounded-lg font-extrabold text-[11px] sm:text-xs bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1 shadow-2xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="إتمام الشراء والانتقال لصفحة الدفع مباشرة"
              >
                <Zap className="w-3.5 h-3.5 text-gold-300" />
                <span>شراء فوري</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Luxury Nutrition Facts Card Section */}
      <section className="pt-1">
        <NutritionFactsCard product={product} />
      </section>

      {/* Customer Reviews Section */}
      <section className="bg-white rounded-xl border border-brand-200/80 shadow-2xs p-3.5 sm:p-5 space-y-4">
        <div className="border-b border-brand-100 pb-3">
          <h2 className="text-sm sm:text-base font-extrabold text-brand-950">
            تقييمات وآراء العملاء
          </h2>
          <p className="text-[10.5px] text-brand-600 mt-0.5">
            آراء موثقة وتجارب حقيقية من عملاء تذوقوا هذا الصنف
          </p>
        </div>

        {/* Reviews Summary & Distribution Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-brand-50/50 p-3 rounded-xl border border-brand-100">
          {/* Big Score Box (4 cols) */}
          <div className="md:col-span-4 text-center md:border-l md:border-brand-200 md:pl-4 space-y-1">
            <div className="text-2xl font-extrabold text-brand-950">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= Math.round(averageRating)
                      ? 'fill-gold-400 text-gold-400'
                      : 'text-brand-200'
                  }`}
                />
              ))}
            </div>
            <div className="text-[10px] font-bold text-brand-700">
              استناداً إلى {reviewsCount} تقييماً
            </div>
          </div>

          {/* Distribution Bars (8 cols) */}
          <div className="md:col-span-8 space-y-1">
            {starDistribution.map((item) => (
              <div key={item.stars} className="flex items-center gap-2 text-[10px]">
                <span className="w-10 font-bold text-brand-800 text-left">
                  {item.stars} نجوم
                </span>
                <div className="flex-1 h-1.5 bg-brand-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-500 rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="w-6 text-brand-600 font-semibold text-right">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Review Submission Form & Existing Reviews Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Review Submission Form Column (5 cols) */}
          <div className="lg:col-span-5 bg-brand-50/70 border border-brand-200 rounded-xl p-3.5 space-y-2.5 h-fit">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-brand-950">أضف تقييمك ورأيك</h3>
              <p className="text-[10px] text-brand-600 mt-0.5">
                رأيك يهمنا ويساعد العملاء الآخرين في اختيار أفضل المكسرات
              </p>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold p-2.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleReviewSubmit} className="space-y-2.5">
              {/* Star Rating Picker */}
              <div>
                <label className="text-[10px] font-extrabold text-brand-900 block mb-1">
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
                        className="p-0.5 text-gold-400 hover:scale-110 transition-transform"
                        title={`${starVal} نجوم`}
                      >
                        <Star
                          className={`w-4 h-4 transition-colors ${
                            isFilled
                              ? 'fill-gold-400 text-gold-400'
                              : 'text-brand-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                  <span className="text-[10px] font-extrabold text-brand-900 mr-1.5 bg-white px-2 py-0.5 rounded border border-brand-200">
                    {RATING_LABELS[hoverRating || formRating] || 'ممتاز'}
                  </span>
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="text-[10px] font-extrabold text-brand-900 block mb-1">
                  اسمك الكريم:
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full px-2.5 py-1.5 bg-white border border-brand-200 rounded-lg text-[11px] font-bold text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-700 transition"
                />
              </div>

              {/* Comment Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-extrabold text-brand-900">
                    رأيك وتجربتك:
                  </label>
                  <span className="text-[9.5px] text-brand-500 font-semibold">
                    {comment.length} / 500 حرف
                  </span>
                </div>
                <textarea
                  required
                  rows={2}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="ما رأيك في القرمشة والتحميص وجودة التغليف؟"
                  className="w-full px-2.5 py-1.5 bg-white border border-brand-200 rounded-lg text-[11px] font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-700 transition resize-none leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 px-3 bg-brand-900 hover:bg-brand-950 text-white rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-gold-400" />
                    <span>جاري إرسال ونشر تقييمك...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3 text-gold-400" />
                    <span>إرسال التقييم الآن</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Customer Reviews List Column (7 cols) */}
          <div className="lg:col-span-7 space-y-2.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-brand-950">
              قائمة التقييمات ({reviews.length})
            </h3>

            {reviews.length === 0 ? (
              <div className="text-center py-6 px-4 bg-brand-50/50 rounded-xl border border-dashed border-brand-200 space-y-1.5">
                <Star className="w-6 h-6 text-brand-300 mx-auto" />
                <p className="text-[11px] font-bold text-brand-800">
                  لا توجد تقييمات مكتوبة لهذا المنتج حتى الآن.
                </p>
                <p className="text-[10px] text-brand-600">
                  كن أول من يشارك رأيه وتجربته مع هذا الصنف الرائع!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-brand-50/60 p-2.5 rounded-lg border border-brand-200/80 space-y-1 hover:border-brand-300 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Name Avatar */}
                        <div className="w-6 h-6 rounded-full bg-brand-900 text-gold-400 font-extrabold text-[10px] flex items-center justify-center">
                          {rev.customerName ? rev.customerName.trim()[0] : 'ع'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-extrabold text-brand-950">
                              {rev.customerName}
                            </span>
                            {rev.verified && (
                              <span className="text-[8.5px] text-pistachio-700 bg-pistachio-50 border border-pistachio-200 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 font-bold">
                                <CheckCircle2 className="w-2.5 h-2.5 text-pistachio-600" />{' '}
                                مشتري موثق
                              </span>
                            )}
                          </div>
                          <span className="text-[9.5px] text-brand-500">
                            {rev.date}
                          </span>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-2.5 h-2.5 ${
                              s <= rev.rating
                                ? 'fill-gold-400 text-gold-400'
                                : 'text-brand-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-brand-800 leading-relaxed pt-0.5">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Smart Cross-Sell Recommendation (يكمل سهرتك مع هذا الصنف) */}
      {relatedProducts.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="border-b border-brand-200 pb-2.5">
            <h2 className="font-cairo text-sm sm:text-base font-extrabold text-brand-950">
              ✨ يكمل سهرتك مع هذا الصنف
            </h2>
            <p className="text-[10.5px] text-brand-600 mt-0.5">
              ترشيحات ذكية من محمصة حفصة تناسب ذوقك وتكمل طلبك للشحن المجاني والكاش باك
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {relatedProducts.map((relProduct) => (
              <ProductCard key={relProduct.id} product={relProduct} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
