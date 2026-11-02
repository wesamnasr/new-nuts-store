'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Eye, Check } from 'lucide-react';
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

  const resolvedWeights: WeightVariant[] = React.useMemo(
    () => getResolvedProductWeights(product),
    [product]
  );

  const defaultWeight =
    resolvedWeights.find((w) => (w.grams || w.weightGrams) === 250) ||
    resolvedWeights[1] ||
    resolvedWeights[0];

  const [selectedWeight, setSelectedWeight] = useState<WeightVariant>(defaultWeight);
  const defaultRoast: RoastOption = product.roastOptions?.[0] || 'محمص مملح';
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    if (!product.inStock) return;
    addToCart(product, selectedWeight, defaultRoast, 1);
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

  const productDetailHref = `/product/${product.slug || product.id}?weight=${encodeURIComponent(
    selectedWeight?.id || ''
  )}&roast=${encodeURIComponent(defaultRoast)}`;

  return (
    <div className="theme-product-card group bg-white rounded-2xl border border-[#E8E0D5] flex flex-col overflow-hidden">
      {/* Larger Clean Product Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FAF6F0]">
        <Link
          href={productDetailHref}
          className="block w-full h-full overflow-hidden"
        >
          <img
            src={getSafeImageUrl(product.image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 cursor-pointer"
          />
        </Link>

        {/* Show discount badge ONLY when a real discount exists */}
        {discountPercent && (
          <div className="absolute top-3 right-3">
            <span className="bg-[#B83B2B] text-white text-[11px] font-bold px-2 py-0.5 rounded-lg tabular-nums">
              -{discountPercent}%
            </span>
          </div>
        )}

        {/* Subtle Quick View Trigger */}
        <button
          type="button"
          onClick={() => setSelectedProductModal(product)}
          className="absolute top-3 left-3 bg-white/95 hover:bg-white text-[#231710] border border-[#E8E0D5] p-2 rounded-xl opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
          title="معاينة وتحديد التحميص"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Calm Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
        <h3 className="font-cairo text-sm sm:text-[15px] font-bold text-[#231710] hover:text-[#9A6836] line-clamp-1 leading-snug transition">
          <Link href={productDetailHref}>{product.name}</Link>
        </h3>

        <div className="space-y-3">
          {/* Calm 4-Weight Selector (125g | 250g | 500g | 1000g) */}
          <div className="grid grid-cols-4 gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E8E0D5]">
            {resolvedWeights.slice(0, 4).map((w) => {
              const isSelected = selectedWeight?.id === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWeight(w)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] transition text-center leading-tight cursor-pointer tabular-nums ${
                    isSelected
                      ? 'bg-[#231710] text-[#FAF6F0] font-bold'
                      : 'text-[#6E5D4F] hover:text-[#231710] font-medium'
                  }`}
                >
                  {getShortWeightLabel(w)}
                </button>
              );
            })}
          </div>

          {/* Clean Price & Add Button */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
              <span className="font-cairo text-base sm:text-lg font-bold text-[#231710] leading-none">
                {selectedWeight?.price}
              </span>
              <span className="text-xs font-medium text-[#6E5D4F]">ج.م</span>
              {selectedWeight?.originalPrice &&
                selectedWeight.originalPrice > selectedWeight.price && (
                  <span className="text-xs text-[#8A7968] line-through mr-0.5">
                    {selectedWeight.originalPrice}
                  </span>
                )}
            </div>

            <button
              type="button"
              disabled={!product.inStock}
              onClick={handleAdd}
              className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                !product.inStock
                  ? 'bg-[#F4EFE6] text-[#8A7968] cursor-not-allowed'
                  : justAdded
                    ? 'bg-[#3B6E4C] text-white'
                    : 'bg-[#231710] hover:bg-[#362419] text-[#FAF6F0]'
              }`}
            >
              {!product.inStock ? (
                <span>غير متاح</span>
              ) : justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>أُضيف</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
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
