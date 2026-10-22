'use client';

import React, { useState, useMemo } from 'react';
import {
  Coffee,
  Sparkles,
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
  const { addCoffeeBlendToCart, setIsCartOpen } = useStore();

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
  const [customBlendName, setCustomBlendName] = useState<string>('توليفة مزاج بني مزار');
  const [justAdded, setJustAdded] = useState<boolean>(false);

  useBrowserUrlSync((params) => {
    const presetParam = params.get('preset');
    if (presetParam === 'royal') {
      setCustomBlendName('توليفة حفصة الملكية');
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
      name.includes('حفصة') ? 'royal' : name.includes('العميد') ? 'ameed' : 'turkish';
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
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-[#231710] via-[#2D1E15] to-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37]/50 py-7 sm:py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-3.5 py-1 rounded-full text-xs font-black">
              <Coffee className="w-3.5 h-3.5" />
              <span>معمل توليفة البن</span>
            </div>
            <h1 className="font-cairo text-2xl sm:text-4xl font-black text-white">
              صمّم توليفة قهوتك الخاصة
            </h1>
            <p className="hidden">
              امزج بين البن البرازيلي والكولومبي والحبشي والهندي، واختر درجة التحميص والتحويجة
              ونوع الطحنة، وسنطبع اسمك على ستيكر البارستا ونطحنها لك طازجة لحظة الطلب.
            </p>
          </div>

          {/* Quick Ready Blends */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                applyPresetBlend(
                  'توليفة حفصة الملكية',
                  50,
                  30,
                  0,
                  20,
                  'وسط (مضبوط)',
                  'محوج مخصوص بحبهان وزر ورد'
                )
              }
              className="bg-[#D4AF37] text-[#231710] font-cairo font-black text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>توليفة حفصة الملكية</span>
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
              className="bg-white/10 hover:bg-white/20 text-[#FAF6F0] border border-[#D4AF37]/50 font-cairo font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-pointer"
            >
              ☕ خلطة العميد الفاخرة
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
              className="bg-white/10 hover:bg-white/20 text-[#FAF6F0] border border-[#D4AF37]/50 font-cairo font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-pointer"
            >
              🔥 وش تركي كثيف
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left/Main Studio Steps (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Origin Percentages */}
          <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-cairo text-base sm:text-lg font-black text-[#231710] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
                  1
                </span>
                <span>اختر نسب حبوب البن العالمية (الإجمالي 100%)</span>
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black tabular-nums ${
                  blendCalc.totalPercentage === 100
                    ? 'bg-[#3B6E4C]/15 text-[#3B6E4C]'
                    : 'bg-[#B83B2B]/15 text-[#B83B2B]'
                }`}
              >
                المجموع الحالي: {blendCalc.totalPercentage}%
              </span>
            </div>

            <div className="space-y-4">
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
                  className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#E6DFD3] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-cairo text-xs sm:text-sm font-black text-[#231710]">
                        {origin.name}
                      </h3>
                      <p className="text-[10.5px] text-[#6E5D4F]">{origin.notes}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[0, 20, 30, 50, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setter(pct)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black tabular-nums cursor-pointer ${
                            val === pct
                              ? 'bg-[#231710] text-[#D4AF37]'
                              : 'bg-white border border-[#E6DFD3] text-[#6E5D4F]'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={val}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="w-full accent-[#231710] cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Roast Level (4 Copper Silos) */}
          <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-3">
            <h2 className="font-cairo text-base sm:text-lg font-black text-[#231710] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
                2
              </span>
              <span>اختر درجة التحميص من الصوامع النحاسية الأربع</span>
            </h2>

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
                    className={`p-3 rounded-2xl border-2 text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#231710] text-[#D4AF37] border-[#D4AF37] font-black shadow'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3] hover:border-[#C88A4B] font-bold'
                    }`}
                  >
                    <Flame
                      className={`w-4 h-4 mx-auto mb-1 ${
                        isSelected ? 'text-[#D4AF37]' : 'text-[#C88A4B]'
                      }`}
                    />
                    <span className="text-xs block">{level}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Spicing (التحويجة السرية) */}
          <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-3">
            <h2 className="font-cairo text-base sm:text-lg font-black text-[#231710] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
                3
              </span>
              <span>اختر التحويجة الخاصة (حبهان • زعفران • زر ورد • جوزة الطيب)</span>
            </h2>

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
                    className={`p-3.5 rounded-2xl border-2 text-right transition cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#231710] text-[#FAF6F0] border-[#D4AF37] shadow'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3] hover:border-[#C88A4B]'
                    }`}
                  >
                    <span className="text-xs font-extrabold">{opt.option}</span>
                    <span
                      className={`text-[10.5px] font-black shrink-0 tabular-nums px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-[#D4AF37] text-[#231710]'
                          : 'bg-white text-[#6E5D4F] border border-[#E6DFD3]'
                      }`}
                    >
                      {opt.extraPerKg === 0 ? 'مشمول' : `+${opt.extraPerKg} ج/كجم`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 4: Grind Type, Weight & Custom Name */}
          <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-4">
            <h2 className="font-cairo text-base sm:text-lg font-black text-[#231710] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
                4
              </span>
              <span>درجة الطحنة والوزن واسم التوليفة على الكيس</span>
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-extrabold text-[#6E5D4F] block">
                نوع الطحنة (المطحن الألماني الفوري):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COFFEE_GRIND_TYPES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGrindType(g);
                      updateUrlQueryParams({ grind: g });
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                      grindType === g
                        ? 'bg-[#231710] text-[#D4AF37] border-[#D4AF37]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold text-[#6E5D4F] block">
                وزن العبوة المطلوب:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { g: 125 as WeightGrams, label: 'ثمن كيلو (125 جم)' },
                    { g: 250 as WeightGrams, label: 'ربع كيلو (250 جم)' },
                    { g: 500 as WeightGrams, label: 'نصف كيلو (500 جم)' },
                    { g: 1000 as WeightGrams, label: 'كيلو كامل (1000 جم)' },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.g}
                    type="button"
                    onClick={() => {
                      setWeightGrams(w.g);
                      updateUrlQueryParams({ weight: w.g });
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer tabular-nums ${
                      weightGrams === w.g
                        ? 'bg-[#D4AF37] text-[#231710] border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#6E5D4F] block">
                اسم صاحب المزاج (يُطبع على ستيكر الكيس):
              </label>
              <input
                type="text"
                value={customBlendName}
                onChange={(e) => setCustomBlendName(e.target.value)}
                placeholder="مثال: توليفة مزاج الباشا - أحمد"
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#C88A4B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#231710] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Sticky Column: Live Barista Sticker Preview & Order CTA (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
          <div className="bg-[#231710] text-[#FAF6F0] rounded-3xl p-6 border-2 border-[#D4AF37] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#D4AF37]" />
                <div>
                  <h3 className="font-cairo text-base font-black text-white">
                    معاينة ستيكر البارستا المباشر
                  </h3>
                  <span className="text-[10px] text-[#D4AF37] font-bold">
                    يُطبع تلقائياً على كيس القهوة في فرع بني مزار
                  </span>
                </div>
              </div>
              <span className="text-xl">☕</span>
            </div>

            {/* Simulated Kraft/Gold Barista Bag Label */}
            <div className="bg-[#FAF6F0] text-[#231710] rounded-2xl p-4 border-2 border-dashed border-[#C88A4B] space-y-3 shadow-inner">
              <div className="text-center border-b border-[#E6DFD3] pb-2">
                <div className="text-[10px] font-black tracking-widest text-[#C88A4B]">
                  HAFSA ROASTERY • BANI MAZAR
                </div>
                <div className="font-cairo text-base font-black text-[#231710]">
                  {customBlendName || 'توليفة حفصة الخاصة'}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#6E5D4F] font-bold">النسب المختارة:</span>
                  <span className="font-black text-[#231710] tabular-nums">
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
                <div className="flex justify-between">
                  <span className="text-[#6E5D4F] font-bold">درجة التحميص:</span>
                  <span className="font-black text-[#231710]">{roastLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E5D4F] font-bold">التحويجة:</span>
                  <span className="font-black text-[#3B6E4C]">{spicing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E5D4F] font-bold">نوع الطحنة:</span>
                  <span className="font-black text-[#231710]">{grindType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E5D4F] font-bold">الوزن الصافي:</span>
                  <span className="font-black text-[#231710] tabular-nums">{weightGrams} جم</span>
                </div>
              </div>

              <div className="bg-[#F3ECE1] p-2 rounded-xl text-[10px] font-bold text-[#231710] text-center border border-[#E6DFD3]">
                🏷️ النص المطبوع للعامل: {blendCalc.baristaLabel}
              </div>
            </div>

            {!blendCalc.isValid && (
              <div className="bg-[#B83B2B]/30 border border-red-400 rounded-xl p-3 text-xs font-bold text-red-200">
                ⚠️ {blendCalc.error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/15 tabular-nums">
              <div>
                <span className="text-xs text-[#F3ECE1]/75 block">إجمالي سعر التوليفة</span>
                <span className="font-cairo text-2xl font-black text-[#D4AF37]">
                  {blendCalc.totalPrice} ج.م
                </span>
              </div>
              <button
                type="button"
                disabled={!blendCalc.isValid}
                onClick={handleAddBlend}
                className={`px-5 py-3.5 rounded-2xl font-cairo font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                  !blendCalc.isValid
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : justAdded
                      ? 'bg-[#3B6E4C] text-white'
                      : 'bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] shadow-lg'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تمت الإضافة للسلة!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>اعتمد التوليفة وأضف للسلة</span>
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
