/**
 * Comprehensive End-to-End Verification Suite: MizanPOS Enterprise Upgrade (Egypt Edition — Packages 1-4)
 * Runtime: Node.js v24+ under tsx (invoking real Next.js App Router API handlers & TypeScript domain engines)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

// Domain & Infrastructure Imports
const { getDbAsync, withDbTransaction } = await import('../src/lib/db.ts');
const { generateAdminToken } = await import('../src/lib/auth.ts');
const { buildRelationalSyncStatements } = await import('../src/lib/postgres-schema.ts');
const {
  calculateOrderTaxBreakdown,
  generateEtaReceiptUuid,
  buildTaxReceiptQrValue,
} = await import('../src/lib/tax.ts');
const { parseScaleBarcode } = await import('../src/lib/pricing.ts');
const { encodeCode128Bits, encodeQrMatrix } = await import('../src/lib/barcode-svg.tsx');
const { calculateTreasuryBalances } = await import('../src/lib/treasury.ts');
const { calculateFinancialSummary } = await import('../src/lib/financials.ts');

// Real Next.js App Router Route Handlers
const { POST: loginPOST } = await import('../src/app/api/admin/login/route.ts');
const { GET: auditLogsGET } = await import('../src/app/api/admin/audit-logs/route.ts');
const { GET: posGET, POST: posPOST } = await import('../src/app/api/pos/route.ts');
const {
  GET: treasuryGET,
  POST: treasuryPOST,
} = await import('../src/app/api/admin/treasury/route.ts');
const {
  GET: creditGET,
  PATCH: creditPATCH,
  POST: creditPOST,
} = await import('../src/app/api/admin/credit/route.ts');
const {
  GET: supplyGET,
  POST: supplyPOST,
  PATCH: supplyPATCH,
} = await import('../src/app/api/supply-invoices/route.ts');
const { POST: ordersPOST } = await import('../src/app/api/orders/route.ts');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${name}`);
  } catch (err) {
    console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${name}`);
    console.error(`    ${colors.red}${err.stack || err.message}${colors.reset}`);
    throw err;
  }
}

function makeReq(url, method = 'GET', token = '', bodyObj = undefined, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
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

async function runEnterpriseVerification() {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}  MIZANPOS ENTERPRISE UPGRADE (EGYPT EDITION — PACKAGES 1–4) E2E SUITE${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

  const originalDbRaw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf8') : null;

  try {
    const db = await getDbAsync();
    const adminPassword = db.settings?.adminPassword || 'Hafsa@Admin2026';
    const accountantPassword = db.settings?.accountantPassword || 'Acc#Fin2026';
    const cashierPassword = db.settings?.cashierPassword || 'Cash#Pos2026';
    const supplierPassword = db.settings?.supplierPassword || 'Sup#Arafat2026';

    const adminToken = generateAdminToken(adminPassword, 'super_admin').token;
    const accountantToken = generateAdminToken(accountantPassword, 'accountant').token;
    const cashier1Token = generateAdminToken(cashierPassword, 'cashier').token;
    const cashier2Token = generateAdminToken(cashierPassword, 'cashier').token;
    const supplierToken = generateAdminToken(supplierPassword, 'supplier').token;

    // ═════════════════════════════════════════════════════════════════════════
    // PACKAGE 1: Differential Postgres Sync, Rate Limiting, Audit Logs & AGENTS.md
    // ═════════════════════════════════════════════════════════════════════════
    await test('PKG1_01: Differential Relational Postgres Sync emits minimal SQL on single-order mutation', async () => {
      const snapBefore = JSON.parse(JSON.stringify(await getDbAsync()));
      const snapAfter = JSON.parse(JSON.stringify(snapBefore));
      snapAfter.orders.unshift({
        id: 'ord-diff-test-1',
        orderNumber: 'POS-DIFF1',
        customerName: 'عميل اختبار',
        customerPhone: '01012345678',
        governorate: 'القاهرة',
        address: 'مبيعات الفرع',
        items: [],
        subtotal: 100,
        shippingCost: 0,
        discountAmount: 0,
        total: 100,
        paymentMethod: 'cash',
        status: 'delivered',
        createdAt: new Date().toISOString(),
      });

      const diffStmts = buildRelationalSyncStatements(snapAfter, 11, 10, snapBefore);
      const sqlTexts = diffStmts.map((s) => s.text).join('\n');
      assert.ok(sqlTexts.includes('UPDATE store_state'), 'Must update store_state version atomically');
      assert.ok(sqlTexts.includes('INSERT INTO orders'), 'Must upsert the newly added order');
      assert.ok(!sqlTexts.includes('INSERT INTO products'), 'Unchanged products table must NOT be rewritten');
      assert.ok(!sqlTexts.includes('INSERT INTO categories'), 'Unchanged categories table must NOT be rewritten');
      assert.ok(diffStmts.length <= 3, `Expected <= 3 SQL statements for 1 order insert, got ${diffStmts.length}`);
    });

    await test('PKG1_02: Login Rate Limiter blocks brute-force per (IP, username) with HTTP 429 & AGENTS.md clean UI', async () => {
      const testIp = '198.51.100.77';
      const bruteUser = `brute_target_${Date.now()}`;

      let lastStatus = 0;
      for (let i = 1; i <= 9; i++) {
        const req = makeReq(
          'http://localhost:3000/api/admin/login',
          'POST',
          '',
          { username: bruteUser, password: 'wrong-password-123' },
          { 'x-forwarded-for': testIp }
        );
        const res = await loginPOST(req);
        lastStatus = res.status;
        if (lastStatus === 429) break;
      }
      assert.strictEqual(lastStatus, 429, 'Rapid failed logins from same (IP, username) must trigger HTTP 429');

      // Verify AGENTS.md strict login UI rule on /admin, /pos, /supplier
      for (const loginFile of ['src/app/admin/page.tsx', 'src/app/pos/page.tsx', 'src/app/supplier/page.tsx']) {
        const full = path.join(ROOT_DIR, loginFile);
        if (!fs.existsSync(full)) continue;
        const content = fs.readFileSync(full, 'utf8');
        assert.ok(!content.includes('admin_hafsa'), `${loginFile} must never leak admin_hafsa`);
        assert.ok(!content.includes('accountant_fin'), `${loginFile} must never leak accountant_fin`);
      }
    });

    // ═════════════════════════════════════════════════════════════════════════
    // PACKAGE 2: Multi-Register Shifts, Coupons, Split Payments & POS Returns
    // ═════════════════════════════════════════════════════════════════════════
    let splitOrder = null;
    let targetProdId = '';
    let initialStockKg = 0;

    await test('PKG2_01: Multi-Register Concurrent Shifts keep reg-1 and reg-2 simultaneously OPEN', async () => {
      const res1 = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'open_shift',
          registerId: 'reg-1',
          registerName: 'ماكينة كاشير 1',
          openingCash: 500,
        })
      );
      assert.strictEqual(res1.status, 200);

      const res2 = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier2Token, {
          action: 'open_shift',
          registerId: 'reg-2',
          registerName: 'ماكينة كاشير 2',
          openingCash: 300,
        })
      );
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      const openRegIds = (data2.openShifts || []).map((s) => s.registerId);
      assert.ok(
        openRegIds.includes('reg-1') && openRegIds.includes('reg-2'),
        `Both reg-1 and reg-2 must remain open simultaneously, got: ${JSON.stringify(openRegIds)}`
      );
    });

    await test('PKG2_02: POS Checkout supports Coupons + Split Payment (Cash + InstaPay) on reg-1', async () => {
      await withDbTransaction(async (mutDb) => {
        const p = mutDb.products.find((x) => !x.sellingMode || x.sellingMode === 'weight') || mutDb.products[0];
        p.stockKg = 40;
        p.inStock = true;
        targetProdId = p.id;
        initialStockKg = 40;
        if (!Array.isArray(mutDb.coupons)) mutDb.coupons = [];
        mutDb.coupons = mutDb.coupons.filter((c) => c.code !== 'POS20');
        mutDb.coupons.push({
          id: 'cpn-pos-test',
          code: 'POS20',
          discountType: 'fixed',
          value: 20,
          minOrderAmount: 100,
          active: true,
        });
      });

      const invoiceRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'create_invoice',
          registerId: 'reg-1',
          couponCode: 'POS20',
          paymentMethod: 'split',
          paymentSplits: [
            { method: 'cash', amount: 100 },
            { method: 'instapay', amount: 80, reference: 'IP-998877' },
          ],
          items: [
            {
              cartItemId: 'ci-split-1',
              productId: targetProdId,
              productName: 'صنف اختبار مقسم',
              weightLabel: '500 جم',
              customWeightGrams: 500,
              unitPrice: 100,
              quantity: 2, // Subtotal = 200, Coupon POS20 = -20 -> Net Total = 180 (100 Cash + 80 InstaPay)
            },
          ],
        })
      );
      assert.strictEqual(invoiceRes.status, 201, 'Split POS invoice must return 201');
      const invoiceData = await invoiceRes.json();
      splitOrder = invoiceData.order;
      assert.strictEqual(splitOrder.discountAmount, 20, 'POS coupon must deduct 20 EGP');
      assert.strictEqual(splitOrder.total, 180, 'Net POS total must equal 180 EGP');
      assert.strictEqual(invoiceData.activeShift.cashSalesTotal, 100, 'Drawer cash sales must add 100 EGP only');
      assert.strictEqual(invoiceData.activeShift.instapayTotal, 80, 'Shift InstaPay total must add 80 EGP');
      assert.strictEqual(invoiceData.activeShift.expectedCashInDrawer, 600, 'Expected cash = 500 opening + 100 cash split');

      const dbNow = await getDbAsync();
      const updatedProd = dbNow.products.find((p) => p.id === targetProdId);
      assert.strictEqual(updatedProd.stockKg, 39, '2 x 500g = 1kg must be deducted from 40kg -> 39kg');
    });

    await test('PKG2_03: Partial POS Returns handle restock (restores stock + deducts drawer) vs damaged (logs spoilage)', async () => {
      // 1) Return 1 item as 'restock' with cash refund (90 EGP proportional after discount)
      const ret1Res = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'create_return',
          registerId: 'reg-1',
          orderId: splitOrder.id,
          refundMethod: 'cash',
          reason: 'استبدال بناء على رغبة العميل',
          items: [
            {
              cartItemId: 'ci-split-1',
              productId: targetProdId,
              productName: 'صنف اختبار مقسم',
              returnQty: 1,
              condition: 'restock',
            },
          ],
        })
      );
      assert.strictEqual(ret1Res.status, 201, 'First partial return (restock) must succeed');
      const ret1Data = await ret1Res.json();
      assert.strictEqual(ret1Data.returnRecord.totalRefundAmount, 90, 'Proportional refund for 1 of 2 items on 180 EGP total = 90 EGP');
      assert.strictEqual(ret1Data.activeShift.expectedCashInDrawer, 510, 'Expected drawer cash must drop from 600 to 510 EGP');

      let dbNow = await getDbAsync();
      let prodNow = dbNow.products.find((p) => p.id === targetProdId);
      assert.strictEqual(prodNow.stockKg, 39.5, 'Restock return of 500g must restore stock from 39kg to 39.5kg');

      // 2) Return remaining 1 item as 'damaged' (must NOT restock, must log InventoryAdjustment)
      const adjCountBefore = (dbNow.inventoryAdjustments || []).length;
      const ret2Res = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'create_return',
          registerId: 'reg-1',
          orderId: splitOrder.id,
          refundMethod: 'cash',
          reason: 'عبوة مفتوحة تالفة',
          items: [
            {
              cartItemId: 'ci-split-1',
              productId: targetProdId,
              productName: 'صنف اختبار مقسم',
              returnQty: 1,
              condition: 'damaged',
            },
          ],
        })
      );
      assert.strictEqual(ret2Res.status, 201, 'Second partial return (damaged) must succeed');
      dbNow = await getDbAsync();
      prodNow = dbNow.products.find((p) => p.id === targetProdId);
      assert.strictEqual(prodNow.stockKg, 39.5, 'Damaged return must NOT add back to sellable stockKg');
      assert.strictEqual(
        (dbNow.inventoryAdjustments || []).length,
        adjCountBefore + 1,
        'Damaged return must append an InventoryAdjustment spoilage entry'
      );
    });

    // ═════════════════════════════════════════════════════════════════════════
    // PACKAGE 3: Egyptian VAT + ETA QR, Scale Weight/Price Barcodes & SVG Matrix
    // ═════════════════════════════════════════════════════════════════════════
    await test('PKG3_01: Egyptian 14% VAT engine (off, inclusive, exclusive, taxExempt) & ETA TLV Base64 QR', async () => {
      const sampleItems = [
        { productId: 'p-taxable', productName: 'بن محمص', weightId: 'w1', weightLabel: '1 كجم', unitPrice: 114, quantity: 1 },
        { productId: 'p-exempt', productName: 'سلعة معفاة', weightId: 'w1', weightLabel: '1 كجم', unitPrice: 100, quantity: 1 },
      ];
      const sampleProds = [
        { id: 'p-taxable', name: 'بن محمص', taxExempt: false, weights: [] },
        { id: 'p-exempt', name: 'سلعة معفاة', taxExempt: true, weights: [] },
      ];

      // Off by default
      const offRes = calculateOrderTaxBreakdown(sampleItems, sampleProds, 0, { enableTax: false });
      assert.strictEqual(offRes.taxAmount, 0);
      assert.strictEqual(offRes.totalAddition, 0);

      // Inclusive 14%: 114 EGP includes 14 EGP VAT (100 net + 14 VAT), exempt 100 EGP has 0 VAT
      const incRes = calculateOrderTaxBreakdown(sampleItems, sampleProds, 0, {
        enableTax: true,
        taxRatePercent: 14,
        taxPricingMode: 'inclusive',
      });
      assert.strictEqual(incRes.taxAmount, 14);
      assert.strictEqual(incRes.totalAddition, 0);

      // Exclusive 14%: 100 EGP taxable -> +14 EGP VAT added on top
      const excRes = calculateOrderTaxBreakdown(
        [{ ...sampleItems[0], unitPrice: 100 }],
        sampleProds,
        0,
        { enableTax: true, taxRatePercent: 14, taxPricingMode: 'exclusive' }
      );
      assert.strictEqual(excRes.taxAmount, 14);
      assert.strictEqual(excRes.totalAddition, 14);

      const uuid = generateEtaReceiptUuid('POS-9001', '123-456-789', 114, '2026-11-11T12:00:00.000Z');
      assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);

      const qrB64 = buildTaxReceiptQrValue(
        { orderNumber: 'POS-9001', total: 114, taxAmount: 14, etaReceiptUuid: uuid, createdAt: '2026-11-11T12:00:00Z' },
        { enableTax: true, storeName: 'ميزان كلاود', taxRegistrationNumber: '123-456-789' }
      );
      const decodedBytes = Buffer.from(qrB64, 'base64');
      assert.strictEqual(decodedBytes[0], 1, 'TLV Tag 1 must be Seller Name');
    });

    await test('PKG3_02: Scale Barcodes (Prefix 20 Weight & Prefix 21 Price) + Code-128 & QR SVG Matrices', async () => {
      const scaleCatalog = [
        {
          id: 'p-cashew',
          name: 'كاجو ملكي',
          pluCode: 1,
          pricePerKg: 800,
          costPerKg: 600,
          weights: [{ id: 'w-1000', label: '1 كجم', weightGrams: 1000, grams: 1000, price: 800 }],
        },
      ];

      // Prefix 20: PLU 0001, weight 00250g -> 250g @ 800/kg = 200 EGP
      const parsedWeight = parseScaleBarcode('200001002507', scaleCatalog);
      assert.ok(parsedWeight, 'Prefix 20 weight barcode must parse');
      assert.strictEqual(parsedWeight.weightGrams, 250);
      assert.strictEqual(parsedWeight.calc.unitPrice, 200);

      // Prefix 21: PLU 0001, price 20000 piastres (200.00 EGP) -> 250g
      const parsedPricePiastres = parseScaleBarcode('210001200003', scaleCatalog);
      assert.ok(parsedPricePiastres, 'Prefix 21 piastres price barcode must parse');
      assert.strictEqual(parsedPricePiastres.calc.unitPrice, 200);
      assert.strictEqual(parsedPricePiastres.weightGrams, 250);

      // Prefix 22: PLU 0001, price 00200 EGP -> 250g
      const parsedPriceWhole = parseScaleBarcode('220001002003', scaleCatalog);
      assert.ok(parsedPriceWhole, 'Prefix 22 whole-EGP price barcode must parse');
      assert.strictEqual(parsedPriceWhole.calc.unitPrice, 200);
      assert.strictEqual(parsedPriceWhole.weightGrams, 250);

      const bits128 = encodeCode128Bits('POS-1024');
      assert.ok(bits128.length > 60 && bits128.includes(1), 'Code-128 encoder must produce valid bar/space modules');

      const qrMatrix = encodeQrMatrix('https://mizanpos.eg/r/POS-1024');
      assert.ok(qrMatrix.length >= 21 && qrMatrix.length === qrMatrix[0].length, 'QR encoder must produce square matrix >= 21x21');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // PACKAGE 4: Credit Sales Lock & AR, Treasury Safe, Supplier AP & Online Receipt
    // ═════════════════════════════════════════════════════════════════════════
    await test('PKG4_01: Master Credit Sales Lock blocks POS credit when disabled, enforces limit when enabled, & collects debt', async () => {
      // 1) Ensure credit sales disabled -> POS credit sale MUST return 403
      await creditPATCH(
        makeReq('http://localhost:3000/api/admin/credit', 'PATCH', adminToken, {
          action: 'toggle_master_credit',
          enableCreditSales: false,
          creditSalesRequireApproval: true,
        })
      );

      const blockedRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'create_invoice',
          registerId: 'reg-1',
          customerName: 'عميل آجل',
          customerPhone: '01098765432',
          paymentMethod: 'credit',
          items: [
            {
              productId: targetProdId,
              productName: 'صنف آجل',
              weightLabel: '250 جم',
              customWeightGrams: 250,
              unitPrice: 120,
              quantity: 1,
            },
          ],
        })
      );
      assert.strictEqual(blockedRes.status, 403, 'POS credit sale must be locked (403) when enableCreditSales is false');

      // 2) Enable master credit sales + approve customer with 300 EGP credit limit
      await creditPATCH(
        makeReq('http://localhost:3000/api/admin/credit', 'PATCH', adminToken, {
          action: 'toggle_master_credit',
          enableCreditSales: true,
          creditSalesRequireApproval: true,
        })
      );
      const custApproveRes = await creditPATCH(
        makeReq('http://localhost:3000/api/admin/credit', 'PATCH', adminToken, {
          action: 'update_customer_credit',
          phone: '01098765432',
          customerName: 'أحمد عميل آجل معتمد',
          allowCredit: true,
          creditLimit: 300,
        })
      );
      assert.strictEqual(custApproveRes.status, 200);

      // 3) Over-limit sale (400 EGP > 300 limit) must be rejected (400)
      const overLimitRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'create_invoice',
          registerId: 'reg-1',
          customerName: 'أحمد عميل آجل معتمد',
          customerPhone: '01098765432',
          paymentMethod: 'credit',
          items: [
            {
              productId: targetProdId,
              productName: 'صنف آجل',
              weightLabel: '500 جم',
              customWeightGrams: 500,
              unitPrice: 400,
              quantity: 1,
            },
          ],
        })
      );
      assert.strictEqual(overLimitRes.status, 400, 'Credit sale exceeding creditLimit must be rejected with 400');

      // 4) Within-limit credit sale (200 EGP <= 300 limit) succeeds
      const okCreditRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'create_invoice',
          registerId: 'reg-1',
          customerName: 'أحمد عميل آجل معتمد',
          customerPhone: '01098765432',
          paymentMethod: 'credit',
          items: [
            {
              productId: targetProdId,
              productName: 'صنف آجل',
              weightLabel: '250 جم',
              customWeightGrams: 250,
              unitPrice: 200,
              quantity: 1,
            },
          ],
        })
      );
      assert.strictEqual(okCreditRes.status, 201, 'Approved credit sale within limit must return 201');

      // 5) Collect 120 EGP debt via /api/admin/credit -> remaining debt = 80 EGP + Treasury main_safe credited
      const collectRes = await creditPOST(
        makeReq('http://localhost:3000/api/admin/credit', 'POST', adminToken, {
          phone: '01098765432',
          amount: 120,
          paymentMethod: 'cash',
          notes: 'دفعة نقدية أولى من العميل',
        })
      );
      assert.strictEqual(collectRes.status, 200);
      const collectData = await collectRes.json();
      assert.strictEqual(collectData.remainingDebt, 80, 'Customer remaining debt must be 200 - 120 = 80 EGP');
    });

    await test('PKG4_02: Shift Close automatically settles cash & InstaPay into Treasury + supports manual transfer', async () => {
      const treBeforeRes = await treasuryGET(makeReq('http://localhost:3000/api/admin/treasury', 'GET', adminToken));
      const treBefore = await treBeforeRes.json();
      const safeBefore = treBefore.accounts.main_safe.balance;
      const instapayBefore = treBefore.accounts.instapay_bank.balance;

      // Close reg-1 shift (expectedCashInDrawer is 420 after the two 90 EGP returns; instapayTotal is 80)
      const closeRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashier1Token, {
          action: 'close_shift',
          registerId: 'reg-1',
          actualCash: 420,
        })
      );
      assert.strictEqual(closeRes.status, 200);

      // reg-2 shift MUST STILL BE OPEN!
      const posStateRes = await posGET(makeReq('http://localhost:3000/api/pos?registerId=reg-2', 'GET', cashier2Token));
      const posState = await posStateRes.json();
      assert.strictEqual(posState.activeShift?.registerId, 'reg-2', 'Closing reg-1 must NOT close reg-2');
      assert.strictEqual(posState.activeShift?.status, 'open');

      // Verify Treasury balances increased by +420 in main_safe and +80 in instapay_bank
      const treAfterCloseRes = await treasuryGET(makeReq('http://localhost:3000/api/admin/treasury', 'GET', adminToken));
      const treAfterClose = await treAfterCloseRes.json();
      assert.strictEqual(treAfterClose.accounts.main_safe.balance, safeBefore + 420);
      assert.strictEqual(treAfterClose.accounts.instapay_bank.balance, instapayBefore + 80);

      // Inter-account transfer: move 100 EGP from main_safe to vodafone_wallet
      const transferRes = await treasuryPOST(
        makeReq('http://localhost:3000/api/admin/treasury', 'POST', adminToken, {
          action: 'transfer',
          fromAccountId: 'main_safe',
          toAccountId: 'vodafone_wallet',
          amount: 100,
          notes: 'تغذية محفظة فودافون كاش',
        })
      );
      assert.ok(transferRes.status === 200 || transferRes.status === 201);
      const transferData = await transferRes.json();
      assert.strictEqual(transferData.accounts.main_safe.balance, safeBefore + 320);
    });

    await test('PKG4_03: Supplier AP supports Weight + Unit WAC, Partial Payment, Supply Return & Accountant 403 RBAC', async () => {
      let unitProdId = '';
      await withDbTransaction(async (mutDb) => {
        let up = mutDb.products.find((p) => p.sellingMode === 'unit');
        if (!up) {
          up = {
            id: 'prod-unit-jar-test',
            name: 'برطمان زبدة فول سوداني 400جم',
            slug: 'peanut-butter-jar-test',
            categoryId: mutDb.categories[0]?.id || 'cat-1',
            sellingMode: 'unit',
            unitLabel: 'برطمان',
            pricePerKg: 95,
            costPerKg: 60,
            stockKg: 10,
            inStock: true,
            image: '/placeholder.svg',
            description: 'اختبار بالقطعة',
            roastOptions: ['جاهز'],
            weights: [{ id: 'u-1', label: '1 برطمان', weightGrams: 1000, grams: 1000, unitsCount: 1, price: 95 }],
          };
          mutDb.products.push(up);
        } else {
          up.stockKg = 10;
          up.costPerKg = 60;
          up.unitCost = 60;
        }
        unitProdId = up.id;
      });

      // Accountant MUST be rejected with 403 on POST /api/supply-invoices
      const accBlocked = await supplyPOST(
        makeReq('http://localhost:3000/api/supply-invoices', 'POST', accountantToken, {
          supplierName: 'محاولة محاسب',
          items: [{ productId: unitProdId, productName: 'برطمان', sellingMode: 'unit', quantityKg: 5, unitCost: 70, costPerKg: 70 }],
        })
      );
      assert.strictEqual(accBlocked.status, 403, 'Accountant must receive 403 on POST /api/supply-invoices');

      // Supplier submits credit supply invoice (10 jars @ 80 EGP = 800 EGP, paidAmount = 200 EGP -> 600 remaining)
      const createSupRes = await supplyPOST(
        makeReq('http://localhost:3000/api/supply-invoices', 'POST', supplierToken, {
          supplierName: 'شركة التوريدات المصرية',
          invoiceRef: 'SUP-INV-77',
          paidAmount: 200,
          dueDate: '2026-12-01',
          items: [
            {
              productId: unitProdId,
              productName: 'برطمان زبدة فول سوداني 400جم',
              sellingMode: 'unit',
              unitLabel: 'برطمان',
              quantityKg: 10,
              unitsCount: 10,
              unitCost: 80,
              costPerKg: 80,
            },
          ],
        })
      );
      assert.strictEqual(createSupRes.status, 201);
      const createdInvoice = (await createSupRes.json()).invoice;
      assert.strictEqual(createdInvoice.totalAmount, 800);
      assert.strictEqual(createdInvoice.remainingAmount, 800);
      assert.strictEqual(createdInvoice.paymentStatus, 'unpaid');

      // Admin approves invoice -> stock becomes 10 + 10 = 20 jars, WAC = (10*60 + 10*80)/20 = 70 EGP/jar
      const approveRes = await supplyPATCH(
        makeReq('http://localhost:3000/api/supply-invoices', 'PATCH', adminToken, {
          id: createdInvoice.id,
          status: 'approved',
        })
      );
      assert.strictEqual(approveRes.status, 200);
      let dbAfterSup = await getDbAsync();
      let unitProd = dbAfterSup.products.find((p) => p.id === unitProdId);
      assert.strictEqual(unitProd.stockKg, 20, 'Approved unit supply must add 10 units -> 20');
      assert.strictEqual(unitProd.costPerKg, 70, 'Unit WAC must equal (600 + 800) / 20 = 70 EGP');

      // Admin records supplier partial payment of 450 EGP from main_safe -> remaining drops from 800 to 350 EGP
      const paySupRes = await supplyPATCH(
        makeReq('http://localhost:3000/api/supply-invoices', 'PATCH', adminToken, {
          id: createdInvoice.id,
          action: 'record_payment',
          amount: 450,
          accountId: 'main_safe',
          notes: 'دفعة نقدية للمورد',
        })
      );
      assert.strictEqual(paySupRes.status, 200);
      const afterPayInv = (await paySupRes.json()).invoice;
      assert.strictEqual(afterPayInv.remainingAmount, 350);
      assert.strictEqual(afterPayInv.paymentStatus, 'partial');

      // Admin creates Purchase Return (مرتجع مشتريات للمورد) of 2 damaged jars (@ 80 = 160 EGP) -> stock 18, remaining 190 EGP
      const supRetRes = await supplyPATCH(
        makeReq('http://localhost:3000/api/supply-invoices', 'PATCH', adminToken, {
          id: createdInvoice.id,
          action: 'create_supply_return',
          reason: 'برطمانات مكسورة الغطاء عند الفرز',
          items: [{ productId: unitProdId, returnQty: 2 }],
        })
      );
      assert.strictEqual(supRetRes.status, 200);
      const afterRetInv = (await supRetRes.json()).invoice;
      assert.strictEqual(afterRetInv.returnedAmount, 160);
      assert.strictEqual(afterRetInv.remainingAmount, 190);

      dbAfterSup = await getDbAsync();
      unitProd = dbAfterSup.products.find((p) => p.id === unitProdId);
      assert.strictEqual(unitProd.stockKg, 18, 'Purchase return of 2 units must deduct stock from 20 -> 18');
    });

    await test('PKG4_04: Online Store Checkout persists transfer receipt image + optional 14% exclusive VAT + Audit Logs', async () => {
      await withDbTransaction(async (mutDb) => {
        mutDb.settings.enableTax = true;
        mutDb.settings.taxRatePercent = 14;
        mutDb.settings.taxPricingMode = 'exclusive';
        mutDb.settings.taxRegistrationNumber = '555-666-777';
      });

      const dbNow = await getDbAsync();
      const onlineProd = dbNow.products.find((p) => p.id === targetProdId);
      const validVariant = onlineProd.weights[0];
      const fakeReceiptDataUrl =
        'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

      const orderRes = await ordersPOST(
        makeReq('http://localhost:3000/api/orders', 'POST', '', {
          customerName: 'عميل متجر إلكتروني',
          customerPhone: '01122334455',
          governorate: 'القاهرة',
          deliveryMethod: 'store_pickup',
          address: 'استلام من الفرع الرئيسي',
          paymentMethod: 'instapay',
          paymentReference: 'INSTA-554433',
          paymentReceiptImage: fakeReceiptDataUrl,
          items: [
            {
              productId: onlineProd.id,
              productName: onlineProd.name,
              weightId: validVariant.id,
              weightLabel: validVariant.label,
              unitPrice: validVariant.price,
              quantity: 1,
            },
          ],
        })
      );
      assert.ok(orderRes.status === 200 || orderRes.status === 201, `Online order must succeed, got ${orderRes.status}`);
      const orderJson = await orderRes.json();
      const createdOrd = orderJson.order;
      assert.strictEqual(createdOrd.paymentReceiptImage, fakeReceiptDataUrl, 'Transfer receipt data URL must persist on order');
      const expectedVat = Math.round(validVariant.price * 0.14 * 100) / 100;
      assert.strictEqual(createdOrd.taxAmount, expectedVat, 'Exclusive 14% VAT must be computed on online order');
      assert.ok(createdOrd.etaReceiptUuid, 'ETA Receipt UUID must be generated when enableTax is true');

      // Verify Audit Logs endpoint RBAC & populated entries
      const cashierAuditBlocked = await auditLogsGET(
        makeReq('http://localhost:3000/api/admin/audit-logs', 'GET', cashier1Token)
      );
      assert.strictEqual(cashierAuditBlocked.status, 403, 'Cashier must be blocked from reading audit logs');

      const adminAuditRes = await auditLogsGET(
        makeReq('http://localhost:3000/api/admin/audit-logs', 'GET', adminToken)
      );
      assert.strictEqual(adminAuditRes.status, 200);
      const adminAuditData = await adminAuditRes.json();
      assert.ok(adminAuditData.logs.length >= 5, 'Audit log must contain immutable entries for shifts, returns, treasury, credit & supply');

      // Verify Unified Financial Summary computes new AP, AR, Tax, Returns & Treasury KPIs cleanly
      const finalDb = await getDbAsync();
      const finReport = calculateFinancialSummary({
        orders: finalDb.orders,
        products: finalDb.products,
        posShifts: finalDb.posShifts,
        posExpenses: finalDb.posExpenses,
        vipMembers: finalDb.vipMembers,
        coupons: finalDb.coupons,
        supplyInvoices: finalDb.supplyInvoices,
        posReturns: finalDb.posReturns,
        treasuryTransactions: finalDb.treasuryTransactions,
      });
      assert.ok(finReport.supplierPayablesTotal >= 190, 'Financial report must reflect Supplier AP remaining balance');
      assert.ok(finReport.customerReceivablesTotal >= 80, 'Financial report must reflect Customer AR remaining balance');
      assert.strictEqual(
        typeof calculateTreasuryBalances(finalDb.treasuryTransactions).totalLiquidity,
        'number'
      );
    });

    console.log(
      `\n${colors.bold}${colors.green}🎉 ALL ${passed}/${total} ENTERPRISE EGYPT UPGRADE (PACKAGES 1–4) E2E TESTS PASSED!${colors.reset}\n`
    );
  } finally {
    if (originalDbRaw !== null) {
      fs.writeFileSync(DB_PATH, originalDbRaw, 'utf8');
    }
  }
}

runEnterpriseVerification().catch((err) => {
  console.error('Enterprise verification failed:', err);
  process.exit(1);
});
