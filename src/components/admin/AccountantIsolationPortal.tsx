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
  Printer,
  BarChart3,
  Layers,
  Search,
  Filter,
  RotateCcw,
  ExternalLink,
  ShoppingBag,
  CreditCard,
  Sparkles,
  ShoppingCart,
  Percent,
  Archive,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table as TableIcon,
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
  roundCurrency,
} from '@/lib/financials';
import { generateOrdersCsv } from '@/lib/csv';
import {
  updateUrlQueryParams,
  buildUrlWithParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';

export type AccountantReportSubTab =
  | 'daily_income'
  | 'channels'
  | 'shifts'
  | 'supply'
  | 'expenses'
  | 'margins';

export type AccountantDisplayMode = 'both' | 'cards' | 'table';

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
  settings,
  onExportCsv,
  onExportOrdersCsv,
  onOpenOrdersTab,
  onOpenSupplyInvoicesTab,
  onOpenOperationsTab,
  onOpenProductsTab,
}: AccountantIsolationPortalProps) {
  // Primary Report Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<AccountantReportSubTab>('daily_income');
  // Display Mode: Both Cards & Tables (default), Cards only, or Table only
  const [displayMode, setDisplayMode] = useState<AccountantDisplayMode>('both');

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
  const [marginStockFilter, setMarginStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Expansion States
  const [selectedShiftForZReport, setSelectedShiftForZReport] = useState<PosShift | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [expandedSupplyInvoiceId, setExpandedSupplyInvoiceId] = useState<string | null>(null);

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

  // Daily Income Cards & Table Aggregation (Group by Date YYYY-MM-DD)
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

  // Inventory Valuation & Low-Stock Summary
  const inventoryValuation = useMemo(() => {
    let totalStockKg = 0;
    let totalWholesaleValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const stock = typeof p.stockKg === 'number' ? Math.max(0, p.stockKg) : 0;
      const wCost =
        typeof p.costPerKg === 'number' && p.costPerKg > 0
          ? p.costPerKg
          : roundCurrency((p.pricePerKg || 0) * 0.72);
      const rPrice =
        typeof p.pricePerKg === 'number' && p.pricePerKg > 0
          ? p.pricePerKg
          : p.weights?.[0]?.price
            ? roundCurrency((p.weights[0].price / (p.weights[0].weightGrams || 250)) * 1000)
            : 0;

      totalStockKg += stock;
      totalWholesaleValue += stock * wCost;
      totalRetailValue += stock * rPrice;

      if (!p.inStock || stock <= 0) {
        outOfStockCount++;
      } else if (stock <= 5) {
        lowStockCount++;
      }
    }

    return {
      totalStockKg: roundCurrency(totalStockKg),
      totalWholesaleValue: roundCurrency(totalWholesaleValue),
      totalRetailValue: roundCurrency(totalRetailValue),
      expectedInventoryProfit: roundCurrency(totalRetailValue - totalWholesaleValue),
      lowStockCount,
      outOfStockCount,
    };
  }, [products]);

  const productMarginAnalytics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .map((p) => {
        const retail =
          typeof p.pricePerKg === 'number' && p.pricePerKg > 0
            ? p.pricePerKg
            : p.weights?.[0]?.price
              ? roundCurrency((p.weights[0].price / (p.weights[0].weightGrams || 250)) * 1000)
              : 0;
        const cost =
          typeof p.costPerKg === 'number' && p.costPerKg > 0
            ? p.costPerKg
            : roundCurrency(retail * 0.72);
        const pkg = p.packagingCost || 0;
        const totalUnitCost = roundCurrency(cost + pkg);
        const netPerKg = roundCurrency(retail - totalUnitCost);
        const marginPct = retail > 0 ? roundCurrency((netPerKg / retail) * 100) : 0;
        return {
          ...p,
          retailKg: retail,
          wholesaleCost: cost,
          totalUnitCost,
          netPerKg,
          marginPct,
        };
      })
      .filter((p) => {
        const stock = p.stockKg ?? 0;
        if (marginStockFilter === 'low' && (stock <= 0 || stock > 5 || !p.inStock)) return false;
        if (marginStockFilter === 'out' && p.inStock && stock > 0) return false;
        if (marginTierFilter === 'high' && p.marginPct < 20) return false;
        if (marginTierFilter === 'low' && p.marginPct >= 15) return false;
        if (q) {
          return (
            p.name.toLowerCase().includes(q) ||
            (p.origin || '').toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [products, marginStockFilter, marginTierFilter, searchQuery]);

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
    setMarginStockFilter('all');
    setSearchQuery('');
    updateUrlQueryParams({ range: null, channel: null, pay: null });
  };

  const hasActiveFilters =
    datePreset !== 'all' ||
    channelFilter !== 'all' ||
    paymentFilter !== 'all' ||
    statusFilter !== 'all' ||
    marginTierFilter !== 'all' ||
    marginStockFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const showCards = displayMode === 'both' || displayMode === 'cards';
  const showTables = displayMode === 'both' || displayMode === 'table';

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
              <span>مركز التقارير المالية والدخل اليومي والرقابة المحاسبية - وضع المراجعة والتدقيق المالي (Read-Only Audit)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black">
              التقارير المالية الشاملة وتدقيق القنوات والورديات والمخزون
            </h2>
          </div>

          {/* 5 CSV Export Buttons (Full Excel BOM Compatibility) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadBlobCsv(generateFinancialSummaryCsv(report), `hafsa-financial-summary-${datePreset}`)
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>قائمة الدخل والأرباح (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (onExportCsv) onExportCsv();
                else if (onExportOrdersCsv) onExportOrdersCsv();
                else downloadBlobCsv(generateOrdersCsv(filteredOrders), `hafsa-orders-audit-${datePreset}`);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs shadow transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير الفواتير (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlobCsv(
                  generateShiftsAuditCsv(report.shiftAudits as unknown as PosShift[]),
                  `hafsa-shifts-zreport-${datePreset}`
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-xs shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير الورديات (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlobCsv(
                  generateExpensesLedgerCsv(filteredExpenses),
                  `hafsa-operating-expenses-${datePreset}`
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/90 hover:bg-rose-400 text-white font-black text-xs shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دفتر المصروفات (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlobCsv(
                  generateSupplyLedgerCsv(filteredSupplyInvoices),
                  `hafsa-supply-invoices-${datePreset}`
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black text-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>سجل التوريدات (CSV)</span>
            </button>
          </div>
        </div>

        {/* Accountant Quick Navigation Shortcuts Row + Display Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3.5 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-200 ml-1">
              🔗 انتقال سريع لأقسام الداشبورد:
            </span>
            {onOpenOrdersTab && (
              <button
                type="button"
                onClick={onOpenOrdersTab}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-gold-400" />
                <span>جدول الفواتير والكاشير ({orders.length})</span>
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
                <span>الأوزان والعروض والـ VIP</span>
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

          {/* Display Mode Toggle (Both / Cards / Tables) */}
          <div className="inline-flex items-center bg-black/30 p-1 rounded-xl border border-white/15 gap-1">
            {(
              [
                { id: 'both', label: 'بطاقات + جداول' },
                { id: 'cards', label: 'عرض البطاقات' },
                { id: 'table', label: 'عرض الجداول' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setDisplayMode(m.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition cursor-pointer ${
                  displayMode === m.id
                    ? 'bg-gold-500 text-brand-950 shadow-2xs'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {m.id === 'table' ? (
                  <TableIcon className="w-3 h-3" />
                ) : (
                  <LayoutGrid className="w-3 h-3" />
                )}
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
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
              <span>الفترة الزمنية للتقارير:</span>
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

        {/* Row 2: Search + Channel Filter + Payment Filter + Status/Margin Filter */}
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
                <option value="high">✅ ربحية مرتفعة (≥ 20%)</option>
                <option value="low">⚠️ ربحية منخفضة (&lt; 15%)</option>
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
      {/* 8 EXECUTIVE FINANCIAL & RECONCILIATION KPI CARDS                      */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Gross Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">إجمالي الإيرادات (Total Revenue)</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-black text-brand-950">
            {report.totalRevenue.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            مجموع {report.onlineMetrics.orderCount + report.posMetrics.orderCount} طلب وفاتورة مبيعات
          </p>
        </div>

        {/* KPI 2: Online vs POS Distribution */}
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">توزيع القنوات (Online vs POS)</span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-brand-600 font-bold">المتجر الأونلاين:</span>
              <span className="font-black text-indigo-700">
                {report.onlineMetrics.grossRevenue.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-600 font-bold">كاشير الفرع:</span>
              <span className="font-black text-amber-700">
                {report.posMetrics.grossRevenue.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            {report.totalRevenue > 0
              ? `نسبة الأونلاين: ${roundCurrency((report.onlineMetrics.grossRevenue / report.totalRevenue) * 100)}%`
              : 'لا توجد مبيعات في الفترة'}
          </p>
        </div>

        {/* KPI 3: COGS */}
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">تكلفة البضاعة المباعة (COGS)</span>
            <Archive className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-800">
            {report.totalCogs.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            تمثل {report.totalRevenue > 0 ? roundCurrency((report.totalCogs / report.totalRevenue) * 100) : 0}% من إجمالي المبيعات
          </p>
        </div>

        {/* KPI 4: Gross Profit & Operating Expenses */}
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">المصروفات التشغيلية ومجمل الربح</span>
            <Wallet className="w-4 h-4 text-rose-600" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-brand-600 font-bold">مجمل الربح:</span>
              <span className="font-black text-emerald-700">
                {report.grossProfit.toLocaleString('ar-EG')} ج.م ({report.grossMarginPercent}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-600 font-bold">المصروفات النثرية:</span>
              <span className="font-black text-rose-600">
                -{report.operatingExpenses.toLocaleString('ar-EG')} ج.م ({filteredExpenses.length})
              </span>
            </div>
          </div>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            مصروفات الفرع المسحوبة من الدرج
          </p>
        </div>

        {/* KPI 5: Net Operating Profit */}
        <div className="bg-emerald-950 text-white rounded-2xl p-4 border border-emerald-700 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-200">صافي الربح الفعلي (Net Profit)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-300">
            {report.netOperatingProfit.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </p>
          <p className="text-[10.5px] text-emerald-200/80 mt-1 font-bold">
            الإيرادات - تكلفة الخامات - المصروفات
          </p>
        </div>

        {/* KPI 6: Net Margin % */}
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">هامش الربح الصافي (Net Margin)</span>
            <Percent className="w-4 h-4 text-purple-600" />
          </div>
          <p
            className={`text-xl font-black ${
              report.netMarginPercent >= 15 ? 'text-purple-700' : 'text-amber-700'
            }`}
          >
            {report.netMarginPercent}%
          </p>
          <p className="text-[10.5px] text-brand-500 mt-1 font-bold">
            {report.netMarginPercent >= 15
              ? '✅ نسبة صحية ومطابقة لمعايير الربحية'
              : '⚠️ أقل من المستهدف المرجعي (15%)'}
          </p>
        </div>

        {/* KPI 7: Cash Drawer Reconciliation */}
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">مطابقة دروج الكاشير</span>
            <Receipt className="w-4 h-4 text-brand-700" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-lg font-black ${
                report.totalDrawerVariance === 0
                  ? 'text-emerald-700'
                  : report.totalDrawerVariance > 0
                  ? 'text-blue-700'
                  : 'text-rose-700'
              }`}
            >
              {report.totalDrawerVariance > 0
                ? `+${report.totalDrawerVariance}`
                : report.totalDrawerVariance}{' '}
              ج.م
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                report.totalDrawerVariance === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : report.totalDrawerVariance > 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {report.totalDrawerVariance === 0
                ? 'مطابق تماماً'
                : report.totalDrawerVariance > 0
                ? 'فائض بالدرج'
                : 'عجز بالدرج'}
            </span>
          </div>
          <div className="text-[10px] text-brand-500 mt-1 font-bold flex justify-between">
            <span>عجز: {report.totalDrawerShortage} ج</span>
            <span>فائض: +{report.totalDrawerSurplus} ج</span>
            <span>الورديات: {report.shiftAudits.length}</span>
          </div>
        </div>

        {/* KPI 8: Supply & VIP Liabilities */}
        <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-brand-600">التوريدات ومحافظ VIP</span>
            <Crown className="w-4 h-4 text-amber-600" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-brand-600 font-bold">توريد معتمد:</span>
              <span className="font-black text-brand-950">
                {report.supplyFinancials.approvedTotal.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-600 font-bold">رصيد محافظ VIP:</span>
              <span className="font-black text-purple-700">
                {report.vipLiabilities.totalPointsBalance.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
          <p className="text-[10.5px] text-amber-700 mt-1 font-bold">
            توريد معلق: {report.supplyFinancials.pendingTotal.toLocaleString('ar-EG')} ج.م ({report.vipLiabilities.membersCount} عضو VIP)
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
            label: `مقارنة القنوات والفواتير (${filteredOrders.length})`,
            icon: BarChart3,
          },
          {
            id: 'shifts' as const,
            label: `تدقيق ورديات الكاشير والدرج (${report.shiftAudits.length})`,
            icon: Store,
          },
          {
            id: 'supply' as const,
            label: `سجل فواتير التوريد والالتزامات (${filteredSupplyInvoices.length})`,
            icon: Truck,
          },
          {
            id: 'expenses' as const,
            label: `دفتر المصروفات التشغيلية (${filteredExpenses.length})`,
            icon: Wallet,
          },
          {
            id: 'margins' as const,
            label: `ربحية الأصناف وتقييم المخزون (${productMarginAnalytics.length})`,
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
      {/* TAB 1: DAILY INCOME & CASH FLOW (الدخل اليومي والخزينة)               */}
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

          {dailyIncomeCards.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد حركات مالية مسجلة مطابقة للفلاتر المحددة
            </div>
          ) : (
            <>
              {/* Day-by-Day Income Table View */}
              {showTables && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-black text-brand-950">
                      جدول تقارير الدخل اليومي التفصيلي ({dailyIncomeCards.length} يوم)
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-brand-200">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-3 whitespace-nowrap">التاريخ واليوم</th>
                          <th className="p-3 whitespace-nowrap">عدد الفواتير</th>
                          <th className="p-3 whitespace-nowrap">مبيعات الكاشير POS</th>
                          <th className="p-3 whitespace-nowrap">مبيعات الأونلاين</th>
                          <th className="p-3 whitespace-nowrap">إجمالي الإيراد</th>
                          <th className="p-3 whitespace-nowrap">تكلفة البضاعة (COGS)</th>
                          <th className="p-3 whitespace-nowrap">المصروفات اليومية</th>
                          <th className="p-3 whitespace-nowrap">صافي الربح اليومي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100 bg-white">
                        {dailyIncomeCards.map((day) => (
                          <tr key={day.dateKey} className="hover:bg-brand-50/70 transition">
                            <td className="p-3 whitespace-nowrap">
                              <div className="font-black text-brand-950">{day.dateLabel}</div>
                              <div className="text-[10px] font-mono text-brand-500">{day.dateKey}</div>
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-brand-900">
                              {day.ordersCount} فاتورة
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-amber-800">
                              {day.posRevenue.toLocaleString('ar-EG')} ج.م ({day.posCount})
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-indigo-800">
                              {day.onlineRevenue.toLocaleString('ar-EG')} ج.م ({day.onlineCount})
                            </td>
                            <td className="p-3 whitespace-nowrap font-black text-brand-950">
                              {day.totalRevenue.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-amber-700">
                              {day.cogs.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-rose-600">
                              -{day.expenses.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3 whitespace-nowrap font-black text-emerald-700">
                              +{day.netProfit.toLocaleString('ar-EG')} ج.م
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Day-by-Day Income Cards Grid */}
              {showCards && (
                <div className="space-y-3">
                  <h3 className="text-sm sm:text-base font-black text-brand-950">
                    بطاقات تقارير الدخل اليومي ({dailyIncomeCards.length} يوم)
                  </h3>
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
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CHANNELS COMPARISON (ONLINE vs POS) & INVOICES AUDIT           */}
      {/* ===================================================================== */}
      {activeSubTab === 'channels' && (
        <div className="space-y-5">
          {/* Detailed Side-by-Side Channel P&L Breakdown (Online Storefront vs POS Terminal) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Online Storefront Full P&L Card */}
            <div className="bg-white border border-indigo-200 rounded-3xl p-5 relative overflow-hidden shadow-xs">
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-indigo-600" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-brand-950">
                      المتجر الإلكتروني (Online Storefront)
                    </h3>
                    <p className="text-[11px] text-brand-500">
                      طلبات التوصيل للمنازل وقرى مركز بني مزار والمحافظات
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-800 px-3 py-1 rounded-full font-black border border-indigo-200">
                  {report.onlineMetrics.orderCount} طلب
                </span>
              </div>

              <div className="space-y-2.5 divide-y divide-brand-100 text-xs">
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">إجمالي المبيعات (Gross Revenue):</span>
                  <span className="font-black text-brand-950 text-sm">
                    {report.onlineMetrics.grossRevenue.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">المجموع الفرعي (Subtotal):</span>
                  <span className="font-bold text-brand-900">
                    {report.onlineMetrics.subtotal.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">إيرادات الشحن والتوصيل:</span>
                  <span className="font-bold text-brand-900">
                    {report.onlineMetrics.shippingRevenue.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">الخصومات وكوبونات الترويج:</span>
                  <span className="font-bold text-rose-600">
                    -{report.onlineMetrics.discountTotal.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">تكلفة البضاعة المباعة (COGS):</span>
                  <span className="font-bold text-amber-800">
                    {report.onlineMetrics.cogs.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2 bg-indigo-50/70 p-2.5 rounded-xl">
                  <span className="text-indigo-950 font-black">إجمالي الربح التجاري (Gross Profit):</span>
                  <span className="font-black text-indigo-900 text-sm">
                    {report.onlineMetrics.grossProfit.toLocaleString('ar-EG')} ج.م ({report.onlineMetrics.grossMarginPercent}%)
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">متوسط قيمة الطلب (Average Ticket):</span>
                  <span className="font-black text-brand-900">
                    {report.onlineMetrics.avgTicket.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* POS Store Terminal Full P&L Card */}
            <div className="bg-white border border-amber-200 rounded-3xl p-5 relative overflow-hidden shadow-xs">
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-amber-500" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-brand-950">
                      كاشير الفرع المباشر (POS Store Terminal)
                    </h3>
                    <p className="text-[11px] text-brand-500">
                      مبيعات المحل المباشرة (أمام مسجد الزراعيين) والميزان وتوليفة البن
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-amber-50 text-amber-900 px-3 py-1 rounded-full font-black border border-amber-200">
                  {report.posMetrics.orderCount} فاتورة
                </span>
              </div>

              <div className="space-y-2.5 divide-y divide-brand-100 text-xs">
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">إجمالي المبيعات (Gross Revenue):</span>
                  <span className="font-black text-brand-950 text-sm">
                    {report.posMetrics.grossRevenue.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">المجموع الفرعي (Subtotal):</span>
                  <span className="font-bold text-brand-900">
                    {report.posMetrics.subtotal.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">خصومات فورية واستبدال نقاط VIP:</span>
                  <span className="font-bold text-rose-600">
                    -{report.posMetrics.discountTotal.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">تكلفة الخامات والمواد المباعة (COGS):</span>
                  <span className="font-bold text-amber-800">
                    {report.posMetrics.cogs.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2 bg-amber-50/70 p-2.5 rounded-xl">
                  <span className="text-amber-950 font-black">إجمالي الربح التجاري (Gross Profit):</span>
                  <span className="font-black text-amber-900 text-sm">
                    {report.posMetrics.grossProfit.toLocaleString('ar-EG')} ج.م ({report.posMetrics.grossMarginPercent}%)
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-brand-600 font-bold">متوسط قيمة الفاتورة (Average Ticket):</span>
                  <span className="font-black text-brand-900">
                    {report.posMetrics.avgTicket.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown + VIP Liabilities Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-brand-200 shadow-xs space-y-3">
              <h3 className="font-black text-brand-950 text-sm">💳 توزيع المقبوضات حسب طريقة الدفع</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-bold">
                <div className="p-3 rounded-2xl bg-brand-50 border border-brand-100">
                  <span className="text-[10.5px] text-brand-500 block">
                    نقدي وعند الاستلام ({paymentBreakdown.codCount})
                  </span>
                  <span className="text-sm font-black text-brand-950 mt-0.5 block">
                    {paymentBreakdown.cod.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
                  <span className="text-[10.5px] text-indigo-600 block">
                    إنستا باي ({paymentBreakdown.instapayCount})
                  </span>
                  <span className="text-sm font-black text-indigo-800 mt-0.5 block">
                    {paymentBreakdown.instapay.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
                  <span className="text-[10.5px] text-rose-600 block">
                    فودافون كاش ({paymentBreakdown.vodafoneCount})
                  </span>
                  <span className="text-sm font-black text-rose-800 mt-0.5 block">
                    {paymentBreakdown.vodafone_cash.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100">
                  <span className="text-[10.5px] text-purple-600 block">
                    محفظة VIP ({paymentBreakdown.vipCount})
                  </span>
                  <span className="text-sm font-black text-purple-800 mt-0.5 block">
                    {paymentBreakdown.vip_wallet.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* VIP Cashback Liabilities Card */}
            <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-3xl flex flex-col justify-between text-xs shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-200 text-amber-900 rounded-xl shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-amber-950 text-sm">
                    التزامات نادي عملاء حفصة VIP
                  </div>
                  <div className="text-amber-800 text-[11px]">
                    أرصدة الكاش باك المعلقة في محافظ العملاء المستحقة للاستبدال
                  </div>
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-3 mt-3 border-t border-amber-200/80">
                <span className="text-amber-800 font-bold">
                  إجمالي {report.vipLiabilities.membersCount} عميل مسجل
                </span>
                <span className="text-lg font-black text-amber-950">
                  {report.vipLiabilities.totalPointsBalance.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
          </div>

          {/* Invoices Financial Audit (Table + Cards) */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد فواتير مطابقة للفلاتر المحددة
            </div>
          ) : (
            <>
              {showTables && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-black text-brand-950">
                      جدول التدقيق المالي للفواتير ({filteredOrders.length} فاتورة)
                    </h3>
                    {onOpenOrdersTab && (
                      <button
                        type="button"
                        onClick={onOpenOrdersTab}
                        className="text-xs font-black text-indigo-700 hover:underline cursor-pointer"
                      >
                        فتح سجل الطلبات الكامل ←
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-brand-200">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-3 whitespace-nowrap">رقم الفاتورة</th>
                          <th className="p-3 whitespace-nowrap">القناة</th>
                          <th className="p-3 whitespace-nowrap">العميل والمنطقة</th>
                          <th className="p-3 whitespace-nowrap">طريقة الدفع</th>
                          <th className="p-3 whitespace-nowrap">الإجمالي</th>
                          <th className="p-3 whitespace-nowrap">تكلفة الخامات (COGS)</th>
                          <th className="p-3 whitespace-nowrap">صافي الربح</th>
                          <th className="p-3 whitespace-nowrap">التاريخ</th>
                          <th className="p-3 text-center whitespace-nowrap">الفاتورة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100 bg-white">
                        {filteredOrders.slice(0, 50).map((ord) => {
                          const isPos =
                            ord.orderSource === 'pos' || ord.orderNumber?.startsWith('POS-');
                          const rawCost = ord.rawCostTotal || Math.round((ord.total || 0) * 0.68);
                          const netProfit = ord.netProfitEgp ?? (ord.total || 0) - rawCost;
                          return (
                            <tr key={ord.id} className="hover:bg-brand-50/70 transition">
                              <td className="p-3 whitespace-nowrap">
                                <span className="font-mono font-black text-xs bg-brand-950 text-gold-400 px-2.5 py-1 rounded-lg">
                                  {ord.orderNumber}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                                    isPos
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  }`}
                                >
                                  {isPos ? '⚖️ كاشير POS' : '🌐 متجر أونلاين'}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-black text-brand-950">{ord.customerName}</div>
                                <div className="text-[10px] text-brand-500 font-mono">
                                  {ord.customerPhone} • {ord.governorate}
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="text-[10.5px] font-bold bg-brand-50 text-brand-800 px-2 py-1 rounded-lg border border-brand-200">
                                  {PAYMENT_METHOD_LABELS[ord.paymentMethod] || ord.paymentMethod}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap font-black text-brand-950">
                                {(ord.total || 0).toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 whitespace-nowrap font-bold text-amber-800">
                                {rawCost.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 whitespace-nowrap font-black text-emerald-700">
                                +{netProfit.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 whitespace-nowrap text-[11px] text-brand-500">
                                {new Date(ord.createdAt).toLocaleString('ar-EG')}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoiceOrder(ord)}
                                  className="px-2.5 py-1 bg-brand-900 hover:bg-brand-950 text-gold-400 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>طباعة</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {showCards && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-black text-brand-950">
                      بطاقات التدقيق المالي للفواتير ({filteredOrders.length} فاتورة)
                    </h3>
                  </div>
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
                            <span>
                              {ord.items?.length || 0} أصناف •{' '}
                              {new Date(ord.createdAt).toLocaleString('ar-EG')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceOrder(ord)}
                              className="px-2.5 py-1 bg-brand-100 hover:bg-brand-200 text-brand-950 rounded-lg font-black inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>الفاتورة</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: POS SHIFTS & DRAWER Z-REPORT (TABLE + CARDS)                   */}
      {/* ===================================================================== */}
      {activeSubTab === 'shifts' && (
        <div className="space-y-4">
          {report.shiftAudits.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد ورديات كاشير مسجلة في هذه الفترة
            </div>
          ) : (
            <>
              {/* Full 12-Column Shifts Audit Table */}
              {showTables && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-brand-950">
                        جدول سجل ورديات الكاشير وجرد النقدية بالدرج ({report.shiftAudits.length} وردية)
                      </h3>
                      <p className="text-xs text-brand-500">
                        مقارنة النقدية الفعلية المحصية مع الرصيد المتوقع برمجياً وطباعة تقارير Z-Report
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlobCsv(
                          generateShiftsAuditCsv(report.shiftAudits as unknown as PosShift[]),
                          `hafsa-shifts-audit-${datePreset}`
                        )
                      }
                      className="py-1.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-900 font-black text-xs rounded-xl flex items-center gap-1.5 border border-brand-200 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير الورديات CSV</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-brand-200">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-3 whitespace-nowrap">رقم الوردية</th>
                          <th className="p-3 whitespace-nowrap">الكاشير</th>
                          <th className="p-3 whitespace-nowrap">الحالة</th>
                          <th className="p-3 whitespace-nowrap">رصيد الافتتاح</th>
                          <th className="p-3 whitespace-nowrap">المبيعات النقدية</th>
                          <th className="p-3 whitespace-nowrap">إلكتروني</th>
                          <th className="p-3 whitespace-nowrap">المصروفات</th>
                          <th className="p-3 whitespace-nowrap">المتوقع بالدرج</th>
                          <th className="p-3 whitespace-nowrap">الفعلي المحصي</th>
                          <th className="p-3 whitespace-nowrap">الفارق (عجز/فائض)</th>
                          <th className="p-3 whitespace-nowrap">صافي الربح</th>
                          <th className="p-3 text-center whitespace-nowrap">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100 bg-white">
                        {report.shiftAudits.map((shift) => {
                          const origShift =
                            posShifts.find((s) => s.id === shift.shiftId) ||
                            (shift as unknown as PosShift);
                          return (
                            <tr key={shift.shiftId} className="hover:bg-brand-50/70 transition">
                              <td className="p-3 font-mono font-black text-brand-950">
                                {shift.shiftNumber}
                              </td>
                              <td className="p-3 font-bold text-brand-800">{shift.cashierName}</td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    shift.status === 'open'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-brand-100 text-brand-800'
                                  }`}
                                >
                                  {shift.status === 'open' ? '🟢 مفتوحة' : 'مغلقة'}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-brand-800">
                                {shift.openingCash.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 font-black text-brand-950">
                                {shift.cashSalesTotal.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 font-bold text-indigo-700">
                                {shift.electronicSalesTotal.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 font-bold text-rose-600">
                                -{shift.expensesTotal.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 font-black text-brand-950">
                                {shift.expectedCashInDrawer.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 font-bold text-brand-800">
                                {shift.actualClosingCash !== undefined
                                  ? `${shift.actualClosingCash.toLocaleString('ar-EG')} ج.م`
                                  : '—'}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    shift.varianceType === 'balanced'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : shift.varianceType === 'surplus'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {shift.varianceType === 'balanced'
                                    ? 'مطابق تماماً'
                                    : shift.varianceType === 'surplus'
                                    ? `فائض (+${shift.variance})`
                                    : `عجز (${shift.variance})`}
                                </span>
                              </td>
                              <td className="p-3 font-black text-emerald-700">
                                {shift.totalNetProfit.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedShiftForZReport(origShift);
                                    updateUrlQueryParams({
                                      zreport: origShift.shiftNumber || origShift.id,
                                    });
                                  }}
                                  className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 rounded-lg font-black text-[11px] border border-amber-300 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>تقرير Z</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Shifts Cards View */}
              {showCards && (
                <div className="space-y-3">
                  <h3 className="text-sm sm:text-base font-black text-brand-950">
                    بطاقات تدقيق ورديات الكاشير والدرج ({filteredShifts.length} وردية)
                  </h3>
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
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SUPPLY & PURCHASE INVOICE LEDGER (TABLE + CARDS)               */}
      {/* ===================================================================== */}
      {activeSubTab === 'supply' && (
        <div className="space-y-4">
          {/* Supply Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-4 border border-emerald-200 shadow-xs">
              <span className="text-xs font-bold text-emerald-700 block">
                ✅ فواتير مشتريات معتمدة ومضافة للمخزون
              </span>
              <p className="text-xl font-black text-emerald-800 mt-1">
                {report.supplyFinancials.approvedTotal.toLocaleString('ar-EG')} ج.م
              </p>
              <span className="text-[11px] text-emerald-700 font-bold">
                ({report.supplyFinancials.approvedCount} فاتورة معتمدة)
              </span>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-amber-200 shadow-xs">
              <span className="text-xs font-bold text-amber-700 block">
                ⏳ فواتير مشتريات قيد المراجعة
              </span>
              <p className="text-xl font-black text-amber-800 mt-1">
                {report.supplyFinancials.pendingTotal.toLocaleString('ar-EG')} ج.م
              </p>
              <span className="text-[11px] text-amber-700 font-bold">
                ({report.supplyFinancials.pendingCount} فاتورة معلقة)
              </span>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-brand-200 shadow-xs">
              <span className="text-xs font-bold text-brand-600 block">
                ❌ فواتير توريد مرفوضة
              </span>
              <p className="text-xl font-black text-brand-950 mt-1">
                {report.supplyFinancials.rejectedTotal.toLocaleString('ar-EG')} ج.م
              </p>
              <span className="text-[11px] text-brand-500 font-bold">
                ({report.supplyFinancials.rejectedCount} فاتورة مرفوضة)
              </span>
            </div>
          </div>

          {filteredSupplyInvoices.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد فواتير شراء أو توريد مسجلة في هذه الفترة
            </div>
          ) : (
            <>
              {/* Expandable Supply Invoices Accounting Table */}
              {showTables && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-brand-950">
                        جدول سجل فواتير التوريد والالتزامات للموردين ({filteredSupplyInvoices.length})
                      </h3>
                      <p className="text-xs text-brand-500">
                        اضغط على أي فاتورة لاستعراض بنود الكميات وتكلفة الكيلو وملاحظات الاعتماد
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlobCsv(
                          generateSupplyLedgerCsv(filteredSupplyInvoices),
                          `hafsa-supply-ledger-${datePreset}`
                        )
                      }
                      className="py-1.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-900 font-black text-xs rounded-xl flex items-center gap-1.5 border border-brand-200 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير التوريدات CSV</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-brand-200">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-3">رقم الفاتورة</th>
                          <th className="p-3">المورد</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">تاريخ الإنشاء</th>
                          <th className="p-3">المعتمد بواسطة</th>
                          <th className="p-3">إجمالي القيمة</th>
                          <th className="p-3">عدد الأصناف</th>
                          <th className="p-3 text-center">التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100 bg-white">
                        {filteredSupplyInvoices.map((inv) => {
                          const isExpanded = expandedSupplyInvoiceId === inv.id;
                          return (
                            <React.Fragment key={inv.id}>
                              <tr className="hover:bg-brand-50/70 transition">
                                <td className="p-3 font-mono font-black text-brand-950">
                                  {inv.invoiceNumber}
                                </td>
                                <td className="p-3 font-bold text-brand-800">
                                  {inv.supplierName || 'مورد المحمصة'}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                                      inv.status === 'approved'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : inv.status === 'pending'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {inv.status === 'approved'
                                      ? 'معتمدة ومضافة للمخزون'
                                      : inv.status === 'pending'
                                      ? 'معلقة (بانتظار الإدارة)'
                                      : 'مرفوضة'}
                                  </span>
                                </td>
                                <td className="p-3 text-brand-600 font-mono text-[11px]">
                                  {inv.createdAt?.slice(0, 10)}
                                </td>
                                <td className="p-3 text-brand-700 font-bold">
                                  {inv.reviewedBy || '—'}
                                </td>
                                <td className="p-3 font-black text-emerald-800">
                                  {inv.totalAmount.toLocaleString('ar-EG')} ج.م
                                </td>
                                <td className="p-3 font-bold text-brand-700">
                                  {(inv.items || []).length} أصناف
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedSupplyInvoiceId(isExpanded ? null : inv.id)
                                    }
                                    className="p-1.5 text-brand-600 hover:text-brand-950 rounded-lg hover:bg-brand-100 cursor-pointer"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-brand-50/60 border-t border-brand-200">
                                  <td colSpan={8} className="p-4">
                                    <div className="bg-white p-3.5 rounded-2xl border border-brand-200 space-y-2.5">
                                      <div className="text-xs font-black text-brand-950">
                                        بنود أصناف الفاتورة ({inv.invoiceNumber}):
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                        {(inv.items || []).map((it, idx) => (
                                          <div
                                            key={idx}
                                            className="p-2.5 bg-brand-50 rounded-xl border border-brand-200 text-xs"
                                          >
                                            <div className="font-black text-brand-950">
                                              {it.productName}
                                            </div>
                                            <div className="text-brand-600 text-[11px] mt-0.5">
                                              الكمية:{' '}
                                              <span className="font-bold text-brand-900">
                                                {it.quantityKg} كجم
                                              </span>{' '}
                                              × التكلفة:{' '}
                                              <span className="font-bold text-brand-900">
                                                {it.costPerKg} ج.م
                                              </span>
                                            </div>
                                            <div className="font-black text-amber-800 text-xs mt-1">
                                              الإجمالي: {it.totalCost.toLocaleString('ar-EG')} ج.م
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      {inv.notes && (
                                        <div className="text-xs text-brand-700 pt-2 border-t border-brand-100">
                                          <span className="font-black">ملاحظات المورد:</span>{' '}
                                          {inv.notes}
                                        </div>
                                      )}
                                      {inv.adminNotes && (
                                        <div className="text-xs text-amber-900 font-bold">
                                          <span className="font-black">ملاحظات الإدارة:</span>{' '}
                                          {inv.adminNotes}
                                        </div>
                                      )}
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
                </div>
              )}

              {/* Supply Invoices Cards View */}
              {showCards && (
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
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: OPERATIONAL EXPENSES LEDGER (TABLE + CARDS)                    */}
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

          {filteredExpenses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-brand-200 text-brand-500 font-bold text-xs">
              لا توجد مصروفات مسجلة في هذه الفترة
            </div>
          ) : (
            <>
              {/* Operating Expenses Ledger Table */}
              {showTables && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-brand-950">
                        جدول دفتر قيد المصروفات النثرية والتشغيلية ({filteredExpenses.length})
                      </h3>
                      <p className="text-xs text-brand-500">
                        سجل نفقات الفرع المسحوبة من درج الكاشير أثناء الورديات
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlobCsv(
                          generateExpensesLedgerCsv(filteredExpenses),
                          `hafsa-operating-expenses-${datePreset}`
                        )
                      }
                      className="py-1.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-900 font-black text-xs rounded-xl flex items-center gap-1.5 border border-brand-200 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير المصروفات CSV</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-brand-200">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-3">المعرف</th>
                          <th className="p-3">الوردية</th>
                          <th className="p-3">بيان المصروف</th>
                          <th className="p-3">المبلغ</th>
                          <th className="p-3">التصنيف</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100 bg-white">
                        {filteredExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-brand-50/70 transition">
                            <td className="p-3 font-mono text-brand-600">{exp.id.slice(0, 10)}</td>
                            <td className="p-3 font-bold text-brand-800">{exp.shiftId || 'عام'}</td>
                            <td className="p-3 font-black text-brand-950">{exp.title}</td>
                            <td className="p-3 font-black text-rose-600">
                              -{exp.amount.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                {EXPENSE_CATEGORY_LABELS[exp.category] || exp.category}
                              </span>
                            </td>
                            <td className="p-3 text-brand-500 font-mono text-[11px]">
                              {new Date(exp.createdAt).toLocaleString('ar-EG')}
                            </td>
                            <td className="p-3 text-brand-600">{exp.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Individual Expense Cards */}
              {showCards && (
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
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: PRODUCT PROFITABILITY, MARGINS & INVENTORY VALUATION           */}
      {/* ===================================================================== */}
      {activeSubTab === 'margins' && (
        <div className="space-y-4">
          {/* 4 Inventory Valuation & Low-Stock Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 bg-white border border-brand-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-brand-500 block">
                إجمالي رصيد المخزون الفعلي
              </span>
              <span className="text-xl font-black text-brand-950 mt-0.5 block">
                {inventoryValuation.totalStockKg.toLocaleString('ar-EG')} كجم
              </span>
              <span className="text-[10.5px] text-brand-500 font-bold block mt-0.5">
                موزعة على {products.length} صنف بالكتالوج
              </span>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-amber-800 block">
                قيمة المخزون بتكلفة الجملة
              </span>
              <span className="text-xl font-black text-amber-950 mt-0.5 block">
                {inventoryValuation.totalWholesaleValue.toLocaleString('ar-EG')} ج.م
              </span>
              <span className="text-[10.5px] text-amber-700 font-bold block mt-0.5">
                رأس المال العامل في البضاعة الحالية
              </span>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 block">
                القيمة البيعية المتوقعة للمخزون
              </span>
              <span className="text-xl font-black text-emerald-950 mt-0.5 block">
                {inventoryValuation.totalRetailValue.toLocaleString('ar-EG')} ج.م
              </span>
              <span className="text-[10.5px] text-emerald-700 font-bold block mt-0.5">
                ربح متوقع: +{inventoryValuation.expectedInventoryProfit.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-rose-800 block">
                تنبيهات نواقص المخزون الحرجة
              </span>
              <span className="text-xl font-black text-rose-900 mt-0.5 block">
                {inventoryValuation.lowStockCount} نواقص • {inventoryValuation.outOfStockCount} نافد
              </span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() =>
                    setMarginStockFilter(marginStockFilter === 'low' ? 'all' : 'low')
                  }
                  className="text-[10.5px] font-black text-rose-700 underline cursor-pointer"
                >
                  {marginStockFilter === 'low'
                    ? 'عرض كل الأصناف'
                    : 'فلترة النواقص الحرجة (≤ 5 كجم)'}
                </button>
              </div>
            </div>
          </div>

          {/* Stock & Margin Quick Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-brand-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-black text-brand-950">
              تدقيق هوامش ربحية أصناف الكتالوج ({productMarginAnalytics.length} من {products.length})
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={marginStockFilter}
                onChange={(e) => setMarginStockFilter(e.target.value as 'all' | 'low' | 'out')}
                className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
              >
                <option value="all">المخزون: كل الأصناف</option>
                <option value="low">⚠️ نواقص حرجة (≤ 5 كجم)</option>
                <option value="out">❌ أصناف نافدة (0 كجم)</option>
              </select>

              <select
                value={marginTierFilter}
                onChange={(e) => setMarginTierFilter(e.target.value as 'all' | 'high' | 'low')}
                className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
              >
                <option value="all">الهامش: كل المستويات</option>
                <option value="high">✅ هامش مرتفع (≥ 20%)</option>
                <option value="low">⚠️ هامش منخفض (&lt; 15%)</option>
              </select>
            </div>
          </div>

          {/* Full Catalog Margin Audit Table */}
          {showTables && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs">
              <div className="overflow-x-auto rounded-2xl border border-brand-200">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                      <th className="p-3">اسم المنتج</th>
                      <th className="p-3">المنشأ / التصنيف</th>
                      <th className="p-3">رصيد المخزون</th>
                      <th className="p-3">تكلفة الجملة / كجم</th>
                      <th className="p-3">التغليف</th>
                      <th className="p-3">سعر البيع / كجم</th>
                      <th className="p-3">صافي ربح الكيلو</th>
                      <th className="p-3">نسبة الهامش %</th>
                      <th className="p-3">قنوات العرض</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 bg-white">
                    {productMarginAnalytics.map((p) => (
                      <tr key={p.id} className="hover:bg-brand-50/70 transition">
                        <td className="p-3 font-black text-brand-950">{p.name}</td>
                        <td className="p-3 text-brand-600 font-bold">{p.origin || p.categoryId}</td>
                        <td className="p-3">
                          <span
                            className={`font-mono font-black px-2 py-0.5 rounded-lg border ${
                              (p.stockKg ?? 0) <= 5
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-brand-50 text-brand-900 border-brand-200'
                            }`}
                          >
                            {p.stockKg ?? 0} كجم
                          </span>
                        </td>
                        <td className="p-3 font-bold text-amber-800">{p.wholesaleCost} ج.م</td>
                        <td className="p-3 text-brand-600">{p.packagingCost || 0} ج.م</td>
                        <td className="p-3 font-black text-brand-950">{p.retailKg} ج.م</td>
                        <td className="p-3 font-black text-emerald-700">+{p.netPerKg} ج.م</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                              p.marginPct >= 20
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.marginPct >= 15
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {p.marginPct}%
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {p.showOnline !== false && (
                              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9.5px] px-1.5 py-0.5 rounded font-bold">
                                أونلاين
                              </span>
                            )}
                            {p.showInPos !== false && (
                              <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[9.5px] px-1.5 py-0.5 rounded font-bold">
                                كاشير
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Product Profitability Cards */}
          {showCards && (
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
                      <span className="text-[10.5px] text-brand-500">
                        {p.origin} • المخزون: {p.stockKg ?? 0} كجم
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black shrink-0 ${
                        p.marginPct >= 20
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {p.marginPct >= 20 ? (
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
                      <span className="text-xs font-black text-brand-950">{p.retailKg} ج.م</span>
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
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* OFFICIAL Z-REPORT MODAL & ORDER RECEIPT MODAL                         */}
      {/* ===================================================================== */}
      {selectedShiftForZReport && (
        <SupermarketReceiptModal
          shift={selectedShiftForZReport}
          mode="zreport"
          settings={settings || undefined}
          showProfit={true}
          onClose={() => {
            setSelectedShiftForZReport(null);
            updateUrlQueryParams({ zreport: null });
          }}
        />
      )}

      {selectedInvoiceOrder && (
        <SupermarketReceiptModal
          order={selectedInvoiceOrder}
          mode="receipt"
          settings={settings || undefined}
          showProfit={true}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}
    </div>
  );
}

export { AccountantIsolationPortal };
