'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Calculator,
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
  CreditCard,
  ShoppingCart,
  Percent,
  Archive,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table as TableIcon,
  Scale,
  Landmark,
  PanelRightClose,
  PanelRightOpen,
  Search,
  RotateCcw,
  FileText,
} from 'lucide-react';
import ExportMenu from '@/components/ui/ExportMenu';
import DataTableShell from '@/components/ui/DataTableShell';
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
import InventoryAdjustmentModal from '@/components/admin/InventoryAdjustmentModal';
import TreasuryAndLedgersModule from '@/components/admin/TreasuryAndLedgersModule';
import AdvancedCompetitorReports from '@/components/admin/AdvancedCompetitorReports';
import type { Category } from '@/types/store';

export type AccountantReportSubTab =
  | 'executive_pnl'
  | 'daily_income'
  | 'treasury_ledgers'
  | 'channels'
  | 'shifts'
  | 'supply'
  | 'expenses'
  | 'margins'
  | 'advanced_reports';

export type AccountantDisplayMode = 'both' | 'cards' | 'table';

interface AccountantIsolationPortalProps {
  products: Product[];
  categories?: Category[];
  orders: Order[];
  posShifts: PosShift[];
  posExpenses: PosExpense[];
  coupons?: Coupon[];
  vipMembers: VipMember[];
  supplyInvoices?: SupplyInvoice[];
  settings?: any;
  canMutate?: boolean;
  onRefreshStore?: () => void;
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
  cash: 'نقدي بالدرج',
  instapay: 'إنستا باي',
  vodafone_cash: 'فودافون كاش',
  vip_wallet: 'محفظة VIP',
  card: 'ماكينة فيزا الفرع',
  credit: 'بيع آجل (ذمم عملاء)',
  split: 'دفع مقسم متعدد',
};

const VALID_SUBTABS: AccountantReportSubTab[] = [
  'executive_pnl',
  'daily_income',
  'treasury_ledgers',
  'channels',
  'shifts',
  'supply',
  'expenses',
  'margins',
  'advanced_reports',
];

export default function AccountantIsolationPortal({
  products,
  categories = [],
  orders,
  posShifts,
  posExpenses,
  vipMembers,
  supplyInvoices = [],
  settings,
  canMutate = false,
  onRefreshStore,
  onExportCsv,
  onExportOrdersCsv,
  onOpenOrdersTab,
  onOpenSupplyInvoicesTab,
}: AccountantIsolationPortalProps) {
  // Primary Report Sub-Tab (Defaults to Executive P&L Clean Sheet)
  const [activeSubTab, setActiveSubTab] = useState<AccountantReportSubTab>('executive_pnl');
  // Display Mode: Clean Accounting Table by default, switchable to Cards on demand
  const [displayMode, setDisplayMode] = useState<AccountantDisplayMode>('table');
  const [directoryOpen, setDirectoryOpen] = useState<boolean>(true);
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const reportSheetRef = useRef<HTMLDivElement | null>(null);

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

  // Table Pagination States (25 rows/page)
  const TABLE_PAGE_SIZE = 25;
  const [channelsPage, setChannelsPage] = useState<number>(1);
  const [shiftsPage, setShiftsPage] = useState<number>(1);
  const [supplyPage, setSupplyPage] = useState<number>(1);
  const [expensesPage, setExpensesPage] = useState<number>(1);
  const [marginsPage, setMarginsPage] = useState<number>(1);

  const resetPagination = () => {
    setChannelsPage(1);
    setShiftsPage(1);
    setSupplyPage(1);
    setExpensesPage(1);
    setMarginsPage(1);
  };

  // Modals & Expansion States
  const [selectedShiftForZReport, setSelectedShiftForZReport] = useState<PosShift | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [expandedSupplyInvoiceId, setExpandedSupplyInvoiceId] = useState<string | null>(null);

  useBrowserUrlSync((params) => {
    const sub = params.get('subtab') as AccountantReportSubTab | null;
    if (sub && VALID_SUBTABS.includes(sub)) {
      setActiveSubTab(sub);
    } else if (!sub) {
      setActiveSubTab('executive_pnl');
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
      const netAmt = Math.max(0, (Number(ord.total) || 0) - (Number(ord.returnedAmountTotal) || 0));
      const cost = Number(ord.rawCostTotal) || Math.round(netAmt * 0.68);
      bucket.totalRevenue += netAmt;
      bucket.cogs += cost;
      bucket.ordersCount += 1;
      if (isPos) {
        bucket.posRevenue += netAmt;
        bucket.posCount += 1;
      } else {
        bucket.onlineRevenue += netAmt;
        bucket.onlineCount += 1;
      }
      if (
        ord.paymentMethod === 'instapay' ||
        ord.paymentMethod === 'vodafone_cash' ||
        ord.paymentMethod === 'card'
      ) {
        bucket.digitalRevenue += netAmt;
      } else if (ord.paymentMethod === 'split' && Array.isArray(ord.paymentSplits)) {
        const gross = Number(ord.total) || 1;
        const ratio = netAmt / gross;
        for (const sp of ord.paymentSplits) {
          const spNet = (Number(sp.amount) || 0) * ratio;
          if (sp.method === 'cod') bucket.cashRevenue += spNet;
          else if (
            sp.method === 'card' ||
            sp.method === 'instapay' ||
            sp.method === 'vodafone_cash'
          ) {
            bucket.digitalRevenue += spNet;
          }
        }
      } else if (ord.paymentMethod === 'cod') {
        bucket.cashRevenue += netAmt;
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

  const riderCodCustodyAudit = useMemo(() => {
    let unsettledOrdersCount = 0;
    let unsettledAmount = 0;
    let settledOrdersCount = 0;
    let settledAmount = 0;

    for (const o of filteredOrders) {
      if (o.orderSource === 'pos') continue;
      if (o.paymentMethod !== 'cod') continue;
      if (o.status !== 'delivered') continue;
      const amt = Math.max(0, Math.round(Number(o.cashCollected ?? o.total ?? 0)));
      if (o.riderCodSettled) {
        settledOrdersCount += 1;
        settledAmount += amt;
      } else {
        unsettledOrdersCount += 1;
        unsettledAmount += amt;
      }
    }

    const drawerSettledShiftsTotal = posShifts.reduce(
      (sum, s) => sum + Math.max(0, Math.round(Number(s.riderCodSettledTotal || 0))),
      0
    );

    return {
      unsettledOrdersCount,
      unsettledAmount,
      settledOrdersCount,
      settledAmount,
      drawerSettledShiftsTotal,
    };
  }, [filteredOrders, posShifts]);

  const paymentBreakdown = useMemo(() => {
    let cod = 0;
    let card = 0;
    let instapay = 0;
    let vodafone_cash = 0;
    let vip_wallet = 0;
    let credit = 0;
    let codCount = 0;
    let cardCount = 0;
    let instapayCount = 0;
    let vodafoneCount = 0;
    let vipCount = 0;
    let creditCount = 0;
    for (const o of filteredOrders) {
      if (o.status === 'cancelled') continue;
      const grossAmt = o.total || 0;
      const netAmt = Math.max(0, grossAmt - (o.returnedAmountTotal || 0));
      if (o.paymentMethod === 'split' && Array.isArray(o.paymentSplits) && o.paymentSplits.length > 0) {
        const ratio = grossAmt > 0 ? netAmt / grossAmt : 1;
        for (const sp of o.paymentSplits) {
          const spAmt = roundCurrency((Number(sp.amount) || 0) * ratio);
          if (sp.method === 'cod') {
            cod += spAmt;
            codCount += 1;
          } else if (sp.method === 'card') {
            card += spAmt;
            cardCount += 1;
          } else if (sp.method === 'instapay') {
            instapay += spAmt;
            instapayCount += 1;
          } else if (sp.method === 'vodafone_cash') {
            vodafone_cash += spAmt;
            vodafoneCount += 1;
          } else if (sp.method === 'vip_wallet') {
            vip_wallet += spAmt;
            vipCount += 1;
          } else if (sp.method === 'credit') {
            credit += spAmt;
            creditCount += 1;
          }
        }
      } else if (o.paymentMethod === 'card') {
        card += netAmt;
        cardCount += 1;
      } else if (o.paymentMethod === 'instapay') {
        instapay += netAmt;
        instapayCount += 1;
      } else if (o.paymentMethod === 'vodafone_cash') {
        vodafone_cash += netAmt;
        vodafoneCount += 1;
      } else if (o.paymentMethod === 'vip_wallet') {
        vip_wallet += netAmt;
        vipCount += 1;
      } else if (o.paymentMethod === 'credit') {
        credit += netAmt;
        creditCount += 1;
      } else {
        cod += netAmt;
        codCount += 1;
      }
    }
    return {
      cod: roundCurrency(cod),
      card: roundCurrency(card),
      instapay: roundCurrency(instapay),
      vodafone_cash: roundCurrency(vodafone_cash),
      vip_wallet: roundCurrency(vip_wallet),
      credit: roundCurrency(credit),
      codCount,
      cardCount,
      instapayCount,
      vodafoneCount,
      vipCount,
      creditCount,
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
    resetPagination();
    updateUrlQueryParams({ range: null, channel: null, pay: null });
  };

  const activeFiltersCount = [
    datePreset !== 'all',
    channelFilter !== 'all',
    paymentFilter !== 'all',
    statusFilter !== 'all',
    marginTierFilter !== 'all',
    marginStockFilter !== 'all',
  ].filter(Boolean).length;

  const exportMenuItems = [
    {
      id: 'income_csv',
      label: 'قائمة الدخل والأرباح (CSV)',
      description: 'ملخص الإيرادات والتكاليف وصافي الربح',
      icon: <Download className="w-4 h-4" />,
      onClick: () =>
        downloadBlobCsv(generateFinancialSummaryCsv(report), `hafsa-financial-summary-${datePreset}`),
    },
    {
      id: 'orders_csv',
      label: 'تصدير الفواتير (CSV)',
      description: `سجل فواتير الأونلاين والكاشير (${filteredOrders.length})`,
      icon: <FileSpreadsheet className="w-4 h-4" />,
      onClick: () => {
        if (onExportCsv) onExportCsv();
        else if (onExportOrdersCsv) onExportOrdersCsv();
        else downloadBlobCsv(generateOrdersCsv(filteredOrders), `hafsa-orders-audit-${datePreset}`);
      },
    },
    {
      id: 'shifts_csv',
      label: 'تصدير الورديات (CSV)',
      description: `تدقيق الدرج وتقارير Z-Report (${report.shiftAudits.length})`,
      icon: <Download className="w-4 h-4" />,
      onClick: () =>
        downloadBlobCsv(
          generateShiftsAuditCsv(report.shiftAudits as unknown as PosShift[]),
          `hafsa-shifts-zreport-${datePreset}`
        ),
    },
    {
      id: 'expenses_csv',
      label: 'دفتر المصروفات (CSV)',
      description: `مصروفات التشغيل المسحوبة من الدرج (${filteredExpenses.length})`,
      icon: <Download className="w-4 h-4" />,
      onClick: () =>
        downloadBlobCsv(
          generateExpensesLedgerCsv(filteredExpenses),
          `hafsa-operating-expenses-${datePreset}`
        ),
    },
    {
      id: 'supply_csv',
      label: 'سجل التوريدات (CSV)',
      description: `فواتير التوريد والموردين (${filteredSupplyInvoices.length})`,
      icon: <Download className="w-4 h-4" />,
      onClick: () =>
        downloadBlobCsv(
          generateSupplyLedgerCsv(filteredSupplyInvoices),
          `hafsa-supply-invoices-${datePreset}`
        ),
    },
  ];

  const channelsTotalPages = Math.max(1, Math.ceil(filteredOrders.length / TABLE_PAGE_SIZE));
  const channelsSafePage = Math.min(channelsPage, channelsTotalPages);
  const paginatedOrders = filteredOrders.slice(
    (channelsSafePage - 1) * TABLE_PAGE_SIZE,
    channelsSafePage * TABLE_PAGE_SIZE
  );

  const shiftsTotalPages = Math.max(1, Math.ceil(report.shiftAudits.length / TABLE_PAGE_SIZE));
  const shiftsSafePage = Math.min(shiftsPage, shiftsTotalPages);
  const paginatedShiftAudits = report.shiftAudits.slice(
    (shiftsSafePage - 1) * TABLE_PAGE_SIZE,
    shiftsSafePage * TABLE_PAGE_SIZE
  );

  const supplyTotalPages = Math.max(
    1,
    Math.ceil(filteredSupplyInvoices.length / TABLE_PAGE_SIZE)
  );
  const supplySafePage = Math.min(supplyPage, supplyTotalPages);
  const paginatedSupplyInvoices = filteredSupplyInvoices.slice(
    (supplySafePage - 1) * TABLE_PAGE_SIZE,
    supplySafePage * TABLE_PAGE_SIZE
  );

  const expensesTotalPages = Math.max(1, Math.ceil(filteredExpenses.length / TABLE_PAGE_SIZE));
  const expensesSafePage = Math.min(expensesPage, expensesTotalPages);
  const paginatedExpenses = filteredExpenses.slice(
    (expensesSafePage - 1) * TABLE_PAGE_SIZE,
    expensesSafePage * TABLE_PAGE_SIZE
  );

  const marginsTotalPages = Math.max(
    1,
    Math.ceil(productMarginAnalytics.length / TABLE_PAGE_SIZE)
  );
  const marginsSafePage = Math.min(marginsPage, marginsTotalPages);
  const paginatedProductMargins = productMarginAnalytics.slice(
    (marginsSafePage - 1) * TABLE_PAGE_SIZE,
    marginsSafePage * TABLE_PAGE_SIZE
  );

  const showCards = displayMode === 'both' || displayMode === 'cards';
  const showTables = displayMode === 'both' || displayMode === 'table';

  const periodScopeLabel =
    datePreset === 'today'
      ? 'اليوم الحالي'
      : datePreset === 'this_week'
        ? 'آخر 7 أيام'
        : datePreset === 'this_month'
          ? 'هذا الشهر'
          : datePreset === 'custom'
            ? customStart || customEnd
              ? `من ${customStart || 'البداية'} إلى ${customEnd || 'اليوم'}`
              : 'فترة مخصصة'
            : 'كل الفترات';

  const hasPeriodSales = report.totalRevenue > 0;
  const hasShiftAudits = report.shiftAudits.length > 0;
  const totalOrdersCount = report.onlineMetrics.orderCount + report.posMetrics.orderCount;
  const currency = settings?.currencySymbol || 'ج.م';
  const storeName = settings?.storeName || 'النظام المالي';
  const fmtMoney = (val: number) =>
    `${Math.round(Number(val) || 0).toLocaleString('en-US')} ${currency}`;

  type ReportNavItem = {
    id: AccountantReportSubTab;
    group: 'sales' | 'treasury' | 'inventory' | 'advanced';
    label: string;
    fullTitle: string;
    description: string;
    count?: number;
    supportsViewToggle?: boolean;
    supportsSearch?: boolean;
    icon: React.ComponentType<{ className?: string }>;
  };

  const REPORT_GROUPS: Array<{
    id: 'sales' | 'treasury' | 'inventory' | 'advanced';
    title: string;
  }> = [
    { id: 'sales', title: 'المبيعات والأرباح' },
    { id: 'treasury', title: 'الخزينة والورديات' },
    { id: 'inventory', title: 'المخزون والتوريد' },
    { id: 'advanced', title: 'تقارير متقدمة' },
  ];

  const reportNavItems: ReportNavItem[] = [
    {
      id: 'executive_pnl',
      group: 'sales',
      label: 'الملخص وقائمة الدخل',
      fullTitle: 'الملخص التنفيذي وقائمة الدخل',
      description: 'قائمة دخل محاسبية منظمة مع الموقف النقدي اليومي وتقييم أصول المخزون',
      icon: FileText,
    },
    {
      id: 'daily_income',
      group: 'sales',
      label: 'الدخل اليومي والسيولة',
      fullTitle: 'دفتر الدخل اليومي وحركة السيولة',
      description: 'رصد المبيعات والتكاليف والمصروفات وصافي الربح يوماً بيوم',
      count: dailyIncomeCards.length,
      supportsViewToggle: true,
      supportsSearch: true,
      icon: Calendar,
    },
    {
      id: 'channels',
      group: 'sales',
      label: 'القنوات والفواتير',
      fullTitle: 'تقرير القنوات وسجل الفواتير',
      description: 'مقارنة أداء كاشير الفرع مقابل المتجر الإلكتروني ومراجعة الفواتير',
      count: filteredOrders.length,
      supportsViewToggle: true,
      supportsSearch: true,
      icon: BarChart3,
    },
    {
      id: 'treasury_ledgers',
      group: 'treasury',
      label: 'الخزينة والذمم والموردين',
      fullTitle: 'حركة الخزينة والآجل وكشف الموردين',
      description: 'سندات القبض والصرف، ذمم العملاء الآجلة، وأرصدة الموردين',
      icon: Landmark,
    },
    {
      id: 'shifts',
      group: 'treasury',
      label: 'الورديات ومطابقة الدرج',
      fullTitle: 'تدقيق ورديات الكاشير ومطابقة الدروج',
      description: 'مراجعة تقارير إغلاق الورديات والعجز والفائض وعهد الكاشير',
      count: report.shiftAudits.length,
      supportsViewToggle: true,
      supportsSearch: true,
      icon: Store,
    },
    {
      id: 'expenses',
      group: 'treasury',
      label: 'دفتر المصروفات',
      fullTitle: 'دفتر المصروفات التشغيلية والنثرية',
      description: 'تحليل المصروفات المسحوبة من الدرج حسب البند والتاريخ',
      count: filteredExpenses.length,
      supportsViewToggle: true,
      supportsSearch: true,
      icon: Wallet,
    },
    {
      id: 'margins',
      group: 'inventory',
      label: 'ربحية الأصناف والمخزون',
      fullTitle: 'تحليل ربحية الأصناف وتقييم المخزون',
      description: 'مراجعة تكلفة الجملة والتغليف وسعر البيع وهامش الربح لكل صنف',
      count: productMarginAnalytics.length,
      supportsViewToggle: true,
      supportsSearch: true,
      icon: Layers,
    },
    {
      id: 'supply',
      group: 'inventory',
      label: 'فواتير التوريد والمشتريات',
      fullTitle: 'سجل فواتير التوريد والالتزامات',
      description: 'فواتير المشتريات المعتمدة والمعلقة والمدفوعات المستحقة للموردين',
      count: filteredSupplyInvoices.length,
      supportsViewToggle: true,
      supportsSearch: true,
      icon: Truck,
    },
    {
      id: 'advanced_reports',
      group: 'advanced',
      label: 'بالساعة • كارت صنف • أدلة',
      fullTitle: 'التقارير المتقدمة وأدلة الطباعة',
      description: 'تحليل المبيعات بالساعة، كارت حركة الصنف، جرد المجموعات، وطباعة القوائم',
      icon: FileSpreadsheet,
    },
  ];

  const currentTabInfo =
    reportNavItems.find((t) => t.id === activeSubTab) || reportNavItems[0];

  const selectReportTab = (tabId: AccountantReportSubTab) => {
    setActiveSubTab(tabId);
    updateUrlQueryParams({
      subtab: tabId === 'executive_pnl' ? null : tabId,
    });
  };

  const handlePrintCurrentReport = () => {
    if (typeof window === 'undefined' || !reportSheetRef.current) return;
    const contentHtml = reportSheetRef.current.innerHTML;
    const printWin = window.open('', '_blank', 'width=1024,height=780');
    if (!printWin) return;
    const printedAt = new Date().toLocaleString('ar-EG');
    printWin.document.open();
    printWin.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${currentTabInfo.fullTitle} — ${storeName}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #231710;
      background: #fff;
      margin: 0;
      font-size: 11px;
      line-height: 1.5;
    }
    .print-header {
      border-bottom: 2px solid #231710;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .print-header h1 { margin: 0 0 3px 0; font-size: 16px; }
    .print-header p { margin: 0; color: #6B5A4E; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10.5px; }
    th, td { border: 1px solid #DDD2C3; padding: 6px 8px; text-align: right; }
    th { background: #FAF6F0; font-weight: 700; }
    button, select, input, .no-print { display: none !important; }
    .grid { display: block !important; }
    .grid > * { margin-bottom: 10px; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="print-header">
    <div>
      <h1>${storeName} — ${currentTabInfo.fullTitle}</h1>
      <p>نطاق الفترة: ${periodScopeLabel}</p>
    </div>
    <div style="text-align:left; font-size:10px; color:#6B5A4E;">
      تاريخ الطباعة: ${printedAt}
    </div>
  </div>
  ${contentHtml}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
</body>
</html>`);
    printWin.document.close();
  };

  const showContextualFilterBar = Boolean(
    currentTabInfo.supportsSearch || datePreset === 'custom'
  );

  return (
    <div className="animate-fade-in">
      {/* ===================================================================== */}
      {/* CLEAN ACCOUNTING SHEET SHELL (CATEGORIZED DIRECTORY + REPORT PAPER)   */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden flex flex-col lg:flex-row min-h-[calc(100vh-110px)]">
        {/* RIGHT COLUMN: SLIM COLLAPSIBLE 4-GROUP REPORTS DIRECTORY */}
        {directoryOpen && (
          <aside className="w-full lg:w-[215px] xl:w-[225px] shrink-0 bg-[#FAF6F0]/80 border-b lg:border-b-0 lg:border-l border-[#E8E0D5] flex flex-col justify-between">
            <div>
              {/* Directory Header */}
              <div className="px-3.5 py-2.5 border-b border-[#E8E0D5] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Calculator className="w-4 h-4 text-[#9A6836] shrink-0" />
                  <span className="text-xs font-black text-[#231710] truncate">
                    فهرس التقارير
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectoryOpen(false)}
                  title="طي فهرس التقارير لتوسيع الجدول"
                  className="p-1.5 rounded-lg text-[#6B5A4E] hover:text-[#231710] hover:bg-white border border-transparent hover:border-[#E8E0D5] transition cursor-pointer"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {/* 4 Categorized Report Groups */}
              <nav className="p-2.5 space-y-3 overflow-y-auto">
                {REPORT_GROUPS.map((grp) => {
                  const items = reportNavItems.filter((item) => item.group === grp.id);
                  return (
                    <div key={grp.id} className="space-y-0.5">
                      <div className="px-2 py-1 text-[11px] font-black text-[#8A735E] tracking-tight">
                        {grp.title}
                      </div>
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeSubTab === item.id;
                        return (
                          <a
                            key={item.id}
                            href={buildUrlWithParams('/admin', {
                              tab: 'accounting_portal',
                              subtab: item.id === 'executive_pnl' ? null : item.id,
                            })}
                            onClick={(e) => {
                              e.preventDefault();
                              selectReportTab(item.id);
                            }}
                            className={`min-h-[34px] w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                              isActive
                                ? 'bg-[#231710] text-white font-bold shadow-2xs'
                                : 'text-[#231710] hover:bg-white font-medium'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isActive ? 'text-[#D4AF37]' : 'text-[#8A735E]'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.count !== undefined && (
                              <span
                                className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold tabular-nums shrink-0 ${
                                  isActive
                                    ? 'bg-white/15 text-white'
                                    : 'bg-white text-[#6B5A4E] border border-[#E8E0D5]'
                                }`}
                              >
                                {item.count}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Directory Bottom Utility Shortcut */}
            <div className="p-2.5 border-t border-[#E8E0D5] bg-[#FAF6F0]">
              <button
                type="button"
                onClick={() => setShowInventoryModal(true)}
                className="w-full min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] font-bold text-xs transition cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">دفتر تسويات وهالك الجرد</span>
              </button>
            </div>
          </aside>
        )}

        {/* LEFT COLUMN: FOCUSED CLEAN WHITE ACCOUNTING REPORT SHEET */}
        <div className="flex-1 min-w-0 bg-white flex flex-col">
          {/* SINGLE SLIM CONTEXTUAL REPORT COMMAND BAR */}
          <header className="px-4 py-2.5 bg-white border-b border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {!directoryOpen && (
                <button
                  type="button"
                  onClick={() => setDirectoryOpen(true)}
                  title="إظهار فهرس التقارير"
                  className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer shrink-0"
                >
                  <PanelRightOpen className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span>الفهرس</span>
                </button>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-[#231710] truncate">
                    {currentTabInfo.fullTitle}
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF6F0] text-[#6B5A4E] border border-[#E8E0D5] shrink-0">
                    {canMutate ? 'مراجعة وتحكم' : 'تدقيق مالي'}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B5A4E] truncate hidden sm:block">
                  {currentTabInfo.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Compact Period Switcher */}
              <div className="inline-flex items-center bg-[#FAF6F0] p-0.5 rounded-xl border border-[#E8E0D5] gap-0.5">
                {(
                  [
                    { id: 'all', label: 'الكل' },
                    { id: 'today', label: 'اليوم' },
                    { id: 'this_week', label: '7 أيام' },
                    { id: 'this_month', label: 'الشهر' },
                    { id: 'custom', label: 'مخصص' },
                  ] as { id: DateRangePreset; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setDatePreset(p.id);
                      resetPagination();
                      updateUrlQueryParams({ range: p.id === 'all' ? null : p.id });
                    }}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      datePreset === p.id
                        ? 'bg-[#231710] text-white'
                        : 'text-[#6B5A4E] hover:text-[#231710]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Contextual Table / Cards Toggle (ONLY for tabs that support both views) */}
              {currentTabInfo.supportsViewToggle && (
                <div className="inline-flex items-center bg-[#FAF6F0] p-0.5 rounded-xl border border-[#E8E0D5] gap-0.5">
                  <button
                    type="button"
                    onClick={() => setDisplayMode('table')}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                      displayMode !== 'cards'
                        ? 'bg-[#231710] text-white'
                        : 'text-[#6B5A4E] hover:text-[#231710]'
                    }`}
                  >
                    <TableIcon className="w-3 h-3" />
                    <span>جدول</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('cards')}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                      displayMode === 'cards'
                        ? 'bg-[#231710] text-white'
                        : 'text-[#6B5A4E] hover:text-[#231710]'
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>بطاقات</span>
                  </button>
                </div>
              )}

              {/* Print A4 Report Sheet */}
              <button
                type="button"
                onClick={handlePrintCurrentReport}
                className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer"
                title="طباعة التقرير الحالي بصيغة A4 منظمة"
              >
                <Printer className="w-3.5 h-3.5 text-[#9A6836]" />
                <span className="hidden sm:inline">طباعة</span>
              </button>

              {/* Export CSV Menu */}
              <ExportMenu label="تصدير ▾" items={exportMenuItems} />
            </div>
          </header>

          {/* CONTEXTUAL INLINE FILTER STRIP (ONLY SHOWN WHEN RELEVANT TO ACTIVE REPORT) */}
          {showContextualFilterBar && (
            <div className="px-4 py-2 bg-[#FAF6F0]/55 border-b border-[#E8E0D5] flex flex-wrap items-center gap-2">
              {datePreset === 'custom' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#6B5A4E]">من:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      setCustomStart(e.target.value);
                      resetPagination();
                    }}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#E8E0D5] bg-white text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                  />
                  <span className="text-[11px] font-bold text-[#6B5A4E]">إلى:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomEnd(e.target.value);
                      resetPagination();
                    }}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#E8E0D5] bg-white text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>
              )}

              {currentTabInfo.supportsSearch && (
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-[#8A735E] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      resetPagination();
                    }}
                    placeholder={
                      activeSubTab === 'margins'
                        ? 'ابحث باسم الصنف أو المنشأ...'
                        : activeSubTab === 'shifts'
                          ? 'ابحث برقم الوردية أو اسم الكاشير...'
                          : activeSubTab === 'supply'
                            ? 'ابحث برقم فاتورة التوريد أو المورد أو الصنف...'
                            : activeSubTab === 'expenses'
                              ? 'ابحث ببند المصروف أو الملاحظة...'
                              : 'بحث سريع برقم الفاتورة، العميل، أو الصنف...'
                    }
                    className="w-full min-h-[34px] ps-8 pe-3 py-1 rounded-lg border border-[#E8E0D5] bg-white text-xs font-medium text-[#231710] placeholder:text-[#8A735E] focus:outline-none focus:border-[#231710]"
                  />
                </div>
              )}

              {/* Channels & Payment filters ONLY on Channels / Daily Income */}
              {(activeSubTab === 'channels' || activeSubTab === 'daily_income') && (
                <>
                  <select
                    value={channelFilter}
                    onChange={(e) => {
                      const next = e.target.value as 'all' | 'pos' | 'online';
                      setChannelFilter(next);
                      resetPagination();
                      updateUrlQueryParams({ channel: next === 'all' ? null : next });
                    }}
                    className="min-h-[34px] bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1 text-xs font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                  >
                    <option value="all">كل القنوات</option>
                    <option value="pos">كاشير الفرع فقط</option>
                    <option value="online">المتجر الأونلاين فقط</option>
                  </select>

                  <select
                    value={paymentFilter}
                    onChange={(e) => {
                      const next = e.target.value as any;
                      setPaymentFilter(next);
                      resetPagination();
                      updateUrlQueryParams({ pay: next === 'all' ? null : next });
                    }}
                    className="min-h-[34px] bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1 text-xs font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                  >
                    <option value="all">كل طرق الدفع</option>
                    <option value="cod">نقدي وعند الاستلام</option>
                    <option value="instapay">إنستا باي</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="vip_wallet">محفظة VIP</option>
                  </select>
                </>
              )}

              {/* Status filter ONLY on Channels, Shifts, Supply */}
              {(activeSubTab === 'channels' ||
                activeSubTab === 'shifts' ||
                activeSubTab === 'supply') && (
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    resetPagination();
                  }}
                  className="min-h-[34px] bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1 text-xs font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                >
                  <option value="all">كل الحالات</option>
                  <option value="completed">مكتملة / معتمدة / مغلقة</option>
                  <option value="pending">جارية / معلقة / مفتوحة</option>
                  <option value="cancelled">ملغاة / مرفوضة</option>
                </select>
              )}

              {/* Margin & Stock filters ONLY on Margins tab */}
              {activeSubTab === 'margins' && (
                <>
                  <select
                    value={marginStockFilter}
                    onChange={(e) => {
                      setMarginStockFilter(e.target.value as 'all' | 'low' | 'out');
                      resetPagination();
                    }}
                    className="min-h-[34px] bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1 text-xs font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                  >
                    <option value="all">المخزون: الكل</option>
                    <option value="low">نواقص حرجة (≤ 5)</option>
                    <option value="out">أصناف نافدة (0)</option>
                  </select>

                  <select
                    value={marginTierFilter}
                    onChange={(e) => {
                      setMarginTierFilter(e.target.value as 'all' | 'high' | 'low');
                      resetPagination();
                    }}
                    className="min-h-[34px] bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1 text-xs font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                  >
                    <option value="all">الهامش: الكل</option>
                    <option value="high">هامش مرتفع (≥ 20%)</option>
                    <option value="low">هامش منخفض (&lt; 15%)</option>
                  </select>
                </>
              )}

              {(activeFiltersCount > 0 || searchQuery.trim().length > 0) && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#6B5A4E] hover:text-[#231710] transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة ضبط</span>
                </button>
              )}
            </div>
          )}

          {/* FOCUSED ACCOUNTING REPORT PAPER BODY */}
          <div ref={reportSheetRef} className="flex-1 p-4 sm:p-5 bg-white space-y-5">
            {/* =============================================================== */}
            {/* REPORT 1 (DEFAULT): EXECUTIVE P&L STATEMENT & LIVE ASSETS SHEET */}
            {/* =============================================================== */}
            {activeSubTab === 'executive_pnl' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* RIGHT 7 COLS: FORMAL INCOME STATEMENT (P&L) + CONTROLS */}
                <div className="xl:col-span-7 space-y-4">
                  {/* Formal P&L Accounting Sheet */}
                  <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden bg-white">
                    <div className="px-4 py-3 bg-[#FAF6F0] border-b border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#9A6836]" />
                        <h3 className="text-xs sm:text-sm font-black text-[#231710]">
                          قائمة الدخل المختصرة (الإيرادات والأرباح)
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold text-[#6B5A4E] tabular-nums">
                        النطاق: {periodScopeLabel} • {totalOrdersCount.toLocaleString('en-US')} فاتورة
                      </span>
                    </div>

                    <div className="divide-y divide-[#EFE7DC] text-xs tabular-nums">
                      {/* Row 1: Gross Revenue */}
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="font-black text-[#231710]">إجمالي إيرادات المبيعات</div>
                          <div className="text-[11px] text-[#6B5A4E] flex flex-wrap items-center gap-3">
                            <span>
                              كاشير الفرع: {fmtMoney(report.posMetrics.grossRevenue)} (
                              {report.posMetrics.orderCount})
                            </span>
                            <span>•</span>
                            <span>
                              المتجر الأونلاين: {fmtMoney(report.onlineMetrics.grossRevenue)} (
                              {report.onlineMetrics.orderCount})
                            </span>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-sm font-black text-[#231710]">
                            {fmtMoney(report.totalRevenue)}
                          </div>
                          <div className="text-[11px] text-[#8A735E]">
                            {hasPeriodSales ? '100%' : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: COGS */}
                      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-[#FDFBF8]">
                        <div className="space-y-0.5">
                          <div className="font-bold text-[#6B5A4E] flex items-center gap-1.5">
                            <Archive className="w-3.5 h-3.5 text-[#9A6836]" />
                            <span>(−) تكلفة البضاعة المباعة (خامات وتغليف)</span>
                          </div>
                          <div className="text-[11px] text-[#8A735E]">
                            محسوبة على أساس تكلفة الشراء والتغليف للأصناف المباعة
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-sm font-bold text-[#9A6836]">
                            {report.totalCogs > 0 ? `−${fmtMoney(report.totalCogs)}` : fmtMoney(0)}
                          </div>
                          <div className="text-[11px] text-[#8A735E]">
                            {hasPeriodSales
                              ? `${roundCurrency((report.totalCogs / report.totalRevenue) * 100)}%`
                              : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Gross Profit Subtotal */}
                      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-[#FAF6F0]/55">
                        <div className="font-black text-[#231710]">
                          (=) مجمل الربح التجاري
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-sm font-black text-emerald-700">
                            {fmtMoney(report.grossProfit)}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700">
                            {hasPeriodSales ? `هامش ${report.grossMarginPercent}%` : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Operating Expenses */}
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="font-bold text-[#6B5A4E]">
                            (−) المصروفات التشغيلية والنثرية
                          </div>
                          <div className="text-[11px] text-[#8A735E]">
                            عدد بنود المصروفات المسجلة: {filteredExpenses.length} حركة
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-sm font-bold text-rose-700">
                            {report.operatingExpenses > 0
                              ? `−${fmtMoney(report.operatingExpenses)}`
                              : fmtMoney(0)}
                          </div>
                          <div className="text-[11px] text-[#8A735E]">
                            {hasPeriodSales
                              ? `${roundCurrency((report.operatingExpenses / report.totalRevenue) * 100)}%`
                              : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Row 5: NET OPERATING PROFIT HIGHLIGHT BAR */}
                      <div className="px-4 py-3.5 bg-[#231710] text-white flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                            <ArrowUpRight className="w-4 h-4 text-[#D4AF37]" />
                            <span>(=) صافي الربح التشغيلي للفترة</span>
                          </div>
                          <div className="text-[11px] text-white/70">
                            {!hasPeriodSales
                              ? 'لا توجد مبيعات مسجلة في هذه الفترة لحساب هامش الربح'
                              : report.netMarginPercent >= 15
                                ? 'هامش ربح صحي ومطابق لمعايير المحمصة (≥ 15%)'
                                : 'هامش الربح أقل من المستهدف المرجعي (15%) — راجع التكاليف والمصروفات'}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <div className="text-lg font-black text-white">
                              {fmtMoney(report.netOperatingProfit)}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                              !hasPeriodSales
                                ? 'bg-white/10 text-white/85 border-white/20'
                                : report.netMarginPercent >= 15
                                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                                  : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                            }`}
                          >
                            <Percent className="w-3 h-3" />
                            <span>
                              {hasPeriodSales
                                ? `${report.netMarginPercent}%`
                                : 'بانتظار أول مبيعة'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Audit Grid: Payment Mix + Shifts & Rider Custody */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 tabular-nums">
                    {/* Payment Methods Mix */}
                    <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-[#FAF6F0]/75 border-b border-[#E8E0D5] flex items-center justify-between">
                        <span className="text-xs font-black text-[#231710] flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-[#9A6836]" />
                          <span>تحليل وسائل التحصيل</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => selectReportTab('channels')}
                          className="text-[11px] font-bold text-[#9A6836] hover:underline cursor-pointer"
                        >
                          التفاصيل ←
                        </button>
                      </div>
                      <div className="divide-y divide-[#EFE7DC] text-xs">
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">نقدي وعند الاستلام ({paymentBreakdown.codCount})</span>
                          <span className="font-bold text-[#231710]">{fmtMoney(paymentBreakdown.cod)}</span>
                        </div>
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">فيزا ماكينة الفرع ({paymentBreakdown.cardCount})</span>
                          <span className="font-bold text-[#231710]">{fmtMoney(paymentBreakdown.card)}</span>
                        </div>
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">إنستا باي ({paymentBreakdown.instapayCount})</span>
                          <span className="font-bold text-[#231710]">{fmtMoney(paymentBreakdown.instapay)}</span>
                        </div>
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">فودافون كاش ({paymentBreakdown.vodafoneCount})</span>
                          <span className="font-bold text-[#231710]">{fmtMoney(paymentBreakdown.vodafone_cash)}</span>
                        </div>
                        {paymentBreakdown.credit > 0 && (
                          <div className="px-3.5 py-2 flex items-center justify-between">
                            <span className="text-[#9A6836] font-bold">بيع آجل / ذمم ({paymentBreakdown.creditCount})</span>
                            <span className="font-bold text-[#9A6836]">{fmtMoney(paymentBreakdown.credit)}</span>
                          </div>
                        )}
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">محفظة VIP ({paymentBreakdown.vipCount})</span>
                          <span className="font-bold text-[#231710]">{fmtMoney(paymentBreakdown.vip_wallet)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Shifts Drawer Reconciliation & Rider Custody */}
                    <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-[#FAF6F0]/75 border-b border-[#E8E0D5] flex items-center justify-between">
                        <span className="text-xs font-black text-[#231710] flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-[#9A6836]" />
                          <span>رقابة الورديات وعُهد المناديب</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => selectReportTab('shifts')}
                          className="text-[11px] font-bold text-[#9A6836] hover:underline cursor-pointer"
                        >
                          الورديات ←
                        </button>
                      </div>
                      <div className="divide-y divide-[#EFE7DC] text-xs">
                        <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                          <span className="text-[#6B5A4E]">مطابقة الدروج ({report.shiftAudits.length} وردية)</span>
                          {!hasShiftAudits ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF6F0] text-[#6B5A4E] border border-[#E8E0D5]">
                              لا توجد ورديات بعد
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                report.totalDrawerVariance === 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : report.totalDrawerVariance < 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {report.totalDrawerVariance === 0
                                ? 'مطابق تماماً'
                                : `${report.totalDrawerVariance > 0 ? '+' : ''}${fmtMoney(report.totalDrawerVariance)}`}
                            </span>
                          )}
                        </div>
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">
                            عُهد طرف المناديب ({riderCodCustodyAudit.unsettledOrdersCount} طلب)
                          </span>
                          <span className="font-bold text-amber-800">
                            {fmtMoney(riderCodCustodyAudit.unsettledAmount)}
                          </span>
                        </div>
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">
                            مورَّد للدرج من المناديب ({riderCodCustodyAudit.settledOrdersCount} طلب)
                          </span>
                          <span className="font-bold text-emerald-700">
                            {fmtMoney(riderCodCustodyAudit.settledAmount)}
                          </span>
                        </div>
                        <div className="px-3.5 py-2 flex items-center justify-between">
                          <span className="text-[#6B5A4E]">إجمالي المسجل بالورديات</span>
                          <span className="font-bold text-[#231710]">
                            {fmtMoney(riderCodCustodyAudit.drawerSettledShiftsTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LEFT 5 COLS: LIVE TODAY SNAPSHOT + INVENTORY CAPITAL + OBLIGATIONS */}
                <div className="xl:col-span-5 space-y-4 tabular-nums">
                  {/* Block 1: Live Today Liquidity */}
                  <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-[#FAF6F0] border-b border-[#E8E0D5] flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#231710] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>موقف اليوم الحالي</span>
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          todaySnapshot.hasOpenShift
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-white text-[#6B5A4E] border-[#E8E0D5]'
                        }`}
                      >
                        {todaySnapshot.hasOpenShift ? 'وردية مفتوحة' : 'الوردية مغلقة'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-y divide-x divide-x-reverse divide-[#EFE7DC]">
                      <div className="p-3 space-y-0.5">
                        <span className="text-[11px] font-bold text-[#6B5A4E] block">
                          مبيعات اليوم ({todaySnapshot.ordersCount})
                        </span>
                        <span className="text-base font-black text-[#231710]">
                          {fmtMoney(todaySnapshot.revenue)}
                        </span>
                      </div>
                      <div className="p-3 space-y-0.5">
                        <span className="text-[11px] font-bold text-[#6B5A4E] block">
                          نقدية الدرج الآن
                        </span>
                        <span className="text-base font-black text-emerald-700">
                          {fmtMoney(todaySnapshot.drawerCash)}
                        </span>
                      </div>
                      <div className="p-3 space-y-0.5">
                        <span className="text-[11px] font-bold text-[#6B5A4E] block">
                          مصروفات اليوم
                        </span>
                        <span className="text-sm font-black text-rose-700">
                          {fmtMoney(todaySnapshot.expenses)}
                        </span>
                      </div>
                      <div className="p-3 space-y-0.5">
                        <span className="text-[11px] font-bold text-[#6B5A4E] block">
                          صافي دخل اليوم
                        </span>
                        <span className="text-sm font-black text-[#231710]">
                          {fmtMoney(todaySnapshot.netProfit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Block 2: Live Inventory Capital Valuation (Always Real Data!) */}
                  <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-[#FAF6F0] border-b border-[#E8E0D5] flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#231710] flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>أصول المخزون ورأس المال</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => selectReportTab('margins')}
                        className="text-[11px] font-bold text-[#9A6836] hover:underline cursor-pointer"
                      >
                        عرض {products.length} صنف ←
                      </button>
                    </div>
                    <div className="p-3.5 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]">
                          <span className="block text-[11px] font-bold text-[#6B5A4E]">
                            القيمة بالتكلفة
                          </span>
                          <span className="text-sm font-black text-[#231710]">
                            {fmtMoney(inventoryValuation.totalWholesaleValue)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]">
                          <span className="block text-[11px] font-bold text-[#6B5A4E]">
                            القيمة بسعر البيع
                          </span>
                          <span className="text-sm font-black text-[#9A6836]">
                            {fmtMoney(inventoryValuation.totalRetailValue)}
                          </span>
                        </div>
                      </div>

                      <div className="px-3 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                        <div>
                          <span className="block text-[11px] font-bold text-emerald-800">
                            الربح الكامن في المخزون
                          </span>
                          <span className="text-sm font-black text-emerald-800">
                            +{fmtMoney(inventoryValuation.expectedInventoryProfit)}
                          </span>
                        </div>
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-white text-emerald-700 border border-emerald-200">
                          {inventoryValuation.totalRetailValue > 0
                            ? `${roundCurrency(
                                (inventoryValuation.expectedInventoryProfit /
                                  inventoryValuation.totalRetailValue) *
                                  100
                              )}%`
                            : '0%'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#EFE7DC]">
                        <span className="text-[#6B5A4E]">
                          إجمالي الرصيد:{' '}
                          <strong className="text-[#231710]">
                            {inventoryValuation.totalStockKg.toLocaleString('en-US')} كجم/وحدة
                          </strong>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                            نواقص: {inventoryValuation.lowStockCount}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                            نافد: {inventoryValuation.outOfStockCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Block 3: Supply & VIP Obligations */}
                  <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-[#FAF6F0] border-b border-[#E8E0D5] flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#231710] flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>التوريدات والالتزامات</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => selectReportTab('treasury_ledgers')}
                        className="text-[11px] font-bold text-[#9A6836] hover:underline cursor-pointer"
                      >
                        الخزينة والذمم ←
                      </button>
                    </div>
                    <div className="divide-y divide-[#EFE7DC] text-xs">
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-[#6B5A4E]">فواتير توريد معتمدة</span>
                        <span className="font-bold text-[#231710]">
                          {fmtMoney(report.supplyFinancials.approvedTotal)}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-[#6B5A4E]">فواتير توريد معلقة</span>
                        <span className="font-bold text-[#9A6836]">
                          {fmtMoney(report.supplyFinancials.pendingTotal)}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-[#6B5A4E]">
                          أرصدة محافظ VIP ({report.vipLiabilities.membersCount} عضو)
                        </span>
                        <span className="font-bold text-[#231710]">
                          {fmtMoney(report.vipLiabilities.totalPointsBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* REPORT 2: DAILY INCOME & LIQUIDITY LEDGER (الدخل اليومي)        */}
            {/* =============================================================== */}
            {activeSubTab === 'daily_income' && (
              <div className="space-y-4">
                {/* Compact Horizontal Daily Liquidity Ribbon */}
                <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden bg-white">
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#E8E0D5] tabular-nums">
                    <div className="p-3 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#6B5A4E]">
                        <span>مبيعات اليوم</span>
                        <span>{todaySnapshot.ordersCount} فاتورة</span>
                      </div>
                      <p className="text-base font-black text-[#231710]">
                        {fmtMoney(todaySnapshot.revenue)}
                      </p>
                      <div className="text-[11px] text-[#8A735E]">
                        كاشير: {todaySnapshot.posRevenue.toLocaleString('en-US')} • أونلاين:{' '}
                        {todaySnapshot.onlineRevenue.toLocaleString('en-US')}
                      </div>
                    </div>

                    <div className="p-3 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#6B5A4E]">
                        <span>النقدية بالدرج الآن</span>
                        <span className={todaySnapshot.hasOpenShift ? 'text-emerald-700' : ''}>
                          {todaySnapshot.hasOpenShift ? 'مفتوحة' : 'مغلقة'}
                        </span>
                      </div>
                      <p className="text-base font-black text-emerald-700">
                        {fmtMoney(todaySnapshot.drawerCash)}
                      </p>
                      <div className="text-[11px] text-[#8A735E]">
                        إجمالي الكاش: {fmtMoney(paymentBreakdown.cod)}
                      </div>
                    </div>

                    <div className="p-3 space-y-0.5">
                      <div className="text-[11px] font-bold text-[#6B5A4E]">المحافظ والتحويلات</div>
                      <p className="text-base font-black text-[#231710]">
                        {fmtMoney(paymentBreakdown.instapay + paymentBreakdown.vodafone_cash)}
                      </p>
                      <div className="text-[11px] text-[#8A735E]">
                        إنستا باي: {paymentBreakdown.instapay.toLocaleString('en-US')} • فودافون:{' '}
                        {paymentBreakdown.vodafone_cash.toLocaleString('en-US')}
                      </div>
                    </div>

                    <div className="p-3 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#6B5A4E]">
                        <span>صافي اليوم</span>
                        <span className="text-rose-700">
                          مصروفات: {todaySnapshot.expenses.toLocaleString('en-US')}
                        </span>
                      </div>
                      <p className="text-base font-black text-[#231710]">
                        {fmtMoney(todaySnapshot.netProfit)}
                      </p>
                      <div className="text-[11px] text-[#8A735E]">بعد الخامات والمصروفات</div>
                    </div>
                  </div>
                </div>

                {dailyIncomeCards.length === 0 ? (
                  <div className="rounded-2xl p-8 border border-dashed border-[#D6C2A6] bg-[#FAF6F0]/40 text-center space-y-2.5">
                    <Calendar className="w-7 h-7 text-[#9A6836] mx-auto opacity-80" />
                    <h4 className="text-xs sm:text-sm font-black text-[#231710]">
                      لا توجد حركات مبيعات مسجلة في ({periodScopeLabel})
                    </h4>
                    <p className="text-xs text-[#6B5A4E] max-w-md mx-auto">
                      سيتم إنشاء صف محاسبي تلقائياً لكل يوم فور تسجيل أول فاتورة أو مصروف.
                    </p>
                  </div>
                ) : (
            <>
              {/* Day-by-Day Income Table View */}
              {showTables && (
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8E0D5] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-[#231710]">
                      جدول تقارير الدخل اليومي التفصيلي ({dailyIncomeCards.length} يوم)
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-[#E8E0D5]">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                          <th className="p-3 whitespace-nowrap">التاريخ واليوم</th>
                          <th className="p-3 whitespace-nowrap">عدد الفواتير</th>
                          <th className="p-3 whitespace-nowrap">مبيعات الكاشير</th>
                          <th className="p-3 whitespace-nowrap">مبيعات الأونلاين</th>
                          <th className="p-3 whitespace-nowrap">إجمالي الإيراد</th>
                          <th className="p-3 whitespace-nowrap">تكلفة البضاعة</th>
                          <th className="p-3 whitespace-nowrap">المصروفات اليومية</th>
                          <th className="p-3 whitespace-nowrap">صافي الربح اليومي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E0D5] bg-white">
                        {dailyIncomeCards.map((day) => (
                          <tr key={day.dateKey} className="hover:bg-[#FAF6F0]/70 transition">
                            <td className="p-3 whitespace-nowrap">
                              <div className="font-bold text-[#231710]">{day.dateLabel}</div>
                              <div className="text-xs font-mono text-[#6B5A4E]">{day.dateKey}</div>
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-[#231710]">
                              {day.ordersCount} فاتورة
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-[#9A6836]">
                              {day.posRevenue.toLocaleString('en-US')} ج.م ({day.posCount})
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-[#231710]">
                              {day.onlineRevenue.toLocaleString('en-US')} ج.م ({day.onlineCount})
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-[#231710]">
                              {day.totalRevenue.toLocaleString('en-US')} ج.م
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-[#9A6836]">
                              {day.cogs.toLocaleString('en-US')} ج.م
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-rose-600">
                              -{day.expenses.toLocaleString('en-US')} ج.م
                            </td>
                            <td className="p-3 whitespace-nowrap font-bold text-emerald-700">
                              +{day.netProfit.toLocaleString('en-US')} ج.م
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
                  <h3 className="text-sm sm:text-base font-bold text-[#231710]">
                    بطاقات تقارير الدخل اليومي ({dailyIncomeCards.length} يوم)
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {dailyIncomeCards.map((day) => (
                      <div
                        key={day.dateKey}
                        className="bg-white rounded-2xl p-5 border border-[#E8E0D5] space-y-3.5"
                      >
                        <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
                          <div>
                            <span className="text-xs font-bold text-[#231710] block">
                              {day.dateLabel}
                            </span>
                            <span className="text-xs font-mono text-[#6B5A4E]">
                              {day.dateKey}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] text-xs font-bold">
                            {day.ordersCount} فاتورة
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]">
                            <span className="text-xs text-[#6B5A4E] font-medium block">
                              إجمالي الدخل اليومي
                            </span>
                            <span className="text-sm font-bold text-[#231710]">
                              {day.totalRevenue.toLocaleString('en-US')} ج.م
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                            <span className="text-xs text-emerald-700 font-medium block">
                              صافي الربح اليومي
                            </span>
                            <span className="text-sm font-bold text-emerald-800">
                              {day.netProfit.toLocaleString('en-US')} ج.م
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs font-medium text-[#6B5A4E]">
                          <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-[#FAF6F0]">
                            <span>مبيعات الكاشير ({day.posCount}):</span>
                            <span className="font-bold text-[#231710]">
                              {day.posRevenue.toLocaleString('en-US')} ج.م
                            </span>
                          </div>
                          <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-[#FAF6F0]">
                            <span>مبيعات الأونلاين ({day.onlineCount}):</span>
                            <span className="font-bold text-[#231710]">
                              {day.onlineRevenue.toLocaleString('en-US')} ج.م
                            </span>
                          </div>
                          <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-[#FAF6F0]">
                            <span>تكلفة الخامات:</span>
                            <span className="font-bold text-[#9A6836]">
                              {day.cogs.toLocaleString('en-US')} ج.م
                            </span>
                          </div>
                          <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-rose-50/50">
                            <span>المصروفات اليومية:</span>
                            <span className="font-bold text-rose-700">
                              -{day.expenses.toLocaleString('en-US')} ج.م
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-medium text-[#6B5A4E] pt-2 border-t border-[#E8E0D5]">
                          <span>كاش: {day.cashRevenue.toLocaleString('en-US')} ج.م</span>
                          <span>إلكتروني: {day.digitalRevenue.toLocaleString('en-US')} ج.م</span>
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
            <div className="bg-white border border-[#E8E0D5] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836] rounded-xl">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#231710]">
                      المتجر الإلكتروني الأونلاين
                    </h3>
                    <p className="text-xs text-[#6B5A4E]">
                      طلبات التوصيل للمنازل والضواحي والمحافظات
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-[#FAF6F0] text-[#231710] px-3 py-1 rounded-full font-bold border border-[#E8E0D5]">
                  {report.onlineMetrics.orderCount} طلب
                </span>
              </div>

              <div className="space-y-2.5 divide-y divide-[#E8E0D5] text-xs">
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">إجمالي المبيعات:</span>
                  <span className="font-bold text-[#231710] text-sm">
                    {report.onlineMetrics.grossRevenue.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">المجموع الفرعي:</span>
                  <span className="font-bold text-[#231710]">
                    {report.onlineMetrics.subtotal.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">إيرادات الشحن والتوصيل:</span>
                  <span className="font-bold text-[#231710]">
                    {report.onlineMetrics.shippingRevenue.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">الخصومات وكوبونات الترويج:</span>
                  <span className="font-bold text-rose-600">
                    -{report.onlineMetrics.discountTotal.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">تكلفة البضاعة المباعة:</span>
                  <span className="font-bold text-[#9A6836]">
                    {report.onlineMetrics.cogs.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2 bg-[#FAF6F0] border border-[#E8E0D5] p-2.5 rounded-xl">
                  <span className="text-[#231710] font-bold">إجمالي الربح التجاري:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {report.onlineMetrics.grossProfit.toLocaleString('en-US')} ج.م ({report.onlineMetrics.grossMarginPercent}%)
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">متوسط قيمة الطلب:</span>
                  <span className="font-bold text-[#231710]">
                    {report.onlineMetrics.avgTicket.toLocaleString('en-US')} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* POS Store Terminal Full P&L Card */}
            <div className="bg-white border border-[#E8E0D5] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836] rounded-xl">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#231710]">
                      كاشير الفرع المباشر
                    </h3>
                    <p className="text-xs text-[#6B5A4E]">
                      مبيعات الفرع المباشرة ونقطة البيع والميزان
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-[#FAF6F0] text-[#231710] px-3 py-1 rounded-full font-bold border border-[#E8E0D5]">
                  {report.posMetrics.orderCount} فاتورة
                </span>
              </div>

              <div className="space-y-2.5 divide-y divide-[#E8E0D5] text-xs">
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">إجمالي المبيعات:</span>
                  <span className="font-bold text-[#231710] text-sm">
                    {report.posMetrics.grossRevenue.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">المجموع الفرعي:</span>
                  <span className="font-bold text-[#231710]">
                    {report.posMetrics.subtotal.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">خصومات فورية واستبدال نقاط VIP:</span>
                  <span className="font-bold text-rose-600">
                    -{report.posMetrics.discountTotal.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">تكلفة الخامات والمواد المباعة:</span>
                  <span className="font-bold text-[#9A6836]">
                    {report.posMetrics.cogs.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="flex justify-between pt-2 bg-[#FAF6F0] border border-[#E8E0D5] p-2.5 rounded-xl">
                  <span className="text-[#231710] font-bold">إجمالي الربح التجاري:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {report.posMetrics.grossProfit.toLocaleString('en-US')} ج.م ({report.posMetrics.grossMarginPercent}%)
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[#6B5A4E] font-medium">متوسط قيمة الفاتورة:</span>
                  <span className="font-bold text-[#231710]">
                    {report.posMetrics.avgTicket.toLocaleString('en-US')} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown + VIP Liabilities Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E8E0D5] space-y-3">
              <h3 className="font-bold text-[#231710] text-sm">توزيع المقبوضات حسب طريقة الدفع</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-bold">
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]">
                  <span className="text-xs text-[#6B5A4E] font-medium block">
                    نقدي وعند الاستلام ({paymentBreakdown.codCount})
                  </span>
                  <span className="text-sm font-bold text-[#231710] mt-0.5 block">
                    {paymentBreakdown.cod.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]">
                  <span className="text-xs text-[#6B5A4E] font-medium block">
                    إنستا باي ({paymentBreakdown.instapayCount})
                  </span>
                  <span className="text-sm font-bold text-[#231710] mt-0.5 block">
                    {paymentBreakdown.instapay.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]">
                  <span className="text-xs text-[#6B5A4E] font-medium block">
                    فودافون كاش ({paymentBreakdown.vodafoneCount})
                  </span>
                  <span className="text-sm font-bold text-[#231710] mt-0.5 block">
                    {paymentBreakdown.vodafone_cash.toLocaleString('en-US')} ج.م
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]">
                  <span className="text-xs text-[#6B5A4E] font-medium block">
                    محفظة VIP ({paymentBreakdown.vipCount})
                  </span>
                  <span className="text-sm font-bold text-[#9A6836] mt-0.5 block">
                    {paymentBreakdown.vip_wallet.toLocaleString('en-US')} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* VIP Cashback Liabilities Card */}
            <div className="p-5 bg-white border border-[#E8E0D5] rounded-2xl flex flex-col justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836] rounded-xl shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-[#231710] text-sm">
                    التزامات نادي الولاء VIP
                  </div>
                  <div className="text-[#6B5A4E] text-xs">
                    أرصدة الكاش باك المعلقة في محافظ العملاء المستحقة للاستبدال
                  </div>
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-3 mt-3 border-t border-[#E8E0D5]">
                <span className="text-[#6B5A4E] font-medium">
                  إجمالي {report.vipLiabilities.membersCount} عميل مسجل
                </span>
                <span className="text-lg font-bold text-[#231710]">
                  {report.vipLiabilities.totalPointsBalance.toLocaleString('en-US')} ج.م
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
                  <DataTableShell
                    totalItems={filteredOrders.length}
                    currentPage={channelsSafePage}
                    pageSize={TABLE_PAGE_SIZE}
                    onPageChange={setChannelsPage}
                  >
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
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
                        {paginatedOrders.map((ord) => {
                          const isPos =
                            ord.orderSource === 'pos' || ord.orderNumber?.startsWith('POS-');
                          const rawCost = ord.rawCostTotal || Math.round((ord.total || 0) * 0.68);
                          const netProfit = ord.netProfitEgp ?? (ord.total || 0) - rawCost;
                          return (
                            <tr key={ord.id} className="hover:bg-brand-50/70 transition">
                              <td className="p-3 whitespace-nowrap">
                                <span className="font-mono font-bold text-xs bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2.5 py-1 rounded-lg">
                                  {ord.orderNumber}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    isPos
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  }`}
                                >
                                  {isPos ? 'كاشير POS' : 'متجر أونلاين'}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-black text-brand-950">{ord.customerName}</div>
                                <div className="text-[11px] text-brand-600 font-mono">
                                  {ord.customerPhone} • {ord.governorate}
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold bg-brand-50 text-brand-800 px-2 py-1 rounded-lg border border-brand-200">
                                  {PAYMENT_METHOD_LABELS[ord.paymentMethod] || ord.paymentMethod}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap font-black text-brand-950">
                                {(ord.total || 0).toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 whitespace-nowrap font-bold text-amber-800">
                                {rawCost.toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 whitespace-nowrap font-black text-emerald-700">
                                +{netProfit.toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 whitespace-nowrap text-[11px] text-brand-500">
                                {new Date(ord.createdAt).toLocaleString('en-US')}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoiceOrder(ord)}
                                  className="min-h-[38px] px-2.5 py-1 bg-[#231710] hover:bg-[#3A271C] text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
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
                  </DataTableShell>
                </div>
              )}

              {showCards && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-black text-brand-950">
                      بطاقات التدقيق المالي للفواتير ({filteredOrders.length} فاتورة)
                    </h3>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {paginatedOrders.map((ord) => {
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
                            <span className="font-mono font-bold text-xs bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2.5 py-1 rounded-lg">
                              {ord.orderNumber}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isPos
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {isPos ? 'كاشير POS' : 'متجر أونلاين'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <p className="font-black text-brand-950">{ord.customerName}</p>
                              <p className="text-[11px] text-brand-600 font-mono">
                                {ord.customerPhone} • {ord.governorate}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold bg-brand-50 text-brand-700 px-2 py-1 rounded-lg border border-brand-200">
                              {PAYMENT_METHOD_LABELS[ord.paymentMethod] || ord.paymentMethod}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center pt-1">
                            <div className="p-2 rounded-xl bg-brand-50">
                              <span className="text-[11px] text-brand-600 font-bold block">
                                الإجمالي
                              </span>
                              <span className="text-xs font-black text-brand-950">
                                {(ord.total || 0).toLocaleString('en-US')} ج
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-amber-50">
                              <span className="text-[11px] text-amber-800 font-bold block">
                                تكلفة الخامات
                              </span>
                              <span className="text-xs font-black text-amber-800">
                                {rawCost.toLocaleString('en-US')} ج
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-emerald-50">
                              <span className="text-[11px] text-emerald-800 font-bold block">
                                صافي الربح
                              </span>
                              <span className="text-xs font-black text-emerald-700">
                                +{netProfit.toLocaleString('en-US')} ج
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-brand-600 pt-2 border-t border-brand-100">
                            <span>
                              {ord.items?.length || 0} أصناف •{' '}
                              {new Date(ord.createdAt).toLocaleString('en-US')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceOrder(ord)}
                              className="min-h-[38px] px-2.5 py-1 bg-brand-100 hover:bg-brand-200 text-brand-950 rounded-lg font-black inline-flex items-center gap-1 cursor-pointer"
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

                  <DataTableShell
                    totalItems={report.shiftAudits.length}
                    currentPage={shiftsSafePage}
                    pageSize={TABLE_PAGE_SIZE}
                    onPageChange={setShiftsPage}
                  >
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
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
                        {paginatedShiftAudits.map((shift) => {
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
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    shift.status === 'open'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-brand-100 text-brand-800'
                                  }`}
                                >
                                  {shift.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-brand-800">
                                {shift.openingCash.toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 font-black text-brand-950">
                                {shift.cashSalesTotal.toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 font-bold text-indigo-700">
                                {shift.electronicSalesTotal.toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 font-bold text-rose-600">
                                -{shift.expensesTotal.toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 font-black text-brand-950">
                                {shift.expectedCashInDrawer.toLocaleString('en-US')} ج.م
                              </td>
                              <td className="p-3 font-bold text-brand-800">
                                {shift.actualClosingCash !== undefined
                                  ? `${shift.actualClosingCash.toLocaleString('en-US')} ج.م`
                                  : '—'}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
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
                                {shift.totalNetProfit.toLocaleString('en-US')} ج.م
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
                                  className="min-h-[38px] py-1 px-2.5 bg-[#FAF6F0] hover:bg-[#F2EAE0] text-[#231710] rounded-lg font-bold text-[11px] border border-[#E8E0D5] inline-flex items-center gap-1 cursor-pointer"
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
                  </DataTableShell>
                </div>
              )}

              {/* Shifts Cards View */}
              {showCards && (
                <div className="space-y-3">
                  <h3 className="text-sm sm:text-base font-black text-brand-950">
                    بطاقات تدقيق ورديات الكاشير والدرج ({filteredShifts.length} وردية)
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {filteredShifts.map((shift) => {
                      const diff = shift.cashDifference ?? shift.variance ?? 0;
                      return (
                        <div
                          key={shift.id}
                          className="bg-white rounded-3xl p-5 border border-brand-200 shadow-xs hover:shadow-md transition space-y-3.5"
                        >
                          <div className="flex items-center justify-between border-b border-brand-100 pb-3">
                            <div>
                              <span className="font-mono font-bold text-xs bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2.5 py-1 rounded-lg">
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
                              <span className="text-[11px] text-brand-600 font-bold block">
                                إجمالي مبيعات الوردية
                              </span>
                              <span className="text-sm font-black text-brand-950">
                                {(shift.totalRevenue || 0).toLocaleString('en-US')} ج.م
                              </span>
                            </div>
                            <div className="p-2.5 rounded-2xl bg-emerald-50">
                              <span className="text-[11px] text-emerald-800 font-bold block">
                                صافي ربح الوردية
                              </span>
                              <span className="text-sm font-black text-emerald-800">
                                {(shift.totalNetProfit || 0).toLocaleString('en-US')} ج.م
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs font-bold text-brand-700">
                            <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-brand-50/60">
                              <span>عهدة بداية الدرج:</span>
                              <span className="font-black text-brand-950">
                                {(shift.openingCash || 0).toLocaleString('en-US')} ج.م
                              </span>
                            </div>
                            <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-rose-50/60">
                              <span>المصروفات من الدرج:</span>
                              <span className="font-black text-rose-700">
                                -{(shift.expensesTotal || 0).toLocaleString('en-US')} ج.م
                              </span>
                            </div>
                            <div className="flex justify-between px-2.5 py-1.5 rounded-xl bg-indigo-50/70">
                              <span>المتوقع بالدرج:</span>
                              <span className="font-black text-indigo-800">
                                {(shift.expectedCashInDrawer || 0).toLocaleString('en-US')} ج.م
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
                                  ).toLocaleString('en-US')}{' '}
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
                            className="w-full py-2 px-3 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
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
                فواتير مشتريات معتمدة ومضافة للمخزون
              </span>
              <p className="text-xl font-black text-emerald-800 mt-1">
                {report.supplyFinancials.approvedTotal.toLocaleString('en-US')} ج.م
              </p>
              <span className="text-[11px] text-emerald-700 font-bold">
                ({report.supplyFinancials.approvedCount} فاتورة معتمدة)
              </span>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-amber-200 shadow-xs">
              <span className="text-xs font-bold text-amber-700 block">
                فواتير مشتريات قيد المراجعة
              </span>
              <p className="text-xl font-black text-amber-800 mt-1">
                {report.supplyFinancials.pendingTotal.toLocaleString('en-US')} ج.م
              </p>
              <span className="text-[11px] text-amber-700 font-bold">
                ({report.supplyFinancials.pendingCount} فاتورة معلقة)
              </span>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-brand-200 shadow-xs">
              <span className="text-xs font-bold text-brand-600 block">
                فواتير توريد مرفوضة
              </span>
              <p className="text-xl font-black text-brand-950 mt-1">
                {report.supplyFinancials.rejectedTotal.toLocaleString('en-US')} ج.م
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

                  <DataTableShell
                    totalItems={filteredSupplyInvoices.length}
                    currentPage={supplySafePage}
                    pageSize={TABLE_PAGE_SIZE}
                    onPageChange={setSupplyPage}
                  >
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
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
                        {paginatedSupplyInvoices.map((inv) => {
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
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
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
                                  {inv.totalAmount.toLocaleString('en-US')} ج.م
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
                                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center p-1.5 text-brand-600 hover:text-brand-950 rounded-lg hover:bg-brand-100 cursor-pointer"
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
                                              الإجمالي: {it.totalCost.toLocaleString('en-US')} ج.م
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
                  </DataTableShell>
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
                        <span className="font-mono font-bold text-xs bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2.5 py-1 rounded-lg">
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
                          <p className="text-[11px] text-brand-600">
                            {new Date(inv.createdAt).toLocaleString('en-US')}
                          </p>
                        </div>
                        <div className="text-left">
                          <span className="text-[11px] text-brand-600 font-bold block">الإجمالي</span>
                          <span className="text-sm font-black text-emerald-800">
                            {inv.totalAmount.toLocaleString('en-US')} ج.م
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
                    <span className="text-[11px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">
                      {cat.count} حركة
                    </span>
                  </div>
                  <p className="text-lg font-black text-rose-600">
                    {cat.total.toLocaleString('en-US')} ج.م
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
                      className="min-h-[40px] py-1.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-900 font-black text-xs rounded-xl flex items-center gap-1.5 border border-brand-200 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير المصروفات CSV</span>
                    </button>
                  </div>

                  <DataTableShell
                    totalItems={filteredExpenses.length}
                    currentPage={expensesSafePage}
                    pageSize={TABLE_PAGE_SIZE}
                    onPageChange={setExpensesPage}
                  >
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
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
                        {paginatedExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-brand-50/70 transition">
                            <td className="p-3 font-mono text-brand-600">{exp.id.slice(0, 10)}</td>
                            <td className="p-3 font-bold text-brand-800">{exp.shiftId || 'عام'}</td>
                            <td className="p-3 font-black text-brand-950">{exp.title}</td>
                            <td className="p-3 font-black text-rose-600">
                              -{exp.amount.toLocaleString('en-US')} ج.م
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                {EXPENSE_CATEGORY_LABELS[exp.category] || exp.category}
                              </span>
                            </td>
                            <td className="p-3 text-brand-600 font-mono text-[11px]">
                              {new Date(exp.createdAt).toLocaleString('en-US')}
                            </td>
                            <td className="p-3 text-brand-600">{exp.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DataTableShell>
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
                          -{exp.amount.toLocaleString('en-US')} ج.م
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-black text-brand-950">{exp.title}</p>
                      {exp.notes && <p className="text-[11px] text-brand-600">{exp.notes}</p>}
                      <div className="flex items-center justify-between text-[11px] text-brand-600 pt-2 border-t border-brand-100">
                        <span className="font-mono">وردية: {exp.shiftId || 'عام'}</span>
                        <span>{new Date(exp.createdAt).toLocaleString('en-US')}</span>
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
              <span className="text-[11px] font-bold text-brand-600 block">
                إجمالي رصيد المخزون الفعلي
              </span>
              <span className="text-xl font-black text-brand-950 mt-0.5 block">
                {inventoryValuation.totalStockKg.toLocaleString('en-US')} كجم
              </span>
              <span className="text-[11px] text-brand-600 font-bold block mt-0.5">
                موزعة على {products.length} صنف بالكتالوج
              </span>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-amber-800 block">
                قيمة المخزون بتكلفة الجملة
              </span>
              <span className="text-xl font-black text-amber-950 mt-0.5 block">
                {inventoryValuation.totalWholesaleValue.toLocaleString('en-US')} ج.م
              </span>
              <span className="text-[11px] text-amber-800 font-bold block mt-0.5">
                رأس المال العامل في البضاعة الحالية
              </span>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 block">
                القيمة البيعية المتوقعة للمخزون
              </span>
              <span className="text-xl font-black text-emerald-950 mt-0.5 block">
                {inventoryValuation.totalRetailValue.toLocaleString('en-US')} ج.م
              </span>
              <span className="text-[11px] text-emerald-800 font-bold block mt-0.5">
                ربح متوقع: +{inventoryValuation.expectedInventoryProfit.toLocaleString('en-US')} ج.م
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
                  onClick={() => {
                    setMarginStockFilter(marginStockFilter === 'low' ? 'all' : 'low');
                    resetPagination();
                  }}
                  className="text-[11px] font-black text-rose-700 underline cursor-pointer"
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
                onChange={(e) => {
                  setMarginStockFilter(e.target.value as 'all' | 'low' | 'out');
                  resetPagination();
                }}
                className="min-h-[40px] bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
              >
                <option value="all">المخزون: كل الأصناف</option>
                <option value="low">نواقص حرجة (≤ 5 كجم)</option>
                <option value="out">أصناف نافدة (0 كجم)</option>
              </select>

              <select
                value={marginTierFilter}
                onChange={(e) => {
                  setMarginTierFilter(e.target.value as 'all' | 'high' | 'low');
                  resetPagination();
                }}
                className="min-h-[40px] bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
              >
                <option value="all">الهامش: كل المستويات</option>
                <option value="high">هامش مرتفع (≥ 20%)</option>
                <option value="low">هامش منخفض (&lt; 15%)</option>
              </select>
            </div>
          </div>

          {/* Full Catalog Margin Audit Table */}
          {showTables && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-brand-200 shadow-xs">
              <DataTableShell
                totalItems={productMarginAnalytics.length}
                currentPage={marginsSafePage}
                pageSize={TABLE_PAGE_SIZE}
                onPageChange={setMarginsPage}
              >
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
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
                    {paginatedProductMargins.map((p) => (
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
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
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
                              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] px-1.5 py-0.5 rounded font-bold">
                                أونلاين
                              </span>
                            )}
                            {p.showInPos !== false && (
                              <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[11px] px-1.5 py-0.5 rounded font-bold">
                                كاشير
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            </div>
          )}

          {/* Product Profitability Cards */}
          {showCards && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
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
                      <span className="text-[11px] text-brand-600">
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
                      <span className="text-[11px] text-amber-800 font-bold block">
                        التكلفة + التغليف
                      </span>
                      <span className="text-xs font-black text-amber-900">
                        {p.totalUnitCost} ج.م
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-brand-50">
                      <span className="text-[11px] text-brand-600 font-bold block">
                        سعر البيع / كجم
                      </span>
                      <span className="text-xs font-black text-brand-950">{p.retailKg} ج.م</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50">
                      <span className="text-[11px] text-emerald-800 font-bold block">
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

      {activeSubTab === 'treasury_ledgers' && (
        <TreasuryAndLedgersModule
          readOnly={!canMutate}
          supplyInvoices={supplyInvoices}
          onOpenSupplyTab={onOpenSupplyInvoicesTab}
          onRefreshStore={onRefreshStore}
        />
      )}

      {activeSubTab === 'advanced_reports' && (
        <AdvancedCompetitorReports
          products={products}
          categories={categories}
          orders={filteredOrders}
          posExpenses={filteredExpenses}
          supplyInvoices={filteredSupplyInvoices}
          vipMembers={vipMembers}
          currency={settings?.currencySymbol || 'ج.م'}
        />
      )}
          </div>
        </div>
      </section>

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

      <InventoryAdjustmentModal
        isOpen={showInventoryModal}
        onClose={() => setShowInventoryModal(false)}
        products={products}
        currentRole="accountant"
      />
    </div>
  );
}

export { AccountantIsolationPortal };
