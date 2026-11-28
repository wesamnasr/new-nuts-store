'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Image as ImageIcon,
  ImageOff,
  Package,
  Plus,
  Scale,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import {
  CartItem,
  Category,
  PrepMethodOption,
  Product,
  ProductAddonOption,
  WeightVariant,
} from '@/types/store';
import {
  calculatePosItemByAmountEgp,
  calculatePosItemByGrams,
  getProductBarcode,
  getProductStockUnitLabel,
  getResolvedProductWeights,
  isUnitProduct,
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
  prepMethods?: PrepMethodOption[];
  productAddons?: ProductAddonOption[];
  canAddProduct?: boolean;
  onOpenQuickAddProduct?: () => void;
}

const LOW_STOCK_THRESHOLD_KG = 5;

const UNIFIED_WEIGHT_MODES = [
  { id: '125' as const, grams: 125, label: 'ثمن', short: '125 جم' },
  { id: '250' as const, grams: 250, label: 'ربع', short: '250 جم' },
  { id: '500' as const, grams: 500, label: 'نصف', short: '500 جم' },
  { id: '1000' as const, grams: 1000, label: 'كيلو', short: '1 كجم' },
  { id: 'custom' as const, grams: 0, label: 'ميزان حر', short: 'مبلغ / جم' },
];

type ActiveWeightModeId = (typeof UNIFIED_WEIGHT_MODES)[number]['id'];
type SellingTypeFilter = 'all' | 'weight' | 'unit' | 'low_stock';

const fmtNum = (val: number) =>
  Number.isFinite(val) ? Number(Math.round(val * 100) / 100).toLocaleString('en-US') : '0';

// 6-Category Fixed Color Coding (UX Constitution — Muscle Memory & Instant Visual Scan)
function getCategoryAccentColor(categoryId?: string, categoryName?: string): {
  bar: string;
  dot: string;
} {
  const id = (categoryId || '').toLowerCase();
  const name = (categoryName || '').toLowerCase();
  if (id.includes('box') || name.includes('بوكس') || name.includes('هدايا')) {
    return { bar: 'bg-[#7F1D1D]', dot: 'bg-[#7F1D1D]' }; // Burgundy — Boxes
  }
  if (id.includes('coffee') || name.includes('بن') || name.includes('قهوة') || name.includes('إسبريسو')) {
    return { bar: 'bg-[#231710]', dot: 'bg-[#231710]' }; // Espresso — Coffee & Drinks
  }
  if (id.includes('honey') || id.includes('date') || id.includes('spice') || name.includes('عسل') || name.includes('تمر') || name.includes('عطارة')) {
    return { bar: 'bg-[#C88A4B]', dot: 'bg-[#C88A4B]' }; // Honey Oak — Honey & Spices
  }
  if (id.includes('offer') || id.includes('promo') || name.includes('عرض') || name.includes('عروض')) {
    return { bar: 'bg-[#1D4ED8]', dot: 'bg-[#1D4ED8]' }; // Calm Blue — Active Promos
  }
  if (id.includes('cup') || id.includes('snack') || id.includes('candy') || name.includes('كاندي') || name.includes('كوبا') || name.includes('تسالي')) {
    return { bar: 'bg-[#BE185D]', dot: 'bg-[#BE185D]' }; // Soft Rose — Candy & Cups
  }
  return { bar: 'bg-[#D4AF37]', dot: 'bg-[#D4AF37]' }; // Royal Gold — Luxury Nuts
}

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
  prepMethods = [],
  productAddons = [],
  canAddProduct = false,
  onOpenQuickAddProduct,
}: PosDirectSalesPageProps) {
  const weightProducts = useMemo(() => products.filter((p) => !isUnitProduct(p)), [products]);
  const unitProductsCount = useMemo(() => products.filter((p) => isUnitProduct(p)).length, [products]);

  const [internalCategoryId, setInternalCategoryId] = useState<string>('all');
  const selectedCategoryId = externalCategoryId ?? internalCategoryId;
  const setSelectedCategoryId = (catId: string) => {
    setInternalCategoryId(catId);
    onSelectCategoryId?.(catId);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sellingTypeFilter, setSellingTypeFilter] = useState<SellingTypeFilter>('all');
  const [activeWeightMode, setActiveWeightMode] = useState<ActiveWeightModeId>('250');
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);

  // Per-product remembered roast (when customized)
  const [cardRoasts, setCardRoasts] = useState<Record<string, string>>({});

  // On-Demand Custom Scale / Roast / Sell-by-Amount Modal State
  const [scaleModalProduct, setScaleModalProduct] = useState<Product | null>(null);
  const [scaleMode, setScaleMode] = useState<'by_amount_egp' | 'by_grams'>('by_amount_egp');
  const [scaleGrams, setScaleGrams] = useState<number>(250);
  const [scaleTargetEgp, setScaleTargetEgp] = useState<number>(50);
  const [scaleRoast, setScaleRoast] = useState<string>('');
  const [scaleWorkerNotes, setScaleWorkerNotes] = useState<string>('');
  const [scaleSelectedAddons, setScaleSelectedAddons] = useState<ProductAddonOption[]>([]);

  const shortageCount = useMemo(() => {
    return products.filter((p) => {
      if (p.showInPos === false) return false;
      const s = typeof p.stockKg === 'number' ? p.stockKg : 50;
      return !p.inStock || s <= LOW_STOCK_THRESHOLD_KG;
    }).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.showInPos === false) return false;

      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) {
        return false;
      }

      if (sellingTypeFilter === 'weight' && isUnitProduct(p)) return false;
      if (sellingTypeFilter === 'unit' && !isUnitProduct(p)) return false;
      if (sellingTypeFilter === 'low_stock') {
        const s = typeof p.stockKg === 'number' ? p.stockKg : 50;
        if (!(!p.inStock || s <= LOW_STOCK_THRESHOLD_KG)) return false;
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
  }, [products, selectedCategoryId, searchQuery, sellingTypeFilter]);

  const activeWeightObj = useMemo(
    () => UNIFIED_WEIGHT_MODES.find((w) => w.id === activeWeightMode) || UNIFIED_WEIGHT_MODES[1],
    [activeWeightMode]
  );

  // Live Digital Scale Calculation (only when modal is open)
  const scaleCalculation = useMemo(() => {
    if (!scaleModalProduct) return null;
    const prodIdx = Math.max(0, products.findIndex((p) => p.id === scaleModalProduct.id));
    if (scaleMode === 'by_amount_egp') {
      return calculatePosItemByAmountEgp(scaleModalProduct, scaleTargetEgp, prodIdx);
    }
    return calculatePosItemByGrams(scaleModalProduct, scaleGrams, prodIdx);
  }, [scaleModalProduct, scaleMode, scaleGrams, scaleTargetEgp, products]);

  // 1-Click Add Unit / Pack Variant
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

  // 1-Click Add Weight Product using Unified Top Weight Bar
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

  // Open Scale / Roast / Amount Modal for a Product
  const openProductScaleModal = (
    prod: Product,
    defaultMode: 'by_amount_egp' | 'by_grams' = 'by_grams'
  ) => {
    setScaleModalProduct(prod);
    setScaleMode(defaultMode);
    setScaleRoast(cardRoasts[prod.id] || prod.roastOptions?.[0] || '');
    setScaleTargetEgp(50);
    setScaleGrams(activeWeightObj.grams > 0 ? activeWeightObj.grams : 250);
    setScaleWorkerNotes('');
    setScaleSelectedAddons([]);
  };

  const handleConfirmScaleModal = () => {
    if (!scaleModalProduct || !scaleCalculation) return;
    if (scaleRoast) {
      setCardRoasts((prev) => ({ ...prev, [scaleModalProduct.id]: scaleRoast }));
    }
    const addonsExtra = scaleSelectedAddons.reduce((s, a) => s + Number(a.extraPrice || 0), 0);
    const addonsLabel = scaleSelectedAddons.map((a) => a.name).join(' + ');
    const combinedNotes = [
      scaleMode === 'by_amount_egp' ? `بيع بالمبلغ (${fmtNum(scaleTargetEgp)} ${currencySymbol})` : '',
      addonsLabel ? `إضافات: ${addonsLabel}` : '',
      scaleWorkerNotes.trim(),
    ]
      .filter(Boolean)
      .join(' • ');
    const finalUnitPrice = Number((scaleCalculation.unitPrice + addonsExtra).toFixed(2));
    onAddPosItem({
      cartItemId: `pos-scale-${scaleModalProduct.id}-${scaleCalculation.weightGrams}-${finalUnitPrice}-${scaleRoast}-${combinedNotes}`,
      productId: scaleModalProduct.id,
      productName: scaleModalProduct.name,
      productImage: getSafeImageUrl(scaleModalProduct.image),
      weightId: `scale-${scaleCalculation.weightGrams}`,
      weightLabel: scaleCalculation.weightLabel,
      roastOption: scaleRoast,
      unitPrice: finalUnitPrice,
      quantity: 1,
      rawCostEgp: scaleCalculation.rawCostEgp,
      customWeightGrams: scaleCalculation.weightGrams,
      sellByAmountMode: scaleMode === 'by_amount_egp',
      barcodeLabel: scaleCalculation.barcodeLabel,
      workerNotes: combinedNotes || undefined,
      selectedAddons:
        scaleSelectedAddons.length > 0
          ? scaleSelectedAddons.map((a) => ({ id: a.id, name: a.name, extraPrice: a.extraPrice }))
          : undefined,
    });
    setScaleModalProduct(null);
  };

  return (
    <div className="space-y-2.5">
      {/* =================================================================== */}
      {/* COMPACT QUICK-CATALOG BAR: SEARCH -> CATEGORIES -> WEIGHTS -> GRID  */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-2.5 border border-[#E8E0D5] space-y-2 shadow-2xs">
        {/* 1. TOPMOST ROW: Search + Quick Add Product + Thumbnails Toggle + Free Scale */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-[#6B5B4E] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="pos-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              placeholder="بحث سريع بالاسم أو الكود (F2)..."
              className="w-full min-h-[38px] bg-[#FAF6F0] focus:bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl pr-8 pl-7 py-1.5 text-xs font-medium outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6B5B4E] hover:text-[#231710] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {canAddProduct && onOpenQuickAddProduct && (
            <button
              type="button"
              onClick={onOpenQuickAddProduct}
              title="إضافة منتج جديد مباشرة من الكاشير"
              className="min-h-[38px] bg-[#3B6E4C] hover:bg-[#2f5a3d] text-white px-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة منتج</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowThumbnails((v) => !v)}
            title={showThumbnails ? 'إخفاء الصور لعرض أصناف أكثر' : 'إظهار الصور المصغرة'}
            className={`min-h-[38px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition ${
              showThumbnails
                ? 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#EFE6D8]'
                : 'bg-[#231710] text-white border-[#231710]'
            }`}
          >
            {showThumbnails ? (
              <ImageOff className="w-3.5 h-3.5 text-[#9A6836]" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
            )}
            <span className="hidden sm:inline">{showThumbnails ? 'بدون صور' : 'إظهار الصور'}</span>
          </button>

          {enableWeightScale && weightProducts.length > 0 && (
            <button
              type="button"
              onClick={() => openProductScaleModal(weightProducts[0], 'by_amount_egp')}
              title="بيع سريع بمبلغ محدد بالجنيه مع حساب الجرامات تلقائياً وتسجيل وسم الرقابة"
              className="min-h-[42px] bg-[#D4AF37] hover:bg-[#c5a02d] text-[#231710] border border-[#B89220] px-3 rounded-xl text-xs font-cairo font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0 transition shadow-2xs"
            >
              <Scale className="w-4 h-4 text-[#231710]" />
              <span>بيع بالمبلغ</span>
            </button>
          )}
        </div>

        {/* 2. CATEGORIES ROW (ABOVE QUICK WEIGHTS): Categories + Weight/Unit Type Filter */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId('all');
                setSellingTypeFilter('all');
              }}
              className={`min-h-[34px] px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer shrink-0 transition border ${
                selectedCategoryId === 'all' && sellingTypeFilter === 'all'
                  ? 'bg-[#231710] text-white border-[#231710]'
                  : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#EFE6D8]'
              }`}
            >
              كل الأقسام ({products.length})
            </button>

            {categories.map((cat) => {
              const catAccent = getCategoryAccentColor(cat.id, cat.name);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold cursor-pointer shrink-0 transition border flex items-center gap-1.5 ${
                    selectedCategoryId === cat.id
                      ? 'bg-[#231710] text-white border-[#231710]'
                      : 'bg-white text-[#231710] border-[#E8E0D5] hover:bg-[#FAF6F0]'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${catAccent.dot}`} />
                  <span>{formatCategoryName(cat.name)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all' as const, label: `الكل (${products.length})` },
              { id: 'weight' as const, label: `بالوزن (${weightProducts.length})` },
              { id: 'unit' as const, label: `بالقطعة (${unitProductsCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSellingTypeFilter(f.id)}
                className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer shrink-0 transition border ${
                  sellingTypeFilter === f.id
                    ? 'bg-[#9A6836] text-white border-[#9A6836]'
                    : 'bg-[#FAF6F0]/80 text-[#6B5644] border-[#E8E0D5] hover:text-[#231710]'
                }`}
              >
                {f.label}
              </button>
            ))}

            {shortageCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSellingTypeFilter((prev) => (prev === 'low_stock' ? 'all' : 'low_stock'))
                }
                className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 shrink-0 transition border ${
                  sellingTypeFilter === 'low_stock'
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>نواقص ({shortageCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. QUICK WEIGHTS ROW (BELOW CATEGORIES, DIRECTLY ABOVE PRODUCTS) */}
        {enableWeightScale && (
          <div className="bg-[#FAF6F0] rounded-xl p-1 border border-[#E8E0D5] flex items-center gap-1 overflow-x-auto">
            <span className="text-[10px] font-bold text-[#6B5644] px-1.5 shrink-0 hidden sm:inline">
              الوزن السريع:
            </span>
            {UNIFIED_WEIGHT_MODES.map((w) => {
              const active = activeWeightMode === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setActiveWeightMode(w.id)}
                  className={`flex-1 min-w-[60px] py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                    active
                      ? 'bg-[#231710] text-white shadow-2xs'
                      : 'text-[#231710] hover:bg-white'
                  }`}
                >
                  <div className="text-[11px] font-bold leading-none">{w.label}</div>
                  <div
                    className={`text-[9px] mt-0.5 leading-none ${
                      active ? 'text-[#D4AF37]' : 'text-[#8C7A6B]'
                    }`}
                  >
                    {w.short}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* ZERO-COLLISION COMPACT PRODUCT CARDS GRID                           */}
      {/* =================================================================== */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-8 text-center">
          <p className="text-xs font-bold text-[#231710]">لا توجد أصناف مطابقة للفلتر الحالي</p>
          <p className="text-[11px] text-[#6B5B4E] mt-1">جرّب مسح البحث أو اختيار «الكل».</p>
        </div>
      ) : (
        <div
          className={`grid gap-2 ${
            showThumbnails
              ? 'grid-cols-[repeat(auto-fill,minmax(175px,1fr))]'
              : 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'
          }`}
        >
          {filteredProducts.map((prod) => {
            const prodIdx = Math.max(0, products.findIndex((p) => p.id === prod.id));
            const unitMode = isUnitProduct(prod);
            const stockUnitLabel = getProductStockUnitLabel(prod);
            const unitVariants = unitMode ? getResolvedProductWeights(prod) : [];
            const activeRoast = cardRoasts[prod.id] || prod.roastOptions?.[0] || '';
            const stockKg = typeof prod.stockKg === 'number' ? Math.max(0, prod.stockKg) : 50;
            const isOutOfStock = !prod.inStock || stockKg <= 0;
            const isLowStock = !isOutOfStock && stockKg <= LOW_STOCK_THRESHOLD_KG;

            const activeWeightCalc =
              !unitMode && activeWeightObj.grams > 0
                ? calculatePosItemByGrams(prod, activeWeightObj.grams, prodIdx)
                : null;

            const matchedCat = categories.find((c) => c.id === prod.categoryId);
            const cardAccent = getCategoryAccentColor(prod.categoryId, matchedCat?.name);

            return (
              <div
                key={prod.id}
                className={`rounded-xl border overflow-hidden flex flex-col justify-between transition ${
                  isOutOfStock
                    ? 'bg-red-50/30 border-red-200 opacity-70'
                    : isLowStock
                      ? 'bg-amber-50/25 border-amber-200 hover:border-amber-400'
                      : 'bg-white border-[#E8E0D5] hover:border-[#B9A48C] hover:shadow-2xs'
                }`}
              >
                <div className={`h-1 w-full ${isOutOfStock ? 'bg-red-400' : cardAccent.bar}`} />
                <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                {/* Top: Compact Thumbnail (40x40 optional) + Name + Mode/Stock Meta */}
                <div className="flex items-start gap-2 min-w-0">
                  {showThumbnails && (
                    <img
                      src={getSafeImageUrl(prod.image)}
                      alt=""
                      aria-hidden="true"
                      className={`w-10 h-10 rounded-lg object-cover border border-[#E8E0D5] bg-[#FAF6F0] shrink-0 ${
                        isOutOfStock ? 'grayscale' : ''
                      }`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3
                      title={prod.name}
                      className="font-cairo font-bold text-xs text-[#231710] leading-snug line-clamp-2"
                    >
                      {prod.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {unitMode ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                          <Package className="w-2.5 h-2.5" />
                          <span>قطعة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-50 text-[#9A6836] border border-amber-200/80 px-1.5 py-0.5 rounded tabular-nums">
                          <Scale className="w-2.5 h-2.5" />
                          <span>
                            {fmtNum(prod.pricePerKg || 400)}/كجم
                          </span>
                        </span>
                      )}

                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-[#B91C1C] text-white px-1.5 py-0.5 rounded">
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span>نفد المخزون</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                            isLowStock
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-[#FAF6F0] text-[#6B5B4E]'
                          }`}
                        >
                          {fmtNum(stockKg)} {stockUnitLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Strip (Zero Overlapping Text) */}
                {unitMode ? (
                  <div className="space-y-1">
                    {unitVariants.slice(0, 3).map((uv) => (
                      <button
                        key={uv.id}
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => {
                          if (isOutOfStock) {
                            playCashierBeep(300, 0.2);
                            showToast('نفد المخزون', `صنف "${prod.name}" غير متوفر حالياً`);
                            return;
                          }
                          handleQuickAddUnitVariant(prod, uv);
                        }}
                        className={`w-full min-h-[34px] rounded-lg px-2 py-1 flex items-center justify-between gap-2 text-right transition group ${
                          isOutOfStock
                            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                            : 'bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710] cursor-pointer'
                        }`}
                      >
                        <span className="text-[11px] font-bold truncate flex items-center gap-1 min-w-0">
                          <Plus className="w-3 h-3 shrink-0" />
                          <span className="truncate">{uv.label}</span>
                        </span>
                        <span
                          className={`text-[11px] font-bold tabular-nums shrink-0 whitespace-nowrap ${
                            isOutOfStock
                              ? 'text-gray-400'
                              : 'text-[#3B6E4C] group-hover:text-[#D4AF37]'
                          }`}
                        >
                          {fmtNum(uv.price)} {currencySymbol}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => {
                        if (isOutOfStock) {
                          playCashierBeep(300, 0.2);
                          showToast('نفد المخزون', `صنف "${prod.name}" غير متوفر حالياً`);
                          return;
                        }
                        if (activeWeightMode === 'custom' || !activeWeightCalc) {
                          openProductScaleModal(prod, 'by_amount_egp');
                        } else {
                          handleQuickAddWeight(prod, activeWeightObj.grams);
                        }
                      }}
                      className={`flex-1 min-w-0 min-h-[36px] rounded-lg px-2 py-1 flex items-center justify-between gap-1.5 transition group ${
                        isOutOfStock
                          ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                          : 'bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710] cursor-pointer'
                      }`}
                    >
                      <span className="text-[11px] font-bold flex items-center gap-1 truncate min-w-0">
                        <Plus className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {activeWeightMode === 'custom' ? 'وزن / مبلغ' : activeWeightObj.label}
                        </span>
                      </span>
                      {activeWeightCalc && (
                        <span
                          className={`text-[11px] font-bold tabular-nums shrink-0 whitespace-nowrap ${
                            isOutOfStock
                              ? 'text-gray-400'
                              : 'text-[#9A6836] group-hover:text-[#D4AF37]'
                          }`}
                        >
                          {fmtNum(activeWeightCalc.unitPrice)} {currencySymbol}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => openProductScaleModal(prod, 'by_grams')}
                      title={
                        activeRoast
                          ? `تعديل التحميص (${activeRoast}) أو إدخال وزن / مبلغ حر`
                          : 'تعديل التحميص أو وزن / مبلغ حر'
                      }
                      className={`min-h-[36px] w-9 rounded-lg border flex items-center justify-center shrink-0 transition ${
                        isOutOfStock
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white hover:bg-[#FAF6F0] text-[#6B5644] hover:text-[#231710] border-[#E8E0D5] cursor-pointer'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* ON-DEMAND SCALE / ROAST / SELL-BY-AMOUNT MODAL                      */}
      {/* =================================================================== */}
      {scaleModalProduct && scaleCalculation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-[#E8E0D5] shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={getSafeImageUrl(scaleModalProduct.image)}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover border border-[#E8E0D5] shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-cairo font-bold text-sm text-[#231710] truncate">
                    {scaleModalProduct.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs tabular-nums">
                    <span className="font-bold text-[#9A6836]">
                      الكيلو: {fmtNum(scaleModalProduct.pricePerKg || 400)} {currencySymbol}
                    </span>
                    <span className="text-[#E8E0D5]">•</span>
                    <span className="text-[#6B5B4E]">
                      المتاح: {fmtNum(scaleModalProduct.stockKg ?? 50)} كجم
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScaleModalProduct(null)}
                className="w-9 h-9 rounded-xl bg-[#FAF6F0] hover:bg-red-50 text-[#231710] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Switcher */}
            <div>
              <select
                value={scaleModalProduct.id}
                onChange={(e) => {
                  const found = products.find((p) => p.id === e.target.value);
                  if (found) {
                    setScaleModalProduct(found);
                    setScaleRoast(cardRoasts[found.id] || found.roastOptions?.[0] || '');
                  }
                }}
                className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
              >
                {weightProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({fmtNum(p.pricePerKg || 400)} {currencySymbol}/كجم)
                  </option>
                ))}
              </select>
            </div>

            {/* Product Roast Options (if available) */}
            {scaleModalProduct.roastOptions && scaleModalProduct.roastOptions.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#6B5B4E] block">
                  درجة التحميص / التمليح:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {scaleModalProduct.roastOptions.map((roastOpt) => (
                    <button
                      key={roastOpt}
                      type="button"
                      onClick={() => setScaleRoast(roastOpt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        scaleRoast === roastOpt
                          ? 'bg-[#231710] text-white border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#EFE6D8]'
                      }`}
                    >
                      {roastOpt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode Switcher: By EGP Amount vs By Weight Grams */}
            <div className="grid grid-cols-2 gap-2 bg-[#FAF6F0] p-1 rounded-xl border border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => setScaleMode('by_amount_egp')}
                className={`min-h-[38px] py-1.5 rounded-lg font-cairo font-bold text-xs cursor-pointer transition ${
                  scaleMode === 'by_amount_egp' ? 'bg-[#231710] text-white' : 'text-[#231710]'
                }`}
              >
                بيع بمبلغ (بـ ... {currencySymbol})
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('by_grams')}
                className={`min-h-[38px] py-1.5 rounded-lg font-cairo font-bold text-xs cursor-pointer transition ${
                  scaleMode === 'by_grams' ? 'bg-[#231710] text-white' : 'text-[#231710]'
                }`}
              >
                وزن بالجرام (جم)
              </button>
            </div>

            {/* Input & Quick Buttons */}
            {scaleMode === 'by_amount_egp' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={scaleTargetEgp}
                    onChange={(e) => setScaleTargetEgp(Math.max(5, Number(e.target.value) || 0))}
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-4 py-2.5 text-lg font-bold text-center text-[#231710] tabular-nums outline-none"
                  />
                  <span className="font-cairo font-bold text-sm text-[#231710] shrink-0">
                    {currencySymbol}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[20, 25, 30, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setScaleTargetEgp(amt)}
                      className={`min-h-[48px] py-2 rounded-xl text-sm font-cairo font-extrabold tabular-nums cursor-pointer border transition ${
                        scaleTargetEgp === amt
                          ? 'bg-[#D4AF37] text-[#231710] border-[#B89220] shadow-xs'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#F3ECE1]'
                      }`}
                    >
                      {amt} {currencySymbol}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#6B5B4E] bg-[#FAF6F0] border border-[#E8E0D5] rounded-lg px-2.5 py-1.5">
                  سعر الكيلو المركزي مقفل للرقابة ({fmtNum(scaleModalProduct.pricePerKg || 400)} {currencySymbol}/كجم) وتُسجل العملية بوسم <strong>«بيع بالمبلغ»</strong> في سجل التدقيق.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={scaleGrams}
                    onChange={(e) => setScaleGrams(Math.max(10, Number(e.target.value) || 0))}
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-4 py-2.5 text-lg font-bold text-center text-[#231710] tabular-nums outline-none"
                  />
                  <span className="font-cairo font-bold text-sm text-[#231710] shrink-0">جرام</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[100, 125, 200, 250, 500, 1000].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setScaleGrams(g)}
                      className={`min-h-[36px] py-1.5 rounded-lg text-xs font-bold tabular-nums cursor-pointer border transition ${
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

            {/* Dynamic Prep Methods & Paid Add-ons */}
            {(prepMethods.length > 0 || productAddons.length > 0) && (
              <div className="space-y-2 pt-1">
                {prepMethods.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-[#6B5B4E] block mb-1">
                      طريقة التجهيز / التحويج:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {prepMethods.slice(0, 8).map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setScaleRoast(pm.name)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            scaleRoast === pm.name
                              ? 'bg-[#231710] text-white border-[#231710]'
                              : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                          }`}
                        >
                          {pm.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {productAddons.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-[#6B5B4E] block mb-1">
                      إضافات مدفوعة:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {productAddons.map((ad) => {
                        const active = scaleSelectedAddons.some((x) => x.id === ad.id);
                        return (
                          <button
                            key={ad.id}
                            type="button"
                            onClick={() =>
                              setScaleSelectedAddons((prev) =>
                                active ? prev.filter((x) => x.id !== ad.id) : [...prev, ad]
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              active
                                ? 'bg-[#9A6836] text-white border-[#9A6836]'
                                : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                            }`}
                          >
                            {ad.name} (+{fmtNum(ad.extraPrice)} {currencySymbol})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Worker Notes */}
            <input
              type="text"
              value={scaleWorkerNotes}
              onChange={(e) => setScaleWorkerNotes(e.target.value)}
              placeholder="ملاحظة للعامل (مثال: تقسيم على كيسين / بدون ملح)..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs outline-none"
            />

            {/* Digital Result Display — Huge Grams Readout for Worker on Scale */}
            <div className="bg-[#231710] text-[#FAF6F0] border border-[#3A271C] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs text-[#D4AF37] font-bold block">
                  الوزن المطلوب وزنه على الميزان
                </span>
                <span className="font-cairo font-black text-3xl text-white tabular-nums">
                  {fmtNum(scaleCalculation.weightGrams)} جم
                </span>
              </div>
              <div className="text-left">
                <span className="text-xs text-[#FAF6F0]/75 block">السعر النهائي</span>
                <span className="font-cairo font-black text-2xl text-[#D4AF37] tabular-nums">
                  {fmtNum(
                    scaleCalculation.unitPrice +
                      scaleSelectedAddons.reduce((s, a) => s + Number(a.extraPrice || 0), 0)
                  )}{' '}
                  {currencySymbol}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmScaleModal}
                className="flex-1 bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                <span>
                  إضافة للفاتورة (
                  {fmtNum(
                    scaleCalculation.unitPrice +
                      scaleSelectedAddons.reduce((s, a) => s + Number(a.extraPrice || 0), 0)
                  )}{' '}
                  {currencySymbol})
                </span>
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
                      scaleCalculation.barcodeLabel || getProductBarcode(scaleModalProduct, 0),
                    date: new Date().toLocaleDateString('ar-EG'),
                  });
                }}
                className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-3.5 py-3 rounded-xl font-cairo font-bold text-xs flex items-center gap-1.5 cursor-pointer"
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
