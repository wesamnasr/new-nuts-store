import fs from 'fs';
import os from 'os';
import path from 'path';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { DatabaseSchema } from '@/types/store';
import {
  getResolvedPageContent,
  getResolvedThemeConfig,
  getSafeImageUrl,
} from '@/lib/defaults';
import seedJson from '../../data/store-db.json';

const DB_PATH = path.join(process.cwd(), 'data', 'store-db.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'new-nuts-store-db.json');

declare global {
  // eslint-disable-next-line no-var
  var __newNutsMemoryDb: DatabaseSchema | undefined;
  // eslint-disable-next-line no-var
  var __newNutsTableReady: boolean | undefined;
}

function getPostgresUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_URL ||
    undefined
  );
}

export const initialDatabase: DatabaseSchema =
  seedJson as unknown as DatabaseSchema;

function normalizeDatabase(parsed: DatabaseSchema): DatabaseSchema {
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
      customerUsername: parsed.settings?.customerUsername || 'customer_buyer',
      customerPassword: parsed.settings?.customerPassword || 'Cust#Buy2026',
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
        customerUsername: parsed.settings.customerUsername || 'customer_buyer',
        customerPassword: parsed.settings.customerPassword || 'Cust#Buy2026',
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
    if (!parsed.settings.customerUsername || parsed.settings.customerUsername === 'customer') {
      parsed.settings.customerUsername = 'customer_buyer';
    }
    if (!parsed.settings.customerPassword || parsed.settings.customerPassword === 'customer') {
      parsed.settings.customerPassword = 'Cust#Buy2026';
    }
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
  if (!Array.isArray(parsed.posShifts) || parsed.posShifts.length === 0) {
    parsed.posShifts = structuredClone(initialDatabase.posShifts || []);
  }
  if (!Array.isArray(parsed.posExpenses)) {
    parsed.posExpenses = structuredClone(initialDatabase.posExpenses || []);
  }

  if (Array.isArray(parsed.orders)) {
    for (const order of parsed.orders) {
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

async function ensurePostgresTable(
  sql: NeonQueryFunction<false, false>
): Promise<void> {
  if (globalThis.__newNutsTableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS store_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  globalThis.__newNutsTableReady = true;
}

export async function getDbAsync(): Promise<DatabaseSchema> {
  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return getDb();
  }

  try {
    const sql = neon(pgUrl);
    await ensurePostgresTable(sql);

    const rows = await sql`SELECT data FROM store_state WHERE id = 'main' LIMIT 1`;
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

      if (!hadCanonical) {
        const serialized = JSON.stringify(normalized);
        await sql`
          INSERT INTO store_state (id, data, updated_at)
          VALUES ('main', ${serialized}::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data,
              updated_at = NOW()
        `;
      }
      return normalized;
    }

    const seed = ensureDbFile();
    const serialized = JSON.stringify(seed);
    await sql`
      INSERT INTO store_state (id, data, updated_at)
      VALUES ('main', ${serialized}::jsonb, NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    globalThis.__newNutsMemoryDb = seed;
    return seed;
  } catch (err) {
    console.error('Neon Postgres read error, falling back to local/tmp DB:', err);
    return getDb();
  }
}

export async function saveDbAsync(data: DatabaseSchema): Promise<void> {
  const normalized = normalizeDatabase(data);
  saveDb(normalized);

  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return;
  }

  try {
    const sql = neon(pgUrl);
    await ensurePostgresTable(sql);
    const serialized = JSON.stringify(normalized);
    await sql`
      INSERT INTO store_state (id, data, updated_at)
      VALUES ('main', ${serialized}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data,
          updated_at = NOW()
    `;
  } catch (err) {
    console.error('Failed to persist store state to Neon Postgres:', err);
  }
}
