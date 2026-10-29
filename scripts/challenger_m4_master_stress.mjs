/**
 * Master Adversarial Concurrency & Stress Verification Suite — Milestone M4
 * Agent: challenger_m4_master
 * 
 * Verifies:
 *   1. Multi-Portal Cross-Concurrency: 30 concurrent mutations across Orders, POS, Supply Invoices & Expenses
 *   2. Custom Mix Boxes Dynamic Pricing: Proportional calculations for 500g, 1000g, 2000g & live order integration
 *   3. POS Shift Accounting: Expected cash and variance under surplus, shortage, exact match, and electronic payments
 *   4. Master Forensic Invariant Check: Zero corruptions, HAFSA_AC_01_03 (all 29 products with exact 4 weights)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');
const DB_BACKUP_PATH = path.join(ROOT_DIR, 'data', 'store-db.json.m4_master.bak');

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
const {
  calculateCustomBoxPrice,
  getProductBasePriceForBox,
  getResolvedProductWeights,
} = await import('../src/lib/pricing.ts');

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

async function runMasterStressSuite() {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  MASTER ADVERSARIAL & STRESS VERIFICATION SUITE — MILESTONE M4   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);

  try {
    const dbInitial = await getDbAsync();

    const adminToken = generateAdminToken(dbInitial.settings.adminPassword, 'super_admin').token;
    const cashierToken = generateAdminToken(dbInitial.settings.cashierPassword, 'cashier').token;
    const supplierToken = generateAdminToken(dbInitial.settings.supplierPassword, 'supplier').token;

    // ────────────────────────────────────────────────────────────────
    // TIER 1: Multi-Portal Cross-Concurrency & Race Stress
    // ────────────────────────────────────────────────────────────────
    console.log(`${colors.bold}▶ TIER 1: Multi-Portal Cross-Concurrency & Race Stress (30 Mutations)${colors.reset}`);
    {
      const prodA = dbInitial.products[0];
      const prodB = dbInitial.products[1];
      const prodA_id = prodA.id;
      const prodB_id = prodB.id;

      const initStockA = 100.0;
      const initStockB = 100.0;

      // Seed pristine initial stocks and ensure open shift
      await withDbTransaction(async (db) => {
        const pA = db.products.find((p) => p.id === prodA_id);
        const pB = db.products.find((p) => p.id === prodB_id);
        pA.stockKg = initStockA;
        pA.inStock = true;
        pA.showOnline = true;
        pA.showInPos = true;

        pB.stockKg = initStockB;
        pB.inStock = true;
        pB.showOnline = true;
        pB.showInPos = true;

        let openShift = db.posShifts.find((s) => s.status === 'open');
        if (!openShift) {
          openShift = {
            id: `shift-m4-${Date.now()}`,
            shiftNumber: 'SHIFT-M4-01',
            status: 'open',
            cashierId: 'cashier_pos',
            cashierName: 'كاشير التحدي الشامل',
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
          };
          db.posShifts.unshift(openShift);
        }
      });

      const N_ONLINE = 10;
      const N_POS = 10;
      const N_SUPPLY = 5;
      const N_EXPENSES = 5;
      const TOTAL_OPS = N_ONLINE + N_POS + N_SUPPLY + N_EXPENSES;

      console.log(`  Spawning ${TOTAL_OPS} concurrent transactions across Online, POS, Supply & Expenses...`);
      const startT = performance.now();
      const promises = [];

      // 10 Online orders: each buys 250g (0.25kg) of ProdA
      for (let i = 0; i < N_ONLINE; i++) {
        const req = new NextRequest('http://localhost:3000/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: `عميل أونلاين متزامن ${i + 1}`,
            customerPhone: `010000000${i.toString().padStart(2, '0')}`,
            governorate: 'بني مزار - البندر',
            deliveryMethod: 'store_pickup',
            address: 'شارع الجمهورية',
            items: [
              {
                productId: prodA_id,
                productName: prodA.name,
                weightLabel: 'ربع 250 جم',
                customWeightGrams: 250,
                quantity: 1,
              },
            ],
          }),
        });
        promises.push(
          ordersPOST(req).then(async (res) => ({
            type: 'online_order',
            status: res.status,
            body: await res.json(),
          }))
        );
      }

      // 10 POS orders: each buys 500g (0.5kg) of ProdB
      for (let i = 0; i < N_POS; i++) {
        const req = new NextRequest('http://localhost:3000/api/pos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${cashierToken}`,
          },
          body: JSON.stringify({
            action: 'create_invoice',
            paymentMethod: 'cod',
            customerName: `عميل كاشير متزامن ${i + 1}`,
            items: [
              {
                productId: prodB_id,
                productName: prodB.name,
                weightLabel: 'نصف 500 جم',
                customWeightGrams: 500,
                quantity: 1,
                unitPrice: 150,
              },
            ],
          }),
        });
        promises.push(
          posPOST(req).then(async (res) => ({
            type: 'pos_order',
            status: res.status,
            body: await res.json(),
          }))
        );
      }

      // 5 Supply Invoices drafted: each drafts 10kg for ProdA (stock must remain unchanged until approval)
      for (let i = 0; i < N_SUPPLY; i++) {
        const req = new NextRequest('http://localhost:3000/api/supply-invoices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${supplierToken}`,
          },
          body: JSON.stringify({
            supplierId: 'supplier_arafat',
            invoiceNumber: `SUP-M4-RACE-${Date.now()}-${i}`,
            items: [{ productId: prodA_id, quantityKg: 10, costPerKg: 350 }],
          }),
        });
        promises.push(
          supplyPOST(req).then(async (res) => ({
            type: 'supply_invoice',
            status: res.status,
            body: await res.json(),
          }))
        );
      }

      // 5 POS Expenses: each adds 20 EGP expense
      for (let i = 0; i < N_EXPENSES; i++) {
        const req = new NextRequest('http://localhost:3000/api/pos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${cashierToken}`,
          },
          body: JSON.stringify({
            action: 'add_expense',
            amount: 20,
            title: `مصروف متزامن M4 #${i + 1}`,
          }),
        });
        promises.push(
          posPOST(req).then(async (res) => ({
            type: 'pos_expense',
            status: res.status,
            body: await res.json(),
          }))
        );
      }

      const results = await Promise.all(promises);
      const elapsed = Math.round(performance.now() - startT);
      console.log(`  Completed all ${TOTAL_OPS} concurrent transactions in ${elapsed}ms.`);

      const onlineResults = results.filter((r) => r.type === 'online_order');
      const posResults = results.filter((r) => r.type === 'pos_order');
      const supplyResults = results.filter((r) => r.type === 'supply_invoice');
      const expenseResults = results.filter((r) => r.type === 'pos_expense');

      check(
        'All 10 online orders succeeded with HTTP 201',
        onlineResults.every((r) => r.status === 201)
      );
      check(
        'All 10 POS orders succeeded with HTTP 201',
        posResults.every((r) => r.status === 201)
      );
      check(
        'All 5 supply invoices drafted with HTTP 201',
        supplyResults.every((r) => r.status === 201)
      );
      check(
        'All 5 POS expenses recorded with HTTP 200',
        expenseResults.every((r) => r.status === 200)
      );

      // Verify DB post-concurrency state
      const dbAfter = await getDbAsync();
      const pA_after = dbAfter.products.find((p) => p.id === prodA_id);
      const pB_after = dbAfter.products.find((p) => p.id === prodB_id);

      // Expected stock A: 100 - (10 * 0.25) = 97.5 kg (supply invoices are pending so 0 added)
      const expectedA = 100 - (10 * 0.25);
      check(
        `Product A stock decremented accurately: ${initStockA} - 2.5 = ${expectedA} kg (actual: ${pA_after.stockKg} kg)`,
        Math.abs(pA_after.stockKg - expectedA) < 0.001
      );

      // Expected stock B: 100 - (10 * 0.5) = 95.0 kg
      const expectedB = 100 - (10 * 0.5);
      check(
        `Product B stock decremented accurately: ${initStockB} - 5.0 = ${expectedB} kg (actual: ${pB_after.stockKg} kg)`,
        Math.abs(pB_after.stockKg - expectedB) < 0.001
      );

      // Verify all drafted invoices remain pending
      const createdInvoiceIds = supplyResults.map((r) => r.body.invoice?.id).filter(Boolean);
      const allPending = createdInvoiceIds.every((id) => {
        const inv = dbAfter.supplyInvoices.find((i) => i.id === id);
        return inv && inv.status === 'pending';
      });
      check('All drafted supply invoices safely stored in pending status without premature stock additions', allPending);
    }

    // ────────────────────────────────────────────────────────────────
    // TIER 2: Custom Mix Boxes Dynamic Pricing & Tracking Integration
    // ────────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}▶ TIER 2: Custom Mix Boxes Dynamic Pricing & Tracking Schema Stress${colors.reset}`);
    {
      const db = await getDbAsync();
      const p0 = db.products[0];
      const p1 = db.products[1];
      const p2 = db.products[2];
      const p3 = db.products[3];

      // Test 500g box with 50% + 50%
      const calc500 = calculateCustomBoxPrice(500, [
        { product: p0, percentage: 50, roastOption: 'محمص مملح' },
        { product: p1, percentage: 50, roastOption: 'محمص بدون ملح' },
      ]);
      check('500g custom box calculation is valid (100% capacity)', calc500.isValid === true);
      const base0_500 = getProductBasePriceForBox(p0, 500);
      const base1_500 = getProductBasePriceForBox(p1, 500);
      const expected500Price = Math.round(base0_500 * 0.5) + Math.round(base1_500 * 0.5);
      check(
        `500g dynamic price matches formula: ${expected500Price} EGP (actual: ${calc500.totalPrice} EGP)`,
        calc500.totalPrice === expected500Price
      );

      // Test 1000g box with 25% * 4
      const calc1000 = calculateCustomBoxPrice(1000, [
        { product: p0, percentage: 25, roastOption: 'محمص مملح' },
        { product: p1, percentage: 25, roastOption: 'محمص بدون ملح' },
        { product: p2, percentage: 25, roastOption: 'محمص ليمون' },
        { product: p3, percentage: 25, roastOption: 'نيء طبيعي' },
      ]);
      check('1000g custom box calculation is valid (4x 25%)', calc1000.isValid === true);
      const expected1000Price =
        Math.round(getProductBasePriceForBox(p0, 1000) * 0.25) +
        Math.round(getProductBasePriceForBox(p1, 1000) * 0.25) +
        Math.round(getProductBasePriceForBox(p2, 1000) * 0.25) +
        Math.round(getProductBasePriceForBox(p3, 1000) * 0.25);
      check(
        `1000g dynamic price matches formula: ${expected1000Price} EGP (actual: ${calc1000.totalPrice} EGP)`,
        calc1000.totalPrice === expected1000Price
      );

      // Test 2000g box with 40%, 30%, 20%, 10%
      const calc2000 = calculateCustomBoxPrice(2000, [
        { product: p0, percentage: 40, roastOption: 'محمص مملح' },
        { product: p1, percentage: 30, roastOption: 'محمص بدون ملح' },
        { product: p2, percentage: 20, roastOption: 'محمص ليمون' },
        { product: p3, percentage: 10, roastOption: 'نيء طبيعي' },
      ]);
      check('2000g custom box calculation is valid (100% capacity)', calc2000.isValid === true);
      const expected2000Price =
        Math.round(getProductBasePriceForBox(p0, 2000) * 0.4) +
        Math.round(getProductBasePriceForBox(p1, 2000) * 0.3) +
        Math.round(getProductBasePriceForBox(p2, 2000) * 0.2) +
        Math.round(getProductBasePriceForBox(p3, 2000) * 0.1);
      check(
        `2000g dynamic price matches formula: ${expected2000Price} EGP (actual: ${calc2000.totalPrice} EGP)`,
        calc2000.totalPrice === expected2000Price
      );

      // Edge cases:
      const calcUnder = calculateCustomBoxPrice(1000, [
        { product: p0, percentage: 50, roastOption: 'محمص مملح' },
        { product: p1, percentage: 49.9, roastOption: 'محمص بدون ملح' },
      ]);
      check('Under-capacity box (99.9%) returns isValid === false with guidance', calcUnder.isValid === false && calcUnder.error?.includes('سعة العلبة غير مكتملة'));

      const calcOver = calculateCustomBoxPrice(1000, [
        { product: p0, percentage: 50, roastOption: 'محمص مملح' },
        { product: p1, percentage: 50.1, roastOption: 'محمص بدون ملح' },
      ]);
      check('Over-capacity box (100.1%) returns isValid === false with guidance', calcOver.isValid === false && calcOver.error?.includes('تجاوزت السعة الإجمالية'));

      const calcInvalidSize = calculateCustomBoxPrice(1500, [
        { product: p0, percentage: 50, roastOption: 'محمص مملح' },
        { product: p1, percentage: 50, roastOption: 'محمص بدون ملح' },
      ]);
      check('Unsupported box size (1500g) rejected', calcInvalidSize.isValid === false);

      // Live Order Pipeline Integration: 2000g Custom Mix Box Order
      console.log('  Testing live 2000g custom mix box order via POST /api/orders...');
      const initP0Stock = (await getDbAsync()).products.find((p) => p.id === p0.id).stockKg;
      const initP1Stock = (await getDbAsync()).products.find((p) => p.id === p1.id).stockKg;

      const customBoxReq = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'أحمد التحدي للبوكسات',
          customerPhone: '01099887766',
          governorate: 'بني مزار - البندر',
          deliveryMethod: 'store_pickup',
          address: 'شارع المحطة',
          items: [
            {
              productId: 'custom-mix-box-2000',
              productName: 'علبة مشكلة فاخرة 2 كجم',
              isCustomMix: true,
              boxCapacityGrams: 2000,
              quantity: 1,
              unitPrice: calc2000.totalPrice,
              customBreakdown: [
                { productId: p0.id, productName: p0.name, percentage: 60, weightGrams: 1200 },
                { productId: p1.id, productName: p1.name, percentage: 40, weightGrams: 800 },
              ],
            },
          ],
        }),
      });

      const customRes = await ordersPOST(customBoxReq);
      check('Order with 2000g custom mix box returns HTTP 201', customRes.status === 201);
      const customData = await customRes.json();
      check('Order response has valid orderNumber', Boolean(customData.order?.orderNumber));

      // Verify DB persistence of custom breakdown
      const dbWithBox = await getDbAsync();
      const savedOrder = dbWithBox.orders.find((o) => o.id === customData.order.id);
      check('Order saved in DB with customMix item intact', Boolean(savedOrder && savedOrder.items[0]?.isCustomMix));
      check('Custom breakdown has 2 constituent items', savedOrder?.items[0]?.customBreakdown?.length === 2);
      check('Box capacity is preserved as 2000g', savedOrder?.items[0]?.boxCapacityGrams === 2000);

      // Verify inventory was depleted by exact breakdown weights (1.2 kg and 0.8 kg)
      const p0AfterBox = dbWithBox.products.find((p) => p.id === p0.id);
      const p1AfterBox = dbWithBox.products.find((p) => p.id === p1.id);
      check(
        `Constituent P0 stock decremented by exactly 1.2 kg: ${initP0Stock} -> ${p0AfterBox.stockKg} kg`,
        Math.abs(p0AfterBox.stockKg - (initP0Stock - 1.2)) < 0.001
      );
      check(
        `Constituent P1 stock decremented by exactly 0.8 kg: ${initP1Stock} -> ${p1AfterBox.stockKg} kg`,
        Math.abs(p1AfterBox.stockKg - (initP1Stock - 0.8)) < 0.001
      );

      // Test Order Cancellation Reversal on Custom Box
      const cancelReq = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId: savedOrder.id,
          status: 'cancelled',
        }),
      });
      const cancelRes = await ordersPATCH(cancelReq);
      check('Order cancellation returns HTTP 200', cancelRes.status === 200);

      const dbReversed = await getDbAsync();
      const p0Reversed = dbReversed.products.find((p) => p.id === p0.id);
      const p1Reversed = dbReversed.products.find((p) => p.id === p1.id);
      check(
        `Cancellation reversal restored P0 stock back to initial ${initP0Stock} kg`,
        Math.abs(p0Reversed.stockKg - initP0Stock) < 0.001
      );
      check(
        `Cancellation reversal restored P1 stock back to initial ${initP1Stock} kg`,
        Math.abs(p1Reversed.stockKg - initP1Stock) < 0.001
      );
    }

    // ────────────────────────────────────────────────────────────────
    // TIER 3: POS Shift Accounting & Drawer Cash Reconciliation
    // ────────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}▶ TIER 3: POS Shift Accounting & Cash Reconciliation Stress${colors.reset}`);
    {
      // 1. Open new shift with openingCash = 750 EGP
      const openReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'open_shift',
          cashierName: 'كاشير اختبار الورديات',
          openingCash: 750,
          shiftPeriod: 'الوردية المسائية',
        }),
      });
      const openRes = await posPOST(openReq);
      check('Opening new POS shift returns HTTP 200', openRes.status === 200);

      // 2. Direct Cash sale: 400 EGP (must increment cashSales and expectedCash)
      const cashSaleReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cod',
          items: [{ productName: 'فول سوداني نقدي', unitPrice: 400, quantity: 1 }],
        }),
      });
      const cashSaleRes = await posPOST(cashSaleReq);
      check('POS Cash sale returns HTTP 201', cashSaleRes.status === 201);

      // 3. Electronic sales: Card, Instapay, Vodafone Cash (must NOT affect expected drawer cash)
      const cardSaleReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'card',
          items: [{ productName: 'مكسرات فيزا', unitPrice: 250, quantity: 1 }],
        }),
      });
      const cardSaleRes = await posPOST(cardSaleReq);
      check('POS Card sale returns HTTP 201', cardSaleRes.status === 201);

      const instapaySaleReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'instapay',
          items: [{ productName: 'بن إنستاباي', unitPrice: 180, quantity: 1 }],
        }),
      });
      const instapaySaleRes = await posPOST(instapaySaleReq);
      check('POS Instapay sale returns HTTP 201', instapaySaleRes.status === 201);

      // 4. Add 2 petty cash expenses: 150 + 100 = 250 EGP
      const exp1Req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'add_expense',
          amount: 150,
          title: 'أكياس تعبئة وبكر فواتير',
        }),
      });
      await posPOST(exp1Req);

      const exp2Req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'add_expense',
          amount: 100,
          title: 'ضيافة قهوة ومياه',
        }),
      });
      await posPOST(exp2Req);

      // Current calculation:
      // openingCash = 750
      // cashSales = 400
      // expenses = 250
      // expectedCash = 750 + 400 - 250 = 900 EGP
      // (Electronic card 250 + instapay 180 = 430 EGP do NOT alter drawer cash)

      // Test 3.1: Close shift with exact match actualCash = 900 EGP -> variance === 0
      const closeMatchReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'close_shift',
          actualCash: 900,
          notes: 'مطابقة تامة',
        }),
      });
      const closeMatchRes = await posPOST(closeMatchReq);
      check('Closing shift returns HTTP 200', closeMatchRes.status === 200);
      const closeMatchData = await closeMatchRes.json();
      const closedShift = closeMatchData.closedShift;
      check(
        `Expected cash is exactly 900 EGP (actual: ${closedShift.expectedCash})`,
        closedShift.expectedCash === 900
      );
      check(
        `Variance on exact count is 0 (actual: ${closedShift.variance})`,
        closedShift.variance === 0
      );
      check('Shift status is closed', closedShift.status === 'closed');

      // Test 3.2: Shortage (عجز) test
      // Open new shift with 500, cash sale 200, close with 650 (shortage 50)
      await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'open_shift', openingCash: 500 }),
      }));
      await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cod',
          items: [{ productName: 'شراء كاش', unitPrice: 200, quantity: 1 }],
        }),
      }));
      // Expected: 500 + 200 = 700. Actual counted: 650 -> variance = -50
      const closeShortageRes = await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'close_shift', actualCash: 650 }),
      }));
      const shortageShift = (await closeShortageRes.json()).closedShift;
      check(
        `Shortage calculated accurately: variance = -50 (actual: ${shortageShift.variance})`,
        shortageShift.variance === -50
      );

      // Test 3.3: Surplus (زيادة) test
      // Open new shift with 500, cash sale 100, close with 650 (surplus +50)
      await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'open_shift', openingCash: 500 }),
      }));
      await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cod',
          items: [{ productName: 'شراء كاش', unitPrice: 100, quantity: 1 }],
        }),
      }));
      // Expected: 500 + 100 = 600. Actual counted: 650 -> variance = +50
      const closeSurplusRes = await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'close_shift', actualCash: 650 }),
      }));
      const surplusShift = (await closeSurplusRes.json()).closedShift;
      check(
        `Surplus calculated accurately: variance = +50 (actual: ${surplusShift.variance})`,
        surplusShift.variance === 50
      );

      // Test 3.4: Closing when no active shift open returns 400
      const closeNoShiftRes = await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'close_shift', actualCash: 500 }),
      }));
      check('Closing when no shift is open returns HTTP 400', closeNoShiftRes.status === 400);

      // Test 3.5: Invalid expense (empty title) returns 400
      const badExpenseRes = await posPOST(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'add_expense', amount: 50, title: '' }),
      }));
      check('Invalid expense (empty title) rejected with HTTP 400', badExpenseRes.status === 400);
    }

    // ────────────────────────────────────────────────────────────────
    // TIER 4: Master Forensic Invariant & Data Integrity Check
    // ────────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}▶ TIER 4: Master Forensic Invariant & Data Integrity Check (HAFSA_AC_01_03)${colors.reset}`);
    {
      const rawDb = fs.readFileSync(DB_PATH, 'utf-8');
      const db = JSON.parse(rawDb);

      check('store-db.json is non-empty and strictly valid JSON', typeof db === 'object' && db !== null);
      check('Must have exactly 6 main categories', Array.isArray(db.categories) && db.categories.length === 6);
      check(`Must have exactly 29 products (actual: ${db.products.length})`, db.products.length === 29);

      // HAFSA_AC_01_03: Every product in store-db.json must preserve exactly 4 weights [125, 250, 500, 1000]
      let all29Preserve4Weights = true;
      const invalidProducts = [];
      for (const p of db.products) {
        if (!Array.isArray(p.weights) || p.weights.length !== 4) {
          all29Preserve4Weights = false;
          invalidProducts.push(`${p.id} (length ${p.weights?.length})`);
          continue;
        }
        const grams = p.weights.map((w) => w.weightGrams || w.grams);
        if (JSON.stringify(grams) !== JSON.stringify([125, 250, 500, 1000])) {
          all29Preserve4Weights = false;
          invalidProducts.push(`${p.id} (weights: ${JSON.stringify(grams)})`);
        }
      }
      check(
        'Invariant HAFSA_AC_01_03: Every one of all 29 products preserves exactly 4 weights [125, 250, 500, 1000]',
        all29Preserve4Weights,
        invalidProducts.join(', ')
      );

      // Verify dynamic 2000g resolution without disk modification
      const sampleProd = db.products[0];
      const resolvedWeights = getResolvedProductWeights(sampleProd, true);
      check(
        'getResolvedProductWeights resolves 5 weights dynamically for UI/POS without altering disk JSON',
        resolvedWeights.length === 5 && (resolvedWeights[4].weightGrams || resolvedWeights[4].grams) === 2000
      );

      // Verify all 4 staff roles exist with distinct credentials
      const creds = [
        db.settings.adminUsername,
        db.settings.supplierUsername,
        db.settings.cashierUsername,
        db.settings.accountantUsername,
      ];
      check('All 4 staff credentials exist and are non-empty', creds.every((c) => typeof c === 'string' && c.length > 0));
      check('All 4 staff usernames are strictly unique', new Set(creds.map((c) => c.toLowerCase())).size === 4);
    }

    console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}  M4 CHALLENGER SUMMARY:                                         ${colors.reset}`);
    console.log(`  Total Checks : ${totalChecks}`);
    console.log(`  Passed       : ${colors.green}${passedChecks}${colors.reset}`);
    console.log(`  Failed       : ${failedChecks === 0 ? colors.green + '0' : colors.red + failedChecks}${colors.reset}`);
    console.log(`  Pass Rate    : ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
    console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);

    if (failedChecks === 0) {
      console.log(`${colors.bold}${colors.green}🎉 ALL EMPIRICAL CHALLENGES PASSED! VERDICT: APPROVE${colors.reset}\n`);
    } else {
      console.log(`${colors.bold}${colors.red}❌ CHALLENGE FAILURES DETECTED! VERDICT: REJECT${colors.reset}\n`);
      process.exit(1);
    }
  } finally {
    if (fs.existsSync(DB_BACKUP_PATH)) {
      // Safe file restore
      try {
        const backupContent = fs.readFileSync(DB_BACKUP_PATH, 'utf-8');
        fs.writeFileSync(DB_PATH, backupContent, 'utf-8');
        fs.unlinkSync(DB_BACKUP_PATH);
        console.log('✓ Cleaned up test state; database restored to pristine condition.');
      } catch (err) {
        console.error('Warning during cleanup:', err.message);
      }
    }
  }
}

runMasterStressSuite().catch((err) => {
  console.error('Fatal execution error in challenger_m4_master_stress:', err);
  process.exit(1);
});
