'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Check, Zap } from 'lucide-react';
import { Product, RoastOption, WeightVariant } from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { getCurrencySymbol, getSafeImageUrl } from '@/lib/defaults';
import {
  getResolvedProductWeights,
  getShortWeightLabel,
  isUnitProduct,
} from '@/lib/pricing';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, storeData } = useStore();
  const currency = getCurrencySymbol(storeData?.settings);
  const unitMode = isUnitProduct(product);

  const resolvedWeights: WeightVariant[] = React.useMemo(
    () => getResolvedProductWeights(product),
    [product]
  );

  const defaultWeight = unitMode
    ? resolvedWeights[0]
    : resolvedWeights.find((w) => (w.grams || w.weightGrams) === 250) ||
      resolvedWeights[1] ||
      resolvedWeights[0];

  const [selectedWeight, setSelectedWeight] =
    useState<WeightVariant>(defaultWeight);
  const defaultRoast: RoastOption = product.roastOptions?.[0] || '';
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    if (!product.inStock) return;
    addToCart(product, selectedWeight, defaultRoast, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
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

  const productDetailHref = `/product/${
    product.slug || product.id
  }?weight=${encodeURIComponent(
    selectedWeight?.id || ''
  )}&roast=${encodeURIComponent(defaultRoast)}`;

  const directOrderHref = `${productDetailHref}#direct-order-box`;

  const secondaryGalleryImage =
    product.gallery && product.gallery.length > 0 && product.gallery[0]?.trim()
      ? getSafeImageUrl(product.gallery[0])
      : null;

  return (
    <div className="theme-product-card group bg-white rounded-2xl border border-[#E8DFD3] flex flex-col overflow-hidden">
      {/* Compact Square-on-Mobile / Portrait-on-Desktop Product Frame */}
      <div className="relative aspect-square sm:aspect-[4/5] w-full overflow-hidden bg-[#F6F1EA]">
        <Link
          href={productDetailHref}
          className="block w-full h-full overflow-hidden relative"
        >
          <img
            src={getSafeImageUrl(product.image)}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-all duration-500 ease-out cursor-pointer ${
              secondaryGalleryImage
                ? 'group-hover:opacity-0 group-hover:scale-105'
                : 'group-hover:scale-105'
            }`}
          />
          {secondaryGalleryImage && (
            <img
              src={secondaryGalleryImage}
              alt={`${product.name} - صورة إضافية`}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out pointer-events-none"
            />
          )}
        </Link>

        {/* Muted Terracotta Sale Tag (-XX%) */}
        {discountPercent && (
          <div className="absolute top-2 right-2 z-10">
            <span className="bg-[#B84A39] text-[#FAF7F2] text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-xs tabular-nums">
              -{discountPercent}%
            </span>
          </div>
        )}
      </div>

      {/* Compact Card Body + Single-Row Weight Pills + Primary Buy Now CTA */}
      <div className="p-2 sm:p-3.5 flex-1 flex flex-col justify-between gap-2 sm:gap-2.5">
        <h3 className="font-cairo text-xs sm:text-[15px] font-extrabold text-[#261A13] hover:text-[#9A6836] text-center line-clamp-2 leading-snug transition-colors duration-200 min-h-[2.4em] flex items-center justify-center">
          <Link href={productDetailHref}>{product.name}</Link>
        </h3>

        <div className="space-y-2">
          {/* Single-Row Scrollable Weight Pills on Mobile (prevents vertical card bloat) */}
          {resolvedWeights.length <= 1 ? (
            <div className="bg-[#F6F1EA] min-h-[30px] px-2 py-1 rounded-xl border border-[#EAE0D3] flex items-center justify-center gap-1 text-[10px] sm:text-[11px]">
              <span className="text-[#6E5D4F] font-medium">
                {unitMode ? 'العبوة:' : 'الوزن:'}
              </span>
              <span className="font-bold text-[#261A13]">
                {selectedWeight
                  ? getShortWeightLabel(selectedWeight)
                  : product.unitLabel || 'قطعة'}
              </span>
            </div>
          ) : (
            <div className="flex flex-nowrap sm:flex-wrap items-center justify-start sm:justify-center gap-1 bg-[#F6F1EA] p-1 rounded-xl border border-[#EAE0D3] overflow-x-auto no-scrollbar">
              {resolvedWeights.map((w) => {
                const isSelected = selectedWeight?.id === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWeight(w)}
                    className={`min-h-[26px] sm:min-h-[30px] py-0.5 px-2 rounded-lg text-[10px] sm:text-[11px] transition-all duration-200 flex items-center justify-center text-center leading-tight cursor-pointer tabular-nums whitespace-nowrap shrink-0 sm:flex-1 sm:min-w-[44px] ${
                      isSelected
                        ? 'bg-[#FFF9EE] text-[#261A13] border border-[#9A6836] font-extrabold shadow-2xs'
                        : 'text-[#5E4D40] hover:text-[#261A13] hover:bg-white/85 font-bold'
                    }`}
                  >
                    {getShortWeightLabel(w)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Centered Price Row + Price per 100g Transparency Badge (UX Constitution) */}
          <div className="text-center space-y-0.5 tabular-nums">
            <div className="flex items-baseline justify-center gap-1.5">
              {selectedWeight?.originalPrice &&
                selectedWeight.originalPrice > selectedWeight.price && (
                  <span className="text-[10px] sm:text-xs text-[#8A7968] line-through font-medium">
                    {selectedWeight.originalPrice} {currency}
                  </span>
                )}
              <span className="font-cairo text-sm sm:text-lg font-black text-[#261A13] leading-none">
                {selectedWeight?.price}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-[#9A6836]">
                {currency}
              </span>
            </div>
            {!unitMode &&
              selectedWeight &&
              (selectedWeight.weightGrams || selectedWeight.grams || 0) > 0 && (
                <div className="text-[10px] sm:text-[11px] font-medium text-[#6E5D4F]">
                  ({Math.round((selectedWeight.price / (selectedWeight.weightGrams || selectedWeight.grams || 250)) * 100)}{' '}
                  {currency} لكل 100 جم)
                </div>
              )}
          </div>

          {/* Primary Isolated Emerald "اطلب الآن" + Compact Cart Icon */}
          <div className="flex items-center gap-1.5">
            {product.inStock ? (
              <Link
                href={directOrderHref}
                className="flex-1 min-h-[36px] sm:min-h-[40px] py-1.5 px-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-cairo font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow-2xs transition-all duration-200 active:scale-[0.98]"
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>اطلب الآن</span>
              </Link>
            ) : (
              <span className="flex-1 min-h-[36px] sm:min-h-[40px] py-1.5 px-2.5 rounded-xl bg-[#F4EFE6] text-[#8A7968] border border-[#E8DFD3] font-cairo font-bold text-[11px] sm:text-xs flex items-center justify-center">
                غير متاح حالياً
              </span>
            )}

            <button
              type="button"
              disabled={!product.inStock}
              onClick={handleAdd}
              title={justAdded ? 'تمت الإضافة للسلة' : 'أضف إلى السلة'}
              aria-label={justAdded ? 'تمت الإضافة للسلة' : 'أضف إلى السلة'}
              className={`min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] px-2 rounded-xl border flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.96] shrink-0 ${
                !product.inStock
                  ? 'bg-[#F4EFE6] text-[#8A7968] border-[#E8DFD3] cursor-not-allowed'
                  : justAdded
                    ? 'bg-[#15803D] text-white border-[#15803D]'
                    : 'bg-[#FAF7F2] hover:bg-[#F3ECE2] text-[#261A13] border-[#D5C4AE]'
              }`}
            >
              {justAdded ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
