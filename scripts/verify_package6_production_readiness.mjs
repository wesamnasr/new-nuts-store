/**
 * Package 6 Verification Suite: Production Readiness, Safe Operational Purge & Atomic Relational Reset Guard
 * Target: محمصة حفصة للبن والمكسرات — فرع بني مزار (HAFSA ROASTERY)
 * Runtime: Node.js v24+ with TypeScript execution via tsx
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Ensure execution under tsx so TypeScript Next.js route handlers can be imported directly
const isRunningUnderTsx = Boolean(
  process.env.TSX_EXEC_ACTIVE ||
    process.execArgv.some((arg) => arg.includes('tsx'))
);

if (!isRunningUnderTsx) {
  const targetScript = '"' + fileURLToPath(import.meta.url) + '"';
  const result = spawnSync('npx', ['tsx', targetScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_EXEC_ACTIVE: '1', HAFSA_LOCAL_DB_ONLY: '1' },
    shell: true,
  });
  process.exit(result.status ?? 0);
}

process.env.HAFSA_LOCAL_DB_ONLY = '1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');

const { default: assert } = await import('node:assert/strict');
const { NextRequest } = await import('next/server');
const { buildRelationalSyncStatements } = await import('../src/lib/postgres-schema.ts');
const { getDbAsync, withDbTransaction } = await import('../src/lib/db.ts');
const { generateAdminToken } = await import('../src/lib/auth.ts');
const { POST: resetTransactionsPOST } = await import('../src/app/api/admin/reset-transactions/route.ts');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${name}`);
  } catch (err) {
    console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

function makeReq(url, method = 'POST', token = '', bodyObj = undefined) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-token'] = token;
  }
  return new NextRequest(url, {
    method,
    headers,
    body: bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined,
  });
}

async function runPackage6Verification() {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}RUNNING PACKAGE 6 VERIFICATION: PRODUCTION READINESS & SAFE PURGE${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  const initialDbRaw = fs.readFileSync(DB_PATH, 'utf8');

  try {
    const db = await getDbAsync();
    const adminPassword = db.settings?.adminPassword || 'Hafsa@Admin2026';
    const accountantPassword = db.settings?.accountantPassword || 'Acc#Fin2026';
    const cashierPassword = db.settings?.cashierPassword || 'Cash#Pos2026';
    const supplierPassword = db.settings?.supplierPassword || 'Sup#Arafat2026';
    const riderPassword = db.settings?.riderPassword || 'Rider#Hafsa2026';

    const superAdminToken = generateAdminToken(adminPassword, 'super_admin').token;
    const accountantToken = generateAdminToken(accountantPassword, 'accountant').token;
    const cashierToken = generateAdminToken(cashierPassword, 'cashier').token;
    const supplierToken = generateAdminToken(supplierPassword, 'supplier').token;
    const riderToken = generateAdminToken(riderPassword, 'delivery_rider').token;

    // 1. Unauthenticated Request Rejection
    await test('P6_RBAC_01: Unauthenticated request to reset-transactions endpoint returns 401', async () => {
      const req = makeReq('http://localhost:3000/api/admin/reset-transactions', 'POST', '', {
        confirmationText: 'تصفير العمليات التجريبية',
      });
      const res = await resetTransactionsPOST(req);
      assert.equal(res.status, 401, 'Must reject unauthenticated request with 401');
      const data = await res.json();
      assert.ok(data.error, 'Must return error message');
    });

    // 2. Role Isolation & Guardrails (403 Forbidden for non-super_admin)
    await test('P6_RBAC_02: Accountant, Cashier, Supplier and Rider requests strictly rejected with 403 Forbidden', async () => {
      const nonAdminTokens = [
        { role: 'accountant', token: accountantToken },
        { role: 'cashier', token: cashierToken },
        { role: 'supplier', token: supplierToken },
        { role: 'delivery_rider', token: riderToken },
      ];

      for (const item of nonAdminTokens) {
        const req = makeReq('http://localhost:3000/api/admin/reset-transactions', 'POST', item.token, {
          confirmationText: 'تصفير العمليات التجريبية',
        });
        const res = await resetTransactionsPOST(req);
        assert.equal(res.status, 403, `Must reject ${item.role} with 403 Forbidden`);
        const data = await res.json();
        assert.ok(data.error.includes('403') || data.error.includes('عزل الأدوار'), 'Must enforce role isolation');
      }
    });

    // 3. Confirmation Safety Guard (400 Bad Request if text is missing or wrong)
    await test('P6_CNF_03: Confirmation text guard requires exact matching phrase to prevent accidental deletion', async () => {
      const invalidTexts = ['', 'تصفير', 'reset', 'confirm', 'تصفير العمليات'];

      for (const invalid of invalidTexts) {
        const req = makeReq('http://localhost:3000/api/admin/reset-transactions', 'POST', superAdminToken, {
          confirmationText: invalid,
        });
        const res = await resetTransactionsPOST(req);
        assert.equal(res.status, 400, `Must reject invalid confirmation text "${invalid}" with 400`);
        const data = await res.json();
        assert.ok(data.error.includes('نص التأكيد غير صحيح'), 'Must return informative confirmation error');
      }
    });

    // 4. Super Admin Atomic Execution: Clears test transactional entities while preserving catalog & staff
    await test('P6_EXE_04: Super Admin with valid confirmation executes atomic purge while preserving catalog & staff', async () => {
      // Seed dummy transactional records
      await withDbTransaction((d) => {
        d.orders = [
          {
            id: 'ord-test-purge-1',
            orderNumber: 'TEST-PURGE-01',
            customerName: 'عميل تجريبي للتصفير',
            customerPhone: '01011112222',
            deliveryMethod: 'bandar_fast',
            paymentMethod: 'cod',
            subtotal: 100,
            shippingCost: 0,
            discountAmount: 0,
            total: 100,
            items: [],
            status: 'delivered',
            createdAt: new Date().toISOString(),
          },
        ];
        d.posShifts = [
          {
            id: 'shift-test-purge-1',
            shiftNumber: 'SH-PURGE-01',
            status: 'closed',
            cashierId: 'cashier-1',
            cashierName: 'كاشير تجريبي',
            openedAt: new Date().toISOString(),
            closedAt: new Date().toISOString(),
            openingCash: 500,
            cashSales: 100,
            expenses: 0,
            expectedCash: 600,
            actualCashCount: 600,
            variance: 0,
          },
        ];
        d.posExpenses = [
          {
            id: 'exp-test-purge-1',
            shiftId: 'shift-test-purge-1',
            title: 'مصروف نظافة تجريبي',
            amount: 50,
            category: 'cleaning',
            createdAt: new Date().toISOString(),
          },
        ];
        d.supplyInvoices = [
          {
            id: 'sup-test-purge-1',
            invoiceNumber: 'SUP-PURGE-01',
            supplierId: 'supplier-1',
            supplierName: 'مورد تجريبي',
            status: 'approved',
            items: [],
            totalAmount: 1000,
            createdAt: new Date().toISOString(),
          },
        ];
        d.vipMembers = [
          {
            phone: '01011112222',
            customerName: 'عضو تجريبي',
            pointsBalance: 50,
            totalSpent: 1000,
            ordersCount: 2,
            tier: 'gold',
            joinedAt: new Date().toISOString(),
          },
        ];
      });

      // Verify records are present before reset
      const preDb = await getDbAsync();
      assert.equal(preDb.orders.length, 1);
      assert.equal(preDb.posShifts.length, 1);
      assert.equal(preDb.posExpenses.length, 1);
      assert.equal(preDb.supplyInvoices.length, 1);
      assert.equal(preDb.vipMembers.length, 1);
      const preProductsCount = preDb.products.length;
      const preCategoriesCount = preDb.categories.length;
      const preStaffCount = preDb.staffAccounts.length;

      // Execute Reset via POST endpoint
      const req = makeReq('http://localhost:3000/api/admin/reset-transactions', 'POST', superAdminToken, {
        confirmationText: 'تصفير العمليات التجريبية',
        clearOrders: true,
        clearShifts: true,
        clearExpenses: true,
        clearSupplyInvoices: true,
        clearVipMembers: true,
      });

      const res = await resetTransactionsPOST(req);
      assert.equal(res.status, 200, 'Must return 200 OK on successful reset');
      const data = await res.json();

      assert.equal(data.success, true);
      assert.equal(data.purged.orders, 1);
      assert.equal(data.purged.posShifts, 1);
      assert.equal(data.purged.posExpenses, 1);
      assert.equal(data.purged.supplyInvoices, 1);
      assert.equal(data.purged.vipMembers, 1);

      // Verify database state post-reset
      const postDb = await getDbAsync();
      assert.equal(postDb.orders.length, 0, 'Orders array must be completely purged');
      assert.equal(postDb.posShifts.length, 0, 'POS shifts must be completely purged');
      assert.equal(postDb.posExpenses.length, 0, 'POS expenses must be completely purged');
      assert.equal(postDb.supplyInvoices.length, 0, 'Supply invoices must be completely purged');
      assert.equal(postDb.vipMembers.length, 0, 'VIP test members must be completely purged');

      // Verify that catalog, settings and staff accounts remain 100% intact
      assert.equal(postDb.products.length, preProductsCount, 'Products catalog must remain 100% intact');
      assert.equal(postDb.categories.length, preCategoriesCount, 'Categories must remain 100% intact');
      assert.equal(postDb.staffAccounts.length, preStaffCount, 'Staff accounts must remain 100% intact');
      assert.ok(postDb.settings.storeName.includes('محمصة حفصة'), 'Store settings must remain intact');
    });

    // 5. Relational PostgreSQL Schema Sync Compliance
    await test('P6_REL_05: Relational SQL sync statements generate clean table delete queries when arrays are empty', async () => {
      const mockDb = {
        settings: { storeName: 'محمصة حفصة' },
        categories: [{ id: 'cat-1', name: 'مكسرات', slug: 'nuts', sortOrder: 1, active: true }],
        products: [{ id: 'prod-1', name: 'بندق', categoryId: 'cat-1', pricePerKg: 500, costPerKg: 350, weights: [], active: true }],
        orders: [],
        posShifts: [],
        posExpenses: [],
        supplyInvoices: [],
        vipMembers: [],
        staffAccounts: [{ id: 'staff-1', username: 'admin_hafsa', role: 'super_admin', active: true }],
        coupons: [],
      };

      const stmts = buildRelationalSyncStatements(mockDb, 2);
      const sqlTexts = stmts.map((s) => s.text).join('\n');

      assert.ok(sqlTexts.includes('DELETE FROM orders WHERE NOT (id = ANY($1::text[]))'), 'Must generate delete query for orders');
      assert.ok(sqlTexts.includes('DELETE FROM pos_shifts WHERE NOT (id = ANY($1::text[]))'), 'Must generate delete query for pos_shifts');
      assert.ok(sqlTexts.includes('DELETE FROM pos_expenses WHERE NOT (id = ANY($1::text[]))'), 'Must generate delete query for pos_expenses');
      assert.ok(sqlTexts.includes('DELETE FROM supply_invoices WHERE NOT (id = ANY($1::text[]))'), 'Must generate delete query for supply_invoices');
      assert.ok(sqlTexts.includes('DELETE FROM vip_members WHERE NOT (phone = ANY($1::text[]))'), 'Must generate delete query for vip_members');
    });

    // 6. UI Safeguard Component & Page Mounting Contract
    await test('P6_UI_06: PreLaunchResetSafeguard component and Admin / Operations mount integration', async () => {
      const safeguardCompPath = path.join(ROOT_DIR, 'src/components/admin/PreLaunchResetSafeguard.tsx');
      assert.ok(fs.existsSync(safeguardCompPath), 'PreLaunchResetSafeguard.tsx must exist');
      const compRaw = fs.readFileSync(safeguardCompPath, 'utf8');

      assert.ok(
        compRaw.includes('تصفير العمليات التجريبية') &&
        compRaw.includes('خزنة تصفير العمليات التجريبية') &&
        compRaw.includes('المدير العام فقط'),
        'PreLaunchResetSafeguard must require exact confirmation string and enforce Super Admin authority'
      );

      const adminPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/admin/page.tsx'), 'utf8');
      assert.ok(
        adminPageRaw.includes('<PreLaunchResetSafeguard') &&
        adminPageRaw.includes("currentRole === 'super_admin'"),
        'admin/page.tsx must mount PreLaunchResetSafeguard conditionally for super_admin'
      );

      const opsStudioRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/admin/HafsaOperationsStudio.tsx'), 'utf8');
      assert.ok(
        opsStudioRaw.includes('pre_launch_reset') &&
        opsStudioRaw.includes('<PreLaunchResetSafeguard'),
        'HafsaOperationsStudio must support pre_launch_reset subtab'
      );
    });

    console.log(`\n${colors.bold}${colors.green}ALL PACKAGE 6 PRODUCTION READINESS & SAFE PURGE CHECKS PASSED (6/6)${colors.reset}\n`);

  } finally {
    // Restore database to pristine state
    fs.writeFileSync(DB_PATH, initialDbRaw, 'utf8');
  }
}

runPackage6Verification().catch((err) => {
  console.error('Fatal package 6 verification error:', err);
  process.exit(1);
});
