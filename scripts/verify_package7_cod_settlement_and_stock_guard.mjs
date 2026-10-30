/**
 * Package 7 Verification Suite:
 * 1. Rider COD Custody -> Cashier Drawer Settlement -> Shift Z-Report Reconciliation
 * 2. Atomic Anti-Oversell Online Stock Guard (Standard, Custom Mix & Partitioned Boxes)
 * 3. Critical Low-Stock (<= 5 kg) Telegram Alerts + Secret Stripping & Settings Persistence
 *
 * Target: محمصة حفصة للبن والمكسرات — فرع بني مزار (HAFSA ROASTERY)
 * Runtime: Node.js v24+ with TypeScript execution via tsx
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
const { getDbAsync, withDbTransaction } = await import('../src/lib/db.ts');
const { generateAdminToken, stripAllPasswords } = await import('../src/lib/auth.ts');
const { calculateShiftAudit } = await import('../src/lib/financials.ts');
const {
  formatLowStockTelegramMessage,
  formatShiftZReportTelegramMessage,
} = await import('../src/lib/telegram.ts');
const { GET: storeGET } = await import('../src/app/api/store/route.ts');
const { POST: ordersPOST } = await import('../src/app/api/orders/route.ts');
const { GET: posGET, POST: posPOST } = await import('../src/app/api/pos/route.ts');
const { GET: riderOrdersGET, PATCH: riderOrdersPATCH } = await import(
  '../src/app/api/rider/orders/route.ts'
);

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

async function runPackage7Verification() {
  console.log(
    `\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`
  );
  console.log(
    `${colors.bold}RUNNING PACKAGE 7 VERIFICATION: COD SETTLEMENT, STOCK GUARD & ALERTS${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`
  );

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
    const riderStaff = (db.staffAccounts || []).find((s) => s.role === 'delivery_rider');
    const riderToken = riderStaff
      ? generateAdminToken(riderStaff.passwordHash, 'delivery_rider', {
          staffId: riderStaff.id,
          username: riderStaff.username,
          displayName: riderStaff.displayName,
        }).token
      : generateAdminToken(riderPassword, 'delivery_rider').token;

    // 1. Secret Stripping & Zero Username Leakage in POS/Public Store
    await test('P7_SEC_01: stripAllPasswords & GET /api/store strip telegramBotToken/telegramChatId, and GET /api/pos availableRiders never leaks usernames', async () => {
      await withDbTransaction((draft) => {
        draft.settings.telegramBotToken = '999999:SECRET_BOT_TOKEN_TEST';
        draft.settings.telegramChatId = '-100987654321';
      });

      const strippedDirect = stripAllPasswords({
        storeName: 'محمصة حفصة',
        telegramBotToken: '999999:SECRET_BOT_TOKEN_TEST',
        telegramChatId: '-100987654321',
        adminPassword: 'secret',
      });
      assert.equal(strippedDirect.telegramBotToken, undefined, 'telegramBotToken must be stripped');
      assert.equal(strippedDirect.telegramChatId, undefined, 'telegramChatId must be stripped');

      const pubStoreRes = await storeGET(makeReq('http://localhost:3000/api/store', 'GET'));
      assert.equal(pubStoreRes.status, 200);
      const pubStoreData = await pubStoreRes.json();
      assert.equal(
        pubStoreData.settings?.telegramBotToken,
        undefined,
        'Public GET /api/store must never expose telegramBotToken'
      );
      assert.equal(
        pubStoreData.settings?.telegramChatId,
        undefined,
        'Public GET /api/store must never expose telegramChatId'
      );

      const posGetRes = await posGET(makeReq('http://localhost:3000/api/pos', 'GET', cashierToken));
      assert.equal(posGetRes.status, 200);
      const posGetData = await posGetRes.json();
      assert.ok(Array.isArray(posGetData.availableRiders), 'GET /api/pos must return availableRiders array');
      for (const r of posGetData.availableRiders) {
        assert.equal(r.username, undefined, 'availableRiders must not leak staff username to cashier');
        assert.equal(r.passwordHash, undefined, 'availableRiders must not leak passwordHash');
      }
    });

    // 2. Role Isolation Guard on settle_rider_cod
    await test('P7_RBAC_02: Unauthenticated (401) and Accountant/Supplier/Rider (403) strictly blocked from settle_rider_cod', async () => {
      const unauthRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', '', {
          action: 'settle_rider_cod',
          settleAll: true,
        })
      );
      assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');

      for (const forbidden of [
        { role: 'accountant', token: accountantToken },
        { role: 'supplier', token: supplierToken },
        { role: 'delivery_rider', token: riderToken },
      ]) {
        const res = await posPOST(
          makeReq('http://localhost:3000/api/pos', 'POST', forbidden.token, {
            action: 'settle_rider_cod',
            settleAll: true,
          })
        );
        assert.equal(res.status, 403, `${forbidden.role} must be blocked from settle_rider_cod with 403`);
      }
    });

    // 3. Full Lifecycle: Online COD Order -> Rider Delivery -> Custody Balance -> Cashier Drawer Settlement -> Z-Report
    await test('P7_COD_03: End-to-End Rider COD Custody Handover into Active POS Shift Drawer & Anti-Double-Settlement Guard', async () => {
      let targetProduct;
      await withDbTransaction((draft) => {
        targetProduct = draft.products.find((p) => p.weights && p.weights.length > 0) || draft.products[0];
        targetProduct.inStock = true;
        targetProduct.stockKg = 25;
      });

      const chosenWeight = targetProduct.weights[0];
      const orderCreateRes = await ordersPOST(
        makeReq('http://localhost:3000/api/orders', 'POST', '', {
          customerName: 'عميل تجربة تحصيل المندوب',
          customerPhone: '01012345678',
          governorate: 'بندر بني مزار (توصيل فوري للمنزل)',
          address: 'شارع العاشر من رمضان بجوار مسجد الزراعيين',
          deliveryMethod: 'bandar_fast',
          paymentMethod: 'cod',
          items: [
            {
              cartItemId: 'cod-test-item-1',
              productId: targetProduct.id,
              productName: targetProduct.name,
              weightLabel: chosenWeight.label,
              weightGrams: chosenWeight.weightGrams || 250,
              roastOption: targetProduct.roastOptions?.[0] || 'محمص طازج',
              unitPrice: chosenWeight.price,
              quantity: 1,
            },
          ],
        })
      );
      assert.equal(orderCreateRes.status, 201, 'Online COD order creation must succeed with 201');
      const createdOrder = (await orderCreateRes.json()).order;
      assert.ok(createdOrder?.id, 'Created order must have an id');

      // Assign order to rider via Cashier POS action
      const assignRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashierToken, {
          action: 'assign_rider',
          orderId: createdOrder.id,
          riderId: riderStaff?.id || 'staff-rider-primary',
          riderName: riderStaff?.displayName || 'طيار توصيل البندر والقرى',
        })
      );
      assert.equal(assignRes.status, 200, 'Cashier assign_rider must succeed');

      // Rider delivers the COD order and collects cash
      const riderDeliverRes = await riderOrdersPATCH(
        makeReq('http://localhost:3000/api/rider/orders', 'PATCH', riderToken, {
          orderId: createdOrder.id,
          status: 'delivered',
          cashCollected: createdOrder.total,
          riderDeliveryNotes: 'تم التسليم والتحصيل نقداً',
        })
      );
      assert.equal(riderDeliverRes.status, 200, 'Rider delivery confirmation must succeed');

      // Rider GET stats must reflect unsettled COD custody
      const riderStatsBeforeRes = await riderOrdersGET(
        makeReq('http://localhost:3000/api/rider/orders', 'GET', riderToken)
      );
      const riderStatsBefore = (await riderStatsBeforeRes.json()).stats;
      assert.ok(
        riderStatsBefore.unsettledCodBalance >= createdOrder.total,
        `Rider unsettledCodBalance (${riderStatsBefore.unsettledCodBalance}) must include order total (${createdOrder.total})`
      );
      assert.ok(riderStatsBefore.unsettledOrdersCount >= 1, 'Rider unsettledOrdersCount must be >= 1');

      // Open a clean POS shift with 1000 EGP opening cash
      const openShiftRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashierToken, {
          action: 'open_shift',
          cashierName: 'كاشير الفترة المسائية',
          shiftPeriod: 'الوردية المسائية',
          openingCash: 1000,
        })
      );
      assert.equal(openShiftRes.status, 200, 'Opening POS shift must succeed');

      // Cashier settles the Rider's COD order into the drawer
      const settleRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashierToken, {
          action: 'settle_rider_cod',
          orderId: createdOrder.id,
        })
      );
      assert.equal(settleRes.status, 200, 'Cashier settle_rider_cod must succeed');
      const settleData = await settleRes.json();
      assert.equal(settleData.settledCount, 1);
      assert.equal(settleData.settledAmount, createdOrder.total);
      assert.equal(settleData.activeShift.riderCodSettledTotal, createdOrder.total);
      assert.equal(
        settleData.activeShift.expectedCashInDrawer,
        1000 + createdOrder.total,
        'Drawer expected cash must equal openingCash + settled Rider COD'
      );
      // Verify Cashier profit isolation on returned activeShift
      assert.equal(settleData.activeShift.totalRawCost, undefined, 'Cashier shift response must strip totalRawCost');
      assert.equal(settleData.activeShift.totalNetProfit, undefined, 'Cashier shift response must strip totalNetProfit');

      // Rider GET stats must now show settled balance updated and unsettled reduced
      const riderStatsAfterRes = await riderOrdersGET(
        makeReq('http://localhost:3000/api/rider/orders', 'GET', riderToken)
      );
      const riderStatsAfter = (await riderStatsAfterRes.json()).stats;
      assert.equal(
        riderStatsAfter.unsettledCodBalance,
        riderStatsBefore.unsettledCodBalance - createdOrder.total,
        'Rider unsettledCodBalance must decrease by exact settled amount'
      );
      assert.ok(
        riderStatsAfter.settledCodTotal >= createdOrder.total,
        'Rider settledCodTotal must include settled order amount'
      );

      // Anti-Double-Settlement Guard: re-settling the same order must return 400
      const duplicateSettleRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', cashierToken, {
          action: 'settle_rider_cod',
          orderId: createdOrder.id,
        })
      );
      assert.equal(duplicateSettleRes.status, 400, 'Re-settling an already settled order must be rejected with 400');

      // Close shift with exact physical cash (1000 + createdOrder.total) -> variance must be 0
      const closeRes = await posPOST(
        makeReq('http://localhost:3000/api/pos', 'POST', superAdminToken, {
          action: 'close_shift',
          actualClosingCash: 1000 + createdOrder.total,
        })
      );
      assert.equal(closeRes.status, 200);
      const closedShift = (await closeRes.json()).closedShift;
      assert.equal(closedShift.cashDifference, 0, 'Closed shift cashDifference must be 0');
      const shiftAudit = calculateShiftAudit(closedShift);
      assert.equal(shiftAudit.expectedCashInDrawer, 1000 + createdOrder.total);
      assert.equal(shiftAudit.riderCodSettledTotal, createdOrder.total);
      assert.equal(shiftAudit.variance, 0);
      assert.equal(shiftAudit.varianceType, 'balanced');
    });

    // 4. Atomic Anti-Oversell Online Stock Guard
    await test('P7_STK_04: POST /api/orders atomically blocks out-of-stock & insufficient-stock orders (direct & partitioned boxes) without mutating coupons', async () => {
      let limitedProduct;
      let initialCouponUses = 0;
      await withDbTransaction((draft) => {
        limitedProduct = draft.products.find((p) => p.weights && p.weights.length > 0) || draft.products[0];
        limitedProduct.inStock = true;
        limitedProduct.stockKg = 0.2; // Only 200g left in stock!
        const activeCoupon = draft.coupons.find((c) => c.active);
        if (activeCoupon) {
          initialCouponUses = activeCoupon.usedCount || 0;
        }
      });

      const dbSnap = await getDbAsync();
      const activeCoupon = dbSnap.coupons.find((c) => c.active);
      const w250 =
        limitedProduct.weights.find((w) => (w.weightGrams || w.grams || 250) >= 250) ||
        limitedProduct.weights[0];

      // Requesting 2 x w250 (>= 500g = 0.5 kg) when only 0.2 kg is available -> MUST fail with 400
      const oversellRes = await ordersPOST(
        makeReq('http://localhost:3000/api/orders', 'POST', '', {
          customerName: 'عميل اختبار حماية المخزون',
          customerPhone: '01122334455',
          governorate: 'بندر بني مزار (توصيل فوري للمنزل)',
          address: 'شارع الجمهورية',
          paymentMethod: 'cod',
          couponCode: activeCoupon?.code || undefined,
          items: [
            {
              cartItemId: 'oversell-1',
              productId: limitedProduct.id,
              productName: limitedProduct.name,
              weightId: w250.id,
              weightLabel: w250.label,
              weightGrams: w250.weightGrams || w250.grams || 250,
              roastOption: limitedProduct.roastOptions?.[0] || 'محمص',
              unitPrice: w250.price || 150,
              quantity: 2,
            },
          ],
        })
      );
      assert.equal(oversellRes.status, 400, 'Overselling beyond available stockKg must return 400');
      const oversellErr = await oversellRes.json();
      assert.ok(
        oversellErr.error && oversellErr.error.includes('الرصيد المتاح بالمخزن حالياً'),
        `Expected clear Arabic insufficient stock message, got: ${oversellErr.error}`
      );

      // Verify stockKg & coupon usedCount were NOT mutated
      const dbAfterOversell = await getDbAsync();
      const prodCheck = dbAfterOversell.products.find((p) => p.id === limitedProduct.id);
      assert.equal(prodCheck.stockKg, 0.2, 'Failed oversell order must not deplete stockKg');
      if (activeCoupon) {
        const couponCheck = dbAfterOversell.coupons.find((c) => c.id === activeCoupon.id);
        assert.equal(couponCheck.usedCount || 0, initialCouponUses, 'Failed oversell order must not increment coupon usedCount');
      }

      // Partitioned box roqan_4 requesting 4 slots x 100g = 400g of the same 200g product -> MUST fail with 400
      const nonVipFiller =
        dbSnap.products.find((p) => p.id !== limitedProduct.id && !p.isSuperVipItem && (p.pricePerKg || 300) < 600) ||
        limitedProduct;
      const boxOversellRes = await ordersPOST(
        makeReq('http://localhost:3000/api/orders', 'POST', '', {
          customerName: 'عميل بوكس مقسم',
          customerPhone: '01234567890',
          governorate: 'بندر بني مزار (توصيل فوري للمنزل)',
          address: 'شارع بورسعيد',
          paymentMethod: 'cod',
          items: [
            {
              cartItemId: 'box-oversell-1',
              productId: 'partitioned-box-4',
              productName: 'بوكس الروقان 4 خانات',
              weightLabel: '400 جم',
              roastOption: 'مشكل',
              unitPrice: 125,
              quantity: 1,
              isPartitionedBox: true,
              partitionedBoxSize: 'roqan_4',
              partitionedSlots: [
                { slotIndex: 1, productId: limitedProduct.id, productName: limitedProduct.name, roastOption: 'محمص', slotGrams: 100 },
                { slotIndex: 2, productId: limitedProduct.id, productName: limitedProduct.name, roastOption: 'محمص', slotGrams: 100 },
                { slotIndex: 3, productId: limitedProduct.id, productName: limitedProduct.name, roastOption: 'محمص', slotGrams: 100 },
                { slotIndex: 4, productId: nonVipFiller.id, productName: nonVipFiller.name, roastOption: 'محمص', slotGrams: 100 },
              ],
            },
          ],
        })
      );
      assert.equal(boxOversellRes.status, 400, 'Partitioned box exceeding cumulative slot stockKg must return 400');

      // Out-of-stock product (stockKg = 0, inStock = false) -> MUST fail with 400
      await withDbTransaction((draft) => {
        const p = draft.products.find((x) => x.id === limitedProduct.id);
        p.stockKg = 0;
        p.inStock = false;
      });
      const zeroStockRes = await ordersPOST(
        makeReq('http://localhost:3000/api/orders', 'POST', '', {
          customerName: 'عميل صنف نافد',
          customerPhone: '01099887766',
          governorate: 'بندر بني مزار (توصيل فوري للمنزل)',
          address: 'أمام المحطة',
          paymentMethod: 'cod',
          items: [
            {
              cartItemId: 'zero-stock-1',
              productId: limitedProduct.id,
              productName: limitedProduct.name,
              weightId: w250.id,
              weightLabel: w250.label,
              weightGrams: w250.weightGrams || w250.grams || 250,
              roastOption: limitedProduct.roastOptions?.[0] || 'محمص',
              unitPrice: w250.price || 150,
              quantity: 1,
            },
          ],
        })
      );
      assert.equal(zeroStockRes.status, 400, 'Out-of-stock product must be rejected with 400');
      const zeroErr = await zeroStockRes.json();
      assert.ok(zeroErr.error.includes('نفد من المخزون'), 'Must return clear out-of-stock Arabic error');
    });

    // 5. Critical Low-Stock Telegram Formatter & Z-Report COD Handover Line
    await test('P7_NOTIF_05: Low-Stock (<= 5 kg) Telegram Alert Formatter & Z-Report COD Settlement Breakdown', async () => {
      const lowStockMsg = formatLowStockTelegramMessage(
        [
          { productId: 'p1', productName: 'فستق حلبي جامبو محمص', previousStockKg: 5.5, remainingStockKg: 4.75 },
          { productId: 'p2', productName: 'بن حبشي محوج فاتح', previousStockKg: 0.25, remainingStockKg: 0 },
        ],
        'طلب أونلاين #NUT-7777'
      );
      assert.ok(lowStockMsg.includes('تنبيه نقص مخزون حرج'), 'Must include low-stock header');
      assert.ok(
        lowStockMsg.includes('فستق حلبي جامبو محمص') && lowStockMsg.includes('4.75 كجم'),
        'Must list critical <=5kg item'
      );
      assert.ok(lowStockMsg.includes('نفد بالكامل (0 كجم)'), 'Must flag zero-stock item');

      const zReportMsg = formatShiftZReportTelegramMessage({
        shiftNumber: 'SHIFT-707',
        cashierName: 'أحمد الكاشير',
        shiftPeriod: 'الوردية المسائية',
        openingCash: 1000,
        cashSalesTotal: 2500,
        riderCodSettledTotal: 640,
        cardSalesTotal: 400,
        vodafoneCashTotal: 150,
        instapayTotal: 250,
        expensesTotal: 100,
        expectedCashInDrawer: 4040,
        actualClosingCash: 4040,
        cashDifference: 0,
        totalRevenue: 3300,
        totalNetProfit: 920,
      });
      assert.ok(
        zReportMsg.includes('توريدات عهدة المناديب (COD) بالدرج') && zReportMsg.includes('+640'),
        'Z-Report Telegram message must include settled Rider COD total'
      );
    });

    console.log(
      `\n${colors.bold}${colors.green}✅ ALL PACKAGE 7 COD SETTLEMENT, STOCK GUARD & LOW-STOCK ALERT CHECKS PASSED!${colors.reset}\n`
    );
  } finally {
    fs.writeFileSync(DB_PATH, initialDbRaw, 'utf8');
  }
}

runPackage7Verification().catch((err) => {
  console.error('\nPackage 7 Verification Failed:', err);
  process.exit(1);
});
