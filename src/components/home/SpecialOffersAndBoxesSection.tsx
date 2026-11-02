'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Gift,
  Coffee,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { FlashPromotion, PartitionedBoxSize, Product } from '@/types/store';
import {
  PARTITIONED_BOX_PRESETS,
  buildDefaultPartitionedBoxSlots,
} from '@/lib/pricing';
import { getSafeImageUrl, stripUiEmojis } from '@/lib/defaults';
import { useStore } from '@/context/StoreContext';

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
    subtitle: 'تنوع أكبر بـ 6 أصناف مختارة بعناية للضيافة والعائلة',
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
  const { addPartitionedBoxToCart, addFlashPromoToCart } = useStore();
  const [addedBoxId, setAddedBoxId] = useState<string | null>(null);

  const handleQuickAddBox = (size: PartitionedBoxSize) => {
    const preset = PARTITIONED_BOX_PRESETS[size];
    const onlineProducts = products.filter((p) => p.showOnline !== false);
    const slots = buildDefaultPartitionedBoxSlots(
      size,
      onlineProducts.length > 0 ? onlineProducts : products
    );
    addPartitionedBoxToCart(size, slots, preset.basePrice, 1);
    setAddedBoxId(size);
    setTimeout(() => setAddedBoxId(null), 1500);
  };

  return (
    <div className="space-y-14 sm:space-y-16">
      {/* 1. Calm Partitioned Boxes Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
              بوكسات السهرة المقسمة
            </h2>
            <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
              اطلب التشكيلة الجاهزة مباشرة أو خصّص أصناف كل خانة حسب ذوقك
            </p>
          </div>
          <Link
            href="/build-box"
            className="inline-flex items-center gap-1.5 text-sm font-cairo font-bold text-[#231710] hover:text-[#9A6836] self-start sm:self-auto transition"
          >
            <Gift className="w-4 h-4 text-[#9A6836]" />
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
                className="rounded-2xl bg-white border border-[#E8E0D5] p-6 flex flex-col justify-between gap-6 hover:border-[#231710]/25 transition"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6E5D4F] font-medium tabular-nums">
                    <span>{preset.slotsCount} أقسام منفصلة</span>
                    <span>حوالي {preset.approximateTotalGrams} جم</span>
                  </div>

                  <h3 className="font-cairo text-lg sm:text-xl font-bold text-[#231710]">
                    {preset.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#5C4A3D] leading-relaxed">
                    {card.subtitle} ({preset.gramsPerSlot} جم لكل قسم).
                  </p>
                </div>

                <div className="pt-4 border-t border-[#F0EAE0] flex items-center justify-between gap-3">
                  <div className="tabular-nums">
                    <span className="font-cairo text-xl font-bold text-[#231710]">
                      {preset.basePrice}
                    </span>
                    <span className="text-xs text-[#6E5D4F] font-medium mr-1">
                      ج.م
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/build-box?size=${card.size}`}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#E8E0D5] bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] transition"
                    >
                      تخصيص
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleQuickAddBox(card.size)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        isJustAdded
                          ? 'bg-[#3B6E4C] text-white'
                          : 'bg-[#231710] hover:bg-[#362419] text-[#FAF6F0]'
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

      {/* 2. Active Bundle Offers (Calm Light Presentation, Zero Fake Countdown) */}
      {promotions.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <div>
            <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
              باقات التوفير المختارة
            </h2>
            <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
              عروض حقيقية مجمّعة بأسعار مخفضة من المحمصة مباشرة
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {promotions.map((promo) => {
              const cleanBadge = stripUiEmojis(promo.badge || promo.badgeText || 'باقة توفير');
              const cleanTitle = stripUiEmojis(promo.title);

              return (
                <div
                  key={promo.id}
                  className="bg-white rounded-2xl p-5 border border-[#E8E0D5] flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-[#FAF6F0] text-[#9A6836] border border-[#E8E0D5] text-[11px] font-bold px-2.5 py-0.5 rounded-lg">
                        {cleanBadge || 'عرض خاص'}
                      </span>
                      {promo.isVipOnly && (
                        <span className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-[11px] font-bold px-2.5 py-0.5 rounded-lg">
                          لأعضاء VIP
                        </span>
                      )}
                    </div>
                    <h3 className="font-cairo text-base font-bold text-[#231710]">
                      {cleanTitle}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-3.5 border-t border-[#F0EAE0]">
                    <div className="tabular-nums">
                      {(promo.originalRetailPrice || promo.originalPrice) && (
                        <span className="text-xs text-[#8A7968] line-through block">
                          {promo.originalRetailPrice || promo.originalPrice} ج.م
                        </span>
                      )}
                      <span className="font-cairo text-lg font-bold text-[#231710]">
                        {promo.promoPrice} ج.م
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
                      className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
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

      {/* 3. Calm Coffee Blender Studio Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E0D5] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9A6836]">
              <Coffee className="w-4 h-4" />
              <span>معمل توليفة البن</span>
            </div>
            <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
              ركّب توليفة قهوتك الخاصة بالجرام ودرجة التحميص والتحويجة
            </h2>
            <p className="text-xs sm:text-sm text-[#5C4A3D]">
              امزج البن البرازيلي والكولومبي والحبشي بنسب دقيقة مع اختيار الحبهان وجوزة الطيب والطحن الطازج قبل الشحن مباشرة.
            </p>
          </div>
          <Link
            href="/coffee-blender"
            className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-sm px-6 py-3.5 rounded-xl flex items-center gap-2 shrink-0 transition"
          >
            <span>ابدأ تركيب التوليفة</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
