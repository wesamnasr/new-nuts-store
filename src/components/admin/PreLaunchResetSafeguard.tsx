'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Lock,
  Package,
  Layers,
  Users,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

interface PreLaunchResetSafeguardProps {
  adminToken: string | null;
  onResetComplete?: () => void;
  isSuperAdmin?: boolean;
}

export default function PreLaunchResetSafeguard({
  adminToken,
  onResetComplete,
  isSuperAdmin = true,
}: PreLaunchResetSafeguardProps) {
  const { storeData, refreshStore, showToast } = useStore();

  const [confirmationInput, setConfirmationInput] = useState('');
  const [clearOrders, setClearOrders] = useState(true);
  const [clearShifts, setClearShifts] = useState(true);
  const [clearExpenses, setClearExpenses] = useState(true);
  const [clearSupplyInvoices, setClearSupplyInvoices] = useState(true);
  const [clearVipMembers, setClearVipMembers] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    success: boolean;
    text: string;
    purged?: Record<string, number>;
  } | null>(null);

  const ordersCount = Array.isArray(storeData?.orders) ? storeData.orders.length : 0;
  const shiftsCount = Array.isArray(storeData?.posShifts) ? storeData.posShifts.length : 0;
  const expensesCount = Array.isArray(storeData?.posExpenses) ? storeData.posExpenses.length : 0;
  const supplyCount = Array.isArray(storeData?.supplyInvoices) ? storeData.supplyInvoices.length : 0;
  const vipCount = Array.isArray(storeData?.vipMembers) ? storeData.vipMembers.length : 0;

  const productsCount = Array.isArray(storeData?.products) ? storeData.products.length : 0;
  const categoriesCount = Array.isArray(storeData?.categories) ? storeData.categories.length : 0;
  const staffCount = Array.isArray(storeData?.staffAccounts) ? storeData.staffAccounts.length : 0;

  const REQUIRED_PHRASE = 'تصفير العمليات التجريبية';
  const isPhraseMatching = confirmationInput.trim() === REQUIRED_PHRASE;

  const handleExecuteReset = async () => {
    if (!isSuperAdmin) {
      showToast('⚠️ هذه العملية مقصورة حصرياً على رتبة المدير العام (Super Admin)');
      return;
    }

    if (!isPhraseMatching) {
      showToast('⚠️ يرجى كتابة نص التأكيد بدقة للمتابعة');
      return;
    }

    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const res = await fetch('/api/admin/reset-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({
          confirmationText: confirmationInput.trim(),
          clearOrders,
          clearShifts,
          clearExpenses,
          clearSupplyInvoices,
          clearVipMembers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل تنفيذ عملية التصفير');
      }

      setResultMessage({
        success: true,
        text: data.message || 'تم تصفير العمليات التجريبية وتجهيز الفرع للافتتاح الرسمي بنجاح!',
        purged: data.purged,
      });

      showToast('✅ تم تصفير العمليات بنجاح والفرع جاهز للافتتاح الرسمي!');
      setConfirmationInput('');

      await refreshStore();
      if (onResetComplete) {
        onResetComplete();
      }
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: err?.message || 'تعذر الاتصال بالخادم لإجراء التصفير',
      });
      showToast('❌ فشل تنفيذ التصفير');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#D4AF37]/50 shadow-sm overflow-hidden text-[#231710]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#231710] via-[#352319] to-[#231710] text-[#FAF6F0] p-4 sm:p-5 flex items-center justify-between border-b border-[#D4AF37]/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#D4AF37] flex items-center gap-2">
              <span>خزنة تصفير العمليات التجريبية (جاهزية الافتتاح الرسمي)</span>
              <span className="text-[10px] bg-[#D4AF37] text-[#231710] font-black px-2 py-0.5 rounded-full">
                المدير العام فقط
              </span>
            </h3>
            <p className="text-[11px] text-[#F3ECE1]/80 mt-0.5">
              تفريغ ذري لكافة الحركات الدفترية والورديات التجريبية قبل انطلاق فرع بني مزار، مع الحماية الكاملة للمخزون والأسعار وحسابات الموظفين.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Protected Entities Notice */}
        <div className="bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-[#231710] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>البيانات المحمية 100% التي لن تتأثر إطلاقاً بالتصفير:</span>
            </h4>
            <p className="text-[11px] text-[#6E5D4F] leading-relaxed">
              كتالوج الأصناف والأسعار وتكلفة الجملة، حسابات الموظفين الـ 5 المشفرة، إعدادات المتجر وهوية الفرع، إعدادات بوت تلجرام، وخصومات الكوبونات.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-black text-[#231710] tabular-nums shrink-0">
            <span className="px-2.5 py-1 bg-[#F3ECE1] rounded-lg border border-[#E6DFD3] flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-[#C88A4B]" /> {productsCount} منتج
            </span>
            <span className="px-2.5 py-1 bg-[#F3ECE1] rounded-lg border border-[#E6DFD3] flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#C88A4B]" /> {categoriesCount} قسم
            </span>
            <span className="px-2.5 py-1 bg-[#F3ECE1] rounded-lg border border-[#E6DFD3] flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#C88A4B]" /> {staffCount} موظف
            </span>
          </div>
        </div>

        {/* Current Transactional Snapshot Metrics */}
        <div>
          <h4 className="text-xs font-black text-[#231710] mb-2.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#C88A4B]" />
            <span>الحركات التجريبية المسجلة حالياً في النظام:</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-[#F3ECE1]/60 border border-[#E6DFD3] rounded-xl p-3 text-center">
              <span className="block text-[11px] font-bold text-[#6E5D4F]">الطلبات المسجلة</span>
              <span className="text-lg font-black text-[#231710] tabular-nums">{ordersCount}</span>
            </div>
            <div className="bg-[#F3ECE1]/60 border border-[#E6DFD3] rounded-xl p-3 text-center">
              <span className="block text-[11px] font-bold text-[#6E5D4F]">ورديات الكاشير</span>
              <span className="text-lg font-black text-[#231710] tabular-nums">{shiftsCount}</span>
            </div>
            <div className="bg-[#F3ECE1]/60 border border-[#E6DFD3] rounded-xl p-3 text-center">
              <span className="block text-[11px] font-bold text-[#6E5D4F]">مصروفات الفرع</span>
              <span className="text-lg font-black text-[#231710] tabular-nums">{expensesCount}</span>
            </div>
            <div className="bg-[#F3ECE1]/60 border border-[#E6DFD3] rounded-xl p-3 text-center">
              <span className="block text-[11px] font-bold text-[#6E5D4F]">فواتير التوريد</span>
              <span className="text-lg font-black text-[#231710] tabular-nums">{supplyCount}</span>
            </div>
            <div className="bg-[#F3ECE1]/60 border border-[#E6DFD3] rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <span className="block text-[11px] font-bold text-[#6E5D4F]">أعضاء VIP التجريبيين</span>
              <span className="text-lg font-black text-[#231710] tabular-nums">{vipCount}</span>
            </div>
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-2">
          <label className="text-xs font-black text-[#231710] block">
            اختر العمليات المراد تصفيرها:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-bold text-[#231710]">
            <label className="flex items-center gap-2 p-2.5 bg-[#FAF6F0] rounded-xl border border-[#E6DFD3] cursor-pointer">
              <input
                type="checkbox"
                checked={clearOrders}
                onChange={(e) => setClearOrders(e.target.checked)}
                className="rounded text-[#231710] focus:ring-[#D4AF37]"
              />
              <span>تصفير جميع طلبات الأونلاين والكاشير</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-[#FAF6F0] rounded-xl border border-[#E6DFD3] cursor-pointer">
              <input
                type="checkbox"
                checked={clearShifts}
                onChange={(e) => setClearShifts(e.target.checked)}
                className="rounded text-[#231710] focus:ring-[#D4AF37]"
              />
              <span>تصفير ورديات الكاشير وتقارير Z-Report</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-[#FAF6F0] rounded-xl border border-[#E6DFD3] cursor-pointer">
              <input
                type="checkbox"
                checked={clearExpenses}
                onChange={(e) => setClearExpenses(e.target.checked)}
                className="rounded text-[#231710] focus:ring-[#D4AF37]"
              />
              <span>تصفير سجل مصروفات درج الكاشير</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-[#FAF6F0] rounded-xl border border-[#E6DFD3] cursor-pointer">
              <input
                type="checkbox"
                checked={clearSupplyInvoices}
                onChange={(e) => setClearSupplyInvoices(e.target.checked)}
                className="rounded text-[#231710] focus:ring-[#D4AF37]"
              />
              <span>تصفير فواتير التوريد التجريبية</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-[#FAF6F0] rounded-xl border border-[#E6DFD3] cursor-pointer sm:col-span-2 lg:col-span-1">
              <input
                type="checkbox"
                checked={clearVipMembers}
                onChange={(e) => setClearVipMembers(e.target.checked)}
                className="rounded text-[#231710] focus:ring-[#D4AF37]"
              />
              <span>تصفير حسابات كاش باك VIP التجريبية</span>
            </label>
          </div>
        </div>

        {/* Confirmation Input Guard */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>لتأكيد العملية، يرجى كتابة العبارة التالية بالضبط:</span>
            </label>
            <button
              type="button"
              onClick={() => setConfirmationInput(REQUIRED_PHRASE)}
              className="text-[11px] text-amber-800 hover:text-amber-950 underline font-black cursor-pointer"
            >
              نسخ العبارة تلقائياً
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full">
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="اكتب هنا: تصفير العمليات التجريبية"
                className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-xs font-black transition ${
                  isPhraseMatching
                    ? 'border-emerald-500 ring-2 ring-emerald-200 text-emerald-950'
                    : 'border-amber-300 focus:border-[#231710]'
                }`}
              />
              {isPhraseMatching && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <button
              type="button"
              disabled={!isPhraseMatching || isSubmitting}
              onClick={handleExecuteReset}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center justify-center gap-2 transition cursor-pointer ${
                isPhraseMatching && !isSubmitting
                  ? 'bg-rose-700 hover:bg-rose-800 text-white shadow-md'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التصفير الذري...' : 'تأكيد التصفير وتجهيز الفرع'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {resultMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-bold flex items-start gap-2.5 ${
              resultMessage.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            {resultMessage.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p>{resultMessage.text}</p>
              {resultMessage.purged && (
                <div className="text-[11px] font-mono text-emerald-800 flex flex-wrap gap-x-3 gap-y-1">
                  <span>طلبات: {resultMessage.purged.orders || 0}</span>
                  <span>ورديات: {resultMessage.purged.posShifts || 0}</span>
                  <span>مصروفات: {resultMessage.purged.posExpenses || 0}</span>
                  <span>فواتير توريد: {resultMessage.purged.supplyInvoices || 0}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
