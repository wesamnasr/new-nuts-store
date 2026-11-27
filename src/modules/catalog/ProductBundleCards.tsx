'use client';

import React, { useMemo } from 'react';
import { Truck, Sparkles, Check } from 'lucide-react';
import { Product, WeightVariant } from '@/types/store';
import { getProductPriceForWeight, isUnitProduct } from '@/lib/pricing';

interface ProductBundleCardsProps {
  product: Product;
  availableWeights: WeightVariant[];
  selectedWeight: WeightVariant;
  onSelectWeight: (w: WeightVariant) => void;
  currency: string;
  freeShippingThreshold: number;
}

function getTierPresentation(
  variant: WeightVariant,
  unitMode: boolean,
  has1kgExpensive: boolean
): { title: string; subtitle: string; badgeText?: string; badgeTone?: 'gold' | 'emerald' } {
  if (unitMode) {
    const count = variant.unitsCount || 1;
    return {
      title: variant.label,
      subtitle: count > 1 ? `عبوة عائلية موفرة (${count} قطع)` : 'العبوة الأساسية جاهزة للتسليم',
      badgeText: count >= 3 ? 'أفضل قيمة' : undefined,
      badgeTone: count >= 3 ? 'gold' : undefined,
    };
  }

  const grams = variant.weightGrams || variant.grams || 0;
  if (grams === 250) {
    return {
      title: 'ربع كيلو (٢٥٠ جم)',
      subtitle: 'كيس واحد للتجربة السريعة',
    };
  }
  if (grams === 500) {
    return {
      title: 'نصف كيلو (٥٠٠ جم)',
      subtitle: 'الحجم المثالي للسهرة والبيت',
      badgeText: has1kgExpensive ? 'الأكثر طلباً' : 'اختيار ممتاز',
      badgeTone: 'gold',
    };
  }
  if (grams === 1000) {
    return {
      title: 'كيلو كامل (١٠٠٠ جم)',
      subtitle: 'كيسين نصف كيلو محكمين الغلق',
      badgeText: has1kgExpensive ? 'أفضل قيمة' : 'الأكثر طلباً',
      badgeTone: 'gold',
    };
  }
  if (grams === 2000) {
    return {
      title: 'عرض العيلة — ٢ كيلو (٤ أكياس نصف كيلو)',
      subtitle: 'يكفي العيلة والضيوف بأعلى توفير',
      badgeText: 'عرض العيلة',
      badgeTone: 'emerald',
    };
  }

  return {
    title: variant.label,
    subtitle: 'معبأ طازج ومغلف حرارياً',
  };
}

export default function ProductBundleCards({
  product,
  availableWeights,
  selectedWeight,
  onSelectWeight,
  currency,
  freeShippingThreshold,
}: ProductBundleCardsProps) {
  const unitMode = isUnitProduct(product);

  const baseRefWeight = useMemo(() => {
    if (unitMode) return availableWeights[0];
    return (
      availableWeights.find((w) => (w.weightGrams || w.grams) === 250) || availableWeights[0]
    );
  }, [availableWeights, unitMode]);

  const offerVariants = useMemo(() => {
    if (unitMode) {
      return availableWeights;
    }

    const filtered = availableWeights.filter((w) => {
      const g = w.weightGrams || w.grams || 0;
      return g !== 125;
    });
    const list = filtered.length > 0 ? [...filtered] : [...availableWeights];

    const has2000 = list.some((w) => (w.weightGrams || w.grams) === 2000);
    if (!has2000) {
      const p2000 = getProductPriceForWeight(product, 2000);
      if (p2000 > 0) {
        const w1000 = list.find((w) => (w.weightGrams || w.grams) === 1000);
        const orig2000 =
          w1000?.originalPrice && w1000.originalPrice * 2 > p2000
            ? w1000.originalPrice * 2
            : undefined;
        list.push({
          id: 'w-2000',
          label: '2 كجم (2000 جم)',
          weightGrams: 2000,
          grams: 2000,
          price: p2000,
          originalPrice: orig2000,
        });
      }
    }

    return list;
  }, [availableWeights, product, unitMode]);

  const kiloVariantPrice = useMemo(() => {
    if (unitMode) return 0;
    const w1000 = offerVariants.find((w) => (w.weightGrams || w.grams) === 1000);
    return w1000?.price || product.pricePerKg || 0;
  }, [offerVariants, product.pricePerKg, unitMode]);

  const has1kgExpensive = kiloVariantPrice > 750;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs sm:text-sm font-extrabold text-[#261A13]">
          {unitMode ? '١. اختر الباقة أو العدد المناسب:' : '١. اختر الباقة المناسبة:'}
        </label>
        <span className="text-[10px] sm:text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full">
          شحن مجاني فوق {freeShippingThreshold} {currency}
        </span>
      </div>

      <div className="space-y-2">
        {offerVariants.map((w) => {
          const isSelected = selectedWeight.id === w.id;
          const grams = w.weightGrams || w.grams || 0;
          const presentation = getTierPresentation(w, unitMode, has1kgExpensive);

          const hasOriginalDiscount = Boolean(w.originalPrice && w.originalPrice > w.price);
          const originalSavings = hasOriginalDiscount
            ? Math.round((w.originalPrice || 0) - w.price)
            : 0;

          const baseGrams = baseRefWeight?.weightGrams || baseRefWeight?.grams || 250;
          const bulkSavings =
            !unitMode && baseRefWeight && grams > baseGrams && baseGrams > 0
              ? Math.max(0, Math.round((baseRefWeight.price / baseGrams) * grams - w.price))
              : 0;

          const displaySavings = Math.max(originalSavings, bulkSavings);
          const unlocksFreeGovShipping = w.price >= freeShippingThreshold;

          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelectWeight(w)}
              className={`w-full text-right rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 transition-all duration-200 cursor-pointer flex items-center justify-between gap-2.5 ${
                isSelected
                  ? 'bg-[#FFFBF2] border-2 border-[#9A6836] ring-2 ring-[#E5B869]/30 shadow-sm'
                  : 'bg-white border border-[#E8DFD3] hover:border-[#C88A4B] hover:bg-[#FFFEFC]'
              }`}
            >
              {/* Right side: Custom Radio + Title + Badges */}
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                    isSelected
                      ? 'border-[#9A6836] bg-[#9A6836] text-white'
                      : 'border-[#CFC3B4] bg-white'
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                </span>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-cairo text-xs sm:text-sm font-extrabold text-[#261A13]">
                      {presentation.title}
                    </span>

                    {unlocksFreeGovShipping ? (
                      <span className="inline-flex items-center gap-1 bg-[#15803D] text-white text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        <Truck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>شحن مجاني لكل مصر</span>
                      </span>
                    ) : presentation.badgeText ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          presentation.badgeTone === 'emerald'
                            ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                            : 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{presentation.badgeText}</span>
                      </span>
                    ) : null}
                  </div>

                  <p className="text-[10px] sm:text-[11px] text-[#6E5D4F] leading-snug">
                    {presentation.subtitle}
                  </p>
                </div>
              </div>

              {/* Left side: Price + Anchor + Real Savings */}
              <div className="text-left shrink-0 tabular-nums space-y-0.5">
                <div className="font-cairo text-sm sm:text-lg font-black text-[#261A13] leading-none">
                  {w.price} <span className="text-[11px] font-bold text-[#9A6836]">{currency}</span>
                </div>
                {hasOriginalDiscount && (
                  <div className="text-[10px] text-[#8A7968] line-through font-bold">
                    {w.originalPrice} {currency}
                  </div>
                )}
                {displaySavings > 0 && (
                  <div className="inline-block text-[9px] sm:text-[10px] font-extrabold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded-md">
                    وفّر {displaySavings} {currency}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
