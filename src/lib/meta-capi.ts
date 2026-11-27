import crypto from 'crypto';
import type { Order, StoreSettings } from '@/types/store';

function sha256Normalized(value?: string | null): string | undefined {
  const clean = (value || '').trim().toLowerCase();
  if (!clean) return undefined;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

function normalizePhoneForMetaEgypt(rawPhone?: string | null): string | undefined {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('20') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `20${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('1')) return `20${digits}`;
  return digits;
}

export interface MetaCapiContext {
  eventId?: string;
  eventSourceUrl?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
}

export interface MetaCapiResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Dispatches a server-side Meta Conversions API (CAPI) `Purchase` event
 * deduplicated against browser `fbq('track', 'Purchase', ..., { eventID })`.
 * Strictly non-blocking with a short timeout so checkout is never delayed.
 */
export async function sendMetaCapiPurchase(
  settings: StoreSettings | undefined | null,
  order: Order,
  ctx: MetaCapiContext = {}
): Promise<MetaCapiResult> {
  const pixelId = (
    settings?.metaPixelId ||
    process.env.NEXT_PUBLIC_META_PIXEL_ID ||
    ''
  ).trim();
  const accessToken = (
    settings?.metaCapiAccessToken ||
    process.env.META_CAPI_ACCESS_TOKEN ||
    ''
  ).trim();

  if (!pixelId || !accessToken) {
    return {
      success: false,
      skipped: true,
      error: 'Meta Pixel ID or CAPI access token not configured',
    };
  }

  const nameParts = (order.customerName || '').trim().split(/\s+/).filter(Boolean);
  const firstNameHash = sha256Normalized(nameParts[0]);
  const lastNameHash = nameParts.length > 1 ? sha256Normalized(nameParts.slice(1).join(' ')) : undefined;
  const phoneHash = sha256Normalized(normalizePhoneForMetaEgypt(order.customerPhone));
  const cityHash = sha256Normalized(order.governorate);
  const countryHash = sha256Normalized('eg');

  const userData: Record<string, unknown> = {
    ...(phoneHash ? { ph: [phoneHash] } : {}),
    ...(firstNameHash ? { fn: [firstNameHash] } : {}),
    ...(lastNameHash ? { ln: [lastNameHash] } : {}),
    ...(cityHash ? { ct: [cityHash] } : {}),
    ...(countryHash ? { country: [countryHash] } : {}),
    ...(ctx.clientIpAddress ? { client_ip_address: ctx.clientIpAddress } : {}),
    ...(ctx.clientUserAgent ? { client_user_agent: ctx.clientUserAgent } : {}),
    ...(ctx.fbp ? { fbp: ctx.fbp } : {}),
    ...(ctx.fbc ? { fbc: ctx.fbc } : {}),
  };

  const contentIds = Array.from(
    new Set((order.items || []).map((i) => i.productId).filter(Boolean))
  );
  const numItems = (order.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);

  const eventPayload: Record<string, unknown> = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: ctx.eventId || order.metaEventId || order.orderNumber,
    action_source: 'website',
    ...(ctx.eventSourceUrl ? { event_source_url: ctx.eventSourceUrl } : {}),
    user_data: userData,
    custom_data: {
      currency: 'EGP',
      value: Number(order.total) || 0,
      content_type: 'product',
      content_ids: contentIds,
      num_items: numItems,
      order_id: order.orderNumber,
      contents: (order.items || []).map((item) => ({
        id: item.productId,
        quantity: item.quantity || 1,
        item_price: item.unitPrice,
      })),
    },
  };

  const testEventCode = (
    settings?.metaCapiTestEventCode ||
    process.env.META_CAPI_TEST_EVENT_CODE ||
    ''
  ).trim();

  const body: Record<string, unknown> = {
    data: [eventPayload],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Meta CAPI HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    return { success: true };
  } catch (err: any) {
    clearTimeout(timer);
    return { success: false, error: err?.message || 'Meta CAPI network error' };
  }
}
