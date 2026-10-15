'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  Flame,
  ShieldCheck,
  MapPin,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { RoastOption, WeightVariant } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';

export default function ProductModal() {
  const { selectedProductModal, setSelectedProductModal, addToCart, storeData } = useStore();

  const [selectedWeight, setSelectedWeight] = useState<WeightVariant | null>(null);
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>('محمص مملح');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (selectedProductModal) {
      setSelectedWeight(
        selectedProductModal.weights[1] || selectedProductModal.weights[0] || null
      );
      setSelectedRoast(selectedProductModal.roastOptions[0] || 'محمص مملح');
      setQuantity(1);
    }
  }, [selectedProductModal]);

  if (!selectedProductModal || !selectedWeight) return null;

  const product = selectedProductModal;
  const whatsappNumber = formatWhatsAppPhone(storeData?.settings.whatsappNumber);

  const baseWeight = product.weights[0];
  const bulkSavingsEgp =
    baseWeight && selectedWeight.weightGrams > baseWeight.weightGrams
      ? Math.max(
          0,
          Math.round(
            (baseWeight.price / baseWeight.weightGrams) * selectedWeight.weightGrams -
              selectedWeight.price
          )
        )
      : 0;

  const servingHint =
    selectedWeight.weightGrams <= 300
      ? 'يكفي ٢-٣ أشخاص (حجم شخصي / تجريبي)'
      : selectedWeight.weightGrams <= 600
      ? 'حجم عائلي مثالي (٤-٦ أشخاص) • الأكثر طلباً'
      : 'حجم ضيافة وتوفير (٨-١٢ شخص)';

  const handleAddToCart = () => {
    addToCart(product, selectedWeight, selectedRoast, quantity);
    setSelectedProductModal(null);
  };

  const whatsappInquiryUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً، أود الاستفسار عن منتج: ${product.name} (${selectedWeight.label} - ${selectedRoast})`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto md:overflow-hidden shadow-2xl border border-brand-200 my-auto relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={() => setSelectedProductModal(null)}
          className="sticky md:absolute top-3 left-3 float-left md:float-none z-20 m-2 md:m-0 bg-white/95 hover:bg-white text-brand-950 p-1.5 rounded-full shadow-md border border-brand-100 transition cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 clear-both">
          {/* Image Column */}
          <div className="relative bg-brand-100 h-56 sm:h-64 md:h-auto md:min-h-[360px]">
            <img
              src={getSafeImageUrl(product.image)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {product.badge && (
              <span className="absolute top-3 right-3 bg-brand-950 text-gold-400 text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-md">
                ✨ {product.badge}
              </span>
            )}
            <div className="absolute bottom-2.5 inset-x-2.5 sm:bottom-3 sm:inset-x-3 bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-xl shadow-md border border-brand-100">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold text-brand-900 mb-1">
                <span className="flex items-center gap-1 text-pistachio-700">
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  القيمة الغذائية (100 جم)
                </span>
                <span>السعرات: {product.caloriesPer100g} سعر</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-brand-700 line-clamp-2">{product.nutritionalHighlight}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-brand-800">
                <span className="bg-brand-100 px-2 py-0.5 rounded-md">
                  البروتين: {product.proteinPer100g}
                </span>
                <span className="bg-pistachio-50 text-pistachio-700 px-2 py-0.5 rounded-md">
                  تحميص يومي بدون زيوت مهدرجة
                </span>
              </div>
            </div>
          </div>

          {/* Details Column */}
          <div className="p-3.5 sm:p-5 flex flex-col justify-between md:max-h-[85vh] md:overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-brand-700">
                <span className="flex items-center gap-1 bg-brand-100 px-2.5 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3 text-brand-600" />
                  المنشأ: {product.origin}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Star className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
                  {product.rating} ({product.reviewsCount} تقييم)
                </span>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-brand-950">{product.name}</h2>
                <p className="text-xs text-brand-600 font-semibold mt-0.5">{product.subtitle}</p>
              </div>

              <p className="text-xs text-brand-800 leading-relaxed bg-brand-50/70 p-2.5 rounded-xl border border-brand-100">
                {product.description}
              </p>

              {/* Weight selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-brand-900 block">
                  1. اختر الوزن المناسب:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {product.weights.map((w) => {
                    const active = selectedWeight.id === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWeight(w)}
                        className={`p-2 rounded-xl border text-center transition ${
                          active
                            ? 'bg-brand-900 text-white border-brand-900 shadow-sm'
                            : 'bg-brand-50 text-brand-900 border-brand-200 hover:border-brand-400'
                        }`}
                      >
                        <div className="text-[11px] font-extrabold">{w.label}</div>
                        <div
                          className={`text-xs font-black mt-0.5 ${
                            active ? 'text-gold-400' : 'text-brand-700'
                          }`}
                        >
                          {w.price} ج.م
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] bg-brand-50 px-2.5 py-1.5 rounded-lg border border-brand-100">
                  <span className="font-bold text-brand-800">👥 {servingHint}</span>
                  {bulkSavingsEgp > 0 && (
                    <span className="font-extrabold text-pistachio-700 bg-pistachio-50 px-2 py-0.5 rounded border border-pistachio-200">
                      ✨ أوفر بـ {bulkSavingsEgp} ج.م
                    </span>
                  )}
                </div>
              </div>

              {/* Roast selection */}
              <div>
                <label className="text-[11px] font-extrabold text-brand-900 block mb-1.5">
                  2. اختر طريقة التحميص / النكهة:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {product.roastOptions.map((roast) => {
                    const active = selectedRoast === roast;
                    return (
                      <button
                        key={roast}
                        type="button"
                        onClick={() => setSelectedRoast(roast)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                          active
                            ? 'bg-amber-100 text-brand-950 border-brand-700 shadow-xs'
                            : 'bg-white text-brand-700 border-brand-200 hover:bg-brand-50'
                        }`}
                      >
                        {roast}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Reviews Preview */}
              {product.reviews && product.reviews.length > 0 && (
                <div className="pt-2 border-t border-brand-100">
                  <h4 className="text-[11px] font-extrabold text-brand-900 mb-1.5">
                    آراء العملاء في هذا الصنف:
                  </h4>
                  <div className="space-y-1.5">
                    {product.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-brand-50/80 p-2 rounded-lg border border-brand-100 text-[11px]"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-brand-950 flex items-center gap-1">
                            {rev.customerName}
                            {rev.verified && (
                              <span className="text-[9px] text-pistachio-700 bg-pistachio-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> مشتري موثق
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] text-brand-500">{rev.date}</span>
                        </div>
                        <p className="text-brand-800">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-3.5 mt-3.5 border-t border-brand-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                {/* Quantity Counter */}
                <div className="flex items-center border border-brand-300 rounded-xl bg-brand-50">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 text-brand-900 hover:bg-brand-200 rounded-r-xl transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2.5 sm:px-3 text-xs font-extrabold text-brand-950">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2 text-brand-900 hover:bg-brand-200 rounded-l-xl transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Total Price & Add Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 bg-brand-900 hover:bg-brand-950 text-white py-2.5 px-3 sm:px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                >
                  <ShoppingBag className="w-4 h-4 text-gold-400 shrink-0" />
                  <span>أضف للسلة • {selectedWeight.price * quantity} ج.م</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-[11px] text-brand-700 pt-0.5">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-pistachio-600 shrink-0" />
                  تغليف حراري محكم يحفظ القرمشة
                </span>
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-pistachio-700 hover:underline font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  استفسر عبر واتساب
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
