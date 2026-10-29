import fs from 'fs';
import os from 'os';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { AdminRole, DatabaseSchema, StaffAccount } from '@/types/store';
import {
  getResolvedPageContent,
  getResolvedThemeConfig,
  getSafeImageUrl,
} from '@/lib/defaults';
import {
  computeSettingsFingerprint,
  hashPasswordScrypt,
} from '@/lib/password-hash';
import {
  ensurePostgresSchema,
  executeAtomicPostgresTransaction,
  getPostgresUrl,
  inspectPostgresRelationalHealth,
  RELATIONAL_TABLES,
  syncAllRelationalTablesHttp,
} from '@/lib/postgres-schema';
import seedJson from '../../data/store-db.json';

export {
  getPostgresUrl,
  ensurePostgresSchema,
  inspectPostgresRelationalHealth,
  RELATIONAL_TABLES,
};

const DB_PATH = path.join(process.cwd(), 'data', 'store-db.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'new-nuts-store-db.json');

declare global {
  // eslint-disable-next-line no-var
  var __newNutsMemoryDb: DatabaseSchema | undefined;
  // eslint-disable-next-line no-var
  var __newNutsWriteMutex: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __newNutsPrimaryHashCache: Map<string, string> | undefined;
}

export const initialDatabase: DatabaseSchema =
  seedJson as unknown as DatabaseSchema;

function getCachedPrimaryScryptHash(role: AdminRole, rawPassword: string, fp: string): string {
  if (!globalThis.__newNutsPrimaryHashCache) {
    globalThis.__newNutsPrimaryHashCache = new Map<string, string>();
  }
  const key = `${role}:${fp}`;
  const cached = globalThis.__newNutsPrimaryHashCache.get(key);
  if (cached) return cached;
  const hashed = hashPasswordScrypt(rawPassword);
  globalThis.__newNutsPrimaryHashCache.set(key, hashed);
  return hashed;
}

function syncStaffAccounts(parsed: DatabaseSchema): void {
  const settings = parsed.settings;
  if (!settings) return;

  const existingList: StaffAccount[] = Array.isArray(parsed.staffAccounts)
    ? parsed.staffAccounts.filter((s) => Boolean(s && typeof s === 'object' && s.id && s.username))
    : [];

  const primaryDefinitions: Array<{
    id: string;
    role: AdminRole;
    username: string;
    rawPassword: string;
    defaultDisplayName: string;
  }> = [
    {
      id: 'staff-primary-super_admin',
      role: 'super_admin',
      username: settings.adminUsername || 'admin_hafsa',
      rawPassword: settings.adminPassword || 'Hafsa@Admin2026',
      defaultDisplayName: 'إدارة محمصة حفصة (المدير العام)',
    },
    {
      id: 'staff-primary-accountant',
      role: 'accountant',
      username: settings.accountantUsername || 'accountant_fin',
      rawPassword: settings.accountantPassword || 'Acc#Fin2026',
      defaultDisplayName: 'المحاسب المالي الرئيسي',
    },
    {
      id: 'staff-primary-cashier',
      role: 'cashier',
      username: settings.cashierUsername || 'cashier_pos',
      rawPassword: settings.cashierPassword || 'Cash#Pos2026',
      defaultDisplayName: 'كاشير صالة فرع بني مزار (أساسي)',
    },
    {
      id: 'staff-primary-supplier',
      role: 'supplier',
      username: settings.supplierUsername || 'supplier_arafat',
      rawPassword: settings.supplierPassword || 'Sup#Arafat2026',
      defaultDisplayName: 'مسؤول التوريد والمخزون الرئيسي',
    },
    {
      id: 'staff-primary-delivery_rider',
      role: 'delivery_rider',
      username: settings.riderUsername || 'rider_delivery',
      rawPassword: settings.riderPassword || 'Rider#Hafsa2026',
      defaultDisplayName: 'مندوب التوصيل الرئيسي (بني مزار)',
    },
  ];

  const nowIso = new Date().toISOString();
  const primaryIds = new Set(primaryDefinitions.map((d) => d.id));
  const nextAccounts: StaffAccount[] = [];
  const usedUsernames = new Set<string>();

  for (const def of primaryDefinitions) {
    const existing =
      existingList.find((acc) => acc.id === def.id) ||
      existingList.find((acc) => acc.isPrimary && acc.role === def.role);

    const fp = computeSettingsFingerprint(def.rawPassword);
    const hasReusableHash =
      existing &&
      existing.settingsFingerprint === fp &&
      typeof existing.passwordHash === 'string' &&
      existing.passwordHash.startsWith('scrypt$');

    const passwordHash = hasReusableHash
      ? existing.passwordHash
      : getCachedPrimaryScryptHash(def.role, def.rawPassword, fp);

    const normalizedUsername = def.username.trim();
    usedUsernames.add(normalizedUsername.toLowerCase());

    nextAccounts.push({
      id: def.id,
      username: normalizedUsername,
      passwordHash,
      role: def.role,
      displayName: existing?.displayName?.trim() || def.defaultDisplayName,
      phone: existing?.phone,
      active: existing?.active !== false,
      isPrimary: true,
      notes: existing?.notes,
      settingsFingerprint: fp,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: existing?.updatedAt || nowIso,
      lastLoginAt: existing?.lastLoginAt,
    });
  }

  for (const acc of existingList) {
    if (primaryIds.has(acc.id) || acc.isPrimary) continue;
    const uname = String(acc.username || '').trim();
    if (!uname || usedUsernames.has(uname.toLowerCase())) continue;
    usedUsernames.add(uname.toLowerCase());

    nextAccounts.push({
      ...acc,
      username: uname,
      passwordHash: hashPasswordScrypt(acc.passwordHash || 'Hafsa@Staff2026'),
      active: acc.active !== false,
      isPrimary: false,
      displayName: acc.displayName?.trim() || uname,
      createdAt: acc.createdAt || nowIso,
    });
  }

  parsed.staffAccounts = nextAccounts;
}

export function normalizeDatabase(parsed: DatabaseSchema): DatabaseSchema {
  const hasCanonicalCategories =
    Array.isArray(parsed.categories) &&
    parsed.categories.some((c) => c.id === 'cat-snacks') &&
    parsed.categories.some((c) => c.id === 'cat-coffee-espresso');

  if (!hasCanonicalCategories) {
    parsed.categories = structuredClone(initialDatabase.categories);
    parsed.products = structuredClone(initialDatabase.products);
    parsed.settings = {
      ...structuredClone(initialDatabase.settings),
      adminUsername: parsed.settings?.adminUsername || 'admin_hafsa',
      adminPassword: parsed.settings?.adminPassword || 'Hafsa@Admin2026',
      supplierUsername: parsed.settings?.supplierUsername || 'supplier_arafat',
      supplierPassword: parsed.settings?.supplierPassword || 'Sup#Arafat2026',
      cashierUsername: parsed.settings?.cashierUsername || 'cashier_pos',
      cashierPassword: parsed.settings?.cashierPassword || 'Cash#Pos2026',
      accountantUsername: parsed.settings?.accountantUsername || 'accountant_fin',
      accountantPassword: parsed.settings?.accountantPassword || 'Acc#Fin2026',
      riderUsername: parsed.settings?.riderUsername || 'rider_delivery',
      riderPassword: parsed.settings?.riderPassword || 'Rider#Hafsa2026',
    };
  }

  if (parsed.settings) {
    if (parsed.settings.storeName === 'محمصة الواحة الذهبية') {
      parsed.settings = {
        ...structuredClone(initialDatabase.settings),
        adminUsername: parsed.settings.adminUsername || 'admin_hafsa',
        adminPassword: parsed.settings.adminPassword || 'Hafsa@Admin2026',
        supplierUsername: parsed.settings.supplierUsername || 'supplier_arafat',
        supplierPassword: parsed.settings.supplierPassword || 'Sup#Arafat2026',
        cashierUsername: parsed.settings.cashierUsername || 'cashier_pos',
        cashierPassword: parsed.settings.cashierPassword || 'Cash#Pos2026',
        accountantUsername: parsed.settings.accountantUsername || 'accountant_fin',
        accountantPassword: parsed.settings.accountantPassword || 'Acc#Fin2026',
        riderUsername: parsed.settings.riderUsername || 'rider_delivery',
        riderPassword: parsed.settings.riderPassword || 'Rider#Hafsa2026',
      };
      parsed.categories = structuredClone(initialDatabase.categories);
      parsed.shippingRates = structuredClone(initialDatabase.shippingRates);
      parsed.coupons = structuredClone(initialDatabase.coupons);
    }
    parsed.settings.pageContent = getResolvedPageContent(parsed.settings);
    parsed.settings.themeConfig = getResolvedThemeConfig(parsed.settings);
    if (!parsed.settings.adminUsername || parsed.settings.adminUsername === 'admin') {
      parsed.settings.adminUsername = 'admin_hafsa';
    }
    if (!parsed.settings.adminPassword || parsed.settings.adminPassword === 'admin') {
      parsed.settings.adminPassword = 'Hafsa@Admin2026';
    }
    if (!parsed.settings.supplierUsername || parsed.settings.supplierUsername === 'supplier') {
      parsed.settings.supplierUsername = 'supplier_arafat';
    }
    if (!parsed.settings.supplierPassword || parsed.settings.supplierPassword === 'supplier') {
      parsed.settings.supplierPassword = 'Sup#Arafat2026';
    }
    if (!parsed.settings.cashierUsername || parsed.settings.cashierUsername === 'cashier') {
      parsed.settings.cashierUsername = 'cashier_pos';
    }
    if (!parsed.settings.cashierPassword || parsed.settings.cashierPassword === 'cashier') {
      parsed.settings.cashierPassword = 'Cash#Pos2026';
    }
    if (!parsed.settings.accountantUsername || parsed.settings.accountantUsername === 'accountant') {
      parsed.settings.accountantUsername = 'accountant_fin';
    }
    if (!parsed.settings.accountantPassword || parsed.settings.accountantPassword === 'accountant') {
      parsed.settings.accountantPassword = 'Acc#Fin2026';
    }
    if (!parsed.settings.riderUsername || parsed.settings.riderUsername === 'rider') {
      parsed.settings.riderUsername = 'rider_delivery';
    }
    if (!parsed.settings.riderPassword || parsed.settings.riderPassword === 'rider') {
      parsed.settings.riderPassword = 'Rider#Hafsa2026';
    }
    delete (parsed.settings as any).customerUsername;
    delete (parsed.settings as any).customerPassword;
    delete (parsed.settings as any).managerPassword;
    delete (parsed.settings as any).promoPartnerPassword;
    delete (parsed.settings as any).wesamAdminPassword;
    if (typeof parsed.settings.vipCashbackPercent !== 'number') {
      parsed.settings.vipCashbackPercent = 5;
    }
    if (typeof parsed.settings.vipMinOrderForCashback !== 'number') {
      parsed.settings.vipMinOrderForCashback = 150;
    }
    if (typeof parsed.settings.villageMinOrderAmount !== 'number') {
      parsed.settings.villageMinOrderAmount = 200;
    }
  }

  if (!Array.isArray(parsed.categories) || parsed.categories.length < 6) {
    parsed.categories = structuredClone(initialDatabase.categories);
  }

  if (!Array.isArray(parsed.products) || parsed.products.length < 20) {
    parsed.products = structuredClone(initialDatabase.products);
  }

  if (!Array.isArray(parsed.vipMembers) || parsed.vipMembers.length === 0) {
    parsed.vipMembers = structuredClone(initialDatabase.vipMembers || []);
  }
  if (!Array.isArray(parsed.promotions) || parsed.promotions.length === 0) {
    parsed.promotions = structuredClone(initialDatabase.promotions || []);
  }
  for (const promo of parsed.promotions) {
    if (promo.active !== false && promo.endsAt && Date.parse(promo.endsAt) < Date.now()) {
      promo.endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
  }
  if (!Array.isArray(parsed.flashPromotions) || parsed.flashPromotions.length === 0) {
    parsed.flashPromotions = structuredClone(parsed.promotions);
  } else {
    for (const promo of parsed.flashPromotions) {
      if (promo.active !== false && promo.endsAt && Date.parse(promo.endsAt) < Date.now()) {
        promo.endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    }
  }
  if (!Array.isArray(parsed.posShifts) || parsed.posShifts.length === 0) {
    parsed.posShifts = structuredClone(initialDatabase.posShifts || []);
  }
  if (!Array.isArray(parsed.posExpenses)) {
    parsed.posExpenses = structuredClone(initialDatabase.posExpenses || []);
  }
  if (!Array.isArray(parsed.supplyInvoices)) {
    parsed.supplyInvoices = structuredClone(initialDatabase.supplyInvoices || []);
  }

  if (Array.isArray(parsed.orders)) {
    for (const order of parsed.orders) {
      if ((order.status as string) === 'preparing') {
        order.status = 'roasting_packing';
      } else if (
        !order.status ||
        ![
          'pending',
          'confirmed',
          'roasting_packing',
          'shipped',
          'delivered',
          'cancelled',
        ].includes(order.status)
      ) {
        order.status = 'pending';
      }
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          item.productImage = getSafeImageUrl(item.productImage);
          if (Array.isArray(item.customBreakdown)) {
            for (const part of item.customBreakdown) {
              part.productImage = getSafeImageUrl(part.productImage);
            }
          }
        }
      }
    }
  }

  if (Array.isArray(parsed.products)) {
    for (const prod of parsed.products) {
      prod.image = getSafeImageUrl(prod.image);
      prod.showOnline = prod.showOnline !== false;
      prod.showInPos = prod.showInPos !== false;
      prod.stockKg = typeof prod.stockKg === 'number' ? prod.stockKg : 50;
      prod.packagingCost = typeof prod.packagingCost === 'number' ? prod.packagingCost : 5;
      if (typeof prod.inStock !== 'boolean') {
        prod.inStock = prod.stockKg > 0;
      }
      if (
        Array.isArray(prod.weights) &&
        !prod.weights.some((w) => (w.weightGrams || w.grams) === 125)
      ) {
        const w1000 = prod.weights.find(
          (w) => (w.weightGrams || w.grams) === 1000
        );
        const w250 = prod.weights.find(
          (w) => (w.weightGrams || w.grams) === 250
        );
        const w125Price = w1000
          ? Math.round(w1000.price * 0.125)
          : w250
            ? Math.round(w250.price * 0.5)
            : 50;
        prod.weights.unshift({
          id: 'w-125',
          label: 'ثمن كيلو (125 جم)',
          grams: 125,
          weightGrams: 125,
          price: w125Price,
        });
      }
    }
  }

  if (Array.isArray(parsed.categories)) {
    for (const cat of parsed.categories) {
      cat.image = getSafeImageUrl(cat.image);
    }
  }

  syncStaffAccounts(parsed);

  return parsed;
}

function ensureDbFile(): DatabaseSchema {
  try {
    if (getPostgresUrl() && globalThis.__newNutsMemoryDb) {
      globalThis.__newNutsMemoryDb = normalizeDatabase(globalThis.__newNutsMemoryDb);
      return globalThis.__newNutsMemoryDb;
    }

    if (process.env.VERCEL && fs.existsSync(TMP_DB_PATH)) {
      const rawTmp = fs.readFileSync(TMP_DB_PATH, 'utf-8');
      const parsedTmp = normalizeDatabase(
        JSON.parse(rawTmp) as DatabaseSchema
      );
      globalThis.__newNutsMemoryDb = parsedTmp;
      return parsedTmp;
    }

    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = normalizeDatabase(JSON.parse(raw) as DatabaseSchema);
      globalThis.__newNutsMemoryDb = parsed;
      return parsed;
    }

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(initialDatabase, null, 2),
      'utf-8'
    );
    return normalizeDatabase(structuredClone(initialDatabase));
  } catch (err) {
    if (globalThis.__newNutsMemoryDb) {
      return globalThis.__newNutsMemoryDb;
    }
    try {
      if (fs.existsSync(TMP_DB_PATH)) {
        const rawTmp = fs.readFileSync(TMP_DB_PATH, 'utf-8');
        return normalizeDatabase(JSON.parse(rawTmp) as DatabaseSchema);
      }
    } catch {
      // Ignore /tmp read error
    }
    console.error('Database read fallback to memory:', err);
    return normalizeDatabase(structuredClone(initialDatabase));
  }
}

export function getDb(): DatabaseSchema {
  return ensureDbFile();
}

export function saveDb(data: DatabaseSchema): void {
  const normalized = normalizeDatabase(data);
  globalThis.__newNutsMemoryDb = normalized;
  const serialized = JSON.stringify(normalized, null, 2);

  try {
    if (!process.env.VERCEL) {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, serialized, 'utf-8');
      return;
    }
  } catch {
    // Fall through to /tmp write on read-only filesystem
  }

  try {
    fs.writeFileSync(TMP_DB_PATH, serialized, 'utf-8');
  } catch (err) {
    console.error('Failed to write database file to /tmp:', err);
  }
}

function isErrorHttpResponse(val: unknown): boolean {
  if (typeof Response !== 'undefined' && val instanceof Response && val.status >= 400) {
    return true;
  }
  if (
    val &&
    typeof val === 'object' &&
    typeof (val as { status?: unknown }).status === 'number' &&
    ((val as { status: number }).status >= 400)
  ) {
    return true;
  }
  return false;
}

export async function getDbAsync(): Promise<DatabaseSchema> {
  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return getDb();
  }

  try {
    await ensurePostgresSchema();
    const sql = neon(pgUrl);

    const rows = await sql`
      SELECT
        data,
        version,
        (SELECT COUNT(*)::int FROM products) AS prod_count,
        (SELECT COUNT(*)::int FROM staff_accounts) AS staff_count
      FROM store_state
      WHERE id = 'main'
      LIMIT 1
    `;

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
      const parsed =
        typeof rows[0].data === 'string'
          ? (JSON.parse(rows[0].data) as DatabaseSchema)
          : (rows[0].data as DatabaseSchema);
      const hadCanonical =
        Array.isArray(parsed.categories) &&
        parsed.categories.some((c) => c.id === 'cat-snacks') &&
        Boolean(parsed.settings?.adminUsername) &&
        parsed.settings?.adminPassword !== 'admin';

      const normalized = normalizeDatabase(parsed);
      globalThis.__newNutsMemoryDb = normalized;

      const needsRelationalHydration =
        !hadCanonical ||
        Number(rows[0].prod_count) === 0 ||
        Number(rows[0].staff_count) === 0;

      if (needsRelationalHydration) {
        const currentVersion = Number(rows[0].version) || 1;
        await syncAllRelationalTablesHttp(pgUrl, normalized, currentVersion);
      }

      return normalized;
    }

    const seed = ensureDbFile();
    await syncAllRelationalTablesHttp(pgUrl, seed, 1);
    globalThis.__newNutsMemoryDb = seed;
    return seed;
  } catch (err) {
    console.error('Neon Postgres read error, falling back to local/tmp DB:', err);
    return getDb();
  }
}

async function persistDbUnlocked(data: DatabaseSchema): Promise<void> {
  const normalized = normalizeDatabase(data);
  saveDb(normalized);

  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return;
  }

  try {
    const sql = neon(pgUrl);
    await ensurePostgresSchema();
    const rows = await sql`SELECT version FROM store_state WHERE id = 'main' LIMIT 1`;
    const nextVersion = (Number(rows?.[0]?.version) || 0) + 1;
    await syncAllRelationalTablesHttp(pgUrl, normalized, nextVersion);
  } catch (err) {
    console.error('Failed to persist store state & relational tables to Neon Postgres:', err);
  }
}

export async function saveDbAsync(data: DatabaseSchema): Promise<void> {
  const previousLock = globalThis.__newNutsWriteMutex || Promise.resolve();
  const nextWrite = previousLock.catch(() => {}).then(async () => {
    await persistDbUnlocked(data);
  });
  globalThis.__newNutsWriteMutex = nextWrite;
  await nextWrite;
}

export async function withDbTransaction<T>(
  mutator: (db: DatabaseSchema) => Promise<T> | T
): Promise<T> {
  const previousLock = globalThis.__newNutsWriteMutex || Promise.resolve();
  let result!: T;

  const txPromise = previousLock.catch(() => {}).then(async () => {
    const pgUrl = getPostgresUrl();

    if (pgUrl) {
      try {
        const outcome = await executeAtomicPostgresTransaction<T>(
          pgUrl,
          normalizeDatabase,
          () => ensureDbFile(),
          mutator,
          isErrorHttpResponse
        );
        result = outcome.result;
        if (outcome.committedDb) {
          saveDb(outcome.committedDb);
        } else {
          globalThis.__newNutsMemoryDb = undefined;
        }
        return;
      } catch (err) {
        globalThis.__newNutsMemoryDb = undefined;
        throw err;
      }
    }

    // Local JSON atomic mutex transaction with full rollback on error/4xx/5xx
    const db = await getDbAsync();
    try {
      result = await mutator(db);
      if (!isErrorHttpResponse(result)) {
        await persistDbUnlocked(db);
      } else {
        globalThis.__newNutsMemoryDb = undefined;
      }
    } catch (err) {
      globalThis.__newNutsMemoryDb = undefined;
      throw err;
    }
  });

  globalThis.__newNutsWriteMutex = txPromise;
  await txPromise;
  return result;
}
