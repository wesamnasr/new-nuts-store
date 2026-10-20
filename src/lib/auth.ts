import crypto from 'crypto';
import { AdminRole, DatabaseSchema, StoreSettings, SystemRole } from '@/types/store';
import { getDb } from '@/lib/db';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SECRET_SALT = process.env.ADMIN_JWT_SECRET || 'golden-oasis-admin-secret-salt-v1';

export interface AdminTokenPayload {
  expiresAt: number;
  sig: string;
  role?: AdminRole;
}

export const ROLE_LABELS_AR: Record<SystemRole, string> = {
  super_admin: 'الأدمن (المدير العام)',
  admin: 'الأدمن (المدير العام)',
  supplier: 'المورد (إدارة التوريد والمخزون)',
  cashier: 'الكاشير (نقطة البيع وتجهيز الطلبات)',
  accountant: 'المحاسب (المراجعة المالية والورديات)',
  store_manager: 'مدير التشغيل والطلبات',
  promo_partner: 'شريك العروض والتسويق',
};

/**
 * Resolve the configured username for a specific role from StoreSettings.
 */
export function getRoleUsernameFromSettings(
  settings: StoreSettings | undefined,
  role?: SystemRole
): string {
  switch (role) {
    case 'supplier':
      return settings?.supplierUsername || 'supplier_arafat';
    case 'cashier':
      return settings?.cashierUsername || 'cashier_pos';
    case 'accountant':
      return settings?.accountantUsername || 'accountant_fin';
    case 'store_manager':
      return 'manager';
    case 'promo_partner':
      return 'promo';
    case 'admin':
    case 'super_admin':
    default:
      return settings?.adminUsername || 'admin_hafsa';
  }
}

/**
 * Resolve the configured password for a specific role from StoreSettings.
 */
export function getRolePasswordFromSettings(
  settings: StoreSettings | undefined,
  role?: SystemRole
): string {
  switch (role) {
    case 'supplier':
      return settings?.supplierPassword || 'Sup#Arafat2026';
    case 'cashier':
      return settings?.cashierPassword || 'Cash#Pos2026';
    case 'accountant':
      return settings?.accountantPassword || 'Acc#Fin2026';
    case 'store_manager':
      return settings?.managerPassword || 'manager';
    case 'promo_partner':
      return settings?.promoPartnerPassword || 'promo';
    case 'admin':
    case 'super_admin':
    default:
      return settings?.adminPassword || 'Hafsa@Admin2026';
  }
}

/**
 * Normalize role aliases ('admin' -> 'super_admin') for consistent checks.
 */
export function normalizeAdminRole(role?: AdminRole | string | null): AdminRole {
  if (
    role === 'supplier' ||
    role === 'cashier' ||
    role === 'accountant' ||
    role === 'store_manager' ||
    role === 'promo_partner'
  ) {
    return role;
  }
  return 'super_admin';
}

/**
 * Generate a cryptographically signed session token.
 * Valid for 24 hours and verified against the role's password in StoreSettings.
 * When called with 1 argument (password), preserves legacy payload format for backwards compatibility.
 */
export function generateAdminToken(
  password: string,
  role?: AdminRole
): { token: string; expiresAt: number; role: AdminRole } {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const resolvedRole = normalizeAdminRole(role);

  if (role === undefined) {
    const payload = `${expiresAt}:${password}:${SECRET_SALT}`;
    const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
    const token = Buffer.from(JSON.stringify({ expiresAt, sig })).toString('base64url');
    return { token, expiresAt, role: resolvedRole };
  }

  const payload = `${expiresAt}:${resolvedRole}:${password}:${SECRET_SALT}`;
  const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
  const token = Buffer.from(
    JSON.stringify({ expiresAt, sig, role: resolvedRole })
  ).toString('base64url');
  return { token, expiresAt, role: resolvedRole };
}

/**
 * Verify whether a provided token is a valid, unexpired session token.
 */
export function verifyAdminToken(token: string, currentPassword?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (!trimmed) return false;

  try {
    const raw = Buffer.from(trimmed, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expiresAt !== 'number' || typeof parsed.sig !== 'string') {
      return false;
    }

    if (Date.now() > parsed.expiresAt) {
      return false; // Token expired
    }

    const tokenRole: AdminRole | undefined = parsed.role
      ? normalizeAdminRole(parsed.role)
      : undefined;

    const password =
      currentPassword ||
      getRolePasswordFromSettings(getDb().settings, tokenRole);

    const expectedPayload = tokenRole
      ? `${parsed.expiresAt}:${tokenRole}:${password}:${SECRET_SALT}`
      : `${parsed.expiresAt}:${password}:${SECRET_SALT}`;

    const expectedSig = crypto
      .createHmac('sha256', SECRET_SALT)
      .update(expectedPayload)
      .digest('hex');

    if (parsed.sig.length !== expectedSig.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

/**
 * Extract the authenticated role from a verified token (defaults to 'super_admin').
 */
export function extractTokenRole(token: string | null | undefined): AdminRole {
  if (!token || typeof token !== 'string') return 'super_admin';
  try {
    const raw = Buffer.from(token.trim(), 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    return normalizeAdminRole(parsed?.role);
  } catch {
    return 'super_admin';
  }
}

/**
 * Extract admin token from request Authorization header, x-admin-token header, or admin_session cookie.
 */
export function extractAdminToken(req: Request): string | null {
  // 1. Authorization header: "Bearer <token>" or raw token
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    if (authHeader.trim() && !authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.trim();
    }
  }

  // 2. x-admin-token header
  const xAdminToken = req.headers.get('x-admin-token') || req.headers.get('X-Admin-Token');
  if (xAdminToken && xAdminToken.trim()) {
    return xAdminToken.trim();
  }

  // 3. NextRequest cookies or standard Cookie header
  if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
    const cookieVal = (req as any).cookies.get('admin_session')?.value;
    if (cookieVal) return String(cookieVal).trim();
  }

  const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].trim());
    }
  }

  return null;
}

/**
 * Verifies if an incoming HTTP request is authenticated and optionally checks if its role is in allowedRoles.
 */
export function verifyAdminRequest(
  req: Request,
  allowedRoles?: AdminRole[]
): { isAuthenticated: boolean; role?: AdminRole; statusCode?: number; error?: string } {
  const token = extractAdminToken(req);
  if (!token) {
    return {
      isAuthenticated: false,
      statusCode: 401,
      error: 'غير مصرح لك بالوصول (401 Unauthorized)',
    };
  }

  const isValid = verifyAdminToken(token);
  if (!isValid) {
    return {
      isAuthenticated: false,
      statusCode: 401,
      error: 'غير مصرح لك بالوصول (401 Unauthorized)',
    };
  }

  const role = extractTokenRole(token);

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const normalizedAllowed = new Set(allowedRoles.map((r) => normalizeAdminRole(r)));
    if (!normalizedAllowed.has(role)) {
      return {
        isAuthenticated: false,
        role,
        statusCode: 403,
        error: `عزل الأدوار: الدور الحالي (${ROLE_LABELS_AR[role]}) غير مصرح له بهذا الإجراء (403 Forbidden)`,
      };
    }
  }

  return { isAuthenticated: true, role, statusCode: 200 };
}

/**
 * Remove all sensitive password fields from StoreSettings.
 */
export function stripAllPasswords(settings: StoreSettings): StoreSettings {
  const sanitizedSettings = { ...settings };
  delete sanitizedSettings.adminUsername;
  delete sanitizedSettings.adminPassword;
  delete sanitizedSettings.supplierUsername;
  delete sanitizedSettings.supplierPassword;
  delete sanitizedSettings.cashierUsername;
  delete sanitizedSettings.cashierPassword;
  delete sanitizedSettings.accountantUsername;
  delete sanitizedSettings.accountantPassword;
  delete (sanitizedSettings as any).customerUsername;
  delete (sanitizedSettings as any).customerPassword;
  delete sanitizedSettings.managerPassword;
  delete sanitizedSettings.promoPartnerPassword;
  delete sanitizedSettings.wesamAdminPassword;
  return sanitizedSettings;
}

/**
 * Helper to sanitize public store data for unauthenticated visitors / public storefront.
 * Strips all role passwords, wholesale costs, net profits, POS shifts/expenses, VIP member lists, and customer orders.
 */
export function sanitizePublicStoreData(db: DatabaseSchema): DatabaseSchema {
  const sanitizedSettings = stripAllPasswords(db.settings);

  const sanitizedProducts = Array.isArray(db.products)
    ? db.products.map((p) => {
        const copy = { ...p };
        delete copy.costPerKg;
        delete copy.packagingCost;
        return copy;
      })
    : [];

  const sanitizedPromotions = Array.isArray(db.promotions)
    ? db.promotions.map((promo) => {
        const copy = { ...promo };
        delete copy.totalRawCost;
        delete copy.costPrice;
        delete copy.netProfitEgp;
        delete copy.profitMarginPercent;
        delete copy.packagingCost;
        if (Array.isArray(copy.items)) {
          copy.items = copy.items.map((item) => {
            const itemCopy = { ...item };
            delete (itemCopy as any).unitCost;
            return itemCopy;
          });
        }
        return copy;
      })
    : undefined;

  return {
    ...db,
    settings: sanitizedSettings,
    products: sanitizedProducts,
    ...(sanitizedPromotions !== undefined ? { promotions: sanitizedPromotions } : {}),
    orders: [], // Customer orders hidden from public
    posShifts: [], // POS shifts hidden from public
    posExpenses: [], // POS expenses hidden from public
    vipMembers: [], // Full VIP directory hidden from public (looked up via /api/vip by phone)
    supplyInvoices: [], // Supply invoices hidden from public
  };
}

/**
 * Role-isolated store data projection for the 4 staff roles and unauthenticated public storefront:
 * 1. super_admin / admin: Full access to all store data, costs, profits, orders, shifts, settings & role passwords
 * 2. supplier: Access to products (including wholesale costPerKg, packagingCost, inStock, origin) & categories; isolated from customer orders, POS shifts/expenses, VIP members, and coupons
 * 3. cashier: Access to POS products (retail prices only, NO costPerKg), active orders & POS shifts (NO wholesale rawCostTotal or netProfitEgp), and VIP lookup
 * 4. accountant: Access to all financial records (orders, products with costs & margins, POS shifts, POS expenses, coupons, VIP liabilities), but no role passwords
 * Public/Unauthenticated: Public storefront data only via sanitizePublicStoreData
 */
export function sanitizeStoreDataForRole(
  db: DatabaseSchema,
  role: SystemRole
): DatabaseSchema {
  if ((role as string) === 'customer') {
    return sanitizePublicStoreData(db);
  }

  const normalized = normalizeAdminRole(role);

  // Role 1: Admin / Super Admin -> Full unrestricted access
  if (normalized === 'super_admin') {
    return db;
  }

  const safeSettings = stripAllPasswords(db.settings);

  // Role 2: Supplier (المورد) -> Supply & Inventory only (wholesale costPerKg, packagingCost, inStock, categories)
  if (normalized === 'supplier') {
    return {
      ...db,
      settings: safeSettings,
      orders: [], // Supplier cannot see customer orders or phone numbers
      posShifts: [], // Supplier cannot see cashier shifts or drawer cash
      posExpenses: [], // Supplier cannot see store petty cash expenses
      vipMembers: [], // Supplier cannot see VIP customer wallets
      coupons: [], // Supplier cannot see marketing coupons
    };
  }

  // Role 3: Cashier (الكاشير) -> POS & Order Fulfillment only (strictly isolated from wholesale costPerKg & net profit)
  if (normalized === 'cashier' || normalized === 'store_manager') {
    const productsWithoutWholesaleCost = Array.isArray(db.products)
      ? db.products.map((p) => {
          const copy = { ...p };
          delete copy.costPerKg;
          delete copy.packagingCost;
          return copy;
        })
      : [];

    const ordersWithoutProfit = Array.isArray(db.orders)
      ? db.orders.map((ord) => {
          const copy = { ...ord };
          delete copy.rawCostTotal;
          delete copy.netProfitEgp;
          if (Array.isArray(copy.items)) {
            copy.items = copy.items.map((item) => {
              const itemCopy = { ...item };
              delete itemCopy.rawCostEgp;
              return itemCopy;
            });
          }
          return copy;
        })
      : [];

    const shiftsWithoutProfit = Array.isArray(db.posShifts)
      ? db.posShifts.map((s) => {
          const copy = { ...s };
          delete (copy as any).totalRawCost;
          delete (copy as any).totalNetProfit;
          return copy;
        })
      : [];

    const promosWithoutProfit = Array.isArray(db.promotions)
      ? db.promotions.map((promo) => {
          const copy = { ...promo };
          delete copy.totalRawCost;
          delete copy.costPrice;
          delete copy.netProfitEgp;
          delete copy.profitMarginPercent;
          return copy;
        })
      : [];

    return {
      ...db,
      settings: safeSettings,
      products: productsWithoutWholesaleCost,
      orders: ordersWithoutProfit,
      posShifts: shiftsWithoutProfit,
      promotions: promosWithoutProfit,
      supplyInvoices: [],
    };
  }

  // Role 4: Accountant (المحاسب) -> Full Financial, Cost, Profit, Orders, Shifts & Expenses Audit (passwords stripped)
  if (normalized === 'accountant') {
    return {
      ...db,
      settings: safeSettings,
    };
  }

  // Promo Partner fallback
  return {
    ...db,
    settings: safeSettings,
    orders: [],
    posShifts: [],
    posExpenses: [],
    vipMembers: [],
  };
}

// Re-export CSV utilities from dedicated client-safe shared module
export { generateOrdersCsv, escapeCsvField } from '@/lib/csv';

