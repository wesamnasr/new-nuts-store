/**
 * Empirical Adversarial Challenger Test Suite — Milestone M2
 * Agent: challenger_m2_exec_2
 * 
 * Verifies:
 * 1. Route canonical redirects (/custom-box -> /build-box, /cashier -> /pos, etc.) & URL param integrity.
 * 2. Database consistency (all products maintain exactly 4 weights, HAFSA_AC_01_03 compliance, and 2000g resolution).
 * 3. Custom mix box pricing engine math, proportional pricing, and boundary stress tests.
 * 4. End-to-end breakdown display and lifecycle integrity (cart, checkout, tracking, receipts, inventory reversal, COGS).
 * 5. POS cashier low-stock visual indicators and out-of-stock guardrails.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const isRunningUnderTsx = Boolean(
  process.env.TSX_EXEC_ACTIVE ||
  process.execArgv.some((arg) => arg.includes('tsx'))
);

if (!isRunningUnderTsx) {
  const targetScript = '"' + fileURLToPath(import.meta.url) + '"';
  const result = spawnSync('npx', ['tsx', targetScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_EXEC_ACTIVE: '1' },
    shell: true,
  });
  process.exit(result.status ?? 0);
}

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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function check(desc, condition, extraInfo = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${desc}`);
  } else {
    failedTests++;
    failures.push({ desc, extraInfo });
    console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${desc} ${extraInfo}`);
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
}

async function runEmpiricalChallenge() {
  console.log(`\n${colors.bold}${colors.yellow}==================================================================`);
  console.log(`  EMPIRICAL ADVERSARIAL CHALLENGER M2 TEST HARNESS`);
  console.log(`==================================================================${colors.reset}`);

  // Dynamic imports of application modules
  const {
    calculateCustomBoxPrice,
    generateWeightsFromKiloPrice,
    generate5WeightsFromKiloPrice,
    generate2000gWeightVariant,
    getResolvedProductWeights,
    getProductPriceForWeight,
    getProductCostForWeight,
    getShortWeightLabel,
    PARTITIONED_BOX_PRESETS,
  } = await import('../src/lib/pricing.ts');

  const { calculateOrderCogs } = await import('../src/lib/financials.ts');
  const { computeOrderStockConsumptionKg, reverseOrderEffects } = await import('../src/lib/order-reversal.ts');

  const dbRaw = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(dbRaw);

  // ─────────────────────────────────────────────────────────────────────────
  suite('Track 1: Route Canonical Redirections & Navigation Integrity');
  // ─────────────────────────────────────────────────────────────────────────

  const customBoxFile = path.join(ROOT_DIR, 'src/app/custom-box/page.tsx');
  check('custom-box page exists', fs.existsSync(customBoxFile));
  const customBoxContent = fs.readFileSync(customBoxFile, 'utf8');
  check(
    '/custom-box redirects cleanly to /build-box',
    customBoxContent.includes("redirect('/build-box')")
  );

  const buildBoxFile = path.join(ROOT_DIR, 'src/app/build-box/page.tsx');
  check('build-box page exists', fs.existsSync(buildBoxFile));
  const buildBoxContent = fs.readFileSync(buildBoxFile, 'utf8');
  check(
    '/build-box does NOT contain redirect back to /custom-box (no redirect loop)',
    !buildBoxContent.includes("redirect('/custom-box')") &&
    !buildBoxContent.includes('redirect("/custom-box")')
  );

  check(
    '/build-box imports and mounts CustomMixBoxStudio component',
    buildBoxContent.includes('CustomMixBoxStudio') &&
    fs.existsSync(path.join(ROOT_DIR, 'src/components/boxes/CustomMixBoxStudio.tsx'))
  );

  check(
    '/build-box supports dual-mode tab switching (mix & partitioned)',
    buildBoxContent.includes('activeMode') &&
    buildBoxContent.includes("'partitioned'") &&
    buildBoxContent.includes("'mix'")
  );

  const trackOrderFile = path.join(ROOT_DIR, 'src/app/track-order/page.tsx');
  check(
    '/track-order canonical redirect to /track exists',
    fs.existsSync(trackOrderFile) &&
    fs.readFileSync(trackOrderFile, 'utf8').includes("redirect('/track')")
  );

  const cashierFile = path.join(ROOT_DIR, 'src/app/cashier/page.tsx');
  check(
    '/cashier canonical redirect to /pos exists',
    fs.existsSync(cashierFile) &&
    fs.readFileSync(cashierFile, 'utf8').includes("redirect('/pos')")
  );

  // ─────────────────────────────────────────────────────────────────────────
  suite('Track 2: Database Weights Consistency & 2000g Resolution Invariants');
  // ─────────────────────────────────────────────────────────────────────────

  check('Database contains products array', Array.isArray(db.products) && db.products.length > 0);

  let allProductsHave4Weights = true;
  let allWeightSequencesMatch = true;
  let allWeightsMatchPercentages = true;

  for (const product of db.products) {
    if (!Array.isArray(product.weights) || product.weights.length !== 4) {
      allProductsHave4Weights = false;
    }
    const gramsSeq = (product.weights || []).map((w) => w.weightGrams || w.grams).join(',');
    if (gramsSeq !== '125,250,500,1000') {
      allWeightSequencesMatch = false;
    }

    const kiloPrice = product.pricePerKg || product.weights?.[3]?.price || 0;
    const w125 = product.weights?.find((w) => (w.weightGrams || w.grams) === 125);
    const w250 = product.weights?.find((w) => (w.weightGrams || w.grams) === 250);
    const w500 = product.weights?.find((w) => (w.weightGrams || w.grams) === 500);
    const w1000 = product.weights?.find((w) => (w.weightGrams || w.grams) === 1000);

    if (
      w125?.price !== Math.round(kiloPrice * 0.125) ||
      w250?.price !== Math.round(kiloPrice * 0.25) ||
      w500?.price !== Math.round(kiloPrice * 0.5) ||
      w1000?.price !== Math.round(kiloPrice)
    ) {
      allWeightsMatchPercentages = false;
    }
  }

  check('Invariant HAFSA_AC_01_03: Every product in store-db.json has exactly 4 weights', allProductsHave4Weights);
  check('Weight sequence is strictly [125, 250, 500, 1000] for all database products', allWeightSequencesMatch);
  
  // Test dynamic generation of weights from kiloPrice
  const sampleGeneratedWeights = generateWeightsFromKiloPrice(400);
  check(
    'generateWeightsFromKiloPrice generates exactly [125, 250, 500, 1000] with proportional prices (50, 100, 200, 400)',
    sampleGeneratedWeights.length === 4 &&
    sampleGeneratedWeights[0].price === 50 &&
    sampleGeneratedWeights[1].price === 100 &&
    sampleGeneratedWeights[2].price === 200 &&
    sampleGeneratedWeights[3].price === 400
  );

  const bulkProducts = db.products.filter((p) => p.supports2kg === true);
  check('At least 5 bulk products tagged with supports2kg: true', bulkProducts.length >= 5);

  // Test dynamic resolution of 2000g
  const sampleBulkProduct = bulkProducts[0];
  const resolvedBulkWeights = getResolvedProductWeights(sampleBulkProduct);
  check(
    'getResolvedProductWeights dynamically resolves 5 weights for supports2kg=true product',
    resolvedBulkWeights.length === 5 &&
    resolvedBulkWeights.some((w) => (w.weightGrams || w.grams) === 2000)
  );

  const nonBulkProduct = db.products.find((p) => !p.supports2kg) || db.products[0];
  const resolvedNonBulkWeights = getResolvedProductWeights(nonBulkProduct);
  check(
    'getResolvedProductWeights preserves exactly 4 weights when supports2kg is false',
    resolvedNonBulkWeights.length === 4
  );

  const force2kgWeights = getResolvedProductWeights(nonBulkProduct, { include2000g: true });
  check(
    'getResolvedProductWeights resolves 5 weights when { include2000g: true } is explicitly passed',
    force2kgWeights.length === 5 &&
    force2kgWeights[4].weightGrams === 2000
  );

  // Check 2000g pricing math
  const kiloPriceTest = 400;
  const weights5 = generate5WeightsFromKiloPrice(kiloPriceTest);
  check('generate5WeightsFromKiloPrice outputs 5 variants', weights5.length === 5);
  check('2000g variant in generate5WeightsFromKiloPrice equals kiloPrice * 2 (800 EGP)', weights5[4].price === 800);

  const standalone2kg = generate2000gWeightVariant(kiloPriceTest, 450, 5); // 5% discount
  check('generate2000gWeightVariant with 5% discount calculates 760 EGP', standalone2kg.price === 760);

  const resolvedPrice2000 = getProductPriceForWeight(sampleBulkProduct, 2000);
  const sampleKilo = sampleBulkProduct.pricePerKg || sampleBulkProduct.weights[3].price;
  check('getProductPriceForWeight for 2000g matches kiloPrice * 2', resolvedPrice2000 === sampleKilo * 2);

  // ─────────────────────────────────────────────────────────────────────────
  suite('Track 3: Custom Mix Box Pricing Engine & Adversarial Boundary Tests');
  // ─────────────────────────────────────────────────────────────────────────

  const nut1 = db.products.find((p) => p.id === 'prod-pistachio-1') || db.products[0];
  const nut2 = db.products.find((p) => p.id === 'prod-cashew-1') || db.products[1];
  const nut3 = db.products.find((p) => p.id === 'prod-almond-1') || db.products[2];

  // Test 1: Valid 500g mix with 50% + 50% = 100%
  const res500 = calculateCustomBoxPrice(500, [
    { product: nut1, percentage: 50, roastOption: 'محمص مملح' },
    { product: nut2, percentage: 50, roastOption: 'محمص مملح' },
  ]);
  check('500g box with 50% + 50% is valid', res500.isValid);
  check('500g box totalPercentage is 100', res500.totalPercentage === 100);
  check('500g box breakdown contains 2 items', res500.breakdown.length === 2);
  const expected500Weight = res500.breakdown.reduce((s, b) => s + b.weightGrams, 0);
  check('500g box constituent weights sum to 500g', expected500Weight === 500);

  // Test 2: Valid 1000g mix with 40% + 35% + 25% = 100%
  const res1000 = calculateCustomBoxPrice(1000, [
    { product: nut1, percentage: 40, roastOption: 'محمص مملح' },
    { product: nut2, percentage: 35, roastOption: 'نيء طبيعي' },
    { product: nut3, percentage: 25, roastOption: 'مدخن بالجبنة' },
  ]);
  check('1000g box with 40% + 35% + 25% is valid', res1000.isValid);
  const expected1000Weight = res1000.breakdown.reduce((s, b) => s + b.weightGrams, 0);
  check('1000g box constituent weights sum to 1000g', expected1000Weight === 1000);

  // Test 3: Valid 2000g mix with 50% + 50% = 100%
  const res2000 = calculateCustomBoxPrice(2000, [
    { product: nut1, percentage: 50, roastOption: 'محمص مملح' },
    { product: nut2, percentage: 50, roastOption: 'محمص مملح' },
  ]);
  check('2000g box is valid', res2000.isValid);
  const expected2000Weight = res2000.breakdown.reduce((s, b) => s + b.weightGrams, 0);
  check('2000g box constituent weights sum to 2000g', expected2000Weight === 2000);

  // Adversarial Boundary 1: Incomplete box (< 100%)
  const resIncomplete = calculateCustomBoxPrice(1000, [
    { product: nut1, percentage: 40, roastOption: 'محمص مملح' },
    { product: nut2, percentage: 30, roastOption: 'محمص مملح' },
  ]);
  check('Incomplete box (70%) returns isValid: false', !resIncomplete.isValid);
  check('Incomplete box provides descriptive error message in Arabic', Boolean(resIncomplete.error && resIncomplete.error.includes('سعة العلبة غير مكتملة')));

  // Adversarial Boundary 2: Overfilled box (> 100%)
  const resOverfilled = calculateCustomBoxPrice(1000, [
    { product: nut1, percentage: 60, roastOption: 'محمص مملح' },
    { product: nut2, percentage: 50, roastOption: 'محمص مملح' },
  ]);
  check('Overfilled box (110%) returns isValid: false', !resOverfilled.isValid);
  check('Overfilled box provides descriptive error message in Arabic', Boolean(resOverfilled.error && resOverfilled.error.includes('تجاوزت السعة')));

  // Adversarial Boundary 3: Negative or zero percentage
  const resZeroPercent = calculateCustomBoxPrice(1000, [
    { product: nut1, percentage: 100, roastOption: 'محمص مملح' },
    { product: nut2, percentage: 0, roastOption: 'محمص مملح' },
  ]);
  check('Portion with 0% returns isValid: false', !resZeroPercent.isValid);

  const resNegativePercent = calculateCustomBoxPrice(1000, [
    { product: nut1, percentage: 110, roastOption: 'محمص مملح' },
    { product: nut2, percentage: -10, roastOption: 'محمص مملح' },
  ]);
  check('Portion with negative percentage returns isValid: false', !resNegativePercent.isValid);

  // Adversarial Boundary 4: Invalid box sizes
  const resInvalidSize = calculateCustomBoxPrice(750, [
    { product: nut1, percentage: 100, roastOption: 'محمص مملح' },
  ]);
  check('Unsupported box size (750g) returns isValid: false', !resInvalidSize.isValid);

  // Adversarial Boundary 5: Empty portions
  const resEmptyPortions = calculateCustomBoxPrice(1000, []);
  check('Empty portions array returns isValid: false', !resEmptyPortions.isValid);

  // Adversarial Boundary 6: Floating point precision roundoff (33.33 + 33.33 + 33.34 = 100)
  const resFloating = calculateCustomBoxPrice(1000, [
    { product: nut1, percentage: 33.33, roastOption: 'محمص مملح' },
    { product: nut2, percentage: 33.33, roastOption: 'محمص مملح' },
    { product: nut3, percentage: 33.34, roastOption: 'محمص مملح' },
  ]);
  check('Floating point percentage precision handled cleanly', resFloating.isValid);

  // ─────────────────────────────────────────────────────────────────────────
  suite('Track 4: Downstream Breakdown Display, Inventory Reversal & COGS');
  // ─────────────────────────────────────────────────────────────────────────

  // Check code presence for breakdown rendering across customer and operational portals
  const cartDrawerFile = path.join(ROOT_DIR, 'src/components/CartDrawer.tsx');
  const cartDrawerContent = fs.readFileSync(cartDrawerFile, 'utf8');
  check('CartDrawer renders customBreakdown', cartDrawerContent.includes('item.customBreakdown'));

  const checkoutFile = path.join(ROOT_DIR, 'src/app/checkout/page.tsx');
  const checkoutContent = fs.readFileSync(checkoutFile, 'utf8');
  check('Checkout page renders customBreakdown', checkoutContent.includes('item.customBreakdown'));

  const trackFile = path.join(ROOT_DIR, 'src/app/track/page.tsx');
  const trackContent = fs.readFileSync(trackFile, 'utf8');
  check('Order tracking page renders customBreakdown', trackContent.includes('item.customBreakdown'));

  const receiptModalFile = path.join(ROOT_DIR, 'src/components/SupermarketReceiptModal.tsx');
  const receiptModalContent = fs.readFileSync(receiptModalFile, 'utf8');
  check('SupermarketReceiptModal renders customBreakdown', receiptModalContent.includes('it.customBreakdown'));

  const adminFile = path.join(ROOT_DIR, 'src/app/admin/page.tsx');
  const adminContent = fs.readFileSync(adminFile, 'utf8');
  check('Admin orders view renders customBreakdown', adminContent.includes('item.customBreakdown'));

  // Test Inventory Reversal Oracle for Custom Mix Box
  const testStockNut1 = 50.0;
  const testStockNut2 = 40.0;
  const mockProducts = [
    { ...nut1, stockKg: testStockNut1, inStock: true },
    { ...nut2, stockKg: testStockNut2, inStock: true },
  ];

  const mockCustomMixOrder = {
    id: 'ord-test-custom-mix-1',
    status: 'cancelled',
    items: [
      {
        id: 'item-mix-1',
        productId: 'custom-box-builder',
        title: 'علبة مكسرات مشكلة خاصة (1000 جم)',
        price: res1000.totalPrice,
        quantity: 2, // 2 boxes of 1kg
        isCustomMix: true,
        customBreakdown: [
          {
            productId: nut1.id,
            productName: nut1.name,
            percentage: 60,
            weightGrams: 600, // 600g per box -> 1.2kg total
            priceContribution: 300,
          },
          {
            productId: nut2.id,
            productName: nut2.name,
            percentage: 40,
            weightGrams: 400, // 400g per box -> 0.8kg total
            priceContribution: 200,
          },
        ],
      },
    ],
  };

  const mockDb = { products: mockProducts, orders: [mockCustomMixOrder], coupons: [], vipMembers: [] };
  const consumption = computeOrderStockConsumptionKg(mockDb, mockCustomMixOrder);
  check('computeOrderStockConsumptionKg calculates nut1 consumption as 1.2 kg', consumption[nut1.id] === 1.2);
  check('computeOrderStockConsumptionKg calculates nut2 consumption as 0.8 kg', consumption[nut2.id] === 0.8);

  reverseOrderEffects(mockDb, mockCustomMixOrder);
  const restoredNut1 = mockProducts.find((p) => p.id === nut1.id);
  const restoredNut2 = mockProducts.find((p) => p.id === nut2.id);

  check(
    'reverseOrderEffects restores nut1 stock accurately (+1.2 kg)',
    restoredNut1 && Math.abs(restoredNut1.stockKg - (testStockNut1 + 1.2)) < 0.001
  );
  check(
    'reverseOrderEffects restores nut2 stock accurately (+0.8 kg)',
    restoredNut2 && Math.abs(restoredNut2.stockKg - (testStockNut2 + 0.8)) < 0.001
  );

  // Test Financials COGS Oracle for Custom Mix Box
  const cogs = calculateOrderCogs(mockCustomMixOrder, mockProducts);
  check('calculateOrderCogs computes COGS for custom mix boxes (> 0)', cogs > 0);

  // ─────────────────────────────────────────────────────────────────────────
  suite('Track 5: POS Low-Stock Product Visual Indicators');
  // ─────────────────────────────────────────────────────────────────────────

  const posDirectSalesFile = path.join(ROOT_DIR, 'src/components/pos/PosDirectSalesPage.tsx');
  check('PosDirectSalesPage exists', fs.existsSync(posDirectSalesFile));
  const posDirectSalesContent = fs.readFileSync(posDirectSalesFile, 'utf8');

  check(
    'PosDirectSalesPage preserves showInPos !== false invariant',
    posDirectSalesContent.includes('p.showInPos !== false')
  );

  check(
    'PosDirectSalesPage defines LOW_STOCK_THRESHOLD_KG = 5',
    posDirectSalesContent.includes('LOW_STOCK_THRESHOLD_KG = 5')
  );

  check(
    'PosDirectSalesPage includes low-stock filter state (low_stock)',
    posDirectSalesContent.includes('stockFilter') &&
    posDirectSalesContent.includes("'low_stock'")
  );

  check(
    'PosDirectSalesPage renders low stock remaining badge in kg',
    posDirectSalesContent.includes('متبقي') &&
    posDirectSalesContent.includes('كجم')
  );

  check(
    'PosDirectSalesPage renders out of stock indicator (نفد المخزون)',
    posDirectSalesContent.includes('نفد المخزون')
  );

  check(
    'PosDirectSalesPage guards scale and weight selection when product is out of stock',
    posDirectSalesContent.includes('isOutOfStock') &&
    posDirectSalesContent.includes('disabled={isOutOfStock}')
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Final Results
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}EMPIRICAL ADVERSARIAL CHALLENGE SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Total Checks : ${colors.bold}${totalTests}${colors.reset}`);
  console.log(`  Passed       : ${colors.green}${colors.bold}${passedTests}${colors.reset}`);
  console.log(`  Failed       : ${failedTests > 0 ? colors.red : colors.green}${colors.bold}${failedTests}${colors.reset}`);
  console.log(`  Pass Rate    : ${colors.bold}${((passedTests / totalTests) * 100).toFixed(1)}%${colors.reset}`);

  if (failedTests > 0) {
    console.log(`\n${colors.bold}${colors.red}Failures Summary:${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${colors.red}${f.desc}${colors.reset}: ${f.extraInfo}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}🎉 ALL ${totalTests} EMPIRICAL ADVERSARIAL CHECKS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal unhandled error in challenge suite:', err);
  process.exit(1);
});
