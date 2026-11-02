'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Check,
  Trash2,
  ShoppingBag,
  Info,
  Wand2,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Equal,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { calculateCustomBoxPrice } from '@/lib/pricing';
import { Product, RoastOption } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';
import { updateUrlQueryParams } from '@/lib/url-sync';

const BOX_CAPACITIES = [
  {
    grams: 500 as const,
    label: '500 جم (نصف كيلو)',
    badge: 'حجم شخصي',
    desc: 'علبة متوازنة تكفي ٢-٤ أفراد',
  },
  {
    grams: 1000 as const,
    label: '1 كجم (كيلو كامل)',
    badge: 'الأكثر طلباً',
    desc: 'الحجم العائلي المثالي والأوفر',
  },
  {
    grams: 2000 as const,
    label: '2 كجم (حجم عائلي كبير)',
    badge: 'حجم الضيافة',
    desc: 'تنوع وتوفير للعائلات والمناسبات',
  },
];

const ROAST_OPTIONS: RoastOption[] = [
  'محمص مملح',
  'محمص بدون ملح',
  'سبايسي متبل',
  'مدخن بالجبنة',
  'نيء طبيعي',
];

interface SelectedPortion {
  product: Product;
  percentage: number;
  roastOption: RoastOption;
}

interface CustomMixBoxStudioProps {
  initialCapacity?: 500 | 1000 | 2000;
}

export default function CustomMixBoxStudio({
  initialCapacity = 1000,
}: CustomMixBoxStudioProps) {
  const { storeData, addCustomBoxToCart, setIsCartOpen } = useStore();

  const [boxSizeGrams, setBoxSizeGrams] = useState<500 | 1000 | 2000>(initialCapacity);
  const [portions, setPortions] = useState<SelectedPortion[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [justAdded, setJustAdded] = useState(false);

  // Available loose nuts and seeds for custom box (excluding coffee & pre-packaged boxes)
  const availableNuts = useMemo(() => {
    const excludedCategoryIds = [
      'cat-coffee-espresso',
      'cat-coffee-bar',
      'cat-mixed-boxes',
      'cat-partitioned-boxes',
    ];
    return (storeData?.products || []).filter(
      (p) =>
        p.showOnline !== false &&
        !excludedCategoryIds.includes(p.categoryId) &&
        (p.stockKg ?? 50) > 0
    );
  }, [storeData?.products]);

  // Initial popular combo seeding when available
  useEffect(() => {
    if (portions.length === 0 && availableNuts.length >= 2) {
      const p1 = availableNuts.find((p) => p.id === 'prod-pistachio-1') || availableNuts[0];
      const p2 = availableNuts.find((p) => p.id === 'prod-cashew-1') || availableNuts[1];
      if (p1 && p2 && p1.id !== p2.id) {
        setPortions([
          {
            product: p1,
            percentage: 50,
            roastOption: p1.roastOptions?.[0] || 'محمص مملح',
          },
          {
            product: p2,
            percentage: 50,
            roastOption: p2.roastOptions?.[0] || 'محمص مملح',
          },
        ]);
      }
    }
  }, [availableNuts, portions.length]);

  // Total allocated percentage
  const totalPercentage = useMemo(() => {
    return portions.reduce((sum, p) => sum + (Number(p.percentage) || 0), 0);
  }, [portions]);

  const remainingPercentage = Math.max(0, 100 - totalPercentage);

  // Calculation result from core pricing engine
  const pricingCalc = useMemo(() => {
    return calculateCustomBoxPrice(boxSizeGrams, portions);
  }, [boxSizeGrams, portions]);

  // Filtered nuts by category and search
  const filteredNuts = useMemo(() => {
    return availableNuts.filter((nut) => {
      if (categoryFilter === 'luxury' && nut.categoryId !== 'cat-luxury-nuts') {
        return false;
      }
      if (
        categoryFilter === 'seeds' &&
        nut.categoryId !== 'cat-snacks' &&
        nut.categoryId !== 'cat-seeds' &&
        nut.categoryId !== 'cat-peanuts-crackers'
      ) {
        return false;
      }
      if (
        categoryFilter === 'sweets' &&
        nut.categoryId !== 'cat-choco-candy' &&
        nut.categoryId !== 'cat-honey-spices' &&
        nut.categoryId !== 'cat-sweets-dates'
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          nut.name.toLowerCase().includes(q) ||
          (nut.subCategoryName || '').toLowerCase().includes(q) ||
          (nut.description || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [availableNuts, categoryFilter, searchQuery]);

  // Handler: Add nut to box
  const handleAddNut = (product: Product) => {
    const existingIndex = portions.findIndex((p) => p.product.id === product.id);
    if (existingIndex >= 0) {
      // Increase existing by 5% if remaining allows, else notify
      const curr = portions[existingIndex].percentage;
      const addAmount = Math.min(10, remainingPercentage > 0 ? remainingPercentage : 5);
      setPortions((prev) => {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], percentage: curr + addAmount };
        return next;
      });
      return;
    }

    // Default portion size: remaining % or 25%
    const initialPercent = remainingPercentage > 0 ? Math.min(25, remainingPercentage) : 25;
    setPortions((prev) => [
      ...prev,
      {
        product,
        percentage: initialPercent,
        roastOption: product.roastOptions?.[0] || 'محمص مملح',
      },
    ]);
  };

  // Handler: Update portion percentage
  const handleUpdatePercentage = (productId: string, newPercentage: number) => {
    if (newPercentage <= 0) {
      handleRemoveNut(productId);
      return;
    }
    const safePercent = Math.min(100, Math.max(5, Math.round(newPercentage)));
    setPortions((prev) =>
      prev.map((p) =>
        p.product.id === productId ? { ...p, percentage: safePercent } : p
      )
    );
  };

  // Handler: Update portion roast option
  const handleUpdateRoast = (productId: string, roastOption: RoastOption) => {
    setPortions((prev) =>
      prev.map((p) =>
        p.product.id === productId ? { ...p, roastOption } : p
      )
    );
  };

  // Handler: Remove nut
  const handleRemoveNut = (productId: string) => {
    setPortions((prev) => prev.filter((p) => p.product.id !== productId));
  };

  // Handler: Distribute equally
  const handleEqualDistribution = () => {
    if (portions.length === 0) return;
    const count = portions.length;
    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;

    setPortions((prev) =>
      prev.map((p, idx) => ({
        ...p,
        percentage: idx === 0 ? base + remainder : base,
      }))
    );
  };

  // Handler: Auto-fill Chef's recommended mix
  const handleChefRecommendedMix = () => {
    if (availableNuts.length < 3) return;
    const pPistachio = availableNuts.find((p) => p.id === 'prod-pistachio-1') || availableNuts[0];
    const pCashew = availableNuts.find((p) => p.id === 'prod-cashew-1') || availableNuts[1];
    const pHazelnut = availableNuts.find((p) => p.id === 'prod-hazelnut-1') || availableNuts[2];
    const pAlmond = availableNuts.find((p) => p.id === 'prod-almond-1') || availableNuts[3] || availableNuts[0];

    if (boxSizeGrams === 500) {
      setPortions([
        { product: pPistachio, percentage: 50, roastOption: 'محمص مملح' },
        { product: pCashew, percentage: 50, roastOption: 'محمص مملح' },
      ]);
    } else if (boxSizeGrams === 1000) {
      setPortions([
        { product: pPistachio, percentage: 40, roastOption: 'محمص مملح' },
        { product: pCashew, percentage: 30, roastOption: 'محمص مملح' },
        { product: pHazelnut, percentage: 30, roastOption: 'محمص مملح' },
      ]);
    } else {
      setPortions([
        { product: pPistachio, percentage: 35, roastOption: 'محمص مملح' },
        { product: pCashew, percentage: 35, roastOption: 'محمص مملح' },
        { product: pHazelnut, percentage: 15, roastOption: 'محمص مملح' },
        { product: pAlmond, percentage: 15, roastOption: 'محمص مملح' },
      ]);
    }
  };

  // Handler: Clear all
  const handleClearAll = () => {
    setPortions([]);
  };

  // Handler: Add completed box to cart
  const handleAddToCart = () => {
    if (!pricingCalc.isValid || totalPercentage !== 100) return;
    addCustomBoxToCart(boxSizeGrams, pricingCalc.breakdown, pricingCalc.totalPrice);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setIsCartOpen(true);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Step 1: Select Box Capacity                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="font-cairo text-base sm:text-lg font-bold text-[#231710] flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#231710] text-white text-xs flex items-center justify-center font-bold">
            1
          </span>
          <span>الخطوة الأولى: اختر سعة العلبة المشكلة</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BOX_CAPACITIES.map((cap) => {
            const isSelected = boxSizeGrams === cap.grams;
            return (
              <button
                key={cap.grams}
                type="button"
                onClick={() => {
                  setBoxSizeGrams(cap.grams);
                  updateUrlQueryParams({ size: String(cap.grams) });
                }}
                className={`text-right p-5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                    : 'bg-white text-[#231710] border-[#E8E0D5] hover:border-[#231710]/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-cairo text-sm sm:text-base font-bold">
                      {cap.label}
                    </span>
                    {cap.badge && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          isSelected
                            ? 'bg-white/15 text-white'
                            : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5]'
                        }`}
                      >
                        {cap.badge}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs ${
                      isSelected ? 'text-[#E8E0D5]/80' : 'text-[#6E5D4F]'
                    }`}
                  >
                    {cap.desc}
                  </p>
                </div>
                <div className="text-left shrink-0 tabular-nums">
                  <span
                    className={`font-cairo text-lg font-bold block ${
                      isSelected ? 'text-white' : 'text-[#231710]'
                    }`}
                  >
                    {cap.grams >= 1000 ? `${cap.grams / 1000} كجم` : `${cap.grams} جم`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Capacity Progress Bar & Status */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-cairo font-bold text-sm text-[#231710]">
              سعة العلبة الإجمالية:
            </span>
            <span
              className={`font-bold text-xs px-2.5 py-0.5 rounded-lg tabular-nums ${
                totalPercentage === 100
                  ? 'bg-[#EEF5F0] text-[#2F5A3D] border border-[#D4E8DA]'
                  : totalPercentage > 100
                    ? 'bg-red-50 text-[#B83B2B] border border-red-200'
                    : 'bg-[#FAF6F0] text-[#9A6836] border border-[#E8E0D5]'
              }`}
            >
              {totalPercentage}% / 100%
            </span>
          </div>

          <div className="text-xs font-medium text-[#6E5D4F]">
            {totalPercentage === 100 ? (
              <span className="text-[#3B6E4C] flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>السعة مكتملة وجاهزة للتعبئة</span>
              </span>
            ) : totalPercentage > 100 ? (
              <span className="text-[#B83B2B] flex items-center gap-1 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>تجاوزت السعة 100% بمقدار {totalPercentage - 100}%</span>
              </span>
            ) : (
              <span>
                المتبقي لإكمال العلبة:{' '}
                <strong className="text-[#231710] tabular-nums">{remainingPercentage}%</strong> (
                {Math.round((boxSizeGrams * remainingPercentage) / 100)} جم)
              </span>
            )}
          </div>
        </div>

        <div className="w-full bg-[#FAF6F0] rounded-full h-2.5 overflow-hidden border border-[#E8E0D5]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              totalPercentage === 100
                ? 'bg-[#3B6E4C]'
                : totalPercentage > 100
                  ? 'bg-[#B83B2B]'
                  : 'bg-[#231710]'
            }`}
            style={{ width: `${Math.min(100, totalPercentage)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#F0EAE0] text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEqualDistribution}
              disabled={portions.length === 0}
              className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] font-bold flex items-center gap-1.5 border border-[#E8E0D5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Equal className="w-3.5 h-3.5" />
              <span>توزيع متساوي</span>
            </button>
            <button
              type="button"
              onClick={handleChefRecommendedMix}
              className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] font-bold flex items-center gap-1.5 border border-[#E8E0D5] cursor-pointer transition"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>تشكيلة مقترحة</span>
            </button>
          </div>

          {portions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-[#B83B2B] hover:underline font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>مسح الأصناف</span>
            </button>
          )}
        </div>
      </div>

      {/* Studio Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-2.5">
              <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                <span>محتويات العلبة</span>
                <span className="text-xs text-[#6E5D4F] font-medium">
                  ({portions.length} أصناف مختارة)
                </span>
              </h3>
              <span className="font-cairo font-bold text-base text-[#231710] tabular-nums">
                {pricingCalc.totalPrice} ج.م
              </span>
            </div>

            {portions.length === 0 ? (
              <div className="text-center py-10 px-4 bg-[#FAF6F0] rounded-xl border border-dashed border-[#E8E0D5] space-y-2.5">
                <p className="text-xs font-medium text-[#6E5D4F]">
                  العلبة فارغة حالياً. اختر من قائمة المكسرات المتاحة على اليسار لإضافتها للعلبة.
                </p>
                <button
                  type="button"
                  onClick={handleChefRecommendedMix}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#231710] px-4 py-2 rounded-xl cursor-pointer hover:bg-[#3a261a] transition"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>ابدأ بتشكيلة مقترحة</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {portions.map((portion) => {
                  const nutPriceContrib =
                    pricingCalc.breakdown.find((b) => b.productId === portion.product.id)
                      ?.priceContribution || 0;
                  const nutGrams = Math.round((boxSizeGrams * portion.percentage) / 100);

                  return (
                    <div
                      key={portion.product.id}
                      className="bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] p-3 space-y-2.5 transition hover:border-[#231710]/30"
                    >
                      {/* Top Row: Image, Name, Weight & Trash */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={getSafeImageUrl(portion.product.image)}
                            alt={portion.product.name}
                            className="w-10 h-10 rounded-lg object-cover border border-[#E8E0D5] shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-cairo font-bold text-xs text-[#231710] truncate">
                              {portion.product.name}
                            </h4>
                            <div className="text-xs text-[#6E5D4F] font-medium tabular-nums">
                              {nutGrams} جم ({portion.percentage}%) •{' '}
                              <span className="text-[#231710] font-bold">
                                {nutPriceContrib} ج.م
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveNut(portion.product.id)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-red-50 text-[#6E5D4F] hover:text-red-600 flex items-center justify-center border border-[#E8E0D5] cursor-pointer transition shrink-0"
                          title="إزالة من العلبة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Middle Row: Roast Selector */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-xs font-medium text-[#6E5D4F] shrink-0">
                          التحميص:
                        </span>
                        <select
                          value={portion.roastOption}
                          onChange={(e) =>
                            handleUpdateRoast(portion.product.id, e.target.value as RoastOption)
                          }
                          className="flex-1 bg-white border border-[#E8E0D5] rounded-lg px-2 py-1 text-xs font-bold text-[#231710] outline-none"
                        >
                          {(portion.product.roastOptions && portion.product.roastOptions.length > 0
                            ? portion.product.roastOptions
                            : ROAST_OPTIONS
                          ).map((roast) => (
                            <option key={roast} value={roast}>
                              {roast}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bottom Row: Percentage Stepper Controls */}
                      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#E8E0D5]">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePercentage(
                                portion.product.id,
                                portion.percentage - 10
                              )
                            }
                            className="px-2 py-1 rounded bg-white hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] text-xs font-bold cursor-pointer transition"
                            title="إنقاص 10%"
                          >
                            -10%
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePercentage(portion.product.id, portion.percentage - 5)
                            }
                            className="px-2 py-1 rounded bg-white hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] text-xs font-bold cursor-pointer transition"
                            title="إنقاص 5%"
                          >
                            -5%
                          </button>
                        </div>

                        <span className="font-cairo font-bold text-xs text-[#231710] tabular-nums px-2">
                          {portion.percentage}%
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePercentage(portion.product.id, portion.percentage + 5)
                            }
                            className="px-2 py-1 rounded bg-white hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] text-xs font-bold cursor-pointer transition"
                            title="زيادة 5%"
                          >
                            +5%
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePercentage(
                                portion.product.id,
                                portion.percentage + 10
                              )
                            }
                            className="px-2 py-1 rounded bg-white hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] text-xs font-bold cursor-pointer transition"
                            title="زيادة 10%"
                          >
                            +10%
                          </button>
                          {remainingPercentage > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdatePercentage(
                                  portion.product.id,
                                  portion.percentage + remainingPercentage
                                )
                              }
                              className="px-2 py-1 rounded bg-[#231710] hover:bg-[#3a261a] text-white text-xs font-bold cursor-pointer transition"
                              title="إكمال كل السعة المتبقية لهذا الصنف"
                            >
                              إكمال الباقي
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary Box & Add to Cart Action */}
            <div className="pt-3 border-t border-[#E8E0D5] space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-[#6E5D4F]">
                <span>إجمالي وزن العلبة:</span>
                <span className="font-bold text-[#231710] tabular-nums">
                  {boxSizeGrams >= 1000 ? `${boxSizeGrams / 1000} كجم` : `${boxSizeGrams} جم`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium text-[#6E5D4F]">
                <span>سعر العلبة المحسوب:</span>
                <span className="font-cairo font-bold text-base text-[#231710] tabular-nums">
                  {pricingCalc.totalPrice} ج.م
                </span>
              </div>

              {/* Error Message if not 100% */}
              {totalPercentage !== 100 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-1.5 leading-relaxed">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {totalPercentage < 100
                      ? `سعة العلبة غير مكتملة (المحدد حالياً: ${totalPercentage}% - المتبقي: ${remainingPercentage}%). يرجى إكمال السعة إلى 100%.`
                      : `لقد تجاوزت السعة الإجمالية 100% بمقدار ${totalPercentage - 100}%. يرجى تقليل النسب لتصبح 100%.`}
                  </span>
                </div>
              )}

              {/* CTA Button */}
              <button
                type="button"
                disabled={!pricingCalc.isValid || totalPercentage !== 100}
                onClick={handleAddToCart}
                className={`w-full py-3 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                  pricingCalc.isValid && totalPercentage === 100
                    ? justAdded
                      ? 'bg-[#3B6E4C] text-white'
                      : 'bg-[#231710] hover:bg-[#3a261a] text-white'
                    : 'bg-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed opacity-70'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>تمت الإضافة إلى السلة بنجاح!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {totalPercentage === 100
                        ? `أضف العلبة المشكلة للسلة (${pricingCalc.totalPrice} ج.م)`
                        : `يرجى إكمال السعة (المتبقي ${remainingPercentage}%)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Available Nuts Catalog (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 space-y-3.5">
            {/* Catalog Header & Filters */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-cairo font-bold text-sm text-[#231710]">
                  قائمة المكسرات والبذور المتاحة للعلبة
                </h3>
                <span className="text-xs text-[#6E5D4F] font-medium">
                  ({filteredNuts.length} صنف متاح)
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن مكسرات (فستق، كاجو، بندق، لب، سوداني...)"
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-xs font-medium text-[#231710] placeholder:text-[#6E5D4F]/60 outline-none focus:border-[#9A6836]"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'luxury', label: 'مكسرات فاخرة' },
                  { id: 'seeds', label: 'لب ومقرمشات وسوداني' },
                  { id: 'sweets', label: 'حلويات وفواكه' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryFilter(c.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                      categoryFilter === c.id
                        ? 'bg-[#231710] text-white'
                        : 'bg-[#FAF6F0] text-[#6E5D4F] hover:text-[#231710]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nut Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredNuts.map((nut) => {
                const existingPortion = portions.find((p) => p.product.id === nut.id);
                const isSelected = Boolean(existingPortion);

                return (
                  <div
                    key={nut.id}
                    className={`rounded-2xl border p-3 flex flex-col justify-between transition ${
                      isSelected
                        ? 'bg-[#FAF6F0] border-[#231710]'
                        : 'bg-white border-[#E8E0D5] hover:border-[#9A6836]'
                    }`}
                  >
                    <div>
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#FAF6F0] mb-2">
                        <img
                          src={getSafeImageUrl(nut.image)}
                          alt={nut.name}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 right-2 bg-white/95 text-[#231710] border border-[#E8E0D5] text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums">
                          {nut.pricePerKg || 400} ج/كجم
                        </span>
                        {isSelected && (
                          <span className="absolute top-2 left-2 bg-[#3B6E4C] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            <span>{existingPortion!.percentage}%</span>
                          </span>
                        )}
                      </div>

                      <h4 className="font-cairo font-bold text-xs sm:text-sm text-[#231710] line-clamp-1 mb-1">
                        {nut.name}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddNut(nut)}
                      className={`w-full py-2 rounded-lg font-cairo font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-[#231710] text-white hover:bg-[#3A2519]'
                          : 'bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710]'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'زيادة النسبة' : 'أضف للعلبة'}</span>
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
