/**
 * Empirical Adversarial Challenger Test Suite — Milestone M3
 * Focus: Rollback on Failure, Database Transaction Concurrency, Supply Invoice Approval Lifecycle & Integrity
 * Agent: challenger_m3_exec_2
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const isRunningUnderTsx = Boolean(
  process.env.TSX_EXEC_ACTIVE ||
  process.execArgv.some((arg) => arg.includes('tsx'))
);

if (!isRunningUnderTsx) {
  const targetScript = '"' + fileURLToPath(import.meta.url) + '"';
  const result = spawnSync('npx', ['tsx', targetScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_EXEC_ACTIVE: '1' },
    shell: true,
  });
  process.exit(result.status ?? 0);
}

const { default: assert } = await import('node:assert/strict');
const { NextRequest, NextResponse } = await import('next/server');
const { getDb, getDbAsync, withDbTransaction } = await import('../src/lib/db.ts');
const { generateAdminToken } = await import('../src/lib/auth.ts');
const { POST: supplyPOST, PATCH: supplyPATCH } = await import('../src/app/api/supply-invoices/route.ts');
const { POST: posPOST } = await import('../src/app/api/pos/route.ts');

const ROOT_DIR = process.cwd();
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');
const DB_BACKUP_PATH = path.join(ROOT_DIR, 'data', 'store-db.json.challenger_m3.bak');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function check(desc, condition, extraInfo = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${desc}`);
  } else {
    failedChecks++;
    failures.push({ desc, extraInfo });
    console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${desc} ${extraInfo}`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ Milestone M3 Empirical Rollback & Transaction Integrity Challenge${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);

  try {
    // ══════════════════════════════════════════════════════════════════
    // Tier 1: Rollback on Thrown Exception inside withDbTransaction
    // ══════════════════════════════════════════════════════════════════
    console.log(`${colors.bold}--- Tier 1: Rollback on Thrown Exception inside withDbTransaction ---${colors.reset}`);
    {
      const initialDb = await getDbAsync();
      const initialStock = initialDb.products[0].stockKg;
      const initialOrderCount = initialDb.orders.length;
      const initialStoreName = initialDb.settings.storeName;

      let exceptionCaught = false;
      try {
        await withDbTransaction(async (db) => {
          // Perform invasive mutations
          db.products[0].stockKg = 999999;
          db.orders.push({
            id: 'corrupted-order-simulated-999',
            orderNumber: 'CORRUPT-999',
            customerName: 'Hacker',
            customerPhone: '01000000000',
            address: 'Unknown',
            items: [],
            totalAmount: 9999,
            subtotal: 9999,
            shippingCost: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
          db.settings.storeName = 'HACKED_STORE_NAME';

          // Simulate an unexpected runtime crash midway
          throw new Error('SIMULATED_UNHANDLED_DATABASE_FAILURE');
        });
      } catch (err) {
        exceptionCaught = true;
        check('Thrown error is propagated by withDbTransaction', err.message === 'SIMULATED_UNHANDLED_DATABASE_FAILURE');
      }
      check('Exception was caught from withDbTransaction', exceptionCaught);

      // Verify in-memory cache was cleared
      check('globalThis.__newNutsMemoryDb is cleared to undefined after exception', globalThis.__newNutsMemoryDb === undefined);

      // Verify fresh read from getDbAsync() did not persist partial mutations
      const freshDb = await getDbAsync();
      check('Product stockKg was not modified in memory (remains initial)', freshDb.products[0].stockKg === initialStock);
      check('Corrupted order was not appended in memory', !freshDb.orders.some((o) => o.id === 'corrupted-order-simulated-999'));
      check('Store name was not corrupted in memory', freshDb.settings.storeName === initialStoreName);

      // Verify data/store-db.json on disk was not modified
      const rawDisk = fs.readFileSync(DB_PATH, 'utf-8');
      const diskDb = JSON.parse(rawDisk);
      check('Product stockKg on disk was not modified', diskDb.products[0].stockKg === initialStock);
      check('Disk JSON does not contain corrupted order', !diskDb.orders.some((o) => o.id === 'corrupted-order-simulated-999'));
      check('Disk JSON store name was not corrupted', diskDb.settings.storeName === initialStoreName);
    }

    // ══════════════════════════════════════════════════════════════════
    // Tier 2: Rollback on HTTP Error Response (status >= 400)
    // ══════════════════════════════════════════════════════════════════
    console.log(`\n${colors.bold}--- Tier 2: Rollback on HTTP Error Response (status >= 400) ---${colors.reset}`);
    {
      const initialDb = await getDbAsync();
      const initialStock = initialDb.products[0].stockKg;

      // 2A: NextResponse with status 400
      const res400 = await withDbTransaction(async (db) => {
        db.products[0].stockKg = 888888;
        return NextResponse.json({ error: 'Simulated 400 Client Validation Failure' }, { status: 400 });
      });

      check('withDbTransaction returns 400 NextResponse intact', res400.status === 400);
      check('Memory cache cleared after status 400', globalThis.__newNutsMemoryDb === undefined);

      const dbAfter400 = await getDbAsync();
      check('Stock remains initial after status 400 (not 888888)', dbAfter400.products[0].stockKg === initialStock);

      const diskAfter400 = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      check('Disk stock remains initial after status 400', diskAfter400.products[0].stockKg === initialStock);

      // 2B: Object with status 403 (Forbidden)
      const res403 = await withDbTransaction(async (db) => {
        db.products[0].stockKg = 777777;
        return { status: 403, error: 'Simulated 403 Forbidden' };
      });

      check('withDbTransaction returns 403 object intact', res403.status === 403);
      check('Memory cache cleared after status 403', globalThis.__newNutsMemoryDb === undefined);

      const dbAfter403 = await getDbAsync();
      check('Stock remains initial after status 403 (not 777777)', dbAfter403.products[0].stockKg === initialStock);

      // 2C: Object with status 500 (Internal Server Error)
      const res500 = await withDbTransaction(async (db) => {
        db.products[0].stockKg = 666666;
        return { status: 500, error: 'Simulated 500 Server Error' };
      });

      check('withDbTransaction returns 500 object intact', res500.status === 500);
      const dbAfter500 = await getDbAsync();
      check('Stock remains initial after status 500 (not 666666)', dbAfter500.products[0].stockKg === initialStock);
    }

    // ══════════════════════════════════════════════════════════════════
    // Tier 3: Concurrency Mutex & Serialized Execution Stress
    // ══════════════════════════════════════════════════════════════════
    console.log(`\n${colors.bold}--- Tier 3: Concurrency Mutex & Serialized Execution Stress ---${colors.reset}`);
    {
      const initialDb = await getDbAsync();
      const targetProduct = initialDb.products[0];
      const startStock = targetProduct.stockKg;
      const PARALLEL_COUNT = 10;
      const INCREMENT_EACH = 2.5;

      console.log(`  Spawning ${PARALLEL_COUNT} concurrent transactions incrementing stock by ${INCREMENT_EACH} kg...`);

      const tasks = Array.from({ length: PARALLEL_COUNT }, (_, idx) => {
        return withDbTransaction(async (db) => {
          // Deliberate async tick inside transaction to challenge race conditions
          await sleep(Math.floor(Math.random() * 15) + 5);
          const p = db.products.find((prod) => prod.id === targetProduct.id);
          assert.ok(p, 'Target product must exist in db');
          p.stockKg = Math.round((p.stockKg + INCREMENT_EACH) * 1000) / 1000;
          return { success: true, workerIndex: idx, stockNow: p.stockKg };
        });
      });

      const results = await Promise.all(tasks);
      check(`All ${PARALLEL_COUNT} parallel transactions completed successfully`, results.every((r) => r.success));

      const expectedFinalStock = Math.round((startStock + PARALLEL_COUNT * INCREMENT_EACH) * 1000) / 1000;
      const freshDb = await getDbAsync();
      const updatedProduct = freshDb.products.find((prod) => prod.id === targetProduct.id);

      check(
        `Final stock matches exact serialized increment (${startStock} -> ${expectedFinalStock}) without lost updates`,
        updatedProduct.stockKg === expectedFinalStock,
        `expected=${expectedFinalStock}, actual=${updatedProduct.stockKg}`
      );

      const diskDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      const diskProduct = diskDb.products.find((prod) => prod.id === targetProduct.id);
      check('Disk DB reflects serialized final stock', diskProduct.stockKg === expectedFinalStock);

      // Revert product stock back to original
      await withDbTransaction(async (db) => {
        const p = db.products.find((prod) => prod.id === targetProduct.id);
        p.stockKg = startStock;
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // Tier 4: Supply Invoice Approval Lifecycle & Re-Approval Rejection
    // ══════════════════════════════════════════════════════════════════
    console.log(`\n${colors.bold}--- Tier 4: Supply Invoice Approval Lifecycle & Re-Approval Rejection ---${colors.reset}`);
    {
      const db = await getDbAsync();
      const supplierToken = generateAdminToken(db.settings.supplierPassword, 'supplier').token;
      const adminToken = generateAdminToken(db.settings.adminPassword, 'super_admin').token;
      const cashierToken = generateAdminToken(db.settings.cashierPassword, 'cashier').token;
      const accountantToken = generateAdminToken(db.settings.accountantPassword, 'accountant').token;

      const targetProduct = db.products[1];
      const initialStock = targetProduct.stockKg;
      const initialCost = targetProduct.costPerKg;
      const supplyQty = 12.5;
      const supplyCost = Math.round((initialCost + 45) * 100) / 100;

      // 4.1: Supplier creates a pending invoice
      const createReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({
          invoiceNumber: `CHALLENGE-SUP-${Date.now()}`,
          supplierName: 'شركة النيل للتوريدات',
          notes: 'شحنة اختبار للتأكد من ذرية المعاملات',
          items: [
            {
              productId: targetProduct.id,
              productName: targetProduct.name,
              quantityKg: supplyQty,
              costPerKg: supplyCost,
            },
          ],
        }),
      });

      const createRes = await supplyPOST(createReq);
      check('POST /api/supply-invoices returns 201 Created', createRes.status === 201);
      const createData = await createRes.json();
      const invoiceId = createData.invoice.id;
      check('Created invoice has status "pending"', createData.invoice.status === 'pending');

      // Verify that while invoice is pending, inventory and cost MUST NOT CHANGE
      const dbPending = await getDbAsync();
      const prodPending = dbPending.products.find((p) => p.id === targetProduct.id);
      check('Product stock remains unchanged while invoice is pending', prodPending.stockKg === initialStock);
      check('Product cost remains unchanged while invoice is pending', prodPending.costPerKg === initialCost);

      // 4.2: Unauthorized roles attempting to approve invoice must be rejected
      const cashierApproveReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({ invoiceId, status: 'approved' }),
      });
      const cashierApproveRes = await supplyPATCH(cashierApproveReq);
      check('Cashier approval attempt rejected with 403 Forbidden', cashierApproveRes.status === 403);

      const accountantApproveReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accountantToken}`,
        },
        body: JSON.stringify({ invoiceId, status: 'approved' }),
      });
      const accountantApproveRes = await supplyPATCH(accountantApproveReq);
      check('Accountant approval attempt rejected with 403 Forbidden', accountantApproveRes.status === 403);

      const supplierApproveReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({ invoiceId, status: 'approved' }),
      });
      const supplierApproveRes = await supplyPATCH(supplierApproveReq);
      check('Supplier self-approval attempt rejected with 403 Forbidden', supplierApproveRes.status === 403);

      // 4.3: Admin approves the invoice
      const adminApproveReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          invoiceId,
          status: 'approved',
          adminNotes: 'معتمدة بالكامل من الإدارة',
        }),
      });

      const adminApproveRes = await supplyPATCH(adminApproveReq);
      check('Admin approval returns 200 OK', adminApproveRes.status === 200);
      const approveData = await adminApproveRes.json();
      check('Approved invoice status is "approved"', approveData.invoice.status === 'approved');

      // Verify atomic stock increment and cost update
      const expectedStockAfterApproval = Math.round((initialStock + supplyQty) * 1000) / 1000;
      const dbApproved = await getDbAsync();
      const prodApproved = dbApproved.products.find((p) => p.id === targetProduct.id);
      check(
        `Product stockKg atomically incremented from ${initialStock} to ${expectedStockAfterApproval}`,
        prodApproved.stockKg === expectedStockAfterApproval
      );
      check(
        `Product costPerKg updated from ${initialCost} to ${supplyCost}`,
        prodApproved.costPerKg === supplyCost
      );
      check('Product inStock flag set to true', prodApproved.inStock === true);

      // 4.4: ADVERSARIAL CHALLENGE — Re-approving an already approved invoice
      console.log(`  Testing re-approval rejection of already approved invoice (${invoiceId})...`);
      const reApproveReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          invoiceId,
          status: 'approved',
        }),
      });

      const reApproveRes = await supplyPATCH(reApproveReq);
      check('Re-approving an approved invoice returns HTTP 400 Bad Request', reApproveRes.status === 400);
      const reApproveData = await reApproveRes.json();
      check(
        'Re-approval rejection error message explains already approved status',
        reApproveData.error && reApproveData.error.includes('معتمدة بالفعل')
      );

      // Crucial: verify that stock was NOT incremented a second time!
      const dbAfterReApprove = await getDbAsync();
      const prodAfterReApprove = dbAfterReApprove.products.find((p) => p.id === targetProduct.id);
      check(
        'Product stockKg was NOT incremented again on re-approval rejection',
        prodAfterReApprove.stockKg === expectedStockAfterApproval
      );

      // 4.5: Rejection Lifecycle
      const rejectInvoiceReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({
          invoiceNumber: `CHALLENGE-REJ-${Date.now()}`,
          supplierName: 'شركة النيل للتوريدات',
          items: [
            {
              productId: targetProduct.id,
              quantityKg: 20,
              costPerKg: 300,
            },
          ],
        }),
      });

      const rejectCreateRes = await supplyPOST(rejectInvoiceReq);
      const rejectInvId = (await rejectCreateRes.json()).invoice.id;

      const adminRejectReq = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          invoiceId: rejectInvId,
          status: 'rejected',
          adminNotes: 'مرفوضة لعدم مطابقة المواصفات',
        }),
      });

      const adminRejectRes = await supplyPATCH(adminRejectReq);
      check('Admin rejection returns 200 OK', adminRejectRes.status === 200);

      const dbAfterReject = await getDbAsync();
      const prodAfterReject = dbAfterReject.products.find((p) => p.id === targetProduct.id);
      check('Product stockKg remained unchanged upon rejection', prodAfterReject.stockKg === expectedStockAfterApproval);
      check('Product costPerKg remained unchanged upon rejection', prodAfterReject.costPerKg === supplyCost);
    }

    // ══════════════════════════════════════════════════════════════════
    // Tier 5: Database JSON Integrity & Schema Health Check
    // ══════════════════════════════════════════════════════════════════
    console.log(`\n${colors.bold}--- Tier 5: Database JSON Integrity & Schema Health Check ---${colors.reset}`);
    {
      const rawDisk = fs.readFileSync(DB_PATH, 'utf-8');
      check('data/store-db.json is non-empty file', rawDisk.trim().length > 100);

      let parsedDisk;
      let validJson = false;
      try {
        parsedDisk = JSON.parse(rawDisk);
        validJson = true;
      } catch (err) {
        validJson = false;
      }
      check('data/store-db.json is strictly valid JSON without corruption', validJson);

      if (validJson) {
        check('categories array exists and has >= 6 categories', Array.isArray(parsedDisk.categories) && parsedDisk.categories.length >= 6);
        check('products array exists and has >= 20 products', Array.isArray(parsedDisk.products) && parsedDisk.products.length >= 20);
        check('orders array is intact', Array.isArray(parsedDisk.orders));
        check('supplyInvoices array is intact', Array.isArray(parsedDisk.supplyInvoices));
        check('posShifts array is intact', Array.isArray(parsedDisk.posShifts));
        check('posExpenses array is intact', Array.isArray(parsedDisk.posExpenses));
        check('vipMembers array is intact', Array.isArray(parsedDisk.vipMembers));
        check('settings object exists', typeof parsedDisk.settings === 'object' && parsedDisk.settings !== null);

        // Verify each product maintains required schema
        let allProductsValid = true;
        for (const prod of parsedDisk.products) {
          if (!prod.id || !prod.name || typeof prod.stockKg !== 'number' || !Array.isArray(prod.weights)) {
            allProductsValid = false;
            break;
          }
        }
        check('All products in database maintain valid schema and numeric stockKg', allProductsValid);

        // Verify staff credentials in settings
        const s = parsedDisk.settings;
        const credentialsValid =
          Boolean(s.adminUsername) &&
          Boolean(s.adminPassword) &&
          Boolean(s.supplierUsername) &&
          Boolean(s.supplierPassword) &&
          Boolean(s.cashierUsername) &&
          Boolean(s.cashierPassword) &&
          Boolean(s.accountantUsername) &&
          Boolean(s.accountantPassword);
        check('All 4 staff credentials exist in store settings', credentialsValid);
      }
    }

  } finally {
    // Restore initial DB backup
    if (fs.existsSync(DB_BACKUP_PATH)) {
      fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
      fs.unlinkSync(DB_BACKUP_PATH);
      console.log(`\n${colors.gray}Database state cleanly restored from backup.${colors.reset}`);
    }
  }

  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}CHALLENGE SUMMARY:${colors.reset}`);
  console.log(`  Total Checks : ${totalChecks}`);
  console.log(`  Passed       : ${colors.green}${passedChecks}${colors.reset}`);
  console.log(`  Failed       : ${failedChecks > 0 ? colors.red + failedChecks + colors.reset : '0'}`);
  console.log(`  Pass Rate    : ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (failedChecks > 0) {
    console.error(`${colors.red}CHALLENGE FAILED with ${failedChecks} failures.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}🎉 ALL EMPIRICAL CHALLENGES PASSED WITH ZERO DEFECTS!${colors.reset}\n`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal unhandled error in challenge runner:', err);
  if (fs.existsSync(DB_BACKUP_PATH)) {
    fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
    fs.unlinkSync(DB_BACKUP_PATH);
  }
  process.exit(1);
});
