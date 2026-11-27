'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Scale,
  Coffee,
  Gift,
  Receipt,
  Wallet,
  Truck,
  ArrowRight,
  ShoppingBag,
  ChevronDown,
  LogOut,
  RefreshCw,
  WifiOff,
  Volume2,
  VolumeX,
  Monitor,
  Printer,
} from 'lucide-react';
import { playOrderAlertChime, isAudioMuted, toggleAudioMuted } from '@/lib/audio-chime';
import { useStore } from '@/context/StoreContext';
import {
  AdminRole,
  CartItem,
  Category,
  Coupon,
  Order,
  OrderStatus,
  PaymentMethod,
  PosExpense,
  PosOrderType,
  PosPaymentSplit,
  PosRegisterConfig,
  PosReturnItem,
  PosReturnRecord,
  PosShift,
  Product,
  VipMember,
} from '@/types/store';
import {
  calculateVipCashback,
  isUnitProduct,
  mapPhysicalScannerKeyToAscii,
  normalizeBarcodeScanInput,
  parseScaleBarcode,
} from '@/lib/pricing';
import {
  formatCategoryName,
  getCityName,
  getCurrencySymbol,
  getResolvedFeatureFlags,
  getSafeImageUrl,
} from '@/lib/defaults';
import { validateCoupon, validateEgyptianPhone } from '@/lib/validation';
import { calculateOrderTaxBreakdown } from '@/lib/tax';
import SupermarketReceiptModal, {
  StickerPreviewData,
} from '@/components/SupermarketReceiptModal';
import PosActiveInvoiceSidebar, {
  HeldPosInvoice,
  DEFAULT_POS_CART_WIDTH,
  MIN_POS_CART_WIDTH,
  MAX_POS_CART_WIDTH,
} from '@/components/pos/PosActiveInvoiceSidebar';
import PosDirectSalesPage from '@/components/pos/PosDirectSalesPage';
import PosBoxesPage from '@/components/pos/PosBoxesPage';
import PosCoffeeBlendPage from '@/components/pos/PosCoffeeBlendPage';
import PosInvoicesTablePage from '@/components/pos/PosInvoicesTablePage';
import PosShiftSummaryPage from '@/components/pos/PosShiftSummaryPage';
import PosOnlineOrdersPage from '@/components/pos/PosOnlineOrdersPage';
import {
  updateUrlQueryParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';
import {
  getPosOfflineQueue,
  enqueuePosOfflineInvoice,
  syncPosOfflineQueue,
  savePosOfflineSnapshot,
  loadPosOfflineSnapshot,
} from '@/lib/pos-offline';

const ADMIN_SESSION_STORAGE_KEY = 'nuts_admin_session';
const HELD_INVOICES_STORAGE_KEY = 'nuts_pos_held_invoices';
const POS_CART_WIDTH_STORAGE_KEY = 'nuts_pos_cart_width';
const POS_REGISTER_STORAGE_KEY = 'mizan_pos_register_id';
const POS_AUTO_PRINT_STORAGE_KEY = 'mizan_pos_auto_print';

export type PosPageId =
  | 'direct_sales'
  | 'boxes'
  | 'coffee_blend'
  | 'invoices_table'
  | 'shift_summary'
  | 'online_orders';

export default function HafsaPosCashierPage() {
  const pathname = usePathname();
  const isEmbeddedInAdmin = pathname?.startsWith('/admin') ?? false;
  const { storeData, refreshStore, showToast } = useStore();
  const [offlineCatalogProducts, setOfflineCatalogProducts] = useState<Product[]>([]);
  const [offlineCatalogCategories, setOfflineCatalogCategories] = useState<Category[]>([]);
  const rawProductsSource =
    storeData?.products && storeData.products.length > 0
      ? storeData.products
      : offlineCatalogProducts;
  const products = rawProductsSource.filter((p) => p.showInPos !== false);
  const categories =
    storeData?.categories && storeData.categories.length > 0
      ? storeData.categories
      : offlineCatalogCategories;
  const promotions = storeData?.promotions || [];
  const settings = storeData?.settings;
  const featureFlags = getResolvedFeatureFlags(settings);
  const currency = getCurrencySymbol(settings);
  const cityName = getCityName(settings);
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';

  // Cashier & Staff Role Isolation Auth State
  const [posAuthChecking, setPosAuthChecking] = useState<boolean>(true);
  const [posAuthenticated, setPosAuthenticated] = useState<boolean>(false);
  const [posRole, setPosRole] = useState<AdminRole>('cashier');
  const [posToken, setPosToken] = useState<string>('');
  const [posStaffDisplayName, setPosStaffDisplayName] = useState<string>('');
  const [posLoginUsername, setPosLoginUsername] = useState<string>('');
  const [posLoginPassword, setPosLoginPassword] = useState<string>('');
  const [posLoginError, setPosLoginError] = useState<string>('');

  // Cashier is strictly isolated from wholesale raw costs and net profits
  const canSeeProfits = posRole === 'super_admin' || posRole === 'accountant';

  // POS Emergency Offline Queue & Network Resilience
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  // 6-Page POS Navigation State + Internal Sub-Sections State
  const [activePage, setActivePage] = useState<PosPageId>('direct_sales');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [boxTab, setBoxTab] = useState<'ready' | 'touch_builder'>('ready');
  const [coffeeTab, setCoffeeTab] = useState<'ready' | 'custom_bag'>('ready');
  const [invoiceSourceFilter, setInvoiceSourceFilter] = useState<
    'all_pos' | 'counter_takeaway' | 'glass_bar_dine_in' | 'phone_delivery' | 'online' | 'all'
  >('all_pos');
  const [onlineDeliveryFilter, setOnlineDeliveryFilter] = useState<
    'all' | 'bandar_fast' | 'villages_scheduled' | 'governorate_shipping' | 'store_pickup'
  >('all');

  useBrowserUrlSync((params) => {
    const pg = params.get('posPage') as PosPageId | null;
    if (
      pg &&
      [
        'direct_sales',
        'boxes',
        'coffee_blend',
        'invoices_table',
        'shift_summary',
        'online_orders',
      ].includes(pg)
    ) {
      setActivePage(pg);
    } else if (!pg) {
      setActivePage('direct_sales');
    }

    const sub = params.get('posSub');
    if (pg === 'boxes' && (sub === 'ready' || sub === 'touch_builder')) {
      setBoxTab(sub);
    } else if (pg === 'coffee_blend' && (sub === 'ready' || sub === 'custom_bag')) {
      setCoffeeTab(sub);
    } else if (
      pg === 'invoices_table' &&
      sub &&
      ['all_pos', 'counter_takeaway', 'glass_bar_dine_in', 'phone_delivery', 'online', 'all'].includes(
        sub
      )
    ) {
      setInvoiceSourceFilter(sub as any);
    } else if (
      pg === 'online_orders' &&
      sub &&
      ['all', 'bandar_fast', 'villages_scheduled', 'governorate_shipping', 'store_pickup'].includes(sub)
    ) {
      setOnlineDeliveryFilter(sub as any);
    } else if (!pg || pg === 'direct_sales') {
      setSelectedCategoryId(sub || 'all');
    }
  });

  // POS Server State & Multi-Register Support
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('reg-1');
  const [posRegisters, setPosRegisters] = useState<PosRegisterConfig[]>([
    { id: 'reg-1', name: 'ماكينة كاشير 1 (الرئيسية)', active: true },
    { id: 'reg-2', name: 'ماكينة كاشير 2 (الفرعية)', active: true },
  ]);
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [openShifts, setOpenShifts] = useState<PosShift[]>([]);
  const [posShifts, setPosShifts] = useState<PosShift[]>([]);
  const [posExpenses, setPosExpenses] = useState<PosExpense[]>([]);
  const [posReturns, setPosReturns] = useState<PosReturnRecord[]>([]);
  const [posCoupons, setPosCoupons] = useState<Coupon[]>([]);
  const [posVipMembers, setPosVipMembers] = useState<VipMember[]>([]);
  const [creditConfig, setCreditConfig] = useState<{
    enableCreditSales: boolean;
    creditSalesRequireApproval: boolean;
  }>({ enableCreditSales: false, creditSalesRequireApproval: true });
  const [taxConfig, setTaxConfig] = useState<{
    enableTax: boolean;
    taxRatePercent: number;
    taxPricingMode: 'inclusive' | 'exclusive';
    taxRegistrationNumber?: string;
  }>({ enableTax: false, taxRatePercent: 14, taxPricingMode: 'inclusive' });
  const [recentPosOrders, setRecentPosOrders] = useState<Order[]>([]);
  const [onlineQueueOrders, setOnlineQueueOrders] = useState<Order[]>([]);
  const [isPosAudioMuted, setIsPosAudioMuted] = useState(false);
  const [isPosAutoPrint, setIsPosAutoPrint] = useState(false);
  const prevOnlineOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialPosFetchRef = useRef<boolean>(true);

  useEffect(() => {
    setIsPosAudioMuted(isAudioMuted());
    try {
      setIsPosAutoPrint(localStorage.getItem(POS_AUTO_PRINT_STORAGE_KEY) === '1');
    } catch {}
  }, []);
  const [availableRiders, setAvailableRiders] = useState<Array<{ id: string; displayName?: string; username?: string }>>([]);
  const [posLoading, setPosLoading] = useState<boolean>(false);

  // Current Active POS Invoice Cart State (shared across Direct Sales, Boxes, Coffee Blend)
  const [posItems, setPosItems] = useState<CartItem[]>([]);
  const [posOrderType, setPosOrderType] = useState<PosOrderType>('counter_takeaway');
  const [chairNumber, setChairNumber] = useState<1 | 2 | 3 | 4>(1);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [cashierDiscount, setCashierDiscount] = useState<number>(0);
  const [couponCode, setCouponCode] = useState<string>('');
  const [useVipWallet, setUseVipWallet] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentSplits, setPaymentSplits] = useState<PosPaymentSplit[]>([]);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [cashTenderedInput, setCashTenderedInput] = useState<number | ''>('');

  // Held / Parked Invoices State
  const [heldInvoices, setHeldInvoices] = useState<HeldPosInvoice[]>([]);

  // Resizable Cart Sidebar Width State (Default 290px, user-adjustable)
  const [cartWidth, setCartWidth] = useState<number>(DEFAULT_POS_CART_WIDTH);

  // Slim POS Top Bar Dropdown State ("Hick's Law" 4-Choice Navigation)
  const [openNavMenu, setOpenNavMenu] = useState<null | 'boxes_coffee' | 'invoices_online'>(null);
  const topBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openNavMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (topBarRef.current && !topBarRef.current.contains(e.target as Node)) {
        setOpenNavMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenNavMenu(null);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [openNavMenu]);

  // Printable Receipt / Sticker / Z-Report / Return Modal State
  const [printedOrder, setPrintedOrder] = useState<Order | null>(null);
  const [printedShift, setPrintedShift] = useState<PosShift | null>(null);
  const [printedReturn, setPrintedReturn] = useState<PosReturnRecord | null>(null);
  const [initialReturnOrder, setInitialReturnOrder] = useState<Order | null>(null);
  const [stickerPreviewItem, setStickerPreviewItem] =
    useState<StickerPreviewData | null>(null);
  const [printMode, setPrintMode] = useState<'receipt' | 'sticker' | 'zreport' | 'return'>('receipt');

  // Load Held Invoices, Preferred Register & Cart Width from localStorage
  useEffect(() => {
    try {
      const savedReg = localStorage.getItem(POS_REGISTER_STORAGE_KEY);
      if (savedReg && savedReg.trim()) {
        setSelectedRegisterId(savedReg.trim());
      }
      const raw = localStorage.getItem(HELD_INVOICES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHeldInvoices(parsed);
      }
      const savedWidth = Number(localStorage.getItem(POS_CART_WIDTH_STORAGE_KEY));
      if (
        !Number.isNaN(savedWidth) &&
        savedWidth >= MIN_POS_CART_WIDTH &&
        savedWidth <= MAX_POS_CART_WIDTH
      ) {
        setCartWidth(savedWidth);
      }
    } catch {}
  }, []);

  const handleChangeCartWidth = useCallback((nextWidth: number) => {
    const clamped = Math.min(
      MAX_POS_CART_WIDTH,
      Math.max(MIN_POS_CART_WIDTH, Math.round(nextWidth))
    );
    setCartWidth(clamped);
    try {
      localStorage.setItem(POS_CART_WIDTH_STORAGE_KEY, String(clamped));
    } catch {}
  }, []);

  const saveHeldInvoices = (next: HeldPosInvoice[]) => {
    setHeldInvoices(next);
    try {
      localStorage.setItem(HELD_INVOICES_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // Web Audio Chime for Cashier Actions & Alerts
  const playCashierBeep = useCallback((freq = 880, duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }, []);

  const fetchPosData = useCallback(
    async (overrideToken?: string, overrideRegisterId?: string) => {
      try {
        const tokenToUse = overrideToken ?? posToken;
        const regToUse =
          overrideRegisterId ??
          (typeof window !== 'undefined'
            ? localStorage.getItem(POS_REGISTER_STORAGE_KEY) || selectedRegisterId
            : selectedRegisterId);
        const headers: Record<string, string> = {};
        if (tokenToUse) {
          headers['Authorization'] = `Bearer ${tokenToUse}`;
        }
        const query = regToUse ? `?registerId=${encodeURIComponent(regToUse)}` : '';
        const res = await fetch(`/api/pos${query}`, { cache: 'no-store', headers });
        if (res.ok) {
          const data = await res.json();
          setActiveShift(data.activeShift || null);
          setOpenShifts(data.openShifts || []);
          if (Array.isArray(data.posRegisters) && data.posRegisters.length > 0) {
            setPosRegisters(data.posRegisters);
          }
          setPosShifts(data.posShifts || []);
          setPosExpenses(data.posExpenses || []);
          setPosReturns(data.posReturns || []);
          setPosCoupons(data.coupons || []);
          setPosVipMembers(data.vipMembers || []);
          if (data.creditConfig) setCreditConfig(data.creditConfig);
          if (data.taxConfig) setTaxConfig(data.taxConfig);
          setRecentPosOrders(data.recentPosOrders || []);
          const incoming = data.onlineQueueOrders || [];
          if (!isInitialPosFetchRef.current) {
            const newlyArrived = incoming.filter(
              (o: Order) =>
                !prevOnlineOrderIdsRef.current.has(o.id) &&
                (o.status === 'pending' || o.status === 'confirmed' || o.status === 'roasting_packing')
            );
            if (newlyArrived.length > 0) {
              playOrderAlertChime();
              showToast(
                `طلب أونلاين جديد بالفرع (${newlyArrived[0].orderNumber})`,
                `العميل: ${newlyArrived[0].customerName} — الإجمالي: ${newlyArrived[0].total} ج.م`
              );
            }
          }
          isInitialPosFetchRef.current = false;
          prevOnlineOrderIdsRef.current = new Set(incoming.map((o: Order) => o.id));
          setOnlineQueueOrders(incoming);
          if (data.availableRiders) setAvailableRiders(data.availableRiders);
        }
      } catch (e) {
        console.error('Failed to load POS data — hydrating from IndexedDB snapshot', e);
        const snap = await loadPosOfflineSnapshot();
        if (snap) {
          if (snap.products?.length) setOfflineCatalogProducts(snap.products);
          if (snap.categories?.length) setOfflineCatalogCategories(snap.categories);
          if (snap.coupons?.length) setPosCoupons(snap.coupons);
          if (snap.vipMembers?.length) setPosVipMembers(snap.vipMembers);
          if (snap.activeShift) setActiveShift(snap.activeShift);
          if (snap.posRegisters?.length) setPosRegisters(snap.posRegisters);
        }
      }
    },
    [posToken, selectedRegisterId, showToast]
  );

  // Persist live catalog + POS state into IndexedDB whenever online data updates
  useEffect(() => {
    if (!storeData?.products || storeData.products.length === 0) return;
    void savePosOfflineSnapshot({
      products: storeData.products,
      categories: storeData.categories || [],
      coupons: posCoupons.length > 0 ? posCoupons : storeData.coupons || [],
      vipMembers: posVipMembers.length > 0 ? posVipMembers : storeData.vipMembers || [],
      activeShift,
      posRegisters,
      settings: storeData.settings,
    });
  }, [
    storeData?.products,
    storeData?.categories,
    storeData?.coupons,
    storeData?.vipMembers,
    storeData?.settings,
    posCoupons,
    posVipMembers,
    activeShift,
    posRegisters,
  ]);

  const handleSelectRegisterId = useCallback(
    async (nextRegId: string) => {
      setSelectedRegisterId(nextRegId);
      try {
        localStorage.setItem(POS_REGISTER_STORAGE_KEY, nextRegId);
      } catch {}
      await fetchPosData(undefined, nextRegId);
    },
    [fetchPosData]
  );

  const handleSyncOfflineQueue = useCallback(async () => {
    if (isSyncingOffline) return;
    const currentQueue = getPosOfflineQueue();
    if (currentQueue.length === 0) {
      setOfflineQueueCount(0);
      return;
    }
    setIsSyncingOffline(true);
    try {
      const res = await syncPosOfflineQueue(posToken);
      if (res.success) {
        setOfflineQueueCount(res.remainingCount);
        await fetchPosData();
        await refreshStore();
        showToast(
          `تمت مزامنة ${res.syncedCount} فاتورة طوارئ بنجاح مع الخادم`,
          res.remainingCount > 0 ? `المتبقي: ${res.remainingCount}` : 'تم إفراغ طابور الطوارئ بالكامل'
        );
      } else {
        showToast('تعذر إتمام مزامنة بعض فواتير الطوارئ', res.error);
      }
    } catch (e: any) {
      showToast('خطأ في الاتصال أثناء المزامنة', e?.message);
    } finally {
      setIsSyncingOffline(false);
    }
  }, [isSyncingOffline, posToken, fetchPosData, refreshStore, showToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    setOfflineQueueCount(getPosOfflineQueue().length);

    const handleOnline = () => {
      setIsOnline(true);
      const queueLen = getPosOfflineQueue().length;
      setOfflineQueueCount(queueLen);
      if (queueLen > 0) {
        handleSyncOfflineQueue();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setOfflineQueueCount(getPosOfflineQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleSyncOfflineQueue]);

  // Verify Cashier Session on Mount (with Offline Reload Resilience via IndexedDB)
  useEffect(() => {
    const verifyPosSession = async () => {
      let savedToken = '';
      let savedRole: AdminRole | undefined;
      let savedUsername = '';
      try {
        const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.token && (parsed?.expiresAt ? parsed.expiresAt > Date.now() : true)) {
              savedToken = parsed.token;
              savedRole = parsed.role;
              savedUsername = parsed.username || '';
            }
          } catch {}
        }
        if (!savedToken) {
          savedToken =
            sessionStorage.getItem('admin_token') ||
            localStorage.getItem('admin_token') ||
            '';
        }
        const headers: Record<string, string> = {};
        if (savedToken) {
          headers['Authorization'] = `Bearer ${savedToken}`;
          headers['x-admin-token'] = savedToken;
        }
        const res = await fetch('/api/admin/login', { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const verifiedRole: AdminRole = data.role || savedRole || 'cashier';
          const activeToken = data.token || savedToken;
          if (activeToken) {
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
          }
          if (verifiedRole === 'supplier' && !data.permissions?.includes('cashier_portal') && !window.location.pathname.startsWith('/admin')) {
            window.location.replace('/supplier');
            return;
          }
          if (verifiedRole === 'accountant' && !data.permissions?.includes('cashier_portal') && !window.location.pathname.startsWith('/admin')) {
            window.location.replace('/admin');
            return;
          }
          if (verifiedRole === 'delivery_rider') {
            setPosAuthenticated(false);
            setPosRole(verifiedRole);
            setPosLoginError(
              'عزل الأدوار: هذا الحساب غير مصرح له بالدخول إلى شاشة الكاشير ونقطة البيع.'
            );
          } else {
            setPosToken(activeToken);
            setPosRole(verifiedRole);
            if (data.displayName || data.username) {
              setPosStaffDisplayName(data.displayName || data.username);
            }
            setPosAuthenticated(true);
            setPosAuthChecking(false);
            void fetchPosData(activeToken);
          }
        } else {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_token');
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          setPosAuthenticated(false);
        }
      } catch {
        // Offline reload resilience: keep valid non-expired cashier/admin session active & load IndexedDB snapshot
        if (
          savedToken &&
          (!savedRole || savedRole === 'cashier' || savedRole === 'super_admin')
        ) {
          setPosToken(savedToken);
          setPosRole(savedRole || 'cashier');
          if (savedUsername) setPosStaffDisplayName(savedUsername);
          setPosAuthenticated(true);
          const snap = await loadPosOfflineSnapshot();
          if (snap) {
            if (snap.products?.length) setOfflineCatalogProducts(snap.products);
            if (snap.categories?.length) setOfflineCatalogCategories(snap.categories);
            if (snap.coupons?.length) setPosCoupons(snap.coupons);
            if (snap.vipMembers?.length) setPosVipMembers(snap.vipMembers);
            if (snap.activeShift) setActiveShift(snap.activeShift);
            if (snap.posRegisters?.length) setPosRegisters(snap.posRegisters);
          }
        } else {
          setPosAuthenticated(false);
        }
      } finally {
        setPosAuthChecking(false);
      }
    };
    verifyPosSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePosLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosLoginError('');
    if (!posLoginUsername.trim() || !posLoginPassword.trim()) {
      setPosLoginError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: posLoginUsername.trim(),
          password: posLoginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPosLoginError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
        return;
      }
      const role: AdminRole = data.role || 'cashier';
      localStorage.setItem(
        ADMIN_SESSION_STORAGE_KEY,
        JSON.stringify({
          token: data.token,
          expiresAt: data.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
          role,
          username: data.username,
        })
      );
      sessionStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_token', data.token);
      sessionStorage.setItem('hafsa_pos_token_v1', data.token);
      sessionStorage.setItem('hafsa_pos_role_v1', role);
      if (role === 'supplier') {
        window.location.href = '/supplier';
        return;
      }
      if (role === 'accountant') {
        window.location.href = '/admin';
        return;
      }
      if (role === 'delivery_rider') {
        setPosLoginError('عزل الأدوار: هذا الحساب غير مصرح له بفتح شاشة الكاشير');
        return;
      }
      setPosToken(data.token);
      setPosRole(role);
      if (data.displayName || data.username) {
        setPosStaffDisplayName(data.displayName || data.username);
      }
      setPosAuthenticated(true);
      setPosLoginPassword('');
      void fetchPosData(data.token);
      showToast(`تم فتح نقطة بيع الكاشير بنجاح (${data.username || role})`);
    } catch {
      setPosLoginError('تعذر الاتصال بالخادم');
    }
  };

  const handlePosLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('hafsa_pos_token_v1');
    sessionStorage.removeItem('hafsa_pos_role_v1');
    setPosToken('');
    setPosAuthenticated(false);
    setPosLoginPassword('');
    showToast('تم تسجيل الخروج بنجاح');
  };

  // Lookup VIP Member by phone (prefers live POS endpoint vipMembers with credit fields)
  const matchedVipMember: VipMember | null = useMemo(() => {
    const pool = posVipMembers.length > 0 ? posVipMembers : storeData?.vipMembers || [];
    if (!customerPhone.trim() || pool.length === 0) return null;
    const check = validateEgyptianPhone(customerPhone);
    const target = check.isValid ? check.normalized : customerPhone.trim();
    const found = pool.find(
      (m) => m.phone === target || m.membershipCode === customerPhone.trim()
    );
    if (!found) return null;
    const bal = found.pointsBalance ?? found.walletBalance ?? 0;
    return {
      ...found,
      pointsBalance: bal,
      walletBalance: bal,
      customerName: found.customerName || found.name || 'عميل VIP',
    };
  }, [customerPhone, posVipMembers, storeData?.vipMembers]);

  // Auto-fill customer name when VIP member is matched
  useEffect(() => {
    if (matchedVipMember && !customerName) {
      setCustomerName(matchedVipMember.customerName || matchedVipMember.name || '');
    }
  }, [matchedVipMember, customerName]);

  // Add Item to POS Invoice
  const addPosItem = useCallback(
    (item: CartItem) => {
      playCashierBeep(960, 0.1);
      setPosItems((prev) => {
        const idx = prev.findIndex((i) => i.cartItemId === item.cartItemId);
        if (idx > -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            quantity: updated[idx].quantity + item.quantity,
          };
          return updated;
        }
        return [...prev, item];
      });
    },
    [playCashierBeep]
  );

  // Hold / Park Current Invoice
  const handleHoldCurrentInvoice = () => {
    if (posItems.length === 0) return;
    const label =
      customerName.trim() ||
      customerPhone.trim() ||
      (posOrderType === 'glass_bar_dine_in'
        ? `البار كرسي ${chairNumber}`
        : `فاتورة معلقة #${heldInvoices.length + 1}`);

    const newHeld: HeldPosInvoice = {
      id: `held-${Date.now()}`,
      label,
      createdAt: new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      items: posItems,
      posOrderType,
      chairNumber,
      customerPhone,
      customerName,
      deliveryAddress,
      invoiceNotes,
      cashierDiscount,
      couponCode: couponCode || undefined,
    };

    saveHeldInvoices([newHeld, ...heldInvoices]);
    setPosItems([]);
    setCustomerPhone('');
    setCustomerName('');
    setDeliveryAddress('');
    setInvoiceNotes('');
    setCashierDiscount(0);
    setCouponCode('');
    setUseVipWallet(false);
    setPaymentSplits([]);
    setCashTenderedInput('');
    showToast(`تم تعليق "${label}" مؤقتاً`, 'يمكنك استرجاعها في أي وقت بضغطة واحدة');
  };

  const handleRestoreHeldInvoice = (id: string) => {
    const target = heldInvoices.find((h) => h.id === id);
    if (!target) return;
    setPosItems(target.items);
    setPosOrderType(target.posOrderType);
    setChairNumber(target.chairNumber);
    setCustomerPhone(target.customerPhone);
    setCustomerName(target.customerName);
    setDeliveryAddress(target.deliveryAddress);
    setInvoiceNotes(target.invoiceNotes);
    setCashierDiscount(target.cashierDiscount);
    setCouponCode(target.couponCode || '');
    saveHeldInvoices(heldInvoices.filter((h) => h.id !== id));
    showToast(`تم استرجاع "${target.label}" إلى الفاتورة النشطة`);
  };

  const handleDeleteHeldInvoice = (id: string) => {
    saveHeldInvoices(heldInvoices.filter((h) => h.id !== id));
  };

  // Invoice Totals, Coupon, Optional VAT & Profit Margin Calculation
  const posSubtotal = useMemo(
    () => posItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [posItems]
  );

  const posRawCostTotal = useMemo(
    () =>
      posItems.reduce((sum, i) => {
        const unitCost = i.rawCostEgp || Math.round(i.unitPrice * 0.7);
        return sum + unitCost * i.quantity;
      }, 0),
    [posItems]
  );

  const activeCouponsList = useMemo(
    () =>
      posCoupons.length > 0
        ? posCoupons
        : (storeData?.coupons || []).filter((c) => c.active),
    [posCoupons, storeData?.coupons]
  );

  const couponValidation = useMemo(() => {
    if (!couponCode.trim()) {
      return { isValid: false, discountAmount: 0, error: '' };
    }
    const clean = couponCode.trim().toUpperCase();
    const matched = activeCouponsList.find((c) => c.code.toUpperCase() === clean);
    const res = validateCoupon(matched, posSubtotal);
    return {
      isValid: res.isValid,
      discountAmount: res.isValid ? res.discountAmount : 0,
      error: res.isValid ? '' : res.error || 'كود الكوبون غير صالح',
    };
  }, [couponCode, activeCouponsList, posSubtotal]);

  const posShipping = posOrderType === 'phone_delivery' ? 20 : 0;
  const manualSafeDiscount = Math.max(0, Math.min(posSubtotal, Number(cashierDiscount) || 0));
  const safeDiscount = Math.max(
    0,
    Math.min(posSubtotal, manualSafeDiscount + couponValidation.discountAmount)
  );

  const posTaxBreakdown = useMemo(
    () =>
      calculateOrderTaxBreakdown(
        posItems,
        storeData?.products || [],
        safeDiscount,
        settings
      ),
    [posItems, storeData?.products, safeDiscount, settings]
  );

  const totalBeforeVipWallet = Math.max(
    0,
    Math.round((posSubtotal - safeDiscount + posShipping + posTaxBreakdown.totalAddition) * 100) /
      100
  );

  const vipWalletRedeemable = useMemo(() => {
    if (paymentMethod === 'split') return 0;
    if (!useVipWallet || !matchedVipMember) return 0;
    return Math.min(matchedVipMember.pointsBalance || 0, totalBeforeVipWallet);
  }, [paymentMethod, useVipWallet, matchedVipMember, totalBeforeVipWallet]);

  const posNetTotal = Math.max(
    0,
    Math.round((totalBeforeVipWallet - vipWalletRedeemable) * 100) / 100
  );
  const posNetProfit = Math.round(
    posNetTotal - (posTaxBreakdown.taxEnabled ? posTaxBreakdown.taxAmount : 0) - posShipping - posRawCostTotal
  );
  const posProfitMargin =
    posNetTotal > 0 ? Math.round((posNetProfit / posNetTotal) * 1000) / 10 : 0;

  const posVipCashbackEarned = useMemo(() => {
    if (paymentMethod === 'credit') return 0;
    const eligible = Math.max(0, posSubtotal - safeDiscount - vipWalletRedeemable);
    return calculateVipCashback(
      eligible,
      settings?.vipMinOrderForCashback || 150,
      settings?.vipCashbackPercent || 5
    );
  }, [paymentMethod, posSubtotal, safeDiscount, vipWalletRedeemable, settings]);

  const effectiveCashTendered =
    cashTenderedInput === ''
      ? posNetTotal
      : Math.max(0, Number(cashTenderedInput) || 0);
  const changeDue = Math.max(0, effectiveCashTendered - posNetTotal);

  const getPosAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (posToken) {
      headers['Authorization'] = `Bearer ${posToken}`;
    }
    return headers;
  };

  // Issue & Print POS Invoice
  const handleCompletePosInvoice = async (overridePaymentMethod?: PaymentMethod) => {
    if (posItems.length === 0) {
      showToast('الفاتورة فارغة، أضف صنفاً واحداً على الأقل');
      return;
    }
    const chosenPaymentMethod: PaymentMethod =
      typeof overridePaymentMethod === 'string' ? overridePaymentMethod : paymentMethod;
    const currentlyOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const selectedRegObj = posRegisters.find((r) => r.id === selectedRegisterId);
    const clientOrderId = `pos-ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const saveOfflineFallback = () => {
      const isWhatsappOffline = posOrderType === 'whatsapp_online';
      const offlineOrderNumber = `${isWhatsappOffline ? 'WA-OFF-' : 'POS-OFF-'}${Math.floor(1000 + Math.random() * 9000)}`;
      const offlineOrder: Order = {
        id: clientOrderId,
        orderNumber: offlineOrderNumber,
        orderSource: isWhatsappOffline ? 'online' : 'pos',
        posOrderType,
        chairNumber: posOrderType === 'glass_bar_dine_in' ? chairNumber : undefined,
        registerId: selectedRegisterId,
        registerName: selectedRegObj?.name,
        cashierId: posStaffDisplayName || 'pos-cashier',
        cashierName: posStaffDisplayName || 'كاشير الفرع',
        customerName: customerName.trim() || 'عميل الفرع المباشر',
        customerPhone: customerPhone.trim() || '01000000000',
        governorate: `${cityName} — الفرع الرئيسي`,
        address:
          deliveryAddress.trim() ||
          (isWhatsappOffline
            ? `طلب واتساب / سوشيال أونلاين — ${cityName}`
            : 'استلام فوري من كاشير المحل'),
        notes: invoiceNotes.trim() ? `[أوفلاين] ${invoiceNotes.trim()}` : '[أوفلاين]',
        deliveryMethod:
          posOrderType === 'phone_delivery' || isWhatsappOffline
            ? 'bandar_fast'
            : 'store_pickup',
        items: [...posItems],
        subtotal: posSubtotal,
        shippingCost: posShipping,
        discountAmount: safeDiscount,
        couponCode: couponValidation.isValid ? couponCode.trim().toUpperCase() : undefined,
        vipRedeemedAmount: 0,
        vipWalletRedeemed: 0,
        vipCashbackEarned: posVipCashbackEarned,
        ...(posTaxBreakdown.taxEnabled
          ? {
              taxAmount: posTaxBreakdown.taxAmount,
              taxRatePercent: posTaxBreakdown.taxRatePercent,
              taxInclusive: posTaxBreakdown.taxInclusive,
            }
          : {}),
        total: posNetTotal,
        cashTendered: effectiveCashTendered,
        changeDue,
        paymentMethod: chosenPaymentMethod,
        ...(chosenPaymentMethod === 'split' ? { paymentSplits } : {}),
        paymentReference: paymentReference.trim() || undefined,
        status: 'delivered',
        createdAt: new Date().toISOString(),
      };

      enqueuePosOfflineInvoice(offlineOrder);
      setOfflineQueueCount(getPosOfflineQueue().length);
      playCashierBeep(1046.5, 0.25);
      setPrintedOrder(offlineOrder);
      setStickerPreviewItem(null);
      setPrintedShift(null);
      setPrintedReturn(null);
      setPrintMode('receipt');
      setPosItems([]);
      setCashierDiscount(0);
      setCouponCode('');
      setPaymentSplits([]);
      setCashTenderedInput('');
      setInvoiceNotes('');
      setUseVipWallet(false);
      setPosOrderType('counter_takeaway');
      showToast(
        `وضع الطوارئ (أوفلاين): تم حفظ الفاتورة ${offlineOrderNumber} محلياً وجاهزة للطباعة`,
        `سيتم ترحيل الفاتورة تلقائياً عند عودة الاتصال بالإنترنت`
      );
    };

    if (currentlyOffline) {
      saveOfflineFallback();
      setPosLoading(false);
      return;
    }

    setPosLoading(true);
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 6000);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        signal: abortCtrl.signal,
        body: JSON.stringify({
          action: 'create_invoice',
          clientOrderId,
          registerId: selectedRegisterId,
          registerName: selectedRegObj?.name,
          cashierName: posStaffDisplayName || undefined,
          items: posItems,
          posOrderType,
          chairNumber: posOrderType === 'glass_bar_dine_in' ? chairNumber : undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerName: customerName.trim() || undefined,
          address: deliveryAddress.trim() || undefined,
          notes: invoiceNotes.trim() || undefined,
          discountAmount: manualSafeDiscount,
          couponCode: couponValidation.isValid ? couponCode.trim().toUpperCase() : undefined,
          shippingCost: posShipping,
          useVipWallet,
          paymentMethod: chosenPaymentMethod,
          paymentSplits: chosenPaymentMethod === 'split' ? paymentSplits : undefined,
          paymentReference: paymentReference.trim() || undefined,
          cashTendered: effectiveCashTendered,
        }),
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('تعذر إصدار الفاتورة', data.error);
      } else {
        playCashierBeep(1046.5, 0.25);
        setPrintedOrder(data.order);
        setStickerPreviewItem(null);
        setPrintedShift(null);
        setPrintedReturn(null);
        setPrintMode('receipt');
        setPosItems([]);
        setCashierDiscount(0);
        setCouponCode('');
        setPaymentSplits([]);
        if (chosenPaymentMethod === 'split' || chosenPaymentMethod === 'credit') {
          setPaymentMethod('cod');
        }
        setCashTenderedInput('');
        setInvoiceNotes('');
        setUseVipWallet(false);
        setPosOrderType('counter_takeaway');
        showToast(
          `تم إصدار الفاتورة ${data.order.orderNumber} بنجاح`,
          `الإجمالي: ${data.order.total} ج.م • الباقي للعميل: ${data.order.changeDue || 0} ج.م`
        );
        // Refresh POS & global store state non-blockingly so receipt printing & USB Wi-Fi feel instant
        void fetchPosData();
        void refreshStore();
      }
    } catch {
      clearTimeout(timeoutId);
      // Network failure or USB Wi-Fi hang fallback
      saveOfflineFallback();
    } finally {
      setPosLoading(false);
    }
  };

  // Global HID Barcode Scanner Listener (Works anywhere without focusing input)
  // + POS Keyboard Shortcuts: F2 (Search), F4 (Quick Cash Checkout / Invoices), F8 (Hold), Esc (Close)
  const hidBufferRef = useRef<string>('');
  const hidLastKeyAtRef = useRef<number>(0);

  useEffect(() => {
    if (!posAuthenticated) return;

    const handleGlobalPosKeys = (e: KeyboardEvent) => {
      // 1. Escape: close any open print/return modal or clear HID buffer
      if (e.key === 'Escape') {
        hidBufferRef.current = '';
        if (printedOrder || printedReturn || stickerPreviewItem || printedShift) {
          e.preventDefault();
          setPrintedOrder(null);
          setPrintedReturn(null);
          setStickerPreviewItem(null);
          setPrintedShift(null);
          if (printMode === 'zreport' || printMode === 'return') setPrintMode('receipt');
          return;
        }
      }

      // 2. Function Key Shortcuts
      if (e.key === 'F1') {
        e.preventDefault();
        setActivePage('direct_sales');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setActivePage('direct_sales');
        setTimeout(() => {
          const searchEl = document.getElementById('pos-search-input') as HTMLInputElement | null;
          if (searchEl) {
            searchEl.focus();
            searchEl.select();
          }
        }, 40);
        return;
      }
      if (e.key === 'F3') {
        if (featureFlags.enableCoffeeBlender) {
          e.preventDefault();
          setActivePage('coffee_blend');
        } else if (featureFlags.enableCustomBoxes) {
          e.preventDefault();
          setActivePage('boxes');
        }
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (posItems.length > 0 && !posLoading) {
          setPaymentMethod('cod');
          void handleCompletePosInvoice('cod');
        } else {
          setActivePage('invoices_table');
        }
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setActivePage('shift_summary');
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        setActivePage('online_orders');
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        handleHoldCurrentInvoice();
        return;
      }

      // 3. Global HID USB/Bluetooth 20-Beam Barcode Scanner Detector
      // Layout-independent (uses physical e.code so Windows Arabic keyboard never corrupts barcodes)
      // Also catches ultra-fast HID bursts (< 38ms/key) even when focus is inside non-barcode inputs (e.g. cash tendered)
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      const targetId = target?.id || '';
      if (targetId === 'pos-barcode-input' || targetId === 'pos-search-input') {
        return;
      }
      const isEditableField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const delta = now - hidLastKeyAtRef.current;

      if (e.key === 'Enter') {
        const rawScanned = hidBufferRef.current.trim();
        hidBufferRef.current = '';
        const scanned = normalizeBarcodeScanInput(rawScanned);
        const minLen = isEditableField ? 6 : 4;
        const maxEnterDelta = isEditableField ? 60 : 180;

        if (scanned.length >= minLen && delta < maxEnterDelta) {
          e.preventDefault();
          e.stopPropagation();

          // If focus was accidentally inside a numeric/text input while the 20-beam scanner fired,
          // strip the injected trailing barcode characters from that input!
          if (isEditableField && target instanceof HTMLInputElement && target.type !== 'password') {
            const curVal = target.value || '';
            if (curVal.length >= rawScanned.length) {
              const cleanedVal = curVal.slice(0, Math.max(0, curVal.length - rawScanned.length));
              const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              )?.set;
              if (nativeSetter) {
                nativeSetter.call(target, cleanedVal);
                target.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
            target.blur();
          }

          // Check if scanned barcode is an existing POS / Store invoice number -> open Return modal
          const cleanUpper = scanned.replace(/^\*|\*$/g, '').toUpperCase();
          const allKnownOrders = [...recentPosOrders, ...onlineQueueOrders];
          const matchedOrder = allKnownOrders.find(
            (o) =>
              o.orderNumber.toUpperCase() === cleanUpper ||
              o.id.toUpperCase() === cleanUpper
          );
          if (matchedOrder) {
            playCashierBeep(880, 0.14);
            setInitialReturnOrder(matchedOrder);
            setActivePage('invoices_table');
            showToast(
              `تم مسح باركود الفاتورة #${matchedOrder.orderNumber}`,
              'تم فتح نافذة الاسترجاع السريع للفاتورة'
            );
            return;
          }

          // Parse scale barcode (Prefix 20 weight / Prefix 21-22 price) or SKU barcode
          const parsed = parseScaleBarcode(scanned, products);
          if (parsed) {
            const { product, calc, barcodeKind } = parsed;
            const isDeterministicSku = barcodeKind === 'sku' || isUnitProduct(product);
            const weightId = isUnitProduct(product) ? 'u-1' : `scale-${calc.weightGrams}`;
            const cartItemId = isDeterministicSku
              ? `pos-sku-${product.id}-${weightId}`
              : `pos-hid-${product.id}-${calc.weightGrams}-${calc.unitPrice}-${Date.now()}`;

            addPosItem({
              cartItemId,
              productId: product.id,
              productName: product.name,
              productImage: getSafeImageUrl(product.image),
              weightId,
              weightLabel: calc.weightLabel,
              roastOption: product.roastOptions?.[0] || '',
              unitPrice: calc.unitPrice,
              quantity: 1,
              rawCostEgp: calc.rawCostEgp,
              customWeightGrams: calc.weightGrams,
              barcodeLabel: calc.barcodeLabel,
            });
            showToast(
              `تمت إضافة "${product.name}" بالماسح`,
              `${calc.weightLabel} • ${calc.unitPrice} ج.م`
            );
          } else {
            playCashierBeep(320, 0.25);
            showToast('باركود غير معروف', `لم يتم العثور على الصنف: ${scanned}`);
          }
        }
        return;
      }

      const mappedChar = mapPhysicalScannerKeyToAscii(e);
      if (mappedChar) {
        const resetThreshold = isEditableField ? 38 : 110;
        if (delta > resetThreshold) {
          hidBufferRef.current = mappedChar;
        } else {
          hidBufferRef.current += mappedChar;
        }
        hidLastKeyAtRef.current = now;
      }
    };

    window.addEventListener('keydown', handleGlobalPosKeys);
    return () => window.removeEventListener('keydown', handleGlobalPosKeys);
  }, [
    posAuthenticated,
    printedOrder,
    printedReturn,
    stickerPreviewItem,
    printedShift,
    printMode,
    featureFlags.enableCoffeeBlender,
    featureFlags.enableCustomBoxes,
    posItems,
    posLoading,
    recentPosOrders,
    onlineQueueOrders,
    products,
    addPosItem,
    playCashierBeep,
    showToast,
  ]);

  // Shift, Return, Debt & Expense Handlers
  const handleOpenNewShift = async (
    cashierName: string,
    shiftPeriod: 'الوردية الصباحية' | 'الوردية المسائية' | 'وردية اليوم الكامل',
    openingCash: number,
    cupsOpeningCount?: number
  ) => {
    setPosLoading(true);
    try {
      const selectedRegObj = posRegisters.find((r) => r.id === selectedRegisterId);
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'open_shift',
          registerId: selectedRegisterId,
          registerName: selectedRegObj?.name,
          cashierName,
          shiftPeriod,
          openingCash,
          cupsOpeningCount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchPosData();
        showToast('تم فتح وردية الكاشير الجديدة بنجاح');
      } else {
        showToast('تعذر فتح الوردية', data.error);
      }
    } finally {
      setPosLoading(false);
    }
  };

  const handleCloseShift = async (
    actualClosingCash: number,
    notes?: string,
    cupsActualRemaining?: number
  ) => {
    setPosLoading(true);
    try {
      // Guard: auto-sync any queued emergency offline invoices BEFORE closing the shift
      const pendingOffline = getPosOfflineQueue();
      if (pendingOffline.length > 0) {
        const syncRes = await syncPosOfflineQueue(posToken);
        setOfflineQueueCount(syncRes.remainingCount);
        if (!syncRes.success || syncRes.remainingCount > 0) {
          showToast(
            `يوجد ${syncRes.remainingCount || pendingOffline.length} فاتورة طوارئ لم تتم مزامنتها بعد`,
            'يرجى التأكد من اتصال الإنترنت ومزامنة فواتير الطوارئ أولاً حتى تتطابق عهدة الدرج بدقة'
          );
          return;
        }
      }

      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'close_shift',
          registerId: selectedRegisterId,
          shiftId: activeShift?.id,
          actualClosingCash,
          notes,
          cupsActualRemaining,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchPosData();
        setPrintedShift(data.closedShift || activeShift);
        setPrintedOrder(null);
        setStickerPreviewItem(null);
        setPrintedReturn(null);
        setPrintMode('zreport');
        showToast('تم تقفيل الوردية وتوريد الحصيلة للخزينة وإصدار Z-Report');
      } else {
        showToast('تعذر تقفيل الوردية', data.error);
      }
    } finally {
      setPosLoading(false);
    }
  };

  const handleAddExpense = async (
    title: string,
    amount: number,
    category: 'raw_materials' | 'packaging' | 'utilities' | 'delivery_rider' | 'other'
  ) => {
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'add_expense',
          registerId: selectedRegisterId,
          shiftId: activeShift?.id,
          title,
          amount,
          category,
        }),
      });
      if (res.ok) {
        await fetchPosData();
        showToast('تم تسجيل المصروف وخصمه من النقدية المتوقعة بالدرج');
      }
    } finally {
      setPosLoading(false);
    }
  };

  const handleCreatePosReturn = async (payload: {
    orderId: string;
    items: PosReturnItem[];
    refundMethod: PosReturnRecord['refundMethod'];
    reason?: string;
    customerPhone?: string;
  }): Promise<PosReturnRecord | null> => {
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'create_return',
          registerId: selectedRegisterId,
          shiftId: activeShift?.id,
          ...payload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('تعذر اعتماد المرتجع', data.error || 'تحقق من البيانات والوردية المفتوحة');
        return null;
      }
      playCashierBeep(660, 0.2);
      await fetchPosData();
      await refreshStore();
      showToast(
        `تم اعتماد المرتجع ${data.returnRecord.returnNumber} بنجاح`,
        `إجمالي المسترد للعميل: ${data.returnRecord.totalRefundAmount} ج.م`
      );
      return data.returnRecord as PosReturnRecord;
    } catch {
      showToast('خطأ في الاتصال بالخادم أثناء تنفيذ المرتجع');
      return null;
    } finally {
      setPosLoading(false);
    }
  };

  const handleCollectCustomerDebt = async (
    phone: string,
    amount: number,
    method: PaymentMethod
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'collect_customer_debt',
          registerId: selectedRegisterId,
          shiftId: activeShift?.id,
          phone,
          amount,
          paymentMethod: method,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('تعذر تحصيل المديونية', data.error);
        return false;
      }
      playCashierBeep(1040, 0.2);
      await fetchPosData();
      await refreshStore();
      showToast(
        `تم تحصيل ${data.paidAmount} ج.م من مديونية العميل بنجاح`,
        `المتبقي على العميل: ${data.remainingDebt} ج.م`
      );
      return true;
    } catch {
      showToast('خطأ في الاتصال أثناء تحصيل المديونية');
      return false;
    }
  };

  const handleUpdateOnlineOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'update_order_status',
          orderId,
          status,
        }),
      });
      if (res.ok) {
        await fetchPosData();
        await refreshStore();
        showToast(`تم تحديث حالة الطلب ${orderId} إلى ${status}`);
      }
    } catch {}
  };

  const handleAssignOnlineOrderRider = async (
    orderId: string,
    riderId: string,
    riderName: string
  ) => {
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'assign_rider',
          orderId,
          riderId,
          riderName,
        }),
      });
      if (res.ok) {
        await fetchPosData();
        await refreshStore();
        showToast(
          riderId
            ? `تم إسناد الطلب للمندوب (${riderName})`
            : 'تم إلغاء إسناد المندوب من الطلب'
        );
      }
    } catch {}
  };

  const handleSettleRiderCod = async (payload: {
    orderId?: string;
    settleAll?: boolean;
  }) => {
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'settle_rider_cod',
          registerId: selectedRegisterId,
          shiftId: activeShift?.id,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('تعذر توريد عهدة المندوب بالدرج', data?.error || 'تأكد من وجود وردية مفتوحة');
        return;
      }
      playCashierBeep(1040, 0.2);
      await fetchPosData();
      await refreshStore();
      showToast(
        `تم استلام وتوريد ${data.settledAmount} ج.م (${data.settledCount} طلب) في درج الكاشير`,
        'تم تحديث النقدية المتوقعة بالدرج وتصفية عهدة المندوب'
      );
    } catch {
      showToast('خطأ في الاتصال أثناء توريد عهدة المندوب');
    }
  };

  const handleOpenStickerModal = (sticker: StickerPreviewData) => {
    setStickerPreviewItem(sticker);
    setPrintedOrder(null);
    setPrintedShift(null);
    setPrintedReturn(null);
    setPrintMode('sticker');
  };

  const handleOpenOrderReceiptModal = (order: Order) => {
    setPrintedOrder(order);
    setStickerPreviewItem(null);
    setPrintedShift(null);
    setPrintedReturn(null);
    setPrintMode('receipt');
  };

  const handleOpenShiftZReportModal = (shift: PosShift) => {
    setPrintedShift(shift);
    setPrintedOrder(null);
    setStickerPreviewItem(null);
    setPrintedReturn(null);
    setPrintMode('zreport');
  };

  const handleOpenReturnReceiptModal = (ret: PosReturnRecord) => {
    setPrintedReturn(ret);
    setPrintedOrder(null);
    setStickerPreviewItem(null);
    setPrintedShift(null);
    setPrintMode('return');
  };

  // Whether the current page is one of the 3 selling pages that show the persistent left invoice sidebar
  const isSellingPage =
    activePage === 'direct_sales' ||
    activePage === 'boxes' ||
    activePage === 'coffee_blend';

  const pendingOnlineCount = useMemo(
    () =>
      onlineQueueOrders.filter(
        (o) =>
          o.status === 'pending' ||
          o.status === 'confirmed' ||
          o.status === 'roasting_packing'
      ).length,
    [onlineQueueOrders]
  );

  if (posAuthChecking) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#231710] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-white border border-[#E8E0D5] text-[#9A6836] flex items-center justify-center mx-auto">
            <Scale className="w-5 h-5" />
          </div>
          <p className="font-cairo font-medium text-sm text-[#6B5A4E]">
            جاري التحقق من صلاحية الكاشير وعزل الأدوار...
          </p>
        </div>
      </div>
    );
  }

  if (!posAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#231710] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white text-[#231710] rounded-2xl border border-[#E8E0D5] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] flex items-center justify-center mx-auto">
              <Scale className="w-5 h-5" />
            </div>
            <h1 className="font-cairo font-bold text-xl text-[#231710]">
              نقطة البيع والكاشير — {storeName}
            </h1>
            <p className="text-xs text-[#6B5A4E] leading-relaxed">
              تسجيل دخول الكاشير ونقطة البيع المباشرة
            </p>
          </div>

          <form onSubmit={handlePosLogin} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                value={posLoginUsername}
                onChange={(e) => setPosLoginUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                value={posLoginPassword}
                onChange={(e) => setPosLoginPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition"
              />
            </div>

            {posLoginError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium p-3 rounded-xl">
                {posLoginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-sm py-3 rounded-xl transition cursor-pointer"
            >
              تسجيل الدخول
            </button>
          </form>

          <div className="pt-4 border-t border-[#E8E0D5] flex items-center justify-between text-xs font-medium text-[#6B5A4E]">
            <Link href="/" className="hover:text-[#231710] transition">
              العودة للمتجر
            </Link>
            <Link href="/admin" className="hover:text-[#231710] transition">
              لوحة الإدارة
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isBoxesOrCoffeeActive = activePage === 'boxes' || activePage === 'coffee_blend';
  const isInvoicesOrOnlineActive = activePage === 'invoices_table' || activePage === 'online_orders';
  const showBoxesOrCoffeeChoice = featureFlags.enableCustomBoxes || featureFlags.enableCoffeeBlender;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-10">
      <div className="flex flex-col print:hidden">
        {/* =================================================================== */}
        {/* SLIM POS TOP BAR — HICK'S LAW (4 PRIMARY TOP-LEVEL CHOICES)         */}
        {/* =================================================================== */}
        <header
          ref={topBarRef}
          className={
            isEmbeddedInAdmin
              ? 'mx-3 sm:mx-4 mt-3 bg-white text-[#231710] rounded-2xl border border-[#E8E0D5] px-3 py-2.5 shadow-2xs relative z-30'
              : 'sticky top-0 z-30 bg-white/95 backdrop-blur-xs text-[#231710] border-b border-[#E8E0D5] px-3 sm:px-4 py-2 shadow-2xs'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Right Side: Compact Brand + 4 Primary Navigation Choices */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {!isEmbeddedInAdmin && (
                <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-[#E8E0D5]">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836] flex items-center justify-center shrink-0">
                    <Scale className="w-4 h-4" />
                  </div>
                  <span className="font-cairo font-bold text-xs text-[#231710] max-w-[140px] truncate">
                    كاشير {storeName}
                  </span>
                </div>
              )}

              {/* Choice 1: البيع المباشر */}
              <button
                type="button"
                onClick={() => {
                  setOpenNavMenu(null);
                  setActivePage('direct_sales');
                  updateUrlQueryParams({ posPage: null, posSub: null });
                }}
                title="البيع المباشر (F1)"
                className={`min-h-[40px] sm:min-h-[44px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activePage === 'direct_sales'
                    ? 'bg-[#231710] text-white'
                    : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] hover:bg-[#F3ECE1]'
                }`}
              >
                <Scale className="w-4 h-4 shrink-0" />
                <span>البيع المباشر</span>
              </button>

              {/* Choice 2: البوكسات والبن ▾ */}
              {showBoxesOrCoffeeChoice && (
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={openNavMenu === 'boxes_coffee'}
                    onClick={() =>
                      setOpenNavMenu((prev) =>
                        prev === 'boxes_coffee' ? null : 'boxes_coffee'
                      )
                    }
                    className={`min-h-[40px] sm:min-h-[44px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isBoxesOrCoffeeActive
                        ? 'bg-[#231710] text-white'
                        : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] hover:bg-[#F3ECE1]'
                    }`}
                  >
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>البوكسات والبن</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        openNavMenu === 'boxes_coffee' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openNavMenu === 'boxes_coffee' && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl border border-[#E8E0D5] shadow-xl p-1.5 z-50 space-y-1">
                      {featureFlags.enableCustomBoxes && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setActivePage('boxes');
                              setBoxTab('ready');
                              setOpenNavMenu(null);
                              updateUrlQueryParams({ posPage: 'boxes', posSub: 'ready' });
                            }}
                            className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-2 transition cursor-pointer text-right ${
                              activePage === 'boxes' && boxTab === 'ready'
                                ? 'bg-[#231710] text-white'
                                : 'text-[#231710] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            <Gift className="w-4 h-4 shrink-0 text-[#9A6836]" />
                            <span>{featureFlags.boxesModuleLabel || 'البوكسات'} — الجاهزة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActivePage('boxes');
                              setBoxTab('touch_builder');
                              setOpenNavMenu(null);
                              updateUrlQueryParams({
                                posPage: 'boxes',
                                posSub: 'touch_builder',
                              });
                            }}
                            className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-2 transition cursor-pointer text-right ${
                              activePage === 'boxes' && boxTab === 'touch_builder'
                                ? 'bg-[#231710] text-white'
                                : 'text-[#231710] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            <Gift className="w-4 h-4 shrink-0 text-[#9A6836]" />
                            <span>تكوين بوكس باللمس</span>
                          </button>
                        </>
                      )}

                      {featureFlags.enableCoffeeBlender && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setActivePage('coffee_blend');
                              setCoffeeTab('ready');
                              setOpenNavMenu(null);
                              updateUrlQueryParams({
                                posPage: 'coffee_blend',
                                posSub: 'ready',
                              });
                            }}
                            className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-2 transition cursor-pointer text-right ${
                              activePage === 'coffee_blend' && coffeeTab === 'ready'
                                ? 'bg-[#231710] text-white'
                                : 'text-[#231710] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            <Coffee className="w-4 h-4 shrink-0 text-[#9A6836]" />
                            <span>{featureFlags.blenderModuleLabel || 'توليفة البن'} — الجاهز</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActivePage('coffee_blend');
                              setCoffeeTab('custom_bag');
                              setOpenNavMenu(null);
                              updateUrlQueryParams({
                                posPage: 'coffee_blend',
                                posSub: 'custom_bag',
                              });
                            }}
                            className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-2 transition cursor-pointer text-right ${
                              activePage === 'coffee_blend' && coffeeTab === 'custom_bag'
                                ? 'bg-[#231710] text-white'
                                : 'text-[#231710] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            <Coffee className="w-4 h-4 shrink-0 text-[#9A6836]" />
                            <span>خلط توليفة مخصوصة</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Choice 3: الفواتير والأونلاين ▾ */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openNavMenu === 'invoices_online'}
                  onClick={() =>
                    setOpenNavMenu((prev) =>
                      prev === 'invoices_online' ? null : 'invoices_online'
                    )
                  }
                  className={`min-h-[40px] sm:min-h-[44px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isInvoicesOrOnlineActive
                      ? 'bg-[#231710] text-white'
                      : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] hover:bg-[#F3ECE1]'
                  }`}
                >
                  <Receipt className="w-4 h-4 shrink-0" />
                  <span>الفواتير والأونلاين</span>
                  {pendingOnlineCount > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold tabular-nums bg-rose-600 text-white leading-none">
                      {pendingOnlineCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      openNavMenu === 'invoices_online' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openNavMenu === 'invoices_online' && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl border border-[#E8E0D5] shadow-xl p-1.5 z-50 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePage('invoices_table');
                        setOpenNavMenu(null);
                        updateUrlQueryParams({ posPage: 'invoices_table', posSub: null });
                      }}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center justify-between gap-2 transition cursor-pointer ${
                        activePage === 'invoices_table'
                          ? 'bg-[#231710] text-white'
                          : 'text-[#231710] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 shrink-0 text-[#9A6836]" />
                        <span>الفواتير والمرتجعات</span>
                      </span>
                      <span className="text-[11px] opacity-70">F4</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActivePage('online_orders');
                        setOpenNavMenu(null);
                        updateUrlQueryParams({ posPage: 'online_orders', posSub: null });
                      }}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center justify-between gap-2 transition cursor-pointer ${
                        activePage === 'online_orders'
                          ? 'bg-[#231710] text-white'
                          : 'text-[#231710] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Truck className="w-4 h-4 shrink-0 text-[#9A6836]" />
                        <span>طلبات الأونلاين</span>
                      </span>
                      {pendingOnlineCount > 0 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums bg-rose-600 text-white">
                          {pendingOnlineCount}
                        </span>
                      ) : (
                        <span className="text-[11px] opacity-70">F6</span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Choice 4: الوردية والدرج */}
              <button
                type="button"
                onClick={() => {
                  setOpenNavMenu(null);
                  setActivePage('shift_summary');
                  updateUrlQueryParams({ posPage: 'shift_summary', posSub: null });
                }}
                title="الوردية والدرج (F5)"
                className={`min-h-[40px] sm:min-h-[44px] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activePage === 'shift_summary'
                    ? 'bg-[#231710] text-white'
                    : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] hover:bg-[#F3ECE1]'
                }`}
              >
                <Wallet className="w-4 h-4 shrink-0" />
                <span>الوردية والدرج</span>
              </button>
            </div>

            {/* Left Side: Register, Sound Mute, Shift Drawer Pill, Cart Jump, Admin/Logout */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {posRegisters.length > 0 && (
                <div className="min-h-[40px] sm:min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-[#9A6836] shrink-0" />
                  <select
                    aria-label="اختيار جهاز الكاشير"
                    value={selectedRegisterId}
                    onChange={(e) => handleSelectRegisterId(e.target.value)}
                    className="bg-transparent text-xs font-cairo font-bold text-[#231710] outline-none cursor-pointer max-w-[150px]"
                  >
                    {posRegisters.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const next = toggleAudioMuted();
                  setIsPosAudioMuted(next);
                }}
                title={isPosAudioMuted ? 'تفعيل جرس تنبيهات الطلبات' : 'كتم جرس تنبيهات الطلبات'}
                className={`min-h-[40px] sm:min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-cairo font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isPosAudioMuted
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-[#FAF6F0] hover:bg-[#F2EAE0] text-[#231710] border border-[#E8E0D5]'
                }`}
              >
                {isPosAudioMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#9A6836] shrink-0" />
                )}
                <span className="hidden md:inline">
                  {isPosAudioMuted ? 'الصوت مكتوم' : 'الجرس نشط'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !isPosAutoPrint;
                  setIsPosAutoPrint(next);
                  try {
                    localStorage.setItem(POS_AUTO_PRINT_STORAGE_KEY, next ? '1' : '0');
                  } catch {}
                }}
                title={
                  isPosAutoPrint
                    ? 'الطباعة التلقائية فور البيع مفعّلة — اضغط للتحويل إلى المعاينة والطباعة اليدوية'
                    : 'تفعيل الطباعة التلقائية فور إتمام الفاتورة'
                }
                className={`min-h-[40px] sm:min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-cairo font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isPosAutoPrint
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-[#FAF6F0] hover:bg-[#F2EAE0] text-[#231710] border border-[#E8E0D5]'
                }`}
              >
                <Printer
                  className={`w-4 h-4 shrink-0 ${
                    isPosAutoPrint ? 'text-emerald-700' : 'text-[#9A6836]'
                  }`}
                />
                <span className="hidden md:inline">
                  {isPosAutoPrint ? 'طباعة تلقائية' : 'طباعة يدوية'}
                </span>
              </button>

              {activeShift ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenNavMenu(null);
                    setActivePage('shift_summary');
                    updateUrlQueryParams({ posPage: 'shift_summary', posSub: null });
                  }}
                  title={`درج الوردية: ${activeShift.expectedCashInDrawer} ${currency}`}
                  className="min-h-[40px] sm:min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl py-2 px-3 text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition tabular-nums"
                >
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">درج الوردية:</span>
                  <span>
                    {activeShift.expectedCashInDrawer} {currency}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpenNavMenu(null);
                    setActivePage('shift_summary');
                    updateUrlQueryParams({ posPage: 'shift_summary', posSub: null });
                  }}
                  className="min-h-[40px] sm:min-h-[44px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-cairo font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span>افتح وردية</span>
                </button>
              )}

              {!isSellingPage && posItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenNavMenu(null);
                    setActivePage('direct_sales');
                    updateUrlQueryParams({ posPage: null, posSub: null });
                  }}
                  className="min-h-[40px] sm:min-h-[44px] bg-[#231710] text-white py-2 px-3 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    الفاتورة ({posNetTotal} {currency})
                  </span>
                </button>
              )}

              {!isEmbeddedInAdmin && canSeeProfits && (
                <Link
                  href="/admin"
                  title="لوحة الإدارة"
                  className="min-h-[40px] sm:min-h-[44px] py-2 px-3 rounded-xl text-xs font-cairo font-bold bg-[#FAF6F0] hover:bg-[#F2EAE0] text-[#231710] border border-[#E8E0D5] flex items-center gap-1.5"
                >
                  <span>الإدارة</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180 shrink-0" />
                </Link>
              )}

              {!isEmbeddedInAdmin && (
                <button
                  type="button"
                  onClick={handlePosLogout}
                  title="خروج الكاشير"
                  className="min-h-[40px] sm:min-h-[44px] py-2 px-3 rounded-xl text-xs font-cairo font-bold bg-[#FAF6F0] hover:bg-rose-50 text-[#6B5A4E] hover:text-rose-700 border border-[#E8E0D5] flex items-center gap-1.5 cursor-pointer transition"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* =================================================================== */}
        {/* MAIN WORKSPACE CONTENT: SELLING PAGES (WITH RESIZABLE CART)         */}
        {/* =================================================================== */}
        <main className="flex-1 min-w-0 w-full px-3 sm:px-4 pt-3 space-y-3">
          {/* POS EMERGENCY OFFLINE QUEUE STATUS BANNER */}
          {(!isOnline || offlineQueueCount > 0) && (
            <div className="bg-amber-50 text-amber-950 rounded-2xl p-3.5 border border-amber-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <h4 className="font-cairo font-bold text-xs sm:text-sm text-amber-950">
                    {!isOnline
                      ? 'وضع الطوارئ (انقطاع اتصال الإنترنت) — البيع والطباعة مستمران محلياً'
                      : `طابور الطوارئ: يوجد ${offlineQueueCount} فواتير مسجلة محلياً في انتظار المزامنة`}
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    يمكنك إتمام البيع وطباعة بونات الكاشير كالمعتاد، وسيتم ترحيل الفواتير فور عودة الشبكة.
                  </p>
                </div>
              </div>

              {offlineQueueCount > 0 && (
                <button
                  type="button"
                  disabled={isSyncingOffline}
                  onClick={handleSyncOfflineQueue}
                  className="min-h-[40px] bg-[#231710] text-white hover:bg-[#3A271C] font-cairo font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                  <span>{isSyncingOffline ? 'جارٍ المزامنة...' : `مزامنة الآن (${offlineQueueCount})`}</span>
                </button>
              )}
            </div>
          )}
          {isSellingPage ? (
            <div className="flex flex-col lg:flex-row gap-3.5 items-start">
              {/* CENTER/MAIN AREA (Flex-1): Large Simplified Cards */}
              <div className="flex-1 min-w-0 w-full">
                {activePage === 'direct_sales' && (
                  <PosDirectSalesPage
                    products={products}
                    categories={categories}
                    canSeeProfits={canSeeProfits}
                    onAddPosItem={addPosItem}
                    onPrintSticker={handleOpenStickerModal}
                    showToast={showToast}
                    playCashierBeep={playCashierBeep}
                    selectedCategoryId={selectedCategoryId}
                    onSelectCategoryId={setSelectedCategoryId}
                    enableWeightScale={featureFlags.enableWeightScale}
                    currencySymbol={currency}
                  />
                )}

                {activePage === 'boxes' && (
                  <PosBoxesPage
                    products={products}
                    promotions={promotions}
                    canSeeProfits={canSeeProfits}
                    onAddPosItem={addPosItem}
                    onPrintSticker={handleOpenStickerModal}
                    showToast={showToast}
                    boxTab={boxTab}
                    onChangeBoxTab={setBoxTab}
                  />
                )}

                {activePage === 'coffee_blend' && (
                  <PosCoffeeBlendPage
                    products={products}
                    canSeeProfits={canSeeProfits}
                    onAddPosItem={addPosItem}
                    onPrintSticker={handleOpenStickerModal}
                    showToast={showToast}
                    coffeeTab={coffeeTab}
                    onChangeCoffeeTab={setCoffeeTab}
                  />
                )}
              </div>

              {/* LEFT AREA: Sticky & Resizable Compact Cart Sidebar */}
              <div
                className="w-full lg:w-[var(--pos-cart-width)] lg:shrink-0"
                style={{ '--pos-cart-width': `${cartWidth}px` } as React.CSSProperties}
              >
                <PosActiveInvoiceSidebar
                  posItems={posItems}
                  setPosItems={setPosItems}
                  posOrderType={posOrderType}
                  setPosOrderType={setPosOrderType}
                  chairNumber={chairNumber}
                  setChairNumber={setChairNumber}
                  customerPhone={customerPhone}
                  setCustomerPhone={setCustomerPhone}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  deliveryAddress={deliveryAddress}
                  setDeliveryAddress={setDeliveryAddress}
                  invoiceNotes={invoiceNotes}
                  setInvoiceNotes={setInvoiceNotes}
                  cashierDiscount={cashierDiscount}
                  setCashierDiscount={setCashierDiscount}
                  couponCode={couponCode}
                  setCouponCode={setCouponCode}
                  couponDiscount={couponValidation.discountAmount}
                  couponError={couponValidation.error}
                  coupons={activeCouponsList}
                  useVipWallet={useVipWallet}
                  setUseVipWallet={setUseVipWallet}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  paymentSplits={paymentSplits}
                  setPaymentSplits={setPaymentSplits}
                  paymentReference={paymentReference}
                  setPaymentReference={setPaymentReference}
                  cashTenderedInput={cashTenderedInput}
                  setCashTenderedInput={setCashTenderedInput}
                  matchedVipMember={matchedVipMember}
                  creditConfig={creditConfig}
                  taxConfig={taxConfig}
                  posTaxAmount={posTaxBreakdown.taxAmount}
                  onCollectCustomerDebt={handleCollectCustomerDebt}
                  posSubtotal={posSubtotal}
                  posShipping={posShipping}
                  vipWalletRedeemable={vipWalletRedeemable}
                  posNetTotal={posNetTotal}
                  posRawCostTotal={posRawCostTotal}
                  posNetProfit={posNetProfit}
                  posProfitMargin={posProfitMargin}
                  posVipCashbackEarned={posVipCashbackEarned}
                  changeDue={changeDue}
                  canSeeProfits={canSeeProfits}
                  posLoading={posLoading}
                  onCompleteInvoice={handleCompletePosInvoice}
                  onPrintItemSticker={handleOpenStickerModal}
                  heldInvoices={heldInvoices}
                  onHoldCurrentInvoice={handleHoldCurrentInvoice}
                  onRestoreHeldInvoice={handleRestoreHeldInvoice}
                  onDeleteHeldInvoice={handleDeleteHeldInvoice}
                  cartWidth={cartWidth}
                  onChangeCartWidth={handleChangeCartWidth}
                  embeddedInAdmin={isEmbeddedInAdmin}
                />
              </div>
            </div>
          ) : (
            /* FULL-WIDTH WORKSPACE FOR INVOICES TABLE, SHIFT SUMMARY & ONLINE ORDERS */
            <div>
              {activePage === 'invoices_table' && (
                <PosInvoicesTablePage
                  recentPosOrders={recentPosOrders}
                  onlineQueueOrders={onlineQueueOrders}
                  posShifts={posShifts}
                  activeShift={activeShift}
                  posReturns={posReturns}
                  canSeeProfits={canSeeProfits}
                  onReprintOrder={handleOpenOrderReceiptModal}
                  onPrintReturnReceipt={handleOpenReturnReceiptModal}
                  onCreateReturn={handleCreatePosReturn}
                  initialReturnOrder={initialReturnOrder}
                  onClearInitialReturnOrder={() => setInitialReturnOrder(null)}
                  onRefresh={() => fetchPosData()}
                  sourceFilter={invoiceSourceFilter}
                  onChangeSourceFilter={setInvoiceSourceFilter}
                />
              )}

              {activePage === 'shift_summary' && (
                <PosShiftSummaryPage
                  activeShift={activeShift}
                  openShifts={openShifts}
                  posRegisters={posRegisters}
                  selectedRegisterId={selectedRegisterId}
                  onSelectRegisterId={handleSelectRegisterId}
                  posShifts={posShifts}
                  posExpenses={posExpenses}
                  canSeeProfits={canSeeProfits}
                  posLoading={posLoading}
                  defaultCashierName={posStaffDisplayName || undefined}
                  onOpenNewShift={handleOpenNewShift}
                  onCloseShift={handleCloseShift}
                  onAddExpense={handleAddExpense}
                  onPrintShiftZReport={handleOpenShiftZReportModal}
                />
              )}

              {activePage === 'online_orders' && (
                <PosOnlineOrdersPage
                  onlineQueueOrders={onlineQueueOrders}
                  onUpdateOrderStatus={handleUpdateOnlineOrderStatus}
                  onPrintOrderReceipt={handleOpenOrderReceiptModal}
                  onPrintSticker={handleOpenStickerModal}
                  onRefresh={() => fetchPosData()}
                  playCashierBeep={playCashierBeep}
                  deliveryFilter={onlineDeliveryFilter}
                  onChangeDeliveryFilter={setOnlineDeliveryFilter}
                  availableRiders={availableRiders}
                  onAssignRider={handleAssignOnlineOrderRider}
                  onSettleRiderCod={handleSettleRiderCod}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* SUPERMARKET 80MM THERMAL RECEIPT, Z-REPORT, RETURN & 58MM STICKER     */}
      {/* ===================================================================== */}
      {(printedOrder ||
        printedReturn ||
        stickerPreviewItem ||
        (printMode === 'zreport' && (printedShift || activeShift))) && (
        <SupermarketReceiptModal
          order={printedOrder}
          returnRecord={printedReturn}
          sticker={stickerPreviewItem}
          shift={printMode === 'zreport' ? printedShift || activeShift : null}
          mode={printMode}
          settings={settings}
          autoPrintOnMount={isPosAutoPrint || Boolean(settings?.enableDirectEscPosPrint)}
          showProfit={canSeeProfits}
          onClose={() => {
            setPrintedOrder(null);
            setPrintedReturn(null);
            setStickerPreviewItem(null);
            setPrintedShift(null);
            if (printMode === 'zreport' || printMode === 'return') setPrintMode('receipt');
          }}
        />
      )}
    </div>
  );
}
