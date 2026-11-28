'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/context/StoreContext';
import { getResolvedThemeConfig, STORE_THEMES } from '@/lib/defaults';

const OPERATIONAL_ROUTE_PREFIXES = [
  '/admin',
  '/pos',
  '/cashier',
  '/supplier',
  '/accountant',
  '/rider',
];

function isOperationalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return OPERATIONAL_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * White-Label Multi-Theme & Compact Operational Density Controller (MizanPOS Blueprint)
 * Dynamically synchronizes StoreSettings.themeConfig (light/dark presets + border radius)
 * and enforces the practical 80% compact operational density across all ERP/POS staff screens
 * on both Web and Desktop while leaving customer storefront pages untouched.
 */
export default function ThemeController() {
  const { storeData } = useStore();
  const pathname = usePathname();
  const themeConfig = getResolvedThemeConfig(storeData?.settings);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const preset = STORE_THEMES.find((t) => t.id === themeConfig.themeId) || STORE_THEMES[0];
    const mode = preset?.isDark ? 'dark' : 'light';

    root.setAttribute('data-theme', themeConfig.themeId);
    root.setAttribute('data-mode', mode);
    root.setAttribute('data-radius', themeConfig.borderRadius || 'rounded');
  }, [themeConfig.themeId, themeConfig.borderRadius]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isOperationalPath(pathname)) {
      root.setAttribute('data-ops-density', 'compact');
    } else {
      root.removeAttribute('data-ops-density');
    }
  }, [pathname]);

  return null;
}
