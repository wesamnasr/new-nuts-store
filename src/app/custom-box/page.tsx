'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Check,
  Flame,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { Product, RoastOption } from '@/types/store';
import { calculateCustomBoxPrice, getProductBasePriceForBox } from '@/lib/pricing';
import { getResolvedPageContent, getSafeImageUrl } from '@/lib/defaults';

// Palette mapping for segmented visual box gauge
const NUT_COLORS: Record<string, { bg: string; border: string; text: string; hex: string }> = {
  'prod-pistachio-1': { bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-emerald-700', hex: '#059669' },
  'prod-cashew-1': { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-amber-700', hex: '#d97706' },
  'prod-almond-1': { bg: 'bg-orange-700', border: 'border-orange-800', text: 'text-orange-800', hex: '#c2410c' },
  'prod-walnut-1': { bg: 'bg-stone-700', border: 'border-stone-800', text: 'text-stone-800', hex: '#44403c' },
  'prod-hazelnut-1': { bg: 'bg-yellow-700', border: 'border-yellow-800', text: 'text-yellow-800', hex: '#a16207' },
  'prod-dates-stuffed-1': { bg: 'bg-rose-800', border: 'border-rose-900', text: 'text-rose-800', hex: '#9f1239' },
  'prod-apricot-prunes-1': { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-orange-700', hex: '#f97316' },
  'prod-savory-mix-1': { bg: 'bg-red-600', border: 'border-red-700', text: 'text-red-700', hex: '#dc2626' },
};
const DEFAULT_NUT_COLOR = { bg: 'bg-brand-600', border: 'border-brand-700', text: 'text-brand-700', hex: '#bf7039' };

interface NutAllocation {
  percentage: number;
  roast: RoastOption;
}

interface MixPreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  items: Array<{ productId: string; percentage: number; preferredRoast?: RoastOption }>;
}

const MIX_PRESETS: MixPreset[] = [
  {
    id: 'royal_vip',
    title: 'خلطة الضيافة الملكية VIP',
    subtitle: 'فستق + كاجو + بندق + لوز (25% لكل صنف)',
    badge: '👑 الأكثر طلباً',
    items: [
      { productId: 'prod-pistachio-1', percentage: 25, preferredRoast: 'محمص مملح' },
      { productId: 'prod-cashew-1', percentage: 25, preferredRoast: 'محمص مملح' },
      { productId: 'prod-hazelnut-1', percentage: 25, preferredRoast: 'محمص بدون ملح' },
      { productId: 'prod-almond-1', percentage: 25, preferredRoast: 'محمص مملح' },
    ],
  },
  {
    id: 'keto_diet',
    title: 'خلطة الكيتو والدايت الصحية',
    subtitle: 'لوز + عين جمل + بندق (نيء طبيعي / بدون ملح)',
    badge: '🥗 صحي 100%',
    items: [
      { productId: 'prod-almond-1', percentage: 40, preferredRoast: 'نيء طبيعي' },
      { productId: 'prod-walnut-1', percentage: 30, preferredRoast: 'نيء طبيعي' },
      { productId: 'prod-hazelnut-1', percentage: 30, preferredRoast: 'محمص بدون ملح' },
    ],
  },
  {
    id: 'energy_sport',
    title: 'خلطة الطاقة والرياضة',
    subtitle: 'كاجو (35%) + لوز (35%) + عين جمل (30%)',
    badge: '⚡ بروتين عالي',
    items: [
      { productId: 'prod-cashew-1', percentage: 35, preferredRoast: 'محمص بدون ملح' },
      { productId: 'prod-almond-1', percentage: 35, preferredRoast: 'نيء طبيعي' },
      { productId: 'prod-walnut-1', percentage: 30, preferredRoast: 'نيء طبيعي' },
    ],
  },
  {
    id: 'fruits_nuts',
    title: 'خلطة الفواكه والمكسرات',
    subtitle: 'تمر محشو + مشمشية وقراصيا + عين جمل + لوز',
    badge: '🍑 فواكه ومكسرات',
    items: [
      { productId: 'prod-dates-stuffed-1', percentage: 30, preferredRoast: 'تشكيلة فاخرة' },
      { productId: 'prod-apricot-prunes-1', percentage: 30, preferredRoast: 'نيء طبيعي' },
      { productId: 'prod-walnut-1', percentage: 20, preferredRoast: 'نيء طبيعي' },
      { productId: 'prod-almond-1', percentage: 20, preferredRoast: 'نيء طبيعي' },
    ],
  },
  {
    id: 'family_night',
    title: 'خلطة السهرة والعائلة',
    subtitle: 'مقرمشات السهرة (40%) + فستق (30%) + كاجو (30%)',
    badge: '🍿 سناك اللمة',
    items: [
      { productId: 'prod-savory-mix-1', percentage: 40, preferredRoast: 'محمص مملح' },
      { productId: 'prod-pistachio-1', percentage: 30, preferredRoast: 'محمص مملح' },
      { productId: 'prod-cashew-1', percentage: 30, preferredRoast: 'محمص مملح' },
    ],
  },
];

export default function CustomBoxPage() {
  const { storeData, loading, addCustomBoxToCart, setIsCartOpen, showToast } = useStore();
  const pageContent = getResolvedPageContent(storeData?.settings);

  // 1. Box Size State (500g, 1000g, 2000g)
  const [boxSizeGrams, setBoxSizeGrams] = useState<500 | 1000 | 2000>(1000);

  // 2. Nut Allocations State: Map productId -> { percentage, roast }
  const [allocations, setAllocations] = useState<Record<string, NutAllocation>>({});
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [selectedBuilderCategory, setSelectedBuilderCategory] = useState<string>('all');

  // 3. All eligible products for Custom Box (Luxury Nuts + Dried Fruits & Dates + Savory Snacks)
  const boxEligibleProducts = useMemo(() => {
    if (!storeData?.products) return [];
    return storeData.products.filter(
      (p) => p.categoryId !== 'cat-mixed-boxes' && p.inStock
    );
  }, [storeData]);

  // Filtered products displayed in Step 2 grid based on category tab
  const displayedProducts = useMemo(() => {
    if (selectedBuilderCategory === 'all') return boxEligibleProducts;
    return boxEligibleProducts.filter((p) => p.categoryId === selectedBuilderCategory);
  }, [boxEligibleProducts, selectedBuilderCategory]);

  // Total allocated percentage
  const totalPercentage = useMemo(() => {
    const sum = Object.values(allocations).reduce((acc, item) => acc + (item.percentage || 0), 0);
    return Math.round(sum * 100) / 100;
  }, [allocations]);

  const remainingPercentage = Math.max(0, Math.round((100 - totalPercentage) * 100) / 100);
  const excessPercentage = Math.max(0, Math.round((totalPercentage - 100) * 100) / 100);
  const totalGramsAllocated = Math.round((boxSizeGrams * totalPercentage) / 100);
  const remainingGrams = Math.round((boxSizeGrams * remainingPercentage) / 100);

  // Active portions array for calculateCustomBoxPrice
  const activePortions = useMemo(() => {
    return Object.entries(allocations)
      .filter(([_, alloc]) => alloc.percentage > 0)
      .map(([productId, alloc]) => {
        const product = boxEligibleProducts.find((p) => p.id === productId);
        return product
          ? { product, percentage: alloc.percentage, roastOption: alloc.roast }
          : null;
      })
      .filter(Boolean) as Array<{ product: Product; percentage: number; roastOption: RoastOption }>;
  }, [allocations, boxEligibleProducts]);

  // Dynamic pricing and validation calculation via official pricing engine
  const calculationResult = useMemo(() => {
    if (activePortions.length === 0) {
      return {
        isValid: false,
        totalPrice: 0,
        totalPercentage: 0,
        breakdown: [],
        error: 'يرجى اختيار صنف واحد على الأقل وتحديد نسبته المئوية للعلبة.',
      };
    }
    return calculateCustomBoxPrice(boxSizeGrams, activePortions);
  }, [boxSizeGrams, activePortions]);

  // Estimated price accumulated so far (shown dynamically before reaching 100%)
  const currentAccumulatedPrice = useMemo(() => {
    return activePortions.reduce((sum, item) => {
      const base = getProductBasePriceForBox(item.product, boxSizeGrams);
      return sum + Math.round((base * item.percentage) / 100);
    }, 0);
  }, [activePortions, boxSizeGrams]);

  // Live Nutritional Calculator for the custom mix (weighted per 100g)
  const mixNutritionStats = useMemo(() => {
    if (activePortions.length === 0 || totalPercentage <= 0) {
      return { caloriesPer100g: 0, proteinGramsPer100g: 0 };
    }
    let weightedCalories = 0;
    let weightedProtein = 0;
    activePortions.forEach((p) => {
      const weightRatio = p.percentage / totalPercentage;
      weightedCalories += (p.product.caloriesPer100g || 580) * weightRatio;
      const numericProtein =
        parseFloat(String(p.product.proteinPer100g || '15').replace(/[^\d.]/g, '')) || 15;
      weightedProtein += numericProtein * weightRatio;
    });
    return {
      caloriesPer100g: Math.round(weightedCalories),
      proteinGramsPer100g: Math.round(weightedProtein * 10) / 10,
    };
  }, [activePortions, totalPercentage]);

  // Handlers
  const handleSetPercentage = (productId: string, newPercentage: number) => {
    const product = boxEligibleProducts.find((p) => p.id === productId);
    if (!product) return;

    const currentAlloc = allocations[productId] || {
      percentage: 0,
      roast: product.roastOptions[0] || 'محمص مملح',
    };

    // Calculate maximum percentage this nut can take without exceeding 100% total
    const otherPercentages = totalPercentage - currentAlloc.percentage;
    const maxPossible = Math.max(0, 100 - otherPercentages);
    const clamped = Math.max(0, Math.min(newPercentage, maxPossible));

    setActivePresetId(null);
    setAllocations((prev) => ({
      ...prev,
      [productId]: {
        ...currentAlloc,
        percentage: clamped,
      },
    }));
  };

  const handleStepPercentage = (productId: string, delta: number) => {
    const current = allocations[productId]?.percentage || 0;
    handleSetPercentage(productId, current + delta);
  };

  const handleRoastChange = (productId: string, roast: RoastOption) => {
    setAllocations((prev) => {
      const current = prev[productId] || { percentage: 0, roast };
      return {
        ...prev,
        [productId]: { ...current, roast },
      };
    });
  };

  const handleRemoveNut = (productId: string) => {
    setActivePresetId(null);
    setAllocations((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  // Quick Action 1: Equal Split across selected items (or top 4 luxury nuts if none selected)
  const handleEqualSplit = () => {
    const currentlySelectedIds = Object.keys(allocations).filter(
      (id) => allocations[id]?.percentage > 0
    );
    const targetIds =
      currentlySelectedIds.length > 0
        ? currentlySelectedIds
        : boxEligibleProducts.slice(0, 4).map((p) => p.id);

    const n = targetIds.length;
    if (n === 0) return;

    const baseShare = Math.floor(100 / n);
    const remainder = 100 - baseShare * n;

    const newAlloc: Record<string, NutAllocation> = {};
    boxEligibleProducts.forEach((p) => {
      if (targetIds.includes(p.id)) {
        const idx = targetIds.indexOf(p.id);
        const share = baseShare + (idx < remainder ? 1 : 0);
        const roast = allocations[p.id]?.roast || p.roastOptions[0] || 'محمص مملح';
        newAlloc[p.id] = { percentage: share, roast };
      }
    });

    setActivePresetId(null);
    setAllocations(newAlloc);
    showToast('تم التوزيع المتساوي للنسب', `تم تقسيم 100% بالتساوي على ${n} أصناف`);
  };

  // Quick Action 2: Reset / Clear Mix
  const handleClearMix = () => {
    setActivePresetId(null);
    setAllocations({});
    showToast('تم تفريغ الخلطة', 'يمكنك الآن البدء من جديد واختيار أصنافك المفضلة');
  };

  // Quick Action 3: Apply any of the 5 Ready Mix Presets
  const handleApplyPreset = (preset: MixPreset) => {
    const validItems = preset.items.filter((item) =>
      boxEligibleProducts.some((p) => p.id === item.productId)
    );
    if (validItems.length === 0) return;

    // Normalize percentages to 100% in case any product was deleted by admin
    const rawTotal = validItems.reduce((s, i) => s + i.percentage, 0);
    const newAlloc: Record<string, NutAllocation> = {};
    let runningSum = 0;

    validItems.forEach((item, index) => {
      const product = boxEligibleProducts.find((p) => p.id === item.productId)!;
      const pct =
        index === validItems.length - 1
          ? Math.max(0, 100 - runningSum)
          : Math.round((item.percentage / rawTotal) * 100);
      runningSum += pct;

      const roast =
        item.preferredRoast && product.roastOptions.includes(item.preferredRoast)
          ? item.preferredRoast
          : product.roastOptions[0] || 'محمص مملح';

      newAlloc[product.id] = {
        percentage: pct,
        roast,
      };
    });

    setActivePresetId(preset.id);
    setSelectedBuilderCategory('all');
    setAllocations(newAlloc);
    showToast(`تم تطبيق "${preset.title}" ✨`, preset.subtitle);
  };

  // Add to Cart Safety Gate
  const handleAddToCart = () => {
    if (!calculationResult.isValid || totalPercentage !== 100 || calculationResult.totalPrice <= 0) {
      if (totalPercentage < 100) {
        showToast('سعة العلبة غير مكتملة', `متبقي ${remainingPercentage}% لاكتمال العلبة`);
      } else if (totalPercentage > 100) {
        showToast('سعة العلبة زائدة', `تجاوزت سعة العلبة بمقدار ${excessPercentage}%`);
      }
      return;
    }

    addCustomBoxToCart(boxSizeGrams, calculationResult.breakdown, calculationResult.totalPrice);
    setIsCartOpen(true);
  };

  if (loading && !storeData) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-brand-900 text-gold-400 flex items-center justify-center mx-auto animate-spin text-xl">
          🌰
        </div>
        <p className="text-sm font-extrabold text-brand-900">جاري تحميل تشكيلة المكسرات...</p>
      </div>
    );
  }

  const isAddToCartEnabled = calculationResult.isValid && totalPercentage === 100 && calculationResult.totalPrice > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4 pb-14">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-[11px] font-bold text-brand-600">
        <Link href="/" className="hover:text-brand-900 transition flex items-center gap-1">
          <span>الرئيسية</span>
        </Link>
        <span>/</span>
        <span className="text-brand-950 font-extrabold">كوّن علبتك بنفسك</span>
      </nav>

      {/* Hero Header Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-850 text-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-gold-500/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1 bg-gold-500/20 border border-gold-400/40 text-gold-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Sparkles className="w-2.5 h-2.5" />
              <span>{pageContent.customBoxPageBadge}</span>
            </div>
            <h1 className="text-base sm:text-xl font-extrabold leading-tight">
              {pageContent.customBoxPageTitle}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] shrink-0">
            <button
              type="button"
              onClick={handleEqualSplit}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-2.5 py-1.5 rounded-lg border border-white/20 transition cursor-pointer"
            >
              توزيع متساوي (100%)
            </button>
            {totalPercentage > 0 && (
              <button
                type="button"
                onClick={handleClearMix}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-200 font-bold px-2 py-1.5 rounded-lg border border-red-400/30 transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>تفريغ العلبة</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Ready-Made Mix Presets Bar (One-Click Templates) */}
      <section className="bg-white rounded-xl p-3 border border-brand-200 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-brand-950 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gold-500" />
            <span>قوالب خلطات جاهزة بضغطة واحدة (يمكنك التعديل عليها بحرية):</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {MIX_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-2 rounded-lg border text-right transition flex flex-col justify-between gap-0.5 cursor-pointer ${
                  isActive
                    ? 'bg-brand-900 text-white border-brand-900 shadow-2xs ring-1 ring-gold-400/40'
                    : 'bg-brand-50/70 hover:bg-brand-100/70 text-brand-950 border-brand-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-gold-500 text-brand-950'
                        : 'bg-amber-100 text-brand-900'
                    }`}
                  >
                    {preset.badge}
                  </span>
                  {isActive && <Check className="w-3 h-3 text-gold-400 shrink-0" />}
                </div>
                <div className="font-extrabold text-[11px] leading-snug mt-0.5">{preset.title}</div>
                <div
                  className={`text-[9.5px] leading-snug line-clamp-1 ${
                    isActive ? 'text-brand-200' : 'text-brand-600'
                  }`}
                >
                  {preset.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sticky Mobile & Tablet Live Box Progress Bar (< lg) */}
      <div className="lg:hidden sticky top-[82px] z-20 bg-brand-950/95 backdrop-blur-md text-white rounded-xl p-2.5 border border-gold-500/40 shadow-lg space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
              <span className="text-gold-400">
                الامتلاء: {totalPercentage}%
              </span>
              <span className="text-[9.5px] text-brand-200 font-semibold">
                ({totalGramsAllocated}/{boxSizeGrams} جم)
              </span>
            </div>
            <div className="text-[9.5px] text-brand-200">
              السعر التقديري:{' '}
              <strong className="text-white">
                {calculationResult.isValid ? calculationResult.totalPrice : currentAccumulatedPrice} ج.م
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href="#box-summary"
              className="bg-white/15 hover:bg-white/25 text-white text-[9.5px] font-bold px-2 py-1 rounded-md transition"
            >
              معاينة الصينية ↓
            </a>
            {totalPercentage === 100 && (
              <button
                type="button"
                onClick={handleAddToCart}
                className="bg-gold-500 hover:bg-gold-400 text-brand-950 text-[9.5px] font-extrabold px-2.5 py-1 rounded-md shadow flex items-center gap-1 cursor-pointer"
              >
                <ShoppingBag className="w-2.5 h-2.5" />
                <span>أضف للسلة</span>
              </button>
            )}
          </div>
        </div>

        {/* Mini Segmented Progress Bar */}
        <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden flex gap-0.5 p-0.5">
          {activePortions.map((portion) => {
            const nutColor = NUT_COLORS[portion.product.id] || DEFAULT_NUT_COLOR;
            return (
              <div
                key={portion.product.id}
                style={{ width: `${portion.percentage}%` }}
                className={`h-full ${nutColor.bg} rounded-full transition-all duration-300`}
              />
            );
          })}
        </div>
      </div>

      {/* Main Workspace: 8 cols configuration + 4 cols sticky sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* RIGHT COLUMN: Configuration Sections (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* FEATURE 1: Box Size Selector */}
          <section className="bg-white rounded-xl p-3 border border-brand-200 shadow-2xs space-y-2">
            <h2 className="text-xs font-extrabold text-brand-950 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-900 text-gold-400 text-[9.5px] flex items-center justify-center font-bold">
                1
              </span>
              اختر حجم العلبة
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {([
                {
                  size: 500 as const,
                  label: '500 جم',
                  sub: 'علبة نصف كيلو',
                  badge: null,
                },
                {
                  size: 1000 as const,
                  label: '1 كجم',
                  sub: 'العلبة العائلية',
                  badge: 'الأكثر طلباً ⭐',
                },
                {
                  size: 2000 as const,
                  label: '2 كجم',
                  sub: 'علبة الضيافة الملكية',
                  badge: 'أفضل توفير 👑',
                },
              ]).map((box) => {
                const isSelected = boxSizeGrams === box.size;
                return (
                  <button
                    key={box.size}
                    type="button"
                    onClick={() => setBoxSizeGrams(box.size)}
                    className={`relative p-2 sm:p-2.5 rounded-lg border text-right transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/70 border-gold-500 ring-1 ring-gold-400/30 shadow-2xs'
                        : 'bg-brand-50/50 border-brand-200 hover:border-brand-400'
                    }`}
                  >
                    {box.badge && (
                      <span className="absolute -top-2 left-1.5 bg-brand-900 text-gold-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap">
                        {box.badge}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-brand-950">{box.label}</div>
                      <div className="text-[9px] font-semibold text-brand-600 truncate">
                        {box.sub}
                      </div>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full hidden sm:flex items-center justify-center border shrink-0 ${
                        isSelected
                          ? 'bg-gold-500 border-gold-600 text-brand-950 font-bold'
                          : 'border-brand-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* FEATURE 2: Nut, Dried Fruit & Snack Variety Selection Grid */}
          <section className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xs font-extrabold text-brand-950 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-brand-900 text-gold-400 text-[9.5px] flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                <span>اختر الأصناف ودرجة التحميص والنسبة (إجمالي 100%)</span>
              </h2>

              {/* Category Filter Tabs for Box Builder */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0 sm:flex-wrap">
                {([
                  { id: 'all', label: `كل الأصناف (${boxEligibleProducts.length})` },
                  { id: 'cat-luxury-nuts', label: '🥜 مكسرات فاخرة' },
                  { id: 'cat-dried-fruits', label: '🍑 فواكه مجففة وتمور' },
                  { id: 'cat-snacks', label: '🍿 تسالي ومقرمشات' },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedBuilderCategory(tab.id)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      selectedBuilderCategory === tab.id
                        ? 'bg-brand-900 text-gold-400 shadow-2xs'
                        : 'bg-white text-brand-800 border border-brand-200 hover:bg-brand-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {displayedProducts.map((product) => {
                const currentAlloc = allocations[product.id] || {
                  percentage: 0,
                  roast: product.roastOptions[0] || 'محمص مملح',
                };
                const percentage = currentAlloc.percentage;
                const weightInGrams = Math.round((boxSizeGrams * percentage) / 100);
                const basePriceForBox = getProductBasePriceForBox(product, boxSizeGrams);
                const priceContribution = Math.round((basePriceForBox * percentage) / 100);
                const isSelected = percentage > 0;

                return (
                  <div
                    key={product.id}
                    className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-2xs ${
                      isSelected
                        ? 'border-gold-500 shadow-sm ring-1 ring-gold-400/30'
                        : 'border-brand-200 hover:border-brand-300'
                    }`}
                  >
                    {/* Card Top: Image + Details */}
                    <div className="p-2.5 flex gap-2.5">
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-brand-100 shrink-0">
                        <img
                          src={getSafeImageUrl(product.image)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 bg-gold-500 text-brand-950 rounded-full p-0.5 shadow">
                            <Check className="w-2 h-2 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="text-[11.5px] font-extrabold text-brand-950 truncate">
                            {product.name}
                          </h3>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => handleRemoveNut(product.id)}
                              className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer shrink-0"
                              title="إزالة الصنف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-[9.5px] text-brand-600 mt-0.5">
                          {product.origin} • <span className="font-bold text-brand-900">{basePriceForBox} ج.م</span>/{boxSizeGrams >= 1000 ? `${boxSizeGrams / 1000} كجم` : `${boxSizeGrams} جم`}
                        </div>

                        {/* Roast Selector Chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {product.roastOptions.map((roast) => {
                            const active = currentAlloc.roast === roast;
                            return (
                              <button
                                key={roast}
                                type="button"
                                onClick={() => handleRoastChange(product.id, roast)}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                  active
                                    ? 'bg-brand-900 text-gold-400 border-brand-900'
                                    : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
                                }`}
                              >
                                {roast}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Unified Compact Portion Control Bar */}
                    <div className="px-2.5 py-2 bg-brand-50/60 border-t border-brand-100 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-brand-800">النسبة:</span>
                        <span className="font-extrabold text-brand-950">
                          {percentage}%{' '}
                          {isSelected && (
                            <span className="text-pistachio-700 font-bold">
                              ({weightInGrams} جم • {priceContribution} ج.م)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStepPercentage(product.id, -10)}
                          disabled={percentage <= 0}
                          className="px-1.5 py-0.5 rounded border border-brand-200 bg-white hover:bg-brand-100 text-brand-900 font-extrabold text-[10px] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer shrink-0"
                        >
                          <Minus className="w-2.5 h-2.5" />
                          <span>10%</span>
                        </button>

                        <input
                          type="range"
                          min="0"
                          max={Math.min(100, percentage + remainingPercentage)}
                          step="5"
                          value={percentage}
                          onChange={(e) => handleSetPercentage(product.id, Number(e.target.value))}
                          className="flex-1 h-1.5 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-gold-500"
                        />

                        <button
                          type="button"
                          onClick={() => handleStepPercentage(product.id, 10)}
                          disabled={remainingPercentage <= 0}
                          className="px-1.5 py-0.5 rounded border border-brand-200 bg-white hover:bg-brand-100 text-brand-900 font-extrabold text-[10px] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer shrink-0"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>10%</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* LEFT COLUMN: Sticky Summary Sidebar (4 cols) */}
        <div id="box-summary" className="lg:col-span-4 scroll-mt-24">
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-brand-200 shadow-md sticky top-16 space-y-3">
            <div className="border-b border-brand-100 pb-2.5 flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-extrabold text-brand-950 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-gold-500" />
                <span>ملخص العلبة</span>
              </h3>
              <span className="text-[10px] font-extrabold bg-brand-100 text-brand-900 px-2 py-0.5 rounded-md">
                {boxSizeGrams >= 1000 ? `${boxSizeGrams / 1000} كجم` : `${boxSizeGrams} جم`}
              </span>
            </div>

            {/* Visual Box Gauge & Dynamic Capacity Meter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-extrabold">
                <span className="text-brand-950">الامتلاء:</span>
                <span
                  className={
                    totalPercentage === 100
                      ? 'text-pistachio-700'
                      : totalPercentage > 100
                      ? 'text-red-600'
                      : 'text-amber-700'
                  }
                >
                  {totalPercentage}% ({totalGramsAllocated} / {boxSizeGrams} جم)
                </span>
              </div>

              {/* Segmented Horizontal Progress Bar */}
              <div className="h-3 w-full bg-brand-100 rounded-md overflow-hidden border border-brand-200 flex p-0.5 gap-0.5">
                {activePortions.map((portion) => {
                  const nutColor = NUT_COLORS[portion.product.id] || DEFAULT_NUT_COLOR;
                  return (
                    <div
                      key={portion.product.id}
                      style={{ width: `${portion.percentage}%` }}
                      className={`h-full ${nutColor.bg} rounded-xs transition-all duration-300`}
                      title={`${portion.product.name}: ${portion.percentage}%`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Tri-state Arabic Validation Feedback */}
            {totalPercentage === 0 && (
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-2 text-[10px] text-brand-800 flex items-start gap-1.5">
                <Info className="w-3 h-3 text-brand-600 shrink-0 mt-0.5" />
                <p>ابدأ باختيار أصناف المكسرات من القائمة وتحديد نسب كل صنف لتعبئة العلبة.</p>
              </div>
            )}

            {totalPercentage > 0 && totalPercentage < 100 && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 text-[10px] text-amber-900 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  متبقي <strong>{remainingPercentage}%</strong> لاكتمال العلبة ({remainingGrams} جم). يرجى إكمال السعة إلى 100% لإضافة العلبة للسلة.
                </p>
              </div>
            )}

            {totalPercentage === 100 && (
              <div className="bg-pistachio-50 border border-pistachio-400 rounded-lg p-2 text-[10px] text-pistachio-900 flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-pistachio-600 shrink-0 mt-0.5" />
                <p>
                  العلبة مكتملة 100% وجاهزة للإضافة 🎉 ({boxSizeGrams} جم). يمكنك الآن إضافتها مباشرة إلى السلة!
                </p>
              </div>
            )}

            {totalPercentage > 100 && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-2 text-[10px] text-red-900 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                <p>
                  تجاوزت سعة العلبة بمقدار {excessPercentage}%! يرجى تقليل النسب لتصبح 100%.
                </p>
              </div>
            )}

            {/* Visual Divided Box Tray Preview */}
            {activePortions.length > 0 && (
              <div className="space-y-1.5 border-t border-brand-100 pt-2.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-extrabold text-brand-950 flex items-center gap-1">
                    <span>🍱</span>
                    <span>معاينة صينية العلبة المقسمة:</span>
                  </span>
                  <span className="text-[9.5px] font-bold text-brand-600">
                    {activePortions.length} حجرات
                  </span>
                </div>

                <div className="bg-gradient-to-br from-brand-900 via-brand-950 to-brand-900 p-1.5 rounded-xl border border-gold-500/40 shadow-inner">
                  <div className="grid grid-cols-2 gap-1">
                    {activePortions.map((portion) => {
                      const weight = Math.round((boxSizeGrams * portion.percentage) / 100);
                      return (
                        <div
                          key={portion.product.id}
                          className="relative h-14 rounded-lg overflow-hidden border border-gold-400/30 bg-brand-800 group"
                        >
                          <img
                            src={getSafeImageUrl(portion.product.image)}
                            alt={portion.product.name}
                            className="w-full h-full object-cover opacity-85"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                          <span className="absolute top-1 left-1 bg-gold-500 text-brand-950 text-[8.5px] font-extrabold px-1 py-0.2 rounded shadow">
                            {portion.percentage}%
                          </span>
                          <div className="absolute bottom-1 inset-x-1 text-white">
                            <div className="text-[9.5px] font-bold truncate leading-tight">
                              {portion.product.name}
                            </div>
                            <div className="text-[8px] text-amber-200 truncate">
                              {weight} جم • {portion.roastOption}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {remainingPercentage > 0 && (
                      <div className="h-14 rounded-lg border border-dashed border-gold-400/40 bg-white/5 flex flex-col items-center justify-center text-center p-1">
                        <span className="text-[9.5px] font-bold text-gold-400">
                          + مساحة متبقية {remainingPercentage}%
                        </span>
                        <span className="text-[8px] text-brand-200">
                          ({remainingGrams} جم فارغ)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Mix Nutrition Meter */}
                <div className="bg-pistachio-50/70 border border-pistachio-200 rounded-lg p-1.5 flex items-center justify-between text-[9.5px]">
                  <span className="font-bold text-pistachio-800 flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-pistachio-600" />
                    <span>لكل 100 جم:</span>
                  </span>
                  <div className="flex items-center gap-1.5 font-extrabold text-brand-950">
                    <span>⚡ {mixNutritionStats.caloriesPer100g} سعر</span>
                    <span>•</span>
                    <span className="text-pistachio-700">
                      💪 {mixNutritionStats.proteinGramsPer100g} جم بروتين
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Itemized List of Selected Nuts */}
            <div className="space-y-1.5 border-t border-brand-100 pt-2.5">
              <h4 className="text-[10.5px] font-extrabold text-brand-900">تفاصيل الأوزان والأسعار:</h4>
              {activePortions.length === 0 ? (
                <p className="text-[10px] text-brand-500 italic">لم يتم اختيار أي أصناف بعد</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto pl-1">
                  {activePortions.map((portion) => {
                    const weight = Math.round((boxSizeGrams * portion.percentage) / 100);
                    const basePrice = getProductBasePriceForBox(portion.product, boxSizeGrams);
                    const price = Math.round((basePrice * portion.percentage) / 100);
                    return (
                      <div
                        key={portion.product.id}
                        className="flex items-center justify-between text-[10px] bg-brand-50 p-1.5 rounded-lg border border-brand-100"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img
                            src={getSafeImageUrl(portion.product.image)}
                            alt={portion.product.name}
                            className="w-6 h-6 rounded object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-brand-950 truncate">
                              {portion.product.name}
                            </div>
                            <div className="text-[9px] text-brand-600">
                              {portion.roastOption} • {portion.percentage}% ({weight} جم)
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-brand-950">{price} ج.م</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Total Price in EGP */}
            <div className="border-t border-brand-200 pt-2.5 space-y-1">
              <div className="flex justify-between items-center text-[10px] text-brand-700">
                <span>تغليف علبة فاخرة محكمة:</span>
                <span className="font-bold text-pistachio-700">مجاناً 🎁</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-brand-100">
                <span className="text-[11px] font-extrabold text-brand-950">السعر الإجمالي للعلبة:</span>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-extrabold text-pistachio-700">
                    {calculationResult.isValid ? calculationResult.totalPrice : currentAccumulatedPrice} ج.م
                  </span>
                  <span className="block text-[8.5px] text-brand-500">
                    {calculationResult.isValid ? 'شامل الضريبة والعلبة الفاخرة' : 'سعر تقديري حتى اكتمال 100%'}
                  </span>
                </div>
              </div>
            </div>

            {/* Add to Cart Button (strictly disabled unless 100% capacity and price > 0) */}
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isAddToCartEnabled}
              className={`w-full py-2 px-3 rounded-xl font-extrabold text-[11px] shadow-md transition-all flex items-center justify-center gap-1.5 ${
                isAddToCartEnabled
                  ? 'bg-gradient-to-l from-brand-800 to-brand-950 hover:from-brand-900 hover:to-brand-950 text-white active:scale-95 shadow-brand-900/20 cursor-pointer'
                  : 'bg-brand-200 text-brand-400 cursor-not-allowed shadow-none'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-gold-400" />
              <span>
                {totalPercentage === 100
                  ? `أضف العلبة المشكلة إلى السلة • ${calculationResult.totalPrice} ج.م`
                  : `أكمل 100% لإضافة العلبة للسلة (${totalPercentage}%)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
