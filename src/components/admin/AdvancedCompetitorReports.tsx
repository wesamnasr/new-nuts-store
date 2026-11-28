'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  PieChart,
  Printer,
  Users,
} from 'lucide-react';
import {
  Category,
  InventoryAdjustment,
  Order,
  PosExpense,
  Product,
  SupplyInvoice,
  VipMember,
  WarehouseTransfer,
} from '@/types/store';
import { getProductBarcode, isUnitProduct } from '@/lib/pricing';
import { triggerCsvDownload } from '@/lib/financials';

interface AdvancedCompetitorReportsProps {
  products: Product[];
  categories: Category[];
  orders: Order[];
  posExpenses: PosExpense[];
  supplyInvoices: SupplyInvoice[];
  vipMembers: VipMember[];
  currency: string;
}

type AdvReportId =
  | 'hourly_sales'
  | 'item_card'
  | 'movement_groups'
  | 'expense_analysis'
  | 'print_directory';

export default function AdvancedCompetitorReports({
  products,
  categories,
  orders,
  posExpenses,
  supplyInvoices,
  vipMembers,
  currency,
}: AdvancedCompetitorReportsProps) {
  const [activeReport, setActiveReport] = useState<AdvReportId>('hourly_sales');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [expenseLabelMap, setExpenseLabelMap] = useState<Record<string, string>>({
    raw_materials: 'خامات وتوريدات',
    packaging: 'أكياس وعبوات تغليف',
    utilities: 'كهرباء ومرافق وغاز',
    delivery_rider: 'طيارين وتوصيل طلبات',
    other: 'مصروفات تشغيلية أخرى',
  });
  const [printTab, setPrintTab] = useState<'items' | 'customers'>('items');

  useEffect(() => {
    let token = '';
    try {
      token =
        sessionStorage.getItem('admin_token') ||
        localStorage.getItem('admin_token') ||
        JSON.parse(localStorage.getItem('nuts_admin_session') || '{}')?.token ||
        '';
    } catch {}
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}`, 'x-admin-token': token }
      : {};

    Promise.all([
      fetch('/api/admin/inventory-adjustments', { headers }).then((r) =>
        r.ok ? r.json() : ({} as Record<string, unknown>)
      ),
      fetch('/api/admin/erp-modules', { headers }).then((r) =>
        r.ok ? r.json() : ({} as Record<string, unknown>)
      ),
    ])
      .then(([adjRes, erpRes]: [Record<string, unknown>, Record<string, unknown>]) => {
        if (Array.isArray(adjRes?.adjustments)) {
          setAdjustments(adjRes.adjustments as InventoryAdjustment[]);
        }
        if (Array.isArray(erpRes?.warehouseTransfers)) {
          setTransfers(erpRes.warehouseTransfers as WarehouseTransfer[]);
        }
        if (Array.isArray(erpRes?.expenseCategories)) {
          const map: Record<string, string> = {};
          for (const ec of erpRes.expenseCategories as Array<{ key: string; label: string }>) {
            map[ec.key] = ec.label;
          }
          setExpenseLabelMap((prev) => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
  }, []);

  const validOrders = useMemo(() => orders.filter((o) => o.status !== 'cancelled'), [orders]);

  // 1. Hourly Sales ("المبيعات بالساعة")
  const hourlyStats = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      ordersCount: 0,
      revenue: 0,
    }));
    for (const o of validOrders) {
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) continue;
      const h = d.getHours();
      buckets[h].ordersCount += 1;
      buckets[h].revenue += Number(o.total || 0);
    }
    const maxRev = Math.max(1, ...buckets.map((b) => b.revenue));
    return { buckets, maxRev };
  }, [validOrders]);

  // 2. Item Stock Card ("كارت صنف")
  const itemCardLedger = useMemo(() => {
    const prod = products.find((p) => p.id === selectedProductId) || products[0];
    if (!prod) return { product: null, rows: [] };

    const rows: Array<{
      date: string;
      type: string;
      ref: string;
      delta: number;
      notes: string;
    }> = [];

    // Supply purchases & returns
    for (const inv of supplyInvoices) {
      if (inv.status !== 'approved') continue;
      for (const it of inv.items || []) {
        if (it.productId === prod.id) {
          rows.push({
            date: inv.reviewedAt || inv.createdAt,
            type: 'توريد / مشتريات (+)',
            ref: inv.invoiceNumber,
            delta: Number(it.quantityUnits ?? it.quantityKg ?? 0),
            notes: `المورد: ${inv.supplierName}`,
          });
        }
      }
      for (const ret of inv.returns || inv.supplyReturns || []) {
        for (const it of ret.items || []) {
          if (it.productId === prod.id) {
            rows.push({
              date: ret.createdAt,
              type: 'مرتجع مشتريات (-)',
              ref: ret.returnNumber,
              delta: -Math.abs(Number(it.quantity || it.returnQty || 0)),
              notes: ret.reason || '',
            });
          }
        }
      }
    }

    // Sales & POS returns
    for (const ord of validOrders) {
      for (const it of ord.items || []) {
        if (it.productId === prod.id) {
          const qty = isUnitProduct(prod)
            ? Number(it.quantity || 1)
            : Number(((it.customWeightGrams || 250) * (it.quantity || 1)) / 1000);
          rows.push({
            date: ord.createdAt,
            type: ord.orderSource === 'pos' ? 'بيع كاشير (-)' : 'بيع أونلاين (-)',
            ref: ord.orderNumber,
            delta: -Math.round(qty * 1000) / 1000,
            notes: ord.customerName || '',
          });
        }
      }
      for (const r of ord.returnRecords || []) {
        for (const ri of r.items || []) {
          if (ri.productId === prod.id && ri.condition === 'restock') {
            const q = isUnitProduct(prod) ? ri.returnQty : ((ri.weightGrams || 250) * ri.returnQty) / 1000;
            rows.push({
              date: r.createdAt,
              type: 'مرتجع مبيعات (+)',
              ref: r.returnNumber,
              delta: Math.round(q * 1000) / 1000,
              notes: r.reason || '',
            });
          }
        }
      }
    }

    // Inventory adjustments
    for (const adj of adjustments) {
      if (adj.productId === prod.id) {
        rows.push({
          date: adj.createdAt,
          type: `تسوية جردية (${adj.reasonLabel})`,
          ref: adj.adjustmentNumber,
          delta: Number(adj.differenceKg || 0),
          notes: adj.notes || adj.adjustedBy,
        });
      }
    }

    // Warehouse transfers
    for (const tr of transfers) {
      if (tr.productId === prod.id) {
        rows.push({
          date: tr.createdAt,
          type: 'تحويل مخزني',
          ref: tr.transferNumber,
          delta: Number(tr.quantityKg || 0),
          notes: `${tr.fromWarehouseName} ← ${tr.toWarehouseName}`,
        });
      }
    }

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { product: prod, rows };
  }, [selectedProductId, products, supplyInvoices, validOrders, adjustments, transfers]);

  // 3. Item Movement & Category Inventory ("حركة الأصناف وجرد المجموعات")
  const categoryInventoryRows = useMemo(() => {
    const soldByProd = new Map<string, { qty: number; rev: number }>();
    for (const ord of validOrders) {
      for (const it of ord.items || []) {
        const prev = soldByProd.get(it.productId) || { qty: 0, rev: 0 };
        prev.qty += it.customWeightGrams ? (it.customWeightGrams * (it.quantity || 1)) / 1000 : it.quantity || 1;
        prev.rev += (it.unitPrice || 0) * (it.quantity || 1);
        soldByProd.set(it.productId, prev);
      }
    }

    return categories.map((cat) => {
      const catProds = products.filter((p) => p.categoryId === cat.id);
      let stockQty = 0;
      let stockCostVal = 0;
      let stockSellVal = 0;
      let periodSales = 0;
      for (const p of catProds) {
        const s = Number(p.stockKg || 0);
        const cost = Number(p.costPerKg ?? p.unitCost ?? 0);
        const price = Number(p.pricePerKg ?? p.unitPrice ?? 0);
        stockQty += s;
        stockCostVal += s * cost;
        stockSellVal += s * price;
        periodSales += soldByProd.get(p.id)?.rev || 0;
      }
      return {
        id: cat.id,
        name: cat.name,
        productsCount: catProds.length,
        stockQty: Math.round(stockQty * 100) / 100,
        stockCostVal: Math.round(stockCostVal),
        stockSellVal: Math.round(stockSellVal),
        periodSales: Math.round(periodSales),
      };
    });
  }, [categories, products, validOrders]);

  // 4. Expense Analysis ("تحليل المصروفات")
  const expenseAnalysis = useMemo(() => {
    const totalSales = validOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalExp = posExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const grouped = new Map<string, { key: string; label: string; count: number; amount: number }>();
    for (const e of posExpenses) {
      const k = e.category || 'other';
      const prev = grouped.get(k) || { key: k, label: expenseLabelMap[k] || k, count: 0, amount: 0 };
      prev.count += 1;
      prev.amount += Number(e.amount || 0);
      grouped.set(k, prev);
    }
    const rows = Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
    return { totalSales, totalExp, rows };
  }, [posExpenses, validOrders, expenseLabelMap]);

  const exportCurrentCsv = () => {
    let lines: string[] = [];
    if (activeReport === 'hourly_sales') {
      lines = ['الساعة,عدد الفواتير,إجمالي المبيعات', ...hourlyStats.buckets.map((b) => `${b.label},${b.ordersCount},${b.revenue}`)];
    } else if (activeReport === 'movement_groups') {
      lines = [
        'المجموعة,عدد الأصناف,الرصيد,القيمة بالتكلفة,القيمة بالبيع,مبيعات الفترة',
        ...categoryInventoryRows.map((r) => `"${r.name}",${r.productsCount},${r.stockQty},${r.stockCostVal},${r.stockSellVal},${r.periodSales}`),
      ];
    } else if (activeReport === 'expense_analysis') {
      lines = [
        'البند,عدد الحركات,الإجمالي,النسبة من المصروفات',
        ...expenseAnalysis.rows.map(
          (r) =>
            `"${r.label}",${r.count},${r.amount},${expenseAnalysis.totalExp > 0 ? ((r.amount / expenseAnalysis.totalExp) * 100).toFixed(1) : 0}%`
        ),
      ];
    } else if (activeReport === 'print_directory') {
      lines =
        printTab === 'items'
          ? ['الكود/الباركود,الصنف,التكلفة,السعر,الرصيد', ...products.map((p, i) => `"${getProductBarcode(p, i)}","${p.name}",${p.costPerKg ?? 0},${p.pricePerKg ?? 0},${p.stockKg ?? 0}`)]
          : ['العميل,الموبايل,رصيد VIP,الآجل,إجمالي المشتريات', ...vipMembers.map((m) => `"${m.name || m.customerName || ''}","${m.phone}",${m.walletBalance ?? m.pointsBalance ?? 0},${m.creditBalanceDue ?? 0},${m.totalSpent ?? 0}`)];
    } else {
      lines = [
        'التاريخ,الحركة,المرجع,الكمية,ملاحظات',
        ...itemCardLedger.rows.map((r) => `"${r.date}","${r.type}","${r.ref}",${r.delta},"${r.notes}"`),
      ];
    }
    triggerCsvDownload('\uFEFF' + lines.join('\n'), `mizan-${activeReport}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF6F0] p-2 rounded-xl border border-[#E8E0D5]">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'hourly_sales', label: 'المبيعات بالساعة', icon: <Clock className="w-3.5 h-3.5" /> },
            { id: 'item_card', label: 'كارت صنف تفصيلي', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
            { id: 'movement_groups', label: 'حركة الأصناف وجرد المجموعات', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'expense_analysis', label: 'تحليل المصروفات', icon: <PieChart className="w-3.5 h-3.5" /> },
            { id: 'print_directory', label: 'طباعة الأصناف والعملاء', icon: <Printer className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReport(tab.id as AdvReportId)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeReport === tab.id ? 'bg-[#231710] text-white' : 'text-[#6B5644] hover:text-[#231710]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCurrentCsv}
            className="inline-flex items-center gap-1 bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" /> تصدير CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 bg-[#231710] text-white px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5" /> طباعة
          </button>
        </div>
      </div>

      {/* 1. Hourly Sales Report */}
      {activeReport === 'hourly_sales' && (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4">
          <h3 className="font-cairo font-bold text-base text-[#231710] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#9A6836]" /> تحليل المبيعات وساعات الذروة (٢٤ ساعة)
          </h3>
          <div className="grid grid-cols-12 gap-1.5 items-end h-48 pt-4 px-2 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5]">
            {hourlyStats.buckets.filter((_, i) => i >= 8 && i <= 23).map((b) => {
              const pct = Math.max(4, Math.round((b.revenue / hourlyStats.maxRev) * 100));
              return (
                <div key={b.hour} className="col-span-1 flex flex-col items-center justify-end h-full group">
                  <div className="text-[9px] font-bold text-[#9A6836] mb-1 opacity-0 group-hover:opacity-100 transition">
                    {Math.round(b.revenue)}
                  </div>
                  <div
                    style={{ height: `${pct}%` }}
                    title={`${b.label}: ${b.revenue} ${currency} (${b.ordersCount} فاتورة)`}
                    className="w-full max-w-[26px] rounded-t-md bg-[#9A6836] hover:bg-[#231710] transition"
                  />
                  <span className="text-[9px] font-bold text-[#6B5644] mt-1">{b.hour}</span>
                </div>
              );
            })}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FAF6F0] border-b font-bold">
                <tr><th className="p-2.5">الساعة</th><th className="p-2.5">عدد الفواتير</th><th className="p-2.5">إجمالي المبيعات</th></tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE2]">
                {hourlyStats.buckets.filter((b) => b.ordersCount > 0).map((b) => (
                  <tr key={b.hour}>
                    <td className="p-2.5 font-bold">{b.label}</td>
                    <td className="p-2.5">{b.ordersCount} فاتورة</td>
                    <td className="p-2.5 font-bold text-[#231710]">{Math.round(b.revenue).toLocaleString('ar-EG')} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Item Stock Card */}
      {activeReport === 'item_card' && (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full max-w-md bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — الرصيد الحالي: {p.stockKg ?? 0} {isUnitProduct(p) ? p.unitLabel || 'قطعة' : 'كجم'}
                </option>
              ))}
            </select>
            {itemCardLedger.product && (
              <div className="text-xs font-bold bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl border border-emerald-200">
                إجمالي الحركات المسجلة: {itemCardLedger.rows.length} حركة
              </div>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FAF6F0] border-b font-bold">
                <tr><th className="p-2.5">التاريخ</th><th className="p-2.5">نوع الحركة</th><th className="p-2.5">المرجع</th><th className="p-2.5">الكمية (+/-)</th><th className="p-2.5">التفاصيل</th></tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE2]">
                {itemCardLedger.rows.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-[#6B5644]">لا توجد حركات مسجلة لهذا الصنف في الفترة المحددة</td></tr>
                ) : (
                  itemCardLedger.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-2.5">{new Date(r.date).toLocaleString('ar-EG')}</td>
                      <td className="p-2.5 font-bold">{r.type}</td>
                      <td className="p-2.5 font-mono">{r.ref}</td>
                      <td className={`p-2.5 font-bold ${r.delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {r.delta > 0 ? `+${r.delta}` : r.delta}
                      </td>
                      <td className="p-2.5 text-[#6B5644]">{r.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Category Inventory & Movement */}
      {activeReport === 'movement_groups' && (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5">
          <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FAF6F0] border-b font-bold">
                <tr>
                  <th className="p-2.5">المجموعة / القسم</th>
                  <th className="p-2.5">عدد الأصناف</th>
                  <th className="p-2.5">إجمالي الرصيد</th>
                  <th className="p-2.5">قيمة المخزون بالتكلفة</th>
                  <th className="p-2.5">قيمة المخزون بالبيع</th>
                  <th className="p-2.5">مبيعات الفترة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE2]">
                {categoryInventoryRows.map((row) => (
                  <tr key={row.id}>
                    <td className="p-2.5 font-bold text-[#231710]">{row.name}</td>
                    <td className="p-2.5">{row.productsCount}</td>
                    <td className="p-2.5 font-bold">{row.stockQty}</td>
                    <td className="p-2.5">{row.stockCostVal.toLocaleString('ar-EG')} {currency}</td>
                    <td className="p-2.5 font-bold text-emerald-700">{row.stockSellVal.toLocaleString('ar-EG')} {currency}</td>
                    <td className="p-2.5 font-bold text-[#9A6836]">{row.periodSales.toLocaleString('ar-EG')} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Expense Analysis */}
      {activeReport === 'expense_analysis' && (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E8E0D5]">
              <div className="text-xs text-[#6B5644]">إجمالي المصروفات</div>
              <div className="text-lg font-black text-[#B83B2B]">{expenseAnalysis.totalExp.toLocaleString('ar-EG')} {currency}</div>
            </div>
            <div className="bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E8E0D5]">
              <div className="text-xs text-[#6B5644]">نسبة المصروفات من المبيعات</div>
              <div className="text-lg font-black text-[#231710]">
                {expenseAnalysis.totalSales > 0
                  ? ((expenseAnalysis.totalExp / expenseAnalysis.totalSales) * 100).toFixed(1)
                  : '0'}%
              </div>
            </div>
            <div className="bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E8E0D5]">
              <div className="text-xs text-[#6B5644]">عدد بنود الصرف النشطة</div>
              <div className="text-lg font-black text-[#9A6836]">{expenseAnalysis.rows.length} بند</div>
            </div>
          </div>

          <div className="space-y-2.5">
            {expenseAnalysis.rows.map((r) => {
              const pct = expenseAnalysis.totalExp > 0 ? Math.round((r.amount / expenseAnalysis.totalExp) * 100) : 0;
              return (
                <div key={r.key} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{r.label} ({r.count} حركة)</span>
                    <span>{r.amount.toLocaleString('ar-EG')} {currency} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[#FAF6F0] h-2.5 rounded-full overflow-hidden border border-[#E8E0D5]">
                    <div style={{ width: `${pct}%` }} className="bg-[#231710] h-full rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Print Items Price List & Customers Directory */}
      {activeReport === 'print_directory' && (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPrintTab('items')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold ${printTab === 'items' ? 'bg-[#231710] text-white' : 'bg-[#FAF6F0]'}`}
            >
              قائمة الأصناف وأكواد الميزان ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setPrintTab('customers')}
              className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold ${printTab === 'customers' ? 'bg-[#231710] text-white' : 'bg-[#FAF6F0]'}`}
            >
              <Users className="w-3.5 h-3.5" /> دليل العملاء وأرصدتهم ({vipMembers.length})
            </button>
          </div>

          {printTab === 'items' ? (
            <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#FAF6F0] border-b font-bold">
                  <tr><th className="p-2.5">الباركود / PLU</th><th className="p-2.5">الصنف</th><th className="p-2.5">الوحدة</th><th className="p-2.5">السعر</th><th className="p-2.5">الرصيد</th></tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE2]">
                  {products.map((p, i) => (
                    <tr key={p.id}>
                      <td className="p-2.5 font-mono">{getProductBarcode(p, i)}</td>
                      <td className="p-2.5 font-bold">{p.name}</td>
                      <td className="p-2.5">{isUnitProduct(p) ? p.unitLabel || 'قطعة' : 'كيلو/جرام'}</td>
                      <td className="p-2.5 font-bold">{p.pricePerKg ?? p.unitPrice ?? 0} {currency}</td>
                      <td className="p-2.5">{p.stockKg ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#FAF6F0] border-b font-bold">
                  <tr><th className="p-2.5">اسم العميل</th><th className="p-2.5">الموبايل</th><th className="p-2.5">رصيد VIP</th><th className="p-2.5">الآجل المستحق</th><th className="p-2.5">إجمالي المشتريات</th></tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE2]">
                  {vipMembers.map((m) => (
                    <tr key={m.phone}>
                      <td className="p-2.5 font-bold">{m.name || m.customerName || 'عميل VIP'}</td>
                      <td className="p-2.5 font-mono">{m.phone}</td>
                      <td className="p-2.5 font-bold text-emerald-700">{m.walletBalance ?? m.pointsBalance ?? 0} {currency}</td>
                      <td className="p-2.5 font-bold text-red-600">{m.creditBalanceDue ?? 0} {currency}</td>
                      <td className="p-2.5">{m.totalSpent ?? 0} {currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
