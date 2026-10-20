/**
 * Pure Financial Calculation Engine for 'محمصة حفصة للبن والمكسرات'
 *
 * Provides authoritative accounting reconciliation and audit reporting for:
 * - Online Store vs In-Store POS Channel Segregation
 * - Cost of Goods Sold (COGS), Gross Profit & Gross Margin %
 * - Operational Petty Cash Expenses & Net Operating Profit %
 * - POS Shift Drawer Cash Reconciliation (Expected vs Actual, Shortage/Surplus)
 * - Vendor Supply Invoices Ledger & Outstanding Liabilities
 * - VIP Cashback & Wallet Liabilities
 * - Period Filtering ('all', 'today', 'this_week', 'this_month', 'custom')
 * - RFC 4180 / UTF-8 BOM CSV Exports with CWE-1236 Formula Injection Neutralization
 *
 * ZERO Node-only imports (no node:fs, node:crypto, node:path) - 100% browser & client safe.
 */

import {
  Order,
  Product,
  PosShift,
  PosExpense,
  SupplyInvoice,
  VipMember,
} from '@/types/store';
import { escapeCsvField } from '@/lib/csv';

export type DateRangePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'custom';

export interface FinancialDateRangeFilter {
  preset?: DateRangePreset;
  startDate?: string; // YYYY-MM-DD or ISO string
  endDate?: string;   // YYYY-MM-DD or ISO string
}

export interface ChannelFinancialMetrics {
  channel: 'online' | 'pos' | 'combined';
  orderCount: number;
  grossRevenue: number;
  subtotal: number;
  discountTotal: number;
  shippingRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  avgTicket: number;
}

export interface ShiftReconciliationAudit {
  shiftId: string;
  shiftNumber: string;
  cashierName: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashSalesTotal: number;
  electronicSalesTotal: number;
  expensesTotal: number;
  expectedCashInDrawer: number;
  actualClosingCash?: number;
  variance: number; // actualClosingCash - expectedCashInDrawer
  varianceType: 'balanced' | 'surplus' | 'shortage';
  ordersCount: number;
  totalRevenue: number;
  totalRawCost: number;
  totalNetProfit: number;
}

export interface SupplyInvoicesFinancials {
  approvedTotal: number;
  approvedCount: number;
  pendingTotal: number;
  pendingCount: number;
  rejectedTotal: number;
  rejectedCount: number;
}

export interface FinancialSummaryReport {
  dateFilter: FinancialDateRangeFilter;
  generatedAt: string;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: number;
  netOperatingProfit: number;
  netMarginPercent: number;
  onlineMetrics: ChannelFinancialMetrics;
  posMetrics: ChannelFinancialMetrics;
  shiftAudits: ShiftReconciliationAudit[];
  totalDrawerVariance: number;
  totalDrawerShortage: number;
  totalDrawerSurplus: number;
  supplyFinancials: SupplyInvoicesFinancials;
  vipLiabilities: {
    totalPointsBalance: number;
    membersCount: number;
  };
}

/**
 * Standard monetary rounding helper (2 decimal places)
 */
export function roundCurrency(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

/**
 * Standard percentage rounding helper (1 decimal place)
 */
export function roundPercentage(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 10) / 10;
}

/**
 * Determines whether an order originated from the online customer storefront.
 */
export function isOnlineOrder(order: Order): boolean {
  if (!order) return false;
  return order.orderSource !== 'pos' && !order.orderNumber?.startsWith('POS-');
}

/**
 * Determines whether an order originated from the in-store cashier POS.
 */
export function isPosOrder(order: Order): boolean {
  if (!order) return false;
  return order.orderSource === 'pos' || order.orderNumber?.startsWith('POS-');
}

/**
 * Extracts the timestamp ISO string from an entity.
 */
function extractTimestamp(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  if (typeof obj.createdAt === 'string') return obj.createdAt;
  if (typeof obj.openedAt === 'string') return obj.openedAt;
  if (typeof obj.date === 'string') return obj.date;
  if (typeof obj.startTime === 'string') return obj.startTime;
  return null;
}

/**
 * Filters items by financial date range (all, today, this_week, this_month, custom).
 */
export function filterItemsByDateRange<T>(
  items: T[],
  filter?: FinancialDateRangeFilter
): T[] {
  if (!Array.isArray(items)) return [];
  if (!filter || !filter.preset || filter.preset === 'all') {
    return items;
  }

  const now = new Date();

  return items.filter((item) => {
    const rawTs = extractTimestamp(item);
    if (!rawTs) return true; // Keep items with indeterminate dates by default

    const itemDate = new Date(rawTs);
    if (isNaN(itemDate.getTime())) return true;

    if (filter.preset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return itemDate >= todayStart && itemDate <= todayEnd;
    }

    if (filter.preset === 'this_week') {
      // Last 7 rolling days
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      return itemDate >= weekStart;
    }

    if (filter.preset === 'this_month') {
      // Beginning of current calendar month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return itemDate >= monthStart;
    }

    if (filter.preset === 'custom') {
      if (filter.startDate) {
        const start = new Date(filter.startDate);
        start.setHours(0, 0, 0, 0);
        if (!isNaN(start.getTime()) && itemDate < start) return false;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        if (!isNaN(end.getTime()) && itemDate > end) return false;
      }
      return true;
    }

    return true;
  });
}

/**
 * Calculates Cost of Goods Sold (COGS) for an individual order.
 * Evaluates precomputed rawCostTotal or parses constituent item costs.
 */
export function calculateOrderCogs(order: Order, products?: Product[]): number {
  if (!order) return 0;

  // 1. If precomputed rawCostTotal is available and valid, use it directly
  if (typeof order.rawCostTotal === 'number' && order.rawCostTotal >= 0) {
    return roundCurrency(order.rawCostTotal);
  }

  // 2. Otherwise compute from cart items
  if (!Array.isArray(order.items) || order.items.length === 0) {
    return 0;
  }

  let totalCost = 0;
  const productsMap = new Map<string, Product>();
  if (Array.isArray(products)) {
    for (const p of products) {
      if (p.id) productsMap.set(p.id, p);
    }
  }

  for (const item of order.items) {
    const qty = item.quantity || 1;

    // A. Item has explicit rawCostEgp
    if (typeof item.rawCostEgp === 'number' && item.rawCostEgp > 0) {
      totalCost += item.rawCostEgp * qty;
      continue;
    }

    // B. Custom mix box breakdown
    if (item.isCustomMix && Array.isArray(item.customBreakdown)) {
      let boxCost = 0;
      for (const slot of item.customBreakdown) {
        const prod = productsMap.get(slot.productId);
        const costPerKg = prod?.costPerKg || 400;
        const grams = slot.weightGrams || 0;
        boxCost += (grams / 1000) * costPerKg;
      }
      totalCost += boxCost * qty;
      continue;
    }

    // C. Partitioned box breakdown
    if (item.isPartitionedBox && Array.isArray(item.partitionedSlots)) {
      let pBoxCost = 0;
      for (const slot of item.partitionedSlots) {
        const prod = productsMap.get(slot.productId);
        const costPerKg = slot.costPerKg || prod?.costPerKg || 300;
        const grams = slot.slotGrams || slot.weightGrams || 100;
        pBoxCost += (grams / 1000) * costPerKg;
      }
      totalCost += pBoxCost * qty;
      continue;
    }

    // D. Product catalog lookup by productId
    const prod = productsMap.get(item.productId);
    if (prod && typeof prod.costPerKg === 'number' && prod.costPerKg > 0) {
      let grams = item.customWeightGrams || 0;
      if (!grams && item.weightLabel) {
        const match = item.weightLabel.match(/(\d+)\s*جم/);
        if (match) grams = parseInt(match[1], 10);
      }
      if (!grams && item.weightId) {
        const match = item.weightId.match(/(\d+)/);
        if (match) grams = parseInt(match[1], 10);
      }
      if (!grams) grams = 250; // Fallback average weight (quarter kilo)

      const unitCost = (grams / 1000) * prod.costPerKg + (prod.packagingCost || 0);
      totalCost += unitCost * qty;
      continue;
    }

    // E. Conservative fallback: assume 65% wholesale cost of unitPrice
    if (typeof item.unitPrice === 'number' && item.unitPrice > 0) {
      totalCost += item.unitPrice * 0.65 * qty;
    }
  }

  return roundCurrency(totalCost);
}

/**
 * Calculates channel-specific financial metrics (online or pos).
 */
export function calculateChannelMetrics(
  orders: Order[],
  channel: 'online' | 'pos' | 'combined',
  products?: Product[]
): ChannelFinancialMetrics {
  const eligible = (orders || []).filter((order) => {
    if (order.status === 'cancelled') return false;
    if (channel === 'online') return isOnlineOrder(order);
    if (channel === 'pos') return isPosOrder(order);
    return true; // 'combined'
  });

  const orderCount = eligible.length;
  let grossRevenue = 0;
  let subtotal = 0;
  let discountTotal = 0;
  let shippingRevenue = 0;
  let cogs = 0;

  for (const o of eligible) {
    grossRevenue += o.total || 0;
    subtotal += o.subtotal || 0;
    discountTotal += (o.discountAmount || 0) + (o.vipRedeemedAmount || o.vipWalletRedeemed || 0);
    shippingRevenue += o.shippingCost || 0;
    cogs += calculateOrderCogs(o, products);
  }

  grossRevenue = roundCurrency(grossRevenue);
  subtotal = roundCurrency(subtotal);
  discountTotal = roundCurrency(discountTotal);
  shippingRevenue = roundCurrency(shippingRevenue);
  cogs = roundCurrency(cogs);

  const grossProfit = roundCurrency(grossRevenue - cogs);
  const grossMarginPercent = grossRevenue > 0
    ? roundPercentage((grossProfit / grossRevenue) * 100)
    : 0;
  const avgTicket = orderCount > 0
    ? roundCurrency(grossRevenue / orderCount)
    : 0;

  return {
    channel,
    orderCount,
    grossRevenue,
    subtotal,
    discountTotal,
    shippingRevenue,
    cogs,
    grossProfit,
    grossMarginPercent,
    avgTicket,
  };
}

/**
 * Calculates POS shift drawer cash reconciliation audit metrics.
 */
export function calculateShiftAudit(shift: PosShift): ShiftReconciliationAudit {
  const openingCash = roundCurrency(shift.openingCash ?? shift.startingCash ?? 0);
  const cashSalesTotal = roundCurrency(shift.cashSalesTotal ?? shift.cashSales ?? 0);
  const electronicSalesTotal = roundCurrency(
    (shift.cardSales || 0) +
    (shift.vodafoneCashTotal || 0) +
    (shift.instapayTotal || 0)
  );
  const expensesTotal = roundCurrency(shift.expensesTotal ?? shift.expenses ?? 0);

  const expectedCashInDrawer = roundCurrency(
    shift.expectedCashInDrawer ??
    shift.expectedCash ??
    (openingCash + cashSalesTotal - expensesTotal)
  );

  const actualClosingCash =
    shift.actualClosingCash !== undefined
      ? roundCurrency(shift.actualClosingCash)
      : shift.actualCash !== undefined
      ? roundCurrency(shift.actualCash)
      : undefined;

  let variance = 0;
  if (actualClosingCash !== undefined) {
    variance = roundCurrency(actualClosingCash - expectedCashInDrawer);
  } else if (shift.variance !== undefined) {
    variance = roundCurrency(shift.variance);
  } else if (shift.cashDifference !== undefined) {
    variance = roundCurrency(shift.cashDifference);
  }

  let varianceType: 'balanced' | 'surplus' | 'shortage' = 'balanced';
  if (variance > 0) {
    varianceType = 'surplus';
  } else if (variance < 0) {
    varianceType = 'shortage';
  }

  return {
    shiftId: shift.id,
    shiftNumber: shift.shiftNumber || shift.id,
    cashierName: shift.cashierName || 'كاشير الفرع',
    status: shift.status || 'closed',
    openedAt: shift.openedAt || shift.startTime || '',
    closedAt: shift.closedAt || shift.endTime,
    openingCash,
    cashSalesTotal,
    electronicSalesTotal,
    expensesTotal,
    expectedCashInDrawer,
    actualClosingCash,
    variance,
    varianceType,
    ordersCount: shift.ordersCount || 0,
    totalRevenue: roundCurrency(shift.totalRevenue || (cashSalesTotal + electronicSalesTotal)),
    totalRawCost: roundCurrency(shift.totalRawCost || 0),
    totalNetProfit: roundCurrency(shift.totalNetProfit || 0),
  };
}

/**
 * Summarizes supply invoices financial liabilities.
 */
export function calculateSupplyInvoicesFinancials(
  invoices: SupplyInvoice[]
): SupplyInvoicesFinancials {
  let approvedTotal = 0;
  let approvedCount = 0;
  let pendingTotal = 0;
  let pendingCount = 0;
  let rejectedTotal = 0;
  let rejectedCount = 0;

  for (const inv of invoices || []) {
    const amount = inv.totalAmount || 0;
    if (inv.status === 'approved') {
      approvedTotal += amount;
      approvedCount += 1;
    } else if (inv.status === 'pending') {
      pendingTotal += amount;
      pendingCount += 1;
    } else if (inv.status === 'rejected') {
      rejectedTotal += amount;
      rejectedCount += 1;
    }
  }

  return {
    approvedTotal: roundCurrency(approvedTotal),
    approvedCount,
    pendingTotal: roundCurrency(pendingTotal),
    pendingCount,
    rejectedTotal: roundCurrency(rejectedTotal),
    rejectedCount,
  };
}

/**
 * Master calculation aggregating all financial reports across the business.
 */
export function calculateFinancialSummary(params: {
  orders?: Order[];
  products?: Product[];
  posShifts?: PosShift[];
  posExpenses?: PosExpense[];
  supplyInvoices?: SupplyInvoice[];
  vipMembers?: VipMember[];
  dateFilter?: FinancialDateRangeFilter;
}): FinancialSummaryReport {
  const {
    orders = [],
    products = [],
    posShifts = [],
    posExpenses = [],
    supplyInvoices = [],
    vipMembers = [],
    dateFilter = { preset: 'all' },
  } = params;

  // Filter entities according to selected period
  const filteredOrders = filterItemsByDateRange(orders, dateFilter);
  const filteredShifts = filterItemsByDateRange(posShifts, dateFilter);
  const filteredExpenses = filterItemsByDateRange(posExpenses, dateFilter);
  const filteredSupplyInvoices = filterItemsByDateRange(supplyInvoices, dateFilter);

  // Channel metrics
  const onlineMetrics = calculateChannelMetrics(filteredOrders, 'online', products);
  const posMetrics = calculateChannelMetrics(filteredOrders, 'pos', products);

  // Total Revenues & COGS
  const totalRevenue = roundCurrency(onlineMetrics.grossRevenue + posMetrics.grossRevenue);
  const totalCogs = roundCurrency(onlineMetrics.cogs + posMetrics.cogs);
  const grossProfit = roundCurrency(totalRevenue - totalCogs);
  const grossMarginPercent = totalRevenue > 0
    ? roundPercentage((grossProfit / totalRevenue) * 100)
    : 0;

  // Operational Expenses
  let operatingExpenses = 0;
  for (const exp of filteredExpenses) {
    operatingExpenses += exp.amount || 0;
  }
  operatingExpenses = roundCurrency(operatingExpenses);

  // Net Operating Profit
  const netOperatingProfit = roundCurrency(grossProfit - operatingExpenses);
  const netMarginPercent = totalRevenue > 0
    ? roundPercentage((netOperatingProfit / totalRevenue) * 100)
    : 0;

  // Shift Audits & Drawer Variances
  const shiftAudits = filteredShifts.map(calculateShiftAudit);
  let totalDrawerVariance = 0;
  let totalDrawerShortage = 0;
  let totalDrawerSurplus = 0;

  for (const audit of shiftAudits) {
    if (audit.status === 'closed') {
      totalDrawerVariance += audit.variance;
      if (audit.variance < 0) {
        totalDrawerShortage += Math.abs(audit.variance);
      } else if (audit.variance > 0) {
        totalDrawerSurplus += audit.variance;
      }
    }
  }

  totalDrawerVariance = roundCurrency(totalDrawerVariance);
  totalDrawerShortage = roundCurrency(totalDrawerShortage);
  totalDrawerSurplus = roundCurrency(totalDrawerSurplus);

  // Supply Invoices
  const supplyFinancials = calculateSupplyInvoicesFinancials(filteredSupplyInvoices);

  // VIP Liabilities
  let totalPointsBalance = 0;
  for (const m of vipMembers) {
    totalPointsBalance += m.pointsBalance || m.walletBalance || m.walletBalanceEgp || 0;
  }

  return {
    dateFilter,
    generatedAt: new Date().toISOString(),
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPercent,
    operatingExpenses,
    netOperatingProfit,
    netMarginPercent,
    onlineMetrics,
    posMetrics,
    shiftAudits,
    totalDrawerVariance,
    totalDrawerShortage,
    totalDrawerSurplus,
    supplyFinancials,
    vipLiabilities: {
      totalPointsBalance: roundCurrency(totalPointsBalance),
      membersCount: vipMembers.length,
    },
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CSV EXPORT GENERATORS (UTF-8 BOM + RFC 4180 + CWE-1236 Injection Defense)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CSV_BOM = '\uFEFF';
const CRLF = '\r\n';

/**
 * Generates an executive summary CSV comparing channels, revenues, COGS, and profit.
 */
export function generateFinancialSummaryCsv(report: FinancialSummaryReport): string {
  const lines: string[] = [];

  // Header Section
  lines.push(
    [
      escapeCsvField('محمصة حفصة للبن والمكسرات - تقرير التدقيق المالي الشامل'),
      escapeCsvField(`تاريخ الإنشاء: ${report.generatedAt}`),
      escapeCsvField(`الفترة المحددة: ${report.dateFilter.preset || 'الكل'}`),
    ].join(',')
  );
  lines.push('');

  // 1. Executive P&L Overview
  lines.push(
    [
      escapeCsvField('بند قائمة الدخل والربحية'),
      escapeCsvField('القيمة (ج.م)'),
      escapeCsvField('النسبة المئوية %'),
    ].join(',')
  );
  lines.push([escapeCsvField('إجمالي إيرادات المبيعات'), escapeCsvField(report.totalRevenue), escapeCsvField('100%')].join(','));
  lines.push([escapeCsvField('تكلفة البضاعة المباعة (COGS)'), escapeCsvField(report.totalCogs), escapeCsvField(`${report.totalRevenue > 0 ? roundPercentage((report.totalCogs / report.totalRevenue) * 100) : 0}%`)].join(','));
  lines.push([escapeCsvField('إجمالي الربح التجاري (Gross Profit)'), escapeCsvField(report.grossProfit), escapeCsvField(`${report.grossMarginPercent}%`)].join(','));
  lines.push([escapeCsvField('المصروفات النثرية والتشغيلية'), escapeCsvField(report.operatingExpenses), escapeCsvField(`${report.totalRevenue > 0 ? roundPercentage((report.operatingExpenses / report.totalRevenue) * 100) : 0}%`)].join(','));
  lines.push([escapeCsvField('صافي الربح التشغيلي الفعلي (Net Profit)'), escapeCsvField(report.netOperatingProfit), escapeCsvField(`${report.netMarginPercent}%`)].join(','));
  lines.push([escapeCsvField('صافي فارق درج الكاشير (عجز / فائض)'), escapeCsvField(report.totalDrawerVariance), escapeCsvField('')].join(','));
  lines.push('');

  // 2. Channel Comparison Table
  lines.push(
    [
      escapeCsvField('قناة البيع'),
      escapeCsvField('عدد الطلبات / الفواتير'),
      escapeCsvField('إجمالي الإيرادات (ج.م)'),
      escapeCsvField('المجموع الفرعي (ج.م)'),
      escapeCsvField('إجمالي الخصومات (ج.م)'),
      escapeCsvField('إيراد التوصيل (ج.م)'),
      escapeCsvField('تكلفة البضاعة COGS (ج.م)'),
      escapeCsvField('الربح الإجمالي (ج.م)'),
      escapeCsvField('هامش الربح %'),
      escapeCsvField('متوسط قيمة الفاتورة (ج.م)'),
    ].join(',')
  );

  const channels = [
    { label: 'المتجر الإلكتروني (Online Storefront)', m: report.onlineMetrics },
    { label: 'كاشير المحل المباشر (POS Store Terminal)', m: report.posMetrics },
  ];

  for (const c of channels) {
    lines.push(
      [
        escapeCsvField(c.label),
        escapeCsvField(c.m.orderCount),
        escapeCsvField(c.m.grossRevenue),
        escapeCsvField(c.m.subtotal),
        escapeCsvField(c.m.discountTotal),
        escapeCsvField(c.m.shippingRevenue),
        escapeCsvField(c.m.cogs),
        escapeCsvField(c.m.grossProfit),
        escapeCsvField(`${c.m.grossMarginPercent}%`),
        escapeCsvField(c.m.avgTicket),
      ].join(',')
    );
  }
  lines.push('');

  // 3. Supply Invoices Summary
  lines.push(
    [
      escapeCsvField('حالة فواتير التوريد'),
      escapeCsvField('العدد'),
      escapeCsvField('إجمالي المبالغ (ج.م)'),
    ].join(',')
  );
  lines.push([escapeCsvField('فواتير معتمدة (تمت إضافة المخزون)'), escapeCsvField(report.supplyFinancials.approvedCount), escapeCsvField(report.supplyFinancials.approvedTotal)].join(','));
  lines.push([escapeCsvField('فواتير معلقة (بانتظار موافقة الإدارة)'), escapeCsvField(report.supplyFinancials.pendingCount), escapeCsvField(report.supplyFinancials.pendingTotal)].join(','));
  lines.push([escapeCsvField('فواتير مرفوضة'), escapeCsvField(report.supplyFinancials.rejectedCount), escapeCsvField(report.supplyFinancials.rejectedTotal)].join(','));

  return CSV_BOM + lines.join(CRLF);
}

/**
 * Generates an Excel-ready CSV ledger of POS Shifts and Cash Drawer Reconciliation.
 */
export function generateShiftsAuditCsv(shifts: PosShift[]): string {
  const headers = [
    'رقم الوردية',
    'اسم الكاشير',
    'الحالة',
    'تاريخ الفتح',
    'تاريخ الإغلاق',
    'رصيد البداية (ج.م)',
    'المبيعات النقدية (ج.م)',
    'المبيعات الإلكترونية (ج.م)',
    'المصروفات النثرية (ج.م)',
    'النقدية المتوقعة بالدرج (ج.م)',
    'النقدية الفعلية المحصية (ج.م)',
    'الفارق (ج.م)',
    'نوع الفارق',
    'عدد الفواتير',
    'إجمالي الإيراد (ج.م)',
    'إجمالي التكلفة (ج.م)',
    'صافي الربح (ج.م)',
  ];

  const rows = (shifts || []).map((s) => {
    const audit = calculateShiftAudit(s);
    const varianceLabel =
      audit.varianceType === 'balanced'
        ? 'مطابق'
        : audit.varianceType === 'surplus'
        ? 'فائض (+)'
        : 'عجز (-)';

    return [
      escapeCsvField(audit.shiftNumber),
      escapeCsvField(audit.cashierName),
      escapeCsvField(audit.status === 'open' ? 'مفتوحة' : 'مغلقة'),
      escapeCsvField(audit.openedAt),
      escapeCsvField(audit.closedAt || 'مستمرة'),
      escapeCsvField(audit.openingCash),
      escapeCsvField(audit.cashSalesTotal),
      escapeCsvField(audit.electronicSalesTotal),
      escapeCsvField(audit.expensesTotal),
      escapeCsvField(audit.expectedCashInDrawer),
      escapeCsvField(audit.actualClosingCash !== undefined ? audit.actualClosingCash : ''),
      escapeCsvField(audit.variance),
      escapeCsvField(varianceLabel),
      escapeCsvField(audit.ordersCount),
      escapeCsvField(audit.totalRevenue),
      escapeCsvField(audit.totalRawCost),
      escapeCsvField(audit.totalNetProfit),
    ].join(',');
  });

  return CSV_BOM + [headers.map(escapeCsvField).join(','), ...rows].join(CRLF);
}

/**
 * Generates an Excel-ready CSV ledger of operational petty expenses.
 */
export function generateExpensesLedgerCsv(expenses: PosExpense[]): string {
  const headers = [
    'المعرف',
    'معرف الوردية',
    'بيان المصروف',
    'المبلغ (ج.م)',
    'التصنيف',
    'التاريخ',
    'ملاحظات',
  ];

  const categoryLabels: Record<string, string> = {
    raw_materials: 'خامات ومواد أولية',
    packaging: 'تعبئة وتغليف وأكياس',
    utilities: 'مرافق وكهرباء ونظافة',
    delivery_rider: 'أجرة طيار التوصيل',
    other: 'مصروفات نثرية أخرى',
  };

  const rows = (expenses || []).map((exp) => [
    escapeCsvField(exp.id),
    escapeCsvField(exp.shiftId || ''),
    escapeCsvField(exp.title),
    escapeCsvField(exp.amount),
    escapeCsvField(categoryLabels[exp.category] || exp.category),
    escapeCsvField(exp.createdAt),
    escapeCsvField(exp.notes || ''),
  ].join(','));

  return CSV_BOM + [headers.map(escapeCsvField).join(','), ...rows].join(CRLF);
}

/**
 * Generates an Excel-ready CSV ledger of vendor supply invoices.
 */
export function generateSupplyLedgerCsv(invoices: SupplyInvoice[]): string {
  const headers = [
    'رقم الفاتورة',
    'المورد',
    'الحالة',
    'تاريخ الإنشاء',
    'تاريخ الاعتماد / المراجعة',
    'المعتمد بواسطة',
    'إجمالي الفاتورة (ج.م)',
    'عدد الأصناف',
    'تفاصيل الأصناف الموردة',
    'ملاحظات المورد',
    'ملاحظات الإدارة',
  ];

  const statusLabels: Record<string, string> = {
    pending: 'معلقة (بانتظار الاعتماد)',
    approved: 'معتمدة ومضافة للمخزون',
    rejected: 'مرفوضة',
  };

  const rows = (invoices || []).map((inv) => {
    const itemsDetail = (inv.items || [])
      .map((it) => `${it.productName} (${it.quantityKg} كجم × ${it.costPerKg} ج.م = ${it.totalCost} ج.م)`)
      .join(' | ');

    return [
      escapeCsvField(inv.invoiceNumber),
      escapeCsvField(inv.supplierName),
      escapeCsvField(statusLabels[inv.status] || inv.status),
      escapeCsvField(inv.createdAt),
      escapeCsvField(inv.reviewedAt || ''),
      escapeCsvField(inv.reviewedBy || ''),
      escapeCsvField(inv.totalAmount),
      escapeCsvField((inv.items || []).length),
      escapeCsvField(itemsDetail),
      escapeCsvField(inv.notes || ''),
      escapeCsvField(inv.adminNotes || ''),
    ].join(',');
  });

  return CSV_BOM + [headers.map(escapeCsvField).join(','), ...rows].join(CRLF);
}
