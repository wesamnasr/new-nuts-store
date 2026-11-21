'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Barcode,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { Category, Product, ProductSellingMode } from '@/types/store';
import { isUnitProduct, normalizeBarcodeScanInput } from '@/lib/pricing';
import { formatCategoryName } from '@/lib/defaults';
import {
  generateCatalogProductsCsv,
  parseCatalogProductsCsv,
  upsertRapidScannedProduct,
} from '@/modules/catalog/catalog-csv';

interface RapidBarcodeCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  saving?: boolean;
  onSaveCatalog: (nextProducts: Product[], toastMsg: string) => Promise<void>;
}

export default function RapidBarcodeCatalogModal({
  isOpen,
  onClose,
  products,
  categories,
  saving = false,
  onSaveCatalog,
}: RapidBarcodeCatalogModalProps) {
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [sellingMode, setSellingMode] = useState<ProductSellingMode>('unit');
  const [unitLabel, setUnitLabel] = useState('قطعة');
  const [costPrice, setCostPrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [stockQty, setStockQty] = useState('24');
  const [stockOperation, setStockOperation] = useState<'set' | 'increment'>('set');
  const [matchedExisting, setMatchedExisting] = useState<Product | null>(null);
  const [stagedProducts, setStagedProducts] = useState<Product[]>(products);
  const [sessionCount, setSessionCount] = useState(0);
  const [feedback, setFeedback] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStagedProducts(products);
      setCategoryId((prev) => prev || categories[0]?.id || '');
      setHasUnsavedChanges(false);
      setSessionCount(0);
      setFeedback('');
      setTimeout(() => barcodeInputRef.current?.focus(), 60);
    }
  }, [isOpen, products, categories]);

  if (!isOpen) return null;

  const handleLookupBarcode = (rawCode: string) => {
    const clean = normalizeBarcodeScanInput(rawCode);
    setBarcode(clean);
    if (!clean) {
      setMatchedExisting(null);
      return;
    }

    const found = stagedProducts.find(
      (p) => p.barcode && normalizeBarcodeScanInput(p.barcode) === clean
    );
    if (found) {
      const unitMode = isUnitProduct(found);
      setMatchedExisting(found);
      setName(found.name);
      setCategoryId(found.categoryId);
      setSellingMode(unitMode ? 'unit' : 'weight');
      setUnitLabel(found.unitLabel || 'قطعة');
      setRetailPrice(
        String(
          unitMode
            ? found.unitPrice ?? found.weights?.[0]?.price ?? found.pricePerKg ?? ''
            : found.pricePerKg ?? ''
        )
      );
      setCostPrice(
        String(unitMode ? found.unitCost ?? found.costPerKg ?? '' : found.costPerKg ?? '')
      );
      setStockQty(stockOperation === 'increment' ? '12' : String(found.stockKg ?? 0));
      setFeedback(`تم العثور على الصنف المسجل «${found.name}» — يمكنك تحديث السعر أو تزويد الرصيد فوراً`);
      setTimeout(() => priceInputRef.current?.select(), 30);
    } else {
      setMatchedExisting(null);
      setName('');
      if (/^(20|21|22)\d{4}$/.test(clean)) {
        setSellingMode('weight');
      } else {
        setSellingMode('unit');
      }
      setFeedback('باركود جديد — اكتب اسم الصنف وسعر البيع ثم اضغط Enter للإضافة السريعة');
      setTimeout(() => nameInputRef.current?.focus(), 30);
    }
  };

  const handleStageItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizeBarcodeScanInput(barcode);
    const priceNum = Number(normalizeBarcodeScanInput(retailPrice));
    const costNum = Number(normalizeBarcodeScanInput(costPrice || '0'));
    const stockNum = Number(normalizeBarcodeScanInput(stockQty || '0'));

    if (!name.trim() && !cleanCode) {
      setFeedback('يرجى مسح الباركود أو كتابة اسم الصنف أولاً');
      barcodeInputRef.current?.focus();
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setFeedback('يرجى إدخال سعر بيع صحيح أكبر من صفر');
      priceInputRef.current?.focus();
      return;
    }

    const res = upsertRapidScannedProduct(
      {
        barcode: cleanCode,
        name: name.trim() || `صنف ${cleanCode}`,
        categoryId,
        sellingMode,
        retailPrice: priceNum,
        costPrice: Number.isFinite(costNum) && costNum >= 0 ? costNum : Math.round(priceNum * 0.78 * 100) / 100,
        stockQty: Number.isFinite(stockNum) && stockNum >= 0 ? stockNum : 0,
        unitLabel,
        stockOperation: matchedExisting ? stockOperation : 'set',
      },
      stagedProducts,
      categories
    );

    setStagedProducts(res.nextProducts);
    setSessionCount((c) => c + 1);
    setHasUnsavedChanges(true);
    setFeedback(
      res.isUpdate
        ? `تم تحديث «${res.product.name}» بنجاح — امسح الصنف التالي مباشرة`
        : `تمت إضافة «${res.product.name}» (${res.product.barcode || 'بدون باركود'}) — امسح الصنف التالي`
    );

    // Reset inputs for next rapid scan in < 0.1s
    setBarcode('');
    setName('');
    setRetailPrice('');
    setCostPrice('');
    setMatchedExisting(null);
    setTimeout(() => barcodeInputRef.current?.focus(), 20);
  };

  const handleExportTemplateCsv = () => {
    const csv = generateCatalogProductsCsv(stagedProducts, categories);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.href = url;
    link.download = `mizan-catalog-products-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      const parsed = parseCatalogProductsCsv(text, stagedProducts, categories);
      setStagedProducts(parsed.mergedProducts);
      setSessionCount((c) => c + parsed.createdCount + parsed.updatedCount);
      setHasUnsavedChanges(parsed.createdCount + parsed.updatedCount > 0);
      setFeedback(
        `تم استيراد الشيت: ${parsed.createdCount} صنف جديد • ${parsed.updatedCount} صنف محدّث${
          parsed.skippedCount > 0 ? ` • تم تخطي ${parsed.skippedCount} سطر فارغ` : ''
        } — اضغط «حفظ واعتماد الكتالوج» بالأسفل`
      );
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleCommitAll = async () => {
    await onSaveCatalog(
      stagedProducts,
      `تم حفظ واعتماد الكتالوج بنجاح (${stagedProducts.length} صنف إجمالي)`
    );
    setHasUnsavedChanges(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-cairo">
      <div className="bg-white rounded-2xl border border-[#E8E0D5] w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#231710] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#D4AF37] flex items-center justify-center shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                التكويد السريع بقارئ الباركود (20 شعاع) واستيراد شيت Excel / CSV
              </h3>
              <p className="text-[11px] text-white/75">
                امسح الباركود مباشرة ثم أدخل الاسم والسعر واضغط Enter للانتقال للصنف التالي في ثوانٍ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Bulk CSV Bar */}
          <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#231710]">
              <FileSpreadsheet className="w-4 h-4 text-[#9A6836] shrink-0" />
              <span>استيراد أو تصدير جميع أصناف المحل دفعة واحدة (Excel CSV)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportTemplateCsv}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F3ECE1] border border-[#E8E0D5] text-xs font-bold text-[#231710] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#9A6836]" />
                <span>تصدير الكتالوج (CSV)</span>
              </button>
              <label className="px-3 py-1.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>استيراد ملف CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportCsvFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {feedback && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2">
              <span>{feedback}</span>
              {sessionCount > 0 && (
                <span className="bg-emerald-700 text-white px-2 py-0.5 rounded-full text-[11px] shrink-0">
                  تم تجهيز {sessionCount} صنف
                </span>
              )}
            </div>
          )}

          {/* Rapid Scanner Form */}
          <form onSubmit={handleStageItem} className="space-y-3 bg-white border border-[#E8E0D5] rounded-2xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  1. امسح الباركود هنا (Datalogic 20 شعاع)
                </label>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  dir="ltr"
                  value={barcode}
                  onChange={(e) => setBarcode(normalizeBarcodeScanInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLookupBarcode(barcode);
                    }
                  }}
                  placeholder="622300..."
                  className="w-full bg-[#FAF6F0] border-2 border-[#9A6836] focus:border-[#231710] focus:bg-white rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#231710] outline-none"
                />
              </div>

              <div className="sm:col-span-7">
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  2. اسم الصنف التجاري
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: نسكافيه جولد 100 جم / كيس مكرونة الملكة 400 جم..."
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3 py-2 text-sm font-bold text-[#231710] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  سعر البيع للجمهور
                </label>
                <input
                  ref={priceInputRef}
                  type="number"
                  step="0.25"
                  min="0.5"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#231710] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  سعر التكلفة (الجملة)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="تلقائي 78%"
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#231710] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  {matchedExisting && stockOperation === 'increment' ? 'الكمية المضافة' : 'الرصيد الافتتاحي'}
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#231710] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  طريقة البيع
                </label>
                <select
                  value={sellingMode}
                  onChange={(e) => setSellingMode(e.target.value as ProductSellingMode)}
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold text-[#231710] outline-none"
                >
                  <option value="unit">بالقطعة / العبوة (ماركت)</option>
                  <option value="weight">بالوزن / الكيلو</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  القسم
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold text-[#231710] outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCategoryName(c.name)}
                    </option>
                  ))}
                </select>
              </div>

              {sellingMode === 'unit' ? (
                <div>
                  <label className="block text-xs font-bold text-[#231710] mb-1">
                    اسم الوحدة على البون
                  </label>
                  <input
                    type="text"
                    value={unitLabel}
                    onChange={(e) => setUnitLabel(e.target.value)}
                    placeholder="قطعة / علبة / كيس / زجاجة"
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
                  />
                </div>
              ) : (
                <div className="text-[11px] text-[#6B5644] bg-[#FAF6F0] px-3 py-2 rounded-xl border border-[#E8E0D5]">
                  يتم توليد أوزان (ثمن / ربع / نصف / كيلو) تلقائياً
                </div>
              )}

              <button
                type="submit"
                className="min-h-[40px] w-full bg-[#9A6836] hover:bg-[#7F5429] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                <span>{matchedExisting ? 'تحديث الصنف ومسح التالي (Enter)' : 'إضافة الصنف ومسح التالي (Enter)'}</span>
              </button>
            </div>

            {matchedExisting && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E8E0D5] text-xs">
                <span className="font-bold text-[#6B5644]">معاملة الرصيد للصنف المسجل مسبقاً:</span>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#231710]">
                  <input
                    type="radio"
                    checked={stockOperation === 'set'}
                    onChange={() => setStockOperation('set')}
                  />
                  <span>تعيين الرصيد الفعلي مباشرة</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#231710]">
                  <input
                    type="radio"
                    checked={stockOperation === 'increment'}
                    onChange={() => setStockOperation('increment')}
                  />
                  <span>إضافة الكمية فوق الرصيد الحالي ({matchedExisting.stockKg ?? 0})</span>
                </label>
              </div>
            )}
          </form>
        </div>

        {/* Footer Commit Bar */}
        <div className="px-5 py-3.5 bg-[#FAF6F0] border-t border-[#E8E0D5] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-[#6B5644]">
            إجمالي الأصناف بالكتالوج: <span className="text-[#231710] font-mono">{stagedProducts.length}</span> صنف
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-[#E8E0D5] text-xs font-bold text-[#231710] cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              disabled={saving || !hasUnsavedChanges}
              onClick={handleCommitAll}
              className="px-5 py-2.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'جاري حفظ الكتالوج...' : 'حفظ واعتماد الكتالوج بالكامل'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
