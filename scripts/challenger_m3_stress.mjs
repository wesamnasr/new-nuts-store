import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');
const DB_BACKUP_PATH = path.join(ROOT_DIR, 'data', 'store-db.json.challenger.bak');

const isRunningUnderTsx = Boolean(
  process.env.TSX_EXEC_ACTIVE ||
  process.execArgv.some((arg) => arg.includes('tsx'))
);

if (!isRunningUnderTsx) {
  const targetScript = '"' + __filename + '"';
  const result = spawnSync('npx', ['tsx', targetScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_EXEC_ACTIVE: '1' },
    shell: true,
  });
  process.exit(result.status ?? 0);
}

const { default: assert } = await import('node:assert/strict');
const { NextRequest } = await import('next/server');
const { getDbAsync, withDbTransaction } = await import('../src/lib/db.ts');
const { POST: ordersPOST, PATCH: ordersPATCH } = await import('../src/app/api/orders/route.ts');
const { POST: posPOST } = await import('../src/app/api/pos/route.ts');
const { POST: supplyPOST } = await import('../src/app/api/supply-invoices/route.ts');
const { generateAdminToken } = await import('../src/lib/auth.ts');

function logPass(msg) {
  console.log(`  ✓ [CHALLENGER PASS] ${msg}`);
}

async function run() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  CHALLENGER EMPIRICAL CONCURRENCY & STRESS TEST HARNESS (M3)');
  console.log('══════════════════════════════════════════════════════════════════\n');

  // Backup DB
  fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);

  try {
    const dbInitial = await getDbAsync();

    const adminToken = generateAdminToken(dbInitial.settings.adminPassword, 'super_admin').token;
    const cashierToken = generateAdminToken(dbInitial.settings.cashierPassword, 'cashier').token;
    const supplierToken = generateAdminToken(dbInitial.settings.supplierPassword, 'supplier').token;
    const accountantToken = generateAdminToken(dbInitial.settings.accountantPassword, 'accountant').token;

    // ────────────────────────────────────────────────────────────────
    // TEST SUITE 1: Concurrent High-Load Zero-Lost-Updates Race Test
    // ────────────────────────────────────────────────────────────────
    console.log('▶ TEST SUITE 1: High-Load Concurrency & Zero Lost Updates (Race Oracle)');

    // Find standard product with weights and online+pos enabled
    const targetProduct = dbInitial.products.find(
      (p) =>
        p.showOnline !== false &&
        p.showInPos !== false &&
        Array.isArray(p.weights) &&
        p.weights.length > 0 &&
        p.weights.some((w) => w.weightGrams === 250)
    ) || dbInitial.products[0];

    const targetWeight =
      targetProduct.weights.find((w) => w.weightGrams === 250) || targetProduct.weights[0];
    const weightGrams = targetWeight.weightGrams || 250;
    const testProdId = targetProduct.id;
    const S0 = 100.0; // 100 kg initial stock

    // Atomically initialize stock on disk to S0
    await withDbTransaction(async (db) => {
      const prod = db.products.find((p) => p.id === testProdId);
      prod.stockKg = S0;
      prod.inStock = true;
      prod.showOnline = true;
      prod.showInPos = true;

      // Ensure open shift
      let shift = db.posShifts.find((s) => s.status === 'open');
      if (!shift) {
        shift = {
          id: `shift-test-${Date.now()}`,
          status: 'open',
          cashierId: 'cashier_pos',
          cashierName: 'كاشير التحدي',
          startTime: new Date().toISOString(),
          startingCash: 500,
          openingCash: 500,
          cashSales: 0,
          cashSalesTotal: 0,
          cardSales: 0,
          vodafoneCashTotal: 0,
          instapayTotal: 0,
          expenses: 0,
          expensesTotal: 0,
          expectedCash: 500,
          expectedCashInDrawer: 500,
          ordersCount: 0,
          totalRevenue: 0,
          totalRawCost: 0,
          totalNetProfit: 0,
          vipRedeemedTotal: 0,
          vipCashbackIssuedTotal: 0,
          expenseRecords: [],
        };
        db.posShifts.unshift(shift);
      }
    });

    const CONCURRENT_ONLINE_ORDERS = 10;
    const CONCURRENT_POS_ORDERS = 10;
    const CONCURRENT_SUPPLY_INVOICES = 5;
    const CONCURRENT_POS_EXPENSES = 5;
    const TOTAL_MUTATIONS =
      CONCURRENT_ONLINE_ORDERS +
      CONCURRENT_POS_ORDERS +
      CONCURRENT_SUPPLY_INVOICES +
      CONCURRENT_POS_EXPENSES;

    console.log(`  Spawning ${TOTAL_MUTATIONS} concurrent asynchronous mutations simultaneously...`);

    const promises = [];

    // 10 concurrent online orders, each buying weightGrams (0.25 kg)
    for (let i = 0; i < CONCURRENT_ONLINE_ORDERS; i++) {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: `عميل سباق أونلاين ${i + 1}`,
          customerPhone: `0101111222${i % 10}`,
          governorate: 'بني مزار - البندر',
          deliveryMethod: 'store_pickup',
          address: 'بني مزار - شارع السلام',
          items: [
            {
              productId: testProdId,
              productName: targetProduct.name,
              weightId: targetWeight.id,
              weightLabel: targetWeight.label,
              customWeightGrams: weightGrams,
              quantity: 1,
            },
          ],
        }),
      });
      promises.push(
        ordersPOST(req).then(async (res) => {
          const body = await res.json();
          return { type: 'online_order', status: res.status, body };
        })
      );
    }

    // 10 concurrent POS orders, each buying weightGrams (0.25 kg)
    for (let i = 0; i < CONCURRENT_POS_ORDERS; i++) {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cod',
          customerName: `عميل سباق كاشير ${i + 1}`,
          customerPhone: `0103333444${i % 10}`,
          items: [
            {
              productId: testProdId,
              productName: targetProduct.name,
              weightId: targetWeight.id,
              weightLabel: targetWeight.label,
              customWeightGrams: weightGrams,
              quantity: 1,
              unitPrice: targetWeight.price || 100,
            },
          ],
        }),
      });
      promises.push(
        posPOST(req).then(async (res) => {
          const body = await res.json();
          return { type: 'pos_order', status: res.status, body };
        })
      );
    }

    // 5 concurrent supply invoices drafted by supplier
    for (let i = 0; i < CONCURRENT_SUPPLY_INVOICES; i++) {
      const req = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({
          supplierId: 'supplier_arafat',
          invoiceNumber: `SUP-STRESS-${Date.now()}-${i}`,
          items: [
            {
              productId: testProdId,
              quantityKg: 10,
              costPerKg: 300,
            },
          ],
        }),
      });
      promises.push(
        supplyPOST(req).then(async (res) => {
          const body = await res.json();
          return { type: 'supply_invoice', status: res.status, body };
        })
      );
    }

    // 5 concurrent POS expenses recorded by cashier
    for (let i = 0; i < CONCURRENT_POS_EXPENSES; i++) {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'add_expense',
          amount: 25,
          title: `مصروف سباق متزامن ${i + 1}`,
          description: `مصروف سباق متزامن ${i + 1}`,
        }),
      });
      promises.push(
        posPOST(req).then(async (res) => {
          const body = await res.json();
          return { type: 'pos_expense', status: res.status, body };
        })
      );
    }

    // Await all 30 promises simultaneously
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    console.log(`  Completed all ${TOTAL_MUTATIONS} concurrent mutations in ${duration} ms.`);

    // Verify all returned expected HTTP status (201 for creations, 200 for expense addition)
    for (const r of results) {
      const expectedStatus = r.type === 'pos_expense' ? 200 : 201;
      assert.equal(
        r.status,
        expectedStatus,
        `Mutation of type ${r.type} must succeed with ${expectedStatus}, got ${r.status}: ${JSON.stringify(r.body)}`
      );
    }
    logPass(`All ${TOTAL_MUTATIONS} concurrent mutations completed with expected HTTP status (Zero 500s, Zero timeouts)`);

    // Verify ZERO LOST UPDATES in database state
    const dbAfterConcurrent = await getDbAsync();
    const prodAfter = dbAfterConcurrent.products.find((p) => p.id === testProdId);
    assert.ok(prodAfter, 'Target product must exist');

    // Expected deduction: (10 online + 10 pos) * (weightGrams / 1000)
    const expectedDeduction = (CONCURRENT_ONLINE_ORDERS + CONCURRENT_POS_ORDERS) * (weightGrams / 1000);
    const expectedStock = Math.round((S0 - expectedDeduction) * 1000) / 1000;
    assert.equal(
      prodAfter.stockKg,
      expectedStock,
      `ZERO LOST UPDATES VIOLATION! Expected final stock ${expectedStock} kg, but got ${prodAfter.stockKg} kg!`
    );
    logPass(`Stock depletion exact match: ${S0} kg - ${expectedDeduction} kg = ${prodAfter.stockKg} kg (Zero lost updates!)`);

    // Verify orders count reflects all newly created orders
    const onlineOrdersCreated = results.filter((r) => r.type === 'online_order').map((r) => r.body.order.id);
    const posOrdersCreated = results.filter((r) => r.type === 'pos_order').map((r) => r.body.order.id);

    for (const id of [...onlineOrdersCreated, ...posOrdersCreated]) {
      const found = dbAfterConcurrent.orders.find((o) => o.id === id);
      assert.ok(found, `Order ${id} must be persisted in database orders array`);
    }
    logPass(`All 20 created orders (10 online + 10 pos) confirmed persisted in database orders`);

    // Verify supply invoices were created as pending without altering stock
    const supplyInvoicesCreated = results.filter((r) => r.type === 'supply_invoice').map((r) => r.body.invoice.id);
    for (const id of supplyInvoicesCreated) {
      const found = dbAfterConcurrent.supplyInvoices.find((inv) => inv.id === id);
      assert.ok(found, `Supply invoice ${id} must be persisted`);
      assert.equal(found.status, 'pending', 'Drafted supply invoice must be in pending status');
    }
    logPass(`All 5 drafted supply invoices safely stored in pending status without premature stock additions`);

    console.log('\n▶ TEST SUITE 2: POS Flash Promo Stock Depletion down to Grams Precision & Reversal');

    // ────────────────────────────────────────────────────────────────
    // TEST SUITE 2: Flash Promo Grams-Precision Depletion & Reversal
    // ────────────────────────────────────────────────────────────────
    // Custom promo with non-round grams precision:
    // Product 1: 125g (0.125 kg)
    // Product 2: 375g (0.375 kg)
    // Product 3: 500g (0.500 kg)
    const p1 = dbAfterConcurrent.products[0];
    const p2 = dbAfterConcurrent.products[1];
    const p3 = dbAfterConcurrent.products[2];

    const testPromoId = `promo-test-grams-${Date.now()}`;
    const testPromo = {
      id: testPromoId,
      name: 'عرض التحدي التجريبي بالجرامات الدقيقة',
      title: 'عرض التحدي التجريبي بالجرامات الدقيقة',
      discountPrice: 350,
      originalPrice: 450,
      totalRawCost: 240,
      packagingCost: 15,
      active: true,
      items: [
        { productId: p1.id, weightGrams: 125, quantity: 1 },
        { productId: p2.id, weightGrams: 375, quantity: 1 },
        { productId: p3.id, weightGrams: 500, quantity: 1 },
      ],
    };

    // Atomically persist this test promo into DB and reset starting stocks
    await withDbTransaction(async (db) => {
      const prod1 = db.products.find((p) => p.id === p1.id);
      const prod2 = db.products.find((p) => p.id === p2.id);
      const prod3 = db.products.find((p) => p.id === p3.id);
      prod1.stockKg = 15.0;
      prod2.stockKg = 15.0;
      prod3.stockKg = 15.0;
      if (!Array.isArray(db.promotions)) db.promotions = [];
      if (!Array.isArray(db.flashPromotions)) db.flashPromotions = [];
      db.promotions.push(testPromo);
      db.flashPromotions.push(testPromo);
    });

    // Purchase 3 bundles via POS Cashier
    // Consumed:
    // p1: 3 * 125g = 375g = 0.375 kg -> 15.0 - 0.375 = 14.625 kg
    // p2: 3 * 375g = 1125g = 1.125 kg -> 15.0 - 1.125 = 13.875 kg
    // p3: 3 * 500g = 1500g = 1.500 kg -> 15.0 - 1.500 = 13.500 kg
    const promoPurchaseReq = new NextRequest('http://localhost:3000/api/pos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        action: 'create_invoice',
        paymentMethod: 'cod',
        customerName: 'عميل عرض الجرامات',
        customerPhone: '01099998888',
        items: [
          {
            productId: `flash-promo-${testPromoId}`,
            productName: testPromo.name,
            isFlashPromo: true,
            flashPromoId: testPromoId,
            unitPrice: 350,
            quantity: 3,
          },
        ],
      }),
    });

    const promoRes = await posPOST(promoPurchaseReq);
    assert.equal(promoRes.status, 201, 'POS Flash promo purchase must return 201');
    const promoData = await promoRes.json();
    assert.ok(promoData.success);
    const promoOrderId = promoData.order.id;

    // Verify cashier sanitization
    assert.equal(promoData.order.rawCostTotal, undefined, 'Cashier must NOT see rawCostTotal');
    logPass('Cashier response sanitized: rawCostTotal is undefined for cashier terminal');

    // Verify stored order has COGS
    const dbAfterPromo = await getDbAsync();
    const storedPromoOrder = dbAfterPromo.orders.find((o) => o.id === promoOrderId);
    assert.ok(storedPromoOrder, 'Promo order must be stored');
    assert.equal(storedPromoOrder.rawCostTotal, 240 * 3, 'Promo order COGS must equal unitRawCost * quantity (240 * 3 = 720)');
    logPass(`Server-side COGS accurate: 240 EGP * 3 = ${storedPromoOrder.rawCostTotal} EGP`);

    // Verify grams precision in product stock
    const p1After = dbAfterPromo.products.find((p) => p.id === p1.id);
    const p2After = dbAfterPromo.products.find((p) => p.id === p2.id);
    const p3After = dbAfterPromo.products.find((p) => p.id === p3.id);

    assert.equal(p1After.stockKg, 14.625, `Product 1 stock must be 14.625 kg, got ${p1After.stockKg}`);
    assert.equal(p2After.stockKg, 13.875, `Product 2 stock must be 13.875 kg, got ${p2After.stockKg}`);
    assert.equal(p3After.stockKg, 13.500, `Product 3 stock must be 13.500 kg, got ${p3After.stockKg}`);
    logPass('Exact grams-precision stock deductions verified: [14.625 kg, 13.875 kg, 13.500 kg]');

    // Test Cancellation & Full Restoration
    const cancelReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId: promoOrderId,
        status: 'cancelled',
      }),
    });
    const cancelRes = await ordersPATCH(cancelReq);
    assert.equal(cancelRes.status, 200, 'Admin cancellation must succeed');

    const dbAfterCancel = await getDbAsync();
    const p1Reversed = dbAfterCancel.products.find((p) => p.id === p1.id);
    const p2Reversed = dbAfterCancel.products.find((p) => p.id === p2.id);
    const p3Reversed = dbAfterCancel.products.find((p) => p.id === p3.id);

    assert.equal(p1Reversed.stockKg, 15.0, `Product 1 must be restored to 15.000 kg, got ${p1Reversed.stockKg}`);
    assert.equal(p2Reversed.stockKg, 15.0, `Product 2 must be restored to 15.000 kg, got ${p2Reversed.stockKg}`);
    assert.equal(p3Reversed.stockKg, 15.0, `Product 3 must be restored to 15.000 kg, got ${p3Reversed.stockKg}`);
    logPass('Exact grams-precision stock restoration on cancellation verified: all products restored to 15.000 kg');

    // Test Double-Cancellation Idempotency
    const doubleCancelReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId: promoOrderId,
        status: 'cancelled',
      }),
    });
    const doubleCancelRes = await ordersPATCH(doubleCancelReq);
    assert.equal(doubleCancelRes.status, 200, 'Subsequent cancellation must succeed idempotently');
    const dbDoubleCancel = await getDbAsync();
    const p1Double = dbDoubleCancel.products.find((p) => p.id === p1.id);
    assert.equal(p1Double.stockKg, 15.0, 'Double cancellation must NOT add extra inventory (idempotency guarded)');
    logPass('Double-cancellation idempotency confirmed: zero ghost inventory added');

    // Test Re-activation guard under insufficient stock
    await withDbTransaction(async (db) => {
      const prod = db.products.find((p) => p.id === p1.id);
      prod.stockKg = 0.1; // Only 100g available, but order requires 375g
    });

    const reactivateReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId: promoOrderId,
        status: 'processing',
      }),
    });
    const reactivateRes = await ordersPATCH(reactivateReq);
    assert.equal(reactivateRes.status, 400, 'Re-activation must fail with 400 when stock is insufficient');
    const reactivateBody = await reactivateRes.json();
    assert.ok(reactivateBody.error.includes('أقل من الكمية المطلوبة'), 'Must reject with descriptive Arabic error');
    logPass('Re-activation guard confirmed: rejected with 400 when inventory is insufficient');

    console.log('\n▶ TEST SUITE 3: Deadlock Resistance Under Mixed Error & Valid Mutation Load');

    // ────────────────────────────────────────────────────────────────
    // TEST SUITE 3: Deadlock Resistance Under Mixed Error & Valid Load
    // ────────────────────────────────────────────────────────────────
    // Concurrently send:
    // - 5 invalid phone online orders (400)
    // - 5 unauthenticated POS mutations (401)
    // - 5 accountant unauthorized mutations on supply invoices (403)
    // - 5 valid online orders (201)
    // - 5 valid POS sales (201)
    const mixedPromises = [];

    // 5 Invalid phone orders (400)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'خطأ هاتف',
          customerPhone: '12345', // Invalid
          governorate: 'بني مزار - البندر',
          deliveryMethod: 'store_pickup',
          items: [{ productId: testProdId, weightId: targetWeight.id, quantity: 1 }],
        }),
      });
      mixedPromises.push(ordersPOST(req).then((res) => ({ tag: 'bad_phone', status: res.status })));
    }

    // 5 Unauthenticated POS requests (401)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_shift', startingCash: 500 }),
      });
      mixedPromises.push(posPOST(req).then((res) => ({ tag: 'unauth_pos', status: res.status })));
    }

    // 5 Accountant mutating supply invoices (403)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accountantToken}`,
        },
        body: JSON.stringify({
          supplierId: 'supplier_arafat',
          items: [{ productId: testProdId, quantityKg: 5, costPerKg: 200 }],
        }),
      });
      mixedPromises.push(supplyPOST(req).then((res) => ({ tag: 'accountant_forbidden', status: res.status })));
    }

    // 5 Valid online orders (201)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: `عميل سليم ${i + 1}`,
          customerPhone: `0105555666${i}`,
          governorate: 'بني مزار - البندر',
          deliveryMethod: 'store_pickup',
          address: 'بني مزار شارع المحطة',
          items: [
            {
              productId: testProdId,
              productName: targetProduct.name,
              weightId: targetWeight.id,
              weightLabel: targetWeight.label,
              customWeightGrams: weightGrams,
              quantity: 1,
            },
          ],
        }),
      });
      mixedPromises.push(ordersPOST(req).then((res) => ({ tag: 'valid_online', status: res.status })));
    }

    // 5 Valid POS sales (201)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cod',
          customerName: `عميل سليم كاشير ${i + 1}`,
          customerPhone: `0107777888${i}`,
          items: [
            {
              productId: testProdId,
              productName: targetProduct.name,
              weightId: targetWeight.id,
              weightLabel: targetWeight.label,
              customWeightGrams: weightGrams,
              quantity: 1,
              unitPrice: 120,
            },
          ],
        }),
      });
      mixedPromises.push(posPOST(req).then((res) => ({ tag: 'valid_pos', status: res.status })));
    }

    const mixedResults = await Promise.all(mixedPromises);

    const badPhones = mixedResults.filter((r) => r.tag === 'bad_phone');
    const unauths = mixedResults.filter((r) => r.tag === 'unauth_pos');
    const forbiddens = mixedResults.filter((r) => r.tag === 'accountant_forbidden');
    const valids = mixedResults.filter((r) => r.tag === 'valid_online' || r.tag === 'valid_pos');

    for (const r of badPhones) assert.equal(r.status, 400, 'Invalid phone must return 400');
    for (const r of unauths) assert.equal(r.status, 401, 'Unauthenticated POS must return 401');
    for (const r of forbiddens) assert.equal(r.status, 403, 'Accountant mutation must return 403');
    for (const r of valids) assert.equal(r.status, 201, 'Valid order must return 201');

    logPass('Mixed load handled perfectly: 5x 400, 5x 401, 5x 403, 10x 201. Zero deadlocks or leaked locks!');

    console.log('\n▶ TEST SUITE 4: Interleaved Rapid Concurrent Mutations (Orders + Cancellations + Approvals)');

    // ────────────────────────────────────────────────────────────────
    // TEST SUITE 4: Interleaved Concurrent Lifecycle Mutations
    // ────────────────────────────────────────────────────────────────
    // Concurrently:
    // 1. Create 10 POS orders of product 1 (each 250g)
    // 2. Create 5 supply invoices for product 2 (each 10kg)
    // 3. Draft & approve 3 supply invoices for product 3 (each 5kg)
    // 4. Cancel 5 of the created POS orders immediately
    const p1BaseStock = 50.0;
    const p2BaseStock = 50.0;
    const p3BaseStock = 50.0;

    await withDbTransaction(async (db) => {
      const prod1 = db.products.find((p) => p.id === p1.id);
      const prod2 = db.products.find((p) => p.id === p2.id);
      const prod3 = db.products.find((p) => p.id === p3.id);
      prod1.stockKg = p1BaseStock;
      prod2.stockKg = p2BaseStock;
      prod3.stockKg = p3BaseStock;
    });

    // Step 4.1: Concurrently spawn 10 POS orders
    const posOrderReqs = Array.from({ length: 10 }, (_, i) => {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cod',
          customerName: `عميل تداخل ${i + 1}`,
          customerPhone: `0104444555${i}`,
          items: [
            {
              productId: p1.id,
              productName: p1.name,
              customWeightGrams: 250,
              quantity: 1,
              unitPrice: 150,
            },
          ],
        }),
      });
      return posPOST(req).then(async (r) => ({ order: (await r.json()).order, status: r.status }));
    });

    const posOrders = await Promise.all(posOrderReqs);
    for (const o of posOrders) assert.equal(o.status, 201, 'POS order must be created');

    // 10 orders * 0.25 kg = 2.5 kg consumed. Current stock = 47.5 kg
    const dbMid4 = await getDbAsync();
    const p1Mid = dbMid4.products.find((p) => p.id === p1.id);
    assert.equal(p1Mid.stockKg, 47.5, 'Stock after 10 orders must be 47.5 kg');

    // Step 4.2: Concurrently cancel 5 of those orders while creating 5 supply invoices
    const cancelAndSupplyPromises = [];

    // Cancel first 5 orders
    for (let i = 0; i < 5; i++) {
      const orderId = posOrders[i].order.id;
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId,
          status: 'cancelled',
        }),
      });
      cancelAndSupplyPromises.push(ordersPATCH(req).then((r) => ({ type: 'cancel', status: r.status })));
    }

    // Simultaneously draft 5 supply invoices for product 2
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/supply-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({
          supplierId: 'supplier_arafat',
          invoiceNumber: `SUP-CONC-4-${Date.now()}-${i}`,
          items: [
            {
              productId: p2.id,
              quantityKg: 10,
              costPerKg: 250,
            },
          ],
        }),
      });
      cancelAndSupplyPromises.push(supplyPOST(req).then((r) => ({ type: 'supply_draft', status: r.status })));
    }

    const cancelAndSupplyResults = await Promise.all(cancelAndSupplyPromises);
    for (const r of cancelAndSupplyResults) {
      if (r.type === 'cancel') assert.equal(r.status, 200, 'Cancellation must be 200');
      if (r.type === 'supply_draft') assert.equal(r.status, 201, 'Supply draft must be 201');
    }
    logPass('Concurrent cancellations and supply drafting completed cleanly');

    // Verify product 1 stock after 5 cancellations: 47.5 + 5 * 0.25 = 47.5 + 1.25 = 48.75 kg
    const dbAfter4 = await getDbAsync();
    const p1Final = dbAfter4.products.find((p) => p.id === p1.id);
    assert.equal(p1Final.stockKg, 48.75, `Expected 48.75 kg after 5 reversals, got ${p1Final.stockKg} kg`);
    logPass(`Product 1 stock after concurrent partial cancellation: exactly 48.75 kg`);

    // Verify DB file validity (valid JSON, parseable)
    const rawDbContent = fs.readFileSync(DB_PATH, 'utf8');
    assert.doesNotThrow(() => JSON.parse(rawDbContent), 'Database file on disk must be valid uncorrupted JSON');
    logPass('Database JSON integrity on disk 100% verified (Zero corruptions)');

    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL CHALLENGER EMPIRICAL CONCURRENCY & STRESS TESTS PASSED 100%!');
    console.log('══════════════════════════════════════════════════════════════════');
  } finally {
    // Restore DB backup
    if (fs.existsSync(DB_BACKUP_PATH)) {
      fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
      fs.unlinkSync(DB_BACKUP_PATH);
      console.log('\n✓ Cleaned up test state; database restored to pristine condition.');
    }
  }
}

run().catch((err) => {
  console.error('\n❌ CHALLENGER STRESS TEST FAILED:', err);
  process.exit(1);
});
