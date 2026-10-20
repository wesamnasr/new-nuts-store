'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Truck,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  LogOut,
  Search,
  Filter,
  Layers,
  ShieldCheck,
  Eye,
  EyeOff,
  FileText,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Product, Category, SupplyInvoice, SupplyInvoiceItem, AdminRole } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';

const ADMIN_SESSION_STORAGE_KEY = 'nuts_admin_session';

interface InvoiceDraftItem {
  productId: string;
  productName: string;
  quantityKg: number;
  costPerKg: number;
}

export default function DedicatedSupplierPortalPage() {
  // Auth state
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<AdminRole>('supplier');
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string>('');

  // Login form state
  const [loginRole, setLoginRole] = useState<AdminRole>('supplier');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<SupplyInvoice[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'invoices'>('inventory');

  // Filter state for inventory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'shortage' | 'in_stock'>('all');

  // Filter state for invoices
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // New Invoice Modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [draftItems, setDraftItems] = useState<InvoiceDraftItem[]>([]);
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState<boolean>(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  // Fetch store and invoices data
  const fetchData = useCallback(async (activeToken?: string) => {
    const currentToken = activeToken || token;
    if (!currentToken) return;

    setLoadingData(true);
    try {
      const headers = {
        Authorization: `Bearer ${currentToken}`,
        'x-admin-token': currentToken,
      };

      // 1. Fetch store catalog
      const storeRes = await fetch('/api/store', { headers, cache: 'no-store' });
      if (storeRes.ok) {
        const storeData = await storeRes.json();
        setProducts(Array.isArray(storeData.products) ? storeData.products : []);
        setCategories(Array.isArray(storeData.categories) ? storeData.categories : []);
      }

      // 2. Fetch supply invoices
      const invRes = await fetch('/api/supply-invoices', { headers, cache: 'no-store' });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(Array.isArray(invData.invoices) ? invData.invoices : []);
      }
    } catch (err) {
      console.error('Failed to fetch supplier portal data', err);
      showToast('تعذر تحميل أحدث البيانات من الخادم', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [token, showToast]);

  // Verify existing session
  useEffect(() => {
    const verifySession = async () => {
      setAuthChecking(true);
      try {
        let savedToken = '';
        let savedRole: AdminRole | undefined;

        const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.token && (parsed?.expiresAt ? parsed.expiresAt > Date.now() : true)) {
              savedToken = parsed.token;
              savedRole = parsed.role;
            }
          } catch {}
        }

        if (!savedToken) {
          savedToken =
            sessionStorage.getItem('admin_token') ||
            localStorage.getItem('admin_token') ||
            '';
        }

        if (!savedToken) {
          setAuthChecking(false);
          setIsAuthenticated(false);
          return;
        }

        const res = await fetch('/api/admin/login', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
            'x-admin-token': savedToken,
          },
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          const verifiedRole: AdminRole = data.role || savedRole || 'supplier';
          const activeToken = data.token || savedToken;

          // Sync storage
          sessionStorage.setItem('admin_token', activeToken);
          localStorage.setItem('admin_token', activeToken);
          localStorage.setItem(
            ADMIN_SESSION_STORAGE_KEY,
            JSON.stringify({
              token: activeToken,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
              role: verifiedRole,
              username: data.username,
            })
          );

          if (verifiedRole === 'cashier') {
            window.location.replace('/pos');
            return;
          }
          if (verifiedRole === 'accountant') {
            window.location.replace('/accountant');
            return;
          }

          setToken(activeToken);
          setUserRole(verifiedRole);
          setUsername(data.username || 'supplier_arafat');
          setIsAuthenticated(true);

          await fetchData(activeToken);
        } else {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_token');
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Session verification error', err);
        setIsAuthenticated(false);
      } finally {
        setAuthChecking(false);
      }
    };

    verifySession();
  }, [fetchData]);

  // Handle Login
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

      if (res.ok && data.success) {
        const verifiedRole: AdminRole = data.role || 'supplier';
        const activeToken = data.token;

        sessionStorage.setItem('admin_token', activeToken);
        localStorage.setItem('admin_token', activeToken);
        localStorage.setItem(
          ADMIN_SESSION_STORAGE_KEY,
          JSON.stringify({
            token: activeToken,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            role: verifiedRole,
            username: data.username,
          })
        );

        if (verifiedRole === 'cashier') {
          window.location.href = '/pos';
          return;
        }
        if (verifiedRole === 'accountant') {
          window.location.href = '/accountant';
          return;
        }

        setToken(activeToken);
        setUserRole(verifiedRole);
        setUsername(data.username || loginUsername);
        setIsAuthenticated(true);

        showToast('تم تسجيل الدخول بنجاح إلى بوابة المورد ✅');
        await fetchData(activeToken);
      } else {
        setLoginError(data.error || 'فشل تسجيل الدخول: يرجى التحقق من اسم المستخدم وكلمة المرور');
      }
    } catch (err: any) {
      setLoginError('حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {}
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token');
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setToken('');
    setProducts([]);
    setInvoices([]);
    showToast('تم تسجيل الخروج بنجاح');
  };

  // KPIs
  const kpiData = useMemo(() => {
    const totalItems = products.length;
    const inStockItems = products.filter((p) => p.inStock && (p.stockKg || 0) > 0).length;
    const shortageItems = products.filter((p) => !p.inStock || (p.stockKg || 0) <= 10).length;
    const productsWithCost = products.filter((p) => typeof p.costPerKg === 'number' && p.costPerKg > 0);
    const avgCost =
      productsWithCost.length > 0
        ? Math.round(
            (productsWithCost.reduce((sum, p) => sum + (p.costPerKg || 0), 0) /
              productsWithCost.length) *
              10
          ) / 10
        : 0;

    const pendingInvoices = invoices.filter((i) => i.status === 'pending').length;
    const approvedInvoices = invoices.filter((i) => i.status === 'approved').length;

    return { totalItems, inStockItems, shortageItems, avgCost, pendingInvoices, approvedInvoices };
  }, [products, invoices]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.slug.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === 'all' || product.categoryId === categoryFilter;

      const currentStock = typeof product.stockKg === 'number' ? product.stockKg : 0;
      const isShortage = !product.inStock || currentStock <= 10;

      let matchesStock = true;
      if (stockStatusFilter === 'shortage') {
        matchesStock = isShortage;
      } else if (stockStatusFilter === 'in_stock') {
        matchesStock = !isShortage;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchQuery, categoryFilter, stockStatusFilter]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (invoiceStatusFilter === 'all') return true;
      return inv.status === invoiceStatusFilter;
    });
  }, [invoices, invoiceStatusFilter]);

  // Pre-fill invoice modal from product row
  const handleQuickAddProductToInvoice = (product: Product) => {
    const existing = draftItems.find((item) => item.productId === product.id);
    if (!existing) {
      setDraftItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantityKg: 20,
          costPerKg: product.costPerKg || 400,
        },
      ]);
    }
    setIsInvoiceModalOpen(true);
  };

  // Add empty row in draft invoice
  const handleAddDraftRow = () => {
    const available = products.find((p) => !draftItems.some((d) => d.productId === p.id)) || products[0];
    if (available) {
      setDraftItems((prev) => [
        ...prev,
        {
          productId: available.id,
          productName: available.name,
          quantityKg: 10,
          costPerKg: available.costPerKg || 350,
        },
      ]);
    }
  };

  // Update row in draft invoice
  const handleUpdateDraftRow = (index: number, field: keyof InvoiceDraftItem, value: any) => {
    setDraftItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'productId') {
        const prod = products.find((p) => p.id === value);
        item.productId = value;
        item.productName = prod?.name || item.productName;
        if (prod?.costPerKg) {
          item.costPerKg = prod.costPerKg;
        }
      } else if (field === 'quantityKg') {
        item.quantityKg = Math.max(0.1, Number(value));
      } else if (field === 'costPerKg') {
        item.costPerKg = Math.max(1, Number(value));
      }
      updated[index] = item;
      return updated;
    });
  };

  // Remove row from draft invoice
  const handleRemoveDraftRow = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate draft invoice total
  const draftTotalAmount = useMemo(() => {
    return Math.round(
      draftItems.reduce((sum, item) => sum + (item.quantityKg * item.costPerKg), 0) * 100
    ) / 100;
  }, [draftItems]);

  // Submit invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draftItems.length === 0) {
      showToast('يجب إضافة صنف واحد على الأقل للفاتورة', 'error');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const payload = {
        items: draftItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantityKg: item.quantityKg,
          costPerKg: item.costPerKg,
        })),
        notes: draftNotes.trim() || undefined,
        supplierName: 'شركة أرافت للاستيراد والتوريد الزراعي',
      };

      const res = await fetch('/api/supply-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-admin-token': token,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('تم إرسال فاتورة التوريد بنجاح! الفاتورة الآن قيد مراجعة واعتماد الإدارة 📦✅');
        setDraftItems([]);
        setDraftNotes('');
        setIsInvoiceModalOpen(false);
        setActiveTab('invoices');
        await fetchData(token);
      } else {
        showToast(data.error || 'فشل في إرسال فاتورة التوريد', 'error');
      }
    } catch (err: any) {
      showToast('حدث خطأ في الاتصال بالخادم أثناء إرسال الفاتورة', 'error');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Loading or Auth Guard
  // ─────────────────────────────────────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-extrabold text-gold-300">جاري التحقق من هوية بوابة المورد المعزولة...</h2>
        <p className="text-xs text-brand-400 mt-1">محمصة حفصة للبن والمكسرات — بني مزار</p>
      </div>
    );
  }

  // Login view if unauthenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-gold-500/30 text-right space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
              <Truck className="w-8 h-8 text-amber-600" />
            </div>
            <span className="inline-block bg-amber-100 text-amber-900 text-[11px] font-black px-3 py-0.5 rounded-full">
              بوابة المورد والتوريدات المعزولة
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-brand-950">
              محمصة حفصة للبن والمكسرات
            </h1>
            <p className="text-xs text-brand-600 leading-relaxed">
              تسجيل دخول مخصص لموردي البن والمكسرات الخام لمتابعة النواقص وإرسال فواتير التوريد لاعتمادها من الإدارة.
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-2xl font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-brand-950 mb-1.5">
                اسم المستخدم (Username)
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="أدخل اسم مستخدم المورد..."
                className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-800"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-brand-950 mb-1.5">
                كلمة المرور (Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور المورد..."
                  className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-800 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-900 transition"
                  title={showPassword ? 'إخفاء' : 'إظهار'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-brand-900 hover:bg-brand-950 text-white font-black py-3 rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق من بيانات الدخول...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-gold-400" />
                  <span>دخول إلى بوابة المورد</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-brand-100 flex items-center justify-between text-[11px] text-brand-600">
            <Link href="/" className="hover:text-brand-950 font-bold transition flex items-center gap-1">
              <span>← العودة للمتجر الرئيسي</span>
            </Link>
            <Link href="/admin" className="hover:text-brand-950 font-bold transition">
              لوحة تحكم الإدارة
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Authenticated Supplier Portal
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-50/50 flex flex-col font-sans pb-16" dir="rtl">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2.5 animate-bounce ${
            notification.type === 'success'
              ? 'bg-brand-950 text-gold-400 border border-gold-500/40'
              : 'bg-red-900 text-white border border-red-500'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-pistachio-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="bg-brand-950 text-white border-b border-brand-800 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30">
              <Truck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white">
                  محمصة حفصة — بوابة المورد والتوريدات
                </h1>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  {userRole === 'super_admin' ? '👑 أدمن كامل' : '📦 مورد معتمد'}
                </span>
              </div>
              <p className="text-[10.5px] text-brand-300">
                شركة أرافت للاستيراد والتوريد الزراعي (فرع بني مزار)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDraftItems([]);
                handleAddDraftRow();
                setIsInvoiceModalOpen(true);
              }}
              className="bg-gold-500 hover:bg-gold-400 text-brand-950 font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">إنشاء فاتورة توريد جديدة</span>
              <span className="sm:hidden">فاتورة جديدة</span>
            </button>

            <button
              onClick={() => fetchData()}
              disabled={loadingData}
              className="bg-brand-900 hover:bg-brand-800 text-brand-200 p-2 rounded-xl border border-brand-700 transition"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 p-2 rounded-xl transition"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-brand-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-brand-600 text-xs font-bold">
              <span>إجمالي أصناف الكتالوج</span>
              <Layers className="w-4 h-4 text-brand-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-brand-950">{kpiData.totalItems} صنف</div>
            <div className="text-[10px] text-brand-500 font-bold">موزعة على {categories.length} أقسام</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-brand-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-pistachio-700 text-xs font-bold">
              <span>أصناف متوفرة</span>
              <CheckCircle2 className="w-4 h-4 text-pistachio-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-pistachio-800">{kpiData.inStockItems} صنف</div>
            <div className="text-[10px] text-pistachio-600 font-bold">مخزون كافٍ للبيع</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-amber-700 text-xs font-bold">
              <span>تنبيهات النواقص</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-800">{kpiData.shortageItems} صنف</div>
            <div className="text-[10px] text-amber-600 font-bold">أقل من 10 كجم أو نفد المخزون</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-brand-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-brand-600 text-xs font-bold">
              <span>متوسط تكلفة الكيلو</span>
              <DollarSign className="w-4 h-4 text-gold-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-brand-950">{kpiData.avgCost} ج.م</div>
            <div className="text-[10px] text-brand-500 font-bold">تكلفة الجملة الفعلية</div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-brand-200 pb-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-brand-900 text-white shadow-sm'
                : 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-100/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>مخزون ونواقص الأصناف ({filteredProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'invoices'
                ? 'bg-brand-900 text-white shadow-sm'
                : 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-100/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>سجل فواتير التوريد ({invoices.length})</span>
            {kpiData.pendingInvoices > 0 && (
              <span className="bg-amber-500 text-brand-950 text-[10px] px-2 py-0.2 rounded-full font-bold">
                {kpiData.pendingInvoices} معلقة
              </span>
            )}
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: INVENTORY & SHORTAGES CATALOG                                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-brand-200 shadow-2xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-brand-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم الصنف أو الكود..."
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-800"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-800"
                >
                  <option value="all">جميع الأقسام ({products.length} صنف)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as any)}
                  className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-800"
                >
                  <option value="all">كل حالات المخزون</option>
                  <option value="shortage">⚠️ النواقص فقط (≤ 10 كجم أو نفد)</option>
                  <option value="in_stock">✓ المتوفر بكفاية</option>
                </select>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                      <th className="p-3 whitespace-nowrap">الصورة</th>
                      <th className="p-3 whitespace-nowrap">اسم الصنف والبيانات</th>
                      <th className="p-3 whitespace-nowrap">القسم</th>
                      <th className="p-3 whitespace-nowrap text-center">المخزون الحالي</th>
                      <th className="p-3 whitespace-nowrap text-center">تكلفة الجملة / كجم</th>
                      <th className="p-3 whitespace-nowrap text-center">حالة الصنف</th>
                      <th className="p-3 whitespace-nowrap text-center">إجراء سريع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-brand-500 font-bold">
                          لا توجد أصناف مطابقة للبحث والفلاتر المحددة.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => {
                        const stockKg = typeof product.stockKg === 'number' ? product.stockKg : 0;
                        const isShortage = !product.inStock || stockKg <= 10;
                        const catObj = categories.find((c) => c.id === product.categoryId);

                        return (
                          <tr
                            key={product.id}
                            className={`hover:bg-brand-50/70 transition ${
                              isShortage ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <td className="p-3 whitespace-nowrap">
                              <img
                                src={getSafeImageUrl(product.image)}
                                alt={product.name}
                                className="w-10 h-10 rounded-xl object-cover border border-brand-200 bg-brand-50"
                              />
                            </td>

                            <td className="p-3">
                              <div className="font-extrabold text-brand-950">{product.name}</div>
                              <div className="text-[10px] text-brand-500 font-mono mt-0.5">
                                كود: {product.slug}
                              </div>
                            </td>

                            <td className="p-3 whitespace-nowrap">
                              <span className="text-[10.5px] bg-brand-100 text-brand-900 px-2.5 py-0.5 rounded-lg font-bold">
                                {catObj?.name || product.categoryId}
                              </span>
                            </td>

                            <td className="p-3 whitespace-nowrap text-center">
                              <span
                                className={`inline-block font-black text-xs px-2.5 py-1 rounded-lg ${
                                  stockKg === 0
                                    ? 'bg-red-100 text-red-800'
                                    : stockKg <= 10
                                    ? 'bg-amber-100 text-amber-900 font-extrabold'
                                    : 'bg-pistachio-100 text-pistachio-900'
                                }`}
                              >
                                {stockKg} كجم
                              </span>
                            </td>

                            <td className="p-3 whitespace-nowrap text-center font-black text-brand-900">
                              {product.costPerKg ? `${product.costPerKg} ج.م` : 'غير محدد'}
                            </td>

                            <td className="p-3 whitespace-nowrap text-center">
                              {stockKg === 0 ? (
                                <span className="text-[10px] bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-black">
                                  نفد المخزون
                                </span>
                              ) : isShortage ? (
                                <span className="text-[10px] bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-black">
                                  نواقص (بحاجة توريد)
                                </span>
                              ) : (
                                <span className="text-[10px] bg-pistachio-100 text-pistachio-800 px-2.5 py-0.5 rounded-full font-bold">
                                  متوفر
                                </span>
                              )}
                            </td>

                            <td className="p-3 whitespace-nowrap text-center">
                              <button
                                type="button"
                                onClick={() => handleQuickAddProductToInvoice(product)}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-[11px] px-3 py-1.5 rounded-xl transition flex items-center gap-1 mx-auto"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>طلب توريد</span>
                              </button>
                            </td>
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

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: INVOICES HISTORY & STATUS TRACKING                           */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* Filter buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-600">تصفية حسب الحالة:</span>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setInvoiceStatusFilter(st)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      invoiceStatusFilter === st
                        ? 'bg-brand-900 text-white'
                        : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    }`}
                  >
                    {st === 'all' && `الكل (${invoices.length})`}
                    {st === 'pending' && `معلقة (${invoices.filter((i) => i.status === 'pending').length})`}
                    {st === 'approved' && `معتمدة (${invoices.filter((i) => i.status === 'approved').length})`}
                    {st === 'rejected' && `مرفوضة (${invoices.filter((i) => i.status === 'rejected').length})`}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setDraftItems([]);
                  handleAddDraftRow();
                  setIsInvoiceModalOpen(true);
                }}
                className="bg-brand-900 hover:bg-brand-950 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow"
              >
                <Plus className="w-4 h-4 text-gold-400" />
                <span>+ إنشاء فاتورة توريد جديدة</span>
              </button>
            </div>

            {/* Invoices List */}
            {filteredInvoices.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-brand-200 shadow-2xs space-y-3">
                <FileText className="w-12 h-12 text-brand-300 mx-auto" />
                <h3 className="text-base font-black text-brand-950">لا توجد فواتير توريد مسجلة بهذه الحالة</h3>
                <p className="text-xs text-brand-600 max-w-sm mx-auto">
                  يمكنك إنشاء فاتورة توريد جديدة وإرسالها للإدارة لاعتمادها وتحديث كميات المخزون تلقائياً.
                </p>
                <button
                  onClick={() => {
                    setDraftItems([]);
                    handleAddDraftRow();
                    setIsInvoiceModalOpen(true);
                  }}
                  className="bg-gold-500 hover:bg-gold-400 text-brand-950 font-black text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء فاتورة توريد الآن</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((inv) => {
                  const isExpanded = expandedInvoiceId === inv.id;
                  const totalKg = inv.items.reduce((s, i) => s + (i.quantityKg || 0), 0);

                  return (
                    <div
                      key={inv.id}
                      className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden transition"
                    >
                      {/* Summary Header */}
                      <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-brand-50/40">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-950 text-gold-400 flex items-center justify-center font-mono font-black text-xs shrink-0">
                            SUP
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-brand-950 text-sm">
                                {inv.invoiceNumber}
                              </span>
                              {inv.status === 'pending' && (
                                <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>قيد مراجعة واعتماد الإدارة</span>
                                </span>
                              )}
                              {inv.status === 'approved' && (
                                <span className="bg-pistachio-100 border border-pistachio-300 text-pistachio-900 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-pistachio-700" />
                                  <span>معتمدة (تمت إضافة المخزون)</span>
                                </span>
                              )}
                              {inv.status === 'rejected' && (
                                <span className="bg-red-100 border border-red-300 text-red-900 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <XCircle className="w-3 h-3 text-red-600" />
                                  <span>مرفوضة من الإدارة</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-brand-500 mt-0.5">
                              تاريخ الإنشاء: {new Date(inv.createdAt).toLocaleString('ar-EG')} • {inv.items.length} أصناف ({totalKg} كجم)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <span className="text-[10px] text-brand-500 font-bold block">إجمالي الفاتورة</span>
                            <span className="text-sm sm:text-base font-black text-pistachio-800">
                              {inv.totalAmount.toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                            className="bg-brand-100 hover:bg-brand-200 text-brand-900 p-2 rounded-xl transition"
                            title={isExpanded ? 'إخفاء التفاصيل' : 'عرض الأصناف'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Notes Section */}
                      {(inv.notes || inv.adminNotes) && (
                        <div className="px-4 py-2.5 bg-brand-50/70 border-t border-brand-100 text-xs space-y-1">
                          {inv.notes && (
                            <div className="text-brand-700">
                              <span className="font-extrabold text-brand-950">ملاحظات المورد: </span>
                              <span>{inv.notes}</span>
                            </div>
                          )}
                          {inv.adminNotes && (
                            <div className="text-brand-900 bg-amber-50 p-2 rounded-xl border border-amber-200">
                              <span className="font-black text-amber-950">ملاحظات مراجعة الإدارة: </span>
                              <span>{inv.adminNotes}</span>
                              {inv.reviewedAt && (
                                <span className="text-[10px] text-brand-500 mr-2">
                                  (تاريخ المراجعة: {new Date(inv.reviewedAt).toLocaleString('ar-EG')})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expandable Line Items Table */}
                      {isExpanded && (
                        <div className="p-4 border-t border-brand-200 bg-white">
                          <h4 className="text-xs font-black text-brand-950 mb-2">أصناف الفاتورة بالتفصيل:</h4>
                          <div className="overflow-x-auto rounded-xl border border-brand-200">
                            <table className="w-full text-right border-collapse text-xs">
                              <thead>
                                <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                                  <th className="p-2.5">اسم الصنف</th>
                                  <th className="p-2.5 text-center">الكمية الموردة (كجم)</th>
                                  <th className="p-2.5 text-center">تكلفة الكيلو (ج.م)</th>
                                  <th className="p-2.5 text-center">إجمالي البند (ج.م)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-brand-100">
                                {inv.items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-brand-50/60">
                                    <td className="p-2.5 font-bold text-brand-950">{item.productName}</td>
                                    <td className="p-2.5 text-center font-black">{item.quantityKg} كجم</td>
                                    <td className="p-2.5 text-center font-black">{item.costPerKg} ج.م</td>
                                    <td className="p-2.5 text-center font-black text-pistachio-800">
                                      {item.totalCost} ج.م
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE NEW SUPPLY INVOICE                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-gold-500/30 text-right space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-brand-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-brand-950">إنشاء وإرسال فاتورة توريد جديدة</h3>
                  <p className="text-[11px] text-brand-500">
                    أضف الأصناف والكميات وأسعار التكلفة لإرسالها للإدارة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-brand-400 hover:text-brand-800 text-base font-black p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitInvoice} className="space-y-4">
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {draftItems.map((item, index) => {
                  const lineTotal = Math.round(item.quantityKg * item.costPerKg * 100) / 100;
                  return (
                    <div
                      key={index}
                      className="bg-brand-50/80 p-3 rounded-2xl border border-brand-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                    >
                      <div className="sm:col-span-5">
                        <label className="block text-[10.5px] font-bold text-brand-800 mb-1">
                          الصنف *
                        </label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleUpdateDraftRow(index, 'productId', e.target.value)}
                          className="w-full bg-white border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-brand-950"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10.5px] font-bold text-brand-800 mb-1">
                          الكمية (كجم) *
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.5"
                          required
                          value={item.quantityKg}
                          onChange={(e) => handleUpdateDraftRow(index, 'quantityKg', e.target.value)}
                          className="w-full bg-white border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-center text-brand-950"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10.5px] font-bold text-brand-800 mb-1">
                          سعر الكيلو (ج.م) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={item.costPerKg}
                          onChange={(e) => handleUpdateDraftRow(index, 'costPerKg', e.target.value)}
                          className="w-full bg-white border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-center text-brand-950"
                        />
                      </div>

                      <div className="sm:col-span-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRow(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="sm:col-span-12 text-left pt-1 border-t border-brand-200/50 text-[10.5px] font-black text-pistachio-800">
                        إجمالي البند: {lineTotal.toLocaleString('ar-EG')} ج.م
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddDraftRow}
                className="w-full bg-brand-100 hover:bg-brand-200 text-brand-900 font-extrabold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5 border border-dashed border-brand-300"
              >
                <Plus className="w-4 h-4" />
                <span>+ إضافة صنف آخر للفاتورة</span>
              </button>

              <div>
                <label className="block text-[11px] font-bold text-brand-950 mb-1">
                  ملاحظات المورد وتفاصيل الشحنة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="مثال: شحنة وارد تركيا الدفعة الثانية - تاريخ الوصول المتوقع غداً صباحاً"
                  className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs text-brand-900"
                />
              </div>

              <div className="p-3 bg-brand-950 text-white rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-brand-300 block">إجمالي قيمة الفاتورة</span>
                  <span className="text-base sm:text-lg font-black text-gold-400">
                    {draftTotalAmount.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="text-left text-[11px] text-brand-300 font-bold">
                  {draftItems.length} أصناف • حالة مبدئية: معلقة (pending)
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-brand-700 bg-brand-100 hover:bg-brand-200 transition"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingInvoice || draftItems.length === 0}
                  className="bg-brand-900 hover:bg-brand-950 text-white font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow disabled:opacity-50"
                >
                  {isSubmittingInvoice ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-gold-400" />
                      <span>إرسال الفاتورة للاعتماد</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
