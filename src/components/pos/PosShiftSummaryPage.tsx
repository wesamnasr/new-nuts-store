'use client';

import React, { useState } from 'react';
import {
  Printer,
  Lock,
  Unlock,
  Banknote,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { PosExpense, PosShift } from '@/types/store';

interface PosShiftSummaryPageProps {
  activeShift: PosShift | null;
  posShifts: PosShift[];
  posExpenses: PosExpense[];
  canSeeProfits: boolean;
  posLoading: boolean;
  defaultCashierName?: string;
  onOpenNewShift: (
    cashierName: string,
    shiftPeriod: 'الوردية الصباحية' | 'الوردية المسائية' | 'وردية اليوم الكامل',
    openingCash: number
  ) => Promise<void>;
  onCloseShift: (actualClosingCash: number, notes?: string) => Promise<void>;
  onAddExpense: (
    title: string,
    amount: number,
    category: 'raw_materials' | 'packaging' | 'utilities' | 'delivery_rider' | 'other'
  ) => Promise<void>;
  onPrintShiftZReport: (shift: PosShift) => void;
}

export default function PosShiftSummaryPage({
  activeShift,
  posShifts,
  posExpenses,
  canSeeProfits,
  posLoading,
  defaultCashierName,
  onOpenNewShift,
  onCloseShift,
  onAddExpense,
  onPrintShiftZReport,
}: PosShiftSummaryPageProps) {
  const [newShiftCashier, setNewShiftCashier] = useState<string>(
    defaultCashierName || 'كاشير فرع بني مزار (أمام مسجد الزراعيين)'
  );

  React.useEffect(() => {
    if (defaultCashierName && defaultCashierName.trim()) {
      setNewShiftCashier(defaultCashierName.trim());
    }
  }, [defaultCashierName]);
  const [newShiftPeriod, setNewShiftPeriod] = useState<
    'الوردية الصباحية' | 'الوردية المسائية' | 'وردية اليوم الكامل'
  >('الوردية المسائية');
  const [newShiftOpeningCash, setNewShiftOpeningCash] = useState<number>(1000);

  const [closingActualCash, setClosingActualCash] = useState<number>(
    activeShift?.expectedCashInDrawer ?? 1000
  );
  const [closingNotes, setClosingNotes] = useState<string>('');

  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<number>(50);
  const [expenseCategory, setExpenseCategory] = useState<
    'raw_materials' | 'packaging' | 'utilities' | 'delivery_rider' | 'other'
  >('packaging');

  React.useEffect(() => {
    if (activeShift) {
      setClosingActualCash(activeShift.expectedCashInDrawer);
    }
  }, [activeShift]);

  const categoryLabelMap: Record<PosExpense['category'], string> = {
    packaging: 'أكياس وتغليف واستيكرات',
    raw_materials: 'خامات ومستلزمات بار القهوة',
    delivery_rider: 'حساب طيار دليفري',
    utilities: 'كهرباء / مياه / نظافة',
    other: 'مصروفات نثرية أخرى',
  };

  const cashDiff = activeShift
    ? Math.round(closingActualCash - activeShift.expectedCashInDrawer)
    : 0;

  return (
    <div className="space-y-5">
      {/* 1. Active Shift Live Summary Card & Cash Drawer Equation */}
      {activeShift ? (
        <div className="bg-white text-[#231710] rounded-2xl p-6 border border-[#E8E0D5] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>وردية نشطة الآن</span>
                </span>
                <span className="text-xs font-medium text-[#6B5B4E]">
                  {canSeeProfits
                    ? 'تقرير درج الكاشير الحي وصافي الربح الفعلي (Z-Report Live)'
                    : 'تقرير درج الكاشير الحي وجرد النقدية الفعلي (Z-Report Live)'}
                </span>
              </div>
              <h2 className="font-cairo font-bold text-xl text-[#231710] mt-1">
                {activeShift.shiftNumber} — {activeShift.shiftPeriod} ({activeShift.cashierName})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onPrintShiftZReport(activeShift)}
              className="bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة تقرير الـ Z-Report الحراري (80mm)</span>
            </button>
          </div>

          {/* 6 KPI Cards for Cash Drawer Equation */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
            <div className="bg-[#FAF6F0] rounded-2xl p-3.5 border border-[#E8E0D5]">
              <span className="text-[11px] text-[#6B5B4E] block">
                1. عهدة بداية الدرج
              </span>
              <span className="font-cairo font-bold text-lg text-[#231710]">
                {activeShift.openingCash} ج.م
              </span>
            </div>

            <div className="bg-[#FAF6F0] rounded-2xl p-3.5 border border-[#E8E0D5]">
              <span className="text-[11px] text-[#6B5B4E] block">
                2. مبيعات الكاش النقدية
              </span>
              <span className="font-cairo font-bold text-lg text-[#9A6836]">
                +{activeShift.cashSalesTotal} ج.م
              </span>
            </div>

            <div className="bg-[#FAF6F0] rounded-2xl p-3.5 border border-[#E8E0D5]">
              <span className="text-[11px] text-[#6B5B4E] block">
                3. فيزا الفرع + محافظ إلكترونية
              </span>
              <span className="font-cairo font-bold text-lg text-[#231710]">
                {(activeShift.cardSales || activeShift.cardSalesTotal || 0) + activeShift.vodafoneCashTotal + activeShift.instapayTotal} ج.م
              </span>
              <span className="text-[10px] text-[#6B5B4E] block">
                فيزا: {activeShift.cardSales || activeShift.cardSalesTotal || 0}ج • فودافون: {activeShift.vodafoneCashTotal}ج • إنستا: {activeShift.instapayTotal}ج
              </span>
            </div>

            <div className="bg-[#FAF6F0] rounded-2xl p-3.5 border border-[#E8E0D5]">
              <span className="text-[11px] text-[#6B5B4E] block">
                4. مصروفات الدرج النثرية
              </span>
              <span className="font-cairo font-bold text-lg text-[#B83B2B]">
                -{activeShift.expensesTotal} ج.م
              </span>
            </div>

            <div className="bg-[#FAF6F0] rounded-2xl p-3.5 border border-[#C5B8A8]">
              <span className="text-[11px] text-[#231710] font-bold block">
                5. النقدية المتوقعة بالدرج
              </span>
              <span className="font-cairo font-bold text-xl text-[#231710]">
                {activeShift.expectedCashInDrawer} ج.م
              </span>
              <span className="text-[9.5px] text-[#6B5B4E] block">
                {(activeShift.riderCodSettledTotal || 0) > 0
                  ? `(العهدة + الكاش + توريد المناديب ${activeShift.riderCodSettledTotal}ج - المصروفات)`
                  : '(العهدة + الكاش - المصروفات)'}
              </span>
            </div>

            {canSeeProfits && typeof activeShift.totalNetProfit === 'number' ? (
              <div className="bg-emerald-50/70 rounded-2xl p-3.5 border border-emerald-200">
                <span className="text-[11px] text-emerald-900 font-bold block">
                  6. صافي الربح الفعلي
                </span>
                <span className="font-cairo font-bold text-xl text-[#3B6E4C]">
                  +{activeShift.totalNetProfit} ج.م
                </span>
                <span className="text-[10px] text-[#6B5B4E] block">
                  إجمالي المبيعات: {activeShift.totalRevenue} ج
                </span>
              </div>
            ) : (
              <div className="bg-[#FAF6F0] rounded-2xl p-3.5 border border-[#E8E0D5]">
                <span className="text-[11px] text-[#6B5B4E] block">
                  6. فواتير ومبيعات الوردية
                </span>
                <span className="font-cairo font-bold text-xl text-[#231710]">
                  {activeShift.ordersCount} فاتورة
                </span>
                <span className="text-[10px] text-[#9A6836] block">
                  إجمالي التحصيل: {activeShift.totalRevenue} ج.م
                </span>
              </div>
            )}
          </div>

          {/* Secondary Bar: Rider COD Handover, VIP Wallet Activity & Shift Timestamps */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E8E0D5] text-xs text-[#6B5B4E] tabular-nums">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                توريدات عهدة المناديب (COD) بالدرج:{' '}
                <strong className="text-[#231710]">
                  +{activeShift.riderCodSettledTotal || 0} ج.م
                </strong>
              </span>
              <span>
                رصيد VIP المسترد في الوردية:{' '}
                <strong className="text-[#231710]">
                  {activeShift.vipRedeemedTotal || 0} ج.م
                </strong>
              </span>
              <span>
                كاش باك VIP الصادر للعملاء (5%):{' '}
                <strong className="text-[#3B6E4C]">
                  +{activeShift.vipCashbackIssuedTotal || 0} ج.م
                </strong>
              </span>
            </div>
            <span className="text-[#6B5B4E]">
              وقت فتح الوردية: {new Date(activeShift.openedAt).toLocaleString('ar-EG')}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 text-center space-y-2">
          <p className="font-cairo font-bold text-sm text-amber-900 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>لا توجد وردية مفتوحة حالياً — يرجى فتح وردية جديدة بالأسفل لاستلام الدرج</span>
          </p>
        </div>
      )}

      {/* 2. Three Action Cards: Reconcile/Close Shift, Open New Shift, Petty Cash Expense */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card A: Close Current Shift & Reconcile Cash Drawer */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onCloseShift(closingActualCash, closingNotes);
            setClosingNotes('');
          }}
          className="bg-white rounded-2xl p-5 border border-[#E8E0D5] flex flex-col justify-between space-y-3"
        >
          <div className="space-y-2.5">
            <h3 className="font-cairo font-bold text-sm sm:text-base text-[#231710] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#B83B2B]" />
              <span>تقفيل الوردية الحالية وجرد النقدية بالدرج</span>
            </h3>
            <p className="text-xs text-[#6B5B4E]">
              عدّ النقدية الفعلية الموجودة في درج الكاشير الآن لمطابقتها مع الرصيد المتوقع (
              <strong className="text-[#231710] tabular-nums">
                {activeShift?.expectedCashInDrawer || 0} ج.م
              </strong>
              )
            </p>

            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                النقدية الفعلية المعدودة في الدرج (ج.م):
              </label>
              <input
                type="number"
                value={closingActualCash}
                onChange={(e) => setClosingActualCash(Number(e.target.value))}
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-sm font-bold tabular-nums outline-none"
              />
            </div>

            {activeShift && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between tabular-nums border ${
                  cashDiff === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : cashDiff > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-red-50 border-red-200 text-[#B83B2B]'
                }`}
              >
                <span className="flex items-center gap-1">
                  {cashDiff === 0 ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    {cashDiff === 0
                      ? 'الدرج مطابق تماماً 100%'
                      : cashDiff > 0
                        ? 'فائض / زيادة في الدرج:'
                        : 'عجز في الدرج:'}
                  </span>
                </span>
                <span className="font-cairo font-bold text-sm">
                  {cashDiff > 0 ? `+${cashDiff}` : cashDiff} ج.م
                </span>
              </div>
            )}

            <input
              type="text"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="ملاحظات تقفيل الوردية (اختياري)..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-1.5 text-xs font-medium outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={posLoading || !activeShift || activeShift.status === 'closed'}
            className="w-full bg-[#B83B2B] hover:bg-[#9e3123] disabled:opacity-40 text-white font-cairo font-bold text-xs py-3 rounded-xl cursor-pointer transition"
          >
            اعتماد تقفيل الوردية وإصدار Z-Report
          </button>
        </form>

        {/* Card B: Open New Cashier Shift */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onOpenNewShift(newShiftCashier, newShiftPeriod, newShiftOpeningCash);
          }}
          className="bg-white rounded-2xl p-5 border border-[#E8E0D5] flex flex-col justify-between space-y-3"
        >
          <div className="space-y-2.5">
            <h3 className="font-cairo font-bold text-sm sm:text-base text-[#231710] flex items-center gap-1.5">
              <Unlock className="w-4 h-4 text-[#3B6E4C]" />
              <span>فتح وردية كاشير جديدة (استلام الدرج)</span>
            </h3>
            <p className="text-xs text-[#6B5B4E]">
              يتم إغلاق أي وردية سابقة تلقائياً وبدء عداد جديد للفواتير وعهدة الدرج
            </p>

            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                اسم الكاشير المستلم:
              </label>
              <input
                type="text"
                value={newShiftCashier}
                onChange={(e) => setNewShiftCashier(e.target.value)}
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-medium outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold block mb-1 text-[#231710]">الفترة:</label>
                <select
                  value={newShiftPeriod}
                  onChange={(e) => setNewShiftPeriod(e.target.value as any)}
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold outline-none"
                >
                  <option value="الوردية الصباحية">الوردية الصباحية</option>
                  <option value="الوردية المسائية">الوردية المسائية</option>
                  <option value="وردية اليوم الكامل">وردية اليوم الكامل</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-[#231710]">
                  عهدة الفكة بالدرج (ج.م):
                </label>
                <input
                  type="number"
                  value={newShiftOpeningCash}
                  onChange={(e) => setNewShiftOpeningCash(Number(e.target.value))}
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold tabular-nums outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={posLoading}
            className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-xs py-3 rounded-xl cursor-pointer transition"
          >
            فتح وردية جديدة الآن
          </button>
        </form>

        {/* Card C: Petty Cash Drawer Expense Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!expenseTitle.trim()) return;
            await onAddExpense(expenseTitle, expenseAmount, expenseCategory);
            setExpenseTitle('');
            setExpenseAmount(50);
          }}
          className="bg-white rounded-2xl p-5 border border-[#E8E0D5] flex flex-col justify-between space-y-3"
        >
          <div className="space-y-2.5">
            <h3 className="font-cairo font-bold text-sm sm:text-base text-[#231710] flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-[#9A6836]" />
              <span>تسجيل مصروف نثري من درج الكاشير</span>
            </h3>
            <p className="text-xs text-[#6B5B4E]">
              يُخصم المصروف فوراً من النقدية المتوقعة بالدرج ويُسجل في جدول المصروفات بالأسفل
            </p>

            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">بيان المصروف:</label>
              <input
                type="text"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="مثلاً: ثلج وحليب لبار الإسبريسو / أكياس..."
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-medium outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold block mb-1 text-[#231710]">المبلغ (ج.م):</label>
                <input
                  type="number"
                  min={1}
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold tabular-nums outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-[#231710]">التصنيف:</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold outline-none"
                >
                  <option value="packaging">أكياس وتغليف واستيكرات</option>
                  <option value="raw_materials">خامات ومستلزمات بار القهوة</option>
                  <option value="delivery_rider">حساب طيار دليفري</option>
                  <option value="utilities">كهرباء / مياه / نظافة</option>
                  <option value="other">مصروفات أخرى</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={posLoading || !expenseTitle.trim()}
            className="w-full bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] hover:border-[#231710] disabled:opacity-40 font-cairo font-bold text-xs py-3 rounded-xl cursor-pointer transition"
          >
            خصم المصروف من الدرج
          </button>
        </form>
      </div>

      {/* 3. Two Audit Tables Side-by-Side: Expenses Log Table & Shifts History Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Table A: Petty Cash Expenses Log (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
          <div className="p-4 border-b border-[#E8E0D5] flex items-center justify-between">
            <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-[#9A6836]" />
              <span>سجل المصروفات النثرية المسحوبة من الدرج ({posExpenses.length})</span>
            </h3>
          </div>
          {posExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B5B4E]">
              لا توجد مصروفات نثرية مسجلة حتى الآن
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF6F0] text-[#231710] font-cairo font-bold border-b border-[#E8E0D5]">
                    <th className="py-2.5 px-3">البيان</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    <th className="py-2.5 px-3">الوقت</th>
                    <th className="py-2.5 px-3 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0D5] tabular-nums">
                  {posExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#FAF6F0]">
                      <td className="py-2.5 px-3 font-bold text-[#231710]">
                        {exp.title}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[#6B5B4E]">
                        {categoryLabelMap[exp.category] || exp.category}
                      </td>
                      <td className="py-2.5 px-3 text-[10.5px] text-[#6B5B4E]">
                        {new Date(exp.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-left font-cairo font-bold text-[#B83B2B]">
                        -{exp.amount} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Table B: Shifts History & Z-Report Archive (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
          <div className="p-4 border-b border-[#E8E0D5] flex items-center justify-between">
            <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#9A6836]" />
              <span>سجل الورديات وتقارير الـ Z-Report ({posShifts.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF6F0] text-[#231710] font-cairo font-bold border-b border-[#E8E0D5]">
                  <th className="py-3 px-3">الوردية</th>
                  <th className="py-3 px-3">الكاشير / الفترة</th>
                  <th className="py-3 px-3">الفواتير</th>
                  <th className="py-3 px-3">إجمالي المبيعات</th>
                  <th className="py-3 px-3">المتوقع بالدرج</th>
                  <th className="py-3 px-3">الفعلي / الفرق</th>
                  <th className="py-3 px-3 text-center">التقرير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5] tabular-nums">
                {posShifts.map((sh) => (
                  <tr key={sh.id} className="hover:bg-[#FAF6F0]">
                    <td className="py-2.5 px-3 font-cairo font-bold">
                      <span className="block text-[#231710]">{sh.shiftNumber}</span>
                      <span
                        className={`inline-block text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${
                          sh.status === 'open'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-[#FAF6F0] text-[#6B5B4E] border border-[#E8E0D5]'
                        }`}
                      >
                        {sh.status === 'open' ? 'مفتوحة الآن' : 'مغلقة'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[#231710]">{sh.cashierName}</div>
                      <div className="text-[10.5px] text-[#6B5B4E]">{sh.shiftPeriod}</div>
                    </td>
                    <td className="py-2.5 px-3 font-bold">{sh.ordersCount}</td>
                    <td className="py-2.5 px-3 font-cairo font-bold text-[#231710]">
                      {sh.totalRevenue} ج.م
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#231710]">
                      {sh.expectedCashInDrawer} ج.م
                    </td>
                    <td className="py-2.5 px-3">
                      {sh.status === 'closed' && sh.actualClosingCash !== undefined ? (
                        <div>
                          <span className="font-bold block">
                            {sh.actualClosingCash} ج.م
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              (sh.cashDifference || 0) === 0
                                ? 'text-[#3B6E4C]'
                                : 'text-[#B83B2B]'
                            }`}
                          >
                            الفرق: {sh.cashDifference || 0} ج
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10.5px] text-[#6B5B4E]">قيد العمل</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onPrintShiftZReport(sh)}
                        className="bg-[#231710] hover:bg-[#3A271C] text-white px-2.5 py-1 rounded-lg text-[10.5px] font-cairo font-bold inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Z-Report</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
