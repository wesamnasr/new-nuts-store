/**
 * Challenger M2 Final: Adversarial Stress Test Harness
 * 
 * Target: Empirical stress-testing of Milestone 2:
 * 1. Dual-channel product visibility (showOnline, showInPos): strict rejection of showOnline === false in online orders and showInPos === false in POS.
 * 2. Atomic inventory depletion: stockKg arithmetic, boundary checks (clamping to 0, inStock=false), and floating point precision.
 * 3. POS shift lifecycle & drawer reconciliation: opening, expenses, cash sales, card sales, variance math (+/-/0).
 * 4. Staff role isolation for POS and Order mutation routes.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { POST as postOrder, PATCH as patchOrder } from '../src/app/api/orders/route.ts';
import { POST as postPos, GET as getPos } from '../src/app/api/pos/route.ts';
import { generateAdminToken } from '../src/lib/auth.ts';
import { getDbAsync, saveDbAsync } from '../src/lib/db.ts';

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
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${desc}`);
  } else {
    failedChecks++;
    failures.push({ desc, extraInfo });
    console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${desc} ${extraInfo}`);
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
}

async function runAdversarialTests() {
  console.log(`\n${colors.bold}${colors.yellow}==================================================================`);
  console.log(`  CHALLENGER M2 FINAL: EMPIRICAL ADVERSARIAL STRESS TEST SUITE`);
  console.log(`==================================================================${colors.reset}`);

  // 1. Snapshot original database
  const originalDbRaw = fs.readFileSync(DB_PATH, 'utf8');

  try {
    const db = await getDbAsync();

    // Prepare auth tokens for different roles using dynamic passwords from settings
    const cashierPassword = db.settings?.cashierPassword || 'Cash#Pos2026';
    const cashierToken = generateAdminToken(cashierPassword, 'cashier').token;

    const supplierPassword = db.settings?.supplierPassword || 'Sup#Arafat2026';
    const supplierToken = generateAdminToken(supplierPassword, 'supplier').token;

    const accountantPassword = db.settings?.accountantPassword || 'Acc#Fin2026';
    const accountantToken = generateAdminToken(accountantPassword, 'accountant').token;

    const adminPassword = db.settings?.adminPassword || 'Hafsa@Admin2026';
    const adminToken = generateAdminToken(adminPassword, 'super_admin').token;

    // Seed test products with distinct channel flags and stock
    const testProdOnlineOnly = {
      id: 'test-prod-online-only',
      name: 'صنف تجريبي أونلاين فقط',
      slug: 'test-prod-online-only',
      category: 'nuts',
      categoryId: 'cat-nuts',
      pricePerKg: 400,
      costPerKg: 250,
      stockKg: 10.0,
      showOnline: true,
      showInPos: false, // Disallowed in POS
      inStock: true,
      weights: [
        { id: 'w-250', label: '250 جرام', grams: 250, weightGrams: 250, price: 100 },
        { id: 'w-500', label: '500 جرام', grams: 500, weightGrams: 500, price: 200 },
        { id: 'w-1000', label: '1 كيلو', grams: 1000, weightGrams: 1000, price: 400 },
      ],
      roastOptions: ['محمص مملح'],
    };

    const testProdPosOnly = {
      id: 'test-prod-pos-only',
      name: 'صنف تجريبي كاشير فقط',
      slug: 'test-prod-pos-only',
      category: 'nuts',
      categoryId: 'cat-nuts',
      pricePerKg: 300,
      costPerKg: 180,
      stockKg: 10.0,
      showOnline: false, // Disallowed in Online orders
      showInPos: true,
      inStock: true,
      weights: [
        { id: 'w-250-pos', label: '250 جرام', grams: 250, weightGrams: 250, price: 75 },
        { id: 'w-500-pos', label: '500 جرام', grams: 500, weightGrams: 500, price: 150 },
        { id: 'w-1000-pos', label: '1 كيلو', grams: 1000, weightGrams: 1000, price: 300 },
      ],
      roastOptions: ['محمص مملح'],
    };

    const testProdBoth = {
      id: 'test-prod-both',
      name: 'صنف تجريبي متاح بالقناتين',
      slug: 'test-prod-both',
      category: 'nuts',
      categoryId: 'cat-nuts',
      pricePerKg: 500,
      costPerKg: 300,
      stockKg: 5.0,
      showOnline: true,
      showInPos: true,
      inStock: true,
      weights: [
        { id: 'w-250-both', label: '250 جرام', grams: 250, weightGrams: 250, price: 125 },
        { id: 'w-500-both', label: '500 جرام', grams: 500, weightGrams: 500, price: 250 },
        { id: 'w-1000-both', label: '1 كيلو', grams: 1000, weightGrams: 1000, price: 500 },
      ],
      roastOptions: ['محمص مملح'],
    };

    // Upsert test products into DB
    db.products = db.products.filter(p => !p.id.startsWith('test-prod-'));
    db.products.push(testProdOnlineOnly, testProdPosOnly, testProdBoth);
    await saveDbAsync(db);

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 1: Dual-Channel Visibility Enforcement (Online vs POS)
    // ═════════════════════════════════════════════════════════════════════════
    suite('Suite 1: Dual-Channel Visibility Rejection');

    // 1.1 Online direct purchase of showOnline === false product
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'أحمد محمود',
          customerPhone: '01012345678',
          address: 'بني مزار شارع المحطة',
          deliveryMethod: 'bandar_fast',
          items: [
            {
              productId: 'test-prod-pos-only',
              productName: 'صنف تجريبي كاشير فقط',
              weightId: 'w-500-pos',
              quantity: 1,
            },
          ],
        }),
      });
      const res = await postOrder(req);
      const json = await res.json();
      check(
        'Online order rejects direct product with showOnline === false (HTTP 400)',
        res.status === 400 && json.error.includes('المنتج غير متاح للطلب عبر المتجر الإلكتروني'),
        `Status: ${res.status}, error: ${json.error}`
      );
    }

    // 1.2 Online partitioned box containing showOnline === false product in slot
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'أحمد محمود',
          customerPhone: '01012345678',
          address: 'بني مزار شارع المحطة',
          deliveryMethod: 'bandar_fast',
          items: [
            {
              productId: 'box-roqan-4',
              productName: 'بوكس روقان 4 خانات',
              isPartitionedBox: true,
              partitionedBoxSize: 'roqan_4',
              partitionedSlots: [
                { slotIndex: 1, productId: 'test-prod-pos-only', slotGrams: 100 },
                { slotIndex: 2, productId: 'test-prod-both', slotGrams: 100 },
                { slotIndex: 3, productId: 'test-prod-both', slotGrams: 100 },
                { slotIndex: 4, productId: 'test-prod-both', slotGrams: 100 },
              ],
              quantity: 1,
            },
          ],
        }),
      });
      const res = await postOrder(req);
      const json = await res.json();
      check(
        'Online order rejects partitioned box with constituent slot having showOnline === false (HTTP 400)',
        res.status === 400 && json.error.includes('المنتج غير متاح للطلب عبر المتجر الإلكتروني'),
        `Status: ${res.status}, error: ${json.error}`
      );
    }

    // 1.3 Online custom mix containing showOnline === false product
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'أحمد محمود',
          customerPhone: '01012345678',
          address: 'بني مزار شارع المحطة',
          deliveryMethod: 'bandar_fast',
          items: [
            {
              isCustomMix: true,
              boxCapacityGrams: 500,
              customBreakdown: [
                { productId: 'test-prod-pos-only', percentage: 50 },
                { productId: 'test-prod-both', percentage: 50 },
              ],
              quantity: 1,
            },
          ],
        }),
      });
      const res = await postOrder(req);
      const json = await res.json();
      check(
        'Online order rejects custom mix containing constituent with showOnline === false (HTTP 400)',
        res.status === 400 && json.error.includes('المنتج غير متاح للطلب عبر المتجر الإلكتروني'),
        `Status: ${res.status}, error: ${json.error}`
      );
    }

    // 1.4 POS direct purchase of showInPos === false product
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          customerName: 'عميل المحل',
          items: [
            {
              productId: 'test-prod-online-only',
              productName: 'صنف تجريبي أونلاين فقط',
              weightId: 'w-250',
              quantity: 1,
              unitPrice: 100,
            },
          ],
          paymentMethod: 'cod',
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check(
        'POS invoice rejects direct product with showInPos === false (HTTP 400)',
        res.status === 400 && json.error.includes('المنتج غير مصرح ببيعه عبر الكاشير'),
        `Status: ${res.status}, error: ${json.error}`
      );
    }

    // 1.5 POS partitioned box containing showInPos === false product
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          customerName: 'عميل المحل',
          items: [
            {
              productId: 'box-roqan-4',
              productName: 'بوكس روقان 4 خانات',
              isPartitionedBox: true,
              partitionedBoxSize: 'roqan_4',
              partitionedSlots: [
                { slotIndex: 1, productId: 'test-prod-online-only', slotGrams: 100 },
                { slotIndex: 2, productId: 'test-prod-both', slotGrams: 100 },
              ],
              quantity: 1,
              unitPrice: 125,
            },
          ],
          paymentMethod: 'cod',
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check(
        'POS invoice rejects partitioned box containing constituent slot with showInPos === false (HTTP 400)',
        res.status === 400 && json.error.includes('المنتج غير مصرح ببيعه عبر الكاشير'),
        `Status: ${res.status}, error: ${json.error}`
      );
    }

    // 1.6 POS custom mix containing showInPos === false product
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          customerName: 'عميل المحل',
          items: [
            {
              isCustomMix: true,
              boxCapacityGrams: 500,
              customBreakdown: [
                { productId: 'test-prod-online-only', percentage: 50 },
                { productId: 'test-prod-both', percentage: 50 },
              ],
              quantity: 1,
              unitPrice: 200,
            },
          ],
          paymentMethod: 'cod',
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check(
        'POS invoice rejects custom mix containing constituent with showInPos === false (HTTP 400)',
        res.status === 400 && json.error.includes('المنتج غير مصرح ببيعه عبر الكاشير'),
        `Status: ${res.status}, error: ${json.error}`
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 2: Atomic Inventory Depletion & Boundary Arithmetic
    // ═════════════════════════════════════════════════════════════════════════
    suite('Suite 2: Atomic Inventory Depletion & Boundary Arithmetic');

    // 2.1 Online standard product stock deduction
    {
      const freshDb = await getDbAsync();
      const p = freshDb.products.find(p => p.id === 'test-prod-both');
      p.stockKg = 5.0;
      p.inStock = true;
      await saveDbAsync(freshDb);

      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'سارة علي',
          customerPhone: '01123456789',
          address: 'بني مزار شارع الجمهورية',
          deliveryMethod: 'bandar_fast',
          items: [
            {
              productId: 'test-prod-both',
              productName: 'صنف تجريبي متاح بالقناتين',
              weightId: 'w-500-both', // 500 grams = 0.5 kg
              quantity: 2, // 2 * 0.5 = 1.0 kg
            },
          ],
        }),
      });
      const res = await postOrder(req);
      check('Online standard order succeeds (HTTP 201)', res.status === 201);

      const updatedDb = await getDbAsync();
      const updatedP = updatedDb.products.find(p => p.id === 'test-prod-both');
      check(
        'Online order depleted stockKg from 5.0 to 4.0 kg exactly (5.0 - 1.0 = 4.0)',
        updatedP.stockKg === 4.0 && updatedP.inStock === true,
        `Current stockKg: ${updatedP.stockKg}, inStock: ${updatedP.inStock}`
      );
    }

    // 2.2 POS custom weight stock deduction (scale sales in grams)
    {
      const freshDb = await getDbAsync();
      const p = freshDb.products.find(p => p.id === 'test-prod-both');
      p.stockKg = 4.0;
      await saveDbAsync(freshDb);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          customerName: 'عميل ميزان',
          items: [
            {
              productId: 'test-prod-both',
              productName: 'صنف تجريبي متاح بالقناتين',
              customWeightGrams: 350, // 350 grams = 0.35 kg
              quantity: 1,
              unitPrice: 175,
            },
          ],
          paymentMethod: 'cod',
        }),
      });
      const res = await postPos(req);
      check('POS scale sale succeeds (HTTP 201)', res.status === 201);

      const updatedDb = await getDbAsync();
      const updatedP = updatedDb.products.find(p => p.id === 'test-prod-both');
      check(
        'POS scale sale depleted stockKg from 4.0 to 3.65 kg (4.0 - 0.35 = 3.65)',
        updatedP.stockKg === 3.65 && updatedP.inStock === true,
        `Current stockKg: ${updatedP.stockKg}`
      );
    }

    // 2.3 Boundary Condition: Exact depletion to 0 kg
    {
      const freshDb = await getDbAsync();
      const p = freshDb.products.find(p => p.id === 'test-prod-both');
      p.stockKg = 0.5; // Exactly 500 grams left
      p.inStock = true;
      await saveDbAsync(freshDb);

      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'سارة علي',
          customerPhone: '01123456789',
          address: 'بني مزار شارع الجمهورية',
          deliveryMethod: 'bandar_fast',
          items: [
            {
              productId: 'test-prod-both',
              productName: 'صنف تجريبي متاح بالقناتين',
              weightId: 'w-500-both', // 500 grams = 0.5 kg
              quantity: 1,
            },
          ],
        }),
      });
      const res = await postOrder(req);
      check('Exact stock depletion order succeeds (HTTP 201)', res.status === 201);

      const updatedDb = await getDbAsync();
      const updatedP = updatedDb.products.find(p => p.id === 'test-prod-both');
      check(
        'Depletion to exactly 0 sets stockKg = 0 and inStock = false',
        updatedP.stockKg === 0 && updatedP.inStock === false,
        `stockKg: ${updatedP.stockKg}, inStock: ${updatedP.inStock}`
      );
    }

    // 2.4 Boundary Condition: Over-depletion clamped at 0 (Math.max(0, ...))
    {
      const freshDb = await getDbAsync();
      const p = freshDb.products.find(p => p.id === 'test-prod-both');
      p.stockKg = 0.2; // 200g left
      p.inStock = true;
      await saveDbAsync(freshDb);

      // Order 500g
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'سارة علي',
          customerPhone: '01123456789',
          address: 'بني مزار شارع الجمهورية',
          deliveryMethod: 'bandar_fast',
          items: [
            {
              productId: 'test-prod-both',
              productName: 'صنف تجريبي متاح بالقناتين',
              weightId: 'w-500-both', // 500 grams
              quantity: 1,
            },
          ],
        }),
      });
      const res = await postOrder(req);
      check('Over-depletion order completes (HTTP 201)', res.status === 201);

      const updatedDb = await getDbAsync();
      const updatedP = updatedDb.products.find(p => p.id === 'test-prod-both');
      check(
        'Stock over-depletion clamps at 0 (never negative) and inStock = false',
        updatedP.stockKg === 0 && updatedP.inStock === false,
        `stockKg: ${updatedP.stockKg}, inStock: ${updatedP.inStock}`
      );
    }

    // 2.5 Floating Point Drift Stress Test: Iterative 125g decrements
    {
      let stock = 1.0;
      for (let i = 0; i < 8; i++) {
        stock = Math.max(0, Math.round((stock - 0.125) * 1000) / 1000);
      }
      check(
        'Gram-precision rounding eliminates IEEE-754 drift after 8x 125g subtractions (1.0 -> 0.0)',
        stock === 0,
        `Result: ${stock}`
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 3: POS Shift Lifecycle & Drawer Reconciliation Math
    // ═════════════════════════════════════════════════════════════════════════
    suite('Suite 3: POS Shift Lifecycle & Reconciliation Math');

    // 3.1 Open a new shift
    let activeShiftId = '';
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'open_shift',
          cashierName: 'كاشير التجربة',
          startingCash: 1000,
          shiftPeriod: 'وردية بعد الظهر',
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check('Open shift succeeds (HTTP 200)', res.status === 200);
      activeShiftId = json.activeShift.id;
      check(
        'Open shift sets startingCash = 1000 and expectedCash = 1000',
        json.activeShift.startingCash === 1000 && json.activeShift.expectedCash === 1000,
        `startingCash: ${json.activeShift.startingCash}, expectedCash: ${json.activeShift.expectedCash}`
      );
    }

    // 3.2 Add petty cash expenses during shift
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'add_expense',
          title: 'شراء بكر فواتير ومستلزمات نظافة',
          amount: 150,
          category: 'supplies',
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check('Add petty expense succeeds (HTTP 200)', res.status === 200);
      check(
        'Add expense increments expenses and decrements expectedCash to 850 (1000 - 150 = 850)',
        json.activeShift.expenses === 150 && json.activeShift.expectedCash === 850,
        `expenses: ${json.activeShift.expenses}, expectedCash: ${json.activeShift.expectedCash}`
      );
    }

    // 3.3 Cash sale (COD): must increment cashSales and expectedCash
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          customerName: 'عميل نقدي',
          items: [
            {
              productId: 'test-prod-pos-only',
              productName: 'صنف تجريبي كاشير فقط',
              weightId: 'w-1000-pos',
              quantity: 1,
              unitPrice: 300,
            },
          ],
          paymentMethod: 'cod',
          cashTendered: 300,
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check('Cash sale invoice succeeds (HTTP 201)', res.status === 201);
      check(
        'Cash sale increments cashSales (+300) and expectedCash to 1150 (850 + 300 = 1150)',
        json.activeShift.cashSales === 300 && json.activeShift.expectedCash === 1150,
        `cashSales: ${json.activeShift.cashSales}, expectedCash: ${json.activeShift.expectedCash}`
      );
    }

    // 3.4 Digital card sale (Vodafone Cash / InstaPay): increments cardSales, does NOT enter cash drawer
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          customerName: 'عميل محفظة إلكترونية',
          items: [
            {
              productId: 'test-prod-pos-only',
              productName: 'صنف تجريبي كاشير فقط',
              weightId: 'w-1000-pos',
              quantity: 1,
              unitPrice: 300,
            },
          ],
          paymentMethod: 'vodafone_cash',
          paymentReference: 'VOD-987654',
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check('Vodafone Cash sale succeeds (HTTP 201)', res.status === 201);
      check(
        'Digital sale increments cardSales (+300) but expectedCash remains in cash drawer (1150)',
        json.activeShift.cardSales === 300 && json.activeShift.expectedCash === 1150,
        `cardSales: ${json.activeShift.cardSales}, expectedCash: ${json.activeShift.expectedCash}`
      );
    }

    // 3.5 Close shift with drawer reconciliation variance math
    // Expected cash = 1150. Suppose actual counted cash = 1100 (-50 deficit).
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'close_shift',
          actualCash: 1100, // Deficit of 50 EGP
          notes: 'عجز 50 ج.م بسبب فكة ناقصة',
        }),
      });
      const res = await postPos(req);
      const json = await res.json();
      check('Close shift succeeds (HTTP 200)', res.status === 200);
      const closed = json.closedShift;
      check(
        'Shift close computes exact negative variance: 1100 - 1150 = -50 (deficit)',
        closed.status === 'closed' && closed.actualCash === 1100 && closed.variance === -50,
        `status: ${closed.status}, actualCash: ${closed.actualCash}, variance: ${closed.variance}`
      );
    }

    // 3.6 Drawer Surplus Reconciliation (+50)
    {
      // Open new shift with 500
      await postPos(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'open_shift', startingCash: 500 }),
      }));
      // Close with 550 actual cash -> variance = +50
      const closeRes = await postPos(new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ action: 'close_shift', actualCash: 550 }),
      }));
      const closeJson = await closeRes.json();
      check(
        'Shift close computes exact positive variance: 550 - 500 = +50 (surplus)',
        closeJson.closedShift.variance === 50,
        `variance: ${closeJson.closedShift.variance}`
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 4: Staff Role Isolation Matrix (Security Gateways)
    // ═════════════════════════════════════════════════════════════════════════
    suite('Suite 4: Staff Role Isolation Gateways');

    // 4.1 Unauthenticated POST /api/pos -> 401
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_invoice' }),
      });
      const res = await postPos(req);
      check('Unauthenticated POST /api/pos returns 401 Unauthorized', res.status === 401);
    }

    // 4.2 Supplier POST /api/pos -> 403
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({ action: 'create_invoice' }),
      });
      const res = await postPos(req);
      check('Supplier POST /api/pos returns 403 Forbidden', res.status === 403);
    }

    // 4.3 Accountant POST /api/pos -> 403
    {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accountantToken}`,
        },
        body: JSON.stringify({ action: 'create_invoice' }),
      });
      const res = await postPos(req);
      check('Accountant POST /api/pos returns 403 Forbidden', res.status === 403);
    }

    // 4.4 Unauthenticated PATCH /api/orders -> 401
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'test-ord', status: 'confirmed' }),
      });
      const res = await patchOrder(req);
      check('Unauthenticated PATCH /api/orders returns 401 Unauthorized', res.status === 401);
    }

    // 4.5 Supplier PATCH /api/orders -> 403
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({ orderId: 'test-ord', status: 'confirmed' }),
      });
      const res = await patchOrder(req);
      check('Supplier PATCH /api/orders returns 403 Forbidden', res.status === 403);
    }

    // 4.6 Cashier DELETE /api/orders -> 403
    {
      const req = new NextRequest('http://localhost:3000/api/orders?orderId=test-ord', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
        },
      });
      const res = await (await import('../src/app/api/orders/route.ts')).DELETE(req);
      check('Cashier DELETE /api/orders returns 403 Forbidden', res.status === 403);
    }

    // 4.6 Accountant PATCH /api/orders -> 403
    {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accountantToken}`,
        },
        body: JSON.stringify({ orderId: 'test-ord', status: 'confirmed' }),
      });
      const res = await patchOrder(req);
      check('Accountant PATCH /api/orders returns 403 Forbidden', res.status === 403);
    }

  } finally {
    // Pristine database restore
    fs.writeFileSync(DB_PATH, originalDbRaw, 'utf8');
    console.log(`\n${colors.gray}[Database restored to original snapshot]${colors.reset}`);
  }

  // Final Summary
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}ADVERSARIAL STRESS TEST RESULTS${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Total Checks : ${colors.bold}${totalChecks}${colors.reset}`);
  console.log(`  Passed       : ${colors.green}${colors.bold}${passedChecks}${colors.reset}`);
  console.log(`  Failed       : ${failedChecks > 0 ? colors.red : colors.green}${colors.bold}${failedChecks}${colors.reset}`);
  console.log(`  Pass Rate    : ${colors.bold}${((passedChecks / totalChecks) * 100).toFixed(1)}%${colors.reset}`);

  if (failedChecks > 0) {
    console.log(`\n${colors.bold}${colors.red}Failures Summary:${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${colors.red}${f.desc}${colors.reset}: ${f.extraInfo}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}🎉 ALL ${totalChecks} ADVERSARIAL STRESS CHECKS PASSED! ZERO DEFECTS.${colors.reset}\n`);
    process.exit(0);
  }
}

runAdversarialTests().catch((err) => {
  console.error('Fatal exception during stress testing:', err);
  process.exit(1);
});
