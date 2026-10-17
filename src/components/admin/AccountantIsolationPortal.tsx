'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Printer,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Package,
} from 'lucide-react';
import {
  Order,
  PosExpense,
  PosShift,
  Product,
  StoreSettings,
  VipMember,
} from '@/types/store';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';

interface AccountantIsolationPortalProps {
  orders: Order[];
  products: Product[];
  posShifts: PosShift[];
  posExpenses: PosExpense[];
  vipMembers: VipMember[];
  settings: StoreSettings;
  onExportOrdersCsv: () => void;
  onOpenOrdersTab: () => void;
}

export default function AccountantIsolationPortal({
  orders,
  products,
  posShifts,
  posExpenses,
  vipMembers,
  settings,
  onExportOrdersCsv,
  onOpenOrdersTab,
}: AccountantIsolationPortalProps) {
  const [subTab, setSubTab] = useState<'shifts_audit' | 'expenses_audit' | 'margin_audit'>(
    'shifts_audit'
  );
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<PosShift | null>(null);

  const validOrders = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled'),
    [orders]
  );

  const totalRevenue = useMemo(
    () => validOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    [validOrders]
  );

  const totalRawCost = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      if (typeof o.rawCostTotal === 'number' && o.rawCostTotal > 0) {
        return sum + o.rawCostTotal;
      }
      return sum + Math.round((o.subtotal || o.total || 0) * 0.68);
    }, 0);
  }, [validOrders]);

  const grossProfit = useMemo(
    () => Math.max(0, totalRevenue - totalRawCost),
    [totalRevenue, totalRawCost]
  );

  const totalPosExpenses = useMemo(
    () => posExpenses.reduce((sum, ex) => sum + (ex.amount || 0), 0),
    [posExpenses]
  );

  const netProfitAfterExpenses = useMemo(
    () => grossProfit - totalPosExpenses,
    [grossProfit, totalPosExpenses]
  );

  const netMarginPercent = useMemo(() => {
    if (totalRevenue <= 0) return 0;
    return Number(((netProfitAfterExpenses / totalRevenue) * 100).toFixed(1));
  }, [netProfitAfterExpenses, totalRevenue]);

  const totalVipLiability = useMemo(
    () =>
      vipMembers.reduce(
        (sum, m) => sum + (m.walletBalance ?? m.pointsBalance ?? 0),
        0
      ),
    [vipMembers]
  );

  return (
    <div className="space-y-4">
      {/* Role Isolation Security Notice */}
      <div className="bg-gradient-to-l from-emerald-950 via-brand-950 to-brand-900 text-white p-4 rounded-2xl border border-pistachio-500/30 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-pistachio-500/20 border border-pistachio-400/40 text-pistachio-300 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white">
                بوابة المحاسب المعزولة — المراجعة المالية، تكاليف البضاعة، وجرد الورديات
              </h2>
              <span className="text-[10px] font-black bg-pistachio-500 text-brand-950 px-2 py-0.5 rounded-full">
                صلاحية: المحاسب المالي (Accountant)
              </span>
            </div>
            <p className="text-[11px] text-brand-200 mt-0.5">
              تتيح هذه البوابة الرقابة المالية الكاملة على الإيرادات، تكلفة الخامات (شيت عرفات)، صافي الأرباح، تقارير Z-Report للدرج، والمصروفات النثرية — مع عزل تام عن تعديل إعدادات الموقع أو حذف السجلات.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenOrdersTab}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-extrabold text-white flex items-center gap-1.5"
          >
            <Package className="w-3.5 h-3.5 text-gold-400" />
            <span>سجل الفواتير ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={onExportOrdersCsv}
            className="px-4 py-2 rounded-xl bg-pistachio-600 hover:bg-pistachio-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير التقرير المالي CSV</span>
          </button>
        </div>
      </div>

      {/* 6 Financial Audit KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs">
          <div className="text-[10px] font-bold text-brand-600">إجمالي إيرادات المبيعات</div>
          <div className="text-base font-black text-brand-950 mt-1 font-mono">
            {totalRevenue.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-[9.5px] text-brand-500 mt-0.5">
            من {validOrders.length} فاتورة مؤكدة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="text-[10px] font-bold text-amber-800">تكلفة البضاعة المباعة (COGS)</div>
          <div className="text-base font-black text-amber-900 mt-1 font-mono">
            {totalRawCost.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-[9.5px] text-amber-700 mt-0.5">تكلفة الخامات والتوريد</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-red-200 shadow-2xs">
          <div className="text-[10px] font-bold text-red-700">المصروفات النثرية للدرج</div>
          <div className="text-base font-black text-red-700 mt-1 font-mono">
            {totalPosExpenses.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-[9.5px] text-red-600 mt-0.5">
            {posExpenses.length} حركة مصروفات مسجلة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-pistachio-300 bg-pistachio-50/40 shadow-2xs">
          <div className="text-[10px] font-extrabold text-pistachio-800">صافي الربح الفعلي</div>
          <div className="text-base font-black text-pistachio-700 mt-1 font-mono">
            {netProfitAfterExpenses.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-[9.5px] text-pistachio-700 font-bold mt-0.5">
            بعد خصم التكلفة والمصروفات
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs">
          <div className="text-[10px] font-bold text-brand-600">هامش الربح الصافي</div>
          <div className="text-base font-black text-brand-950 mt-1 font-mono">
            {netMarginPercent}%
          </div>
          <div className="text-[9.5px] text-brand-500 mt-0.5">مؤشر ربحية التشغيل</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gold-400/50 shadow-2xs">
          <div className="text-[10px] font-bold text-brand-700">أرصدة محافظ عملاء VIP</div>
          <div className="text-base font-black text-brand-950 mt-1 font-mono">
            {totalVipLiability.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-[9.5px] text-brand-500 mt-0.5">
            لعدد {vipMembers.length} عضو مسجل
          </div>
        </div>
      </div>

      {/* Accountant Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-brand-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setSubTab('shifts_audit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            subTab === 'shifts_audit'
              ? 'bg-brand-950 text-gold-400 shadow-xs'
              : 'text-brand-800 hover:bg-brand-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>سجل ورديات الكاشير وتقفيل الدرج Z-Reports ({posShifts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('expenses_audit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            subTab === 'expenses_audit'
              ? 'bg-brand-950 text-gold-400 shadow-xs'
              : 'text-brand-800 hover:bg-brand-50'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>دفتر المصروفات النثرية ({posExpenses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('margin_audit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            subTab === 'margin_audit'
              ? 'bg-brand-950 text-gold-400 shadow-xs'
              : 'text-brand-800 hover:bg-brand-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>تدقيق تكلفة الأصناف وهامش الربح ({products.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: POS SHIFTS & Z-REPORTS AUDIT */}
      {subTab === 'shifts_audit' && (
        <div className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden">
          {posShifts.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-brand-600">
              لا توجد ورديات كاشير مسجلة حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                    <th className="p-3 whitespace-nowrap">الوردية والكاشير</th>
                    <th className="p-3 whitespace-nowrap">الحالة والتوقيت</th>
                    <th className="p-3 whitespace-nowrap">عهدة البداية</th>
                    <th className="p-3 whitespace-nowrap">مبيعات الكاش / الإلكتروني</th>
                    <th className="p-3 whitespace-nowrap">المصروفات</th>
                    <th className="p-3 whitespace-nowrap">النقدية المتوقعة / الفعلية</th>
                    <th className="p-3 whitespace-nowrap">تكلفة الخامات وصافي الربح</th>
                    <th className="p-3 whitespace-nowrap text-center">تقرير Z-Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {posShifts.map((shift) => {
                    const variance = shift.cashDifference ?? 0;
                    const electronicTotal =
                      (shift.instapayTotal || 0) + (shift.vodafoneCashTotal || 0);
                    return (
                      <tr key={shift.id} className="hover:bg-brand-50/60 transition">
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-mono font-black text-brand-950">
                            {shift.shiftNumber || shift.id}
                          </div>
                          <div className="text-[11px] font-bold text-brand-700 mt-0.5">
                            👤 {shift.cashierName}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              shift.status === 'open'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-pistachio-100 text-pistachio-800'
                            }`}
                          >
                            {shift.status === 'open' ? '🟢 وردية مفتوحة' : '🔒 مغلقة ومجردة'}
                          </span>
                          <div className="text-[10px] text-brand-500 mt-1">
                            فتح: {new Date(shift.openedAt).toLocaleString('ar-EG')}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap font-mono font-bold text-brand-900">
                          {shift.openingCash} ج.م
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-brand-950">
                            كاش: {shift.cashSalesTotal} ج.م
                          </div>
                          <div className="text-[10px] text-brand-600">
                            إلكتروني: {electronicTotal} ج.م ({shift.ordersCount} فاتورة)
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap font-mono font-bold text-red-600">
                          -{shift.expensesTotal} ج.م
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="text-[11px] font-bold text-brand-900">
                            متوقع: {shift.expectedCashInDrawer} ج.م
                          </div>
                          {shift.status === 'closed' && (
                            <div className="text-[10px] font-extrabold mt-0.5">
                              فعلي: {shift.actualClosingCash ?? shift.expectedCashInDrawer} ج.م{' '}
                              <span
                                className={
                                  variance < 0
                                    ? 'text-red-600'
                                    : variance > 0
                                    ? 'text-amber-700'
                                    : 'text-pistachio-700'
                                }
                              >
                                ({variance === 0 ? 'مطابق ✓' : `فرق ${variance} ج.م`})
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="text-[11px] text-amber-900 font-bold">
                            تكلفة: {shift.totalRawCost || 0} ج.م
                          </div>
                          <div className="text-xs font-black text-pistachio-700 mt-0.5">
                            صافي الربح: {shift.totalNetProfit || 0} ج.م
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedShiftForReport(shift)}
                            className="bg-brand-900 hover:bg-brand-950 text-gold-400 text-[11px] font-extrabold px-3 py-1.5 rounded-xl inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Z-Report محاسبي</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: PETTY CASH EXPENSES REGISTER */}
      {subTab === 'expenses_audit' && (
        <div className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden">
          {posExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-brand-600">
              لا توجد مصروفات نثرية مسجلة في الدرج حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                    <th className="p-3 whitespace-nowrap">التاريخ والوقت</th>
                    <th className="p-3 whitespace-nowrap">بند المصروف</th>
                    <th className="p-3">البيان والملاحظات</th>
                    <th className="p-3 whitespace-nowrap">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {posExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-brand-50/60 transition">
                      <td className="p-3 whitespace-nowrap font-mono text-[11px] text-brand-700">
                        {new Date(exp.createdAt).toLocaleString('ar-EG')}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="bg-brand-100 text-brand-900 font-extrabold px-2 py-0.5 rounded text-[10px]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-brand-950">{exp.title}</div>
                        {exp.notes && (
                          <div className="text-[10px] text-brand-500 mt-0.5">{exp.notes}</div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono font-black text-red-600">
                        -{exp.amount} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: PRODUCT COST VS SELLING PRICE MARGIN AUDIT */}
      {subTab === 'margin_audit' && (
        <div className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                  <th className="p-3 whitespace-nowrap">الصنف</th>
                  <th className="p-3 whitespace-nowrap">تكلفة توريد الكيلو</th>
                  <th className="p-3 whitespace-nowrap">تكلفة التغليف</th>
                  <th className="p-3 whitespace-nowrap">إجمالي تكلفة الكيلو</th>
                  <th className="p-3 whitespace-nowrap">سعر بيع الكيلو للجمهور</th>
                  <th className="p-3 whitespace-nowrap">صافي ربح الكيلو</th>
                  <th className="p-3 whitespace-nowrap text-center">نسبة هامش الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {products.map((p) => {
                  const sellPerKg =
                    p.pricePerKg ??
                    p.weights.find((w) => w.grams === 1000)?.price ??
                    (p.weights[0]?.price ? p.weights[0].price * 4 : 400);
                  const rawCost = p.costPerKg ?? Math.round(sellPerKg * 0.68);
                  const packCost = p.packagingCost ?? 0;
                  const totalCost = rawCost + packCost;
                  const netPerKg = sellPerKg - totalCost;
                  const marginPct =
                    sellPerKg > 0 ? Number(((netPerKg / sellPerKg) * 100).toFixed(1)) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-brand-50/60 transition">
                      <td className="p-3 font-extrabold text-brand-950">{p.name}</td>
                      <td className="p-3 font-mono font-bold text-amber-900">{rawCost} ج.م</td>
                      <td className="p-3 font-mono text-brand-700">{packCost} ج.م</td>
                      <td className="p-3 font-mono font-black text-brand-950">{totalCost} ج.م</td>
                      <td className="p-3 font-mono font-black text-pistachio-700">
                        {sellPerKg} ج.م
                      </td>
                      <td className="p-3 font-mono font-black text-pistachio-700">
                        +{netPerKg} ج.م
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            marginPct < 15
                              ? 'bg-red-100 text-red-700'
                              : 'bg-pistachio-100 text-pistachio-800'
                          }`}
                        >
                          {marginPct < 15 ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          <span>{marginPct}%</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Z-Report Modal with Full Profit Audit for Accountant */}
      {selectedShiftForReport && (
        <SupermarketReceiptModal
          mode="zreport"
          shift={selectedShiftForReport}
          settings={settings}
          showProfit={true}
          onClose={() => setSelectedShiftForReport(null)}
        />
      )}
    </div>
  );
}
