/**
 * Tier 5 White-Box API & State Challenger Stress Test Suite
 * 
 * Target: Arabic RTL Nuts E-Commerce Store ("محمصة الواحة الذهبية")
 * Runtime: Node.js v24+ (Native ESM)
 * 
 * Scope:
 *  1. POST /api/orders & PATCH /api/orders
 *     - Server-side price recalculation & anti-tampering
 *     - Coupon threshold & validity validation
 *     - Egyptian phone number formatting & rejection
 *     - Custom mix box breakdown disk persistence
 *     - Admin authentication gate & status transition lifecycle
 *  2. GET /api/store & PUT /api/store
 *     - Public data sanitization (adminPassword & customer orders stripped)
 *     - Unauthenticated mutation rejection (401 Unauthorized)
 *     - Authenticated store settings mutation & persistence
 *  3. POST & GET /api/admin/login, POST /api/admin/logout
 *     - Password authentication & HMAC token issuance
 *     - HttpOnly cookie security verification
 *     - Session verification endpoint
 *     - Symmetric cookie clearance on logout
 *  4. POST & GET /api/reviews
 *     - Review input validation & boundary checks
 *     - Non-existent product rejection (400)
 *     - Weighted average rating & reviewsCount recalculation
 *     - Synchronous disk persistence to data/store-db.json
 *  5. Database Integrity (data/store-db.json)
 *     - 10-product catalog consistency, categories, weights, images
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');
const TEST_PORT = 3008;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// ANSI styling
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  const start = performance.now();
  process.stdout.write(`  Testing: ${name}... `);
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(1);
    passedTests++;
    console.log(`${colors.green}✓ [PASS]${colors.reset} ${colors.gray}(${duration}ms)${colors.reset}`);
  } catch (err) {
    const duration = (performance.now() - start).toFixed(1);
    failedTests++;
    failures.push({ name, error: err });
    console.log(`${colors.red}✗ [FAIL]${colors.reset} ${colors.gray}(${duration}ms)${colors.reset}`);
    console.log(`    ${colors.red}Assertion/Error: ${err.message}${colors.reset}`);
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
}

function getDb() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

// HTTP Helper Functions
async function req(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawText: text };
  }
  return {
    status: res.status,
    headers: res.headers,
    data: json,
    cookies: res.headers.get('set-cookie') || '',
  };
}

// Server lifecycle management
let serverProcess = null;

async function isPortOpen(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/store`, { signal: AbortSignal.timeout(1000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function startServer() {
  const alreadyOpen = await isPortOpen(TEST_PORT);
  if (alreadyOpen) {
    console.log(`${colors.green}● Server already running on port ${TEST_PORT}.${colors.reset}`);
    return;
  }

  console.log(`${colors.yellow}● Launching Next.js production server on port ${TEST_PORT}...${colors.reset}`);
  serverProcess = spawn('npx', ['next', 'start', '-p', String(TEST_PORT)], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: 'ignore',
  });

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const open = await isPortOpen(TEST_PORT);
    if (open) {
      console.log(`${colors.green}✓ Next.js server ready on port ${TEST_PORT}.${colors.reset}`);
      return;
    }
  }

  throw new Error(`Failed to start Next.js server on port ${TEST_PORT} within 15 seconds.`);
}

function stopServer() {
  if (serverProcess) {
    console.log(`\n${colors.gray}● Shutting down test server (PID: ${serverProcess.pid})...${colors.reset}`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch (e) {
      // Ignore
    }
    serverProcess = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE TEST PAYLOAD BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function createBaseOrderPayload() {
  return {
    customerName: 'محمد أحمد السعيد',
    customerPhone: '01012345678',
    customerAltPhone: '',
    governorate: 'القاهرة والجيزة',
    address: 'شارع الهرم، الجيزة، مصر',
    notes: 'برجاء الاتصال قبل التوصيل',
    paymentMethod: 'cod',
    items: [
      {
        cartItemId: 'prod-pistachio-1-w-500-محمص مملح',
        productId: 'prod-pistachio-1',
        productName: 'فستق أمريكي جامبو محمص',
        productImage: 'https://images.unsplash.com/photo-1525351326368-efbb5cb6814d',
        weightId: 'w-500',
        weightLabel: '500 جم (نصف كيلو)',
        roastOption: 'محمص مملح',
        unitPrice: 420,
        quantity: 1,
      },
    ],
    subtotal: 420,
    shippingCost: 50,
    discountAmount: 0,
    total: 470,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

async function runAllTests() {
  console.log(`\n${colors.bold}${colors.magenta}==================================================================`);
  console.log(`  محمصة الواحة الذهبية - Tier 5 White-Box API & State Stress Suite`);
  console.log(`  Exhaustive Adversarial Security, Recalculation & Mutation Audit`);
  console.log(`==================================================================${colors.reset}\n`);

  let dbSnapshot = null;
  if (fs.existsSync(DB_PATH)) {
    dbSnapshot = fs.readFileSync(DB_PATH, 'utf-8');
  }

  try {
    await startServer();

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 1: ORDERS API - POST /api/orders
    // ═════════════════════════════════════════════════════════════════════════
    suite('1. POST /api/orders — Price Recalculation, Anti-Tampering & Security');

    await test('T5_ORD_01: Server rejects forged unitPrice and recalculates true catalog price', async () => {
      const payload = createBaseOrderPayload();
      // Attacker tampers unitPrice to 1 EGP and total to 1 EGP
      payload.items[0].unitPrice = 1;
      payload.subtotal = 1;
      payload.shippingCost = 0;
      payload.total = 1;

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201, 'Order must succeed');
      const order = res.data.order;
      assert.strictEqual(order.items[0].unitPrice, 420, 'Server must enforce DB price 420 EGP');
      assert.strictEqual(order.subtotal, 420, 'Server must compute subtotal 420 EGP');
      assert.strictEqual(order.shippingCost, 50, 'Server must enforce shipping cost 50 EGP (subtotal < 1000)');
      assert.strictEqual(order.total, 470, 'Server must compute total 470 EGP (420 + 50)');
    });

    await test('T5_ORD_02: Server recalculates multi-item cart quantities correctly', async () => {
      const payload = createBaseOrderPayload();
      payload.items = [
        {
          cartItemId: 'prod-pistachio-1-w-500-محمص مملح',
          productId: 'prod-pistachio-1',
          productName: 'فستق أمريكي جامبو محمص',
          productImage: 'https://images.unsplash.com/photo-1525351326368-efbb5cb6814d',
          weightId: 'w-500',
          weightLabel: '500 جم (نصف كيلو)',
          roastOption: 'محمص مملح',
          unitPrice: 999, // tampered
          quantity: 2,
        },
        {
          cartItemId: 'prod-hazelnut-1-w-1000-محمص بدون ملح',
          productId: 'prod-hazelnut-1',
          productName: 'بندق تركي مقشر فاخر',
          productImage: 'https://images.unsplash.com/photo-1599599810769',
          weightId: 'w-1000',
          weightLabel: '1 كجم (كيلو كامل)',
          roastOption: 'محمص بدون ملح',
          unitPrice: 1, // tampered
          quantity: 1,
        },
      ];
      payload.subtotal = 100;
      payload.total = 100;

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const order = res.data.order;
      // Pistachio 500g = 420 * 2 = 840 EGP. Hazelnut 1000g = 700 * 1 = 700 EGP.
      // Subtotal = 1540 EGP. Free shipping threshold (1000 EGP) reached -> shipping 0. Total = 1540 EGP.
      assert.strictEqual(order.subtotal, 1540);
      assert.strictEqual(order.shippingCost, 0, 'Free shipping for subtotal >= 1000');
      assert.strictEqual(order.total, 1540);
    });

    await test('T5_ORD_03: Invalid coupon code is ignored and discount reset to 0', async () => {
      const payload = createBaseOrderPayload();
      payload.couponCode = 'MALICIOUS_COUPON_100';
      payload.discountAmount = 300; // Attacker claims 300 discount
      payload.total = 170;

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const order = res.data.order;
      assert.strictEqual(order.discountAmount, 0, 'Fake coupon discount must be 0');
      assert.strictEqual(order.couponCode, undefined, 'Invalid coupon code must not be saved');
      assert.strictEqual(order.total, 470);
    });

    await test('T5_ORD_04: Coupon under minOrderAmount (WELCOME50 on 420 < 500 EGP, or NUTS10 on 215 < 300 EGP) yields 0 discount', async () => {
      // 1. WELCOME50 requires 500 EGP. Subtotal is 420 EGP.
      const payload1 = createBaseOrderPayload();
      payload1.couponCode = 'WELCOME50';
      payload1.discountAmount = 50; // Attacker tries to force 50
      payload1.total = 420;

      const res1 = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1),
      });

      assert.strictEqual(res1.status, 201);
      assert.strictEqual(res1.data.order.discountAmount, 0, 'Discount must be 0 because 420 < 500 EGP threshold');
      assert.strictEqual(res1.data.order.couponCode, undefined);

      // 2. NUTS10 requires 300 EGP. Subtotal is 215 EGP (250g Pistachio).
      const payload2 = createBaseOrderPayload();
      payload2.items[0].weightId = 'w-250';
      payload2.items[0].unitPrice = 215;
      payload2.couponCode = 'NUTS10';
      payload2.discountAmount = 21.5; // Attacker tries to force 10%
      payload2.total = 243.5;

      const res2 = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2),
      });

      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.data.order.subtotal, 215);
      assert.strictEqual(res2.data.order.discountAmount, 0, 'Discount must be 0 because 215 < 300 EGP threshold');
      assert.strictEqual(res2.data.order.couponCode, undefined);
    });

    await test('T5_ORD_05: Valid coupon NUTS10 with subtotal >= 300 EGP applies exact 10% discount', async () => {
      const payload = createBaseOrderPayload();
      // Subtotal 420 EGP >= 300 EGP minOrderAmount
      payload.couponCode = 'NUTS10';

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const order = res.data.order;
      assert.strictEqual(order.subtotal, 420);
      assert.strictEqual(order.discountAmount, 42, '10% of 420 is 42');
      assert.strictEqual(order.couponCode, 'NUTS10');
      // Subtotal 420 < 1000 -> shipping 50. Total = 420 - 42 + 50 = 428 EGP
      assert.strictEqual(order.total, 428);
    });

    await test('T5_ORD_06: Invalid phone number (prefix 013 - landline) rejected with HTTP 400', async () => {
      const payload = createBaseOrderPayload();
      payload.customerPhone = '01312345678';

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error, 'Must return Arabic validation error');
    });

    await test('T5_ORD_07: Invalid phone length (10 digits) rejected with HTTP 400', async () => {
      const payload = createBaseOrderPayload();
      payload.customerPhone = '0101234567'; // 10 digits

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
    });

    await test('T5_ORD_08: Valid Eastern Arabic phone numerals normalized to ASCII in database', async () => {
      const payload = createBaseOrderPayload();
      payload.customerPhone = '٠١٠٩٨٧٦٥٤٣٢'; // Eastern Arabic 01098765432

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.order.customerPhone, '01098765432');
    });

    await test('T5_ORD_09: Invalid alternative phone number rejected with HTTP 400', async () => {
      const payload = createBaseOrderPayload();
      payload.customerAltPhone = 'invalid-alt-phone';

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes('رقم الهاتف البديل'));
    });

    await test('T5_ORD_10: Custom Mix Box order placed and constituent nut breakdown persisted in DB', async () => {
      const payload = createBaseOrderPayload();
      // 1kg Custom Mix: 50% Pistachio (410 EGP), 30% Cashew (222 EGP), 20% Hazelnut (140 EGP) = 772 EGP
      payload.items = [
        {
          cartItemId: 'custom-mix-box-1000',
          productId: 'custom-mix-box',
          productName: 'علبة مكسرات مشكلة مخصصة',
          productImage: 'https://images.unsplash.com/photo-1536591375667-f2f2b5a22042',
          weightId: 'custom-1000g',
          weightLabel: '1 كجم (علبة مشكلة)',
          roastOption: 'مشكل حسب الاختيار',
          unitPrice: 1, // Attacker tamper attempt
          quantity: 1,
          isCustomMix: true,
          boxCapacityGrams: 1000,
          customBreakdown: [
            {
              productId: 'prod-pistachio-1',
              productName: 'فستق أمريكي جامبو محمص',
              roastOption: 'محمص مملح',
              percentage: 50,
              weightGrams: 500,
              priceContribution: 410,
            },
            {
              productId: 'prod-cashew-1',
              productName: 'كاجو جامبو ملكي (W180)',
              roastOption: 'محمص بدون ملح',
              percentage: 30,
              weightGrams: 300,
              priceContribution: 222,
            },
            {
              productId: 'prod-hazelnut-1',
              productName: 'بندق تركي مقشر فاخر',
              roastOption: 'نيء طبيعي',
              percentage: 20,
              weightGrams: 200,
              priceContribution: 140,
            },
          ],
        },
      ];
      payload.subtotal = 1;
      payload.total = 1;

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const order = res.data.order;
      assert.strictEqual(order.subtotal, 772, 'Server recalculated 772 EGP for custom mix box');
      assert.strictEqual(order.items[0].isCustomMix, true);
      assert.strictEqual(order.items[0].boxCapacityGrams, 1000);
      assert.strictEqual(order.items[0].customBreakdown.length, 3);
      assert.strictEqual(order.items[0].customBreakdown[0].percentage, 50);
      assert.strictEqual(order.items[0].customBreakdown[0].weightGrams, 500);

      // Verify direct database persistence
      const currentDb = getDb();
      const savedOrder = currentDb.orders.find((o) => o.id === order.id);
      assert.ok(savedOrder, 'Order must be saved in store-db.json');
      assert.strictEqual(savedOrder.items[0].isCustomMix, true);
      assert.strictEqual(savedOrder.items[0].customBreakdown.length, 3);
    });

    await test('T5_ORD_11: Incomplete Custom Mix Box (< 100% capacity) rejected with HTTP 400', async () => {
      const payload = createBaseOrderPayload();
      payload.items = [
        {
          cartItemId: 'custom-mix-box-500',
          productId: 'custom-mix-box',
          productName: 'علبة مشكلة ناقصة',
          productImage: 'https://images.unsplash.com/photo-1536591375667',
          weightId: 'custom-500g',
          weightLabel: '500 جم',
          roastOption: 'محمص مملح',
          unitPrice: 200,
          quantity: 1,
          isCustomMix: true,
          boxCapacityGrams: 500,
          customBreakdown: [
            {
              productId: 'prod-pistachio-1',
              productName: 'فستق',
              roastOption: 'محمص مملح',
              percentage: 60, // Only 60% capacity!
              weightGrams: 300,
              priceContribution: 252,
            },
          ],
        },
      ];

      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes('غير صحيحة') || res.data.error.includes('سعة'));
    });

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 2: ORDERS API - PATCH /api/orders & GET /api/orders
    // ═════════════════════════════════════════════════════════════════════════
    suite('2. PATCH /api/orders & GET /api/orders — Admin Authentication Gate');

    let testOrderId = '';
    // Create an order for testing PATCH transitions
    {
      const payload = createBaseOrderPayload();
      const res = await req('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      testOrderId = res.data.order.id;
    }

    await test('T5_ORD_12: Unauthenticated PATCH /api/orders rejected with HTTP 401 Unauthorized', async () => {
      const res = await req('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: testOrderId, status: 'processing' }),
      });

      assert.strictEqual(res.status, 401);
      assert.ok(res.data.error.includes('401'));
    });

    await test('T5_ORD_13: PATCH /api/orders with invalid HMAC token rejected with HTTP 401', async () => {
      const res = await req('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer FORGED_MALICIOUS_TOKEN_HERE',
        },
        body: JSON.stringify({ orderId: testOrderId, status: 'processing' }),
      });

      assert.strictEqual(res.status, 401);
    });

    // Login to obtain valid admin session token and cookie
    let adminToken = '';
    let adminCookie = '';
    {
      const loginRes = await req('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin' }),
      });
      assert.strictEqual(loginRes.status, 200);
      adminToken = loginRes.data.token;
      adminCookie = loginRes.cookies;
    }

    await test('T5_ORD_14: Authenticated PATCH /api/orders updates status: pending -> processing', async () => {
      const res = await req('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ orderId: testOrderId, status: 'processing' }),
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.order.status, 'processing');

      // Verify direct database persistence
      const currentDb = getDb();
      const order = currentDb.orders.find((o) => o.id === testOrderId);
      assert.strictEqual(order.status, 'processing');
    });

    await test('T5_ORD_15: Authenticated PATCH updates status: processing -> completed -> cancelled', async () => {
      // 1. To completed via cookie
      const res1 = await req('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({ orderId: testOrderId, status: 'completed' }),
      });
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.data.order.status, 'completed');

      // 2. To cancelled via x-admin-token
      const res2 = await req('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ orderId: testOrderId, status: 'cancelled' }),
      });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.data.order.status, 'cancelled');

      const currentDb = getDb();
      const order = currentDb.orders.find((o) => o.id === testOrderId);
      assert.strictEqual(order.status, 'cancelled');
    });

    await test('T5_ORD_16: Unauthenticated GET /api/orders without query returns empty array', async () => {
      const res = await req('/api/orders');
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.data.orders, [], 'Public callers without query must get empty array');
    });

    await test('T5_ORD_17: Authenticated GET /api/orders returns all orders to admin', async () => {
      const res = await req('/api/orders', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.orders));
      assert.ok(res.data.orders.length > 0, 'Admin must see orders');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 3: STORE API - GET & PUT /api/store
    // ═════════════════════════════════════════════════════════════════════════
    suite('3. GET & PUT /api/store — Data Sanitization & Mutation Protection');

    await test('T5_STR_01: Unauthenticated GET /api/store strips adminPassword and orders list', async () => {
      const res = await req('/api/store');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.data.settings.adminPassword,
        undefined,
        'CRITICAL: adminPassword must never be exposed to public visitors'
      );
      assert.deepStrictEqual(
        res.data.orders,
        [],
        'CRITICAL: Customer orders must never be exposed to unauthenticated public visitors'
      );
      assert.ok(res.data.products.length >= 10, 'Public products catalog is intact');
    });

    await test('T5_STR_02: Authenticated GET /api/store returns complete admin dataset', async () => {
      const res = await req('/api/store', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.settings.adminPassword, 'admin');
      assert.ok(res.data.orders.length > 0, 'Admin has full access to customer orders');
    });

    await test('T5_STR_03: Unauthenticated PUT /api/store rejected with HTTP 401 Unauthorized', async () => {
      const res = await req('/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { storeName: 'Hacked Store' } }),
      });

      assert.strictEqual(res.status, 401);
      assert.ok(res.data.error.includes('401'));

      // Verify no changes occurred
      const currentDb = getDb();
      assert.strictEqual(currentDb.settings.storeName, 'محمصة الواحة الذهبية');
    });

    await test('T5_STR_04: Authenticated PUT /api/store updates settings and persists to disk', async () => {
      const originalAnnouncement = getDb().settings.announcementText;
      const testAnnouncement = '🔥 إشعار خاص بالاختبار الأمني 2026';

      const res = await req('/api/store', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          settings: { announcementText: testAnnouncement },
        }),
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.settings.announcementText, testAnnouncement);

      // Verify disk persistence
      const currentDb = getDb();
      assert.strictEqual(currentDb.settings.announcementText, testAnnouncement);

      // Revert announcement text
      await req('/api/store', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          settings: { announcementText: originalAnnouncement },
        }),
      });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 4: ADMIN AUTH API - LOGIN & LOGOUT
    // ═════════════════════════════════════════════════════════════════════════
    suite('4. /api/admin/login & /api/admin/logout — HMAC Authentication & Cookies');

    await test('T5_AUTH_01: Valid password grants token and sets HttpOnly cookie', async () => {
      const res = await req('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin' }),
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.token, 'Token string must be present');
      assert.ok(typeof res.data.expiresAt === 'number');

      // Check cookie security flags
      const cookieStr = res.cookies;
      assert.ok(cookieStr.includes('admin_session='), 'Must set admin_session cookie');
      assert.ok(/httponly/i.test(cookieStr), 'Cookie must be HttpOnly to prevent XSS exfiltration');
      assert.ok(/path=\//i.test(cookieStr), 'Cookie path must be root');
    });

    await test('T5_AUTH_02: Incorrect password rejected with HTTP 401 Unauthorized', async () => {
      const res = await req('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password-999' }),
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error, 'كلمة المرور غير صحيحة');
    });

    await test('T5_AUTH_03: Empty or missing password rejected with HTTP 401', async () => {
      const res1 = await req('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '' }),
      });
      assert.strictEqual(res1.status, 401);

      const res2 = await req('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res2.status, 401);
    });

    await test('T5_AUTH_04: GET /api/admin/login verifies active session token', async () => {
      // 1. Valid token
      const resValid = await req('/api/admin/login', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      assert.strictEqual(resValid.status, 200);
      assert.strictEqual(resValid.data.authenticated, true);

      // 2. Missing token
      const resMissing = await req('/api/admin/login');
      assert.strictEqual(resMissing.status, 401);
      assert.strictEqual(resMissing.data.authenticated, false);

      // 3. Invalid token
      const resInvalid = await req('/api/admin/login', {
        headers: { 'Authorization': 'Bearer FAKE_TOKEN' },
      });
      assert.strictEqual(resInvalid.status, 401);
      assert.strictEqual(resInvalid.data.authenticated, false);
    });

    await test('T5_AUTH_05: POST /api/admin/logout clears admin_session cookie symmetrically', async () => {
      const res = await req('/api/admin/logout', { method: 'POST' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);

      const cookieStr = res.cookies;
      assert.ok(cookieStr.includes('admin_session='), 'Must set admin_session');
      assert.ok(/httponly/i.test(cookieStr), 'Clearance cookie must remain HttpOnly');
      assert.ok(/max-age=0/i.test(cookieStr), 'Must set Max-Age=0 to expire immediately');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 5: REVIEWS API - POST & GET /api/reviews
    // ═════════════════════════════════════════════════════════════════════════
    suite('5. POST & GET /api/reviews — Input Validation & Rating Recalculation');

    await test('T5_REV_01: Review with empty customerName rejected with HTTP 400', async () => {
      const res = await req('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod-pistachio-1',
          customerName: '   ',
          rating: 5,
          comment: 'ممتاز جداً',
        }),
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
      assert.ok(res.data.error);
    });

    await test('T5_REV_02: Review with empty comment rejected with HTTP 400', async () => {
      const res = await req('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod-pistachio-1',
          customerName: 'سامي حسني',
          rating: 5,
          comment: '',
        }),
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
    });

    await test('T5_REV_03: Rating out of bounds (< 1 or > 5) rejected with HTTP 400', async () => {
      const resLow = await req('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod-pistachio-1',
          customerName: 'سامي حسني',
          rating: 0,
          comment: 'تعليق تجريبي',
        }),
      });
      assert.strictEqual(resLow.status, 400);

      const resHigh = await req('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod-pistachio-1',
          customerName: 'سامي حسني',
          rating: 6,
          comment: 'تعليق تجريبي',
        }),
      });
      assert.strictEqual(resHigh.status, 400);
    });

    await test('T5_REV_04: Unknown productId rejected with HTTP 400', async () => {
      const res = await req('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod-non-existent-999',
          customerName: 'سامي حسني',
          rating: 5,
          comment: 'تعليق تجريبي',
        }),
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.error, 'معرف المنتج غير صالح');
    });

    await test('T5_REV_05: Valid review submitted, rating recalculated & persisted to disk', async () => {
      const initialDb = getDb();
      const productBefore = initialDb.products.find((p) => p.id === 'prod-pistachio-1');
      const oldRating = productBefore.rating;
      const oldCount = productBefore.reviewsCount;
      const newIncomingRating = 5;

      const expectedNewCount = oldCount + 1;
      const expectedNewRating = Math.round(((oldRating * oldCount + newIncomingRating) / expectedNewCount) * 10) / 10;

      const reviewPayload = {
        productId: 'prod-pistachio-1',
        customerName: 'د. خالد عبد الفتاح',
        rating: newIncomingRating,
        comment: 'فستق فاخر جداً ومقرمش وأعلى جودة بالسوق المصري!',
      };

      const res = await req('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload),
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.rating, expectedNewRating);
      assert.strictEqual(res.data.reviewsCount, expectedNewCount);
      assert.ok(res.data.review.id.startsWith('rev-'));
      assert.strictEqual(res.data.review.verified, true);

      // Verify direct disk persistence in data/store-db.json
      const diskDb = getDb();
      const productAfter = diskDb.products.find((p) => p.id === 'prod-pistachio-1');
      assert.strictEqual(productAfter.reviewsCount, expectedNewCount);
      assert.strictEqual(productAfter.rating, expectedNewRating);
      assert.strictEqual(productAfter.reviews[0].customerName, 'د. خالد عبد الفتاح');
    });

    await test('T5_REV_06: GET /api/reviews?productId=prod-pistachio-1 returns persisted reviews', async () => {
      const res = await req('/api/reviews?productId=prod-pistachio-1');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.reviews));
      assert.strictEqual(res.data.reviews[0].customerName, 'د. خالد عبد الفتاح');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 6: STORE DATABASE INTEGRITY (data/store-db.json)
    // ═════════════════════════════════════════════════════════════════════════
    suite('6. Database Catalog & Schema Integrity (data/store-db.json)');

    await test('T5_INT_01: Verify all 10 products exist with valid IDs, slugs, and categories', async () => {
      const db = getDb();
      assert.strictEqual(db.products.length, 10, 'Catalog must contain exactly 10 products');

      const validCategoryIds = new Set(db.categories.map((c) => c.id));
      assert.strictEqual(validCategoryIds.size, 4, 'Must have 4 categories');

      const seenIds = new Set();
      const seenSlugs = new Set();

      for (const prod of db.products) {
        assert.ok(prod.id && typeof prod.id === 'string', 'Product id required');
        assert.ok(!seenIds.has(prod.id), `Duplicate product ID: ${prod.id}`);
        seenIds.add(prod.id);

        assert.ok(prod.slug && typeof prod.slug === 'string', `Slug required for ${prod.id}`);
        assert.ok(!seenSlugs.has(prod.slug), `Duplicate slug: ${prod.slug}`);
        seenSlugs.add(prod.slug);

        assert.ok(validCategoryIds.has(prod.categoryId), `Invalid categoryId for ${prod.id}`);
        assert.ok(prod.name && prod.name.trim().length > 0, `Name required for ${prod.id}`);
        assert.ok(prod.subtitle && prod.subtitle.trim().length > 0, `Subtitle required for ${prod.id}`);
        assert.ok(prod.description && prod.description.trim().length > 0, `Description required for ${prod.id}`);
      }
    });

    await test('T5_INT_02: Verify product weight variants and pricing consistency', async () => {
      const db = getDb();
      for (const prod of db.products) {
        assert.ok(Array.isArray(prod.weights), `Weights array required for ${prod.id}`);
        assert.ok(prod.weights.length >= 2, `Product ${prod.id} must have >= 2 weight variants`);

        for (const w of prod.weights) {
          assert.ok(w.id, `Weight id required in ${prod.id}`);
          assert.ok(w.weightGrams > 0, `weightGrams must be > 0 in ${prod.id}`);
          assert.ok(w.price > 0, `price must be > 0 in ${prod.id}`);
          assert.ok(w.label, `label required in ${prod.id}`);
        }
      }
    });

    await test('T5_INT_03: Verify product images, roast options, and nutritional metadata', async () => {
      const db = getDb();
      for (const prod of db.products) {
        assert.ok(prod.image && prod.image.startsWith('http'), `Valid image URL required for ${prod.id}`);
        assert.ok(Array.isArray(prod.roastOptions), `roastOptions array required for ${prod.id}`);
        assert.ok(prod.roastOptions.length >= 1, `At least 1 roast option required for ${prod.id}`);

        assert.ok(typeof prod.caloriesPer100g === 'number' && prod.caloriesPer100g > 0, `Calories required for ${prod.id}`);
        assert.ok(prod.proteinPer100g && typeof prod.proteinPer100g === 'string', `Protein required for ${prod.id}`);
        assert.ok(prod.nutritionalHighlight, `Nutritional highlight required for ${prod.id}`);
      }
    });

    await test('T5_INT_04: Verify settings, shipping rates, and active coupons', async () => {
      const db = getDb();
      assert.ok(db.settings.storeName, 'Store name required');
      assert.ok(db.settings.adminPassword, 'Admin password required');
      assert.ok(typeof db.settings.freeShippingThreshold === 'number');

      assert.ok(Array.isArray(db.shippingRates) && db.shippingRates.length > 0, 'Shipping rates required');
      assert.ok(Array.isArray(db.coupons) && db.coupons.length > 0, 'Coupons required');

      const activeCoupon = db.coupons.find((c) => c.active);
      assert.ok(activeCoupon, 'At least one active coupon must exist');
      assert.ok(activeCoupon.minOrderAmount > 0, 'Active coupon must have minOrderAmount');
    });

  } finally {
    stopServer();

    // Restore pristine database state
    if (dbSnapshot) {
      fs.writeFileSync(DB_PATH, dbSnapshot, 'utf-8');
      console.log(`\n${colors.cyan}✓ Database state pristine: restored store-db.json from backup snapshot.${colors.reset}`);
    }
  }

  // Final Summary Report
  console.log(`\n${colors.bold}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}TIER 5 WHITE-BOX API STRESS TEST RESULTS SUMMARY${colors.reset}`);
  console.log(`${colors.bold}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Total Test Cases : ${totalTests}`);
  console.log(`  Passed           : ${colors.green}${passedTests}${colors.reset}`);
  console.log(`  Failed           : ${failedTests > 0 ? colors.red + failedTests + colors.reset : '0'}`);
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';
  console.log(`  Pass Rate        : ${passRate === '100.0' ? colors.green : colors.red}${passRate}%${colors.reset}`);

  if (failedTests > 0) {
    console.log(`\n${colors.red}${colors.bold}DEFECTS DETECTED (${failedTests}):${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error.message}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}🎉 ALL ${passedTests} TIER 5 STRESS TESTS PASSED SUCCESSFULLY! ZERO VULNERABILITIES DETECTED.${colors.reset}\n`);
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error running Tier 5 test suite:', err);
  stopServer();
  process.exit(1);
});
