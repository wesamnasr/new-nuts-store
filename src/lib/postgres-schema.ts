import { neon, Pool, NeonQueryFunctionInTransaction } from '@neondatabase/serverless';
import type { DatabaseSchema } from '@/types/store';

export const RELATIONAL_TABLES = [
  'store_state',
  'staff_accounts',
  'categories',
  'products',
  'orders',
  'pos_shifts',
  'pos_expenses',
  'supply_invoices',
  'vip_members',
  'coupons',
  'inventory_adjustments',
  'pos_returns',
  'treasury_transactions',
  'audit_logs',
] as const;

declare global {
  // eslint-disable-next-line no-var
  var __newNutsRelationalSchemaReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __newNutsSchemaInitPromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __newNutsPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __newNutsPgPoolUrl: string | undefined;
}

export function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (code === '42P01' || code === '42703') return true;
  const msg = String((err as { message?: unknown }).message || '');
  return msg.includes('does not exist') || msg.includes('relation "');
}

export function getPostgresUrl(): string | undefined {
  if (process.env.HAFSA_LOCAL_DB_ONLY === '1') {
    return undefined;
  }
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_URL ||
    undefined
  );
}

/**
 * Per Neon Postgres architecture guidelines:
 * Use direct/unpooled connection string for schema DDL migrations when available,
 * and pooled (-pooler) connection string for normal serverless query/transaction traffic.
 */
export function getDirectPostgresUrl(): string | undefined {
  if (process.env.HAFSA_LOCAL_DB_ONLY === '1') {
    return undefined;
  }
  return (
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    getPostgresUrl()
  );
}

function getSharedNeonPool(pgUrl: string): Pool {
  if (globalThis.__newNutsPgPool && globalThis.__newNutsPgPoolUrl === pgUrl) {
    return globalThis.__newNutsPgPool;
  }
  if (globalThis.__newNutsPgPool) {
    globalThis.__newNutsPgPool.end().catch(() => {});
  }
  const pool = new Pool({
    connectionString: pgUrl,
    max: 4,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 1500,
  });
  pool.on('error', (err: Error) => {
    console.error('Neon Pool background error:', err?.message || err);
  });
  globalThis.__newNutsPgPool = pool;
  globalThis.__newNutsPgPoolUrl = pgUrl;
  return pool;
}

const SCHEMA_DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS store_state (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE store_state ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1`,
  `CREATE TABLE IF NOT EXISTS staff_accounts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_staff_role_active ON staff_accounts (role, active)`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price_per_kg NUMERIC(12, 2),
    cost_per_kg NUMERIC(12, 2),
    stock_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
    in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    show_online BOOLEAN NOT NULL DEFAULT TRUE,
    show_in_pos BOOLEAN NOT NULL DEFAULT TRUE,
    barcode TEXT,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_products_cat_stock ON products (category_id, in_stock)`,
  `CREATE INDEX IF NOT EXISTS idx_products_stock_kg ON products (stock_kg)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    order_source TEXT NOT NULL DEFAULT 'online',
    status TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    cashier_id TEXT,
    cashier_name TEXT,
    rider_id TEXT,
    rider_name TEXT,
    shift_id TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    raw_cost_total NUMERIC(12, 2),
    net_profit_egp NUMERIC(12, 2),
    payment_method TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_source_created ON orders (order_source, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (customer_phone)`,
  `CREATE TABLE IF NOT EXISTS pos_shifts (
    id TEXT PRIMARY KEY,
    shift_number TEXT NOT NULL,
    status TEXT NOT NULL,
    cashier_id TEXT,
    cashier_name TEXT NOT NULL,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cash_sales_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    card_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expenses_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(12, 2),
    variance NUMERIC(12, 2),
    total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shifts_status_opened ON pos_shifts (status, opened_at DESC)`,
  `CREATE TABLE IF NOT EXISTS pos_expenses (
    id TEXT PRIMARY KEY,
    shift_id TEXT,
    title TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS supply_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    status TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reviewed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_supply_status_created ON supply_invoices (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_supply_supplier ON supply_invoices (supplier_id)`,
  `CREATE TABLE IF NOT EXISTS vip_members (
    phone TEXT PRIMARY KEY,
    customer_name TEXT,
    points_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0,
    orders_count INT NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'gold',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL,
    value NUMERIC(12, 2) NOT NULL,
    min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    used_count INT NOT NULL DEFAULT 0,
    payload JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id TEXT PRIMARY KEY,
    adjustment_number TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    previous_stock_kg NUMERIC(12, 3) NOT NULL,
    new_stock_kg NUMERIC(12, 3) NOT NULL,
    difference_kg NUMERIC(12, 3) NOT NULL,
    unit_cost_per_kg NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cost_impact NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    adjusted_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_adj_product_created ON inventory_adjustments (product_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_adj_reason ON inventory_adjustments (reason)`,
  `CREATE TABLE IF NOT EXISTS pos_returns (
    id TEXT PRIMARY KEY,
    return_number TEXT NOT NULL,
    order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    shift_id TEXT,
    register_id TEXT,
    refund_method TEXT NOT NULL,
    total_refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    processed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pos_returns_order ON pos_returns (order_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS treasury_transactions (
    id TEXT PRIMARY KEY,
    tx_number TEXT NOT NULL,
    account_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reference_id TEXT,
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_treasury_account_created ON treasury_transactions (account_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_action_created ON audit_logs (action, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs (actor_username, created_at DESC)`,
];

export async function ensurePostgresSchema(overrideUrl?: string): Promise<void> {
  if (globalThis.__newNutsRelationalSchemaReady) return;
  if (globalThis.__newNutsSchemaInitPromise) {
    await globalThis.__newNutsSchemaInitPromise;
    return;
  }
  const ddlUrl = overrideUrl || getDirectPostgresUrl();
  if (!ddlUrl) return;

  const initTask = (async () => {
    const sql = neon(ddlUrl);
    await sql.transaction((txn) => SCHEMA_DDL_STATEMENTS.map((stmt) => txn.query(stmt)));
    globalThis.__newNutsRelationalSchemaReady = true;
  })();

  globalThis.__newNutsSchemaInitPromise = initTask;
  try {
    await initTask;
  } finally {
    globalThis.__newNutsSchemaInitPromise = undefined;
  }
}

interface SqlStatementSpec {
  text: string;
  values: unknown[];
}

function diffTableRows<T>(
  nextList: T[],
  prevList: T[] | undefined,
  getKey: (item: T) => string
): {
  mode: 'full' | 'diff';
  allKeys: string[];
  removedKeys: string[];
  upsertRows: T[];
} {
  if (prevList === undefined) {
    return {
      mode: 'full',
      allKeys: nextList.map(getKey),
      removedKeys: [],
      upsertRows: nextList,
    };
  }

  const prevSerialized = new Map<string, string>();
  for (const item of prevList) {
    const k = getKey(item);
    if (k) prevSerialized.set(k, JSON.stringify(item));
  }

  const nextKeySet = new Set<string>();
  const upsertRows: T[] = [];
  for (const item of nextList) {
    const k = getKey(item);
    if (!k) continue;
    nextKeySet.add(k);
    const prevJson = prevSerialized.get(k);
    if (prevJson === undefined || prevJson !== JSON.stringify(item)) {
      upsertRows.push(item);
    }
  }

  const removedKeys: string[] = [];
  for (const prevKey of prevSerialized.keys()) {
    if (!nextKeySet.has(prevKey)) {
      removedKeys.push(prevKey);
    }
  }

  return {
    mode: 'diff',
    allKeys: [],
    removedKeys,
    upsertRows,
  };
}

function pushDeleteGuard(
  stmts: SqlStatementSpec[],
  tableName: string,
  pkColumn: string,
  diff: { mode: 'full' | 'diff'; allKeys: string[]; removedKeys: string[] }
): void {
  if (diff.mode === 'full') {
    stmts.push({
      text: `DELETE FROM ${tableName} WHERE NOT (${pkColumn} = ANY($1::text[]))`,
      values: [diff.allKeys],
    });
  } else if (diff.removedKeys.length > 0) {
    stmts.push({
      text: `DELETE FROM ${tableName} WHERE ${pkColumn} = ANY($1::text[])`,
      values: [diff.removedKeys],
    });
  }
}

export function buildRelationalSyncStatements(
  db: DatabaseSchema,
  nextVersion: number,
  expectedVersion?: number,
  previousDb?: DatabaseSchema
): SqlStatementSpec[] {
  const stmts: SqlStatementSpec[] = [];
  const serializedFull = JSON.stringify(db);

  // 1. Authoritative snapshot & ACID optimistic version guard in store_state.
  // If another concurrent transaction incremented `version`, casting the conflict sentinel
  // to integer aborts and rolls back the ENTIRE transaction batch atomically (zero partial writes).
  if (typeof expectedVersion === 'number' && expectedVersion > 0) {
    stmts.push({
      text: `WITH updated AS (
               UPDATE store_state
               SET data = $1::jsonb, version = $2, updated_at = NOW()
               WHERE id = 'main' AND version = $3
               RETURNING version
             )
             SELECT CASE
               WHEN EXISTS (SELECT 1 FROM updated) THEN 1
               ELSE (('HAFSA_VERSION_CONFLICT_' || $3::text)::int)
             END AS version_guard`,
      values: [serializedFull, nextVersion, expectedVersion],
    });
  } else {
    stmts.push({
      text: `INSERT INTO store_state (id, data, version, updated_at)
             VALUES ('main', $1::jsonb, $2, NOW())
             ON CONFLICT (id) DO UPDATE
             SET data = EXCLUDED.data,
                 version = EXCLUDED.version,
                 updated_at = NOW()`,
      values: [serializedFull, nextVersion],
    });
  }

  // 2. staff_accounts
  const staffList = Array.isArray(db.staffAccounts) ? db.staffAccounts : [];
  const prevStaff = previousDb ? (Array.isArray(previousDb.staffAccounts) ? previousDb.staffAccounts : []) : undefined;
  const staffDiff = diffTableRows(staffList, prevStaff, (s) => s.id);
  pushDeleteGuard(stmts, 'staff_accounts', 'id', staffDiff);
  if (staffDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO staff_accounts (
               id, username, display_name, role, password_hash, active, is_primary,
               phone, notes, created_at, updated_at, last_login_at, payload
             )
             SELECT
               elem->>'id',
               LOWER(TRIM(elem->>'username')),
               COALESCE(elem->>'displayName', elem->>'username'),
               COALESCE(elem->>'role', 'cashier'),
               elem->>'passwordHash',
               COALESCE((elem->>'active')::boolean, TRUE),
               COALESCE((elem->>'isPrimary')::boolean, FALSE),
               elem->>'phone',
               elem->>'notes',
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               COALESCE(NULLIF(elem->>'updatedAt', '')::timestamptz, NOW()),
               NULLIF(elem->>'lastLoginAt', '')::timestamptz,
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               username = EXCLUDED.username,
               display_name = EXCLUDED.display_name,
               role = EXCLUDED.role,
               password_hash = EXCLUDED.password_hash,
               active = EXCLUDED.active,
               is_primary = EXCLUDED.is_primary,
               phone = EXCLUDED.phone,
               notes = EXCLUDED.notes,
               updated_at = EXCLUDED.updated_at,
               last_login_at = EXCLUDED.last_login_at,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(staffDiff.upsertRows)],
    });
  }

  // 3. categories
  const categoryList = (Array.isArray(db.categories) ? db.categories : []).map((c, idx) => ({
    ...c,
    __sortOrder: idx,
  }));
  const prevCategoryList = previousDb
    ? (Array.isArray(previousDb.categories) ? previousDb.categories : []).map((c, idx) => ({
        ...c,
        __sortOrder: idx,
      }))
    : undefined;
  const catDiff = diffTableRows(categoryList, prevCategoryList, (c) => c.id);
  pushDeleteGuard(stmts, 'categories', 'id', catDiff);
  if (catDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO categories (id, slug, name, sort_order, payload, updated_at)
             SELECT
               elem->>'id',
               COALESCE(elem->>'slug', elem->>'id'),
               COALESCE(elem->>'name', ''),
               COALESCE((elem->>'__sortOrder')::int, 0),
               elem - '__sortOrder',
               NOW()
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               slug = EXCLUDED.slug,
               name = EXCLUDED.name,
               sort_order = EXCLUDED.sort_order,
               payload = EXCLUDED.payload,
               updated_at = NOW()`,
      values: [JSON.stringify(catDiff.upsertRows)],
    });
  }

  // 4. products
  const productList = Array.isArray(db.products) ? db.products : [];
  const prevProducts = previousDb ? (Array.isArray(previousDb.products) ? previousDb.products : []) : undefined;
  const prodDiff = diffTableRows(productList, prevProducts, (p) => p.id);
  pushDeleteGuard(stmts, 'products', 'id', prodDiff);
  if (prodDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO products (
               id, slug, category_id, name, price_per_kg, cost_per_kg, stock_kg,
               in_stock, show_online, show_in_pos, barcode, payload, updated_at
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'slug', elem->>'id'),
               COALESCE(elem->>'categoryId', 'cat-luxury-nuts'),
               COALESCE(elem->>'name', ''),
               NULLIF(elem->>'pricePerKg', '')::numeric,
               NULLIF(elem->>'costPerKg', '')::numeric,
               COALESCE(NULLIF(elem->>'stockKg', '')::numeric, 0),
               COALESCE((elem->>'inStock')::boolean, TRUE),
               COALESCE((elem->>'showOnline')::boolean, TRUE),
               COALESCE((elem->>'showInPos')::boolean, TRUE),
               elem->>'barcode',
               elem,
               NOW()
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               slug = EXCLUDED.slug,
               category_id = EXCLUDED.category_id,
               name = EXCLUDED.name,
               price_per_kg = EXCLUDED.price_per_kg,
               cost_per_kg = EXCLUDED.cost_per_kg,
               stock_kg = EXCLUDED.stock_kg,
               in_stock = EXCLUDED.in_stock,
               show_online = EXCLUDED.show_online,
               show_in_pos = EXCLUDED.show_in_pos,
               barcode = EXCLUDED.barcode,
               payload = EXCLUDED.payload,
               updated_at = NOW()`,
      values: [JSON.stringify(prodDiff.upsertRows)],
    });
  }

  // 5. orders
  const orderList = Array.isArray(db.orders) ? db.orders : [];
  const prevOrders = previousDb ? (Array.isArray(previousDb.orders) ? previousDb.orders : []) : undefined;
  const orderDiff = diffTableRows(orderList, prevOrders, (o) => o.id);
  pushDeleteGuard(stmts, 'orders', 'id', orderDiff);
  if (orderDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO orders (
               id, order_number, order_source, status, customer_name, customer_phone,
               cashier_id, cashier_name, rider_id, rider_name, shift_id,
               subtotal, total, raw_cost_total, net_profit_egp, payment_method, created_at, payload
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'orderNumber', elem->>'id'),
               COALESCE(elem->>'orderSource', CASE WHEN (elem->>'orderNumber') LIKE 'POS-%' THEN 'pos' ELSE 'online' END),
               COALESCE(elem->>'status', 'pending'),
               COALESCE(elem->>'customerName', ''),
               COALESCE(elem->>'customerPhone', ''),
               elem->>'cashierId',
               elem->>'cashierName',
               elem->>'riderId',
               elem->>'riderName',
               elem->>'shiftId',
               COALESCE(NULLIF(elem->>'subtotal', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'total', '')::numeric, 0),
               NULLIF(elem->>'rawCostTotal', '')::numeric,
               NULLIF(elem->>'netProfitEgp', '')::numeric,
               COALESCE(elem->>'paymentMethod', 'cod'),
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               order_number = EXCLUDED.order_number,
               order_source = EXCLUDED.order_source,
               status = EXCLUDED.status,
               customer_name = EXCLUDED.customer_name,
               customer_phone = EXCLUDED.customer_phone,
               cashier_id = EXCLUDED.cashier_id,
               cashier_name = EXCLUDED.cashier_name,
               rider_id = EXCLUDED.rider_id,
               rider_name = EXCLUDED.rider_name,
               shift_id = EXCLUDED.shift_id,
               subtotal = EXCLUDED.subtotal,
               total = EXCLUDED.total,
               raw_cost_total = EXCLUDED.raw_cost_total,
               net_profit_egp = EXCLUDED.net_profit_egp,
               payment_method = EXCLUDED.payment_method,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(orderDiff.upsertRows)],
    });
  }

  // 6. pos_shifts
  const shiftList = Array.isArray(db.posShifts) ? db.posShifts : [];
  const prevShifts = previousDb ? (Array.isArray(previousDb.posShifts) ? previousDb.posShifts : []) : undefined;
  const shiftDiff = diffTableRows(shiftList, prevShifts, (s) => s.id);
  pushDeleteGuard(stmts, 'pos_shifts', 'id', shiftDiff);
  if (shiftDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO pos_shifts (
               id, shift_number, status, cashier_id, cashier_name,
               opening_cash, cash_sales_total, card_sales, expenses_total,
               expected_cash, actual_cash, variance, total_revenue,
               opened_at, closed_at, payload
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'shiftNumber', elem->>'id'),
               COALESCE(elem->>'status', 'open'),
               elem->>'cashierId',
               COALESCE(elem->>'cashierName', 'كاشير الفرع'),
               COALESCE(NULLIF(elem->>'openingCash', '')::numeric, NULLIF(elem->>'startingCash', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'cashSalesTotal', '')::numeric, NULLIF(elem->>'cashSales', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'cardSales', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'expensesTotal', '')::numeric, NULLIF(elem->>'expenses', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'expectedCashInDrawer', '')::numeric, NULLIF(elem->>'expectedCash', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'actualClosingCash', '')::numeric, NULLIF(elem->>'actualCash', '')::numeric),
               COALESCE(NULLIF(elem->>'variance', '')::numeric, NULLIF(elem->>'cashDifference', '')::numeric),
               COALESCE(NULLIF(elem->>'totalRevenue', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'openedAt', '')::timestamptz, NULLIF(elem->>'startTime', '')::timestamptz, NOW()),
               COALESCE(NULLIF(elem->>'closedAt', '')::timestamptz, NULLIF(elem->>'endTime', '')::timestamptz),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               cashier_id = EXCLUDED.cashier_id,
               cashier_name = EXCLUDED.cashier_name,
               opening_cash = EXCLUDED.opening_cash,
               cash_sales_total = EXCLUDED.cash_sales_total,
               card_sales = EXCLUDED.card_sales,
               expenses_total = EXCLUDED.expenses_total,
               expected_cash = EXCLUDED.expected_cash,
               actual_cash = EXCLUDED.actual_cash,
               variance = EXCLUDED.variance,
               total_revenue = EXCLUDED.total_revenue,
               closed_at = EXCLUDED.closed_at,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(shiftDiff.upsertRows)],
    });
  }

  // 7. pos_expenses
  const expenseList = Array.isArray(db.posExpenses) ? db.posExpenses : [];
  const prevExpenses = previousDb ? (Array.isArray(previousDb.posExpenses) ? previousDb.posExpenses : []) : undefined;
  const expenseDiff = diffTableRows(expenseList, prevExpenses, (e) => e.id);
  pushDeleteGuard(stmts, 'pos_expenses', 'id', expenseDiff);
  if (expenseDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO pos_expenses (
               id, shift_id, title, amount, category, created_by, created_at, payload
             )
             SELECT
               elem->>'id',
               elem->>'shiftId',
               COALESCE(elem->>'title', ''),
               COALESCE(NULLIF(elem->>'amount', '')::numeric, 0),
               COALESCE(elem->>'category', 'other'),
               elem->>'createdBy',
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               shift_id = EXCLUDED.shift_id,
               title = EXCLUDED.title,
               amount = EXCLUDED.amount,
               category = EXCLUDED.category,
               created_by = EXCLUDED.created_by,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(expenseDiff.upsertRows)],
    });
  }

  // 8. supply_invoices
  const supplyList = Array.isArray(db.supplyInvoices) ? db.supplyInvoices : [];
  const prevSupply = previousDb ? (Array.isArray(previousDb.supplyInvoices) ? previousDb.supplyInvoices : []) : undefined;
  const supplyDiff = diffTableRows(supplyList, prevSupply, (inv) => inv.id);
  pushDeleteGuard(stmts, 'supply_invoices', 'id', supplyDiff);
  if (supplyDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO supply_invoices (
               id, invoice_number, supplier_id, supplier_name, status,
               total_amount, reviewed_by, created_at, reviewed_at, payload
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'invoiceNumber', elem->>'id'),
               COALESCE(elem->>'supplierId', 'sup'),
               COALESCE(elem->>'supplierName', ''),
               COALESCE(elem->>'status', 'pending'),
               COALESCE(NULLIF(elem->>'totalAmount', '')::numeric, 0),
               elem->>'reviewedBy',
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               NULLIF(elem->>'reviewedAt', '')::timestamptz,
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               total_amount = EXCLUDED.total_amount,
               reviewed_by = EXCLUDED.reviewed_by,
               reviewed_at = EXCLUDED.reviewed_at,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(supplyDiff.upsertRows)],
    });
  }

  // 9. vip_members (deduplicated by phone)
  const dedupeVip = (list: DatabaseSchema['vipMembers']) => {
    const raw = Array.isArray(list) ? list : [];
    const seen = new Set<string>();
    return raw.filter((m) => {
      if (!m?.phone || seen.has(m.phone)) return false;
      seen.add(m.phone);
      return true;
    });
  };
  const vipList = dedupeVip(db.vipMembers);
  const prevVipList = previousDb ? dedupeVip(previousDb.vipMembers) : undefined;
  const vipDiff = diffTableRows(vipList, prevVipList, (m) => m.phone);
  pushDeleteGuard(stmts, 'vip_members', 'phone', vipDiff);
  if (vipDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO vip_members (
               phone, customer_name, points_balance, total_spent, orders_count, tier, joined_at, payload
             )
             SELECT
               elem->>'phone',
               COALESCE(elem->>'customerName', elem->>'name', ''),
               COALESCE(NULLIF(elem->>'pointsBalance', '')::numeric, NULLIF(elem->>'walletBalance', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'totalSpent', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'ordersCount', '')::int, 0),
               COALESCE(elem->>'tier', 'gold'),
               COALESCE(NULLIF(elem->>'joinedAt', '')::timestamptz, NOW()),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (phone) DO UPDATE SET
               customer_name = EXCLUDED.customer_name,
               points_balance = EXCLUDED.points_balance,
               total_spent = EXCLUDED.total_spent,
               orders_count = EXCLUDED.orders_count,
               tier = EXCLUDED.tier,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(vipDiff.upsertRows)],
    });
  }

  // 10. coupons
  const couponList = Array.isArray(db.coupons) ? db.coupons : [];
  const prevCoupons = previousDb ? (Array.isArray(previousDb.coupons) ? previousDb.coupons : []) : undefined;
  const couponDiff = diffTableRows(couponList, prevCoupons, (c) => c.id);
  pushDeleteGuard(stmts, 'coupons', 'id', couponDiff);
  if (couponDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO coupons (
               id, code, discount_type, value, min_order_amount, active, used_count, payload
             )
             SELECT
               elem->>'id',
               UPPER(TRIM(elem->>'code')),
               COALESCE(elem->>'discountType', 'percentage'),
               COALESCE(NULLIF(elem->>'value', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'minOrderAmount', '')::numeric, 0),
               COALESCE((elem->>'active')::boolean, TRUE),
               COALESCE(NULLIF(elem->>'usedCount', '')::int, 0),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               code = EXCLUDED.code,
               discount_type = EXCLUDED.discount_type,
               value = EXCLUDED.value,
               min_order_amount = EXCLUDED.min_order_amount,
               active = EXCLUDED.active,
               used_count = EXCLUDED.used_count,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(couponDiff.upsertRows)],
    });
  }

  // 11. inventory_adjustments
  const adjustmentList = Array.isArray(db.inventoryAdjustments) ? db.inventoryAdjustments : [];
  const prevAdjustments = previousDb
    ? (Array.isArray(previousDb.inventoryAdjustments) ? previousDb.inventoryAdjustments : [])
    : undefined;
  const adjustmentDiff = diffTableRows(adjustmentList, prevAdjustments, (a) => a.id);
  if (adjustmentDiff.mode === 'full') {
    stmts.push({
      text: `DELETE FROM inventory_adjustments WHERE NOT (id = ANY($1::text[]))`,
      values: [adjustmentDiff.allKeys],
    });
  } else if (adjustmentDiff.removedKeys.length > 0) {
    stmts.push({
      text: `DELETE FROM inventory_adjustments WHERE id = ANY($1::text[])`,
      values: [adjustmentDiff.removedKeys],
    });
  }
  if (adjustmentDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO inventory_adjustments (
               id, adjustment_number, product_id, product_name,
               previous_stock_kg, new_stock_kg, difference_kg,
               unit_cost_per_kg, total_cost_impact, reason,
               adjusted_by, created_at, payload
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'adjustmentNumber', elem->>'id'),
               COALESCE(elem->>'productId', ''),
               COALESCE(elem->>'productName', ''),
               COALESCE(NULLIF(elem->>'previousStockKg', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'newStockKg', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'differenceKg', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'unitCostPerKg', '')::numeric, 0),
               COALESCE(NULLIF(elem->>'totalCostImpact', '')::numeric, 0),
               COALESCE(elem->>'reason', 'correction'),
               COALESCE(elem->>'adjustedBy', 'الإدارة'),
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               adjustment_number = EXCLUDED.adjustment_number,
               product_id = EXCLUDED.product_id,
               product_name = EXCLUDED.product_name,
               previous_stock_kg = EXCLUDED.previous_stock_kg,
               new_stock_kg = EXCLUDED.new_stock_kg,
               difference_kg = EXCLUDED.difference_kg,
               unit_cost_per_kg = EXCLUDED.unit_cost_per_kg,
               total_cost_impact = EXCLUDED.total_cost_impact,
               reason = EXCLUDED.reason,
               adjusted_by = EXCLUDED.adjusted_by,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(adjustmentDiff.upsertRows)],
    });
  }

  // 12. pos_returns
  const returnsList = Array.isArray(db.posReturns) ? db.posReturns : [];
  const prevReturns = previousDb ? (Array.isArray(previousDb.posReturns) ? previousDb.posReturns : []) : undefined;
  const returnsDiff = diffTableRows(returnsList, prevReturns, (r) => r.id);
  pushDeleteGuard(stmts, 'pos_returns', 'id', returnsDiff);
  if (returnsDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO pos_returns (
               id, return_number, order_id, order_number, shift_id, register_id,
               refund_method, total_refund_amount, processed_by, created_at, payload
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'returnNumber', elem->>'id'),
               COALESCE(elem->>'orderId', ''),
               COALESCE(elem->>'orderNumber', ''),
               elem->>'shiftId',
               elem->>'registerId',
               COALESCE(elem->>'refundMethod', 'cash'),
               COALESCE(NULLIF(elem->>'totalRefundAmount', '')::numeric, 0),
               COALESCE(elem->>'processedBy', 'كاشير الفرع'),
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               refund_method = EXCLUDED.refund_method,
               total_refund_amount = EXCLUDED.total_refund_amount,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(returnsDiff.upsertRows)],
    });
  }

  // 13. treasury_transactions
  const treasuryList = Array.isArray(db.treasuryTransactions) ? db.treasuryTransactions : [];
  const prevTreasury = previousDb
    ? (Array.isArray(previousDb.treasuryTransactions) ? previousDb.treasuryTransactions : [])
    : undefined;
  const treasuryDiff = diffTableRows(treasuryList, prevTreasury, (t) => t.id);
  pushDeleteGuard(stmts, 'treasury_transactions', 'id', treasuryDiff);
  if (treasuryDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO treasury_transactions (
               id, tx_number, account_id, direction, category,
               amount, reference_id, recorded_by, created_at, payload
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'txNumber', elem->>'id'),
               COALESCE(elem->>'accountId', 'main_safe'),
               COALESCE(elem->>'direction', 'in'),
               COALESCE(elem->>'category', 'shift_close'),
               COALESCE(NULLIF(elem->>'amount', '')::numeric, 0),
               elem->>'referenceId',
               COALESCE(elem->>'recordedBy', 'الإدارة'),
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO UPDATE SET
               amount = EXCLUDED.amount,
               payload = EXCLUDED.payload`,
      values: [JSON.stringify(treasuryDiff.upsertRows)],
    });
  }

  // 14. audit_logs (immutable append-only in Postgres — never delete aged-out logs)
  const auditList = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  const prevAudit = previousDb ? (Array.isArray(previousDb.auditLogs) ? previousDb.auditLogs : []) : undefined;
  const auditDiff = diffTableRows(auditList, prevAudit, (l) => l.id);
  if (auditDiff.upsertRows.length > 0) {
    stmts.push({
      text: `INSERT INTO audit_logs (
               id, action, actor_username, actor_role, target_type,
               target_id, summary, created_at, payload
             )
             SELECT
               elem->>'id',
               COALESCE(elem->>'action', 'settings_update'),
               COALESCE(elem->>'actorUsername', 'system'),
               COALESCE(elem->>'actorRole', 'super_admin'),
               COALESCE(elem->>'targetType', 'system'),
               elem->>'targetId',
               COALESCE(elem->>'summary', ''),
               COALESCE(NULLIF(elem->>'createdAt', '')::timestamptz, NOW()),
               elem
             FROM jsonb_array_elements($1::jsonb) AS elem
             ON CONFLICT (id) DO NOTHING`,
      values: [JSON.stringify(auditDiff.upsertRows)],
    });
  }

  return stmts;
}

export async function syncAllRelationalTablesHttp(
  pgUrl: string,
  db: DatabaseSchema,
  nextVersion = 1,
  expectedVersion?: number,
  previousDb?: DatabaseSchema
): Promise<void> {
  const sql = neon(pgUrl);
  const stmts = buildRelationalSyncStatements(db, nextVersion, expectedVersion, previousDb);
  try {
    await sql.transaction((txn: NeonQueryFunctionInTransaction<false, false>) =>
      stmts.map((s) => txn.query(s.text, s.values))
    );
    globalThis.__newNutsRelationalSchemaReady = true;
  } catch (err) {
    if (isMissingRelationError(err)) {
      globalThis.__newNutsRelationalSchemaReady = false;
      await ensurePostgresSchema();
      const fullStmts = buildRelationalSyncStatements(db, nextVersion, expectedVersion);
      await sql.transaction((txn: NeonQueryFunctionInTransaction<false, false>) =>
        fullStmts.map((s) => txn.query(s.text, s.values))
      );
      return;
    }
    throw err;
  }
}

/**
 * Executes an ACID SQL transaction over Neon HTTP atomic batch transaction (default fast serverless path)
 * or optional Neon Pool WebSocket (`HAFSA_ENABLE_WS_POOL=1`) with row-level pessimistic locking (`SELECT ... FOR UPDATE`).
 * Skips cold-start DDL statements unless tables are not yet initialized (`42P01`).
 * Uses differential row-level relational sync so unchanged historical rows are never rewritten.
 */
export async function executeAtomicPostgresTransaction<T>(
  pgUrl: string,
  normalizeFn: (raw: DatabaseSchema) => DatabaseSchema,
  seedFallbackFn: () => DatabaseSchema,
  mutator: (db: DatabaseSchema) => Promise<T> | T,
  isErrorResponseFn: (res: T) => boolean
): Promise<{ result: T; committedDb?: DatabaseSchema }> {
  const canUseWebSocketPool =
    process.env.HAFSA_ENABLE_WS_POOL === '1' &&
    typeof globalThis.WebSocket === 'function' &&
    process.env.HAFSA_FORCE_HTTP_TX !== '1';

  if (canUseWebSocketPool) {
    const pool = getSharedNeonPool(pgUrl);
    let client;
    try {
      client = await pool.connect();
    } catch (wsConnectErr) {
      client = undefined;
      console.warn('Neon WebSocket Pool unavailable, using HTTP SQL transaction fallback:', wsConnectErr);
    }

    if (client) {
      try {
        await client.query('BEGIN');
        const lockRes = await client.query(
          `SELECT data, version FROM store_state WHERE id = 'main' FOR UPDATE`
        );

        let currentVersion = 0;
        let workingDb: DatabaseSchema;
        let baselineDb: DatabaseSchema | undefined;

        if (lockRes.rows.length > 0 && lockRes.rows[0]?.data) {
          const rawData = lockRes.rows[0].data;
          const parsed =
            typeof rawData === 'string'
              ? (JSON.parse(rawData) as DatabaseSchema)
              : (rawData as DatabaseSchema);
          workingDb = normalizeFn(parsed);
          baselineDb = structuredClone(workingDb);
          currentVersion = Number(lockRes.rows[0].version) || 1;
          globalThis.__newNutsRelationalSchemaReady = true;
        } else {
          await ensurePostgresSchema();
          workingDb = normalizeFn(seedFallbackFn());
          baselineDb = undefined; // Initial bootstrap: full sync
          currentVersion = 0;
        }

        const result = await mutator(workingDb);
        if (isErrorResponseFn(result)) {
          await client.query('ROLLBACK');
          return { result };
        }

        const normalizedNext = normalizeFn(workingDb);
        const stmts = buildRelationalSyncStatements(
          normalizedNext,
          currentVersion + 1,
          undefined,
          baselineDb
        );
        for (const stmt of stmts) {
          await client.query(stmt.text, stmt.values);
        }

        await client.query('COMMIT');
        return { result, committedDb: normalizedNext };
      } catch (txErr) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        if (isMissingRelationError(txErr)) {
          globalThis.__newNutsRelationalSchemaReady = false;
          await ensurePostgresSchema();
        } else {
          throw txErr;
        }
      } finally {
        client.release();
      }
    }
  }

  // Fast Serverless Default: HTTP atomic batch transaction with ACID optimistic version lock (up to 6 retries with jitter)
  const sql = neon(pgUrl);
  const MAX_OPTIMISTIC_ATTEMPTS = 6;
  for (let attempt = 1; attempt <= MAX_OPTIMISTIC_ATTEMPTS; attempt++) {
    let rows: Record<string, any>[];
    try {
      rows = await sql`SELECT data, version FROM store_state WHERE id = 'main' LIMIT 1`;
    } catch (readErr) {
      if (isMissingRelationError(readErr)) {
        globalThis.__newNutsRelationalSchemaReady = false;
        await ensurePostgresSchema();
        rows = [];
      } else {
        throw readErr;
      }
    }

    let currentVersion = 0;
    let workingDb: DatabaseSchema;
    let baselineDb: DatabaseSchema | undefined;

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
      const rawData = rows[0].data;
      const parsed =
        typeof rawData === 'string'
          ? (JSON.parse(rawData) as DatabaseSchema)
          : (rawData as DatabaseSchema);
      workingDb = normalizeFn(parsed);
      baselineDb = structuredClone(workingDb);
      currentVersion = Number(rows[0].version) || 1;
      globalThis.__newNutsRelationalSchemaReady = true;
    } else {
      await ensurePostgresSchema();
      workingDb = normalizeFn(seedFallbackFn());
      baselineDb = undefined;
      currentVersion = 0;
    }

    const result = await mutator(workingDb);
    if (isErrorResponseFn(result)) {
      return { result };
    }

    const normalizedNext = normalizeFn(workingDb);
    const stmts = buildRelationalSyncStatements(
      normalizedNext,
      currentVersion + 1,
      currentVersion > 0 ? currentVersion : undefined,
      baselineDb
    );

    try {
      await sql.transaction(
        (txn) => stmts.map((s) => txn.query(s.text, s.values)),
        { fullResults: true }
      );
      return { result, committedDb: normalizedNext };
    } catch (commitErr: any) {
      const errMsg = String(commitErr?.message || commitErr || '');
      if (errMsg.includes('HAFSA_VERSION_CONFLICT_')) {
        if (attempt < MAX_OPTIMISTIC_ATTEMPTS) {
          const jitterMs = 25 + Math.floor(Math.random() * 65) * attempt;
          await new Promise((resolve) => setTimeout(resolve, jitterMs));
          continue; // Entire SQL transaction was cleanly rolled back; re-read & retry
        }
        throw new Error('النظام مزدحم حالياً بالطلبات المتزامنة، يرجى إعادة المحاولة خلال لحظة');
      }
      if (isMissingRelationError(commitErr) && attempt < MAX_OPTIMISTIC_ATTEMPTS) {
        globalThis.__newNutsRelationalSchemaReady = false;
        await ensurePostgresSchema();
        continue;
      }
      throw commitErr;
    }
  }

  throw new Error('Failed to commit optimistic Postgres transaction after retries');
}

export interface PostgresRelationalHealth {
  engine: 'neon_postgres' | 'local_json';
  connected: boolean;
  version?: number;
  tables: readonly string[];
  counts?: Record<string, number>;
}

export async function inspectPostgresRelationalHealth(): Promise<PostgresRelationalHealth> {
  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return {
      engine: 'local_json',
      connected: true,
      tables: RELATIONAL_TABLES,
    };
  }

  try {
    await ensurePostgresSchema();
    const sql = neon(pgUrl);
    const rows = await sql`
      SELECT
        (SELECT version FROM store_state WHERE id = 'main' LIMIT 1) AS state_version,
        (SELECT COUNT(*)::int FROM staff_accounts) AS staff_count,
        (SELECT COUNT(*)::int FROM products) AS products_count,
        (SELECT COUNT(*)::int FROM orders) AS orders_count,
        (SELECT COUNT(*)::int FROM pos_shifts) AS shifts_count,
        (SELECT COUNT(*)::int FROM supply_invoices) AS supply_count,
        (SELECT COUNT(*)::int FROM vip_members) AS vip_count,
        (SELECT COUNT(*)::int FROM pos_returns) AS returns_count,
        (SELECT COUNT(*)::int FROM treasury_transactions) AS treasury_count,
        (SELECT COUNT(*)::int FROM audit_logs) AS audit_count
    `;
    const r = rows?.[0] || {};
    return {
      engine: 'neon_postgres',
      connected: true,
      version: Number(r.state_version) || 1,
      tables: RELATIONAL_TABLES,
      counts: {
        staff_accounts: Number(r.staff_count) || 0,
        products: Number(r.products_count) || 0,
        orders: Number(r.orders_count) || 0,
        pos_shifts: Number(r.shifts_count) || 0,
        supply_invoices: Number(r.supply_count) || 0,
        vip_members: Number(r.vip_count) || 0,
        pos_returns: Number(r.returns_count) || 0,
        treasury_transactions: Number(r.treasury_count) || 0,
        audit_logs: Number(r.audit_count) || 0,
      },
    };
  } catch (err) {
    console.error('Postgres health check error:', err);
    return {
      engine: 'neon_postgres',
      connected: false,
      tables: RELATIONAL_TABLES,
    };
  }
}
