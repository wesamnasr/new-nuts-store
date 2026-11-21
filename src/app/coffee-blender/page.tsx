'use client';

import React, { useState, useMemo } from 'react';
import {
  Coffee,
  Flame,
  Check,
  ShoppingBag,
  Printer,
  Wand2,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { updateUrlQueryParams, useBrowserUrlSync } from '@/lib/url-sync';
import {
  COFFEE_ORIGINS,
  COFFEE_ROAST_LEVELS,
  COFFEE_SPICING_OPTIONS,
  COFFEE_GRIND_TYPES,
  calculateCoffeeBlendPrice,
} from '@/lib/pricing';
import {
  CoffeeGrindType,
  CoffeeRoastLevel,
  CoffeeSpicingOption,
  WeightGrams,
} from '@/types/store';

export default function CoffeeBlenderPage() {
  const { storeData, addCoffeeBlendToCart, setIsCartOpen } = useStore();
  const storeName = storeData?.settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const cityName = storeData?.settings?.cityName || 'الفرع الرئيسي';

  // Origin percentages (must total 100%)
  const [brazilianPercent, setBrazilianPercent] = useState<number>(50);
  const [colombianPercent, setColombianPercent] = useState<number>(30);
  const [habashiPercent, setHabashiPercent] = useState<number>(0);
  const [indianPercent, setIndianPercent] = useState<number>(20);

  // Step 2, 3, 4 states
  const [roastLevel, setRoastLevel] = useState<CoffeeRoastLevel>('وسط (مضبوط)');
  const [spicing, setSpicing] = useState<CoffeeSpicingOption>('محوج مخصوص بحبهان وزر ورد');
  const [grindType, setGrindType] = useState<CoffeeGrindType>('ماكينة تركي ناعم');
  const [weightGrams, setWeightGrams] = useState<WeightGrams>(250);
  const [customBlendName, setCustomBlendName] = useState<string>('توليفة المزاج الملكي');
  const [justAdded, setJustAdded] = useState<boolean>(false);

  useBrowserUrlSync((params) => {
    const presetParam = params.get('preset');
    if (presetParam === 'royal') {
      setCustomBlendName('التوليفة الملكية الخاصة');
      setBrazilianPercent(50);
      setColombianPercent(30);
      setHabashiPercent(0);
      setIndianPercent(20);
      setRoastLevel('وسط (مضبوط)');
      setSpicing('محوج مخصوص بحبهان وزر ورد');
    } else if (presetParam === 'ameed') {
      setCustomBlendName('خلطة العميد الفاخرة');
      setBrazilianPercent(40);
      setColombianPercent(40);
      setHabashiPercent(20);
      setIndianPercent(0);
      setRoastLevel('وسط (مضبوط)');
      setSpicing('محوج ملكي بالحبهان والزعفران وجوزة الطيب');
    } else if (presetParam === 'turkish') {
      setCustomBlendName('توليفة وش تركي كثيف');
      setBrazilianPercent(60);
      setColombianPercent(0);
      setHabashiPercent(10);
      setIndianPercent(30);
      setRoastLevel('غامق (ثقيل)');
      setSpicing('محوج عادي بحبهان فاخر');
    }

    const rParam = params.get('roast') as CoffeeRoastLevel | null;
    if (rParam && COFFEE_ROAST_LEVELS.includes(rParam)) {
      setRoastLevel(rParam);
    }
    const sParam = params.get('spicing') as CoffeeSpicingOption | null;
    if (sParam && COFFEE_SPICING_OPTIONS.some((s) => s.option === sParam)) {
      setSpicing(sParam);
    }
    const gParam = params.get('grind') as CoffeeGrindType | null;
    if (gParam && COFFEE_GRIND_TYPES.includes(gParam)) {
      setGrindType(gParam);
    }
    const wParam = Number(params.get('weight')) as WeightGrams;
    if ([125, 250, 500, 1000].includes(wParam)) {
      setWeightGrams(wParam);
    }
  });

  const applyPresetBlend = (
    name: string,
    braz: number,
    col: number,
    hab: number,
    ind: number,
    roast: CoffeeRoastLevel,
    spic: CoffeeSpicingOption
  ) => {
    setCustomBlendName(name);
    setBrazilianPercent(braz);
    setColombianPercent(col);
    setHabashiPercent(hab);
    setIndianPercent(ind);
    setRoastLevel(roast);
    setSpicing(spic);
    const presetSlug =
      name.includes('الملكية') ? 'royal' : name.includes('العميد') ? 'ameed' : 'turkish';
    updateUrlQueryParams({ preset: presetSlug, roast, spicing: spic });
  };

  const blendCalc = useMemo(
    () =>
      calculateCoffeeBlendPrice({
        brazilianPercent,
        indianPercent,
        colombianPercent,
        habashiPercent,
        roastLevel,
        spicing,
        grindType,
        weightGrams,
        customBlendName,
      }),
    [
      brazilianPercent,
      indianPercent,
      colombianPercent,
      habashiPercent,
      roastLevel,
      spicing,
      grindType,
      weightGrams,
      customBlendName,
    ]
  );

  const handleAddBlend = () => {
    if (!blendCalc.isValid) return;
    addCoffeeBlendToCart(blendCalc.spec, blendCalc.totalPrice, 1);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setIsCartOpen(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Compact Header + 3-Step Indicator */}
      <div className="bg-white border-b border-[#E8E0D5] py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[#9A6836] text-xs font-bold">
              <Coffee className="w-4 h-4" />
              <span>معمل توليفة البن الطازج</span>
            </span>
            <h1 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
              صمّم توليفة قهوتك الخاصة في 3 خطوات
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
              <span className="w-5 h-5 rounded-full bg-[#231710] text-white text-[11px] flex items-center justify-center">1</span>
              <span>النسب أو الجاهز</span>
            </span>
            <span className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
              <span className="w-5 h-5 rounded-full bg-[#231710] text-white text-[11px] flex items-center justify-center">2</span>
              <span>التحميص والطحنة</span>
            </span>
            <span className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
              <span className="w-5 h-5 rounded-full bg-[#231710] text-white text-[11px] flex items-center justify-center">3</span>
              <span>الوزن والإضافة</span>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main Studio Steps (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Step 1: Ready Presets OR Custom Origin Sliders */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E0D5] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-cairo text-base sm:text-lg font-bold text-[#231710] flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <span>اختر خلطة جاهزة أو اضبط نسب البن (100%)</span>
              </h2>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-bold tabular-nums ${
                  blendCalc.totalPercentage === 100
                    ? 'bg-[#3B6E4C]/10 text-[#3B6E4C]'
                    : 'bg-[#B83B2B]/10 text-[#B83B2B]'
                }`}
              >
                المجموع: {blendCalc.totalPercentage}%
              </span>
            </div>

            {/* Quick Ready Blends */}
            <div className="flex flex-wrap gap-2 pb-1">
              <button
                type="button"
                onClick={() =>
                  applyPresetBlend(
                    'التوليفة الملكية الخاصة',
                    50,
                    30,
                    0,
                    20,
                    'وسط (مضبوط)',
                    'محوج مخصوص بحبهان وزر ورد'
                  )
                }
                className="min-h-[44px] bg-[#231710] text-white font-cairo font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition hover:bg-[#3A2519]"
              >
                <Wand2 className="w-4 h-4" />
                <span>التوليفة الملكية الخاصة</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPresetBlend(
                    'خلطة العميد الفاخرة',
                    40,
                    40,
                    20,
                    0,
                    'وسط (مضبوط)',
                    'محوج ملكي بالحبهان والزعفران وجوزة الطيب'
                  )
                }
                className="min-h-[44px] bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition"
              >
                خلطة العميد الفاخرة
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPresetBlend(
                    'توليفة وش تركي كثيف',
                    60,
                    0,
                    10,
                    30,
                    'غامق (ثقيل)',
                    'محوج عادي بحبهان فاخر'
                  )
                }
                className="min-h-[44px] bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition"
              >
                وش تركي كثيف
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  origin: COFFEE_ORIGINS[0],
                  val: brazilianPercent,
                  setter: setBrazilianPercent,
                },
                {
                  origin: COFFEE_ORIGINS[1],
                  val: colombianPercent,
                  setter: setColombianPercent,
                },
                {
                  origin: COFFEE_ORIGINS[2],
                  val: habashiPercent,
                  setter: setHabashiPercent,
                },
                {
                  origin: COFFEE_ORIGINS[3],
                  val: indianPercent,
                  setter: setIndianPercent,
                },
              ].map(({ origin, val, setter }) => (
                <div
                  key={origin.id}
                  className="bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E8E0D5] space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-cairo text-xs sm:text-sm font-bold text-[#231710]">
                        {origin.name} ({val}%)
                      </h3>
                      <p className="text-xs text-[#6E5D4F]">{origin.notes}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[0, 20, 30, 50, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setter(pct)}
                          className={`min-h-[40px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-xs font-bold tabular-nums cursor-pointer transition ${
                            val === pct
                              ? 'bg-[#231710] text-white'
                              : 'bg-white border border-[#E8E0D5] text-[#6E5D4F] hover:text-[#231710]'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-h-[44px] flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={val}
                      aria-label={origin.name}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="w-full h-3 accent-[#231710] cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Roast, Spicing & Grind */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E0D5] space-y-5">
            <h2 className="font-cairo text-base sm:text-lg font-bold text-[#231710] flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              <span>درجة التحميص والتحويجة والطحنة</span>
            </h2>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#6E5D4F] block">درجة التحميص:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {COFFEE_ROAST_LEVELS.map((level) => {
                  const isSelected = roastLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setRoastLevel(level);
                        updateUrlQueryParams({ roast: level });
                      }}
                      className={`min-h-[44px] p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-[#231710] text-white border-[#231710] font-bold'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:border-[#9A6836] font-medium'
                      }`}
                    >
                      <Flame
                        className={`w-4 h-4 ${
                          isSelected ? 'text-white' : 'text-[#9A6836]'
                        }`}
                      />
                      <span className="text-xs block">{level}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#6E5D4F] block">التحويجة الخاصة:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COFFEE_SPICING_OPTIONS.map((opt) => {
                  const isSelected = spicing === opt.option;
                  return (
                    <button
                      key={opt.option}
                      type="button"
                      onClick={() => {
                        setSpicing(opt.option);
                        updateUrlQueryParams({ spicing: opt.option });
                      }}
                      className={`min-h-[44px] p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#231710] text-white border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:border-[#9A6836]'
                      }`}
                    >
                      <span className="text-xs font-bold">{opt.option}</span>
                      <span
                        className={`text-[11px] font-bold shrink-0 tabular-nums px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-white/15 text-white'
                            : 'bg-white text-[#6E5D4F] border border-[#E8E0D5]'
                        }`}
                      >
                        {opt.extraPerKg === 0 ? 'مشمول' : `+${opt.extraPerKg} ج/كجم`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#6E5D4F] block">نوع الطحنة:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COFFEE_GRIND_TYPES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGrindType(g);
                      updateUrlQueryParams({ grind: g });
                    }}
                    className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      grindType === g
                        ? 'bg-[#231710] text-white border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:border-[#9A6836]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3: Weight, Custom Name & Add to Cart */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E0D5] space-y-4">
            <h2 className="font-cairo text-base sm:text-lg font-bold text-[#231710] flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              <span>اختر الوزن واسم التوليفة وأضف للسلة</span>
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6E5D4F] block">
                وزن العبوة المطلوب:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { g: 125 as WeightGrams, label: '125 جم (ثمن كيلو)' },
                    { g: 250 as WeightGrams, label: '250 جم (ربع كيلو)' },
                    { g: 500 as WeightGrams, label: '500 جم (نصف كيلو)' },
                    { g: 1000 as WeightGrams, label: '1000 جم (كيلو)' },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.g}
                    type="button"
                    onClick={() => {
                      setWeightGrams(w.g);
                      updateUrlQueryParams({ weight: w.g });
                    }}
                    className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer tabular-nums ${
                      weightGrams === w.g
                        ? 'bg-[#231710] text-white border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:border-[#9A6836]'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#6E5D4F] block">
                اسم التوليفة (يُطبع على الكيس):
              </label>
              <input
                type="text"
                value={customBlendName}
                onChange={(e) => setCustomBlendName(e.target.value)}
                placeholder="مثال: توليفة مزاج أحمد"
                className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#9A6836] rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#231710] focus:outline-none"
              />
            </div>

            <div className="lg:hidden pt-2">
              <button
                type="button"
                disabled={!blendCalc.isValid}
                onClick={handleAddBlend}
                className={`w-full min-h-[48px] px-5 py-3 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                  !blendCalc.isValid
                    ? 'bg-[#F4EFE6] text-[#6E5D4F] cursor-not-allowed'
                    : justAdded
                      ? 'bg-[#3B6E4C] text-white'
                      : 'bg-[#231710] hover:bg-[#3A2519] text-white'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {justAdded
                    ? 'تمت الإضافة للسلة'
                    : `أضف التوليفة للسلة (${blendCalc.totalPrice} ج.م)`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sticky Column: Live Barista Sticker Preview & Order CTA (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-[#E8E0D5] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center text-[#9A6836]">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-cairo text-base font-bold text-[#231710]">
                    معاينة بطاقة الكيس
                  </h3>
                  <span className="text-xs text-[#6E5D4F]">
                    تُطبع تلقائياً على عبوة القهوة عند التحضير
                  </span>
                </div>
              </div>
            </div>

            {/* Simulated Kraft/Ivory Barista Bag Label */}
            <div className="bg-[#FAF6F0] text-[#231710] rounded-xl p-4 border border-dashed border-[#D6C9B8] space-y-3">
              <div className="text-center border-b border-[#E8E0D5] pb-2">
                <div className="text-[11px] font-bold text-[#9A6836]">
                  {storeName} • {cityName}
                </div>
                <div className="font-cairo text-base font-bold text-[#231710]">
                  {customBlendName || 'التوليفة الملكية الخاصة'}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#6E5D4F]">النسب المختارة:</span>
                  <span className="font-bold text-[#231710] tabular-nums text-left">
                    {[
                      brazilianPercent > 0 ? `${brazilianPercent}% برازيلي` : null,
                      colombianPercent > 0 ? `${colombianPercent}% كولومبي` : null,
                      habashiPercent > 0 ? `${habashiPercent}% حبشي` : null,
                      indianPercent > 0 ? `${indianPercent}% هندي` : null,
                    ]
                      .filter(Boolean)
                      .join(' + ') || 'لم يتم التحديد'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#6E5D4F]">درجة التحميص:</span>
                  <span className="font-bold text-[#231710]">{roastLevel}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#6E5D4F]">التحويجة:</span>
                  <span className="font-bold text-[#3B6E4C]">{spicing}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#6E5D4F]">نوع الطحنة:</span>
                  <span className="font-bold text-[#231710]">{grindType}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#6E5D4F]">الوزن الصافي:</span>
                  <span className="font-bold text-[#231710] tabular-nums">{weightGrams} جم</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg text-[11px] font-medium text-[#6E5D4F] text-center border border-[#E8E0D5]">
                ملخص التحضير: {blendCalc.baristaLabel}
              </div>
            </div>

            {!blendCalc.isValid && (
              <div className="bg-[#B83B2B]/10 border border-[#B83B2B]/30 rounded-xl p-3 text-xs font-bold text-[#B83B2B]">
                {blendCalc.error}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#E8E0D5] tabular-nums">
              <div>
                <span className="text-xs text-[#6E5D4F] block">إجمالي التوليفة</span>
                <span className="font-cairo text-2xl font-bold text-[#231710]">
                  {blendCalc.totalPrice} ج.م
                </span>
              </div>
              <button
                type="button"
                disabled={!blendCalc.isValid}
                onClick={handleAddBlend}
                className={`min-h-[44px] px-5 py-3 rounded-xl font-cairo font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                  !blendCalc.isValid
                    ? 'bg-[#F4EFE6] text-[#6E5D4F] cursor-not-allowed'
                    : justAdded
                      ? 'bg-[#3B6E4C] text-white'
                      : 'bg-[#231710] hover:bg-[#3A2519] text-white'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تمت الإضافة للسلة</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>أضف التوليفة للسلة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
