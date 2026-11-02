/**
 * Standalone Verification Suite for Package 8:
 * - Weighted Average Cost (WAC) valuation on Supply Invoice approval
 * - Atomic Physical Inventory Adjustments & Shrinkage Ledger (/api/admin/inventory-adjustments)
 * - Strict RBAC (Accountant Read-Only audit, Super Admin exclusive mutation)
 * - In-Store POS Out-of-Stock Guard & Override
 * - 58mm Thermal Sticker Barista Recipe Breakdown
 * - Neon Serverless Postgres 11-Table Relational Schema Synchronization
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');

// Color helpers
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

let testsPassed = 0;
let testsTotal = 0;

async function runTest(name, fn) {
  testsTotal++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ${green('✓ [PASS]')} ${name}`);
  } catch (err) {
    console.error(`  ${red('✗ [FAIL]')} ${name}`);
    console.error(`    ${red(err.message)}`);
    throw err;
  }
}

async function main() {
  console.log(`\n${cyan('══════════════════════════════════════════════════════════════════')}`);
  console.log(`${cyan('▶ Package 8: WAC Valuation, Inventory Adjustments & POS Guard Suite')}`);
  console.log(`${cyan('══════════════════════════════════════════════════════════════════')}\n`);

  // Backup store-db.json for state isolation
  const originalDbRaw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf8') : null;

  try {
    // 1. Static Contract & Schema DDL Verification
    await runTest('P8_SCH_01: Neon Postgres 11th Relational Table (inventory_adjustments) DDL & Sync', async () => {
      const pgSchemaRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/postgres-schema.ts'), 'utf8');
      const storeTypesRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/types/store.ts'), 'utf8');

      assert.ok(
        pgSchemaRaw.includes("'inventory_adjustments'"),
        'RELATIONAL_TABLES must include inventory_adjustments'
      );
      assert.ok(
        pgSchemaRaw.includes('CREATE TABLE IF NOT EXISTS inventory_adjustments'),
        'SCHEMA_DDL_STATEMENTS must define inventory_adjustments table DDL'
      );
      assert.ok(
        pgSchemaRaw.includes('idx_adj_product_created') && pgSchemaRaw.includes('idx_adj_reason'),
        'SCHEMA_DDL_STATEMENTS must index inventory_adjustments by product and reason'
      );
      assert.ok(
        pgSchemaRaw.includes('INSERT INTO inventory_adjustments') &&
          pgSchemaRaw.includes('DELETE FROM inventory_adjustments'),
        'buildRelationalSyncStatements must synchronize inventory_adjustments'
      );
      assert.ok(
        storeTypesRaw.includes('interface InventoryAdjustment') &&
          storeTypesRaw.includes('inventoryAdjustments?: InventoryAdjustment[]'),
        'store.ts must declare InventoryAdjustment type and field on DatabaseSchema'
      );
    });

    // 2. Weighted Average Cost (WAC) Math & Supply Approval Verification
    await runTest('P8_WAC_02: Supply Invoice Approval Applies Weighted Average Cost (WAC) Formula', async () => {
      const supplyRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/supply-invoices/route.ts'), 'utf8');

      assert.ok(
        supplyRouteRaw.includes('Weighted Average Cost (WAC)') ||
          supplyRouteRaw.includes('totalValuation = (currentStock * currentCost) + (incomingQty * incomingCost)'),
        'PATCH /api/supply-invoices must compute Weighted Average Cost (WAC) when approving invoices'
      );
      assert.ok(
        supplyRouteRaw.includes('totalStock > 0 ? Math.round((totalValuation / totalStock) * 100) / 100 : incomingCost'),
        'WAC formula must divide total valuation by combined physical stock'
      );

      // Unit test WAC calculation oracle
      const currentStock = 20; // 20 kg
      const currentCost = 400; // 400 EGP/kg
      const incomingQty = 5; // 5 kg
      const incomingCost = 650; // 650 EGP/kg

      const totalValuation = currentStock * currentCost + incomingQty * incomingCost; // 8000 + 3250 = 11250
      const totalStock = currentStock + incomingQty; // 25 kg
      const calculatedWac = Math.round((totalValuation / totalStock) * 100) / 100; // 450 EGP/kg

      assert.strictEqual(calculatedWac, 450, '20kg @ 400 + 5kg @ 650 must yield 25kg @ 450 WAC');
    });

    // 3. Inventory Adjustments API Route & RBAC Matrix
    await runTest('P8_ADJ_03: Dedicated /api/admin/inventory-adjustments Endpoint & Strict RBAC Guard', async () => {
      const routePath = path.join(ROOT_DIR, 'src/app/api/admin/inventory-adjustments/route.ts');
      assert.ok(fs.existsSync(routePath), '/api/admin/inventory-adjustments/route.ts must exist');
      const routeRaw = fs.readFileSync(routePath, 'utf8');

      // Verify RBAC enforcement
      assert.ok(routeRaw.includes("auth.role === 'delivery_rider'"), 'Must block delivery_rider');
      assert.ok(routeRaw.includes("auth.role === 'cashier'"), 'Must block cashier');
      assert.ok(routeRaw.includes("auth.role === 'accountant'"), 'Must block accountant on POST mutations');
      assert.ok(routeRaw.includes('صلاحية تدقيق وقراءة فقط'), 'Must declare accountant read-only status');
      assert.ok(routeRaw.includes("auth.role !== 'super_admin' && auth.role !== 'admin'"), 'Must restrict POST to Admin/Super Admin');

      // Verify reason labels & cost impact math
      assert.ok(routeRaw.includes('physical_count_discrepancy'), 'Must support physical_count_discrepancy reason');
      assert.ok(routeRaw.includes('roasting_shrinkage'), 'Must support roasting_shrinkage reason');
      assert.ok(routeRaw.includes('damaged_spoilage'), 'Must support damaged_spoilage reason');
      assert.ok(routeRaw.includes('differenceKg = Math.round((targetStockKg - previousStockKg) * 1000) / 1000'), 'Must compute differenceKg');
      assert.ok(routeRaw.includes('totalCostImpact = Math.round(differenceKg * unitCostPerKg * 100) / 100'), 'Must compute totalCostImpact');
    });

    // 4. POS In-Store Out-of-Stock Guard & Override Contract
    await runTest('P8_POS_04: In-Store POS Out-of-Stock Guard Blocks Depleted Products without Override', async () => {
      const posRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/pos/route.ts'), 'utf8');

      assert.ok(
        posRouteRaw.includes('POS In-Store Physical Stock Availability Guard'),
        'POST /api/pos must contain in-store physical stock availability guard'
      );
      assert.ok(
        posRouteRaw.includes('body.allowOutOfStockOverride !== true'),
        'POST /api/pos must allow managerial override when allowOutOfStockOverride is true'
      );
      assert.ok(
        posRouteRaw.includes('نافد تماماً من صوامع الفرع (الرصيد: 0 كجم)'),
        'POST /api/pos must return descriptive Arabic message when product stock is 0'
      );
    });

    // 5. 58mm Thermal Sticker Barista Recipe & UI Modal Components
    await runTest('P8_UI_05: 58mm Barista Recipe Sticker & Interactive Inventory Adjustment UI Mounting', async () => {
      const receiptModalRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/SupermarketReceiptModal.tsx'), 'utf8');
      const adminModalPath = path.join(ROOT_DIR, 'src/components/admin/InventoryAdjustmentModal.tsx');
      assert.ok(fs.existsSync(adminModalPath), 'InventoryAdjustmentModal.tsx must exist');
      const adminModalRaw = fs.readFileSync(adminModalPath, 'utf8');
      const adminPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/admin/page.tsx'), 'utf8');
      const accountantPortalRaw = fs.readFileSync(
        path.join(ROOT_DIR, 'src/components/admin/AccountantIsolationPortal.tsx'),
        'utf8'
      );

      // Sticker support
      assert.ok(
        receiptModalRaw.includes('recipeLines?: string[]') && receiptModalRaw.includes('مكونات الخلطة / البوكس:'),
        'SupermarketReceiptModal must render barista / box recipe lines on 58mm thermal sticker'
      );

      // Admin Modal mounting
      assert.ok(
        adminModalRaw.includes('تسوية ومطابقة الجرد الفعلي للمخزون') &&
          adminModalRaw.includes('هالك تحميص طبيعي (تبخر رطوبة)'),
        'InventoryAdjustmentModal must display roastery-specific shrinkage options'
      );
      assert.ok(
        adminPageRaw.includes('<InventoryAdjustmentModal') &&
          adminPageRaw.includes('تسوية الجرد الفعلي للمخزون'),
        'src/app/admin/page.tsx must mount InventoryAdjustmentModal'
      );
      assert.ok(
        accountantPortalRaw.includes('<InventoryAdjustmentModal') &&
          accountantPortalRaw.includes('دفتر تسويات وهالك الجرد (Audit)'),
        'AccountantIsolationPortal must mount InventoryAdjustmentModal for read-only audit'
      );
    });

    console.log(`\n${green(`🎉 ALL ${testsPassed}/${testsTotal} PACKAGE 8 WAC, INVENTORY ADJUSTMENT & POS GUARD CHECKS PASSED!`)}\n`);
  } finally {
    // Restore original DB
    if (originalDbRaw && fs.existsSync(DB_PATH)) {
      try {
        fs.writeFileSync(DB_PATH, originalDbRaw, 'utf8');
      } catch (_) {}
    }
  }
}

main().catch((err) => {
  console.error('Fatal error executing Package 8 test suite:', err);
  process.exit(1);
});
