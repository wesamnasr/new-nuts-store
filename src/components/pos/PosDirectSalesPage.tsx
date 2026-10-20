'use client';

import React, { useState, useMemo } from 'react';
import {
  Scale,
  Barcode,
  Search,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import {
  CartItem,
  Category,
  Product,
} from '@/types/store';
import {
  calculatePosItemByAmountEgp,
  calculatePosItemByGrams,
  getProductBarcode,
  parseScaleBarcode,
} from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
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
}

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
}: PosDirectSalesPageProps) {
  const [internalCategoryId, setInternalCategoryId] = useState<string>('all');
  const selectedCategoryId = externalCategoryId ?? internalCategoryId;
  const setSelectedCategoryId = (catId: string) => {
    setInternalCategoryId(catId);
    onSelectCategoryId?.(catId);
  };
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  // Per-card quick roast selection state
  const [cardRoasts, setCardRoasts] = useState<Record<string, string>>({});

  // On-Demand Custom Scale / Sell-by-Amount Modal State (Hidden by default!)
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
  }, [products, selectedCategoryId, searchQuery]);

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
  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const codeToScan = barcodeInput.trim();
    if (!codeToScan) return;

    const parsed = parseScaleBarcode(codeToScan, products);
    if (!parsed) {
      playCashierBeep(320, 0.25);
      showToast('باركود غير معروف', `لم يتم العثور على الصنف: ${codeToScan}`);
      return;
    }

    const { product, calc } = parsed;
    onAddPosItem({
      cartItemId: `pos-bc-${product.id}-${calc.weightGrams}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productImage: getSafeImageUrl(product.image),
      weightId: `scale-${calc.weightGrams}`,
      weightLabel: calc.weightLabel,
      roastOption: product.roastOptions?.[0] || 'محمص مملح',
      unitPrice: calc.unitPrice,
      quantity: 1,
      rawCostEgp: calc.rawCostEgp,
      customWeightGrams: calc.weightGrams,
      barcodeLabel: calc.barcodeLabel,
    });
    setBarcodeInput('');
  };

  // 1-Click Add Product Weight from Card
  const handleQuickAddWeight = (prod: Product, weightGrams: number) => {
    const prodIdx = Math.max(0, products.findIndex((p) => p.id === prod.id));
    const calc = calculatePosItemByGrams(prod, weightGrams, prodIdx);
    const roast = cardRoasts[prod.id] || prod.roastOptions?.[0] || 'سادة';

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
    <div className="space-y-4">
      {/* =================================================================== */}
      {/* SIMPLE, CLEAN TOP FILTER & SEARCH BAR                               */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-3.5 border border-[#E6DFD3] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Instant Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#6E5D4F] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الصنف..."
              className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#D4AF37] rounded-xl pr-10 pl-3 py-2.5 text-sm font-bold outline-none"
            />
          </div>

          {/* Compact Barcode Input */}
          <form onSubmit={handleBarcodeScanSubmit} className="flex items-center gap-1.5">
            <div className="relative w-48 sm:w-56">
              <Barcode className="w-4 h-4 text-[#C88A4B] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="باركود الميزان..."
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#D4AF37] rounded-xl pr-9 pl-2.5 py-2.5 text-xs font-bold outline-none tabular-nums"
              />
            </div>
          </form>

          {/* On-Demand Scale Button */}
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => openProductScaleModal(products[0], 'by_amount_egp')}
              className="bg-[#231710] hover:bg-[#3a261a] text-[#D4AF37] px-4 py-2.5 rounded-xl text-xs font-cairo font-black flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Scale className="w-4 h-4" />
              <span>ميزان مخصص / بيع بمبلغ</span>
            </button>
          )}
        </div>

        {/* Clean Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-4 py-2 rounded-xl text-xs font-cairo font-black cursor-pointer shrink-0 transition ${
              selectedCategoryId === 'all'
                ? 'bg-[#231710] text-[#D4AF37] shadow-xs'
                : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
            }`}
          >
            الكل ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-cairo font-black cursor-pointer flex items-center gap-1.5 shrink-0 transition ${
                selectedCategoryId === cat.id
                  ? 'bg-[#231710] text-[#D4AF37] shadow-xs'
                  : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* LARGE, SIMPLIFIED PRODUCT CARDS (IMAGE + NAME + WEIGHT BUTTONS ONLY)*/}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {filteredProducts.map((prod) => {
          const prodIdx = Math.max(0, products.findIndex((p) => p.id === prod.id));
          const activeRoast = cardRoasts[prod.id] || prod.roastOptions?.[0] || '';
          const hasMultipleRoasts = (prod.roastOptions?.length || 0) > 1;

          return (
            <div
              key={prod.id}
              className="bg-white rounded-2xl border-2 border-[#E6DFD3] hover:border-[#D4AF37] p-3 flex flex-col justify-between transition shadow-xs hover:shadow-md"
            >
              {/* Top: Image + Name */}
              <div>
                <div className="relative h-28 rounded-xl overflow-hidden bg-[#FAF6F0] mb-2.5">
                  <img
                    src={getSafeImageUrl(prod.image)}
                    alt={prod.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Price per Kg Badge */}
                  <span className="absolute top-2 right-2 bg-[#231710]/90 text-[#D4AF37] text-[11px] font-black px-2.5 py-0.5 rounded-lg tabular-nums">
                    {prod.pricePerKg || 400} ج/كجم
                  </span>

                  {/* Custom Scale / Amount Trigger Button */}
                  <button
                    type="button"
                    onClick={() => openProductScaleModal(prod, 'by_amount_egp')}
                    title="وزن حر أو بيع بمبلغ بالجنيه"
                    className="absolute bottom-2 left-2 bg-white/95 hover:bg-[#D4AF37] text-[#231710] px-2.5 py-1 rounded-lg text-[11px] font-cairo font-black flex items-center gap-1 shadow cursor-pointer transition"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>مبلغ / وزن</span>
                  </button>
                </div>

                <h3 className="font-cairo font-black text-sm text-[#231710] line-clamp-1 mb-2">
                  {prod.name}
                </h3>

                {/* Simple Roast Toggle (Only if product has multiple roasts) */}
                {hasMultipleRoasts && (
                  <div className="flex items-center gap-1 mb-2.5 bg-[#FAF6F0] p-1 rounded-xl">
                    {prod.roastOptions!.slice(0, 2).map((roastOpt) => (
                      <button
                        key={roastOpt}
                        type="button"
                        onClick={() =>
                          setCardRoasts((prev) => ({ ...prev, [prod.id]: roastOpt }))
                        }
                        className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer truncate px-1 ${
                          activeRoast === roastOpt
                            ? 'bg-[#231710] text-[#D4AF37]'
                            : 'text-[#6E5D4F] hover:text-[#231710]'
                        }`}
                      >
                        {roastOpt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom: 4 Big 1-Click Weight Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_WEIGHTS.map((w) => {
                  const calc = calculatePosItemByGrams(prod, w.grams, prodIdx);
                  return (
                    <button
                      key={w.grams}
                      type="button"
                      onClick={() => handleQuickAddWeight(prod, w.grams)}
                      className="bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-[#D4AF37] border border-[#E6DFD3] hover:border-[#231710] rounded-xl py-2 px-2 flex items-center justify-between transition cursor-pointer group"
                    >
                      <span className="font-cairo font-black text-xs">{w.label}</span>
                      <span className="font-black text-xs text-[#3B6E4C] group-hover:text-[#D4AF37] tabular-nums">
                        {calc.unitPrice} ج
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* ON-DEMAND SCALE / SELL-BY-AMOUNT MODAL (HIDDEN UNTIL REQUESTED)     */}
      {/* =================================================================== */}
      {scaleModalProduct && scaleCalculation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 border-2 border-[#D4AF37] shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E6DFD3] pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={getSafeImageUrl(scaleModalProduct.image)}
                  alt={scaleModalProduct.name}
                  className="w-12 h-12 rounded-xl object-cover border border-[#E6DFD3]"
                />
                <div>
                  <h3 className="font-cairo font-black text-base text-[#231710]">
                    {scaleModalProduct.name}
                  </h3>
                  <span className="text-xs font-bold text-[#C88A4B] tabular-nums">
                    سعر الكيلو: {scaleModalProduct.pricePerKg || 400} ج.م
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScaleModalProduct(null)}
                className="w-9 h-9 rounded-xl bg-[#FAF6F0] hover:bg-red-100 text-[#231710] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Switcher inside Modal (if cashier wants to change product) */}
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
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.pricePerKg || 400} ج.م/كجم)
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Switcher: By EGP Amount vs By Weight Grams */}
            <div className="grid grid-cols-2 gap-2 bg-[#FAF6F0] p-1.5 rounded-2xl border border-[#E6DFD3]">
              <button
                type="button"
                onClick={() => setScaleMode('by_amount_egp')}
                className={`py-2.5 rounded-xl font-cairo font-black text-xs cursor-pointer transition ${
                  scaleMode === 'by_amount_egp'
                    ? 'bg-[#3B6E4C] text-white shadow-xs'
                    : 'text-[#231710]'
                }`}
              >
                💵 بيع بمبلغ (عايز بـ ... جنيه)
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('by_grams')}
                className={`py-2.5 rounded-xl font-cairo font-black text-xs cursor-pointer transition ${
                  scaleMode === 'by_grams'
                    ? 'bg-[#231710] text-[#D4AF37] shadow-xs'
                    : 'text-[#231710]'
                }`}
              >
                ⚖️ وزن بالجرام (جم)
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
                    className="w-full bg-[#FAF6F0] border-2 border-[#3B6E4C] rounded-2xl px-4 py-3 text-xl font-black text-center text-[#231710] tabular-nums outline-none"
                  />
                  <span className="font-cairo font-black text-sm text-[#231710] shrink-0">
                    ج.م
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[20, 30, 50, 100, 150, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setScaleTargetEgp(amt)}
                      className={`py-2 rounded-xl text-xs font-black tabular-nums cursor-pointer border ${
                        scaleTargetEgp === amt
                          ? 'bg-[#3B6E4C] text-white border-[#3B6E4C]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
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
                    className="w-full bg-[#FAF6F0] border-2 border-[#D4AF37] rounded-2xl px-4 py-3 text-xl font-black text-center text-[#231710] tabular-nums outline-none"
                  />
                  <span className="font-cairo font-black text-sm text-[#231710] shrink-0">
                    جرام
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[100, 125, 200, 250, 500, 1000].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setScaleGrams(g)}
                      className={`py-2 rounded-xl text-xs font-black tabular-nums cursor-pointer border ${
                        scaleGrams === g
                          ? 'bg-[#231710] text-[#D4AF37] border-[#231710]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                      }`}
                    >
                      {g} جم
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Digital Result Display */}
            <div className="bg-[#231710] text-[#FAF6F0] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#FAF6F0]/70 block">الوزن الصافي</span>
                <span className="font-cairo font-black text-xl text-[#D4AF37] tabular-nums">
                  {scaleCalculation.weightGrams} جم
                </span>
              </div>
              <div className="text-left">
                <span className="text-[11px] text-[#FAF6F0]/70 block">السعر النهائي</span>
                <span className="font-cairo font-black text-2xl text-white tabular-nums">
                  {scaleCalculation.unitPrice} ج.م
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmScaleModal}
                className="flex-1 bg-[#3B6E4C] hover:bg-[#2F5A3D] text-white font-cairo font-black text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
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
                className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E6DFD3] px-4 py-3.5 rounded-2xl font-cairo font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Tag className="w-4 h-4 text-[#C88A4B]" />
                <span>استيكر</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
