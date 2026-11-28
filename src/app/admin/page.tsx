'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ShieldCheck,
  Clock,
  Check,
  Filter,
  ClipboardList,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle,
  Scale,
  Barcode,
  Volume2,
  VolumeX,
  Send,
  MoreHorizontal,
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import SlideOverDrawer from '@/components/ui/SlideOverDrawer';
import ExportMenu from '@/components/ui/ExportMenu';
import FilterToolbar from '@/components/ui/FilterToolbar';
import DataTableShell from '@/components/ui/DataTableShell';
import { downloadScalePluCsv } from '@/lib/scale-plu';
import {
  getGovernorateShippingRates,
  inferFulfillmentHubFromGovernorate,
} from '@/lib/egypt-shipping';
import {
  DateRangePreset,
  FinancialDateRangeFilter,
  filterItemsByDateRange,
  calculateFinancialSummary,
  calculateOrderCogs,
  isOnlineOrder,
  isPosOrder,
  generateFinancialSummaryCsv,
  triggerCsvDownload,
} from '@/lib/financials';
import { useStore, STORE_SYNC_STORAGE_KEY } from '@/context/StoreContext';
import { playOrderAlertChime, isAudioMuted, toggleAudioMuted } from '@/lib/audio-chime';
import ImageUploadDropzone from '@/components/admin/ImageUploadDropzone';
import RapidBarcodeCatalogModal from '@/modules/catalog/RapidBarcodeCatalogModal';
import ProductGalleryEditor from '@/modules/catalog/ProductGalleryEditor';
import ProductAdStudioEditor from '@/modules/catalog/ProductAdStudioEditor';
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
  StoreFeatureFlags,
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
import { isUnitProduct, getProductStockUnitLabel } from '@/lib/pricing';
import {
  getResolvedPageContent,
  getResolvedThemeConfig,
  getResolvedFeatureFlags,
  getCurrencySymbol,
  getOrderPrefix,
  getCityName,
  getResolvedBandarZones,
  getResolvedVillageZones,
  getResolvedDeliveryBatches,
  getSafeImageUrl,
  STORE_THEMES,
  DEFAULT_THEME_CONFIG,
  formatCategoryName,
  stripUiEmojis,
} from '@/lib/defaults';
import HafsaOperationsStudio from '@/components/admin/HafsaOperationsStudio';
import PreLaunchResetSafeguard from '@/components/admin/PreLaunchResetSafeguard';
import InventoryAdjustmentModal from '@/components/admin/InventoryAdjustmentModal';
import AuditLogsViewer from '@/components/admin/AuditLogsViewer';
import SupplierIsolationPortal from '@/components/admin/SupplierIsolationPortal';
import AccountantIsolationPortal from '@/components/admin/AccountantIsolationPortal';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';
import AccountsAndPermissionsWorkspace from '@/components/admin/AccountsAndPermissionsWorkspace';
import ReceiptSettingsStudio from '@/components/admin/ReceiptSettingsStudio';
import SupplyInvoicesApprovalModule from '@/components/admin/SupplyInvoicesApprovalModule';
import dynamic from 'next/dynamic';
import {
  getResolvedCustomRoles,
  getResolvedRolePermissions,
  hasRolePermission,
} from '@/lib/permissions';
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
      const maxDim = 560;
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
        const webpDataUrl = canvas.toDataURL('image/webp', 0.78);
        if (webpDataUrl.startsWith('data:image/webp')) {
          onDone(webpDataUrl);
        } else {
          onDone(canvas.toDataURL('image/jpeg', 0.78));
        }
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
  if (role === 'accountant') return 'overview';
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
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  confirmed: {
    label: 'تم التأكيد',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  roasting_packing: {
    label: 'جاري التحميص والتغليف',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
  },
  preparing: {
    label: 'جاري التحميص والتجهيز',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
  },
  shipped: {
    label: 'خرج مع المندوب',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  delivered: {
    label: 'تم التسليم',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-600',
  },
  cancelled: {
    label: 'ملغي',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
  },
};

const DEFAULT_STATUS_META = {
  label: 'قيد المراجعة',
  badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  dotClass: 'bg-amber-500',
};

const getOrderStatusMeta = (status?: string) => {
  if (!status) return DEFAULT_STATUS_META;
  return STATUS_LABELS[status] || DEFAULT_STATUS_META;
};

export default function AdminDashboardPage() {
  const { storeData, refreshStore, showToast, setThemeOverride } = useStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [settingsSubTab, setSettingsSubTab] = useState<
    'branch' | 'receipt' | 'blueprint' | 'payment' | 'security' | 'telegram' | 'backup'
  >('branch');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [posFocusMode, setPosFocusMode] = useState(false);
  const [moreNavOpen, setMoreNavOpen] = useState(false);

  // Sync POS Focus Mode (Full-Screen Cashier toggle from embedded HafsaPosCashierPage)
  useEffect(() => {
    const onPosFocusEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ focus?: boolean }>).detail;
      setPosFocusMode(Boolean(detail?.focus));
    };
    window.addEventListener('hafsa:admin-pos-focus', onPosFocusEvent);
    return () => window.removeEventListener('hafsa:admin-pos-focus', onPosFocusEvent);
  }, []);

  useEffect(() => {
    if (activeTab !== 'cashier_portal' && posFocusMode) {
      setPosFocusMode(false);
    }
  }, [activeTab, posFocusMode]);
  const moreNavRef = useRef<HTMLDivElement | null>(null);
  const [overviewDetailsOpen, setOverviewDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptPreviewOrder, setReceiptPreviewOrder] = useState<Order | null>(null);

  // Authentication & Role Isolation State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [adminToken, setAdminToken] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<AdminRole>('super_admin');
  const [currentCustomRoleId, setCurrentCustomRoleId] = useState<string>('');
  const [currentCustomRoleName, setCurrentCustomRoleName] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loginSubmitting, setLoginSubmitting] = useState<boolean>(false);

  // Invoice Modal State
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [isInventoryAdjustmentModalOpen, setIsInventoryAdjustmentModalOpen] = useState<boolean>(false);

  // Supply Invoices Approval & Management State
  const [supplyInvoices, setSupplyInvoices] = useState<SupplyInvoice[]>([]);
  const [loadingSupplyInvoices, setLoadingSupplyInvoices] = useState<boolean>(false);
  const [invoiceReviewNotes, setInvoiceReviewNotes] = useState<Record<string, string>>({});
  const [actionLoadingInvoiceId, setActionLoadingInvoiceId] = useState<string | null>(null);
  const [supplyInvoiceFilter, setSupplyInvoiceFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [expandedAdminInvoiceId, setExpandedAdminInvoiceId] = useState<string | null>(null);

  // Overview & Financial Date Range Filter State
  const [overviewDatePreset, setOverviewDatePreset] = useState<DateRangePreset>('all');
  const [overviewCustomStart, setOverviewCustomStart] = useState<string>('');
  const [overviewCustomEnd, setOverviewCustomEnd] = useState<string>('');

  // Orders Filter, Sort, Pagination & Detail Drawer State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [orderChannelFilter, setOrderChannelFilter] = useState<'all' | 'online' | 'pos'>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [orderGovernorateFilter, setOrderGovernorateFilter] = useState<string>('all');
  const [orderSort, setOrderSort] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [ordersPage, setOrdersPage] = useState<number>(1);
  const [selectedOrderDetailId, setSelectedOrderDetailId] = useState<string | null>(null);
  const [editingOrderNotesId, setEditingOrderNotesId] = useState<string | null>(null);
  const [orderNotesDraft, setOrderNotesDraft] = useState<string>('');

  // Products Filter, Sort, Pagination, Bulk Selection & Form State
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [productChannelFilter, setProductChannelFilter] = useState<
    'all' | 'online' | 'pos' | 'hidden'
  >('all');
  const [productFeaturedFilter, setProductFeaturedFilter] = useState<'all' | 'featured' | 'regular'>('all');
  const [productRoastFilter, setProductRoastFilter] = useState<string>('all');
  const [productSort, setProductSort] = useState<'default' | 'price_asc' | 'price_desc' | 'rating_desc'>('default');
  const [productsPage, setProductsPage] = useState<number>(1);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isRapidBarcodeModalOpen, setIsRapidBarcodeModalOpen] = useState(false);

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
  const [couponStatusFilter, setCouponStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [couponTypeFilter, setCouponTypeFilter] = useState<'all' | 'percentage' | 'fixed'>('all');
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCouponVal, setNewCouponVal] = useState(10);
  const [newCouponMin, setNewCouponMin] = useState(300);
  const [newCouponDesc, setNewCouponDesc] = useState('');
  const [newCouponExpiresAt, setNewCouponExpiresAt] = useState('');
  const [newCouponMaxUses, setNewCouponMaxUses] = useState('');

  // Reviews Filter & Form State
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewProductFilter, setReviewProductFilter] = useState<string>('all');
  const [reviewRatingFilter, setReviewRatingFilter] = useState<'all' | '5' | '4' | '3_or_less'>('all');
  const [newReviewProdId, setNewReviewProdId] = useState<string>('');
  const [newReviewCustomer, setNewReviewCustomer] = useState<string>('');
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState<string>('');

  // CMS, Theme & White-Label Blueprint Draft State
  const [cmsDraft, setCmsDraft] = useState<StorePageContent>(() =>
    getResolvedPageContent(storeData?.settings)
  );
  const [themeDraft, setThemeDraft] = useState<StoreThemeConfig>(() =>
    getResolvedThemeConfig(storeData?.settings)
  );
  const [featureFlagsDraft, setFeatureFlagsDraft] = useState<StoreFeatureFlags>(() =>
    getResolvedFeatureFlags(storeData?.settings)
  );
  const [currencySymbolDraft, setCurrencySymbolDraft] = useState<string>(() =>
    getCurrencySymbol(storeData?.settings)
  );
  const [orderPrefixDraft, setOrderPrefixDraft] = useState<string>(() =>
    getOrderPrefix(storeData?.settings)
  );
  const [cityNameDraft, setCityNameDraft] = useState<string>(() =>
    getCityName(storeData?.settings)
  );
  const [bandarShippingCostDraft, setBandarShippingCostDraft] = useState<number>(
    storeData?.settings?.bandarShippingCost ?? 15
  );
  const [villagesShippingCostDraft, setVillagesShippingCostDraft] = useState<number>(
    storeData?.settings?.villagesShippingCost ?? 25
  );
  const [minOrderVillagesDraft, setMinOrderVillagesDraft] = useState<number>(
    storeData?.settings?.minOrderVillages ?? storeData?.settings?.villageMinOrderAmount ?? 200
  );
  const [bandarZonesText, setBandarZonesText] = useState<string>(() =>
    getResolvedBandarZones(storeData?.settings).join('\n')
  );
  const [villageZonesText, setVillageZonesText] = useState<string>(() =>
    getResolvedVillageZones(storeData?.settings).join('\n')
  );
  const [deliveryBatchesText, setDeliveryBatchesText] = useState<string>(() =>
    getResolvedDeliveryBatches(storeData?.settings).join('\n')
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
  const lastSyncedSettingsSigRef = useRef<string>('');

  // Sync CMS, Theme & Blueprint drafts ONLY when storeData.settings content actually changes
  // (prevents background 20s polling from wiping unsaved settings/theme/receipt edits)
  useEffect(() => {
    if (!storeData?.settings) return;
    const nextSig = JSON.stringify(storeData.settings);
    if (nextSig === lastSyncedSettingsSigRef.current) return;
    lastSyncedSettingsSigRef.current = nextSig;

    setCmsDraft(getResolvedPageContent(storeData.settings));
    setThemeDraft(getResolvedThemeConfig(storeData.settings));
    setFeatureFlagsDraft(getResolvedFeatureFlags(storeData.settings));
    setCurrencySymbolDraft(getCurrencySymbol(storeData.settings));
    setOrderPrefixDraft(getOrderPrefix(storeData.settings));
    setCityNameDraft(getCityName(storeData.settings));
    setBandarShippingCostDraft(storeData.settings.bandarShippingCost ?? 15);
    setVillagesShippingCostDraft(storeData.settings.villagesShippingCost ?? 25);
    setMinOrderVillagesDraft(
      storeData.settings.minOrderVillages ?? storeData.settings.villageMinOrderAmount ?? 200
    );
    setBandarZonesText(getResolvedBandarZones(storeData.settings).join('\n'));
    setVillageZonesText(getResolvedVillageZones(storeData.settings).join('\n'));
    setDeliveryBatchesText(
      getResolvedDeliveryBatches(storeData.settings).join('\n')
    );
    setAnnouncementDraft(storeData.settings.announcementText || '');
    setNewAdminUsername(storeData.settings.adminUsername || '');
    setNewSupplierUsername(storeData.settings.supplierUsername || '');
    setNewCashierUsername(storeData.settings.cashierUsername || '');
    setNewAccountantUsername(storeData.settings.accountantUsername || '');
  }, [storeData?.settings]);

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
            const resolvedCustomRoleId = typeof data.customRoleId === 'string' ? data.customRoleId : '';
            const resolvedCustomRoleName = typeof data.customRoleName === 'string' ? data.customRoleName : '';
            if (!resolvedCustomRoleId && resolvedRole === 'supplier') {
              window.location.replace('/supplier');
              return;
            }
            if (!resolvedCustomRoleId && resolvedRole === 'cashier') {
              window.location.replace('/pos');
              return;
            }
            if (!resolvedCustomRoleId && resolvedRole === 'delivery_rider') {
              window.location.replace('/rider');
              return;
            }
            setCurrentRole(resolvedRole);
            setCurrentCustomRoleId(resolvedCustomRoleId);
            setCurrentCustomRoleName(resolvedCustomRoleName);
            if (data.username) setCurrentUsername(data.username);
            const serverPerms: AdminPermissionId[] = Array.isArray(data.permissions)
              ? data.permissions
              : [];
            const requestedUrlTab = getRequestedTabFromUrl();
            const isRequestedAllowed =
              requestedUrlTab &&
              ((!resolvedCustomRoleId && (resolvedRole === 'super_admin' || resolvedRole === 'admin')) ||
                (requestedUrlTab !== 'permissions' &&
                  (serverPerms.includes(requestedUrlTab as AdminPermissionId) ||
                    hasRolePermission(
                      resolvedRole,
                      requestedUrlTab as AdminPermissionId,
                      storeData?.settings,
                      resolvedCustomRoleId || undefined
                    ))));
            const fallbackDefaultTab: AdminTab = resolvedCustomRoleId
              ? ((serverPerms[0] as AdminTab) || getDefaultTabForRole(resolvedRole))
              : getDefaultTabForRole(resolvedRole);
            const initialTab = isRequestedAllowed
              ? requestedUrlTab
              : !resolvedCustomRoleId &&
                  resolvedRole === 'accountant' &&
                  !hasRolePermission('accountant', fallbackDefaultTab as AdminPermissionId, storeData?.settings)
                ? 'accounting_portal'
                : fallbackDefaultTab;
            setActiveTab(initialTab);
            updateUrlQueryParams({ tab: initialTab }, { replace: true });
            setIsAuthenticated(true);
            if (activeToken) {
              setAdminToken(activeToken);
            }
            setAuthLoading(false);
            void refreshStore();
            void fetchSupplyInvoices(activeToken);
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
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoginSubmitting(true);
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

          const resolvedCustomRoleId = typeof data.customRoleId === 'string' ? data.customRoleId : '';
          const resolvedCustomRoleName = typeof data.customRoleName === 'string' ? data.customRoleName : '';

          if (!resolvedCustomRoleId && resolvedRole === 'supplier') {
            window.location.href = '/supplier';
            return;
          }
          if (!resolvedCustomRoleId && resolvedRole === 'cashier') {
            window.location.href = '/pos';
            return;
          }
          if (resolvedRole === 'delivery_rider') {
            setLoginError('عزل الأدوار: حساب مندوب التوصيل غير مصرح له بالدخول إلى لوحة الإدارة');
            return;
          }

          setAdminToken(data.token);
          setCurrentRole(resolvedRole);
          setCurrentCustomRoleId(resolvedCustomRoleId);
          setCurrentCustomRoleName(resolvedCustomRoleName);
          if (data.username) setCurrentUsername(data.username);
          const serverPerms: AdminPermissionId[] = Array.isArray(data.permissions)
            ? data.permissions
            : [];
          const requestedUrlTab = getRequestedTabFromUrl();
          const isRequestedAllowed =
            requestedUrlTab &&
            ((!resolvedCustomRoleId && (resolvedRole === 'super_admin' || resolvedRole === 'admin')) ||
              (requestedUrlTab !== 'permissions' &&
                (serverPerms.includes(requestedUrlTab as AdminPermissionId) ||
                  hasRolePermission(
                    resolvedRole,
                    requestedUrlTab as AdminPermissionId,
                    storeData?.settings,
                    resolvedCustomRoleId || undefined
                  ))));
          const fallbackDefaultTab: AdminTab = resolvedCustomRoleId
            ? ((serverPerms[0] as AdminTab) || getDefaultTabForRole(resolvedRole))
            : getDefaultTabForRole(resolvedRole);
          const initialTab = isRequestedAllowed
            ? requestedUrlTab
            : !resolvedCustomRoleId &&
                resolvedRole === 'accountant' &&
                !hasRolePermission('accountant', fallbackDefaultTab as AdminPermissionId, storeData?.settings)
              ? 'accounting_portal'
              : fallbackDefaultTab;
          setActiveTab(initialTab);
          updateUrlQueryParams({ tab: initialTab }, { replace: true });
          setIsAuthenticated(true);
          setLoginPassword('');
          void refreshStore();
          void fetchSupplyInvoices(data.token);
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
            ? 'تم اعتماد فاتورة التوريد وإضافة الكميات للمخزون وتحديث التكلفة بنجاح'
            : 'تم رفض فاتورة التوريد دون تعديل المخزون'
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

  // Package 5: Audio Chimes & Telegram Bot State
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(Boolean(settings?.telegramNotificationsEnabled));
  const [telegramNotifyOrders, setTelegramNotifyOrders] = useState(settings?.telegramNotifyNewOrders !== false);
  const [telegramNotifySupply, setTelegramNotifySupply] = useState(settings?.telegramNotifySupplyInvoices !== false);
  const [telegramNotifyZReport, setTelegramNotifyZReport] = useState(settings?.telegramNotifyZReport !== false);
  const [telegramNotifyLowStock, setTelegramNotifyLowStock] = useState(settings?.telegramNotifyLowStock !== false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramTestFeedback, setTelegramTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [settlingCodOrderId, setSettlingCodOrderId] = useState<string | null>(null);

  const prevAdminOrdersCountRef = useRef<number>(0);
  const isInitialAdminOrdersRef = useRef<boolean>(true);

  useEffect(() => {
    setIsSoundMuted(isAudioMuted());
  }, []);

  // Sync telegram state when settings load
  useEffect(() => {
    if (settings) {
      setTelegramEnabled(Boolean(settings.telegramNotificationsEnabled));
      setTelegramNotifyOrders(settings.telegramNotifyNewOrders !== false);
      setTelegramNotifySupply(settings.telegramNotifySupplyInvoices !== false);
      setTelegramNotifyZReport(settings.telegramNotifyZReport !== false);
      setTelegramNotifyLowStock(settings.telegramNotifyLowStock !== false);
    }
  }, [settings?.telegramNotificationsEnabled, settings?.telegramNotifyNewOrders, settings?.telegramNotifySupplyInvoices, settings?.telegramNotifyZReport, settings?.telegramNotifyLowStock]);

  const handleAdminSettleRiderCod = async (orderId: string) => {
    try {
      setSettlingCodOrderId(orderId);
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          action: 'settle_rider_cod',
          orderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || 'تعذر توريد عهدة المندوب بالدرج (تأكد من وجود وردية مفتوحة)', 'error');
        return;
      }
      await refreshStore();
      showToast(`تم استلام وتوريد عهدة المندوب (${data.settledAmount} ج.م) في درج الوردية المفتوحة بنجاح`);
    } catch {
      showToast('حدث خطأ في الاتصال أثناء توريد عهدة المندوب', 'error');
    } finally {
      setSettlingCodOrderId(null);
    }
  };

  // Audio chime on new incoming unfulfilled orders in Admin
  useEffect(() => {
    if (!isAuthenticated) return;
    const unfulfilled = orders.filter((o) => o.status === 'pending' || o.status === 'confirmed');
    if (!isInitialAdminOrdersRef.current && unfulfilled.length > prevAdminOrdersCountRef.current) {
      playOrderAlertChime();
      showToast('طلب أونلاين جديد بالمتجر', `يوجد ${unfulfilled.length} طلبات قيد الانتظار والتجهيز`);
    }
    isInitialAdminOrdersRef.current = false;
    prevAdminOrdersCountRef.current = unfulfilled.length;
  }, [orders, isAuthenticated, showToast]);

  // Automated background polling every 20 seconds in Admin (paused when tab is hidden)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refreshStore();
    }, 20000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshStore]);

  // Handle Telegram Test Ping
  const handleTestTelegram = async (botToken: string, chatId: string) => {
    setTelegramTesting(true);
    setTelegramTestFeedback(null);
    try {
      const res = await fetch('/api/admin/telegram-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ token: botToken, chatId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramTestFeedback({ success: true, message: stripUiEmojis(data.message || '') });
      } else {
        setTelegramTestFeedback({
          success: false,
          message: stripUiEmojis(data.error || 'فشل الاتصال بسيرفر تلجرام. تحقق من رمز البوت ومعرف المحادثة'),
        });
      }
    } catch (err: any) {
      setTelegramTestFeedback({ success: false, message: `خطأ في الاتصال: ${err?.message || err}` });
    } finally {
      setTelegramTesting(false);
    }
  };

  const selectTab = useCallback(
    (nextTab: AdminTab, extraParams?: Record<string, string | null>) => {
      setActiveTab(nextTab);
      if (extraParams && 'subtab' in extraParams) {
        setActiveSubTab(extraParams.subtab || 'channels');
      } else {
        setActiveSubTab('channels');
      }
      if (nextTab === 'settings') {
        const sSub = extraParams?.subtab;
        if (
          sSub &&
          ['branch', 'receipt', 'blueprint', 'payment', 'security', 'telegram', 'backup'].includes(
            sSub
          )
        ) {
          setSettingsSubTab(
            sSub as
              | 'branch'
              | 'receipt'
              | 'blueprint'
              | 'payment'
              | 'security'
              | 'telegram'
              | 'backup'
          );
        } else {
          setSettingsSubTab('branch');
        }
      }
      updateUrlQueryParams({
        tab: nextTab,
        subtab: null,
        status: null,
        invoice: null,
        productModal: null,
        invStatus: null,
        posPage: null,
        posSub: null,
        cat: null,
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
          hasRolePermission(
            currentRole,
            resolvedTab as AdminPermissionId,
            settings,
            currentCustomRoleId || undefined
          )))
    ) {
      setActiveTab(resolvedTab);
      if (resolvedTab === 'settings') {
        if (
          subParam &&
          ['branch', 'receipt', 'blueprint', 'payment', 'security', 'telegram', 'backup'].includes(
            subParam
          )
        ) {
          setSettingsSubTab(
            subParam as
              | 'branch'
              | 'receipt'
              | 'blueprint'
              | 'payment'
              | 'security'
              | 'telegram'
              | 'backup'
          );
        } else {
          setSettingsSubTab('branch');
        }
      }
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

  const overviewDateFilter = useMemo<FinancialDateRangeFilter>(
    () => ({
      preset: overviewDatePreset,
      startDate: overviewDatePreset === 'custom' ? overviewCustomStart : undefined,
      endDate: overviewDatePreset === 'custom' ? overviewCustomEnd : undefined,
    }),
    [overviewDatePreset, overviewCustomStart, overviewCustomEnd]
  );

  const dateFilteredOrders = useMemo(
    () => filterItemsByDateRange(orders, overviewDateFilter),
    [orders, overviewDateFilter]
  );

  const overviewFinancialSummary = useMemo(() => {
    return calculateFinancialSummary({
      orders,
      products,
      posShifts: storeData?.posShifts || [],
      posExpenses: storeData?.posExpenses || [],
      supplyInvoices: effectiveSupplyInvoices,
      vipMembers: storeData?.vipMembers || [],
      dateFilter: overviewDateFilter,
    });
  }, [
    orders,
    products,
    storeData?.posShifts,
    storeData?.posExpenses,
    effectiveSupplyInvoices,
    storeData?.vipMembers,
    overviewDateFilter,
  ]);

  const filteredOrders = useMemo(() => {
    const list = dateFilteredOrders.filter((o) => {
      if (orderChannelFilter === 'online' && !isOnlineOrder(o)) return false;
      if (orderChannelFilter === 'pos' && !isPosOrder(o)) return false;
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
  }, [
    dateFilteredOrders,
    orderChannelFilter,
    orderStatusFilter,
    orderPaymentFilter,
    orderGovernorateFilter,
    orderSearch,
    orderSort,
  ]);

  const filteredOrdersFinancials = useMemo(() => {
    const valid = filteredOrders.filter((o) => o.status !== 'cancelled');
    const revenue = Math.round(valid.reduce((s, o) => s + (o.total || 0), 0) * 100) / 100;
    const cogs =
      Math.round(valid.reduce((s, o) => s + calculateOrderCogs(o, products), 0) * 100) / 100;
    const discounts =
      Math.round(valid.reduce((s, o) => s + (o.discountAmount || 0), 0) * 100) / 100;
    const shipping =
      Math.round(valid.reduce((s, o) => s + (o.shippingCost || 0), 0) * 100) / 100;
    const netProfit = Math.round((revenue - cogs) * 100) / 100;
    const marginPercent = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;
    return {
      validCount: valid.length,
      cancelledCount: filteredOrders.length - valid.length,
      onlineCount: valid.filter((o) => isOnlineOrder(o)).length,
      posCount: valid.filter((o) => isPosOrder(o)).length,
      revenue,
      cogs,
      discounts,
      shipping,
      netProfit,
      marginPercent,
    };
  }, [filteredOrders, products]);

  const productsInventoryValuation = useMemo(() => {
    let totalStockKg = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let marginSum = 0;
    let marginCount = 0;

    for (const p of products) {
      const stockKg = typeof p.stockKg === 'number' ? Math.max(0, p.stockKg) : 0;
      const w1000 = p.weights?.find((w) => w.weightGrams === 1000 || w.grams === 1000);
      const retailPerKg =
        typeof p.pricePerKg === 'number' && p.pricePerKg > 0
          ? p.pricePerKg
          : w1000?.price || (p.weights?.[0]?.price ? p.weights[0].price * 4 : 400);
      const costPerKg =
        typeof p.costPerKg === 'number' && p.costPerKg > 0
          ? p.costPerKg
          : Math.round(retailPerKg * 0.68);
      const packCost = typeof p.packagingCost === 'number' ? p.packagingCost : 0;
      const fullCostPerKg = costPerKg + packCost;

      totalStockKg += stockKg;
      totalCostValuation += stockKg * fullCostPerKg;
      totalRetailValuation += stockKg * retailPerKg;

      if (retailPerKg > 0) {
        marginSum += ((retailPerKg - fullCostPerKg) / retailPerKg) * 100;
        marginCount += 1;
      }
    }

    return {
      totalStockKg: Math.round(totalStockKg * 100) / 100,
      totalCostValuation: Math.round(totalCostValuation * 100) / 100,
      totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
      potentialInventoryProfit:
        Math.round((totalRetailValuation - totalCostValuation) * 100) / 100,
      avgMarginPercent: marginCount > 0 ? Math.round((marginSum / marginCount) * 10) / 10 : 0,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      if (productCategoryFilter !== 'all' && p.categoryId !== productCategoryFilter) return false;
      if (productStockFilter === 'in' && !p.inStock) return false;
      if (productStockFilter === 'out' && p.inStock && (p.stockKg ?? 50) > 0) return false;
      if (
        productStockFilter === 'low' &&
        (!p.inStock || (p.stockKg ?? 50) <= 0 || (p.stockKg ?? 50) > 5)
      ) {
        return false;
      }
      if (productFeaturedFilter === 'featured' && !p.featured) return false;
      if (productFeaturedFilter === 'regular' && p.featured) return false;
      if (productChannelFilter === 'online' && p.showOnline === false) return false;
      if (productChannelFilter === 'pos' && p.showInPos === false) return false;
      if (productChannelFilter === 'hidden' && p.showOnline !== false && p.showInPos !== false) return false;
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
    productChannelFilter,
    productFeaturedFilter,
    productRoastFilter,
    productSearch,
    productSort,
  ]);

  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * 25;
    return filteredOrders.slice(start, start + 25);
  }, [filteredOrders, ordersPage]);

  const paginatedProducts = useMemo(() => {
    const start = (productsPage - 1) * 25;
    return filteredProducts.slice(start, start + 25);
  }, [filteredProducts, productsPage]);

  const selectedOrderDetail = useMemo(
    () => (selectedOrderDetailId ? orders.find((o) => o.id === selectedOrderDetailId) || null : null),
    [orders, selectedOrderDetailId]
  );

  useEffect(() => {
    setOrdersPage(1);
  }, [
    orderSearch,
    orderStatusFilter,
    orderChannelFilter,
    orderPaymentFilter,
    orderGovernorateFilter,
    overviewDatePreset,
    orderSort,
  ]);

  useEffect(() => {
    setProductsPage(1);
  }, [
    productSearch,
    productCategoryFilter,
    productStockFilter,
    productChannelFilter,
    productFeaturedFilter,
    productRoastFilter,
    productSort,
  ]);

  useEffect(() => {
    if (!moreNavOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (moreNavRef.current && !moreNavRef.current.contains(event.target as Node)) {
        setMoreNavOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreNavOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreNavOpen]);

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
      const isExpiredByDate = Boolean(c.expiresAt && new Date(c.expiresAt).getTime() < Date.now());
      const isMaxedOut = Boolean(
        typeof c.maxUses === 'number' && c.maxUses > 0 && (c.usedCount || 0) >= c.maxUses
      );
      if (couponStatusFilter === 'active' && (!c.active || isExpiredByDate || isMaxedOut)) {
        return false;
      }
      if (couponStatusFilter === 'inactive' && c.active) return false;
      if (couponStatusFilter === 'expired' && !isExpiredByDate && !isMaxedOut) return false;
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
    if (!currentCustomRoleId && currentRole === 'delivery_rider') {
      window.location.replace('/rider');
      return;
    }
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
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-8 text-center text-[#231710] gap-3">
        <div className="w-11 h-11 rounded-xl bg-white border border-[#E8E0D5] flex items-center justify-center text-[#9A6836]">
          <Lock className="w-5 h-5" />
        </div>
        <p className="text-sm font-bold text-[#6E5D4F]">جاري التحقق من الجلسة...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E0D5] space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 bg-[#FAF6F0] text-[#231710] rounded-xl mx-auto flex items-center justify-center border border-[#E8E0D5]">
              <ShieldCheck className="w-6 h-6 text-[#9A6836]" />
            </div>
            <h1 className="font-cairo text-xl font-bold text-[#231710]">
              تسجيل دخول الإدارة
            </h1>
            <p className="text-xs text-[#6E5D4F]">
              {settings?.storeName || 'محمصة حفصة للبن والمكسرات'}
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-[#B83B2B] text-xs font-bold p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
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
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-mono font-medium text-[#231710] focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-mono font-medium text-[#231710] focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full bg-[#231710] hover:bg-[#3A2519] text-white font-cairo font-bold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loginSubmitting ? (
                <span>جاري التحقق...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#E8E0D5] flex items-center justify-between gap-2 text-xs">
            <span className="text-[#6E5D4F]">العودة لواجهة المتجر:</span>
            <Link
              href="/"
              className="font-bold text-[#231710] hover:text-[#9A6836] flex items-center gap-1 transition"
            >
              <span>تصفح المتجر</span>
              <ExternalLink className="w-3.5 h-3.5" />
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

  // Metrics Calculation (Responsive to Date Range Filter)
  const validOrders = dateFilteredOrders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
  const activeOrdersCount = dateFilteredOrders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;
  const deliveredOrdersCount = dateFilteredOrders.filter((o) => o.status === 'delivered').length;
  const averageOrderValue =
    validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
  const outOfStockProducts = products.filter(
    (p) => !p.inStock || (typeof p.stockKg === 'number' && p.stockKg <= 0)
  );
  const lowStockProducts = products.filter(
    (p) => p.inStock && typeof p.stockKg === 'number' && p.stockKg > 0 && p.stockKg <= 5
  );
  const averageStoreRating =
    products.length > 0
      ? (products.reduce((s, p) => s + (p.rating || 5), 0) / products.length).toFixed(1)
      : '5.0';

  // CSV Export handler (exports currently filtered orders)
  const handleExportCsv = () => {
    const targetOrders = filteredOrders.length > 0 ? filteredOrders : orders;
    if (!targetOrders || targetOrders.length === 0) {
      showToast('لا توجد طلبات للتصدير حالياً');
      return;
    }
    const csvContent = generateOrdersCsv(targetOrders);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `golden-oasis-orders-${overviewDatePreset}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`تم تصدير ${targetOrders.length} طلب بنجاح إلى ملف CSV`);
  };

  // JSON Full Backup Export (Full Server Snapshot via /api/admin/backup with local fallback)
  const handleExportBackupJson = async () => {
    const dateStr = new Date().toISOString().split('T')[0];
    try {
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch('/api/admin/backup', { headers, cache: 'no-store' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `mizan-full-backup-${dateStr}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('تم تحميل النسخة الاحتياطية الكاملة والشاملة للنظام');
        return;
      }
    } catch {
      // Fall back to client storeData snapshot
    }
    const backup = JSON.stringify(storeData, null, 2);
    const blob = new Blob([backup], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `store-backup-${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تحميل النسخة الاحتياطية الكاملة للنظام');
  };

  // JSON Full Backup Import (Restores all 18 operational collections via /api/admin/backup)
  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const candidate = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        if (!candidate.products || !candidate.categories || !candidate.settings) {
          showToast('ملف النسخة الاحتياطية غير صالح');
          return;
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (adminToken) {
          headers['Authorization'] = `Bearer ${adminToken}`;
        }
        const res = await fetch('/api/admin/backup', {
          method: 'POST',
          headers,
          body: JSON.stringify(parsed),
        });
        if (res.ok) {
          await refreshStore();
          showToast('تمت استعادة النسخة الاحتياطية الكاملة للنظام بنجاح');
          return;
        }
        await updateStorePayload(
          {
            settings: candidate.settings,
            categories: candidate.categories,
            products: candidate.products,
            shippingRates: candidate.shippingRates || shippingRates,
            coupons: candidate.coupons || coupons,
            orders: candidate.orders || orders,
          },
          'تمت استعادة النسخة الاحتياطية للنظام بنجاح'
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

  const handleAssignOrderRider = async (orderId: string, riderId: string, riderName: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
        headers['x-admin-token'] = adminToken;
      }
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          orderId,
          riderId: riderId || null,
          riderName: riderName || null,
        }),
      });
      if (res.ok) {
        await refreshStore();
        showToast('تم إسناد الطلب لمندوب التوصيل بنجاح');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'فشل إسناد المندوب', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء إسناد المندوب', 'error');
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
      gallery: [],
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

    const isUnit = editingProduct.sellingMode === 'unit';
    const cleanedWeights = editingProduct.weights.filter((w) => w.label.trim() && w.price > 0);
    const resolvedUnitLabel = (editingProduct.unitLabel || 'قطعة').trim() || 'قطعة';
    const resolvedUnitPrice =
      typeof editingProduct.unitPrice === 'number' && editingProduct.unitPrice > 0
        ? editingProduct.unitPrice
        : cleanedWeights[0]?.price || 120;
    const resolvedUnitCost =
      typeof editingProduct.unitCost === 'number' && editingProduct.unitCost > 0
        ? editingProduct.unitCost
        : typeof editingProduct.costPerKg === 'number' && editingProduct.costPerKg > 0
          ? editingProduct.costPerKg
          : Math.round(resolvedUnitPrice * 0.68);

    const normalizedUnitWeights: WeightVariant[] =
      cleanedWeights.length > 0
        ? cleanedWeights.map((w, idx) => {
            const units =
              typeof w.unitsCount === 'number' && w.unitsCount > 0 ? w.unitsCount : 1;
            const syncedPrice =
              cleanedWeights.length === 1 && units === 1 ? resolvedUnitPrice : w.price;
            return {
              ...w,
              id: w.id || `u-${idx + 1}`,
              unitsCount: units,
              weightGrams: units * 1000,
              grams: units * 1000,
              price: syncedPrice,
            };
          })
        : [
            {
              id: 'u-1',
              label: resolvedUnitLabel,
              unitsCount: 1,
              weightGrams: 1000,
              grams: 1000,
              price: resolvedUnitPrice,
            },
          ];

    const kiloVariant = cleanedWeights.find((w) => (w.weightGrams || w.grams) === 1000);
    const derivedWeightPricePerKg =
      kiloVariant?.price ||
      (cleanedWeights[0] && (cleanedWeights[0].weightGrams || cleanedWeights[0].grams || 0) > 0
        ? Math.round(
            (cleanedWeights[0].price * 1000) /
              (cleanedWeights[0].weightGrams || cleanedWeights[0].grams || 250)
          )
        : editingProduct.pricePerKg || 680);
    const derivedWeightCostPerKg =
      typeof editingProduct.costPerKg === 'number' && editingProduct.costPerKg > 0
        ? editingProduct.costPerKg
        : Math.round(derivedWeightPricePerKg * 0.65);

    const cleanPrimaryImg = (editingProduct.image || '').trim();
    const cleanedGallery = Array.from(
      new Set(
        (editingProduct.gallery || [])
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter((u) => Boolean(u) && u !== cleanPrimaryImg)
      )
    );
    const cleanedHighlights = (editingProduct.adHighlights || [])
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .slice(0, 3);
    const cleanedProofImages = Array.from(
      new Set(
        (editingProduct.proofImages || [])
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter(Boolean)
      )
    );

    const finalProd: Product = {
      ...editingProduct,
      image: cleanPrimaryImg || '/images/products/royal-mix.jpg',
      gallery: cleanedGallery,
      videoUrl: editingProduct.videoUrl?.trim() || undefined,
      adHeadline: editingProduct.adHeadline?.trim() || undefined,
      adHighlights: cleanedHighlights.length > 0 ? cleanedHighlights : undefined,
      proofImages: cleanedProofImages.length > 0 ? cleanedProofImages : undefined,
      sellingMode: isUnit ? 'unit' : 'weight',
      ...(isUnit
        ? {
            unitLabel: resolvedUnitLabel,
            unitPrice: resolvedUnitPrice,
            unitCost: resolvedUnitCost,
            pricePerKg: resolvedUnitPrice,
            costPerKg: resolvedUnitCost,
          }
        : {
            pricePerKg: derivedWeightPricePerKg,
            costPerKg: derivedWeightCostPerKg,
          }),
      slug:
        editingProduct.slug.trim() ||
        editingProduct.name.trim().toLowerCase().replace(/\s+/g, '-') +
          '-' +
          Date.now().toString().slice(-4),
      roastOptions: isUnit
        ? editingProduct.roastOptions
        : editingProduct.roastOptions.length > 0
          ? editingProduct.roastOptions
          : ['محمص مملح'],
      weights: isUnit
        ? normalizedUnitWeights
        : cleanedWeights.length > 0
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
    updateUrlQueryParams({ tab: 'products', productModal: null }, { replace: true });
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

  const handleBulkUpdateProducts = async (
    patch: Partial<Pick<Product, 'showOnline' | 'showInPos' | 'inStock'>>,
    successMessage: string
  ) => {
    if (selectedProductIds.length === 0) return;
    const idSet = new Set(selectedProductIds);
    const updated = products.map((p) => (idSet.has(p.id) ? { ...p, ...patch } : p));
    await updateStorePayload({ products: updated }, successMessage);
    setSelectedProductIds([]);
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
    const parsedMaxUses =
      newCouponMaxUses.trim() !== '' && Number(newCouponMaxUses) > 0
        ? Math.floor(Number(newCouponMaxUses))
        : undefined;
    const parsedExpiresAt = newCouponExpiresAt.trim()
      ? new Date(`${newCouponExpiresAt.trim()}T23:59:59`).toISOString()
      : undefined;

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
      expiresAt: parsedExpiresAt,
      maxUses: parsedMaxUses,
      usedCount: 0,
    };
    await updateStorePayload({ coupons: [...coupons, created] }, 'تمت إضافة كود الخصم الجديد');
    setNewCouponCode('');
    setNewCouponDesc('');
    setNewCouponExpiresAt('');
    setNewCouponMaxUses('');
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
      'تم حفظ وتطبيق تعديلات محتوى الصفحات على المتجر بالكامل'
    );
  };

  // Immediately persist a theme or layout change to the database and apply live
  const applyAndSaveThemeConfig = async (
    nextConfig: StoreThemeConfig,
    toastMessage = 'تم حفظ وتطبيق ثيم وتخطيط الموقع الجديد لجميع الزوار بنجاح'
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
      `تم تفعيل وحفظ ثيم "${preset.name}" على كامل الموقع`
    );
  };

  // Save Theme & Layout Config Permanently
  const handleSaveThemeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyAndSaveThemeConfig(
      themeDraft,
      'تم حفظ وتطبيق ثيم وتخطيط الموقع الجديد لجميع الزوار بنجاح'
    );
  };

  const isFullAdmin =
    !currentCustomRoleId &&
    (currentRole === 'super_admin' || currentRole === 'admin');

  // Sidebar navigation config grouped into 4 logical sections, isolated strictly by role
  const NAV_GROUPS: Array<{
    id: 'sales' | 'inventory' | 'accounting' | 'management';
    title: string;
  }> = [
    { id: 'sales', title: 'المبيعات' },
    { id: 'inventory', title: 'المخزون والتوريد' },
    { id: 'accounting', title: 'الحسابات' },
    { id: 'management', title: 'الإدارة والإعدادات' },
  ];

  const allNavItems: Array<{
    id: AdminTab;
    group: 'sales' | 'inventory' | 'accounting' | 'management';
    label: string;
    icon: React.ReactNode;
    urgentCount?: number;
    roles: AdminRole[];
  }> = [
    // Group 1: المبيعات
    {
      id: 'overview',
      group: 'sales',
      label: currentRole === 'accountant' ? 'الدخل اليومي والملخص المالي' : 'النظرة العامة',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'accountant'],
    },
    {
      id: 'orders',
      group: 'sales',
      label:
        currentRole === 'accountant'
          ? 'فواتير المبيعات والكاشير'
          : currentRole === 'cashier'
            ? 'تجهيز طلبات الأونلاين'
            : 'الطلبات والفواتير',
      icon: <Package className="w-4 h-4" />,
      urgentCount: activeOrdersCount > 0 ? activeOrdersCount : undefined,
      roles: ['super_admin', 'admin', 'accountant', 'cashier'],
    },
    {
      id: 'cashier_portal',
      group: 'sales',
      label: 'نقطة البيع (الكاشير)',
      icon: <Scale className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'cashier'],
    },
    {
      id: 'coupons',
      group: 'sales',
      label: currentRole === 'accountant' ? 'الكوبونات والخصومات' : 'الكوبونات والعروض',
      icon: <Tag className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'accountant'],
    },

    // Group 2: المخزون والتوريد
    {
      id: 'products',
      group: 'inventory',
      label: currentRole === 'accountant' ? 'الأصناف والتكاليف والأسعار' : 'المنتجات والأسعار',
      icon: <ShoppingBag className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'accountant'],
    },
    {
      id: 'categories',
      group: 'inventory',
      label: currentRole === 'supplier' ? 'الأقسام والتصنيفات (عرض)' : 'الأقسام والتصنيفات',
      icon: <Layers className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'supplier'],
    },
    {
      id: 'supply_invoices',
      group: 'inventory',
      label: currentRole === 'accountant' ? 'فواتير الشراء والتوريد' : 'فواتير التوريد',
      icon: <ClipboardList className="w-4 h-4" />,
      urgentCount: pendingSupplyInvoicesCount > 0 ? pendingSupplyInvoicesCount : undefined,
      roles: ['super_admin', 'admin', 'accountant'],
    },
    {
      id: 'supply_portal',
      group: 'inventory',
      label: 'بوابة المورد',
      icon: <Truck className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'supplier'],
    },
    {
      id: 'operations',
      group: 'inventory',
      label: currentRole === 'accountant' ? 'الورديات والمصروفات والـ VIP' : 'أدوات التشغيل والورديات',
      icon: <FileText className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'accountant'],
    },

    // Group 3: الحسابات
    {
      id: 'accounting_portal',
      group: 'accounting',
      label: currentRole === 'accountant' ? 'التقارير المالية الشاملة' : 'التقارير والمراجعة المالية',
      icon: <TrendingUp className="w-4 h-4" />,
      roles: ['super_admin', 'admin', 'accountant'],
    },

    // Group 4: الإدارة والإعدادات
    {
      id: 'shipping',
      group: 'management',
      label: 'الشحن والمناطق',
      icon: <Truck className="w-4 h-4" />,
      roles: ['super_admin', 'admin'],
    },
    {
      id: 'reviews',
      group: 'management',
      label: 'تقييمات العملاء',
      icon: <Star className="w-4 h-4" />,
      roles: ['super_admin', 'admin'],
    },
    {
      id: 'permissions',
      group: 'management',
      label: 'الحسابات والصلاحيات',
      icon: <KeyRound className="w-4 h-4" />,
      roles: ['super_admin', 'admin'],
    },
    {
      id: 'settings',
      group: 'management',
      label: 'الإعدادات',
      icon: <Settings className="w-4 h-4" />,
      roles: ['super_admin', 'admin'],
    },
  ];

  const canAccessTab = (tabId: AdminTab): boolean => {
    if (isFullAdmin) return true;
    if (tabId === 'permissions') return isFullAdmin;
    return hasRolePermission(
      currentRole,
      tabId as AdminPermissionId,
      settings,
      currentCustomRoleId || undefined
    );
  };

  const navItems = allNavItems.filter((item) =>
    item.id === 'cashier_portal'
      ? isFullAdmin ||
        currentRole === 'cashier' ||
        (Boolean(currentCustomRoleId) && canAccessTab('cashier_portal'))
      : canAccessTab(item.id)
  );

  const PRIMARY_NAV_PRIORITY: AdminTab[] = [
    'overview',
    'orders',
    'products',
    'accounting_portal',
    'supply_invoices',
    'cashier_portal',
    'supply_portal',
  ];
  const prioritizedNavItems = [...navItems].sort((a, b) => {
    const idxA = PRIMARY_NAV_PRIORITY.indexOf(a.id);
    const idxB = PRIMARY_NAV_PRIORITY.indexOf(b.id);
    const rankA = idxA === -1 ? 999 : idxA;
    const rankB = idxB === -1 ? 999 : idxB;
    return rankA - rankB;
  });
  const primaryTopNavItems = prioritizedNavItems.slice(0, 5);
  const secondaryTopNavItems = prioritizedNavItems.slice(5);
  const isSecondaryTabActive = secondaryTopNavItems.some((item) => item.id === activeTab);

  const currentNav = allNavItems.find((n) => n.id === activeTab) || navItems[0];

  const roleHeaderBadge = currentCustomRoleName
    ? { label: currentCustomRoleName, cls: 'bg-amber-50 text-[#9A6836] border-amber-200' }
    : currentRole === 'supplier'
      ? { label: 'المورد', cls: 'bg-[#FAF6F0] text-[#9A6836] border-[#E8E0D5]' }
      : currentRole === 'accountant'
        ? { label: 'المحاسب', cls: 'bg-[#FAF6F0] text-[#3B6E4C] border-[#E8E0D5]' }
        : currentRole === 'cashier'
          ? { label: 'الكاشير', cls: 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]' }
          : currentRole === 'delivery_rider'
            ? { label: 'مندوب التوصيل', cls: 'bg-blue-50 text-blue-800 border-blue-200' }
            : { label: 'المدير العام', cls: 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]' };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] flex flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* RIGHT-HAND CLEAN LIGHT ERP RTL SIDEBAR */}
      <aside
        className={`${
          activeTab === 'cashier_portal' && posFocusMode ? 'hidden' : 'flex'
        } fixed lg:sticky top-0 right-0 z-50 lg:z-30 h-screen w-60 bg-white text-[#231710] border-l border-[#E8E0D5] flex-col justify-between transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Brand Identity */}
        <div className="px-4 py-3.5 border-b border-[#E8E0D5] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#231710] text-white flex items-center justify-center font-cairo font-bold text-sm shrink-0">
              {(settings.storeName || 'م').trim().charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="font-cairo text-xs font-bold text-[#231710] truncate">
                {settings.storeName}
              </h2>
              <div className="text-[11px] font-medium text-[#6E5D4F] truncate">
                {roleHeaderBadge.label}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg bg-[#FAF6F0] text-[#231710] hover:bg-[#F4EFE6] border border-[#E8E0D5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grouped Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5">
          {NAV_GROUPS.map((grp) => {
            const groupItems = navItems.filter((item) => item.group === grp.id);
            if (groupItems.length === 0) return null;
            return (
              <div key={grp.id} className="space-y-0.5">
                <div className="px-2.5 text-[11px] font-bold text-[#6E5D4F]">
                  {grp.title}
                </div>
                {groupItems.map((item) => {
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
                      className={`w-full min-h-[36px] flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-right transition ${
                        isActive
                          ? 'bg-[#231710] text-white font-bold'
                          : 'text-[#231710] hover:bg-[#FAF6F0] font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`shrink-0 ${
                            isActive ? 'text-white' : 'text-[#6E5D4F]'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="text-xs truncate">{item.label}</span>
                      </div>

                      {item.urgentCount !== undefined && item.urgentCount > 0 && (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums ${
                            isActive
                              ? 'bg-white text-[#231710]'
                              : 'bg-[#B83B2B] text-white'
                          }`}
                        >
                          {item.urgentCount}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Sidebar Footer Actions */}
        <div className="p-2.5 border-t border-[#E8E0D5] space-y-1 bg-[#FAF6F0]/60">
          {(isFullAdmin || currentRole === 'cashier') && (
            <Link
              href="/pos"
              className="w-full bg-white hover:bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-xs font-bold px-3 py-1.5 rounded-xl flex items-center justify-between transition"
            >
              <span>نقطة البيع (POS)</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#6E5D4F]" />
            </Link>
          )}

          <Link
            href="/"
            className="w-full bg-white hover:bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] text-xs font-medium px-3 py-1.5 rounded-xl flex items-center justify-between transition"
          >
            <span>معاينة المتجر</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#6E5D4F]" />
          </Link>

          <button
            onClick={handleLogout}
            className="w-full bg-white hover:bg-red-50 text-[#B83B2B] text-xs font-bold px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition border border-[#E8E0D5] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل خروج</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Clean Light Topbar */}
        <header
          className={`${
            activeTab === 'cashier_portal' && posFocusMode ? 'hidden' : 'block'
          } sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E8E0D5]`}
        >
          <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] shrink-0 cursor-pointer"
                aria-label="فتح القائمة الجانبية"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h1 className="font-cairo text-sm sm:text-base font-bold text-[#231710] truncate">
                  {currentNav?.label}
                </h1>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${roleHeaderBadge.cls}`}
                >
                  {roleHeaderBadge.label}
                </span>
                {saving && (
                  <span className="text-[11px] bg-[#FAF6F0] text-[#9A6836] border border-[#E8E0D5] font-bold px-2.5 py-0.5 rounded-md shrink-0">
                    جاري الحفظ...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSoundMuted(toggleAudioMuted())}
                className="p-2 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] transition cursor-pointer"
                title={isSoundMuted ? 'تشغيل التنبيه الصوتي للطلبات' : 'كتم التنبيه الصوتي'}
              >
                {isSoundMuted ? (
                  <VolumeX className="w-4 h-4 text-[#6E5D4F]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#231710]" />
                )}
              </button>

              {(isFullAdmin || currentRole === 'cashier') && (
                <Link
                  href="/pos"
                  className="bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition"
                >
                  <span>الكاشير POS</span>
                </Link>
              )}

              {isFullAdmin && (
                <button
                  onClick={() => {
                    selectTab('products', { productModal: 'new' });
                    openCreateProductModal();
                  }}
                  className="bg-[#231710] hover:bg-[#3A2519] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>إضافة منتج</span>
                </button>
              )}
            </div>
          </div>

          {/* Unified Top Navigation Bar for Mobile/Tablet (< lg); Desktop uses the Right Sidebar */}
          <div className="lg:hidden flex items-center justify-between gap-2 px-4 sm:px-6 py-2 bg-[#FAF6F0] border-t border-[#E8E0D5]">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
              {primaryTopNavItems.map((item) => {
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
                      setMoreNavOpen(false);
                    }}
                    className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap shrink-0 transition cursor-pointer ${
                      isActive
                        ? 'bg-[#231710] text-white font-bold shadow-2xs'
                        : 'bg-white text-[#231710] border border-[#E8E0D5] hover:bg-[#F4EFE6] font-medium'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.urgentCount !== undefined && item.urgentCount > 0 && (
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                          isActive ? 'bg-white text-[#231710]' : 'bg-[#B83B2B] text-white'
                        }`}
                      >
                        {item.urgentCount}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>

            {secondaryTopNavItems.length > 0 && (
              <div className="relative shrink-0" ref={moreNavRef}>
                <button
                  type="button"
                  onClick={() => setMoreNavOpen((prev) => !prev)}
                  aria-expanded={moreNavOpen}
                  className={`min-h-[40px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs whitespace-nowrap transition cursor-pointer border ${
                    isSecondaryTabActive || moreNavOpen
                      ? 'bg-[#231710] text-white border-[#231710] font-bold'
                      : 'bg-white text-[#231710] border-[#E8E0D5] hover:bg-[#F4EFE6] font-bold'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4 shrink-0" />
                  <span>المزيد ▾</span>
                </button>

                {moreNavOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white border border-[#E8E0D5] shadow-xl p-1.5 z-50 space-y-1">
                    {secondaryTopNavItems.map((item) => {
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
                            setMoreNavOpen(false);
                          }}
                          className={`min-h-[40px] w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition ${
                            isActive
                              ? 'bg-[#231710] text-white font-bold'
                              : 'text-[#231710] hover:bg-[#FAF6F0] font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={isActive ? 'text-white' : 'text-[#6E5D4F]'}>
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.urgentCount !== undefined && item.urgentCount > 0 && (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                                isActive ? 'bg-white text-[#231710]' : 'bg-[#B83B2B] text-white'
                              }`}
                            >
                              {item.urgentCount}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Module Container — Full Fluid Width (No Wasted Side Margins) */}
        <main
          className={
            activeTab === 'cashier_portal'
              ? posFocusMode
                ? 'p-1.5 sm:p-2 w-full max-w-none'
                : 'p-2 sm:p-3 w-full max-w-none'
              : 'p-3 sm:p-4 lg:px-5 space-y-4 w-full max-w-none'
          }
        >
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
            <SupplyInvoicesApprovalModule
              effectiveSupplyInvoices={effectiveSupplyInvoices}
              pendingSupplyInvoicesCount={pendingSupplyInvoicesCount}
              loadingSupplyInvoices={loadingSupplyInvoices}
              supplyInvoiceFilter={supplyInvoiceFilter}
              setSupplyInvoiceFilter={setSupplyInvoiceFilter}
              filteredSupplyInvoices={filteredSupplyInvoices}
              expandedAdminInvoiceId={expandedAdminInvoiceId}
              setExpandedAdminInvoiceId={setExpandedAdminInvoiceId}
              actionLoadingInvoiceId={actionLoadingInvoiceId}
              products={products}
              invoiceReviewNotes={invoiceReviewNotes}
              setInvoiceReviewNotes={setInvoiceReviewNotes}
              fetchSupplyInvoices={() => fetchSupplyInvoices()}
              handleReviewSupplyInvoice={handleReviewSupplyInvoice}
              canApprove={isFullAdmin}
            />
          )}

          {/* ROLE PORTAL 2: ACCOUNTANT ISOLATION PORTAL */}
          {activeTab === 'accounting_portal' &&
            canAccessTab('accounting_portal') && (
              <AccountantIsolationPortal
                orders={orders}
                products={products}
                categories={categories}
                posShifts={storeData?.posShifts || []}
                posExpenses={storeData?.posExpenses || []}
                vipMembers={storeData?.vipMembers || []}
                coupons={coupons}
                supplyInvoices={effectiveSupplyInvoices}
                settings={settings}
                canMutate={isFullAdmin}
                onRefreshStore={refreshStore}
                onExportOrdersCsv={handleExportCsv}
                onOpenOrdersTab={() => selectTab('orders')}
                onOpenSupplyInvoicesTab={() => selectTab('supply_invoices')}
                onOpenOperationsTab={() => selectTab('operations')}
                onOpenProductsTab={() => selectTab('products')}
              />
            )}

          {/* ROLE PORTAL 3: UNIFIED CASHIER POS WORKSPACE (overflow-x-clip keeps sticky invoice working on full-page scroll) */}
          {activeTab === 'cashier_portal' && canAccessTab('cashier_portal') && (
            <div className="rounded-2xl overflow-x-clip border border-[#E8E0D5] bg-[#FAF6F0]">
              <HafsaPosCashierPage />
            </div>
          )}

          {activeTab === 'operations' && canAccessTab('operations') && (
            <HafsaOperationsStudio
              adminToken={adminToken}
              onUpdateStorePayload={updateStorePayload}
              canMutate={isFullAdmin}
              currentRole={currentRole}
            />
          )}

          {/* ================================================================= */}
          {/* MODULE 1: OVERVIEW & ANALYTICS                                    */}
          {/* ================================================================= */}
          {activeTab === 'overview' && canAccessTab('overview') && (
            <div className="space-y-4">
              {/* Financial & Operational Date Range Filter Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-brand-950">
                    <Calendar className="w-4 h-4 text-gold-600" />
                    <span>الفترة الزمنية للتقارير والمؤشرات:</span>
                  </div>
                  <div className="inline-flex flex-wrap bg-brand-50 p-1 rounded-xl border border-brand-200 gap-1">
                    {(
                      [
                        { id: 'all', label: 'كل الفترات' },
                        { id: 'today', label: 'اليوم' },
                        { id: 'this_week', label: 'آخر 7 أيام' },
                        { id: 'this_month', label: 'هذا الشهر' },
                        { id: 'custom', label: 'فترة مخصصة' },
                      ] as const
                    ).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setOverviewDatePreset(preset.id)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                          overviewDatePreset === preset.id
                            ? 'bg-[#231710] text-white'
                            : 'text-[#6E5D4F] hover:bg-[#FAF6F0]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {overviewDatePreset === 'custom' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-brand-700">من:</span>
                      <input
                        type="date"
                        value={overviewCustomStart}
                        onChange={(e) => setOverviewCustomStart(e.target.value)}
                        className="bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-brand-700">إلى:</span>
                      <input
                        type="date"
                        value={overviewCustomEnd}
                        onChange={(e) => setOverviewCustomEnd(e.target.value)}
                        className="bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductStockFilter(lowStockProducts.length > 0 ? 'low' : 'out');
                        selectTab('products');
                      }}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        تنبيه المخزون: {outOfStockProducts.length} نافد • {lowStockProducts.length} نواقص حرجة
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Primary Executive StatCard KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <StatCard
                  title="صافي مبيعات اليوم / الفترة"
                  value={`${totalRevenue.toLocaleString('ar-EG')} ${currencySymbolDraft}`}
                  subtitle={`من ${validOrders.length} طلب مؤكدة • متوسط ${averageOrderValue} ${currencySymbolDraft}`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  tone="emerald"
                  trend={
                    isFullAdmin || currentRole === 'accountant'
                      ? {
                          label: `هامش ${overviewFinancialSummary.netMarginPercent}%`,
                          tone: overviewFinancialSummary.netOperatingProfit >= 0 ? 'positive' : 'negative',
                        }
                      : undefined
                  }
                  onClick={() => selectTab('orders')}
                />

                <StatCard
                  title="الطلبات النشطة الآن"
                  value={activeOrdersCount}
                  subtitle={`مكتملة: ${deliveredOrdersCount} • إجمالي الفترة: ${dateFilteredOrders.length}`}
                  icon={<Clock className="w-4 h-4" />}
                  tone={activeOrdersCount > 0 ? 'amber' : 'default'}
                  trend={{
                    label: activeOrdersCount > 0 ? 'بانتظار التجهيز/التوصيل' : 'لا توجد طلبات معلقة',
                    tone: activeOrdersCount > 0 ? 'warning' : 'positive',
                  }}
                  onClick={() => selectTab('orders')}
                />

                <StatCard
                  title="حالة الوردية والدرج"
                  value={
                    overviewFinancialSummary.totalDrawerVariance === 0
                      ? 'مطابق تماماً'
                      : `${
                          overviewFinancialSummary.totalDrawerVariance > 0
                            ? `+${overviewFinancialSummary.totalDrawerVariance}`
                            : overviewFinancialSummary.totalDrawerVariance
                        } ${currencySymbolDraft}`
                  }
                  subtitle={`إجمالي الورديات: ${overviewFinancialSummary.shiftAudits.length} • مفتوحة: ${
                    (storeData?.posShifts || []).filter((s) => s.status === 'open').length
                  }`}
                  icon={<Scale className="w-4 h-4" />}
                  tone={
                    overviewFinancialSummary.totalDrawerVariance < 0
                      ? 'rose'
                      : overviewFinancialSummary.totalDrawerVariance > 0
                        ? 'accent'
                        : 'emerald'
                  }
                  onClick={() => selectTab('accounting_portal', { subtab: 'shifts' })}
                />

                <StatCard
                  title="التنبيهات والمواقف الحرجة"
                  value={outOfStockProducts.length + lowStockProducts.length + pendingSupplyInvoicesCount}
                  subtitle={`نافد: ${outOfStockProducts.length} • نواقص: ${lowStockProducts.length} • توريد معلق: ${pendingSupplyInvoicesCount}`}
                  icon={<AlertTriangle className="w-4 h-4" />}
                  tone={
                    outOfStockProducts.length + lowStockProducts.length + pendingSupplyInvoicesCount > 0
                      ? 'rose'
                      : 'default'
                  }
                  trend={{
                    label:
                      outOfStockProducts.length > 0
                        ? 'يتطلب مراجعة المخزون'
                        : pendingSupplyInvoicesCount > 0
                          ? 'فواتير توريد بانتظار الاعتماد'
                          : 'المخزون مستقر',
                    tone:
                      outOfStockProducts.length > 0
                        ? 'negative'
                        : pendingSupplyInvoicesCount > 0
                          ? 'warning'
                          : 'positive',
                  }}
                  onClick={() =>
                    outOfStockProducts.length + lowStockProducts.length > 0
                      ? selectTab('products')
                      : selectTab('supply_invoices')
                  }
                />
              </div>

              {/* Progressive Disclosure Toggle for Secondary Breakdowns & Auxiliary Metrics */}
              <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOverviewDetailsOpen((prev) => !prev)}
                  aria-expanded={overviewDetailsOpen}
                  className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-2 text-right hover:bg-[#FAF6F0]/70 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#9A6836]" />
                    <span className="text-xs font-bold text-[#231710]">
                      تفاصيل ومؤشرات إضافية ▾
                    </span>
                    <span className="text-[11px] font-medium text-[#6E5D4F] hidden sm:inline">
                      (توزيع القنوات، تقييم المخزون، التزامات الموردين، مراحل الطلبات)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#9A6836] flex items-center gap-1 shrink-0">
                    <span>{overviewDetailsOpen ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
                    {overviewDetailsOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>

                {overviewDetailsOpen && (
                  <div className="p-4 pt-2 border-t border-[#E8E0D5] space-y-4 bg-[#FAF6F0]/40">
                    {/* Auxiliary Catalog & Service Counters */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                        <div className="text-xs font-bold text-[#6E5D4F]">طلبات مكتملة</div>
                        <div className="text-base font-bold text-[#231710] mt-1 tabular-nums">
                          {deliveredOrdersCount}
                        </div>
                        <div className="text-[11px] text-[#6E5D4F] mt-0.5">تم تسليمها للعملاء</div>
                      </div>
                      <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                        <div className="text-xs font-bold text-[#6E5D4F]">متوسط قيمة الطلب</div>
                        <div className="text-base font-bold text-[#231710] mt-1 tabular-nums">
                          {averageOrderValue} {currencySymbolDraft}
                        </div>
                        <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                          شحن مجاني فوق {settings.freeShippingThreshold}
                        </div>
                      </div>
                      <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                        <div className="text-xs font-bold text-[#6E5D4F]">المنتجات والأقسام</div>
                        <div className="text-base font-bold text-[#231710] mt-1 tabular-nums">
                          {products.length} صنف
                        </div>
                        <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                          موزعة على {categories.length} أقسام
                        </div>
                      </div>
                      <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5]">
                        <div className="text-xs font-bold text-[#6E5D4F]">التقييم العام</div>
                        <div className="text-base font-bold text-[#231710] mt-1 tabular-nums">
                          {averageStoreRating} / 5
                        </div>
                        <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                          {allReviewsFlattened.length} تقييم مسجل
                        </div>
                      </div>
                    </div>

                    {/* Financial Profit & Channel Breakdown Strip */}
                    {(isFullAdmin || currentRole === 'accountant') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5]">
                          <div className="text-xs font-medium text-[#6E5D4F]">مبيعات المتجر الأونلاين</div>
                          <div className="text-base font-bold text-[#231710] mt-1 tabular-nums">
                            {overviewFinancialSummary.onlineMetrics.grossRevenue.toLocaleString()} ج.م
                          </div>
                          <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                            {overviewFinancialSummary.onlineMetrics.orderCount} طلب أونلاين
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5]">
                          <div className="text-xs font-medium text-[#6E5D4F]">مبيعات كاشير الفرع POS</div>
                          <div className="text-base font-bold text-[#231710] mt-1 tabular-nums">
                            {overviewFinancialSummary.posMetrics.grossRevenue.toLocaleString()} ج.م
                          </div>
                          <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                            {overviewFinancialSummary.posMetrics.orderCount} فاتورة كاشير
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5]">
                          <div className="text-xs font-medium text-[#6E5D4F]">تكلفة البضاعة والمصروفات</div>
                          <div className="text-base font-bold text-[#231710] mt-1 tabular-nums">
                            {(overviewFinancialSummary.totalCogs + overviewFinancialSummary.operatingExpenses).toLocaleString()} ج.م
                          </div>
                          <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                            خامات: {overviewFinancialSummary.totalCogs.toLocaleString()} • مصروفات: {overviewFinancialSummary.operatingExpenses.toLocaleString()}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5]">
                          <div className="flex items-center justify-between text-xs font-medium text-[#6E5D4F]">
                            <span>صافي الربح الفعلي</span>
                            <span className="bg-[#FAF6F0] text-[#3B6E4C] border border-[#E8E0D5] px-2 py-0.5 rounded-md font-bold tabular-nums text-[11px]">
                              {overviewFinancialSummary.netMarginPercent}%
                            </span>
                          </div>
                          <div
                            className={`text-base font-bold mt-1 tabular-nums ${
                              overviewFinancialSummary.netOperatingProfit >= 0
                                ? 'text-[#3B6E4C]'
                                : 'text-[#B83B2B]'
                            }`}
                          >
                            {overviewFinancialSummary.netOperatingProfit.toLocaleString()} ج.م
                          </div>
                          <div className="text-[11px] text-[#6E5D4F] mt-0.5">
                            بعد خصم تكلفة الجملة والمصروفات
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inventory Valuation, Supply & VIP Liabilities, and Accounting Portal Shortcut */}
                    {(isFullAdmin || currentRole === 'accountant') && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-xs font-medium text-[#6E5D4F]">
                              <span>تقييم المخزون ({productsInventoryValuation.totalStockKg} كجم)</span>
                              <span className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] px-2 py-0.5 rounded-md font-bold text-[11px]">
                                هامش {productsInventoryValuation.avgMarginPercent}%
                              </span>
                            </div>
                            <div className="text-xs font-bold text-[#231710] mt-1.5">
                              بالتكلفة: {productsInventoryValuation.totalCostValuation.toLocaleString()} ج.م • بالبيع:{' '}
                              {productsInventoryValuation.totalRetailValuation.toLocaleString()} ج.م
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectTab('products')}
                            className="mt-2.5 text-xs font-bold text-[#9A6836] hover:underline text-right cursor-pointer"
                          >
                            ربح المخزون الكامن: +{productsInventoryValuation.potentialInventoryProfit.toLocaleString()} ج.م ←
                          </button>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-xs font-medium text-[#6E5D4F]">
                              <span>التزامات الموردين ومحافظ VIP</span>
                              <span className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] px-2 py-0.5 rounded-md font-bold text-[11px]">
                                {overviewFinancialSummary.supplyFinancials.pendingCount} معلقة
                              </span>
                            </div>
                            <div className="text-xs font-bold text-[#231710] mt-1.5">
                              توريد معتمد: {overviewFinancialSummary.supplyFinancials.approvedTotal.toLocaleString()} ج.م • معلق:{' '}
                              {overviewFinancialSummary.supplyFinancials.pendingTotal.toLocaleString()} ج.م
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectTab('supply_invoices')}
                            className="mt-2.5 text-xs font-bold text-[#9A6836] hover:underline text-right cursor-pointer"
                          >
                            رصيد نقاط VIP: {overviewFinancialSummary.vipLiabilities.totalPointsBalance.toLocaleString()} ج.م ←
                          </button>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-[#E8E0D5] flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-bold text-[#9A6836]">
                              المراجعة والتقارير المالية
                            </div>
                            <div className="text-xs font-medium text-[#6E5D4F] mt-1">
                              6 سجلات محاسبية تفصيلية وتصدير CSV
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2.5">
                            <button
                              type="button"
                              onClick={() => selectTab('accounting_portal')}
                              className="flex-1 min-h-[40px] bg-[#231710] hover:bg-[#3A2519] text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                            >
                              التقارير المالية
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const csv = generateFinancialSummaryCsv(overviewFinancialSummary);
                                triggerCsvDownload(
                                  `hafsa_financial_summary_${new Date().toISOString().slice(0, 10)}.csv`,
                                  csv
                                );
                              }}
                              className="min-h-[40px] bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] text-xs font-bold px-3 py-2 rounded-xl border border-[#E8E0D5] transition cursor-pointer"
                              title="تصدير الملخص المالي CSV"
                            >
                              CSV
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Status Pipeline Breakdown */}
                    <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-[#231710]">
                          مراحل تنفيذ الطلبات (اضغط لفلترة الطلبات)
                        </h3>
                        <button
                          type="button"
                          onClick={() => selectTab('orders')}
                          className="text-[11px] font-bold text-[#9A6836] hover:text-[#231710] underline cursor-pointer"
                        >
                          عرض كل الطلبات ({orders.length})
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {CANONICAL_ORDER_STATUSES.map((stKey) => {
                          const count = orders.filter(
                            (o) =>
                              o.status === stKey ||
                              (stKey === 'roasting_packing' && (o.status as string) === 'preparing')
                          ).length;
                          const info = getOrderStatusMeta(stKey);
                          return (
                            <button
                              key={stKey}
                              type="button"
                              onClick={() => {
                                setOrderStatusFilter(stKey);
                                selectTab('orders', { status: stKey });
                              }}
                              className="min-h-[44px] p-2.5 rounded-xl border border-[#E8E0D5] hover:border-[#231710] bg-[#FAF6F0]/70 hover:bg-[#FAF6F0] text-right transition space-y-0.5 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className={`w-2 h-2 rounded-full ${info.dotClass}`} />
                                <span className="text-sm font-black text-[#231710] tabular-nums">{count}</span>
                              </div>
                              <div className="text-[11px] font-extrabold text-[#231710] truncate">
                                {info.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
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
                        <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
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
                              <span className="font-mono font-bold bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] px-2 py-0.5 rounded-lg text-[11px]">
                                {ord.orderNumber}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <div className="font-extrabold text-brand-950">{ord.customerName}</div>
                              <div className="text-[11px] text-brand-700 font-mono">
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
                              {currentRole !== 'accountant' ? (
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
                              ) : (
                                <span
                                  className={`inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                                    getOrderStatusMeta(ord.status).badgeClass
                                  }`}
                                >
                                  {getOrderStatusMeta(ord.status).label}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedInvoiceOrder(ord);
                                  updateUrlQueryParams({ invoice: ord.orderNumber });
                                }}
                                className="p-1.5 bg-[#231710] text-white rounded-lg hover:bg-[#3A271C] inline-flex"
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
                      <span>حالة توفر المخزون وتنبيهات النواقص</span>
                      <span className="text-[11px] bg-pistachio-100 text-pistachio-700 px-2 py-0.5 rounded-full font-bold">
                        {products.length - outOfStockProducts.length} متاح
                      </span>
                    </h3>

                    {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
                      <div className="p-3 rounded-xl bg-pistachio-50 border border-pistachio-200 text-pistachio-700 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>جميع أصناف المتجر متوفرة بكميات آمنة في المخزون!</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {outOfStockProducts.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-bold text-red-700 flex items-center justify-between">
                              <span>أصناف نافدة ({outOfStockProducts.length})</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setProductStockFilter('out');
                                  selectTab('products');
                                }}
                                className="underline text-[11px] hover:text-red-900"
                              >
                                عرض الكل
                              </button>
                            </div>
                            {outOfStockProducts.slice(0, 4).map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-red-50 border border-red-200 text-xs"
                              >
                                <span className="font-bold text-red-900 truncate">{p.name}</span>
                                {isFullAdmin ? (
                                  <button
                                    onClick={() => handleToggleProductStock(p.id)}
                                    className="bg-white text-pistachio-700 border border-pistachio-300 px-2 py-0.5 rounded-lg text-[11px] font-extrabold shrink-0"
                                  >
                                    إعادة التوفير
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-red-700 shrink-0">
                                    0 كجم
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {lowStockProducts.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-bold text-amber-800 flex items-center justify-between">
                              <span>نواقص حرجة ≤ 5 كجم ({lowStockProducts.length})</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setProductStockFilter('low');
                                  selectTab('products');
                                }}
                                className="underline text-[11px] hover:text-amber-950"
                              >
                                فلترة النواقص
                              </button>
                            </div>
                            {lowStockProducts.slice(0, 5).map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs"
                              >
                                <span className="font-bold text-amber-950 truncate">{p.name}</span>
                                <span className="font-mono font-bold text-[11px] bg-white text-amber-800 border border-amber-300 px-2 py-0.5 rounded-lg shrink-0">
                                  {p.stockKg} كجم متبقي
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
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
              {/* Shopify Polaris-style FilterToolbar */}
              <FilterToolbar
                searchValue={orderSearch}
                onSearchChange={setOrderSearch}
                searchPlaceholder="ابحث برقم الطلب، اسم العميل، الهاتف، العنوان..."
                activeFiltersCount={
                  (orderChannelFilter !== 'all' ? 1 : 0) +
                  (orderStatusFilter !== 'all' ? 1 : 0) +
                  (orderPaymentFilter !== 'all' ? 1 : 0) +
                  (orderGovernorateFilter !== 'all' ? 1 : 0) +
                  (overviewDatePreset !== 'all' ? 1 : 0) +
                  (orderSort !== 'newest' ? 1 : 0)
                }
                onResetFilters={() => {
                  setOrderSearch('');
                  setOrderChannelFilter('all');
                  setOrderStatusFilter('all');
                  setOrderPaymentFilter('all');
                  setOrderGovernorateFilter('all');
                  setOverviewDatePreset('all');
                  setOrderSort('newest');
                  updateUrlQueryParams({ status: null });
                }}
                primarySlot={
                  <>
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => {
                        const nextSt = e.target.value as 'all' | OrderStatus;
                        setOrderStatusFilter(nextSt);
                        updateUrlQueryParams({ status: nextSt === 'all' ? null : nextSt });
                      }}
                      className="min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710]"
                    >
                      <option value="all">كل الحالات ({orders.length})</option>
                      {CANONICAL_ORDER_STATUSES.map((stKey) => (
                        <option key={stKey} value={stKey}>
                          {getOrderStatusMeta(stKey).label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={orderChannelFilter}
                      onChange={(e) =>
                        setOrderChannelFilter(e.target.value as 'all' | 'online' | 'pos')
                      }
                      className="min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710]"
                    >
                      <option value="all">كل القنوات</option>
                      <option value="online">المتجر الأونلاين</option>
                      <option value="pos">كاشير الفرع POS</option>
                    </select>
                  </>
                }
                actionsSlot={
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="min-h-[40px] bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير الجدول CSV</span>
                  </button>
                }
                advancedChildren={
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <select
                        value={overviewDatePreset}
                        onChange={(e) => setOverviewDatePreset(e.target.value as DateRangePreset)}
                        className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710]"
                      >
                        <option value="all">الفترة: كل الفترات</option>
                        <option value="today">الفترة: طلبات اليوم</option>
                        <option value="this_week">الفترة: آخر 7 أيام</option>
                        <option value="this_month">الفترة: هذا الشهر</option>
                        <option value="custom">الفترة: تاريخ مخصص</option>
                      </select>

                      <select
                        value={orderGovernorateFilter}
                        onChange={(e) => setOrderGovernorateFilter(e.target.value)}
                        className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710]"
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
                        className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710]"
                      >
                        <option value="all">كل طرق الدفع</option>
                        <option value="cod">الدفع عند الاستلام (COD)</option>
                        <option value="cash">نقدي بالكاشير (POS)</option>
                        <option value="instapay">تحويل إنستا باي (InstaPay)</option>
                        <option value="vodafone_cash">محفظة فودافون كاش</option>
                        <option value="vip_wallet">محفظة كاش باك VIP</option>
                      </select>

                      <select
                        value={orderSort}
                        onChange={(e) =>
                          setOrderSort(
                            e.target.value as 'newest' | 'oldest' | 'highest' | 'lowest'
                          )
                        }
                        className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710]"
                      >
                        <option value="newest">الترتيب: الأحدث أولاً</option>
                        <option value="oldest">الترتيب: الأقدم أولاً</option>
                        <option value="highest">الترتيب: الأعلى قيمة</option>
                        <option value="lowest">الترتيب: الأقل قيمة</option>
                      </select>
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#E8E0D5]">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderStatusFilter('all');
                          updateUrlQueryParams({ status: null });
                        }}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          orderStatusFilter === 'all'
                            ? 'bg-[#231710] text-white'
                            : 'bg-white text-[#4A3728] border border-[#E8E0D5] hover:bg-[#FAF6F0]'
                        }`}
                      >
                        الكل ({orders.length})
                      </button>
                      {CANONICAL_ORDER_STATUSES.map((stKey) => {
                        const count = orders.filter(
                          (o) =>
                            o.status === stKey ||
                            (stKey === 'roasting_packing' && (o.status as string) === 'preparing')
                        ).length;
                        const info = getOrderStatusMeta(stKey);
                        return (
                          <button
                            key={stKey}
                            type="button"
                            onClick={() => {
                              setOrderStatusFilter(stKey);
                              updateUrlQueryParams({ status: stKey });
                            }}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              orderStatusFilter === stKey
                                ? 'bg-[#231710] text-white'
                                : 'bg-white text-[#4A3728] border border-[#E8E0D5] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            {info.label} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                }
              />

              {/* Financial Audit Strip for Filtered Orders (Admin & Accountant) */}
              {(isFullAdmin || currentRole === 'accountant') && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    title={`مبيعات الفواتير (${filteredOrdersFinancials.validCount})`}
                    value={`${filteredOrdersFinancials.revenue.toLocaleString('ar-EG')} ج.م`}
                    subtitle={`${filteredOrdersFinancials.onlineCount} أونلاين • ${filteredOrdersFinancials.posCount} كاشير`}
                  />
                  <StatCard
                    title="تكلفة البضاعة (COGS)"
                    value={`${filteredOrdersFinancials.cogs.toLocaleString('ar-EG')} ج.م`}
                    subtitle="خامات الجملة وتكاليف التغليف"
                  />
                  <StatCard
                    title="الخصومات والشحن المحصل"
                    value={`-${filteredOrdersFinancials.discounts.toLocaleString('ar-EG')} ج.م`}
                    subtitle={`شحن محصل: ${filteredOrdersFinancials.shipping.toLocaleString('ar-EG')} ج.م`}
                  />
                  <StatCard
                    title="صافي ربح الفواتير"
                    value={`+${filteredOrdersFinancials.netProfit.toLocaleString('ar-EG')} ج.م`}
                    subtitle="بعد خصم تكلفة البضاعة والخصومات"
                    tone={filteredOrdersFinancials.netProfit >= 0 ? 'emerald' : 'rose'}
                    trend={{
                      label: `${filteredOrdersFinancials.marginPercent}%`,
                      tone: filteredOrdersFinancials.netProfit >= 0 ? 'positive' : 'negative',
                    }}
                  />
                </div>
              )}

              {/* Orders DataTableShell (25 rows/page) */}
              <DataTableShell
                totalItems={filteredOrders.length}
                currentPage={ordersPage}
                pageSize={25}
                onPageChange={setOrdersPage}
                emptyState={
                  <div className="p-8 text-center space-y-2">
                    <Package className="w-8 h-8 text-[#8A735E] mx-auto" />
                    <h3 className="text-sm font-bold text-[#231710]">
                      لا توجد طلبات مطابقة للفلاتر المحددة
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderSearch('');
                        setOrderChannelFilter('all');
                        setOrderStatusFilter('all');
                        setOrderPaymentFilter('all');
                        setOrderGovernorateFilter('all');
                        setOrderSort('newest');
                      }}
                      className="min-h-[40px] px-3 text-xs font-bold text-[#6B5644] underline cursor-pointer"
                    >
                      إعادة ضبط جميع الفلاتر
                    </button>
                  </div>
                }
                footerSlot={
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#231710]">
                    <span>
                      إجمالي الفواتير المفلترة: {filteredOrders.length} طلب ({filteredOrdersFinancials.validCount} مؤكدة)
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-pistachio-700">
                        المبيعات: {filteredOrdersFinancials.revenue.toLocaleString('ar-EG')} ج.م
                      </span>
                      {(isFullAdmin || currentRole === 'accountant') && (
                        <>
                          <span className="text-[#9A6836]">
                            التكلفة: {filteredOrdersFinancials.cogs.toLocaleString('ar-EG')} ج.م
                          </span>
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg">
                            صافي الربح: +{filteredOrdersFinancials.netProfit.toLocaleString('ar-EG')} ج.م ({filteredOrdersFinancials.marginPercent}%)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                        <th className="p-3 whitespace-nowrap">رقم الطلب والتاريخ</th>
                        <th className="p-3 whitespace-nowrap">العميل والمنطقة</th>
                        <th className="p-3 whitespace-nowrap">الأصناف والدفع</th>
                        <th className="p-3 whitespace-nowrap">المبلغ الإجمالي</th>
                        <th className="p-3 whitespace-nowrap">الحالة والمندوب</th>
                        <th className="p-3 text-center whitespace-nowrap">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2ECE2] align-top">
                      {paginatedOrders.map((order) => {
                        const st = getOrderStatusMeta(order.status);
                        return (
                          <tr key={order.id} className="hover:bg-[#FAF6F0]/60 transition">
                            {/* Order Number & Date */}
                            <td className="p-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderDetailId(order.id)}
                                  className="font-mono font-bold text-xs bg-[#FAF6F0] hover:bg-[#EFE6D8] text-[#231710] border border-[#E8E0D5] px-2.5 py-1 rounded-lg cursor-pointer transition"
                                >
                                  {order.orderNumber}
                                </button>
                                <span
                                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                                    isPosOrder(order)
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-[#FAF6F0] text-[#4A3728] border-[#E8E0D5]'
                                  }`}
                                >
                                  {isPosOrder(order) ? 'كاشير' : 'أونلاين'}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#6B5644] mt-1">
                                {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                                  dateStyle: 'medium',
                                })}{' '}
                                •{' '}
                                {new Date(order.createdAt).toLocaleTimeString('ar-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>

                            {/* Customer & Region */}
                            <td className="p-3 min-w-[180px] max-w-[230px]">
                              <div className="font-bold text-[#231710]">{order.customerName}</div>
                              <div className="text-[11px] font-mono text-[#6B5644] mt-0.5">
                                {order.customerPhone}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="inline-block text-[11px] font-bold bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2 py-0.5 rounded-md">
                                  {order.governorate}
                                </span>
                                <span className="text-[11px] text-[#6B5A4E] truncate max-w-[160px]">
                                  {order.address}
                                </span>
                              </div>
                            </td>

                            {/* Compact Items & Payment Summary */}
                            <td className="p-3 min-w-[180px] max-w-[240px]">
                              <div className="text-xs font-bold text-[#231710] truncate">
                                {order.items.length} صنف —{' '}
                                {order.items[0] ? stripUiEmojis(order.items[0].productName) : ''}
                                {order.items.length > 1 ? ` (+${order.items.length - 1})` : ''}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
                                  {order.paymentMethod === 'cod'
                                    ? 'عند الاستلام'
                                    : (order.paymentMethod as string) === 'cash'
                                      ? 'نقدي'
                                      : order.paymentMethod === 'instapay'
                                        ? 'إنستا باي'
                                        : (order.paymentMethod as string) === 'vip_wallet'
                                          ? 'محفظة VIP'
                                          : 'فودافون كاش'}
                                </span>
                                {order.paymentReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => setReceiptPreviewOrder(order)}
                                    className="text-[11px] font-bold text-[#9A6836] underline cursor-pointer"
                                  >
                                    إيصال التحويل
                                  </button>
                                )}
                              </div>
                              {order.orderSource !== 'pos' &&
                                order.paymentMethod === 'cod' &&
                                order.status === 'delivered' && (
                                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                        order.riderCodSettled
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : 'bg-amber-50 text-amber-800 border-amber-300'
                                      }`}
                                    >
                                      {order.riderCodSettled
                                        ? 'مورد بالدرج'
                                        : `عهدة ${order.cashCollected ?? order.total} ج`}
                                    </span>
                                    {!order.riderCodSettled && currentRole !== 'accountant' && (
                                      <button
                                        type="button"
                                        disabled={settlingCodOrderId === order.id}
                                        onClick={() => handleAdminSettleRiderCod(order.id)}
                                        className="bg-[#231710] hover:bg-[#3A271C] text-white text-[11px] font-bold px-2 py-0.5 rounded-lg transition cursor-pointer disabled:opacity-50"
                                      >
                                        {settlingCodOrderId === order.id ? 'جاري...' : 'توريد'}
                                      </button>
                                    )}
                                  </div>
                                )}
                            </td>

                            {/* Total & Profit */}
                            <td className="p-3 whitespace-nowrap tabular-nums">
                              <div className="text-sm font-black text-pistachio-700">
                                {order.total} ج.م
                              </div>
                              <div className="text-[11px] text-[#6B5A4E]">
                                شحن: {order.shippingCost === 0 ? 'مجاني' : `${order.shippingCost} ج.م`}
                              </div>
                              {(isFullAdmin || currentRole === 'accountant') && (
                                <div className="text-[11px] text-pistachio-700 font-bold mt-0.5">
                                  ربح: +{Math.round((order.total - calculateOrderCogs(order, products)) * 100) / 100} ج.م
                                </div>
                              )}
                            </td>

                            {/* Status & Rider Assignment */}
                            <td className="p-3 whitespace-nowrap space-y-1.5 min-w-[165px]">
                              <span
                                className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${st?.badgeClass || 'bg-amber-100 text-amber-800 border-amber-200'}`}
                              >
                                {st?.label || order.status || 'قيد المراجعة'}
                              </span>
                              {currentRole !== 'accountant' && (
                                <>
                                  <select
                                    value={(order.status as string) === 'preparing' ? 'roasting_packing' : order.status}
                                    onChange={(e) =>
                                      handleOrderStatusChange(order.id, e.target.value as OrderStatus)
                                    }
                                    className="block w-full min-h-[36px] bg-white border border-[#E8E0D5] text-[#231710] text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-[#231710]"
                                  >
                                    <option value="pending">قيد المراجعة</option>
                                    <option value="confirmed">تم التأكيد</option>
                                    <option value="roasting_packing">جاري التحميص والتغليف</option>
                                    <option value="shipped">خرج مع المندوب</option>
                                    <option value="delivered">تم التسليم</option>
                                    <option value="cancelled">ملغي</option>
                                  </select>
                                  <select
                                    value={order.riderId || ''}
                                    onChange={(e) => {
                                      const selectedRiderId = e.target.value;
                                      const matchedRider = (storeData?.staffAccounts || [])
                                        .filter((s) => s.role === 'delivery_rider')
                                        .find((s) => s.id === selectedRiderId);
                                      handleAssignOrderRider(
                                        order.id,
                                        selectedRiderId,
                                        matchedRider?.displayName || matchedRider?.username || (selectedRiderId ? 'مندوب التوصيل' : '')
                                      );
                                    }}
                                    className="block w-full min-h-[36px] bg-white border border-[#E8E0D5] text-[#231710] text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-[#231710]"
                                  >
                                    <option value="">{order.riderName ? `المندوب: ${order.riderName}` : 'إسناد مندوب...'}</option>
                                    {(storeData?.staffAccounts || [])
                                      .filter((s) => s.role === 'delivery_rider' && s.active !== false)
                                      .map((r) => (
                                        <option key={r.id} value={r.id}>
                                          {r.displayName || r.username}
                                        </option>
                                      ))}
                                    {(!storeData?.staffAccounts ||
                                      !storeData.staffAccounts.some((s) => s.role === 'delivery_rider')) && (
                                      <option value="staff-primary-delivery_rider">
                                        مندوب التوصيل الرئيسي
                                      </option>
                                    )}
                                  </select>
                                </>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderDetailId(order.id)}
                                  className="min-h-[38px] px-2.5 py-1.5 bg-[#FAF6F0] hover:bg-[#EFE6D8] border border-[#E8E0D5] text-[#231710] rounded-lg text-[11px] font-bold transition cursor-pointer"
                                >
                                  التفاصيل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedInvoiceOrder(order);
                                    updateUrlQueryParams({ invoice: order.orderNumber });
                                  }}
                                  className="min-h-[38px] min-w-[38px] p-2 bg-[#231710] hover:bg-[#3A271C] text-white rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                                  title="معاينة وطباعة الفاتورة"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </DataTableShell>

              {/* Order Details SlideOverDrawer */}
              <SlideOverDrawer
                id="admin-order-detail"
                open={Boolean(selectedOrderDetail)}
                onClose={() => {
                  setSelectedOrderDetailId(null);
                  setEditingOrderNotesId(null);
                }}
                title={selectedOrderDetail ? `تفاصيل الطلب #${selectedOrderDetail.orderNumber}` : ''}
                subtitle={
                  selectedOrderDetail
                    ? `${selectedOrderDetail.customerName} • ${selectedOrderDetail.customerPhone}`
                    : undefined
                }
                footer={
                  selectedOrderDetail && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceOrder(selectedOrderDetail);
                            updateUrlQueryParams({ invoice: selectedOrderDetail.orderNumber });
                          }}
                          className="min-h-[40px] px-4 py-2 bg-[#231710] hover:bg-[#3A271C] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة الفاتورة</span>
                        </button>
                        <a
                          href={`https://wa.me/${formatWhatsAppPhone(selectedOrderDetail.customerPhone)}?text=${encodeURIComponent(
                            `مرحباً أ/ ${selectedOrderDetail.customerName}، بخصوص طلبك رقم ${selectedOrderDetail.orderNumber} من ${settings.storeName}...`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[40px] px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب العميل</span>
                        </a>
                      </div>
                      {isFullAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteOrder(selectedOrderDetail.id);
                            setSelectedOrderDetailId(null);
                          }}
                          className="min-h-[40px] px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف الطلب</span>
                        </button>
                      )}
                    </div>
                  )
                }
              >
                {selectedOrderDetail && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E8E0D5] text-xs">
                      <div>
                        <span className="text-[#6B5A4E] block text-[11px]">العنوان والمحافظة</span>
                        <strong className="text-[#231710] block mt-0.5">
                          {selectedOrderDetail.governorate} — {selectedOrderDetail.address}
                        </strong>
                        {selectedOrderDetail.customerAltPhone && (
                          <span className="text-[11px] font-mono text-[#6B5A4E] block mt-1">
                            هاتف بديل: {selectedOrderDetail.customerAltPhone}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[#6B5A4E] block text-[11px]">الدفع والمرجع</span>
                        <strong className="text-[#231710] block mt-0.5">
                          {selectedOrderDetail.paymentMethod} • الإجمالي: {selectedOrderDetail.total} ج.م
                        </strong>
                        {selectedOrderDetail.paymentReference && (
                          <span className="text-[11px] font-mono text-[#6B5A4E] block mt-1">
                            مرجع: {selectedOrderDetail.paymentReference}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Editable Order Notes */}
                    <div className="p-3.5 rounded-xl border border-[#E8E0D5] bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#231710]">ملاحظات الطلب</span>
                        {currentRole !== 'accountant' && editingOrderNotesId !== selectedOrderDetail.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrderNotesId(selectedOrderDetail.id);
                              setOrderNotesDraft(selectedOrderDetail.notes || '');
                            }}
                            className="text-xs font-bold text-[#9A6836] hover:underline cursor-pointer"
                          >
                            تعديل الملاحظات
                          </button>
                        )}
                      </div>
                      {editingOrderNotesId === selectedOrderDetail.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={orderNotesDraft}
                            onChange={(e) => setOrderNotesDraft(e.target.value)}
                            placeholder="ملاحظات الطلب..."
                            className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveOrderNotes(selectedOrderDetail.id)}
                              className="min-h-[38px] bg-[#231710] text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOrderNotesId(null)}
                              className="min-h-[38px] text-xs text-[#6B5A4E] px-2.5 py-1.5 cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#6B5A4E]">
                          {selectedOrderDetail.notes || 'بدون ملاحظات'}
                        </p>
                      )}
                    </div>

                    {/* Ordered Items List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-[#231710]">
                        الأصناف المطلوبة ({selectedOrderDetail.items.length})
                      </h4>
                      {selectedOrderDetail.items.map((item, idx) => (
                        <div
                          key={item.cartItemId || `${selectedOrderDetail.id}-item-${idx}`}
                          className="bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5] text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#231710]">
                              {stripUiEmojis(item.productName)} × {item.quantity}
                            </span>
                            <span className="font-bold text-[#231710]">
                              {item.unitPrice * item.quantity} ج.م
                            </span>
                          </div>
                          {item.isCustomMix && item.customBreakdown ? (
                            <div className="text-[11px] text-[#6B5A4E] mt-1.5 pr-2 border-r-2 border-[#9A6836] space-y-0.5">
                              {item.customBreakdown.map((b, bIdx) => (
                                <div key={b.productId ? `${b.productId}-${bIdx}` : bIdx}>
                                  • {stripUiEmojis(b.productName)} ({b.roastOption}) — {b.weightGrams}جم ({b.percentage}%)
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#6B5A4E] mt-0.5">
                              {item.weightLabel} • {item.roastOption}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SlideOverDrawer>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODULE 3: FULL PRODUCTS, WEIGHTS & ROASTS CRUD                    */}
          {/* ================================================================= */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Shopify Polaris-style FilterToolbar & Grouped Actions */}
              <FilterToolbar
                searchValue={productSearch}
                onSearchChange={setProductSearch}
                searchPlaceholder="ابحث بالاسم، المنشأ، الشارة، أو الرابط..."
                activeFiltersCount={
                  (productCategoryFilter !== 'all' ? 1 : 0) +
                  (productStockFilter !== 'all' ? 1 : 0) +
                  (productChannelFilter !== 'all' ? 1 : 0) +
                  (productFeaturedFilter !== 'all' ? 1 : 0) +
                  (productRoastFilter !== 'all' ? 1 : 0) +
                  (productSort !== 'default' ? 1 : 0)
                }
                onResetFilters={() => {
                  setProductSearch('');
                  setProductCategoryFilter('all');
                  setProductStockFilter('all');
                  setProductChannelFilter('all');
                  setProductFeaturedFilter('all');
                  setProductRoastFilter('all');
                  setProductSort('default');
                  updateUrlQueryParams({ cat: null });
                }}
                primarySlot={
                  <>
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductCategoryFilter(val);
                        updateUrlQueryParams({ cat: val === 'all' ? null : val });
                      }}
                      className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                    >
                      <option value="all">جميع الأقسام ({categories.length})</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatCategoryName(c.name)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={productStockFilter}
                      onChange={(e) =>
                        setProductStockFilter(e.target.value as 'all' | 'in' | 'low' | 'out')
                      }
                      className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                    >
                      <option value="all">كل حالات التوفر</option>
                      <option value="in">متوفر في المخزون</option>
                      <option value="low">نواقص حرجة (5 كجم فأقل)</option>
                      <option value="out">غير متوفر (نافد)</option>
                    </select>
                  </>
                }
                actionsSlot={
                  <div className="flex flex-wrap items-center gap-2">
                    <ExportMenu
                      label="تصدير ▾"
                      items={[
                        {
                          id: 'scale-plu',
                          label: 'تصدير شيت الميزان (PLU CSV)',
                          description: 'تصدير أصناف وأكواد وأسعار الميزان الإلكتروني',
                          icon: <Scale className="w-4 h-4 text-[#9A6836]" />,
                          onClick: () => {
                            downloadScalePluCsv(products);
                            showToast('تم تصدير ملف أصناف وأسعار الميزان الإلكتروني (PLU CSV) بنجاح');
                          },
                        },
                      ]}
                    />
                    {isFullAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsRapidBarcodeModalOpen(true)}
                        className="min-h-[40px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[#231710] text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        title="تكويد سريع بقارئ الباركود 20 شعاع أو استيراد شيت CSV للماركت"
                      >
                        <Barcode className="w-4 h-4 text-[#9A6836]" />
                        <span>تكويد سريع بالباركود / CSV</span>
                      </button>
                    )}
                    {isFullAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsInventoryAdjustmentModalOpen(true)}
                        className="min-h-[40px] bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-[#231710] text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        title="تسوية الجرد الفعلي ومطابقة أرصدة الصوامع والمخزن"
                      >
                        <Scale className="w-4 h-4 text-[#9A6836]" />
                        <span>تسوية الجرد الفعلي للمخزون</span>
                      </button>
                    )}
                    {isFullAdmin && (
                      <button
                        type="button"
                        onClick={openCreateProductModal}
                        className="min-h-[40px] bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-white" />
                        <span>إضافة منتج جديد</span>
                      </button>
                    )}
                  </div>
                }
                advancedChildren={
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <select
                        value={productChannelFilter}
                        onChange={(e) =>
                          setProductChannelFilter(
                            e.target.value as 'all' | 'online' | 'pos' | 'hidden'
                          )
                        }
                        className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                      >
                        <option value="all">قنوات البيع: الكل</option>
                        <option value="online">متاح بالمتجر الإلكتروني</option>
                        <option value="pos">متاح بالكاشير (POS)</option>
                        <option value="hidden">مخفي من قناة واحدة على الأقل</option>
                      </select>

                      <select
                        value={productFeaturedFilter}
                        onChange={(e) =>
                          setProductFeaturedFilter(
                            e.target.value as 'all' | 'featured' | 'regular'
                          )
                        }
                        className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                      >
                        <option value="all">التمييز: الكل</option>
                        <option value="featured">مميز في الرئيسية</option>
                        <option value="regular">غير مميز</option>
                      </select>

                      <select
                        value={productSort}
                        onChange={(e) =>
                          setProductSort(
                            e.target.value as 'default' | 'price_asc' | 'price_desc' | 'rating_desc'
                          )
                        }
                        className="min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                      >
                        <option value="default">الترتيب: الافتراضي</option>
                        <option value="price_asc">السعر: الأقل أولاً</option>
                        <option value="price_desc">السعر: الأعلى أولاً</option>
                        <option value="rating_desc">التقييم: الأعلى أولاً</option>
                      </select>
                    </div>

                    {/* Roast Option Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E8E0D5]">
                      <span className="text-xs font-bold text-[#6B5A4E] ml-1">
                        فلترة حسب التحميص:
                      </span>
                      <button
                        type="button"
                        onClick={() => setProductRoastFilter('all')}
                        className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          productRoastFilter === 'all'
                            ? 'bg-[#231710] text-white'
                            : 'bg-white text-[#231710] border border-[#E8E0D5] hover:bg-[#FAF6F0]'
                        }`}
                      >
                        كل التحميصات
                      </button>
                      {ALL_ROAST_OPTIONS.map((roast) => (
                        <button
                          key={roast}
                          type="button"
                          onClick={() => setProductRoastFilter(roast)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            productRoastFilter === roast
                              ? 'bg-[#231710] text-white'
                              : 'bg-white text-[#231710] border border-[#E8E0D5] hover:bg-[#FAF6F0]'
                          }`}
                        >
                          {roast}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              />

              {/* Full Product Create / Edit SlideOverDrawer */}
              <SlideOverDrawer
                id="admin-product-editor"
                open={Boolean(editingProduct)}
                onClose={() => {
                  setEditingProduct(null);
                  setIsCreatingProduct(false);
                  updateUrlQueryParams({ productModal: null });
                }}
                title={
                  editingProduct
                    ? isCreatingProduct
                      ? 'إضافة منتج جديد إلى المتجر'
                      : `تحرير المنتج: ${editingProduct.name}`
                    : ''
                }
                subtitle={
                  editingProduct
                    ? `التصنيف والأسعار والمخزون وقنوات البيع`
                    : undefined
                }
                widthClassName="max-w-3xl"
                footer={
                  editingProduct && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(null);
                          setIsCreatingProduct(false);
                          updateUrlQueryParams({ productModal: null });
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-[#6B5644] hover:bg-[#FAF6F0] cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        form="admin-product-editor-form"
                        disabled={saving}
                        className="min-h-[44px] bg-[#231710] hover:bg-[#3A271C] text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'جاري الحفظ...' : 'حفظ ونشر التعديلات'}</span>
                      </button>
                    </div>
                  )
                }
              >
                {editingProduct && (
                  <form
                    id="admin-product-editor-form"
                    onSubmit={handleSaveProductModal}
                    className="space-y-4"
                  >
                    {/* Basic Info Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">اسم المنتج *</label>
                        <input
                          type="text"
                          required
                          value={editingProduct.name}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, name: e.target.value })
                          }
                          placeholder="مثال: فستق أمريكي جامبو محمص"
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">القسم *</label>
                        <select
                          value={editingProduct.categoryId}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, categoryId: e.target.value })
                          }
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {formatCategoryName(c.name)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">الرابط المختصر</label>
                        <input
                          type="text"
                          value={editingProduct.slug}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, slug: e.target.value })
                          }
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-mono text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>
                    </div>

                    {/* Origin, Badge, Image */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">بلد المنشأ / درجة الفرز</label>
                        <input
                          type="text"
                          value={editingProduct.origin}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, origin: e.target.value })
                          }
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">الشارة المميزة</label>
                        <input
                          type="text"
                          value={editingProduct.badge || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, badge: e.target.value })
                          }
                          placeholder="الأكثر مبيعاً / تحميص اليوم"
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <ImageUploadDropzone
                          currentImage={editingProduct.image}
                          onImageSelected={(url) => setEditingProduct({ ...editingProduct, image: url })}
                          label="صورة المنتج المضغوطة"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs font-bold text-[#6B5A4E] shrink-0">أو رابط يدوي:</span>
                          <input
                            type="text"
                            value={editingProduct.image}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, image: e.target.value })
                            }
                            placeholder="/images/products/pistachio.jpg أو رابط صورة خارجي"
                            className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1 text-xs font-mono text-[#231710] outline-none focus:border-[#231710]"
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
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                                editingProduct.image === imgOpt.url
                                  ? 'bg-[#231710] text-white border-[#231710]'
                                  : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#F2EAE0]'
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
                        <ProductGalleryEditor
                          primaryImage={editingProduct.image}
                          gallery={editingProduct.gallery || []}
                          onChangePrimary={(url) =>
                            setEditingProduct((prev) => (prev ? { ...prev, image: url } : prev))
                          }
                          onChangeGallery={(nextGallery) =>
                            setEditingProduct((prev) =>
                              prev ? { ...prev, gallery: nextGallery } : prev
                            )
                          }
                          presetImages={LOCAL_PRODUCT_IMAGES}
                        />
                        <ProductAdStudioEditor
                          product={editingProduct}
                          onChange={(patch) =>
                            setEditingProduct((prev) => (prev ? { ...prev, ...patch } : prev))
                          }
                        />
                      </div>
                    </div>

                    {/* Subtitle & Description */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">الوصف المختصر</label>
                        <input
                          type="text"
                          value={editingProduct.subtitle}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, subtitle: e.target.value })
                          }
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">الوصف التفصيلي الكامل</label>
                        <textarea
                          rows={2}
                          value={editingProduct.description}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, description: e.target.value })
                          }
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>
                    </div>

                    {/* Nutrition & Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E8E0D5]">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold mb-1 text-[#231710]">القيمة والفائدة الغذائية</label>
                        <input
                          type="text"
                          value={editingProduct.nutritionalHighlight}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              nutritionalHighlight: e.target.value,
                            })
                          }
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">السعرات (لكل 100 جم)</label>
                        <input
                          type="number"
                          value={editingProduct.caloriesPer100g}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              caloriesPer100g: Number(e.target.value),
                            })
                          }
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 text-[#231710]">البروتين (لكل 100 جم)</label>
                        <input
                          type="text"
                          value={editingProduct.proteinPer100g}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              proteinPer100g: e.target.value,
                            })
                          }
                          className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                        />
                      </div>
                    </div>

                    {/* Dual Selling Mode Selector (Weight vs Unit/Pack) */}
                    <div className="pt-2 border-t border-[#E8E0D5] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold text-[#231710]">
                          نظام بيع وتسعير الصنف:
                        </label>
                        <div className="inline-flex bg-[#FAF6F0] p-1 rounded-xl border border-[#E8E0D5] gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const hasGramWeights = editingProduct.weights.some(
                                (w) => !w.unitsCount && w.weightGrams > 0 && w.weightGrams !== 1000
                              );
                              setEditingProduct({
                                ...editingProduct,
                                sellingMode: 'weight',
                                weights: hasGramWeights
                                  ? editingProduct.weights
                                  : [
                                      { id: 'w-250', label: '250 جم (ربع كيلو)', weightGrams: 250, price: 180 },
                                      { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 350 },
                                      { id: 'w-1000', label: '1 كجم (كيلو كامل)', weightGrams: 1000, price: 680 },
                                    ],
                              });
                            }}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              editingProduct.sellingMode !== 'unit'
                                ? 'bg-[#231710] text-white'
                                : 'text-[#6E5D4F] hover:text-[#231710]'
                            }`}
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>بيع بالوزن (جرام / كجم)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const defUnitLabel = editingProduct.unitLabel || 'عبوة';
                              const defUnitPrice =
                                editingProduct.unitPrice || editingProduct.weights[0]?.price || 150;
                              const defUnitCost =
                                editingProduct.unitCost ||
                                editingProduct.costPerKg ||
                                Math.round(defUnitPrice * 0.68);
                              const hasUnitWeights = editingProduct.weights.some(
                                (w) => typeof w.unitsCount === 'number' && w.unitsCount > 0
                              );
                              setEditingProduct({
                                ...editingProduct,
                                sellingMode: 'unit',
                                unitLabel: defUnitLabel,
                                unitPrice: defUnitPrice,
                                unitCost: defUnitCost,
                                roastOptions: [],
                                weights: hasUnitWeights
                                  ? editingProduct.weights
                                  : [
                                      {
                                        id: 'u-1',
                                        label: `${defUnitLabel} واحدة`,
                                        unitsCount: 1,
                                        weightGrams: 1000,
                                        grams: 1000,
                                        price: defUnitPrice,
                                      },
                                    ],
                              });
                            }}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              editingProduct.sellingMode === 'unit'
                                ? 'bg-[#231710] text-white'
                                : 'text-[#6E5D4F] hover:text-[#231710]'
                            }`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>بيع بالقطعة / العبوة</span>
                          </button>
                        </div>
                      </div>

                      {editingProduct.sellingMode === 'unit' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E8E0D5]">
                          <div>
                            <label className="block text-[11px] font-bold mb-1 text-[#231710]">
                              مسمى الوحدة (قطعة / عبوة / علبة / برطمان)
                            </label>
                            <input
                              type="text"
                              value={editingProduct.unitLabel || 'عبوة'}
                              onChange={(e) =>
                                setEditingProduct({ ...editingProduct, unitLabel: e.target.value })
                              }
                              placeholder="عبوة"
                              className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-lg px-3 py-1.5 text-xs font-bold text-[#231710]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold mb-1 text-[#231710]">
                              سعر بيع الوحدة الأساسية ({currencySymbolDraft})
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={editingProduct.unitPrice ?? editingProduct.weights[0]?.price ?? 150}
                              onChange={(e) => {
                                const nextPrice = Number(e.target.value);
                                const updatedWeights = [...editingProduct.weights];
                                if (updatedWeights.length === 1) {
                                  updatedWeights[0] = { ...updatedWeights[0], price: nextPrice };
                                }
                                setEditingProduct({
                                  ...editingProduct,
                                  unitPrice: nextPrice,
                                  pricePerKg: nextPrice,
                                  weights: updatedWeights,
                                });
                              }}
                              className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-lg px-3 py-1.5 text-xs font-bold text-pistachio-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold mb-1 text-[#231710]">
                              تكلفة جملة الوحدة ({currencySymbolDraft})
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={editingProduct.unitCost ?? editingProduct.costPerKg ?? 100}
                              onChange={(e) => {
                                const nextCost = Number(e.target.value);
                                setEditingProduct({
                                  ...editingProduct,
                                  unitCost: nextCost,
                                  costPerKg: nextCost,
                                });
                              }}
                              className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-lg px-3 py-1.5 text-xs font-bold text-[#9A6836]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold mb-1 text-[#231710]">
                              سعر بيع الكيلو المرجعي ({currencySymbolDraft} / كجم)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={
                                editingProduct.weights.find(
                                  (w) => (w.weightGrams || w.grams) === 1000
                                )?.price ??
                                editingProduct.pricePerKg ??
                                680
                              }
                              onChange={(e) => {
                                const nextKilo = Math.max(0, Number(e.target.value) || 0);
                                const syncedWeights = editingProduct.weights.map((w) => {
                                  const g = w.weightGrams || w.grams || 0;
                                  if (g > 0 && nextKilo > 0) {
                                    return {
                                      ...w,
                                      price: Math.round((nextKilo * g) / 1000),
                                    };
                                  }
                                  return w;
                                });
                                setEditingProduct({
                                  ...editingProduct,
                                  pricePerKg: nextKilo,
                                  weights: syncedWeights,
                                });
                              }}
                              className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-lg px-3 py-1.5 text-xs font-bold text-pistachio-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold mb-1 text-[#231710]">
                              تكلفة جملة الكيلو — لحساب الأرباح ({currencySymbolDraft} / كجم)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={editingProduct.costPerKg ?? 0}
                              onChange={(e) => {
                                const nextCost = Math.max(0, Number(e.target.value) || 0);
                                setEditingProduct({
                                  ...editingProduct,
                                  costPerKg: nextCost,
                                });
                              }}
                              className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-lg px-3 py-1.5 text-xs font-bold text-[#9A6836]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Roast / Custom Options Checkboxes */}
                    <div className="pt-2 border-t border-[#E8E0D5] space-y-1.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        {editingProduct.sellingMode === 'unit'
                          ? 'خيارات إضافية اختيارية للصنف (اتركها فارغة إن لم توجد):'
                          : 'خيارات التحميص المتاحة لهذا الصنف:'}
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
                              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                                checked
                                  ? 'bg-[#231710] text-white border-[#231710]'
                                  : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3" />}
                              <span>{roast}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Weights or Unit Packs Editor */}
                    <div className="pt-2 border-t border-brand-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-brand-950">
                          {editingProduct.sellingMode === 'unit'
                            ? `العبوات / الباقات المتاحة (${editingProduct.weights.length}):`
                            : `الأوزان والأسعار المتاحة (${editingProduct.weights.length}):`}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const isUnit = editingProduct.sellingMode === 'unit';
                            const newWeight: WeightVariant = isUnit
                              ? {
                                  id: `u-${Date.now()}`,
                                  label: `باقة 2 ${editingProduct.unitLabel || 'عبوة'}`,
                                  unitsCount: 2,
                                  weightGrams: 2000,
                                  grams: 2000,
                                  price: (editingProduct.unitPrice || 150) * 2,
                                }
                              : {
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
                          className="min-h-[38px] text-[11px] bg-amber-100 hover:bg-amber-200 text-brand-950 font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>
                            {editingProduct.sellingMode === 'unit'
                              ? 'إضافة حجم عبوة / عرض باقة'
                              : 'إضافة وزن جديد'}
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {editingProduct.weights.map((w, idx) => (
                          <div
                            key={w.id}
                            className="bg-brand-50 p-3 rounded-xl border border-brand-200 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-brand-700">
                                {editingProduct.sellingMode === 'unit'
                                  ? `عبوة #${idx + 1}`
                                  : `وزن #${idx + 1}`}
                              </span>
                              {editingProduct.weights.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextW = editingProduct.weights.filter((_, i) => i !== idx);
                                    setEditingProduct({ ...editingProduct, weights: nextW });
                                  }}
                                  className="text-red-500 hover:text-red-700 text-[11px] font-bold cursor-pointer"
                                >
                                  حذف
                                </button>
                              )}
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold mb-0.5">
                                {editingProduct.sellingMode === 'unit' ? 'مسمى العبوة' : 'مسمى الوزن'}
                              </label>
                              <input
                                type="text"
                                value={w.label}
                                onChange={(e) => {
                                  const updated = [...editingProduct.weights];
                                  updated[idx] = { ...w, label: e.target.value };
                                  setEditingProduct({ ...editingProduct, weights: updated });
                                }}
                                className="w-full min-h-[38px] bg-white border border-brand-200 rounded-lg px-2 py-1 text-xs font-bold"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-1.5">
                              <div>
                                <label className="block text-[11px] font-bold mb-0.5">
                                  {editingProduct.sellingMode === 'unit' ? 'عدد الوحدات' : 'بالجرام'}
                                </label>
                                {editingProduct.sellingMode === 'unit' ? (
                                  <input
                                    type="number"
                                    min={1}
                                    value={w.unitsCount ?? 1}
                                    onChange={(e) => {
                                      const units = Math.max(1, Number(e.target.value) || 1);
                                      const updated = [...editingProduct.weights];
                                      updated[idx] = {
                                        ...w,
                                        unitsCount: units,
                                        weightGrams: units * 1000,
                                        grams: units * 1000,
                                      };
                                      setEditingProduct({ ...editingProduct, weights: updated });
                                    }}
                                    className="w-full min-h-[38px] bg-white border border-brand-200 rounded-lg px-2 py-1 text-xs font-bold"
                                  />
                                ) : (
                                  <input
                                    type="number"
                                    value={w.weightGrams}
                                    onChange={(e) => {
                                      const updated = [...editingProduct.weights];
                                      updated[idx] = { ...w, weightGrams: Number(e.target.value) };
                                      setEditingProduct({ ...editingProduct, weights: updated });
                                    }}
                                    className="w-full min-h-[38px] bg-white border border-brand-200 rounded-lg px-2 py-1 text-xs font-bold"
                                  />
                                )}
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold mb-0.5">
                                  السعر ({currencySymbolDraft})
                                </label>
                                <input
                                  type="number"
                                  value={w.price}
                                  onChange={(e) => {
                                    const updated = [...editingProduct.weights];
                                    updated[idx] = { ...w, price: Number(e.target.value) };
                                    setEditingProduct({ ...editingProduct, weights: updated });
                                  }}
                                  className="w-full min-h-[38px] bg-white border border-brand-300 rounded-lg px-2 py-1 text-xs font-black text-pistachio-700"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold mb-0.5">قبل الخصم</label>
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
                                  className="w-full min-h-[38px] bg-white border border-brand-200 rounded-lg px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Availability, Stock KG/Units, Channels & Featured Flags */}
                    <div className="space-y-3 pt-3 border-t border-brand-200">
                      <div className="flex flex-wrap items-center gap-4 bg-brand-50 p-3 rounded-xl border border-brand-200">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-black text-brand-950">
                            {editingProduct.sellingMode === 'unit'
                              ? `رصيد المخزون الفعلي (${editingProduct.unitLabel || 'قطعة'}):`
                              : 'رصيد المخزون الفعلي (كجم):'}
                          </label>
                          <input
                            type="number"
                            step={editingProduct.sellingMode === 'unit' ? '1' : '0.01'}
                            min="0"
                            value={editingProduct.stockKg ?? 50}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                stockKg: Number(e.target.value),
                              })
                            }
                            className="w-24 min-h-[38px] bg-white border border-brand-300 rounded-lg px-2.5 py-1 text-xs font-black text-brand-900"
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

                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingProduct.showOnline !== false}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, showOnline: e.target.checked })
                            }
                            className="rounded text-[#231710]"
                          />
                          <span>متاح بالمتجر الإلكتروني</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingProduct.showInPos !== false}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, showInPos: e.target.checked })
                            }
                            className="rounded text-[#231710]"
                          />
                          <span>متاح بالكاشير (POS)</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingProduct.featured}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, featured: e.target.checked })
                            }
                            className="rounded text-[#231710]"
                          />
                          <span>منتج مميز في الرئيسية</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-amber-900">
                          <input
                            type="checkbox"
                            checked={Boolean(editingProduct.taxExempt)}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, taxExempt: e.target.checked })
                            }
                            className="rounded text-amber-700"
                          />
                          <span>معفى من ضريبة القيمة المضافة</span>
                        </label>
                      </div>

                      {/* Barcode / PLU & Optional Egyptian ETA Item Code */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E8E0D5]">
                        <div>
                          <label className="block text-[11px] font-bold text-[#231710] mb-1">
                            باركود الصنف أو كود الميزان (SKU / EAN-13 / PLU)
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={editingProduct.barcode || ''}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                barcode: e.target.value.trim() || undefined,
                              })
                            }
                            placeholder="مثال: 6221234567890 أو 200001"
                            className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-mono text-[#231710]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#231710] mb-1">
                            كود الصنف الضريبي الاختياري (EGS / GS1)
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={editingProduct.etaItemCode || ''}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                etaItemCode: e.target.value.trim() || undefined,
                              })
                            }
                            placeholder="مثال: EG-100000000-1001"
                            className="w-full min-h-[40px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-mono text-[#231710]"
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </SlideOverDrawer>

              {/* 4 Inventory Valuation & Margin Summary Cards (Admin & Accountant) */}
              {(isFullAdmin || currentRole === 'accountant') && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    title="إجمالي الوزن الفعلي بالمخزن"
                    value={`${productsInventoryValuation.totalStockKg.toLocaleString('ar-EG')} كجم`}
                    subtitle={`موزعة على ${products.length} صنف`}
                  />
                  <StatCard
                    title="قيمة المخزون بالتكلفة"
                    value={`${productsInventoryValuation.totalCostValuation.toLocaleString('ar-EG')} ج.م`}
                    subtitle="شامل تكلفة الخامات والتغليف"
                  />
                  <StatCard
                    title="قيمة المخزون بسعر البيع"
                    value={`${productsInventoryValuation.totalRetailValuation.toLocaleString('ar-EG')} ج.م`}
                    subtitle="تقييم البيع التقديري للكيلو"
                  />
                  <StatCard
                    title="الربح الكامن من المخزون"
                    value={`+${productsInventoryValuation.potentialInventoryProfit.toLocaleString('ar-EG')} ج.م`}
                    subtitle="متوسط هامش الربح للصنف"
                    tone="emerald"
                    trend={{
                      label: `${productsInventoryValuation.avgMarginPercent}%`,
                      tone: 'positive',
                    }}
                  />
                </div>
              )}

              {/* Products Data Table */}
              <DataTableShell
                totalItems={filteredProducts.length}
                currentPage={productsPage}
                pageSize={25}
                onPageChange={setProductsPage}
                selectedCount={isFullAdmin ? selectedProductIds.length : 0}
                onClearSelection={() => setSelectedProductIds([])}
                bulkActionsSlot={
                  isFullAdmin ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleBulkUpdateProducts(
                            { showOnline: true },
                            'تم إظهار المنتجات المحددة على المتجر الإلكتروني'
                          )
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-brand-200 text-[#231710] hover:bg-[#FAF6F0] transition"
                      >
                        إظهار أونلاين
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleBulkUpdateProducts(
                            { showOnline: false },
                            'تم إخفاء المنتجات المحددة عن المتجر الإلكتروني'
                          )
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition"
                      >
                        إخفاء أونلاين
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleBulkUpdateProducts(
                            { showInPos: true },
                            'تم إتاحة المنتجات المحددة في الكاشير (POS)'
                          )
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition"
                      >
                        إتاحة بالكاشير
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleBulkUpdateProducts(
                            { showInPos: false },
                            'تم تعطيل المنتجات المحددة في الكاشير (POS)'
                          )
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition"
                      >
                        تعطيل بالكاشير
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleBulkUpdateProducts(
                            { inStock: true },
                            'تم تحديد المنتجات المحددة كمتوفرة بالمخزون'
                          )
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-pistachio-50 border border-pistachio-200 text-pistachio-800 hover:bg-pistachio-100 transition"
                      >
                        تحديد كمتوفر
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleBulkUpdateProducts(
                            { inStock: false },
                            'تم تحديد المنتجات المحددة كنافدة'
                          )
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition"
                      >
                        تحديد كنافد
                      </button>
                    </div>
                  ) : undefined
                }
                emptyState={
                  <div className="p-8 text-center space-y-2">
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
                        setProductChannelFilter('all');
                        setProductSort('default');
                      }}
                      className="min-h-[40px] px-3 text-xs font-bold text-brand-700 underline"
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  </div>
                }
              >
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                      {isFullAdmin && (
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            aria-label="تحديد كل المنتجات في هذه الصفحة"
                            checked={
                              paginatedProducts.length > 0 &&
                              paginatedProducts.every((p) => selectedProductIds.includes(p.id))
                            }
                            onChange={(e) => {
                              const pageIds = paginatedProducts.map((p) => p.id);
                              if (e.target.checked) {
                                setSelectedProductIds((prev) =>
                                  Array.from(new Set([...prev, ...pageIds]))
                                );
                              } else {
                                setSelectedProductIds((prev) =>
                                  prev.filter((id) => !pageIds.includes(id))
                                );
                              }
                            }}
                            className="w-4 h-4 accent-brand-700 cursor-pointer rounded"
                          />
                        </th>
                      )}
                      <th className="p-3 whitespace-nowrap">الصنف والرابط</th>
                      <th className="p-3 whitespace-nowrap">القسم والمنشأ</th>
                      <th className="p-3">الأوزان والأسعار (ج.م)</th>
                      {(isFullAdmin || currentRole === 'accountant') && (
                        <th className="p-3 whitespace-nowrap">التكلفة وهامش الربح (للكيلو)</th>
                      )}
                      <th className="p-3">خيارات التحميص</th>
                      <th className="p-3 whitespace-nowrap">التقييم والقيم</th>
                      <th className="p-3 whitespace-nowrap text-center">المخزون والقنوات والتمييز</th>
                      <th className="p-3 whitespace-nowrap text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 align-top">
                    {paginatedProducts.map((prod) => {
                      const catName = formatCategoryName(
                        categories.find((c) => c.id === prod.categoryId)?.name || prod.categoryId
                      );
                      const isSelected = selectedProductIds.includes(prod.id);
                      return (
                        <tr
                          key={prod.id}
                          className={`transition ${
                            isSelected ? 'bg-amber-50/50' : 'hover:bg-[#FAF6F0]/60'
                          }`}
                        >
                          {isFullAdmin && (
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={`تحديد ${prod.name}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProductIds((prev) =>
                                      prev.includes(prod.id) ? prev : [...prev, prod.id]
                                    );
                                  } else {
                                    setSelectedProductIds((prev) =>
                                      prev.filter((id) => id !== prod.id)
                                    );
                                  }
                                }}
                                className="w-4 h-4 accent-brand-700 cursor-pointer rounded"
                              />
                            </td>
                          )}
                          {/* Product Image, Name, Badge & Slug */}
                          <td className="p-3 min-w-[210px]">
                            <div className="flex items-start gap-2.5">
                              <img
                                src={getSafeImageUrl(prod.image)}
                                alt={prod.name}
                                className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#FAF6F0] border border-[#E8E0D5]"
                              />
                              <div className="min-w-0 space-y-0.5">
                                <div className="font-bold text-[#231710] text-xs leading-snug flex items-center gap-1.5 flex-wrap">
                                  <span>{prod.name}</span>
                                  <span
                                    className={`text-[11px] px-1.5 py-0.5 rounded font-bold border ${
                                      isUnitProduct(prod)
                                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                                        : 'bg-amber-50 text-amber-900 border-amber-200'
                                    }`}
                                  >
                                    {isUnitProduct(prod)
                                      ? `بالقطعة (${getProductStockUnitLabel(prod)})`
                                      : 'بالوزن'}
                                  </span>
                                </div>
                                {prod.badge && stripUiEmojis(prod.badge) && (
                                  <span className="inline-block text-[11px] bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836] px-1.5 py-0.5 rounded font-bold">
                                    {stripUiEmojis(prod.badge)}
                                  </span>
                                )}
                                <div className="text-[11px] font-mono text-[#6B5A4E] truncate">
                                  /{prod.slug}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category & Origin */}
                          <td className="p-3 whitespace-nowrap">
                            <span className="inline-block text-xs font-bold bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2 py-0.5 rounded-md">
                              {catName}
                            </span>
                            <div className="text-xs text-[#6B5A4E] font-medium mt-1">
                              {prod.origin}
                            </div>
                          </td>

                          {/* Weights & Prices */}
                          <td className="p-3 min-w-[200px]">
                            <div className="space-y-1">
                              {prod.weights.map((w) => (
                                <div
                                  key={w.id}
                                  className="flex items-center justify-between gap-2 bg-[#FAF6F0] px-2 py-1 rounded-lg border border-[#E8E0D5] text-[11px]"
                                >
                                  <span className="font-bold text-[#231710]">{w.label}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <strong className="text-pistachio-700 font-bold">
                                      {w.price} ج.م
                                    </strong>
                                    {w.originalPrice && (
                                      <span className="line-through text-[#6E5D4F]">
                                        {w.originalPrice}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Cost & Profit Margin per Kg (Admin & Accountant) */}
                          {(isFullAdmin || currentRole === 'accountant') &&
                            (() => {
                              const w1000 = prod.weights.find(
                                (w) => w.weightGrams === 1000 || w.grams === 1000
                              );
                              const retailKg =
                                typeof prod.pricePerKg === 'number' && prod.pricePerKg > 0
                                  ? prod.pricePerKg
                                  : w1000?.price ||
                                    (prod.weights[0]?.price ? prod.weights[0].price * 4 : 400);
                              const rawCostKg =
                                typeof prod.costPerKg === 'number' && prod.costPerKg > 0
                                  ? prod.costPerKg
                                  : Math.round(retailKg * 0.68);
                              const packCostKg =
                                typeof prod.packagingCost === 'number' ? prod.packagingCost : 0;
                              const totalCostKg = rawCostKg + packCostKg;
                              const profitKg = Math.round((retailKg - totalCostKg) * 100) / 100;
                              const marginPct =
                                retailKg > 0 ? Math.round((profitKg / retailKg) * 1000) / 10 : 0;
                              return (
                                <td className="p-3 whitespace-nowrap">
                                  <div className="space-y-1 text-[11px]">
                                    <div className="text-[#9A6836] font-bold">
                                      تكلفة جملة: {rawCostKg} ج.م
                                      {packCostKg > 0 ? ` (+${packCostKg} تغليف)` : ''}
                                    </div>
                                    <div className="text-[#231710] font-bold">
                                      {isUnitProduct(prod)
                                        ? `بيع ${getProductStockUnitLabel(prod)}: ${retailKg} ${currencySymbolDraft}`
                                        : `بيع الكيلو: ${retailKg} ${currencySymbolDraft}`}
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                      <span
                                        className={`font-bold ${
                                          profitKg >= 0 ? 'text-pistachio-700' : 'text-red-700'
                                        }`}
                                      >
                                        ربح: +{profitKg} ج.م
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                                          marginPct < 15
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-pistachio-100 text-pistachio-900'
                                        }`}
                                      >
                                        {marginPct}%
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              );
                            })()}

                          {/* Roast Options */}
                          <td className="p-3 min-w-[150px]">
                            <div className="flex flex-wrap gap-1">
                              {prod.roastOptions.length > 0 ? (
                                prod.roastOptions.map((r) => (
                                  <span
                                    key={r}
                                    className="text-[11px] bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2 py-0.5 rounded font-medium"
                                  >
                                    {r}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-[#6E5D4F]">بدون تحميص</span>
                              )}
                            </div>
                          </td>

                          {/* Rating & Nutrition */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-bold text-[#231710] flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-[#9A6836] fill-[#9A6836]" />
                              <span>{prod.rating || 5.0}</span>
                              <span className="text-[11px] text-[#6B5A4E] font-normal">
                                ({prod.reviewsCount || 0})
                              </span>
                            </div>
                            <div className="text-[11px] text-[#6B5A4E] mt-1">
                              {prod.caloriesPer100g} سعرة • {prod.proteinPer100g}
                            </div>
                          </td>

                          {/* Stock, Channels & Featured Toggles */}
                          <td className="p-3 whitespace-nowrap text-center space-y-1.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={!isFullAdmin}
                                onClick={() => isFullAdmin && handleToggleProductStock(prod.id)}
                                className={`min-h-[32px] text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                                  prod.inStock
                                    ? 'bg-pistachio-50 text-pistachio-700 border-pistachio-200 hover:bg-pistachio-100'
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                }`}
                                title="حالة التوفر"
                              >
                                {prod.inStock ? 'متوفر' : 'نافد'}
                              </button>
                              <span
                                className={`text-[11px] font-mono font-bold px-2 py-1 rounded border ${
                                  (prod.stockKg ?? 0) <= 5
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                                }`}
                                title="المخزون الفعلي المتوفر"
                              >
                                {prod.stockKg !== undefined
                                  ? `${prod.stockKg} ${getProductStockUnitLabel(prod)}`
                                  : `50 ${getProductStockUnitLabel(prod)}`}
                              </span>
                            </div>

                            {/* Channel Badges & Toggles */}
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={!isFullAdmin}
                                onClick={() =>
                                  isFullAdmin && handleToggleProductShowOnline(prod.id)
                                }
                                className={`min-h-[32px] text-[11px] font-bold px-2 py-1 rounded-md border transition ${
                                  prod.showOnline !== false
                                    ? 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#F2EAE0]'
                                    : 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through'
                                }`}
                                title="قناة المتجر الإلكتروني"
                              >
                                {prod.showOnline !== false ? 'أونلاين' : 'أونلاين معطل'}
                              </button>
                              <button
                                type="button"
                                disabled={!isFullAdmin}
                                onClick={() =>
                                  isFullAdmin && handleToggleProductShowInPos(prod.id)
                                }
                                className={`min-h-[32px] text-[11px] font-bold px-2 py-1 rounded-md border transition ${
                                  prod.showInPos !== false
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through'
                                }`}
                                title="قناة الكاشير"
                              >
                                {prod.showInPos !== false ? 'كاشير' : 'كاشير معطل'}
                              </button>
                            </div>

                            <div>
                              <button
                                type="button"
                                disabled={!isFullAdmin}
                                onClick={() => isFullAdmin && handleToggleProductFeatured(prod.id)}
                                className={`min-h-[32px] text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                                  prod.featured
                                    ? 'bg-[#FAF6F0] text-[#9A6836] border-[#E8E0D5]'
                                    : 'bg-white text-[#6B5A4E] border-[#E8E0D5]'
                                }`}
                              >
                                {prod.featured ? 'مميز بالرئيسية' : 'غير مميز'}
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isFullAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsCreatingProduct(false);
                                      setEditingProduct(prod);
                                      updateUrlQueryParams({ productModal: prod.slug });
                                    }}
                                    className="min-h-[40px] bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-[#231710] text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                                    title="تحرير المنتج"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>تحرير</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateProduct(prod)}
                                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 text-[#6B5A4E] hover:bg-[#FAF6F0] rounded-lg"
                                    title="نسخ المنتج"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              <Link
                                href={`/product/${prod.slug}`}
                                target="_blank"
                                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 text-pistachio-700 hover:bg-pistachio-50 rounded-lg"
                                title="معاينة صفحة المنتج"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>

                              {isFullAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(prod.id)}
                                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                  title="حذف المنتج"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTableShell>
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
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8E0D5] space-y-3 h-fit"
                >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#231710]">
                    {editingCategory ? `تعديل قسم: ${formatCategoryName(editingCategory.name)}` : 'إضافة قسم جديد'}
                  </h3>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="text-xs text-red-600 font-bold"
                    >
                      إلغاء
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#231710]">اسم القسم *</label>
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
                    className="w-full bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#231710]">وصف القسم</label>
                  <textarea
                    rows={2}
                    value={editingCategory ? editingCategory.description : catDesc}
                    onChange={(e) =>
                      editingCategory
                        ? setEditingCategory({ ...editingCategory, description: e.target.value })
                        : setCatDesc(e.target.value)
                    }
                    placeholder="زبدة الفول السوداني وزبدة البندق والفستق"
                    className="w-full bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#231710]">صورة القسم</label>
                    <label className="text-xs bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-[#231710] font-bold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1 transition">
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
                      className="w-9 h-9 rounded-lg object-cover border border-[#E8E0D5] shrink-0 bg-[#FAF6F0]"
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
                      className="w-full bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#231710] outline-none focus:border-[#231710]"
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
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold transition ${
                            activeImg === imgOpt.url
                              ? 'bg-[#231710] text-white border-[#231710]'
                              : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#F2EAE0]'
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
                  className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  {editingCategory ? 'حفظ تعديلات القسم' : 'إضافة القسم للمتجر'}
                </button>
              </form>
              )}

              {/* Categories Filter Bar & Data Table */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-[#E8E0D5] space-y-3 h-fit">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-[#9A6836]" />
                    <h3 className="text-sm font-bold text-[#231710]">
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
                      className="text-xs bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-lg"
                    >
                      إعادة ضبط الفلتر
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#6B5A4E] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="ابحث باسم القسم أو الوصف..."
                      className="w-full bg-white border border-[#E8E0D5] rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                    />
                  </div>

                  <select
                    value={categoryCountFilter}
                    onChange={(e) =>
                      setCategoryCountFilter(
                        e.target.value as 'all' | 'with_products' | 'empty'
                      )
                    }
                    className="bg-white border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                  >
                    <option value="all">جميع الأقسام</option>
                    <option value="with_products">أقسام تحتوي على منتجات</option>
                    <option value="empty">أقسام فارغة (0 منتج)</option>
                  </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                        <th className="p-2.5 whitespace-nowrap">الصورة</th>
                        <th className="p-2.5 whitespace-nowrap">اسم القسم والرابط</th>
                        <th className="p-2.5">الوصف</th>
                        <th className="p-2.5 whitespace-nowrap text-center">عدد المنتجات</th>
                        {isFullAdmin && (
                          <th className="p-2.5 whitespace-nowrap text-center">إجراءات</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D5]">
                      {filteredCategories.map((cat) => {
                        const prodCount = products.filter((p) => p.categoryId === cat.id).length;
                        return (
                          <tr key={cat.id} className="hover:bg-[#FAF6F0]/70 transition">
                            <td className="p-2.5 whitespace-nowrap">
                              <img
                                src={getSafeImageUrl(cat.image)}
                                alt={formatCategoryName(cat.name)}
                                className="w-11 h-11 rounded-xl object-cover bg-[#FAF6F0] border border-[#E8E0D5]"
                              />
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="font-bold text-[#231710]">{formatCategoryName(cat.name)}</div>
                              <div className="text-[11px] font-mono text-[#6B5A4E]">{cat.slug}</div>
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
                <div className="bg-white p-4 rounded-2xl border border-brand-200 space-y-3 shadow-2xs">
                  <h3 className="text-xs sm:text-sm font-black text-brand-950">
                    حد الشحن المجاني التلقائي
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-brand-700 mb-1">
                        محلي (بندر وقرى بني مزار):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={settings.freeShippingThreshold}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== settings.freeShippingThreshold) {
                              updateStorePayload(
                                { settings: { ...settings, freeShippingThreshold: val } },
                                'تم تحديث حد الشحن المجاني المحلي'
                              );
                            }
                          }}
                          className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-1.5 text-xs font-black"
                        />
                        <span className="text-xs font-bold shrink-0">ج.م</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-brand-700 mb-1">
                        شحن المحافظات (كل مصر):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={settings.governoratesFreeShippingThreshold ?? 650}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== (settings.governoratesFreeShippingThreshold ?? 650)) {
                              updateStorePayload(
                                { settings: { ...settings, governoratesFreeShippingThreshold: val } },
                                'تم تحديث حد الشحن المجاني للمحافظات'
                              );
                            }
                          }}
                          className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-1.5 text-xs font-black"
                        />
                        <span className="text-xs font-bold shrink-0">ج.م</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-brand-600">
                    يتم تفعيل الشحن المجاني تلقائياً عند تجاوز الحد المخصص لكل نطاق (محلي أو محافظات).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const localNonGov = shippingRates.filter(
                        (r) =>
                          r.zoneType === 'bandar' ||
                          r.zoneType === 'village' ||
                          r.zoneType === 'pickup' ||
                          r.governorate.includes('بندر بني مزار') ||
                          r.governorate.includes('قرى مركز بني مزار') ||
                          r.governorate.includes('استلام سريع')
                      );
                      const all27 = getGovernorateShippingRates(shippingRates);
                      updateStorePayload(
                        { shippingRates: [...localNonGov, ...all27] },
                        'تم تجهيز جدول الـ 27 محافظة مع التوجيه التلقائي لمخزن أكتوبر ومخزن بني مزار'
                      );
                    }}
                    className="w-full bg-[#231710] hover:bg-[#3A271C] text-[#FAF6F0] font-bold py-2 px-3 rounded-xl text-[11px] transition cursor-pointer"
                  >
                    تجهيز جميع محافظات مصر (27 محافظة • مخزنين)
                  </button>
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
                      <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                        <th className="p-2.5 whitespace-nowrap">#</th>
                        <th className="p-2.5">المحافظة / منطقة التوصيل</th>
                        <th className="p-2.5 whitespace-nowrap">مخزن التجهيز</th>
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
                            <td className="p-2.5 font-mono font-bold text-brand-700">
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
                            <td className="p-2.5 whitespace-nowrap">
                              <select
                                value={
                                  rate.fulfillmentHub ||
                                  inferFulfillmentHubFromGovernorate(rate.governorate)
                                }
                                onChange={(e) => {
                                  if (realIdx !== -1) {
                                    const updated = [...shippingRates];
                                    updated[realIdx] = {
                                      ...rate,
                                      fulfillmentHub: e.target.value as 'bani_mazar' | 'cairo_october',
                                    };
                                    updateStorePayload(
                                      { shippingRates: updated },
                                      'تم تحديث مخزن التجهيز للمحافظة'
                                    );
                                  }
                                }}
                                className="bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 text-[11px] font-bold text-brand-900"
                              >
                                <option value="cairo_october">مخزن القاهرة (٦ أكتوبر)</option>
                                <option value="bani_mazar">مخزن بني مزار (المنيا)</option>
                              </select>
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
                              <span className="text-[11px] bg-brand-100 text-brand-900 px-2 py-0.5 rounded-full font-bold">
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
            <div className={`grid grid-cols-1 ${isFullAdmin ? 'lg:grid-cols-3' : ''} gap-4`}>
              {isFullAdmin && (
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
                    <label className="block text-[11px] font-bold mb-1">كود الخصم *</label>
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
                      className="w-full min-h-[40px] bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">نوع الخصم</label>
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
                      className="w-full min-h-[40px] bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت (ج.م)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">قيمة الخصم</label>
                    <input
                      type="number"
                      value={editingCoupon ? editingCoupon.value : newCouponVal}
                      onChange={(e) =>
                        editingCoupon
                          ? setEditingCoupon({ ...editingCoupon, value: Number(e.target.value) })
                          : setNewCouponVal(Number(e.target.value))
                      }
                      className="w-full min-h-[40px] bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">الحد الأدنى للطلب (ج.م)</label>
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
                      className="w-full min-h-[40px] bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      تاريخ الانتهاء (اختياري)
                    </label>
                    <input
                      type="date"
                      value={
                        editingCoupon
                          ? editingCoupon.expiresAt
                            ? editingCoupon.expiresAt.slice(0, 10)
                            : ''
                          : newCouponExpiresAt
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (editingCoupon) {
                          setEditingCoupon({
                            ...editingCoupon,
                            expiresAt: val ? new Date(`${val}T23:59:59`).toISOString() : undefined,
                          });
                        } else {
                          setNewCouponExpiresAt(val);
                        }
                      }}
                      className="w-full min-h-[40px] bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      الحد الأقصى للاستخدام (اختياري)
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="غير محدود (∞)"
                      value={
                        editingCoupon
                          ? editingCoupon.maxUses !== undefined
                            ? editingCoupon.maxUses
                            : ''
                          : newCouponMaxUses
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (editingCoupon) {
                          setEditingCoupon({
                            ...editingCoupon,
                            maxUses: raw && Number(raw) > 0 ? Math.floor(Number(raw)) : undefined,
                          });
                        } else {
                          setNewCouponMaxUses(raw);
                        }
                      }}
                      className="w-full min-h-[40px] bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                {editingCoupon && (
                  <div className="bg-brand-50 p-2.5 rounded-xl border border-brand-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-brand-600 font-bold">مرات الاستخدام الفعلي: </span>
                      <strong className="font-black text-brand-950">
                        {editingCoupon.usedCount || 0} مرة
                      </strong>
                    </div>
                    {(editingCoupon.usedCount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingCoupon({
                            ...editingCoupon,
                            usedCount: 0,
                          })
                        }
                        className="min-h-[36px] text-[11px] bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 font-extrabold px-2.5 py-1 rounded-lg"
                      >
                        تصفير العداد ↺
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold mb-1">وصف العرض الترويجي</label>
                  <input
                    type="text"
                    value={editingCoupon ? editingCoupon.description : newCouponDesc}
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({ ...editingCoupon, description: e.target.value })
                        : setNewCouponDesc(e.target.value)
                    }
                    placeholder="خصم خاص لعملاء المحمصة..."
                    className="w-full min-h-[40px] bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[42px] bg-pistachio-600 hover:bg-pistachio-700 text-white font-extrabold py-2 rounded-xl text-xs"
                >
                  {editingCoupon ? 'حفظ تعديلات الكوبون' : '+ إضافة كود الخصم'}
                </button>
              </form>
              )}

              {/* Coupons Filter Bar & Data Table */}
              <div className={`${isFullAdmin ? 'lg:col-span-2' : ''} bg-white p-4 sm:p-5 rounded-2xl border border-brand-200 space-y-3 h-fit shadow-2xs`}>
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
                      className="text-xs bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-lg"
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#6B5A4E] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={couponSearch}
                      onChange={(e) => setCouponSearch(e.target.value)}
                      placeholder="ابحث بكود الخصم أو الوصف..."
                      className="w-full bg-white border border-[#E8E0D5] rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                    />
                  </div>

                  <select
                    value={couponStatusFilter}
                    onChange={(e) =>
                      setCouponStatusFilter(
                        e.target.value as 'all' | 'active' | 'inactive' | 'expired'
                      )
                    }
                    className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                  >
                    <option value="all">الحالة: جميع الكوبونات</option>
                    <option value="active">الكوبونات الفعالة والصالحة</option>
                    <option value="inactive">الكوبونات المتوقفة يدوياً</option>
                    <option value="expired">منتهية الصلاحية / مكتملة الحد</option>
                  </select>

                  <select
                    value={couponTypeFilter}
                    onChange={(e) =>
                      setCouponTypeFilter(e.target.value as 'all' | 'percentage' | 'fixed')
                    }
                    className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                  >
                    <option value="all">النوع: كل أنواع الخصم</option>
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                        <th className="p-2.5 whitespace-nowrap">كود الخصم</th>
                        <th className="p-2.5 whitespace-nowrap">قيمة الخصم</th>
                        <th className="p-2.5 whitespace-nowrap">الحد الأدنى</th>
                        <th className="p-2.5 whitespace-nowrap">الاستخدام والصلاحية</th>
                        <th className="p-2.5">الوصف الترويجي</th>
                        <th className="p-2.5 whitespace-nowrap text-center">الحالة</th>
                        {isFullAdmin && (
                          <th className="p-2.5 whitespace-nowrap text-center">إجراءات</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D5]">
                      {filteredCoupons.map((c) => {
                        const used = c.usedCount || 0;
                        const max = typeof c.maxUses === 'number' && c.maxUses > 0 ? c.maxUses : null;
                        const isMaxedOut = Boolean(max !== null && used >= max);
                        const isExpiredByDate = Boolean(
                          c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()
                        );
                        const usagePct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;

                        return (
                          <tr key={c.id} className="hover:bg-[#FAF6F0]/70 transition">
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-xs text-[#231710] bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#E8E0D5]">
                                {c.code}
                              </span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="font-bold text-pistachio-700">
                                {c.discountType === 'percentage' ? `${c.value}%` : `${c.value} ج.م`}
                              </div>
                              <div className="text-[11px] text-[#6B5A4E]">
                                {c.discountType === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                              </div>
                            </td>
                            <td className="p-2.5 whitespace-nowrap font-bold text-[#231710]">
                              {c.minOrderAmount} ج.م
                            </td>
                            <td className="p-2.5 whitespace-nowrap min-w-[140px]">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                  <span className={isMaxedOut ? 'text-red-700 font-bold' : 'text-[#231710]'}>
                                    الاستخدام: {used} / {max ?? 'مفتوح'}
                                  </span>
                                  {isMaxedOut && (
                                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                      مكتمل الحد
                                    </span>
                                  )}
                                </div>
                                {max !== null && (
                                  <div className="w-full h-1.5 bg-[#FAF6F0] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        isMaxedOut ? 'bg-red-500' : 'bg-pistachio-600'
                                      }`}
                                      style={{ width: `${usagePct}%` }}
                                    />
                                  </div>
                                )}
                                <div className="text-[11px]">
                                  {c.expiresAt ? (
                                    isExpiredByDate ? (
                                      <span className="text-red-600 font-bold">
                                        منتهي ({c.expiresAt.slice(0, 10)})
                                      </span>
                                    ) : (
                                      <span className="text-[#9A6836] font-bold">
                                        ينتهي: {c.expiresAt.slice(0, 10)}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[#6B5A4E]">مفتوح المدة</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-2.5 text-xs text-[#6B5A4E]">{stripUiEmojis(c.description || '')}</td>
                            <td className="p-2.5 whitespace-nowrap text-center">
                              <button
                                type="button"
                                disabled={!isFullAdmin}
                                onClick={() => {
                                  if (!isFullAdmin) return;
                                  const updated = coupons.map((item) =>
                                    item.id === c.id ? { ...item, active: !item.active } : item
                                  );
                                  updateStorePayload(
                                    { coupons: updated },
                                    'تم تحديث حالة تفعيل الكوبون'
                                  );
                                }}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                                  c.active && !isExpiredByDate && !isMaxedOut
                                    ? 'bg-pistachio-50 text-pistachio-700 border-pistachio-200'
                                    : c.active && (isExpiredByDate || isMaxedOut)
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-[#FAF6F0] text-[#6B5A4E] border-[#E8E0D5]'
                                }`}
                              >
                                {!c.active
                                  ? 'متوقف'
                                  : isExpiredByDate
                                  ? 'منتهي الصلاحية'
                                  : isMaxedOut
                                  ? 'مكتمل العدد'
                                  : 'فعال'}
                              </button>
                            </td>
                            {isFullAdmin && (
                              <td className="p-2.5 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCoupon(c)}
                                    className="p-1.5 bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-[#231710] rounded-lg"
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
          {/* MODULE 8: CUSTOMER REVIEWS DATA TABLE WITH FILTERS                */}
          {/* ================================================================= */}
          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Add Review Form */}
              <form
                onSubmit={handleAddAdminReview}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8E0D5] space-y-3 h-fit"
              >
                <h3 className="text-sm font-bold text-[#231710]">إضافة تقييم عميل موثق</h3>
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#231710]">المنتج *</label>
                  <select
                    value={newReviewProdId || products[0]?.id || ''}
                    onChange={(e) => setNewReviewProdId(e.target.value)}
                    className="w-full bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
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
                    <label className="block text-xs font-bold mb-1 text-[#231710]">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      value={newReviewCustomer}
                      onChange={(e) => setNewReviewCustomer(e.target.value)}
                      placeholder="أحمد محمود"
                      className="w-full bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#231710]">التقييم (1 - 5)</label>
                    <select
                      value={newReviewRating}
                      onChange={(e) => setNewReviewRating(Number(e.target.value))}
                      className="w-full bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                    >
                      <option value={5}>5 نجوم</option>
                      <option value={4}>4 نجوم</option>
                      <option value={3}>3 نجوم</option>
                      <option value={2}>نجمتان</option>
                      <option value={1}>نجمة واحدة</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#231710]">نص التعليق *</label>
                  <textarea
                    rows={2}
                    required
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="اكتب رأي العميل..."
                    className="w-full bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  إضافة ونشر التقييم
                </button>
              </form>

              {/* Reviews Filter Bar & Data Table */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-[#E8E0D5] space-y-3 h-fit">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-[#9A6836]" />
                    <h3 className="text-sm font-bold text-[#231710]">
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
                      className="text-xs bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-lg"
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#6B5A4E] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="ابحث باسم العميل أو نص التعليق..."
                      className="w-full bg-white border border-[#E8E0D5] rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                    />
                  </div>

                  <select
                    value={reviewProductFilter}
                    onChange={(e) => setReviewProductFilter(e.target.value)}
                    className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
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
                    className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#231710] outline-none focus:border-[#231710]"
                  >
                    <option value="all">كل التقييمات (1 - 5 نجوم)</option>
                    <option value="5">5 نجوم فقط</option>
                    <option value="4">4 نجوم فقط</option>
                    <option value="3_or_less">3 نجوم فأقل</option>
                  </select>
                </div>

                {allReviewsFlattened.length === 0 ? (
                  <p className="text-xs text-[#6B5A4E] py-6 text-center">
                    لا توجد تقييمات مطابقة للفلاتر المحددة حالياً.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#FAF6F0] text-[#231710] font-bold border-b border-[#E8E0D5]">
                          <th className="p-2.5 whitespace-nowrap">اسم العميل</th>
                          <th className="p-2.5 whitespace-nowrap">المنتج</th>
                          <th className="p-2.5 whitespace-nowrap">التقييم</th>
                          <th className="p-2.5">نص التعليق</th>
                          <th className="p-2.5 whitespace-nowrap">التاريخ</th>
                          <th className="p-2.5 whitespace-nowrap text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E0D5]">
                        {allReviewsFlattened.map(({ product, review }) => (
                          <tr
                            key={`${product.id}-${review.id}`}
                            className="hover:bg-[#FAF6F0]/70 transition"
                          >
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="font-bold text-[#231710]">
                                {review.customerName}
                              </div>
                              {review.verified && (
                                <span className="text-[11px] text-pistachio-700 font-bold">
                                  مشتري موثق
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="text-xs bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2 py-0.5 rounded font-bold">
                                {product.name}
                              </span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1 font-bold text-[#9A6836]">
                                <Star className="w-3.5 h-3.5 fill-[#9A6836] text-[#9A6836]" />
                                <span>{review.rating} / 5</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-xs text-[#231710] max-w-xs">
                              {stripUiEmojis(review.comment || '')}
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-[11px] text-[#6B5A4E]">
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
            <AccountsAndPermissionsWorkspace
              adminToken={adminToken}
              rolePermissions={getResolvedRolePermissions(settings)}
              customRoles={getResolvedCustomRoles(settings)}
              isSavingPermissions={saving}
              onNotify={showToast}
              onSaveRolesAndPermissions={async (updatedPerms, updatedCustomRoles, msg) => {
                await updateStorePayload(
                  {
                    settings: {
                      ...settings,
                      rolePermissions: updatedPerms,
                      customRoles: updatedCustomRoles,
                    },
                  },
                  msg || 'تم حفظ وتطبيق الأدوار والصلاحيات بنجاح'
                );
              }}
            />
          )}

          {activeTab === 'settings' && canAccessTab('settings') && (
            <div className="w-full max-w-none space-y-4">
              {/* 7 Clean Settings Sub-Tabs Bar */}
              <div className="bg-white p-1.5 rounded-2xl border border-[#E8E0D5] flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'branch' as const, label: 'بيانات الفرع' },
                  { id: 'receipt' as const, label: 'إعدادات وتصميم الفاتورة' },
                  { id: 'blueprint' as const, label: 'الهوية والثيمات والموديولات' },
                  { id: 'payment' as const, label: 'الدفع والشحن' },
                  { id: 'security' as const, label: 'الحسابات والأمان' },
                  { id: 'telegram' as const, label: 'إشعارات تلجرام' },
                  { id: 'backup' as const, label: 'النسخ الاحتياطي والنظام' },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSettingsSubTab(sub.id);
                      updateUrlQueryParams({
                        tab: 'settings',
                        subtab: sub.id === 'branch' ? null : sub.id,
                      });
                    }}
                    className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      settingsSubTab === sub.id
                        ? 'bg-[#231710] text-white'
                        : 'text-[#6B5644] hover:bg-[#FAF6F0] hover:text-[#231710]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* Core Settings Form (Sub-tabs 1..4: branch, payment, security, telegram) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const getStr = (key: string, fb: string, allowEmpty = true) => {
                    const raw = formData.get(key);
                    if (raw === null) return fb;
                    const trimmed = String(raw).trim();
                    if (!allowEmpty && trimmed === '') return fb;
                    return trimmed;
                  };
                  const getNum = (key: string, fb: number) => {
                    const raw = formData.get(key);
                    if (raw === null || String(raw).trim() === '') return fb;
                    const parsed = Number(raw);
                    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fb;
                  };
                  const updatedSettings = {
                    ...settings,
                    storeName: getStr('storeName', settings.storeName, false),
                    tagline: getStr('tagline', settings.tagline),
                    announcementText: getStr('announcementText', settings.announcementText),
                    whatsappNumber: getStr('whatsappNumber', settings.whatsappNumber, false),
                    supportPhone: getStr('supportPhone', settings.supportPhone, false),
                    freeShippingThreshold: getNum(
                      'freeShippingThreshold',
                      settings.freeShippingThreshold
                    ),
                    instapayAddress: getStr('instapayAddress', settings.instapayAddress),
                    vodafoneCashNumber: getStr('vodafoneCashNumber', settings.vodafoneCashNumber),
                    address: getStr('address', settings.address, false),
                    workingHours: getStr('workingHours', settings.workingHours, false),
                    googleMapsUrl: getStr('googleMapsUrl', settings.googleMapsUrl || ''),
                    pageContent: cmsDraft,
                    themeConfig: themeDraft,
                    featureFlags: featureFlagsDraft,
                    currencySymbol: currencySymbolDraft.trim() || 'ج.م',
                    orderPrefix:
                      orderPrefixDraft
                        .trim()
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '') || 'NUT',
                    cityName: cityNameDraft.trim() || 'الفرع الرئيسي',
                    bandarShippingCost: bandarShippingCostDraft,
                    villagesShippingCost: villagesShippingCostDraft,
                    minOrderVillages: minOrderVillagesDraft,
                    villageMinOrderAmount: minOrderVillagesDraft,
                    bandarZones: bandarZonesText
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                    villageZones: villageZonesText
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                    deliveryBatches: deliveryBatchesText
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                    telegramBotToken: getStr('telegramBotToken', settings.telegramBotToken ?? ''),
                    telegramChatId: getStr('telegramChatId', settings.telegramChatId ?? ''),
                    telegramNotificationsEnabled: telegramEnabled,
                    telegramNotifyNewOrders: telegramNotifyOrders,
                    telegramNotifySupplyInvoices: telegramNotifySupply,
                    telegramNotifyZReport: telegramNotifyZReport,
                    telegramNotifyLowStock: telegramNotifyLowStock,
                    enableTax: formData.get('taxFormPresent')
                      ? formData.get('enableTax') === 'on'
                      : Boolean(settings.enableTax),
                    taxRatePercent: getNum('taxRatePercent', settings.taxRatePercent ?? 14),
                    taxPricingMode:
                      (getStr(
                        'taxPricingMode',
                        settings.taxPricingMode || 'inclusive'
                      ) as 'inclusive' | 'exclusive') || 'inclusive',
                    taxRegistrationNumber: getStr(
                      'taxRegistrationNumber',
                      settings.taxRegistrationNumber ?? ''
                    ),
                    taxActivityCode: getStr(
                      'taxActivityCode',
                      settings.taxActivityCode ?? ''
                    ),
                    taxBranchId: getStr('taxBranchId', settings.taxBranchId ?? '0'),
                    enableCreditSales: formData.get('taxFormPresent')
                      ? formData.get('enableCreditSales') === 'on'
                      : Boolean(settings.enableCreditSales),
                    creditSalesRequireApproval: formData.get('taxFormPresent')
                      ? formData.get('creditSalesRequireApproval') === 'on'
                      : settings.creditSalesRequireApproval !== false,
                    enableDirectEscPosPrint: formData.get('taxFormPresent')
                      ? formData.get('enableDirectEscPosPrint') === 'on'
                      : Boolean(settings.enableDirectEscPosPrint),
                    autoOpenCashDrawer: formData.get('taxFormPresent')
                      ? formData.get('autoOpenCashDrawer') === 'on'
                      : settings.autoOpenCashDrawer !== false,
                    thermalPaperWidthMm: formData.get('taxFormPresent')
                      ? (Number(getStr('thermalPaperWidthMm', '80')) === 58 ? 58 : 80)
                      : settings.thermalPaperWidthMm === 58
                        ? 58
                        : 80,
                    receiptConfig: settings.receiptConfig
                      ? {
                          ...settings.receiptConfig,
                          paperWidthMm: formData.get('taxFormPresent')
                            ? (Number(getStr('thermalPaperWidthMm', '80')) === 58 ? 58 : 80)
                            : settings.receiptConfig.paperWidthMm === 58
                              ? 58
                              : 80,
                        }
                      : undefined,
                    requireElectronicPaymentRef: formData.get('taxFormPresent')
                      ? formData.get('requireElectronicPaymentRef') === 'on'
                      : Boolean(settings.requireElectronicPaymentRef),
                    posRegisters: (() => {
                      const rawRegs = getStr('posRegistersRaw', '');
                      if (!rawRegs) return settings.posRegisters;
                      const parsedRegs = rawRegs
                        .split('\n')
                        .map((line, i) => {
                          const clean = line.trim();
                          if (!clean) return null;
                          const [idPart, ...nameParts] = clean.split(':');
                          if (nameParts.length > 0) {
                            return {
                              id: idPart.trim() || `reg-${i + 1}`,
                              name: nameParts.join(':').trim() || `ماكينة كاشير ${i + 1}`,
                              active: true,
                            };
                          }
                          return {
                            id: `reg-${i + 1}`,
                            name: clean,
                            active: true,
                          };
                        })
                        .filter(Boolean) as Array<{ id: string; name: string; active: boolean }>;
                      return parsedRegs.length > 0 ? parsedRegs : settings.posRegisters;
                    })(),
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
                    'تم حفظ الإعدادات بنجاح'
                  );
                  setNewAdminPassword('');
                  setNewSupplierPassword('');
                  setNewCashierPassword('');
                  setNewAccountantPassword('');
                }}
                className={
                  settingsSubTab === 'backup' || settingsSubTab === 'receipt'
                    ? 'hidden'
                    : 'bg-white p-5 sm:p-6 rounded-2xl border border-[#E8E0D5] space-y-5'
                }
              >
                {/* Sub-Tab 1: بيانات الفرع */}
                <div className={settingsSubTab === 'branch' ? 'space-y-4' : 'hidden'}>
                  <div className="border-b border-[#E8E0D5] pb-3">
                    <h3 className="text-base font-bold text-[#231710]">
                      بيانات الفرع والتواصل
                    </h3>
                    <p className="text-xs text-[#6B5644] mt-0.5">
                      الاسم التجاري للمتجر، عنوان الفرع، مواعيد العمل، وأرقام خدمة العملاء.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        الاسم التجاري للمتجر
                      </label>
                      <input
                        name="storeName"
                        defaultValue={settings.storeName}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm font-medium text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        الشعار اللفظي للمتجر
                      </label>
                      <input
                        name="tagline"
                        defaultValue={settings.tagline}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm font-medium text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        مواعيد العمل اليومية
                      </label>
                      <input
                        name="workingHours"
                        defaultValue={settings.workingHours}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        نص الشريط العلوي للمتجر
                      </label>
                      <input
                        name="announcementText"
                        defaultValue={settings.announcementText}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm font-medium text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        عنوان الفرع الرئيسي
                      </label>
                      <input
                        name="address"
                        defaultValue={settings.address}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        رقم واتساب لاستقبال الطلبات (بكود الدولة 20)
                      </label>
                      <input
                        name="whatsappNumber"
                        defaultValue={settings.whatsappNumber}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm font-mono text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        رقم هاتف خدمة العملاء
                      </label>
                      <input
                        name="supportPhone"
                        defaultValue={settings.supportPhone}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm font-mono text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        رابط موقع الفرع على خرائط جوجل
                      </label>
                      <input
                        name="googleMapsUrl"
                        dir="ltr"
                        defaultValue={settings.googleMapsUrl || ''}
                        placeholder="https://maps.google.com/?q=Cairo+Egypt"
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2 text-sm font-mono text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-Tab 1B: الهوية والثيمات والموديولات (White-Label Blueprint Studio) */}
                <div className={settingsSubTab === 'blueprint' ? 'space-y-5' : 'hidden'}>
                  <div className="border-b border-[#E8E0D5] pb-3 flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-bold text-[#231710] flex items-center gap-2">
                        <Palette className="w-4 h-4 text-[#9A6836]" />
                        <span>تخصيص الهوية البصرية والموديولات والمنطقة</span>
                      </h3>
                      <p className="text-xs text-[#6B5644] mt-0.5">
                        تحكم كامل في الثيم اللوني للمتجر، تفعيل أو إخفاء الموديولات حسب نشاطك التجاري، والعملة ونطاق التوصيل.
                      </p>
                    </div>
                  </div>

                  {/* 1. Multi-Industry Theme Selector */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-bold text-[#231710]">
                        1. اختر الثيم البصري للمتجر (معاينة فورية حية):
                      </label>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[#6B5644] font-medium">حواف البطاقات والأزرار:</span>
                        {(
                          [
                            { id: 'rounded', label: 'دائري ناعم' },
                            { id: 'sharp', label: 'هندسي حاد' },
                            { id: 'pill', label: 'انسيابي كامل' },
                          ] as const
                        ).map((rad) => (
                          <button
                            key={rad.id}
                            type="button"
                            onClick={() => {
                              const nextTheme: StoreThemeConfig = {
                                ...themeDraft,
                                borderRadius: rad.id,
                              };
                              setThemeDraft(nextTheme);
                              setThemeOverride(nextTheme);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              themeDraft.borderRadius === rad.id
                                ? 'bg-[#231710] text-white border-[#231710]'
                                : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                            }`}
                          >
                            {rad.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {STORE_THEMES.map((thm) => {
                        const isSelected = themeDraft.themeId === thm.id;
                        return (
                          <button
                            key={thm.id}
                            type="button"
                            onClick={() => {
                              const nextTheme: StoreThemeConfig = {
                                ...themeDraft,
                                themeId: thm.id,
                              };
                              setThemeDraft(nextTheme);
                              setThemeOverride(nextTheme);
                            }}
                            className={`text-right p-3.5 rounded-2xl border-2 transition cursor-pointer space-y-2 ${
                              isSelected
                                ? 'border-[#231710] bg-[#FAF6F0] shadow-sm'
                                : 'border-[#E8E0D5] bg-white hover:border-[#C8B8A6]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-[#231710]">{thm.name}</span>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                  thm.isDark
                                    ? 'bg-zinc-900 text-amber-300 border-zinc-700'
                                    : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                              >
                                {thm.isDark ? 'وضع داكن فاخر' : 'وضع نهاري مشرق'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6B5644] leading-relaxed">
                              {thm.description}
                            </p>
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-5 h-5 rounded-full border border-black/15"
                                  style={{ backgroundColor: thm.swatches.primary }}
                                  title="اللون الأساسي"
                                />
                                <span
                                  className="w-5 h-5 rounded-full border border-black/15"
                                  style={{ backgroundColor: thm.swatches.accent }}
                                  title="اللون المميز"
                                />
                                <span
                                  className="w-5 h-5 rounded-full border border-black/15"
                                  style={{ backgroundColor: thm.swatches.bg }}
                                  title="لون الخلفية"
                                />
                              </div>
                              {isSelected && (
                                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>مفعل حالياً</span>
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Modular Feature Flags */}
                  <div className="pt-4 border-t border-[#E8E0D5] space-y-3">
                    <label className="block text-xs font-bold text-[#231710]">
                      2. الموديولات التخصصية القابلة للتفعيل أو الإيقاف:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Custom Blender Module */}
                      <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] space-y-2">
                        <label className="flex items-center justify-between gap-2 cursor-pointer">
                          <span className="text-xs font-bold text-[#231710]">
                            موديول معمل الخلطات والتوليفات الخاصة
                          </span>
                          <input
                            type="checkbox"
                            checked={featureFlagsDraft.enableCoffeeBlender !== false}
                            onChange={(e) =>
                              setFeatureFlagsDraft({
                                ...featureFlagsDraft,
                                enableCoffeeBlender: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded text-[#231710]"
                          />
                        </label>
                        <input
                          type="text"
                          value={featureFlagsDraft.blenderModuleLabel || ''}
                          onChange={(e) =>
                            setFeatureFlagsDraft({
                              ...featureFlagsDraft,
                              blenderModuleLabel: e.target.value,
                            })
                          }
                          placeholder="مسمى الموديول (مثال: معمل التوليفات / ركن العطور)"
                          className="w-full bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1.5 text-xs text-[#231710]"
                        />
                      </div>

                      {/* Custom Gift Boxes Module */}
                      <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] space-y-2">
                        <label className="flex items-center justify-between gap-2 cursor-pointer">
                          <span className="text-xs font-bold text-[#231710]">
                            موديول تجميع البوكسات والباقات المخصصة
                          </span>
                          <input
                            type="checkbox"
                            checked={featureFlagsDraft.enableCustomBoxes !== false}
                            onChange={(e) =>
                              setFeatureFlagsDraft({
                                ...featureFlagsDraft,
                                enableCustomBoxes: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded text-[#231710]"
                          />
                        </label>
                        <input
                          type="text"
                          value={featureFlagsDraft.boxesModuleLabel || ''}
                          onChange={(e) =>
                            setFeatureFlagsDraft({
                              ...featureFlagsDraft,
                              boxesModuleLabel: e.target.value,
                            })
                          }
                          placeholder="مسمى الموديول (مثال: صمّم بوكس هداياك)"
                          className="w-full bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1.5 text-xs text-[#231710]"
                        />
                      </div>

                      {/* Electronic Weight Scale */}
                      <label className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-between gap-2 cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            الميزان الإلكتروني الحر وباركود الأوزان (PLU)
                          </div>
                          <div className="text-[11px] text-[#6B5644] mt-0.5">
                            يدعم البيع بالوزن أو المبلغ الحر في شاشة الكاشير
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={featureFlagsDraft.enableWeightScale !== false}
                          onChange={(e) =>
                            setFeatureFlagsDraft({
                              ...featureFlagsDraft,
                              enableWeightScale: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>

                      {/* VIP Loyalty Wallet */}
                      <label className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-between gap-2 cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            نادي الولاء ومحفظة الكاش باك (VIP)
                          </div>
                          <div className="text-[11px] text-[#6B5644] mt-0.5">
                            تجميع واستبدال رصيد المكافآت برقم هاتف العميل
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={featureFlagsDraft.enableVipWallet !== false}
                          onChange={(e) =>
                            setFeatureFlagsDraft({
                              ...featureFlagsDraft,
                              enableVipWallet: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>

                      {/* Scheduled Village Delivery Batches */}
                      <label className="sm:col-span-2 p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-between gap-2 cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            نظام دورات التوصيل المجدولة للمناطق والضواحي التابعة
                          </div>
                          <div className="text-[11px] text-[#6B5644] mt-0.5">
                            تقسيم التوصيل المحلي إلى توصيل سريع داخل المدينة ودورات مجدولة للضواحي والقرى
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={featureFlagsDraft.enableVillageBatches !== false}
                          onChange={(e) =>
                            setFeatureFlagsDraft({
                              ...featureFlagsDraft,
                              enableVillageBatches: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>
                    </div>
                  </div>

                  {/* 3. Currency, Order Prefix & Local Delivery Geography */}
                  <div className="pt-4 border-t border-[#E8E0D5] space-y-4">
                    <label className="block text-xs font-bold text-[#231710]">
                      3. العملة، بادئة الفواتير، والنطاق الجغرافي للتوصيل المحلي:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          رمز العملة (ج.م / ر.س / د.إ)
                        </label>
                        <input
                          type="text"
                          value={currencySymbolDraft}
                          onChange={(e) => setCurrencySymbolDraft(e.target.value)}
                          placeholder="ج.م"
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          بادئة أرقام الفواتير (مثال: NUT أو POS)
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={orderPrefixDraft}
                          onChange={(e) => setOrderPrefixDraft(e.target.value.toUpperCase())}
                          placeholder="NUT"
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          اسم المدينة / نطاق الفرع الرئيسي
                        </label>
                        <input
                          type="text"
                          value={cityNameDraft}
                          onChange={(e) => setCityNameDraft(e.target.value)}
                          placeholder="القاهرة / الرياض / الإسكندرية"
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          رسوم التوصيل السريع داخل المدينة ({currencySymbolDraft})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={bandarShippingCostDraft}
                          onChange={(e) => setBandarShippingCostDraft(Number(e.target.value))}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          رسوم توصيل الضواحي والقرى ({currencySymbolDraft})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={villagesShippingCostDraft}
                          onChange={(e) => setVillagesShippingCostDraft(Number(e.target.value))}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          الحد الأدنى لطلبات الضواحي والقرى ({currencySymbolDraft})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={minOrderVillagesDraft}
                          onChange={(e) => setMinOrderVillagesDraft(Number(e.target.value))}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          أحياء ومناطق المدينة (منطقة في كل سطر)
                        </label>
                        <textarea
                          rows={4}
                          value={bandarZonesText}
                          onChange={(e) => setBandarZonesText(e.target.value)}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          القرى والضواحي التابعة (منطقة في كل سطر)
                        </label>
                        <textarea
                          rows={4}
                          value={villageZonesText}
                          onChange={(e) => setVillageZonesText(e.target.value)}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          مواعيد دورات التوصيل (موعد في كل سطر)
                        </label>
                        <textarea
                          rows={4}
                          value={deliveryBatchesText}
                          onChange={(e) => setDeliveryBatchesText(e.target.value)}
                          placeholder="دورة التوزيع الأولى (الساعة 2:00 ظهراً)"
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs text-[#231710]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-Tab 2: الدفع والشحن */}
                <div className={settingsSubTab === 'payment' ? 'space-y-4' : 'hidden'}>
                  <div className="border-b border-[#E8E0D5] pb-3">
                    <h3 className="text-base font-bold text-[#231710]">
                      وسائل الدفع الإلكتروني وحد الشحن المجاني
                    </h3>
                    <p className="text-xs text-[#6B5644] mt-0.5">
                      بيانات التحويل عبر إنستا باي وفودافون كاش والحد الأدنى للشحن المجاني.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        حد الشحن المجاني التلقائي (ج.م)
                      </label>
                      <input
                        name="freeShippingThreshold"
                        type="number"
                        min={0}
                        defaultValue={settings.freeShippingThreshold}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        عنوان الدفع عبر إنستا باي
                      </label>
                      <input
                        name="instapayAddress"
                        defaultValue={settings.instapayAddress}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        رقم محفظة فودافون كاش
                      </label>
                      <input
                        name="vodafoneCashNumber"
                        defaultValue={settings.vodafoneCashNumber}
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>
                  </div>

                  <input type="hidden" name="taxFormPresent" value="1" />

                  {/* Optional Egyptian VAT (14%) & ETA E-Receipt Configuration */}
                  <div className="pt-4 border-t border-[#E8E0D5] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[#231710]">
                          الضريبة المصرية والإيصال الإلكتروني الاختياري (14% VAT &amp; ETA E-Receipt)
                        </h4>
                        <p className="text-[11px] text-[#6B5644]">
                          مغلق افتراضياً للمحلات العادية؛ عند التفعيل يتم حساب الضريبة وطباعة رقم التسجيل الضريبي ورمز QR الضريبي على البون.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 bg-[#FAF6F0] border border-[#E8E0D5] px-3 py-2 rounded-xl text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          name="enableTax"
                          defaultChecked={Boolean(settings.enableTax)}
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                        <span>تفعيل الضريبة على الفواتير</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          نسبة ضريبة القيمة المضافة (%)
                        </label>
                        <input
                          name="taxRatePercent"
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          defaultValue={settings.taxRatePercent ?? 14}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          سياسة احتساب الضريبة
                        </label>
                        <select
                          name="taxPricingMode"
                          defaultValue={settings.taxPricingMode || 'inclusive'}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710]"
                        >
                          <option value="inclusive">شاملة داخل سعر البيع (Inclusive)</option>
                          <option value="exclusive">تُضاف فوق سعر البيع (Exclusive)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          رقم التسجيل الضريبي (RIN - 9 أرقام)
                        </label>
                        <input
                          name="taxRegistrationNumber"
                          dir="ltr"
                          defaultValue={settings.taxRegistrationNumber || ''}
                          placeholder="100-200-300"
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono text-[#231710]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          كود النشاط الضريبي (Tax Activity Code)
                        </label>
                        <input
                          name="taxActivityCode"
                          dir="ltr"
                          defaultValue={settings.taxActivityCode || ''}
                          placeholder="4721"
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono text-[#231710]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#231710] mb-1">
                          كود الفرع بمنظومة الإيصال الإلكتروني (Branch ID)
                        </label>
                        <input
                          name="taxBranchId"
                          dir="ltr"
                          defaultValue={settings.taxBranchId || '0'}
                          placeholder="0"
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono text-[#231710]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Credit Sales Master Admin Lock */}
                  <div className="pt-4 border-t border-[#E8E0D5] space-y-3">
                    <h4 className="text-sm font-bold text-[#231710]">
                      التحكم المركزي في البيع الآجل وذمم العملاء (AR)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            تفعيل البيع الآجل على شاشة الكاشير
                          </div>
                          <div className="text-[11px] text-[#6B5644]">
                            عند إيقاف هذا المفتاح يُقفل البيع الآجل نهائياً أمام الكاشير
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          name="enableCreditSales"
                          defaultChecked={Boolean(settings.enableCreditSales)}
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            قصر البيع الآجل على العملاء المعتمدين فقط
                          </div>
                          <div className="text-[11px] text-[#6B5644]">
                            يشترط تفعيل الحساب الآجل للعميل وعدم تجاوز حده الائتماني
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          name="creditSalesRequireApproval"
                          defaultChecked={settings.creditSalesRequireApproval !== false}
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>
                    </div>
                  </div>

                  {/* POS Hardware (ESC/POS + Cash Drawer) & Multi-Register */}
                  <div className="pt-4 border-t border-[#E8E0D5] space-y-3">
                    <h4 className="text-sm font-bold text-[#231710]">
                      تعدد نقاط الكاشير والطباعة الحرارية المباشرة (ESC/POS &amp; Cash Drawer)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            الطباعة الحرارية الصامتة تلقائياً (WebUSB / WebSerial)
                          </div>
                          <div className="text-[11px] text-[#6B5644]">
                            إرسال البون مباشرة للطابعة الحرارية بدون نافذة معاينة المتصفح
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          name="enableDirectEscPosPrint"
                          defaultChecked={Boolean(settings.enableDirectEscPosPrint)}
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            فتح درج النقدية تلقائياً مع الفاتورة (ESC p)
                          </div>
                          <div className="text-[11px] text-[#6B5644]">
                            إرسال نبضة RJ11 لفتح درج النقدية مع طباعة البون
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          name="autoOpenCashDrawer"
                          defaultChecked={settings.autoOpenCashDrawer !== false}
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>

                      <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] space-y-1.5">
                        <label className="block text-xs font-bold text-[#231710]">
                          مقاس ورق الطابعة الحرارية (RONGTA / XPrinter)
                        </label>
                        <select
                          name="thermalPaperWidthMm"
                          defaultValue={String(settings.thermalPaperWidthMm === 58 ? 58 : 80)}
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
                        >
                          <option value="80">80 مم — رول سوبرماركت عريض قياسي (74mm طباعة)</option>
                          <option value="58">58 مم — رول طابعة حرارية مدمجة RP58 (52mm طباعة)</option>
                        </select>
                      </div>

                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            إلزام الكاشير برقم مرجع فودافون كاش / إنستاباي
                          </div>
                          <div className="text-[11px] text-[#6B5644]">
                            منع إصدار فاتورة دفع إلكتروني بدون تسجيل رقم العملية المرجعي للمراجعة
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          name="requireElectronicPaymentRef"
                          defaultChecked={Boolean(settings.requireElectronicPaymentRef)}
                          className="w-4 h-4 rounded text-[#231710]"
                        />
                      </label>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[#231710]">
                          أيقونة التشغيل المباشر لماكينة الكاشير (Windows i3 4GB RAM + الطباعة الصامتة)
                        </div>
                        <div className="text-[11px] text-[#6B5644]">
                          ملف تشغيل جاهز يفتح شاشة الكاشير بوضع التطبيق الكامل والطباعة الفورية بدون نافذة معاينة مع توفير الرامات
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const posUrl =
                            typeof window !== 'undefined'
                              ? `${window.location.origin}/pos`
                              : 'https://hafsahnuts.com/pos';
                          const batContent = [
                            '@echo off',
                            'chcp 65001 >nul',
                            `set "MIZAN_POS_URL=${posUrl}"`,
                            'set "BROWSER_EXE="',
                            'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"',
                            'if "%BROWSER_EXE%"=="" if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"',
                            'if "%BROWSER_EXE%"=="" if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
                            'if "%BROWSER_EXE%"=="" if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
                            'set "POS_PROFILE_DIR=%LOCALAPPDATA%\\HafsaRoastery_Cashier_Profile"',
                            'start "" "%BROWSER_EXE%" --app="%MIZAN_POS_URL%" --kiosk-printing --user-data-dir="%POS_PROFILE_DIR%" --disable-extensions --disable-background-networking --disable-sync --disable-translate --renderer-process-limit=2 --js-flags="--max-old-space-size=512"',
                            'exit /b 0',
                          ].join('\r\n');
                          const blob = new Blob([batContent], { type: 'application/octet-stream' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'HafsaRoastery-Cashier-Launcher.bat';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          showToast('تم تحميل مشغّل الكاشير الصامت لسطح المكتب بنجاح');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل مشغّل الكاشير (Windows .bat)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-Tab 3: الحسابات والأمان */}
                <div className={settingsSubTab === 'security' ? 'space-y-4' : 'hidden'}>
                  <div className="flex items-start justify-between flex-wrap gap-3 border-b border-[#E8E0D5] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#231710] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#9A6836]" />
                        <span>الحسابات الأساسية وكلمات المرور للأدوار الأربعة</span>
                      </h3>
                      <p className="text-xs text-[#6B5644] mt-0.5">
                        اترك حقل كلمة المرور فارغاً للإبقاء على كلمة المرور الحالية دون تغيير.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isFullAdmin && (
                        <button
                          type="button"
                          onClick={() => selectTab('permissions')}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] text-xs font-bold transition cursor-pointer"
                        >
                          إدارة صلاحيات الأقسام
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="text-xs font-bold text-[#4A3728] hover:text-[#231710] flex items-center gap-1.5 bg-white hover:bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-[#E8E0D5] cursor-pointer"
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                    {/* Role 1: Super Admin */}
                    <div className="p-4 rounded-xl bg-white border border-[#E8E0D5] space-y-2.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        1. الأدمن (المدير العام)
                      </label>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          اسم المستخدم:
                        </span>
                        <input
                          type="text"
                          value={newAdminUsername}
                          onChange={(e) => setNewAdminUsername(e.target.value)}
                          placeholder="أدخل اسم مستخدم المدير..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          كلمة المرور {showPasswordText && settings.adminPassword ? `(الحالية: ${settings.adminPassword})` : '(محفوظة ومحمية ••••••••)'}:
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للأدمن..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                    </div>

                    {/* Role 2: Supplier */}
                    <div className="p-4 rounded-xl bg-white border border-[#E8E0D5] space-y-2.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        2. المورد (بوابة التوريد والمخزون)
                      </label>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          اسم المستخدم:
                        </span>
                        <input
                          type="text"
                          value={newSupplierUsername}
                          onChange={(e) => setNewSupplierUsername(e.target.value)}
                          placeholder="أدخل اسم مستخدم المورد..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          كلمة المرور {showPasswordText && settings.supplierPassword ? `(الحالية: ${settings.supplierPassword})` : '(محفوظة ومحمية ••••••••)'}:
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newSupplierPassword}
                          onChange={(e) => setNewSupplierPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للمورد..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                    </div>

                    {/* Role 3: Cashier */}
                    <div className="p-4 rounded-xl bg-white border border-[#E8E0D5] space-y-2.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        3. الكاشير (نقطة البيع والميزان)
                      </label>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          اسم المستخدم:
                        </span>
                        <input
                          type="text"
                          value={newCashierUsername}
                          onChange={(e) => setNewCashierUsername(e.target.value)}
                          placeholder="أدخل اسم مستخدم الكاشير..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          كلمة المرور {showPasswordText && settings.cashierPassword ? `(الحالية: ${settings.cashierPassword})` : '(محفوظة ومحمية ••••••••)'}:
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newCashierPassword}
                          onChange={(e) => setNewCashierPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للكاشير..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                    </div>

                    {/* Role 4: Accountant */}
                    <div className="p-4 rounded-xl bg-white border border-[#E8E0D5] space-y-2.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        4. المحاسب (المراجعة المالية والجرد)
                      </label>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          اسم المستخدم:
                        </span>
                        <input
                          type="text"
                          value={newAccountantUsername}
                          onChange={(e) => setNewAccountantUsername(e.target.value)}
                          placeholder="أدخل اسم مستخدم المحاسب..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-[#6B5644] mb-1">
                          كلمة المرور {showPasswordText && settings.accountantPassword ? `(الحالية: ${settings.accountantPassword})` : '(محفوظة ومحمية ••••••••)'}:
                        </span>
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newAccountantPassword}
                          onChange={(e) => setNewAccountantPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة للمحاسب..."
                          className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-Tab 4: إشعارات تلجرام */}
                <div className={settingsSubTab === 'telegram' ? 'space-y-4' : 'hidden'}>
                  <div className="flex items-start justify-between flex-wrap gap-3 border-b border-[#E8E0D5] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#231710] flex items-center gap-2">
                        <Send className="w-4 h-4 text-[#9A6836]" />
                        <span>إشعارات بوت تلجرام الفورية</span>
                      </h3>
                      <p className="text-xs text-[#6B5644] mt-0.5">
                        إرسال تنبيهات لحظية لإدارة المحمصة عند وصول طلبات أونلاين جديدة، فواتير التوريد، وتقفيل الوردية.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-[#E8E0D5]">
                      <input
                        type="checkbox"
                        checked={telegramEnabled}
                        onChange={(e) => setTelegramEnabled(e.target.checked)}
                        className="w-4 h-4 rounded text-[#231710] cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#231710]">تفعيل إشعارات تلجرام</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        رمز بوت تلجرام
                      </label>
                      <input
                        name="telegramBotToken"
                        dir="ltr"
                        defaultValue={settings?.telegramBotToken || ''}
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#231710] mb-1.5">
                        معرف محادثة أو مجموعة الإدارة
                      </label>
                      <input
                        name="telegramChatId"
                        dir="ltr"
                        defaultValue={settings?.telegramChatId || ''}
                        placeholder="-1001234567890"
                        className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-3 border-t border-[#E8E0D5] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[#231710] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={telegramNotifyOrders}
                            onChange={(e) => setTelegramNotifyOrders(e.target.checked)}
                            className="rounded text-[#231710]"
                          />
                          <span>طلبات الأونلاين الجديدة</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[#231710] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={telegramNotifySupply}
                            onChange={(e) => setTelegramNotifySupply(e.target.checked)}
                            className="rounded text-[#231710]"
                          />
                          <span>فواتير التوريد والمخزون</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[#231710] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={telegramNotifyZReport}
                            onChange={(e) => setTelegramNotifyZReport(e.target.checked)}
                            className="rounded text-[#231710]"
                          />
                          <span>تقفيل وردية الكاشير</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[#231710] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={telegramNotifyLowStock}
                            onChange={(e) => setTelegramNotifyLowStock(e.target.checked)}
                            className="rounded text-[#231710]"
                          />
                          <span>تنبيهات النواقص الحرجة (≤ 5 كجم)</span>
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={telegramTesting}
                        onClick={async (e) => {
                          const form = (e.currentTarget as HTMLElement).closest('form');
                          const tokenInput = form?.querySelector('input[name="telegramBotToken"]') as HTMLInputElement;
                          const chatInput = form?.querySelector('input[name="telegramChatId"]') as HTMLInputElement;
                          const tokenVal = tokenInput?.value || settings?.telegramBotToken || '';
                          const chatVal = chatInput?.value || settings?.telegramChatId || '';
                          handleTestTelegram(tokenVal, chatVal);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{telegramTesting ? 'جاري الإرسال...' : 'إرسال إشعار تجريبي'}</span>
                      </button>
                    </div>

                    {telegramTestFeedback && (
                      <div
                        className={`sm:col-span-2 text-xs font-bold p-3 rounded-xl border flex items-center gap-2 ${
                          telegramTestFeedback.success
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        <span>{telegramTestFeedback.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shared Save Button for Sub-tabs 1..4 */}
                <div className="pt-3 border-t border-[#E8E0D5] flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[44px] bg-[#231710] hover:bg-[#3A271C] text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
                  </button>
                </div>
              </form>

              {/* Sub-Tab: إعدادات وتصميم الفاتورة الحية */}
              {settingsSubTab === 'receipt' && (
                <ReceiptSettingsStudio
                  settings={settings}
                  saving={saving}
                  onNotify={(msg) => showToast(msg)}
                  onSaveReceiptSettings={async ({
                    receiptConfig,
                    thermalPaperWidthMm,
                    enableDirectEscPosPrint,
                    autoOpenCashDrawer,
                  }) => {
                    await updateStorePayload(
                      {
                        settings: {
                          ...settings,
                          receiptConfig,
                          thermalPaperWidthMm,
                          enableDirectEscPosPrint,
                          autoOpenCashDrawer,
                        },
                      },
                      'تم حفظ إعدادات وتصميم الفاتورة بنجاح'
                    );
                  }}
                />
              )}

              {/* Sub-Tab 5: النسخ الاحتياطي والنظام */}
              {settingsSubTab === 'backup' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E8E0D5] space-y-4">
                    <div className="border-b border-[#E8E0D5] pb-3">
                      <h3 className="text-base font-bold text-[#231710]">
                        النسخ الاحتياطي واستعادة قاعدة البيانات
                      </h3>
                      <p className="text-xs text-[#6B5644] mt-0.5 leading-relaxed">
                        تحميل نسخة احتياطية شاملة لكافة المنتجات والأقسام والطلبات والإعدادات أو استعادتها في أي وقت.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleExportBackupJson}
                        className="w-full bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>تحميل نسخة احتياطية كاملة</span>
                      </button>

                      <label className="w-full bg-white hover:bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
                        <Upload className="w-4 h-4 text-[#6B5644]" />
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

                  {/* Immutable Security & Financial Audit Log */}
                  <AuditLogsViewer
                    adminToken={adminToken}
                    initialLogs={storeData?.auditLogs || []}
                  />

                  {/* Pre-Launch Operational Reset Safeguard (Super Admin Only) */}
                  {currentRole === 'super_admin' && (
                    <PreLaunchResetSafeguard
                      adminToken={adminToken}
                      isSuperAdmin={true}
                      onResetComplete={() => {
                        refreshStore();
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* SUPERMARKET 80MM THERMAL RECEIPT MODAL */}
      {selectedInvoiceOrder && (
        <SupermarketReceiptModal
          order={selectedInvoiceOrder}
          mode="receipt"
          showProfit={isFullAdmin || currentRole === 'accountant'}
          settings={settings}
          onClose={() => {
            setSelectedInvoiceOrder(null);
            updateUrlQueryParams({ invoice: null });
          }}
        />
      )}

      {/* PHYSICAL INVENTORY ADJUSTMENT & AUDIT MODAL */}
      <InventoryAdjustmentModal
        isOpen={isInventoryAdjustmentModalOpen}
        onClose={() => setIsInventoryAdjustmentModalOpen(false)}
        products={products}
        currentRole={currentRole}
        onStockUpdated={() => {
          refreshStore();
        }}
      />

      {/* RAPID 20-BEAM BARCODE SCANNER ONBOARDING & CSV IMPORT MODAL */}
      <RapidBarcodeCatalogModal
        isOpen={isRapidBarcodeModalOpen}
        onClose={() => setIsRapidBarcodeModalOpen(false)}
        products={products}
        categories={categories}
        saving={saving}
        onSaveCatalog={async (nextProducts, toastMsg) => {
          await updateStorePayload({ products: nextProducts }, toastMsg);
        }}
      />

      {/* TRANSFER RECEIPT IMAGE LIGHTBOX MODAL */}
      {receiptPreviewOrder && receiptPreviewOrder.paymentReceiptImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setReceiptPreviewOrder(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E8E0D5] max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#E8E0D5] flex items-center justify-between bg-[#FAF6F0]">
              <div>
                <h4 className="font-cairo font-bold text-sm text-[#231710]">
                  إيصال التحويل الإلكتروني — طلب #{receiptPreviewOrder.orderNumber}
                </h4>
                <p className="text-[11px] text-[#6B5A4E]">
                  {receiptPreviewOrder.customerName} • الإجمالي: {receiptPreviewOrder.total}{' '}
                  {settings.currencySymbol || 'ج.م'}
                  {receiptPreviewOrder.paymentReference
                    ? ` • مرجع: ${receiptPreviewOrder.paymentReference}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptPreviewOrder(null)}
                className="p-1.5 rounded-xl bg-white border border-[#E8E0D5] text-[#231710] hover:bg-[#231710] hover:text-white cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-[#18120E] flex items-center justify-center max-h-[75vh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptPreviewOrder.paymentReceiptImage}
                alt={`إيصال تحويل طلب #${receiptPreviewOrder.orderNumber}`}
                className="max-w-full max-h-[68vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
