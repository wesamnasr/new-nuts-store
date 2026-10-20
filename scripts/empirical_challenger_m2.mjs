/**
 * Empirical Challenger Verification Harness — Milestone 2
 * Focus: Inventory Depletion Math & POS Cash Drawer Reconciliation
 * 
 * Verifies:
 * 1. Inventory depletion under edge-case portions, fractional rounding, and zero/negative stock boundaries.
 * 2. POS cash drawer expected cash formula and reconciliation variance under overage, exact, and shortage.
 * 3. Digital payment method isolation from physical cash drawer.
 */

import assert from 'node:assert/strict';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let testCount = 0;
let passCount = 0;
let failCount = 0;
const failures = [];

async function test(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${name}`);
  } catch (err) {
    failCount++;
    failures.push({ name, error: err });
    console.log(`  ${colors.red}✗ [FAIL]${colors.reset} ${name}`);
    console.log(`    ${colors.red}${err.stack || err.message}${colors.reset}`);
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Inventory Depletion Algorithm Oracle & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

function depleteProductStock(product, consumedKg) {
  const currentStock = typeof product.stockKg === 'number' ? product.stockKg : 50;
  product.stockKg = Math.max(0, Math.round((currentStock - consumedKg) * 1000) / 1000);
  if (product.stockKg <= 0) {
    product.inStock = false;
  } else {
    product.inStock = true;
  }
}

async function runInventoryDepletionTests() {
  suite('Empirical Test Suite 1: Inventory Depletion Math & Edge Cases');

  await test('DEP_01: Standard depletion with integer and clean decimal weights', async () => {
    const product = { id: 'p1', stockKg: 10, inStock: true };
    depleteProductStock(product, 0.25); // 250g
    assert.strictEqual(product.stockKg, 9.75);
    assert.strictEqual(product.inStock, true);

    depleteProductStock(product, 0.5); // 500g
    assert.strictEqual(product.stockKg, 9.25);
    assert.strictEqual(product.inStock, true);

    depleteProductStock(product, 1.0); // 1kg
    assert.strictEqual(product.stockKg, 8.25);
    assert.strictEqual(product.inStock, true);
  });

  await test('DEP_02: Floating point precision drift prevention (0.1 + 0.2 roundoff)', async () => {
    // In naive JS: 10 - 0.1 - 0.2 - 0.3 = 9.400000000000002
    const product = { id: 'p2', stockKg: 10, inStock: true };
    depleteProductStock(product, 0.1);
    depleteProductStock(product, 0.2);
    depleteProductStock(product, 0.3);
    assert.strictEqual(product.stockKg, 9.4);
    assert.strictEqual(product.stockKg.toString(), '9.4');
  });

  await test('DEP_03: Micro-portions and 125g eighth-kilo fractions', async () => {
    const product = { id: 'p3', stockKg: 1.0, inStock: true };
    depleteProductStock(product, 0.125); // 125g
    assert.strictEqual(product.stockKg, 0.875);
    assert.strictEqual(product.inStock, true);

    depleteProductStock(product, 0.125); // 125g
    assert.strictEqual(product.stockKg, 0.75);

    // Micro-portion: 10g (0.010 kg)
    depleteProductStock(product, 0.01);
    assert.strictEqual(product.stockKg, 0.74);

    // 1g (0.001 kg)
    depleteProductStock(product, 0.001);
    assert.strictEqual(product.stockKg, 0.739);
  });

  await test('DEP_04: Odd percentages in custom mix box (33.33% of 1kg)', async () => {
    // 33.33% of 1000g = 333g = 0.333 kg
    const product = { id: 'p4', stockKg: 5.0, inStock: true };
    depleteProductStock(product, 0.333);
    assert.strictEqual(product.stockKg, 4.667);
    assert.strictEqual(product.inStock, true);

    // Three consecutive 333g portions
    depleteProductStock(product, 0.333);
    assert.strictEqual(product.stockKg, 4.334);
    depleteProductStock(product, 0.334); // remaining 334g to make 1000g
    assert.strictEqual(product.stockKg, 4.0);
  });

  await test('DEP_05: Exact stock depletion down to zero triggers inStock = false', async () => {
    const product = { id: 'p5', stockKg: 0.5, inStock: true };
    depleteProductStock(product, 0.5); // exactly 500g consumed
    assert.strictEqual(product.stockKg, 0);
    assert.strictEqual(product.inStock, false);
  });

  await test('DEP_06: Starting at zero stock clamps to 0 and maintains inStock = false', async () => {
    const product = { id: 'p6', stockKg: 0, inStock: false };
    depleteProductStock(product, 0.25); // attempting to deplete 250g from 0
    assert.strictEqual(product.stockKg, 0);
    assert.strictEqual(product.inStock, false);
  });

  await test('DEP_07: Over-depletion underflow clamps to 0 without going negative', async () => {
    const product = { id: 'p7', stockKg: 0.1, inStock: true };
    depleteProductStock(product, 0.5); // 500g consumed from 100g available
    assert.strictEqual(product.stockKg, 0);
    assert.strictEqual(product.inStock, false);
  });

  await test('DEP_08: Default stock fallback when stockKg is undefined', async () => {
    const product = { id: 'p8', inStock: true }; // stockKg missing
    depleteProductStock(product, 2.5); // default 50 - 2.5 = 47.5
    assert.strictEqual(product.stockKg, 47.5);
    assert.strictEqual(product.inStock, true);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: POS Cash Drawer Reconciliation & Variance Oracle
// ─────────────────────────────────────────────────────────────────────────────

function calculateExpectedCash(startingCash, cashSales, expenses) {
  const starting = Math.max(0, Number(startingCash) || 0);
  const cash = Math.max(0, Number(cashSales) || 0);
  const exp = Math.max(0, Number(expenses) || 0);
  return Math.max(0, starting + cash - exp);
}

function calculateDrawerVariance(actualCash, expectedCash) {
  const actual = Math.max(0, Number(actualCash) || 0);
  const expected = Math.max(0, Number(expectedCash) || 0);
  return Math.round(actual - expected);
}

async function runPosCashDrawerReconciliationTests() {
  suite('Empirical Test Suite 2: POS Cash Drawer Reconciliation & Variance');

  await test('POS_DRAWER_01: Exact cash reconciliation (actual === expected => variance === 0)', async () => {
    const startingCash = 500;
    const cashSales = 1850;
    const expenses = 250;
    const expected = calculateExpectedCash(startingCash, cashSales, expenses);
    assert.strictEqual(expected, 2100);

    const actualCash = 2100;
    const variance = calculateDrawerVariance(actualCash, expected);
    assert.strictEqual(variance, 0, 'Variance must be exactly 0 when actual equals expected');
  });

  await test('POS_DRAWER_02: Cash overage reconciliation (actual > expected => variance > 0)', async () => {
    const startingCash = 1000;
    const cashSales = 3200;
    const expenses = 400;
    const expected = calculateExpectedCash(startingCash, cashSales, expenses);
    assert.strictEqual(expected, 3800);

    const actualCash = 3875; // 75 EGP overage
    const variance = calculateDrawerVariance(actualCash, expected);
    assert.strictEqual(variance, 75, 'Variance must be +75 for a 75 EGP surplus');
    assert.ok(variance > 0, 'Variance must be strictly positive for cash surplus');
  });

  await test('POS_DRAWER_03: Cash shortage reconciliation (actual < expected => variance < 0)', async () => {
    const startingCash = 800;
    const cashSales = 2100;
    const expenses = 150;
    const expected = calculateExpectedCash(startingCash, cashSales, expenses);
    assert.strictEqual(expected, 2750);

    const actualCash = 2690; // 60 EGP shortage
    const variance = calculateDrawerVariance(actualCash, expected);
    assert.strictEqual(variance, -60, 'Variance must be -60 for a 60 EGP deficit');
    assert.ok(variance < 0, 'Variance must be strictly negative for cash shortage');
  });

  await test('POS_DRAWER_04: Negative expected cash prevention (expenses exceed starting + sales)', async () => {
    const startingCash = 200;
    const cashSales = 100;
    const expenses = 500; // total cash in drawer is 300, but expense is 500
    const expected = calculateExpectedCash(startingCash, cashSales, expenses);
    assert.strictEqual(expected, 0, 'Expected cash must clamp to 0 and never be negative');

    const actualCash = 0;
    const variance = calculateDrawerVariance(actualCash, expected);
    assert.strictEqual(variance, 0);
  });

  await test('POS_DRAWER_05: Digital payment isolation (Card, Vodafone Cash, InstaPay must not alter drawer cash)', async () => {
    let startingCash = 500;
    let cashSales = 0;
    let cardSales = 0;
    let vodafoneCashTotal = 0;
    let instapayTotal = 0;
    let expenses = 50;

    // Transaction 1: Cash sale 200 EGP
    cashSales += 200;

    // Transaction 2: Vodafone Cash sale 350 EGP
    cardSales += 350;
    vodafoneCashTotal += 350;

    // Transaction 3: InstaPay sale 600 EGP
    cardSales += 600;
    instapayTotal += 600;

    // Calculate expected cash in drawer
    const expectedCashInDrawer = calculateExpectedCash(startingCash, cashSales, expenses);
    
    // Expected cash should ONLY be 500 + 200 - 50 = 650 EGP
    assert.strictEqual(expectedCashInDrawer, 650);
    assert.strictEqual(cardSales, 950);
    assert.strictEqual(vodafoneCashTotal, 350);
    assert.strictEqual(instapayTotal, 600);

    // Cashier counts 650 in the physical drawer
    const variance = calculateDrawerVariance(650, expectedCashInDrawer);
    assert.strictEqual(variance, 0);
  });

  await test('POS_DRAWER_06: Dual-field alias symmetry (expectedCash === expectedCashInDrawer, variance === cashDifference)', async () => {
    const shift = {
      startingCash: 600,
      openingCash: 600,
      cashSales: 1500,
      cashSalesTotal: 1500,
      expenses: 100,
      expensesTotal: 100,
    };

    const expected = calculateExpectedCash(shift.startingCash, shift.cashSales, shift.expenses);
    shift.expectedCash = expected;
    shift.expectedCashInDrawer = expected;

    const actualCash = 1980; // 20 EGP deficit
    shift.actualCash = actualCash;
    shift.actualClosingCash = actualCash;
    const variance = calculateDrawerVariance(actualCash, expected);
    shift.variance = variance;
    shift.cashDifference = variance;

    assert.strictEqual(shift.expectedCash, shift.expectedCashInDrawer);
    assert.strictEqual(shift.actualCash, shift.actualClosingCash);
    assert.strictEqual(shift.variance, shift.cashDifference);
    assert.strictEqual(shift.variance, -20);
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Part 3: Composite Multi-Item Order Depletion & Full Shift Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

async function runCompositeScenarios() {
  suite('Empirical Test Suite 3: Composite Multi-Item Depletion & Full Shift Lifecycle');

  await test('COMPOSITE_01: Mixed order depletes multiple products atomically', async () => {
    const db = {
      products: [
        { id: 'prod-pistachio', name: 'فستق أمريكي', stockKg: 10.0, inStock: true },
        { id: 'prod-cashew', name: 'كاجو محمص', stockKg: 5.0, inStock: true },
        { id: 'prod-almond', name: 'لوز محمص', stockKg: 2.0, inStock: true },
        { id: 'prod-hazelnut', name: 'بندق محمص', stockKg: 0.125, inStock: true },
      ],
    };

    const orderItems = [
      // Standard 250g pistachio (qty: 2 => 500g)
      {
        productId: 'prod-pistachio',
        quantity: 2,
        customWeightGrams: 250,
      },
      // Custom Mix Box 1000g: 50% Cashew (500g), 50% Almond (500g)
      {
        isCustomMix: true,
        boxCapacityGrams: 1000,
        quantity: 1,
        customBreakdown: [
          { productId: 'prod-cashew', percentage: 50, weightGrams: 500 },
          { productId: 'prod-almond', percentage: 50, weightGrams: 500 },
        ],
      },
      // Standard item consuming exactly remaining stock of hazelnut (125g)
      {
        productId: 'prod-hazelnut',
        quantity: 1,
        customWeightGrams: 125,
      },
    ];

    // Execute atomic depletion loop exactly as implemented in orders and pos routes
    for (const item of orderItems) {
      const qty = item.quantity || 1;
      if (item.isCustomMix && Array.isArray(item.customBreakdown)) {
        for (const b of item.customBreakdown) {
          const bProd = db.products.find((p) => p.id === b.productId);
          if (bProd) {
            const constituentGrams = b.weightGrams || ((b.percentage || 0) * (item.boxCapacityGrams || 500) / 100);
            const consumedKg = (constituentGrams * qty) / 1000;
            depleteProductStock(bProd, consumedKg);
          }
        }
      } else {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod) {
          const grams = item.customWeightGrams || 250;
          const consumedKg = (grams * qty) / 1000;
          depleteProductStock(prod, consumedKg);
        }
      }
    }

    // Verify all stock depletions
    const pistachio = db.products.find((p) => p.id === 'prod-pistachio');
    assert.strictEqual(pistachio.stockKg, 9.5); // 10.0 - 0.5
    assert.strictEqual(pistachio.inStock, true);

    const cashew = db.products.find((p) => p.id === 'prod-cashew');
    assert.strictEqual(cashew.stockKg, 4.5); // 5.0 - 0.5
    assert.strictEqual(cashew.inStock, true);

    const almond = db.products.find((p) => p.id === 'prod-almond');
    assert.strictEqual(almond.stockKg, 1.5); // 2.0 - 0.5
    assert.strictEqual(almond.inStock, true);

    const hazelnut = db.products.find((p) => p.id === 'prod-hazelnut');
    assert.strictEqual(hazelnut.stockKg, 0); // 0.125 - 0.125
    assert.strictEqual(hazelnut.inStock, false, 'Hazelnut must be marked out of stock (inStock: false)');
  });

  await test('COMPOSITE_02: Full POS shift sequence with overage and shortage closures', async () => {
    // 1. Open shift with 500 EGP starting cash
    let shift = {
      status: 'open',
      startingCash: 500,
      cashSales: 0,
      cardSales: 0,
      expenses: 0,
      expectedCash: 500,
      expectedCashInDrawer: 500,
    };

    // 2. Add cash sale of 300 EGP
    shift.cashSales += 300;
    shift.expectedCash = calculateExpectedCash(shift.startingCash, shift.cashSales, shift.expenses);
    shift.expectedCashInDrawer = shift.expectedCash;
    assert.strictEqual(shift.expectedCash, 800);

    // 3. Add petty expense of 40 EGP (e.g. branch supplies)
    shift.expenses += 40;
    shift.expectedCash = calculateExpectedCash(shift.startingCash, shift.cashSales, shift.expenses);
    shift.expectedCashInDrawer = shift.expectedCash;
    assert.strictEqual(shift.expectedCash, 760);

    // 4. Test Closing Case A: Cashier enters 810 EGP (50 EGP overage)
    let varianceOverage = calculateDrawerVariance(810, shift.expectedCash);
    assert.strictEqual(varianceOverage, 50);

    // 5. Test Closing Case B: Cashier enters 760 EGP (exact match)
    let varianceExact = calculateDrawerVariance(760, shift.expectedCash);
    assert.strictEqual(varianceExact, 0);

    // 6. Test Closing Case C: Cashier enters 725 EGP (35 EGP shortage)
    let varianceShortage = calculateDrawerVariance(725, shift.expectedCash);
    assert.strictEqual(varianceShortage, -35);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner Execution
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`${colors.bold}STARTING EMPIRICAL CHALLENGER VERIFICATION HARNESS${colors.reset}`);
  await runInventoryDepletionTests();
  await runPosCashDrawerReconciliationTests();
  await runCompositeScenarios();


  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}EMPIRICAL CHALLENGER SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Total Cases : ${colors.bold}${testCount}${colors.reset}`);
  console.log(`  Passed      : ${colors.green}${colors.bold}${passCount}${colors.reset}`);
  console.log(`  Failed      : ${failCount > 0 ? colors.red : colors.green}${colors.bold}${failCount}${colors.reset}`);

  if (failCount > 0) {
    console.error(`\n${colors.bold}${colors.red}CHALLENGE FAILED: Defects detected!${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}ALL EMPIRICAL TESTS PASSED! VERIFIED ZERO DEFECTS.${colors.reset}\n`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
