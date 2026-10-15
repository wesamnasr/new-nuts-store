'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Star,
  Flame,
  Eye,
  Check,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { Product, RoastOption, WeightVariant } from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { getSafeImageUrl } from '@/lib/defaults';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, setSelectedProductModal, themeConfig } = useStore();

  const [selectedWeight, setSelectedWeight] = useState<WeightVariant>(
    product.weights[1] || product.weights[0]
  );
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>(
    product.roastOptions[0] || 'محمص مملح'
  );
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    if (!product.inStock) return;
    addToCart(product, selectedWeight, selectedRoast, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const discountPercent =
    selectedWeight?.originalPrice && selectedWeight.originalPrice > selectedWeight.price
      ? Math.round(
          ((selectedWeight.originalPrice - selectedWeight.price) /
            selectedWeight.originalPrice) *
            100
        )
      : null;

  const baseWeight = product.weights[0];
  const bulkSavingsEgp =
    baseWeight &&
    selectedWeight &&
    selectedWeight.weightGrams > baseWeight.weightGrams
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
      ? 'يكفي ٢-٣ أشخاص'
      : selectedWeight.weightGrams <= 600
      ? 'حجم عائلي (٤-٦ أشخاص)'
      : 'حجم ضيافة (٨-١٢ شخص)';

  const isEditorial = themeConfig.cardStyle === 'editorial';

  return (
    <div className="theme-product-card group bg-white rounded-2xl border border-brand-200/80 shadow-sm hover:shadow-lg hover:border-brand-400 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image Header */}
      <div
        className={`relative h-44 w-full overflow-hidden bg-brand-100 ${
          isEditorial ? 'p-2 bg-brand-50 border-b border-brand-200/80' : ''
        }`}
      >
        <Link
          href={`/products/${product.slug || product.id}`}
          className={`block w-full h-full overflow-hidden ${isEditorial ? 'rounded-xl' : ''}`}
        >
          <img
            src={getSafeImageUrl(product.image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
          />
        </Link>

        {/* Top Badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1">
          {product.badge && (
            <span className="bg-brand-950/90 backdrop-blur-sm text-gold-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {product.badge}
            </span>
          )}
          {discountPercent && (
            <span className="bg-pistachio-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow w-fit">
              وفر {discountPercent}%
            </span>
          )}
        </div>

        {/* Quick View Button */}
        <button
          onClick={() => setSelectedProductModal(product)}
          className="absolute top-2.5 left-2.5 bg-white/90 hover:bg-white text-brand-900 p-1.5 rounded-full shadow-sm transition transform hover:scale-105"
          title="عرض التفاصيل والقيمة الغذائية"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        {/* Origin & Rating Bar */}
        <div className="absolute bottom-2 inset-x-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
          <span className="bg-white/95 backdrop-blur-sm text-brand-900 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1 truncate">
            <MapPin className="w-2.5 h-2.5 text-brand-600 shrink-0" />
            <span className="truncate">{product.origin}</span>
          </span>
          <span className="bg-brand-950/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center justify-between gap-1 shrink-0">
            <Star className="w-3 h-3 text-gold-400 fill-gold-400" />
            {product.rating}
            <span className="text-[9px] text-brand-200">({product.reviewsCount})</span>
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-brand-950 hover:text-brand-700 line-clamp-1 transition">
            <Link href={`/products/${product.slug || product.id}`}>
              {product.name}
            </Link>
          </h3>
          <p className="text-[11px] text-brand-700 mt-0.5 line-clamp-1 leading-relaxed">
            {product.subtitle}
          </p>
        </div>

        {/* Interactive Selectors: Weight & Roast */}
        <div className="space-y-2 pt-1.5 border-t border-brand-100">
          {/* Weight Selector */}
          <div className="grid grid-cols-3 gap-1">
            {product.weights.map((w) => {
              const isSelected = selectedWeight?.id === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWeight(w)}
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border transition text-center ${
                    isSelected
                      ? 'bg-brand-900 text-white border-brand-900 shadow-xs'
                      : 'bg-brand-50 text-brand-800 border-brand-200 hover:border-brand-400'
                  }`}
                >
                  {w.weightGrams >= 1000 ? `${w.weightGrams / 1000} كجم` : `${w.weightGrams} جم`}
                </button>
              );
            })}
          </div>

          {/* Serving Guide & Bulk Savings Micro-Bar */}
          <div className="flex items-center justify-between text-[10px] bg-brand-50/80 px-2 py-1 rounded-lg border border-brand-100">
            <span className="font-bold text-brand-700">👥 {servingHint}</span>
            {bulkSavingsEgp > 0 ? (
              <span className="font-extrabold text-pistachio-700 bg-pistachio-50 px-1.5 py-0.5 rounded border border-pistachio-200">
                أوفر بـ {bulkSavingsEgp} ج.م
              </span>
            ) : (
              <span className="text-brand-500 font-semibold">🔥 تحميص اليوم</span>
            )}
          </div>

          {/* Roast Option Selector */}
          {product.roastOptions.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {product.roastOptions.map((roast) => {
                const active = selectedRoast === roast;
                return (
                  <button
                    key={roast}
                    type="button"
                    onClick={() => setSelectedRoast(roast)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                      active
                        ? 'bg-gold-500/20 text-brand-950 border-gold-500'
                        : 'bg-white text-brand-700 border-brand-200 hover:bg-brand-50'
                    }`}
                  >
                    {roast}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Price & Add to Cart Footer */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-brand-100">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-extrabold text-brand-950">
                {selectedWeight?.price}
              </span>
              <span className="text-[11px] font-bold text-brand-800">ج.م</span>
              {selectedWeight?.originalPrice && (
                <span className="text-[10px] text-gray-400 line-through">
                  {selectedWeight.originalPrice}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!product.inStock}
            onClick={handleAdd}
            className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 ${
              !product.inStock
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : justAdded
                ? 'bg-pistachio-600 text-white'
                : 'bg-gradient-to-l from-brand-800 to-brand-950 hover:from-brand-900 hover:to-brand-950 text-white'
            }`}
          >
            {!product.inStock ? (
              <span>نفدت الكمية</span>
            ) : justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>تمت الإضافة!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5 text-gold-400" />
                <span>أضف للسلة</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
