'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Order, PosShift } from '@/types/store';
import { formatWhatsAppPhone } from '@/lib/validation';

interface PosInvoicesTablePageProps {
  recentPosOrders: Order[];
  onlineQueueOrders: Order[];
  posShifts: PosShift[];
  activeShift: PosShift | null;
  canSeeProfits: boolean;
  onReprintOrder: (order: Order) => void;
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

export default function PosInvoicesTablePage({
  recentPosOrders,
  onlineQueueOrders,
  posShifts,
  activeShift,
  canSeeProfits,
  onReprintOrder,
  onRefresh,
  sourceFilter: externalSourceFilter,
  onChangeSourceFilter,
}: PosInvoicesTablePageProps) {
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
        o.orderSource === 'pos' || o.orderNumber.startsWith('POS-')
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

      {/* 2. Search, Filters & CSV Export Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#9A6836]" />
            <h2 className="font-cairo font-bold text-base text-[#231710]">
              جدول الفواتير وسجل المبيعات التفصيلي
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="bg-[#231710] hover:bg-[#3A271C] text-white px-3.5 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير جدول الفواتير (CSV)</span>
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
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl pr-9 pl-3 py-2 text-xs font-medium outline-none"
            />
          </div>

          {/* Order Type Filter */}
          <div className="lg:col-span-3">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
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
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="cod">نقدي (كاش)</option>
              <option value="card">فيزا الفرع</option>
              <option value="vodafone_cash">فودافون كاش</option>
              <option value="instapay">إنستاباي</option>
              <option value="vip_wallet">محفظة VIP</option>
            </select>
          </div>

          {/* Shift Filter */}
          <div className="lg:col-span-3">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
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

                  const orderTypeBadge = isPos
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
                            : 'محفظة VIP';

                  return (
                    <React.Fragment key={ord.id}>
                      <tr
                        className={`transition hover:bg-[#FAF6F0] ${
                          isExpanded ? 'bg-[#FAF6F0]' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-cairo font-bold text-[#231710]">
                          <span className="inline-block bg-[#FAF6F0] border border-[#E8E0D5] px-2.5 py-1 rounded-lg">
                            {ord.orderNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#6B5B4E]">
                          <div className="font-bold text-[#231710]">
                            {new Date(ord.createdAt).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-[10.5px]">
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
                            <div className="text-[10.5px] text-[#6B5B4E]">
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
                            className="inline-flex items-center gap-1 bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#E8E0D5] text-[#231710] px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer"
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
                            <div className="text-[10px] text-[#B83B2B] font-bold">
                              خصم: -{(ord.discountAmount || 0) + (ord.vipWalletRedeemed || 0)} ج
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-cairo font-bold text-sm text-[#231710]">
                            {ord.total} ج.م
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#231710]">{pmBadge}</div>
                          {ord.paymentMethod === 'cod' &&
                            ord.cashTendered !== undefined &&
                            ord.changeDue !== undefined &&
                            ord.changeDue > 0 && (
                              <div className="text-[10px] text-[#6B5B4E]">
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
                                  <span className="text-[10px] text-[#6B5B4E]">
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
                              className="bg-[#231710] hover:bg-[#3A271C] text-white px-2.5 py-1.5 rounded-xl text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>طباعة بون</span>
                            </button>

                            {ord.customerPhone &&
                              ord.customerPhone !== '01000000000' && (
                                <a
                                  href={`https://wa.me/${formatWhatsAppPhone(
                                    ord.customerPhone
                                  )}?text=${encodeURIComponent(
                                    `فاتورة محمصة حفصة #${ord.orderNumber}\nالإجمالي: ${ord.total} ج.م\nشكراً لتسوقكم من محمصة حفصة`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="إرسال الفاتورة عبر واتساب"
                                  className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] p-1.5 rounded-xl transition"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-[#3B6E4C]" />
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
                                    <p className="text-[10.5px] text-[#6B5B4E]">
                                      {item.weightLabel} • {item.roastOption}
                                    </p>
                                    {item.isPartitionedBox &&
                                      item.partitionedSlots && (
                                        <p className="text-[10px] text-[#9A6836] font-bold">
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
                                      <p className="text-[10px] text-[#9A6836] font-bold">
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
    </div>
  );
}
