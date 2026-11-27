'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Gift,
  ArrowLeft,
  Check,
  Percent,
} from 'lucide-react';
import { FlashPromotion, PartitionedBoxSize, Product } from '@/types/store';
import {
  PARTITIONED_BOX_PRESETS,
  buildDefaultPartitionedBoxSlots,
} from '@/lib/pricing';
import {
  getCurrencySymbol,
  getResolvedFeatureFlags,
  getResolvedPageContent,
  getSafeImageUrl,
  stripUiEmojis,
} from '@/lib/defaults';
import { useStore } from '@/context/StoreContext';
import ProductCard from '@/components/ProductCard';

interface SpecialOffersAndBoxesSectionProps {
  promotions: FlashPromotion[];
  products: Product[];
}

const BOX_CARDS: ReadonlyArray<{
  size: PartitionedBoxSize;
  subtitle: string;
}> = [
  {
    size: 'roqan_4',
    subtitle: 'تشكيلة متوازنة لسهرات الأصدقاء والعائلة الصغيرة',
  },
  {
    size: 'family_6',
    subtitle: 'تنوع أكبر بـ ٦ أصناف مختارة بعناية للضيافة والعائلة',
  },
  {
    size: 'vip_6',
    subtitle: 'تشكيلة المكسرات الفاخرة والضيافة الخاصة بوزن أوفر',
  },
];

export default function SpecialOffersAndBoxesSection({
  promotions,
  products,
}: SpecialOffersAndBoxesSectionProps) {
  const { storeData, addPartitionedBoxToCart, addFlashPromoToCart } = useStore();
  const [addedBoxId, setAddedBoxId] = useState<string | null>(null);
  const settings = storeData?.settings;
  const featureFlags = getResolvedFeatureFlags(settings);
  const pageContent = getResolvedPageContent(settings);
  const currency = getCurrencySymbol(settings);

  const onlineProducts = useMemo(
    () => products.filter((p) => p.showOnline !== false),
    [products]
  );

  const discountedProducts = useMemo(() => {
    return onlineProducts
      .filter((p) =>
        p.weights?.some(
          (w) => Boolean(w.originalPrice && w.originalPrice > w.price)
        )
      )
      .slice(0, 4);
  }, [onlineProducts]);

  const handleQuickAddBox = (size: PartitionedBoxSize) => {
    const preset = PARTITIONED_BOX_PRESETS[size];
    const slots = buildDefaultPartitionedBoxSlots(
      size,
      onlineProducts.length > 0 ? onlineProducts : products
    );
    addPartitionedBoxToCart(size, slots, preset.basePrice, 1);
    setAddedBoxId(size);
    setTimeout(() => setAddedBoxId(null), 1500);
  };

  return (
    <div id="special-offers" className="space-y-8 sm:space-y-14 scroll-mt-24">
      {/* 1. Harmonious "العروض والخصومات" 4-Column Product Grid (Discounted Items Only — No Duplication) */}
      {discountedProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-[#FDF2F0] text-[#B84A39] border border-[#F2D6D0] px-3 py-1 rounded-full text-[11px] sm:text-xs font-cairo font-extrabold">
              <Percent className="w-3.5 h-3.5" />
              <span>تخفيضات حصرية</span>
            </div>
            <h2 className="font-cairo text-lg sm:text-2xl lg:text-[28px] font-black text-[#261A13]">
              العروض والخصومات
            </h2>
            <p className="text-[11px] sm:text-sm text-[#6E5D4F]">
              أقوى العروض اليومية على المكسرات المختارة
            </p>
            <div className="w-12 h-1 bg-gradient-to-r from-[#9A6836] to-[#E5B869] rounded-full mx-auto pt-0.5" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-5">
            {discountedProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </section>
      )}

      {/* 2. Active Bundle Offers */}
      {promotions.length > 0 && pageContent.showFlashDealsSection !== false && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#261A13]">
              {pageContent.flashDealsTitle || 'باقات التوفير العائلية'}
            </h2>
            <p className="text-xs sm:text-sm text-[#6E5D4F]">
              {pageContent.flashDealsSubtitle ||
                'باقات مجمّعة بأسعار مخفضة جاهزة للطلب الفوري'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {promotions.map((promo) => {
              const cleanBadge = stripUiEmojis(
                promo.badge || promo.badgeText || 'باقة توفير'
              );
              const cleanTitle = stripUiEmojis(promo.title);
              const orig = promo.originalRetailPrice || promo.originalPrice;
              const pct =
                orig && orig > promo.promoPrice
                  ? Math.round(((orig - promo.promoPrice) / orig) * 100)
                  : null;

              return (
                <div
                  key={promo.id}
                  className="bg-white rounded-2xl p-5 border border-[#E8DFD3] hover:border-[#C88A4B]/60 flex flex-col justify-between gap-4 shadow-[0_4px_20px_-10px_rgba(35,23,16,0.06)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-[#F6F1EA] text-[#9A6836] border border-[#EAE0D3] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                        {cleanBadge || 'عرض خاص'}
                      </span>
                      {pct ? (
                        <span className="bg-[#B84A39] text-[#FAF7F2] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full tabular-nums">
                          -{pct}%
                        </span>
                      ) : promo.isVipOnly ? (
                        <span className="bg-[#FBF3E4] text-[#8C5828] border border-[#EBD8B8] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                          لأعضاء VIP
                        </span>
                      ) : null}
                    </div>
                    <h3 className="font-cairo text-base font-extrabold text-[#261A13]">
                      {cleanTitle}
                    </h3>
                    {promo.subtitle && (
                      <p className="text-xs text-[#5E4D40] line-clamp-2 leading-relaxed">
                        {stripUiEmojis(promo.subtitle)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3.5 border-t border-[#F0EAE0]">
                    <div className="tabular-nums">
                      {orig && (
                        <span className="text-xs text-[#8A7968] line-through block">
                          {orig} {currency}
                        </span>
                      )}
                      <span className="font-cairo text-lg font-black text-[#261A13]">
                        {promo.promoPrice}{' '}
                        <span className="text-xs font-bold text-[#9A6836]">
                          {currency}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        addFlashPromoToCart(
                          promo.id,
                          cleanTitle,
                          promo.promoPrice,
                          getSafeImageUrl(promo.image)
                        )
                      }
                      className="min-h-[42px] bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] font-cairo font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>أضف للسلة</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Partitioned Gift Boxes Section */}
      {featureFlags.enableCustomBoxes && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#261A13]">
                {featureFlags.boxesModuleLabel || 'بوكسات الضيافة المقسمة'}
              </h2>
              <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
                اطلب البوكس الجاهز مباشرة أو خصّص أصناف كل قسم حسب ذوقك
              </p>
            </div>
            <Link
              href="/build-box"
              className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-cairo font-extrabold text-[#9A6836] hover:text-[#261A13] self-start sm:self-auto transition-colors"
            >
              <Gift className="w-4 h-4" />
              <span>تخصيص بوكس حسب الطلب</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {BOX_CARDS.map((card) => {
              const preset = PARTITIONED_BOX_PRESETS[card.size];
              const isJustAdded = addedBoxId === card.size;

              return (
                <div
                  key={card.size}
                  className="rounded-2xl bg-white border border-[#E8DFD3] p-6 flex flex-col justify-between gap-6 shadow-[0_4px_20px_-10px_rgba(35,23,16,0.06)] hover:border-[#C88A4B]/60 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#9A6836] font-bold tabular-nums">
                      <span className="bg-[#F6F1EA] text-[#261A13] px-2.5 py-0.5 rounded-full border border-[#EAE0D3]">
                        {preset.slotsCount} أقسام منفصلة
                      </span>
                      <span>حوالي {preset.approximateTotalGrams} جم</span>
                    </div>

                    <h3 className="font-cairo text-lg sm:text-xl font-extrabold text-[#261A13]">
                      {preset.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-[#5E4D40] leading-relaxed">
                      {card.subtitle} ({preset.gramsPerSlot} جم لكل قسم).
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#F0EAE0] flex items-center justify-between gap-3">
                    <div className="tabular-nums">
                      <span className="font-cairo text-xl font-black text-[#261A13]">
                        {preset.basePrice}
                      </span>
                      <span className="text-xs text-[#9A6836] font-bold mr-1">
                        {currency}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/build-box?size=${card.size}`}
                        className="min-h-[42px] inline-flex items-center justify-center px-3.5 py-2 rounded-xl text-xs font-bold border border-[#E8DFD3] bg-[#FAF7F2] hover:bg-[#F3ECE2] text-[#261A13] transition-colors"
                      >
                        تخصيص
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleQuickAddBox(card.size)}
                        className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-1.5 ${
                          isJustAdded
                            ? 'bg-[#3B6E4C] text-white'
                            : 'bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2]'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تمت الإضافة</span>
                          </>
                        ) : (
                          <span>أضف للسلة</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
