'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Wallet,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Unlock,
  Users,
  Truck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  CreditCard,
  Banknote,
  ShieldCheck,
} from 'lucide-react';
import {
  Order,
  SupplierPaymentRecord,
  SupplyInvoice,
  TreasuryAccountId,
  TreasuryTransaction,
  VipMember,
} from '@/types/store';
import { TreasuryAccountBalance, TREASURY_ACCOUNT_META } from '@/lib/treasury';

export interface TreasuryAndLedgersModuleProps {
  readOnly?: boolean;
  supplyInvoices?: SupplyInvoice[];
  onOpenSupplyTab?: () => void;
  onRefreshStore?: () => void;
}

const ACCOUNT_ORDER: TreasuryAccountId[] = [
  'main_safe',
  'instapay_bank',
  'vodafone_wallet',
  'card_bank',
];

const CATEGORY_LABELS: Record<TreasuryTransaction['category'], string> = {
  shift_close: 'تقفيل وردية كاشير',
  electronic_settlement: 'تسوية دفع إلكتروني',
  supplier_payment: 'سداد دفعة لمورد',
  customer_debt_collection: 'تحصيل مديونية عميل',
  general_expense: 'مصروفات عامة / تشغيلية',
  owner_deposit: 'إيداع رأس مال / تمويل خزينة',
  owner_withdrawal: 'مسحوبات مالك / إدارة',
  transfer: 'تحويل داخلي بين الحسابات',
};

export default function TreasuryAndLedgersModule({
  readOnly = false,
  supplyInvoices = [],
  onOpenSupplyTab,
  onRefreshStore,
}: TreasuryAndLedgersModuleProps) {
  const [subTab, setSubTab] = useState<'treasury' | 'credit' | 'suppliers_ap'>('treasury');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Treasury State
  const [accounts, setAccounts] = useState<
    Record<TreasuryAccountId, TreasuryAccountBalance> | null
  >(null);
  const [totalLiquidity, setTotalLiquidity] = useState<number>(0);
  const [totalSupplierPayables, setTotalSupplierPayables] = useState<number>(0);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPaymentRecord[]>([]);
  const [txAccountFilter, setTxAccountFilter] = useState<TreasuryAccountId | 'all'>('all');

  // Voucher & Transfer Form State
  const [voucherAccount, setVoucherAccount] = useState<TreasuryAccountId>('main_safe');
  const [voucherDirection, setVoucherDirection] = useState<'in' | 'out'>('in');
  const [voucherCategory, setVoucherCategory] =
    useState<TreasuryTransaction['category']>('owner_deposit');
  const [voucherAmount, setVoucherAmount] = useState<string>('');
  const [voucherTitle, setVoucherTitle] = useState<string>('');
  const [voucherNotes, setVoucherNotes] = useState<string>('');
  const [submittingVoucher, setSubmittingVoucher] = useState(false);

  const [fromAccount, setFromAccount] = useState<TreasuryAccountId>('main_safe');
  const [toAccount, setToAccount] = useState<TreasuryAccountId>('instapay_bank');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Credit Sales (AR) State
  const [enableCreditSales, setEnableCreditSales] = useState<boolean>(false);
  const [creditSalesRequireApproval, setCreditSalesRequireApproval] = useState<boolean>(true);
  const [totalReceivables, setTotalReceivables] = useState<number>(0);
  const [creditCustomers, setCreditCustomers] = useState<VipMember[]>([]);
  const [creditOrders, setCreditOrders] = useState<Order[]>([]);
  const [togglingCreditLock, setTogglingCreditLock] = useState(false);

  // Customer Credit Approval Form
  const [custPhone, setCustPhone] = useState<string>('');
  const [custName, setCustName] = useState<string>('');
  const [custLimit, setCustLimit] = useState<string>('2000');
  const [custAllow, setCustAllow] = useState<boolean>(true);
  const [savingCustomerCredit, setSavingCustomerCredit] = useState(false);

  // Collect Debt Modal / Inline State
  const [collectingCustomer, setCollectingCustomer] = useState<VipMember | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectAccount, setCollectAccount] = useState<TreasuryAccountId>('main_safe');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [submittingCollect, setSubmittingCollect] = useState(false);

  const getTokenHeader = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    let token =
      sessionStorage.getItem('admin_token') ||
      localStorage.getItem('admin_token') ||
      '';
    if (!token) {
      try {
        const raw = localStorage.getItem('nuts_admin_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token && (parsed?.expiresAt ? parsed.expiresAt > Date.now() : true)) {
            token = parsed.token;
          }
        }
      } catch {
        // Ignore malformed session cache
      }
    }
    return token
      ? {
          Authorization: `Bearer ${token}`,
          'x-admin-token': token,
        }
      : {};
  };

  const fetchAllFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getTokenHeader();
      const [trsRes, crdRes] = await Promise.all([
        fetch('/api/admin/treasury', { headers, credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/credit', { headers, credentials: 'include', cache: 'no-store' }),
      ]);
      if (trsRes.ok) {
        const trsData = await trsRes.json();
        setAccounts(trsData.accounts || null);
        setTotalLiquidity(trsData.totalLiquidity || 0);
        setTotalSupplierPayables(trsData.totalSupplierPayables || 0);
        setTransactions(Array.isArray(trsData.transactions) ? trsData.transactions : []);
        setSupplierPayments(
          Array.isArray(trsData.supplierPayments) ? trsData.supplierPayments : []
        );
      }
      if (crdRes.ok) {
        const crdData = await crdRes.json();
        setEnableCreditSales(Boolean(crdData.enableCreditSales));
        setCreditSalesRequireApproval(crdData.creditSalesRequireApproval !== false);
        setTotalReceivables(crdData.totalReceivables || 0);
        setCreditCustomers(Array.isArray(crdData.customers) ? crdData.customers : []);
        setCreditOrders(Array.isArray(crdData.creditOrders) ? crdData.creditOrders : []);
      }
    } catch {
      // ignore transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllFinancialData();
  }, [fetchAllFinancialData, supplyInvoices.length]);

  const filteredTransactions = useMemo(() => {
    if (txAccountFilter === 'all') return transactions;
    return transactions.filter((t) => t.accountId === txAccountFilter);
  }, [transactions, txAccountFilter]);

  const suppliersStatement = useMemo(() => {
    const map = new Map<
      string,
      {
        supplierId: string;
        supplierName: string;
        invoicesCount: number;
        totalApproved: number;
        totalPaid: number;
        totalReturned: number;
        remainingPayable: number;
      }
    >();

    for (const inv of supplyInvoices) {
      if (inv.status !== 'approved') continue;
      const key = inv.supplierId || inv.supplierName || 'supplier';
      if (!map.has(key)) {
        map.set(key, {
          supplierId: key,
          supplierName: inv.supplierName || key,
          invoicesCount: 0,
          totalApproved: 0,
          totalPaid: 0,
          totalReturned: 0,
          remainingPayable: 0,
        });
      }
      const row = map.get(key)!;
      const paid = inv.paidAmount || 0;
      const ret = inv.returnedAmount || 0;
      const rem =
        typeof inv.remainingAmount === 'number'
          ? inv.remainingAmount
          : Math.max(0, (inv.totalAmount || 0) - paid - ret);
      row.invoicesCount += 1;
      row.totalApproved += inv.totalAmount || 0;
      row.totalPaid += paid;
      row.totalReturned += ret;
      row.remainingPayable += rem;
    }

    return Array.from(map.values()).sort((a, b) => b.remainingPayable - a.remainingPayable);
  }, [supplyInvoices]);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSubmittingVoucher(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/treasury', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTokenHeader(),
        },
        body: JSON.stringify({
          accountId: voucherAccount,
          direction: voucherDirection,
          category: voucherCategory,
          amount: Number(voucherAmount),
          title: voucherTitle,
          notes: voucherNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'فشل حفظ السند المالي' });
      } else {
        setFeedback({ type: 'success', message: 'تم تسجيل السند المالي وتحديث رصيد الخزينة بنجاح' });
        setVoucherAmount('');
        setVoucherTitle('');
        setVoucherNotes('');
        await fetchAllFinancialData();
        onRefreshStore?.();
      }
    } catch {
      setFeedback({ type: 'error', message: 'خطأ في الاتصال بالخادم' });
    } finally {
      setSubmittingVoucher(false);
    }
  };

  const handleTransferFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSubmittingTransfer(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/treasury', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTokenHeader(),
        },
        body: JSON.stringify({
          action: 'transfer',
          fromAccountId: fromAccount,
          toAccountId: toAccount,
          amount: Number(transferAmount),
          notes: transferNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'تعذر تنفيذ التحويل المالي' });
      } else {
        setFeedback({
          type: 'success',
          message: 'تم تنفيذ التحويل بين الحسابات وتوثيقه بسجل الرقابة بنجاح',
        });
        setTransferAmount('');
        setTransferNotes('');
        await fetchAllFinancialData();
        onRefreshStore?.();
      }
    } catch {
      setFeedback({ type: 'error', message: 'خطأ في الاتصال بالخادم' });
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleToggleMasterCredit = async (
    nextEnable: boolean,
    nextRequireApproval = creditSalesRequireApproval
  ) => {
    if (readOnly) return;
    setTogglingCreditLock(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/credit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getTokenHeader(),
        },
        body: JSON.stringify({
          action: 'toggle_master_credit',
          enableCreditSales: nextEnable,
          creditSalesRequireApproval: nextRequireApproval,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'تعذر تحديث إعداد البيع الآجل' });
      } else {
        setEnableCreditSales(Boolean(data.enableCreditSales));
        setCreditSalesRequireApproval(Boolean(data.creditSalesRequireApproval));
        setFeedback({
          type: 'success',
          message: data.enableCreditSales
            ? 'تم فتح وتفعيل البيع الآجل على الكاشير وفق السياسة المحددة'
            : 'تم قفل وإيقاف البيع الآجل بالكامل على جميع شاشات الكاشير',
        });
        onRefreshStore?.();
      }
    } catch {
      setFeedback({ type: 'error', message: 'خطأ في الاتصال بالخادم' });
    } finally {
      setTogglingCreditLock(false);
    }
  };

  const handleSaveCustomerCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSavingCustomerCredit(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/credit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getTokenHeader(),
        },
        body: JSON.stringify({
          action: 'update_customer_credit',
          phone: custPhone,
          customerName: custName,
          creditLimit: Number(custLimit),
          allowCredit: custAllow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'تعذر تحديث حد ائتمان العميل' });
      } else {
        setFeedback({
          type: 'success',
          message: `تم تحديث اعتماد العميل (${data.customer?.customerName || custPhone}) بنجاح`,
        });
        setCustPhone('');
        setCustName('');
        await fetchAllFinancialData();
        onRefreshStore?.();
      }
    } catch {
      setFeedback({ type: 'error', message: 'خطأ في الاتصال بالخادم' });
    } finally {
      setSavingCustomerCredit(false);
    }
  };

  const handleCollectDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !collectingCustomer) return;
    setSubmittingCollect(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTokenHeader(),
        },
        body: JSON.stringify({
          phone: collectingCustomer.phone,
          amount: Number(collectAmount),
          accountId: collectAccount,
          notes: collectNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'تعذر تحصيل الدفعة' });
      } else {
        setFeedback({
          type: 'success',
          message: `تم تحصيل ${data.paidAmount} ج.م من العميل وإيداعها في الخزينة (المتبقي: ${data.remainingDebt} ج.م)`,
        });
        setCollectingCustomer(null);
        setCollectAmount('');
        setCollectNotes('');
        await fetchAllFinancialData();
        onRefreshStore?.();
      }
    } catch {
      setFeedback({ type: 'error', message: 'خطأ في الاتصال بالخادم' });
    } finally {
      setSubmittingCollect(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Summary Strip */}
      <div className="bg-white rounded-2xl p-5 border border-[#E8E0D5] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836] flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[#231710]">
                  الخزينة الرئيسية، ذمم العملاء الآجلة وكشف حساب الموردين
                </h3>
                {readOnly && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] text-[11px] font-bold text-[#6B5A4E]">
                    وضع المراجعة المحاسبية (للقراءة فقط)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B5A4E]">
                متابعة السيولة النقدية والبنكية الفعلية، الرقابة على البيع الآجل، وسداد مستحقات الموردين
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchAllFinancialData}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] text-[#231710] border border-[#E8E0D5] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#9A6836] ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الأرصدة</span>
          </button>
        </div>

        {/* Executive Liquidity, AR & AP Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E8E0D5]">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 block">
              إجمالي السيولة بالخزينة والبنوك والمحافظ
            </span>
            <span className="text-lg font-black text-emerald-950 mt-0.5 block">
              {loading && accounts === null
                ? 'جاري التحميل...'
                : `${totalLiquidity.toLocaleString('ar-EG')} ج.م`}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 block">
              إجمالي مديونيات العملاء الآجلة (لنا - AR)
            </span>
            <span className="text-lg font-black text-blue-950 mt-0.5 block">
              {loading && accounts === null
                ? 'جاري التحميل...'
                : `${totalReceivables.toLocaleString('ar-EG')} ج.م`}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 block">
              إجمالي مستحقات الموردين القائمة (علينا - AP)
            </span>
            <span className="text-lg font-black text-amber-950 mt-0.5 block">
              {loading && accounts === null
                ? 'جاري التحميل...'
                : `${totalSupplierPayables.toLocaleString('ar-EG')} ج.م`}
            </span>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            {
              id: 'treasury' as const,
              label: 'الخزينة والحسابات البنكية',
              icon: Landmark,
            },
            {
              id: 'credit' as const,
              label: `البيع الآجل وذمم العملاء (${
                enableCreditSales ? 'مفعل' : 'مقفل'
              })`,
              icon: Users,
            },
            {
              id: 'suppliers_ap' as const,
              label: `كشف حساب الموردين (${suppliersStatement.length})`,
              icon: Truck,
            },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSubTab(t.id);
                  setFeedback(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  active
                    ? 'bg-[#231710] text-white'
                    : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F2EAE0] border border-[#E8E0D5]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: TREASURY & BANK / WALLET ACCOUNTS                              */}
      {/* ===================================================================== */}
      {subTab === 'treasury' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {ACCOUNT_ORDER.map((accKey) => {
              const acc = accounts?.[accKey] || {
                accountId: accKey,
                label: TREASURY_ACCOUNT_META[accKey].label,
                subtitle: TREASURY_ACCOUNT_META[accKey].subtitle,
                totalIn: 0,
                totalOut: 0,
                balance: 0,
              };
              return (
                <div
                  key={accKey}
                  className="bg-white rounded-2xl p-4 border border-[#E8E0D5] flex flex-col justify-between space-y-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#231710]">{acc.label}</span>
                      {accKey === 'main_safe' ? (
                        <Banknote className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <CreditCard className="w-4 h-4 text-[#9A6836]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B5A4E] mt-0.5">{acc.subtitle}</p>
                  </div>
                  <div>
                    <div className="text-xl font-black text-[#231710]">
                      {acc.balance.toLocaleString('ar-EG')}{' '}
                      <span className="text-xs font-bold">ج.م</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold pt-1.5 mt-1.5 border-t border-[#F2ECE2]">
                      <span className="text-emerald-700">وارد: +{acc.totalIn}</span>
                      <span className="text-rose-700">صادر: -{acc.totalOut}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Admin Interactive Vouchers & Transfers */}
          {!readOnly && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Manual Receipt / Expense Voucher */}
              <form
                onSubmit={handleCreateVoucher}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8E0D5] space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-black text-[#231710]">
                  <Wallet className="w-4 h-4 text-[#9A6836]" />
                  <span>تسجيل سند قبض (إيداع) أو سند صرف (مصروفات/سحب)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      نوع السند
                    </label>
                    <select
                      value={voucherDirection}
                      onChange={(e) => {
                        const dir = e.target.value as 'in' | 'out';
                        setVoucherDirection(dir);
                        setVoucherCategory(dir === 'in' ? 'owner_deposit' : 'general_expense');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-bold bg-[#FAF6F0]"
                    >
                      <option value="in">سند قبض / إيداع وارد (+)</option>
                      <option value="out">سند صرف / مصروف صادر (-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      الحساب المالي
                    </label>
                    <select
                      value={voucherAccount}
                      onChange={(e) => setVoucherAccount(e.target.value as TreasuryAccountId)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-bold bg-[#FAF6F0]"
                    >
                      {ACCOUNT_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {TREASURY_ACCOUNT_META[k].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      المبلغ (ج.م)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      required
                      value={voucherAmount}
                      onChange={(e) => setVoucherAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      التصنيف المحاسبي
                    </label>
                    <select
                      value={voucherCategory}
                      onChange={(e) =>
                        setVoucherCategory(e.target.value as TreasuryTransaction['category'])
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-bold"
                    >
                      {voucherDirection === 'in' ? (
                        <>
                          <option value="owner_deposit">إيداع تمويل / رأس مال</option>
                          <option value="electronic_settlement">تسوية مقبوضات إلكترونية</option>
                        </>
                      ) : (
                        <>
                          <option value="general_expense">مصروفات إدارية / إيجار / رواتب</option>
                          <option value="owner_withdrawal">مسحوبات مالك / أرباح</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={voucherTitle}
                    onChange={(e) => setVoucherTitle(e.target.value)}
                    placeholder="بيان السند (مثال: سداد إيجار المحل / تغذية الخزينة)..."
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={voucherNotes}
                    onChange={(e) => setVoucherNotes(e.target.value)}
                    placeholder="ملاحظات إضافية (اختياري)..."
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingVoucher}
                  className="px-4 py-2 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingVoucher ? 'جاري التسجيل...' : 'حفظ السند بالخزينة'}
                </button>
              </form>

              {/* Inter-Account Transfer */}
              <form
                onSubmit={handleTransferFunds}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8E0D5] space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-black text-[#231710]">
                  <ArrowRightLeft className="w-4 h-4 text-[#9A6836]" />
                  <span>تحويل مالي داخلي بين الخزينة والبنوك / المحافظ</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      السحب من حساب
                    </label>
                    <select
                      value={fromAccount}
                      onChange={(e) => setFromAccount(e.target.value as TreasuryAccountId)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-bold bg-[#FAF6F0]"
                    >
                      {ACCOUNT_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {TREASURY_ACCOUNT_META[k].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      الإيداع في حساب
                    </label>
                    <select
                      value={toAccount}
                      onChange={(e) => setToAccount(e.target.value as TreasuryAccountId)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-bold bg-[#FAF6F0]"
                    >
                      {ACCOUNT_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {TREASURY_ACCOUNT_META[k].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      قيمة التحويل (ج.م)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      required
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                      بيان / مرجع التحويل
                    </label>
                    <input
                      type="text"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="مثال: تسييل محفظة فودافون كاش للخزينة..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submittingTransfer}
                  className="px-4 py-2 rounded-xl bg-[#9A6836] hover:bg-[#82562B] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingTransfer ? 'جاري التحويل...' : 'تنفيذ التحويل بين الحسابين'}
                </button>
              </form>
            </div>
          )}

          {/* Treasury Transactions Ledger */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
            <div className="p-4 border-b border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-[#231710]">
                دفتر حركات الخزينة والحسابات البنكية ({filteredTransactions.length} حركة)
              </span>
              <select
                value={txAccountFilter}
                onChange={(e) => setTxAccountFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] text-xs font-bold"
              >
                <option value="all">كل الحسابات المالية</option>
                {ACCOUNT_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {TREASURY_ACCOUNT_META[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#FAF6F0] text-[#6B5A4E] font-bold border-b border-[#E8E0D5]">
                  <tr>
                    <th className="p-3">رقم السند</th>
                    <th className="p-3">الحساب</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">البيان</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">المسؤول</th>
                    <th className="p-3">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE2]">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[#6B5A4E] font-bold">
                        لا توجد حركات خزينة مسجلة بعد — تُرحَّل تقفيلات الورديات والسندات هنا تلقائياً
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="p-3 font-mono font-bold text-[#231710]">{tx.txNumber}</td>
                        <td className="p-3 font-bold">
                          {TREASURY_ACCOUNT_META[tx.accountId]?.label || tx.accountId}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              tx.direction === 'in'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {tx.direction === 'in' ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {CATEGORY_LABELS[tx.category] || tx.category}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-[#231710]">
                          {tx.title}
                          {tx.notes && (
                            <span className="block text-[11px] text-[#6B5A4E] font-normal">
                              {tx.notes}
                            </span>
                          )}
                        </td>
                        <td
                          className={`p-3 font-mono font-black ${
                            tx.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {tx.direction === 'in' ? '+' : '-'}
                          {tx.amount.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 text-[#6B5A4E] font-bold">{tx.recordedBy}</td>
                        <td className="p-3 text-[#6B5A4E]">
                          {new Date(tx.createdAt).toLocaleString('ar-EG')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CUSTOMER CREDIT SALES & RECEIVABLES (AR)                       */}
      {/* ===================================================================== */}
      {subTab === 'credit' && (
        <div className="space-y-4">
          {/* Master Lock Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
              enableCreditSales
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-amber-50/70 border-amber-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  enableCreditSales
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {enableCreditSales ? (
                  <Unlock className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-sm font-black text-[#231710]">
                  مفتاح التحكم الرئيسي في البيع الآجل بالكاشير:{' '}
                  <span className={enableCreditSales ? 'text-emerald-800' : 'text-amber-900'}>
                    {enableCreditSales ? 'مفعل ومسموح حالياً' : 'مقفل وموقوف تماماً'}
                  </span>
                </div>
                <p className="text-xs text-[#6B5A4E] mt-0.5">
                  عند إيقاف هذا المفتاح يختفي ويرفض خيار البيع الآجل من جميع شاشات الكاشير فوراً، وعند تفعيله يلتزم بالسقف الائتماني المحدد لكل عميل.
                </p>
              </div>
            </div>

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#231710] bg-white px-3 py-2 rounded-xl border border-[#E8E0D5] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={creditSalesRequireApproval}
                    onChange={(e) =>
                      handleToggleMasterCredit(enableCreditSales, e.target.checked)
                    }
                  />
                  <span>للعملاء المعتمدين مسبقاً فقط</span>
                </label>

                <button
                  type="button"
                  disabled={togglingCreditLock}
                  onClick={() => handleToggleMasterCredit(!enableCreditSales)}
                  className={`px-4 py-2 rounded-xl text-xs font-black text-white transition cursor-pointer disabled:opacity-50 ${
                    enableCreditSales
                      ? 'bg-rose-700 hover:bg-rose-600'
                      : 'bg-emerald-700 hover:bg-emerald-600'
                  }`}
                >
                  {enableCreditSales ? 'قفل وإيقاف البيع الآجل فوراً' : 'تفعيل البيع الآجل بالكاشير'}
                </button>
              </div>
            )}
          </div>

          {/* Admin Form: Approve / Set Credit Limit for Customer */}
          {!readOnly && (
            <form
              onSubmit={handleSaveCustomerCredit}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8E0D5] space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-black text-[#231710]">
                <ShieldCheck className="w-4 h-4 text-[#9A6836]" />
                <span>اعتماد عميل للبيع الآجل أو تعديل سقف المديونية المسموح</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                    رقم موبايل العميل (مصري)
                  </label>
                  <input
                    type="tel"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                    اسم العميل / التاجر
                  </label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="مثال: كافيه النيل / أ. محمود"
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                    الحد الائتماني الأقصى (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={custLimit}
                    onChange={(e) => setCustLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs font-black"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#231710]">
                    <input
                      type="checkbox"
                      checked={custAllow}
                      onChange={(e) => setCustAllow(e.target.checked)}
                    />
                    <span>معتمد</span>
                  </label>
                  <button
                    type="submit"
                    disabled={savingCustomerCredit}
                    className="flex-1 px-4 py-2 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>حفظ الاعتماد</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Collect Debt Inline Form */}
          {!readOnly && collectingCustomer && (
            <form
              onSubmit={handleCollectDebtSubmit}
              className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200 space-y-3"
            >
              <div className="text-xs font-black text-emerald-950">
                تحصيل سداد مديونية من العميل:{' '}
                {collectingCustomer.customerName || collectingCustomer.name} (
                {collectingCustomer.phone}) — المديونية الحالية:{' '}
                {(
                  collectingCustomer.creditBalanceDue ??
                  collectingCustomer.creditBalance ??
                  0
                ).toLocaleString('ar-EG')}{' '}
                ج.م
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="number"
                  min="1"
                  max={
                    collectingCustomer.creditBalanceDue ??
                    collectingCustomer.creditBalance ??
                    undefined
                  }
                  step="0.5"
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="المبلغ المحصل (ج.م)"
                  className="bg-white px-3 py-2 rounded-xl border border-emerald-300 text-xs font-black"
                />
                <select
                  value={collectAccount}
                  onChange={(e) => setCollectAccount(e.target.value as TreasuryAccountId)}
                  className="bg-white px-3 py-2 rounded-xl border border-emerald-300 text-xs font-bold"
                >
                  {ACCOUNT_ORDER.map((k) => (
                    <option key={k} value={k}>
                      إيداع في: {TREASURY_ACCOUNT_META[k].label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="ملاحظات التحصيل..."
                  className="bg-white px-3 py-2 rounded-xl border border-emerald-300 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCollectingCustomer(null)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingCollect}
                  className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold"
                >
                  {submittingCollect ? 'جاري التحصيل...' : 'تأكيد التحصيل وإيداع الخزينة'}
                </button>
              </div>
            </form>
          )}

          {/* Customers Credit Table */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
            <div className="p-4 border-b border-[#E8E0D5] flex items-center justify-between">
              <span className="text-xs font-black text-[#231710]">
                سجل العملاء المعتمدين والذمم المدينة ({creditCustomers.length} عميل) — فواتير آجلة ({creditOrders.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#FAF6F0] text-[#6B5A4E] font-bold border-b border-[#E8E0D5]">
                  <tr>
                    <th className="p-3">العميل</th>
                    <th className="p-3">الهاتف</th>
                    <th className="p-3">حالة الاعتماد</th>
                    <th className="p-3">الحد الائتماني</th>
                    <th className="p-3">المديونية القائمة</th>
                    {!readOnly && <th className="p-3">إجراء</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE2]">
                  {creditCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#6B5A4E] font-bold">
                        لا يوجد عملاء مسجلون بعد
                      </td>
                    </tr>
                  ) : (
                    creditCustomers.map((m) => {
                      const debt = m.creditBalanceDue ?? m.creditBalance ?? 0;
                      return (
                        <tr key={m.phone} className="hover:bg-[#FAF6F0]/50">
                          <td className="p-3 font-bold text-[#231710]">
                            {m.customerName || m.name || 'عميل'}
                          </td>
                          <td className="p-3 font-mono font-bold">{m.phone}</td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                m.allowCredit
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {m.allowCredit ? 'معتمد للآجل ✓' : 'نقدي فقط'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold">
                            {(m.creditLimit || 0).toLocaleString('ar-EG')} ج.م
                          </td>
                          <td
                            className={`p-3 font-mono font-black ${
                              debt > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {debt.toLocaleString('ar-EG')} ج.م
                          </td>
                          {!readOnly && (
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                {debt > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCollectingCustomer(m);
                                      setCollectAmount(String(debt));
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    تحصيل سداد
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustPhone(m.phone);
                                    setCustName(m.customerName || m.name || '');
                                    setCustLimit(String(m.creditLimit || 2000));
                                    setCustAllow(Boolean(m.allowCredit));
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] text-[11px] font-bold cursor-pointer"
                                >
                                  تعديل الحد
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SUPPLIERS ACCOUNTS PAYABLE STATEMENT (AP)                      */}
      {/* ===================================================================== */}
      {subTab === 'suppliers_ap' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
            <div className="p-4 border-b border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-[#231710]">
                ملخص أرصدة وكشف حساب الموردين المعتمدين
              </span>
              {onOpenSupplyTab && (
                <button
                  type="button"
                  onClick={onOpenSupplyTab}
                  className="px-3 py-1.5 rounded-xl bg-[#231710] text-white text-xs font-bold cursor-pointer"
                >
                  فتح فواتير التوريد للسداد أو المرتجع
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#FAF6F0] text-[#6B5A4E] font-bold border-b border-[#E8E0D5]">
                  <tr>
                    <th className="p-3">المورد</th>
                    <th className="p-3">فواتير معتمدة</th>
                    <th className="p-3">إجمالي التوريدات</th>
                    <th className="p-3">إجمالي المسدد</th>
                    <th className="p-3">مرتجعات مشتريات</th>
                    <th className="p-3">الرصيد المتبقي للمورد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE2]">
                  {suppliersStatement.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#6B5A4E] font-bold">
                        لا توجد فواتير توريد معتمدة بعد
                      </td>
                    </tr>
                  ) : (
                    suppliersStatement.map((s) => (
                      <tr key={s.supplierId} className="hover:bg-[#FAF6F0]/50">
                        <td className="p-3 font-black text-[#231710]">{s.supplierName}</td>
                        <td className="p-3 font-bold">{s.invoicesCount} فاتورة</td>
                        <td className="p-3 font-mono font-bold">
                          {s.totalApproved.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {s.totalPaid.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-700">
                          {s.totalReturned.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 font-mono font-black text-amber-900">
                          {s.remainingPayable.toLocaleString('ar-EG')} ج.م
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {supplierPayments.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
              <div className="p-4 border-b border-[#E8E0D5] text-xs font-black text-[#231710]">
                سجل دفعات سداد الموردين الأخيرة ({supplierPayments.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#FAF6F0] text-[#6B5A4E] font-bold border-b border-[#E8E0D5]">
                    <tr>
                      <th className="p-3">المورد</th>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">المبلغ المسدد</th>
                      <th className="p-3">الحساب المالي</th>
                      <th className="p-3">بواسطة</th>
                      <th className="p-3">التوقيت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE2]">
                    {supplierPayments.map((sp) => (
                      <tr key={sp.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="p-3 font-bold text-[#231710]">{sp.supplierName}</td>
                        <td className="p-3 font-mono font-bold">{sp.invoiceNumber || '—'}</td>
                        <td className="p-3 font-mono font-black text-emerald-700">
                          {sp.amount.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 font-bold">
                          {TREASURY_ACCOUNT_META[sp.accountId]?.label || sp.accountId}
                        </td>
                        <td className="p-3 text-[#6B5A4E]">{sp.recordedBy}</td>
                        <td className="p-3 text-[#6B5A4E]">
                          {new Date(sp.createdAt).toLocaleString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
