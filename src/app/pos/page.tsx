'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Scale,
  Barcode,
  Printer,
  Crown,
  Coffee,
  Gift,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Smartphone,
  RefreshCw,
  Volume2,
  Receipt,
  Wallet,
  ArrowRight,
  Search,
  Tag,
  Clock,
  UserCheck,
  Sparkles,
  Store,
  Truck,
  FileText,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  AdminRole,
  CartItem,
  Order,
  OrderStatus,
  PartitionedBoxSize,
  PaymentMethod,
  PosExpense,
  PosOrderType,
  PosShift,
  Product,
  VipMember,
} from '@/types/store';
import {
  calculateCoffeeBlendPrice,
  calculatePosItemByAmountEgp,
  calculatePosItemByGrams,
  calculateVipCashback,
  COFFEE_GRIND_TYPES,
  COFFEE_ROAST_LEVELS,
  COFFEE_SPICING_OPTIONS,
  getProductBarcode,
  getProductCostForWeight,
  parseScaleBarcode,
  PARTITIONED_BOX_PRESETS,
} from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
import { formatWhatsAppPhone, validateEgyptianPhone } from '@/lib/validation';
import SupermarketReceiptModal from '@/components/SupermarketReceiptModal';

const ADMIN_SESSION_STORAGE_KEY = 'nuts_admin_session';

export default function HafsaPosCashierPage() {
  const { storeData, refreshStore, showToast } = useStore();
  const products = storeData?.products || [];
  const categories = storeData?.categories || [];
  const settings = storeData?.settings;

  // Cashier & Staff Role Isolation Auth State
  const [posAuthChecking, setPosAuthChecking] = useState<boolean>(true);
  const [posAuthenticated, setPosAuthenticated] = useState<boolean>(false);
  const [posRole, setPosRole] = useState<AdminRole>('cashier');
  const [posToken, setPosToken] = useState<string>('');
  const [posLoginRole, setPosLoginRole] = useState<AdminRole>('cashier');
  const [posLoginUsername, setPosLoginUsername] = useState<string>('');
  const [posLoginPassword, setPosLoginPassword] = useState<string>('');
  const [posLoginError, setPosLoginError] = useState<string>('');

  // Cashier is strictly isolated from wholesale raw costs and net profits
  const canSeeProfits = posRole === 'super_admin' || posRole === 'accountant';

  // Workspace Mode Tabs
  const [activeTab, setActiveTab] = useState<
    'terminal' | 'online_queue' | 'pos_history' | 'shift_zreport'
  >('terminal');

  // POS Server State
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [posShifts, setPosShifts] = useState<PosShift[]>([]);
  const [posExpenses, setPosExpenses] = useState<PosExpense[]>([]);
  const [recentPosOrders, setRecentPosOrders] = useState<Order[]>([]);
  const [onlineQueueOrders, setOnlineQueueOrders] = useState<Order[]>([]);
  const [posLoading, setPosLoading] = useState<boolean>(false);

  // Catalog Filter & Barcode Search
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [barcodeFeedback, setBarcodeFeedback] = useState<string | null>(null);

  // Interactive Digital Scale & Sell-by-Amount Panel
  const [scaleProduct, setScaleProduct] = useState<Product | null>(null);
  const [scaleMode, setScaleMode] = useState<'by_grams' | 'by_amount_egp'>('by_grams');
  const [scaleGrams, setScaleGrams] = useState<number>(250);
  const [scaleTargetEgp, setScaleTargetEgp] = useState<number>(50);
  const [scaleRoast, setScaleRoast] = useState<string>('محمص مملح');
  const [scaleWorkerNotes, setScaleWorkerNotes] = useState<string>('');

  // Quick Coffee Barista Modal inside POS
  const [showCoffeePanel, setShowCoffeePanel] = useState<boolean>(false);
  const [coffeeBrazilian, setCoffeeBrazilian] = useState<number>(50);
  const [coffeeColombian, setCoffeeColombian] = useState<number>(30);
  const [coffeeHabashi, setCoffeeHabashi] = useState<number>(0);
  const [coffeeIndian, setCoffeeIndian] = useState<number>(20);
  const [coffeeRoast, setCoffeeRoast] = useState<string>(COFFEE_ROAST_LEVELS[1]);
  const [coffeeSpicing, setCoffeeSpicing] = useState<string>(
    COFFEE_SPICING_OPTIONS[2].option
  );
  const [coffeeGrind, setCoffeeGrind] = useState<string>(COFFEE_GRIND_TYPES[0]);
  const [coffeeWeight, setCoffeeWeight] = useState<number>(250);

  // Current POS Invoice Cart State
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

  // Printable Receipt / Sticker Preview Modal
  const [printedOrder, setPrintedOrder] = useState<Order | null>(null);
  const [printMode, setPrintMode] = useState<'receipt' | 'sticker' | 'zreport'>('receipt');
  const [stickerPreviewItem, setStickerPreviewItem] = useState<{
    title: string;
    weightLabel: string;
    roastOrSpec: string;
    price: number;
    barcode: string;
    date: string;
  } | null>(null);

  // Shift & Expense Forms
  const [newShiftCashier, setNewShiftCashier] = useState<string>(
    'كاشير فرع بني مزار (أمام مسجد الزراعيين)'
  );
  const [newShiftPeriod, setNewShiftPeriod] = useState<
    'الوردية الصباحية' | 'الوردية المسائية' | 'وردية اليوم الكامل'
  >('الوردية المسائية');
  const [newShiftOpeningCash, setNewShiftOpeningCash] = useState<number>(1000);
  const [closingActualCash, setClosingActualCash] = useState<number>(1822);
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<number>(50);
  const [expenseCategory, setExpenseCategory] = useState<
    'raw_materials' | 'packaging' | 'utilities' | 'delivery_rider' | 'other'
  >('packaging');

  const fetchPosData = useCallback(async (overrideToken?: string) => {
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
        if (data.activeShift) {
          setClosingActualCash(data.activeShift.expectedCashInDrawer);
        }
      }
    } catch (e) {
      console.error('Failed to load POS data', e);
    }
  }, [posToken]);

  useEffect(() => {
    const verifyPosSession = async () => {
      try {
        let savedToken = '';
        let savedRole: AdminRole | undefined;
        const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token && parsed?.expiresAt > Date.now()) {
            savedToken = parsed.token;
            savedRole = parsed.role;
          }
        }
        const headers: Record<string, string> = {};
        if (savedToken) {
          headers['Authorization'] = `Bearer ${savedToken}`;
        }
        const res = await fetch('/api/admin/login', { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const verifiedRole: AdminRole = data.role || savedRole || 'super_admin';
          if (verifiedRole === 'supplier' || verifiedRole === 'promo_partner') {
            setPosAuthenticated(false);
            setPosRole(verifiedRole);
            setPosLoginError(
              'عزل الأدوار: حساب المورد معزول تماماً عن شاشة الكاشير ونقطة البيع. يرجى تسجيل الدخول بحساب الكاشير.'
            );
          } else {
            setPosToken(data.token || savedToken);
            setPosRole(verifiedRole);
            setPosAuthenticated(true);
            await fetchPosData(data.token || savedToken);
          }
        } else {
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
          role: posLoginRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPosLoginError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
        return;
      }
      const role: AdminRole = data.role || posLoginRole;
      if (role === 'supplier' || role === 'promo_partner') {
        setPosLoginError('عزل الأدوار: هذا الحساب غير مصرح له بفتح شاشة الكاشير');
        return;
      }
      localStorage.setItem(
        ADMIN_SESSION_STORAGE_KEY,
        JSON.stringify({
          token: data.token,
          expiresAt: data.expiresAt,
          role,
          username: data.username,
        })
      );
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
    setPosToken('');
    setPosAuthenticated(false);
    setPosLoginPassword('');
  };

  // Select first product in scale panel when products load
  useEffect(() => {
    if (!scaleProduct && products.length > 0) {
      setScaleProduct(products[0]);
      setScaleRoast(products[0].roastOptions?.[0] || 'محمص مملح');
    }
  }, [products, scaleProduct]);

  // Web Audio Chime for Cashier Actions & Alerts
  const playCashierBeep = (freq = 880, duration = 0.15) => {
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

  // Filtered Products for POS Touch Grid
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.subCategoryName || '').toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Live Digital Scale Calculation
  const scaleCalculation = useMemo(() => {
    if (!scaleProduct) return null;
    const prodIdx = Math.max(
      0,
      products.findIndex((p) => p.id === scaleProduct.id)
    );
    if (scaleMode === 'by_amount_egp') {
      return calculatePosItemByAmountEgp(scaleProduct, scaleTargetEgp, prodIdx);
    }
    return calculatePosItemByGrams(scaleProduct, scaleGrams, prodIdx);
  }, [scaleProduct, scaleMode, scaleGrams, scaleTargetEgp, products]);

  // Add Item to POS Invoice
  const addPosItem = (item: CartItem) => {
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
  };

  // Add Product from Touch Card Preset Weight (125g, 250g, 500g, 1000g)
  const handleQuickAddWeight = (prod: Product, weightGrams: number) => {
    const prodIdx = Math.max(0, products.findIndex((p) => p.id === prod.id));
    const calc = calculatePosItemByGrams(prod, weightGrams, prodIdx);
    const roast = prod.roastOptions?.[0] || 'محمص مملح';

    addPosItem({
      cartItemId: `pos-${prod.id}-${weightGrams}-${roast}`,
      productId: prod.id,
      productName: prod.name,
      productImage: getSafeImageUrl(prod.image),
      weightId: `w-${weightGrams}`,
      weightLabel: calc.weightLabel,
      roastOption: roast,
      unitPrice: calc.unitPrice,
      quantity: 1,
      rawCostEgp: calc.rawCostEgp,
      customWeightGrams: calc.weightGrams,
      barcodeLabel: calc.barcodeLabel,
    });
  };

  // Add from Digital Scale Panel
  const handleAddScaleItemToInvoice = () => {
    if (!scaleProduct || !scaleCalculation) return;
    addPosItem({
      cartItemId: `pos-scale-${scaleProduct.id}-${scaleCalculation.weightGrams}-${scaleCalculation.unitPrice}-${scaleRoast}-${scaleWorkerNotes}`,
      productId: scaleProduct.id,
      productName: scaleProduct.name,
      productImage: getSafeImageUrl(scaleProduct.image),
      weightId: `scale-${scaleCalculation.weightGrams}`,
      weightLabel: scaleCalculation.weightLabel,
      roastOption: scaleRoast,
      unitPrice: scaleCalculation.unitPrice,
      quantity: 1,
      rawCostEgp: scaleCalculation.rawCostEgp,
      customWeightGrams: scaleCalculation.weightGrams,
      barcodeLabel: scaleCalculation.barcodeLabel,
      workerNotes: scaleWorkerNotes.trim() || undefined,
    });
    showToast(
      `تم وزن وإضافة "${scaleProduct.name}" للفاتورة`,
      `${scaleCalculation.weightLabel} • ${scaleCalculation.unitPrice} ج.م`
    );
    setScaleWorkerNotes('');
  };

  // Barcode / Scale Input Handler
  const handleBarcodeScanSubmit = (e: React.FormEvent, overrideCode?: string) => {
    e.preventDefault();
    const codeToScan = (overrideCode ?? barcodeInput).trim();
    if (!codeToScan) return;

    const parsed = parseScaleBarcode(codeToScan, products);
    if (!parsed) {
      playCashierBeep(320, 0.25);
      setBarcodeFeedback(`❌ لم يتم العثور على باركود أو كود صنف يطابق: ${codeToScan}`);
      return;
    }

    const { product, calc } = parsed;
    addPosItem({
      cartItemId: `pos-bc-${product.id}-${calc.weightGrams}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productImage: getSafeImageUrl(product.image),
      weightId: `scale-${calc.weightGrams}`,
      weightLabel: calc.weightLabel,
      roastOption: product.roastOptions?.[0] || 'محمص مملح',
      unitPrice: calc.unitPrice,
      quantity: 1,
      rawCostEgp: calc.rawCostEgp,
      customWeightGrams: calc.weightGrams,
      barcodeLabel: calc.barcodeLabel,
    });
    setBarcodeFeedback(
      `✅ تم قراءة باركود الميزان: ${product.name} (${calc.weightGrams} جم) = ${calc.unitPrice} ج.م`
    );
    setBarcodeInput('');
  };

  // Quick Add Partitioned Box in POS
  const handleQuickAddPosBox = (boxSize: PartitionedBoxSize) => {
    const preset = PARTITIONED_BOX_PRESETS[boxSize];
    const rawCost =
      boxSize === 'roqan_4' ? 85 : boxSize === 'family_6' ? 168 : 320;
    addPosItem({
      cartItemId: `pos-box-${boxSize}-${Date.now()}`,
      productId:
        boxSize === 'roqan_4'
          ? 'prod-box-roqan-125'
          : boxSize === 'family_6'
            ? 'prod-box-family-250'
            : 'prod-royal-mix-1',
      productName: `🎁 ${preset.name}`,
      productImage: '/images/products/royal-mix.jpg',
      weightId: boxSize,
      weightLabel: `${preset.slotsCount} خانات (~${preset.totalWeightGrams} جم)`,
      roastOption: 'تشكيلة سهرة طازجة',
      unitPrice: preset.basePrice,
      quantity: 1,
      rawCostEgp: rawCost,
      isPartitionedBox: true,
      partitionedBoxSize: boxSize,
    });
  };

  // Quick Add Custom Coffee Blend in POS
  const coffeeBlendCalc = useMemo(
    () =>
      calculateCoffeeBlendPrice({
        brazilianPercent: coffeeBrazilian,
        colombianPercent: coffeeColombian,
        habashiPercent: coffeeHabashi,
        indianPercent: coffeeIndian,
        roastLevel: coffeeRoast,
        spicing: coffeeSpicing,
        grindType: coffeeGrind,
        weightGrams: coffeeWeight,
      }),
    [
      coffeeBrazilian,
      coffeeColombian,
      coffeeHabashi,
      coffeeIndian,
      coffeeRoast,
      coffeeSpicing,
      coffeeGrind,
      coffeeWeight,
    ]
  );

  const handleAddPosCoffeeBlend = () => {
    if (!coffeeBlendCalc.isValid) {
      showToast('⚠️ مجموع نسب البن يجب أن يساوي 100%');
      return;
    }
    const rawCost = Math.round(coffeeBlendCalc.totalPrice * 0.72);
    addPosItem({
      cartItemId: `pos-coffee-${Date.now()}`,
      productId: 'prod-hafsa-turkish-coffee-1',
      productName: `☕ توليفة بن خاصة (${coffeeWeight} جم)`,
      productImage: '/images/products/hazelnut.jpg',
      weightId: `w-${coffeeWeight}`,
      weightLabel: `${coffeeWeight} جم`,
      roastOption: `${coffeeRoast} • ${coffeeSpicing}`,
      unitPrice: coffeeBlendCalc.totalPrice,
      quantity: 1,
      rawCostEgp: rawCost,
      customWeightGrams: coffeeWeight,
      workerNotes: coffeeBlendCalc.baristaLabel,
      isCoffeeBlend: true,
      coffeeBlendSpec: coffeeBlendCalc.spec,
    });
    setShowCoffeePanel(false);
    showToast('تمت إضافة توليفة البن وملصق الباريستا للفاتورة ☕');
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

  // Print Scale / Barista Sticker
  const handleOpenStickerPreview = () => {
    if (scaleProduct && scaleCalculation) {
      setStickerPreviewItem({
        title: scaleProduct.name,
        weightLabel: scaleCalculation.weightLabel,
        roastOrSpec: `${scaleRoast}${scaleWorkerNotes ? ` • ${scaleWorkerNotes}` : ''}`,
        price: scaleCalculation.unitPrice,
        barcode: scaleCalculation.barcodeLabel,
        date: new Date().toLocaleDateString('ar-EG'),
      });
      setPrintMode('sticker');
    }
  };

  // Shift Management Handlers
  const handleOpenNewShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'open_shift',
          cashierName: newShiftCashier,
          shiftPeriod: newShiftPeriod,
          openingCash: newShiftOpeningCash,
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

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'close_shift',
          actualClosingCash: closingActualCash,
        }),
      });
      if (res.ok) {
        await fetchPosData();
        setPrintMode('zreport');
        showToast('📊 تم تقفيل الوردية وإصدار تقرير Z-Report بنجاح');
      }
    } finally {
      setPosLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim()) return;
    setPosLoading(true);
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: getPosAuthHeaders(),
        body: JSON.stringify({
          action: 'add_expense',
          title: expenseTitle,
          amount: expenseAmount,
          category: expenseCategory,
        }),
      });
      if (res.ok) {
        setExpenseTitle('');
        setExpenseAmount(50);
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
              <label className="block text-xs font-black text-[#231710] mb-1.5">
                اختر الدور للدخول إلى نقطة البيع:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'cashier' as AdminRole,
                    label: '⚖️ الكاشير',
                    desc: 'cashier_pos',
                    defaultUser: 'cashier_pos',
                    defaultPass: 'Cash#Pos2026',
                  },
                  {
                    id: 'accountant' as AdminRole,
                    label: '📊 المحاسب',
                    desc: 'accountant_fin',
                    defaultUser: 'accountant_fin',
                    defaultPass: 'Acc#Fin2026',
                  },
                  {
                    id: 'super_admin' as AdminRole,
                    label: '👑 الأدمن',
                    desc: 'admin_hafsa',
                    defaultUser: 'admin_hafsa',
                    defaultPass: 'Hafsa@Admin2026',
                  },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setPosLoginRole(r.id);
                      setPosLoginError('');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      posLoginRole === r.id
                        ? 'bg-[#231710] text-[#D4AF37] border-[#D4AF37] shadow-sm'
                        : 'bg-white text-[#231710] border-[#E6DFD3] hover:border-[#C88A4B]'
                    }`}
                  >
                    <div className="font-cairo font-black text-xs">{r.label}</div>
                    <div className="text-[10px] font-mono opacity-85">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E6DFD3] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="font-mono text-[#231710]">
                {posLoginRole === 'cashier' ? (
                  <>
                    User: <strong>cashier_pos</strong> | Pass: <strong>Cash#Pos2026</strong>
                  </>
                ) : posLoginRole === 'accountant' ? (
                  <>
                    User: <strong>accountant_fin</strong> | Pass: <strong>Acc#Fin2026</strong>
                  </>
                ) : (
                  <>
                    User: <strong>admin_hafsa</strong> | Pass: <strong>Hafsa@Admin2026</strong>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (posLoginRole === 'cashier') {
                    setPosLoginUsername('cashier_pos');
                    setPosLoginPassword('Cash#Pos2026');
                  } else if (posLoginRole === 'accountant') {
                    setPosLoginUsername('accountant_fin');
                    setPosLoginPassword('Acc#Fin2026');
                  } else {
                    setPosLoginUsername('admin_hafsa');
                    setPosLoginPassword('Hafsa@Admin2026');
                  }
                  setPosLoginError('');
                }}
                className="bg-[#231710] text-[#D4AF37] font-black px-2.5 py-1 rounded-lg text-[10px] cursor-pointer"
              >
                تعبئة تلقائية ⚡
              </button>
            </div>

            <div>
              <label className="block text-xs font-black text-[#231710] mb-1">
                اسم المستخدم ({posLoginRole === 'cashier' ? 'الكاشير' : posLoginRole === 'accountant' ? 'المحاسب' : 'الأدمن'}):
              </label>
              <input
                type="text"
                required
                value={posLoginUsername}
                onChange={(e) => setPosLoginUsername(e.target.value)}
                placeholder={
                  posLoginRole === 'cashier'
                    ? 'cashier_pos'
                    : posLoginRole === 'accountant'
                      ? 'accountant_fin'
                      : 'admin_hafsa'
                }
                className="w-full bg-white border-2 border-[#E6DFD3] focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-xs font-mono font-bold outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#231710] mb-1">
                كلمة المرور ({posLoginRole === 'cashier' ? 'الكاشير' : posLoginRole === 'accountant' ? 'المحاسب' : 'الأدمن'}):
              </label>
              <input
                type="password"
                required
                value={posLoginPassword}
                onChange={(e) => setPosLoginPassword(e.target.value)}
                placeholder={
                  posLoginRole === 'cashier'
                    ? 'Cash#Pos2026'
                    : posLoginRole === 'accountant'
                      ? 'Acc#Fin2026'
                      : 'Hafsa@Admin2026'
                }
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
              فتح شاشة الكاشير والميزان الآن
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

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-20">
      {/* ===================================================================== */}
      {/* TOP POS TERMINAL HEADER BAR                                           */}
      {/* ===================================================================== */}
      <div className="bg-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37] px-4 py-3 sticky top-0 z-40 shadow-md print:hidden">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-[#231710] flex items-center justify-center font-black text-lg shadow">
              ⚖️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-cairo font-black text-base sm:text-lg text-[#D4AF37]">
                  نظام كاشير وميزان محمصة حفصة الذكي (POS)
                </h1>
                <span className="bg-[#3B6E4C] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {posRole === 'cashier'
                    ? '🛡️ دور الكاشير (معزول عن التكاليف والأرباح)'
                    : posRole === 'accountant'
                      ? '📊 دور المحاسب (مراجعة مالية)'
                      : '👑 دور الأدمن (إشراف كامل)'}
                </span>
              </div>
              <p className="text-[11px] text-[#FAF6F0]/80">
                {activeShift
                  ? `الوردية النشطة: ${activeShift.shiftNumber} (${activeShift.shiftPeriod}) • النقدية المتوقعة بالدرج: ${activeShift.expectedCashInDrawer} ج.م`
                  : 'لا توجد وردية مفتوحة — يمكنك فتح وردية جديدة من تبويب تقفيل الدرج'}
              </p>
            </div>
          </div>

          {/* 4 POS Workspace Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('terminal')}
              className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'terminal'
                  ? 'bg-[#D4AF37] text-[#231710] shadow'
                  : 'bg-white/10 text-[#FAF6F0] hover:bg-white/20'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>شاشة الكاشير والميزان</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('online_queue')}
              className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'online_queue'
                  ? 'bg-[#D4AF37] text-[#231710] shadow'
                  : 'bg-white/10 text-[#FAF6F0] hover:bg-white/20'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>طلبات الموقع الأونلاين</span>
              <span className="bg-[#B83B2B] text-white text-[10px] px-1.5 py-0.2 rounded-full tabular-nums">
                {onlineQueueOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pos_history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'pos_history'
                  ? 'bg-[#D4AF37] text-[#231710] shadow'
                  : 'bg-white/10 text-[#FAF6F0] hover:bg-white/20'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>فواتير الكاشير ({recentPosOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('shift_zreport')}
              className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'shift_zreport'
                  ? 'bg-[#D4AF37] text-[#231710] shadow'
                  : 'bg-white/10 text-[#FAF6F0] hover:bg-white/20'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>تقفيل الدرج والـ Z-Report</span>
            </button>

            {canSeeProfits && (
              <Link
                href="/admin"
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/15 text-[#D4AF37] border border-[#D4AF37]/40 flex items-center gap-1"
              >
                <span>لوحة الإدارة</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>
            )}

            <button
              type="button"
              onClick={handlePosLogout}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[#B83B2B]/25 hover:bg-[#B83B2B]/40 text-red-200 border border-[#B83B2B]/50 cursor-pointer"
            >
              خروج الكاشير
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: POS TOUCH TERMINAL & DIGITAL SCALE                             */}
      {/* ===================================================================== */}
      {activeTab === 'terminal' && (
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 print:hidden">
          {/* RIGHT/MAIN AREA (7 cols): Barcode Scanner, Digital Scale & Touch Catalog */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* 1. Barcode Scale Scanner & Quick Shortcuts Bar */}
            <div className="bg-white rounded-2xl p-3.5 border border-[#E6DFD3] shadow-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <form
                  onSubmit={(e) => handleBarcodeScanSubmit(e)}
                  className="flex-1 flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-[#C88A4B] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="امسح باركود الميزان الإلكتروني (20PPPPWWWWWC) أو كود الصنف (مثلاً 200001)..."
                      className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#D4AF37] rounded-xl pr-9 pl-3 py-2 text-xs font-bold outline-none tabular-nums"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#231710] hover:bg-[#3a261a] text-[#D4AF37] font-cairo font-black text-xs px-4 py-2 rounded-xl shrink-0 cursor-pointer"
                  >
                    قراءة الباركود
                  </button>
                </form>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickAddPosBox('roqan_4')}
                    className="bg-[#F3ECE1] hover:bg-[#D4AF37]/30 text-[#231710] border border-[#C88A4B]/40 px-2.5 py-2 rounded-xl text-[11px] font-black cursor-pointer"
                  >
                    🎁 بوكس روقان (125ج)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPosBox('family_6')}
                    className="bg-[#F3ECE1] hover:bg-[#D4AF37]/30 text-[#231710] border border-[#C88A4B]/40 px-2.5 py-2 rounded-xl text-[11px] font-black cursor-pointer"
                  >
                    👨‍👩‍👧‍👦 بوكس العيلة (250ج)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPosBox('vip_6')}
                    className="bg-[#231710] text-[#D4AF37] px-2.5 py-2 rounded-xl text-[11px] font-black cursor-pointer"
                  >
                    👑 بوكس VIP (450ج)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCoffeePanel(!showCoffeePanel)}
                    className="bg-[#C88A4B] text-white px-2.5 py-2 rounded-xl text-[11px] font-black cursor-pointer flex items-center gap-1"
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span>توليفة بن</span>
                  </button>
                </div>
              </div>

              {/* Quick Test Scale Barcodes Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#E6DFD3]/70">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-[#6E5D4F]">باركود ميزان سريع للتجربة:</span>
                  <button
                    type="button"
                    onClick={(e) => handleBarcodeScanSubmit(e, '200001002507')}
                    className="bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#E6DFD3] px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold text-[#231710] cursor-pointer"
                  >
                    200001002507 (ربع فستق)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleBarcodeScanSubmit(e, '200006005007')}
                    className="bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#E6DFD3] px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold text-[#231710] cursor-pointer"
                  >
                    200006005007 (نصف لب سوبر)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleBarcodeScanSubmit(e, '200013002507')}
                    className="bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#E6DFD3] px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold text-[#231710] cursor-pointer"
                  >
                    200013002507 (ربع بن حفصة)
                  </button>
                </div>
                {barcodeFeedback && (
                  <span className="font-bold text-[#3B6E4C]">{barcodeFeedback}</span>
                )}
              </div>
            </div>

            {/* Optional Quick Coffee Blend Panel inside POS */}
            {showCoffeePanel && (
              <div className="bg-[#231710] text-[#FAF6F0] rounded-2xl p-4 border-2 border-[#D4AF37] space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-cairo font-black text-sm text-[#D4AF37] flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    <span>ركن الباريستا السريع — طحن توليفة بن خاصة على الكاشير</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCoffeePanel(false)}
                    className="text-xs text-[#FAF6F0]/70 hover:text-white cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-[#D4AF37] font-bold mb-1">
                      برازيلي ({coffeeBrazilian}%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={10}
                      value={coffeeBrazilian}
                      onChange={(e) => setCoffeeBrazilian(Number(e.target.value))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white font-black tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#D4AF37] font-bold mb-1">
                      كولومبي ({coffeeColombian}%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={10}
                      value={coffeeColombian}
                      onChange={(e) => setCoffeeColombian(Number(e.target.value))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white font-black tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#D4AF37] font-bold mb-1">
                      حبشي ({coffeeHabashi}%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={10}
                      value={coffeeHabashi}
                      onChange={(e) => setCoffeeHabashi(Number(e.target.value))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white font-black tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#D4AF37] font-bold mb-1">
                      هندي ({coffeeIndian}%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={10}
                      value={coffeeIndian}
                      onChange={(e) => setCoffeeIndian(Number(e.target.value))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white font-black tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <select
                    value={coffeeRoast}
                    onChange={(e) => setCoffeeRoast(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-2 text-white font-bold"
                  >
                    {COFFEE_ROAST_LEVELS.map((r) => (
                      <option key={r} value={r} className="text-[#231710]">
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    value={coffeeSpicing}
                    onChange={(e) => setCoffeeSpicing(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-2 text-white font-bold"
                  >
                    {COFFEE_SPICING_OPTIONS.map((s) => (
                      <option key={s.id} value={s.option} className="text-[#231710]">
                        {s.option}
                      </option>
                    ))}
                  </select>
                  <select
                    value={coffeeGrind}
                    onChange={(e) => setCoffeeGrind(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-2 text-white font-bold"
                  >
                    {COFFEE_GRIND_TYPES.map((g) => (
                      <option key={g} value={g} className="text-[#231710]">
                        {g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={coffeeWeight}
                    onChange={(e) => setCoffeeWeight(Number(e.target.value))}
                    className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-2 text-white font-bold tabular-nums"
                  >
                    <option value={125} className="text-[#231710]">
                      ثمن 125 جم
                    </option>
                    <option value={250} className="text-[#231710]">
                      ربع 250 جم
                    </option>
                    <option value={500} className="text-[#231710]">
                      نصف 500 جم
                    </option>
                    <option value={1000} className="text-[#231710]">
                      كيلو 1000 جم
                    </option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/15">
                  <div className="text-xs">
                    <span className="text-[#D4AF37] font-bold">ملصق الباريستا: </span>
                    <span className="text-[#FAF6F0]/90">{coffeeBlendCalc.baristaLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPosCoffeeBlend}
                    className="bg-[#D4AF37] text-[#231710] font-cairo font-black text-xs px-4 py-2 rounded-xl cursor-pointer shrink-0"
                  >
                    أضف التوليفة ({coffeeBlendCalc.totalPrice} ج.م) +
                  </button>
                </div>
              </div>
            )}

            {/* 2. Interactive Digital Scale & "Sell by EGP Amount" Unit */}
            {scaleProduct && scaleCalculation && (
              <div className="bg-gradient-to-l from-[#231710] via-[#2c1d14] to-[#231710] text-[#FAF6F0] rounded-2xl p-4 border-2 border-[#D4AF37]/80 shadow-md space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-[#D4AF37] block">
                        ميزان الباركود الإلكتروني الحساس (حساب بالجرام أو بمبلغ بالجنيه)
                      </span>
                      <h2 className="font-cairo font-black text-sm sm:text-base text-white">
                        {scaleProduct.name}{' '}
                        <span className="text-xs font-normal text-[#D4AF37] tabular-nums">
                          (سعر الكيلو: {scaleProduct.pricePerKg || 400} ج.م • كود الميزان:{' '}
                          {getProductBarcode(
                            scaleProduct,
                            products.findIndex((p) => p.id === scaleProduct.id)
                          )}
                          )
                        </span>
                      </h2>
                    </div>
                  </div>

                  {/* Mode Switcher: By Weight (g) vs By Money Amount (EGP) */}
                  <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/15">
                    <button
                      type="button"
                      onClick={() => setScaleMode('by_grams')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-cairo font-black transition cursor-pointer ${
                        scaleMode === 'by_grams'
                          ? 'bg-[#D4AF37] text-[#231710]'
                          : 'text-[#FAF6F0]/80 hover:text-white'
                      }`}
                    >
                      ⚖️ وزن بالجرام (جم)
                    </button>
                    <button
                      type="button"
                      onClick={() => setScaleMode('by_amount_egp')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-cairo font-black transition cursor-pointer ${
                        scaleMode === 'by_amount_egp'
                          ? 'bg-[#3B6E4C] text-white'
                          : 'text-[#FAF6F0]/80 hover:text-white'
                      }`}
                    >
                      💵 بيع بمبلغ («عايز بـ 50 جنيه»)
                    </button>
                  </div>
                </div>

                {/* Scale Controls & Digital Readout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-7 space-y-2">
                    {scaleMode === 'by_grams' ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { g: 125, label: 'ثمن 125 جم' },
                            { g: 250, label: 'ربع 250 جم' },
                            { g: 375, label: 'ثلاثة أثمان 375 جم' },
                            { g: 500, label: 'نصف 500 جم' },
                            { g: 750, label: 'ثلاثة أرباع 750 جم' },
                            { g: 1000, label: 'كيلو 1000 جم' },
                          ].map((preset) => (
                            <button
                              key={preset.g}
                              type="button"
                              onClick={() => setScaleGrams(preset.g)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-black tabular-nums cursor-pointer ${
                                scaleGrams === preset.g
                                  ? 'bg-[#D4AF37] text-[#231710]'
                                  : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-[#D4AF37] shrink-0">
                            وزن الميزان الحر (بالجرام):
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={10000}
                            step={5}
                            value={scaleGrams}
                            onChange={(e) => setScaleGrams(Number(e.target.value))}
                            className="w-28 bg-black/50 border border-[#D4AF37] rounded-xl px-3 py-1.5 text-sm font-black text-[#D4AF37] tabular-nums"
                          />
                          <span className="text-xs text-[#FAF6F0]/80">جرام</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[25, 35, 50, 75, 100, 150, 200, 300].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setScaleTargetEgp(amt)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-black tabular-nums cursor-pointer ${
                                scaleTargetEgp === amt
                                  ? 'bg-[#3B6E4C] text-white border border-white/40'
                                  : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                            >
                              بـ {amt} ج.م
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-[#D4AF37] shrink-0">
                            المبلغ المطلوب بالجنيه:
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={5000}
                            step={5}
                            value={scaleTargetEgp}
                            onChange={(e) => setScaleTargetEgp(Number(e.target.value))}
                            className="w-28 bg-black/50 border border-[#3B6E4C] rounded-xl px-3 py-1.5 text-sm font-black text-white tabular-nums"
                          />
                          <span className="text-xs text-[#D4AF37] font-black">
                            ← اوزن للعميل: {scaleCalculation.weightGrams} جرام بالضبط
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <select
                        value={scaleRoast}
                        onChange={(e) => setScaleRoast(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white"
                      >
                        {(scaleProduct.roastOptions || ['محمص مملح']).map((r) => (
                          <option key={r} value={r} className="text-[#231710]">
                            {r}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={scaleWorkerNotes}
                        onChange={(e) => setScaleWorkerNotes(e.target.value)}
                        placeholder="ملاحظة على الكيس (مثلاً: بدون ملح / على كيسين)..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-white/50 outline-none"
                      />
                    </div>
                  </div>

                  {/* LCD Digital Scale Readout Screen */}
                  <div className="md:col-span-5 bg-black/60 rounded-2xl p-3 border border-[#D4AF37]/60 flex flex-col justify-between gap-2">
                    <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                      <div className="bg-white/5 rounded-xl p-2">
                        <span className="text-[10px] text-[#FAF6F0]/70 block">الوزن الصافي</span>
                        <span className="font-cairo font-black text-base text-[#D4AF37]">
                          {scaleCalculation.weightGrams} جم
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-2">
                        <span className="text-[10px] text-[#FAF6F0]/70 block">السعر المطلوب</span>
                        <span className="font-cairo font-black text-base text-[#3B6E4C]">
                          {scaleCalculation.unitPrice} ج.م
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-2">
                        {canSeeProfits ? (
                          <>
                            <span className="text-[10px] text-[#FAF6F0]/70 block">صافي الربح</span>
                            <span className="font-cairo font-black text-xs text-white">
                              +{scaleCalculation.netProfitEgp} ج ({scaleCalculation.marginPercent}%)
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-[#FAF6F0]/70 block">سعر الكيلو</span>
                            <span className="font-cairo font-black text-xs text-white">
                              {scaleProduct.pricePerKg || 400} ج.م/كجم
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddScaleItemToInvoice}
                        className="flex-1 bg-[#D4AF37] hover:bg-[#c9a12b] text-[#231710] font-cairo font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>أضف للفاتورة ({scaleCalculation.unitPrice} ج.م)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenStickerPreview}
                        title="طباعة استيكر الميزان الذهبي"
                        className="bg-white/15 hover:bg-white/25 text-white px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>استيكر</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Sticky Category Tabs & Search */}
            <div className="bg-white rounded-2xl p-3 border border-[#E6DFD3] shadow-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-black cursor-pointer ${
                      selectedCategoryId === 'all'
                        ? 'bg-[#231710] text-[#D4AF37]'
                        : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
                    }`}
                  >
                    كل الأصناف ({products.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-black cursor-pointer flex items-center gap-1 ${
                        selectedCategoryId === cat.id
                          ? 'bg-[#231710] text-[#D4AF37]'
                          : 'bg-[#FAF6F0] text-[#231710] hover:bg-[#F3ECE1]'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-[#6E5D4F] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث سريع في الـ 24 عين والبن..."
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              {/* Touch Products Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
                {filteredProducts.map((prod, idx) => {
                  const isOnScale = scaleProduct?.id === prod.id;
                  const kiloPrice =
                    prod.pricePerKg ||
                    prod.weights.find((w) => (w.weightGrams || w.grams) === 1000)?.price ||
                    400;
                  return (
                    <div
                      key={prod.id}
                      className={`rounded-2xl p-2.5 border transition flex flex-col justify-between gap-2 ${
                        isOnScale
                          ? 'bg-[#F3ECE1] border-2 border-[#D4AF37] shadow-sm'
                          : 'bg-[#FAF6F0] border-[#E6DFD3] hover:border-[#C88A4B]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[9.5px] font-mono font-bold text-[#6E5D4F] block">
                            #{getProductBarcode(prod, idx)} • {kiloPrice} ج/كجم
                          </span>
                          <h3 className="font-cairo font-black text-xs text-[#231710] line-clamp-2 leading-snug">
                            {prod.name}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScaleProduct(prod);
                            setScaleRoast(prod.roastOptions?.[0] || 'محمص مملح');
                          }}
                          title="ضع الصنف على الميزان الإلكتروني"
                          className={`p-1.5 rounded-lg shrink-0 cursor-pointer ${
                            isOnScale
                              ? 'bg-[#231710] text-[#D4AF37]'
                              : 'bg-white text-[#231710] border border-[#E6DFD3]'
                          }`}
                        >
                          <Scale className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 4 Instant Touch Weight Buttons */}
                      <div className="grid grid-cols-2 gap-1 tabular-nums">
                        {[
                          { g: 125, short: 'ثمن' },
                          { g: 250, short: 'ربع' },
                          { g: 500, short: 'نصف' },
                          { g: 1000, short: 'كيلو' },
                        ].map((wBtn) => {
                          const wObj = prod.weights.find(
                            (w) => (w.weightGrams || w.grams) === wBtn.g
                          );
                          const price = wObj
                            ? wObj.price
                            : Math.round((kiloPrice * wBtn.g) / 1000);
                          return (
                            <button
                              key={wBtn.g}
                              type="button"
                              onClick={() => handleQuickAddWeight(prod, wBtn.g)}
                              className="bg-white hover:bg-[#231710] hover:text-[#D4AF37] text-[#231710] border border-[#E6DFD3] rounded-lg px-1.5 py-1 text-[10.5px] font-black flex items-center justify-between transition cursor-pointer"
                            >
                              <span>{wBtn.short}</span>
                              <span className="text-[#3B6E4C] group-hover:text-[#D4AF37]">
                                {price}ج
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LEFT AREA (5 cols): Active POS Invoice, VIP Sync, Cash Calculator & Print */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-3">
            <div className="bg-white rounded-3xl p-4 border-2 border-[#E6DFD3] shadow-md space-y-3.5 sticky top-20">
              {/* Order Type Selector: Counter / 4-Chair Glass Bar / Phone Delivery */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'counter_takeaway' as PosOrderType, label: '🛍️ بيع كاونتر' },
                    { id: 'glass_bar_dine_in' as PosOrderType, label: '☕ البار (4 كراسي)' },
                    { id: 'phone_delivery' as PosOrderType, label: '🛵 دليفري سريع' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPosOrderType(t.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-cairo font-black border transition cursor-pointer ${
                        posOrderType === t.id
                          ? 'bg-[#231710] text-[#D4AF37] border-[#D4AF37]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {posOrderType === 'glass_bar_dine_in' && (
                  <div className="flex items-center justify-between bg-[#F3ECE1] px-3 py-2 rounded-xl border border-[#C88A4B]/40">
                    <span className="text-xs font-black text-[#231710]">
                      اختر رقم الكرسي على البار الزجاجي:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {([1, 2, 3, 4] as const).map((cNum) => (
                        <button
                          key={cNum}
                          type="button"
                          onClick={() => setChairNumber(cNum)}
                          className={`w-7 h-7 rounded-lg text-xs font-black cursor-pointer ${
                            chairNumber === cNum
                              ? 'bg-[#231710] text-[#D4AF37]'
                              : 'bg-white text-[#231710] border border-[#E6DFD3]'
                          }`}
                        >
                          {cNum}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {posOrderType === 'phone_delivery' && (
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="عنوان التوصيل في بندر بني مزار (+20 ج.م شحن)..."
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                )}
              </div>

              {/* Unified Hafsa VIP Customer Lookup & Cashback Sync */}
              <div className="bg-[#FAF6F0] rounded-2xl p-3 border border-[#D4AF37]/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-cairo font-black text-[#231710] flex items-center gap-1">
                    <Crown className="w-4 h-4 text-[#C88A4B]" />
                    <span>ربط الفاتورة بمحفظة حفصة VIP (5% كاش باك)</span>
                  </span>
                  {posVipCashbackEarned > 0 && (
                    <span className="bg-[#3B6E4C] text-white text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums">
                      +{posVipCashbackEarned} ج.م كاش باك للفاتورة
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="موبايل العميل (01XXXXXXXXX)"
                    className="bg-white border border-[#E6DFD3] rounded-xl px-2.5 py-1.5 text-xs font-bold tabular-nums outline-none"
                  />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم العميل (اختياري)"
                    className="bg-white border border-[#E6DFD3] rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                  />
                </div>

                {matchedVipMember ? (
                  <div className="bg-[#231710] text-[#FAF6F0] rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-black text-[#D4AF37] block">
                        👑 {matchedVipMember.customerName} ({matchedVipMember.tier})
                      </span>
                      <span className="text-[11px] tabular-nums">
                        رصيد المحفظة المتاح: <strong>{matchedVipMember.pointsBalance} ج.م</strong>
                      </span>
                    </div>
                    {matchedVipMember.pointsBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setUseVipWallet(!useVipWallet)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${
                          useVipWallet
                            ? 'bg-[#3B6E4C] text-white'
                            : 'bg-[#D4AF37] text-[#231710]'
                        }`}
                      >
                        {useVipWallet
                          ? `✓ تم خصم ${vipWalletRedeemable} ج`
                          : `خصم الرصيد (${matchedVipMember.pointsBalance} ج)`}
                      </button>
                    )}
                  </div>
                ) : (
                  customerPhone.trim().length >= 11 && (
                    <p className="text-[10.5px] font-bold text-[#3B6E4C]">
                      ✨ سيتم تسجيل رقم {customerPhone} تلقائياً في نادي حفصة VIP مع إصدار الفاتورة!
                    </p>
                  )
                )}
              </div>

              {/* Invoice Items List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {posItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#6E5D4F] bg-[#FAF6F0] rounded-2xl border border-dashed border-[#E6DFD3]">
                    الفاتورة فارغة — اضغط على أي صنف أو استخدم الميزان أو الباركود
                  </div>
                ) : (
                  posItems.map((item) => (
                    <div
                      key={item.cartItemId}
                      className="bg-[#FAF6F0] rounded-xl p-2.5 border border-[#E6DFD3] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-cairo font-black text-xs text-[#231710] truncate">
                          {item.productName}
                        </h4>
                        <p className="text-[10.5px] text-[#6E5D4F]">
                          {item.weightLabel} • {item.roastOption}
                        </p>
                        {item.workerNotes && (
                          <p className="text-[10px] text-[#C88A4B] font-bold truncate">
                            📝 {item.workerNotes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                        <button
                          type="button"
                          onClick={() =>
                            setPosItems((prev) =>
                              prev
                                .map((i) =>
                                  i.cartItemId === item.cartItemId
                                    ? { ...i, quantity: i.quantity - 1 }
                                    : i
                                )
                                .filter((i) => i.quantity > 0)
                            )
                          }
                          className="w-6 h-6 rounded-lg bg-white border border-[#E6DFD3] flex items-center justify-center text-xs font-black cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPosItems((prev) =>
                              prev.map((i) =>
                                i.cartItemId === item.cartItemId
                                  ? { ...i, quantity: i.quantity + 1 }
                                  : i
                              )
                            )
                          }
                          className="w-6 h-6 rounded-lg bg-white border border-[#E6DFD3] flex items-center justify-center text-xs font-black cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="font-cairo font-black text-xs text-[#231710] w-14 text-left">
                          {item.unitPrice * item.quantity} ج.م
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPosItems((prev) =>
                              prev.filter((i) => i.cartItemId !== item.cartItemId)
                            )
                          }
                          className="text-[#B83B2B] hover:bg-[#B83B2B]/10 p-1 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Discount, Profit Safety & Totals */}
              <div className="bg-[#F3ECE1] rounded-2xl p-3 border border-[#E6DFD3] space-y-2 tabular-nums text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#6E5D4F] font-bold">المجموع الفرعي:</span>
                  <span className="font-black">{posSubtotal} ج.م</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6E5D4F] font-bold">خصم الكاشير (ج.م):</span>
                  <input
                    type="number"
                    min={0}
                    max={posSubtotal}
                    value={cashierDiscount}
                    onChange={(e) => setCashierDiscount(Number(e.target.value))}
                    className="w-20 bg-white border border-[#E6DFD3] rounded-lg px-2 py-1 text-left font-black"
                  />
                </div>

                {vipWalletRedeemable > 0 && (
                  <div className="flex items-center justify-between text-[#3B6E4C] font-black">
                    <span>خصم محفظة حفصة VIP:</span>
                    <span>-{vipWalletRedeemable} ج.م</span>
                  </div>
                )}

                {posShipping > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#6E5D4F] font-bold">توصيل بندر بني مزار:</span>
                    <span className="font-black">+{posShipping} ج.م</span>
                  </div>
                )}

                {canSeeProfits && posItems.length > 0 && (
                  <div
                    className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-black flex items-center justify-between ${
                      posNetProfit > 0
                        ? 'bg-[#3B6E4C]/15 text-[#3B6E4C]'
                        : 'bg-[#B83B2B]/15 text-[#B83B2B]'
                    }`}
                  >
                    <span>تكلفة شيت عرفات: {posRawCostTotal} ج.م</span>
                    <span>
                      صافي ربح الفاتورة: {posNetProfit} ج.م ({posProfitMargin}%)
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[#C88A4B]/30">
                  <span className="font-cairo font-black text-sm text-[#231710]">
                    الإجمالي المطلوب تحصيله:
                  </span>
                  <span className="font-cairo font-black text-xl text-[#231710]">
                    {posNetTotal} ج.م
                  </span>
                </div>
              </div>

              {/* Payment Method & Cash Change Calculator */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: 'cod' as PaymentMethod, label: '💵 نقدي بالدرج' },
                    { id: 'vodafone_cash' as PaymentMethod, label: '📱 فودافون كاش' },
                    { id: 'instapay' as PaymentMethod, label: '🏦 إنستاباي' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`py-2 rounded-xl font-cairo font-black border cursor-pointer ${
                        paymentMethod === pm.id
                          ? 'bg-[#231710] text-[#D4AF37] border-[#D4AF37]'
                          : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'cod' ? (
                  <div className="bg-[#FAF6F0] rounded-2xl p-2.5 border border-[#E6DFD3] space-y-2 tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-[#231710]">
                        المدفوع من العميل:
                      </span>
                      <div className="flex items-center gap-1">
                        {[posNetTotal, 50, 100, 200, 500].map((den, i) => (
                          <button
                            key={`${den}-${i}`}
                            type="button"
                            onClick={() => setCashTenderedInput(den)}
                            className="px-2 py-1 rounded-lg bg-white border border-[#E6DFD3] hover:border-[#231710] text-[10.5px] font-black cursor-pointer"
                          >
                            {i === 0 ? 'بالضبط' : `${den}ج`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="number"
                        value={cashTenderedInput}
                        onChange={(e) =>
                          setCashTenderedInput(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder={`المدفوع (${posNetTotal} ج.م)`}
                        className="w-28 bg-white border border-[#E6DFD3] rounded-xl px-2.5 py-1.5 text-xs font-black"
                      />
                      <div className="text-left">
                        <span className="text-[11px] text-[#6E5D4F] ml-1">الباقي للعميل:</span>
                        <span className="font-cairo font-black text-base text-[#3B6E4C]">
                          {changeDue} ج.م
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="رقم المحفظة المحول منها أو مرجع إنستاباي..."
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                )}
              </div>

              {/* Issue Invoice & Print Thermal Receipt Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={posLoading || posItems.length === 0}
                  onClick={handleCompletePosInvoice}
                  className="flex-1 bg-[#3B6E4C] hover:bg-[#2f593d] disabled:opacity-50 text-white font-cairo font-black text-sm py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>إصدار الفاتورة وطباعة البون ({posNetTotal} ج.م)</span>
                </button>
                {posItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPosItems([])}
                    title="إفراغ الفاتورة"
                    className="bg-[#B83B2B]/10 hover:bg-[#B83B2B]/20 text-[#B83B2B] p-3.5 rounded-2xl cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: LIVE ONLINE ORDERS QUEUE IN CASHIER                            */}
      {/* ===================================================================== */}
      {activeTab === 'online_queue' && (
        <div className="max-w-7xl mx-auto px-4 pt-6 space-y-4 print:hidden">
          <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-cairo font-black text-lg text-[#231710]">
                🛵 شاشة استلام وتحضير طلبات الموقع الأونلاين (بندر وقرى بني مزار)
              </h2>
              <p className="text-xs text-[#6E5D4F]">
                جميع الطلبات الواردة من الموقع تظهر هنا فوراً لتحضيرها وطحن البن وطباعة بون التجهيز
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playCashierBeep(880, 0.35)}
                className="bg-[#F3ECE1] text-[#231710] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-[#C88A4B]" />
                <span>اختبار جرس الكاشير</span>
              </button>
              <button
                type="button"
                onClick={() => fetchPosData()}
                className="bg-[#231710] text-[#D4AF37] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث الطابور</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {onlineQueueOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-3xl p-5 border-2 border-[#E6DFD3] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#E6DFD3] pb-2.5">
                  <div>
                    <span className="font-cairo font-black text-base text-[#231710]">
                      #{ord.orderNumber} — {ord.customerName}
                    </span>
                    <p className="text-xs text-[#6E5D4F] tabular-nums">
                      📞 {ord.customerPhone} • 📍 {ord.governorate}
                    </p>
                  </div>
                  <span className="bg-[#D4AF37]/25 text-[#231710] border border-[#D4AF37] px-3 py-1 rounded-full text-xs font-black">
                    {ord.status === 'pending'
                      ? '⏳ قيد المراجعة'
                      : ord.status === 'roasting_packing'
                        ? '🔥 جاري التحميص والتعبئة'
                        : ord.status === 'shipped'
                          ? '🛵 خرج مع الدليفري'
                          : '✅ تم التسليم'}
                  </span>
                </div>

                <p className="text-xs font-bold text-[#231710] bg-[#FAF6F0] p-2.5 rounded-xl">
                  🏠 العنوان: {ord.address}
                  {ord.deliverySlot ? ` • ⏰ ${ord.deliverySlot}` : ''}
                </p>

                <div className="space-y-1 text-xs">
                  {ord.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-[#E6DFD3]/50">
                      <span className="font-bold">
                        {item.quantity}× {item.productName} ({item.weightLabel})
                      </span>
                      <span className="font-black tabular-nums">
                        {item.unitPrice * item.quantity} ج.م
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <span className="font-cairo font-black text-base text-[#3B6E4C] tabular-nums">
                    الإجمالي: {ord.total} ج.م ({ord.paymentMethod.toUpperCase()})
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateOnlineOrderStatus(ord.id, 'roasting_packing')
                      }
                      className="bg-[#C88A4B] text-white px-2.5 py-1.5 rounded-xl text-[11px] font-black cursor-pointer"
                    >
                      🔥 بدء التحضير
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateOnlineOrderStatus(ord.id, 'shipped')}
                      className="bg-[#231710] text-[#D4AF37] px-2.5 py-1.5 rounded-xl text-[11px] font-black cursor-pointer"
                    >
                      🛵 خرج دليفري
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateOnlineOrderStatus(ord.id, 'delivered')}
                      className="bg-[#3B6E4C] text-white px-2.5 py-1.5 rounded-xl text-[11px] font-black cursor-pointer"
                    >
                      ✅ تم التسليم
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintedOrder(ord);
                        setPrintMode('receipt');
                      }}
                      className="bg-[#F3ECE1] text-[#231710] border border-[#C88A4B] px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>بون</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: RECENT IN-STORE POS RECEIPTS HISTORY                           */}
      {/* ===================================================================== */}
      {activeTab === 'pos_history' && (
        <div className="max-w-7xl mx-auto px-4 pt-6 space-y-4 print:hidden">
          <div className="bg-white rounded-3xl p-5 border border-[#E6DFD3] flex items-center justify-between">
            <div>
              <h2 className="font-cairo font-black text-lg text-[#231710]">
                🧾 سجل فواتير الكاشير المباشرة (POS Invoices)
              </h2>
              <p className="text-xs text-[#6E5D4F]">
                جميع فواتير البيع المباشر والبار الزجاجي مع إمكانية إعادة طباعة البون الحراري في أي وقت
              </p>
            </div>
          </div>

          {recentPosOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center text-sm text-[#6E5D4F] border border-[#E6DFD3]">
              لم يتم إصدار فواتير كاشير في هذه الجلسة بعد — أصدر أول فاتورة من تبويب «شاشة الكاشير والميزان»
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentPosOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl p-4 border border-[#E6DFD3] shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-cairo font-black text-sm text-[#231710]">
                      {ord.orderNumber}
                    </span>
                    <span className="text-[11px] text-[#6E5D4F] tabular-nums">
                      {new Date(ord.createdAt).toLocaleTimeString('ar-EG')}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#231710]">
                    👤 {ord.customerName} ({ord.customerPhone})
                  </p>
                  <p className="text-[11px] text-[#6E5D4F]">{ord.address}</p>
                  <div className="text-xs space-y-1 bg-[#FAF6F0] p-2.5 rounded-xl">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {it.quantity}× {it.productName} ({it.weightLabel})
                        </span>
                        <span className="font-black tabular-nums">
                          {it.unitPrice * it.quantity} ج.م
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E6DFD3] tabular-nums">
                    <div>
                      <span className="font-cairo font-black text-sm text-[#3B6E4C] block">
                        الإجمالي: {ord.total} ج.م
                      </span>
                      {canSeeProfits && ord.netProfitEgp !== undefined && (
                        <span className="text-[10.5px] font-bold text-[#6E5D4F]">
                          صافي الربح: +{ord.netProfitEgp} ج.م
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintedOrder(ord);
                        setPrintMode('receipt');
                      }}
                      className="bg-[#231710] text-[#D4AF37] px-3 py-1.5 rounded-xl text-xs font-cairo font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>إعادة طباعة البون</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SHIFT MANAGEMENT, PETTY EXPENSES & Z-REPORT                    */}
      {/* ===================================================================== */}
      {activeTab === 'shift_zreport' && (
        <div className="max-w-7xl mx-auto px-4 pt-6 space-y-6 print:hidden">
          {/* Active Shift Summary Cards */}
          {activeShift && (
            <div className="bg-[#231710] text-[#FAF6F0] rounded-3xl p-6 border-2 border-[#D4AF37] space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-[#D4AF37] block">
                    {canSeeProfits
                      ? 'تقرير درج الكاشير الحي وصافي ربح شيت عرفات (Z-Report Live)'
                      : 'تقرير درج الكاشير الحي وجرد النقدية الفعلي (Z-Report Live)'}
                  </span>
                  <h2 className="font-cairo font-black text-xl text-white">
                    {activeShift.shiftNumber} — {activeShift.shiftPeriod} ({activeShift.cashierName})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrintMode('zreport');
                  }}
                  className="bg-[#D4AF37] text-[#231710] font-cairo font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة تقرير الـ Z-Report الحراري</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
                <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
                  <span className="text-[11px] text-[#FAF6F0]/75 block">رصيد بداية الدرج</span>
                  <span className="font-cairo font-black text-lg text-white">
                    {activeShift.openingCash} ج.م
                  </span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
                  <span className="text-[11px] text-[#FAF6F0]/75 block">مبيعات الكاش النقدية</span>
                  <span className="font-cairo font-black text-lg text-[#D4AF37]">
                    +{activeShift.cashSalesTotal} ج.م
                  </span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
                  <span className="text-[11px] text-[#FAF6F0]/75 block">فودافون كاش + إنستاباي</span>
                  <span className="font-cairo font-black text-lg text-white">
                    {activeShift.vodafoneCashTotal + activeShift.instapayTotal} ج.م
                  </span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
                  <span className="text-[11px] text-[#FAF6F0]/75 block">مصروفات الدرج النثرية</span>
                  <span className="font-cairo font-black text-lg text-[#B83B2B]">
                    -{activeShift.expensesTotal} ج.م
                  </span>
                </div>
                <div className="bg-[#D4AF37]/20 rounded-2xl p-3 border border-[#D4AF37]">
                  <span className="text-[11px] text-[#D4AF37] font-bold block">
                    النقدية الفعلية المتوقعة بالدرج
                  </span>
                  <span className="font-cairo font-black text-xl text-[#D4AF37]">
                    {activeShift.expectedCashInDrawer} ج.م
                  </span>
                </div>
                {canSeeProfits && typeof activeShift.totalNetProfit === 'number' ? (
                  <div className="bg-[#3B6E4C]/25 rounded-2xl p-3 border border-[#3B6E4C]">
                    <span className="text-[11px] text-[#FAF6F0] font-bold block">
                      صافي الربح الفعلي (بعد التكلفة)
                    </span>
                    <span className="font-cairo font-black text-xl text-[#3B6E4C]">
                      +{activeShift.totalNetProfit} ج.م
                    </span>
                  </div>
                ) : (
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
                    <span className="text-[11px] text-[#FAF6F0]/75 block">
                      عدد فواتير الوردية
                    </span>
                    <span className="font-cairo font-black text-xl text-white">
                      {activeShift.ordersCount} فاتورة
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Close Current Shift / Reconcile Cash Drawer */}
            <form
              onSubmit={handleCloseShift}
              className="bg-white rounded-3xl p-5 border border-[#E6DFD3] space-y-3"
            >
              <h3 className="font-cairo font-black text-base text-[#231710]">
                🔒 تقفيل الوردية الحالية وجرد النقدية بالدرج
              </h3>
              <p className="text-xs text-[#6E5D4F]">
                أدخل المبلغ النقدي الفعلي الموجود في درج الكاشير الآن لمطابقته مع الرصيد المتوقع (
                {activeShift?.expectedCashInDrawer || 0} ج.م)
              </p>
              <div>
                <label className="text-xs font-bold block mb-1">
                  النقدية الفعلية المعدودة في الدرج (ج.م):
                </label>
                <input
                  type="number"
                  value={closingActualCash}
                  onChange={(e) => setClosingActualCash(Number(e.target.value))}
                  className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-sm font-black tabular-nums"
                />
              </div>
              {activeShift && (
                <div className="text-xs font-bold tabular-nums">
                  الفرق في الدرج:{' '}
                  <span
                    className={
                      closingActualCash - activeShift.expectedCashInDrawer === 0
                        ? 'text-[#3B6E4C]'
                        : 'text-[#B83B2B]'
                    }
                  >
                    {closingActualCash - activeShift.expectedCashInDrawer} ج.م
                  </span>
                </div>
              )}
              <button
                type="submit"
                disabled={!activeShift || activeShift.status === 'closed'}
                className="w-full bg-[#B83B2B] hover:bg-[#9e3123] disabled:opacity-40 text-white font-cairo font-black text-xs py-3 rounded-xl cursor-pointer"
              >
                اعتماد تقفيل الوردية وإصدار Z-Report
              </button>
            </form>

            {/* 2. Open New Cashier Shift */}
            <form
              onSubmit={handleOpenNewShift}
              className="bg-white rounded-3xl p-5 border border-[#E6DFD3] space-y-3"
            >
              <h3 className="font-cairo font-black text-base text-[#231710]">
                🔓 فتح وردية كاشير جديدة (استلام الدرج)
              </h3>
              <div>
                <label className="text-xs font-bold block mb-1">اسم الكاشير المستلم:</label>
                <input
                  type="text"
                  value={newShiftCashier}
                  onChange={(e) => setNewShiftCashier(e.target.value)}
                  className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold block mb-1">الفترة:</label>
                  <select
                    value={newShiftPeriod}
                    onChange={(e) => setNewShiftPeriod(e.target.value as any)}
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="الوردية الصباحية">الوردية الصباحية</option>
                    <option value="الوردية المسائية">الوردية المسائية</option>
                    <option value="وردية اليوم الكامل">وردية اليوم الكامل</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">عهدة الفكة بالدرج (ج.م):</label>
                  <input
                    type="number"
                    value={newShiftOpeningCash}
                    onChange={(e) => setNewShiftOpeningCash(Number(e.target.value))}
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-[#231710] text-[#D4AF37] font-cairo font-black text-xs py-3 rounded-xl cursor-pointer"
              >
                فتح وردية جديدة الآن
              </button>
            </form>

            {/* 3. Petty Cash Drawer Expense Form */}
            <form
              onSubmit={handleAddExpense}
              className="bg-white rounded-3xl p-5 border border-[#E6DFD3] space-y-3"
            >
              <h3 className="font-cairo font-black text-base text-[#231710]">
                💸 تسجيل مصروف نثري من درج الكاشير
              </h3>
              <div>
                <label className="text-xs font-bold block mb-1">بيان المصروف:</label>
                <input
                  type="text"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="مثلاً: ثلج وحليب لبار الإسبريسو / أكياس..."
                  className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold block mb-1">المبلغ (ج.م):</label>
                  <input
                    type="number"
                    min={1}
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">التصنيف:</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as any)}
                    className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="packaging">أكياس وتغليف واستيكرات</option>
                    <option value="raw_materials">خامات ومستلزمات بار القهوة</option>
                    <option value="delivery_rider">حساب طيار دليفري</option>
                    <option value="utilities">كهرباء / مياه / نظافة</option>
                    <option value="other">مصروفات أخرى</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-[#C88A4B] text-white font-cairo font-black text-xs py-3 rounded-xl cursor-pointer"
              >
                خصم المصروف من الدرج
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUPERMARKET 80MM THERMAL RECEIPT & SCALE STICKER MODAL                */}
      {/* ===================================================================== */}
      {(printedOrder || stickerPreviewItem || (printMode === 'zreport' && activeShift)) && (
        <SupermarketReceiptModal
          order={printedOrder}
          sticker={stickerPreviewItem}
          shift={printMode === 'zreport' ? activeShift : null}
          mode={printMode}
          settings={settings}
          autoPrintOnMount={true}
          showProfit={canSeeProfits}
          onClose={() => {
            setPrintedOrder(null);
            setStickerPreviewItem(null);
            if (printMode === 'zreport') setPrintMode('receipt');
          }}
        />
      )}
    </div>
  );
}
