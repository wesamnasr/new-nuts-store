import crypto from 'crypto';
import {
  AdminPermissionId,
  AdminRole,
  DatabaseSchema,
  NonAdminStaffRole,
  RolePermissionsConfig,
  StaffAccount,
  StaffAccountPublic,
  StoreSettings,
  SystemRole,
} from '@/types/store';
import { getDb } from '@/lib/db';
import {
  computeSettingsFingerprint,
  hashPasswordScrypt,
  verifyPasswordConstantTime,
} from '@/lib/password-hash';
import {
  ALL_DASHBOARD_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DASHBOARD_PERMISSION_META,
  getResolvedRolePermissions,
  hasRolePermission,
  getAllowedRolesForPermission,
  getEffectiveRolePermissions,
} from '@/lib/permissions';

export {
  ALL_DASHBOARD_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DASHBOARD_PERMISSION_META,
  getResolvedRolePermissions,
  hasRolePermission,
  getAllowedRolesForPermission,
  getEffectiveRolePermissions,
  hashPasswordScrypt,
  verifyPasswordConstantTime,
  computeSettingsFingerprint,
};

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SECRET_SALT = process.env.ADMIN_JWT_SECRET || 'golden-oasis-admin-secret-salt-v1';

export interface StaffTokenMeta {
  staffId?: string;
  username?: string;
  displayName?: string;
}

export interface AdminTokenPayload {
  expiresAt: number;
  sig: string;
  role?: AdminRole;
  staffId?: string;
  username?: string;
  displayName?: string;
}

export const ROLE_LABELS_AR: Record<SystemRole, string> = {
  super_admin: 'الأدمن (المدير العام)',
  admin: 'الأدمن (المدير العام)',
  supplier: 'المورد (إدارة التوريد والمخزون)',
  cashier: 'الكاشير (نقطة البيع وتجهيز الطلبات)',
  accountant: 'المحاسب (المراجعة المالية والورديات)',
  delivery_rider: 'مندوب التوصيل (البندر ودورات القرى)',
};

/**
 * Strip sensitive hash/fingerprint fields before returning a StaffAccount to clients.
 */
export function toPublicStaffAccount(acc: StaffAccount): StaffAccountPublic {
  const { passwordHash: _ph, settingsFingerprint: _fp, ...safe } = acc;
  return safe;
}

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
    case 'delivery_rider':
      return settings?.riderUsername || 'rider_delivery';
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
    case 'delivery_rider':
      return settings?.riderPassword || 'Rider#Hafsa2026';
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
    role === 'delivery_rider'
  ) {
    return role;
  }
  return 'super_admin';
}

/**
 * Generate a cryptographically signed session token.
 * Supports:
 * - 1-arg legacy call: generateAdminToken(password)
 * - 2-arg role-isolated call: generateAdminToken(password, role)
 * - 3-arg multi-staff call: generateAdminToken(passwordHash, role, { staffId, username, displayName })
 */
export function generateAdminToken(
  password: string,
  role?: AdminRole,
  staffMeta?: StaffTokenMeta
): {
  token: string;
  expiresAt: number;
  role: AdminRole;
  staffId?: string;
  username?: string;
  displayName?: string;
} {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const resolvedRole = normalizeAdminRole(role);

  if (role === undefined && !staffMeta) {
    const payload = `${expiresAt}:${password}:${SECRET_SALT}`;
    const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
    const token = Buffer.from(JSON.stringify({ expiresAt, sig })).toString('base64url');
    return { token, expiresAt, role: resolvedRole };
  }

  if (staffMeta && (staffMeta.staffId || staffMeta.username)) {
    const staffId = staffMeta.staffId || '';
    const username = staffMeta.username || '';
    const displayName = staffMeta.displayName || username;
    const payload = `${expiresAt}:${resolvedRole}:${staffId}:${username}:${password}:${SECRET_SALT}`;
    const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
    const token = Buffer.from(
      JSON.stringify({
        expiresAt,
        sig,
        role: resolvedRole,
        staffId: staffId || undefined,
        username: username || undefined,
        displayName: displayName || undefined,
      })
    ).toString('base64url');
    return {
      token,
      expiresAt,
      role: resolvedRole,
      staffId: staffId || undefined,
      username: username || undefined,
      displayName: displayName || undefined,
    };
  }

  const payload = `${expiresAt}:${resolvedRole}:${password}:${SECRET_SALT}`;
  const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
  const token = Buffer.from(
    JSON.stringify({ expiresAt, sig, role: resolvedRole })
  ).toString('base64url');
  return { token, expiresAt, role: resolvedRole };
}

/**
 * Verify whether a provided token is a valid, unexpired, active session token.
 * Multi-staff tokens are verified against live `db.staffAccounts` so account deactivation,
 * deletion, role modification, or password rotation immediately revokes active tokens.
 */
export function verifyAdminToken(token: string, currentPassword?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (!trimmed) return false;

  try {
    const raw = Buffer.from(trimmed, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as AdminTokenPayload;
    if (!parsed || typeof parsed.expiresAt !== 'number' || typeof parsed.sig !== 'string') {
      return false;
    }

    if (Date.now() > parsed.expiresAt) {
      return false; // Token expired
    }

    const tokenRole: AdminRole | undefined = parsed.role
      ? normalizeAdminRole(parsed.role)
      : undefined;

    if (parsed.staffId || parsed.username) {
      const db = getDb();
      const staffList = Array.isArray(db.staffAccounts) ? db.staffAccounts : [];
      const account = staffList.find((acc) => {
        if (parsed.staffId && acc.id === parsed.staffId) return true;
        if (
          parsed.username &&
          acc.username.toLowerCase() === String(parsed.username).toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      if (!account || account.active === false) {
        return false;
      }

      const resolvedRole = tokenRole || normalizeAdminRole(account.role);
      if (normalizeAdminRole(account.role) !== resolvedRole) {
        return false;
      }

      const secret = currentPassword || account.passwordHash;
      const expectedPayload = `${parsed.expiresAt}:${resolvedRole}:${parsed.staffId || ''}:${parsed.username || ''}:${secret}:${SECRET_SALT}`;
      const expectedSig = crypto
        .createHmac('sha256', SECRET_SALT)
        .update(expectedPayload)
        .digest('hex');

      if (parsed.sig.length !== expectedSig.length) {
        return false;
      }
      return crypto.timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expectedSig));
    }

    const db = getDb();
    const password =
      currentPassword ||
      getRolePasswordFromSettings(db.settings, tokenRole);

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
 * Extract full staff metadata (role, staffId, username, displayName) from a verified token.
 */
export function extractTokenStaffMeta(token: string | null | undefined): {
  role: AdminRole;
  staffId?: string;
  username?: string;
  displayName?: string;
} {
  if (!token || typeof token !== 'string') {
    return { role: 'super_admin' };
  }
  try {
    const raw = Buffer.from(token.trim(), 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as AdminTokenPayload;
    const role = normalizeAdminRole(parsed?.role);
    const db = getDb();
    const staffList = Array.isArray(db.staffAccounts) ? db.staffAccounts : [];

    if (parsed?.staffId || parsed?.username) {
      const liveAccount = staffList.find(
        (acc) =>
          (parsed.staffId && acc.id === parsed.staffId) ||
          (parsed.username &&
            acc.username.toLowerCase() === String(parsed.username).toLowerCase())
      );
      return {
        role: liveAccount ? normalizeAdminRole(liveAccount.role) : role,
        staffId: liveAccount?.id || parsed.staffId,
        username: liveAccount?.username || parsed.username,
        displayName: liveAccount?.displayName || parsed.displayName || parsed.username,
      };
    }

    const fallbackUsername = getRoleUsernameFromSettings(db.settings, role);
    const primaryAcc = staffList.find(
      (acc) => acc.isPrimary && normalizeAdminRole(acc.role) === role
    );
    return {
      role,
      staffId: primaryAcc?.id,
      username: primaryAcc?.username || fallbackUsername,
      displayName: primaryAcc?.displayName || ROLE_LABELS_AR[role],
    };
  } catch {
    return { role: 'super_admin' };
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
): {
  isAuthenticated: boolean;
  role?: AdminRole;
  staffId?: string;
  username?: string;
  displayName?: string;
  statusCode?: number;
  error?: string;
} {
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

  const meta = extractTokenStaffMeta(token);
  const role = meta.role;

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const normalizedAllowed = new Set(allowedRoles.map((r) => normalizeAdminRole(r)));
    if (!normalizedAllowed.has(role)) {
      return {
        isAuthenticated: false,
        role,
        staffId: meta.staffId,
        username: meta.username,
        displayName: meta.displayName,
        statusCode: 403,
        error: `عزل الأدوار: الدور الحالي (${ROLE_LABELS_AR[role]}) غير مصرح له بهذا الإجراء (403 Forbidden)`,
      };
    }
  }

  return {
    isAuthenticated: true,
    role,
    staffId: meta.staffId,
    username: meta.username,
    displayName: meta.displayName,
    statusCode: 200,
  };
}

/**
 * Remove all sensitive password fields from StoreSettings.
 */
export function stripAllPasswords(settings: StoreSettings): StoreSettings {
  const sanitizedSettings = { ...settings } as Record<string, unknown>;
  delete sanitizedSettings.adminUsername;
  delete sanitizedSettings.adminPassword;
  delete sanitizedSettings.supplierUsername;
  delete sanitizedSettings.supplierPassword;
  delete sanitizedSettings.cashierUsername;
  delete sanitizedSettings.cashierPassword;
  delete sanitizedSettings.accountantUsername;
  delete sanitizedSettings.accountantPassword;
  delete sanitizedSettings.riderUsername;
  delete sanitizedSettings.riderPassword;
  delete sanitizedSettings.customerUsername;
  delete sanitizedSettings.customerPassword;
  delete sanitizedSettings.managerPassword;
  delete sanitizedSettings.promoPartnerPassword;
  return sanitizedSettings as unknown as StoreSettings;
}

/**
 * Helper to sanitize public store data for unauthenticated visitors / public storefront.
 * Strips all role passwords, staff accounts, wholesale costs, net profits, POS shifts/expenses, VIP member lists, and customer orders.
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
    staffAccounts: [], // Staff directory hidden from public
  };
}

/**
 * Role-isolated store data projection for staff roles and unauthenticated public storefront:
 * 1. super_admin / admin: Full access to all store data, costs, profits, orders, shifts, settings & public staff directory (passwordHash stripped)
 * 2. supplier: Access to products (including wholesale costPerKg, packagingCost, inStock, origin) & categories; isolated from customer orders, POS shifts/expenses, VIP members, and coupons (unless granted by Admin in rolePermissions)
 * 3. cashier: Access to POS products (retail prices only, NO costPerKg), active orders & POS shifts (NO wholesale rawCostTotal or netProfitEgp), and VIP lookup (unless granted by Admin in rolePermissions)
 * 4. accountant: Access to all financial records (orders, products with costs & margins, POS shifts, POS expenses, coupons, VIP liabilities), but no role passwords or staff management directory
 * 5. delivery_rider: Strictly isolated from financials, shifts, VIP directory & supply invoices
 */
export function sanitizeStoreDataForRole(
  db: DatabaseSchema,
  role: SystemRole
): DatabaseSchema {
  if ((role as string) === 'customer') {
    return sanitizePublicStoreData(db);
  }

  const normalized = normalizeAdminRole(role);

  // Role 1: Admin / Super Admin -> Full access (strip scrypt passwordHash from staffAccounts JSON)
  if (normalized === 'super_admin') {
    return {
      ...db,
      staffAccounts: Array.isArray(db.staffAccounts)
        ? db.staffAccounts.map((acc) => toPublicStaffAccount(acc)) as unknown as StaffAccount[]
        : [],
    };
  }

  const safeSettings = stripAllPasswords(db.settings);

  // Role 2: Supplier (المورد) -> Supply & Inventory by default, dynamically adaptable via rolePermissions
  if (normalized === 'supplier') {
    const canSeeOrders =
      hasRolePermission('supplier', 'orders', db.settings) ||
      hasRolePermission('supplier', 'accounting_portal', db.settings) ||
      hasRolePermission('supplier', 'cashier_portal', db.settings) ||
      hasRolePermission('supplier', 'overview', db.settings);
    const canSeePosAndVip =
      hasRolePermission('supplier', 'accounting_portal', db.settings) ||
      hasRolePermission('supplier', 'cashier_portal', db.settings) ||
      hasRolePermission('supplier', 'operations', db.settings) ||
      hasRolePermission('supplier', 'overview', db.settings);
    const canSeeCoupons =
      hasRolePermission('supplier', 'coupons', db.settings) ||
      hasRolePermission('supplier', 'accounting_portal', db.settings) ||
      hasRolePermission('supplier', 'cashier_portal', db.settings) ||
      hasRolePermission('supplier', 'overview', db.settings);

    return {
      ...db,
      settings: safeSettings,
      orders: canSeeOrders ? db.orders : [],
      posShifts: canSeePosAndVip ? db.posShifts : [],
      posExpenses: canSeePosAndVip ? db.posExpenses : [],
      vipMembers: canSeePosAndVip ? db.vipMembers : [],
      coupons: canSeeCoupons ? db.coupons : [],
      staffAccounts: [],
    };
  }

  // Role 3: Cashier (الكاشير) -> POS & Order Fulfillment by default, dynamically adaptable via rolePermissions
  if (normalized === 'cashier') {
    const canSeeWholesaleAndProfit =
      normalized === 'cashier' &&
      (hasRolePermission('cashier', 'supply_portal', db.settings) ||
        hasRolePermission('cashier', 'accounting_portal', db.settings) ||
        hasRolePermission('cashier', 'overview', db.settings) ||
        hasRolePermission('cashier', 'products', db.settings));

    const canSeeSupplyInvoices =
      normalized === 'cashier' &&
      (hasRolePermission('cashier', 'supply_invoices', db.settings) ||
        hasRolePermission('cashier', 'supply_portal', db.settings) ||
        hasRolePermission('cashier', 'accounting_portal', db.settings) ||
        hasRolePermission('cashier', 'overview', db.settings));

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
      products: canSeeWholesaleAndProfit ? db.products : productsWithoutWholesaleCost,
      orders: canSeeWholesaleAndProfit ? db.orders : ordersWithoutProfit,
      posShifts: canSeeWholesaleAndProfit ? db.posShifts : shiftsWithoutProfit,
      promotions: canSeeWholesaleAndProfit ? db.promotions : promosWithoutProfit,
      supplyInvoices: canSeeSupplyInvoices ? db.supplyInvoices : [],
      staffAccounts: [],
    };
  }

  // Role 4: Accountant (المحاسب) -> Full Financial, Cost, Profit, Orders, Shifts & Expenses Audit (passwords stripped)
  if (normalized === 'accountant') {
    return {
      ...db,
      settings: safeSettings,
      staffAccounts: [],
    };
  }

  // Role 5: Delivery Rider fallback (strictly isolated from financials, shifts, VIP directory & supply invoices)
  return {
    ...db,
    settings: safeSettings,
    orders: [],
    posShifts: [],
    posExpenses: [],
    vipMembers: [],
    supplyInvoices: [],
    staffAccounts: [],
  };
}

// Re-export CSV utilities from dedicated client-safe shared module
export { generateOrdersCsv, escapeCsvField } from '@/lib/csv';
