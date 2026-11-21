'use client';

import React, { useState, useMemo } from 'react';
import {
  Scale,
  Barcode,
  Search,
  Plus,
  Tag,
  X,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import {
  CartItem,
  Category,
  Product,
  WeightVariant,
} from '@/types/store';
import {
  calculatePosItemByAmountEgp,
  calculatePosItemByGrams,
  getProductBarcode,
  getProductStockUnitLabel,
  getResolvedProductWeights,
  isUnitProduct,
  parseScaleBarcode,
} from '@/lib/pricing';
import { formatCategoryName, getSafeImageUrl } from '@/lib/defaults';
import { StickerPreviewData } from '@/components/SupermarketReceiptModal';

interface PosDirectSalesPageProps {
  products: Product[];
  categories: Category[];
  canSeeProfits: boolean;
  onAddPosItem: (item: CartItem) => void;
  onPrintSticker: (sticker: StickerPreviewData) => void;
  showToast: (title: string, subtitle?: string) => void;
  playCashierBeep: (freq?: number, duration?: number) => void;
  selectedCategoryId?: string;
  onSelectCategoryId?: (catId: string) => void;
  enableWeightScale?: boolean;
  currencySymbol?: string;
}

const LOW_STOCK_THRESHOLD_KG = 5;

const QUICK_WEIGHTS = [
  { grams: 125, label: 'ثمن' },
  { grams: 250, label: 'ربع' },
  { grams: 500, label: 'نصف' },
  { grams: 1000, label: 'كيلو' },
];

export default function PosDirectSalesPage({
  products,
  categories,
  onAddPosItem,
  onPrintSticker,
  showToast,
  playCashierBeep,
  selectedCategoryId: externalCategoryId,
  onSelectCategoryId,
  enableWeightScale = true,
  currencySymbol = 'ج.م',
}: PosDirectSalesPageProps) {
  const weightProducts = useMemo(
    () => products.filter((p) => !isUnitProduct(p)),
    [products]
  );
  const [internalCategoryId, setInternalCategoryId] = useState<string>('all');
  const selectedCategoryId = externalCategoryId ?? internalCategoryId;
  const setSelectedCategoryId = (catId: string) => {
    setInternalCategoryId(catId);
    onSelectCategoryId?.(catId);
  };
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [mobileInputMode, setMobileInputMode] = useState<'search' | 'barcode'>('search');
  const [stockFilter, setStockFilter] = useState<'all' | 'low_stock'>('all');

  // Per-card quick roast selection state
  const [cardRoasts, setCardRoasts] = useState<Record<string, string>>({});

  // On-Demand Custom Scale / Sell-by-Amount Modal State (Hidden by default)
  const [scaleModalProduct, setScaleModalProduct] = useState<Product | null>(null);
  const [scaleMode, setScaleMode] = useState<'by_amount_egp' | 'by_grams'>('by_amount_egp');
  const [scaleGrams, setScaleGrams] = useState<number>(250);
  const [scaleTargetEgp, setScaleTargetEgp] = useState<number>(50);
  const [scaleRoast, setScaleRoast] = useState<string>('محمص مملح');
  const [scaleWorkerNotes, setScaleWorkerNotes] = useState<string>('');

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.showInPos !== false) {
        // product is allowed in POS
      } else {
        return false;
      }
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) {
        return false;
      }
      if (stockFilter === 'low_stock') {
        const s = typeof p.stockKg === 'number' ? p.stockKg : 50;
        if (!(!p.inStock || s <= LOW_STOCK_THRESHOLD_KG)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.subCategoryName || '').toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategoryId, searchQuery, stockFilter]);

  const shortageCount = useMemo(() => {
    return products.filter((p) => {
      if (p.showInPos === false) return false;
      const s = typeof p.stockKg === 'number' ? p.stockKg : 50;
      return !p.inStock || s <= LOW_STOCK_THRESHOLD_KG;
    }).length;
  }, [products]);

  // Live Digital Scale Calculation (only when modal is open)
  const scaleCalculation = useMemo(() => {
    if (!scaleModalProduct) return null;
    const prodIdx = Math.max(
      0,
      products.findIndex((p) => p.id === scaleModalProduct.id)
    );
    if (scaleMode === 'by_amount_egp') {
      return calculatePosItemByAmountEgp(scaleModalProduct, scaleTargetEgp, prodIdx);
    }
    return calculatePosItemByGrams(scaleModalProduct, scaleGrams, prodIdx);
  }, [scaleModalProduct, scaleMode, scaleGrams, scaleTargetEgp, products]);

  // Barcode / Scale Input Handler
  const executeBarcodeScan = (rawCode: string): boolean => {
    const codeToScan = rawCode.trim();
    if (!codeToScan) return false;

    const parsed = parseScaleBarcode(codeToScan, products);
    if (!parsed) {
      playCashierBeep(320, 0.25);
      showToast('باركود غير معروف', `لم يتم العثور على الصنف: ${codeToScan}`);
      return false;
    }

    const { product, calc, barcodeKind } = parsed;
    const isDeterministicSku = barcodeKind === 'sku' || isUnitProduct(product);
    const weightId = isUnitProduct(product) ? 'u-1' : `scale-${calc.weightGrams}`;
    const cartItemId = isDeterministicSku
      ? `pos-sku-${product.id}-${weightId}`
      : `pos-bc-${product.id}-${calc.weightGrams}-${calc.unitPrice}-${Date.now()}`;

    onAddPosItem({
      cartItemId,
      productId: product.id,
      productName: product.name,
      productImage: getSafeImageUrl(product.image),
      weightId,
      weightLabel: calc.weightLabel,
      roastOption: product.roastOptions?.[0] || '',
      unitPrice: calc.unitPrice,
      quantity: 1,
      rawCostEgp: calc.rawCostEgp,
      customWeightGrams: calc.weightGrams,
      barcodeLabel: calc.barcodeLabel,
    });
    return true;
  };

  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    executeBarcodeScan(barcodeInput);
    setBarcodeInput('');
  };

  // 1-Click Add Unit / Pack Variant from Card
  const handleQuickAddUnitVariant = (prod: Product, variant: WeightVariant) => {
    const prodIdx = Math.max(0, products.findIndex((p) => p.id === prod.id));
    const roast = cardRoasts[prod.id] || prod.roastOptions?.[0] || '';
    const units = Math.max(
      1,
      variant.unitsCount || Math.round((variant.weightGrams || 1000) / 1000) || 1
    );
    const unitBaseCost =
      prod.unitCost ??
      prod.costPerKg ??
      Math.round((prod.unitPrice ?? prod.pricePerKg ?? variant.price) * 0.7);
    const rawCostEgp = Math.round(unitBaseCost * units * 100) / 100;

    onAddPosItem({
      cartItemId: `pos-unit-${prod.id}-${variant.id}-${roast}`,
      productId: prod.id,
      productName: prod.name,
      productImage: getSafeImageUrl(prod.image),
      weightId: variant.id,
      weightLabel: variant.label,
      roastOption: roast,
      unitPrice: variant.price,
      quantity: 1,
      rawCostEgp,
      customWeightGrams: units * 1000,
      barcodeLabel: getProductBarcode(prod, prodIdx),
    });
  };

  // 1-Click Add Product Weight from Card
  const handleQuickAddWeight = (prod: Product, weightGrams: number) => {
    const prodIdx = Math.max(0, products.findIndex((p) => p.id === prod.id));
    const calc = calculatePosItemByGrams(prod, weightGrams, prodIdx);
    const roast = cardRoasts[prod.id] || prod.roastOptions?.[0] || '';

    onAddPosItem({
      cartItemId: `pos-${prod.id}-${weightGrams}-${roast}`,
      productId: prod.id,
      productName: prod.name,
      productImage: getSafeImageUrl(prod.image),
      weightId: `w-${weightGrams}`,
      weightLabel: calc.weightLabel,
      roastOption: roast,
      unitPrice: calc.unitPrice,
      quantity: 1,
      rawCostEgp: calc.rawCostEgp,
      customWeightGrams: calc.weightGrams,
      barcodeLabel: calc.barcodeLabel,
    });
  };

  // Open Scale / Custom Amount Modal for a Product
  const openProductScaleModal = (prod: Product, defaultMode: 'by_amount_egp' | 'by_grams' = 'by_amount_egp') => {
    setScaleModalProduct(prod);
    setScaleMode(defaultMode);
    setScaleRoast(cardRoasts[prod.id] || prod.roastOptions?.[0] || 'سادة');
    setScaleTargetEgp(50);
    setScaleGrams(250);
    setScaleWorkerNotes('');
  };

  // Add from Scale Modal
  const handleConfirmScaleModal = () => {
    if (!scaleModalProduct || !scaleCalculation) return;
    onAddPosItem({
      cartItemId: `pos-scale-${scaleModalProduct.id}-${scaleCalculation.weightGrams}-${scaleCalculation.unitPrice}-${scaleRoast}-${scaleWorkerNotes}`,
      productId: scaleModalProduct.id,
      productName: scaleModalProduct.name,
      productImage: getSafeImageUrl(scaleModalProduct.image),
      weightId: `scale-${scaleCalculation.weightGrams}`,
      weightLabel: scaleCalculation.weightLabel,
      roastOption: scaleRoast,
      unitPrice: scaleCalculation.unitPrice,
      quantity: 1,
      rawCostEgp: scaleCalculation.rawCostEgp,
      customWeightGrams: scaleCalculation.weightGrams,
      barcodeLabel: scaleCalculation.barcodeLabel,
      workerNotes: scaleWorkerNotes.trim() || undefined,
    });
    setScaleModalProduct(null);
  };

  return (
    <div className="space-y-3">
      {/* =================================================================== */}
      {/* COMPACT MOBILE-FIRST SEARCH / BARCODE / SCALE & CATEGORY BAR        */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-[#E8E0D5] space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile (<lg): Quick Mode Toggle (بحث / باركود) */}
          <div className="flex lg:hidden items-center bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileInputMode('search')}
              aria-label="وضع البحث بالاسم"
              className={`min-h-[40px] px-2.5 rounded-lg text-xs font-cairo font-bold flex items-center gap-1 transition cursor-pointer ${
                mobileInputMode === 'search'
                  ? 'bg-[#231710] text-white'
                  : 'text-[#6B5A4E] hover:text-[#231710]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>بحث</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileInputMode('barcode')}
              aria-label="وضع مسح الباركود"
              className={`min-h-[40px] px-2.5 rounded-lg text-xs font-cairo font-bold flex items-center gap-1 transition cursor-pointer ${
                mobileInputMode === 'barcode'
                  ? 'bg-[#231710] text-white'
                  : 'text-[#6B5A4E] hover:text-[#231710]'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>باركود</span>
            </button>
          </div>

          {/* Instant Search (Always visible on lg+, shown on mobile when mobileInputMode === 'search') */}
          <div
            className={`relative flex-1 min-w-0 lg:min-w-[220px] ${
              mobileInputMode === 'search' ? 'block' : 'hidden lg:block'
            }`}
          >
            <Search className="w-4 h-4 text-[#6B5B4E] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="pos-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  (e.currentTarget as HTMLInputElement).blur();
                  return;
                }
                if (e.key === 'Enter' && searchQuery.trim().length >= 4) {
                  const candidate = searchQuery.trim();
                  if (/^[\d\u0660-\u0669]{4,}$/.test(candidate)) {
                    e.preventDefault();
                    if (executeBarcodeScan(candidate)) {
                      setSearchQuery('');
                    }
                  }
                }
              }}
              placeholder="ابحث باسم الصنف أو الباركود (F2)..."
              className="w-full min-h-[42px] sm:min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm font-medium outline-none"
            />
          </div>

          {/* Compact Barcode Input (Always visible on lg+, shown on mobile when mobileInputMode === 'barcode') */}
          <form
            onSubmit={handleBarcodeScanSubmit}
            className={`items-center gap-1.5 ${
              mobileInputMode === 'barcode' ? 'flex flex-1 min-w-0' : 'hidden lg:flex'
            }`}
          >
            <div className="relative flex-1 lg:w-56">
              <Barcode className="w-4 h-4 text-[#9A6836] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="pos-barcode-input"
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="مسح تلقائي (وزن 20 / سعر 21-22)..."
                className="w-full min-h-[42px] sm:min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl pr-9 pl-2.5 py-2 text-xs font-medium outline-none tabular-nums"
              />
            </div>
          </form>

          {/* On-Demand Free Scale Button ("ميزان حر") */}
          {enableWeightScale && weightProducts.length > 0 && (
            <button
              type="button"
              onClick={() => openProductScaleModal(weightProducts[0], 'by_amount_egp')}
              className="min-h-[42px] sm:min-h-[44px] bg-[#231710] hover:bg-[#3A271C] text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition"
            >
              <Scale className="w-4 h-4 shrink-0" />
              <span className="lg:hidden">ميزان حر</span>
              <span className="hidden lg:inline">ميزان حر / بيع بمبلغ</span>
            </button>
          )}
        </div>

        {/* Clean Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryId('all');
              setStockFilter('all');
            }}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-cairo font-bold cursor-pointer shrink-0 transition ${
              selectedCategoryId === 'all' && stockFilter === 'all'
                ? 'bg-[#231710] text-white'
                : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] hover:bg-[#F3ECE1]'
            }`}
          >
            الكل ({products.length})
          </button>
          {shortageCount > 0 && (
            <button
              type="button"
              onClick={() => setStockFilter((prev) => (prev === 'low_stock' ? 'all' : 'low_stock'))}
              className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold cursor-pointer flex items-center gap-1.5 shrink-0 transition ${
                stockFilter === 'low_stock'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>النواقص ({shortageCount})</span>
            </button>
          )}
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setStockFilter('all');
              }}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-cairo font-bold cursor-pointer flex items-center gap-1.5 shrink-0 transition ${
                selectedCategoryId === cat.id
                  ? 'bg-[#231710] text-white'
                  : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] hover:bg-[#F3ECE1]'
              }`}
            >
              <span>{formatCategoryName(cat.name)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SQUARE-STYLE ZERO-TRUNCATION PRODUCT TILES                          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
        {filteredProducts.map((prod) => {
          const prodIdx = Math.max(0, products.findIndex((p) => p.id === prod.id));
          const unitMode = isUnitProduct(prod);
          const stockUnitLabel = getProductStockUnitLabel(prod);
          const unitVariants = unitMode ? getResolvedProductWeights(prod) : [];
          const activeRoast = cardRoasts[prod.id] || prod.roastOptions?.[0] || '';
          const hasMultipleRoasts = (prod.roastOptions?.length || 0) > 1;

          const stockKg = typeof prod.stockKg === 'number' ? Math.max(0, prod.stockKg) : 50;
          const isOutOfStock = !prod.inStock || stockKg <= 0;
          const isLowStock = !isOutOfStock && stockKg <= LOW_STOCK_THRESHOLD_KG;

          return (
            <div
              key={prod.id}
              className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 transition ${
                isOutOfStock
                  ? 'bg-red-50/20 border-red-200 opacity-80'
                  : isLowStock
                    ? 'bg-amber-50/20 border-amber-200 hover:border-amber-400'
                    : 'bg-white border-[#E8E0D5] hover:border-[#C5B8A8]'
              }`}
            >
              {/* Top: Image + Name + Roast */}
              <div>
                <div className="relative h-20 sm:h-24 rounded-xl overflow-hidden bg-[#FAF6F0] mb-2.5">
                  <img
                    src={getSafeImageUrl(prod.image)}
                    alt={prod.name}
                    className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale-40' : ''}`}
                  />
                  {/* Price per Kg / Unit Badge */}
                  <span className="absolute top-1.5 right-1.5 bg-white/95 text-[#231710] border border-[#E8E0D5] text-[11px] font-bold px-2 py-0.5 rounded-lg tabular-nums">
                    {unitMode
                      ? `${prod.unitPrice ?? prod.pricePerKg ?? 0} ${currencySymbol}/${stockUnitLabel}`
                      : `${prod.pricePerKg || 400} ${currencySymbol}/كجم`}
                  </span>

                  {/* Low-Stock / Out-of-Stock Indicator Badge */}
                  {isOutOfStock ? (
                    <span className="absolute top-1.5 left-1.5 bg-red-600/95 text-white text-[11px] font-cairo font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-white shrink-0" />
                      <span>نفد المخزون</span>
                    </span>
                  ) : isLowStock ? (
                    <span className="absolute top-1.5 left-1.5 bg-amber-600/95 text-white text-[11px] font-cairo font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 tabular-nums">
                      <AlertTriangle className="w-3 h-3 text-white shrink-0" />
                      <span>
                        {unitMode
                          ? `متبقي ${stockKg} ${stockUnitLabel}`
                          : stockKg >= 1
                            ? `متبقي ${stockKg} كجم`
                            : `متبقي ${Math.round(stockKg * 1000)} جم`}
                      </span>
                    </span>
                  ) : null}

                  {/* Custom Scale / Amount Trigger Button (Weight Products Only) */}
                  {!unitMode && enableWeightScale && (
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => openProductScaleModal(prod, 'by_amount_egp')}
                      title="وزن حر أو بيع بمبلغ"
                      className={`absolute bottom-1.5 left-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-cairo font-bold flex items-center gap-1 transition ${
                        isOutOfStock
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-white/95 hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] cursor-pointer'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>مبلغ / وزن</span>
                    </button>
                  )}
                </div>

                <div className="flex items-start justify-between gap-1.5 mb-2">
                  <h3 className="font-cairo font-bold text-sm text-[#231710] leading-snug break-words flex-1 min-w-0">
                    {prod.name}
                  </h3>
                  {isLowStock ? (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0 tabular-nums">
                      {stockKg} {stockUnitLabel}
                    </span>
                  ) : isOutOfStock ? (
                    <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md shrink-0">
                      0 {stockUnitLabel}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-[#6B5B4E] bg-[#FAF6F0] border border-[#E8E0D5] px-1.5 py-0.5 rounded-md shrink-0 tabular-nums">
                      {stockKg} {stockUnitLabel}
                    </span>
                  )}
                </div>

                {/* Simple Roast Toggle (Zero-Truncation Multi-line Safe) */}
                {hasMultipleRoasts && (
                  <div className="flex flex-wrap items-center gap-1 mb-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E8E0D5]">
                    {prod.roastOptions!.slice(0, 3).map((roastOpt) => (
                      <button
                        key={roastOpt}
                        type="button"
                        onClick={() =>
                          setCardRoasts((prev) => ({ ...prev, [prod.id]: roastOpt }))
                        }
                        className={`flex-1 min-w-[60px] min-h-[36px] py-1 px-2 rounded-lg text-[11px] font-bold leading-snug break-words transition cursor-pointer ${
                          activeRoast === roastOpt
                            ? 'bg-[#231710] text-white'
                            : 'text-[#6B5A4E] hover:text-[#231710]'
                        }`}
                      >
                        {roastOpt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom: Unit Add Buttons OR 4 Big 1-Click Weight Buttons */}
              {unitMode ? (
                <div className={unitVariants.length <= 1 ? 'grid grid-cols-1 gap-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-1.5'}>
                  {unitVariants.slice(0, 4).map((uv) => (
                    <button
                      key={uv.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => {
                        if (isOutOfStock) {
                          playCashierBeep(300, 0.2);
                          showToast('نفد المخزون', `صنف "${prod.name}" غير متوفر حالياً بالمخزن`);
                          return;
                        }
                        handleQuickAddUnitVariant(prod, uv);
                      }}
                      className={`min-h-[40px] sm:min-h-[44px] rounded-xl py-2 px-2.5 flex items-center justify-between gap-1.5 text-right transition group ${
                        isOutOfStock
                          ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                          : 'bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710] cursor-pointer'
                      }`}
                    >
                      <span className="font-cairo font-bold text-xs leading-snug break-words flex items-center gap-1 min-w-0">
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span className="leading-snug break-words">{uv.label}</span>
                      </span>
                      <span
                        className={`font-bold text-xs tabular-nums shrink-0 ${
                          isOutOfStock
                            ? 'text-gray-400'
                            : 'text-[#6B5B4E] group-hover:text-white'
                        }`}
                      >
                        {uv.price} {currencySymbol}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_WEIGHTS.map((w) => {
                    const calc = calculatePosItemByGrams(prod, w.grams, prodIdx);
                    return (
                      <button
                        key={w.grams}
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => {
                          if (isOutOfStock) {
                            playCashierBeep(300, 0.2);
                            showToast('نفد المخزون', `صنف "${prod.name}" غير متوفر حالياً بالمخزن`);
                            return;
                          }
                          handleQuickAddWeight(prod, w.grams);
                        }}
                        className={`min-h-[40px] sm:min-h-[44px] rounded-xl py-2 px-2 flex items-center justify-between gap-1 transition group ${
                          isOutOfStock
                            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                            : 'bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710] cursor-pointer'
                        }`}
                      >
                        <span className="font-cairo font-bold text-xs leading-snug">{w.label}</span>
                        <span className={`font-bold text-xs tabular-nums shrink-0 ${
                          isOutOfStock
                            ? 'text-gray-400'
                            : 'text-[#6B5B4E] group-hover:text-white'
                        }`}>
                          {calc.unitPrice} {currencySymbol}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* ON-DEMAND SCALE / SELL-BY-AMOUNT MODAL                              */}
      {/* =================================================================== */}
      {scaleModalProduct && scaleCalculation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-[#E8E0D5] shadow-xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={getSafeImageUrl(scaleModalProduct.image)}
                  alt={scaleModalProduct.name}
                  className="w-12 h-12 rounded-xl object-cover border border-[#E8E0D5]"
                />
                <div>
                  <h3 className="font-cairo font-bold text-base text-[#231710]">
                    {scaleModalProduct.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-[#9A6836] tabular-nums">
                      سعر الكيلو: {scaleModalProduct.pricePerKg || 400} ج.م
                    </span>
                    <span className="text-xs text-[#E8E0D5]">•</span>
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        (scaleModalProduct.stockKg ?? 50) <= LOW_STOCK_THRESHOLD_KG
                          ? 'text-amber-700 font-bold'
                          : 'text-[#6B5B4E]'
                      }`}
                    >
                      المخزون المتاح: {scaleModalProduct.stockKg ?? 50} كجم
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScaleModalProduct(null)}
                className="w-10 h-10 rounded-xl bg-[#FAF6F0] hover:bg-red-50 text-[#231710] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Switcher inside Modal */}
            <div>
              <select
                value={scaleModalProduct.id}
                onChange={(e) => {
                  const found = products.find((p) => p.id === e.target.value);
                  if (found) {
                    setScaleModalProduct(found);
                    setScaleRoast(found.roastOptions?.[0] || 'سادة');
                  }
                }}
                className="w-full min-h-[42px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
              >
                {weightProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.pricePerKg || 400} {currencySymbol}/كجم)
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Switcher: By EGP Amount vs By Weight Grams */}
            <div className="grid grid-cols-2 gap-2 bg-[#FAF6F0] p-1.5 rounded-2xl border border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => setScaleMode('by_amount_egp')}
                className={`min-h-[42px] py-2 rounded-xl font-cairo font-bold text-xs cursor-pointer transition ${
                  scaleMode === 'by_amount_egp'
                    ? 'bg-[#231710] text-white'
                    : 'text-[#231710]'
                }`}
              >
                بيع بمبلغ (عايز بـ ... جنيه)
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('by_grams')}
                className={`min-h-[42px] py-2 rounded-xl font-cairo font-bold text-xs cursor-pointer transition ${
                  scaleMode === 'by_grams'
                    ? 'bg-[#231710] text-white'
                    : 'text-[#231710]'
                }`}
              >
                وزن بالجرام (جم)
              </button>
            </div>

            {/* Input & Quick Buttons */}
            {scaleMode === 'by_amount_egp' ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={scaleTargetEgp}
                    onChange={(e) =>
                      setScaleTargetEgp(Math.max(5, Number(e.target.value) || 0))
                    }
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-2xl px-4 py-3 text-xl font-bold text-center text-[#231710] tabular-nums outline-none"
                  />
                  <span className="font-cairo font-bold text-sm text-[#231710] shrink-0">
                    ج.م
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[20, 30, 50, 100, 150, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setScaleTargetEgp(amt)}
                      className={`min-h-[40px] py-2 rounded-xl text-xs font-bold tabular-nums cursor-pointer border transition ${
                        scaleTargetEgp === amt
                          ? 'bg-[#231710] text-white border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                      }`}
                    >
                      {amt} ج
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={scaleGrams}
                    onChange={(e) =>
                      setScaleGrams(Math.max(10, Number(e.target.value) || 0))
                    }
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-2xl px-4 py-3 text-xl font-bold text-center text-[#231710] tabular-nums outline-none"
                  />
                  <span className="font-cairo font-bold text-sm text-[#231710] shrink-0">
                    جرام
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[100, 125, 200, 250, 500, 1000].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setScaleGrams(g)}
                      className={`min-h-[40px] py-2 rounded-xl text-xs font-bold tabular-nums cursor-pointer border transition ${
                        scaleGrams === g
                          ? 'bg-[#231710] text-white border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                      }`}
                    >
                      {g} جم
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Digital Result Display */}
            <div className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#6B5B4E] block">الوزن الصافي</span>
                <span className="font-cairo font-bold text-xl text-[#9A6836] tabular-nums">
                  {scaleCalculation.weightGrams} جم
                </span>
              </div>
              <div className="text-left">
                <span className="text-[11px] text-[#6B5B4E] block">السعر النهائي</span>
                <span className="font-cairo font-bold text-2xl text-[#231710] tabular-nums">
                  {scaleCalculation.unitPrice} ج.م
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmScaleModal}
                className="flex-1 bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة للفاتورة ({scaleCalculation.unitPrice} ج.م)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onPrintSticker({
                    title: scaleModalProduct.name,
                    weightLabel: scaleCalculation.weightLabel,
                    roastOrSpec: scaleRoast,
                    price: scaleCalculation.unitPrice,
                    barcode:
                      scaleCalculation.barcodeLabel ||
                      getProductBarcode(scaleModalProduct, 0),
                    date: new Date().toLocaleDateString('ar-EG'),
                  });
                }}
                className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-4 py-3.5 rounded-2xl font-cairo font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Tag className="w-4 h-4 text-[#9A6836]" />
                <span>استيكر</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
