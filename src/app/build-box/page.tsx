'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Gift,
  Layers,
  Check,
  Trash2,
  ShoppingBag,
  Award,
  Info,
  Wand2,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  PARTITIONED_BOX_PRESETS,
  calculatePartitionedBox,
  buildDefaultPartitionedBoxSlots,
} from '@/lib/pricing';
import {
  BoxSlotSelection,
  PartitionedBoxSize,
  Product,
  RoastOption,
} from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';
import { updateUrlQueryParams, useBrowserUrlSync } from '@/lib/url-sync';
import CustomMixBoxStudio from '@/components/boxes/CustomMixBoxStudio';

function BuildBoxStudioContent() {
  const { storeData, addPartitionedBoxToCart, setIsCartOpen } = useStore();
  const searchParams = useSearchParams();

  const initialSizeRaw = searchParams.get('size');
  const initialTabParam = searchParams.get('tab') || searchParams.get('mode');

  const [activeMode, setActiveMode] = useState<'mix' | 'partitioned'>(() => {
    if (initialSizeRaw && ['roqan_4', 'family_6', 'vip_6'].includes(initialSizeRaw)) {
      return 'partitioned';
    }
    if (initialTabParam === 'partitioned') {
      return 'partitioned';
    }
    return 'mix';
  });

  const customMixInitialCapacity = useMemo(() => {
    if (initialSizeRaw === '500') return 500;
    if (initialSizeRaw === '2000') return 2000;
    return 1000;
  }, [initialSizeRaw]);

  const initialSizeParam = searchParams.get('size') as PartitionedBoxSize | null;
  const [boxSize, setBoxSize] = useState<PartitionedBoxSize>(
    initialSizeParam && PARTITIONED_BOX_PRESETS[initialSizeParam]
      ? initialSizeParam
      : 'roqan_4'
  );

  const preset = PARTITIONED_BOX_PRESETS[boxSize];
  const [slots, setSlots] = useState<Array<BoxSlotSelection | null>>([
    null,
    null,
    null,
    null,
  ]);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [justAdded, setJustAdded] = useState(false);

  useBrowserUrlSync((params) => {
    const tab = params.get('tab') || params.get('mode');
    const szRaw = params.get('size');
    if (tab === 'partitioned' || (szRaw && ['roqan_4', 'family_6', 'vip_6'].includes(szRaw))) {
      setActiveMode('partitioned');
    } else if (tab === 'mix' || (szRaw && ['500', '1000', '2000'].includes(szRaw))) {
      setActiveMode('mix');
    }

    const sz = params.get('size') as PartitionedBoxSize | null;
    if (sz && PARTITIONED_BOX_PRESETS[sz]) {
      setBoxSize(sz);
    }
    const cat = params.get('cat');
    if (cat && ['all', 'seeds', 'luxury', 'sweets'].includes(cat)) {
      setCategoryFilter(cat);
    } else {
      setCategoryFilter('all');
    }
    const slotParam = params.get('slot');
    if (slotParam) {
      const idx = Number(slotParam) - 1;
      if (!Number.isNaN(idx) && idx >= 0) {
        setActiveSlotIdx(idx);
      }
    }
  });

  const products = useMemo(() => {
    const all = storeData?.products || [];
    return all.filter(
      (p) =>
        ![
          'cat-coffee-espresso',
          'cat-coffee-bar',
          'cat-mixed-boxes',
          'cat-partitioned-boxes',
        ].includes(p.categoryId)
    );
  }, [storeData?.products]);

  useEffect(() => {
    const targetCount = PARTITIONED_BOX_PRESETS[boxSize].slotsCount;
    setSlots((prev) => {
      const next = Array.from({ length: targetCount }, (_, i) => {
        const existing = prev[i];
        if (!existing) return null;
        return {
          ...existing,
          slotIndex: i + 1,
          slotGrams: PARTITIONED_BOX_PRESETS[boxSize].gramsPerSlot,
        };
      });
      return next;
    });
    setActiveSlotIdx(0);
  }, [boxSize]);

  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    if (categoryFilter === 'seeds') {
      return products.filter((p) =>
        ['cat-snacks', 'cat-seeds-crackers'].includes(p.categoryId)
      );
    }
    if (categoryFilter === 'luxury') {
      return products.filter((p) => p.categoryId === 'cat-luxury-nuts');
    }
    if (categoryFilter === 'sweets') {
      return products.filter((p) =>
        ['cat-choco-candy', 'cat-honey-spices', 'cat-dates-yameesh', 'cat-sweets-savory'].includes(
          p.categoryId
        )
      );
    }
    return products;
  }, [products, categoryFilter]);

  const assignProductToSlot = (product: Product, targetIdx?: number) => {
    const idxToFill =
      typeof targetIdx === 'number'
        ? targetIdx
        : slots.findIndex((s) => s === null) !== -1
          ? slots.findIndex((s) => s === null)
          : activeSlotIdx;

    const pricePerKg =
      product.pricePerKg ||
      product.weights.find((w) => w.grams === 1000)?.price ||
      350;
    const costPerKg = product.costPerKg || Math.round(pricePerKg * 0.68);
    const isSuperVipItem = Boolean(
      product.isSuperVipItem ||
        pricePerKg >= 750 ||
        product.name.includes('فستق') ||
        product.name.includes('كاجو') ||
        product.name.includes('بندق') ||
        product.name.includes('عين جمل')
    );

    const newSlot: BoxSlotSelection = {
      slotIndex: idxToFill + 1,
      productId: product.id,
      productName: product.name,
      productImage: getSafeImageUrl(product.image),
      roastOption: product.roastOptions?.[0] || 'محمص مملح',
      slotGrams: preset.gramsPerSlot,
      pricePerKg,
      costPerKg,
      isSuperVipItem,
    };

    setSlots((prev) => {
      const updated = [...prev];
      updated[idxToFill] = newSlot;
      const nextEmpty = updated.findIndex((s) => s === null);
      if (nextEmpty !== -1) {
        setActiveSlotIdx(nextEmpty);
      } else {
        setActiveSlotIdx((idxToFill + 1) % preset.slotsCount);
      }
      return updated;
    });
  };

  const updateSlotRoast = (slotIdx: number, roast: RoastOption) => {
    setSlots((prev) => {
      const updated = [...prev];
      if (updated[slotIdx]) {
        updated[slotIdx] = { ...updated[slotIdx]!, roastOption: roast };
      }
      return updated;
    });
  };

  const clearSlot = (slotIdx: number) => {
    setSlots((prev) => {
      const updated = [...prev];
      updated[slotIdx] = null;
      return updated;
    });
    setActiveSlotIdx(slotIdx);
  };

  const handleAutoFillPreset = () => {
    if (products.length === 0) return;
    setSlots(buildDefaultPartitionedBoxSlots(boxSize, products));
  };

  const filledSlots = useMemo(
    () => slots.filter((s): s is BoxSlotSelection => s !== null),
    [slots]
  );

  const pricingCalc = useMemo(
    () => calculatePartitionedBox(boxSize, filledSlots),
    [boxSize, filledSlots]
  );

  const handleAddBoxToCart = () => {
    if (!pricingCalc.isValid) return;
    addPartitionedBoxToCart(boxSize, filledSlots, pricingCalc.finalPrice, 1);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setIsCartOpen(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Calm Light Artisanal Header */}
      <div className="bg-white border-b border-[#E8E0D5] py-7 sm:py-9 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[#9A6836] text-xs font-bold">
              <Gift className="w-3.5 h-3.5" />
              <span>استوديو العلب والبوكسات المخصصة</span>
            </span>
            <h1 className="font-cairo text-2xl sm:text-3xl font-bold text-[#231710]">
              صمّم علبتك وبوكس السهرة على ذوقك
            </h1>
            <p className="text-sm text-[#6E5D4F]">
              اختر بين تكوين علبة مشكلة بالأوزان (500 جم / 1 كجم / 2 كجم) أو بوكس السهرة المقسم خانات منفصلة
            </p>
          </div>

          {activeMode === 'partitioned' && (
            <button
              type="button"
              onClick={handleAutoFillPreset}
              className="bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 self-start md:self-auto cursor-pointer transition"
            >
              <Wand2 className="w-4 h-4 text-[#9A6836]" />
              <span>تعبئة تلقائية متوازنة</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Dual-Mode Segmented Control */}
        <div className="flex p-1 bg-white rounded-xl border border-[#E8E0D5] max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => {
              setActiveMode('mix');
              updateUrlQueryParams({ tab: 'mix', size: '1000' });
            }}
            className={`flex-1 py-2.5 px-3 rounded-lg font-cairo font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMode === 'mix'
                ? 'bg-[#231710] text-white'
                : 'text-[#6E5D4F] hover:text-[#231710]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>علبة مخصصة بالوزن (500ج / 1كج / 2كج)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('partitioned');
              updateUrlQueryParams({ tab: 'partitioned', size: 'roqan_4' });
            }}
            className={`flex-1 py-2.5 px-3 rounded-lg font-cairo font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMode === 'partitioned'
                ? 'bg-[#231710] text-white'
                : 'text-[#6E5D4F] hover:text-[#231710]'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>بوكس السهرة المقسم (4 / 6 خانات)</span>
          </button>
        </div>

        {activeMode === 'mix' ? (
          <CustomMixBoxStudio initialCapacity={customMixInitialCapacity} />
        ) : (
          <div className="space-y-6">
            {/* Step 1: Select Box Size */}
            <div className="space-y-3">
              <h2 className="font-cairo text-base font-bold text-[#231710] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <span>اختر حجم البوكس المقسم</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {(['roqan_4', 'family_6', 'vip_6'] as PartitionedBoxSize[]).map((sizeKey) => {
                  const p = PARTITIONED_BOX_PRESETS[sizeKey];
                  const isSelected = boxSize === sizeKey;
                  return (
                    <button
                      key={sizeKey}
                      type="button"
                      onClick={() => {
                        setBoxSize(sizeKey);
                        updateUrlQueryParams({ size: sizeKey, slot: null });
                      }}
                      className={`text-right p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#231710] text-white border-[#231710]'
                          : 'bg-white text-[#231710] border-[#E8E0D5] hover:border-[#9A6836]'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="font-cairo text-sm sm:text-base font-bold block">
                          {p.title}
                        </span>
                        <p
                          className={`text-xs ${
                            isSelected ? 'text-white/75' : 'text-[#6E5D4F]'
                          }`}
                        >
                          {p.slotsCount} خانات منفصلة • نحو {p.approximateTotalGrams} جم
                        </p>
                      </div>
                      <div className="text-left shrink-0 tabular-nums">
                        <span
                          className={`font-cairo text-lg font-bold block ${
                            isSelected ? 'text-white' : 'text-[#231710]'
                          }`}
                        >
                          {p.basePrice} ج.م
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Studio Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Right Column: Visual Compartmentalized Box */}
              <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-2xl p-5 border border-[#E8E0D5] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
                  <div>
                    <h3 className="font-cairo text-base font-bold text-[#231710]">
                      معاينة {preset.title}
                    </h3>
                    <p className="text-xs text-[#6E5D4F]">
                      تم تعبئة {filledSlots.length} من {preset.slotsCount} خانات ({preset.gramsPerSlot}{' '}
                      جم لكل خانة)
                    </p>
                  </div>
                  <span className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-sm px-3 py-1 rounded-xl tabular-nums">
                    {pricingCalc.finalPrice} ج.م
                  </span>
                </div>

                {/* Visual Slots Container */}
                <div
                  className={`grid ${
                    preset.slotsCount === 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
                  } gap-2.5 bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5]`}
                >
                  {slots.map((slot, idx) => {
                    const isActive = activeSlotIdx === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setActiveSlotIdx(idx);
                          updateUrlQueryParams({ slot: idx + 1 });
                        }}
                        className={`rounded-xl p-2.5 border transition cursor-pointer flex flex-col justify-between min-h-[125px] ${
                          slot
                            ? isActive
                              ? 'bg-white border-[#231710]'
                              : 'bg-white border-[#E8E0D5]'
                            : isActive
                              ? 'bg-white border-dashed border-[#9A6836]'
                              : 'bg-[#FAF6F0] border-dashed border-[#D6C9B8]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-md tabular-nums ${
                              isActive
                                ? 'bg-[#231710] text-white'
                                : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5]'
                            }`}
                          >
                            خانة #{idx + 1}
                          </span>
                          {slot ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearSlot(idx);
                              }}
                              className="text-[#B83B2B] hover:opacity-75 p-0.5 cursor-pointer"
                              title="تفريغ الخانة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[#9A6836]">{preset.gramsPerSlot} جم</span>
                          )}
                        </div>

                        {slot ? (
                          <div className="space-y-1.5 mt-1.5">
                            <div className="flex items-center gap-1.5">
                              <img
                                src={getSafeImageUrl(slot.productImage)}
                                alt={slot.productName}
                                className="w-9 h-9 rounded-lg object-cover border border-[#E8E0D5] shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[#231710] line-clamp-1">
                                  {slot.productName}
                                </div>
                                {slot.isSuperVipItem && (
                                  <span className="text-[10px] text-[#9A6836] font-medium flex items-center gap-0.5">
                                    <Award className="w-2.5 h-2.5" /> صنف فاخر
                                  </span>
                                )}
                              </div>
                            </div>

                            <select
                              value={slot.roastOption}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                updateSlotRoast(idx, e.target.value as RoastOption)
                              }
                              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-lg px-2 py-1 text-[11px] font-medium text-[#231710]"
                            >
                              <option value="محمص مملح">محمص مملح</option>
                              <option value="محمص بدون ملح">محمص بدون ملح</option>
                              <option value="سبايسي متبل">سبايسي متبل</option>
                              <option value="مدخن بالجبنة">مدخن بالجبنة</option>
                              <option value="نيء طبيعي">نيء طبيعي</option>
                            </select>
                          </div>
                        ) : (
                          <div className="text-center my-auto py-3">
                            <span className="text-xs font-medium text-[#6E5D4F] block">
                              {isActive ? 'اختر صنفاً من القائمة' : 'اضغط لتحديد الخانة'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pricing & Margin Protection Info */}
                {pricingCalc.vipExtraSurcharge > 0 && (
                  <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 text-xs text-[#231710] flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#9A6836] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">فرق الأصناف الفاخرة:</span> تم احتساب{' '}
                      <strong className="text-[#9A6836]">+{pricingCalc.vipExtraSurcharge} ج.م</strong>{' '}
                      لإضافة خانات إضافية من المكسرات الفاخرة فوق الحد المشمول في السعر الأساسي.
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!pricingCalc.isValid}
                  onClick={handleAddBoxToCart}
                  className={`w-full py-3.5 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                    !pricingCalc.isValid
                      ? 'bg-[#F4EFE6] text-[#6E5D4F] cursor-not-allowed'
                      : justAdded
                        ? 'bg-[#3B6E4C] text-white'
                        : 'bg-[#231710] hover:bg-[#3A2519] text-white'
                  }`}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>تمت إضافة البوكس للسلة</span>
                    </>
                  ) : !pricingCalc.isValid ? (
                    <span>
                      أكمل باقي الخانات ({preset.slotsCount - filledSlots.length} خانات متبقية)
                    </span>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        أضف {preset.title} للسلة ({pricingCalc.finalPrice} ج.م)
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Left Column: Nuts & Snacks Picker */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                  <h3 className="font-cairo text-sm font-bold text-[#231710]">
                    2. اضغط على الصنف لإضافته في الخانة النشطة (#{activeSlotIdx + 1})
                  </h3>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'الكل' },
                      { id: 'seeds', label: 'لب وسوداني ومقرمشات' },
                      { id: 'luxury', label: 'مكسرات فاخرة' },
                      { id: 'sweets', label: 'فواكه مجففة وشوكولاتة' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(f.id);
                          updateUrlQueryParams({ cat: f.id === 'all' ? null : f.id });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                          categoryFilter === f.id
                            ? 'bg-[#231710] text-white'
                            : 'bg-[#FAF6F0] text-[#6E5D4F] hover:text-[#231710]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredProducts.map((product) => {
                    const pricePerKg =
                      product.pricePerKg ||
                      product.weights.find((w) => w.grams === 1000)?.price ||
                      350;
                    const isVip = Boolean(
                      product.isSuperVipItem ||
                        pricePerKg >= 750 ||
                        product.name.includes('فستق') ||
                        product.name.includes('كاجو') ||
                        product.name.includes('بندق')
                    );
                    const selectedInCount = filledSlots.filter(
                      (s) => s.productId === product.id
                    ).length;

                    return (
                      <div
                        key={product.id}
                        onClick={() => assignProductToSlot(product)}
                        className={`bg-white rounded-2xl p-3 border transition cursor-pointer flex flex-col justify-between gap-2 ${
                          selectedInCount > 0
                            ? 'border-[#231710]'
                            : 'border-[#E8E0D5] hover:border-[#9A6836]'
                        }`}
                      >
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#FAF6F0]">
                          <img
                            src={getSafeImageUrl(product.image)}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                          {isVip && (
                            <span className="absolute top-2 right-2 bg-white/95 text-[#9A6836] border border-[#E8E0D5] text-[10px] font-bold px-2 py-0.5 rounded-md">
                              فاخر
                            </span>
                          )}
                          {selectedInCount > 0 && (
                            <span className="absolute top-2 left-2 bg-[#3B6E4C] text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                              مختار ({selectedInCount})
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-cairo text-xs sm:text-sm font-bold text-[#231710] line-clamp-1">
                            {product.name}
                          </h4>
                        </div>

                        <button
                          type="button"
                          className="w-full py-2 rounded-lg bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710] text-xs font-bold transition cursor-pointer"
                        >
                          + أضف للخانة #{activeSlotIdx + 1}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BuildBoxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center bg-[#FAF6F0]">
          <p className="font-cairo text-sm font-bold text-[#231710]">
            جاري تجهيز استوديو بوكس السهرة...
          </p>
        </div>
      }
    >
      <BuildBoxStudioContent />
    </Suspense>
  );
}
