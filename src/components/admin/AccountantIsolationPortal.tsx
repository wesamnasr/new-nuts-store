'use client';

import React, { useMemo, useState } from 'react';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Receipt,
  Wallet,
  Crown,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowUpRight,
  Clock,
  Store,
  Calendar,
  Truck,
  FileText,
  Printer,
  BarChart3,
  Layers,
  X,
  Search,
  Filter,
  RotateCcw,
  ExternalLink,
  ShoppingBag,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import {
  Coupon,
  Order,
  PosExpense,
  PosShift,
  Product,
  SupplyInvoice,
  VipMember,
} from '@/types/store';
import {
  calculateFinancialSummary,
  DateRangePreset,
  FinancialDateRangeFilter,
  filterItemsByDateRange,
  generateFinancialSummaryCsv,
  generateShiftsAuditCsv,
  generateExpensesLedgerCsv,
  generateSupplyLedgerCsv,
} from '@/lib/financials';
import { generateOrdersCsv } from '@/lib/csv';
import {
  updateUrlQueryParams,
  buildUrlWithParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';

export type AccountantReportSubTab =
  | 'daily_income'
  | 'channels'
  | 'shifts'
  | 'supply'
  | 'expenses'
  | 'margins';

interface AccountantIsolationPortalProps {
  products: Product[];
  orders: Order[];
  posShifts: PosShift[];
  posExpenses: PosExpense[];
  coupons?: Coupon[];
  vipMembers: VipMember[];
  supplyInvoices?: SupplyInvoice[];
  settings?: any;
  onExportCsv?: () => void;
  onExportOrdersCsv?: () => void;
  onOpenOrdersTab?: () => void;
  onOpenSupplyInvoicesTab?: () => void;
  onOpenOperationsTab?: () => void;
  onOpenProductsTab?: () => void;
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  raw_materials: 'خامات وتوريدات',
  packaging: 'أكياس وعبوات تغليف',
  utilities: 'كهرباء ومرافق وغاز',
  delivery_rider: 'طيارين وتوصيل طلبات',
  other: 'مصروفات تشغيلية أخرى',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'نقدي / كاش وعند الاستلام',
  cash: 'نقدي بالدرج (Cash)',
  instapay: 'إنستا باي (InstaPay)',
  vodafone_cash: 'فودافون كاش',
  vip_wallet: 'محفظة VIP',
};

const VALID_SUBTABS: AccountantReportSubTab[] = [
  'daily_income',
  'channels',
  'shifts',
  'supply',
  'expenses',
  'margins',
];

export default function AccountantIsolationPortal({
  products,
  orders,
  posShifts,
  posExpenses,
  vipMembers,
  supplyInvoices = [],
  onExportCsv,
  onExportOrdersCsv,
  onOpenOrdersTab,
  onOpenSupplyInvoicesTab,
  onOpenOperationsTab,
  onOpenProductsTab,
}: AccountantIsolationPortalProps) {
  // Primary Report Sub-Tab (Daily Income is first tab inside Reports)
  const [activeSubTab, setActiveSubTab] = useState<AccountantReportSubTab>('daily_income');

  // Filter States
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'pos' | 'online'>('all');
  const [paymentFilter, setPaymentFilter] = useState<
    'all' | 'cod' | 'instapay' | 'vodafone_cash' | 'vip_wallet'
  >('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'completed' | 'pending' | 'cancelled'
  >('all');
  const [marginTierFilter, setMarginTierFilter] = useState<'all' | 'high' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Printable Z-Report Modal
  const [selectedShiftForZReport, setSelectedShiftForZReport] = useState<PosShift | null>(null);

  useBrowserUrlSync((params) => {
    const sub = params.get('subtab') as AccountantReportSubTab | null;
    if (sub && VALID_SUBTABS.includes(sub)) {
      setActiveSubTab(sub);
    } else if (!sub) {
      setActiveSubTab('daily_income');
    }

    const rng = params.get('range');
    if (rng && ['all', 'today', 'this_week', 'this_month', 'custom'].includes(rng)) {
      setDatePreset(rng as DateRangePreset);
    } else if (!rng) {
      setDatePreset('all');
    }

    const ch = params.get('channel');
    if (ch && ['all', 'pos', 'online'].includes(ch)) {
      setChannelFilter(ch as 'all' | 'pos' | 'online');
    } else if (!ch) {
      setChannelFilter('all');
    }

    const pm = params.get('pay');
    if (pm && ['all', 'cod', 'instapay', 'vodafone_cash', 'vip_wallet'].includes(pm)) {
      setPaymentFilter(pm as any);
    } else if (!pm) {
      setPaymentFilter('all');
    }

    const zParam = params.get('zreport');
    if (zParam && posShifts.length > 0) {
      const found = posShifts.find((s) => s.id === zParam || s.shiftNumber === zParam);
      if (found) setSelectedShiftForZReport(found);
    } else if (!zParam) {
      setSelectedShiftForZReport(null);
    }
  });

  const dateFilter: FinancialDateRangeFilter = useMemo(
    () => ({
      preset: datePreset,
      startDate: datePreset === 'custom' ? customStart : undefined,
      endDate: datePreset === 'custom' ? customEnd : undefined,
    }),
    [datePreset, customStart, customEnd]
  );

  // Date-filtered base collections
  const dateFilteredOrders = useMemo(
    () => filterItemsByDateRange(orders, dateFilter),
    [orders, dateFilter]
  );
  const dateFilteredShifts = useMemo(
    () => filterItemsByDateRange(posShifts, dateFilter),
    [posShifts, dateFilter]
  );
  const dateFilteredExpenses = useMemo(
    () => filterItemsByDateRange(posExpenses, dateFilter),
    [posExpenses, dateFilter]
  );
  const dateFilteredSupplyInvoices = useMemo(
    () => filterItemsByDateRange(supplyInvoices, dateFilter),
    [supplyInvoices, dateFilter]
  );

  // Apply Multi-Criteria Accountant Filters (Channel, Payment Method, Status, Search)
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dateFilteredOrders.filter((ord) => {
      const isPos = ord.orderSource === 'pos' || ord.orderNumber?.startsWith('POS-');
      if (channelFilter === 'pos' && !isPos) return false;
      if (channelFilter === 'online' && isPos) return false;

      if (paymentFilter !== 'all') {
        const pm = (ord.paymentMethod as string) === 'cash' ? 'cod' : ord.paymentMethod;
        if (pm !== paymentFilter) return false;
      }

      if (statusFilter === 'completed' && ord.status !== 'delivered' && !isPos) return false;
      if (
        statusFilter === 'pending' &&
        (ord.status === 'delivered' || ord.status === 'cancelled')
      ) {
        return false;
      }
      if (statusFilter === 'cancelled' && ord.status !== 'cancelled') return false;

      if (q) {
        const match =
          (ord.orderNumber || '').toLowerCase().includes(q) ||
          (ord.customerName || '').toLowerCase().includes(q) ||
          (ord.customerPhone || '').includes(q) ||
          (ord.governorate || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [dateFilteredOrders, channelFilter, paymentFilter, statusFilter, searchQuery]);

  const filteredShifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dateFilteredShifts.filter((sh) => {
      if (statusFilter === 'completed' && sh.status !== 'closed') return false;
      if (statusFilter === 'pending' && sh.status !== 'open') return false;
      if (q) {
        const match =
          (sh.shiftNumber || '').toLowerCase().includes(q) ||
          (sh.cashierName || '').toLowerCase().includes(q) ||
          (sh.shiftPeriod || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [dateFilteredShifts, statusFilter, searchQuery]);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dateFilteredExpenses.filter((exp) => {
      if (q) {
        const match =
          (exp.title || '').toLowerCase().includes(q) ||
          (exp.category || '').toLowerCase().includes(q) ||
          (exp.notes || '').toLowerCase().includes(q) ||
          (exp.shiftId || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [dateFilteredExpenses, searchQuery]);

  const filteredSupplyInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dateFilteredSupplyInvoices.filter((inv) => {
      if (statusFilter === 'completed' && inv.status !== 'approved') return false;
      if (statusFilter === 'pending' && inv.status !== 'pending') return false;
      if (statusFilter === 'cancelled' && inv.status !== 'rejected') return false;
      if (q) {
        const match =
          (inv.invoiceNumber || '').toLowerCase().includes(q) ||
          (inv.supplierName || '').toLowerCase().includes(q) ||
          (inv.notes || '').toLowerCase().includes(q) ||
          inv.items.some((it) => it.productName.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [dateFilteredSupplyInvoices, statusFilter, searchQuery]);

  // Overall Financial Summary computed on filtered dataset
  const report = useMemo(() => {
    return calculateFinancialSummary({
      orders: filteredOrders,
      products,
      posShifts: filteredShifts,
      posExpenses: filteredExpenses,
      supplyInvoices: filteredSupplyInvoices,
      vipMembers,
      dateFilter: { preset: 'all' },
    });
  }, [
    filteredOrders,
    products,
    filteredShifts,
    filteredExpenses,
    filteredSupplyInvoices,
    vipMembers,
  ]);

  // Daily Income Cards Aggregation (Group by Date YYYY-MM-DD)
  const dailyIncomeCards = useMemo(() => {
    const dayMap = new Map<
      string,
      {
        dateKey: string;
        dateLabel: string;
        totalRevenue: number;
        onlineRevenue: number;
        posRevenue: number;
        cashRevenue: number;
        digitalRevenue: number;
        cogs: number;
        expenses: number;
        supplyApproved: number;
        ordersCount: number;
        onlineCount: number;
        posCount: number;
      }
    >();

    const ensureDay = (isoStr: string) => {
      const d = new Date(isoStr);
      const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
      const dateKey = safeDate.toISOString().slice(0, 10);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          dateKey,
          dateLabel: safeDate.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          totalRevenue: 0,
          onlineRevenue: 0,
          posRevenue: 0,
          cashRevenue: 0,
          digitalRevenue: 0,
          cogs: 0,
          expenses: 0,
          supplyApproved: 0,
          ordersCount: 0,
          onlineCount: 0,
          posCount: 0,
        });
      }
      return dayMap.get(dateKey)!;
    };

    for (const ord of filteredOrders) {
      if (ord.status === 'cancelled') continue;
      const bucket = ensureDay(ord.createdAt);
      const isPos = ord.orderSource === 'pos' || ord.orderNumber?.startsWith('POS-');
      const amt = Number(ord.total) || 0;
      const cost = Number(ord.rawCostTotal) || Math.round(amt * 0.68);
      bucket.totalRevenue += amt;
      bucket.cogs += cost;
      bucket.ordersCount += 1;
      if (isPos) {
        bucket.posRevenue += amt;
        bucket.posCount += 1;
      } else {
        bucket.onlineRevenue += amt;
        bucket.onlineCount += 1;
      }
      if (ord.paymentMethod === 'instapay' || ord.paymentMethod === 'vodafone_cash') {
        bucket.digitalRevenue += amt;
      } else {
        bucket.cashRevenue += amt;
      }
    }

    for (const exp of filteredExpenses) {
      const bucket = ensureDay(exp.createdAt);
      bucket.expenses += Number(exp.amount) || 0;
    }

    for (const inv of filteredSupplyInvoices) {
      if (inv.status === 'approved') {
        const bucket = ensureDay(inv.createdAt);
        bucket.supplyApproved += Number(inv.totalAmount) || 0;
      }
    }

    return Array.from(dayMap.values())
      .map((d) => {
        const grossProfit = d.totalRevenue - d.cogs;
        const netProfit = grossProfit - d.expenses;
        return {
          ...d,
          grossProfit,
          netProfit,
        };
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredOrders, filteredExpenses, filteredSupplyInvoices]);

  // Today's Snapshot Card Metrics
  const todaySnapshot = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayCard = dailyIncomeCards.find((d) => d.dateKey === todayKey);
    const openShift = posShifts.find((s) => s.status === 'open') || null;
    return {
      revenue: todayCard?.totalRevenue || 0,
      posRevenue: todayCard?.posRevenue || 0,
      onlineRevenue: todayCard?.onlineRevenue || 0,
      expenses: todayCard?.expenses || 0,
      netProfit: todayCard?.netProfit || 0,
      ordersCount: todayCard?.ordersCount || 0,
      drawerCash: openShift?.expectedCashInDrawer || 0,
      hasOpenShift: Boolean(openShift),
    };
  }, [dailyIncomeCards, posShifts]);

  const paymentBreakdown = useMemo(() => {
    let cod = 0;
    let instapay = 0;
    let vodafone_cash = 0;
    let vip_wallet = 0;
    let codCount = 0;
    let instapayCount = 0;
    let vodafoneCount = 0;
    let vipCount = 0;
    for (const o of filteredOrders) {
      if (o.status === 'cancelled') continue;
      const amt = o.total || 0;
      if (o.paymentMethod === 'instapay') {
        instapay += amt;
        instapayCount += 1;
      } else if (o.paymentMethod === 'vodafone_cash') {
        vodafone_cash += amt;
        vodafoneCount += 1;
      } else if (o.paymentMethod === 'vip_wallet') {
        vip_wallet += amt;
        vipCount += 1;
      } else {
        cod += amt;
        codCount += 1;
      }
    }
    return {
      cod,
      instapay,
      vodafone_cash,
      vip_wallet,
      codCount,
      instapayCount,
      vodafoneCount,
      vipCount,
    };
  }, [filteredOrders]);

  const expenseCategoryCards = useMemo(() => {
    const map: Record<string, { category: string; label: string; total: number; count: number }> =
      {};
    for (const exp of filteredExpenses) {
      const cat = exp.category || 'other';
      if (!map[cat]) {
        map[cat] = {
          category: cat,
          label: EXPENSE_CATEGORY_LABELS[cat] || cat,
          total: 0,
          count: 0,
        };
      }
      map[cat].total += Number(exp.amount) || 0;
      map[cat].count += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const productMarginAnalytics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .map((p) => {
        const retail = p.pricePerKg || 0;
        const cost = p.costPerKg || 0;
        const pkg = p.packagingCost || 0;
        const totalUnitCost = cost + pkg;
        const netPerKg = retail - totalUnitCost;
        const marginPct = retail > 0 ? Math.round((netPerKg / retail) * 100) : 0;
        return {
          ...p,
          totalUnitCost,
          netPerKg,
          marginPct,
        };
      })
      .filter((p) => {
        if (marginTierFilter === 'high' && p.marginPct < 22) return false;
        if (marginTierFilter === 'low' && p.marginPct >= 22) return false;
        if (q) {
          return (
            p.name.toLowerCase().includes(q) ||
            (p.origin || '').toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [products, marginTierFilter, searchQuery]);

  const downloadBlobCsv = (csvContent: string, filenamePrefix: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAllFilters = () => {
    setDatePreset('all');
    setCustomStart('');
    setCustomEnd('');
    setChannelFilter('all');
    setPaymentFilter('all');
    setStatusFilter('all');
    setMarginTierFilter('all');
    setSearchQuery('');
    updateUrlQueryParams({ range: null, channel: null, pay: null });
  };

  const hasActiveFilters =
    datePreset !== 'all' ||
    channelFilter !== 'all' ||
    paymentFilter !== 'all' ||
    statusFilter !== 'all' ||
    marginTierFilter !== 'all' ||
    Boolean(searchQuery.trim());

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ===================================================================== */}
      {/* TOP HEADER BANNER + QUICK LINKS & EXCEL EXPORTS                       */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-l from-indigo-950 via-brand-900 to-brand-950 rounded-3xl p-5 md:p-6 text-white shadow-xl border border-indigo-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 text-[11px] font-black">
              <Calculator className="w-3.5 h-3.5" />
              <span>مركز التقارير المالية والدخل اليومي والرقابة المحاسبية</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black">
              بطاقات التقارير المالية الشاملة والدخل اليومي
            </h2>
          </div>

          {/* Export & Quick Jump Links */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadBlobCsv(generateFinancialSummaryCsv(report), 'hafsa-financial-summary')
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ملخص الأرباح (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (onExportCsv) onExportCsv();
                else if (onExportOrdersCsv) onExportOrdersCsv();
                else downloadBlobCsv(generateOrdersCsv(filteredOrders), 'hafsa-orders-audit');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs shadow transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير الفواتير (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlobCsv(generateShiftsAuditCsv(filteredShifts), 'hafsa-shifts-zreport')
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-xs shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير الورديات (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlobCsv(
                  generateSupplyLedgerCsv(filteredSupplyInvoices),
                  'hafsa-supply-invoices'
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black text-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير المشتريات (CSV)</span>
            </button>
          </div>
        </div>

        {/* Accountant Quick Navigation Shortcuts Row */}
        {(onOpenOrdersTab ||
          onOpenSupplyInvoicesTab ||
          onOpenOperationsTab ||
          onOpenProductsTab) && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3.5 border-t border-white/10">
            <span className="text-[11px] font-bold text-indigo-200 ml-1">
              🔗 انتقال سريع للسجلات:
            </span>
            {onOpenOrdersTab && (
              <button
                type="button"
                onClick={onOpenOrdersTab}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-gold-400" />
                <span>سجل فواتير المبيعات والكاشير ({orders.length})</span>
                <ExternalLink className="w-3 h-3 opacity-75" />
              </button>
            )}
            {onOpenSupplyInvoicesTab && (
              <button
                type="button"
                onClick={onOpenSupplyInvoicesTab}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>فواتير الشراء والتوريد ({supplyInvoices.length})</span>
                <ExternalLink className="w-3 h-3 opacity-75" />
              </button>
            )}
            {onOpenOperationsTab && (
              <button
                type="button"
                onClick={onOpenOperationsTab}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>الورديات والمصروفات والـ VIP</span>
                <ExternalLink className="w-3 h-3 opacity-75" />
              </button>
            )}
            {onOpenProductsTab && (
              <button
                type="button"
                onClick={onOpenProductsTab}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-sky-400" />
                <span>الأصناف والتكاليف والأسعار ({products.length})</span>
                <ExternalLink className="w-3 h-3 opacity-75" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* UNIFIED MULTI-CRITERIA ACCOUNTANT FILTER SUITE                        */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-sm space-y-3.5">
        {/* Row 1: Date Range Preset Pills + Custom Date Picker + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-brand-950 font-black text-xs ml-1">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>الفترة الزمنية:</span>
            </div>
            {(
              [
                { id: 'all', label: 'كل الفترات' },
                { id: 'today', label: 'اليوم' },
                { id: 'this_week', label: 'آخر 7 أيام' },
                { id: 'this_month', label: 'هذا الشهر' },
                { id: 'custom', label: 'تخصيص فترة' },
              ] as { id: DateRangePreset; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setDatePreset(p.id);
                  updateUrlQueryParams({ range: p.id === 'all' ? null : p.id });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-brand-50 text-brand-800 hover:bg-brand-100 border border-brand-200/70'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>

        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-100">
            <span className="text-xs font-bold text-brand-700">من تاريخ:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-brand-200 bg-brand-50 text-xs font-bold"
            />
            <span className="text-xs font-bold text-brand-700">إلى تاريخ:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-brand-200 bg-brand-50 text-xs font-bold"
            />
          </div>
        )}

        {/* Row 2: Search + Channel Filter + Payment Filter + Status Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 border-t border-brand-100">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم فاتورة، عميل، كاشير، مورد، صنف..."
              className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-8 pl-3 py-2 text-xs font-bold text-brand-950 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {/* Channel Filter */}
          <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-brand-600 shrink-0">القناة:</span>
            <select
              value={channelFilter}
              onChange={(e) => {
                const next = e.target.value as 'all' | 'pos' | 'online';
                setChannelFilter(next);
                updateUrlQueryParams({ channel: next === 'all' ? null : next });
              }}
              className="w-full bg-transparent text-xs font-black text-brand-950 focus:outline-none"
            >
              <option value="all">كل القنوات (الأونلاين + الكاشير)</option>
              <option value="pos">كاشير الفرع (POS) فقط</option>
              <option value="online">المتجر الأونلاين فقط</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-brand-600 shrink-0">الدفع:</span>
            <select
              value={paymentFilter}
              onChange={(e) => {
                const next = e.target.value as any;
                setPaymentFilter(next);
                updateUrlQueryParams({ pay: next === 'all' ? null : next });
              }}
              className="w-full bg-transparent text-xs font-black text-brand-950 focus:outline-none"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="cod">نقدي بالدرج وعند الاستلام</option>
              <option value="instapay">تحويل إنستا باي (InstaPay)</option>
              <option value="vodafone_cash">فودافون كاش</option>
              <option value="vip_wallet">محفظة نقاط VIP</option>
            </select>
          </div>

          {/* Status / Margin Filter */}
          {activeSubTab === 'margins' ? (
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-brand-600 shrink-0">الهامش:</span>
              <select
                value={marginTierFilter}
                onChange={(e) => setMarginTierFilter(e.target.value as any)}
                className="w-full bg-transparent text-xs font-black text-brand-950 focus:outline-none"
              >
                <option value="all">كل مستويات الربحية</option>
                <option value="high">ربحية مرتفعة (22% فأكثر)</option>
                <option value="low">ربحية منخفضة (أقل من 22%)</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-brand-600 shrink-0">الحالة:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-transparent text-xs font-black text-brand-950 focus:outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="completed">مكتملة / معتمدة / مغلقة</option>
                <option value="pending">جارية / معلقة / مفتوحة</option>
                <option value="cancelled">ملغاة / مرفوضة</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 7 EXECUTIVE FINANCIAL KPI CARDS                                       */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">إجمالي المبيعات</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-lg font-black text-brand-950">
            {report.totalRevenue.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            {report.onlineMetrics.orderCount + report.posMetrics.orderCount} فاتورة مبيعات
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">تكلفة البضاعة (COGS)</span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg font-black text-amber-700">
            {report.totalCogs.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">شامل الخامات والتغليف</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">مجمل الربح</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-black text-emerald-700">
            {report.grossProfit.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-emerald-600 mt-1 font-bold">
            هامش مجمل {report.grossMarginPercent}%
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">المصروفات التشغيلية</span>
            <Wallet className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg font-black text-rose-600">
            {report.operatingExpenses.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            {filteredExpenses.length} حركة مصروفات
          </p>
        </div>

        <div className="bg-emerald-950 text-white rounded-2xl p-4 border border-emerald-700 shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-200">صافي الربح النهائي</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-300">
            {report.netOperatingProfit.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-emerald-200/80 mt-1 font-bold">
            هامش صافي {report.netMarginPercent}%
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">مشتريات وتوريد معتمد</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg font-black text-brand-950">
            {report.supplyFinancials.approvedTotal.toLocaleString('ar-EG')}{' '}
            <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-amber-700 mt-1 font-bold">
            معلق: {report.supplyFinancials.pendingTotal.toLocaleString('ar-EG')} ج.م
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">رصيد محافظ VIP</span>
            <Crown className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-lg font-black text-purple-700">
            {report.vipLiabilities.totalPointsBalance.toLocaleString('ar-EG')}{' '}
            <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            {report.vipLiabilities.membersCount} عضو مسجل
          </p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* INTERNAL REPORT TABS BAR (INSIDE REPORTS SECTION)                     */}
      {/* ===================================================================== */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-brand-200 shadow-xs">
        {[
          {
            id: 'daily_income' as const,
            label: `الدخل اليومي والخزينة (${dailyIncomeCards.length} يوم)`,
            icon: Calendar,
          },
          {
            id: 'channels' as const,
            label: `كروت القنوات والفواتير (${filteredOrders.length})`,
            icon: BarChart3,
          },
          {
            id: 'shifts' as const,
            label: `كروت ورديات الكاشير (${filteredShifts.length})`,
            icon: Store,
          },
          {
            id: 'supply' as const,
            label: `كروت فواتير الشراء (${filteredSupplyInvoices.length})`,
            icon: Truck,
          },
          {
            id: 'expenses' as const,
            label: `كروت المصروفات (${filteredExpenses.length})`,
            icon: Wallet,
          },
          {
            id: 'margins' as const,
            label: `كروت ربحية الأصناف (${productMarginAnalytics.length})`,
            icon: Layers,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <a
              key={tab.id}
              href={buildUrlWithParams('/admin', {
                tab: 'accounting_portal',
                subtab: tab.id === 'daily_income' ? null : tab.id,
              })}
              onClick={(e) => {
                e.preventDefault();
                setActiveSubTab(tab.id);
                updateUrlQueryParams({
                  subtab: tab.id === 'daily_income' ? null : tab.id,
                });
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                isActive
                  ? 'bg-brand-950 text-gold-400 shadow-xs'
                  : 'text-brand-700 hover:bg-brand-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </a>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: DAILY INCOME & CASH FLOW CARDS (الدخل اليومي والخزينة)         */}
      {/* ===================================================================== */}
      {activeSubTab === 'daily_income' && (
        <div className="space-y-5">
          {/* Today's Live Treasury & Daily Income Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-brand-950 to-brand-900 text-white rounded-3xl p-5 border border-gold-500/30 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gold-400">📅 إيراد اليوم الحالي</span>
                <span className="text-[10px] font-bold bg-white/10 px-2.5 py-0.5 rounded-full">
                  {todaySnapshot.ordersCount} فاتورة اليوم
                </span>
              </div>
              <p className="text-2xl font-black text-white">
                {todaySnapshot.revenue.toLocaleString('ar-EG')} ج.م
              </p>
              <div className="flex items-center justify-between text-[11px] text-brand-200 pt-2 border-t border-white/10">
                <span>كاشير: {todaySnapshot.posRevenue.toLocaleString('ar-EG')} ج</span>
                <span>أونلاين: {todaySnapshot.onlineRevenue.toLocaleString('ar-EG')} ج</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-800">💵 النقدية الحالية بالدرج</span>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    todaySnapshot.hasOpenShift
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {todaySnapshot.hasOpenShift ? 'وردية مفتوحة' : 'الوردية مغلقة'}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700">
                {todaySnapshot.drawerCash.toLocaleString('ar-EG')} ج.م
              </p>
              <p className="text-[11px] text-brand-500 font-bold pt-2 border-t border-brand-100">
                إجمالي الكاش والمقبوضات: {paymentBreakdown.cod.toLocaleString('ar-EG')} ج.م
              </p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-indigo-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-800">📱 المحافظ والتحويلات</span>
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                  InstaPay + Vodafone
                </span>
              </div>
              <p className="text-2xl font-black text-indigo-700">
                {(paymentBreakdown.instapay + paymentBreakdown.vodafone_cash).toLocaleString(
                  'ar-EG'
                )}{' '}
                ج.م
              </p>
              <div className="flex items-center justify-between text-[11px] text-brand-600 font-bold pt-2 border-t border-brand-100">
                <span>إنستا باي: {paymentBreakdown.instapay.toLocaleString('ar-EG')} ج</span>
                <span>فودافون: {paymentBreakdown.vodafone_cash.toLocaleString('ar-EG')} ج</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900">📈 صافي دخل اليوم</span>
                <span className="text-[10px] font-black bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full">
                  مصروفات اليوم: {todaySnapshot.expenses} ج
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700">
                {todaySnapshot.netProfit.toLocaleString('ar-EG')} ج.م
              </p>
              <p className="text-[11px] text-brand-600 font-bold pt-2 border-t border-brand-100">
                بعد خصم تكلفة الخامات والمصروفات اليومية
              </p>
            </div>
          </div>

          {/* Day-by-Day Income Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-brand-950">
                بطاقات تقارير الدخل اليومي التفصيلية ({dailyIncomeCards.length} يوم)
              </h3>
            </div>

            {dailyIncomeCards.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
                لا توجد حركات مالية مسجلة مطابقة للفلاتر المحددة
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dailyIncomeCards.map((day) => (
                  <div
                    key={day.dateKey}
                    className="bg-white rounded-3xl p-5 border border-brand-200 shadow-xs hover:shadow-md transition space-y-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-brand-100 pb-3">
                      <div>
                        <span className="text-xs font-black text-brand-950 block">
                          {day.dateLabel}
                        </span>
                        <span className="text-[10.5px] font-mono text-brand-500">
                          {day.dateKey}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-brand-950 text-gold-400 text-[11px] font-black">
                        {day.ordersCount} فاتورة
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-2xl bg-brand-50/80 border border-brand-100">
                        <span className="text-[10.5px] text-brand-600 font-bold block">
                          إجمالي الدخل اليومي
                        </span>
                        <span className="text-sm font-black text-brand-950">
                          {day.totalRevenue.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                        <span className="text-[10.5px] text-emerald-700 font-bold block">
                          صافي الربح اليومي
                        </span>
                        <span className="text-sm font-black text-emerald-800">
                          {day.netProfit.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-bold text-brand-700">
                      <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-brand-50/50">
                        <span>⚖️ مبيعات الكاشير ({day.posCount}):</span>
                        <span className="font-black text-brand-950">
                          {day.posRevenue.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-indigo-50/50">
                        <span>🌐 مبيعات الأونلاين ({day.onlineCount}):</span>
                        <span className="font-black text-indigo-800">
                          {day.onlineRevenue.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-amber-50/50">
                        <span>📦 تكلفة الخامات (COGS):</span>
                        <span className="font-black text-amber-800">
                          {day.cogs.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-rose-50/50">
                        <span>💸 المصروفات اليومية:</span>
                        <span className="font-black text-rose-700">
                          {day.expenses.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold text-brand-600 pt-2 border-t border-brand-100">
                      <span>كاش: {day.cashRevenue.toLocaleString('ar-EG')} ج.م</span>
                      <span>إلكتروني: {day.digitalRevenue.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CHANNELS, PAYMENT METHODS & INVOICE AUDIT CARDS                */}
      {/* ===================================================================== */}
      {activeSubTab === 'channels' && (
        <div className="space-y-5">
          {/* Channels & Payment Methods Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-brand-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-brand-950 text-sm">
                  🌐 قناة المتجر الإلكتروني (Online)
                </h3>
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black">
                  {report.onlineMetrics.orderCount} طلب
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-100 text-center">
                <div className="p-2.5 rounded-2xl bg-brand-50">
                  <p className="text-[10.5px] text-brand-500 font-bold">الإيرادات</p>
                  <p className="text-xs sm:text-sm font-black text-brand-950">
                    {report.onlineMetrics.grossRevenue.toLocaleString('ar-EG')} ج
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50">
                  <p className="text-[10.5px] text-amber-700 font-bold">التكلفة</p>
                  <p className="text-xs sm:text-sm font-black text-amber-800">
                    {report.onlineMetrics.cogs.toLocaleString('ar-EG')} ج
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-emerald-50">
                  <p className="text-[10.5px] text-emerald-700 font-bold">مجمل الربح</p>
                  <p className="text-xs sm:text-sm font-black text-emerald-700">
                    {report.onlineMetrics.grossProfit.toLocaleString('ar-EG')} ج
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-brand-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-brand-950 text-sm">
                  ⚖️ قناة كاشير الفرع (POS)
                </h3>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black">
                  {report.posMetrics.orderCount} فاتورة
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-100 text-center">
                <div className="p-2.5 rounded-2xl bg-brand-50">
                  <p className="text-[10.5px] text-brand-500 font-bold">الإيرادات</p>
                  <p className="text-xs sm:text-sm font-black text-brand-950">
                    {report.posMetrics.grossRevenue.toLocaleString('ar-EG')} ج
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50">
                  <p className="text-[10.5px] text-amber-700 font-bold">التكلفة</p>
                  <p className="text-xs sm:text-sm font-black text-amber-800">
                    {report.posMetrics.cogs.toLocaleString('ar-EG')} ج
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-emerald-50">
                  <p className="text-[10.5px] text-emerald-700 font-bold">مجمل الربح</p>
                  <p className="text-xs sm:text-sm font-black text-emerald-700">
                    {report.posMetrics.grossProfit.toLocaleString('ar-EG')} ج
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-brand-200 shadow-xs space-y-2.5">
              <h3 className="font-black text-brand-950 text-sm">💳 كروت طرق التحصيل والدفع</h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <div className="p-2 rounded-xl bg-brand-50 border border-brand-100">
                  <span className="text-[10px] text-brand-500 block">
                    نقدي وعند الاستلام ({paymentBreakdown.codCount})
                  </span>
                  <span className="font-black text-brand-950">
                    {paymentBreakdown.cod.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                  <span className="text-[10px] text-indigo-600 block">
                    إنستا باي ({paymentBreakdown.instapayCount})
                  </span>
                  <span className="font-black text-indigo-800">
                    {paymentBreakdown.instapay.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                  <span className="text-[10px] text-rose-600 block">
                    فودافون كاش ({paymentBreakdown.vodafoneCount})
                  </span>
                  <span className="font-black text-rose-800">
                    {paymentBreakdown.vodafone_cash.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-100">
                  <span className="text-[10px] text-purple-600 block">
                    محفظة VIP ({paymentBreakdown.vipCount})
                  </span>
                  <span className="font-black text-purple-800">
                    {paymentBreakdown.vip_wallet.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices Financial Audit Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-brand-950">
                بطاقات التدقيق المالي للفواتير ({filteredOrders.length} فاتورة)
              </h3>
              {onOpenOrdersTab && (
                <button
                  type="button"
                  onClick={onOpenOrdersTab}
                  className="text-xs font-black text-indigo-700 hover:underline cursor-pointer"
                >
                  فتح سجل الفواتير الكامل ←
                </button>
              )}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
                لا توجد فواتير مطابقة للفلاتر المحددة
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.slice(0, 36).map((ord) => {
                  const isPos =
                    ord.orderSource === 'pos' || ord.orderNumber?.startsWith('POS-');
                  const rawCost = ord.rawCostTotal || Math.round((ord.total || 0) * 0.68);
                  const netProfit = ord.netProfitEgp ?? (ord.total || 0) - rawCost;
                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs hover:shadow-md transition space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-brand-100 pb-2.5">
                        <span className="font-mono font-black text-xs bg-brand-950 text-gold-400 px-2.5 py-1 rounded-lg">
                          {ord.orderNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                            isPos
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {isPos ? '⚖️ كاشير POS' : '🌐 متجر أونلاين'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-black text-brand-950">{ord.customerName}</p>
                          <p className="text-[10.5px] text-brand-500 font-mono">
                            {ord.customerPhone} • {ord.governorate}
                          </p>
                        </div>
                        <span className="text-[10.5px] font-bold bg-brand-50 text-brand-700 px-2 py-1 rounded-lg border border-brand-200">
                          {PAYMENT_METHOD_LABELS[ord.paymentMethod] || ord.paymentMethod}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div className="p-2 rounded-xl bg-brand-50">
                          <span className="text-[10px] text-brand-500 font-bold block">
                            الإجمالي
                          </span>
                          <span className="text-xs font-black text-brand-950">
                            {(ord.total || 0).toLocaleString('ar-EG')} ج
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-50">
                          <span className="text-[10px] text-amber-700 font-bold block">
                            تكلفة الخامات
                          </span>
                          <span className="text-xs font-black text-amber-800">
                            {rawCost.toLocaleString('ar-EG')} ج
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-50">
                          <span className="text-[10px] text-emerald-700 font-bold block">
                            صافي الربح
                          </span>
                          <span className="text-xs font-black text-emerald-700">
                            +{netProfit.toLocaleString('ar-EG')} ج
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10.5px] text-brand-500 pt-2 border-t border-brand-100">
                        <span>{ord.items?.length || 0} أصناف</span>
                        <span>{new Date(ord.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: POS SHIFTS & DRAWER Z-REPORT CARDS                             */}
      {/* ===================================================================== */}
      {activeSubTab === 'shifts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black text-brand-950">
              بطاقات تدقيق ورديات الكاشير والدرج ({filteredShifts.length} وردية)
            </h3>
          </div>

          {filteredShifts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد ورديات كاشير مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredShifts.map((shift) => {
                const diff = shift.cashDifference ?? shift.variance ?? 0;
                return (
                  <div
                    key={shift.id}
                    className="bg-white rounded-3xl p-5 border border-brand-200 shadow-xs hover:shadow-md transition space-y-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-brand-100 pb-3">
                      <div>
                        <span className="font-mono font-black text-xs bg-brand-950 text-gold-400 px-2.5 py-1 rounded-lg">
                          {shift.shiftNumber}
                        </span>
                        <p className="text-xs font-black text-brand-950 mt-1.5">
                          الكاشير: {shift.cashierName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${
                          shift.status === 'open'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-brand-100 text-brand-800'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {shift.status === 'open' ? 'مفتوحة الآن' : 'مغلقة'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-2xl bg-brand-50">
                        <span className="text-[10px] text-brand-500 font-bold block">
                          إجمالي مبيعات الوردية
                        </span>
                        <span className="text-sm font-black text-brand-950">
                          {(shift.totalRevenue || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-emerald-50">
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          صافي ربح الوردية
                        </span>
                        <span className="text-sm font-black text-emerald-800">
                          {(shift.totalNetProfit || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-bold text-brand-700">
                      <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-brand-50/60">
                        <span>عهدة بداية الدرج:</span>
                        <span className="font-black text-brand-950">
                          {(shift.openingCash || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-rose-50/60">
                        <span>المصروفات من الدرج:</span>
                        <span className="font-black text-rose-700">
                          -{(shift.expensesTotal || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-indigo-50/70">
                        <span>المتوقع بالدرج:</span>
                        <span className="font-black text-indigo-800">
                          {(shift.expectedCashInDrawer || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>

                      {shift.status === 'closed' && (
                        <div className="flex justify-between px-2.5 py-1.5 rounded-xl border border-brand-200">
                          <span>الجرد الفعلي والمطابقة:</span>
                          <span
                            className={`font-black ${
                              diff === 0
                                ? 'text-emerald-700'
                                : diff > 0
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {(
                              shift.actualClosingCash ??
                              shift.expectedCashInDrawer ??
                              0
                            ).toLocaleString('ar-EG')}{' '}
                            ج ({diff === 0 ? 'مطابق' : diff > 0 ? `+${diff}` : diff})
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShiftForZReport(shift);
                        updateUrlQueryParams({ zreport: shift.shiftNumber || shift.id });
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-brand-950 hover:bg-brand-900 text-gold-400 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>عرض وطباعة تقرير Z-Report</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SUPPLY & PURCHASE INVOICE CARDS                                */}
      {/* ===================================================================== */}
      {activeSubTab === 'supply' && (
        <div className="space-y-4">
          {/* Supply Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-4 border border-emerald-200 shadow-xs">
              <span className="text-xs font-bold text-emerald-700 block">
                ✅ فواتير مشتريات معتمدة
              </span>
              <p className="text-xl font-black text-emerald-800 mt-1">
                {report.supplyFinancials.approvedTotal.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-amber-200 shadow-xs">
              <span className="text-xs font-bold text-amber-700 block">
                ⏳ فواتير مشتريات قيد المراجعة
              </span>
              <p className="text-xl font-black text-amber-800 mt-1">
                {report.supplyFinancials.pendingTotal.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-brand-200 shadow-xs">
              <span className="text-xs font-bold text-brand-600 block">
                📦 إجمالي عدد الفواتير
              </span>
              <p className="text-xl font-black text-brand-950 mt-1">
                {filteredSupplyInvoices.length} فاتورة توريد
              </p>
            </div>
          </div>

          {filteredSupplyInvoices.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد فواتير شراء أو توريد مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSupplyInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white rounded-3xl p-5 border border-brand-200 shadow-xs hover:shadow-md transition space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-brand-100 pb-2.5">
                    <span className="font-mono font-black text-xs bg-brand-950 text-gold-400 px-2.5 py-1 rounded-lg">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                        inv.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : inv.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {inv.status === 'approved'
                        ? 'معتمدة ✓'
                        : inv.status === 'rejected'
                        ? 'مرفوضة ✕'
                        : 'قيد المراجعة'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-brand-950">
                        المورد: {inv.supplierName || 'مورد المحمصة'}
                      </p>
                      <p className="text-[10.5px] text-brand-500">
                        {new Date(inv.createdAt).toLocaleString('ar-EG')}
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-brand-500 font-bold block">الإجمالي</span>
                      <span className="text-sm font-black text-emerald-800">
                        {inv.totalAmount.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-brand-50/70 border border-brand-100 space-y-1 max-h-32 overflow-y-auto">
                    {inv.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] font-bold text-brand-800"
                      >
                        <span className="truncate">{it.productName}</span>
                        <span className="font-mono text-brand-600 shrink-0">
                          {it.quantityKg} كجم × {it.costPerKg} ج
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: OPERATIONAL EXPENSES CARDS                                     */}
      {/* ===================================================================== */}
      {activeSubTab === 'expenses' && (
        <div className="space-y-5">
          {/* Category Breakdown Cards */}
          {expenseCategoryCards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {expenseCategoryCards.map((cat) => (
                <div
                  key={cat.category}
                  className="bg-white rounded-2xl p-4 border border-rose-200 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-rose-900">{cat.label}</span>
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">
                      {cat.count} حركة
                    </span>
                  </div>
                  <p className="text-lg font-black text-rose-600">
                    {cat.total.toLocaleString('ar-EG')} ج.م
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Individual Expense Cards */}
          {filteredExpenses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد مصروفات مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-black">
                      {EXPENSE_CATEGORY_LABELS[exp.category] || exp.category}
                    </span>
                    <span className="text-base font-black text-rose-600">
                      -{exp.amount.toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-black text-brand-950">{exp.title}</p>
                  {exp.notes && <p className="text-[11px] text-brand-600">{exp.notes}</p>}
                  <div className="flex items-center justify-between text-[10.5px] text-brand-500 pt-2 border-t border-brand-100">
                    <span className="font-mono">وردية: {exp.shiftId || 'عام'}</span>
                    <span>{new Date(exp.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: PRODUCT PROFITABILITY & COST CARDS                             */}
      {/* ===================================================================== */}
      {activeSubTab === 'margins' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productMarginAnalytics.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs hover:shadow-md transition space-y-3"
              >
                <div className="flex items-center justify-between border-b border-brand-100 pb-2.5">
                  <div className="min-w-0">
                    <h4 className="font-black text-brand-950 text-xs sm:text-sm truncate">
                      {p.name}
                    </h4>
                    <span className="text-[10.5px] text-brand-500">{p.origin}</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black shrink-0 ${
                      p.marginPct >= 22
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {p.marginPct >= 22 ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    هامش {p.marginPct}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-amber-50/70">
                    <span className="text-[10px] text-amber-800 font-bold block">
                      التكلفة + التغليف
                    </span>
                    <span className="text-xs font-black text-amber-900">
                      {p.totalUnitCost} ج.م
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-brand-50">
                    <span className="text-[10px] text-brand-600 font-bold block">
                      سعر البيع / كجم
                    </span>
                    <span className="text-xs font-black text-brand-950">{p.pricePerKg} ج.م</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50">
                    <span className="text-[10px] text-emerald-700 font-bold block">
                      صافي ربح الكيلو
                    </span>
                    <span className="text-xs font-black text-emerald-700">+{p.netPerKg} ج.م</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PRINTABLE Z-REPORT MODAL                                              */}
      {/* ===================================================================== */}
      {selectedShiftForZReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-brand-200 space-y-5">
            <div className="flex items-center justify-between border-b border-brand-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-brand-900">
                  تقرير تقفيل الوردية (Z-Report) — {selectedShiftForZReport.shiftNumber}
                </h3>
                <p className="text-xs text-brand-500">
                  الكاشير: {selectedShiftForZReport.cashierName} | الفترة:{' '}
                  {selectedShiftForZReport.shiftPeriod}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedShiftForZReport(null);
                  updateUrlQueryParams({ zreport: null });
                }}
                className="p-2 rounded-xl hover:bg-brand-50 text-brand-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm font-bold">
              <div className="flex justify-between p-2.5 rounded-xl bg-brand-50">
                <span>عهدة بداية الوردية:</span>
                <span className="font-black">{selectedShiftForZReport.openingCash} ج.م</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-emerald-50 text-emerald-900">
                <span>المبيعات النقدية (Cash Sales):</span>
                <span className="font-black">
                  {selectedShiftForZReport.cashSalesTotal || 0} ج.م
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-indigo-50 text-indigo-900">
                <span>مبيعات إنستا باي وفودافون كاش:</span>
                <span>
                  {(selectedShiftForZReport.instapayTotal || 0) +
                    (selectedShiftForZReport.vodafoneCashTotal || 0)}{' '}
                  ج.م
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-rose-50 text-rose-900">
                <span>إجمالي المصروفات من الدرج:</span>
                <span className="font-black">
                  -{selectedShiftForZReport.expensesTotal || 0} ج.م
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-brand-900 text-gold-400">
                <span>النقدية المتوقعة بالدرج:</span>
                <span className="font-black">
                  {selectedShiftForZReport.expectedCashInDrawer || 0} ج.م
                </span>
              </div>
              {selectedShiftForZReport.status === 'closed' && (
                <div className="flex justify-between p-3 rounded-xl border border-brand-200">
                  <span>الجرد الفعلي المسلم عند الإغلاق:</span>
                  <span className="font-black">
                    {selectedShiftForZReport.actualClosingCash ??
                      selectedShiftForZReport.expectedCashInDrawer ??
                      0}{' '}
                    ج.م
                  </span>
                </div>
              )}
              <div className="flex justify-between p-3 rounded-xl bg-emerald-950 text-emerald-300">
                <span>صافي ربح الوردية (بعد الخامات):</span>
                <span className="font-black">
                  {selectedShiftForZReport.totalNetProfit || 0} ج.م
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة Z-Report</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedShiftForZReport(null);
                  updateUrlQueryParams({ zreport: null });
                }}
                className="px-4 py-2.5 rounded-xl bg-brand-100 hover:bg-brand-200 text-brand-800 font-black text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AccountantIsolationPortal };
