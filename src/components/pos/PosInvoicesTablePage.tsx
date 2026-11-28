'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  Search,
  Printer,
  MessageCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Order, PosReturnItem, PosReturnRecord, PosShift } from '@/types/store';
import { formatWhatsAppPhone } from '@/lib/validation';
import { useStore } from '@/context/StoreContext';

interface PosInvoicesTablePageProps {
  recentPosOrders: Order[];
  onlineQueueOrders: Order[];
  posShifts: PosShift[];
  activeShift: PosShift | null;
  posReturns?: PosReturnRecord[];
  canSeeProfits: boolean;
  onReprintOrder: (order: Order) => void;
  onPrintReturnReceipt?: (ret: PosReturnRecord) => void;
  onCreateReturn?: (payload: {
    orderId: string;
    items: PosReturnItem[];
    refundMethod: PosReturnRecord['refundMethod'];
    reason?: string;
    customerPhone?: string;
  }) => Promise<PosReturnRecord | null>;
  initialReturnOrder?: Order | null;
  onClearInitialReturnOrder?: () => void;
  onRefresh: () => void;
  sourceFilter?:
    | 'all_pos'
    | 'counter_takeaway'
    | 'glass_bar_dine_in'
    | 'phone_delivery'
    | 'online'
    | 'all';
  onChangeSourceFilter?: (
    filter:
      | 'all_pos'
      | 'counter_takeaway'
      | 'glass_bar_dine_in'
      | 'phone_delivery'
      | 'online'
      | 'all'
  ) => void;
}

interface ReturnDraftRow {
  key: string;
  cartItemId?: string;
  productId: string;
  productName: string;
  soldQty: number;
  unitPrice: number;
  unitLabel?: string;
  weightGrams?: number;
  returnQty: number;
  condition: 'restock' | 'damaged';
}

export default function PosInvoicesTablePage({
  recentPosOrders,
  onlineQueueOrders,
  posShifts,
  activeShift,
  posReturns = [],
  canSeeProfits,
  onReprintOrder,
  onPrintReturnReceipt,
  onCreateReturn,
  initialReturnOrder,
  onClearInitialReturnOrder,
  onRefresh,
  sourceFilter: externalSourceFilter,
  onChangeSourceFilter,
}: PosInvoicesTablePageProps) {
  const { storeData, showToast } = useStore();
  const storeName = storeData?.settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const currency = storeData?.settings?.currencySymbol || 'ج.م';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [internalSourceFilter, setInternalSourceFilter] = useState<
    'all_pos' | 'counter_takeaway' | 'glass_bar_dine_in' | 'phone_delivery' | 'online' | 'all'
  >('all_pos');
  const sourceFilter = externalSourceFilter ?? internalSourceFilter;
  const setSourceFilter = (
    val:
      | 'all_pos'
      | 'counter_takeaway'
      | 'glass_bar_dine_in'
      | 'phone_delivery'
      | 'online'
      | 'all'
  ) => {
    setInternalSourceFilter(val);
    onChangeSourceFilter?.(val);
  };
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showReturnsLedger, setShowReturnsLedger] = useState<boolean>(false);

  // POS Partial/Full Return Modal State
  const [returnTargetOrder, setReturnTargetOrder] = useState<Order | null>(null);
  const [returnDraftRows, setReturnDraftRows] = useState<ReturnDraftRow[]>([]);
  const [returnRefundMethod, setReturnRefundMethod] =
    useState<PosReturnRecord['refundMethod']>('cash');
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnCustomerPhone, setReturnCustomerPhone] = useState<string>('');
  const [returnSubmitting, setReturnSubmitting] = useState<boolean>(false);
  const [quickReturnLookup, setQuickReturnLookup] = useState<string>('');

  const openReturnModalForOrder = (ord: Order) => {
    setReturnTargetOrder(ord);
    setReturnDraftRows(
      ord.items.map((it, idx) => ({
        key: it.cartItemId || `${it.productId}-${idx}`,
        cartItemId: it.cartItemId,
        productId: it.productId,
        productName: it.productName,
        soldQty: it.quantity || 1,
        unitPrice: it.unitPrice,
        unitLabel: it.weightLabel,
        weightGrams: it.customWeightGrams,
        returnQty: 0,
        condition: 'restock',
      }))
    );
    if (ord.paymentMethod === 'credit' || (ord.creditDueAmount || 0) > 0) {
      setReturnRefundMethod('credit_deduction');
    } else if (
      ord.paymentMethod === 'card' ||
      ord.paymentMethod === 'instapay' ||
      ord.paymentMethod === 'vodafone_cash'
    ) {
      setReturnRefundMethod('original_electronic');
    } else {
      setReturnRefundMethod('cash');
    }
    setReturnReason('');
    setReturnCustomerPhone(
      ord.customerPhone && ord.customerPhone !== '01000000000' ? ord.customerPhone : ''
    );
  };

  useEffect(() => {
    if (initialReturnOrder) {
      openReturnModalForOrder(initialReturnOrder);
      onClearInitialReturnOrder?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReturnOrder]);

  // Combine POS and Online orders without duplicates
  const allCombinedOrders = useMemo(() => {
    const map = new Map<string, Order>();
    for (const o of recentPosOrders) map.set(o.id, o);
    for (const o of onlineQueueOrders) {
      if (!map.has(o.id)) map.set(o.id, o);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [recentPosOrders, onlineQueueOrders]);

  const filteredOrders = useMemo(() => {
    return allCombinedOrders.filter((ord) => {
      const isPos = ord.orderSource === 'pos' || ord.orderNumber?.startsWith('POS-');
      if (sourceFilter === 'all_pos' && !isPos) return false;
      if (sourceFilter === 'online' && isPos) return false;
      if (
        sourceFilter === 'counter_takeaway' &&
        (!isPos || ord.posOrderType !== 'counter_takeaway')
      ) {
        return false;
      }
      if (
        sourceFilter === 'glass_bar_dine_in' &&
        (!isPos || ord.posOrderType !== 'glass_bar_dine_in')
      ) {
        return false;
      }
      if (
        sourceFilter === 'phone_delivery' &&
        (!isPos || ord.posOrderType !== 'phone_delivery')
      ) {
        return false;
      }

      if (paymentFilter !== 'all' && ord.paymentMethod !== paymentFilter) {
        return false;
      }

      if (shiftFilter === 'active_shift') {
        if (activeShift && ord.shiftId && ord.shiftId !== activeShift.id) {
          return false;
        }
      } else if (shiftFilter !== 'all') {
        if (ord.shiftId !== shiftFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchOrderNum = ord.orderNumber.toLowerCase().includes(q);
        const matchName = (ord.customerName || '').toLowerCase().includes(q);
        const matchPhone = (ord.customerPhone || '').toLowerCase().includes(q);
        const matchItem = ord.items.some((it) =>
          it.productName.toLowerCase().includes(q)
        );
        return matchOrderNum || matchName || matchPhone || matchItem;
      }

      return true;
    });
  }, [
    allCombinedOrders,
    sourceFilter,
    paymentFilter,
    shiftFilter,
    activeShift,
    searchQuery,
  ]);

  // Summary Metrics for Filtered Invoices
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let cashTotal = 0;
    let digitalTotal = 0;
    let netProfitTotal = 0;

    for (const o of filteredOrders) {
      totalRevenue += o.total || 0;
      if (o.paymentMethod === 'cod') {
        cashTotal += o.total || 0;
      } else {
        digitalTotal += o.total || 0;
      }
      if (canSeeProfits && typeof o.netProfitEgp === 'number') {
        netProfitTotal += o.netProfitEgp;
      }
    }

    return {
      count: filteredOrders.length,
      totalRevenue,
      cashTotal,
      digitalTotal,
      netProfitTotal,
    };
  }, [filteredOrders, canSeeProfits]);

  // Export Filtered Table to CSV
  const handleExportCsv = () => {
    const headers = [
      'رقم الفاتورة',
      'التاريخ والوقت',
      'نوع الطلب',
      'اسم العميل',
      'رقم الهاتف',
      'عدد الأصناف',
      'المجموع الفرعي',
      'الخصم',
      'الإجمالي الصافي',
      'طريقة الدفع',
      ...(canSeeProfits ? ['التكلفة الفعلية', 'صافي الربح'] : []),
    ];

    const rows = filteredOrders.map((o) => {
      const orderTypeLabel =
        o.posOrderType === 'whatsapp_online' || o.orderNumber.startsWith('WA-')
          ? 'طلب أونلاين (واتساب)'
          : o.orderSource === 'pos' || o.orderNumber.startsWith('POS-')
            ? o.posOrderType === 'glass_bar_dine_in'
              ? `البار الزجاجي (كرسي ${o.chairNumber || 1})`
              : o.posOrderType === 'phone_delivery'
                ? 'دليفري تليفون'
                : 'كاونتر مباشر'
            : 'طلب موقع أونلاين';

      const pmLabel =
        o.paymentMethod === 'cod'
          ? 'نقدي كاش'
          : o.paymentMethod === 'vodafone_cash'
            ? 'فودافون كاش'
            : o.paymentMethod === 'instapay'
              ? 'إنستاباي'
              : o.paymentMethod === 'card'
                ? 'فيزا الفرع'
                : 'محفظة VIP';

      return [
        o.orderNumber,
        new Date(o.createdAt).toLocaleString('ar-EG'),
        orderTypeLabel,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        o.customerPhone,
        o.items.reduce((s, i) => s + i.quantity, 0),
        o.subtotal,
        o.discountAmount || 0,
        o.total,
        pmLabel,
        ...(canSeeProfits ? [o.rawCostTotal ?? 0, o.netProfitEgp ?? 0] : []),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `hafsa-pos-invoices-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 tabular-nums">
        <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5]">
          <span className="text-xs text-[#6B5B4E] font-medium block">
            عدد الفواتير المعروضة
          </span>
          <span className="font-cairo font-bold text-xl text-[#231710]">
            {metrics.count} فاتورة
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5]">
          <span className="text-xs text-[#6B5B4E] font-medium block">
            إجمالي مبيعات الجدول
          </span>
          <span className="font-cairo font-bold text-xl text-[#231710]">
            {metrics.totalRevenue} ج.م
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5]">
          <span className="text-xs text-[#6B5B4E] font-medium block">
            تحصيل النقدي (الكاش)
          </span>
          <span className="font-cairo font-bold text-xl text-[#231710]">
            {metrics.cashTotal} ج.م
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5]">
          <span className="text-xs text-[#6B5B4E] font-medium block">
            فودافون كاش + إنستاباي + فيزا
          </span>
          <span className="font-cairo font-bold text-xl text-[#9A6836]">
            {metrics.digitalTotal} ج.م
          </span>
        </div>

        {canSeeProfits ? (
          <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5]">
            <span className="text-xs text-[#6B5B4E] font-medium block">
              صافي الربح الفعلي
            </span>
            <span className="font-cairo font-bold text-xl text-[#3B6E4C]">
              +{metrics.netProfitTotal} ج.م
            </span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5]">
            <span className="text-xs text-[#6B5B4E] font-medium block">
              متوسط قيمة الفاتورة
            </span>
            <span className="font-cairo font-bold text-xl text-[#231710]">
              {metrics.count > 0 ? Math.round(metrics.totalRevenue / metrics.count) : 0} ج.م
            </span>
          </div>
        )}
      </div>

      {/* 2. Search, Quick Return Scanner, Filters & CSV Export Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#9A6836]" />
            <h2 className="font-cairo font-bold text-base text-[#231710]">
              جدول الفواتير والمرتجعات وسجل المبيعات التفصيلي
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onCreateReturn && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = quickReturnLookup.trim().toLowerCase();
                  if (!q) return;
                  const match = allCombinedOrders.find(
                    (o) =>
                      o.orderNumber.toLowerCase() === q ||
                      o.orderNumber.toLowerCase().endsWith(q)
                  );
                  if (match) {
                    openReturnModalForOrder(match);
                    setQuickReturnLookup('');
                  } else {
                    showToast('لم يتم العثور على الفاتورة', `تحقق من رقم الفاتورة: ${quickReturnLookup}`);
                  }
                }}
                className="flex items-center gap-1.5 w-full sm:w-auto"
              >
                <input
                  type="text"
                  value={quickReturnLookup}
                  onChange={(e) => setQuickReturnLookup(e.target.value)}
                  placeholder="مسح / رقم فاتورة للمرتجع الفوري..."
                  className="min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#B83B2B] rounded-xl px-3 py-2 text-xs font-bold outline-none flex-1 min-w-0 sm:w-48"
                />
                <button
                  type="submit"
                  className="min-h-[40px] bg-rose-50 hover:bg-rose-100 text-[#B83B2B] border border-rose-200 px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>مرتجع</span>
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setShowReturnsLedger(!showReturnsLedger)}
              className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 border cursor-pointer transition ${
                showReturnsLedger
                  ? 'bg-[#B83B2B] text-white border-[#B83B2B]'
                  : 'bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border-[#E8E0D5]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>سجل المرتجعات ({posReturns.length})</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="min-h-[40px] bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[40px] bg-[#231710] hover:bg-[#3A271C] text-white px-3.5 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-[#6B5B4E] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة (POS-...)، اسم العميل، الهاتف، أو الصنف..."
              className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl pr-9 pl-3 py-2 text-xs font-medium outline-none"
            />
          </div>

          {/* Order Type Filter */}
          <div className="lg:col-span-3">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
            >
              <option value="all_pos">كل فواتير الكاشير المباشرة (POS)</option>
              <option value="counter_takeaway">بيع كاونتر مباشر فقط</option>
              <option value="glass_bar_dine_in">البار الزجاجي (4 كراسي) فقط</option>
              <option value="phone_delivery">دليفري تليفون الكاشير فقط</option>
              <option value="online">طلبات الموقع الأونلاين فقط</option>
              <option value="all">كل الفواتير (الكاشير + الأونلاين)</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="lg:col-span-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="cod">نقدي (كاش)</option>
              <option value="card">فيزا الفرع</option>
              <option value="vodafone_cash">فودافون كاش</option>
              <option value="instapay">إنستاباي</option>
              <option value="split">دفع مقسم</option>
              <option value="credit">بيع آجل</option>
              <option value="vip_wallet">محفظة VIP</option>
            </select>
          </div>

          {/* Shift Filter */}
          <div className="lg:col-span-3">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
            >
              <option value="all">كل الورديات</option>
              {activeShift && (
                <option value="active_shift">
                  الوردية الحالية ({activeShift.shiftNumber})
                </option>
              )}
              {posShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shiftNumber} — {s.shiftPeriod} ({s.cashierName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Optional Collapsible POS Returns Ledger */}
      {showReturnsLedger && (
        <div className="bg-white rounded-2xl border border-rose-200 overflow-hidden">
          <div className="bg-rose-50/70 px-4 py-3 border-b border-rose-200 flex items-center justify-between">
            <h3 className="font-cairo font-bold text-sm text-[#B83B2B] flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" />
              <span>سجل بونات المرتجعات المسجلة ({posReturns.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowReturnsLedger(false)}
              className="text-xs font-bold text-[#6B5B4E] hover:text-[#231710] cursor-pointer"
            >
              إخفاء
            </button>
          </div>

          {posReturns.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6B5B4E]">
              لا توجد عمليات مرتجع مسجلة حتى الآن
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF6F0] text-[#231710] font-cairo font-bold border-b border-[#E8E0D5]">
                    <th className="py-2.5 px-3">رقم المرتجع</th>
                    <th className="py-2.5 px-3">الفاتورة الأصلية</th>
                    <th className="py-2.5 px-3">الأصناف وحالتها</th>
                    <th className="py-2.5 px-3">طريقة الرد</th>
                    <th className="py-2.5 px-3">المبلغ المسترد</th>
                    <th className="py-2.5 px-3">التوقيت / الموظف</th>
                    <th className="py-2.5 px-3 text-center">بون المرتجع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0D5] tabular-nums">
                  {posReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-[#FAF6F0]">
                      <td className="py-2.5 px-3 font-cairo font-bold text-[#B83B2B]">
                        {ret.returnNumber}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#231710]">
                        #{ret.orderNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        {ret.items.map((ri, i) => (
                          <div key={i} className="text-[11px]">
                            {ri.returnQty}× {ri.productName}{' '}
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                ri.condition === 'damaged'
                                  ? 'bg-red-50 text-[#B83B2B]'
                                  : 'bg-emerald-50 text-emerald-800'
                              }`}
                            >
                              {ri.condition === 'damaged' ? 'تالف/هالك' : 'عاد للمخزن'}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {ret.refundMethod === 'cash'
                          ? 'نقداً من الدرج'
                          : ret.refundMethod === 'vip_wallet'
                            ? 'محفظة VIP'
                            : ret.refundMethod === 'credit_deduction'
                              ? 'خصم مديونية آجلة'
                              : 'رد إلكتروني'}
                      </td>
                      <td className="py-2.5 px-3 font-cairo font-bold text-[#B83B2B]">
                        -{ret.totalRefundAmount} ج.م
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[#6B5B4E]">
                        <div>{new Date(ret.createdAt).toLocaleString('ar-EG')}</div>
                        <div>{ret.processedBy}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {onPrintReturnReceipt && (
                          <button
                            type="button"
                            onClick={() => onPrintReturnReceipt(ret)}
                            className="min-h-[36px] bg-[#231710] hover:bg-[#3A271C] text-white px-2.5 py-1 rounded-lg text-[11px] font-cairo font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Structured Interactive Invoices Data Table */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-xs text-[#6B5B4E]">
            <Filter className="w-7 h-7 text-[#9A6836] mx-auto opacity-60" />
            <p className="font-cairo font-bold text-sm text-[#231710]">
              لا توجد فواتير مطابقة لمعايير البحث الحالية
            </p>
            <p>جرب تغيير الفلتر أو إصدار فاتورة جديدة من صفحة البيع المباشر</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF6F0] text-[#231710] font-cairo font-bold border-b border-[#E8E0D5]">
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-3">التاريخ والوقت</th>
                  <th className="py-3 px-3">نوع الطلب</th>
                  <th className="py-3 px-3">العميل</th>
                  <th className="py-3 px-3 text-center">الأصناف</th>
                  <th className="py-3 px-3">المجموع / الخصم</th>
                  <th className="py-3 px-3">الإجمالي الصافي</th>
                  <th className="py-3 px-3">طريقة الدفع</th>
                  {canSeeProfits && <th className="py-3 px-3">صافي الربح</th>}
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5] tabular-nums">
                {filteredOrders.map((ord) => {
                  const isExpanded = expandedOrderId === ord.id;
                  const totalUnits = ord.items.reduce((s, i) => s + i.quantity, 0);
                  const isPos =
                    ord.orderSource === 'pos' || ord.orderNumber.startsWith('POS-');

                  const orderTypeBadge =
                    ord.posOrderType === 'whatsapp_online' || ord.orderNumber.startsWith('WA-')
                      ? 'طلب أونلاين (واتساب)'
                      : isPos
                        ? ord.posOrderType === 'glass_bar_dine_in'
                          ? `البار (كرسي ${ord.chairNumber || 1})`
                          : ord.posOrderType === 'phone_delivery'
                            ? 'دليفري سريع'
                            : 'بيع كاونتر'
                        : 'طلب أونلاين';

                  const pmBadge =
                    ord.paymentMethod === 'cod'
                      ? 'نقدي كاش'
                      : ord.paymentMethod === 'vodafone_cash'
                        ? 'فودافون كاش'
                        : ord.paymentMethod === 'instapay'
                          ? 'إنستاباي'
                          : ord.paymentMethod === 'card'
                            ? 'فيزا الفرع'
                            : ord.paymentMethod === 'split'
                              ? 'دفع مقسم'
                              : ord.paymentMethod === 'credit'
                                ? 'بيع آجل'
                                : 'محفظة VIP';

                  const returnedTotal = ord.returnedAmountTotal || 0;
                  const isFullyReturned = returnedTotal >= ord.total && ord.total > 0;

                  return (
                    <React.Fragment key={ord.id}>
                      <tr
                        className={`transition hover:bg-[#FAF6F0] ${
                          isExpanded ? 'bg-[#FAF6F0]' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-cairo font-bold text-[#231710]">
                          <div className="space-y-1">
                            <span className="inline-block bg-[#FAF6F0] border border-[#E8E0D5] px-2.5 py-1 rounded-lg">
                              {ord.orderNumber}
                            </span>
                            {returnedTotal > 0 && (
                              <span className="block text-[11px] text-[#B83B2B] font-bold">
                                مرتجع: -{returnedTotal} ج.م
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#6B5B4E]">
                          <div className="font-bold text-[#231710]">
                            {new Date(ord.createdAt).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-[11px]">
                            {new Date(ord.createdAt).toLocaleDateString('ar-EG')}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block bg-[#FAF6F0] border border-[#E8E0D5] px-2.5 py-1 rounded-lg font-medium text-[11px] text-[#231710]">
                            {orderTypeBadge}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#231710]">
                            {ord.customerName}
                          </div>
                          {ord.customerPhone && ord.customerPhone !== '01000000000' && (
                            <div className="text-[11px] text-[#6B5B4E]">
                              {ord.customerPhone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedOrderId(isExpanded ? null : ord.id)
                            }
                            className="min-h-[36px] inline-flex items-center gap-1 bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#E8E0D5] text-[#231710] px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            <span>
                              {ord.items.length} أصناف ({totalUnits})
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#231710]">{ord.subtotal} ج.م</div>
                          {(ord.discountAmount > 0 || (ord.vipWalletRedeemed || 0) > 0) && (
                            <div className="text-[11px] text-[#B83B2B] font-bold">
                              خصم: -{(ord.discountAmount || 0) + (ord.vipWalletRedeemed || 0)} ج
                              {ord.couponCode ? ` (${ord.couponCode})` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-cairo font-bold text-sm text-[#231710]">
                            {ord.total} ج.م
                          </span>
                          {(ord.taxAmount || 0) > 0 && (
                            <div className="text-[11px] text-[#6B5B4E]">
                              ضريبة: {ord.taxAmount}ج
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#231710]">{pmBadge}</div>
                          {ord.paymentMethod === 'split' && ord.paymentSplits && (
                            <div className="text-[11px] text-[#6B5B4E]">
                              {ord.paymentSplits.map((s) => `${s.amount}ج`).join(' + ')}
                            </div>
                          )}
                          {(ord.creditDueAmount || 0) > 0 && (
                            <div className="text-[11px] text-amber-800 font-bold">
                              متبقي آجل: {Math.max(0, (ord.creditDueAmount || 0) - (ord.creditPaidAmount || 0))}ج
                            </div>
                          )}
                          {ord.paymentMethod === 'cod' &&
                            ord.cashTendered !== undefined &&
                            ord.changeDue !== undefined &&
                            ord.changeDue > 0 && (
                              <div className="text-[11px] text-[#6B5B4E]">
                                دُفع {ord.cashTendered}ج • باقي {ord.changeDue}ج
                              </div>
                            )}
                        </td>
                        {canSeeProfits && (
                          <td className="py-3 px-3">
                            {typeof ord.netProfitEgp === 'number' ? (
                              <div>
                                <span className="font-cairo font-bold text-xs text-[#3B6E4C] block">
                                  +{ord.netProfitEgp} ج.م
                                </span>
                                {ord.rawCostTotal !== undefined && (
                                  <span className="text-[11px] text-[#6B5B4E]">
                                    تكلفة: {ord.rawCostTotal}ج
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#6B5B4E]">—</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onReprintOrder(ord)}
                              title="إعادة طباعة البون الحراري 80mm"
                              className="min-h-[40px] bg-[#231710] hover:bg-[#3A271C] text-white px-3 py-1.5 rounded-xl text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>بون</span>
                            </button>

                            {onCreateReturn && ord.status !== 'cancelled' && !isFullyReturned && (
                              <button
                                type="button"
                                onClick={() => openReturnModalForOrder(ord)}
                                title="إجراء مرتجع جزئي أو كلي على هذه الفاتورة"
                                className="min-h-[40px] bg-rose-50 hover:bg-rose-100 text-[#B83B2B] border border-rose-200 px-2.5 py-1.5 rounded-xl text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>مرتجع</span>
                              </button>
                            )}

                            {ord.customerPhone &&
                              ord.customerPhone !== '01000000000' && (
                                <a
                                  href={`https://wa.me/${formatWhatsAppPhone(
                                    ord.customerPhone
                                  )}?text=${encodeURIComponent(
                                    `فاتورة ${storeName} #${ord.orderNumber}\nالإجمالي: ${ord.total} ${currency}\nشكراً لتسوقكم من ${storeName}`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="إرسال الفاتورة عبر واتساب"
                                  className="min-h-[40px] min-w-[40px] bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] p-2 rounded-xl flex items-center justify-center transition"
                                >
                                  <MessageCircle className="w-4 h-4 text-[#3B6E4C]" />
                                </a>
                              )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Order Details Row */}
                      {isExpanded && (
                        <tr className="bg-[#FAF6F0]/60">
                          <td
                            colSpan={canSeeProfits ? 10 : 9}
                            className="p-4 border-b border-[#E8E0D5]"
                          >
                            <div className="bg-white rounded-2xl p-3.5 border border-[#E8E0D5] space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E0D5] pb-2">
                                <span className="font-cairo font-bold text-xs text-[#231710]">
                                  تفصيل أصناف الفاتورة #{ord.orderNumber} • الكاشير:{' '}
                                  {ord.cashierName || 'كاشير الفرع'}
                                  {ord.registerName ? ` • ${ord.registerName}` : ''}
                                </span>
                                <span className="text-[11px] text-[#6B5B4E]">
                                  {ord.address}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {ord.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-[#FAF6F0] rounded-xl p-2.5 border border-[#E8E0D5] space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-cairo font-bold text-xs text-[#231710]">
                                        {item.quantity}× {item.productName}
                                      </span>
                                      <span className="font-cairo font-bold text-xs text-[#231710]">
                                        {item.unitPrice * item.quantity} ج.م
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-[#6B5B4E]">
                                      {item.weightLabel} • {item.roastOption}
                                    </p>
                                    {item.isPartitionedBox &&
                                      item.partitionedSlots && (
                                        <p className="text-[11px] text-[#9A6836] font-bold">
                                          الخانات:{' '}
                                          {item.partitionedSlots
                                            .map(
                                              (s) =>
                                                `${s.productName} (${
                                                  s.slotGrams || s.weightGrams
                                                }ج)`
                                            )
                                            .join(' + ')}
                                        </p>
                                      )}
                                    {item.isCoffeeBlend && item.coffeeBlendSpec && (
                                      <p className="text-[11px] text-[#9A6836] font-bold">
                                        {item.coffeeBlendSpec.baristaLabel}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* PARTIAL & FULL POS RETURN MODAL (مرتجع مبيعات جزئي أو كلي)          */}
      {/* =================================================================== */}
      {returnTargetOrder && onCreateReturn && (() => {
        const maxOrderRefund = Math.max(
          0,
          Math.round((returnTargetOrder.total - (returnTargetOrder.returnedAmountTotal || 0)) * 100) / 100
        );
        const netOrderGoods = Math.max(
          0,
          (returnTargetOrder.total || 0) - (returnTargetOrder.shippingCost || 0)
        );
        const prorationRatio =
          returnTargetOrder.subtotal > 0
            ? Math.min(1, Math.max(0, netOrderGoods / returnTargetOrder.subtotal))
            : 1;
        const rawDraftRefund = Math.round(
          returnDraftRows.reduce(
            (sum, r) => sum + r.returnQty * r.unitPrice * prorationRatio,
            0
          ) * 100
        ) / 100;
        const effectiveRefund = Math.min(maxOrderRefund, rawDraftRefund);

        return (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 border border-[#E8E0D5] shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
                <div>
                  <h3 className="font-cairo font-bold text-base text-[#231710] flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-[#B83B2B]" />
                    <span>مرتجع فاتورة مبيعات #{returnTargetOrder.orderNumber}</span>
                  </h3>
                  <p className="text-xs text-[#6B5B4E] tabular-nums">
                    إجمالي الفاتورة: {returnTargetOrder.total} ج.م • المتاح للاسترداد: {maxOrderRefund} ج.م
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReturnTargetOrder(null)}
                  className="w-10 h-10 rounded-xl bg-[#FAF6F0] hover:bg-red-50 text-[#231710] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Select All / Clear All helper */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-cairo font-bold text-[#231710]">
                  حدد الأصناف والكميات وحالة الصنف المرتجع:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setReturnDraftRows((prev) =>
                        prev.map((r) => ({ ...r, returnQty: r.soldQty }))
                      )
                    }
                    className="min-h-[38px] bg-[#FAF6F0] hover:bg-[#231710] hover:text-white border border-[#E8E0D5] px-3 py-1.5 rounded-lg font-cairo font-bold text-[11px] cursor-pointer transition"
                  >
                    استرجاع كامل الفاتورة
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReturnDraftRows((prev) =>
                        prev.map((r) => ({ ...r, returnQty: 0 }))
                      )
                    }
                    className="min-h-[38px] px-2.5 text-[11px] text-[#6B5B4E] hover:text-[#231710] font-bold cursor-pointer"
                  >
                    تصفير
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {returnDraftRows.map((row, idx) => (
                  <div
                    key={row.key}
                    className={`rounded-xl p-3 border transition ${
                      row.returnQty > 0
                        ? 'bg-rose-50/40 border-rose-200'
                        : 'bg-[#FAF6F0] border-[#E8E0D5]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-cairo font-bold text-xs text-[#231710]">
                          {row.productName}{' '}
                          {row.unitLabel ? (
                            <span className="text-[#6B5B4E] font-medium">({row.unitLabel})</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-[#6B5B4E] tabular-nums">
                          المباع: {row.soldQty} • سعر الوحدة: {row.unitPrice} ج.م
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Quantity Input */}
                        <div className="min-h-[40px] flex items-center gap-1 bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1">
                          <span className="text-[11px] text-[#6B5B4E]">الكمية المرتجعة:</span>
                          <input
                            type="number"
                            min={0}
                            max={row.soldQty}
                            step="1"
                            value={row.returnQty}
                            onChange={(e) => {
                              const val = Math.min(
                                row.soldQty,
                                Math.max(0, Number(e.target.value) || 0)
                              );
                              setReturnDraftRows((prev) =>
                                prev.map((r, rIdx) =>
                                  rIdx === idx ? { ...r, returnQty: val } : r
                                )
                              );
                            }}
                            className="w-14 text-center font-bold text-xs tabular-nums outline-none"
                          />
                        </div>

                        {/* Condition Toggle: Restock vs Damaged */}
                        <select
                          value={row.condition}
                          onChange={(e) => {
                            const cond = e.target.value as 'restock' | 'damaged';
                            setReturnDraftRows((prev) =>
                              prev.map((r, rIdx) =>
                                rIdx === idx ? { ...r, condition: cond } : r
                              )
                            );
                          }}
                          className={`min-h-[40px] rounded-xl px-2.5 py-1.5 text-[11px] font-cairo font-bold border outline-none ${
                            row.condition === 'restock'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-red-50 text-[#B83B2B] border-red-200'
                          }`}
                        >
                          <option value="restock">سليم (يعود للمخزن)</option>
                          <option value="damaged">تالف / هالك (لا يعود للمخزن)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Refund Method & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-cairo font-bold text-[#231710] mb-1">
                    طريقة رد المبلغ للعميل:
                  </label>
                  <select
                    value={returnRefundMethod}
                    onChange={(e) =>
                      setReturnRefundMethod(
                        e.target.value as PosReturnRecord['refundMethod']
                      )
                    }
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
                  >
                    <option value="cash">رد نقداً من درج الكاشير النشط</option>
                    <option value="vip_wallet">إضافة رصيد في محفظة العميل VIP</option>
                    <option value="credit_deduction">خصم من مديونية العميل الآجلة</option>
                    <option value="original_electronic">رد إلكتروني (فيزا / محفظة / إنستاباي)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-cairo font-bold text-[#231710] mb-1">
                    سبب المرتجع (اختياري):
                  </label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="مثال: استبدال صنف / رغبة العميل..."
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-medium outline-none"
                  />
                </div>
              </div>

              {returnRefundMethod === 'vip_wallet' && (
                <div>
                  <label className="block text-xs font-cairo font-bold text-[#231710] mb-1">
                    رقم موبايل العميل لإضافة رصيد المرتجع بالمحفظة:
                  </label>
                  <input
                    type="tel"
                    value={returnCustomerPhone}
                    onChange={(e) => setReturnCustomerPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold tabular-nums outline-none"
                  />
                </div>
              )}

              {/* Summary & Submit */}
              <div className="bg-[#FAF6F0] rounded-2xl p-3.5 border border-[#E8E0D5] flex items-center justify-between">
                <div className="text-xs text-[#6B5B4E]">
                  <span className="flex items-center gap-1 font-bold text-[#231710]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#9A6836]" />
                    <span>سيتم تحديث المخزن والدرج وإصدار بون مرتجع رسمي فوراً</span>
                  </span>
                </div>
                <div className="text-left tabular-nums">
                  <span className="text-[11px] text-[#6B5B4E] block">إجمالي المبلغ المسترد</span>
                  <span className="font-cairo font-bold text-xl text-[#B83B2B]">
                    {effectiveRefund} ج.م
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={returnSubmitting || effectiveRefund <= 0}
                onClick={async () => {
                  const netOrderGoods = Math.max(
                    0,
                    (returnTargetOrder.total || 0) - (returnTargetOrder.shippingCost || 0)
                  );
                  const prorationRatio =
                    returnTargetOrder.subtotal > 0
                      ? Math.min(1, Math.max(0, netOrderGoods / returnTargetOrder.subtotal))
                      : 1;
                  const selectedItems: PosReturnItem[] = returnDraftRows
                    .filter((r) => r.returnQty > 0)
                    .map((r) => ({
                      cartItemId: r.cartItemId,
                      productId: r.productId,
                      productName: r.productName,
                      returnQty: r.returnQty,
                      weightGrams: r.weightGrams,
                      unitLabel: r.unitLabel,
                      refundAmount:
                        Math.round(r.returnQty * r.unitPrice * prorationRatio * 100) / 100,
                      condition: r.condition,
                    }));
                  if (selectedItems.length === 0) return;

                  setReturnSubmitting(true);
                  const created = await onCreateReturn({
                    orderId: returnTargetOrder.id,
                    items: selectedItems,
                    refundMethod: returnRefundMethod,
                    reason: returnReason.trim() || undefined,
                    customerPhone: returnCustomerPhone.trim() || undefined,
                  });
                  setReturnSubmitting(false);

                  if (created) {
                    setReturnTargetOrder(null);
                    onPrintReturnReceipt?.(created);
                  }
                }}
                className="w-full min-h-[44px] bg-[#B83B2B] hover:bg-[#9e3123] disabled:opacity-40 text-white font-cairo font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {returnSubmitting
                    ? 'جارٍ اعتماد المرتجع...'
                    : `تأكيد المرتجع وطباعة إيصال الاسترداد (${effectiveRefund} ج.م)`}
                </span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
