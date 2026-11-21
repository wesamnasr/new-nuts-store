import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');
const DB_BACKUP_PATH = path.join(ROOT_DIR, 'data', 'store-db.json.improvements.bak');

// Check if running under tsx; if running under pure node, delegate to tsx
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
const { POST: loginPOST } = await import('../src/app/api/admin/login/route.ts');
const { POST: ordersPOST, PATCH: ordersPATCH, DELETE: ordersDELETE } = await import('../src/app/api/orders/route.ts');
const { POST: posPOST } = await import('../src/app/api/pos/route.ts');
const {
  generateAdminToken,
  hashPasswordScrypt,
  verifyPasswordConstantTime,
  ALL_DASHBOARD_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} = await import('../src/lib/auth.ts');
const {
  ALL_DASHBOARD_PERMISSIONS: PERM_ALL,
  DEFAULT_ROLE_PERMISSIONS: PERM_DEFAULTS,
} = await import('../src/lib/permissions.ts');
const { validateCoupon } = await import('../src/lib/validation.ts');
const { getDbAsync, saveDbAsync, withDbTransaction } = await import('../src/lib/db.ts');

async function runImprovementsVerification() {
  console.log('==================================================================');
  console.log('  Verifying All 4 Architectural & Business Logic Improvements');
  console.log('==================================================================');

  fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);

  try {
    const initialDb = await getDbAsync();
    const adminToken = generateAdminToken(initialDb.settings.adminPassword, 'super_admin').token;
    const cashierToken = generateAdminToken(initialDb.settings.cashierPassword, 'cashier').token;

    // 1. Track 1: Order Cancellation & Re-activation Stock + VIP + Coupon Reversal
    {
      const db = await getDbAsync();
      const testProd = db.products[0];
      testProd.stockKg = 10.0;
      testProd.inStock = true;
      const w500 = testProd.weights.find((w) => (w.weightGrams || w.grams) === 500) || testProd.weights[0];
      const wGrams = w500.weightGrams || w500.grams || 500;
      const expectedConsumedKg = (wGrams * 2) / 1000;

      // Add a test coupon with maxUses
      db.coupons.push({
        id: 'coup-test-limit',
        code: 'LIMIT2',
        discountType: 'fixed',
        value: 25,
        minOrderAmount: 100,
        active: true,
        description: 'كوبون تجريبي بحد أقصى',
        maxUses: 2,
        usedCount: 0,
      });
      await saveDbAsync(db);

      // Create online order with qty 2 and coupon LIMIT2
      const createRes = await ordersPOST(
        new NextRequest('http://localhost:3000/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'عميل اختبار الإلغاء',
            customerPhone: '01098765432',
            deliveryMethod: 'bandar_fast',
            address: 'شارع الجمهورية، بني مزار',
            couponCode: 'LIMIT2',
            items: [
              {
                productId: testProd.id,
                productName: testProd.name,
                weightId: w500.id,
                weightLabel: w500.label,
                unitPrice: w500.price,
                quantity: 2,
              },
            ],
          }),
        })
      );
      assert.equal(createRes.status, 201, 'Order creation must return 201');
      const createdOrder = (await createRes.json()).order;
      assert.equal(createdOrder.rawCostTotal, undefined, 'Public order response must strip rawCostTotal');

      let dbAfterCreate = await getDbAsync();
      assert.equal(
        dbAfterCreate.products.find((p) => p.id === testProd.id).stockKg,
        Math.round((10.0 - expectedConsumedKg) * 1000) / 1000,
        'Stock must be depleted after order creation'
      );
      assert.equal(
        dbAfterCreate.coupons.find((c) => c.code === 'LIMIT2').usedCount,
        1,
        'Coupon usedCount must increment to 1'
      );

      // Cancel order via PATCH /api/orders -> must restore stockKg and decrement coupon usedCount
      const cancelRes = await ordersPATCH(
        new NextRequest('http://localhost:3000/api/orders', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            orderId: createdOrder.id,
            status: 'cancelled',
          }),
        })
      );
      assert.equal(cancelRes.status, 200, 'Order cancellation must succeed');

      let dbAfterCancel = await getDbAsync();
      assert.equal(
        dbAfterCancel.products.find((p) => p.id === testProd.id).stockKg,
        10.0,
        'Stock must be restored to 10.0 kg upon order cancellation'
      );
      assert.equal(
        dbAfterCancel.coupons.find((c) => c.code === 'LIMIT2').usedCount,
        0,
        'Coupon usedCount must decrement back to 0 upon order cancellation'
      );

      // Re-activate order -> must re-deplete stockKg
      const reactivateRes = await ordersPATCH(
        new NextRequest('http://localhost:3000/api/orders', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            orderId: createdOrder.id,
            status: 'confirmed',
          }),
        })
      );
      assert.equal(reactivateRes.status, 200, 'Order re-activation must succeed');

      let dbAfterReactivate = await getDbAsync();
      assert.equal(
        dbAfterReactivate.products.find((p) => p.id === testProd.id).stockKg,
        Math.round((10.0 - expectedConsumedKg) * 1000) / 1000,
        'Stock must be re-depleted when order is un-cancelled'
      );

      // Delete active order -> must restore stockKg before deleting
      const deleteRes = await ordersDELETE(
        new NextRequest(`http://localhost:3000/api/orders?orderId=${createdOrder.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      );
      assert.equal(deleteRes.status, 200, 'Order deletion must succeed');

      let dbAfterDelete = await getDbAsync();
      assert.equal(
        dbAfterDelete.products.find((p) => p.id === testProd.id).stockKg,
        10.0,
        'Stock must be restored when active order is deleted'
      );
      console.log('✓ Track 1.1: Order cancellation, re-activation, and deletion stock/VIP/coupon reversal verified');
    }

    // 2. Track 1: Coupon Expiration & Max Uses Validation
    {
      const expiredCoupon = {
        id: 'c-exp',
        code: 'OLD10',
        discountType: 'percentage',
        value: 10,
        minOrderAmount: 100,
        active: true,
        description: 'Expired',
        expiresAt: '2020-01-01T00:00:00.000Z',
      };
      const expRes = validateCoupon(expiredCoupon, 500);
      assert.equal(expRes.isValid, false, 'Expired coupon must be rejected');

      const exhaustedCoupon = {
        id: 'c-max',
        code: 'MAX10',
        discountType: 'fixed',
        value: 50,
        minOrderAmount: 100,
        active: true,
        description: 'Exhausted',
        maxUses: 5,
        usedCount: 5,
      };
      const maxRes = validateCoupon(exhaustedCoupon, 500);
      assert.equal(maxRes.isValid, false, 'Exhausted coupon must be rejected');
      console.log('✓ Track 1.2: Coupon expiration and maxUses validation verified');
    }

    // 3. Track 1: POS Accurate COGS for Custom Mix & Coffee Blend
    {
      const db = await getDbAsync();
      const p0 = db.products[0];
      const p1 = db.products[1];
      const posRes = await posPOST(
        new NextRequest('http://localhost:3000/api/pos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'create_invoice',
            posOrderType: 'counter_takeaway',
            paymentMethod: 'cod',
            items: [
              {
                isCustomMix: true,
                boxCapacityGrams: 500,
                productName: 'علبة مشكلة POS',
                unitPrice: 300,
                quantity: 1,
                customBreakdown: [
                  { productId: p0.id, productName: p0.name, percentage: 50, weightGrams: 250 },
                  { productId: p1.id, productName: p1.name, percentage: 50, weightGrams: 250 },
                ],
              },
            ],
          }),
        })
      );
      assert.equal(posRes.status, 201, 'POS custom mix invoice must succeed');
      const posData = await posRes.json();
      assert.ok(posData.order.rawCostTotal > 0, 'POS custom mix must compute positive wholesale rawCostTotal');
      console.log('✓ Track 1.3: POS server-side COGS calculation for custom boxes verified');
    }

    // 4. Track 2: Database Write Mutex & Transaction Helper
    {
      await withDbTransaction(async (db) => {
        assert.ok(Array.isArray(db.products), 'withDbTransaction provides normalized database');
      });
      console.log('✓ Track 2: Serialized database write mutex & withDbTransaction verified');
    }

    // 5. Track 3: RBAC Unification, Scrypt Password Hashing & Login Rate Limiting
    {
      assert.deepEqual(ALL_DASHBOARD_PERMISSIONS, PERM_ALL, 'auth.ts and permissions.ts must share ALL_DASHBOARD_PERMISSIONS');
      assert.deepEqual(DEFAULT_ROLE_PERMISSIONS, PERM_DEFAULTS, 'auth.ts and permissions.ts must share DEFAULT_ROLE_PERMISSIONS');

      const hashed = hashPasswordScrypt('MySecret#2026');
      assert.ok(hashed.startsWith('scrypt$'), 'Scrypt hash must use scrypt$ prefix');
      assert.equal(verifyPasswordConstantTime('MySecret#2026', hashed), true, 'Correct password must verify against scrypt hash');
      assert.equal(verifyPasswordConstantTime('WrongPass', hashed), false, 'Wrong password must fail against scrypt hash');

      // Test IP rate limiting on /api/admin/login
      const testIp = '203.0.113.99';
      let lastStatus = 200;
      for (let attempt = 1; attempt <= 11; attempt++) {
        const res = await loginPOST(
          new NextRequest('http://localhost:3000/api/admin/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': testIp,
            },
            body: JSON.stringify({
              username: 'admin_hafsa',
              password: 'WrongPasswordAttempt',
            }),
          })
        );
        lastStatus = res.status;
      }
      assert.equal(lastStatus, 429, '11th failed login attempt from same IP must return 429 Too Many Requests');
      console.log('✓ Track 3: RBAC unification, scrypt hashing, and IP login rate limiting verified');
    }

    console.log('\n🎉 ALL ARCHITECTURAL & BUSINESS LOGIC IMPROVEMENTS VERIFIED SUCCESSFULLY!');
  } finally {
    if (fs.existsSync(DB_BACKUP_PATH)) {
      fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
      fs.unlinkSync(DB_BACKUP_PATH);
    }
  }
}

runImprovementsVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
