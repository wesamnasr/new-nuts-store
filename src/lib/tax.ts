import { CartItem, Order, Product, StoreSettings } from '@/types/store';

export interface OrderTaxBreakdown {
  taxEnabled: boolean;
  taxRatePercent: number;
  taxInclusive: boolean;
  taxableAmount: number;
  exemptAmount: number;
  taxAmount: number;
  totalAddition: number; // 0 when inclusive, +taxAmount when exclusive
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Computes optional Egyptian VAT (default 14%) respecting per-product `taxExempt`
 * and `taxPricingMode` ('inclusive' vs 'exclusive').
 * Returns 0 tax when `settings.enableTax` is false/off.
 */
export function calculateOrderTaxBreakdown(
  items: CartItem[],
  products: Product[],
  discountAmount: number,
  settings?: StoreSettings
): OrderTaxBreakdown {
  if (!settings?.enableTax) {
    return {
      taxEnabled: false,
      taxRatePercent: 0,
      taxInclusive: true,
      taxableAmount: 0,
      exemptAmount: 0,
      taxAmount: 0,
      totalAddition: 0,
    };
  }

  const rate =
    typeof settings.taxRatePercent === 'number' && settings.taxRatePercent >= 0
      ? settings.taxRatePercent
      : 14;
  const taxInclusive = settings.taxPricingMode !== 'exclusive';
  const productMap = new Map((products || []).map((p) => [p.id, p]));

  let rawTaxable = 0;
  let rawExempt = 0;

  for (const item of items || []) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const lineTotal = Math.max(0, Number(item.unitPrice) || 0) * qty;
    const prod = productMap.get(item.productId);
    if (prod?.taxExempt) {
      rawExempt += lineTotal;
    } else {
      rawTaxable += lineTotal;
    }
  }

  const grossItems = rawTaxable + rawExempt;
  const safeDiscount = Math.max(0, Math.min(grossItems, Number(discountAmount) || 0));
  const taxableShare = grossItems > 0 ? rawTaxable / grossItems : 0;
  const netTaxable = Math.max(0, round2(rawTaxable - safeDiscount * taxableShare));
  const netExempt = Math.max(0, round2(rawExempt - safeDiscount * (1 - taxableShare)));

  if (rate <= 0 || netTaxable <= 0) {
    return {
      taxEnabled: true,
      taxRatePercent: rate,
      taxInclusive,
      taxableAmount: netTaxable,
      exemptAmount: netExempt,
      taxAmount: 0,
      totalAddition: 0,
    };
  }

  if (taxInclusive) {
    // Shelf price already includes VAT: VAT = Gross * (r / (100 + r))
    const taxAmount = round2((netTaxable * rate) / (100 + rate));
    return {
      taxEnabled: true,
      taxRatePercent: rate,
      taxInclusive: true,
      taxableAmount: round2(netTaxable - taxAmount),
      exemptAmount: netExempt,
      taxAmount,
      totalAddition: 0,
    };
  }

  // Exclusive mode: VAT is added on top of net taxable items
  const taxAmount = round2((netTaxable * rate) / 100);
  return {
    taxEnabled: true,
    taxRatePercent: rate,
    taxInclusive: false,
    taxableAmount: netTaxable,
    exemptAmount: netExempt,
    taxAmount,
    totalAddition: taxAmount,
  };
}

/**
 * Generates an ETA E-Receipt compatible UUID fingerprint for tax receipts.
 */
export function generateEtaReceiptUuid(
  orderNumber: string,
  taxRegistrationNumber: string | undefined,
  total: number,
  createdAtIso: string
): string {
  const seed = `${taxRegistrationNumber || '000000000'}|${orderNumber}|${total.toFixed(2)}|${createdAtIso}`;
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hexA = (h1 >>> 0).toString(16).padStart(8, '0');
  const hexB = (h2 >>> 0).toString(16).padStart(8, '0');
  const tsHex = Date.now().toString(16).slice(-12).padStart(12, '0');
  return `${hexA}-${hexB.slice(0, 4)}-4${hexB.slice(5, 8)}-a${tsHex.slice(0, 3)}-${tsHex}`;
}

function encodeTlvField(tag: number, value: string): number[] {
  const encoder = new TextEncoder();
  const bytes = Array.from(encoder.encode(value));
  return [tag, Math.min(255, bytes.length), ...bytes.slice(0, 255)];
}

/**
 * Encodes a standard TLV Base64 tax receipt QR string (Seller, RIN, Timestamp, Total, VAT, UUID)
 * compatible with Egyptian e-receipt & Middle East fiscal scanners.
 */
export function buildTaxReceiptQrValue(order: Order, settings?: StoreSettings): string {
  if (!settings?.enableTax) {
    return order.orderNumber;
  }
  const seller = settings.storeName || 'محمصة حفصة للبن والمكسرات';
  const rin = (settings.taxRegistrationNumber || '000-000-000').replace(/\s+/g, '');
  const timestamp = order.createdAt || new Date().toISOString();
  const totalStr = (Number(order.total) || 0).toFixed(2);
  const vatStr = (Number(order.taxAmount) || 0).toFixed(2);
  const uuid = order.etaReceiptUuid || order.orderNumber;

  const tlvBytes = [
    ...encodeTlvField(1, seller),
    ...encodeTlvField(2, rin),
    ...encodeTlvField(3, timestamp),
    ...encodeTlvField(4, totalStr),
    ...encodeTlvField(5, vatStr),
    ...encodeTlvField(6, uuid),
  ];

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(Uint8Array.from(tlvBytes)).toString('base64');
  }
  let binary = '';
  for (const b of tlvBytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
