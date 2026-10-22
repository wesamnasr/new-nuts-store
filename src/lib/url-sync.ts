'use client';

import { useEffect, useRef } from 'react';

export const URL_SYNC_CUSTOM_EVENT = 'hafsa:urlchange';

/**
 * Updates URL search parameters in the browser address bar using history.pushState
 * or history.replaceState without triggering a full page reload or Next.js unmount,
 * and dispatches a custom event so all mounted components stay in sync.
 */
export function updateUrlQueryParams(
  updates: Record<string, string | number | boolean | null | undefined>,
  options: { replace?: boolean; basePath?: string } = {}
) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (options.basePath) {
      url.pathname = options.basePath;
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === false) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, String(value));
      }
    });

    const nextRelativeUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextRelativeUrl === currentRelativeUrl) return;

    if (options.replace) {
      window.history.replaceState(window.history.state, '', nextRelativeUrl);
    } else {
      window.history.pushState(window.history.state, '', nextRelativeUrl);
    }

    window.dispatchEvent(new CustomEvent(URL_SYNC_CUSTOM_EVENT));
  } catch (err) {
    console.error('Failed to update URL query params:', err);
  }
}

/**
 * Builds an href string by merging current searchParams with the given updates.
 */
export function buildUrlWithParams(
  basePath: string,
  updates: Record<string, string | number | boolean | null | undefined>,
  preserveExisting = false
): string {
  const params = new URLSearchParams(
    preserveExisting && typeof window !== 'undefined' ? window.location.search : ''
  );
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '' || value === false) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Hook that listens to browser Back/Forward (popstate) and custom URL updates,
 * invoking the callback with the current URLSearchParams and pathname.
 */
export function useBrowserUrlSync(
  onUrlChange: (params: URLSearchParams, pathname: string) => void
) {
  const callbackRef = useRef(onUrlChange);
  callbackRef.current = onUrlChange;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSync = () => {
      const params = new URLSearchParams(window.location.search);
      callbackRef.current(params, window.location.pathname);
    };

    // Run once on mount to initialize from current URL
    handleSync();

    window.addEventListener('popstate', handleSync);
    window.addEventListener(URL_SYNC_CUSTOM_EVENT, handleSync);
    return () => {
      window.removeEventListener('popstate', handleSync);
      window.removeEventListener(URL_SYNC_CUSTOM_EVENT, handleSync);
    };
  }, []);
}
