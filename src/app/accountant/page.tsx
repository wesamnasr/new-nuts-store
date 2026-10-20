'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Store,
  Layers,
  Calendar,
  Download,
  RefreshCw,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  Search,
  Filter,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Receipt,
  ArrowRight,
  Percent,
  Archive,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  Order,
  Product,
  PosShift,
  PosExpense,
  SupplyInvoice,
  VipMember,
  StoreSettings,
  AdminRole,
} from '@/types/store';
import {
  FinancialDateRangeFilter,
  DateRangePreset,
  calculateFinancialSummary,
  generateFinancialSummaryCsv,
  generateShiftsAuditCsv,
  generateExpensesLedgerCsv,
  generateSupplyLedgerCsv,
  roundCurrency,
} from '@/lib/financials';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';

const ADMIN_SESSION_STORAGE_KEY = 'nuts_admin_session';

export default function AccountantPortalPage() {
  // ─────────────────────────────────────────────────────────────────────────
  // Authentication & Session State
  // ─────────────────────────────────────────────────────────────────────────
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<AdminRole>('accountant');
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string>('');

  // Login Form State
  const [loginRole, setLoginRole] = useState<AdminRole>('accountant');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // ─────────────────────────────────────────────────────────────────────────
  // Database & Financial Records State
  // ─────────────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posShifts, setPosShifts] = useState<PosShift[]>([]);
  const [posExpenses, setPosExpenses] = useState<PosExpense[]>([]);
  const [supplyInvoices, setSupplyInvoices] = useState<SupplyInvoice[]>([]);
  const [vipMembers, setVipMembers] = useState<VipMember[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // ─────────────────────────────────────────────────────────────────────────
  // UI Controls & Filtering State
  // ─────────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'channels' | 'shifts' | 'expenses' | 'supply' | 'margins'>('channels');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals & Expansion State
  const [selectedShiftForZReport, setSelectedShiftForZReport] = useState<PosShift | null>(null);
  const [expandedSupplyInvoiceId, setExpandedSupplyInvoiceId] = useState<string | null>(null);
  const [marginSearchQuery, setMarginSearchQuery] = useState<string>('');
  const [marginCategoryFilter, setMarginCategoryFilter] = useState<string>('all');
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (activeToken?: string) => {
    const currentToken = activeToken || token;
    if (!currentToken) return;

    setLoadingData(true);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${currentToken}`,
        'x-admin-token': currentToken,
      };

      // 1. Fetch store database (unredacted for accountant)
      const storeRes = await fetch('/api/store', { headers, cache: 'no-store' });
      if (storeRes.ok) {
        const storeData = await storeRes.json();
        setProducts(storeData.products || []);
        setOrders(storeData.orders || []);
        setPosShifts(storeData.posShifts || []);
        setPosExpenses(storeData.posExpenses || []);
        setVipMembers(storeData.vipMembers || []);
        setSettings(storeData.settings || null);
        if (storeData.supplyInvoices && Array.isArray(storeData.supplyInvoices)) {
          setSupplyInvoices(storeData.supplyInvoices);
        }
      }

      // 2. Fetch supply invoices
      const supplyRes = await fetch('/api/supply-invoices', { headers, cache: 'no-store' });
      if (supplyRes.ok) {
        const supplyData = await supplyRes.json();
        setSupplyInvoices(Array.isArray(supplyData.invoices) ? supplyData.invoices : (supplyData.supplyInvoices || []));
      }
    } catch (err) {
      console.error('Error loading accountant financial data:', err);
      showToast('تعذر تحميل البيانات المالية من الخادم', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [token, showToast]);

  // ─────────────────────────────────────────────────────────────────────────
  // Session Synchronization
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const rawSession =
        localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ||
        sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
      const rawToken =
        localStorage.getItem('admin_token') ||
        sessionStorage.getItem('admin_token');

      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        const sessionToken = parsed.token || rawToken;
        const sessionRole: AdminRole = parsed.role || 'accountant';

        if (sessionToken) {
          setToken(sessionToken);
          setUserRole(sessionRole);
          setUsername(parsed.username || '');
          setIsAuthenticated(true);
          fetchData(sessionToken);
        }
      } else if (rawToken) {
        setToken(rawToken);
        const savedRole = (localStorage.getItem('nuts_admin_role') || 'accountant') as AdminRole;
        setUserRole(savedRole);
        setIsAuthenticated(true);
        fetchData(rawToken);
      }
    } catch (e) {
      console.error('Failed to parse saved session:', e);
    } finally {
      setAuthChecking(false);
    }
  }, [fetchData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication Actions
  // ─────────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'فشل تسجيل الدخول: تحقق من اسم المستخدم أو كلمة المرور');
        setLoginLoading(false);
        return;
      }

      const resolvedRole: AdminRole = data.role || 'accountant';
      const sessionObj = {
        token: data.token,
        role: resolvedRole,
        username: data.username || loginUsername.trim(),
      };

      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(sessionObj));
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(sessionObj));
      localStorage.setItem('admin_token', data.token);
      sessionStorage.setItem('admin_token', data.token);
      localStorage.setItem('nuts_admin_role', resolvedRole);

      if (resolvedRole === 'cashier') {
        window.location.href = '/pos';
        return;
      }
      if (resolvedRole === 'supplier') {
        window.location.href = '/supplier';
        return;
      }

      setToken(data.token);
      setUserRole(resolvedRole);
      setUsername(data.username || loginUsername.trim());
      setIsAuthenticated(true);
      fetchData(data.token);
      showToast(`مرحباً بك: ${data.username || 'المحاسب المالي'}`);
    } catch (err) {
      console.error('Login request error:', err);
      setLoginError('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
    } catch (_) {}

    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('nuts_admin_role');

    setToken('');
    setIsAuthenticated(false);
    setUserRole('accountant');
    setUsername('');
    setOrders([]);
    setProducts([]);
    setPosShifts([]);
    setPosExpenses([]);
    setSupplyInvoices([]);
    showToast('تم تسجيل الخروج بنجاح');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Financial Calculations & Date Filtering
  // ─────────────────────────────────────────────────────────────────────────
  const dateFilter: FinancialDateRangeFilter = useMemo(() => {
    return {
      preset: datePreset,
      startDate: datePreset === 'custom' ? customStartDate : undefined,
      endDate: datePreset === 'custom' ? customEndDate : undefined,
    };
  }, [datePreset, customStartDate, customEndDate]);

  const report = useMemo(() => {
    return calculateFinancialSummary({
      orders,
      products,
      posShifts,
      posExpenses,
      supplyInvoices,
      vipMembers,
      dateFilter,
    });
  }, [orders, products, posShifts, posExpenses, supplyInvoices, vipMembers, dateFilter]);

  // Product Margins Catalog Memo
  const marginProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch =
          !marginSearchQuery ||
          p.name.toLowerCase().includes(marginSearchQuery.toLowerCase()) ||
          p.origin.toLowerCase().includes(marginSearchQuery.toLowerCase());
        const matchesCategory =
          marginCategoryFilter === 'all' || p.categoryId === marginCategoryFilter;
        return matchesSearch && matchesCategory;
      })
      .map((p) => {
        const retailKg = p.pricePerKg || (p.weights?.[0]?.price ? (p.weights[0].price / (p.weights[0].weightGrams / 1000)) : 0);
        const wholesaleCost = p.costPerKg || 0;
        const profitMarginEgp = roundCurrency(retailKg - wholesaleCost);
        const marginPct = retailKg > 0 ? roundCurrency((profitMarginEgp / retailKg) * 100) : 0;
        return {
          ...p,
          retailKg: roundCurrency(retailKg),
          wholesaleCost: roundCurrency(wholesaleCost),
          profitMarginEgp,
          marginPct,
        };
      });
  }, [products, marginSearchQuery, marginCategoryFilter]);

  // ─────────────────────────────────────────────────────────────────────────
  // CSV Export Trigger
  // ─────────────────────────────────────────────────────────────────────────
  const triggerCsvDownload = (csvContent: string, fileName: string) => {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`تم تنزيل ملف: ${fileName}`, 'success');
      setExportDropdownOpen(false);
    } catch (e) {
      console.error('CSV download error:', e);
      showToast('فشل تصدير ملف CSV', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Loading State
  // ─────────────────────────────────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-amber-200 text-center max-w-md w-full">
          <RefreshCw className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-amber-900 mb-2">جاري التحقق من جلسة المحاسب...</h2>
          <p className="text-amber-700 text-sm">محمصة حفصة للبن والمكسرات — بوابة التقارير المالية والرقابية</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Login Screen (Unauthenticated)
  // ─────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-stone-800 rounded-3xl shadow-2xl border border-amber-500/30 max-w-md w-full p-8 text-stone-100">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-amber-600/20 rounded-2xl border border-amber-500/30 text-amber-400 mb-4">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <h1 className="text-2xl font-black text-amber-400 mb-2">محمصة حفصة للبن والمكسرات</h1>
            <p className="text-stone-300 font-medium text-sm">بوابة المحاسب المالي والتقارير الرقابية</p>
            <div className="mt-3 inline-block bg-amber-950/60 text-amber-300 text-xs px-3 py-1 rounded-full border border-amber-800">
              🔒 وضع المراجعة والتدقيق المالي (Read-Only Audit)
            </div>
          </div>

          {loginError && (
            <div className="mb-6 p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-200 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-2">اسم المستخدم</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم المعتمد"
                className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 text-stone-100 font-medium focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-2">كلمة المرور السرية</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 pl-11 text-stone-100 font-medium focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-900 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري التحقق والمصادقة...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>تسجيل الدخول لبوابة المحاسب</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-700/60 text-center">
            <Link href="/" className="text-xs text-stone-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5">
              <span>العودة لمتجر محمصة حفصة الرئيسي</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Role Isolation Enforcement (Block Cashier & Supplier)
  // ─────────────────────────────────────────────────────────────────────────
  if (userRole !== 'accountant' && userRole !== 'super_admin') {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-stone-800 rounded-3xl shadow-2xl border border-red-500/40 max-w-lg w-full p-8 text-center text-stone-100">
          <div className="inline-flex p-4 bg-red-600/20 rounded-2xl border border-red-500/30 text-red-400 mb-4">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-red-400 mb-2">عزل الصلاحيات: الوصول محظور (403 Forbidden)</h2>
          <p className="text-stone-300 text-sm leading-relaxed mb-6">
            أنت مسجل حالياً بدور <span className="font-bold text-amber-400">({userRole})</span>. بوابة المحاسب المالي مخصصة حصرياً للمحاسب المالي المعتمد والإدارة العامة لتدقيق الأرباح والمصروفات والورديات.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogout}
              className="w-full py-3 px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all"
            >
              تسجيل الخروج والدخول بحساب المحاسب
            </button>
            <Link
              href="/"
              className="w-full py-3 px-6 bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold rounded-xl transition-all block text-center"
            >
              العودة للصفحة الرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Dedicated Accountant Portal
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 font-sans" dir="rtl">
      {/* ───────────────────────────────────────────────────────────────────────
          Toast Notification
      ─────────────────────────────────────────────────────────────────────── */}
      {notification && (
        <div
          className={`fixed bottom-6 left-6 z-50 py-3 px-5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 transition-all ${
            notification.type === 'error'
              ? 'bg-red-900 text-red-100 border border-red-700'
              : 'bg-emerald-900 text-emerald-100 border border-emerald-700'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          Top Navigation Bar
      ─────────────────────────────────────────────────────────────────────── */}
      <header className="bg-stone-900 text-stone-100 border-b border-amber-600/30 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-600/20 border border-amber-500/40 rounded-xl text-amber-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-amber-400">محمصة حفصة للبن والمكسرات</h1>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                  بوابة المحاسب المالي والتقارير
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                نظام التدقيق والرقابة المالية الشاملة — فرع بني مزار والمتجر الإلكتروني
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Refresh Button */}
            <button
              onClick={() => fetchData()}
              disabled={loadingData}
              className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl border border-stone-700 transition-colors title='تحديث البيانات'"
              title="تحديث البيانات لحظياً"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* CSV Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="py-2 px-3.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>تصدير تقارير Excel</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {exportDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-stone-800 border border-stone-700 rounded-2xl shadow-2xl py-2 z-40 text-xs">
                  <div className="px-3 py-1.5 text-stone-400 font-bold border-b border-stone-700/60 mb-1">
                    تصدير ملفات CSV متوافقة مع Excel العربي (BOM):
                  </div>
                  <button
                    onClick={() =>
                      triggerCsvDownload(
                        generateFinancialSummaryCsv(report),
                        `hafsa-financial-summary-${datePreset}.csv`
                      )
                    }
                    className="w-full text-right px-4 py-2.5 hover:bg-stone-700/80 text-stone-200 font-medium flex items-center gap-2.5"
                  >
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>تقرير قائمة الدخل والربحية الشامل</span>
                  </button>
                  <button
                    onClick={() =>
                      triggerCsvDownload(
                        generateShiftsAuditCsv(report.shiftAudits as unknown as PosShift[]),
                        `hafsa-shifts-drawer-audit.csv`
                      )
                    }
                    className="w-full text-right px-4 py-2.5 hover:bg-stone-700/80 text-stone-200 font-medium flex items-center gap-2.5"
                  >
                    <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تقرير تدقيق ورديات الكاشير والدرج</span>
                  </button>
                  <button
                    onClick={() =>
                      triggerCsvDownload(
                        generateExpensesLedgerCsv(posExpenses),
                        `hafsa-operational-expenses.csv`
                      )
                    }
                    className="w-full text-right px-4 py-2.5 hover:bg-stone-700/80 text-stone-200 font-medium flex items-center gap-2.5"
                  >
                    <DollarSign className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>دفتر المصروفات النثرية والتشغيلية</span>
                  </button>
                  <button
                    onClick={() =>
                      triggerCsvDownload(
                        generateSupplyLedgerCsv(supplyInvoices),
                        `hafsa-supply-invoices-ledger.csv`
                      )
                    }
                    className="w-full text-right px-4 py-2.5 hover:bg-stone-700/80 text-stone-200 font-medium flex items-center gap-2.5"
                  >
                    <Truck className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>سجل فواتير التوريد والالتزامات</span>
                  </button>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="py-2 px-3 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/60 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────────────────
          Read-Only Security Banner
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="bg-amber-100 border-b border-amber-300 text-amber-950 py-2.5 px-4 text-xs font-bold shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              🔒 وضع المراجعة والتدقيق المالي (Read-Only Audit) — كافة السجلات والعمليات محمية ضد التعديل، والمحاسب يتمتع بصلاحية الاطلاع والتحليل الشامل وتصدير التقارير.
            </span>
          </div>
          <div className="text-amber-800 font-medium">
            المستخدم النشط: <span className="font-bold underline">{username || 'accountant_fin'}</span> ({userRole})
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ───────────────────────────────────────────────────────────────────────
            Date Range Filter Bar
        ─────────────────────────────────────────────────────────────────────── */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-600">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>الفترة الزمنية للتقرير:</span>
            <div className="inline-flex bg-stone-100 p-1 rounded-xl border border-stone-200">
              {(
                [
                  { id: 'all', label: 'كافة الفترات' },
                  { id: 'today', label: 'اليوم' },
                  { id: 'this_week', label: 'آخر 7 أيام' },
                  { id: 'this_month', label: 'هذا الشهر' },
                  { id: 'custom', label: 'تخصيص تاريخ' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setDatePreset(preset.id)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    datePreset === preset.id
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-stone-600">من:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-stone-50 border border-stone-300 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-stone-600">إلى:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-stone-50 border border-stone-300 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          <div className="text-xs text-stone-500 font-medium">
            تحديث التقارير لحظياً بناءً على آخر العمليات المسجلة
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────────
            7 High-Level KPI Cards Grid
        ─────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Gross Revenue */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold">إجمالي الإيرادات (Total Revenue)</span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-stone-900">
              {report.totalRevenue.toLocaleString()} <span className="text-xs font-normal text-stone-500">ج.م</span>
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              مجموع {report.onlineMetrics.orderCount + report.posMetrics.orderCount} طلب وفاتورة مبيعات
            </div>
          </div>

          {/* KPI 2: Online vs POS Revenue */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold">توزيع القنوات (Online vs POS)</span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-600 font-bold">المتجر الأونلاين:</span>
                <span className="font-black text-blue-700">{report.onlineMetrics.grossRevenue.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-600 font-bold">كاشير الفرع:</span>
                <span className="font-black text-amber-700">{report.posMetrics.grossRevenue.toLocaleString()} ج.م</span>
              </div>
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              {report.totalRevenue > 0
                ? `نسبة الأونلاين: ${roundCurrency((report.onlineMetrics.grossRevenue / report.totalRevenue) * 100)}%`
                : 'لا توجد مبيعات في الفترة'}
            </div>
          </div>

          {/* KPI 3: COGS (Wholesale Raw Cost) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold">تكلفة البضاعة المباعة (COGS)</span>
              <div className="p-2 bg-stone-100 text-stone-700 rounded-xl">
                <Archive className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-stone-900">
              {report.totalCogs.toLocaleString()} <span className="text-xs font-normal text-stone-500">ج.م</span>
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              تمثل {report.totalRevenue > 0 ? roundCurrency((report.totalCogs / report.totalRevenue) * 100) : 0}% من إجمالي المبيعات
            </div>
          </div>

          {/* KPI 4: Petty Expenses */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold">المصروفات التشغيلية (Expenses)</span>
              <div className="p-2 bg-red-50 text-red-700 rounded-xl">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-stone-900">
              {report.operatingExpenses.toLocaleString()} <span className="text-xs font-normal text-stone-500">ج.م</span>
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              مصروفات الفرع النثرية المقيدة بالورديات
            </div>
          </div>

          {/* KPI 5: Net Operating Profit */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold">صافي الربح الفعلي (Net Profit)</span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className={`text-2xl font-black ${report.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {report.netOperatingProfit.toLocaleString()} <span className="text-xs font-normal text-stone-500">ج.م</span>
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              الإيرادات - تكلفة الخامات - المصروفات النثرية
            </div>
          </div>

          {/* KPI 6: Net Margin % */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold">هامش الربح الصافي (Net Margin)</span>
              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className={`text-2xl font-black ${report.netMarginPercent >= 15 ? 'text-purple-700' : 'text-amber-700'}`}>
              {report.netMarginPercent}%
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              {report.netMarginPercent >= 15 ? '✅ نسبة صحية ومطابقة لمعايير الربحية' : '⚠️ أقل من المستهدف المرجعي (15%)'}
            </div>
          </div>

          {/* KPI 7: Cash Drawer Variance */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between col-span-1 sm:col-span-2">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold">مطابقة دروج الكاشير (Drawer Reconciliation)</span>
              <div className="p-2 bg-stone-100 text-stone-700 rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <div className={`text-2xl font-black ${
                report.totalDrawerVariance === 0
                  ? 'text-emerald-700'
                  : report.totalDrawerVariance > 0
                  ? 'text-blue-700'
                  : 'text-red-700'
              }`}>
                {report.totalDrawerVariance > 0 ? `+${report.totalDrawerVariance}` : report.totalDrawerVariance}{' '}
                <span className="text-xs font-normal text-stone-500">ج.م</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                report.totalDrawerVariance === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : report.totalDrawerVariance > 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {report.totalDrawerVariance === 0
                  ? 'مطابق تماماً'
                  : report.totalDrawerVariance > 0
                  ? `فائض في الدرج (+${report.totalDrawerVariance} ج.م)`
                  : `عجز إجمالي بالدرج (${report.totalDrawerVariance} ج.م)`}
              </span>
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium flex justify-between">
              <span>عجز إجمالي: <span className="font-bold text-red-600">{report.totalDrawerShortage} ج.م</span></span>
              <span>فائض إجمالي: <span className="font-bold text-blue-600">{report.totalDrawerSurplus} ج.م</span></span>
              <span>ورديات مدققة: <span className="font-bold text-stone-800">{report.shiftAudits.length}</span></span>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────────
            5 Focused Sub-Tabs Bar
        ─────────────────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="flex border-b border-stone-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('channels')}
              className={`py-3.5 px-5 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'channels'
                  ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>مقارنة قنوات البيع (أونلاين vs كاشير)</span>
            </button>

            <button
              onClick={() => setActiveTab('shifts')}
              className={`py-3.5 px-5 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'shifts'
                  ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>تدقيق ورديات الكاشير والدرج</span>
              <span className="bg-stone-200 text-stone-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {report.shiftAudits.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-3.5 px-5 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>دفتر المصروفات التشغيلية</span>
              <span className="bg-stone-200 text-stone-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {posExpenses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('supply')}
              className={`py-3.5 px-5 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'supply'
                  ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>سجل فواتير التوريد والالتزامات</span>
              <span className="bg-stone-200 text-stone-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {supplyInvoices.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('margins')}
              className={`py-3.5 px-5 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'margins'
                  ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Percent className="w-4 h-4" />
              <span>تدقيق هوامش ربحية الأصناف</span>
              <span className="bg-stone-200 text-stone-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {products.length}
              </span>
            </button>
          </div>

          <div className="p-6">
            {/* ─────────────────────────────────────────────────────────────────
                Tab 1: Channels Comparison (Online vs POS)
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'channels' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Online Channel Card */}
                  <div className="bg-stone-50 border border-blue-200 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 left-0 h-1.5 bg-blue-600" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                          <ShoppingCart className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-stone-900">المتجر الإلكتروني (Online Storefront)</h3>
                          <p className="text-xs text-stone-500">طلبات التوصيل للمنازل وقرى مركز بني مزار</p>
                        </div>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                        {report.onlineMetrics.orderCount} طلب
                      </span>
                    </div>

                    <div className="space-y-3 divide-y divide-stone-200 text-xs">
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">إجمالي المبيعات (Gross Revenue):</span>
                        <span className="font-black text-stone-900 text-sm">{report.onlineMetrics.grossRevenue.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">المجموع الفرعي (Subtotal):</span>
                        <span className="font-bold text-stone-800">{report.onlineMetrics.subtotal.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">إيرادات الشحن والتوصيل:</span>
                        <span className="font-bold text-stone-800">{report.onlineMetrics.shippingRevenue.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">الخصومات وكوبونات الترويج:</span>
                        <span className="font-bold text-red-600">-{report.onlineMetrics.discountTotal.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">تكلفة البضاعة المباعة (COGS):</span>
                        <span className="font-bold text-stone-700">{report.onlineMetrics.cogs.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2 bg-blue-50/60 p-2 rounded-lg">
                        <span className="text-blue-900 font-bold">إجمالي الربح التجاري (Gross Profit):</span>
                        <span className="font-black text-blue-900 text-sm">{report.onlineMetrics.grossProfit.toLocaleString()} ج.م ({report.onlineMetrics.grossMarginPercent}%)</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">متوسط قيمة الطلب (Average Ticket):</span>
                        <span className="font-bold text-stone-800">{report.onlineMetrics.avgTicket.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  </div>

                  {/* POS Channel Card */}
                  <div className="bg-stone-50 border border-amber-200 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 left-0 h-1.5 bg-amber-600" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                          <Store className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-stone-900">كاشير الفرع المباشر (POS Store Terminal)</h3>
                          <p className="text-xs text-stone-500">مبيعات المحل (أمام مسجد الزراعيين) وبار القهوة</p>
                        </div>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
                        {report.posMetrics.orderCount} فاتورة
                      </span>
                    </div>

                    <div className="space-y-3 divide-y divide-stone-200 text-xs">
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">إجمالي المبيعات (Gross Revenue):</span>
                        <span className="font-black text-stone-900 text-sm">{report.posMetrics.grossRevenue.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">المجموع الفرعي (Subtotal):</span>
                        <span className="font-bold text-stone-800">{report.posMetrics.subtotal.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">خصومات فورية واستبدال نقاط VIP:</span>
                        <span className="font-bold text-red-600">-{report.posMetrics.discountTotal.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">تكلفة الخامات والمواد المباعة (COGS):</span>
                        <span className="font-bold text-stone-700">{report.posMetrics.cogs.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-2 bg-amber-50/60 p-2 rounded-lg">
                        <span className="text-amber-900 font-bold">إجمالي الربح التجاري (Gross Profit):</span>
                        <span className="font-black text-amber-900 text-sm">{report.posMetrics.grossProfit.toLocaleString()} ج.م ({report.posMetrics.grossMarginPercent}%)</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-stone-600">متوسط قيمة الفاتورة (Average Ticket):</span>
                        <span className="font-bold text-stone-800">{report.posMetrics.avgTicket.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIP Liabilities Overview */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-200 text-amber-900 rounded-xl">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-amber-950 text-sm">التزامات نادي عملاء حفصة VIP (Cashback Liabilities)</div>
                      <div className="text-amber-800">أرصدة الكاش باك المعلقة في محافظ العملاء المستحقة للاستبدال</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-amber-950">
                      {report.vipLiabilities.totalPointsBalance.toLocaleString()} ج.م
                    </div>
                    <div className="text-amber-800 font-medium">
                      إجمالي {report.vipLiabilities.membersCount} عميل مسجل
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                Tab 2: Shifts & Drawer Reconciliation
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'shifts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-stone-900">سجل ورديات الكاشير وجرد النقدية بالدرج</h3>
                    <p className="text-xs text-stone-500">مقارنة النقدية الفعلية المحصية مع الرصيد المتوقع برمجياً</p>
                  </div>
                  <button
                    onClick={() =>
                      triggerCsvDownload(
                        generateShiftsAuditCsv(report.shiftAudits as unknown as PosShift[]),
                        'hafsa-shifts-audit.csv'
                      )
                    }
                    className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-stone-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير الورديات CSV</span>
                  </button>
                </div>

                {report.shiftAudits.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
                    لا توجد ورديات مسجلة في الفترة الزمنية المحددة
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-stone-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                        <tr>
                          <th className="p-3">رقم الوردية</th>
                          <th className="p-3">الكاشير</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">رصيد الافتتاح</th>
                          <th className="p-3">المبيعات النقدية</th>
                          <th className="p-3">إلكتروني</th>
                          <th className="p-3">المصروفات</th>
                          <th className="p-3">المتوقع بالدرج</th>
                          <th className="p-3">الفعلي المحصي</th>
                          <th className="p-3">الفارق (عجز/فائض)</th>
                          <th className="p-3">صافي الربح</th>
                          <th className="p-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {report.shiftAudits.map((shift) => {
                          const origShift = posShifts.find((s) => s.id === shift.shiftId) || (shift as unknown as PosShift);
                          return (
                            <tr key={shift.shiftId} className="hover:bg-amber-50/30 transition-colors">
                              <td className="p-3 font-bold text-stone-900">{shift.shiftNumber}</td>
                              <td className="p-3 text-stone-700">{shift.cashierName}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  shift.status === 'open'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-stone-100 text-stone-700'
                                }`}>
                                  {shift.status === 'open' ? '🟢 مفتوحة' : 'مغلقة'}
                                </span>
                              </td>
                              <td className="p-3 text-stone-800">{shift.openingCash} ج.م</td>
                              <td className="p-3 font-bold text-stone-900">{shift.cashSalesTotal} ج.م</td>
                              <td className="p-3 text-stone-600">{shift.electronicSalesTotal} ج.م</td>
                              <td className="p-3 text-red-600">-{shift.expensesTotal} ج.م</td>
                              <td className="p-3 font-bold text-stone-900">{shift.expectedCashInDrawer} ج.م</td>
                              <td className="p-3 text-stone-800">
                                {shift.actualClosingCash !== undefined ? `${shift.actualClosingCash} ج.م` : '—'}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  shift.varianceType === 'balanced'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : shift.varianceType === 'surplus'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {shift.varianceType === 'balanced'
                                    ? 'مطابق'
                                    : shift.varianceType === 'surplus'
                                    ? `فائض (+${shift.variance})`
                                    : `عجز (${shift.variance})`}
                                </span>
                              </td>
                              <td className="p-3 font-black text-emerald-700">{shift.totalNetProfit} ج.م</td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => setSelectedShiftForZReport(origShift)}
                                  className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px] border border-amber-300 inline-flex items-center gap-1"
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
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                Tab 3: Operating Expenses Ledger
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-stone-900">دفتر قيد المصروفات النثرية والتشغيلية</h3>
                    <p className="text-xs text-stone-500">تسجيل نفقات الفرع المسحوبة من درج الكاشير أثناء الورديات</p>
                  </div>
                  <button
                    onClick={() =>
                      triggerCsvDownload(
                        generateExpensesLedgerCsv(posExpenses),
                        'hafsa-operating-expenses.csv'
                      )
                    }
                    className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-stone-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير المصروفات CSV</span>
                  </button>
                </div>

                {posExpenses.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
                    لا توجد مصروفات مسجلة في الفترة المحددة
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-stone-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                        <tr>
                          <th className="p-3">المعرف</th>
                          <th className="p-3">الوردية</th>
                          <th className="p-3">بيان المصروف</th>
                          <th className="p-3">المبلغ</th>
                          <th className="p-3">التصنيف</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {posExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="p-3 font-mono text-stone-600">{exp.id.slice(0, 10)}</td>
                            <td className="p-3 font-bold text-stone-800">{exp.shiftId || 'عام'}</td>
                            <td className="p-3 font-bold text-stone-900">{exp.title}</td>
                            <td className="p-3 font-black text-red-600">{exp.amount} ج.م</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
                                {exp.category === 'raw_materials'
                                  ? 'خامات ومواد أولية'
                                  : exp.category === 'packaging'
                                  ? 'تعبئة وتغليف'
                                  : exp.category === 'utilities'
                                  ? 'مرافق وكهرباء'
                                  : exp.category === 'delivery_rider'
                                  ? 'أجرة طيار'
                                  : 'أخرى'}
                              </span>
                            </td>
                            <td className="p-3 text-stone-500 font-mono text-[11px]">{exp.createdAt?.slice(0, 16)}</td>
                            <td className="p-3 text-stone-600">{exp.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                Tab 4: Supply Invoices Ledger
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'supply' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-stone-900">سجل فواتير التوريد والالتزامات للموردين</h3>
                    <p className="text-xs text-stone-500">متابعة الفواتير المعتمدة والمضافة للمخزون والفواتير المعلقة</p>
                  </div>
                  <button
                    onClick={() =>
                      triggerCsvDownload(
                        generateSupplyLedgerCsv(supplyInvoices),
                        'hafsa-supply-ledger.csv'
                      )
                    }
                    className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-stone-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير فواتير التوريد CSV</span>
                  </button>
                </div>

                {/* Supply Summary Stat Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-xs text-emerald-800 font-bold block mb-1">فواتير معتمدة ومضافة للمخزون</span>
                    <span className="text-xl font-black text-emerald-900">
                      {report.supplyFinancials.approvedTotal.toLocaleString()} ج.م
                    </span>
                    <span className="text-xs text-emerald-700 mr-2 font-medium">({report.supplyFinancials.approvedCount} فاتورة)</span>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-xs text-amber-800 font-bold block mb-1">فواتير معلقة بانتظار موافقة المدير</span>
                    <span className="text-xl font-black text-amber-900">
                      {report.supplyFinancials.pendingTotal.toLocaleString()} ج.م
                    </span>
                    <span className="text-xs text-amber-700 mr-2 font-medium">({report.supplyFinancials.pendingCount} فاتورة)</span>
                  </div>

                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                    <span className="text-xs text-stone-700 font-bold block mb-1">فواتير توريد مرفوضة</span>
                    <span className="text-xl font-black text-stone-800">
                      {report.supplyFinancials.rejectedTotal.toLocaleString()} ج.م
                    </span>
                    <span className="text-xs text-stone-600 mr-2 font-medium">({report.supplyFinancials.rejectedCount} فاتورة)</span>
                  </div>
                </div>

                {supplyInvoices.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
                    لا توجد فواتير توريد مسجلة
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-stone-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                        <tr>
                          <th className="p-3">رقم الفاتورة</th>
                          <th className="p-3">المورد</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">تاريخ الإنشاء</th>
                          <th className="p-3">المعتمد</th>
                          <th className="p-3">إجمالي القيمة</th>
                          <th className="p-3">عدد الأصناف</th>
                          <th className="p-3 text-center">التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {supplyInvoices.map((inv) => {
                          const isExpanded = expandedSupplyInvoiceId === inv.id;
                          return (
                            <React.Fragment key={inv.id}>
                              <tr className="hover:bg-amber-50/30 transition-colors">
                                <td className="p-3 font-bold text-stone-900">{inv.invoiceNumber}</td>
                                <td className="p-3 font-medium text-stone-800">{inv.supplierName}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    inv.status === 'approved'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : inv.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {inv.status === 'approved'
                                      ? 'معتمدة ومضافة للمخزون'
                                      : inv.status === 'pending'
                                      ? 'معلقة (بانتظار الإدارة)'
                                      : 'مرفوضة'}
                                  </span>
                                </td>
                                <td className="p-3 text-stone-600 font-mono text-[11px]">{inv.createdAt?.slice(0, 10)}</td>
                                <td className="p-3 text-stone-700">{inv.reviewedBy || '—'}</td>
                                <td className="p-3 font-black text-stone-900">{inv.totalAmount.toLocaleString()} ج.م</td>
                                <td className="p-3 text-stone-700">{(inv.items || []).length} أصناف</td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => setExpandedSupplyInvoiceId(isExpanded ? null : inv.id)}
                                    className="p-1 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-stone-50 border-t border-stone-200">
                                  <td colSpan={8} className="p-4">
                                    <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
                                      <div className="text-xs font-bold text-stone-700">بنود أصناف الفاتورة:</div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {(inv.items || []).map((it, idx) => (
                                          <div key={idx} className="p-2 bg-stone-50 rounded-lg border border-stone-200 text-xs">
                                            <div className="font-bold text-stone-900">{it.productName}</div>
                                            <div className="text-stone-600 text-[11px]">
                                              الكمية: <span className="font-bold text-stone-800">{it.quantityKg} كجم</span> × التكلفة: <span className="font-bold text-stone-800">{it.costPerKg} ج.م</span>
                                            </div>
                                            <div className="font-bold text-amber-800 text-xs mt-1">
                                              الإجمالي: {it.totalCost.toLocaleString()} ج.م
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      {inv.notes && (
                                        <div className="text-xs text-stone-600 pt-2 border-t border-stone-100">
                                          <span className="font-bold">ملاحظات المورد:</span> {inv.notes}
                                        </div>
                                      )}
                                      {inv.adminNotes && (
                                        <div className="text-xs text-amber-800">
                                          <span className="font-bold">ملاحظات الإدارة:</span> {inv.adminNotes}
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
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                Tab 5: Product Margins & Catalog Wholesale Audit
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'margins' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-stone-900">تدقيق هوامش ربحية أصناف الكتالوج</h3>
                    <p className="text-xs text-stone-500">مقارنة أسعار التكلفة بالجملة (Excel عرفات) مع أسعار البيع للمستهلك</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={marginSearchQuery}
                        onChange={(e) => setMarginSearchQuery(e.target.value)}
                        placeholder="ابحث عن صنف..."
                        className="bg-stone-50 border border-stone-300 rounded-xl pr-8 pl-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                      />
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                      <tr>
                        <th className="p-3">اسم المنتج</th>
                        <th className="p-3">التصنيف</th>
                        <th className="p-3">رصيد المخزون</th>
                        <th className="p-3">تكلفة الجملة (كجم)</th>
                        <th className="p-3">سعر البيع (كجم)</th>
                        <th className="p-3">هامش الربح (ج.م)</th>
                        <th className="p-3">نسبة الهامش %</th>
                        <th className="p-3">قنوات العرض</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {marginProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-3 font-bold text-stone-900">{p.name}</td>
                          <td className="p-3 text-stone-600">{p.origin || p.categoryId}</td>
                          <td className="p-3">
                            <span className={`font-bold ${((p.stockKg ?? 0) <= 5) ? 'text-red-600' : 'text-stone-800'}`}>
                              {p.stockKg ?? 0} كجم
                            </span>
                          </td>
                          <td className="p-3 text-stone-700 font-medium">{p.wholesaleCost} ج.م</td>
                          <td className="p-3 font-bold text-stone-900">{p.retailKg} ج.م</td>
                          <td className="p-3 font-black text-emerald-700">{p.profitMarginEgp} ج.م</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.marginPct >= 20
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.marginPct >= 10
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {p.marginPct}%
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {p.showOnline !== false && (
                                <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                  أونلاين
                                </span>
                              )}
                              {p.showInPos !== false && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold">
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
          </div>
        </div>
      </main>

      {/* ───────────────────────────────────────────────────────────────────────
          Z-Report Printable Modal
      ─────────────────────────────────────────────────────────────────────── */}
      {selectedShiftForZReport && (
        <SupermarketReceiptModal
          shift={selectedShiftForZReport}
          mode="zreport"
          settings={settings || undefined}
          showProfit={true}
          onClose={() => setSelectedShiftForZReport(null)}
        />
      )}
    </div>
  );
}
