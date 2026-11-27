'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { URL_SYNC_CUSTOM_EVENT } from '@/lib/url-sync';

const AD_UTM_SOURCE_REGEX = /^(fb|facebook|ig|instagram|meta|tiktok|snap|influencer|ad)$/i;
const AD_UTM_MEDIUM_REGEX = /^(cpc|paid|paid_social|social|video|ad|reel)$/i;

/**
 * Determines whether a product URL represents paid-ad or distraction-free landing mode
 * (?ad=1, fbclid, ttclid, gclid, paid utm_source/utm_medium) without touching server searchParams.
 */
export function isAdLandingUrl(pathname: string | null | undefined, search: string): boolean {
  if (!pathname?.startsWith('/product/')) {
    return false;
  }

  const params = new URLSearchParams(search || '');
  const adFlag = (params.get('ad') || '').trim().toLowerCase();
  const modeFlag = (params.get('mode') || '').trim().toLowerCase();

  // Explicit escape hatch back to full storefront mode
  if (adFlag === '0' || modeFlag === 'store') {
    return false;
  }

  if (
    adFlag === '1' ||
    adFlag === 'true' ||
    modeFlag === 'ad' ||
    modeFlag === 'landing' ||
    params.has('fbclid') ||
    params.has('ttclid') ||
    params.has('gclid')
  ) {
    return true;
  }

  const utmSource = (params.get('utm_source') || '').trim();
  const utmMedium = (params.get('utm_medium') || '').trim();
  if (AD_UTM_SOURCE_REGEX.test(utmSource) || AD_UTM_MEDIUM_REGEX.test(utmMedium)) {
    return true;
  }

  return false;
}

/**
 * Client hook synced with popstate & custom URL sync events while preserving SSR hydration safety.
 */
export function useAdLandingMode(): boolean {
  const pathname = usePathname();
  const [isAdMode, setIsAdMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncMode = () => {
      setIsAdMode(isAdLandingUrl(pathname, window.location.search));
    };

    syncMode();
    window.addEventListener('popstate', syncMode);
    window.addEventListener(URL_SYNC_CUSTOM_EVENT, syncMode);
    return () => {
      window.removeEventListener('popstate', syncMode);
      window.removeEventListener(URL_SYNC_CUSTOM_EVENT, syncMode);
    };
  }, [pathname]);

  return isAdMode;
}

/**
 * Builds a clean ad-landing URL with ?ad=1 and optional promo coupon code.
 */
export function buildAdLandingUrl(slugOrId: string, couponCode?: string, origin?: string): string {
  const cleanSlug = encodeURIComponent((slugOrId || '').trim());
  const params = new URLSearchParams({ ad: '1' });
  if (couponCode?.trim()) {
    params.set('coupon', couponCode.trim().toUpperCase());
  }
  const relative = `/product/${cleanSlug}?${params.toString()}`;
  if (origin?.trim()) {
    return `${origin.replace(/\/+$/, '')}${relative}`;
  }
  return relative;
}
