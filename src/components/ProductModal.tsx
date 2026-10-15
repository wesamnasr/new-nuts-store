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
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto md:overflow-hidden shadow-2xl border border-brand-200 my-auto relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={() => setSelectedProductModal(null)}
          className="sticky md:absolute top-2.5 left-2.5 float-left md:float-none z-20 m-2 md:m-0 bg-white/95 hover:bg-white text-brand-950 p-1 rounded-full shadow-sm border border-brand-100 transition cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 clear-both">
          {/* Image Column */}
          <div className="relative bg-brand-100 h-48 sm:h-56 md:h-auto md:min-h-[310px]">
            <img
              src={getSafeImageUrl(product.image)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {product.badge && (
              <span className="absolute top-2.5 right-2.5 bg-brand-950 text-gold-400 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                ✨ {product.badge}
              </span>
            )}
            <div className="absolute bottom-2 inset-x-2 sm:bottom-2.5 sm:inset-x-2.5 bg-white/95 backdrop-blur-md p-2 rounded-lg shadow-sm border border-brand-100">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[9.5px] sm:text-[10px] font-bold text-brand-900 mb-0.5">
                <span className="flex items-center gap-1 text-pistachio-700">
                  <Flame className="w-3 h-3 shrink-0" />
                  القيمة الغذائية (100 جم)
                </span>
                <span>السعرات: {product.caloriesPer100g} سعر</span>
              </div>
              <p className="text-[9.5px] text-brand-700 line-clamp-2">{product.nutritionalHighlight}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] font-bold text-brand-800">
                <span className="bg-brand-100 px-1.5 py-0.5 rounded">
                  البروتين: {product.proteinPer100g}
                </span>
                <span className="bg-pistachio-50 text-pistachio-700 px-1.5 py-0.5 rounded">
                  تحميص يومي طازج
                </span>
              </div>
            </div>
          </div>

          {/* Details Column */}
          <div className="p-3 sm:p-4 flex flex-col justify-between md:max-h-[82vh] md:overflow-y-auto">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-brand-700">
                <span className="flex items-center gap-1 bg-brand-100 px-2 py-0.5 rounded-full">
                  <MapPin className="w-2.5 h-2.5 text-brand-600" />
                  المنشأ: {product.origin}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Star className="w-3 h-3 fill-gold-400 text-gold-400" />
                  {product.rating} ({product.reviewsCount} تقييم)
                </span>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-brand-950">{product.name}</h2>
                <p className="text-[11px] text-brand-600 font-semibold mt-0.5">{product.subtitle}</p>
              </div>

              <p className="text-[11px] text-brand-800 leading-relaxed bg-brand-50/70 p-2 rounded-lg border border-brand-100">
                {product.description}
              </p>

              {/* Weight selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-brand-900 block">
                  1. اختر الوزن المناسب:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {product.weights.map((w) => {
                    const active = selectedWeight.id === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWeight(w)}
                        className={`p-1.5 rounded-lg border text-center transition ${
                          active
                            ? 'bg-brand-900 text-white border-brand-900 shadow-2xs'
                            : 'bg-brand-50 text-brand-900 border-brand-200 hover:border-brand-400'
                        }`}
                      >
                        <div className="text-[10px] font-bold">{w.label}</div>
                        <div
                          className={`text-[11px] font-extrabold mt-0.5 ${
                            active ? 'text-gold-400' : 'text-brand-700'
                          }`}
                        >
                          {w.price} ج.م
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 text-[9.5px] bg-brand-50 px-2 py-1 rounded-md border border-brand-100">
                  <span className="font-bold text-brand-800">👥 {servingHint}</span>
                  {bulkSavingsEgp > 0 && (
                    <span className="font-bold text-pistachio-700 bg-pistachio-50 px-1.5 py-0.5 rounded border border-pistachio-200">
                      ✨ أوفر بـ {bulkSavingsEgp} ج.م
                    </span>
                  )}
                </div>
              </div>

              {/* Roast selection */}
              <div>
                <label className="text-[10px] font-extrabold text-brand-900 block mb-1">
                  2. اختر طريقة التحميص / النكهة:
                </label>
                <div className="flex flex-wrap gap-1">
                  {product.roastOptions.map((roast) => {
                    const active = selectedRoast === roast;
                    return (
                      <button
                        key={roast}
                        type="button"
                        onClick={() => setSelectedRoast(roast)}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                          active
                            ? 'bg-amber-100 text-brand-950 border-brand-700 shadow-2xs'
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
                <div className="pt-1.5 border-t border-brand-100">
                  <h4 className="text-[10px] font-extrabold text-brand-900 mb-1">
                    آراء العملاء في هذا الصنف:
                  </h4>
                  <div className="space-y-1">
                    {product.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-brand-50/80 p-1.5 rounded-md border border-brand-100 text-[10px]"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-brand-950 flex items-center gap-1">
                            {rev.customerName}
                            {rev.verified && (
                              <span className="text-[8.5px] text-pistachio-700 bg-pistachio-50 px-1 py-0.2 rounded flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> مشتري موثق
                              </span>
                            )}
                          </span>
                          <span className="text-[8.5px] text-brand-500">{rev.date}</span>
                        </div>
                        <p className="text-brand-800">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-2.5 mt-2.5 border-t border-brand-200 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                {/* Quantity Counter */}
                <div className="flex items-center border border-brand-300 rounded-lg bg-brand-50">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-1.5 text-brand-900 hover:bg-brand-200 rounded-r-lg transition"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-2.5 text-[11px] font-extrabold text-brand-950">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-1.5 text-brand-900 hover:bg-brand-200 rounded-l-lg transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Total Price & Add Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 bg-brand-900 hover:bg-brand-950 text-white py-2 px-3 rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span>أضف للسلة • {selectedWeight.price * quantity} ج.م</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1 text-[9.5px] text-brand-700 pt-0.5">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-pistachio-600 shrink-0" />
                  تغليف حراري محكم يحفظ القرمشة
                </span>
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-pistachio-700 hover:underline font-bold"
                >
                  <MessageCircle className="w-3 h-3 shrink-0" />
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
