'use client';

import React, { useState, useMemo } from 'react';
import {
  Gift,
  Plus,
  Layers,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import {
  CartItem,
  PartitionedBoxTierId,
  Product,
  Promotion,
} from '@/types/store';
import {
  PARTITIONED_BOX_TIERS,
  calculatePartitionedBoxValuation,
} from '@/lib/pricing';
import { getSafeImageUrl, stripUiEmojis } from '@/lib/defaults';
import { StickerPreviewData } from '@/components/SupermarketReceiptModal';

interface PosBoxesPageProps {
  products: Product[];
  promotions: Promotion[];
  canSeeProfits: boolean;
  onAddPosItem: (item: CartItem) => void;
  onPrintSticker: (sticker: StickerPreviewData) => void;
  showToast: (title: string, subtitle?: string) => void;
  boxTab?: 'ready' | 'touch_builder';
  onChangeBoxTab?: (tab: 'ready' | 'touch_builder') => void;
}

interface ReadyPresetBox {
  id: string;
  name: string;
  tierId: PartitionedBoxTierId;
  badge: string;
  slotIds: string[];
}

export default function PosBoxesPage({
  products,
  promotions,
  onAddPosItem,
  showToast,
  boxTab: externalBoxTab,
  onChangeBoxTab,
}: PosBoxesPageProps) {
  const [internalBoxTab, setInternalBoxTab] = useState<'ready' | 'touch_builder'>('ready');
  const boxTab = externalBoxTab ?? internalBoxTab;
  const setBoxTab = (tab: 'ready' | 'touch_builder') => {
    setInternalBoxTab(tab);
    onChangeBoxTab?.(tab);
  };

  // Touch-to-Fill Box Builder State
  const [selectedTierId, setSelectedTierId] = useState<PartitionedBoxTierId>('roqan_4');
  const [slotProducts, setSlotProducts] = useState<Array<Product | null>>([
    null,
    null,
    null,
    null,
  ]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);

  const activeTier = useMemo(
    () =>
      PARTITIONED_BOX_TIERS.find((t) => t.id === selectedTierId) ||
      PARTITIONED_BOX_TIERS[0],
    [selectedTierId]
  );

  // Switch Box Size (4 slots vs 6 slots)
  const handleSelectTier = (tierId: PartitionedBoxTierId) => {
    const tier =
      PARTITIONED_BOX_TIERS.find((t) => t.id === tierId) || PARTITIONED_BOX_TIERS[0];
    setSelectedTierId(tierId);
    const nextSlots: Array<Product | null> = Array.from(
      { length: tier.slotsCount },
      (_, idx) => slotProducts[idx] || null
    );
    setSlotProducts(nextSlots);
    const firstEmpty = nextSlots.findIndex((s) => s === null);
    setActiveSlotIndex(firstEmpty >= 0 ? firstEmpty : 0);
  };

  // Tap a product card -> immediately fills the active/next empty slot
  const handleTapProductForSlot = (prod: Product) => {
    const next = [...slotProducts];
    const targetIdx =
      next[activeSlotIndex] === null
        ? activeSlotIndex
        : next.findIndex((s) => s === null);

    const idxToFill = targetIdx >= 0 ? targetIdx : activeSlotIndex;
    next[idxToFill] = prod;
    setSlotProducts(next);

    const nextEmpty = next.findIndex((s, i) => s === null && i > idxToFill);
    const anyEmpty = next.findIndex((s) => s === null);
    if (nextEmpty >= 0) {
      setActiveSlotIndex(nextEmpty);
    } else if (anyEmpty >= 0) {
      setActiveSlotIndex(anyEmpty);
    } else {
      setActiveSlotIndex((idxToFill + 1) % activeTier.slotsCount);
    }
  };

  const handleClearSlot = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...slotProducts];
    next[idx] = null;
    setSlotProducts(next);
    setActiveSlotIndex(idx);
  };

  const handleClearAllSlots = () => {
    setSlotProducts(Array.from({ length: activeTier.slotsCount }, () => null));
    setActiveSlotIndex(0);
  };

  // Calculate Touch Box Valuation for filled slots
  const filledCount = slotProducts.filter(Boolean).length;
  const isBoxComplete = filledCount === activeTier.slotsCount;

  const touchBoxValuation = useMemo(() => {
    const resolvedProds = slotProducts.map((p) => p || products[0]).filter(Boolean);
    const slotsInput = resolvedProds.map((p, idx) => ({
      slotNumber: idx + 1,
      product: p,
      roastOption: p.roastOptions?.[0] || 'محمص مملح',
    }));
    return calculatePartitionedBoxValuation(activeTier, slotsInput);
  }, [activeTier, slotProducts, products]);

  const handleAddTouchBoxToInvoice = () => {
    if (!isBoxComplete) {
      showToast(
        'أكمل خانات البوكس أولاً',
        `متبقي ${activeTier.slotsCount - filledCount} خانة فارغة — اضغط على الأصناف لملئها`
      );
      return;
    }

    onAddPosItem({
      cartItemId: `pos-touchbox-${activeTier.id}-${Date.now()}`,
      productId: `box-${activeTier.id}`,
      productName: `${activeTier.name} (${activeTier.slotsCount} خانات)`,
      productImage: getSafeImageUrl(slotProducts[0]?.image),
      weightId: activeTier.id,
      weightLabel: `${activeTier.totalGrams} جم (${activeTier.slotsCount} خانات)`,
      roastOption: slotProducts.map((p) => p?.name).join(' + '),
      unitPrice: touchBoxValuation.finalBoxPriceEgp,
      quantity: 1,
      rawCostEgp: touchBoxValuation.totalRawCostEgp,
      customWeightGrams: activeTier.totalGrams,
      isPartitionedBox: true,
      partitionedBoxTierId: activeTier.id,
      partitionedSlots: touchBoxValuation.slots,
    });

    showToast(
      `تمت إضافة "${activeTier.name}" للفاتورة`,
      `${touchBoxValuation.finalBoxPriceEgp} ج.م`
    );
    handleClearAllSlots();
  };

  // Ready 1-Click Boxes Catalog
  const readyBoxes: ReadyPresetBox[] = useMemo(() => {
    const p = (idx: number) => products[idx]?.id || products[0]?.id || '';
    return [
      {
        id: 'ready-roqan-4',
        name: 'بوكس الروقان الجاهز (4 خانات)',
        tierId: 'roqan_4',
        badge: '600 جم',
        slotIds: [p(2), p(5), p(6), p(10)],
      },
      {
        id: 'ready-sahra-4',
        name: 'بوكس السهرة والتسالي (4 خانات)',
        tierId: 'roqan_4',
        badge: '600 جم',
        slotIds: [p(5), p(6), p(7), p(8)],
      },
      {
        id: 'ready-family-6',
        name: 'بوكس لمة العيلة (6 خانات)',
        tierId: 'family_6',
        badge: '900 جم',
        slotIds: [p(0), p(1), p(2), p(3), p(5), p(12)],
      },
      {
        id: 'ready-vip-6',
        name: 'بوكس الملوك VIP الفاخر (6 خانات)',
        tierId: 'vip_6',
        badge: '1200 جم',
        slotIds: [p(0), p(1), p(2), p(3), p(4), p(12)],
      },
    ];
  }, [products]);

  const handleAddReadyBox = (preset: ReadyPresetBox) => {
    const tier =
      PARTITIONED_BOX_TIERS.find((t) => t.id === preset.tierId) ||
      PARTITIONED_BOX_TIERS[0];
    const slotsInput = preset.slotIds.map((pid, idx) => {
      const prod =
        products.find((p) => p.id === pid) || products[idx % products.length];
      return {
        slotNumber: idx + 1,
        product: prod,
        roastOption: prod?.roastOptions?.[0] || 'محمص مملح',
      };
    });
    const val = calculatePartitionedBoxValuation(tier, slotsInput);
    onAddPosItem({
      cartItemId: `pos-ready-box-${preset.id}-${Date.now()}`,
      productId: preset.id,
      productName: preset.name,
      productImage: getSafeImageUrl(slotsInput[0]?.product?.image),
      weightId: tier.id,
      weightLabel: `${tier.totalGrams} جم (${tier.slotsCount} خانات)`,
      roastOption: val.slots.map((s) => s.productName).join(' + '),
      unitPrice: val.finalBoxPriceEgp,
      quantity: 1,
      rawCostEgp: val.totalRawCostEgp,
      customWeightGrams: tier.totalGrams,
      isPartitionedBox: true,
      partitionedBoxTierId: tier.id,
      partitionedSlots: val.slots,
    });
  };

  const handleAddPromoBox = (promo: Promotion) => {
    const effectivePrice = promo.discountedPrice ?? promo.promoPrice ?? 0;
    onAddPosItem({
      cartItemId: `pos-promo-${promo.id}`,
      productId: promo.id,
      productName: stripUiEmojis(promo.title),
      productImage: getSafeImageUrl(promo.image),
      weightId: 'promo-box',
      weightLabel: stripUiEmojis(promo.badgeText || 'بوكس عرض جاهز'),
      roastOption: stripUiEmojis(promo.subtitle),
      unitPrice: effectivePrice,
      quantity: 1,
      rawCostEgp: Math.round(effectivePrice * 0.72),
    });
  };

  return (
    <div className="space-y-4">
      {/* =================================================================== */}
      {/* 2 SIMPLE MODE TABS: READY BOXES VS TOUCH-TO-FILL BOX BUILDER        */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 gap-3 bg-white p-2 rounded-2xl border border-[#E8E0D5]">
        <button
          type="button"
          onClick={() => setBoxTab('ready')}
          className={`py-3 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
            boxTab === 'ready'
              ? 'bg-[#231710] text-white'
              : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>البوكسات الجاهزة (بضغطة واحدة)</span>
        </button>

        <button
          type="button"
          onClick={() => setBoxTab('touch_builder')}
          className={`py-3 px-4 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
            boxTab === 'touch_builder'
              ? 'bg-[#231710] text-white'
              : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>تكوين بوكس مخصوص باللمس (اختر الأصناف)</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: READY 1-CLICK BOXES                                          */}
      {/* =================================================================== */}
      {boxTab === 'ready' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {readyBoxes.map((preset) => {
            const tier =
              PARTITIONED_BOX_TIERS.find((t) => t.id === preset.tierId) ||
              PARTITIONED_BOX_TIERS[0];
            const slotsInput = preset.slotIds.map((pid, idx) => {
              const prod =
                products.find((p) => p.id === pid) ||
                products[idx % Math.max(1, products.length)];
              return {
                slotNumber: idx + 1,
                product: prod,
                roastOption: prod?.roastOptions?.[0] || 'محمص مملح',
              };
            });
            const val = calculatePartitionedBoxValuation(tier, slotsInput);

            return (
              <div
                key={preset.id}
                className="bg-white rounded-2xl border border-[#E8E0D5] hover:border-[#C5B8A8] p-4 flex flex-col justify-between transition space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#6B5B4E] text-xs font-bold px-2.5 py-1 rounded-lg">
                      {preset.badge}
                    </span>
                    <span className="font-cairo font-bold text-xl text-[#231710] tabular-nums">
                      {val.finalBoxPriceEgp} ج.م
                    </span>
                  </div>

                  <h3 className="font-cairo font-bold text-base text-[#231710]">
                    {preset.name}
                  </h3>

                  {/* Simple Pills of Contents */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {val.slots.map((s) => (
                      <span
                        key={s.slotNumber}
                        className="bg-[#FAF6F0] text-[#6B5B4E] text-[11px] font-medium px-2 py-0.5 rounded-md border border-[#E8E0D5]"
                      >
                        {s.productName}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddReadyBox(preset)}
                  className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة للفاتورة ({val.finalBoxPriceEgp} ج.م)</span>
                </button>
              </div>
            );
          })}

          {promotions
            .filter((p) => p.active)
            .map((promo) => (
              <div
                key={promo.id}
                className="bg-white rounded-2xl border border-[#E8E0D5] hover:border-[#C5B8A8] p-4 flex flex-col justify-between transition space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836] text-xs font-bold px-2.5 py-1 rounded-lg">
                      عرض جاهز
                    </span>
                    <span className="font-cairo font-bold text-xl text-[#231710] tabular-nums">
                      {promo.discountedPrice ?? promo.promoPrice} ج.م
                    </span>
                  </div>

                  <h3 className="font-cairo font-bold text-base text-[#231710]">
                    {stripUiEmojis(promo.title)}
                  </h3>
                  <p className="text-xs font-medium text-[#6B5B4E] line-clamp-2">
                    {stripUiEmojis(promo.subtitle)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddPromoBox(promo)}
                  className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة للفاتورة ({promo.discountedPrice ?? promo.promoPrice} ج.م)</span>
                </button>
              </div>
            ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: TOUCH-TO-FILL CUSTOM BOX                                     */}
      {/* =================================================================== */}
      {boxTab === 'touch_builder' && (
        <div className="space-y-4">
          {/* Step 1: Pick Box Size (3 Clean Buttons) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PARTITIONED_BOX_TIERS.map((tier) => {
              const isSelected = selectedTierId === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => handleSelectTier(tier.id)}
                  className={`p-3.5 rounded-2xl border text-right transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#231710] text-white border-[#231710]'
                      : 'bg-white text-[#231710] border-[#E8E0D5] hover:border-[#C5B8A8]'
                  }`}
                >
                  <div>
                    <div className="font-cairo font-bold text-sm">{tier.name}</div>
                    <div className="text-xs opacity-80">
                      {tier.slotsCount} خانات × {tier.gramsPerSlot} جم = {tier.totalGrams} جم
                    </div>
                  </div>
                  <span className="font-cairo font-bold text-xs px-2.5 py-1 rounded-xl bg-black/10 tabular-nums">
                    {tier.slotsCount} خانات
                  </span>
                </button>
              );
            })}
          </div>

          {/* Step 2: Visual Box Slots Tray + Instant Add Button */}
          <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-cairo font-bold text-sm text-[#231710]">
                  خانات البوكس ({filledCount} من {activeTier.slotsCount}):
                </span>
                <span className="text-xs font-medium text-[#6B5B4E]">
                  اضغط على أي صنف بالأسفل لملء الخانة المحددة
                </span>
              </div>

              {filledCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSlots}
                  className="text-xs font-bold text-[#B83B2B] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إفراغ الخانات</span>
                </button>
              )}
            </div>

            {/* Visual Slots Grid (4 or 6 Slots) */}
            <div
              className={`grid gap-2.5 ${
                activeTier.slotsCount === 4
                  ? 'grid-cols-2 sm:grid-cols-4'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
              }`}
            >
              {slotProducts.map((slotProd, idx) => {
                const isTarget = activeSlotIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveSlotIndex(idx)}
                    className={`relative rounded-2xl p-2.5 border transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[96px] ${
                      slotProd
                        ? 'bg-[#FAF6F0] border-[#231710]'
                        : isTarget
                          ? 'bg-[#FAF6F0] border-[#9A6836] border-dashed'
                          : 'bg-[#FAF6F0]/50 border-[#E8E0D5] border-dashed'
                    }`}
                  >
                    <span className="absolute top-1.5 right-2 text-[10px] font-bold text-[#6B5B4E]">
                      #{idx + 1}
                    </span>

                    {slotProd ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleClearSlot(idx, e)}
                          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-red-50 hover:bg-red-100 text-[#B83B2B] flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <img
                          src={getSafeImageUrl(slotProd.image)}
                          alt={slotProd.name}
                          className="w-10 h-10 rounded-lg object-cover mb-1"
                        />
                        <span className="font-cairo font-bold text-xs text-[#231710] line-clamp-1">
                          {slotProd.name}
                        </span>
                        <span className="text-[10px] font-medium text-[#6B5B4E] tabular-nums">
                          {activeTier.gramsPerSlot} جم
                        </span>
                      </>
                    ) : (
                      <div className="text-xs font-medium text-[#6B5B4E] py-2">
                        {isTarget ? 'اختر صنفاً' : 'خانة فارغة'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Bar of Box Tray */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E8E0D5]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#6B5B4E]">سعر البوكس:</span>
                <span className="font-cairo font-bold text-2xl text-[#231710] tabular-nums">
                  {filledCount > 0 ? touchBoxValuation.finalBoxPriceEgp : activeTier.basePriceEgp}{' '}
                  ج.م
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddTouchBoxToInvoice}
                disabled={!isBoxComplete}
                className={`px-6 py-3 rounded-xl font-cairo font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
                  isBoxComplete
                    ? 'bg-[#231710] hover:bg-[#3A271C] text-white'
                    : 'bg-[#FAF6F0] text-[#6B5B4E] border border-[#E8E0D5] cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {isBoxComplete
                    ? `إضافة البوكس للفاتورة (${touchBoxValuation.finalBoxPriceEgp} ج.م)`
                    : `اختر ${activeTier.slotsCount - filledCount} أصناف متبقية`}
                </span>
              </button>
            </div>
          </div>

          {/* Step 3: Simple Touch Product Cards Grid to Fill Slots */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {products.map((prod) => {
              const slotCost = Math.round(
                ((prod.pricePerKg || 400) * activeTier.gramsPerSlot) / 1000
              );
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleTapProductForSlot(prod)}
                  className="bg-white hover:bg-[#FAF6F0] border border-[#E8E0D5] hover:border-[#C5B8A8] rounded-2xl p-2.5 text-right transition cursor-pointer flex items-center gap-2.5"
                >
                  <img
                    src={getSafeImageUrl(prod.image)}
                    alt={prod.name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#FAF6F0]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-cairo font-bold text-xs text-[#231710] truncate">
                      {prod.name}
                    </div>
                    <div className="text-[11px] font-bold text-[#9A6836] tabular-nums mt-0.5">
                      + خانة ({slotCost} ج)
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
