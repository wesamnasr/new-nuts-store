import { Order } from '@/types/store';

/**
 * 17 Standard Arabic column headers for orders export, compliant with
 * Requirement R2 and E2E verification test suites.
 */
export const CSV_ORDER_HEADERS = [
  'رقم الطلب',
  'تاريخ الطلب',
  'اسم العميل',
  'رقم الهاتف',
  'هاتف بديل',
  'المحافظة',
  'العنوان',
  'الأصناف المطلوبة',
  'المجموع الفرعي',
  'تكلفة الشحن',
  'قيمة الخصم',
  'كود الخصم',
  'الإجمالي النهائي',
  'طريقة الدفع',
  'المرجع للدفع',
  'حالة الطلب',
  'ملاحظات',
] as const;

/**
 * Escapes and sanitizes a CSV cell value in compliance with:
 * 1. RFC 4180: Double quote escaping (" -> "") and wrapping in quotes.
 * 2. CWE-1236: CSV / Excel Formula Injection neutralization.
 *    Any string starting with =, +, -, @, \t, or \r (or whitespace followed by those)
 *    has a single quote (') prepended before wrapping in double quotes.
 * 3. Preserves legitimate numbers (e.g. subtotal, shippingCost, total) without single-quote prefix.
 * 4. Preserves Arabic text and multiline strings (replaces CRLF with spaces).
 */
export function escapeCsvField(val: unknown): string {
  if (val === undefined || val === null) {
    return '""';
  }

  // Preserve primitive finite numbers directly without formula prefixing
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `"${val}"`;
  }

  // Convert to string, escape quotes per RFC 4180, flatten newlines to spaces
  let str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');

  // Neutralize CSV Formula Injection (CWE-1236)
  // Check for leading formula triggers: =, +, -, @, \t, \r (including leading whitespace)
  if (/^\s*[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  return `"${str}"`;
}

/**
 * Generates an Excel-compatible CSV export string of orders with:
 * - UTF-8 BOM (\uFEFF) for native Arabic character rendering in Excel
 * - Exactly 17 Arabic column headers
 * - Full constituent recipe breakdown for Custom Mix Boxes:
 *   علبة مخصصة [سعة]جم [صنف (تحميص - نسبة%) + ...] × الكمية
 * - RFC 4180 CRLF (\r\n) line terminators
 *
 * This module has ZERO server-only dependencies (no Node fs/path/crypto),
 * making it 100% safe to import in client components (such as src/app/admin/page.tsx)
 * without triggering Webpack bundling errors.
 */
export function generateOrdersCsv(orders: Order[]): string {
  const BOM = '\uFEFF';

  const rows = (orders || []).map((order) => {
    const itemsSummary = (order.items || [])
      .map((item) => {
        if (item.isCustomMix && item.customBreakdown) {
          const breakdownStr = item.customBreakdown
            .map((b) => `${b.productName} (${b.roastOption} - ${b.percentage}%)`)
            .join(' + ');
          return `علبة مخصصة ${item.boxCapacityGrams || 1000}جم [${breakdownStr}] × ${item.quantity}`;
        }
        if (item.isPartitionedBox && item.partitionedSlots) {
          const slotsStr = item.partitionedSlots
            .map((s) => `خانة ${s.slotIndex}: ${s.productName} (${s.roastOption})`)
            .join(' + ');
          return `${item.productName} [${slotsStr}] × ${item.quantity}`;
        }
        if (item.isCoffeeBlend && item.coffeeBlendSpec) {
          return `${item.productName} [${item.coffeeBlendSpec.baristaLabel}] × ${item.quantity}`;
        }
        const notesSuffix = item.workerNotes ? ` [ملاحظة للعامل: ${item.workerNotes}]` : '';
        return `${item.productName} (${item.weightLabel || ''} - ${item.roastOption || ''})${notesSuffix} × ${item.quantity}`;
      })
      .join(' | ');

    return [
      escapeCsvField(order.orderNumber),
      escapeCsvField(order.createdAt),
      escapeCsvField(order.customerName),
      escapeCsvField(order.customerPhone),
      escapeCsvField(order.customerAltPhone || ''),
      escapeCsvField(order.governorate),
      escapeCsvField(order.address),
      escapeCsvField(itemsSummary),
      escapeCsvField(order.subtotal),
      escapeCsvField(order.shippingCost),
      escapeCsvField(order.discountAmount),
      escapeCsvField(order.couponCode || ''),
      escapeCsvField(order.total),
      escapeCsvField(order.paymentMethod),
      escapeCsvField(order.paymentReference || ''),
      escapeCsvField(order.status),
      escapeCsvField(order.notes || ''),
    ].join(',');
  });

  return BOM + [CSV_ORDER_HEADERS.map(escapeCsvField).join(','), ...rows].join('\r\n');
}
