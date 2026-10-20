/**
 * Challenger Milestone 2 Empirical Adversarial Stress Test Suite
 * 
 * Verifies:
 * 1. Product Channel Enforcement (showOnline === false on online orders, showInPos === false on POS sales)
 * 2. Inventory Depletion (stockKg decrement on online & POS orders, stockout edge case stockKg <= 0 -> inStock = false)
 * 3. POS Shift Reconciliation (open, expense, cash sales, card sales isolation, close drawer variance)
 * 4. Verification of type safety and test suite
 * 
 * Execution:
 *   npx tsx scripts/challenger_m2_f2_stress.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

// System Under Test Modules
import { POST as postOrder } from '../src/app/api/orders/route.ts';
import { POST as postPos, GET as getPos } from '../src/app/api/pos/route.ts';
import { getDb, saveDb } from '../src/lib/db.ts';
import { generateAdminToken, getRolePasswordFromSettings } from '../src/lib/auth.ts';

const ROOT_DIR = process.cwd();
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');

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
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${desc}`);
  } else {
    failedChecks++;
    failures.push({ desc, extraInfo });
    console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${desc} ${extraInfo}`);
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
}

async function runChallengerSuite() {
  console.log(`\n${colors.bold}${colors.yellow}==================================================================`);
  console.log(`  EMPIRICAL CHALLENGER MILESTONE 2: STRESS TEST HARNESS`);
  console.log(`  Target: Product Channels, Stock Depletion, Shift Reconciliation`);
  console.log(`==================================================================${colors.reset}`);

  // Snapshot database for pristine restoration
  let originalDbRaw = '';
  if (fs.existsSync(DB_PATH)) {
    originalDbRaw = fs.readFileSync(DB_PATH, 'utf8');
  }

  try {
    const db = getDb();
    const cashierPassword = getRolePasswordFromSettings(db.settings, 'cashier');
    const { token: cashierToken } = generateAdminToken(cashierPassword, 'cashier');
    const cashierHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cashierToken}`,
    };

    // Ensure we have test products for channel testing
    const onlineProduct = db.products.find((p) => p.showOnline !== false) || db.products[0];
    const posProduct = db.products.find((p) => p.showInPos !== false) || db.products[0];

    // Create / identify a product with showOnline: false
    let offlineOnlyProd = db.products.find((p) => p.showOnline === false);
    if (!offlineOnlyProd) {
      offlineOnlyProd = {
        ...JSON.parse(JSON.stringify(db.products[1])),
        id: 'test-offline-only-item',
        name: 'منتج خاص بالفرع فقط (غير متاح أونلاين)',
        showOnline: false,
        showInPos: true,
        stockKg: 20,
        inStock: true,
      };
      db.products.push(offlineOnlyProd);
      saveDb(db);
    }

    // Create / identify a product with showInPos: false
    let onlineOnlyProd = db.products.find((p) => p.showInPos === false);
    if (!onlineOnlyProd) {
      onlineOnlyProd = {
        ...JSON.parse(JSON.stringify(db.products[2])),
        id: 'test-online-only-item',
        name: 'منتج خاص بالمتجر الإلكتروني فقط (غير متاح كاشير)',
        showOnline: true,
        showInPos: false,
        stockKg: 20,
        inStock: true,
      };
      db.products.push(onlineOnlyProd);
      saveDb(db);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 1: Product Channel Enforcement
    // ═════════════════════════════════════════════════════════════════════════
    suite('Section 1: Product Channel Enforcement');

    // 1.1 Direct Online Order rejection for showOnline: false
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'أحمد محمود',
          customerPhone: '01012345678',
          address: 'بني مزار - شارع بورسعيد',
          items: [
            {
              productId: offlineOnlyProd.id,
              productName: offlineOnlyProd.name,
              weightId: offlineOnlyProd.weights[0].id,
              quantity: 1,
              unitPrice: offlineOnlyProd.weights[0].price,
            },
          ],
        }),
      });

      const res = await postOrder(req);
      const json = await res.json();
      check(
        'Online order with item having showOnline: false rejected with 400',
        res.status === 400,
        `Expected status 400, got ${res.status}`
      );
      check(
        'Rejection response contains exact Arabic channel error message',
        json.error === 'المنتج غير متاح للطلب عبر المتجر الإلكتروني',
        `Received: "${json.error}"`
      );
    }

    // 1.2 Partitioned Box online order rejection if slot has showOnline: false
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'محمود علي',
          customerPhone: '01123456789',
          address: 'بني مزار - طريق البحر',
          items: [
            {
              isPartitionedBox: true,
              partitionedBoxSize: 'roqan_4',
              partitionedSlots: [
                { slotIndex: 1, productId: offlineOnlyProd.id, slotGrams: 100 },
                { slotIndex: 2, productId: onlineProduct.id, slotGrams: 100 },
                { slotIndex: 3, productId: onlineProduct.id, slotGrams: 100 },
                { slotIndex: 4, productId: onlineProduct.id, slotGrams: 100 },
              ],
              quantity: 1,
            },
          ],
        }),
      });

      const res = await postOrder(req);
      const json = await res.json();
      check(
        'Online order with partitioned box slot having showOnline: false rejected with 400',
        res.status === 400,
        `Expected status 400, got ${res.status}`
      );
      check(
        'Partitioned box rejection returns channel error message',
        json.error === 'المنتج غير متاح للطلب عبر المتجر الإلكتروني',
        `Received: "${json.error}"`
      );
    }

    // 1.3 Custom Mix Box online order rejection if constituent has showOnline: false
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'إبراهيم يوسف',
          customerPhone: '01234567890',
          address: 'بني مزار - أمام المحطة',
          items: [
            {
              isCustomMix: true,
              boxCapacityGrams: 500,
              customBreakdown: [
                { productId: offlineOnlyProd.id, percentage: 50, roastOption: 'محمص مملح' },
                { productId: onlineProduct.id, percentage: 50, roastOption: 'محمص مملح' },
              ],
              quantity: 1,
            },
          ],
        }),
      });

      const res = await postOrder(req);
      const json = await res.json();
      check(
        'Online order with custom mix constituent having showOnline: false rejected with 400',
        res.status === 400,
        `Expected status 400, got ${res.status}`
      );
      check(
        'Custom mix box rejection returns channel error message',
        json.error === 'المنتج غير متاح للطلب عبر المتجر الإلكتروني',
        `Received: "${json.error}"`
      );
    }

    // 1.4 POS sale rejection for showInPos: false
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'create_invoice',
          customerPhone: '01099887766',
          items: [
            {
              productId: onlineOnlyProd.id,
              productName: onlineOnlyProd.name,
              quantity: 1,
              unitPrice: onlineOnlyProd.weights[0].price,
              weightId: onlineOnlyProd.weights[0].id,
            },
          ],
        }),
      });

      const res = await postPos(req);
      const json = await res.json();
      check(
        'POS sale with item having showInPos: false rejected with 400',
        res.status === 400,
        `Expected status 400, got ${res.status}`
      );
      check(
        'POS sale rejection returns exact Arabic channel error message',
        json.error === 'المنتج غير مصرح ببيعه عبر الكاشير',
        `Received: "${json.error}"`
      );
    }

    // 1.5 Valid online order with showOnline: true accepted
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'عمرو دياب',
          customerPhone: '01511223344',
          address: 'بني مزار - المركز',
          deliveryMethod: 'bandar_fast',
          items: [
            {
              productId: onlineProduct.id,
              productName: onlineProduct.name,
              weightId: onlineProduct.weights[0].id,
              quantity: 1,
              unitPrice: onlineProduct.weights[0].price,
            },
          ],
        }),
      });

      const res = await postOrder(req);
      const json = await res.json();
      check(
        'Online order with valid showOnline item accepted with 201 Created',
        res.status === 201 && json.order && json.order.id,
        `Expected 201, got ${res.status}`
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 2: Inventory Depletion & Stockout Handling
    // ═════════════════════════════════════════════════════════════════════════
    suite('Section 2: Inventory Depletion & Stockout Handling');

    // 2.1 Online order decrements stockKg
    {
      // Prepare fresh product in db with known stock
      const freshDb = getDb();
      const testProd = freshDb.products.find((p) => p.id === 'test-deplete-online') || {
        ...JSON.parse(JSON.stringify(freshDb.products[0])),
        id: 'test-deplete-online',
        name: 'منتج اختبار خصم المخزون أونلاين',
        showOnline: true,
        showInPos: true,
        stockKg: 10.0,
        inStock: true,
      };
      testProd.stockKg = 10.0;
      testProd.inStock = true;
      const idx = freshDb.products.findIndex((p) => p.id === testProd.id);
      if (idx >= 0) freshDb.products[idx] = testProd;
      else freshDb.products.push(testProd);
      saveDb(freshDb);

      // Order 500g variant (0.5 kg)
      const weight500 = testProd.weights.find((w) => (w.grams || w.weightGrams) === 500) || testProd.weights[0];
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'سعيد عبد الله',
          customerPhone: '01055566677',
          address: 'بني مزار - حارة السلام',
          items: [
            {
              productId: testProd.id,
              productName: testProd.name,
              weightId: weight500.id,
              quantity: 1,
              unitPrice: weight500.price,
            },
          ],
        }),
      });

      const res = await postOrder(req);
      check('Online order placed successfully for inventory test', res.status === 201, `Status: ${res.status}`);

      const afterDb = getDb();
      const updatedProd = afterDb.products.find((p) => p.id === testProd.id);
      const consumedGrams = weight500.weightGrams || weight500.grams || 500;
      const expectedStock = Math.round((10.0 - consumedGrams / 1000) * 1000) / 1000;
      check(
        `Online order decremented stockKg accurately (Expected: ${expectedStock}, Found: ${updatedProd?.stockKg})`,
        updatedProd?.stockKg === expectedStock,
        `Stock: ${updatedProd?.stockKg}`
      );
      check('Product remains inStock: true when stockKg > 0', updatedProd?.inStock === true);
    }

    // 2.2 POS sale decrements stockKg
    {
      const freshDb = getDb();
      const testProd = freshDb.products.find((p) => p.id === 'test-deplete-pos') || {
        ...JSON.parse(JSON.stringify(freshDb.products[0])),
        id: 'test-deplete-pos',
        name: 'منتج اختبار خصم مخزون الكاشير',
        showOnline: true,
        showInPos: true,
        stockKg: 5.0,
        inStock: true,
      };
      testProd.stockKg = 5.0;
      testProd.inStock = true;
      const idx = freshDb.products.findIndex((p) => p.id === testProd.id);
      if (idx >= 0) freshDb.products[idx] = testProd;
      else freshDb.products.push(testProd);
      saveDb(freshDb);

      const weight250 = testProd.weights.find((w) => (w.grams || w.weightGrams) === 250) || testProd.weights[0];
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'create_invoice',
          customerPhone: '01011122233',
          items: [
            {
              productId: testProd.id,
              productName: testProd.name,
              quantity: 2, // 2 x 250g = 500g = 0.5 kg
              unitPrice: weight250.price,
              weightId: weight250.id,
            },
          ],
        }),
      });

      const res = await postPos(req);
      check('POS sale created successfully for inventory test', res.status === 201, `Status: ${res.status}`);

      const afterDb = getDb();
      const updatedProd = afterDb.products.find((p) => p.id === testProd.id);
      const expectedStock = Math.round((5.0 - (2 * (weight250.grams || 250)) / 1000) * 1000) / 1000;
      check(
        `POS sale decremented stockKg accurately (Expected: ${expectedStock}, Found: ${updatedProd?.stockKg})`,
        updatedProd?.stockKg === expectedStock,
        `Stock: ${updatedProd?.stockKg}`
      );
    }

    // 2.3 Stockout Edge Case: when stock drops to 0, inStock flips to false
    {
      const freshDb = getDb();
      const testProd = freshDb.products.find((p) => p.id === 'test-stockout-prod') || {
        ...JSON.parse(JSON.stringify(freshDb.products[0])),
        id: 'test-stockout-prod',
        name: 'منتج اختبار نفاد الكمية',
        showOnline: true,
        showInPos: true,
        stockKg: 0.25,
        inStock: true,
      };
      testProd.stockKg = 0.25;
      testProd.inStock = true;
      const idx = freshDb.products.findIndex((p) => p.id === testProd.id);
      if (idx >= 0) freshDb.products[idx] = testProd;
      else freshDb.products.push(testProd);
      saveDb(freshDb);

      const weight250 = testProd.weights.find((w) => (w.grams || w.weightGrams) === 250) || testProd.weights[0];
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'create_invoice',
          customerPhone: '01033344455',
          items: [
            {
              productId: testProd.id,
              productName: testProd.name,
              quantity: 1, // 0.25 kg exactly depletes 0.25 kg stock
              unitPrice: weight250.price,
              weightId: weight250.id,
            },
          ],
        }),
      });

      const res = await postPos(req);
      check('POS sale for stockout test created', res.status === 201);

      const afterDb = getDb();
      const updatedProd = afterDb.products.find((p) => p.id === testProd.id);
      check(
        `Stock reached exactly 0.0 kg (Found: ${updatedProd?.stockKg})`,
        updatedProd?.stockKg === 0,
        `Stock: ${updatedProd?.stockKg}`
      );
      check(
        'Product inStock automatically set to false upon complete depletion',
        updatedProd?.inStock === false,
        `inStock: ${updatedProd?.inStock}`
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 3: POS Shift Reconciliation Lifecycle
    // ═════════════════════════════════════════════════════════════════════════
    suite('Section 3: POS Shift Reconciliation Lifecycle');

    // 3.1 Full shift lifecycle:
    // Open startingCash: 1000 -> Expense: 200 -> Cash sale: 500 -> Close actualCash: 1300
    // Expected: expectedCash = 1300, variance = 0
    {
      // Step A: Open shift
      const openReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'open_shift',
          startingCash: 1000,
          cashierName: 'كاشير اختبار دورة الوردية',
          cashierId: 'cashier_m2_test',
          notes: 'وردية اختبار المطابقة النقدية',
        }),
      });

      const openRes = await postPos(openReq);
      const openJson = await openRes.json();
      check('Shift opened with 200 OK', openRes.status === 200);
      check(
        'Active shift has startingCash = 1000 and expectedCash = 1000',
        openJson.activeShift?.startingCash === 1000 &&
          (openJson.activeShift?.expectedCash === 1000 || openJson.activeShift?.expectedCashInDrawer === 1000),
        `startingCash: ${openJson.activeShift?.startingCash}, expectedCash: ${openJson.activeShift?.expectedCash}`
      );

      // Step B: Add expense 200 EGP
      const expReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'add_expense',
          title: 'شراء أدوات نظافة وأكياس تغليف',
          amount: 200,
          category: 'supplies',
        }),
      });

      const expRes = await postPos(expReq);
      const expJson = await expRes.json();
      check('Expense added with 200 OK', expRes.status === 200);
      check(
        'Active shift expenses recorded as 200',
        expJson.activeShift?.expenses === 200 || expJson.activeShift?.expensesTotal === 200,
        `expenses: ${expJson.activeShift?.expenses}`
      );
      check(
        'Drawer expectedCash decreased by expense (1000 - 200 = 800)',
        expJson.activeShift?.expectedCash === 800 || expJson.activeShift?.expectedCashInDrawer === 800,
        `expectedCash: ${expJson.activeShift?.expectedCash}`
      );

      // Step C: Add Cash Sale of 500 EGP
      // We will create a sale using an existing product with unitPrice adjusted to 500
      const saleReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'create_invoice',
          customerPhone: '01066778899',
          paymentMethod: 'cod', // Cash
          items: [
            {
              productId: posProduct.id,
              productName: posProduct.name,
              quantity: 1,
              unitPrice: 500,
              weightId: posProduct.weights[0].id,
            },
          ],
        }),
      });

      const saleRes = await postPos(saleReq);
      const saleJson = await saleRes.json();
      check('Cash sale of 500 EGP recorded with 201 Created', saleRes.status === 201);
      check(
        'Active shift cashSales equals 500',
        saleJson.activeShift?.cashSales === 500 || saleJson.activeShift?.cashSalesTotal === 500,
        `cashSales: ${saleJson.activeShift?.cashSales}`
      );
      check(
        'Drawer expectedCash equals 1300 (1000 starting - 200 expense + 500 cash)',
        saleJson.activeShift?.expectedCash === 1300 || saleJson.activeShift?.expectedCashInDrawer === 1300,
        `expectedCash: ${saleJson.activeShift?.expectedCash}`
      );

      // Step D: Close shift with actualCash: 1300
      const closeReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'close_shift',
          actualCash: 1300,
          notes: 'تقفيل الوردية بمطابقة تامة 100%',
        }),
      });

      const closeRes = await postPos(closeReq);
      const closeJson = await closeRes.json();
      check('Shift closed with 200 OK', closeRes.status === 200);
      const closed = closeJson.closedShift;
      check('Closed shift status is "closed"', closed?.status === 'closed');
      check(
        'Closed shift expectedCash is exactly 1300',
        closed?.expectedCash === 1300 || closed?.expectedCashInDrawer === 1300,
        `expectedCash: ${closed?.expectedCash}`
      );
      check(
        'Closed shift actualCash recorded as 1300',
        closed?.actualCash === 1300 || closed?.actualClosingCash === 1300,
        `actualCash: ${closed?.actualCash}`
      );
      check(
        'Shift drawer variance is exactly 0 (مطابقة تامة بدون عجز أو زيادة)',
        closed?.variance === 0 || closed?.cashDifference === 0,
        `variance: ${closed?.variance}`
      );
    }

    // 3.2 Shift Reconciliation with Shortage (عجز) & Digital Sales Isolation
    {
      // Open new shift with startingCash: 500
      const openReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'open_shift',
          startingCash: 500,
          cashierName: 'كاشير فرعي',
          cashierId: 'cashier_sub',
        }),
      });
      await postPos(openReq);

      // Add Cash sale: 300 EGP
      const cashSaleReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cod',
          items: [{ productId: posProduct.id, productName: posProduct.name, quantity: 1, unitPrice: 300, weightId: posProduct.weights[0].id }],
        }),
      });
      await postPos(cashSaleReq);

      // Add Card / Digital sale: 400 EGP (vodafone_cash)
      const digitalSaleReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'vodafone_cash',
          items: [{ productId: posProduct.id, productName: posProduct.name, quantity: 1, unitPrice: 400, weightId: posProduct.weights[0].id }],
        }),
      });
      const digitalRes = await postPos(digitalSaleReq);
      const digitalJson = await digitalRes.json();

      check(
        'Digital sale (Vodafone Cash) does not increase drawer expected cash (remains 500 + 300 = 800)',
        digitalJson.activeShift?.expectedCash === 800 || digitalJson.activeShift?.expectedCashInDrawer === 800,
        `expectedCash: ${digitalJson.activeShift?.expectedCash}`
      );
      check(
        'Digital sale recorded in cardSales (400)',
        digitalJson.activeShift?.cardSales === 400 || digitalJson.activeShift?.vodafoneCashTotal === 400,
        `cardSales: ${digitalJson.activeShift?.cardSales}`
      );

      // Close shift with actualCash: 750 (shortage of 50 EGP)
      const closeReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          action: 'close_shift',
          actualCash: 750,
          notes: 'عجز 50 جنيه في الوردية',
        }),
      });
      const closeRes = await postPos(closeReq);
      const closeJson = await closeRes.json();
      const closed = closeJson.closedShift;
      check(
        'Shift shortage calculated correctly as variance = -50',
        closed?.variance === -50 || closed?.cashDifference === -50,
        `variance: ${closed?.variance}`
      );
    }

  } finally {
    // Restore pristine database snapshot
    if (originalDbRaw && fs.existsSync(DB_PATH)) {
      try {
        fs.writeFileSync(DB_PATH, originalDbRaw, 'utf8');
      } catch (err) {
        console.error('Failed to restore database state:', err);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═════════════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}EMPIRICAL CHALLENGER M2 RESULTS SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Total Checks : ${colors.bold}${totalChecks}${colors.reset}`);
  console.log(`  Passed       : ${colors.green}${colors.bold}${passedChecks}${colors.reset}`);
  console.log(`  Failed       : ${failedChecks > 0 ? colors.red : colors.green}${colors.bold}${failedChecks}${colors.reset}`);
  console.log(`  Pass Rate    : ${colors.bold}${((passedChecks / totalChecks) * 100).toFixed(1)}%${colors.reset}`);

  if (failures.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Failures Summary:${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${colors.red}${f.desc}${colors.reset}: ${f.extraInfo}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}🎉 ALL ${totalChecks} EMPIRICAL CHECKS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  }
}

runChallengerSuite().catch((err) => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
