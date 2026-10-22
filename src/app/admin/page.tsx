'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Layers,
  Palette,
  Truck,
  Tag,
  Star,
  Settings,
  Plus,
  Trash2,
  Save,
  MessageCircle,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
  Edit3,
  Printer,
  Download,
  Upload,
  LogOut,
  Lock,
  KeyRound,
  AlertCircle,
  Search,
  ExternalLink,
  Menu,
  X,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  ShieldCheck,
  Clock,
  Check,
  Filter,
  ClipboardList,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore, STORE_SYNC_STORAGE_KEY } from '@/context/StoreContext';
import {
  OrderStatus,
  Product,
  Category,
  ShippingRate,
  Coupon,
  RoastOption,
  Order,
  WeightVariant,
  StorePageContent,
  ProductReview,
  StoreThemeConfig,
  StoreThemeId,
  HeroLayoutStyle,
  NavbarStyle,
  CardStyle,
  BorderRadiusStyle,
  AdminRole,
  SupplyInvoice,
  SupplyInvoiceItem,
} from '@/types/store';
import { generateOrdersCsv } from '@/lib/csv';
import { formatWhatsAppPhone } from '@/lib/validation';
import {
  getResolvedPageContent,
  getResolvedThemeConfig,
  getSafeImageUrl,
  STORE_THEMES,
  DEFAULT_THEME_CONFIG,
} from '@/lib/defaults';
import HafsaOperationsStudio from '@/components/admin/HafsaOperationsStudio';
import SupplierIsolationPortal from '@/components/admin/SupplierIsolationPortal';
import AccountantIsolationPortal from '@/components/admin/AccountantIsolationPortal';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';
import RolePermissionsManager from '@/components/admin/RolePermissionsManager';
import dynamic from 'next/dynamic';
import { getResolvedRolePermissions, hasRolePermission } from '@/lib/permissions';
import {
  updateUrlQueryParams,
  buildUrlWithParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';
const HafsaPosCashierPage = dynamic(() => import('@/app/pos/page'), { ssr: false });
import type { AdminPermissionId } from '@/types/store';

const LOCAL_PRODUCT_IMAGES: Array<{ url: string; label: string }> = [
  { url: '/images/products/pistachio.jpg', label: 'فستق' },
  { url: '/images/products/cashew.jpg', label: 'كاجو' },
  { url: '/images/products/almond.jpg', label: 'لوز' },
  { url: '/images/products/hazelnut.jpg', label: 'بندق' },
  { url: '/images/products/walnut.jpg', label: 'عين جمل' },
  { url: '/images/products/royal-mix.jpg', label: 'مشكل ملكي' },
  { url: '/images/products/energy-mix.jpg', label: 'ميكس طاقة' },
  { url: '/images/products/stuffed-dates.jpg', label: 'تمور محشوة' },
  { url: '/images/products/apricots-prunes.jpg', label: 'فواكه مجففة' },
  { url: '/images/products/savory-snacks.jpg', label: 'مقرمشات' },
];

function readAndCompressImageFile(file: File, onDone: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const src = String(ev.target?.result || '');
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const maxDim = 640;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        onDone(canvas.toDataURL('image/jpeg', 0.82));
      } else {
        onDone(src);
      }
    };
    img.onerror = () => onDone(src);
    img.src = src;
  };
  reader.readAsDataURL(file);
}

type AdminTab =
  | 'overview'
  | 'orders'
  | 'products'
  | 'categories'
  | 'supply_invoices'
  | 'supply_portal'
  | 'accounting_portal'
  | 'cashier_portal'
  | 'operations'
  | 'shipping'
  | 'coupons'
  | 'reviews'
  | 'permissions'
  | 'settings';

const ALL_ADMIN_TABS: AdminTab[] = [
  'overview',
  'orders',
  'products',
  'categories',
  'supply_invoices',
  'supply_portal',
  'accounting_portal',
  'cashier_portal',
  'operations',
  'shipping',
  'coupons',
  'reviews',
  'permissions',
  'settings',
];

function getDefaultTabForRole(role: AdminRole): AdminTab {
  if (role === 'supplier') return 'supply_portal';
  if (role === 'accountant') return 'accounting_portal';
  if (role === 'cashier') return 'cashier_portal';
  return 'overview';
}

function getRequestedTabFromUrl(): AdminTab | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const qTab = params.get('tab') as AdminTab | null;
  if (qTab && ALL_ADMIN_TABS.includes(qTab)) return qTab;
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'admin' && parts[1] && ALL_ADMIN_TABS.includes(parts[1] as AdminTab)) {
    return parts[1] as AdminTab;
  }
  if (parts[0] === 'accountant') {
    return 'accounting_portal';
  }
  if (parts[0] === 'supplier') {
    return 'supply_portal';
  }
  return null;
}

type SelectableLoginRole = 'super_admin' | 'supplier' | 'accountant' | 'cashier';

const ROLE_PORTAL_META: Record<
  SelectableLoginRole,
  {
    title: string;
    badge: string;
    defaultUsername: string;
    description: string;
    badgeClass: string;
  }
> = {
  super_admin: {
    title: '👑 الأدمن (المدير العام)',
    badge: 'صلاحية كاملة',
    defaultUsername: 'admin_hafsa',
    description: 'تحكم كامل بالمتجر، الأسعار، الطلبات، التقارير، وبيانات دخول جميع الأدوار',
    badgeClass: 'bg-gold-500 text-brand-950',
  },
  supplier: {
    title: '📦 المورد (إدارة التوريد)',
    badge: 'عزل التوريد والمخزون',
    defaultUsername: 'supplier_arafat',
    description: 'متابعة المخزون وتقديم فواتير التوريد بانتظار موافقة الإدارة',
    badgeClass: 'bg-amber-500 text-brand-950',
  },
  cashier: {
    title: '⚖️ الكاشير (نقطة البيع POS)',
    badge: 'عزل الكاشير والمبيعات',
    defaultUsername: 'cashier_pos',
    description: 'شاشة الميزان والبيع المباشر وتجهيز طلبات الأونلاين والورديات',
    badgeClass: 'bg-sky-400 text-brand-950',
  },
  accountant: {
    title: '📊 المحاسب (المراجعة المالية)',
    badge: 'عزل مالي ومحاسبي',
    defaultUsername: 'accountant_fin',
    description: 'مراجعة الإيرادات، تكلفة البضاعة المباعة، صافي الأرباح، وجرد الورديات Z-Report',
    badgeClass: 'bg-pistachio-500 text-brand-950',
  },
};

const ALL_ROAST_OPTIONS: RoastOption[] = [
  'محمص مملح',
  'محمص بدون ملح',
  'نيء طبيعي',
  'مدخن بالتوابل',
  'تشكيلة فاخرة',
];

const CANONICAL_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'roasting_packing',
  'shipped',
  'delivered',
  'cancelled',
];

const STATUS_LABELS: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  pending: {
    label: 'قيد المراجعة',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  confirmed: {
    label: 'تم التأكيد',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  roasting_packing: {
    label: 'جاري التحميص والتغليف 🔥',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
  },
  preparing: {
    label: 'جاري التحميص والتجهيز 🔥',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
  },
  shipped: {
    label: 'خرج مع المندوب 🚚',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  delivered: {
    label: 'تم التسليم ✅',
    badgeClass: 'bg-pistachio-100 text-pistachio-700 border-pistachio-300',
    dotClass: 'bg-pistachio-600',
  },
  cancelled: {
    label: 'ملغي ❌',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
  },
};

const DEFAULT_STATUS_META = {
  label: 'قيد المراجعة',
  badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  dotClass: 'bg-amber-500',
};

const getOrderStatusMeta = (status?: string) => {
  if (!status) return DEFAULT_STATUS_META;
  return STATUS_LABELS[status] || DEFAULT_STATUS_META;
};

export default function AdminDashboardPage() {
  const { storeData, refreshStore, showToast, setThemeOverride } = useStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Authentication & Role Isolation State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [adminToken, setAdminToken] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<AdminRole>('super_admin');
  const [currentUsername, setCurrentUsername] = useState<string>('admin_hafsa');
  const [selectedLoginRole, setSelectedLoginRole] = useState<SelectableLoginRole>('super_admin');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loginSubmitting, setLoginSubmitting] = useState<boolean>(false);

  // Invoice Modal State
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  // Supply Invoices Approval & Management State
  const [supplyInvoices, setSupplyInvoices] = useState<SupplyInvoice[]>([]);
  const [loadingSupplyInvoices, setLoadingSupplyInvoices] = useState<boolean>(false);
  const [invoiceReviewNotes, setInvoiceReviewNotes] = useState<Record<string, string>>({});
  const [actionLoadingInvoiceId, setActionLoadingInvoiceId] = useState<string | null>(null);
  const [supplyInvoiceFilter, setSupplyInvoiceFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [expandedAdminInvoiceId, setExpandedAdminInvoiceId] = useState<string | null>(null);

  // Orders Filter, Sort & Search State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [orderGovernorateFilter, setOrderGovernorateFilter] = useState<string>('all');
  const [orderSort, setOrderSort] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [editingOrderNotesId, setEditingOrderNotesId] = useState<string | null>(null);
  const [orderNotesDraft, setOrderNotesDraft] = useState<string>('');

  // Products Filter, Sort & Form State
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [productFeaturedFilter, setProductFeaturedFilter] = useState<'all' | 'featured' | 'regular'>('all');
  const [productRoastFilter, setProductRoastFilter] = useState<string>('all');
  const [productSort, setProductSort] = useState<'default' | 'price_asc' | 'price_desc' | 'rating_desc'>('default');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Categories Filter & Form State
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryCountFilter, setCategoryCountFilter] = useState<'all' | 'with_products' | 'empty'>('all');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState('Nut');
  const [catImage, setCatImage] = useState('/images/products/royal-mix.jpg');

  // Shipping Filter, Sort & Form State
  const [shippingSearch, setShippingSearch] = useState('');
  const [shippingPriceFilter, setShippingPriceFilter] = useState<'all' | 'low' | 'high'>('all');
  const [shippingSort, setShippingSort] = useState<'default' | 'price_asc' | 'price_desc' | 'name'>('default');
  const [newGovName, setNewGovName] = useState('');
  const [newGovPrice, setNewGovPrice] = useState(60);
  const [newGovDays, setNewGovDays] = useState('1 - 2 يوم عمل');

  // Coupons Filter & Form State
  const [couponSearch, setCouponSearch] = useState('');
  const [couponStatusFilter, setCouponStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [couponTypeFilter, setCouponTypeFilter] = useState<'all' | 'percentage' | 'fixed'>('all');
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCouponVal, setNewCouponVal] = useState(10);
  const [newCouponMin, setNewCouponMin] = useState(300);
  const [newCouponDesc, setNewCouponDesc] = useState('');

  // Reviews Filter & Form State
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewProductFilter, setReviewProductFilter] = useState<string>('all');
  const [reviewRatingFilter, setReviewRatingFilter] = useState<'all' | '5' | '4' | '3_or_less'>('all');
  const [newReviewProdId, setNewReviewProdId] = useState<string>('');
  const [newReviewCustomer, setNewReviewCustomer] = useState<string>('');
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState<string>('');

  // CMS & Theme Draft State
  const [cmsDraft, setCmsDraft] = useState<StorePageContent>(() =>
    getResolvedPageContent(storeData?.settings)
  );
  const [themeDraft, setThemeDraft] = useState<StoreThemeConfig>(() =>
    getResolvedThemeConfig(storeData?.settings)
  );
  const [announcementDraft, setAnnouncementDraft] = useState<string>(
    storeData?.settings.announcementText || ''
  );

  // Username & Password Change State (for all 5 isolated roles)
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newSupplierUsername, setNewSupplierUsername] = useState('');
  const [newSupplierPassword, setNewSupplierPassword] = useState('');
  const [newCashierUsername, setNewCashierUsername] = useState('');
  const [newCashierPassword, setNewCashierPassword] = useState('');
  const [newAccountantUsername, setNewAccountantUsername] = useState('');
  const [newAccountantPassword, setNewAccountantPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Sync CMS & Theme draft when storeData loads/updates
  useEffect(() => {
    if (storeData?.settings) {
      setCmsDraft(getResolvedPageContent(storeData.settings));
      setThemeDraft(getResolvedThemeConfig(storeData.settings));
      setAnnouncementDraft(storeData.settings.announcementText || '');
      setNewAdminUsername(storeData.settings.adminUsername || 'admin_hafsa');
      setNewSupplierUsername(storeData.settings.supplierUsername || 'supplier_arafat');
      setNewCashierUsername(storeData.settings.cashierUsername || 'cashier_pos');
      setNewAccountantUsername(storeData.settings.accountantUsername || 'accountant_fin');
    }
  }, [storeData?.settings]);

  // Pre-select login role if visiting /supplier or /accountant or ?role=
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const qRole = params.get('role');
    if (path.startsWith('/supplier') || qRole === 'supplier') {
      setSelectedLoginRole('supplier');
    } else if (path.startsWith('/accountant') || qRole === 'accountant') {
      setSelectedLoginRole('accountant');
    } else if (qRole === 'cashier') {
      setSelectedLoginRole('cashier');
    }
  }, []);

  // Check admin session on mount via lightweight GET /api/admin/login
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        let savedToken = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
        if (!savedToken) {
          try {
            const raw = localStorage.getItem('nuts_admin_session');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.token && (parsed?.expiresAt ? parsed.expiresAt > Date.now() : true)) {
                savedToken = parsed.token;
              }
            }
          } catch {}
        }

        const headers: Record<string, string> = {};
        if (savedToken) {
          headers['Authorization'] = `Bearer ${savedToken}`;
          headers['x-admin-token'] = savedToken;
        }

        const res = await fetch('/api/admin/login', {
          method: 'GET',
          headers,
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && isMounted) {
            const resolvedRole: AdminRole = data.role || 'super_admin';
            const activeToken = data.token || savedToken || '';
            if (activeToken) {
              sessionStorage.setItem('admin_token', activeToken);
              localStorage.setItem('admin_token', activeToken);
              localStorage.setItem(
                'nuts_admin_session',
                JSON.stringify({
                  token: activeToken,
                  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                  role: resolvedRole,
                  username: data.username || currentUsername,
                })
              );
            }
            if (false && resolvedRole === 'supplier') {
              window.location.replace('/supplier');
              return;
            }
            if (resolvedRole === 'cashier') {
              window.location.replace('/pos');
              return;
            }
            if (false && resolvedRole === 'accountant') {
              window.location.replace('/accountant');
              return;
            }
            setCurrentRole(resolvedRole);
            if (data.username) setCurrentUsername(data.username);
            const requestedUrlTab = getRequestedTabFromUrl();
            const isRequestedAllowed =
              requestedUrlTab &&
              (resolvedRole === 'super_admin' ||
                resolvedRole === 'admin' ||
                (requestedUrlTab !== 'permissions' &&
                  hasRolePermission(
                    resolvedRole,
                    requestedUrlTab as AdminPermissionId,
                    storeData?.settings
                  )));
            const initialTab = isRequestedAllowed
              ? requestedUrlTab
              : getDefaultTabForRole(resolvedRole);
            setActiveTab(initialTab);
            updateUrlQueryParams({ tab: initialTab }, { replace: true });
            setIsAuthenticated(true);
            if (activeToken) {
              setAdminToken(activeToken);
            }
            await refreshStore();
            fetchSupplyInvoices(activeToken);
            return;
          }
        }

        if (isMounted) {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('hafsa_pos_token_v1');
          sessionStorage.removeItem('hafsa_pos_role_v1');
          localStorage.removeItem('nuts_admin_session');
          localStorage.removeItem('admin_token');
          setAdminToken('');
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.error('Session verification error:', e);
        if (isMounted) {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('hafsa_pos_token_v1');
          sessionStorage.removeItem('hafsa_pos_role_v1');
          localStorage.removeItem('nuts_admin_session');
          localStorage.removeItem('admin_token');
          setAdminToken('');
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    checkSession();
    return () => {
      isMounted = false;
    };
  }, [refreshStore]);

  // Login handler — authenticates username & password and routes user automatically by role
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
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
        if (data.token) {
          const resolvedRole: AdminRole = data.role || 'super_admin';
          sessionStorage.setItem('admin_token', data.token);
          localStorage.setItem('admin_token', data.token);
          localStorage.setItem(
            'nuts_admin_session',
            JSON.stringify({
              token: data.token,
              expiresAt: data.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
              role: resolvedRole,
              username: data.username,
            })
          );
          sessionStorage.setItem('hafsa_pos_token_v1', data.token);
          sessionStorage.setItem('hafsa_pos_role_v1', resolvedRole);

          if (false && resolvedRole === 'supplier') {
            window.location.href = '/supplier';
            return;
          }
          if (resolvedRole === 'cashier') {
            window.location.href = '/pos';
            return;
          }
          if (false && resolvedRole === 'accountant') {
            window.location.href = '/accountant';
            return;
          }

          setAdminToken(data.token);
          setCurrentRole(resolvedRole);
          if (data.username) setCurrentUsername(data.username);
          const requestedUrlTab = getRequestedTabFromUrl();
          const isRequestedAllowed =
            requestedUrlTab &&
            (resolvedRole === 'super_admin' ||
              resolvedRole === 'admin' ||
              (requestedUrlTab !== 'permissions' &&
                hasRolePermission(
                  resolvedRole,
                  requestedUrlTab as AdminPermissionId,
                  storeData?.settings
                )));
          const initialTab = isRequestedAllowed
            ? requestedUrlTab
            : getDefaultTabForRole(resolvedRole);
          setActiveTab(initialTab);
          updateUrlQueryParams({ tab: initialTab }, { replace: true });
          setIsAuthenticated(true);
          setLoginPassword('');
          await refreshStore();
          fetchSupplyInvoices(data.token);
          showToast(data.message || `تم تسجيل الدخول بنجاح (${data.username || resolvedRole})`);
        }
      } else {
        setLoginError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch {
      setLoginError('فشل الاتصال بالخادم. يرجى المحاولة لاحقاً');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('hafsa_pos_token_v1');
    sessionStorage.removeItem('hafsa_pos_role_v1');
    localStorage.removeItem('nuts_admin_session');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('customer_auth_session');
    setAdminToken('');
    setIsAuthenticated(false);
    await refreshStore();
    showToast('تم تسجيل الخروج بنجاح');
  };

  // Save helper to /api/store
  const updateStorePayload = async (payload: Record<string, unknown>, successMsg: string) => {
    setSaving(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
        headers['x-admin-token'] = adminToken;
      }
      const res = await fetch('/api/store', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const rotatedToken = res.headers.get('x-new-admin-token');
        if (rotatedToken) {
          setAdminToken(rotatedToken);
          sessionStorage.setItem('admin_token', rotatedToken);
        }
        await refreshStore();
        try {
          localStorage.setItem(STORE_SYNC_STORAGE_KEY, String(Date.now()));
        } catch {}
        showToast(successMsg);
      } else if (res.status === 401) {
        showToast('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_token');
      }
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  };

  // Fetch Supply Invoices
  const fetchSupplyInvoices = useCallback(async (tokenOverride?: string) => {
    const activeTok = tokenOverride || adminToken;
    if (!activeTok) return;
    try {
      setLoadingSupplyInvoices(true);
      const res = await fetch('/api/supply-invoices', {
        headers: {
          Authorization: `Bearer ${activeTok}`,
          'x-admin-token': activeTok,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setSupplyInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      }
    } catch (err) {
      console.error('Failed to load supply invoices', err);
    } finally {
      setLoadingSupplyInvoices(false);
    }
  }, [adminToken]);

  // Review (Approve / Reject) Supply Invoice
  const handleReviewSupplyInvoice = async (
    invoiceId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      setActionLoadingInvoiceId(invoiceId);
      const note = invoiceReviewNotes[invoiceId] || '';
      const res = await fetch('/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          invoiceId,
          status,
          adminNotes: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          status === 'approved'
            ? 'تم اعتماد فاتورة التوريد وإضافة الكميات للمخزون وتحديث التكلفة بنجاح ✅'
            : 'تم رفض فاتورة التوريد دون تعديل المخزون ❌'
        );
        await fetchSupplyInvoices();
        await refreshStore();
      } else {
        showToast(data.error || 'فشل تحديث حالة الفاتورة', 'error');
      }
    } catch {
      showToast('حدث خطأ أثناء معالجة الفاتورة', 'error');
    } finally {
      setActionLoadingInvoiceId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'supply_invoices' && isAuthenticated && adminToken) {
      fetchSupplyInvoices();
    }
  }, [activeTab, isAuthenticated, adminToken, fetchSupplyInvoices]);

  // Derived data & filters
  const orders = storeData?.orders || [];
  const products = storeData?.products || [];
  const categories = storeData?.categories || [];
  const shippingRates = storeData?.shippingRates || [];
  const coupons = storeData?.coupons || [];
  const settings = storeData?.settings;

  const selectTab = useCallback(
    (nextTab: AdminTab, extraParams?: Record<string, string | null>) => {
      setActiveTab(nextTab);
      if (extraParams && 'subtab' in extraParams) {
        setActiveSubTab(extraParams.subtab || 'channels');
      } else {
        setActiveSubTab('channels');
      }
      updateUrlQueryParams({
        tab: nextTab,
        subtab: null,
        status: null,
        invoice: null,
        productModal: null,
        invStatus: null,
        ...extraParams,
      });
    },
    []
  );

  const [activeSubTab, setActiveSubTab] = useState<string>('channels');

  // Sync Dashboard activeTab, filters & modals with Browser URL and Back/Forward
  useBrowserUrlSync((params, pathname) => {
    const subParam = params.get('subtab');
    setActiveSubTab(subParam || 'channels');
    const qTab = params.get('tab') as AdminTab | null;
    const parts = pathname.split('/').filter(Boolean);
    const pathTab: AdminTab | null =
      parts[0] === 'admin' && parts[1] && ALL_ADMIN_TABS.includes(parts[1] as AdminTab)
        ? (parts[1] as AdminTab)
        : parts[0] === 'accountant'
          ? 'accounting_portal'
          : parts[0] === 'supplier'
            ? 'supply_portal'
            : null;
    const resolvedTab = qTab && ALL_ADMIN_TABS.includes(qTab) ? qTab : pathTab;
    if (
      resolvedTab &&
      (currentRole === 'super_admin' ||
        currentRole === 'admin' ||
        (resolvedTab !== 'permissions' &&
          hasRolePermission(currentRole, resolvedTab as AdminPermissionId, settings)))
    ) {
      setActiveTab(resolvedTab);
    }

    const stParam = params.get('status');
    if (stParam && (stParam === 'all' || CANONICAL_ORDER_STATUSES.includes(stParam as OrderStatus))) {
      setOrderStatusFilter(stParam as 'all' | OrderStatus);
    } else if (!stParam) {
      setOrderStatusFilter('all');
    }

    const invStParam = params.get('invStatus');
    if (invStParam && ['all', 'pending', 'approved', 'rejected'].includes(invStParam)) {
      setSupplyInvoiceFilter(invStParam as 'all' | 'pending' | 'approved' | 'rejected');
    } else if (!invStParam) {
      setSupplyInvoiceFilter('all');
    }

    const catParam = params.get('cat');
    setProductCategoryFilter(catParam || 'all');

    const invoiceParam = params.get('invoice');
    if (invoiceParam && orders.length > 0) {
      const foundOrd = orders.find(
        (o) => o.orderNumber === invoiceParam || o.id === invoiceParam
      );
      if (foundOrd) setSelectedInvoiceOrder(foundOrd);
    } else if (!invoiceParam) {
      setSelectedInvoiceOrder(null);
    }

    const prodModalParam = params.get('productModal');
    if (prodModalParam && products.length > 0 && prodModalParam !== 'new') {
      const foundProd = products.find(
        (p) => p.slug === prodModalParam || p.id === prodModalParam
      );
      if (foundProd) {
        setIsCreatingProduct(false);
        setEditingProduct(foundProd);
      }
    } else if (!prodModalParam) {
      setEditingProduct(null);
      setIsCreatingProduct(false);
    }
  });

  const effectiveSupplyInvoices = useMemo<SupplyInvoice[]>(() => {
    if (supplyInvoices.length > 0) return supplyInvoices;
    const storeInvoices = (storeData as any)?.supplyInvoices;
    return Array.isArray(storeInvoices) ? (storeInvoices as SupplyInvoice[]) : [];
  }, [supplyInvoices, storeData]);

  const pendingSupplyInvoicesCount = useMemo(() => {
    return effectiveSupplyInvoices.filter((i) => i.status === 'pending').length;
  }, [effectiveSupplyInvoices]);

  const filteredSupplyInvoices = useMemo<SupplyInvoice[]>(() => {
    return effectiveSupplyInvoices.filter((inv) => {
      if (supplyInvoiceFilter === 'all') return true;
      return inv.status === supplyInvoiceFilter;
    });
  }, [effectiveSupplyInvoices, supplyInvoiceFilter]);

  const filteredOrders = useMemo(() => {
    const list = orders.filter((o) => {
      if (orderStatusFilter !== 'all') {
        const normStatus = (o.status as string) === 'preparing' ? 'roasting_packing' : o.status;
        if (normStatus !== orderStatusFilter) return false;
      }
      if (orderPaymentFilter !== 'all' && o.paymentMethod !== orderPaymentFilter) return false;
      if (orderGovernorateFilter !== 'all' && o.governorate !== orderGovernorateFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          o.governorate.toLowerCase().includes(q) ||
          o.address.toLowerCase().includes(q) ||
          (o.notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (orderSort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (orderSort === 'highest') {
        return b.total - a.total;
      }
      if (orderSort === 'lowest') {
        return a.total - b.total;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders, orderStatusFilter, orderPaymentFilter, orderGovernorateFilter, orderSearch, orderSort]);

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      if (productCategoryFilter !== 'all' && p.categoryId !== productCategoryFilter) return false;
      if (productStockFilter === 'in' && !p.inStock) return false;
      if (productStockFilter === 'out' && p.inStock) return false;
      if (productFeaturedFilter === 'featured' && !p.featured) return false;
      if (productFeaturedFilter === 'regular' && p.featured) return false;
      if (productRoastFilter !== 'all' && !p.roastOptions.includes(productRoastFilter as RoastOption)) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q) ||
          (p.badge || '').toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const minPriceA = a.weights[0]?.price || 0;
      const minPriceB = b.weights[0]?.price || 0;
      if (productSort === 'price_asc') return minPriceA - minPriceB;
      if (productSort === 'price_desc') return minPriceB - minPriceA;
      if (productSort === 'rating_desc') return (b.rating || 5) - (a.rating || 5);
      return 0;
    });
  }, [
    products,
    productCategoryFilter,
    productStockFilter,
    productFeaturedFilter,
    productRoastFilter,
    productSearch,
    productSort,
  ]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const prodCount = products.filter((p) => p.categoryId === c.id).length;
      if (categoryCountFilter === 'with_products' && prodCount === 0) return false;
      if (categoryCountFilter === 'empty' && prodCount > 0) return false;
      if (categorySearch.trim()) {
        const q = categorySearch.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categories, products, categoryCountFilter, categorySearch]);

  const filteredShippingRates = useMemo(() => {
    const list = shippingRates.filter((r) => {
      if (shippingPriceFilter === 'low' && r.price > 60) return false;
      if (shippingPriceFilter === 'high' && r.price <= 60) return false;
      if (shippingSearch.trim()) {
        const q = shippingSearch.trim().toLowerCase();
        return (
          r.governorate.toLowerCase().includes(q) ||
          r.estimatedDays.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (shippingSort === 'price_asc') return a.price - b.price;
      if (shippingSort === 'price_desc') return b.price - a.price;
      if (shippingSort === 'name') return a.governorate.localeCompare(b.governorate, 'ar');
      return 0;
    });
  }, [shippingRates, shippingPriceFilter, shippingSearch, shippingSort]);

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (couponStatusFilter === 'active' && !c.active) return false;
      if (couponStatusFilter === 'inactive' && c.active) return false;
      if (couponTypeFilter !== 'all' && c.discountType !== couponTypeFilter) return false;
      if (couponSearch.trim()) {
        const q = couponSearch.trim().toLowerCase();
        return (
          c.code.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [coupons, couponStatusFilter, couponTypeFilter, couponSearch]);

  const allReviewsFlattened = useMemo(() => {
    const list: Array<{ product: Product; review: ProductReview }> = [];
    for (const prod of products) {
      if (Array.isArray(prod.reviews)) {
        for (const rev of prod.reviews) {
          if (reviewProductFilter !== 'all' && prod.id !== reviewProductFilter) continue;
          if (reviewRatingFilter === '5' && rev.rating !== 5) continue;
          if (reviewRatingFilter === '4' && rev.rating !== 4) continue;
          if (reviewRatingFilter === '3_or_less' && rev.rating > 3) continue;
          if (reviewSearch.trim()) {
            const q = reviewSearch.trim().toLowerCase();
            const matches =
              rev.customerName.toLowerCase().includes(q) ||
              rev.comment.toLowerCase().includes(q) ||
              prod.name.toLowerCase().includes(q);
            if (!matches) continue;
          }
          list.push({ product: prod, review: rev });
        }
      }
    }
    return list;
  }, [products, reviewProductFilter, reviewRatingFilter, reviewSearch]);

  useEffect(() => {
    if (!settings) return;
    if (currentRole === 'super_admin' || currentRole === 'admin') return;
    if (activeTab === 'permissions') {
      const fallbackTab = getDefaultTabForRole(currentRole);
      setActiveTab(fallbackTab);
      updateUrlQueryParams({ tab: fallbackTab }, { replace: true });
      return;
    }
    if (!hasRolePermission(currentRole, activeTab as AdminPermissionId, settings)) {
      const resolved = getResolvedRolePermissions(settings);
      const allowedList =
        currentRole === 'supplier' || currentRole === 'accountant' || currentRole === 'cashier'
          ? resolved[currentRole]
          : [];
      if (allowedList.length > 0) {
        const nextAllowedTab = allowedList[0] as AdminTab;
        setActiveTab(nextAllowedTab);
        updateUrlQueryParams({ tab: nextAllowedTab }, { replace: true });
      }
    }
  }, [currentRole, activeTab, settings]);

  // Authentication gate rendering
  if (authLoading) {
    return (
      <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center p-8 text-center text-white gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gold-500/20 border border-gold-400/40 flex items-center justify-center text-gold-400 animate-pulse">
          <Lock className="w-6 h-6" />
        </div>
        <p className="text-sm font-extrabold text-brand-100">جاري التحقق من صلاحيات الإدارة...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-gold-500/30 shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-brand-950 text-gold-400 rounded-2xl mx-auto flex items-center justify-center shadow-md border border-gold-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black text-brand-950">
              تسجيل دخول طاقم العمل
            </h1>
            <p className="text-xs text-brand-600">
              {settings?.storeName || 'محمصة حفصة'}
            </p>
            <p className="hidden">
              {settings?.storeName || 'محمصة حفصة للبن والمكسرات'} — أدخل اسم المستخدم وكلمة المرور ليتم تحويلك تلقائياً إلى القسم المسموح لك حسب تخصصك
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-900 mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-900 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-900"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full bg-brand-900 hover:bg-brand-950 text-white font-black text-xs py-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loginSubmitting ? (
                <span>جاري التحقق والتوجيه تلقائياً...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-gold-400" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>

          {/* Direct Storefront Link */}
          <div className="pt-3 border-t border-brand-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-bold text-brand-600">
              🛒 أو تصفح المتجر مباشرة كزائر:
            </span>
            <Link
              href="/"
              className="font-black text-pistachio-700 hover:text-pistachio-800 underline flex items-center gap-1"
            >
              <span>الانتقال إلى واجهة المتجر والشراء</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!storeData || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center font-bold text-xs">
        جاري تحميل بيانات النظام...
      </div>
    );
  }

  // Metrics Calculation
  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;
  const deliveredOrdersCount = orders.filter((o) => o.status === 'delivered').length;
  const averageOrderValue =
    validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
  const outOfStockProducts = products.filter((p) => !p.inStock);
  const averageStoreRating =
    products.length > 0
      ? (products.reduce((s, p) => s + (p.rating || 5), 0) / products.length).toFixed(1)
      : '5.0';

  // CSV Export handler
  const handleExportCsv = () => {
    if (!orders || orders.length === 0) {
      showToast('لا توجد طلبات للتصدير حالياً');
      return;
    }
    const csvContent = generateOrdersCsv(orders);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `golden-oasis-orders-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير الطلبات بنجاح إلى ملف CSV');
  };

  // JSON Full Backup Export
  const handleExportBackupJson = () => {
    const backup = JSON.stringify(storeData, null, 2);
    const blob = new Blob([backup], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `store-backup-${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تحميل النسخة الاحتياطية الكاملة للنظام');
  };

  // JSON Full Backup Import
  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (!parsed.products || !parsed.categories || !parsed.settings) {
          showToast('ملف النسخة الاحتياطية غير صالح');
          return;
        }
        await updateStorePayload(
          {
            settings: parsed.settings,
            categories: parsed.categories,
            products: parsed.products,
            shippingRates: parsed.shippingRates || shippingRates,
            coupons: parsed.coupons || coupons,
            orders: parsed.orders || orders,
          },
          'تمت استعادة النسخة الاحتياطية للنظام بنجاح ✅'
        );
      } catch {
        showToast('تعذر قراءة ملف JSON');
      }
    };
    reader.readAsText(file);
  };

  // Order Handlers
  const handleOrderStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
        headers['x-admin-token'] = adminToken;
      }
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ orderId, status }),
      });
      if (res.ok) {
        await refreshStore();
        showToast('تم تحديث حالة الطلب بنجاح');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveOrderNotes = async (orderId: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
        headers['x-admin-token'] = adminToken;
      }
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ orderId, notes: orderNotesDraft }),
      });
      if (res.ok) {
        setEditingOrderNotesId(null);
        await refreshStore();
        showToast('تم حفظ ملاحظات الطلب');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
        headers['x-admin-token'] = adminToken;
      }
      const res = await fetch(`/api/orders?orderId=${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        await refreshStore();
        showToast('تم حذف الطلب من السجل');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Product Handlers
  const openCreateProductModal = () => {
    const blankProduct: Product = {
      id: `prod-${Date.now()}`,
      slug: `nut-${Date.now()}`,
      name: '',
      subtitle: 'مكسرات طازجة نخب أول محمصة يومياً',
      categoryId: categories[0]?.id || 'cat-luxury-nuts',
      description: 'مكسرات طازجة نخب أول محمصة يومياً بعناية فائقة للحفاظ على القرمشة والزيوت الطبيعية.',
      image: '/images/products/royal-mix.jpg',
      badge: 'تحميص اليوم',
      origin: 'مستورد نخب أول',
      nutritionalHighlight: 'غني بالبروتين والفيتامينات الطبيعية ومضادات الأكسدة',
      caloriesPer100g: 580,
      proteinPer100g: '18 جم',
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'نيء طبيعي'],
      weights: [
        { id: 'w-250', label: '250 جم (ربع كيلو)', weightGrams: 250, price: 180, originalPrice: 205 },
        { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 350, originalPrice: 395 },
        { id: 'w-1000', label: '1 كجم (كيلو كامل)', weightGrams: 1000, price: 680, originalPrice: 760 },
      ],
      inStock: true,
      featured: true,
      stockKg: 50,
      packagingCost: 5,
      showOnline: true,
      showInPos: true,
      rating: 5.0,
      reviewsCount: 1,
      reviews: [],
    };
    setIsCreatingProduct(true);
    setEditingProduct(blankProduct);
  };

  const handleSaveProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name.trim()) return;

    const cleanedWeights = editingProduct.weights.filter((w) => w.label.trim() && w.price > 0);
    const finalProd: Product = {
      ...editingProduct,
      slug:
        editingProduct.slug.trim() ||
        editingProduct.name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4),
      roastOptions:
        editingProduct.roastOptions.length > 0 ? editingProduct.roastOptions : ['محمص مملح'],
      weights:
        cleanedWeights.length > 0
          ? cleanedWeights
          : [{ id: 'w-250', label: '250 جم', weightGrams: 250, price: 180 }],
      stockKg:
        typeof editingProduct.stockKg === 'number' && !isNaN(editingProduct.stockKg)
          ? editingProduct.stockKg
          : 50,
      showOnline: editingProduct.showOnline !== false,
      showInPos: editingProduct.showInPos !== false,
    };

    if (isCreatingProduct) {
      await updateStorePayload(
        { products: [finalProd, ...products] },
        `تمت إضافة "${finalProd.name}" إلى المتجر بنجاح`
      );
    } else {
      const updated = products.map((p) => (p.id === finalProd.id ? finalProd : p));
      await updateStorePayload({ products: updated }, `تم حفظ تعديلات "${finalProd.name}" بنجاح`);
    }

    setEditingProduct(null);
    setIsCreatingProduct(false);
  };

  const handleDuplicateProduct = async (prod: Product) => {
    const copy: Product = {
      ...prod,
      id: `prod-${Date.now()}`,
      slug: `${prod.slug}-copy-${Date.now().toString().slice(-3)}`,
      name: `${prod.name} (نسخة)`,
    };
    await updateStorePayload({ products: [copy, ...products] }, `تم نسخ "${prod.name}"`);
  };

  const handleToggleProductStock = async (prodId: string) => {
    const updated = products.map((p) => (p.id === prodId ? { ...p, inStock: !p.inStock } : p));
    await updateStorePayload({ products: updated }, 'تم تحديث حالة توفر المنتج');
  };

  const handleToggleProductFeatured = async (prodId: string) => {
    const updated = products.map((p) => (p.id === prodId ? { ...p, featured: !p.featured } : p));
    await updateStorePayload({ products: updated }, 'تم تحديث حالة تمييز المنتج');
  };

  const handleToggleProductShowOnline = async (prodId: string) => {
    const updated = products.map((p) =>
      p.id === prodId ? { ...p, showOnline: p.showOnline === false ? true : false } : p
    );
    await updateStorePayload({ products: updated }, 'تم تحديث قناة المتجر الإلكتروني للمنتج');
  };

  const handleToggleProductShowInPos = async (prodId: string) => {
    const updated = products.map((p) =>
      p.id === prodId ? { ...p, showInPos: p.showInPos === false ? true : false } : p
    );
    await updateStorePayload({ products: updated }, 'تم تحديث قناة الكاشير (POS) للمنتج');
  };

  const handleDeleteProduct = async (prodId: string) => {
    const updated = products.filter((p) => p.id !== prodId);
    await updateStorePayload({ products: updated }, 'تم حذف المنتج من المتجر');
  };

  // Category Handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      const updated = categories.map((c) =>
        c.id === editingCategory.id ? editingCategory : c
      );
      await updateStorePayload({ categories: updated }, 'تم تحديث بيانات القسم');
      setEditingCategory(null);
      return;
    }

    if (!catName.trim()) return;
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: catName.trim(),
      slug: catSlug.trim() || `cat-${Date.now()}`,
      description: catDesc.trim() || 'تشكيلة طازجة فاخرة',
      icon: catIcon || 'Nut',
      image: catImage,
    };
    await updateStorePayload(
      { categories: [...categories, newCat] },
      `تمت إضافة قسم "${newCat.name}"`
    );
    setCatName('');
    setCatSlug('');
    setCatDesc('');
  };

  const handleDeleteCategory = async (catId: string) => {
    const updated = categories.filter((c) => c.id !== catId);
    await updateStorePayload({ categories: updated }, 'تم حذف القسم');
  };

  // Shipping Handlers
  const handleAddGovernorate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGovName.trim()) return;
    const newRate: ShippingRate = {
      id: `ship-${Date.now()}`,
      governorate: newGovName.trim(),
      price: Number(newGovPrice) || 0,
      estimatedDays: newGovDays.trim() || '1 - 2 يوم عمل',
    };
    await updateStorePayload(
      { shippingRates: [...shippingRates, newRate] },
      `تمت إضافة محافظة "${newRate.governorate}"`
    );
    setNewGovName('');
  };

  // Coupon Handlers
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCoupon) {
      const updated = coupons.map((c) => (c.id === editingCoupon.id ? editingCoupon : c));
      await updateStorePayload({ coupons: updated }, 'تم حفظ تعديلات الكوبون');
      setEditingCoupon(null);
      return;
    }

    if (!newCouponCode.trim()) return;
    const created: Coupon = {
      id: `coup-${Date.now()}`,
      code: newCouponCode.trim().toUpperCase(),
      discountType: newCouponType,
      value: Number(newCouponVal),
      minOrderAmount: Number(newCouponMin),
      active: true,
      description:
        newCouponDesc.trim() ||
        `خصم ${newCouponVal}${newCouponType === 'percentage' ? '%' : ' ج.م'} للطلبات فوق ${newCouponMin} ج.م`,
    };
    await updateStorePayload({ coupons: [...coupons, created] }, 'تمت إضافة كود الخصم الجديد');
    setNewCouponCode('');
    setNewCouponDesc('');
  };

  // Review Moderation Handlers
  const handleDeleteReview = async (productId: string, reviewId: string) => {
    const updatedProducts = products.map((p) => {
      if (p.id !== productId) return p;
      const remaining = (p.reviews || []).filter((r) => r.id !== reviewId);
      const newCount = remaining.length;
      const newRating =
        newCount > 0
          ? Math.round((remaining.reduce((s, r) => s + r.rating, 0) / newCount) * 10) / 10
          : 5.0;
      return {
        ...p,
        reviews: remaining,
        reviewsCount: newCount,
        rating: newRating,
      };
    });
    await updateStorePayload({ products: updatedProducts }, 'تم حذف التقييم وتحديث متوسط المنتج');
  };

  const handleAddAdminReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProdId = newReviewProdId || products[0]?.id;
    if (!targetProdId || !newReviewCustomer.trim() || !newReviewComment.trim()) return;

    const newRev: ProductReview = {
      id: `rev-admin-${Date.now()}`,
      customerName: newReviewCustomer.trim(),
      rating: Number(newReviewRating) || 5,
      comment: newReviewComment.trim(),
      date: new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date()),
      verified: true,
    };

    const updatedProducts = products.map((p) => {
      if (p.id !== targetProdId) return p;
      const updatedReviews = [newRev, ...(p.reviews || [])];
      const newCount = (p.reviewsCount || 0) + 1;
      const newRating =
        Math.round((((p.rating || 5) * (p.reviewsCount || 0) + newRev.rating) / newCount) * 10) /
        10;
      return {
        ...p,
        reviews: updatedReviews,
        reviewsCount: newCount,
        rating: newRating,
      };
    });

    await updateStorePayload({ products: updatedProducts }, 'تمت إضافة التقييم للمنتج بنجاح');
    setNewReviewCustomer('');
    setNewReviewComment('');
  };

  // Save CMS Page Content
  const handleSaveCmsContent = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateStorePayload(
      {
        settings: {
          ...settings,
          announcementText: announcementDraft,
          pageContent: cmsDraft,
          themeConfig: themeDraft,
        },
      },
      'تم حفظ وتطبيق تعديلات محتوى الصفحات على المتجر بالكامل ✅'
    );
  };

  // Immediately persist a theme or layout change to the database and apply live
  const applyAndSaveThemeConfig = async (
    nextConfig: StoreThemeConfig,
    toastMessage = 'تم حفظ وتطبيق ثيم وتخطيط الموقع الجديد لجميع الزوار بنجاح 🎨✅'
  ) => {
    setThemeDraft(nextConfig);
    setThemeOverride(nextConfig);
    if (!settings) return;
    await updateStorePayload(
      {
        settings: {
          ...settings,
          themeConfig: nextConfig,
        },
      },
      toastMessage
    );
  };

  // Select a Theme Preset in Admin Studio (applies live + saves immediately to DB)
  const handleSelectAdminThemePreset = async (id: StoreThemeId) => {
    const preset = STORE_THEMES.find((t) => t.id === id);
    if (!preset) return;
    const nextConfig: StoreThemeConfig = {
      ...themeDraft,
      themeId: preset.id,
      heroLayout: preset.defaults.heroLayout,
      navbarStyle: preset.defaults.navbarStyle,
      cardStyle: preset.defaults.cardStyle,
      borderRadius: preset.defaults.borderRadius,
    };
    await applyAndSaveThemeConfig(
      nextConfig,
      `تم تفعيل وحفظ ثيم "${preset.name}" على كامل الموقع 🎨✅`
    );
  };

  // Save Theme & Layout Config Permanently
  const handleSaveThemeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyAndSaveThemeConfig(
      themeDraft,
      'تم حفظ وتطبيق ثيم وتخطيط الموقع الجديد لجميع الزوار بنجاح 🎨✅'
    );
  };

  const isFullAdmin =
    currentRole === 'super_admin' ||
    currentRole === 'admin' ||
    currentRole === 'store_manager' ||
    currentRole === 'promo_partner';

  // Sidebar navigation config isolated strictly by role
  const allNavItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
    roles: AdminRole[];
  }> = [
    {
      id: 'overview',
      label: currentRole === 'accountant' ? 'الدخل اليومي والملخص المالي' : 'النظرة العامة',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'store_manager', 'accountant'],
    },
    {
      id: 'supply_portal',
      label: 'بوابة المورد',
      icon: <Truck className="w-4 h-4" />,
      badge: `${products.length} صنف`,
      badgeColor: 'bg-amber-500 text-brand-950',
      roles: ['super_admin', 'admin', 'supplier'],
    },
    {
      id: 'supply_invoices',
      label: currentRole === 'accountant' ? 'فواتير الشراء والتوريد' : 'فواتير التوريد',
      icon: <ClipboardList className="w-4 h-4" />,
      badge: pendingSupplyInvoicesCount > 0 ? `${pendingSupplyInvoicesCount} معلقة` : effectiveSupplyInvoices.length,
      badgeColor:
        pendingSupplyInvoicesCount > 0
          ? 'bg-amber-500 text-brand-950 font-black animate-pulse'
          : 'bg-white/15 text-white',
      roles: ['super_admin', 'admin', 'store_manager', 'accountant'],
    },
    {
      id: 'accounting_portal',
      label: currentRole === 'accountant' ? 'التقارير المالية الشاملة' : 'بوابة المحاسب',
      icon: <TrendingUp className="w-4 h-4" />,
      badge: 'مالي',
      badgeColor: 'bg-pistachio-500 text-brand-950',
      roles: ['super_admin', 'admin', 'accountant'],
    },
    {
      id: 'cashier_portal',
      label: 'بوابة الكاشير',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: 'POS',
      badgeColor: 'bg-sky-400 text-brand-950',
      roles: ['cashier'],
    },
    {
      id: 'orders',
      label:
        currentRole === 'accountant'
          ? 'فواتير المبيعات والكاشير'
          : currentRole === 'cashier'
          ? 'تجهيز طلبات الموقع الأونلاين'
          : 'الطلبات والفواتير',
      icon: <Package className="w-4 h-4" />,
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} جاري` : orders.length,
      badgeColor: activeOrdersCount > 0 ? 'bg-amber-500 text-brand-950' : 'bg-white/15 text-white',
      roles: ['super_admin', 'admin', 'store_manager', 'accountant', 'cashier'],
    },
    {
      id: 'products',
      label: currentRole === 'accountant' ? 'الأصناف والتكاليف والأسعار' : 'المنتجات والأسعار',
      icon: <ShoppingBag className="w-4 h-4" />,
      badge: products.length,
      roles: ['super_admin', 'admin', 'store_manager', 'accountant'],
    },
    {
      id: 'categories',
      label: currentRole === 'supplier' ? 'الأقسام والتصنيفات (عرض)' : 'الأقسام والتصنيفات',
      icon: <Layers className="w-4 h-4" />,
      badge: categories.length,
      roles: ['super_admin', 'admin', 'store_manager', 'supplier'],
    },
    {
      id: 'operations',
      label: currentRole === 'accountant' ? 'الورديات والمصروفات والـ VIP' : 'أدوات التشغيل',
      icon: <Sparkles className="w-4 h-4" />,
      badge: currentRole === 'accountant' ? 'درج الكاشير' : 'الشركاء 4',
      badgeColor: 'bg-gold-500 text-brand-950',
      roles: ['super_admin', 'admin', 'store_manager', 'promo_partner', 'accountant'],
    },
    {
      id: 'shipping',
      label: 'الشحن والمحافظات',
      icon: <Truck className="w-4 h-4" />,
      badge: shippingRates.length,
      roles: ['super_admin', 'admin', 'store_manager'],
    },
    {
      id: 'coupons',
      label: 'الكوبونات والعروض',
      icon: <Tag className="w-4 h-4" />,
      badge: coupons.filter((c) => c.active).length,
      roles: ['super_admin', 'admin', 'promo_partner'],
    },
    {
      id: 'reviews',
      label: 'تقييمات وآراء العملاء',
      icon: <Star className="w-4 h-4" />,
      badge: allReviewsFlattened.length,
      roles: ['super_admin', 'admin', 'store_manager'],
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: <Settings className="w-4 h-4" />,
      roles: ['super_admin', 'admin'],
    },
  ];

  allNavItems.splice(allNavItems.length - 1, 0, {
    id: 'permissions',
    label: 'صلاحيات المستخدمين',
    icon: <KeyRound className="w-4 h-4" />,
    badge: '4 مستخدمين',
    badgeColor: 'bg-gold-500 text-brand-950',
    roles: ['super_admin', 'admin'],
  });

  const canAccessTab = (tabId: AdminTab): boolean => {
    if (isFullAdmin) return true;
    if (tabId === 'permissions') return isFullAdmin;
    return hasRolePermission(currentRole, tabId as AdminPermissionId, settings);
  };

  const navItems = allNavItems.filter((item) => canAccessTab(item.id));


  const currentNav = navItems.find((n) => n.id === activeTab) || navItems[0];

  const roleHeaderBadge =
    currentRole === 'supplier'
      ? { label: '📦 المورد', cls: 'bg-amber-100 text-amber-950 border-amber-300' }
      : currentRole === 'accountant'
      ? { label: '📊 المحاسب', cls: 'bg-pistachio-100 text-pistachio-900 border-pistachio-300' }
      : currentRole === 'cashier'
      ? { label: '⚖️ الكاشير', cls: 'bg-sky-100 text-sky-950 border-sky-300' }
      : { label: '👑 الأدمن', cls: 'bg-gold-500/20 text-brand-950 border-gold-500/40' };

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* RIGHT-HAND RTL SIDEBAR NAVIGATION */}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-50 lg:z-30 h-screen w-56 bg-brand-950 text-white border-l border-gold-500/25 flex flex-col justify-between transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Brand Identity */}
        <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-brand-950 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              {cmsDraft.logoEmoji || '🌰'}
            </div>
            <div className="min-w-0">
              <h2 className="text-[11px] font-black text-white truncate">{settings.storeName}</h2>
              <div className="text-[9.5px] font-bold text-gold-400 truncate">
                {roleHeaderBadge.label}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Navigation Links List */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const tabHref = buildUrlWithParams('/admin', {
              tab: item.id,
              subtab: null,
              status: null,
              invoice: null,
              productModal: null,
              invStatus: null,
            });
            return (
              <a
                key={item.id}
                href={tabHref}
                onClick={(e) => {
                  e.preventDefault();
                  selectTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl text-right transition group ${
                  isActive
                    ? 'bg-gradient-to-l from-gold-500 to-gold-400 text-brand-950 font-black shadow-xs'
                    : 'text-brand-100 hover:bg-white/10 font-bold'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 ${
                      isActive ? 'text-brand-950' : 'text-gold-400 group-hover:scale-110 transition'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="text-[11px] leading-tight truncate">{item.label}</div>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                      isActive
                        ? 'bg-brand-950 text-gold-400'
                        : item.badgeColor || 'bg-white/10 text-brand-100'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Bottom Sidebar Footer Actions */}
        <div className="p-2.5 border-t border-white/10 space-y-1.5 bg-brand-950/90">
          {(isFullAdmin || currentRole === 'cashier') && (
            <Link
              href="/pos"
              className="w-full bg-gold-500 hover:bg-gold-400 text-brand-950 text-[11px] font-black px-2.5 py-1.5 rounded-xl flex items-center justify-between transition shadow-xs"
            >
              <span>⚖️ شاشة الكاشير والميزان POS</span>
              <ExternalLink className="w-3 h-3 text-brand-950" />
            </Link>
          )}

          <Link
            href="/"
            className="w-full bg-pistachio-600/20 hover:bg-pistachio-600/30 border border-pistachio-500/40 text-pistachio-100 text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl flex items-center justify-between transition"
          >
            <span>معاينة المتجر الحي</span>
            <ExternalLink className="w-3 h-3 text-pistachio-400" />
          </Link>

          <button
            onClick={handleLogout}
            className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white text-[10px] font-extrabold px-2 py-1.5 rounded-xl flex items-center justify-center gap-1 transition border border-red-500/30"
          >
            <LogOut className="w-3 h-3" />
            <span>تسجيل خروج</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Admin Topbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-brand-200 shadow-2xs">
          <div className="px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded-xl bg-brand-950 text-gold-400 shrink-0 cursor-pointer"
                aria-label="فتح القائمة الجانبية"
              >
                <Menu className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-brand-950 truncate">
                  {currentNav?.label}
                </h1>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${roleHeaderBadge.cls}`}
                >
                  {roleHeaderBadge.label}
                </span>
                {saving && (
                  <span className="text-[9.5px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full animate-pulse shrink-0">
                    جاري الحفظ...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(isFullAdmin || currentRole === 'cashier') && (
                <Link
                  href="/pos"
                  className="bg-amber-100 hover:bg-amber-200 text-brand-950 border border-amber-300 text-[10px] sm:text-[11px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition"
                >
                  <span>⚖️ الكاشير POS</span>
                </Link>
              )}
              <Link
                href="/"
                className="lg:hidden bg-pistachio-50 hover:bg-pistachio-100 text-pistachio-800 border border-pistachio-200 text-[10px] font-extrabold px-2 py-1 rounded-xl flex items-center gap-1 transition"
              >
                <span>المتجر</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              {isFullAdmin && (
                <button
                  onClick={() => {
                    selectTab('products', { productModal: 'new' });
                    openCreateProductModal();
                  }}
                  className="bg-brand-900 hover:bg-brand-950 text-white text-[10px] sm:text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-gold-400 shrink-0" />
                  <span>إضافة منتج</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile & Tablet Horizontal Quick-Switch Tab Bar */}
          <div className="lg:hidden flex items-center gap-1 overflow-x-auto no-scrollbar px-3 py-1.5 bg-brand-50/90 border-t border-brand-100">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const tabHref = buildUrlWithParams('/admin', {
                tab: item.id,
                subtab: null,
                status: null,
                invoice: null,
                productModal: null,
                invStatus: null,
              });
              return (
                <a
                  key={item.id}
                  href={tabHref}
                  onClick={(e) => {
                    e.preventDefault();
                    selectTab(item.id);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] whitespace-nowrap shrink-0 transition cursor-pointer ${
                    isActive
                      ? 'bg-brand-950 text-gold-400 font-black shadow-2xs'
                      : 'bg-white text-brand-800 border border-brand-200 font-bold hover:bg-brand-100'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[8.5px] font-black px-1 py-0.5 rounded-md ${
                        isActive ? 'bg-gold-500 text-brand-950' : 'bg-brand-100 text-brand-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </header>

        {/* Dynamic Module Container */}
        <main className="p-3 sm:p-5 space-y-4 max-w-7xl w-full mx-auto">
          {/* ROLE PORTAL 1: SUPPLIER ISOLATION PORTAL */}
          {activeTab === 'supply_portal' &&
            canAccessTab('supply_portal') && (
              <SupplierIsolationPortal
                products={products}
                categories={categories}
                saving={saving}
                supplyInvoices={effectiveSupplyInvoices}
                onInvoiceCreated={(inv) => setSupplyInvoices((prev) => [inv, ...prev])}
                onUpdateStorePayload={updateStorePayload}
              />
            )}

          {/* ROLE MODULE: SUPPLY INVOICES APPROVAL WORKFLOW */}
          {activeTab === 'supply_invoices' && canAccessTab('supply_invoices') && (
            <div className="space-y-4">
              {/* Header card with quick actions and stats */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
                      <ClipboardList className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base font-black text-brand-950">
                          إدارة فواتير التوريد واعتماد الشحنات
                        </h2>
                        {pendingSupplyInvoicesCount > 0 && (
                          <span className="bg-amber-500 text-brand-950 font-black text-[10.5px] px-2.5 py-0.5 rounded-full animate-pulse">
                            {pendingSupplyInvoicesCount} بانتظار الاعتماد
                          </span>
                        )}
                      </div>
                      <p className="hidden">
                        فحص ومراجعة فواتير التوريد الواردة من المورد، وتدقيق الأصناف والأسعار، واعتمادها لإضافة المخزون وتحديث التكلفة تلقائياً
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchSupplyInvoices()}
                      disabled={loadingSupplyInvoices}
                      className="bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${loadingSupplyInvoices ? 'animate-spin' : ''}`} />
                      <span>تحديث الفواتير</span>
                    </button>
                    <Link
                      href="/supplier"
                      target="_blank"
                      className="bg-amber-500 hover:bg-amber-400 text-brand-950 font-black px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>فتح بوابة المورد ↗</span>
                    </Link>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-brand-100">
                  <div className="bg-brand-50/70 p-2.5 rounded-xl border border-brand-100">
                    <span className="text-[10px] font-bold text-brand-600 block">إجمالي الفواتير</span>
                    <span className="text-base font-black text-brand-950">{effectiveSupplyInvoices.length}</span>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-700 block">فواتير معلقة (قيد المراجعة)</span>
                    <span className="text-base font-black text-amber-800">{pendingSupplyInvoicesCount}</span>
                  </div>
                  <div className="bg-pistachio-50 p-2.5 rounded-xl border border-pistachio-200">
                    <span className="text-[10px] font-bold text-pistachio-700 block">فواتير معتمدة ومضافة</span>
                    <span className="text-base font-black text-pistachio-800">
                      {effectiveSupplyInvoices.filter((i) => i.status === 'approved').length}
                    </span>
                  </div>
                  <div className="bg-red-50 p-2.5 rounded-xl border border-red-200">
                    <span className="text-[10px] font-bold text-red-700 block">فواتير مرفوضة</span>
                    <span className="text-base font-black text-red-800">
                      {effectiveSupplyInvoices.filter((i) => i.status === 'rejected').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setSupplyInvoiceFilter(st);
                      updateUrlQueryParams({ invStatus: st === 'all' ? null : st });
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      supplyInvoiceFilter === st
                        ? 'bg-brand-900 text-white shadow-xs'
                        : 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-50'
                    }`}
                  >
                    {st === 'all' && `جميع الفواتير (${effectiveSupplyInvoices.length})`}
                    {st === 'pending' && `بانتظار المراجعة (${pendingSupplyInvoicesCount})`}
                    {st === 'approved' && `المعتمدة (${effectiveSupplyInvoices.filter((i) => i.status === 'approved').length})`}
                    {st === 'rejected' && `المرفوضة (${effectiveSupplyInvoices.filter((i) => i.status === 'rejected').length})`}
                  </button>
                ))}
              </div>

              {/* Invoices List */}
              {filteredSupplyInvoices.length === 0 ? (
                <div className="bg-white p-8 text-center rounded-2xl border border-brand-200 shadow-2xs space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-pistachio-600 mx-auto" />
                  <h3 className="text-sm font-black text-brand-950">لا توجد فواتير توريد بهذه الحالة</h3>
                  <p className="text-xs text-brand-600">
                    يمكن للمورد إرسال فواتير توريد جديدة من بوابته المخصصة لتظهر هنا فوراً.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredSupplyInvoices.map((inv) => {
                    const isPending = inv.status === 'pending';
                    const isExpanded = expandedAdminInvoiceId === inv.id || isPending;
                    const totalKg = inv.items.reduce((s: number, i: SupplyInvoiceItem) => s + (i.quantityKg || 0), 0);
                    const isActionLoading = actionLoadingInvoiceId === inv.id;

                    return (
                      <div
                        key={inv.id}
                        className={`bg-white rounded-2xl border shadow-2xs overflow-hidden transition ${
                          isPending ? 'border-amber-300 ring-2 ring-amber-100' : 'border-brand-200'
                        }`}
                      >
                        {/* Invoice Header */}
                        <div className={`p-4 flex flex-wrap items-center justify-between gap-3 ${
                          isPending ? 'bg-amber-50/50' : 'bg-brand-50/40'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                              isPending
                                ? 'bg-amber-500 text-brand-950 font-bold'
                                : inv.status === 'approved'
                                ? 'bg-pistachio-700 text-white'
                                : 'bg-red-700 text-white'
                            }`}>
                              SUP
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-brand-950 text-sm">
                                  {inv.invoiceNumber}
                                </span>
                                {inv.status === 'pending' && (
                                  <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>قيد المراجعة والاعتماد</span>
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
                                    <AlertCircle className="w-3 h-3 text-red-600" />
                                    <span>مرفوضة من الإدارة</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-brand-500 mt-0.5">
                                المورد: <span className="font-extrabold text-brand-900">{inv.supplierName || inv.supplierId}</span> • تاريخ الإنشاء: {new Date(inv.createdAt).toLocaleString('ar-EG')} • {inv.items.length} أصناف ({totalKg} كجم)
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

                            {!isPending && (
                              <button
                                type="button"
                                onClick={() => setExpandedAdminInvoiceId(isExpanded ? null : inv.id)}
                                className="bg-brand-100 hover:bg-brand-200 text-brand-900 p-2 rounded-xl transition"
                                title={isExpanded ? 'إخفاء التفاصيل' : 'عرض الأصناف'}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Supplier Notes */}
                        {inv.notes && (
                          <div className="px-4 py-2 bg-brand-50/70 border-t border-brand-100 text-xs text-brand-800">
                            <span className="font-extrabold text-brand-950">ملاحظات المورد: </span>
                            <span>{inv.notes}</span>
                          </div>
                        )}

                        {/* Line Items Table */}
                        {isExpanded && (
                          <div className="p-4 border-t border-brand-200 bg-white space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black text-brand-950">
                                تفاصيل أصناف وكميات الشحنة ({inv.items.length} أصناف):
                              </h4>
                              {isPending && (
                                <span className="text-[10.5px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 font-bold">
                                  💡 المخزون الفعلي الحالي لن يتأثر إلا بعد الضغط على "اعتماد الفاتورة"
                                </span>
                              )}
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-brand-200">
                              <table className="w-full text-right border-collapse text-xs">
                                <thead>
                                  <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                                    <th className="p-2.5">اسم الصنف</th>
                                    <th className="p-2.5 text-center">الكمية الموردة (كجم)</th>
                                    <th className="p-2.5 text-center">تكلفة الكيلو (ج.م)</th>
                                    <th className="p-2.5 text-center">إجمالي البند (ج.م)</th>
                                    <th className="p-2.5 text-center">المخزون الحالي بالمتجر</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-100">
                                  {inv.items.map((item: SupplyInvoiceItem, idx: number) => {
                                    const prod = products.find((p) => p.id === item.productId);
                                    const currentStock = typeof prod?.stockKg === 'number' ? prod.stockKg : 0;
                                    return (
                                      <tr key={idx} className="hover:bg-brand-50/60">
                                        <td className="p-2.5">
                                          <div className="font-bold text-brand-950">{item.productName}</div>
                                          {prod && (
                                            <div className="text-[10px] text-brand-500 font-mono">
                                              كود: {prod.slug}
                                            </div>
                                          )}
                                        </td>
                                        <td className="p-2.5 text-center font-black text-amber-900">
                                          +{item.quantityKg} كجم
                                        </td>
                                        <td className="p-2.5 text-center font-black">
                                          {item.costPerKg} ج.م
                                        </td>
                                        <td className="p-2.5 text-center font-black text-pistachio-800">
                                          {item.totalCost} ج.م
                                        </td>
                                        <td className="p-2.5 text-center font-mono">
                                          <span className="bg-brand-100 text-brand-900 px-2 py-0.5 rounded font-bold">
                                            {currentStock} كجم
                                          </span>
                                          {isPending && (
                                            <span className="text-[10px] text-pistachio-700 block font-bold mt-0.5">
                                              → بعد الاعتماد: {Math.round((currentStock + item.quantityKg) * 1000) / 1000} كجم
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Pending Action Box */}
                            {isPending && (
                              <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3 mt-3">
                                <div>
                                  <label className="block text-[11px] font-black text-brand-950 mb-1">
                                    ملاحظات الإدارة عند المراجعة (اختياري):
                                  </label>
                                  <input
                                    type="text"
                                    value={invoiceReviewNotes[inv.id] || ''}
                                    onChange={(e) =>
                                      setInvoiceReviewNotes((prev) => ({
                                        ...prev,
                                        [inv.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="مثال: تم فحص الشحنة ومطابقة الأوزان على ميزان الفرع واعتمادها"
                                    className="w-full bg-white border border-brand-200 rounded-xl px-3 py-1.5 text-xs text-brand-950"
                                  />
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                  <div className="text-[11px] text-brand-600 font-bold">
                                    ⚠️ بالضغط على اعتماد الفاتورة سيتم فورياً إضافة الكميات إلى مخزون الأصناف وتحديث تكلفة الكيلو.
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={isActionLoading}
                                      onClick={() => handleReviewSupplyInvoice(inv.id, 'rejected')}
                                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>رفض الفاتورة</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isActionLoading}
                                      onClick={() => handleReviewSupplyInvoice(inv.id, 'approved')}
                                      className="bg-pistachio-700 hover:bg-pistachio-800 text-white font-black text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow disabled:opacity-50"
                                    >
                                      {isActionLoading ? (
                                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Check className="w-3.5 h-3.5" />
                                      )}
                                      <span>اعتماد الفاتورة وإضافة المخزون</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Reviewed History Notes */}
                            {!isPending && (inv.adminNotes || inv.reviewedAt) && (
                              <div className="p-3 bg-brand-50 rounded-xl border border-brand-200 text-xs space-y-0.5">
                                <div className="text-brand-950 font-black">
                                  حالة الفحص والاعتماد: {inv.status === 'approved' ? 'معتمدة ✓' : 'مرفوضة ✕'}
                                </div>
                                {inv.adminNotes && (
                                  <div className="text-brand-700">ملاحظات الإدارة: {inv.adminNotes}</div>
                                )}
                                {inv.reviewedAt && (
                                  <div className="text-[10px] text-brand-500">
                                    تاريخ المراجعة: {new Date(inv.reviewedAt).toLocaleString('ar-EG')} بواسطة {inv.reviewedBy || 'الأدمن'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ROLE PORTAL 2: ACCOUNTANT ISOLATION PORTAL */}
          {activeTab === 'accounting_portal' &&
            canAccessTab('accounting_portal') && (
              <AccountantIsolationPortal
                orders={orders}
                products={products}
                posShifts={storeData?.posShifts || []}
                posExpenses={storeData?.posExpenses || []}
                vipMembers={storeData?.vipMembers || []}
                coupons={coupons}
                supplyInvoices={effectiveSupplyInvoices}
                settings={settings}
                onExportOrdersCsv={handleExportCsv}
                onOpenOrdersTab={() => selectTab('orders')}
                onOpenSupplyInvoicesTab={() => selectTab('supply_invoices')}
                onOpenOperationsTab={() => selectTab('operations')}
                onOpenProductsTab={() => selectTab('products')}
              />
            )}

          {/* ROLE PORTAL 3: CASHIER ISOLATION PORTAL */}
          {activeTab === 'cashier_portal' && canAccessTab('cashier_portal') && (
            <div className="bg-gradient-to-l from-brand-950 via-brand-900 to-brand-950 text-white p-6 rounded-3xl border border-gold-500/30 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-block text-[11px] font-black bg-sky-400 text-brand-950 px-3 py-0.5 rounded-full">
                    ⚖️ بوابة الكاشير المعزولة (Cashier Isolation)
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    شاشة الكاشير والميزان الرقمي وتجهيز الطلبات
                  </h2>
                  <p className="hidden">
                    حساب الكاشير معزول تماماً عن تكاليف الجملة (شيت عرفات)، صافي الأرباح، وإعدادات الإدارة. يمكنك فتح شاشة الميزان والباركود للبيع المباشر أو متابعة تجهيز طلبات الموقع الأونلاين.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    href="/pos"
                    className="bg-gold-500 hover:bg-gold-400 text-brand-950 font-black text-xs px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg transition"
                  >
                    <span>⚖️ فتح شاشة الكاشير والميزان POS</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => selectTab('orders')}
                    className="bg-white/10 hover:bg-white/15 border border-white/20 text-white font-extrabold text-xs px-4 py-3 rounded-2xl transition"
                  >
                    📦 تجهيز طلبات الأونلاين ({activeOrdersCount} جاري)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cashier_portal' && canAccessTab('cashier_portal') && (
            <div className="rounded-3xl overflow-hidden border border-gold-500/30 shadow-2xl">
              <HafsaPosCashierPage />
            </div>
          )}

          {activeTab === 'operations' && canAccessTab('operations') && (
            <HafsaOperationsStudio
              adminToken={adminToken}
              onUpdateStorePayload={updateStorePayload}
            />
          )}

          {/* ================================================================= */}
          {/* MODULE 1: OVERVIEW & ANALYTICS                                    */}
          {/* ================================================================= */}
          {activeTab === 'overview' && canAccessTab('overview') && (
            <div className="space-y-4">
              {/* 6 KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="bg-white p-3 rounded-2xl border border-brand-200 shadow-2xs">
                  <div className="flex items-center justify-between text-brand-600 text-[10px] font-bold">
                    <span>إجمالي الإيرادات</span>
                    <TrendingUp className="w-3.5 h-3.5 text-pistachio-600" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-brand-950 mt-0.5">
                    {totalRevenue} ج.م
                  </div>
                  <div className="text-[9.5px] text-pistachio-700 font-semibold mt-0.5">
                    من {validOrders.length} طلبات مؤكدة
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-brand-200 shadow-2xs">
                  <div className="flex items-center justify-between text-brand-600 text-[10px] font-bold">
                    <span>طلبات جارية</span>
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-brand-950 mt-0.5">
                    {activeOrdersCount}
                  </div>
                  <div className="text-[9.5px] text-brand-600 mt-0.5">قيد التحضير أو التوصيل</div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-brand-200 shadow-2xs">
                  <div className="flex items-center justify-between text-brand-600 text-[10px] font-bold">
                    <span>طلبات مكتملة</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-pistachio-600" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-brand-950 mt-0.5">
                    {deliveredOrdersCount}
                  </div>
                  <div className="text-[9.5px] text-brand-600 mt-0.5">تم تسليمها للعملاء</div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-brand-200 shadow-2xs">
                  <div className="flex items-center justify-between text-brand-600 text-[10px] font-bold">
                    <span>متوسط قيمة الطلب</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-brand-700" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-brand-950 mt-0.5">
                    {averageOrderValue} ج.م
                  </div>
                  <div className="text-[9.5px] text-brand-600 mt-0.5">شحن مجاني فوق {settings.freeShippingThreshold}</div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-brand-200 shadow-2xs">
                  <div className="flex items-center justify-between text-brand-600 text-[10px] font-bold">
                    <span>المنتجات والأقسام</span>
                    <Layers className="w-3.5 h-3.5 text-brand-700" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-brand-950 mt-0.5">
                    {products.length} صنف
                  </div>
                  <div className="text-[9.5px] text-brand-600 mt-0.5">
                    موزعة على {categories.length} أقسام
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-brand-200 shadow-2xs">
                  <div className="flex items-center justify-between text-brand-600 text-[10px] font-bold">
                    <span>التقييم العام</span>
                    <Star className="w-3.5 h-3.5 text-gold-500 fill-gold-500" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-brand-950 mt-0.5">
                    {averageStoreRating} / 5
                  </div>
                  <div className="text-[9.5px] text-brand-600 mt-0.5">
                    {allReviewsFlattened.length} تقييم مسجل
                  </div>
                </div>
              </div>

              {/* Order Status Pipeline Breakdown */}
              <div className="bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-brand-950">
                    مراحل تنفيذ الطلبات (اضغط لفلترة الطلبات)
                  </h3>
                  <button
                    onClick={() => selectTab('orders')}
                    className="text-[10.5px] font-bold text-brand-700 hover:text-brand-950 underline"
                  >
                    عرض كل الطلبات ({orders.length})
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {CANONICAL_ORDER_STATUSES.map((stKey) => {
                    const count = orders.filter(
                      (o) => o.status === stKey || (stKey === 'roasting_packing' && (o.status as string) === 'preparing')
                    ).length;
                    const info = getOrderStatusMeta(stKey);
                    return (
                      <button
                        key={stKey}
                        onClick={() => {
                          setOrderStatusFilter(stKey);
                          selectTab('orders', { status: stKey });
                        }}
                        className="p-2.5 rounded-xl border border-brand-200 hover:border-brand-700 bg-brand-50/60 hover:bg-brand-100/60 text-right transition space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`w-2 h-2 rounded-full ${info.dotClass}`} />
                          <span className="text-sm font-black text-brand-950">{count}</span>
                        </div>
                        <div className="text-[10px] font-extrabold text-brand-800 truncate">
                          {info.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Control Center Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                {/* Latest Orders Data Table */}
                <div className="lg:col-span-2 bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black text-brand-950">
                      جدول أحدث الطلبات الواردة
                    </h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={orderStatusFilter}
                        onChange={(e) => {
                          const nextSt = e.target.value as 'all' | OrderStatus;
                          setOrderStatusFilter(nextSt);
                          updateUrlQueryParams({ status: nextSt === 'all' ? null : nextSt });
                        }}
                        className="bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                      >
                        <option value="all">كل الحالات ({orders.length})</option>
                        <option value="pending">قيد المراجعة</option>
                        <option value="confirmed">تم التأكيد</option>
                        <option value="roasting_packing">جاري التحميص</option>
                        <option value="shipped">خرج للتوصيل</option>
                        <option value="delivered">تم التسليم</option>
                        <option value="cancelled">ملغي</option>
                      </select>
                      <button
                        onClick={() => selectTab('orders')}
                        className="text-[11px] font-bold text-pistachio-700 hover:underline"
                      >
                        الجدول الكامل ←
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-brand-200">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-2.5 whitespace-nowrap">رقم الطلب</th>
                          <th className="p-2.5 whitespace-nowrap">العميل</th>
                          <th className="p-2.5 whitespace-nowrap">المحافظة</th>
                          <th className="p-2.5 whitespace-nowrap">الإجمالي</th>
                          <th className="p-2.5 whitespace-nowrap">الحالة</th>
                          <th className="p-2.5 text-center whitespace-nowrap">فاتورة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100">
                        {filteredOrders.slice(0, 6).map((ord) => (
                          <tr key={ord.id} className="hover:bg-brand-50/70 transition">
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="font-mono font-black bg-brand-950 text-gold-400 px-2 py-0.5 rounded text-[11px]">
                                {ord.orderNumber}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <div className="font-extrabold text-brand-950">{ord.customerName}</div>
                              <div className="text-[10px] text-brand-500 font-mono">
                                {ord.customerPhone}
                              </div>
                            </td>
                            <td className="p-2.5 text-[11px] text-brand-700 whitespace-nowrap">
                              {ord.governorate}
                            </td>
                            <td className="p-2.5 font-black text-pistachio-700 whitespace-nowrap">
                              {ord.total} ج.م
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <select
                                value={ord.status}
                                onChange={(e) =>
                                  handleOrderStatusChange(ord.id, e.target.value as OrderStatus)
                                }
                                className="bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                              >
                                <option value="pending">قيد المراجعة</option>
                                <option value="confirmed">تم التأكيد</option>
                                <option value="roasting_packing">جاري التحميص</option>
                                <option value="shipped">خرج للتوصيل</option>
                                <option value="delivered">تم التسليم</option>
                                <option value="cancelled">ملغي</option>
                              </select>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedInvoiceOrder(ord);
                                  updateUrlQueryParams({ invoice: ord.orderNumber });
                                }}
                                className="p-1.5 bg-brand-900 text-gold-400 rounded-lg hover:bg-brand-950 inline-flex"
                                title="طباعة الفاتورة"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Stock Alerts & Quick Page Shortcuts */}
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-brand-200 shadow-2xs space-y-2.5">
                    <h3 className="text-xs sm:text-sm font-black text-brand-950 flex items-center justify-between">
                      <span>حالة توفر المخزون</span>
                      <span className="text-[10px] bg-pistachio-100 text-pistachio-700 px-2 py-0.5 rounded-full font-bold">
                        {products.length - outOfStockProducts.length} متاح
                      </span>
                    </h3>

                    {outOfStockProducts.length === 0 ? (
                      <div className="p-3 rounded-xl bg-pistachio-50 border border-pistachio-200 text-pistachio-700 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>جميع أصناف المتجر متوفرة حالياً في المخزون!</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {outOfStockProducts.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-red-50 border border-red-200 text-xs"
                          >
                            <span className="font-bold text-red-900 truncate">{p.name}</span>
                            <button
                              onClick={() => handleToggleProductStock(p.id)}
                              className="bg-white text-pistachio-700 border border-pistachio-300 px-2 py-0.5 rounded-lg text-[10px] font-extrabold shrink-0"
                            >
                              إعادة التوفير
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 2: ORDERS & INVOICES DATA TABLE WITH FILTERS               */}
          {/* ================================================================= */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Comprehensive Filters & Sort Bar */}
              <div className="bg-white p-4 rounded-2xl border border-brand-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-brand-800" />
                    <h2 className="text-sm font-black text-brand-950">
                      فلترة وبحث جدول الطلبات ({filteredOrders.length} من {orders.length})
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {(orderSearch ||
                      orderStatusFilter !== 'all' ||
                      orderPaymentFilter !== 'all' ||
                      orderGovernorateFilter !== 'all' ||
                      orderSort !== 'newest') && (
                      <button
                        type="button"
                        onClick={() => {
                          setOrderSearch('');
                          setOrderStatusFilter('all');
                          setOrderPaymentFilter('all');
                          setOrderGovernorateFilter('all');
                          setOrderSort('newest');
                        }}
                        className="text-[11px] bg-red-50 hover:bg-red-100 text-red-700 font-extrabold px-2.5 py-1.5 rounded-xl transition"
                      >
                        إعادة ضبط الفلاتر ✕
                      </button>
                    )}

                    <button
                      onClick={handleExportCsv}
                      className="bg-pistachio-700 hover:bg-pistachio-800 text-white text-xs font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير الجدول CSV</span>
                    </button>
                  </div>
                </div>

                {/* Multi-Criteria Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="رقم الطلب، اسم العميل، الهاتف، العنوان..."
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold focus:outline-none focus:border-brand-800"
                    />
                  </div>

                  <select
                    value={orderGovernorateFilter}
                    onChange={(e) => setOrderGovernorateFilter(e.target.value)}
                    className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="all">كل المحافظات والمناطق</option>
                    {Array.from(
                      new Set([
                        ...shippingRates.map((r) => r.governorate),
                        ...orders.map((o) => o.governorate),
                      ])
                    ).map((gov) => (
                      <option key={gov} value={gov}>
                        {gov}
                      </option>
                    ))}
                  </select>

                  <select
                    value={orderPaymentFilter}
                    onChange={(e) => setOrderPaymentFilter(e.target.value)}
                    className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="all">كل طرق الدفع</option>
                    <option value="cod">الدفع عند الاستلام (COD)</option>
                    <option value="instapay">تحويل إنستا باي (InstaPay)</option>
                    <option value="vodafone_cash">محفظة فودافون كاش</option>
                  </select>

                  <select
                    value={orderSort}
                    onChange={(e) =>
                      setOrderSort(
                        e.target.value as 'newest' | 'oldest' | 'highest' | 'lowest'
                      )
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="newest">الترتيب: الأحدث أولاً</option>
                    <option value="oldest">الترتيب: الأقدم أولاً</option>
                    <option value="highest">الترتيب: الأعلى قيمة</option>
                    <option value="lowest">الترتيب: الأقل قيمة</option>
                  </select>
                </div>

                {/* Status Filter Pills */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-brand-100">
                  <button
                    onClick={() => {
                      setOrderStatusFilter('all');
                      updateUrlQueryParams({ status: null });
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition ${
                      orderStatusFilter === 'all'
                        ? 'bg-brand-900 text-white'
                        : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                    }`}
                  >
                    الكل ({orders.length})
                  </button>
                  {CANONICAL_ORDER_STATUSES.map((stKey) => {
                    const count = orders.filter(
                      (o) => o.status === stKey || (stKey === 'roasting_packing' && (o.status as string) === 'preparing')
                    ).length;
                    const info = getOrderStatusMeta(stKey);
                    return (
                      <button
                        key={stKey}
                        onClick={() => {
                          setOrderStatusFilter(stKey);
                          updateUrlQueryParams({ status: stKey });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                          orderStatusFilter === stKey
                            ? 'bg-brand-900 text-white'
                            : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                        }`}
                      >
                        {info.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Orders Data Table */}
              {filteredOrders.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-brand-200 text-center space-y-2">
                  <Package className="w-8 h-8 text-brand-400 mx-auto" />
                  <h3 className="text-sm font-extrabold text-brand-950">
                    لا توجد طلبات مطابقة للفلاتر المحددة
                  </h3>
                  <button
                    onClick={() => {
                      setOrderSearch('');
                      setOrderStatusFilter('all');
                      setOrderPaymentFilter('all');
                      setOrderGovernorateFilter('all');
                      setOrderSort('newest');
                    }}
                    className="text-xs font-bold text-brand-700 underline"
                  >
                    إعادة ضبط جميع الفلاتر
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-3 whitespace-nowrap">رقم الطلب والتاريخ</th>
                          <th className="p-3 whitespace-nowrap">بيانات العميل</th>
                          <th className="p-3">المحافظة والعنوان والملاحظات</th>
                          <th className="p-3">الأصناف المطلوبة</th>
                          <th className="p-3 whitespace-nowrap">طريقة الدفع</th>
                          <th className="p-3 whitespace-nowrap">المبلغ الإجمالي</th>
                          <th className="p-3 whitespace-nowrap">حالة الطلب</th>
                          <th className="p-3 text-center whitespace-nowrap">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100 align-top">
                        {filteredOrders.map((order) => {
                          const st = getOrderStatusMeta(order.status);
                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-brand-50/60 transition"
                            >
                              {/* Order Number & Date */}
                              <td className="p-3 whitespace-nowrap">
                                <span className="inline-block font-mono font-black text-xs bg-brand-950 text-gold-400 px-2.5 py-1 rounded-lg">
                                  {order.orderNumber}
                                </span>
                                <div className="text-[10px] text-brand-600 mt-1">
                                  {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                                    dateStyle: 'medium',
                                  })}
                                </div>
                                <div className="text-[10px] text-brand-400">
                                  {new Date(order.createdAt).toLocaleTimeString('ar-EG', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </td>

                              {/* Customer Info */}
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-extrabold text-brand-950">
                                  {order.customerName}
                                </div>
                                <div className="text-[11px] font-mono text-brand-700 mt-0.5">
                                  📞 {order.customerPhone}
                                </div>
                                {order.customerAltPhone && (
                                  <div className="text-[10px] font-mono text-brand-500">
                                    بديل: {order.customerAltPhone}
                                  </div>
                                )}
                              </td>

                              {/* Governorate, Address & Editable Notes */}
                              <td className="p-3 min-w-[200px] max-w-[260px]">
                                <span className="inline-block text-[10px] font-extrabold bg-brand-100 text-brand-900 px-2 py-0.5 rounded-md mb-1">
                                  {order.governorate}
                                </span>
                                <div className="text-[11px] text-brand-800 leading-snug">
                                  {order.address}
                                </div>

                                <div className="mt-1.5 pt-1.5 border-t border-brand-100">
                                  {editingOrderNotesId === order.id ? (
                                    <div className="space-y-1">
                                      <input
                                        type="text"
                                        value={orderNotesDraft}
                                        onChange={(e) => setOrderNotesDraft(e.target.value)}
                                        placeholder="ملاحظات الطلب..."
                                        className="w-full bg-white border border-brand-300 rounded px-2 py-1 text-[10px]"
                                      />
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveOrderNotes(order.id)}
                                          className="bg-brand-900 text-white text-[10px] font-bold px-2 py-0.5 rounded"
                                        >
                                          حفظ
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingOrderNotesId(null)}
                                          className="text-[10px] text-brand-600 px-1.5 py-0.5"
                                        >
                                          إلغاء
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-1 text-[10px]">
                                      <span className="text-amber-900 font-bold truncate">
                                        📝 {order.notes || 'بدون ملاحظات'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingOrderNotesId(order.id);
                                          setOrderNotesDraft(order.notes || '');
                                        }}
                                        className="text-brand-700 hover:underline font-bold shrink-0"
                                      >
                                        تعديل
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Ordered Items */}
                              <td className="p-3 min-w-[240px]">
                                <div className="space-y-1">
                                  {order.items.map((item, idx) => (
                                    <div
                                      key={item.cartItemId || `${order.id}-item-${idx}-${item.productId || 'p'}`}
                                      className="bg-brand-50/80 px-2 py-1.5 rounded-lg border border-brand-100 text-[11px]"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-brand-950">
                                          {item.productName} × {item.quantity}
                                        </span>
                                        <span className="font-extrabold text-brand-900 shrink-0">
                                          {item.unitPrice * item.quantity} ج.م
                                        </span>
                                      </div>
                                      {item.isCustomMix && item.customBreakdown ? (
                                        <div className="text-[10px] text-brand-700 mt-1 pr-1.5 border-r-2 border-gold-500 space-y-0.5">
                                          {item.customBreakdown.map((b, bIdx) => (
                                            <div key={b.productId ? `${b.productId}-${bIdx}` : bIdx}>
                                              • {b.productName} ({b.roastOption}) — {b.weightGrams}جم (
                                              {b.percentage}%)
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-brand-600">
                                          {item.weightLabel} • {item.roastOption}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>

                              {/* Payment Method */}
                              <td className="p-3 whitespace-nowrap">
                                <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-brand-100 text-brand-900">
                                  {order.paymentMethod === 'cod'
                                    ? '💵 الدفع عند الاستلام'
                                    : order.paymentMethod === 'instapay'
                                    ? '⚡ إنستا باي'
                                    : '📱 فودافون كاش'}
                                </span>
                                {order.paymentReference && (
                                  <div className="text-[10px] font-mono text-brand-600 mt-1">
                                    مرجع: {order.paymentReference}
                                  </div>
                                )}
                              </td>

                              {/* Total & Breakdown */}
                              <td className="p-3 whitespace-nowrap">
                                <div className="text-sm font-black text-pistachio-700">
                                  {order.total} ج.م
                                </div>
                                <div className="text-[10px] text-brand-600">
                                  شحن: {order.shippingCost === 0 ? 'مجاني' : `${order.shippingCost} ج.م`}
                                </div>
                                {order.discountAmount > 0 && (
                                  <div className="text-[10px] text-pistachio-700 font-bold">
                                    خصم: -{order.discountAmount} ج.م
                                  </div>
                                )}
                                {(isFullAdmin || currentRole === 'accountant') &&
                                  typeof order.netProfitEgp === 'number' && (
                                    <div className="mt-1 pt-1 border-t border-brand-100 text-[10px] space-y-0.5">
                                      <div className="text-amber-800 font-bold">
                                        تكلفة: {order.rawCostTotal || 0} ج.م
                                      </div>
                                      <div className="text-pistachio-700 font-black">
                                        ربح صافي: +{order.netProfitEgp} ج.م
                                      </div>
                                    </div>
                                  )}
                              </td>

                              {/* Status Badge & Selector */}
                              <td className="p-3 whitespace-nowrap space-y-1.5">
                                <div>
                                  <span
                                    className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${st?.badgeClass || 'bg-amber-100 text-amber-800 border-amber-200'}`}
                                  >
                                    {st?.label || order.status || 'قيد المراجعة'}
                                  </span>
                                </div>
                                {currentRole !== 'accountant' && (
                                  <select
                                    value={(order.status as string) === 'preparing' ? 'roasting_packing' : order.status}
                                    onChange={(e) =>
                                      handleOrderStatusChange(order.id, e.target.value as OrderStatus)
                                    }
                                    className="block w-full bg-brand-50 border border-brand-300 text-brand-950 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none"
                                  >
                                    <option value="pending">قيد المراجعة</option>
                                    <option value="confirmed">تم التأكيد</option>
                                    <option value="roasting_packing">جاري التحميص والتغليف</option>
                                    <option value="shipped">خرج مع المندوب</option>
                                    <option value="delivered">تم التسليم</option>
                                    <option value="cancelled">ملغي</option>
                                  </select>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="p-3 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => {
                                      setSelectedInvoiceOrder(order);
                                      updateUrlQueryParams({ invoice: order.orderNumber });
                                    }}
                                    className="p-1.5 bg-brand-900 hover:bg-brand-950 text-gold-400 rounded-lg transition"
                                    title="معاينة وطباعة الفاتورة"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>

                                  <a
                                    href={`https://wa.me/${formatWhatsAppPhone(order.customerPhone)}?text=${encodeURIComponent(
                                      `مرحباً أ/ ${order.customerName}، بخصوص طلبك رقم ${order.orderNumber} من ${settings.storeName}...`
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg transition"
                                    title="مراسلة عبر واتساب"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>

                                  {isFullAdmin && (
                                    <button
                                      onClick={() => handleDeleteOrder(order.id)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                      title="حذف الطلب"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-brand-50 border-t-2 border-brand-200 font-black text-xs text-brand-950">
                          <td colSpan={5} className="p-3">
                            إجمالي الطلبات المعروضة في الجدول ({filteredOrders.length} طلب)
                          </td>
                          <td colSpan={3} className="p-3 text-pistachio-700 text-sm">
                            {filteredOrders
                              .filter((o) => o.status !== 'cancelled')
                              .reduce((s, o) => s + o.total, 0)}{' '}
                            ج.م (صافي غير الملغي)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 3: FULL PRODUCTS, WEIGHTS & ROASTS CRUD                    */}
          {/* ================================================================= */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Filter & Action Header */}
              <div className="bg-white p-4 rounded-2xl border border-brand-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-brand-800" />
                    <div>
                      <h2 className="text-sm sm:text-base font-black text-brand-950">
                        جدول المنتجات والأوزان والأسعار ({filteredProducts.length} من {products.length} صنف)
                      </h2>
                      <p className="text-[11px] text-brand-600">
                        فلترة، ترتيب، وتحكم كامل في كافة بيانات الأصناف والأوزان وخيارات التحميص
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(productSearch ||
                      productCategoryFilter !== 'all' ||
                      productStockFilter !== 'all' ||
                      productFeaturedFilter !== 'all' ||
                      productRoastFilter !== 'all' ||
                      productSort !== 'default') && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearch('');
                          setProductCategoryFilter('all');
                          setProductStockFilter('all');
                          setProductFeaturedFilter('all');
                          setProductRoastFilter('all');
                          setProductSort('default');
                        }}
                        className="text-[11px] bg-red-50 hover:bg-red-100 text-red-700 font-extrabold px-2.5 py-1.5 rounded-xl transition"
                      >
                        إعادة ضبط الفلاتر ✕
                      </button>
                    )}
                    <button
                      onClick={openCreateProductModal}
                      className="bg-brand-900 hover:bg-brand-950 text-white text-xs font-extrabold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-gold-400" />
                      <span>إضافة منتج مكسرات جديد</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-2 border-t border-brand-100">
                  <div className="relative lg:col-span-2">
                    <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="ابحث بالاسم، المنشأ، الشارة، أو الرابط..."
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <select
                    value={productCategoryFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProductCategoryFilter(val);
                      updateUrlQueryParams({ cat: val === 'all' ? null : val });
                    }}
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">جميع الأقسام ({categories.length})</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={productStockFilter}
                    onChange={(e) => setProductStockFilter(e.target.value as 'all' | 'in' | 'out')}
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">كل حالات التوفر</option>
                    <option value="in">متوفر في المخزون</option>
                    <option value="out">غير متوفر (نافد)</option>
                  </select>

                  <select
                    value={productFeaturedFilter}
                    onChange={(e) =>
                      setProductFeaturedFilter(
                        e.target.value as 'all' | 'featured' | 'regular'
                      )
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">التمييز: الكل</option>
                    <option value="featured">مميز في الرئيسية ⭐</option>
                    <option value="regular">غير مميز</option>
                  </select>

                  <select
                    value={productSort}
                    onChange={(e) =>
                      setProductSort(
                        e.target.value as 'default' | 'price_asc' | 'price_desc' | 'rating_desc'
                      )
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="default">الترتيب: الافتراضي</option>
                    <option value="price_asc">السعر: الأقل أولاً</option>
                    <option value="price_desc">السعر: الأعلى أولاً</option>
                    <option value="rating_desc">التقييم: الأعلى أولاً</option>
                  </select>
                </div>

                {/* Roast Option Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-brand-100">
                  <span className="text-[11px] font-bold text-brand-600 ml-1">
                    فلترة حسب التحميص:
                  </span>
                  <button
                    type="button"
                    onClick={() => setProductRoastFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                      productRoastFilter === 'all'
                        ? 'bg-brand-900 text-white'
                        : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                    }`}
                  >
                    كل التحميصات
                  </button>
                  {ALL_ROAST_OPTIONS.map((roast) => (
                    <button
                      key={roast}
                      type="button"
                      onClick={() => setProductRoastFilter(roast)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                        productRoastFilter === roast
                          ? 'bg-brand-900 text-white'
                          : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                      }`}
                    >
                      {roast}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Product Create / Edit Form Modal */}
              {editingProduct && (
                <form
                  onSubmit={handleSaveProductModal}
                  className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-brand-900 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-brand-100 pb-3">
                    <h3 className="font-black text-sm sm:text-base text-brand-950">
                      {isCreatingProduct
                        ? '➕ إضافة منتج جديد إلى المتجر'
                        : `✏️ تحرير شامل للمنتج: ${editingProduct.name}`}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setIsCreatingProduct(false);
                      }}
                      className="text-xs font-bold text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg"
                    >
                      إغلاق ✕
                    </button>
                  </div>

                  {/* Basic Info Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">اسم المنتج *</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.name}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, name: e.target.value })
                        }
                        placeholder="مثال: فستق أمريكي جامبو محمص"
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">القسم *</label>
                      <select
                        value={editingProduct.categoryId}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, categoryId: e.target.value })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">الرابط المختصر (Slug)</label>
                      <input
                        type="text"
                        value={editingProduct.slug}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, slug: e.target.value })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Origin, Badge, Image */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">بلد المنشأ / درجة الفرز</label>
                      <input
                        type="text"
                        value={editingProduct.origin}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, origin: e.target.value })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">الشارة المميزة (Badge)</label>
                      <input
                        type="text"
                        value={editingProduct.badge || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, badge: e.target.value })
                        }
                        placeholder="الأكثر مبيعاً / تحميص اليوم"
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold">صورة المنتج</label>
                        <label className="text-[10px] bg-brand-900 hover:bg-brand-950 text-gold-400 font-bold px-2 py-0.5 rounded-lg cursor-pointer flex items-center gap-1 transition">
                          <Upload className="w-3 h-3" />
                          <span>رفع صورة من الجهاز</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                readAndCompressImageFile(file, (dataUrl) => {
                                  setEditingProduct({ ...editingProduct, image: dataUrl });
                                });
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <img
                          src={getSafeImageUrl(editingProduct.image)}
                          alt="معاينة"
                          className="w-9 h-9 rounded-lg object-cover border border-brand-200 shrink-0 bg-brand-50"
                        />
                        <input
                          type="text"
                          value={editingProduct.image}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, image: e.target.value })
                          }
                          placeholder="/images/products/pistachio.jpg أو رابط صورة"
                          className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {LOCAL_PRODUCT_IMAGES.map((imgOpt) => (
                          <button
                            key={imgOpt.url}
                            type="button"
                            onClick={() =>
                              setEditingProduct({ ...editingProduct, image: imgOpt.url })
                            }
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[10px] font-bold transition ${
                              editingProduct.image === imgOpt.url
                                ? 'bg-brand-900 text-gold-400 border-brand-900'
                                : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
                            }`}
                          >
                            <img
                              src={getSafeImageUrl(imgOpt.url)}
                              alt={imgOpt.label}
                              className="w-4 h-4 rounded object-cover"
                            />
                            <span>{imgOpt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Subtitle & Description */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">الوصف المختصر (Subtitle)</label>
                      <input
                        type="text"
                        value={editingProduct.subtitle}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, subtitle: e.target.value })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">الوصف التفصيلي الكامل</label>
                      <textarea
                        rows={2}
                        value={editingProduct.description}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, description: e.target.value })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Nutrition & Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-brand-100">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold mb-1">القيمة والفائدة الغذائية</label>
                      <input
                        type="text"
                        value={editingProduct.nutritionalHighlight}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            nutritionalHighlight: e.target.value,
                          })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">السعرات (لكل 100 جم)</label>
                      <input
                        type="number"
                        value={editingProduct.caloriesPer100g}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            caloriesPer100g: Number(e.target.value),
                          })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">البروتين (لكل 100 جم)</label>
                      <input
                        type="text"
                        value={editingProduct.proteinPer100g}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            proteinPer100g: e.target.value,
                          })
                        }
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Roast Options Checkboxes */}
                  <div className="pt-2 border-t border-brand-100 space-y-1.5">
                    <label className="block text-[11px] font-extrabold text-brand-900">
                      خيارات التحميص المتاحة لهذا الصنف:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_ROAST_OPTIONS.map((roast) => {
                        const checked = editingProduct.roastOptions.includes(roast);
                        return (
                          <button
                            key={roast}
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? editingProduct.roastOptions.filter((r) => r !== roast)
                                : [...editingProduct.roastOptions, roast];
                              setEditingProduct({ ...editingProduct, roastOptions: next });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                              checked
                                ? 'bg-brand-900 text-gold-400 border-brand-900'
                                : 'bg-brand-50 text-brand-700 border-brand-200'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                            <span>{roast}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Weights & Prices Editor */}
                  <div className="pt-2 border-t border-brand-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-brand-950">
                        الأوزان والأسعار المتاحة ({editingProduct.weights.length}):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newWeight: WeightVariant = {
                            id: `w-${Date.now()}`,
                            label: 'وزن جديد',
                            weightGrams: 250,
                            price: 150,
                          };
                          setEditingProduct({
                            ...editingProduct,
                            weights: [...editingProduct.weights, newWeight],
                          });
                        }}
                        className="text-[11px] bg-amber-100 hover:bg-amber-200 text-brand-950 font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>إضافة وزن جديد</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {editingProduct.weights.map((w, idx) => (
                        <div
                          key={w.id}
                          className="bg-brand-50 p-3 rounded-xl border border-brand-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-brand-700">
                              وزن #{idx + 1}
                            </span>
                            {editingProduct.weights.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextW = editingProduct.weights.filter((_, i) => i !== idx);
                                  setEditingProduct({ ...editingProduct, weights: nextW });
                                }}
                                className="text-red-500 hover:text-red-700 text-[10px] font-bold"
                              >
                                حذف الوزن
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold mb-0.5">مسمى الوزن</label>
                            <input
                              type="text"
                              value={w.label}
                              onChange={(e) => {
                                const updated = [...editingProduct.weights];
                                updated[idx] = { ...w, label: e.target.value };
                                setEditingProduct({ ...editingProduct, weights: updated });
                              }}
                              className="w-full bg-white border border-brand-200 rounded-lg px-2 py-1 text-xs font-bold"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="block text-[10px] font-bold mb-0.5">بالجرام</label>
                              <input
                                type="number"
                                value={w.weightGrams}
                                onChange={(e) => {
                                  const updated = [...editingProduct.weights];
                                  updated[idx] = { ...w, weightGrams: Number(e.target.value) };
                                  setEditingProduct({ ...editingProduct, weights: updated });
                                }}
                                className="w-full bg-white border border-brand-200 rounded-lg px-2 py-1 text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold mb-0.5">السعر (ج.م)</label>
                              <input
                                type="number"
                                value={w.price}
                                onChange={(e) => {
                                  const updated = [...editingProduct.weights];
                                  updated[idx] = { ...w, price: Number(e.target.value) };
                                  setEditingProduct({ ...editingProduct, weights: updated });
                                }}
                                className="w-full bg-white border border-brand-300 rounded-lg px-2 py-1 text-xs font-black text-pistachio-700"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold mb-0.5">قبل الخصم</label>
                              <input
                                type="number"
                                value={w.originalPrice || ''}
                                onChange={(e) => {
                                  const updated = [...editingProduct.weights];
                                  updated[idx] = {
                                    ...w,
                                    originalPrice: e.target.value ? Number(e.target.value) : undefined,
                                  };
                                  setEditingProduct({ ...editingProduct, weights: updated });
                                }}
                                placeholder="اختياري"
                                className="w-full bg-white border border-brand-200 rounded-lg px-2 py-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Availability, Stock KG, Channels & Featured Flags + Submit */}
                  <div className="space-y-3 pt-3 border-t border-brand-200">
                    <div className="flex flex-wrap items-center gap-4 bg-brand-50 p-3 rounded-xl border border-brand-200">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-black text-brand-950">رصيد المخزون الفعلي (كجم):</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingProduct.stockKg ?? 50}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              stockKg: Number(e.target.value),
                            })
                          }
                          className="w-24 bg-white border border-brand-300 rounded-lg px-2.5 py-1 text-xs font-black text-brand-900"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 text-xs font-extrabold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingProduct.inStock}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, inStock: e.target.checked })
                          }
                          className="rounded text-brand-900"
                        />
                        <span>متوفر للبيع</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs font-extrabold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingProduct.showOnline !== false}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, showOnline: e.target.checked })
                          }
                          className="rounded text-brand-900"
                        />
                        <span>🌐 متاح بالمتجر الإلكتروني</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs font-extrabold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingProduct.showInPos !== false}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, showInPos: e.target.checked })
                          }
                          className="rounded text-brand-900"
                        />
                        <span>🧾 متاح بالكاشير (POS)</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs font-extrabold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingProduct.featured}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, featured: e.target.checked })
                          }
                          className="rounded text-brand-900"
                        />
                        <span>منتج مميز في الرئيسية ⭐</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(null);
                          setIsCreatingProduct(false);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-brand-700 hover:bg-brand-100"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-brand-900 hover:bg-brand-950 text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md"
                      >
                        <Save className="w-3.5 h-3.5 text-gold-400" />
                        <span>حفظ ونشر التعديلات</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Products Data Table */}
              {filteredProducts.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-brand-200 text-center space-y-2">
                  <ShoppingBag className="w-8 h-8 text-brand-400 mx-auto" />
                  <h3 className="text-sm font-extrabold text-brand-950">
                    لا توجد منتجات مطابقة للفلاتر المحددة
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('');
                      setProductCategoryFilter('all');
                      setProductStockFilter('all');
                      setProductFeaturedFilter('all');
                      setProductRoastFilter('all');
                      setProductSort('default');
                    }}
                    className="text-xs font-bold text-brand-700 underline"
                  >
                    إعادة ضبط الفلاتر
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-3 whitespace-nowrap">الصنف والرابط</th>
                          <th className="p-3 whitespace-nowrap">القسم والمنشأ</th>
                          <th className="p-3">الأوزان والأسعار (ج.م)</th>
                          <th className="p-3">خيارات التحميص</th>
                          <th className="p-3 whitespace-nowrap">التقييم والقيم</th>
                          <th className="p-3 whitespace-nowrap text-center">المخزون والقنوات والتمييز</th>
                          <th className="p-3 whitespace-nowrap text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100 align-top">
                        {filteredProducts.map((prod) => {
                          const catName =
                            categories.find((c) => c.id === prod.categoryId)?.name ||
                            prod.categoryId;
                          return (
                            <tr key={prod.id} className="hover:bg-brand-50/60 transition">
                              {/* Product Image, Name, Badge & Slug */}
                              <td className="p-3 min-w-[210px]">
                                <div className="flex items-start gap-2.5">
                                  <img
                                    src={getSafeImageUrl(prod.image)}
                                    alt={prod.name}
                                    className="w-12 h-12 rounded-xl object-cover shrink-0 bg-brand-100 border border-brand-200"
                                  />
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="font-extrabold text-brand-950 text-xs leading-snug">
                                      {prod.name}
                                    </div>
                                    {prod.badge && (
                                      <span className="inline-block text-[9px] bg-gold-500/25 text-brand-950 px-1.5 py-0.5 rounded font-extrabold">
                                        {prod.badge}
                                      </span>
                                    )}
                                    <div className="text-[10px] font-mono text-brand-500 truncate">
                                      /{prod.slug}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Category & Origin */}
                              <td className="p-3 whitespace-nowrap">
                                <span className="inline-block text-[10px] font-extrabold bg-brand-100 text-brand-900 px-2 py-0.5 rounded-md">
                                  {catName}
                                </span>
                                <div className="text-[11px] text-brand-700 font-bold mt-1">
                                  🌍 {prod.origin}
                                </div>
                              </td>

                              {/* Weights & Prices */}
                              <td className="p-3 min-w-[200px]">
                                <div className="space-y-1">
                                  {prod.weights.map((w) => (
                                    <div
                                      key={w.id}
                                      className="flex items-center justify-between gap-2 bg-brand-50 px-2 py-1 rounded-lg border border-brand-200/80 text-[10px]"
                                    >
                                      <span className="font-bold text-brand-800">{w.label}</span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <strong className="text-pistachio-700 font-black">
                                          {w.price} ج.م
                                        </strong>
                                        {w.originalPrice && (
                                          <span className="line-through text-brand-400">
                                            {w.originalPrice}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>

                              {/* Roast Options */}
                              <td className="p-3 min-w-[150px]">
                                <div className="flex flex-wrap gap-1">
                                  {prod.roastOptions.map((r) => (
                                    <span
                                      key={r}
                                      className="text-[9px] bg-amber-50 border border-amber-200 text-brand-900 px-1.5 py-0.5 rounded font-bold"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </td>

                              {/* Rating & Nutrition */}
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-black text-brand-950 flex items-center gap-1">
                                  <span className="text-gold-500">★</span>
                                  <span>{prod.rating || 5.0}</span>
                                  <span className="text-[10px] text-brand-500 font-normal">
                                    ({prod.reviewsCount || 0})
                                  </span>
                                </div>
                                <div className="text-[10px] text-brand-600 mt-1">
                                  🔥 {prod.caloriesPer100g} سعرة • 💪 {prod.proteinPer100g}
                                </div>
                              </td>

                              {/* Stock, Channels & Featured Toggles */}
                              <td className="p-3 whitespace-nowrap text-center space-y-1.5">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleProductStock(prod.id)}
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition ${
                                      prod.inStock
                                        ? 'bg-pistachio-50 text-pistachio-700 border-pistachio-200 hover:bg-pistachio-100'
                                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                    }`}
                                    title="تغيير حالة التوفر"
                                  >
                                    {prod.inStock ? 'متوفر ✓' : 'نافد ✕'}
                                  </button>
                                  <span
                                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                      (prod.stockKg ?? 0) <= 5
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-brand-50 text-brand-700 border-brand-200'
                                    }`}
                                    title="المخزون المتوفر بالكيلوجرام"
                                  >
                                    {prod.stockKg !== undefined ? `${prod.stockKg} كجم` : '50 كجم'}
                                  </span>
                                </div>

                                {/* Channel Badges & Toggles */}
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleProductShowOnline(prod.id)}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border transition ${
                                      prod.showOnline !== false
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                        : 'bg-zinc-100 text-zinc-400 border-zinc-200 line-through'
                                    }`}
                                    title="قناة المتجر الإلكتروني: انقر للتفعيل أو التعطيل"
                                  >
                                    🌐 {prod.showOnline !== false ? 'أونلاين' : 'معطل'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleProductShowInPos(prod.id)}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border transition ${
                                      prod.showInPos !== false
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-zinc-100 text-zinc-400 border-zinc-200 line-through'
                                    }`}
                                    title="قناة الكاشير POS: انقر للتفعيل أو التعطيل"
                                  >
                                    🧾 {prod.showInPos !== false ? 'كاشير' : 'معطل'}
                                  </button>
                                </div>

                                <div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleProductFeatured(prod.id)}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${
                                      prod.featured
                                        ? 'bg-gold-500/20 text-brand-950 border-gold-500/40'
                                        : 'bg-brand-50 text-brand-400 border-brand-200'
                                    }`}
                                  >
                                    {prod.featured ? '⭐ مميز بالرئيسية' : '☆ غير مميز'}
                                  </button>
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="p-3 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsCreatingProduct(false);
                                      setEditingProduct(prod);
                                      updateUrlQueryParams({ productModal: prod.slug });
                                    }}
                                    className="bg-amber-100 hover:bg-amber-200 text-brand-950 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                                    title="تحرير شامل للمنتج"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>تحرير</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateProduct(prod)}
                                    className="p-1.5 text-brand-700 hover:bg-brand-100 rounded-lg"
                                    title="نسخ المنتج"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>

                                  <Link
                                    href={`/product/${prod.slug}`}
                                    target="_blank"
                                    className="p-1.5 text-pistachio-700 hover:bg-pistachio-50 rounded-lg"
                                    title="معاينة صفحة المنتج"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(prod.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                    title="حذف المنتج"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 4: CATEGORIES DATA TABLE WITH FILTERS                      */}
          {/* ================================================================= */}
          {activeTab === 'categories' && (
            <div className={`grid grid-cols-1 ${isFullAdmin ? 'lg:grid-cols-3' : ''} gap-4`}>
              {isFullAdmin && (
                <form
                  onSubmit={handleSaveCategory}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 h-fit shadow-2xs"
                >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-brand-950">
                    {editingCategory ? `تعديل قسم: ${editingCategory.name}` : '+ إضافة قسم جديد'}
                  </h3>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="text-[11px] text-red-600 font-bold"
                    >
                      إلغاء
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">اسم القسم *</label>
                  <input
                    type="text"
                    required
                    value={editingCategory ? editingCategory.name : catName}
                    onChange={(e) =>
                      editingCategory
                        ? setEditingCategory({ ...editingCategory, name: e.target.value })
                        : setCatName(e.target.value)
                    }
                    placeholder="مثال: زبدة المكسرات الطبيعية"
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">وصف القسم</label>
                  <textarea
                    rows={2}
                    value={editingCategory ? editingCategory.description : catDesc}
                    onChange={(e) =>
                      editingCategory
                        ? setEditingCategory({ ...editingCategory, description: e.target.value })
                        : setCatDesc(e.target.value)
                    }
                    placeholder="زبدة الفول السوداني وزبدة البندق والفستق"
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold">صورة القسم</label>
                    <label className="text-[10px] bg-brand-900 hover:bg-brand-950 text-gold-400 font-bold px-2 py-0.5 rounded-lg cursor-pointer flex items-center gap-1 transition">
                      <Upload className="w-3 h-3" />
                      <span>رفع من الجهاز</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            readAndCompressImageFile(file, (dataUrl) => {
                              if (editingCategory) {
                                setEditingCategory({ ...editingCategory, image: dataUrl });
                              } else {
                                setCatImage(dataUrl);
                              }
                            });
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src={getSafeImageUrl(editingCategory ? editingCategory.image : catImage)}
                      alt="معاينة القسم"
                      className="w-9 h-9 rounded-lg object-cover border border-brand-200 shrink-0 bg-brand-50"
                    />
                    <input
                      type="text"
                      value={editingCategory ? editingCategory.image : catImage}
                      onChange={(e) =>
                        editingCategory
                          ? setEditingCategory({ ...editingCategory, image: e.target.value })
                          : setCatImage(e.target.value)
                      }
                      placeholder="/images/products/pistachio.jpg أو رابط صورة"
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {LOCAL_PRODUCT_IMAGES.map((imgOpt) => {
                      const activeImg = editingCategory ? editingCategory.image : catImage;
                      return (
                        <button
                          key={imgOpt.url}
                          type="button"
                          onClick={() =>
                            editingCategory
                              ? setEditingCategory({ ...editingCategory, image: imgOpt.url })
                              : setCatImage(imgOpt.url)
                          }
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[10px] font-bold transition ${
                            activeImg === imgOpt.url
                              ? 'bg-brand-900 text-gold-400 border-brand-900'
                              : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
                          }`}
                        >
                          <img
                            src={getSafeImageUrl(imgOpt.url)}
                            alt={imgOpt.label}
                            className="w-4 h-4 rounded object-cover"
                          />
                          <span>{imgOpt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-brand-900 hover:bg-brand-950 text-white font-extrabold py-2 rounded-xl text-xs"
                >
                  {editingCategory ? 'حفظ تعديلات القسم' : '+ إضافة القسم للمتجر'}
                </button>
              </form>
              )}

              {/* Categories Filter Bar & Data Table */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 h-fit shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-brand-800" />
                    <h3 className="text-sm font-black text-brand-950">
                      جدول الأقسام والتصنيفات ({filteredCategories.length} من {categories.length})
                    </h3>
                  </div>

                  {(categorySearch || categoryCountFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategorySearch('');
                        setCategoryCountFilter('all');
                      }}
                      className="text-[11px] bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-lg"
                    >
                      إعادة ضبط الفلتر ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="ابحث باسم القسم أو الوصف..."
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <select
                    value={categoryCountFilter}
                    onChange={(e) =>
                      setCategoryCountFilter(
                        e.target.value as 'all' | 'with_products' | 'empty'
                      )
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="all">جميع الأقسام</option>
                    <option value="with_products">أقسام تحتوي على منتجات</option>
                    <option value="empty">أقسام فارغة (0 منتج)</option>
                  </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-brand-200">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                        <th className="p-2.5 whitespace-nowrap">الصورة</th>
                        <th className="p-2.5 whitespace-nowrap">اسم القسم والرابط</th>
                        <th className="p-2.5">الوصف</th>
                        <th className="p-2.5 whitespace-nowrap text-center">عدد المنتجات</th>
                        {isFullAdmin && (
                          <th className="p-2.5 whitespace-nowrap text-center">إجراءات</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {filteredCategories.map((cat) => {
                        const prodCount = products.filter((p) => p.categoryId === cat.id).length;
                        return (
                          <tr key={cat.id} className="hover:bg-brand-50/70 transition">
                            <td className="p-2.5 whitespace-nowrap">
                              <img
                                src={getSafeImageUrl(cat.image)}
                                alt={cat.name}
                                className="w-11 h-11 rounded-xl object-cover bg-brand-100 border border-brand-200"
                              />
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="font-extrabold text-brand-950">{cat.name}</div>
                              <div className="text-[10px] font-mono text-brand-500">{cat.slug}</div>
                            </td>
                            <td className="p-2.5 text-[11px] text-brand-700 max-w-xs">
                              {cat.description}
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setProductCategoryFilter(cat.id);
                                  setActiveTab(
                                    currentRole === 'supplier' ? 'supply_portal' : 'products'
                                  );
                                }}
                                className="text-[11px] bg-brand-100 hover:bg-brand-200 text-brand-900 px-2.5 py-1 rounded-lg font-extrabold transition"
                                title="عرض منتجات هذا القسم"
                              >
                                {prodCount} صنف ←
                              </button>
                            </td>
                            {isFullAdmin && (
                              <td className="p-2.5 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCategory(cat)}
                                    className="p-1.5 bg-amber-100 hover:bg-amber-200 text-brand-950 rounded-lg"
                                    title="تعديل القسم"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                    title="حذف القسم"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 6: SHIPPING & GOVERNORATES FULL CRUD                       */}
          {/* ================================================================= */}
          {activeTab === 'shipping' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Add Governorate & Free Shipping Threshold */}
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-brand-200 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs sm:text-sm font-black text-brand-950">
                    حد الشحن المجاني التلقائي
                  </h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      defaultValue={settings.freeShippingThreshold}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== settings.freeShippingThreshold) {
                          updateStorePayload(
                            { settings: { ...settings, freeShippingThreshold: val } },
                            'تم تحديث حد الشحن المجاني'
                          );
                        }
                      }}
                      className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-1.5 text-xs font-black"
                    />
                    <span className="text-xs font-bold shrink-0">ج.م</span>
                  </div>
                  <p className="text-[10px] text-brand-600">
                    أي طلب يتجاوز هذا المبلغ يحصل تلقائياً على شحن مجاني (0 ج.م).
                  </p>
                </div>

                <form
                  onSubmit={handleAddGovernorate}
                  className="bg-white p-4 rounded-2xl border border-brand-200 space-y-3 shadow-2xs"
                >
                  <h3 className="text-xs sm:text-sm font-black text-brand-950">
                    + إضافة محافظة / منطقة شحن
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">اسم المحافظة أو المنطقة *</label>
                    <input
                      type="text"
                      required
                      value={newGovName}
                      onChange={(e) => setNewGovName(e.target.value)}
                      placeholder="مثال: مدن القناة وسيناء"
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">سعر الشحن (ج.م)</label>
                      <input
                        type="number"
                        required
                        value={newGovPrice}
                        onChange={(e) => setNewGovPrice(Number(e.target.value))}
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">مدة التوصيل</label>
                      <input
                        type="text"
                        value={newGovDays}
                        onChange={(e) => setNewGovDays(e.target.value)}
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-brand-900 hover:bg-brand-950 text-white font-extrabold py-2 rounded-xl text-xs"
                  >
                    إضافة المنطقة
                  </button>
                </form>
              </div>

              {/* Shipping Rates Filter Bar & Data Table */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 shadow-2xs h-fit">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-brand-800" />
                    <h3 className="text-sm font-black text-brand-950">
                      جدول المحافظات وأسعار التوصيل ({filteredShippingRates.length} من{' '}
                      {shippingRates.length})
                    </h3>
                  </div>

                  {(shippingSearch ||
                    shippingPriceFilter !== 'all' ||
                    shippingSort !== 'default') && (
                    <button
                      type="button"
                      onClick={() => {
                        setShippingSearch('');
                        setShippingPriceFilter('all');
                        setShippingSort('default');
                      }}
                      className="text-[11px] bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-lg"
                    >
                      إعادة ضبط الفلاتر ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={shippingSearch}
                      onChange={(e) => setShippingSearch(e.target.value)}
                      placeholder="ابحث باسم المحافظة أو المدة..."
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <select
                    value={shippingPriceFilter}
                    onChange={(e) =>
                      setShippingPriceFilter(e.target.value as 'all' | 'low' | 'high')
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">جميع شرائح أسعار الشحن</option>
                    <option value="low">شحن اقتصادي (60 ج.م فأقل)</option>
                    <option value="high">شحن محافظات بعيدة (أكثر من 60 ج.م)</option>
                  </select>

                  <select
                    value={shippingSort}
                    onChange={(e) =>
                      setShippingSort(
                        e.target.value as 'default' | 'price_asc' | 'price_desc' | 'name'
                      )
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="default">الترتيب: الافتراضي</option>
                    <option value="price_asc">السعر: الأقل أولاً</option>
                    <option value="price_desc">السعر: الأعلى أولاً</option>
                    <option value="name">المحافظة: أبجدياً</option>
                  </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-brand-200">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                        <th className="p-2.5 whitespace-nowrap">#</th>
                        <th className="p-2.5">المحافظة / منطقة التوصيل</th>
                        <th className="p-2.5">مدة التوصيل المتوقعة</th>
                        <th className="p-2.5 whitespace-nowrap">سعر الشحن (ج.م)</th>
                        <th className="p-2.5 whitespace-nowrap text-center">الطلبات</th>
                        <th className="p-2.5 whitespace-nowrap text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {filteredShippingRates.map((rate: ShippingRate, idx: number) => {
                        const realIdx = shippingRates.findIndex((r) => r.id === rate.id);
                        const govOrdersCount = orders.filter(
                          (o) => o.governorate === rate.governorate
                        ).length;
                        return (
                          <tr key={rate.id} className="hover:bg-brand-50/70 transition">
                            <td className="p-2.5 font-mono font-bold text-brand-500">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 min-w-[180px]">
                              <input
                                key={`${rate.id}-gov-${rate.governorate}`}
                                type="text"
                                defaultValue={rate.governorate}
                                onBlur={(e) => {
                                  if (e.target.value !== rate.governorate && realIdx !== -1) {
                                    const updated = [...shippingRates];
                                    updated[realIdx] = { ...rate, governorate: e.target.value };
                                    updateStorePayload(
                                      { shippingRates: updated },
                                      'تم تحديث اسم المحافظة'
                                    );
                                  }
                                }}
                                className="w-full bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1 text-xs font-extrabold text-brand-950"
                              />
                            </td>
                            <td className="p-2.5 min-w-[140px]">
                              <input
                                key={`${rate.id}-days-${rate.estimatedDays}`}
                                type="text"
                                defaultValue={rate.estimatedDays}
                                onBlur={(e) => {
                                  if (e.target.value !== rate.estimatedDays && realIdx !== -1) {
                                    const updated = [...shippingRates];
                                    updated[realIdx] = { ...rate, estimatedDays: e.target.value };
                                    updateStorePayload(
                                      { shippingRates: updated },
                                      'تم تحديث مدة التوصيل'
                                    );
                                  }
                                }}
                                className="w-full bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1 text-[11px] text-brand-700"
                              />
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={rate.price}
                                  onChange={(e) => {
                                    if (realIdx !== -1) {
                                      const updated = [...shippingRates];
                                      updated[realIdx] = {
                                        ...rate,
                                        price: Number(e.target.value),
                                      };
                                      updateStorePayload(
                                        { shippingRates: updated },
                                        'تم تحديث سعر الشحن'
                                      );
                                    }
                                  }}
                                  className="w-20 bg-brand-50 border border-brand-300 rounded-lg px-2 py-1 text-xs font-black text-pistachio-700 text-center"
                                />
                                <span className="text-[11px] font-bold">ج.م</span>
                              </div>
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-center">
                              <span className="text-[10px] bg-brand-100 text-brand-900 px-2 py-0.5 rounded-full font-bold">
                                {govOrdersCount} طلب
                              </span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = shippingRates.filter((r) => r.id !== rate.id);
                                  updateStorePayload({ shippingRates: updated }, 'تم حذف المنطقة');
                                }}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg inline-flex"
                                title="حذف المنطقة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 7: COUPONS & PROMOTIONS DATA TABLE WITH FILTERS            */}
          {/* ================================================================= */}
          {activeTab === 'coupons' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <form
                onSubmit={handleSaveCoupon}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 h-fit shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-brand-950">
                    {editingCoupon ? `تعديل كوبون: ${editingCoupon.code}` : '+ إضافة كود خصم جديد'}
                  </h3>
                  {editingCoupon && (
                    <button
                      type="button"
                      onClick={() => setEditingCoupon(null)}
                      className="text-xs text-red-600 font-bold"
                    >
                      إلغاء
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold mb-1">كود الخصم *</label>
                    <input
                      type="text"
                      required
                      value={editingCoupon ? editingCoupon.code : newCouponCode}
                      onChange={(e) =>
                        editingCoupon
                          ? setEditingCoupon({
                              ...editingCoupon,
                              code: e.target.value.toUpperCase(),
                            })
                          : setNewCouponCode(e.target.value)
                      }
                      placeholder="RAMADAN20"
                      className="w-full bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1">نوع الخصم</label>
                    <select
                      value={editingCoupon ? editingCoupon.discountType : newCouponType}
                      onChange={(e) =>
                        editingCoupon
                          ? setEditingCoupon({
                              ...editingCoupon,
                              discountType: e.target.value as 'percentage' | 'fixed',
                            })
                          : setNewCouponType(e.target.value as 'percentage' | 'fixed')
                      }
                      className="w-full bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت (ج.م)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold mb-1">قيمة الخصم</label>
                    <input
                      type="number"
                      value={editingCoupon ? editingCoupon.value : newCouponVal}
                      onChange={(e) =>
                        editingCoupon
                          ? setEditingCoupon({ ...editingCoupon, value: Number(e.target.value) })
                          : setNewCouponVal(Number(e.target.value))
                      }
                      className="w-full bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1">الحد الأدنى للطلب (ج.م)</label>
                    <input
                      type="number"
                      value={editingCoupon ? editingCoupon.minOrderAmount : newCouponMin}
                      onChange={(e) =>
                        editingCoupon
                          ? setEditingCoupon({
                              ...editingCoupon,
                              minOrderAmount: Number(e.target.value),
                            })
                          : setNewCouponMin(Number(e.target.value))
                      }
                      className="w-full bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold mb-1">وصف العرض الترويجي</label>
                  <input
                    type="text"
                    value={editingCoupon ? editingCoupon.description : newCouponDesc}
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({ ...editingCoupon, description: e.target.value })
                        : setNewCouponDesc(e.target.value)
                    }
                    placeholder="خصم خاص لعملاء المحمصة..."
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-pistachio-600 hover:bg-pistachio-700 text-white font-extrabold py-2 rounded-xl text-xs"
                >
                  {editingCoupon ? 'حفظ تعديلات الكوبون' : '+ إضافة كود الخصم'}
                </button>
              </form>

              {/* Coupons Filter Bar & Data Table */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 h-fit shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-brand-800" />
                    <h3 className="text-sm font-black text-brand-950">
                      جدول الكوبونات وأكواد الخصم ({filteredCoupons.length} من {coupons.length})
                    </h3>
                  </div>

                  {(couponSearch ||
                    couponStatusFilter !== 'all' ||
                    couponTypeFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCouponSearch('');
                        setCouponStatusFilter('all');
                        setCouponTypeFilter('all');
                      }}
                      className="text-[11px] bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-lg"
                    >
                      إعادة ضبط الفلاتر ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={couponSearch}
                      onChange={(e) => setCouponSearch(e.target.value)}
                      placeholder="ابحث بكود الخصم أو الوصف..."
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <select
                    value={couponStatusFilter}
                    onChange={(e) =>
                      setCouponStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">الحالة: جميع الكوبونات</option>
                    <option value="active">الكوبونات الفعالة فقط ✓</option>
                    <option value="inactive">الكوبونات المتوقفة</option>
                  </select>

                  <select
                    value={couponTypeFilter}
                    onChange={(e) =>
                      setCouponTypeFilter(e.target.value as 'all' | 'percentage' | 'fixed')
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">النوع: كل أنواع الخصم</option>
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-brand-200">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                        <th className="p-2.5 whitespace-nowrap">كود الخصم</th>
                        <th className="p-2.5 whitespace-nowrap">نوع الخصم</th>
                        <th className="p-2.5 whitespace-nowrap">قيمة الخصم</th>
                        <th className="p-2.5 whitespace-nowrap">الحد الأدنى</th>
                        <th className="p-2.5">الوصف الترويجي</th>
                        <th className="p-2.5 whitespace-nowrap text-center">الحالة</th>
                        <th className="p-2.5 whitespace-nowrap text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {filteredCoupons.map((c) => (
                        <tr key={c.id} className="hover:bg-brand-50/70 transition">
                          <td className="p-2.5 whitespace-nowrap">
                            <span className="font-mono font-black text-xs text-brand-950 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                              {c.code}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-[11px] font-bold text-brand-700">
                            {c.discountType === 'percentage' ? 'نسبة مئوية (%)' : 'مبلغ ثابت (ج.م)'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-black text-pistachio-700">
                            {c.discountType === 'percentage' ? `${c.value}%` : `${c.value} ج.م`}
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-bold text-brand-900">
                            {c.minOrderAmount} ج.م
                          </td>
                          <td className="p-2.5 text-[11px] text-brand-600">{c.description}</td>
                          <td className="p-2.5 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = coupons.map((item) =>
                                  item.id === c.id ? { ...item, active: !item.active } : item
                                );
                                updateStorePayload(
                                  { coupons: updated },
                                  'تم تحديث حالة تفعيل الكوبون'
                                );
                              }}
                              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                                c.active
                                  ? 'bg-pistachio-100 text-pistachio-700 border-pistachio-300'
                                  : 'bg-brand-100 text-brand-500 border-brand-200'
                              }`}
                            >
                              {c.active ? 'فعال ✓' : 'متوقف'}
                            </button>
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingCoupon(c)}
                                className="p-1.5 bg-amber-100 hover:bg-amber-200 text-brand-950 rounded-lg"
                                title="تعديل"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = coupons.filter((item) => item.id !== c.id);
                                  updateStorePayload({ coupons: updated }, 'تم حذف الكوبون');
                                }}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 8: CUSTOMER REVIEWS DATA TABLE WITH FILTERS                */}
          {/* ================================================================= */}
          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Add Review Form */}
              <form
                onSubmit={handleAddAdminReview}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 h-fit shadow-2xs"
              >
                <h3 className="text-sm font-black text-brand-950">+ إضافة تقييم عميل موثق</h3>
                <div>
                  <label className="block text-[11px] font-bold mb-1">المنتج *</label>
                  <select
                    value={newReviewProdId || products[0]?.id || ''}
                    onChange={(e) => setNewReviewProdId(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      value={newReviewCustomer}
                      onChange={(e) => setNewReviewCustomer(e.target.value)}
                      placeholder="أحمد محمود"
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">التقييم (1 - 5)</label>
                    <select
                      value={newReviewRating}
                      onChange={(e) => setNewReviewRating(Number(e.target.value))}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value={5}>5 نجوم ⭐⭐⭐⭐⭐</option>
                      <option value={4}>4 نجوم ⭐⭐⭐⭐</option>
                      <option value={3}>3 نجوم ⭐⭐⭐</option>
                      <option value={2}>نجمتان ⭐⭐</option>
                      <option value={1}>نجمة واحدة ⭐</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">نص التعليق *</label>
                  <textarea
                    rows={2}
                    required
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="اكتب رأي العميل..."
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-900 hover:bg-brand-950 text-white font-extrabold py-2 rounded-xl text-xs"
                >
                  إضافة ونشر التقييم
                </button>
              </form>

              {/* Reviews Filter Bar & Data Table */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 h-fit shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-brand-800" />
                    <h3 className="text-sm font-black text-brand-950">
                      جدول تقييمات وآراء العملاء ({allReviewsFlattened.length})
                    </h3>
                  </div>

                  {(reviewSearch ||
                    reviewProductFilter !== 'all' ||
                    reviewRatingFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewSearch('');
                        setReviewProductFilter('all');
                        setReviewRatingFilter('all');
                      }}
                      className="text-[11px] bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-lg"
                    >
                      إعادة ضبط الفلاتر ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="ابحث باسم العميل أو نص التعليق..."
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <select
                    value={reviewProductFilter}
                    onChange={(e) => setReviewProductFilter(e.target.value)}
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">جميع المنتجات</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={reviewRatingFilter}
                    onChange={(e) =>
                      setReviewRatingFilter(
                        e.target.value as 'all' | '5' | '4' | '3_or_less'
                      )
                    }
                    className="bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">كل التقييمات (1 - 5 نجوم)</option>
                    <option value="5">5 نجوم فقط ⭐⭐⭐⭐⭐</option>
                    <option value="4">4 نجوم فقط ⭐⭐⭐⭐</option>
                    <option value="3_or_less">3 نجوم فأقل</option>
                  </select>
                </div>

                {allReviewsFlattened.length === 0 ? (
                  <p className="text-xs text-brand-600 py-6 text-center">
                    لا توجد تقييمات مطابقة للفلاتر المحددة حالياً.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-brand-200">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                          <th className="p-2.5 whitespace-nowrap">اسم العميل</th>
                          <th className="p-2.5 whitespace-nowrap">المنتج</th>
                          <th className="p-2.5 whitespace-nowrap">التقييم</th>
                          <th className="p-2.5">نص التعليق</th>
                          <th className="p-2.5 whitespace-nowrap">التاريخ</th>
                          <th className="p-2.5 whitespace-nowrap text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-100">
                        {allReviewsFlattened.map(({ product, review }) => (
                          <tr
                            key={`${product.id}-${review.id}`}
                            className="hover:bg-brand-50/70 transition"
                          >
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="font-extrabold text-brand-950">
                                {review.customerName}
                              </div>
                              {review.verified && (
                                <span className="text-[9px] text-pistachio-700 font-bold">
                                  ✓ مشتري موثق
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="text-[10px] bg-brand-100 text-brand-900 px-2 py-0.5 rounded font-bold">
                                {product.name}
                              </span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="text-gold-500 font-black">
                                {'★'.repeat(review.rating)}
                              </span>
                              <span className="text-[10px] text-brand-500 mr-1">
                                ({review.rating}/5)
                              </span>
                            </td>
                            <td className="p-2.5 text-[11px] text-brand-800 max-w-xs">
                              {review.comment}
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-[10px] text-brand-500">
                              {review.date}
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteReview(product.id, review.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg inline-flex"
                                title="حذف التقييم"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 9: STORE SETTINGS, SECURITY & BACKUP                       */}
          {/* ================================================================= */}
          {activeTab === 'permissions' && isFullAdmin && (
            <RolePermissionsManager
              rolePermissions={getResolvedRolePermissions(settings)}
              isSaving={saving}
              onSaveRolePermissions={async (updated) => {
                await updateStorePayload(
                  {
                    settings: {
                      ...settings,
                      rolePermissions: updated,
                    },
                  },
                  'تم حفظ وتطبيق صلاحيات المستخدمين (المورد، المحاسب، الكاشير) بنجاح ✅'
                );
              }}
            />
          )}

          {activeTab === 'settings' && canAccessTab('settings') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Core Identity, Role Passwords & Payment Settings Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const updatedSettings = {
                    ...settings,
                    storeName: String(formData.get('storeName') || settings.storeName),
                    tagline: String(formData.get('tagline') || settings.tagline),
                    announcementText: String(
                      formData.get('announcementText') || settings.announcementText
                    ),
                    whatsappNumber: String(
                      formData.get('whatsappNumber') || settings.whatsappNumber
                    ),
                    supportPhone: String(formData.get('supportPhone') || settings.supportPhone),
                    freeShippingThreshold: Number(
                      formData.get('freeShippingThreshold') || settings.freeShippingThreshold
                    ),
                    instapayAddress: String(
                      formData.get('instapayAddress') || settings.instapayAddress
                    ),
                    vodafoneCashNumber: String(
                      formData.get('vodafoneCashNumber') || settings.vodafoneCashNumber
                    ),
                    address: String(formData.get('address') || settings.address),
                    workingHours: String(formData.get('workingHours') || settings.workingHours),
                    pageContent: cmsDraft,
                    themeConfig: themeDraft,
                    ...(newAdminUsername.trim()
                      ? { adminUsername: newAdminUsername.trim() }
                      : {}),
                    ...(newAdminPassword.trim()
                      ? { adminPassword: newAdminPassword.trim() }
                      : {}),
                    ...(newSupplierUsername.trim()
                      ? { supplierUsername: newSupplierUsername.trim() }
                      : {}),
                    ...(newSupplierPassword.trim()
                      ? { supplierPassword: newSupplierPassword.trim() }
                      : {}),
                    ...(newCashierUsername.trim()
                      ? { cashierUsername: newCashierUsername.trim() }
                      : {}),
                    ...(newCashierPassword.trim()
                      ? { cashierPassword: newCashierPassword.trim() }
                      : {}),
                    ...(newAccountantUsername.trim()
                      ? { accountantUsername: newAccountantUsername.trim() }
                      : {}),
                    ...(newAccountantPassword.trim()
                      ? { accountantPassword: newAccountantPassword.trim() }
                      : {}),
                  };
                  updateStorePayload(
                    { settings: updatedSettings },
                    'تم حفظ إعدادات المتجر وأسماء المستخدمين وكلمات المرور للأدوار الـ 4 بنجاح ✅'
                  );
                  setNewAdminPassword('');
                  setNewSupplierPassword('');
                  setNewCashierPassword('');
                  setNewAccountantPassword('');
                }}
                className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-brand-200 shadow-2xs space-y-4"
              >
                <h3 className="text-sm sm:text-base font-extrabold text-brand-950 border-b border-brand-100 pb-2.5">
                  إعدادات الهوية، أرقام التواصل، ووسائل الدفع
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">اسم المتجر / المحمصة</label>
                    <input
                      name="storeName"
                      defaultValue={settings.storeName}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      حد الشحن المجاني التلقائي (ج.م)
                    </label>
                    <input
                      name="freeShippingThreshold"
                      type="number"
                      defaultValue={settings.freeShippingThreshold}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">
                    الشعار اللفظي (Tagline)
                  </label>
                  <input
                    name="tagline"
                    defaultValue={settings.tagline}
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">
                    نص شريط العروض العلوي (Announcement Bar)
                  </label>
                  <input
                    name="announcementText"
                    defaultValue={settings.announcementText}
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      رقم واتساب لاستقبال الطلبات (بكود الدولة 20)
                    </label>
                    <input
                      name="whatsappNumber"
                      defaultValue={settings.whatsappNumber}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">رقم هاتف خدمة العملاء</label>
                    <input
                      name="supportPhone"
                      defaultValue={settings.supportPhone}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">عنوان الدفع عبر InstaPay</label>
                    <input
                      name="instapayAddress"
                      defaultValue={settings.instapayAddress}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">رقم محفظة فودافون كاش</label>
                    <input
                      name="vodafoneCashNumber"
                      defaultValue={settings.vodafoneCashNumber}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">عنوان الفرع الرئيسي</label>
                    <input
                      name="address"
                      defaultValue={settings.address}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">مواعيد العمل</label>
                    <input
                      name="workingHours"
                      defaultValue={settings.workingHours}
                      className="w-full bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                {/* 4-Role Isolation & Independent Usernames + Passwords Section */}
                <div className="pt-4 border-t border-brand-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-brand-950 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-gold-500" />
                        <span>إدارة حسابات وصلاحيات المستخدمين الـ 4 (الأدمن، المورد، المحاسب، الكاشير)</span>
                        {isFullAdmin && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('permissions')}
                            className="mr-2 px-3 py-1 rounded-lg bg-gold-500 hover:bg-gold-400 text-brand-950 text-[11px] font-black transition cursor-pointer"
                          >
                            ⚙️ منح أو حذف صلاحيات المستخدمين
                          </button>
                        )}
                      </h4>
                      <p className="text-[10.5px] text-brand-600 mt-0.5">
                        لكل دور وظيفي اسم مستخدم (Username) وكلمة مرور (Password) مختلفان تماماً. اترك حقل كلمة المرور فارغاً للإبقاء على كلمة المرور الحالية.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="text-[11px] font-bold text-brand-700 hover:text-brand-950 flex items-center gap-1 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200"
                    >
                      {showPasswordText ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>إخفاء كلمات المرور</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>إظهار كلمات المرور</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Role 1: Super Admin */}
                    <div className="p-3 rounded-xl bg-brand-50/70 border border-brand-200 space-y-2">
                      <label className="block text-[11px] font-extrabold text-brand-950">
                        1. 👑 الأدمن (المدير العام)
                      </label>
                      <div>
                        <span className="block text-[10px] font-bold text-brand-600 mb-0.5">
                          اسم المستخدم (Username):
                        </span>
                        <input
                          type="text"
                          value={newAdminUsername}
                          onChange={(e) => setNewAdminUsername(e.target.value)}
                          placeholder="admin_hafsa"
                          className="w-full bg-white border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-brand-600 mb-0.5">
                          كلمة المرور (الحالية: {settings.adminPassword || 'Hafsa@Admin2026'}):
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للأدمن..."
                          className="w-full bg-white border border-brand-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Role 2: Supplier */}
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                      <label className="block text-[11px] font-extrabold text-amber-950">
                        2. 📦 المورد (بوابة التوريد والمخزون)
                      </label>
                      <div>
                        <span className="block text-[10px] font-bold text-amber-800 mb-0.5">
                          اسم المستخدم (Username):
                        </span>
                        <input
                          type="text"
                          value={newSupplierUsername}
                          onChange={(e) => setNewSupplierUsername(e.target.value)}
                          placeholder="supplier_arafat"
                          className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-amber-800 mb-0.5">
                          كلمة المرور (الحالية: {settings.supplierPassword || 'Sup#Arafat2026'}):
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newSupplierPassword}
                          onChange={(e) => setNewSupplierPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للمورد..."
                          className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Role 3: Cashier */}
                    <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 space-y-2">
                      <label className="block text-[11px] font-extrabold text-sky-950">
                        3. ⚖️ الكاشير (شاشة البيع والميزان POS)
                      </label>
                      <div>
                        <span className="block text-[10px] font-bold text-sky-800 mb-0.5">
                          اسم المستخدم (Username):
                        </span>
                        <input
                          type="text"
                          value={newCashierUsername}
                          onChange={(e) => setNewCashierUsername(e.target.value)}
                          placeholder="cashier_pos"
                          className="w-full bg-white border border-sky-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-sky-800 mb-0.5">
                          كلمة المرور (الحالية: {settings.cashierPassword || 'Cash#Pos2026'}):
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newCashierPassword}
                          onChange={(e) => setNewCashierPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للكاشير..."
                          className="w-full bg-white border border-sky-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Role 4: Accountant */}
                    <div className="p-3 rounded-xl bg-pistachio-50/60 border border-pistachio-200 space-y-2">
                      <label className="block text-[11px] font-extrabold text-pistachio-900">
                        4. 📊 المحاسب (المراجعة المالية والجرد)
                      </label>
                      <div>
                        <span className="block text-[10px] font-bold text-pistachio-800 mb-0.5">
                          اسم المستخدم (Username):
                        </span>
                        <input
                          type="text"
                          value={newAccountantUsername}
                          onChange={(e) => setNewAccountantUsername(e.target.value)}
                          placeholder="accountant_fin"
                          className="w-full bg-white border border-pistachio-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-pistachio-800 mb-0.5">
                          كلمة المرور (الحالية: {settings.accountantPassword || 'Acc#Fin2026'}):
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newAccountantPassword}
                          onChange={(e) => setNewAccountantPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للمحاسب..."
                          className="w-full bg-white border border-pistachio-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-brand-900 hover:bg-brand-950 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4 text-gold-400" />
                  <span>حفظ جميع الإعدادات وأسماء المستخدمين وكلمات المرور</span>
                </button>
              </form>

              {/* Backup & Restore Card */}
              <div className="space-y-4">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 shadow-2xs">
                  <h3 className="text-sm font-black text-brand-950">
                    النسخ الاحتياطي واستعادة النظام
                  </h3>
                  <p className="text-[11px] text-brand-600 leading-relaxed">
                    يمكنك تحميل نسخة احتياطية كاملة (تشمل كافة المنتجات، الأقسام، الطلبات، وإعدادات الصفحات) بصيغة JSON أو استعادتها في أي وقت.
                  </p>

                  <button
                    type="button"
                    onClick={handleExportBackupJson}
                    className="w-full bg-brand-900 hover:bg-brand-950 text-white text-xs font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4 text-gold-400" />
                    <span>تحميل نسخة احتياطية كاملة (JSON)</span>
                  </button>

                  <label className="w-full bg-brand-50 hover:bg-brand-100 border border-brand-300 text-brand-950 text-xs font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
                    <Upload className="w-4 h-4 text-brand-700" />
                    <span>استيراد واستعادة نسخة احتياطية</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportBackupJson}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* SUPERMARKET 80MM THERMAL RECEIPT MODAL */}
      {selectedInvoiceOrder && (
        <SupermarketReceiptModal
          order={selectedInvoiceOrder}
          mode="receipt"
          settings={settings}
          onClose={() => {
            setSelectedInvoiceOrder(null);
            updateUrlQueryParams({ invoice: null });
          }}
        />
      )}
    </div>
  );
}
