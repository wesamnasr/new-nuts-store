'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DatabaseSchema,
  Product,
  WeightVariant,
  RoastOption,
  CartItem,
  Coupon,
  CustomMixItem,
  StoreThemeConfig,
  BoxSlotSelection,
  CustomCoffeeBlendSpec,
  VipMember,
  FlashPromotion,
  PartitionedBoxSize,
} from '@/types/store';
import { getResolvedThemeConfig, getSafeImageUrl, STORE_THEMES } from '@/lib/defaults';
import { PARTITIONED_BOX_PRESETS } from '@/lib/pricing';
import { validateEgyptianPhone } from '@/lib/validation';

interface ToastMessage {
  id: string;
  title: string;
  subtitle?: string;
  showCartButton?: boolean;
}

export interface PixelEventLog {
  id: string;
  timestamp: string;
  platform: 'Meta Pixel' | 'TikTok Pixel' | 'Both';
  eventName: string;
  details: string;
}

interface StoreContextType {
  storeData: DatabaseSchema | null;
  loading: boolean;
  isLoading: boolean;
  refreshStore: () => Promise<void>;
  themeConfig: StoreThemeConfig;
  setThemeOverride: (override: Partial<StoreThemeConfig> | null) => void;
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (
    product: Product,
    weight: WeightVariant,
    roast: RoastOption | string,
    quantity?: number,
    workerNotes?: string
  ) => void;
  addCustomBoxToCart: (
    boxSizeGrams: 500 | 1000 | 2000,
    breakdown: CustomMixItem[],
    totalPrice: number
  ) => void;
  addPartitionedBoxToCart: (
    presetId: PartitionedBoxSize,
    slotsOrPresetName: BoxSlotSelection[] | string,
    priceOrSlotsCount?: number,
    quantityOrTotalWeightGrams?: number,
    maybeSlots?: BoxSlotSelection[],
    maybeProtectedPrice?: number
  ) => void;
  addCoffeeBlendToCart: (spec: CustomCoffeeBlendSpec, unitPrice: number, quantity?: number) => void;
  addFlashPromoToCart: (
    promoOrId: FlashPromotion | string,
    title?: string,
    promoPrice?: number,
    image?: string
  ) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartCount: number;
  appliedCoupon: Coupon | null;
  applyCouponCode: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  discountAmount: number;
  activeVipPhone: string;
  setActiveVipPhone: (phone: string) => void;
  activeVipMember: VipMember | null;
  useVipWalletInCheckout: boolean;
  setUseVipWalletInCheckout: (val: boolean) => void;
  selectedProductModal: Product | null;
  setSelectedProductModal: (product: Product | null) => void;
  toasts: ToastMessage[];
  showToast: (title: string, subtitle?: string, showCartButton?: boolean) => void;
  trackPixelEvent: (eventName: string, details?: string | Record<string, any>) => void;
  pixelEvents: PixelEventLog[];
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'new_nuts_cart_v1';
const VIP_PHONE_STORAGE_KEY = 'hafsa_vip_phone_v1';
const PIXEL_LOG_STORAGE_KEY = 'hafsa_pixel_events_v1';
const THEME_OVERRIDE_KEY = 'new_nuts_theme_override_v1';
export const STORE_SYNC_STORAGE_KEY = 'new_nuts_store_sync_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [storeData, setStoreData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [activeVipPhone, setActiveVipPhoneState] = useState<string>('');
  const [useVipWalletInCheckout, setUseVipWalletInCheckout] = useState<boolean>(false);
  const [selectedProductModal, setSelectedProductModal] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pixelEvents, setPixelEvents] = useState<PixelEventLog[]>([]);
  const [themeOverrideState, setThemeOverrideState] = useState<Partial<StoreThemeConfig> | null>(null);

  const showToast = useCallback((title: string, subtitle?: string, showCartButton = false) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, subtitle, showCartButton }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const trackPixelEvent = useCallback(
    (eventName: string, details: string | Record<string, any> = '') => {
      const detailsStr =
        typeof details === 'string' ? details : JSON.stringify(details);
      const logItem: PixelEventLog = {
        id: `px-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('ar-EG'),
        platform: 'Both',
        eventName,
        details: detailsStr,
      };
      setPixelEvents((prev) => {
        const updated = [logItem, ...prev.slice(0, 29)];
        try {
          localStorage.setItem(PIXEL_LOG_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      if (typeof window !== 'undefined') {
        try {
          const w = window as any;
          if (typeof w.fbq === 'function') {
            w.fbq('track', eventName, typeof details === 'object' ? details : { details });
          }
          if (typeof w.ttq?.track === 'function') {
            w.ttq.track(eventName, typeof details === 'object' ? details : { details });
          }
        } catch {}
      }
    },
    []
  );

  const refreshStore = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        try {
          const savedToken =
            sessionStorage.getItem('admin_token') ||
            sessionStorage.getItem('hafsa_pos_token_v1') ||
            '';
          if (savedToken) {
            headers['Authorization'] = `Bearer ${savedToken}`;
            headers['x-admin-token'] = savedToken;
          }
        } catch {}
      }
      const res = await fetch('/api/store', { cache: 'no-store', headers });
      if (res.ok) {
        const data: DatabaseSchema = await res.json();
        setStoreData(data);
        setThemeOverrideState(null);
      }
    } catch (error) {
      console.error('Error loading store data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStore();
    try {
      sessionStorage.removeItem(THEME_OVERRIDE_KEY);
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
      const savedVipPhone = localStorage.getItem(VIP_PHONE_STORAGE_KEY);
      if (savedVipPhone) {
        setActiveVipPhoneState(savedVipPhone);
      }
      const savedPixels = localStorage.getItem(PIXEL_LOG_STORAGE_KEY);
      if (savedPixels) {
        setPixelEvents(JSON.parse(savedPixels));
      }
    } catch (e) {
      console.error('Failed to load state from storage', e);
    }

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === STORE_SYNC_STORAGE_KEY) {
        refreshStore();
      }
    };
    const handleWindowFocus = () => {
      refreshStore();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshStore();
      }
    };

    window.addEventListener('storage', handleStorageSync);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshStore]);

  const setActiveVipPhone = useCallback((phone: string) => {
    const validated = validateEgyptianPhone(phone);
    const clean = validated.isValid ? validated.normalized : phone.trim();
    setActiveVipPhoneState(clean);
    try {
      if (clean) {
        localStorage.setItem(VIP_PHONE_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(VIP_PHONE_STORAGE_KEY);
      }
    } catch {}
  }, []);

  const activeVipMember = React.useMemo(() => {
    if (!activeVipPhone || !storeData?.vipMembers) return null;
    const validated = validateEgyptianPhone(activeVipPhone);
    const target = validated.isValid ? validated.normalized : activeVipPhone.trim();
    const raw = storeData.vipMembers.find((m) => m.phone === target);
    if (!raw) return null;
    const balance = raw.pointsBalance ?? raw.walletBalance ?? 0;
    const name = raw.customerName || raw.name || 'عميل حفصة VIP';
    return {
      ...raw,
      name,
      customerName: name,
      walletBalance: balance,
      pointsBalance: balance,
      qrCodeValue: raw.qrCodeValue || raw.membershipCode || `HAFSA-VIP-${raw.phone}`,
    };
  }, [activeVipPhone, storeData?.vipMembers]);

  const setThemeOverride = useCallback((override: Partial<StoreThemeConfig> | null) => {
    setThemeOverrideState((prev) => {
      if (override === null) {
        try {
          sessionStorage.removeItem(THEME_OVERRIDE_KEY);
        } catch {}
        return null;
      }
      let merged: Partial<StoreThemeConfig> = { ...(prev || {}), ...override };
      if (
        override.themeId &&
        !override.heroLayout &&
        !override.navbarStyle &&
        !override.cardStyle &&
        !override.borderRadius
      ) {
        const preset = STORE_THEMES.find((t) => t.id === override.themeId);
        if (preset) {
          merged = {
            ...merged,
            themeId: preset.id,
            ...preset.defaults,
          };
        }
      }
      return merged;
    });
  }, []);

  const themeConfig: StoreThemeConfig = React.useMemo(() => {
    const base = getResolvedThemeConfig(storeData?.settings);
    if (!themeOverrideState) return base;
    return {
      ...base,
      ...themeOverrideState,
    };
  }, [storeData?.settings, themeOverrideState]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const preset = STORE_THEMES.find((t) => t.id === themeConfig.themeId);
      root.setAttribute('data-theme', themeConfig.themeId);
      root.setAttribute('data-mode', preset?.isDark ? 'dark' : 'light');
      root.setAttribute('data-radius', themeConfig.borderRadius);
      root.setAttribute('data-card-style', themeConfig.cardStyle);
      root.setAttribute('data-navbar-style', themeConfig.navbarStyle);
      root.setAttribute('data-hero-layout', themeConfig.heroLayout);
    }
  }, [themeConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart', e);
    }
  }, [cart]);

  const addToCart = (
    product: Product,
    weight: WeightVariant,
    roast: RoastOption | string,
    quantity = 1,
    workerNotes?: string
  ) => {
    const notesSuffix = workerNotes?.trim() ? `-${workerNotes.trim()}` : '';
    const cartItemId = `${product.id}-${weight.id}-${roast}${notesSuffix}`;
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId,
          productId: product.id,
          productName: product.name,
          productImage: getSafeImageUrl(product.image),
          weightId: weight.id,
          weightLabel: weight.label,
          roastOption: roast,
          unitPrice: weight.price,
          quantity,
          workerNotes: workerNotes?.trim() || undefined,
        },
      ];
    });
    trackPixelEvent('AddToCart', `${product.name} (${weight.label}) - ${weight.price * quantity} ج.م`);
    showToast(`تمت إضافة "${product.name}" إلى السلة`, `${weight.label} • ${roast}`, true);
  };

  const addCustomBoxToCart = (
    boxSizeGrams: 500 | 1000 | 2000,
    breakdown: CustomMixItem[],
    totalPrice: number
  ) => {
    const sizeLabel = boxSizeGrams >= 1000 ? `${boxSizeGrams / 1000} كجم` : `${boxSizeGrams} جم`;
    const cartItemId = `custom-box-${boxSizeGrams}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newCartItem: CartItem = {
      cartItemId,
      productId: `custom-box-${boxSizeGrams}`,
      productName: `علبة مشكلة مخصصة (${sizeLabel})`,
      productImage: getSafeImageUrl(breakdown[0]?.productImage),
      weightId: `w-${boxSizeGrams}`,
      weightLabel: sizeLabel,
      roastOption: 'تشكيلة فاخرة',
      unitPrice: totalPrice,
      quantity: 1,
      isCustomMix: true,
      boxCapacityGrams: boxSizeGrams,
      customBreakdown: breakdown,
    };

    setCart((prev) => [...prev, newCartItem]);
    trackPixelEvent('AddToCart', `علبة مشكلة مخصصة (${sizeLabel}) - ${totalPrice} ج.م`);
    showToast(
      `تمت إضافة العلبة المشكلة (${sizeLabel}) إلى السلة`,
      `${breakdown.length} أصناف • ${totalPrice} ج.م`,
      true
    );
  };

  const addPartitionedBoxToCart = (
    presetId: PartitionedBoxSize,
    slotsOrPresetName: BoxSlotSelection[] | string,
    priceOrSlotsCount?: number,
    quantityOrTotalWeightGrams = 1,
    maybeSlots?: BoxSlotSelection[],
    maybeProtectedPrice?: number
  ) => {
    const preset =
      PARTITIONED_BOX_PRESETS[presetId] || PARTITIONED_BOX_PRESETS.roqan_4;

    let slots: BoxSlotSelection[] = [];
    let presetName = preset.title || preset.name;
    let slotsCount: 4 | 6 = preset.slotsCount;
    let totalWeightGrams = preset.approximateTotalGrams || preset.totalWeightGrams;
    let protectedPrice = preset.basePrice;
    let quantity = 1;

    if (Array.isArray(slotsOrPresetName)) {
      slots = slotsOrPresetName;
      protectedPrice = Number(priceOrSlotsCount) || preset.basePrice;
      quantity = Number(quantityOrTotalWeightGrams) || 1;
    } else {
      presetName = slotsOrPresetName || presetName;
      slotsCount = (priceOrSlotsCount as 4 | 6) || preset.slotsCount;
      totalWeightGrams = Number(quantityOrTotalWeightGrams) || preset.totalWeightGrams;
      slots = maybeSlots || [];
      protectedPrice = Number(maybeProtectedPrice) || preset.basePrice;
    }

    const cartItemId = `partitioned-box-${presetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const breakdown: CustomMixItem[] = slots.map((s, idx) => ({
      productId: s.productId,
      productName: s.productName,
      productImage: s.productImage,
      roastOption: s.roastOption,
      percentage: Math.round((100 / slotsCount) * 10) / 10,
      weightGrams: s.weightGrams || s.slotGrams || preset.slotWeightGrams,
      priceContribution: s.priceContribution || Math.round(protectedPrice / slotsCount),
      slotNumber: s.slotNumber || s.slotIndex || idx + 1,
      slotTitle: s.slotTitle || `الخانة ${idx + 1}`,
    }));

    const newCartItem: CartItem = {
      cartItemId,
      productId:
        presetId === 'roqan_4'
          ? 'prod-box-roqan-125'
          : presetId === 'family_6'
            ? 'prod-box-family-250'
            : 'prod-royal-mix-1',
      productName: `${presetName} — تصميمك الخاص`,
      productImage: getSafeImageUrl(slots[0]?.productImage || '/images/products/royal-mix.jpg'),
      weightId: presetId,
      weightLabel: `${slotsCount} خانات (~${totalWeightGrams} جم)`,
      roastOption: 'تشكيلة فاخرة',
      unitPrice: protectedPrice,
      quantity,
      isPartitionedBox: true,
      partitionedBoxSize: presetId,
      partitionedSlots: slots,
      boxPresetId: presetId,
      boxSlotsCount: slotsCount,
      boxSlots: slots,
      customBreakdown: breakdown,
    };

    setCart((prev) => [...prev, newCartItem]);
    trackPixelEvent('AddToCart', `${presetName} (${slotsCount} خانات) - ${protectedPrice} ج.م`);
    showToast(
      `تم اعتماد وإضافة "${presetName}" للسلة! 🎁`,
      `${slotsCount} خانات مختارة على ذوقك • ${protectedPrice} ج.م`,
      true
    );
  };

  const addCoffeeBlendToCart = (
    spec: CustomCoffeeBlendSpec,
    unitPrice: number,
    quantity = 1
  ) => {
    const weightLabel = spec.weightLabel || `${spec.weightGrams} جم`;
    const cartItemId = `coffee-blend-${spec.weightGrams}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newCartItem: CartItem = {
      cartItemId,
      productId: 'prod-hafsa-turkish-coffee-1',
      productName: spec.customBlendName
        ? `توليفة "${spec.customBlendName}" الخاصة (${weightLabel})`
        : `توليفة قهوة حفصة الخاصة (${weightLabel})`,
      productImage: '/images/products/hazelnut.jpg',
      weightId: `w-${spec.weightGrams}`,
      weightLabel,
      roastOption: `${spec.roastLevel} • ${spec.spicing}`,
      unitPrice,
      quantity,
      workerNotes: spec.baristaLabel,
      isCoffeeBlend: true,
      coffeeBlendSpec: spec,
    };

    setCart((prev) => [...prev, newCartItem]);
    trackPixelEvent('AddToCart', `توليفة قهوة (${weightLabel}) - ${unitPrice * quantity} ج.م`);
    showToast(
      `تم تجهيز ملصق الباريستا وإضافة توليفتك للسلة! ☕`,
      `${spec.roastLevel} • ${spec.spicing} • ${unitPrice} ج.م`,
      true
    );
  };

  const addFlashPromoToCart = (
    promoOrId: FlashPromotion | string,
    title?: string,
    promoPrice?: number,
    image?: string
  ) => {
    let promoId = '';
    let promoTitle = '';
    let finalPrice = 0;
    let promoImg = '/images/products/royal-mix.jpg';
    let workerNotes = 'عرض الشريك الرابع الترويجي';

    if (typeof promoOrId === 'string') {
      promoId = promoOrId;
      promoTitle = title || 'باقة عرض حفصة الترويجي';
      finalPrice = Number(promoPrice) || 199;
      promoImg = getSafeImageUrl(image);
    } else {
      promoId = promoOrId.id;
      promoTitle = promoOrId.title;
      finalPrice = promoOrId.promoPrice;
      promoImg = getSafeImageUrl(promoOrId.image);
      if (promoOrId.items && promoOrId.items.length > 0) {
        workerNotes = `محتويات العرض: ${promoOrId.items
          .map((i) => `${i.productName} (${i.weightLabel}) × ${i.quantity}`)
          .join(' + ')}`;
      } else if (promoOrId.bundleItemsSummary) {
        workerNotes = `محتويات العرض: ${promoOrId.bundleItemsSummary}`;
      }
    }

    const cartItemId = `flash-promo-${promoId}`;

    setCart((prev) => {
      const existing = prev.findIndex((i) => i.cartItemId === cartItemId);
      if (existing > -1) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId,
          productId: promoId,
          productName: `🔥 ${promoTitle}`,
          productImage: promoImg,
          weightId: promoId,
          weightLabel: 'باقة عرض الشريك الرابع',
          roastOption: 'تشكيلة فاخرة',
          unitPrice: finalPrice,
          quantity: 1,
          workerNotes,
        },
      ];
    });
    trackPixelEvent('AddToCart', `عرض خاطف: ${promoTitle} - ${finalPrice} ج.م`);
    showToast(`تمت إضافة "${promoTitle}" للسلة! 🔥`, `سعر العرض: ${finalPrice} ج.م`, true);
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (appliedCoupon && cartSubtotal < appliedCoupon.minOrderAmount) {
      const code = appliedCoupon.code;
      const minAmount = appliedCoupon.minOrderAmount;
      setAppliedCoupon(null);
      showToast(
        `تم إلغاء كود الخصم (${code})`,
        `قيمة السلة (${cartSubtotal} ج.م) أقل من الحد الأدنى للكوبون (${minAmount} ج.م)`
      );
    }
  }, [cartSubtotal, appliedCoupon, showToast]);

  const applyCouponCode = (code: string): { success: boolean; message: string } => {
    if (!storeData) return { success: false, message: 'جاري تحميل البيانات...' };
    const cleanCode = code.trim().toUpperCase();
    const coupon = storeData.coupons.find(
      (c) => c.code.toUpperCase() === cleanCode && c.active
    );

    if (!coupon) {
      return { success: false, message: 'كود الخصم غير صحيح أو منتهي الصلاحية' };
    }

    if (cartSubtotal < coupon.minOrderAmount) {
      return {
        success: false,
        message: `الحد الأدنى لاستخدام هذا الكود هو ${coupon.minOrderAmount} ج.م`,
      };
    }

    setAppliedCoupon(coupon);
    showToast(`تم تفعيل كود الخصم ${coupon.code} بنجاح!`, coupon.description);
    return { success: true, message: `تم تطبيق الخصم: ${coupon.description}` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const discountAmount = React.useMemo(() => {
    if (!appliedCoupon) return 0;
    if (cartSubtotal < appliedCoupon.minOrderAmount) return 0;
    if (appliedCoupon.discountType === 'percentage') {
      return Math.round((cartSubtotal * appliedCoupon.value) / 100);
    }
    return Math.min(appliedCoupon.value, cartSubtotal);
  }, [appliedCoupon, cartSubtotal]);

  return (
    <StoreContext.Provider
      value={{
        storeData,
        loading,
        isLoading: loading,
        refreshStore,
        themeConfig,
        setThemeOverride,
        cart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        addCustomBoxToCart,
        addPartitionedBoxToCart,
        addCoffeeBlendToCart,
        addFlashPromoToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartSubtotal,
        cartCount,
        appliedCoupon,
        applyCouponCode,
        removeCoupon,
        discountAmount,
        activeVipPhone,
        setActiveVipPhone,
        activeVipMember,
        useVipWalletInCheckout,
        setUseVipWalletInCheckout,
        selectedProductModal,
        setSelectedProductModal,
        toasts,
        showToast,
        trackPixelEvent,
        pixelEvents,
      }}
    >
      {children}
      {/* Floating Toast Notifications */}
      <div className="fixed bottom-16 lg:bottom-4 left-3.5 z-[100] flex flex-col gap-1.5 max-w-[290px] w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[#231710] text-white px-3 py-2.5 rounded-xl shadow-xl border border-[#D4AF37]/50 flex items-center justify-between gap-2"
          >
            <div>
              <p className="font-bold text-xs text-[#D4AF37]">{toast.title}</p>
              {toast.subtitle && (
                <p className="text-[11px] text-[#FAF6F0]/90 mt-0.5 font-tajawal">{toast.subtitle}</p>
              )}
            </div>
            {toast.showCartButton && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="text-[11px] bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-extrabold px-2.5 py-1.5 rounded-lg shrink-0 transition"
              >
                عرض السلة
              </button>
            )}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
