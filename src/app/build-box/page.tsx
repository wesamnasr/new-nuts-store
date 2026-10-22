'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Gift,
  Sparkles,
  Check,
  Trash2,
  ShoppingBag,
  Crown,
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
import { updateUrlQueryParams, useBrowserUrlSync, buildUrlWithParams } from '@/lib/url-sync';

function BuildBoxStudioContent() {
  const { storeData, addPartitionedBoxToCart, setIsCartOpen } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();

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

  // Adjust slots array length when boxSize changes (4 slots vs 6 slots)
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
      // Move active pointer to next empty slot
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
      {/* Header Banner */}
      <div className="bg-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37]/50 py-6 sm:py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-3 py-1 rounded-full text-xs font-black">
              <Gift className="w-3.5 h-3.5" />
              <span>استوديو بوكس السهرة</span>
            </div>
            <h1 className="font-cairo text-2xl sm:text-3xl font-black text-white">
              صمّم بوكس السهرة على ذوقك
            </h1>
            <p className="text-xs sm:text-sm text-[#F3ECE1]/85">
              {''}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAutoFillPreset}
            className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 self-start md:self-auto cursor-pointer transition"
          >
            <Wand2 className="w-4 h-4" />
            <span>تعبئة تلقائية ذكية (تشكيلة الشيف) ✨</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Step 1: Select Box Size */}
        <div className="space-y-2.5">
          <h2 className="font-cairo text-base sm:text-lg font-black text-[#231710] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#231710] text-[#D4AF37] text-xs flex items-center justify-center font-black">
              1
            </span>
            <span>الخطوة الأولى: اختر حجم البوكس المقسم</span>
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
                  className={`text-right p-4 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#231710] text-[#FAF6F0] border-[#D4AF37] shadow-lg'
                      : 'bg-white text-[#231710] border-[#E6DFD3] hover:border-[#C88A4B]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-cairo text-sm sm:text-base font-black">
                        {p.title}
                      </span>
                      {sizeKey === 'roqan_4' && (
                        <span className="bg-[#B83B2B] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                          الأكثر طلباً
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] ${
                        isSelected ? 'text-[#F3ECE1]/80' : 'text-[#6E5D4F]'
                      }`}
                    >
                      {p.slotsCount} خانات منفصلة • تقريبًا {p.approximateTotalGrams} جم
                    </p>
                  </div>
                  <div className="text-left shrink-0 tabular-nums">
                    <span
                      className={`font-cairo text-xl font-black block ${
                        isSelected ? 'text-[#D4AF37]' : 'text-[#231710]'
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

        {/* Main Studio Grid: Visual Box Container (Right) + 24-Bin Selector (Left) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Column: Visual Compartmentalized Box */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 bg-white rounded-3xl p-5 border-2 border-[#D4AF37] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6DFD3] pb-3">
              <div>
                <h3 className="font-cairo text-base font-black text-[#231710]">
                  📦 معاينة {preset.title}
                </h3>
                <p className="text-[11px] text-[#6E5D4F]">
                  تم تعبئة {filledSlots.length} من {preset.slotsCount} خانات ({preset.gramsPerSlot}{' '}
                  جم لكل خانة)
                </p>
              </div>
              <span className="bg-[#F3ECE1] text-[#231710] border border-[#D4AF37] font-cairo font-black text-sm px-3 py-1 rounded-xl tabular-nums">
                {pricingCalc.finalPrice} ج.م
              </span>
            </div>

            {/* Visual Slots Container */}
            <div
              className={`grid ${
                preset.slotsCount === 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
              } gap-2.5 bg-[#F3ECE1] p-3 rounded-2xl border-2 border-[#C88A4B]/40`}
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
                    className={`rounded-2xl p-2.5 border-2 transition cursor-pointer flex flex-col justify-between min-h-[125px] ${
                      slot
                        ? isActive
                          ? 'bg-white border-[#231710] shadow-md'
                          : 'bg-white border-[#D4AF37]'
                        : isActive
                          ? 'bg-[#FAF6F0] border-dashed border-[#C88A4B] ring-2 ring-[#D4AF37]/40'
                          : 'bg-[#FAF6F0]/70 border-dashed border-[#E6DFD3]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-black">
                      <span className="bg-[#231710] text-[#D4AF37] px-2 py-0.5 rounded-md tabular-nums">
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
                        <span className="text-[#C88A4B]">{preset.gramsPerSlot} جم</span>
                      )}
                    </div>

                    {slot ? (
                      <div className="space-y-1.5 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={getSafeImageUrl(slot.productImage)}
                            alt={slot.productName}
                            className="w-9 h-9 rounded-lg object-cover border border-[#E6DFD3] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-[11px] font-black text-[#231710] line-clamp-1">
                              {slot.productName}
                            </div>
                            {slot.isSuperVipItem && (
                              <span className="text-[8.5px] text-[#C88A4B] font-extrabold flex items-center gap-0.5">
                                <Crown className="w-2.5 h-2.5" /> صنف سوبر VIP
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Roast Option Selector inside Slot */}
                        <select
                          value={slot.roastOption}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            updateSlotRoast(idx, e.target.value as RoastOption)
                          }
                          className="w-full bg-[#F3ECE1] border border-[#E6DFD3] rounded-lg px-1.5 py-1 text-[9.5px] font-extrabold text-[#231710]"
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
                        <span className="text-[10.5px] font-bold text-[#6E5D4F] block">
                          {isActive ? '👈 اختر صنفاً من القائمة' : 'اضغط لتحديد الخانة'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pricing & Margin Protection Info */}
            {pricingCalc.vipExtraSurcharge > 0 && (
              <div className="bg-[#F3ECE1] border border-[#D4AF37] rounded-xl p-2.5 text-[11px] text-[#231710] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#C88A4B] shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold">ملاحظة تسعير الأصناف الفاخرة:</span> تم احتساب{' '}
                  <strong className="text-[#C88A4B]">+{pricingCalc.vipExtraSurcharge} ج.م</strong>{' '}
                  لإضافة خانات إضافية من المكسرات الملكية (فستق/كاجو/بندق/عين جمل) فوق الحد المشمول في
                  السعر الأساسي.
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!pricingCalc.isValid}
              onClick={handleAddBoxToCart}
              className={`w-full py-3.5 px-4 rounded-2xl font-cairo font-black text-sm flex items-center justify-center gap-2 transition shadow-lg cursor-pointer ${
                !pricingCalc.isValid
                  ? 'bg-[#E6DFD3] text-[#6E5D4F] cursor-not-allowed'
                  : justAdded
                    ? 'bg-[#3B6E4C] text-white'
                    : 'bg-[#231710] hover:bg-[#3A2519] text-[#D4AF37] border border-[#D4AF37]'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>تمت إضافة البوكس للسلة بنجاح!</span>
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

          {/* Left Column: 24-Bin Nuts & Snacks Picker */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-[#E6DFD3]">
              <h3 className="font-cairo text-sm sm:text-base font-black text-[#231710]">
                2. اضغط على أي صنف لإضافته في الخانة النشطة (#{activeSlotIdx + 1})
              </h3>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                      categoryFilter === f.id
                        ? 'bg-[#231710] text-[#D4AF37]'
                        : 'bg-[#F3ECE1] text-[#6E5D4F] hover:text-[#231710]'
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
                    className={`bg-white rounded-2xl p-2.5 border transition cursor-pointer flex flex-col justify-between gap-2 hover:shadow-md ${
                      selectedInCount > 0
                        ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]'
                        : 'border-[#E6DFD3] hover:border-[#C88A4B]'
                    }`}
                  >
                    <div className="relative h-28 rounded-xl overflow-hidden bg-[#F3ECE1]">
                      <img
                        src={getSafeImageUrl(product.image)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {isVip && (
                        <span className="absolute top-1.5 right-1.5 bg-[#231710]/90 text-[#D4AF37] text-[8.5px] font-black px-2 py-0.5 rounded-full">
                          👑 VIP
                        </span>
                      )}
                      {selectedInCount > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-[#3B6E4C] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                          في {selectedInCount} خانة ✓
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-cairo text-xs font-black text-[#231710] line-clamp-1">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-[#6E5D4F] line-clamp-1">
                        {product.subtitle || product.origin}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="w-full py-1.5 rounded-xl bg-[#F3ECE1] hover:bg-[#231710] text-[#231710] hover:text-[#D4AF37] text-[10.5px] font-extrabold transition cursor-pointer"
                    >
                      + ضع في الخانة #{activeSlotIdx + 1}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BuildBoxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center bg-[#FAF6F0]">
          <p className="font-cairo text-sm font-black text-[#231710]">
            جاري تجهيز استوديو بوكس السهرة...
          </p>
        </div>
      }
    >
      <BuildBoxStudioContent />
    </Suspense>
  );
}
