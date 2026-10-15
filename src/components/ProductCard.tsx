'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Star,
  Eye,
  Check,
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
  const selectedRoast: RoastOption = product.roastOptions[0] || 'محمص مملح';
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

  const isEditorial = themeConfig.cardStyle === 'editorial';

  return (
    <div className="theme-product-card group bg-white rounded-xl border border-brand-200/70 shadow-2xs hover:shadow-md hover:border-brand-300 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image Header */}
      <div
        className={`relative h-48 sm:h-52 md:h-56 w-full overflow-hidden bg-brand-100 ${
          isEditorial ? 'p-1 bg-brand-50 border-b border-brand-200/60' : ''
        }`}
      >
        <Link
          href={`/products/${product.slug || product.id}`}
          className={`block w-full h-full overflow-hidden ${isEditorial ? 'rounded-lg' : ''}`}
        >
          <img
            src={getSafeImageUrl(product.image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
          />
        </Link>

        {/* Subtle Top Badge */}
        {(product.badge || discountPercent) && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {product.badge && (
              <span className="bg-brand-950/85 backdrop-blur-xs text-gold-400 text-[8.5px] font-bold px-2 py-0.5 rounded-full">
                {product.badge}
              </span>
            )}
            {discountPercent && (
              <span className="bg-pistachio-600/95 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded-full">
                -{discountPercent}%
              </span>
            )}
          </div>
        )}

        {/* Quick View Button */}
        <button
          onClick={() => setSelectedProductModal(product)}
          className="absolute top-2 left-2 bg-white/85 hover:bg-white text-brand-900 p-1.5 rounded-full shadow-2xs opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="عرض التفاصيل السريعة"
        >
          <Eye className="w-3 h-3" />
        </button>
      </div>

      {/* Clean Minimal Card Body */}
      <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
        {/* Title, Rating & Subtitle */}
        <div>
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-[11px] sm:text-xs font-extrabold text-brand-950 hover:text-brand-700 line-clamp-1 leading-tight transition">
              <Link href={`/products/${product.slug || product.id}`}>
                {product.name}
              </Link>
            </h3>
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-brand-700 shrink-0">
              <Star className="w-2.5 h-2.5 text-gold-500 fill-gold-500" />
              {product.rating}
            </span>
          </div>
          <p className="text-[9px] text-brand-500 mt-0.5 line-clamp-1 leading-tight">
            {product.subtitle}
          </p>
        </div>

        {/* Single Sleek Weight Switcher + Price & Add Button */}
        <div className="space-y-1.5">
          {/* Minimal Segmented Weight Bar (No heavy borders) */}
          <div className="flex items-center bg-brand-50/80 p-0.5 rounded-lg gap-0.5">
            {product.weights.map((w) => {
              const isSelected = selectedWeight?.id === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWeight(w)}
                  className={`flex-1 py-0.5 px-1 rounded-md text-[8.5px] font-bold transition text-center leading-tight cursor-pointer ${
                    isSelected
                      ? 'bg-white text-brand-950 shadow-2xs font-extrabold'
                      : 'text-brand-600 hover:text-brand-900'
                  }`}
                >
                  {w.weightGrams >= 1000 ? `${w.weightGrams / 1000} كجم` : `${w.weightGrams} جم`}
                </button>
              );
            })}
          </div>

          {/* Price & Add to Cart Row */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <div className="flex items-baseline gap-0.5 shrink-0">
              <span className="text-xs sm:text-[13px] font-black text-brand-950 leading-none">
                {selectedWeight?.price}
              </span>
              <span className="text-[8.5px] font-bold text-brand-700">ج.م</span>
              {selectedWeight?.originalPrice && (
                <span className="text-[8px] text-gray-400 line-through">
                  {selectedWeight.originalPrice}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!product.inStock}
              onClick={handleAdd}
              className={`py-1.5 px-2.5 rounded-lg font-bold text-[9.5px] flex items-center justify-center gap-1 transition active:scale-95 leading-none cursor-pointer ${
                !product.inStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : justAdded
                  ? 'bg-pistachio-600 text-white'
                  : 'bg-brand-900 hover:bg-brand-950 text-white'
              }`}
            >
              {!product.inStock ? (
                <span>نفد</span>
              ) : justAdded ? (
                <>
                  <Check className="w-2.5 h-2.5 shrink-0" />
                  <span>تمت</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-2.5 h-2.5 text-gold-400 shrink-0" />
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
