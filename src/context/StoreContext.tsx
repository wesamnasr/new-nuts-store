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
} from '@/types/store';
import { getResolvedThemeConfig, getSafeImageUrl, STORE_THEMES } from '@/lib/defaults';

interface ToastMessage {
  id: string;
  title: string;
  subtitle?: string;
  showCartButton?: boolean;
}

interface StoreContextType {
  storeData: DatabaseSchema | null;
  loading: boolean;
  refreshStore: () => Promise<void>;
  themeConfig: StoreThemeConfig;
  setThemeOverride: (override: Partial<StoreThemeConfig> | null) => void;
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, weight: WeightVariant, roast: RoastOption, quantity?: number) => void;
  addCustomBoxToCart: (
    boxSizeGrams: 500 | 1000 | 2000,
    breakdown: CustomMixItem[],
    totalPrice: number
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
  selectedProductModal: Product | null;
  setSelectedProductModal: (product: Product | null) => void;
  toasts: ToastMessage[];
  showToast: (title: string, subtitle?: string, showCartButton?: boolean) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'new_nuts_cart_v1';
const THEME_OVERRIDE_KEY = 'new_nuts_theme_override_v1';
export const STORE_SYNC_STORAGE_KEY = 'new_nuts_store_sync_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [storeData, setStoreData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [selectedProductModal, setSelectedProductModal] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [themeOverrideState, setThemeOverrideState] = useState<Partial<StoreThemeConfig> | null>(null);

  const showToast = useCallback((title: string, subtitle?: string, showCartButton = false) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, subtitle, showCartButton }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const refreshStore = useCallback(async () => {
    try {
      const res = await fetch('/api/store', { cache: 'no-store' });
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
      // Remove any leftover sessionStorage theme override so admin database theme always applies
      sessionStorage.removeItem(THEME_OVERRIDE_KEY);
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
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

  const setThemeOverride = useCallback((override: Partial<StoreThemeConfig> | null) => {
    setThemeOverrideState((prev) => {
      if (override === null) {
        try {
          sessionStorage.removeItem(THEME_OVERRIDE_KEY);
        } catch {}
        return null;
      }
      // If themeId changed without explicit layout props, pull defaults for that themeId
      let merged: Partial<StoreThemeConfig> = { ...(prev || {}), ...override };
      if (override.themeId && !override.heroLayout && !override.navbarStyle && !override.cardStyle && !override.borderRadius) {
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
    roast: RoastOption,
    quantity = 1
  ) => {
    const cartItemId = `${product.id}-${weight.id}-${roast}`;
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
        },
      ];
    });
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
    showToast(
      `تمت إضافة العلبة المشكلة (${sizeLabel}) إلى السلة`,
      `${breakdown.length} أصناف • ${totalPrice} ج.م`,
      true
    );
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

  // Auto-invalidate coupon if subtotal drops below coupon threshold
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
        refreshStore,
        themeConfig,
        setThemeOverride,
        cart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        addCustomBoxToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartSubtotal,
        cartCount,
        appliedCoupon,
        applyCouponCode,
        removeCoupon,
        discountAmount,
        selectedProductModal,
        setSelectedProductModal,
        toasts,
        showToast,
      }}
    >
      {children}
      {/* Floating Toast Notifications */}
      <div className="fixed bottom-3.5 left-3.5 z-[100] flex flex-col gap-1 max-w-[260px] w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-brand-950 text-white px-2.5 py-2 rounded-xl shadow-lg border border-gold-500/40 flex items-center justify-between gap-2"
          >
            <div>
              <p className="font-bold text-[11px] text-gold-400">{toast.title}</p>
              {toast.subtitle && (
                <p className="text-[10px] text-brand-100 mt-0.5">{toast.subtitle}</p>
              )}
            </div>
            {toast.showCartButton && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="text-[10px] bg-gold-500 hover:bg-gold-600 text-brand-950 font-bold px-2 py-1 rounded-lg shrink-0 transition"
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
