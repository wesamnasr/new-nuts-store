'use client';

import { usePathname } from 'next/navigation';

/**
 * Returns true for any canonical /product/[slug] route so the clean,
 * distraction-free high-converting layout is the permanent default.
 */
export function isProductLandingPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/product/'));
}

/**
 * Synchronous client hook (zero hydration flash) identifying /product/* landing routes.
 */
export function useIsProductLanding(): boolean {
  const pathname = usePathname();
  return isProductLandingPath(pathname);
}

/**
 * Builds the canonical clean product landing URL with an optional coupon code.
 */
export function buildAdLandingUrl(
  slugOrId: string,
  couponCode?: string,
  origin?: string
): string {
  const cleanSlug = encodeURIComponent((slugOrId || '').trim());
  const params = new URLSearchParams();
  if (couponCode?.trim()) {
    params.set('coupon', couponCode.trim().toUpperCase());
  }
  const qs = params.toString();
  const relative = `/product/${cleanSlug}${qs ? `?${qs}` : ''}`;
  if (origin?.trim()) {
    return `${origin.replace(/\/+$/, '')}${relative}`;
  }
  return relative;
}
