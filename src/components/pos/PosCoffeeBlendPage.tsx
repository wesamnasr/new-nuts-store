'use client';

import React, { useState, useMemo } from 'react';
import {
  Coffee,
  Plus,
  Tag,
  Layers,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  CartItem,
  CoffeeBlendRoastLevel,
  CoffeeBlendSpicingOption,
  CoffeeGrindSize,
  Product,
} from '@/types/store';
import {
  COFFEE_ORIGINS_CATALOG,
  COFFEE_SPICING_SURCHARGE_PER_KG,
} from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
import { StickerPreviewData } from '@/components/SupermarketReceiptModal';

interface PosCoffeeBlendPageProps {
  products: Product[];
  canSeeProfits: boolean;
  onAddPosItem: (item: CartItem) => void;
  onPrintSticker: (sticker: StickerPreviewData) => void;
  showToast: (title: string, subtitle?: string) => void;
}

interface CustomBagItem {
  id: string;
  originId: string;
  name: string;
  grams: number;
  priceEgp: number;
  costEgp: number;
}

const ROAST_OPTIONS: Array<{ id: CoffeeBlendRoastLevel; label: string }> = [
  { id: 'light', label: 'فاتح' },
  { id: 'medium', label: 'وسط' },
  { id: 'dark', label: 'غامق' },
];

const SPICING_OPTIONS: Array<{ id: CoffeeBlendSpicingOption; label: string }> = [
  { id: 'plain', label: 'سادة' },
  { id: 'cardamom', label: 'محوج بالحبهان' },
  { id: 'royal_mix', label: 'تحويجة ملكية' },
  { id: 'extra_cardamom', label: 'حبهان مضاعف' },
];

const GRIND_OPTIONS: Array<{ id: CoffeeGrindSize; label: string }> = [
  { id: 'turkish_fine', label: 'ناعم تركي' },
  { id: 'espresso_medium', label: 'اسبريسو' },
  { id: 'french_coarse', label: 'خشن / فرنش' },
  { id: 'whole_bean', label: 'حصى بدون طحن' },
];

const READY_COFFEE_CARDS = [
  {
    id: 'blend-hafsa-royal',
    name: 'توليفة حفصة الملكية الخاصة',
    desc: 'برازيلي + كولومبي + حبشي',
    pricePerKg: 580,
    costPerKg: 430,
  },
  {
    id: 'blend-turkish-classic',
    name: 'توليفة تركي كلاسيك بوش تقيل',
    desc: 'برازيلي + هندي روبوستا',
    pricePerKg: 500,
    costPerKg: 375,
  },
  {
    id: 'blend-espresso-crema',
    name: 'توليفة اسبريسو إيطالي كريما',
    desc: 'كولومبي + برازيلي + روبوستا',
    pricePerKg: 560,
    costPerKg: 420,
  },
  {
    id: 'blend-arabic-majlis',
    name: 'توليفة القهوة العربي والديوانية',
    desc: 'يمني مطري + حبشي ييرغاشيف',
    pricePerKg: 760,
    costPerKg: 575,
  },
  ...COFFEE_ORIGINS_CATALOG.map((o) => ({
    id: `single-${o.id}`,
    name: `${o.name} (صنف صافي)`,
    desc: o.flavorNote,
    pricePerKg: o.pricePerKg,
    costPerKg: o.costPerKg,
  })),
];

const QUICK_WEIGHTS = [
  { grams: 125, label: 'ثمن' },
  { grams: 250, label: 'ربع' },
  { grams: 500, label: 'نصف' },
  { grams: 1000, label: 'كيلو' },
];

export default function PosCoffeeBlendPage({
  products,
  onAddPosItem,
  onPrintSticker,
  showToast,
  coffeeTab: externalCoffeeTab,
  onChangeCoffeeTab,
}: PosCoffeeBlendPageProps & {
  coffeeTab?: 'ready' | 'custom_bag';
  onChangeCoffeeTab?: (tab: 'ready' | 'custom_bag') => void;
}) {
  const [internalCoffeeTab, setInternalCoffeeTab] = useState<'ready' | 'custom_bag'>('ready');
  const coffeeTab = externalCoffeeTab ?? internalCoffeeTab;
  const setCoffeeTab = (tab: 'ready' | 'custom_bag') => {
    setInternalCoffeeTab(tab);
    onChangeCoffeeTab?.(tab);
  };

  // Shared Roast / Spicing / Grind Toggles
  const [roastLevel, setRoastLevel] = useState<CoffeeBlendRoastLevel>('medium');
  const [spicing, setSpicing] = useState<CoffeeBlendSpicingOption>('cardamom');
  const [grindSize, setGrindSize] = useState<CoffeeGrindSize>('turkish_fine');

  // Custom Amount Modal for Ready Coffee Cards
  const [amountModalCard, setAmountModalCard] = useState<
    (typeof READY_COFFEE_CARDS)[number] | null
  >(null);
  const [targetEgp, setTargetEgp] = useState<number>(50);

  // Custom Bag State (Add beans by grams or EGP without percentage sliders)
  const [bagItems, setBagItems] = useState<CustomBagItem[]>([]);

  const roastLabel =
    ROAST_OPTIONS.find((r) => r.id === roastLevel)?.label || 'وسط';
  const spicingLabel =
    SPICING_OPTIONS.find((s) => s.id === spicing)?.label || 'سادة';
  const grindLabel =
    GRIND_OPTIONS.find((g) => g.id === grindSize)?.label || 'ناعم تركي';

  const spicingSurchargePerKg =
    COFFEE_SPICING_SURCHARGE_PER_KG[spicing]?.pricePerKg || 0;
  const spicingCostPerKg =
    COFFEE_SPICING_SURCHARGE_PER_KG[spicing]?.costPerKg || 0;

  const coffeeImage = useMemo(() => {
    const p = products.find((item) => item.categoryId === 'cat-coffee');
    return getSafeImageUrl(p?.image);
  }, [products]);

  // Add Ready Coffee Card by Weight
  const handleAddReadyCoffeeWeight = (
    card: (typeof READY_COFFEE_CARDS)[number],
    grams: number
  ) => {
    const effectivePricePerKg = card.pricePerKg + spicingSurchargePerKg;
    const effectiveCostPerKg = card.costPerKg + spicingCostPerKg;
    const priceEgp = Math.round((effectivePricePerKg * grams) / 1000);
    const costEgp = Math.round((effectiveCostPerKg * grams) / 100) / 10;

    const weightText =
      grams === 125
        ? 'ثمن كيلو (125 جم)'
        : grams === 250
          ? 'ربع كيلو (250 جم)'
          : grams === 500
            ? 'نصف كيلو (500 جم)'
            : grams === 1000
              ? 'كيلو (1000 جم)'
              : `${grams} جم`;

    const specSummary = `تحميص ${roastLabel} • ${spicingLabel} • ${grindLabel}`;

    onAddPosItem({
      cartItemId: `pos-coffee-${card.id}-${grams}-${roastLevel}-${spicing}-${grindSize}`,
      productId: card.id,
      productName: card.name,
      productImage: coffeeImage,
      weightId: `coffee-${grams}`,
      weightLabel: weightText,
      roastOption: specSummary,
      unitPrice: priceEgp,
      quantity: 1,
      rawCostEgp: costEgp,
      customWeightGrams: grams,
    });
  };

  // Confirm Ready Coffee by EGP Amount
  const handleConfirmAmountModal = () => {
    if (!amountModalCard) return;
    const effectivePricePerKg = amountModalCard.pricePerKg + spicingSurchargePerKg;
    const effectiveCostPerKg = amountModalCard.costPerKg + spicingCostPerKg;
    const grams = Math.max(25, Math.round((targetEgp / effectivePricePerKg) * 1000));
    const costEgp = Math.round((effectiveCostPerKg * grams) / 100) / 10;
    const specSummary = `تحميص ${roastLabel} • ${spicingLabel} • ${grindLabel}`;

    onAddPosItem({
      cartItemId: `pos-coffee-amt-${amountModalCard.id}-${targetEgp}-${Date.now()}`,
      productId: amountModalCard.id,
      productName: amountModalCard.name,
      productImage: coffeeImage,
      weightId: `coffee-egp-${targetEgp}`,
      weightLabel: `بـ ${targetEgp} ج.م (${grams} جم)`,
      roastOption: specSummary,
      unitPrice: targetEgp,
      quantity: 1,
      rawCostEgp: costEgp,
      customWeightGrams: grams,
    });
    setAmountModalCard(null);
  };

  // Add Bean to Custom Bag by Grams
  const handleAddBeanByGrams = (
    origin: (typeof COFFEE_ORIGINS_CATALOG)[number],
    grams: number
  ) => {
    const priceEgp = Math.round((origin.pricePerKg * grams) / 1000);
    const costEgp = Math.round((origin.costPerKg * grams) / 100) / 10;

    setBagItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.originId === origin.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        const newGrams = next[existingIdx].grams + grams;
        next[existingIdx] = {
          ...next[existingIdx],
          grams: newGrams,
          priceEgp: Math.round((origin.pricePerKg * newGrams) / 1000),
          costEgp: Math.round((origin.costPerKg * newGrams) / 100) / 10,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `${origin.id}-${Date.now()}`,
          originId: origin.id,
          name: origin.name,
          grams,
          priceEgp,
          costEgp,
        },
      ];
    });
  };

  // Add Bean to Custom Bag by EGP Amount
  const handleAddBeanByEgp = (
    origin: (typeof COFFEE_ORIGINS_CATALOG)[number],
    amountEgp: number
  ) => {
    const grams = Math.max(20, Math.round((amountEgp / origin.pricePerKg) * 1000));
    handleAddBeanByGrams(origin, grams);
  };

  // Custom Bag Totals
  const bagTotals = useMemo(() => {
    const totalGrams = bagItems.reduce((s, i) => s + i.grams, 0);
    const beansPrice = bagItems.reduce((s, i) => s + i.priceEgp, 0);
    const beansCost = bagItems.reduce((s, i) => s + i.costEgp, 0);
    const spicingPrice = Math.round((spicingSurchargePerKg * totalGrams) / 1000);
    const spicingCost = Math.round((spicingCostPerKg * totalGrams) / 100) / 10;

    return {
      totalGrams,
      finalPriceEgp: beansPrice + spicingPrice,
      finalCostEgp: beansCost + spicingCost,
      recipeText: bagItems.map((i) => `${i.name} (${i.grams} جم)`).join(' + '),
    };
  }, [bagItems, spicingSurchargePerKg, spicingCostPerKg]);

  const handleAddCustomBagToInvoice = () => {
    if (bagItems.length === 0) return;
    const specText = `${bagTotals.recipeText} • تحميص ${roastLabel} • ${spicingLabel} • ${grindLabel}`;

    onAddPosItem({
      cartItemId: `pos-custom-blend-bag-${Date.now()}`,
      productId: 'custom-coffee-blend',
      productName: `توليفة بن مخصوصة (${bagTotals.totalGrams} جم)`,
      productImage: coffeeImage,
      weightId: `blend-${bagTotals.totalGrams}`,
      weightLabel: `${bagTotals.totalGrams} جم صافي`,
      roastOption: specText,
      unitPrice: bagTotals.finalPriceEgp,
      quantity: 1,
      rawCostEgp: bagTotals.finalCostEgp,
      customWeightGrams: bagTotals.totalGrams,
      isCoffeeBlend: true,
    });

    showToast(
      'تمت إضافة كيس التوليفة للفاتورة',
      `${bagTotals.totalGrams} جم • ${bagTotals.finalPriceEgp} ج.م`
    );
    setBagItems([]);
  };

  return (
    <div className="space-y-4">
      {/* =================================================================== */}
      {/* 2 SIMPLE TABS: READY COFFEE VS CUSTOM BLEND BAG                     */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 gap-3 bg-white p-2 rounded-2xl border border-[#E8E0D5]">
        <button
          type="button"
          onClick={() => setCoffeeTab('ready')}
          className={`py-3 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
            coffeeTab === 'ready'
              ? 'bg-[#231710] text-white'
              : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>توليفات وبن جاهز (بضغطة واحدة)</span>
        </button>

        <button
          type="button"
          onClick={() => setCoffeeTab('custom_bag')}
          className={`py-3 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
            coffeeTab === 'custom_bag'
              ? 'bg-[#231710] text-white'
              : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>خلط توليفة مخصوصة (بالجرام أو الجنيه)</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* SIMPLE ROAST / SPICING / GRIND BAR (1-CLICK PILLS)                  */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-3.5 border border-[#E8E0D5] grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Roast */}
        <div className="flex items-center gap-1.5 bg-[#FAF6F0] p-1.5 rounded-xl border border-[#E8E0D5]">
          <span className="text-xs font-bold text-[#6B5B4E] px-2 shrink-0">
            التحميص:
          </span>
          {ROAST_OPTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoastLevel(r.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-cairo font-bold transition cursor-pointer ${
                roastLevel === r.id
                  ? 'bg-[#231710] text-white'
                  : 'text-[#231710] hover:bg-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Spicing */}
        <div className="flex items-center gap-1 bg-[#FAF6F0] p-1.5 rounded-xl border border-[#E8E0D5] overflow-x-auto">
          <span className="text-xs font-bold text-[#6B5B4E] px-1.5 shrink-0">
            التحويجة:
          </span>
          {SPICING_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSpicing(s.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-cairo font-bold shrink-0 transition cursor-pointer ${
                spicing === s.id
                  ? 'bg-[#231710] text-white'
                  : 'text-[#231710] hover:bg-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Grind */}
        <div className="flex items-center gap-1 bg-[#FAF6F0] p-1.5 rounded-xl border border-[#E8E0D5] overflow-x-auto">
          <span className="text-xs font-bold text-[#6B5B4E] px-1.5 shrink-0">
            الطحن:
          </span>
          {GRIND_OPTIONS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGrindSize(g.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-cairo font-bold shrink-0 transition cursor-pointer ${
                grindSize === g.id
                  ? 'bg-[#231710] text-white'
                  : 'text-[#231710] hover:bg-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: READY COFFEE & BLENDS                                        */}
      {/* =================================================================== */}
      {coffeeTab === 'ready' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {READY_COFFEE_CARDS.map((card) => {
            const effectivePricePerKg = card.pricePerKg + spicingSurchargePerKg;
            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-[#E8E0D5] hover:border-[#C5B8A8] p-4 flex flex-col justify-between transition space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="bg-[#FAF6F0] text-[#9A6836] border border-[#E8E0D5] text-[11px] font-bold px-2.5 py-0.5 rounded-lg tabular-nums">
                      {effectivePricePerKg} ج/كجم
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAmountModalCard(card);
                        setTargetEgp(50);
                      }}
                      className="bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] px-2.5 py-1 rounded-lg text-xs font-cairo font-bold transition cursor-pointer"
                    >
                      بيع بمبلغ
                    </button>
                  </div>

                  <h3 className="font-cairo font-bold text-base text-[#231710]">
                    {card.name}
                  </h3>
                  <p className="text-xs font-medium text-[#6B5B4E] mt-0.5">
                    {card.desc}
                  </p>
                </div>

                {/* 4 Big 1-Click Weight Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_WEIGHTS.map((w) => {
                    const price = Math.round((effectivePricePerKg * w.grams) / 1000);
                    return (
                      <button
                        key={w.grams}
                        type="button"
                        onClick={() => handleAddReadyCoffeeWeight(card, w.grams)}
                        className="bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710] rounded-xl py-2.5 px-2.5 flex items-center justify-between transition cursor-pointer group"
                      >
                        <span className="font-cairo font-bold text-xs">{w.label}</span>
                        <span className="font-bold text-xs text-[#6B5B4E] group-hover:text-white tabular-nums">
                          {price} ج
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: CUSTOM BLEND BAG BY GRAMS OR EGP                             */}
      {/* =================================================================== */}
      {coffeeTab === 'custom_bag' && (
        <div className="space-y-4">
          {/* Top Tray: Current Custom Coffee Bag */}
          <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-cairo font-bold text-base text-[#231710]">
                  كيس التوليفة الحالي:
                </span>
                <span className="text-xs font-medium text-[#6B5B4E]">
                  اضغط على أوزان أو مبالغ البن بالأسفل لإضافتها في نفس الكيس
                </span>
              </div>

              {bagItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBagItems([])}
                  className="text-xs font-bold text-[#B83B2B] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إفراغ الكيس</span>
                </button>
              )}
            </div>

            {bagItems.length === 0 ? (
              <div className="bg-[#FAF6F0] rounded-xl p-5 text-center border border-dashed border-[#E8E0D5] text-xs font-medium text-[#6B5B4E]">
                الكيس فارغ حالياً — اختر من أصناف البن بالأسفل بالجرام أو بالجنيه لتكوين التوليفة
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bagItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 flex items-center gap-2.5"
                  >
                    <div>
                      <span className="font-cairo font-bold text-xs text-[#231710] block">
                        {item.name}
                      </span>
                      <span className="text-[11px] font-medium text-[#6B5B4E] tabular-nums">
                        {item.grams} جم • {item.priceEgp} ج.م
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setBagItems((prev) => prev.filter((x) => x.id !== item.id))
                      }
                      className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-[#B83B2B] flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Total & Add Bag Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E8E0D5]">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs font-medium text-[#6B5B4E] block">
                    إجمالي وزن الكيس
                  </span>
                  <span className="font-cairo font-bold text-lg text-[#231710] tabular-nums">
                    {bagTotals.totalGrams} جم
                  </span>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#6B5B4E] block">
                    إجمالي سعر التوليفة
                  </span>
                  <span className="font-cairo font-bold text-2xl text-[#231710] tabular-nums">
                    {bagTotals.finalPriceEgp} ج.م
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {bagItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onPrintSticker({
                        title: `توليفة بن مخصوصة (${bagTotals.totalGrams} جم)`,
                        weightLabel: `${bagTotals.totalGrams} جم`,
                        roastOrSpec: `${bagTotals.recipeText} • ${roastLabel} • ${spicingLabel}`,
                        price: bagTotals.finalPriceEgp,
                        barcode: `209900${String(bagTotals.totalGrams).padStart(5, '0')}7`,
                        date: new Date().toLocaleDateString('ar-EG'),
                      })
                    }
                    className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-4 py-3 rounded-xl font-cairo font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Tag className="w-4 h-4 text-[#9A6836]" />
                    <span>طباعة استيكر</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddCustomBagToInvoice}
                  disabled={bagItems.length === 0}
                  className={`px-6 py-3 rounded-xl font-cairo font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
                    bagItems.length > 0
                      ? 'bg-[#231710] hover:bg-[#3A271C] text-white'
                      : 'bg-[#FAF6F0] text-[#6B5B4E] border border-[#E8E0D5] cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة كيس التوليفة للفاتورة ({bagTotals.finalPriceEgp} ج.م)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bean Cards to Add into Bag by Grams or EGP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {COFFEE_ORIGINS_CATALOG.map((origin) => (
              <div
                key={origin.id}
                className="bg-white rounded-2xl border border-[#E8E0D5] hover:border-[#C5B8A8] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-cairo font-bold text-base text-[#231710]">
                    {origin.name}
                  </h3>
                  <span className="bg-[#FAF6F0] text-[#9A6836] text-xs font-bold px-2.5 py-0.5 rounded-lg border border-[#E8E0D5] tabular-nums">
                    {origin.pricePerKg} ج/كجم
                  </span>
                </div>

                {/* Add by Grams */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[#6B5B4E] block">
                    إضافة بالجرام للكيس:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[50, 100, 125, 250].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleAddBeanByGrams(origin, g)}
                        className="bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] rounded-xl py-2 text-xs font-bold tabular-nums cursor-pointer transition"
                      >
                        +{g} جم
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add by Money EGP */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[#9A6836] block">
                    إضافة بمبلغ بالجنيه للكيس:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[25, 50, 75, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleAddBeanByEgp(origin, amt)}
                        className="bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] rounded-xl py-2 text-xs font-bold tabular-nums cursor-pointer transition"
                      >
                        + بـ {amt} ج
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ON-DEMAND SELL-BY-AMOUNT MODAL FOR READY COFFEE                     */}
      {/* =================================================================== */}
      {amountModalCard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-[#E8E0D5] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
              <h3 className="font-cairo font-bold text-base text-[#231710]">
                بيع بمبلغ: {amountModalCard.name}
              </h3>
              <button
                type="button"
                onClick={() => setAmountModalCard(null)}
                className="w-8 h-8 rounded-xl bg-[#FAF6F0] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <input
                type="number"
                min={10}
                step={5}
                value={targetEgp}
                onChange={(e) => setTargetEgp(Math.max(10, Number(e.target.value) || 0))}
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-2xl px-4 py-3 text-2xl font-bold text-center text-[#231710] tabular-nums outline-none"
              />
              <div className="grid grid-cols-5 gap-1.5">
                {[30, 50, 100, 150, 200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTargetEgp(amt)}
                    className={`py-2 rounded-xl text-xs font-bold tabular-nums cursor-pointer border transition ${
                      targetEgp === amt
                        ? 'bg-[#231710] text-white border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                    }`}
                  >
                    {amt} ج
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] rounded-2xl p-3.5 flex items-center justify-between">
              <span className="text-xs text-[#6B5B4E] font-medium">الوزن المقابل للمبلغ:</span>
              <span className="font-cairo font-bold text-lg text-[#9A6836] tabular-nums">
                {Math.max(
                  25,
                  Math.round(
                    (targetEgp / (amountModalCard.pricePerKg + spicingSurchargePerKg)) *
                      1000
                  )
                )}{' '}
                جم
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmAmountModal}
              className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-sm py-3.5 rounded-2xl cursor-pointer transition"
            >
              + إضافة للفاتورة ({targetEgp} ج.م)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
