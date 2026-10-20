/**
 * Empirical Adversarial Test Harness for Milestone 5 Final Verification
 * Project: محمصة حفصة للبن والمكسرات
 * Agent: challenger_m5_final
 * 
 * Execution: npx tsx scripts/challenger_m5_final_empirical.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');
const DB_BACKUP_PATH = path.join(ROOT_DIR, 'data', 'store-db.json.challenger.bak');

// Import API Route Handlers directly via TSX
import { POST as loginPOST, GET as loginGET } from '../src/app/api/admin/login/route.ts';
import { GET as storeGET, PUT as storePUT } from '../src/app/api/store/route.ts';
import { POST as ordersPOST, PATCH as ordersPATCH, DELETE as ordersDELETE } from '../src/app/api/orders/route.ts';
import { GET as posGET, POST as posPOST } from '../src/app/api/pos/route.ts';
import { GET as supplyInvoicesGET, POST as supplyInvoicesPOST, PATCH as supplyInvoicesPATCH } from '../src/app/api/supply-invoices/route.ts';
import { POST as vipPOST, GET as vipGET } from '../src/app/api/vip/route.ts';
import { generateAdminToken, sanitizeStoreDataForRole, sanitizePublicStoreData } from '../src/lib/auth.ts';
import { getDbAsync, saveDbAsync } from '../src/lib/db.ts';

let passedChecks = 0;
let totalChecks = 0;

async function asyncCheck(title, asyncAssertionFn) {
  totalChecks++;
  try {
    await asyncAssertionFn();
    console.log(`  ✓ [PASS] #${totalChecks}: ${title}`);
    passedChecks++;
  } catch (err) {
    console.error(`  ✗ [FAIL] #${totalChecks}: ${title}`);
    console.error(err);
    throw err;
  }
}

async function runEmpiricalStressSuite() {
  console.log('========================================================================');
  console.log('  CHALLENGER M5 FINAL: EMPIRICAL ADVERSARIAL STRESS VERIFICATION SUITE');
  console.log('  Testing Subsystems: Channels, Stock, RBAC, Invoices, Accountant Sync');
  console.log('========================================================================\n');

  // Backup store-db.json before test execution
  fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);

  try {
    const initialDb = await getDbAsync();

    // Setup helper tokens
    const adminToken = generateAdminToken(initialDb.settings.adminPassword, 'super_admin').token;
    const supplierToken = generateAdminToken(initialDb.settings.supplierPassword, 'supplier').token;
    const cashierToken = generateAdminToken(initialDb.settings.cashierPassword, 'cashier').token;
    const accountantToken = generateAdminToken(initialDb.settings.accountantPassword, 'accountant').token;

    console.log('\n------------------------------------------------------------------------');
    console.log('SECTION 1: Product Channels & Inventory Depletion');
    console.log('------------------------------------------------------------------------');

    // 1.1 Direct product with showOnline === false blocked on POST /api/orders
    await asyncCheck('POST /api/orders rejects direct product with showOnline === false (400)', async () => {
      const db = await getDbAsync();
      const testProd = db.products[0];
      const originalShowOnline = testProd.showOnline;
      testProd.showOnline = false;
      await saveDbAsync(db);

      try {
        const req = new NextRequest('http://localhost:3000/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'أحمد محمود',
            customerPhone: '01012345678',
            deliveryMethod: 'bandar_fast',
            address: 'شارع البحر، بني مزار',
            items: [
              {
                productId: testProd.id,
                productName: testProd.name,
                weightId: testProd.weights[0].id,
                weightLabel: testProd.weights[0].label,
                unitPrice: testProd.weights[0].price,
                quantity: 1,
              },
            ],
          }),
        });

        const res = await ordersPOST(req);
        assert.equal(res.status, 400, 'Must return 400 Bad Request');
        const data = await res.json();
        assert.ok(data.error.includes('غير متاح للطلب عبر المتجر الإلكتروني'), 'Must return channel rejection error');
      } finally {
        testProd.showOnline = originalShowOnline;
        await saveDbAsync(db);
      }
    });

    // 1.2 Partitioned box containing showOnline === false slot blocked on POST /api/orders
    await asyncCheck('POST /api/orders rejects partitioned box with showOnline === false slot (400)', async () => {
      const db = await getDbAsync();
      const slotProd = db.products[1];
      const originalShowOnline = slotProd.showOnline;
      slotProd.showOnline = false;
      await saveDbAsync(db);

      try {
        const req = new NextRequest('http://localhost:3000/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'محمد سمير',
            customerPhone: '01123456789',
            deliveryMethod: 'bandar_fast',
            address: 'شارع الجمهورية',
            items: [
              {
                isPartitionedBox: true,
                partitionedBoxSize: 'roqan_4',
                productName: 'بوكس روقان 4 خانات',
                quantity: 1,
                partitionedSlots: [
                  { slotIndex: 0, productId: slotProd.id, productName: slotProd.name, slotGrams: 100 },
                  { slotIndex: 1, productId: db.products[0].id, productName: db.products[0].name, slotGrams: 100 },
                  { slotIndex: 2, productId: db.products[2].id, productName: db.products[2].name, slotGrams: 100 },
                  { slotIndex: 3, productId: db.products[3].id, productName: db.products[3].name, slotGrams: 100 },
                ],
              },
            ],
          }),
        });

        const res = await ordersPOST(req);
        assert.equal(res.status, 400, 'Must return 400 Bad Request');
        const data = await res.json();
        assert.ok(data.error.includes('غير متاح للطلب عبر المتجر الإلكتروني'), 'Must return channel rejection error for slot');
      } finally {
        slotProd.showOnline = originalShowOnline;
        await saveDbAsync(db);
      }
    });

    // 1.3 Custom mix box containing showOnline === false portion blocked on POST /api/orders
    await asyncCheck('POST /api/orders rejects custom mix box with showOnline === false portion (400)', async () => {
      const db = await getDbAsync();
      const mixProd = db.products[2];
      const originalShowOnline = mixProd.showOnline;
      mixProd.showOnline = false;
      await saveDbAsync(db);

      try {
        const req = new NextRequest('http://localhost:3000/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'محمود علي',
            customerPhone: '01234567890',
            deliveryMethod: 'bandar_fast',
            address: 'شارع المحطة',
            items: [
              {
                isCustomMix: true,
                boxCapacityGrams: 500,
                productName: 'علبة مشكلة مخصصة 500 جرام',
                quantity: 1,
                customBreakdown: [
                  { productId: mixProd.id, productName: mixProd.name, percentage: 50, weightGrams: 250 },
                  { productId: db.products[0].id, productName: db.products[0].name, percentage: 50, weightGrams: 250 },
                ],
              },
            ],
          }),
        });

        const res = await ordersPOST(req);
        assert.equal(res.status, 400, 'Must return 400 Bad Request');
        const data = await res.json();
        assert.ok(data.error.includes('غير متاح للطلب عبر المتجر الإلكتروني'), 'Must return channel rejection error for custom mix portion');
      } finally {
        mixProd.showOnline = originalShowOnline;
        await saveDbAsync(db);
      }
    });

    // 1.4 Direct product with showInPos === false blocked on POST /api/pos
    await asyncCheck('POST /api/pos rejects direct product with showInPos === false (400)', async () => {
      const db = await getDbAsync();
      const posProd = db.products[3];
      const originalShowInPos = posProd.showInPos;
      posProd.showInPos = false;
      await saveDbAsync(db);

      try {
        const req = new NextRequest('http://localhost:3000/api/pos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cashierToken}`,
          },
          body: JSON.stringify({
            action: 'create_invoice',
            posOrderType: 'counter_takeaway',
            paymentMethod: 'cod',
            items: [
              {
                productId: posProd.id,
                productName: posProd.name,
                weightId: posProd.weights[0].id,
                unitPrice: posProd.weights[0].price,
                quantity: 1,
              },
            ],
          }),
        });

        const res = await posPOST(req);
        assert.equal(res.status, 400, 'Must return 400 Bad Request');
        const data = await res.json();
        assert.ok(data.error.includes('غير مصرح ببيعه عبر الكاشير'), 'Must return POS channel rejection error');
      } finally {
        posProd.showInPos = originalShowInPos;
        await saveDbAsync(db);
      }
    });

    // 1.5 Partitioned box containing showInPos === false slot blocked on POST /api/pos
    await asyncCheck('POST /api/pos rejects partitioned box with showInPos === false slot (400)', async () => {
      const db = await getDbAsync();
      const posSlotProd = db.products[4];
      const originalShowInPos = posSlotProd.showInPos;
      posSlotProd.showInPos = false;
      await saveDbAsync(db);

      try {
        const req = new NextRequest('http://localhost:3000/api/pos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cashierToken}`,
          },
          body: JSON.stringify({
            action: 'create_invoice',
            posOrderType: 'counter_takeaway',
            items: [
              {
                isPartitionedBox: true,
                partitionedBoxSize: 'roqan_4',
                productName: 'بوكس روقان 4 خانات',
                quantity: 1,
                partitionedSlots: [
                  { slotIndex: 0, productId: posSlotProd.id, productName: posSlotProd.name, slotGrams: 100 },
                  { slotIndex: 1, productId: db.products[0].id, productName: db.products[0].name, slotGrams: 100 },
                ],
              },
            ],
          }),
        });

        const res = await posPOST(req);
        assert.equal(res.status, 400, 'Must return 400 Bad Request');
        const data = await res.json();
        assert.ok(data.error.includes('غير مصرح ببيعه عبر الكاشير'), 'Must return POS channel rejection error for slot');
      } finally {
        posSlotProd.showInPos = originalShowInPos;
        await saveDbAsync(db);
      }
    });

    // 1.6 Custom mix box containing showInPos === false portion blocked on POST /api/pos
    await asyncCheck('POST /api/pos rejects custom mix box with showInPos === false portion (400)', async () => {
      const db = await getDbAsync();
      const posMixProd = db.products[5];
      const originalShowInPos = posMixProd.showInPos;
      posMixProd.showInPos = false;
      await saveDbAsync(db);

      try {
        const req = new NextRequest('http://localhost:3000/api/pos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cashierToken}`,
          },
          body: JSON.stringify({
            action: 'create_invoice',
            posOrderType: 'counter_takeaway',
            items: [
              {
                isCustomMix: true,
                boxCapacityGrams: 500,
                productName: 'علبة مشكلة مخصصة 500 جرام',
                quantity: 1,
                customBreakdown: [
                  { productId: posMixProd.id, productName: posMixProd.name, percentage: 50, weightGrams: 250 },
                  { productId: db.products[0].id, productName: db.products[0].name, percentage: 50, weightGrams: 250 },
                ],
              },
            ],
          }),
        });

        const res = await posPOST(req);
        assert.equal(res.status, 400, 'Must return 400 Bad Request');
        const data = await res.json();
        assert.ok(data.error.includes('غير مصرح ببيعه عبر الكاشير'), 'Must return POS channel rejection error for mix');
      } finally {
        posMixProd.showInPos = originalShowInPos;
        await saveDbAsync(db);
      }
    });

    // 1.7 Atomic stock depletion on Online Order across all 4 item types
    await asyncCheck('POST /api/orders atomically decrements stockKg and updates inStock flag', async () => {
      const db = await getDbAsync();
      const stdProd = db.products[0];
      const slotProd = db.products[1];
      const mixProd = db.products[2];
      const coffeeProd = db.products.find((p) => p.categoryId === 'cat-coffee-espresso') || db.products[10];

      // Reset stock values for predictable verification
      stdProd.stockKg = 10.0;
      slotProd.stockKg = 5.0;
      mixProd.stockKg = 8.0;
      coffeeProd.stockKg = 6.0;
      await saveDbAsync(db);

      // 4 slots for partitioned box roqan_4
      const p3 = db.products[3];
      const p4 = db.products[4];
      const stdWeight500 = stdProd.weights.find((w) => w.weightGrams === 500) || stdProd.weights[2];

      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'علي كمال',
          customerPhone: '01011112222',
          deliveryMethod: 'bandar_fast',
          address: 'بني مزار',
          items: [
            // Standard product 500g, qty 2 -> 1.0 kg consumed
            {
              productId: stdProd.id,
              productName: stdProd.name,
              weightId: stdWeight500.id,
              weightLabel: stdWeight500.label,
              unitPrice: stdWeight500.price,
              quantity: 2,
            },
            // Partitioned box 4 slots: 100g each slot, qty 1
            {
              isPartitionedBox: true,
              partitionedBoxSize: 'roqan_4',
              productName: 'بوكس روقان 4 خانات',
              quantity: 1,
              partitionedSlots: [
                { slotIndex: 1, productId: slotProd.id, productName: slotProd.name, slotGrams: 100, roastOption: 'محمص مملح' },
                { slotIndex: 2, productId: stdProd.id, productName: stdProd.name, slotGrams: 100, roastOption: 'محمص مملح' },
                { slotIndex: 3, productId: p3.id, productName: p3.name, slotGrams: 100, roastOption: 'محمص مملح' },
                { slotIndex: 4, productId: p4.id, productName: p4.name, slotGrams: 100, roastOption: 'محمص مملح' },
              ],
            },
            // Custom mix box 500g: mixProd (50%) + stdProd (50%), qty 2 -> 0.5 kg mixProd, 0.5 kg stdProd consumed
            {
              isCustomMix: true,
              boxCapacityGrams: 500,
              productName: 'علبة مشكلة مخصصة 500 جرام',
              quantity: 2,
              customBreakdown: [
                { productId: mixProd.id, productName: mixProd.name, percentage: 50, roastOption: 'محمص مملح' },
                { productId: stdProd.id, productName: stdProd.name, percentage: 50, roastOption: 'محمص مملح' },
              ],
            },
            // Coffee blend 250g, qty 2 -> 0.5 kg consumed
            {
              isCoffeeBlend: true,
              productId: coffeeProd.id,
              productName: 'توليفة قهوة خاصة',
              coffeeBlendSpec: {
                brazilianPercent: 50,
                colombianPercent: 50,
                weightGrams: 250,
                roastLevel: 'وسط (مضبوط)',
                spicing: 'سادة بدون إضافات',
                grindType: 'ماكينة تركي ناعم',
              },
              unitPrice: 90,
              quantity: 2,
            },
          ],
        }),
      });

      const res = await ordersPOST(req);
      const resData = await res.json();
      assert.equal(res.status, 201, `Order must be created with 201: ${JSON.stringify(resData.error || resData)}`);

      const reloadedDb = await getDbAsync();
      const updatedStd = reloadedDb.products.find((p) => p.id === stdProd.id);
      const updatedSlot = reloadedDb.products.find((p) => p.id === slotProd.id);
      const updatedMix = reloadedDb.products.find((p) => p.id === mixProd.id);
      const updatedCoffee = reloadedDb.products.find((p) => p.id === coffeeProd.id);

      // stdProd consumed: 1.0 (std) + 0.1 (slot) + 0.5 (mix: 250g*2=500g) = 1.6 kg => 10.0 - 1.6 = 8.4 kg
      assert.equal(updatedStd.stockKg, 8.4, 'Standard item stock must be 8.4 kg');
      // slotProd consumed: 0.1 kg => 5.0 - 0.1 = 4.9 kg
      assert.equal(updatedSlot.stockKg, 4.9, 'Slot item stock must be 4.9 kg');
      // mixProd consumed: 0.5 kg => 8.0 - 0.5 = 7.5 kg
      assert.equal(updatedMix.stockKg, 7.5, 'Mix item stock must be 7.5 kg');
      // coffeeProd consumed: 0.5 kg => 6.0 - 0.5 = 5.5 kg
      assert.equal(updatedCoffee.stockKg, 5.5, 'Coffee blend stock must be 5.5 kg');
    });

    // 1.8 Atomic stock depletion on POS sale and inStock false boundary transition
    await asyncCheck('POST /api/pos atomically decrements stockKg and sets inStock: false when depleted to 0', async () => {
      const db = await getDbAsync();
      const depleteProd = db.products[0];
      depleteProd.stockKg = 0.5; // Exactly 500g in stock
      depleteProd.inStock = true;
      await saveDbAsync(db);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          action: 'create_invoice',
          posOrderType: 'counter_takeaway',
          paymentMethod: 'cod',
          items: [
            {
              productId: depleteProd.id,
              productName: depleteProd.name,
              customWeightGrams: 500, // consumes 0.5 kg
              unitPrice: 150,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await posPOST(req);
      assert.equal(res.status, 201, 'POS sale must succeed with 201');

      const reloadedDb = await getDbAsync();
      const updated = reloadedDb.products.find((p) => p.id === depleteProd.id);
      assert.equal(updated.stockKg, 0, 'stockKg must be exactly 0');
      assert.equal(updated.inStock, false, 'inStock must be transitioned to false when stockKg reaches 0');
    });

    console.log('\n------------------------------------------------------------------------');
    console.log('SECTION 2: Staff Authentication & RBAC Guardrails');
    console.log('------------------------------------------------------------------------');

    // 2.1 Dynamic password authentication from db.settings for all 4 roles
    await asyncCheck('Dynamic password authentication succeeds for super_admin, supplier, cashier, and accountant', async () => {
      const db = await getDbAsync();
      const roles = [
        { role: 'super_admin', user: db.settings.adminUsername, pass: db.settings.adminPassword },
        { role: 'supplier', user: db.settings.supplierUsername, pass: db.settings.supplierPassword },
        { role: 'cashier', user: db.settings.cashierUsername, pass: db.settings.cashierPassword },
        { role: 'accountant', user: db.settings.accountantUsername, pass: db.settings.accountantPassword },
      ];

      for (const r of roles) {
        const req = new NextRequest('http://localhost:3000/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: r.user, password: r.pass, role: r.role }),
        });
        const res = await loginPOST(req);
        assert.equal(res.status, 200, `Login must succeed for ${r.role}`);
        const data = await res.json();
        assert.equal(data.role, r.role);
        assert.ok(data.token, 'Must return JWT/HMAC token');
      }
    });

    // 2.2 Password rotation: modifying password in db.settings immediately revokes old password
    await asyncCheck('Rotating password in db.settings immediately invalidates old password (401) and validates new (200)', async () => {
      const db = await getDbAsync();
      const oldPass = db.settings.cashierPassword;
      const newPass = 'NewCashierPass#2026';
      db.settings.cashierPassword = newPass;
      await saveDbAsync(db);

      try {
        // Attempt with old password -> must fail 401
        const oldReq = new NextRequest('http://localhost:3000/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: db.settings.cashierUsername,
            password: oldPass,
            role: 'cashier',
          }),
        });
        const oldRes = await loginPOST(oldReq);
        assert.equal(oldRes.status, 401, 'Old password must be rejected with 401');

        // Attempt with new password -> must succeed 200
        const newReq = new NextRequest('http://localhost:3000/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: db.settings.cashierUsername,
            password: newPass,
            role: 'cashier',
          }),
        });
        const newRes = await loginPOST(newReq);
        assert.equal(newRes.status, 200, 'New rotated password must be accepted with 200');
      } finally {
        db.settings.cashierPassword = oldPass;
        await saveDbAsync(db);
      }
    });

    // 2.3 Unauthenticated requests to protected APIs strictly return 401
    await asyncCheck('Unauthenticated requests to protected routes return 401 Unauthorized', async () => {
      const endpoints = [
        { name: 'GET /api/pos', fn: () => posGET(new NextRequest('http://localhost:3000/api/pos')) },
        {
          name: 'POST /api/pos',
          fn: () => posPOST(new NextRequest('http://localhost:3000/api/pos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_invoice' }),
          })),
        },
        {
          name: 'PUT /api/store',
          fn: () => storePUT(new NextRequest('http://localhost:3000/api/store', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: {} }),
          })),
        },
        {
          name: 'PATCH /api/orders',
          fn: () => ordersPATCH(new NextRequest('http://localhost:3000/api/orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: 'ord-1', status: 'shipped' }),
          })),
        },
        {
          name: 'DELETE /api/orders',
          fn: () => ordersDELETE(new NextRequest('http://localhost:3000/api/orders?orderId=ord-1', {
            method: 'DELETE',
          })),
        },
        {
          name: 'GET /api/supply-invoices',
          fn: () => supplyInvoicesGET(new Request('http://localhost:3000/api/supply-invoices')),
        },
        {
          name: 'POST /api/supply-invoices',
          fn: () => supplyInvoicesPOST(new Request('http://localhost:3000/api/supply-invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [] }),
          })),
        },
        {
          name: 'PATCH /api/supply-invoices',
          fn: () => supplyInvoicesPATCH(new Request('http://localhost:3000/api/supply-invoices', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: 'inv-1', status: 'approved' }),
          })),
        },
      ];

      for (const ep of endpoints) {
        const res = await ep.fn();
        assert.equal(res.status, 401, `${ep.name} unauthenticated must return 401 Unauthorized`);
      }
    });

    // 2.4 Cashier role isolation: wholesale costs hidden, supply invoices 403, store mutations 403
    await asyncCheck('Cashier role cannot access wholesale costs (costPerKg) or supply invoices (403)', async () => {
      // 1. GET /api/store as cashier
      const storeReq = new NextRequest('http://localhost:3000/api/store', {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });
      const storeRes = await storeGET(storeReq);
      assert.equal(storeRes.status, 200);
      const storeData = await storeRes.json();
      assert.equal(storeData.products[0].costPerKg, undefined, 'costPerKg must be stripped for cashier');
      assert.equal(storeData.products[0].packagingCost, undefined, 'packagingCost must be stripped for cashier');
      if (storeData.orders && storeData.orders.length > 0) {
        assert.equal(storeData.orders[0].rawCostTotal, undefined, 'rawCostTotal must be stripped from orders for cashier');
        assert.equal(storeData.orders[0].netProfitEgp, undefined, 'netProfitEgp must be stripped from orders for cashier');
      }

      // Public visitor has orders stripped completely
      const pubRes = await storeGET(new NextRequest('http://localhost:3000/api/store'));
      const pubData = await pubRes.json();
      assert.equal(pubData.orders.length, 0, 'Public visitors must receive empty orders array');
      assert.equal(pubData.products[0].costPerKg, undefined, 'costPerKg must be stripped for public');

      // 2. GET /api/supply-invoices as cashier -> 403
      const supReq = new Request('http://localhost:3000/api/supply-invoices', {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });
      const supRes = await supplyInvoicesGET(supReq);
      assert.equal(supRes.status, 403, 'GET /api/supply-invoices as cashier must return 403 Forbidden');

      // 3. PUT /api/store as cashier -> 403
      const putReq = new NextRequest('http://localhost:3000/api/store', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: {} }),
      });
      const putRes = await storePUT(putReq);
      assert.equal(putRes.status, 403, 'PUT /api/store as cashier must return 403 Forbidden');
    });

    // 2.5 Supplier role isolation: cannot view customer orders, POS shifts, or approve supply invoices (403)
    await asyncCheck('Supplier role cannot view customer orders, POS shifts, or approve supply invoices (403)', async () => {
      // 1. GET /api/store as supplier
      const storeReq = new NextRequest('http://localhost:3000/api/store', {
        headers: { Authorization: `Bearer ${supplierToken}` },
      });
      const storeRes = await storeGET(storeReq);
      assert.equal(storeRes.status, 200);
      const storeData = await storeRes.json();
      assert.equal(storeData.orders.length, 0, 'orders must be empty/isolated for supplier');
      assert.equal(storeData.posShifts.length, 0, 'posShifts must be empty/isolated for supplier');

      // 2. GET /api/pos as supplier -> 403
      const posReq = new NextRequest('http://localhost:3000/api/pos', {
        headers: { Authorization: `Bearer ${supplierToken}` },
      });
      const posRes = await posGET(posReq);
      assert.equal(posRes.status, 403, 'GET /api/pos as supplier must return 403 Forbidden');

      // 3. POST /api/pos as supplier -> 403
      const posPostReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${supplierToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_invoice' }),
      });
      const posPostRes = await posPOST(posPostReq);
      assert.equal(posPostRes.status, 403, 'POST /api/pos as supplier must return 403 Forbidden');

      // 4. PATCH /api/supply-invoices as supplier -> 403
      const patchReq = new Request('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${supplierToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: 'inv-test', status: 'approved' }),
      });
      const patchRes = await supplyInvoicesPATCH(patchReq);
      assert.equal(patchRes.status, 403, 'PATCH /api/supply-invoices as supplier must return 403 Forbidden');
    });

    // 2.6 Accountant role is strictly read-only: returns 403 across all 7 mutation APIs
    await asyncCheck('Accountant role returns 403 Forbidden across all 7 mutation APIs', async () => {
      const accountantMutations = [
        {
          name: 'POST /api/pos',
          fn: () => posPOST(new NextRequest('http://localhost:3000/api/pos', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accountantToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_invoice' }),
          })),
        },
        {
          name: 'PUT /api/store',
          fn: () => storePUT(new NextRequest('http://localhost:3000/api/store', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accountantToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: {} }),
          })),
        },
        {
          name: 'PATCH /api/orders',
          fn: () => ordersPATCH(new NextRequest('http://localhost:3000/api/orders', {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accountantToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: 'any-order', status: 'shipped' }),
          })),
        },
        {
          name: 'DELETE /api/orders',
          fn: () => ordersDELETE(new NextRequest('http://localhost:3000/api/orders?orderId=any-order', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accountantToken}` },
          })),
        },
        {
          name: 'POST /api/supply-invoices',
          fn: () => supplyInvoicesPOST(new Request('http://localhost:3000/api/supply-invoices', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accountantToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ productId: 'p1', quantityKg: 10, costPerKg: 100 }] }),
          })),
        },
        {
          name: 'PATCH /api/supply-invoices',
          fn: () => supplyInvoicesPATCH(new Request('http://localhost:3000/api/supply-invoices', {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accountantToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: 'inv-test', status: 'approved' }),
          })),
        },
        {
          name: 'POST /api/vip (action: cashier_sync)',
          fn: () => vipPOST(new NextRequest('http://localhost:3000/api/vip', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accountantToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cashier_sync', phone: '01012345678', deltaEgp: 50 }),
          })),
        },
      ];

      for (const m of accountantMutations) {
        const res = await m.fn();
        assert.equal(res.status, 403, `${m.name} must return 403 Forbidden for accountant`);
        const data = await res.json();
        assert.ok(data.error.includes('عزل الأدوار') || data.error.includes('403'), `${m.name} must return role isolation error`);
      }
    });

    console.log('\n------------------------------------------------------------------------');
    console.log('SECTION 3: Supply Invoices Approval Lifecycle & Accountant Sync');
    console.log('------------------------------------------------------------------------');

    let createdInvoiceId = null;
    let targetProductId = null;
    let initialStockKg = null;
    let initialCostPerKg = null;

    // 3.1 POST /api/supply-invoices creates pending invoice without altering physical stock
    await asyncCheck('POST /api/supply-invoices creates pending invoice without altering physical stock', async () => {
      const db = await getDbAsync();
      const testProd = db.products[0];
      targetProductId = testProd.id;
      initialStockKg = testProd.stockKg;
      initialCostPerKg = testProd.costPerKg || 400;

      const req = new Request('http://localhost:3000/api/supply-invoices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supplierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierName: 'شركة أرافت للاستيراد والتوريد الزراعي',
          notes: 'شحنة تجريبية من المورد',
          items: [
            {
              productId: targetProductId,
              productName: testProd.name,
              quantityKg: 25.5,
              costPerKg: 520.0,
            },
          ],
        }),
      });

      const res = await supplyInvoicesPOST(req);
      assert.equal(res.status, 201, 'POST /api/supply-invoices must return 201 Created');
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.invoice.status, 'pending');
      assert.equal(data.invoice.items[0].quantityKg, 25.5);
      assert.equal(data.invoice.items[0].costPerKg, 520.0);
      assert.equal(data.invoice.totalAmount, 25.5 * 520.0);
      createdInvoiceId = data.invoice.id;

      // Verify physical stock and cost in DB have NOT changed
      const reloadedDb = await getDbAsync();
      const prodCheck = reloadedDb.products.find((p) => p.id === targetProductId);
      assert.equal(prodCheck.stockKg, initialStockKg, 'Product stockKg must remain unchanged while invoice is pending');
      assert.equal(prodCheck.costPerKg, initialCostPerKg, 'Product costPerKg must remain unchanged while invoice is pending');
    });

    // 3.2 PATCH /api/supply-invoices approval atomically increments stockKg and updates wholesale costPerKg
    await asyncCheck('PATCH /api/supply-invoices approval atomically increments stockKg and updates costPerKg', async () => {
      assert.ok(createdInvoiceId, 'Must have a created invoice');

      const req = new Request('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: createdInvoiceId,
          status: 'approved',
          adminNotes: 'تم الفحص والاستلام بمخزن بني مزار',
        }),
      });

      const res = await supplyInvoicesPATCH(req);
      assert.equal(res.status, 200, 'Approval must return 200 OK');
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.invoice.status, 'approved');

      const reloadedDb = await getDbAsync();
      const updatedProd = reloadedDb.products.find((p) => p.id === targetProductId);
      const expectedStock = Math.round((initialStockKg + 25.5) * 1000) / 1000;
      assert.equal(updatedProd.stockKg, expectedStock, `Stock must be incremented by 25.5 kg to ${expectedStock}`);
      assert.equal(updatedProd.costPerKg, 520.0, 'costPerKg must be updated to 520.0 EGP');
      assert.equal(updatedProd.inStock, true, 'inStock must be true');
    });

    // 3.3 Re-approving an already approved invoice is rejected (HTTP 400)
    await asyncCheck('Re-approving an already approved invoice is rejected with HTTP 400', async () => {
      const req = new Request('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: createdInvoiceId,
          status: 'approved',
        }),
      });

      const res = await supplyInvoicesPATCH(req);
      assert.equal(res.status, 400, 'Re-approval must return 400 Bad Request');
      const data = await res.json();
      assert.ok(data.error.includes('معتمدة بالفعل'), 'Must return already approved message');
    });

    // 3.4 Rejecting a supply invoice updates status to rejected without touching stock
    await asyncCheck('Rejecting a supply invoice sets status: rejected and leaves stock unchanged', async () => {
      // Create a new invoice to reject
      const createReq = new Request('http://localhost:3000/api/supply-invoices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supplierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierName: 'شركة أرافت',
          items: [{ productId: targetProductId, quantityKg: 10, costPerKg: 600 }],
        }),
      });
      const createRes = await supplyInvoicesPOST(createReq);
      const createData = await createRes.json();
      assert.equal(createRes.status, 201, `Create invoice in 3.4 must return 201: ${JSON.stringify(createData)}`);
      const rejectInvId = createData.invoice.id;

      const currentDb = await getDbAsync();
      const stockBeforeReject = currentDb.products.find((p) => p.id === targetProductId).stockKg;

      const rejectReq = new Request('http://localhost:3000/api/supply-invoices', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: rejectInvId,
          status: 'rejected',
          adminNotes: 'رفض بسبب عيوب بالتحميص',
        }),
      });
      const rejectRes = await supplyInvoicesPATCH(rejectReq);
      const rejectData = await rejectRes.json();
      assert.equal(rejectRes.status, 200, `Reject invoice must return 200: ${JSON.stringify(rejectData)}`);
      assert.equal(rejectData.invoice.status, 'rejected');

      const reloadedDb = await getDbAsync();
      const stockAfterReject = reloadedDb.products.find((p) => p.id === targetProductId).stockKg;
      assert.equal(stockAfterReject, stockBeforeReject, 'Stock must not change when invoice is rejected');
    });

    // 3.5 GET /api/supply-invoices returns both 'invoices' and 'supplyInvoices' for universal client compatibility
    await asyncCheck('GET /api/supply-invoices returns both "invoices" and "supplyInvoices" keys for supplier, accountant, and admin', async () => {
      // 1. As supplier
      const supReq = new Request('http://localhost:3000/api/supply-invoices', {
        headers: { Authorization: `Bearer ${supplierToken}` },
      });
      const supRes = await supplyInvoicesGET(supReq);
      assert.equal(supRes.status, 200);
      const supData = await supRes.json();
      assert.ok(Array.isArray(supData.invoices), 'Must provide "invoices" array for supplier');
      assert.ok(Array.isArray(supData.supplyInvoices), 'Must provide "supplyInvoices" array for supplier');
      assert.equal(supData.invoices.length, supData.supplyInvoices.length);

      // 2. As accountant
      const accReq = new Request('http://localhost:3000/api/supply-invoices', {
        headers: { Authorization: `Bearer ${accountantToken}` },
      });
      const accRes = await supplyInvoicesGET(accReq);
      assert.equal(accRes.status, 200);
      const accData = await accRes.json();
      assert.ok(Array.isArray(accData.invoices), 'Must provide "invoices" array for accountant');
      assert.ok(Array.isArray(accData.supplyInvoices), 'Must provide "supplyInvoices" array for accountant');
      assert.equal(accData.invoices.length, accData.supplyInvoices.length);

      // 3. As admin
      const admReq = new Request('http://localhost:3000/api/supply-invoices', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const admRes = await supplyInvoicesGET(admReq);
      assert.equal(admRes.status, 200);
      const admData = await admRes.json();
      assert.ok(Array.isArray(admData.invoices), 'Must provide "invoices" array for admin');
      assert.ok(Array.isArray(admData.supplyInvoices), 'Must provide "supplyInvoices" array for admin');
      assert.equal(admData.invoices.length, admData.supplyInvoices.length);
    });

    console.log('\n========================================================================');
    console.log(`EMPIRICAL STRESS TEST SUMMARY: ${passedChecks}/${totalChecks} PASSED (100% PASS RATE)`);
    console.log('========================================================================\n');

  } finally {
    // Restore original store-db.json from backup to maintain integrity
    if (fs.existsSync(DB_BACKUP_PATH)) {
      fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
      fs.unlinkSync(DB_BACKUP_PATH);
      console.log('✓ Original database data/store-db.json restored cleanly from backup.');
    }
  }
}

runEmpiricalStressSuite().catch((err) => {
  console.error('Fatal execution error in stress suite:', err);
  process.exit(1);
});
