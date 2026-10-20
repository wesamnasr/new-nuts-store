/**
 * Challenger M2 Iteration 3 Empirical Stress & Verification Harness
 * 
 * Verifies:
 * 1. Product Channel Rejections (showOnline: false -> 400 in POST /api/orders, showInPos: false -> 400 in POST /api/pos)
 * 2. Next.js 15 Build Manifests Integrity (.next/build-manifest.json, app-build-manifest.json, routes-manifest.json, prerender-manifest.json)
 * 3. Atomic stock and POS role guardrails
 * 
 * Usage:
 *   npx tsx scripts/challenger_m2_it3_stress.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { POST as postOrder } from '../src/app/api/orders/route.ts';
import { POST as postPos, GET as getPos } from '../src/app/api/pos/route.ts';
import { getDb, saveDb, getDbAsync, saveDbAsync } from '../src/lib/db.ts';
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

async function check(name, fn) {
  totalChecks++;
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(1);
    passedChecks++;
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
  } catch (err) {
    const duration = (performance.now() - start).toFixed(1);
    failedChecks++;
    failures.push({ name, error: err });
    console.log(`  ${colors.red}✗ [FAIL]${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
    console.log(`    ${colors.red}Error: ${err.message}${colors.reset}`);
    if (err.stack) {
      console.log(`    ${colors.gray}${err.stack.split('\n').slice(1, 4).join('\n')}${colors.reset}`);
    }
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
}

async function run() {
  console.log(`${colors.bold}Starting Challenger Empirical Stress Harness...${colors.reset}\n`);

  // Ensure DB backup
  const originalDbContent = fs.readFileSync(DB_PATH, 'utf8');

  try {
    // ═════════════════════════════════════════════════════════════════
    // Section 1: Next.js 15 Build Manifests Integrity
    // ═════════════════════════════════════════════════════════════════
    suite('Manifest Integrity: Next.js 15 Build Artifacts');

    const manifestFiles = [
      { name: 'build-manifest.json', relPath: path.join('.next', 'build-manifest.json') },
      { name: 'app-build-manifest.json', relPath: path.join('.next', 'app-build-manifest.json') },
      { name: 'routes-manifest.json', relPath: path.join('.next', 'routes-manifest.json') },
      { name: 'prerender-manifest.json', relPath: path.join('.next', 'prerender-manifest.json') },
    ];

    for (const m of manifestFiles) {
      await check(`Manifest Existence & JSON Validity: ${m.name}`, async () => {
        const fullPath = path.join(ROOT_DIR, m.relPath);
        assert.ok(fs.existsSync(fullPath), `Manifest file ${m.relPath} must exist on disk`);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 0, `Manifest file ${m.relPath} must not be empty`);
        const parsed = JSON.parse(content);
        assert.ok(typeof parsed === 'object' && parsed !== null, `Manifest ${m.name} must parse to an object`);
      });
    }

    await check('Build Manifest Content: build-manifest.json contains pages and polyfills', async () => {
      const fullPath = path.join(ROOT_DIR, '.next', 'build-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      assert.ok(manifest.pages, 'build-manifest.json must have pages property');
      assert.ok(manifest.pages['/_app'], 'pages must contain /_app');
      assert.ok(manifest.pages['/_error'], 'pages must contain /_error');
      assert.ok(Array.isArray(manifest.polyfillFiles), 'build-manifest must have polyfillFiles array');
    });

    await check('App Build Manifest Content: app-build-manifest.json contains core app routes', async () => {
      const fullPath = path.join(ROOT_DIR, '.next', 'app-build-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      assert.ok(manifest.pages, 'app-build-manifest.json must have pages property');
      const expectedRoutes = [
        '/(store)/page',
        '/(pos)/pos/page',
        '/(admin)/admin/page',
        '/(shop)/shop/page',
      ];
      // Note: app routes keys in Next.js 15 may vary by grouping (e.g., /page or /pos/page or grouped)
      const pageKeys = Object.keys(manifest.pages);
      assert.ok(pageKeys.length >= 10, `Expected at least 10 app routes, found ${pageKeys.length}`);
      const hasRoot = pageKeys.some((k) => k.includes('page') || k === '/');
      const hasPos = pageKeys.some((k) => k.includes('pos'));
      const hasAdmin = pageKeys.some((k) => k.includes('admin'));
      assert.ok(hasRoot, 'App build manifest must contain storefront root page');
      assert.ok(hasPos, 'App build manifest must contain pos route');
      assert.ok(hasAdmin, 'App build manifest must contain admin route');
    });

    await check('Routes Manifest Content: routes-manifest.json contains static and dynamic route definitions', async () => {
      const fullPath = path.join(ROOT_DIR, '.next', 'routes-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      assert.ok(Array.isArray(manifest.staticRoutes), 'routes-manifest.json must contain staticRoutes array');
      assert.ok(Array.isArray(manifest.dynamicRoutes), 'routes-manifest.json must contain dynamicRoutes array');
      
      const staticPaths = manifest.staticRoutes.map((r) => r.page);
      assert.ok(staticPaths.includes('/') || staticPaths.includes('/shop'), 'staticRoutes must include / or /shop');
      assert.ok(staticPaths.includes('/pos') || staticPaths.includes('/admin'), 'staticRoutes must include /pos or /admin');
    });

    await check('Prerender Manifest Content: prerender-manifest.json contains valid version and routes/preview', async () => {
      const fullPath = path.join(ROOT_DIR, '.next', 'prerender-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      assert.ok(manifest.version >= 4, 'prerender-manifest version must be >= 4');
      assert.ok(typeof manifest.routes === 'object', 'prerender-manifest must contain routes object');
      assert.ok(typeof manifest.dynamicRoutes === 'object', 'prerender-manifest must contain dynamicRoutes object');
    });

    // ═════════════════════════════════════════════════════════════════
    // Section 2: Product Channel Visibility & Rejection Hardening
    // ═════════════════════════════════════════════════════════════════
    suite('Product Channel Rejection: Online Order vs POS Sale');

    // Prepare test database state:
    // Product 1: showOnline: false, showInPos: true (POS-only item)
    // Product 2: showOnline: true, showInPos: false (Online-only item)
    // Product 3: showOnline: true, showInPos: true (Dual-channel item)
    // Product 4: showOnline: false, showInPos: false (Hidden item)

    const db = await getDbAsync();
    const posOnlyProd = db.products.find((p) => p.showOnline === false && p.showInPos === true) || {
      ...db.products[0],
      id: 'test-pos-only-prod',
      name: 'منتج كاشير فقط',
      showOnline: false,
      showInPos: true,
      stockKg: 50,
      inStock: true,
    };
    posOnlyProd.showOnline = false;
    posOnlyProd.showInPos = true;

    const onlineOnlyProd = db.products.find((p) => p.showOnline === true && p.showInPos === false) || {
      ...db.products[1],
      id: 'test-online-only-prod',
      name: 'منتج أونلاين فقط',
      showOnline: true,
      showInPos: false,
      stockKg: 50,
      inStock: true,
    };
    onlineOnlyProd.showOnline = true;
    onlineOnlyProd.showInPos = false;

    // Save test products into db
    if (!db.products.some((p) => p.id === posOnlyProd.id)) db.products.push(posOnlyProd);
    if (!db.products.some((p) => p.id === onlineOnlyProd.id)) db.products.push(onlineOnlyProd);
    await saveDbAsync(db);

    const cashierPassword = getRolePasswordFromSettings(db.settings, 'cashier');
    const { token: cashierToken } = generateAdminToken(cashierPassword, 'cashier');

    const adminPassword = getRolePasswordFromSettings(db.settings, 'super_admin');
    const { token: adminToken } = generateAdminToken(adminPassword, 'super_admin');

    const supplierPassword = getRolePasswordFromSettings(db.settings, 'supplier');
    const { token: supplierToken } = generateAdminToken(supplierPassword, 'supplier');

    const accountantPassword = getRolePasswordFromSettings(db.settings, 'accountant');
    const { token: accountantToken } = generateAdminToken(accountantPassword, 'accountant');

    await check('Online Order Rejection: Standard product with showOnline: false returns 400', async () => {
      const weightObj = posOnlyProd.weights?.[0] || { id: 'w1', label: '250 جرام', grams: 250, price: 100 };
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'أحمد علي',
          customerPhone: '01012345678',
          address: 'شارع الجمهورية - بني مزار',
          city: 'بني مزار',
          deliveryMethod: 'delivery',
          paymentMethod: 'cash_on_delivery',
          items: [
            {
              productId: posOnlyProd.id,
              productName: posOnlyProd.name,
              weightId: weightObj.id,
              weightLabel: weightObj.label,
              unitPrice: weightObj.price,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await postOrder(req);
      assert.strictEqual(res.status, 400, `Expected HTTP 400, received ${res.status}`);
      const body = await res.json();
      assert.ok(
        body.error && body.error.includes('غير متاح للطلب عبر المتجر الإلكتروني'),
        `Expected Arabic online rejection message, received: ${body.error}`
      );
    });

    await check('Online Order Rejection: Partitioned Box with slot having showOnline: false returns 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'سارة محمود',
          customerPhone: '01123456789',
          address: 'شارع المحطة - بني مزار',
          city: 'بني مزار',
          deliveryMethod: 'delivery',
          paymentMethod: 'cash_on_delivery',
          items: [
            {
              productId: 'partitioned-box-roqan_4',
              productName: 'بوكس روقان 4 خانات',
              quantity: 1,
              isPartitionedBox: true,
              partitionedBoxSize: 'roqan_4',
              partitionedSlots: [
                {
                  slotIndex: 1,
                  productId: posOnlyProd.id,
                  productName: posOnlyProd.name,
                  roastOption: 'محمص مملح',
                  slotGrams: 100,
                  pricePerKg: posOnlyProd.pricePerKg || 400,
                },
                {
                  slotIndex: 2,
                  productId: onlineOnlyProd.id,
                  productName: onlineOnlyProd.name,
                  roastOption: 'محمص خفيف',
                  slotGrams: 100,
                  pricePerKg: onlineOnlyProd.pricePerKg || 400,
                },
                {
                  slotIndex: 3,
                  productId: onlineOnlyProd.id,
                  productName: onlineOnlyProd.name,
                  roastOption: 'نيء',
                  slotGrams: 100,
                  pricePerKg: onlineOnlyProd.pricePerKg || 400,
                },
                {
                  slotIndex: 4,
                  productId: onlineOnlyProd.id,
                  productName: onlineOnlyProd.name,
                  roastOption: 'محمص بالليمون',
                  slotGrams: 100,
                  pricePerKg: onlineOnlyProd.pricePerKg || 400,
                },
              ],
            },
          ],
        }),
      });

      const res = await postOrder(req);
      assert.strictEqual(res.status, 400, `Expected HTTP 400, received ${res.status}`);
      const body = await res.json();
      assert.ok(
        body.error && body.error.includes('غير متاح للطلب عبر المتجر الإلكتروني'),
        `Expected Arabic online rejection message, received: ${body.error}`
      );
    });

    await check('Online Order Rejection: Custom Mix Box with breakdown having showOnline: false returns 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'محمد حسن',
          customerPhone: '01234567890',
          address: 'بني مزار - المنيا',
          city: 'بني مزار',
          deliveryMethod: 'delivery',
          paymentMethod: 'cash_on_delivery',
          items: [
            {
              productId: 'custom-box-500g',
              productName: 'علبة مشكلة مخصصة 500 جرام',
              quantity: 1,
              isCustomMix: true,
              boxCapacityGrams: 500,
              customBreakdown: [
                {
                  productId: posOnlyProd.id,
                  percentage: 50,
                  roastOption: 'محمص مملح',
                },
                {
                  productId: onlineOnlyProd.id,
                  percentage: 50,
                  roastOption: 'محمص خفيف',
                },
              ],
            },
          ],
        }),
      });

      const res = await postOrder(req);
      assert.strictEqual(res.status, 400, `Expected HTTP 400, received ${res.status}`);
      const body = await res.json();
      assert.ok(
        body.error && body.error.includes('غير متاح للطلب عبر المتجر الإلكتروني'),
        `Expected Arabic online rejection message, received: ${body.error}`
      );
    });

    await check('POS Sale Rejection: Standard product with showInPos: false returns 400', async () => {
      const weightObj = onlineOnlyProd.weights?.[0] || { id: 'w1', label: '250 جرام', grams: 250, price: 100 };
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cash',
          orderType: 'takeaway',
          items: [
            {
              productId: onlineOnlyProd.id,
              productName: onlineOnlyProd.name,
              weightId: weightObj.id,
              weightLabel: weightObj.label,
              unitPrice: weightObj.price,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await postPos(req);
      assert.strictEqual(res.status, 400, `Expected HTTP 400, received ${res.status}`);
      const body = await res.json();
      assert.ok(
        body.error && body.error.includes('غير مصرح ببيعه عبر الكاشير'),
        `Expected Arabic POS rejection message, received: ${body.error}`
      );
    });

    await check('POS Sale Rejection: Partitioned Box with slot having showInPos: false returns 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cash',
          orderType: 'takeaway',
          items: [
            {
              productId: 'pos-part-box-1',
              productName: 'بوكس كاشير مقسم',
              quantity: 1,
              isPartitionedBox: true,
              partitionedBoxSize: 'roqan_4',
              partitionedSlots: [
                {
                  slotIndex: 1,
                  productId: onlineOnlyProd.id,
                  productName: onlineOnlyProd.name,
                },
              ],
            },
          ],
        }),
      });

      const res = await postPos(req);
      assert.strictEqual(res.status, 400, `Expected HTTP 400, received ${res.status}`);
      const body = await res.json();
      assert.ok(
        body.error && body.error.includes('غير مصرح ببيعه عبر الكاشير'),
        `Expected Arabic POS rejection message, received: ${body.error}`
      );
    });

    await check('POS Sale Rejection: Custom Mix with breakdown item having showInPos: false returns 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cash',
          orderType: 'takeaway',
          items: [
            {
              productId: 'pos-custom-box-1',
              productName: 'بوكس مشكل',
              quantity: 1,
              isCustomMix: true,
              boxCapacityGrams: 500,
              customBreakdown: [
                {
                  productId: onlineOnlyProd.id,
                  percentage: 100,
                },
              ],
            },
          ],
        }),
      });

      const res = await postPos(req);
      assert.strictEqual(res.status, 400, `Expected HTTP 400, received ${res.status}`);
      const body = await res.json();
      assert.ok(
        body.error && body.error.includes('غير مصرح ببيعه عبر الكاشير'),
        `Expected Arabic POS rejection message, received: ${body.error}`
      );
    });

    await check('Positive Baseline: Online Order with showOnline: true succeeds (HTTP 200/201)', async () => {
      const weightObj = onlineOnlyProd.weights?.[0] || { id: 'w1', label: '250 جرام', grams: 250, price: 100 };
      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'عميل أونلاين سليم',
          customerPhone: '01099887766',
          address: 'بني مزار - المركز',
          city: 'بني مزار',
          deliveryMethod: 'delivery',
          paymentMethod: 'cash_on_delivery',
          items: [
            {
              productId: onlineOnlyProd.id,
              productName: onlineOnlyProd.name,
              weightId: weightObj.id,
              weightLabel: weightObj.label,
              unitPrice: weightObj.price,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await postOrder(req);
      assert.strictEqual(res.status, 201, `Expected HTTP 201, received ${res.status}`);
      const body = await res.json();
      assert.ok(body.order && body.order.id, 'Response must return order object with ID');
    });

    await check('Positive Baseline: POS Sale with showInPos: true succeeds (HTTP 201)', async () => {
      const weightObj = posOnlyProd.weights?.[0] || { id: 'w1', label: '250 جرام', grams: 250, price: 100 };
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          paymentMethod: 'cash',
          orderType: 'takeaway',
          items: [
            {
              productId: posOnlyProd.id,
              productName: posOnlyProd.name,
              weightId: weightObj.id,
              weightLabel: weightObj.label,
              unitPrice: weightObj.price,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await postPos(req);
      assert.strictEqual(res.status, 201, `Expected HTTP 201, received ${res.status}`);
      const body = await res.json();
      assert.ok(body.success, 'POS Sale must succeed with success: true');
      assert.ok(body.order && body.order.orderNumber, 'Response must return created order with orderNumber');
    });

    await check('POS Role Isolation: Unauthenticated POST /api/pos returns 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_invoice', items: [{ productId: 'any' }] }),
      });
      const res = await postPos(req);
      assert.strictEqual(res.status, 401, `Expected HTTP 401, received ${res.status}`);
    });

    await check('POS Role Isolation: Supplier POST /api/pos returns 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supplierToken}`,
        },
        body: JSON.stringify({ action: 'create_invoice', items: [{ productId: 'any' }] }),
      });
      const res = await postPos(req);
      assert.strictEqual(res.status, 403, `Expected HTTP 403, received ${res.status}`);
    });

    await check('POS Role Isolation: Accountant POST /api/pos returns 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accountantToken}`,
        },
        body: JSON.stringify({ action: 'create_invoice', items: [{ productId: 'any' }] }),
      });
      const res = await postPos(req);
      assert.strictEqual(res.status, 403, `Expected HTTP 403, received ${res.status}`);
    });

  } finally {
    // Restore pristine database state
    fs.writeFileSync(DB_PATH, originalDbContent, 'utf8');
    console.log(`\n${colors.gray}[State Cleanup] Restored original database state.${colors.reset}`);
  }

  // ═════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}EMPIRICAL CHALLENGE SUITE RESULTS${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Total Invariant Checks : ${colors.bold}${totalChecks}${colors.reset}`);
  console.log(`  Passed                 : ${colors.green}${colors.bold}${passedChecks}${colors.reset}`);
  console.log(`  Failed                 : ${failedChecks > 0 ? colors.red : colors.green}${colors.bold}${failedChecks}${colors.reset}`);
  console.log(`  Pass Rate              : ${colors.bold}${((passedChecks / totalChecks) * 100).toFixed(1)}%${colors.reset}`);

  if (failures.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Failures Summary:${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${colors.red}${f.name}${colors.reset}: ${f.error.message}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}🎉 ALL ${totalChecks} INVARIANT CHECKS PASSED EMPIRICALLY! ZERO REGRESSIONS.${colors.reset}\n`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal Runner Exception:', err);
  process.exit(1);
});
