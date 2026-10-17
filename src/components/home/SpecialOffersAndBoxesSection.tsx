'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Flame,
  Clock,
  Crown,
  ShoppingBag,
  Gift,
  Coffee,
  ArrowLeft,
} from 'lucide-react';
import { FlashPromotion, PartitionedBoxSize, Product } from '@/types/store';
import {
  PARTITIONED_BOX_PRESETS,
  buildDefaultPartitionedBoxSlots,
} from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
import { useStore } from '@/context/StoreContext';

interface SpecialOffersAndBoxesSectionProps {
  promotions: FlashPromotion[];
  products: Product[];
}

export default function SpecialOffersAndBoxesSection({
  promotions,
  products,
}: SpecialOffersAndBoxesSectionProps) {
  const { addPartitionedBoxToCart, addFlashPromoToCart } = useStore();
  const [addedBoxId, setAddedBoxId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({
    hours: 11,
    minutes: 42,
    seconds: 19,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0)
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0)
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleQuickAddBox = (size: PartitionedBoxSize) => {
    const preset = PARTITIONED_BOX_PRESETS[size];
    const slots = buildDefaultPartitionedBoxSlots(size, products);
    addPartitionedBoxToCart(size, slots, preset.basePrice, 1);
    setAddedBoxId(size);
    setTimeout(() => setAddedBoxId(null), 1500);
  };

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* 1. Partitioned Boxes Showcase (بوكس الـ 125 جنيه وبوكسات اللمة المقسمة) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-xs font-black text-[#C88A4B] uppercase tracking-wider block">
              ★ البطل التسويقي الأول في بني مزار ★
            </span>
            <h2 className="font-cairo text-2xl sm:text-3xl font-black text-[#231710]">
              بوكس الـ 125 جنيه وبوكسات اللمة المقسمة
            </h2>
            <p className="text-xs sm:text-sm text-[#6E5D4F] mt-1">
              اختر بوكس السهرة الجاهز بضغطة واحدة أو ادخل الاستوديو التفاعلي واملأ كل خانة على ذوقك!
            </p>
          </div>
          <Link
            href="/build-box"
            className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto shadow-sm transition"
          >
            <Gift className="w-4 h-4" />
            <span>افتح استوديو تصميم البوكس التفاعلي</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(
            [
              {
                size: 'roqan_4' as PartitionedBoxSize,
                tag: 'الأكثر مبيعاً في بني مزار 🔥',
                sampleItems:
                  'لب سوبر محمص + لب أبيض + سوداني أسواني + مقرمشات بالجبنة',
                bgAccent: 'border-[#D4AF37] bg-white',
              },
              {
                size: 'family_6' as PartitionedBoxSize,
                tag: 'مثالي للسهرة العائلية 👨‍👩‍👧‍👦',
                sampleItems:
                  'لب سوبر + لب بطيخ + سوداني + مقرمشات سوري + كاجو + لوز',
                bgAccent: 'border-[#C88A4B] bg-white',
              },
              {
                size: 'vip_6' as PartitionedBoxSize,
                tag: 'ضيافة ملكية وهدايا فاخرة 👑',
                sampleItems:
                  'فستق أمريكي + كاجو جامبو + بندق تركي + لوز + عين جمل + مشكل ملكي',
                bgAccent:
                  'border-[#231710] bg-gradient-to-b from-[#231710] to-[#332218] text-white',
              },
            ] as const
          ).map((card) => {
            const preset = PARTITIONED_BOX_PRESETS[card.size];
            const isVipCard = card.size === 'vip_6';
            const isJustAdded = addedBoxId === card.size;

            return (
              <div
                key={card.size}
                className={`rounded-3xl border-2 p-5 shadow-md flex flex-col justify-between gap-4 transition hover:shadow-xl ${card.bgAccent}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10.5px] font-black px-3 py-1 rounded-full ${
                        isVipCard
                          ? 'bg-[#D4AF37] text-[#231710]'
                          : 'bg-[#F3ECE1] text-[#231710] border border-[#D4AF37]'
                      }`}
                    >
                      {card.tag}
                    </span>
                    <span
                      className={`text-xs font-extrabold tabular-nums ${
                        isVipCard ? 'text-[#D4AF37]' : 'text-[#6E5D4F]'
                      }`}
                    >
                      {preset.slotsCount} خانات ({preset.approximateTotalGrams} جم)
                    </span>
                  </div>

                  <h3
                    className={`font-cairo text-xl font-black ${
                      isVipCard ? 'text-white' : 'text-[#231710]'
                    }`}
                  >
                    {preset.title}
                  </h3>

                  <p
                    className={`text-xs leading-relaxed ${
                      isVipCard ? 'text-[#F3ECE1]/85' : 'text-[#6E5D4F]'
                    }`}
                  >
                    {preset.subtitle}
                  </p>

                  {/* Visual Compartment Grid Preview */}
                  <div
                    className={`grid ${
                      preset.slotsCount === 4 ? 'grid-cols-2' : 'grid-cols-3'
                    } gap-1.5 p-2.5 rounded-2xl border ${
                      isVipCard
                        ? 'bg-white/5 border-[#D4AF37]/30'
                        : 'bg-[#F3ECE1]/70 border-[#E6DFD3]'
                    }`}
                  >
                    {Array.from({ length: preset.slotsCount }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl p-2 text-center text-[10px] font-bold border ${
                          isVipCard
                            ? 'bg-[#231710] border-[#D4AF37]/40 text-[#D4AF37]'
                            : 'bg-white border-[#E6DFD3] text-[#231710]'
                        }`}
                      >
                        خانة {idx + 1} ({preset.gramsPerSlot}ج)
                      </div>
                    ))}
                  </div>

                  <p
                    className={`text-[11px] font-bold ${
                      isVipCard ? 'text-[#D4AF37]' : 'text-[#3B6E4C]'
                    }`}
                  >
                    ✨ تشكيلة جاهزة: {card.sampleItems}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E6DFD3]/40 flex items-center justify-between gap-2">
                  <div className="tabular-nums">
                    <span
                      className={`text-[10px] block font-bold ${
                        isVipCard ? 'text-[#F3ECE1]/70' : 'text-[#6E5D4F]'
                      }`}
                    >
                      السعر الثابت للبوكس
                    </span>
                    <span
                      className={`font-cairo text-2xl font-black ${
                        isVipCard ? 'text-[#D4AF37]' : 'text-[#231710]'
                      }`}
                    >
                      {preset.basePrice} ج.م
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/build-box?size=${card.size}`}
                      className={`px-3 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                        isVipCard
                          ? 'border-[#D4AF37] text-[#D4AF37] hover:bg-white/10'
                          : 'border-[#231710] text-[#231710] hover:bg-[#F3ECE1]'
                      }`}
                    >
                      خصّص الخانات
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleQuickAddBox(card.size)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        isJustAdded
                          ? 'bg-[#3B6E4C] text-white'
                          : isVipCard
                            ? 'bg-[#D4AF37] text-[#231710] hover:opacity-95'
                            : 'bg-[#231710] text-[#D4AF37] hover:bg-[#3A2519]'
                      }`}
                    >
                      {isJustAdded ? 'تمت الإضافة ✓' : 'أضف للسلة'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Flash Deals & Coffee Blender Studio Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {promotions.length > 0 && (
          <div className="bg-gradient-to-l from-[#231710] via-[#2D1E15] to-[#231710] rounded-3xl p-5 sm:p-7 text-[#FAF6F0] border-2 border-[#D4AF37]/50 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/15">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-[#B83B2B] text-white text-[10.5px] font-black px-3 py-1 rounded-full">
                  <Flame className="w-3.5 h-3.5" />
                  <span>عروض الشريك الرابع الحصرية • خصومات نهاية الأسبوع ببني مزار</span>
                </div>
                <h2 className="font-cairo text-xl sm:text-2xl font-black text-white">
                  حزم التوفير الذكية وعروض السهرة الفورية
                </h2>
              </div>

              <div className="flex items-center gap-2 bg-black/35 border border-[#D4AF37]/40 px-4 py-2.5 rounded-2xl shrink-0">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-bold text-[#F3ECE1]">ينتهي العرض خلال:</span>
                <div className="flex items-center gap-1 font-cairo font-black text-sm text-[#D4AF37] tabular-nums">
                  <span className="bg-[#231710] px-2 py-1 rounded-lg border border-[#D4AF37]/30">
                    {String(countdown.hours).padStart(2, '0')}س
                  </span>
                  <span>:</span>
                  <span className="bg-[#231710] px-2 py-1 rounded-lg border border-[#D4AF37]/30">
                    {String(countdown.minutes).padStart(2, '0')}د
                  </span>
                  <span>:</span>
                  <span className="bg-[#231710] px-2 py-1 rounded-lg border border-[#D4AF37]/30">
                    {String(countdown.seconds).padStart(2, '0')}ث
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="bg-[#FAF6F0] text-[#231710] rounded-2xl p-4 border border-[#D4AF37] flex flex-col justify-between gap-3 shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-[#B83B2B] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                        {promo.badge || promo.badgeText || 'عرض حصري 🔥'}
                      </span>
                      {promo.isVipOnly && (
                        <span className="bg-[#D4AF37]/25 text-[#231710] border border-[#D4AF37] text-[9.5px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Crown className="w-3 h-3 text-[#C88A4B]" />
                          <span>لأعضاء VIP</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-cairo text-sm sm:text-base font-black text-[#231710]">
                      {promo.title}
                    </h3>
                    <p className="text-xs text-[#6E5D4F] leading-relaxed">
                      {promo.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E6DFD3]">
                    <div className="tabular-nums">
                      <span className="text-[10px] text-[#6E5D4F] line-through block">
                        بدلاً من {promo.originalRetailPrice || promo.originalPrice} ج.م
                      </span>
                      <span className="font-cairo text-lg font-black text-[#3B6E4C]">
                        {promo.promoPrice} ج.م
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        addFlashPromoToCart(
                          promo.id,
                          promo.title,
                          promo.promoPrice,
                          getSafeImageUrl(promo.image)
                        )
                      }
                      className="bg-[#231710] hover:bg-[#3A2519] text-[#D4AF37] font-cairo font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>اطلب الباقة فوراً</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Coffee Blender Interactive Studio Callout */}
        <div className="bg-gradient-to-r from-[#231710] via-[#3A2519] to-[#231710] rounded-3xl p-5 sm:p-7 text-[#FAF6F0] border-2 border-[#D4AF37]/50 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-3 py-1 rounded-full text-xs font-black">
              <Coffee className="w-3.5 h-3.5" />
              <span>صوامع البن النحاسية الأربعة • مطحن ألماني فوري</span>
            </span>
            <h2 className="font-cairo text-xl sm:text-2xl font-black text-white">
              صمّم توليفة قهوتك الخاصة بالجرام مع استيكر الباريستا الذهبي باسمك
            </h2>
            <p className="text-xs sm:text-sm text-[#F3ECE1]/85 leading-relaxed">
              امزج بين البن البرازيلي، الكولومبي، الحبشي، والهندي وحدد درجة التحميص والتحويجة بالحبهان والزعفران ونوع الطحنة.
            </p>
          </div>
          <Link
            href="/coffee-blender"
            className="bg-gradient-to-l from-[#D4AF37] to-[#C88A4B] hover:opacity-95 text-[#231710] font-cairo font-black text-xs sm:text-sm px-5 py-3.5 rounded-2xl shadow-lg flex items-center gap-2 shrink-0 transition"
          >
            <Coffee className="w-4 h-4" />
            <span>⚙️ افتح معمل توليفة البن</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
