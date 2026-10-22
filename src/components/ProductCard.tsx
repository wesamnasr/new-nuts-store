'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Star,
  Eye,
  Check,
  Flame,
} from 'lucide-react';
import { Product, RoastOption, WeightVariant } from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { getSafeImageUrl } from '@/lib/defaults';
import {
  getResolvedProductWeights,
  getShortWeightLabel,
} from '@/lib/pricing';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, setSelectedProductModal } = useStore();

  // Ensure all 4 weight buttons (125g, 250g, 500g, 1000g) are always available via shared helper
  const resolvedWeights: WeightVariant[] = React.useMemo(
    () => getResolvedProductWeights(product),
    [product]
  );

  // Default to 250g (ربع كيلو) — the most popular choice in Bani Mazar
  const defaultWeight =
    resolvedWeights.find((w) => (w.grams || w.weightGrams) === 250) ||
    resolvedWeights[1] ||
    resolvedWeights[0];

  const [selectedWeight, setSelectedWeight] = useState<WeightVariant>(defaultWeight);
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>(
    product.roastOptions?.[0] || 'محمص مملح'
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

  const getShortWeightTitle = getShortWeightLabel;
  const productDetailHref = `/product/${product.slug || product.id}?weight=${encodeURIComponent(
    selectedWeight?.id || ''
  )}&roast=${encodeURIComponent(selectedRoast)}`;

  return (
    <div className="theme-product-card group bg-white rounded-2xl border border-[#E6DFD3] shadow-xs hover:shadow-lg hover:border-[#C88A4B] transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image Header */}
      <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-[#F3ECE1]">
        <Link
          href={productDetailHref}
          className="block w-full h-full overflow-hidden"
        >
          <img
            src={getSafeImageUrl(product.image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
          />
        </Link>

        {/* Top Badges */}
        <div className="absolute top-2 right-2 flex flex-wrap items-center gap-1">
          {product.badge ? (
            <span className="bg-[#231710]/90 backdrop-blur-xs text-[#D4AF37] border border-[#D4AF37]/40 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs">
              {product.badge}
            </span>
          ) : (
            <span className="bg-[#231710]/85 backdrop-blur-xs text-[#FAF6F0] text-[8.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Flame className="w-2.5 h-2.5 text-[#C88A4B]" />
              <span>طازج يومياً</span>
            </span>
          )}
          {discountPercent && (
            <span className="bg-[#B83B2B] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full tabular-nums">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Quick View Button */}
        <button
          onClick={() => setSelectedProductModal(product)}
          className="absolute top-2 left-2 bg-white/90 hover:bg-white text-[#231710] p-1.5 rounded-full shadow-sm opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
          title="عرض سريع"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
        <div>
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-cairo text-xs sm:text-[13px] font-extrabold text-[#231710] hover:text-[#C88A4B] line-clamp-1 leading-snug transition">
              <Link href={productDetailHref}>
                {product.name}
              </Link>
            </h3>
            <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-[#231710] shrink-0 tabular-nums">
              <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
              {product.rating || 4.9}
            </span>
          </div>
          <p className="text-[10px] text-[#6E5D4F] mt-0.5 line-clamp-1">
            {product.origin}
          </p>
        </div>

        {/* 4 Instant Weight Buttons (125g | 250g | 500g | 1000g) */}
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1 bg-[#F3ECE1] p-1 rounded-xl border border-[#E6DFD3]">
            {resolvedWeights.slice(0, 4).map((w) => {
              const isSelected = selectedWeight?.id === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWeight(w)}
                  className={`py-1 px-1 rounded-lg text-[9.5px] font-extrabold transition text-center leading-tight cursor-pointer tabular-nums ${
                    isSelected
                      ? 'bg-[#231710] text-[#D4AF37] shadow-xs font-black'
                      : 'text-[#6E5D4F] hover:text-[#231710] hover:bg-white/60'
                  }`}
                >
                  {getShortWeightTitle(w)}
                </button>
              );
            })}
          </div>

          {/* Roast / Option Selector (if more than 1 option) */}
          {product.roastOptions && product.roastOptions.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {product.roastOptions.slice(0, 3).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedRoast(opt)}
                  className={`text-[9px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap border transition cursor-pointer ${
                    selectedRoast === opt
                      ? 'bg-[#C88A4B]/20 text-[#231710] border-[#C88A4B] font-extrabold'
                      : 'bg-[#FAF6F0] text-[#6E5D4F] border-[#E6DFD3] hover:border-[#C88A4B]/50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Live Price & Add to Cart Button */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E6DFD3]/70">
            <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
              <span className="font-cairo text-sm sm:text-base font-black text-[#231710] leading-none">
                {selectedWeight?.price}
              </span>
              <span className="text-[10px] font-extrabold text-[#6E5D4F]">ج.م</span>
              {selectedWeight?.originalPrice && (
                <span className="text-[9.5px] text-[#6E5D4F]/70 line-through">
                  {selectedWeight.originalPrice}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!product.inStock}
              onClick={handleAdd}
              className={`py-2 px-3 rounded-xl font-extrabold text-[10.5px] flex items-center justify-center gap-1.5 transition active:scale-95 leading-none cursor-pointer shadow-xs ${
                !product.inStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : justAdded
                    ? 'bg-[#3B6E4C] text-white'
                    : 'bg-[#231710] hover:bg-[#3A2519] text-[#FAF6F0] border border-[#D4AF37]/40'
              }`}
            >
              {!product.inStock ? (
                <span>نفد حالياً</span>
              ) : justAdded ? (
                <>
                  <Check className="w-3 h-3 text-white shrink-0" />
                  <span>تمت الإضافة</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3 h-3 text-[#D4AF37] shrink-0" />
                  <span>أضف للسلة</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
