'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Scale,
  Coffee,
  Gift,
  Receipt,
  Wallet,
  Truck,
  ArrowRight,
  ShoppingBag,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  LogOut,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  AdminRole,
  CartItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PosExpense,
  PosOrderType,
  PosShift,
  VipMember,
} from '@/types/store';
import { calculateVipCashback } from '@/lib/pricing';
import { validateEgyptianPhone } from '@/lib/validation';
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

const ADMIN_SESSION_STORAGE_KEY = 'nuts_admin_session';
const HELD_INVOICES_STORAGE_KEY = 'nuts_pos_held_invoices';
const POS_CART_WIDTH_STORAGE_KEY = 'nuts_pos_cart_width';
const POS_NAV_WIDTH_STORAGE_KEY = 'nuts_pos_nav_width';
const POS_NAV_COLLAPSED_STORAGE_KEY = 'nuts_pos_nav_collapsed';

const MIN_NAV_WIDTH = 165;
const MAX_NAV_WIDTH = 300;
const DEFAULT_NAV_WIDTH = 205;
const COLLAPSED_NAV_WIDTH = 68;

export type PosPageId =
  | 'direct_sales'
  | 'boxes'
  | 'coffee_blend'
  | 'invoices_table'
  | 'shift_summary'
  | 'online_orders';

export default function HafsaPosCashierPage() {
  const { storeData, refreshStore, showToast } = useStore();
  const products = storeData?.products || [];
  const categories = storeData?.categories || [];
  const promotions = storeData?.promotions || [];
  const settings = storeData?.settings;

  // Cashier & Staff Role Isolation Auth State
  const [posAuthChecking, setPosAuthChecking] = useState<boolean>(true);
  const [posAuthenticated, setPosAuthenticated] = useState<boolean>(false);
  const [posRole, setPosRole] = useState<AdminRole>('cashier');
  const [posToken, setPosToken] = useState<string>('');
  const [posLoginUsername, setPosLoginUsername] = useState<string>('');
  const [posLoginPassword, setPosLoginPassword] = useState<string>('');
  const [posLoginError, setPosLoginError] = useState<string>('');

  // Cashier is strictly isolated from wholesale raw costs and net profits
  const canSeeProfits = posRole === 'super_admin' || posRole === 'accountant';

  // 6-Page POS Navigation State + Internal Sub-Sections State
  const [activePage, setActivePage] = useState<PosPageId>('direct_sales');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [boxTab, setBoxTab] = useState<'ready' | 'touch_builder'>('ready');
  const [coffeeTab, setCoffeeTab] = useState<'ready' | 'custom_bag'>('ready');
  const [invoiceSourceFilter, setInvoiceSourceFilter] = useState<
    'all_pos' | 'counter_takeaway' | 'glass_bar_dine_in' | 'phone_delivery' | 'online' | 'all'
  >('all_pos');
  const [onlineDeliveryFilter, setOnlineDeliveryFilter] = useState<
    'all' | 'bandar_fast' | 'villages_scheduled' | 'store_pickup'
  >('all');

  // POS Server State
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [posShifts, setPosShifts] = useState<PosShift[]>([]);
  const [posExpenses, setPosExpenses] = useState<PosExpense[]>([]);
  const [recentPosOrders, setRecentPosOrders] = useState<Order[]>([]);
  const [onlineQueueOrders, setOnlineQueueOrders] = useState<Order[]>([]);
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
  const [useVipWallet, setUseVipWallet] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [cashTenderedInput, setCashTenderedInput] = useState<number | ''>('');

  // Held / Parked Invoices State
  const [heldInvoices, setHeldInvoices] = useState<HeldPosInvoice[]>([]);

  // Resizable Cart Sidebar Width State (Default 290px, user-adjustable)
  const [cartWidth, setCartWidth] = useState<number>(DEFAULT_POS_CART_WIDTH);

  // Collapsible & Resizable Right Navigation Sidebar State
  const [navWidth, setNavWidth] = useState<number>(DEFAULT_NAV_WIDTH);
  const [navCollapsed, setNavCollapsed] = useState<boolean>(false);
  const [isDraggingNav, setIsDraggingNav] = useState<boolean>(false);

  // Printable Receipt / Sticker / Z-Report Modal State
  const [printedOrder, setPrintedOrder] = useState<Order | null>(null);
  const [printedShift, setPrintedShift] = useState<PosShift | null>(null);
  const [stickerPreviewItem, setStickerPreviewItem] =
    useState<StickerPreviewData | null>(null);
  const [printMode, setPrintMode] = useState<'receipt' | 'sticker' | 'zreport'>('receipt');

  // Load Held Invoices & Preferred Cart/Nav Widths from localStorage
  useEffect(() => {
    try {
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
      const savedNavWidth = Number(localStorage.getItem(POS_NAV_WIDTH_STORAGE_KEY));
      if (
        !Number.isNaN(savedNavWidth) &&
        savedNavWidth >= MIN_NAV_WIDTH &&
        savedNavWidth <= MAX_NAV_WIDTH
      ) {
        setNavWidth(savedNavWidth);
      }
      const savedCollapsed = localStorage.getItem(POS_NAV_COLLAPSED_STORAGE_KEY);
      if (savedCollapsed === 'true') {
        setNavCollapsed(true);
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

  const handleChangeNavWidth = useCallback((nextWidth: number) => {
    const clamped = Math.min(
      MAX_NAV_WIDTH,
      Math.max(MIN_NAV_WIDTH, Math.round(nextWidth))
    );
    setNavWidth(clamped);
    setNavCollapsed(false);
    try {
      localStorage.setItem(POS_NAV_WIDTH_STORAGE_KEY, String(clamped));
      localStorage.setItem(POS_NAV_COLLAPSED_STORAGE_KEY, 'false');
    } catch {}
  }, []);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(POS_NAV_COLLAPSED_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Mouse drag handler for resizing the Right Navigation Sidebar (anchored at right: 0)
  useEffect(() => {
    if (!isDraggingNav) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rawWidth = window.innerWidth - e.clientX;
      if (rawWidth < 115) {
        setNavCollapsed(true);
        try {
          localStorage.setItem(POS_NAV_COLLAPSED_STORAGE_KEY, 'true');
        } catch {}
      } else {
        handleChangeNavWidth(rawWidth);
      }
    };
    const handleMouseUp = () => setIsDraggingNav(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingNav, handleChangeNavWidth]);

  const effectiveNavWidth = navCollapsed ? COLLAPSED_NAV_WIDTH : navWidth;

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
    async (overrideToken?: string) => {
      try {
        const tokenToUse = overrideToken ?? posToken;
        const headers: Record<string, string> = {};
        if (tokenToUse) {
          headers['Authorization'] = `Bearer ${tokenToUse}`;
        }
        const res = await fetch('/api/pos', { cache: 'no-store', headers });
        if (res.ok) {
          const data = await res.json();
          setActiveShift(data.activeShift || null);
          setPosShifts(data.posShifts || []);
          setPosExpenses(data.posExpenses || []);
          setRecentPosOrders(data.recentPosOrders || []);
          setOnlineQueueOrders(data.onlineQueueOrders || []);
        }
      } catch (e) {
        console.error('Failed to load POS data', e);
      }
    },
    [posToken]
  );

  // Verify Cashier Session on Mount
  useEffect(() => {
    const verifyPosSession = async () => {
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
          if (verifiedRole === 'supplier') {
            window.location.replace('/supplier');
            return;
          }
          if (verifiedRole === 'accountant') {
            window.location.replace('/accountant');
            return;
          }
          if (verifiedRole === 'promo_partner') {
            setPosAuthenticated(false);
            setPosRole(verifiedRole);
            setPosLoginError(
              'عزل الأدوار: هذا الحساب غير مصرح له بالدخول إلى شاشة الكاشير ونقطة البيع.'
            );
          } else {
            setPosToken(activeToken);
            setPosRole(verifiedRole);
            setPosAuthenticated(true);
            await fetchPosData(activeToken);
          }
        } else {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_token');
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          setPosAuthenticated(false);
        }
      } catch {
        setPosAuthenticated(false);
      } finally {
        setPosAuthChecking(false);
      }
    };
    verifyPosSession();
  }, [fetchPosData]);

  // Keyboard Shortcuts F1..F6 to switch between the 6 POS pages
  useEffect(() => {
    if (!posAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const map: Record<string, PosPageId> = {
        F1: 'direct_sales',
        F2: 'boxes',
        F3: 'coffee_blend',
        F4: 'invoices_table',
        F5: 'shift_summary',
        F6: 'online_orders',
      };
      if (map[e.key]) {
        e.preventDefault();
        setActivePage(map[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [posAuthenticated]);

  const handlePosLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        window.location.href = '/accountant';
        return;
      }
      if (role === 'promo_partner') {
        setPosLoginError('عزل الأدوار: هذا الحساب غير مصرح له بفتح شاشة الكاشير');
        return;
      }
      setPosToken(data.token);
      setPosRole(role);
      setPosAuthenticated(true);
      setPosLoginPassword('');
      await fetchPosData(data.token);
      showToast(`⚖️ تم فتح نقطة بيع الكاشير بنجاح (${data.username || role})`);
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

  // Lookup VIP Member by phone
  const matchedVipMember: VipMember | null = useMemo(() => {
    if (!customerPhone.trim() || !storeData?.vipMembers) return null;
    const check = validateEgyptianPhone(customerPhone);
    const target = check.isValid ? check.normalized : customerPhone.trim();
    const found = storeData.vipMembers.find(
      (m) => m.phone === target || m.membershipCode === customerPhone.trim()
    );
    if (!found) return null;
    const bal = found.pointsBalance ?? found.walletBalance ?? 0;
    return {
      ...found,
      pointsBalance: bal,
      walletBalance: bal,
      customerName: found.customerName || found.name || 'عميل حفصة VIP',
    };
  }, [customerPhone, storeData?.vipMembers]);

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
    };

    saveHeldInvoices([newHeld, ...heldInvoices]);
    setPosItems([]);
    setCustomerPhone('');
    setCustomerName('');
    setDeliveryAddress('');
    setInvoiceNotes('');
    setCashierDiscount(0);
    setUseVipWallet(false);
    setCashTenderedInput('');
    showToast(`⏸️ تم تعليق "${label}" مؤقتاً`, 'يمكنك استرجاعها في أي وقت بضغطة واحدة');
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
    saveHeldInvoices(heldInvoices.filter((h) => h.id !== id));
    showToast(`▶️ تم استرجاع "${target.label}" إلى الفاتورة النشطة`);
  };

  const handleDeleteHeldInvoice = (id: string) => {
    saveHeldInvoices(heldInvoices.filter((h) => h.id !== id));
  };

  // Invoice Totals & Profit Margin Safety Calculation
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

  const posShipping = posOrderType === 'phone_delivery' ? 20 : 0;
  const safeDiscount = Math.max(0, Math.min(posSubtotal, Number(cashierDiscount) || 0));
  const totalBeforeVipWallet = Math.max(0, posSubtotal - safeDiscount + posShipping);

  const vipWalletRedeemable = useMemo(() => {
    if (!useVipWallet || !matchedVipMember) return 0;
    return Math.min(matchedVipMember.pointsBalance || 0, totalBeforeVipWallet);
  }, [useVipWallet, matchedVipMember, totalBeforeVipWallet]);

  const posNetTotal = Math.max(0, totalBeforeVipWallet - vipWalletRedeemable);
  const posNetProfit = Math.round(posNetTotal - posShipping - posRawCostTotal);
  const posProfitMargin =
    posNetTotal > 0 ? Math.round((posNetProfit / posNetTotal) * 1000) / 10 : 0;

  const posVipCashbackEarned = useMemo(() => {
    const eligible = Math.max(0, posSubtotal - safeDiscount - vipWalletRedeemable);
    return calculateVipCashback(
      eligible,
      settings?.vipMinOrderForCashback || 150,
      settings?.vipCashbackPercent || 5
    );
  }, [posSubtotal, safeDiscount, vipWalletRedeemable, settings]);

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
  const handleCompletePosInvoice = async () => {
    if (posItems.length === 0) {
      showToast('⚠️ الفاتورة فارغة، أضف صنفاً واحداً على الأقل');
      return;
    }
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'create_invoice',
          items: posItems,
          posOrderType,
          chairNumber: posOrderType === 'glass_bar_dine_in' ? chairNumber : undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerName: customerName.trim() || undefined,
          address: deliveryAddress.trim() || undefined,
          notes: invoiceNotes.trim() || undefined,
          discountAmount: safeDiscount,
          shippingCost: posShipping,
          useVipWallet,
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          cashTendered: effectiveCashTendered,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('❌ تعذر إصدار الفاتورة', data.error);
      } else {
        playCashierBeep(1046.5, 0.25);
        setPrintedOrder(data.order);
        setStickerPreviewItem(null);
        setPrintedShift(null);
        setPrintMode('receipt');
        setPosItems([]);
        setCashierDiscount(0);
        setCashTenderedInput('');
        setInvoiceNotes('');
        setUseVipWallet(false);
        await fetchPosData();
        await refreshStore();
        showToast(
          `✅ تم إصدار الفاتورة ${data.order.orderNumber} بنجاح!`,
          `الإجمالي: ${data.order.total} ج.م • الباقي للعميل: ${data.order.changeDue || 0} ج.م`
        );
      }
    } catch {
      showToast('❌ خطأ في الاتصال بالخادم');
    } finally {
      setPosLoading(false);
    }
  };

  // Shift & Expense Handlers
  const handleOpenNewShift = async (
    cashierName: string,
    shiftPeriod: 'الوردية الصباحية' | 'الوردية المسائية' | 'وردية اليوم الكامل',
    openingCash: number
  ) => {
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'open_shift',
          cashierName,
          shiftPeriod,
          openingCash,
        }),
      });
      if (res.ok) {
        await fetchPosData();
        showToast('✅ تم فتح وردية الكاشير الجديدة بنجاح');
      }
    } finally {
      setPosLoading(false);
    }
  };

  const handleCloseShift = async (actualClosingCash: number, notes?: string) => {
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'close_shift',
          actualClosingCash,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchPosData();
        setPrintedShift(data.closedShift || activeShift);
        setPrintedOrder(null);
        setStickerPreviewItem(null);
        setPrintMode('zreport');
        showToast('📊 تم تقفيل الوردية وإصدار تقرير Z-Report بنجاح');
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
          title,
          amount,
          category,
        }),
      });
      if (res.ok) {
        await fetchPosData();
        showToast('💸 تم تسجيل المصروف وخصمه من النقدية المتوقعة بالدرج');
      }
    } finally {
      setPosLoading(false);
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
        showToast(`✅ تم تحديث حالة الطلب ${orderId} إلى ${status}`);
      }
    } catch {}
  };

  const handleOpenStickerModal = (sticker: StickerPreviewData) => {
    setStickerPreviewItem(sticker);
    setPrintedOrder(null);
    setPrintedShift(null);
    setPrintMode('sticker');
  };

  const handleOpenOrderReceiptModal = (order: Order) => {
    setPrintedOrder(order);
    setStickerPreviewItem(null);
    setPrintedShift(null);
    setPrintMode('receipt');
  };

  const handleOpenShiftZReportModal = (shift: PosShift) => {
    setPrintedShift(shift);
    setPrintedOrder(null);
    setStickerPreviewItem(null);
    setPrintMode('zreport');
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
      <div className="min-h-screen bg-[#231710] text-[#FAF6F0] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37] text-[#231710] flex items-center justify-center font-black text-2xl mx-auto animate-pulse">
            ⚖️
          </div>
          <p className="font-cairo font-black text-sm text-[#D4AF37]">
            جاري التحقق من صلاحية الكاشير وعزل الأدوار...
          </p>
        </div>
      </div>
    );
  }

  if (!posAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#231710] via-[#1B110B] to-[#231710] text-[#FAF6F0] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#FAF6F0] text-[#231710] rounded-3xl border-2 border-[#D4AF37] p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#231710] text-[#D4AF37] border-2 border-[#D4AF37] flex items-center justify-center text-2xl mx-auto shadow-md">
              ⚖️
            </div>
            <span className="inline-block bg-[#3B6E4C]/15 text-[#3B6E4C] border border-[#3B6E4C]/30 px-3 py-0.5 rounded-full text-[11px] font-black">
              نظام عزل الأدوار • بوابة الكاشير المستقلة
            </span>
            <h1 className="font-cairo font-black text-xl text-[#231710]">
              نقطة بيع وميزان محمصة حفصة (POS)
            </h1>
            <p className="text-xs text-[#6E5D4F] leading-relaxed">
              هذه البوابة مخصصة ومحمية لدور <strong>الكاشير</strong> فقط (معزولة تماماً عن المتجر الخارجي وعن تكاليف المورد والأرباح الصافية وإعدادات المدير).
            </p>
          </div>

          <form onSubmit={handlePosLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-black text-[#231710] mb-1">
                اسم المستخدم:
              </label>
              <input
                type="text"
                required
                value={posLoginUsername}
                onChange={(e) => setPosLoginUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full bg-white border-2 border-[#E6DFD3] focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-xs font-mono font-bold outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#231710] mb-1">
                كلمة المرور:
              </label>
              <input
                type="password"
                required
                value={posLoginPassword}
                onChange={(e) => setPosLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border-2 border-[#E6DFD3] focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-xs font-mono font-bold outline-none"
              />
            </div>

            {posLoginError && (
              <div className="bg-[#B83B2B]/10 border border-[#B83B2B]/40 text-[#B83B2B] text-xs font-bold p-3 rounded-xl">
                ⚠️ {posLoginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#231710] hover:bg-[#3a261a] text-[#D4AF37] font-cairo font-black text-sm py-3 rounded-xl shadow-md transition cursor-pointer"
            >
              تسجيل الدخول
            </button>
          </form>

          <div className="pt-3 border-t border-[#E6DFD3] flex items-center justify-between text-xs font-bold">
            <Link href="/" className="text-[#6E5D4F] hover:text-[#231710]">
              ← واجهة المشتري (المتجر العام)
            </Link>
            <Link href="/admin" className="text-[#C88A4B] hover:underline">
              بوابة الأدوار الأخرى (الأدمن / المورد / المحاسب)
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navPages: Array<{
    id: PosPageId;
    shortcut: string;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
  }> = [
    {
      id: 'direct_sales',
      shortcut: 'F1',
      label: 'الأصناف والبيع',
      icon: <Scale className="w-4 h-4" />,
    },
    {
      id: 'boxes',
      shortcut: 'F2',
      label: 'البوكسات',
      icon: <Gift className="w-4 h-4" />,
    },
    {
      id: 'coffee_blend',
      shortcut: 'F3',
      label: 'توليفة البن',
      icon: <Coffee className="w-4 h-4" />,
    },
    {
      id: 'invoices_table',
      shortcut: 'F4',
      label: 'الفواتير',
      icon: <Receipt className="w-4 h-4" />,
      badge: recentPosOrders.length,
    },
    {
      id: 'shift_summary',
      shortcut: 'F5',
      label: 'الوردية والدرج',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      id: 'online_orders',
      shortcut: 'F6',
      label: 'طلبات الأونلاين',
      icon: <Truck className="w-4 h-4" />,
      badge: pendingOnlineCount > 0 ? pendingOnlineCount : onlineQueueOrders.length,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-10">
      <div className="flex flex-col lg:flex-row items-start print:hidden">
        {/* =================================================================== */}
        {/* RIGHT VERTICAL NAVIGATION SIDEBAR (COLLAPSIBLE & RESIZABLE)         */}
        {/* =================================================================== */}
        <div
          className="w-full lg:shrink-0"
          style={{ width: `${effectiveNavWidth}px`, maxWidth: '100%' }}
        >
          <aside
            style={{ width: `${effectiveNavWidth}px`, maxWidth: '100%' }}
            className="w-full lg:fixed lg:right-0 lg:top-0 lg:bottom-0 lg:z-40 bg-[#231710] text-[#FAF6F0] border-b-2 lg:border-b-0 lg:border-l-2 border-[#D4AF37] p-2.5 flex flex-col justify-between shadow-xl select-none"
          >
            {/* Drag Handle on Left Edge of Right Nav Sidebar (Desktop) */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingNav(true);
              }}
              title="اسحب لتكبير أو تصغير عمود التنقل"
              className={`hidden lg:flex items-center justify-center absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-16 rounded-full border cursor-ew-resize z-50 transition ${
                isDraggingNav
                  ? 'bg-[#D4AF37] text-[#231710] border-[#231710] scale-110'
                  : 'bg-[#231710] text-[#D4AF37] border-[#D4AF37] hover:scale-105'
              }`}
            >
              <GripVertical className="w-3 h-3" />
            </div>

            {/* Top Section: Brand + Collapse/Expand */}
            <div className="border-b border-white/15 pb-2.5">
              <div
                className={`flex items-center ${
                  navCollapsed ? 'justify-center' : 'justify-between'
                } gap-1.5`}
              >
                {!navCollapsed && (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#D4AF37] text-[#231710] flex items-center justify-center font-black text-xs shrink-0">
                      ⚖️
                    </div>
                    <span className="font-cairo font-black text-xs text-[#D4AF37] truncate">
                      كاشير محمصة حفصة
                    </span>
                  </div>
                )}

                {/* Collapse / Expand Toggle Button */}
                <button
                  type="button"
                  onClick={toggleNavCollapsed}
                  title={navCollapsed ? 'تكبير عمود التنقل' : 'تصغير عمود التنقل'}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#231710] flex items-center justify-center cursor-pointer transition shrink-0"
                >
                  {navCollapsed ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Middle Section: 6 POS Navigation Pages + Smaller Internal Sub-Sections */}
            <nav className="flex-1 overflow-y-auto my-2 space-y-1.5">
              {navPages.map((pg) => {
                const isActive = activePage === pg.id;
                return (
                  <div key={pg.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setActivePage(pg.id)}
                      title={`${pg.label} (${pg.shortcut})`}
                      className={`relative w-full py-2 px-2.5 rounded-xl text-xs font-cairo font-black flex items-center ${
                        navCollapsed ? 'justify-center' : 'justify-between'
                      } gap-2 transition cursor-pointer ${
                        isActive
                          ? 'bg-[#D4AF37] text-[#231710] shadow-md'
                          : 'bg-white/10 text-[#FAF6F0] hover:bg-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">{pg.icon}</span>
                        {!navCollapsed && (
                          <span className="truncate text-[11.5px]">{pg.label}</span>
                        )}
                      </div>

                      {!navCollapsed ? (
                        <div className="flex items-center gap-1 shrink-0 tabular-nums">
                          {pg.badge !== undefined && (
                            <span
                              className={`text-[10px] px-1.5 rounded-full font-black ${
                                pg.id === 'online_orders' && pendingOnlineCount > 0
                                  ? 'bg-[#B83B2B] text-white'
                                  : isActive
                                    ? 'bg-[#231710] text-[#D4AF37]'
                                    : 'bg-white/15 text-white'
                              }`}
                            >
                              {pg.badge}
                            </span>
                          )}
                        </div>
                      ) : (
                        pg.badge !== undefined && (
                          <span className="absolute -top-1 -left-1 bg-[#B83B2B] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center tabular-nums">
                            {pg.badge}
                          </span>
                        )
                      )}
                    </button>

                    {/* Smaller Internal Sub-Sections / Categories inside Right Sidebar */}
                    {!navCollapsed && pg.id === 'direct_sales' && (
                      <div className="mr-3 pr-2 border-r border-[#D4AF37]/35 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePage('direct_sales');
                            setSelectedCategoryId('all');
                          }}
                          className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center justify-between transition cursor-pointer ${
                            activePage === 'direct_sales' && selectedCategoryId === 'all'
                              ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">📦 كل الأصناف</span>
                        </button>
                        {categories.map((cat) => {
                          const isCatSelected =
                            activePage === 'direct_sales' && selectedCategoryId === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setActivePage('direct_sales');
                                setSelectedCategoryId(cat.id);
                              }}
                              className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                isCatSelected
                                  ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span className="shrink-0 text-[10px]">{cat.icon}</span>
                              <span className="truncate">{cat.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {!navCollapsed && pg.id === 'boxes' && (
                      <div className="mr-3 pr-2 border-r border-[#D4AF37]/35 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePage('boxes');
                            setBoxTab('ready');
                          }}
                          className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            activePage === 'boxes' && boxTab === 'ready'
                              ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">🎁 البوكسات الجاهزة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActivePage('boxes');
                            setBoxTab('touch_builder');
                          }}
                          className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            activePage === 'boxes' && boxTab === 'touch_builder'
                              ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">✨ تكوين بوكس باللمس</span>
                        </button>
                      </div>
                    )}

                    {!navCollapsed && pg.id === 'coffee_blend' && (
                      <div className="mr-3 pr-2 border-r border-[#D4AF37]/35 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePage('coffee_blend');
                            setCoffeeTab('ready');
                          }}
                          className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            activePage === 'coffee_blend' && coffeeTab === 'ready'
                              ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">☕ توليفات وبن جاهز</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActivePage('coffee_blend');
                            setCoffeeTab('custom_bag');
                          }}
                          className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            activePage === 'coffee_blend' && coffeeTab === 'custom_bag'
                              ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">🥣 خلط توليفة مخصوصة</span>
                        </button>
                      </div>
                    )}

                    {!navCollapsed && pg.id === 'invoices_table' && isActive && (
                      <div className="mr-3 pr-2 border-r border-[#D4AF37]/35 space-y-0.5">
                        {[
                          { id: 'all_pos' as const, label: '🧾 كل فواتير الكاشير' },
                          { id: 'counter_takeaway' as const, label: '🛍️ مبيعات الكاونتر' },
                          { id: 'glass_bar_dine_in' as const, label: '☕ البار الزجاجي' },
                          { id: 'phone_delivery' as const, label: '🛵 دليفري التليفون' },
                          { id: 'online' as const, label: '🌐 فواتير الأونلاين' },
                        ].map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setActivePage('invoices_table');
                              setInvoiceSourceFilter(sub.id);
                            }}
                            className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              invoiceSourceFilter === sub.id
                                ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {!navCollapsed && pg.id === 'online_orders' && isActive && (
                      <div className="mr-3 pr-2 border-r border-[#D4AF37]/35 space-y-0.5">
                        {[
                          { id: 'all' as const, label: '📋 كل الطلبات' },
                          { id: 'bandar_fast' as const, label: '🛵 دليفري البندر' },
                          { id: 'villages_scheduled' as const, label: '🚐 قرى المركز' },
                          { id: 'store_pickup' as const, label: '🏪 استلام الفرع' },
                        ].map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setActivePage('online_orders');
                              setOnlineDeliveryFilter(sub.id);
                            }}
                            className={`w-full text-right py-1 px-2 rounded-lg text-[10px] font-cairo font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              onlineDeliveryFilter === sub.id
                                ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-black'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Bottom Section: Shift Drawer Summary + Active Cart Jump + Admin Link + Logout */}
            <div className="pt-2 border-t border-white/15 space-y-1.5">
              {/* Shift Drawer Summary Pill at the Bottom */}
              {activeShift ? (
                <button
                  type="button"
                  onClick={() => setActivePage('shift_summary')}
                  title={`درج الوردية: ${activeShift.expectedCashInDrawer} ج.م`}
                  className={`w-full bg-[#3B6E4C] hover:bg-[#2F5A3D] text-white rounded-xl py-2 px-2.5 text-[10.5px] font-cairo font-black flex items-center ${
                    navCollapsed ? 'justify-center' : 'justify-between'
                  } cursor-pointer transition tabular-nums`}
                >
                  {navCollapsed ? (
                    <span>💵</span>
                  ) : (
                    <>
                      <span>درج الوردية:</span>
                      <span>{activeShift.expectedCashInDrawer} ج.م</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActivePage('shift_summary')}
                  title="افتح وردية"
                  className="w-full bg-[#B83B2B] text-white text-[10.5px] font-bold py-2 px-2.5 rounded-xl text-center cursor-pointer"
                >
                  {navCollapsed ? '⚠️' : '⚠️ افتح وردية'}
                </button>
              )}

              {!isSellingPage && posItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActivePage('direct_sales')}
                  title={`الفاتورة (${posNetTotal} ج)`}
                  className="w-full bg-[#3B6E4C] text-white py-2 px-2 rounded-xl text-[11px] font-cairo font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                  {!navCollapsed && (
                    <span className="truncate">الفاتورة ({posNetTotal} ج)</span>
                  )}
                </button>
              )}

              {canSeeProfits && (
                <Link
                  href="/admin"
                  title="لوحة الإدارة"
                  className={`w-full py-2 px-2.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 text-[#D4AF37] flex items-center ${
                    navCollapsed ? 'justify-center' : 'justify-between'
                  }`}
                >
                  {!navCollapsed && <span>الإدارة</span>}
                  <ArrowRight className="w-3.5 h-3.5 rotate-180 shrink-0" />
                </Link>
              )}

              <button
                type="button"
                onClick={handlePosLogout}
                title="خروج الكاشير"
                className={`w-full py-2 px-2.5 rounded-xl text-[11px] font-bold bg-[#B83B2B]/30 hover:bg-[#B83B2B]/50 text-red-100 flex items-center ${
                  navCollapsed ? 'justify-center' : 'justify-between'
                } cursor-pointer`}
              >
                {!navCollapsed && <span>خروج</span>}
                <LogOut className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </aside>
        </div>

        {/* =================================================================== */}
        {/* MAIN WORKSPACE CONTENT: SELLING PAGES (WITH FIXED RESIZABLE CART)   */}
        {/* =================================================================== */}
        <main className="flex-1 min-w-0 w-full px-3 sm:px-4 pt-3">
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

              {/* LEFT AREA: Fixed & Resizable Compact Cart Sidebar */}
              <div
                className="w-full lg:shrink-0"
                style={{ width: `${cartWidth}px`, maxWidth: '100%' }}
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
                  useVipWallet={useVipWallet}
                  setUseVipWallet={setUseVipWallet}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  paymentReference={paymentReference}
                  setPaymentReference={setPaymentReference}
                  cashTenderedInput={cashTenderedInput}
                  setCashTenderedInput={setCashTenderedInput}
                  matchedVipMember={matchedVipMember}
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
                  canSeeProfits={canSeeProfits}
                  onReprintOrder={handleOpenOrderReceiptModal}
                  onRefresh={() => fetchPosData()}
                  sourceFilter={invoiceSourceFilter}
                  onChangeSourceFilter={setInvoiceSourceFilter}
                />
              )}

              {activePage === 'shift_summary' && (
                <PosShiftSummaryPage
                  activeShift={activeShift}
                  posShifts={posShifts}
                  posExpenses={posExpenses}
                  canSeeProfits={canSeeProfits}
                  posLoading={posLoading}
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
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* SUPERMARKET 80MM THERMAL RECEIPT, Z-REPORT & 58MM STICKER MODAL       */}
      {/* ===================================================================== */}
      {(printedOrder ||
        stickerPreviewItem ||
        (printMode === 'zreport' && (printedShift || activeShift))) && (
        <SupermarketReceiptModal
          order={printedOrder}
          sticker={stickerPreviewItem}
          shift={printMode === 'zreport' ? printedShift || activeShift : null}
          mode={printMode}
          settings={settings}
          autoPrintOnMount={true}
          showProfit={canSeeProfits}
          onClose={() => {
            setPrintedOrder(null);
            setStickerPreviewItem(null);
            setPrintedShift(null);
            if (printMode === 'zreport') setPrintMode('receipt');
          }}
        />
      )}
    </div>
  );
}
