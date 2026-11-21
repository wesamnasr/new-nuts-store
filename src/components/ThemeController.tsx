'use client';

import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { getResolvedThemeConfig, STORE_THEMES } from '@/lib/defaults';

/**
 * White-Label Multi-Theme Controller (MizanPOS Blueprint)
 * Dynamically synchronizes StoreSettings.themeConfig (4 light/dark presets + border radius)
 * to document.documentElement attributes in real time.
 */
export default function ThemeController() {
  const { storeData } = useStore();
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

  return null;
}
