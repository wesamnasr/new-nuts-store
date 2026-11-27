'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/context/StoreContext';

const STAFF_PREFIXES = ['/admin', '/pos', '/cashier', '/supplier', '/accountant', '/rider'];

function isStaffPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return STAFF_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isValidMetaPixelId(id: string): boolean {
  return /^\d{5,25}$/.test(id.trim());
}

function isValidTiktokPixelId(id: string): boolean {
  return /^[A-Za-z0-9_-]{6,40}$/.test(id.trim());
}

export function readBrowserCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Dynamically injects official Meta Pixel (fbevents.js) and TikTok Pixel scripts
 * configured in Admin Settings (or NEXT_PUBLIC_* env vars) strictly on public storefront routes.
 */
export default function MarketingPixels() {
  const { storeData } = useStore();
  const pathname = usePathname();
  const initializedMetaIdRef = useRef<string | null>(null);
  const initializedTiktokIdRef = useRef<string | null>(null);
  const lastTrackedPathRef = useRef<string | null>(null);

  const metaPixelId = (
    storeData?.settings?.metaPixelId ||
    process.env.NEXT_PUBLIC_META_PIXEL_ID ||
    ''
  ).trim();

  const tiktokPixelId = (
    storeData?.settings?.tiktokPixelId ||
    process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ||
    ''
  ).trim();

  const staffRoute = isStaffPath(pathname);

  // 1. Initialize Meta Pixel once
  useEffect(() => {
    if (staffRoute || typeof window === 'undefined') return;
    if (!isValidMetaPixelId(metaPixelId)) return;
    if (initializedMetaIdRef.current === metaPixelId) return;

    const w = window as any;
    if (!w.fbq) {
      const fbqFn: any = function (...args: any[]) {
        if (fbqFn.callMethod) {
          fbqFn.callMethod.apply(fbqFn, args);
        } else {
          fbqFn.queue.push(args);
        }
      };
      if (!w._fbq) w._fbq = fbqFn;
      fbqFn.push = fbqFn;
      fbqFn.loaded = true;
      fbqFn.version = '2.0';
      fbqFn.queue = [];
      w.fbq = fbqFn;

      if (!document.getElementById('hafsa-meta-pixel-script')) {
        const script = document.createElement('script');
        script.id = 'hafsa-meta-pixel-script';
        script.async = true;
        script.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(script);
      }
    }

    try {
      w.fbq('init', metaPixelId);
      w.fbq('track', 'PageView');
      initializedMetaIdRef.current = metaPixelId;
      lastTrackedPathRef.current = pathname || '/';
    } catch {
      // Ignore pixel init errors in restricted browsers
    }
  }, [metaPixelId, staffRoute, pathname]);

  // 2. Initialize TikTok Pixel once
  useEffect(() => {
    if (staffRoute || typeof window === 'undefined') return;
    if (!isValidTiktokPixelId(tiktokPixelId)) return;
    if (initializedTiktokIdRef.current === tiktokPixelId) return;

    const w = window as any;
    try {
      if (!w.ttq) {
        w.TiktokAnalyticsObject = 'ttq';
        const ttq: any = (w.ttq = w.ttq || []);
        ttq.methods = [
          'page',
          'track',
          'identify',
          'instances',
          'debug',
          'on',
          'off',
          'once',
          'ready',
          'alias',
          'group',
          'enableCookie',
          'disableCookie',
        ];
        ttq.setAndDefer = function (target: any, method: string) {
          target[method] = function (...args: any[]) {
            target.push([method, ...args]);
          };
        };
        for (let i = 0; i < ttq.methods.length; i++) {
          ttq.setAndDefer(ttq, ttq.methods[i]);
        }
        ttq.load = function (pixelCode: string) {
          const base = 'https://analytics.tiktok.com/i18n/pixel/events.js';
          ttq._i = ttq._i || {};
          ttq._i[pixelCode] = [];
          ttq._i[pixelCode]._u = base;
          ttq._t = ttq._t || {};
          ttq._t[pixelCode] = Date.now();
          ttq._o = ttq._o || {};
          ttq._o[pixelCode] = {};
          if (!document.getElementById('hafsa-tiktok-pixel-script')) {
            const script = document.createElement('script');
            script.id = 'hafsa-tiktok-pixel-script';
            script.type = 'text/javascript';
            script.async = true;
            script.src = `${base}?sdkid=${encodeURIComponent(pixelCode)}&lib=ttq`;
            document.head.appendChild(script);
          }
        };
      }
      w.ttq.load(tiktokPixelId);
      w.ttq.page();
      initializedTiktokIdRef.current = tiktokPixelId;
    } catch {
      // Ignore TikTok pixel init errors
    }
  }, [tiktokPixelId, staffRoute]);

  // 3. Track PageView on client-side SPA navigations
  useEffect(() => {
    if (staffRoute || typeof window === 'undefined') return;
    if (!pathname || lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;

    const w = window as any;
    try {
      if (initializedMetaIdRef.current && typeof w.fbq === 'function') {
        w.fbq('track', 'PageView');
      }
      if (initializedTiktokIdRef.current && typeof w.ttq?.page === 'function') {
        w.ttq.page();
      }
    } catch {
      // Ignore SPA pixel tracking errors
    }
  }, [pathname, staffRoute]);

  return null;
}
