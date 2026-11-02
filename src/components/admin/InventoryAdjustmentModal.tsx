'use client';

import React, { useState, useEffect } from 'react';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  X,
  History,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { Product, InventoryAdjustment, InventoryAdjustmentReason } from '@/types/store';

interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currentRole?: string;
  onStockUpdated?: (updatedProduct: Partial<Product>) => void;
}

const REASON_OPTIONS: Array<{ value: InventoryAdjustmentReason; label: string; description: string }> = [
  {
    value: 'physical_count_discrepancy',
    label: 'تسوية جرد دوري (عجز / زيادة)',
    description: 'فارق بين الوزن الفعلي بالصوامع ورصيد السيستم أثناء الجرد الدوري',
  },
  {
    value: 'roasting_shrinkage',
    label: 'هالك تحميص طبيعي (تبخر رطوبة)',
    description: 'فقدان طبيعي في وزن حبوب البن والمكسرات أثناء التحميص بالفرع (10-18%)',
  },
  {
    value: 'damaged_spoilage',
    label: 'تالف / كسر / منتهي الصلاحية',
    description: 'أصناف تعرضت للتلف أو الكسر أو أكياس تالفة بالصالة',
  },
  {
    value: 'sample_hospitality',
    label: 'ضيافة وتذوق بالفرع',
    description: 'عينات تذوق وضيافة للعملاء والزوار بالفرع',
  },
  {
    value: 'correction',
    label: 'تصحيح خطأ إدخال رصيد سابق',
    description: 'تصحيح فاتورة توريد سابقة أو خطأ كتابي في كمية سابقة',
  },
];

export default function InventoryAdjustmentModal({
  isOpen,
  onClose,
  products,
  currentRole = 'super_admin',
  onStockUpdated,
}: InventoryAdjustmentModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [physicalStockInput, setPhysicalStockInput] = useState<string>('');
  const [reason, setReason] = useState<InventoryAdjustmentReason>('physical_count_discrepancy');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'adjust' | 'history'>('adjust');

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const currentStockKg = typeof selectedProduct?.stockKg === 'number' ? selectedProduct.stockKg : 0;
  const unitCost = typeof selectedProduct?.costPerKg === 'number' && selectedProduct.costPerKg > 0
    ? selectedProduct.costPerKg
    : (selectedProduct?.pricePerKg ? Math.round(selectedProduct.pricePerKg * 0.65) : 300);

  const parsedPhysicalStock = parseFloat(physicalStockInput);
  const isValidNumber = !isNaN(parsedPhysicalStock) && parsedPhysicalStock >= 0;
  const differenceKg = isValidNumber ? Math.round((parsedPhysicalStock - currentStockKg) * 1000) / 1000 : 0;
  const costImpact = Math.round(differenceKg * unitCost * 100) / 100;

  const isReadOnly = currentRole === 'accountant' || currentRole === 'cashier' || currentRole === 'delivery_rider';

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/admin/inventory-adjustments');
      const data = await res.json();
      if (res.ok && Array.isArray(data.adjustments)) {
        setAdjustments(data.adjustments);
      }
    } catch (e) {
      console.error('Failed to load adjustments history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      if (selectedProduct) {
        setPhysicalStockInput(String(selectedProduct.stockKg || 0));
      }
    }
  }, [isOpen, selectedProductId]);

  if (!isOpen) return null;

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber) {
      setError('يرجى إدخال وزن فعلي صحيح بالكيلوجرام (>= 0)');
      return;
    }
    if (differenceKg === 0) {
      setError('الوزن الفعلي المدخل مطابق تماماً لرصيد السيستم الحالي (لا يوجد فارق للتسوية)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch('/api/admin/inventory-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          newStockKg: parsedPhysicalStock,
          reason,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل في حفظ تسوية الجرد');
      }

      setSuccessMsg(data.message || 'تمت تسوية الجرد وتحديث المخزون بنجاح');
      if (data.adjustment) {
        setAdjustments((prev) => [data.adjustment, ...prev]);
      }
      if (data.product && onStockUpdated) {
        onStockUpdated(data.product);
      }
      setNotes('');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تنفيذ تسوية الجرد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-[#FAF6F0] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#D4AF37]/40 flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#231710] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#D4AF37]/30">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <h3 className="font-cairo font-bold text-base text-[#D4AF37]">
                تسوية ومطابقة الجرد الفعلي للمخزون
              </h3>
              <p className="text-[11px] text-white/70">
                محمصة حفصة للبن والمكسرات — فرع بني مزار
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 bg-[#F3ECE1]/60 px-5 pt-2">
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setActiveTab('adjust')}
              className={`pb-2.5 px-4 font-cairo font-bold text-xs flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'adjust'
                  ? 'border-[#C88A4B] text-[#231710]'
                  : 'border-transparent text-gray-500 hover:text-[#231710]'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>إجراء تسوية جديدة</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-4 font-cairo font-bold text-xs flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'history' || isReadOnly
                ? 'border-[#C88A4B] text-[#231710]'
                : 'border-transparent text-gray-500 hover:text-[#231710]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل تسويات وهالك الجرد ({adjustments.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto flex-1 font-cairo text-sm text-[#231710]">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-300 text-red-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'adjust' && !isReadOnly ? (
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {/* Product Selector */}
              <div>
                <label className="block font-bold text-xs mb-1 text-gray-700">
                  اختر الصنف المراد تسوية جرده:
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-[#C88A4B] focus:border-[#C88A4B] outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (الرصيد الدفتري الحالي: {p.stockKg || 0} كجم)
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Metrics Card */}
              <div className="grid grid-cols-3 gap-2.5 bg-[#F3ECE1] p-3 rounded-xl border border-black/5 text-xs">
                <div>
                  <span className="text-gray-500 block text-[11px]">الرصيد الدفتري الحالي:</span>
                  <span className="font-black text-sm text-[#231710]">
                    {currentStockKg} كجم
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">متوسط التكلفة (WAC):</span>
                  <span className="font-black text-sm text-[#231710]">
                    {unitCost} ج.م / كجم
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">قيمة الرصيد الحالي:</span>
                  <span className="font-black text-sm text-[#231710]">
                    {Math.round(currentStockKg * unitCost)} ج.م
                  </span>
                </div>
              </div>

              {/* Physical Weight Input */}
              <div>
                <label className="block font-bold text-xs mb-1 text-gray-700">
                  الوزن الفعلي الحقيقي بعد الوزن على الميزان (كجم):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={physicalStockInput}
                    onChange={(e) => setPhysicalStockInput(e.target.value)}
                    placeholder="مثلاً: 24.500"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-black text-left pl-14 focus:ring-2 focus:ring-[#C88A4B] focus:border-[#C88A4B] outline-none dir-ltr"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">
                    كجم
                  </span>
                </div>
              </div>

              {/* Computed Discrepancy & Cost Impact */}
              {isValidNumber && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    differenceKg < 0
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : differenceKg > 0
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {differenceKg < 0 ? (
                      <TrendingDown className="w-5 h-5 text-amber-600" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    )}
                    <div>
                      <div className="font-bold">
                        {differenceKg < 0
                          ? `عجز جرد / هالك: ${Math.abs(differenceKg)} كجم (${Math.round(Math.abs(differenceKg) * 1000)} جم)`
                          : differenceKg > 0
                            ? `فائض جرد: +${differenceKg} كجم (${Math.round(differenceKg * 1000)} جم)`
                            : 'الرصيد متطابق تماماً'}
                      </div>
                      <div className="text-[11px] opacity-80">
                        الأثر المالي للتسوية: {costImpact > 0 ? `+${costImpact}` : costImpact} ج.م
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Adjustment Reason */}
              <div>
                <label className="block font-bold text-xs mb-1 text-gray-700">
                  سبب التسوية الجردية:
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as InventoryAdjustmentReason)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-[#C88A4B] focus:border-[#C88A4B] outline-none"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10.5px] text-gray-500 mt-1">
                  {REASON_OPTIONS.find((r) => r.value === reason)?.description}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-xs mb-1 text-gray-700">
                  ملاحظات وتوثيق الحركة (اختياري):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثلاً: جرد ربع سنوي بحضور مسؤول الفرع، أو هالك تحميص دفعة بن كولومبي..."
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#C88A4B] focus:border-[#C88A4B] outline-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !isValidNumber || differenceKg === 0}
                  className="w-full bg-[#C88A4B] hover:bg-[#b0753a] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
                >
                  {loading ? (
                    <span>جاري حفظ التسوية...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>اعتماد تسوية الجرد وتحديث المخزون الفعلي</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* History / Audit Log View */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-600 bg-[#F3ECE1] p-2.5 rounded-xl">
                <span>إجمالي الحركات المسجلة: <b>{adjustments.length}</b></span>
                <span>
                  صافي الأثر المالي للتسويات:{' '}
                  <b className="text-[#231710]">
                    {Math.round(
                      adjustments.reduce((sum, a) => sum + (a.totalCostImpact || 0), 0) * 100
                    ) / 100}{' '}
                    ج.م
                  </b>
                </span>
              </div>

              {loadingHistory ? (
                <div className="text-center py-8 text-xs text-gray-500">جاري تحميل سجل التسويات...</div>
              ) : adjustments.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-xs text-gray-500">
                  لا توجد حركات تسوية جرد مسجلة حتى الآن
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#231710] text-[#D4AF37] font-bold">
                      <tr>
                        <th className="py-2 px-3">رقم الحركة</th>
                        <th className="py-2 px-3">الصنف</th>
                        <th className="py-2 px-3">السابق</th>
                        <th className="py-2 px-3">الجديد</th>
                        <th className="py-2 px-3">الفارق</th>
                        <th className="py-2 px-3">الأثر المالي</th>
                        <th className="py-2 px-3">السبب</th>
                        <th className="py-2 px-3">المنفذ</th>
                        <th className="py-2 px-3">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {adjustments.map((adj) => (
                        <tr key={adj.id} className="hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono font-bold">{adj.adjustmentNumber}</td>
                          <td className="py-2 px-3 font-bold">{adj.productName}</td>
                          <td className="py-2 px-3 text-gray-600">{adj.previousStockKg} كجم</td>
                          <td className="py-2 px-3 font-bold">{adj.newStockKg} كجم</td>
                          <td
                            className={`py-2 px-3 font-bold ${
                              adj.differenceKg < 0 ? 'text-amber-600' : 'text-blue-600'
                            }`}
                          >
                            {adj.differenceKg > 0 ? `+${adj.differenceKg}` : adj.differenceKg} كجم
                          </td>
                          <td className="py-2 px-3 font-bold">
                            {adj.totalCostImpact > 0 ? `+${adj.totalCostImpact}` : adj.totalCostImpact} ج.م
                          </td>
                          <td className="py-2 px-3 text-[11px] text-gray-700">{adj.reasonLabel || adj.reason}</td>
                          <td className="py-2 px-3 text-[11px] text-gray-600">{adj.adjustedBy}</td>
                          <td className="py-2 px-3 text-[10px] text-gray-500">
                            {new Date(adj.createdAt).toLocaleDateString('ar-EG')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
