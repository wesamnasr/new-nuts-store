import crypto from 'crypto';
import { DatabaseSchema } from '@/types/store';
import { getDb } from '@/lib/db';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SECRET_SALT = process.env.ADMIN_JWT_SECRET || 'golden-oasis-admin-secret-salt-v1';

export interface AdminTokenPayload {
  expiresAt: number;
  sig: string;
}

/**
 * Generate a cryptographically signed admin session token.
 * Valid for 24 hours and verified against the store's admin password.
 */
export function generateAdminToken(password: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `${expiresAt}:${password}:${SECRET_SALT}`;
  const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
  const token = Buffer.from(JSON.stringify({ expiresAt, sig })).toString('base64url');
  return { token, expiresAt };
}

/**
 * Verify whether a provided token is a valid, unexpired admin session token.
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

    const password = currentPassword || getDb().settings?.adminPassword || 'admin';
    const expectedPayload = `${parsed.expiresAt}:${password}:${SECRET_SALT}`;
    const expectedSig = crypto.createHmac('sha256', SECRET_SALT).update(expectedPayload).digest('hex');

    if (parsed.sig.length !== expectedSig.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expectedSig));
  } catch {
    return false;
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
 * Verifies if an incoming HTTP request is authenticated as admin.
 */
export function verifyAdminRequest(req: Request): { isAuthenticated: boolean; error?: string } {
  const token = extractAdminToken(req);
  if (!token) {
    return {
      isAuthenticated: false,
      error: 'غير مصرح لك بالوصول (401 Unauthorized)',
    };
  }

  const isValid = verifyAdminToken(token);
  if (!isValid) {
    return {
      isAuthenticated: false,
      error: 'غير مصرح لك بالوصول (401 Unauthorized)',
    };
  }

  return { isAuthenticated: true };
}

/**
 * Helper to sanitize public store data for unauthenticated visitors.
 * Strips adminPassword and ensures customer orders are not leaked.
 */
export function sanitizePublicStoreData(db: DatabaseSchema): DatabaseSchema {
  const sanitizedSettings = { ...db.settings };
  delete sanitizedSettings.adminPassword;

  return {
    ...db,
    settings: sanitizedSettings,
    orders: [], // Customer orders hidden from public
  };
}

// Re-export CSV utilities from dedicated client-safe shared module
export { generateOrdersCsv, escapeCsvField } from '@/lib/csv';
