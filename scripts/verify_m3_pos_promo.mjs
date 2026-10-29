import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');
const DB_BACKUP_PATH = path.join(ROOT_DIR, 'data', 'store-db.json.promo.bak');

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
const { getDbAsync } = await import('../src/lib/db.ts');
const { POST: posPOST } = await import('../src/app/api/pos/route.ts');
const { PATCH: ordersPATCH } = await import('../src/app/api/orders/route.ts');
const { generateAdminToken } = await import('../src/lib/auth.ts');

async function run() {
  console.log('--- Testing POS Flash Promo Bundle Stock Depletion & COGS (Feature 8) ---');
  fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);

  try {
    const db = await getDbAsync();

    // Find a flash promo in db with items
    const promoPool = db.flashPromotions || db.promotions || [];
    const targetPromo = promoPool.find((p) => Array.isArray(p.items) && p.items.length > 0);
    assert.ok(targetPromo, 'Target promo with constituent items must exist');

    console.log(`Using promo: ${targetPromo.id} with ${targetPromo.items.length} items`);

    // Record initial stock for each constituent item
    const initialStocks = new Map();
    for (const pi of targetPromo.items) {
      const prod = db.products.find((p) => p.id === pi.productId);
      assert.ok(prod, `Constituent product ${pi.productId} must exist`);
      initialStocks.set(pi.productId, prod.stockKg || 50);
    }

    const cashierToken = generateAdminToken(db.settings.cashierPassword, 'cashier').token;
    const adminToken = generateAdminToken(db.settings.adminPassword, 'super_admin').token;

    // 1. Simulate POS sale of the flash promo by Cashier
    const posReq = new NextRequest('http://localhost:3000/api/pos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        action: 'create_invoice',
        paymentMethod: 'cod',
        items: [
          {
            productId: `flash-promo-${targetPromo.id}`,
            productName: targetPromo.title || targetPromo.name || 'عرض الفلاش',
            isFlashPromo: true,
            flashPromoId: targetPromo.id,
            unitPrice: targetPromo.discountPrice || 250,
            quantity: 2,
          },
        ],
      }),
    });

    const res = await posPOST(posReq);
    assert.equal(res.status, 201, 'POS sale must return HTTP 201');
    const data = await res.json();
    assert.ok(data.success, 'Sale must be successful');
    assert.ok(data.order, 'Order must be created');
    // Cashier must NOT see rawCostTotal (role isolation & data sanitization)
    assert.equal(data.order.rawCostTotal, undefined, 'Cashier response must strip rawCostTotal');

    // 2. Verify that in the database, order has accurate rawCostTotal > 0
    const dbAfter = await getDbAsync();
    const storedOrder = dbAfter.orders.find((o) => o.id === data.order.id);
    assert.ok(storedOrder, 'Order must be stored in database');
    assert.ok(storedOrder.rawCostTotal > 0, `Stored order rawCostTotal (${storedOrder.rawCostTotal}) must be positive`);
    console.log(`✓ POS promo COGS calculated accurately: ${storedOrder.rawCostTotal} EGP`);

    // 3. Verify that fresh DB state shows constituent product stocks depleted
    for (const pi of targetPromo.items) {
      const prodAfter = dbAfter.products.find((p) => p.id === pi.productId);
      const initial = initialStocks.get(pi.productId);
      const itemGrams = (Number(pi.weightGrams) || 250) * (Number(pi.quantity) || 1);
      const expectedConsumedKg = (itemGrams * 2) / 1000;
      const expectedStock = Math.max(0, Math.round((initial - expectedConsumedKg) * 1000) / 1000);

      assert.equal(
        prodAfter.stockKg,
        expectedStock,
        `Product ${pi.productId} stockKg must be depleted from ${initial} to ${expectedStock}`
      );
      console.log(`✓ Product ${pi.productId}: ${initial} kg -> ${prodAfter.stockKg} kg (deducted ${expectedConsumedKg} kg)`);
    }

    // 4. Now cancel the order and verify reversal restores exact inventory
    const cancelReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId: data.order.id,
        status: 'cancelled',
      }),
    });

    const cancelRes = await ordersPATCH(cancelReq);
    assert.equal(cancelRes.status, 200, 'Order cancellation must succeed');

    const dbReversed = await getDbAsync();
    for (const pi of targetPromo.items) {
      const prodReversed = dbReversed.products.find((p) => p.id === pi.productId);
      const initial = initialStocks.get(pi.productId);
      assert.equal(
        prodReversed.stockKg,
        initial,
        `Product ${pi.productId} stockKg must be restored back to initial ${initial}`
      );
      console.log(`✓ Reversal restored ${pi.productId} back to ${initial} kg`);
    }

    console.log('🎉 POS Flash Promo Depletion & Reversal (Feature 8) 100% Verified!');
  } finally {
    if (fs.existsSync(DB_BACKUP_PATH)) {
      fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
      fs.unlinkSync(DB_BACKUP_PATH);
    }
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
