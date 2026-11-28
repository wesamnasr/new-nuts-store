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
  Layers,
  Eye,
  EyeOff,
  FileText,
  ChevronDown,
  ChevronUp,
  DollarSign,
  X,
} from 'lucide-react';
import { Product, Category, SupplyInvoice, AdminRole } from '@/types/store';
import { formatCategoryName, getCurrencySymbol, getSafeImageUrl } from '@/lib/defaults';
import { useStore } from '@/context/StoreContext';

const ADMIN_SESSION_STORAGE_KEY = 'nuts_admin_session';

interface InvoiceDraftItem {
  productId: string;
  productName: string;
  quantityKg: number;
  costPerKg: number;
}

export default function DedicatedSupplierPortalPage() {
  const { storeData } = useStore();
  const storeName = storeData?.settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const cityName = storeData?.settings?.cityName || 'الفرع الرئيسي';
  const currency = getCurrencySymbol(storeData?.settings);

  const getProdUnitLabel = (p?: Product) =>
    p?.sellingMode === 'unit' ? p.unitLabel || 'قطعة' : 'كجم';

  const getProdWholesaleCost = (p?: Product) =>
    p?.sellingMode === 'unit'
      ? p.unitCost ?? p.costPerKg ?? 100
      : p?.costPerKg ?? 350;
  // Auth state
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<AdminRole>('supplier');
  const [username, setUsername] = useState<string>('');
  const [supplierDisplayName, setSupplierDisplayName] = useState<string>('');
  const [token, setToken] = useState<string>('');

  // Login form state (Strictly Username & Password only per AGENTS.md)
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

      const [storeRes, invRes] = await Promise.all([
        fetch('/api/store', { headers, cache: 'no-store' }),
        fetch('/api/supply-invoices', { headers, cache: 'no-store' }),
      ]);

      if (storeRes.ok) {
        const storeData = await storeRes.json();
        setProducts(Array.isArray(storeData.products) ? storeData.products : []);
        setCategories(Array.isArray(storeData.categories) ? storeData.categories : []);
      }

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

        const reqHeaders: Record<string, string> = {};
        if (savedToken) {
          reqHeaders['Authorization'] = `Bearer ${savedToken}`;
          reqHeaders['x-admin-token'] = savedToken;
        }

        const res = await fetch('/api/admin/login', {
          headers: reqHeaders,
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
            window.location.replace('/admin');
            return;
          }
          if (verifiedRole === 'delivery_rider') {
            window.location.replace('/rider');
            return;
          }

          setToken(activeToken);
          setUserRole(verifiedRole);
          setUsername(data.username || '');
          if (data.displayName) setSupplierDisplayName(data.displayName);
          setIsAuthenticated(true);
          setAuthChecking(false);

          void fetchData(activeToken);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoginLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers,
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

        if (verifiedRole === 'super_admin' || verifiedRole === 'admin') {
          window.location.replace('/admin');
          return;
        }
        if (verifiedRole === 'cashier') {
          window.location.replace('/pos');
          return;
        }
        if (verifiedRole === 'accountant') {
          window.location.replace('/admin');
          return;
        }
        if (verifiedRole === 'delivery_rider') {
          window.location.replace('/rider');
          return;
        }

        setToken(activeToken);
        setUserRole(verifiedRole);
        setUsername(data.username || loginUsername);
        if (data.displayName) setSupplierDisplayName(data.displayName);
        setIsAuthenticated(true);

        showToast('تم تسجيل الدخول بنجاح إلى بوابة المورد');
        await fetchData(activeToken);
      } else {
        setLoginError(data.error || 'فشل تسجيل الدخول: يرجى التحقق من اسم المستخدم وكلمة المرور');
      }
    } catch {
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

  const supplierPayableSummary = useMemo(() => {
    let totalApproved = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    for (const inv of invoices) {
      if (inv.status !== 'approved') continue;
      const amt = inv.totalAmount || 0;
      const paid = inv.paidAmount || 0;
      const ret = inv.returnedAmount || 0;
      const rem =
        typeof inv.remainingAmount === 'number'
          ? inv.remainingAmount
          : Math.max(0, amt - paid - ret);
      totalApproved += amt;
      totalPaid += paid;
      totalRemaining += rem;
    }
    return {
      totalApproved: Math.round(totalApproved * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
    };
  }, [invoices]);

  // Pre-fill invoice modal from product row
  const handleQuickAddProductToInvoice = (product: Product) => {
    const existing = draftItems.find((item) => item.productId === product.id);
    if (!existing) {
      const isUnit = product.sellingMode === 'unit';
      setDraftItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantityKg: isUnit ? 12 : 20,
          costPerKg: getProdWholesaleCost(product),
        },
      ]);
    }
    setIsInvoiceModalOpen(true);
  };

  // Add empty row in draft invoice
  const handleAddDraftRow = () => {
    const available = products.find((p) => !draftItems.some((d) => d.productId === p.id)) || products[0];
    if (available) {
      const isUnit = available.sellingMode === 'unit';
      setDraftItems((prev) => [
        ...prev,
        {
          productId: available.id,
          productName: available.name,
          quantityKg: isUnit ? 10 : 10,
          costPerKg: getProdWholesaleCost(available),
        },
      ]);
    }
  };

  // Update row in draft invoice
  const handleUpdateDraftRow = (index: number, field: keyof InvoiceDraftItem, value: string | number) => {
    setDraftItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'productId') {
        const prod = products.find((p) => p.id === value);
        item.productId = String(value);
        item.productName = prod?.name || item.productName;
        if (prod) {
          item.costPerKg = getProdWholesaleCost(prod);
          if (prod.sellingMode === 'unit') {
            item.quantityKg = Math.max(1, Math.round(item.quantityKg || 1));
          }
        }
      } else if (field === 'quantityKg') {
        const prod = products.find((p) => p.id === item.productId);
        const minQty = prod?.sellingMode === 'unit' ? 1 : 0.05;
        const parsed = Number(value);
        item.quantityKg = Number.isFinite(parsed) && parsed > 0 ? Math.max(minQty, parsed) : minQty;
      } else if (field === 'costPerKg') {
        const parsed = Number(value);
        item.costPerKg = Number.isFinite(parsed) && parsed > 0 ? Math.max(0.5, parsed) : 1;
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
        supplierName: supplierDisplayName || 'شركة أرافت للاستيراد والتوريد الزراعي',
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
        showToast('تم إرسال فاتورة التوريد بنجاح وهي الآن قيد مراجعة واعتماد الإدارة');
        setDraftItems([]);
        setDraftNotes('');
        setIsInvoiceModalOpen(false);
        setActiveTab('invoices');
        await fetchData(token);
      } else {
        showToast(data.error || 'فشل في إرسال فاتورة التوريد', 'error');
      }
    } catch {
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
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-4" dir="rtl">
        <RefreshCw className="w-7 h-7 text-[#9A6836] animate-spin mb-3" />
        <h2 className="text-sm font-bold text-[#231710]">جاري التحقق من جلسة بوابة المورد...</h2>
        <p className="text-xs text-[#6E5D4F] mt-1">{storeName} — {cityName}</p>
      </div>
    );
  }

  // Login view if unauthenticated (Strictly Username & Password only)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-[#E8E0D5] text-right space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-[#FAF6F0] text-[#231710] rounded-xl flex items-center justify-center mx-auto border border-[#E8E0D5]">
              <Truck className="w-6 h-6 text-[#231710]" />
            </div>
            <h1 className="text-xl font-bold text-[#231710]">
              {storeName}
            </h1>
            <p className="text-xs text-[#6E5D4F] font-medium">
              بوابة المورد والتوريدات — متابعة النواقص وإرسال فواتير التوريد
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-[#B83B2B] text-xs p-3.5 rounded-xl font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#B83B2B] mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3.5 py-2.5 text-sm text-[#231710] focus:outline-none focus:border-[#231710] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3.5 py-2.5 text-sm text-[#231710] focus:outline-none focus:border-[#231710] transition pl-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-[#6E5D4F] hover:text-[#231710] transition cursor-pointer"
                  title={showPassword ? 'إخفاء' : 'إظهار'}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full min-h-[48px] bg-[#231710] hover:bg-[#3A271C] text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق من بيانات الدخول...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#E8E0D5] text-center">
            <Link href="/" className="text-xs text-[#6E5D4F] hover:text-[#231710] font-medium transition">
              العودة للمتجر الرئيسي
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
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] flex flex-col font-sans pb-16" dir="rtl">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-md font-bold text-xs flex items-center gap-2.5 ${
            notification.type === 'success'
              ? 'bg-[#231710] text-white border border-[#3A271C]'
              : 'bg-[#B83B2B] text-white border border-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-200 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="bg-white text-[#231710] border-b border-[#E8E0D5] sticky top-0 z-40">
        <div className="w-full max-w-none px-4 sm:px-5 min-h-[56px] py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#FAF6F0] text-[#231710] rounded-xl flex items-center justify-center border border-[#E8E0D5] shrink-0">
              <Truck className="w-5 h-5 text-[#231710]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-[#231710] truncate">
                  {storeName} — بوابة المورد
                </h1>
                <span className="text-[11px] bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5] px-2.5 py-0.5 rounded-lg font-medium shrink-0">
                  {userRole === 'super_admin' ? 'مدير النظام' : 'مورد معتمد'}
                </span>
              </div>
              <p className="text-xs text-[#6E5D4F] truncate">
                {supplierDisplayName || username || 'حساب المورد المعتمد'} — {cityName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (draftItems.length === 0) {
                  handleAddDraftRow();
                }
                setIsInvoiceModalOpen(true);
              }}
              className="min-h-[44px] bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">مسودة الفاتورة ({draftItems.length})</span>
              <span className="sm:hidden">الفاتورة ({draftItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => fetchData()}
              disabled={loadingData}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#FAF6F0] hover:bg-[#EFE8DF] text-[#231710] p-2 rounded-xl border border-[#E8E0D5] transition cursor-pointer"
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#FAF6F0] hover:bg-red-50 text-[#B83B2B] border border-[#E8E0D5] p-2 rounded-xl transition cursor-pointer"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body — Full Fluid Width */}
      <main className="w-full max-w-none px-4 sm:px-5 py-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] space-y-1">
            <div className="flex items-center justify-between text-[#6E5D4F] text-xs font-medium">
              <span>إجمالي أصناف الكتالوج</span>
              <Layers className="w-4 h-4 text-[#9A6836]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#231710] tabular-nums">{kpiData.totalItems} صنف</div>
            <div className="text-[11px] text-[#6E5D4F]">موزعة على {categories.length} أقسام</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] space-y-1">
            <div className="flex items-center justify-between text-[#6E5D4F] text-xs font-medium">
              <span>أصناف متوفرة</span>
              <CheckCircle2 className="w-4 h-4 text-[#3B6E4C]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#3B6E4C] tabular-nums">{kpiData.inStockItems} صنف</div>
            <div className="text-[11px] text-[#6E5D4F]">مخزون كافٍ للبيع</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] space-y-1">
            <div className="flex items-center justify-between text-[#6E5D4F] text-xs font-medium">
              <span>تنبيهات النواقص</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-700 tabular-nums">{kpiData.shortageItems} صنف</div>
            <div className="text-[11px] text-[#6E5D4F]">أقل من 10 كجم أو نفد المخزون</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] space-y-1">
            <div className="flex items-center justify-between text-[#6E5D4F] text-xs font-medium">
              <span>متوسط تكلفة الجملة</span>
              <DollarSign className="w-4 h-4 text-[#9A6836]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#231710] tabular-nums">{kpiData.avgCost} {currency}</div>
            <div className="text-[11px] text-[#6E5D4F]">تكلفة الجملة الفعلية</div>
          </div>
        </div>

        {/* Clean 2-Tab Workflow Switcher */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E8E0D5] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-[#231710] text-white'
                : 'bg-white text-[#6E5D4F] border border-[#E8E0D5] hover:text-[#231710]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>تسجيل فاتورة توريد ({filteredProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'invoices'
                ? 'bg-[#231710] text-white'
                : 'bg-white text-[#6E5D4F] border border-[#E8E0D5] hover:text-[#231710]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>سجل الفواتير ({invoices.length})</span>
            {kpiData.pendingInvoices > 0 && (
              <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[11px] px-2 py-0.5 rounded-full font-bold">
                {kpiData.pendingInvoices} معلقة
              </span>
            )}
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: REGISTER SUPPLY INVOICE & SHORTAGES CATALOG                  */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6E5D4F] absolute right-3 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم الصنف أو الكود..."
                    className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl pr-9 pl-3 py-2 text-xs font-medium text-[#231710] focus:outline-none focus:border-[#231710]"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="تصفية حسب القسم"
                  className="min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-medium text-[#231710] focus:outline-none focus:border-[#231710]"
                >
                  <option value="all">جميع الأقسام ({products.length} صنف)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCategoryName(c.name)}
                    </option>
                  ))}
                </select>

                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as 'all' | 'shortage' | 'in_stock')}
                  aria-label="تصفية حسب حالة المخزون"
                  className="min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-medium text-[#231710] focus:outline-none focus:border-[#231710]"
                >
                  <option value="all">كل حالات المخزون</option>
                  <option value="shortage">النواقص فقط (أقل من 10 كجم أو نفد)</option>
                  <option value="in_stock">المتوفر بكفاية</option>
                </select>
              </div>
            </div>

            {/* Mobile Cards View (< md) */}
            <div className="md:hidden space-y-2.5">
              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E0D5] p-8 text-center text-xs text-[#6E5D4F] font-medium">
                  لا توجد أصناف مطابقة للبحث والفلاتر المحددة.
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const stockKg = typeof product.stockKg === 'number' ? product.stockKg : 0;
                  const unitLabel = getProdUnitLabel(product);
                  const unitCost = getProdWholesaleCost(product);
                  const isShortage = !product.inStock || stockKg <= 10;
                  return (
                    <div
                      key={product.id}
                      className={`bg-white rounded-2xl border p-3.5 space-y-3 ${
                        isShortage ? 'border-amber-300 bg-amber-50/20' : 'border-[#E8E0D5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={getSafeImageUrl(product.image)}
                            alt={product.name}
                            className="w-11 h-11 rounded-xl object-cover border border-[#E8E0D5] bg-[#FAF6F0] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#231710] truncate">{product.name}</div>
                            <div className="text-[11px] text-[#6E5D4F] tabular-nums">
                              المخزون: <strong>{stockKg} {unitLabel}</strong> • التكلفة: <strong>{unitCost ? `${unitCost} ${currency}` : 'غير محدد'}</strong>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[11px] px-2.5 py-1 rounded-full font-bold shrink-0 border ${
                            stockKg === 0
                              ? 'bg-red-50 text-[#B83B2B] border-red-200'
                              : isShortage
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-[#3B6E4C] border-emerald-200'
                          }`}
                        >
                          {stockKg === 0 ? 'نفد المخزون' : isShortage ? 'نواقص' : 'متوفر'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickAddProductToInvoice(product)}
                        className="w-full min-h-[44px] bg-[#FAF6F0] hover:bg-[#231710] text-[#231710] hover:text-white border border-[#E8E0D5] font-bold text-xs px-3 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة لفاتورة التوريد</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Inventory Table (>= md) */}
            <div className="hidden md:block bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                      <th className="p-3 whitespace-nowrap">الصورة</th>
                      <th className="p-3 whitespace-nowrap">اسم الصنف والبيانات</th>
                      <th className="p-3 whitespace-nowrap">القسم</th>
                      <th className="p-3 whitespace-nowrap text-center">المخزون الحالي</th>
                      <th className="p-3 whitespace-nowrap text-center">تكلفة الوحدة / الكيلو</th>
                      <th className="p-3 whitespace-nowrap text-center">حالة الصنف</th>
                      <th className="p-3 whitespace-nowrap text-center">إجراء سريع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E0D5]">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#6E5D4F] font-medium">
                          لا توجد أصناف مطابقة للبحث والفلاتر المحددة.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => {
                        const stockKg = typeof product.stockKg === 'number' ? product.stockKg : 0;
                        const unitLabel = getProdUnitLabel(product);
                        const unitCost = getProdWholesaleCost(product);
                        const isShortage = !product.inStock || stockKg <= 10;
                        const catObj = categories.find((c) => c.id === product.categoryId);

                        return (
                          <tr
                            key={product.id}
                            className={`hover:bg-[#FAF6F0]/70 transition ${
                              isShortage ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="p-3 whitespace-nowrap">
                              <img
                                src={getSafeImageUrl(product.image)}
                                alt={product.name}
                                className="w-10 h-10 rounded-xl object-cover border border-[#E8E0D5] bg-[#FAF6F0]"
                              />
                            </td>

                            <td className="p-3">
                              <div className="font-bold text-[#231710]">{product.name}</div>
                              <div className="text-[11px] text-[#6E5D4F] font-mono mt-0.5">
                                كود: {product.slug}
                              </div>
                            </td>

                            <td className="p-3 whitespace-nowrap">
                              <span className="text-[11px] bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] px-2.5 py-0.5 rounded-lg font-medium">
                                {catObj ? formatCategoryName(catObj.name) : product.categoryId}
                              </span>
                            </td>

                            <td className="p-3 whitespace-nowrap text-center">
                              <span
                                className={`inline-block font-bold text-xs px-2.5 py-1 rounded-lg tabular-nums ${
                                  stockKg === 0
                                    ? 'bg-red-50 text-[#B83B2B] border border-red-200'
                                    : stockKg <= 10
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-50 text-[#3B6E4C] border border-emerald-200'
                                }`}
                              >
                                {stockKg} {unitLabel}
                              </span>
                            </td>

                            <td className="p-3 whitespace-nowrap text-center font-bold text-[#231710] tabular-nums">
                              {unitCost ? `${unitCost} ${currency}` : 'غير محدد'}
                            </td>

                            <td className="p-3 whitespace-nowrap text-center">
                              {stockKg === 0 ? (
                                <span className="text-[11px] bg-red-50 text-[#B83B2B] border border-red-200 px-2.5 py-0.5 rounded-full font-bold">
                                  نفد المخزون
                                </span>
                              ) : isShortage ? (
                                <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                                  نواقص (بحاجة توريد)
                                </span>
                              ) : (
                                <span className="text-[11px] bg-emerald-50 text-[#3B6E4C] border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                                  متوفر
                                </span>
                              )}
                            </td>

                            <td className="p-3 whitespace-nowrap text-center">
                              <button
                                type="button"
                                onClick={() => handleQuickAddProductToInvoice(product)}
                                className="min-h-[44px] bg-[#FAF6F0] hover:bg-[#EFE8DF] text-[#231710] border border-[#E8E0D5] font-bold text-xs px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
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
            {/* Supplier Approved Payables Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
              <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                <span className="text-[11px] text-[#6E5D4F] block">إجمالي التوريد المعتمد</span>
                <span className="text-base sm:text-lg font-bold text-[#231710]">
                  {supplierPayableSummary.totalApproved.toLocaleString('ar-EG')} {currency}
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                <span className="text-[11px] text-[#6E5D4F] block">إجمالي المسدد للمورد</span>
                <span className="text-base sm:text-lg font-bold text-[#3B6E4C]">
                  {supplierPayableSummary.totalPaid.toLocaleString('ar-EG')} {currency}
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                <span className="text-[11px] text-[#6E5D4F] block">المتبقي مستحق السداد</span>
                <span className="text-base sm:text-lg font-bold text-amber-800">
                  {supplierPayableSummary.totalRemaining.toLocaleString('ar-EG')} {currency}
                </span>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#6E5D4F]">تصفية حسب الحالة:</span>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setInvoiceStatusFilter(st)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      invoiceStatusFilter === st
                        ? 'bg-[#231710] text-white'
                        : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5] hover:text-[#231710]'
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
                type="button"
                onClick={() => {
                  setDraftItems([]);
                  handleAddDraftRow();
                  setIsInvoiceModalOpen(true);
                }}
                className="min-h-[44px] bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء فاتورة توريد جديدة</span>
              </button>
            </div>

            {/* Invoices List */}
            {filteredInvoices.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-[#E8E0D5] space-y-3">
                <FileText className="w-10 h-10 text-[#9A6836] mx-auto" />
                <h3 className="text-base font-bold text-[#231710]">لا توجد فواتير توريد مسجلة بهذه الحالة</h3>
                <p className="text-xs text-[#6E5D4F] max-w-sm mx-auto">
                  يمكنك إنشاء فاتورة توريد جديدة وإرسالها للإدارة لاعتمادها وتحديث كميات المخزون تلقائياً.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDraftItems([]);
                    handleAddDraftRow();
                    setIsInvoiceModalOpen(true);
                  }}
                  className="min-h-[44px] bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer"
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
                      className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden transition"
                    >
                      {/* Summary Header */}
                      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            SUP
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-[#231710] text-sm">
                                {inv.invoiceNumber}
                              </span>
                              {inv.status === 'pending' && (
                                <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>قيد مراجعة واعتماد الإدارة</span>
                                </span>
                              )}
                              {inv.status === 'approved' && (
                                <span className="bg-emerald-50 border border-emerald-200 text-[#3B6E4C] text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3B6E4C]" />
                                  <span>معتمدة (تمت إضافة المخزون)</span>
                                </span>
                              )}
                              {inv.status === 'rejected' && (
                                <span className="bg-red-50 border border-red-200 text-[#B83B2B] text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-[#B83B2B]" />
                                  <span>مرفوضة من الإدارة</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                              تاريخ الإنشاء: {new Date(inv.createdAt).toLocaleString('ar-EG')} • {inv.items.length} أصناف ({totalKg} كجم)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <span className="text-[11px] text-[#6E5D4F] block">إجمالي الفاتورة</span>
                            <span className="text-sm sm:text-base font-bold text-[#231710] tabular-nums">
                              {inv.totalAmount.toLocaleString('ar-EG')} {currency}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#FAF6F0] hover:bg-[#EFE8DF] text-[#231710] border border-[#E8E0D5] p-2 rounded-xl transition cursor-pointer"
                            title={isExpanded ? 'إخفاء التفاصيل' : 'عرض الأصناف'}
                            aria-label={isExpanded ? 'إخفاء التفاصيل' : 'عرض الأصناف'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Notes Section */}
                      {(inv.notes || inv.adminNotes) && (
                        <div className="px-4 py-2.5 bg-[#FAF6F0] border-t border-[#E8E0D5] text-xs space-y-1.5">
                          {inv.notes && (
                            <div className="text-[#6E5D4F]">
                              <span className="font-bold text-[#231710]">ملاحظات المورد: </span>
                              <span>{inv.notes}</span>
                            </div>
                          )}
                          {inv.adminNotes && (
                            <div className="text-[#231710] bg-white p-2.5 rounded-xl border border-[#E8E0D5]">
                              <span className="font-bold text-[#231710]">ملاحظات مراجعة الإدارة: </span>
                              <span>{inv.adminNotes}</span>
                              {inv.reviewedAt && (
                                <span className="text-[11px] text-[#6E5D4F] mr-2">
                                  (تاريخ المراجعة: {new Date(inv.reviewedAt).toLocaleString('ar-EG')})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expandable Line Items Table */}
                      {isExpanded && (
                        <div className="p-4 border-t border-[#E8E0D5] bg-white">
                          <h4 className="text-xs font-bold text-[#231710] mb-2.5">أصناف الفاتورة بالتفصيل:</h4>
                          <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
                            <table className="w-full text-right border-collapse text-xs">
                              <thead>
                                <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                                  <th className="p-2.5">اسم الصنف</th>
                                  <th className="p-2.5 text-center">الكمية الموردة (كجم)</th>
                                  <th className="p-2.5 text-center">تكلفة الكيلو (ج.م)</th>
                                  <th className="p-2.5 text-center">إجمالي البند (ج.م)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E8E0D5]">
                                {inv.items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-[#FAF6F0]/60">
                                    <td className="p-2.5 font-bold text-[#231710]">{item.productName}</td>
                                    <td className="p-2.5 text-center font-medium tabular-nums">{item.quantityKg} كجم</td>
                                    <td className="p-2.5 text-center font-medium tabular-nums">{item.costPerKg} ج.م</td>
                                    <td className="p-2.5 text-center font-bold text-[#231710] tabular-nums">
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-7 shadow-lg border border-[#E8E0D5] text-right space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#231710]">إنشاء وإرسال فاتورة توريد جديدة</h3>
                  <p className="text-xs text-[#6E5D4F]">
                    أضف الأصناف والكميات وأسعار التكلفة لإرسالها للإدارة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#6E5D4F] hover:text-[#231710] p-1.5 rounded-lg hover:bg-[#FAF6F0] transition cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInvoice} className="space-y-4">
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {draftItems.map((item, index) => {
                  const selectedProd = products.find((p) => p.id === item.productId);
                  const isUnit = selectedProd?.sellingMode === 'unit';
                  const unitLabel = getProdUnitLabel(selectedProd);
                  const lineTotal = Math.round(item.quantityKg * item.costPerKg * 100) / 100;
                  return (
                    <div
                      key={index}
                      className="bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E8E0D5] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                    >
                      <div className="sm:col-span-5">
                        <label className="block text-xs font-bold text-[#231710] mb-1">
                          الصنف *
                        </label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleUpdateDraftRow(index, 'productId', e.target.value)}
                          className="w-full min-h-[44px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-medium text-[#231710] focus:outline-none focus:border-[#231710]"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({getProdUnitLabel(p)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-[#231710] mb-1">
                          الكمية ({unitLabel}) *
                        </label>
                        <input
                          type="number"
                          min={isUnit ? '1' : '0.05'}
                          step={isUnit ? '1' : 'any'}
                          required
                          value={item.quantityKg}
                          onChange={(e) => handleUpdateDraftRow(index, 'quantityKg', e.target.value)}
                          className="w-full min-h-[44px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold text-center text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-[#231710] mb-1">
                          سعر {unitLabel} ({currency}) *
                        </label>
                        <input
                          type="number"
                          min="0.5"
                          step="any"
                          required
                          value={item.costPerKg}
                          onChange={(e) => handleUpdateDraftRow(index, 'costPerKg', e.target.value)}
                          className="w-full min-h-[44px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold text-center text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div className="sm:col-span-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRow(index)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-[#B83B2B] hover:bg-red-50 rounded-xl transition cursor-pointer"
                          title="حذف هذا البند"
                          aria-label="حذف هذا البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="sm:col-span-12 text-left pt-1.5 border-t border-[#E8E0D5] text-xs font-bold text-[#231710] tabular-nums">
                        إجمالي البند: {lineTotal.toLocaleString('ar-EG')} {currency}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddDraftRow}
                className="w-full min-h-[44px] bg-[#FAF6F0] hover:bg-[#EFE8DF] text-[#231710] font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 border border-dashed border-[#C5B8A8] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف آخر للفاتورة</span>
              </button>

              <div>
                <label className="block text-xs font-bold text-[#231710] mb-1">
                  ملاحظات المورد وتفاصيل الشحنة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="مثال: شحنة الدفعة الثانية - تاريخ الوصول المتوقع غداً صباحاً"
                  className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs text-[#231710] focus:outline-none focus:border-[#231710]"
                />
              </div>

              <div className="p-3.5 bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#6E5D4F] block">إجمالي قيمة الفاتورة</span>
                  <span className="text-base sm:text-lg font-bold text-[#231710] tabular-nums">
                    {draftTotalAmount.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="text-left text-xs text-[#6E5D4F] font-medium">
                  {draftItems.length} أصناف • بانتظار المراجعة
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-[#6E5D4F] bg-[#FAF6F0] hover:bg-[#EFE8DF] border border-[#E8E0D5] transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingInvoice || draftItems.length === 0}
                  className="min-h-[44px] bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingInvoice ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
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
