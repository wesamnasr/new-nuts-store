import { Coupon } from '@/types/store';

/**
 * Normalizes Eastern Arabic (and Persian) digits to standard Western Arabic ASCII digits (0-9).
 */
export function normalizeArabicDigits(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  return str
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
}

export interface EgyptianPhoneValidationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Validates and normalizes Egyptian mobile phone numbers.
 * Supported networks: 010 (Vodafone), 011 (Etisalat), 012 (Orange), 015 (WE).
 * Supports prefixes (+20, 0020, 20), spaces, dashes, parentheses, and Eastern Arabic numerals.
 * Normalizes to standard 11-digit mobile format: 01[0125]XXXXXXXX.
 */
export function validateEgyptianPhone(phone: string): EgyptianPhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      normalized: '',
      error: 'يرجى إدخال رقم هاتف مصري يبدأ بـ (010، 011، 012، 015) ومكون من 11 رقماً',
    };
  }

  // Convert Arabic/Persian digits to standard ASCII digits
  const converted = normalizeArabicDigits(phone.trim());

  // Strip whitespace, hyphens, brackets, dots, underscores
  let cleaned = converted.replace(/[\s\-\(\)\.\_]/g, '');

  if (!cleaned) {
    return {
      isValid: false,
      normalized: '',
      error: 'يرجى إدخال رقم الهاتف',
    };
  }

  // Strip international prefix (+20, 0020, 20) if present
  let hadCountryCode = false;
  if (cleaned.startsWith('+20')) {
    cleaned = cleaned.slice(3);
    hadCountryCode = true;
  } else if (cleaned.startsWith('0020')) {
    cleaned = cleaned.slice(4);
    hadCountryCode = true;
  } else if (cleaned.startsWith('20') && cleaned.length >= 12) {
    cleaned = cleaned.slice(2);
    hadCountryCode = true;
  }

  // If preceded by country code and leading 0 was omitted (+2010... -> 10...), restore it
  if (hadCountryCode && !cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }

  // Domestic format must now match exactly 01[0125] followed by 8 digits (11 digits total)
  const match = cleaned.match(/^(01[0125]\d{8})$/);

  if (!match) {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'يرجى إدخال رقم هاتف مصري صحيح يبدأ بـ (010، 011، 012، 015) ومكون من 11 رقماً',
    };
  }

  return {
    isValid: true,
    normalized: match[1],
  };
}

/**
 * Formats a phone number for https://wa.me/<number> links.
 * Automatically prefixes Egyptian local mobile numbers (01XXXXXXXXX -> 201XXXXXXXXX)
 * and strips non-digits (+, spaces, dashes).
 */
export function formatWhatsAppPhone(phone?: string): string {
  if (!phone || typeof phone !== 'string') return '201000000000';
  const digits = normalizeArabicDigits(phone).replace(/\D/g, '');
  if (!digits) return '201000000000';
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `20${digits}`;
  }
  return digits;
}

export interface CouponValidationResult {
  isValid: boolean;
  discountAmount: number;
  error?: string;
}

/**
 * Validates a coupon against the cart subtotal and calculates discount.
 */
export function validateCoupon(
  coupon: Coupon | null | undefined,
  subtotal: number
): CouponValidationResult {
  if (!coupon) {
    return {
      isValid: false,
      discountAmount: 0,
      error: 'كود الخصم غير موجود',
    };
  }

  if (!coupon.active) {
    return {
      isValid: false,
      discountAmount: 0,
      error: 'كود الخصم غير مفعّل أو منتهي الصلاحية',
    };
  }

  const safeSubtotal = Math.max(0, Number(subtotal) || 0);

  if (safeSubtotal < coupon.minOrderAmount) {
    return {
      isValid: false,
      discountAmount: 0,
      error: `الحد الأدنى لاستخدام هذا الكود هو ${coupon.minOrderAmount} ج.م (قيمة مشترياتك الحالية: ${safeSubtotal} ج.م)`,
    };
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = Math.round((safeSubtotal * coupon.value) / 100);
  } else {
    discountAmount = Math.min(coupon.value, safeSubtotal);
  }

  return {
    isValid: true,
    discountAmount,
  };
}
