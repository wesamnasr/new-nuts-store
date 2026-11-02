'use client';

import React from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  RotateCcw,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Trash2,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { Product, SupplyInvoice, SupplyInvoiceItem } from '@/types/store';
import { updateUrlQueryParams } from '@/lib/url-sync';
import { generateSupplyLedgerCsv, triggerCsvDownload } from '@/lib/financials';

export interface SupplyInvoicesApprovalModuleProps {
  effectiveSupplyInvoices: SupplyInvoice[];
  pendingSupplyInvoicesCount: number;
  loadingSupplyInvoices: boolean;
  supplyInvoiceFilter: 'all' | 'pending' | 'approved' | 'rejected';
  setSupplyInvoiceFilter: (f: 'all' | 'pending' | 'approved' | 'rejected') => void;
  filteredSupplyInvoices: SupplyInvoice[];
  expandedAdminInvoiceId: string | null;
  setExpandedAdminInvoiceId: (id: string | null) => void;
  actionLoadingInvoiceId: string | null;
  products: Product[];
  invoiceReviewNotes: Record<string, string>;
  setInvoiceReviewNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fetchSupplyInvoices: () => void;
  handleReviewSupplyInvoice: (invoiceId: string, status: 'approved' | 'rejected') => void;
  canApprove?: boolean;
}

export default function SupplyInvoicesApprovalModule({
  effectiveSupplyInvoices,
  pendingSupplyInvoicesCount,
  loadingSupplyInvoices,
  supplyInvoiceFilter,
  setSupplyInvoiceFilter,
  filteredSupplyInvoices,
  expandedAdminInvoiceId,
  setExpandedAdminInvoiceId,
  actionLoadingInvoiceId,
  products,
  invoiceReviewNotes,
  setInvoiceReviewNotes,
  fetchSupplyInvoices,
  handleReviewSupplyInvoice,
  canApprove = true,
}: SupplyInvoicesApprovalModuleProps) {
  const totalAllAmount = effectiveSupplyInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalPendingAmount = effectiveSupplyInvoices
    .filter((i) => i.status === 'pending')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalApprovedAmount = effectiveSupplyInvoices
    .filter((i) => i.status === 'approved')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalRejectedAmount = effectiveSupplyInvoices
    .filter((i) => i.status === 'rejected')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header card with quick actions and stats */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8E0D5] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] text-[#9A6836] flex items-center justify-center border border-[#E8E0D5]">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-[#231710]">
                  إدارة فواتير التوريد واعتماد الشحنات
                </h2>
                {pendingSupplyInvoicesCount > 0 && (
                  <span className="bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[10.5px] px-2.5 py-0.5 rounded-full">
                    {pendingSupplyInvoicesCount} بانتظار الاعتماد
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const csv = generateSupplyLedgerCsv(filteredSupplyInvoices);
                triggerCsvDownload(
                  `hafsa_supply_ledger_${new Date().toISOString().slice(0, 10)}.csv`,
                  csv
                );
              }}
              className="bg-[#FAF6F0] hover:bg-[#F2ECE2] text-[#231710] border border-[#E8E0D5] px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#6B5644]" />
              <span>تصدير كشف التوريد (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => fetchSupplyInvoices()}
              disabled={loadingSupplyInvoices}
              className="bg-[#FAF6F0] hover:bg-[#F2ECE2] text-[#231710] border border-[#E8E0D5] px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-[#6B5644] ${loadingSupplyInvoices ? 'animate-spin' : ''}`} />
              <span>تحديث الفواتير</span>
            </button>
            {canApprove && (
              <Link
                href="/supplier"
                target="_blank"
                className="bg-[#231710] hover:bg-[#3A271C] text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>فتح بوابة المورد</span>
              </Link>
            )}
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E8E0D5]">
          <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5]">
            <span className="text-[11px] font-medium text-[#6B5644] block">إجمالي الفواتير المسجلة</span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-sm font-bold text-[#231710]">{effectiveSupplyInvoices.length} فاتورة</span>
              <span className="text-xs font-bold text-[#4A3728]">
                {totalAllAmount.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
          <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5]">
            <span className="text-[11px] font-medium text-[#6B5644] block">فواتير قيد المراجعة</span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-sm font-bold text-amber-800">{pendingSupplyInvoicesCount} فاتورة</span>
              <span className="text-xs font-bold text-[#231710]">
                {totalPendingAmount.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
          <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5]">
            <span className="text-[11px] font-medium text-[#6B5644] block">فواتير معتمدة بالمخزون</span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-sm font-bold text-emerald-700">
                {effectiveSupplyInvoices.filter((i) => i.status === 'approved').length} فاتورة
              </span>
              <span className="text-xs font-bold text-[#231710]">
                {totalApprovedAmount.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
          <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5]">
            <span className="text-[11px] font-medium text-[#6B5644] block">فواتير مرفوضة</span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-sm font-bold text-red-700">
                {effectiveSupplyInvoices.filter((i) => i.status === 'rejected').length} فاتورة
              </span>
              <span className="text-xs font-bold text-[#231710]">
                {totalRejectedAmount.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
          <button
            key={st}
            onClick={() => {
              setSupplyInvoiceFilter(st);
              updateUrlQueryParams({ invStatus: st === 'all' ? null : st });
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              supplyInvoiceFilter === st
                ? 'bg-brand-900 text-white shadow-xs'
                : 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-50'
            }`}
          >
            {st === 'all' && `جميع الفواتير (${effectiveSupplyInvoices.length})`}
            {st === 'pending' && `بانتظار المراجعة (${pendingSupplyInvoicesCount})`}
            {st === 'approved' && `المعتمدة (${effectiveSupplyInvoices.filter((i) => i.status === 'approved').length})`}
            {st === 'rejected' && `المرفوضة (${effectiveSupplyInvoices.filter((i) => i.status === 'rejected').length})`}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {filteredSupplyInvoices.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-2xl border border-brand-200 shadow-2xs space-y-2">
          <CheckCircle2 className="w-10 h-10 text-pistachio-600 mx-auto" />
          <h3 className="text-sm font-black text-brand-950">لا توجد فواتير توريد بهذه الحالة</h3>
          <p className="text-xs text-brand-600">
            يمكن للمورد إرسال فواتير توريد جديدة من بوابته المخصصة لتظهر هنا فوراً.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredSupplyInvoices.map((inv) => {
            const isPending = inv.status === 'pending';
            const isExpanded = expandedAdminInvoiceId === inv.id || isPending;
            const totalKg = inv.items.reduce((s: number, i: SupplyInvoiceItem) => s + (i.quantityKg || 0), 0);
            const isActionLoading = actionLoadingInvoiceId === inv.id;

            return (
              <div
                key={inv.id}
                className={`bg-white rounded-2xl border shadow-2xs overflow-hidden transition ${
                  isPending ? 'border-amber-300 ring-2 ring-amber-100' : 'border-brand-200'
                }`}
              >
                {/* Invoice Header */}
                <div
                  className={`p-4 flex flex-wrap items-center justify-between gap-3 ${
                    isPending ? 'bg-amber-50/50' : 'bg-brand-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                        isPending
                          ? 'bg-amber-500 text-brand-950 font-bold'
                          : inv.status === 'approved'
                          ? 'bg-pistachio-700 text-white'
                          : 'bg-red-700 text-white'
                      }`}
                    >
                      SUP
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-brand-950 text-sm">
                          {inv.invoiceNumber}
                        </span>
                        {inv.status === 'pending' && (
                          <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>قيد المراجعة والاعتماد</span>
                          </span>
                        )}
                        {inv.status === 'approved' && (
                          <span className="bg-pistachio-100 border border-pistachio-300 text-pistachio-900 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-pistachio-700" />
                            <span>معتمدة (تمت إضافة المخزون)</span>
                          </span>
                        )}
                        {inv.status === 'rejected' && (
                          <span className="bg-red-100 border border-red-300 text-red-900 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            <span>مرفوضة من الإدارة</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-brand-500 mt-0.5">
                        المورد: <span className="font-extrabold text-brand-900">{inv.supplierName || inv.supplierId}</span> • تاريخ الإنشاء:{' '}
                        {new Date(inv.createdAt).toLocaleString('ar-EG')} • {inv.items.length} أصناف ({totalKg} كجم)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <span className="text-[10px] text-brand-500 font-bold block">إجمالي الفاتورة</span>
                      <span className="text-sm sm:text-base font-black text-pistachio-800">
                        {inv.totalAmount.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    {!isPending && (
                      <button
                        type="button"
                        onClick={() => setExpandedAdminInvoiceId(isExpanded ? null : inv.id)}
                        className="bg-brand-100 hover:bg-brand-200 text-brand-900 p-2 rounded-xl transition"
                        title={isExpanded ? 'إخفاء التفاصيل' : 'عرض الأصناف'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Supplier Notes */}
                {inv.notes && (
                  <div className="px-4 py-2 bg-brand-50/70 border-t border-brand-100 text-xs text-brand-800">
                    <span className="font-extrabold text-brand-950">ملاحظات المورد: </span>
                    <span>{inv.notes}</span>
                  </div>
                )}

                {/* Line Items Table */}
                {isExpanded && (
                  <div className="p-4 border-t border-brand-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-brand-950">
                        تفاصيل أصناف وكميات الشحنة ({inv.items.length} أصناف):
                      </h4>
                      {isPending && (
                        <span className="text-[10.5px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 font-bold">
                          المخزون الفعلي الحالي لن يتأثر إلا بعد الضغط على &quot;اعتماد الفاتورة&quot;
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                            <th className="p-2.5">اسم الصنف</th>
                            <th className="p-2.5 text-center">الكمية الموردة (كجم)</th>
                            <th className="p-2.5 text-center">تكلفة الكيلو (ج.م)</th>
                            <th className="p-2.5 text-center">إجمالي البند (ج.م)</th>
                            <th className="p-2.5 text-center">المخزون الحالي بالمتجر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F2ECE2]">
                          {inv.items.map((item: SupplyInvoiceItem, idx: number) => {
                            const prod = products.find((p) => p.id === item.productId);
                            const currentStock = typeof prod?.stockKg === 'number' ? prod.stockKg : 0;
                            return (
                              <tr key={idx} className="hover:bg-[#FAF6F0]/60">
                                <td className="p-2.5">
                                  <div className="font-bold text-[#231710]">{item.productName}</div>
                                  {prod && (
                                    <div className="text-[10px] text-[#8A735E] font-mono">
                                      كود: {prod.slug}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-bold text-[#231710]">
                                  +{item.quantityKg} كجم
                                </td>
                                <td className="p-2.5 text-center font-bold">
                                  {item.costPerKg} ج.م
                                </td>
                                <td className="p-2.5 text-center font-bold text-emerald-700">
                                  {item.totalCost} ج.م
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  <span className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] px-2 py-0.5 rounded font-bold">
                                    {currentStock} كجم
                                  </span>
                                  {isPending && (
                                    <span className="text-[10px] text-emerald-700 block font-bold mt-0.5">
                                      → بعد الاعتماد: {Math.round((currentStock + item.quantityKg) * 1000) / 1000} كجم
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pending Action Box */}
                    {isPending && canApprove && (
                      <div className="p-4 bg-[#FAF6F0] rounded-2xl border border-[#E8E0D5] space-y-3 mt-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#231710] mb-1">
                            ملاحظات الإدارة عند المراجعة (اختياري):
                          </label>
                          <input
                            type="text"
                            value={invoiceReviewNotes[inv.id] || ''}
                            onChange={(e) =>
                              setInvoiceReviewNotes((prev) => ({
                                ...prev,
                                [inv.id]: e.target.value,
                              }))
                            }
                            placeholder="مثال: تم فحص الشحنة ومطابقة الأوزان على ميزان الفرع واعتمادها"
                            className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs text-[#231710]"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="text-[11px] text-[#6B5644] font-medium">
                            بالضغط على اعتماد الفاتورة سيتم فورياً إضافة الكميات إلى مخزون الأصناف وتحديث تكلفة الكيلو.
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleReviewSupplyInvoice(inv.id, 'rejected')}
                              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>رفض الفاتورة</span>
                            </button>

                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleReviewSupplyInvoice(inv.id, 'approved')}
                              className="bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {isActionLoading ? (
                                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>اعتماد الفاتورة وإضافة المخزون</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {isPending && !canApprove && (
                      <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] text-[11px] font-bold text-[#6B5644] mt-3">
                        هذه الفاتورة قيد المراجعة — اعتماد الشحنات وإضافتها للمخزون الفعلي متاح لصلاحية الإدارة العامة.
                      </div>
                    )}

                    {/* Reviewed History Notes */}
                    {!isPending && (inv.adminNotes || inv.reviewedAt) && (
                      <div className="p-3 bg-brand-50 rounded-xl border border-brand-200 text-xs space-y-0.5">
                        <div className="text-brand-950 font-black">
                          حالة الفحص والاعتماد: {inv.status === 'approved' ? 'معتمدة ✓' : 'مرفوضة ✕'}
                        </div>
                        {inv.adminNotes && (
                          <div className="text-brand-700">ملاحظات الإدارة: {inv.adminNotes}</div>
                        )}
                        {inv.reviewedAt && (
                          <div className="text-[10px] text-brand-500">
                            تاريخ المراجعة: {new Date(inv.reviewedAt).toLocaleString('ar-EG')} بواسطة {inv.reviewedBy || 'الأدمن'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
