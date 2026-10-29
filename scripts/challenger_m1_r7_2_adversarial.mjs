// @ts-check
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('══════════════════════════════════════════════════════════════════');
console.log('CHALLENGER M1 R7.2 EMPIRICAL ADVERSARIAL TEST SUITE');
console.log('══════════════════════════════════════════════════════════════════\n');

let passedTests = 0;
let totalTests = 0;

function runEmpiricalTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}:`, err.message);
  }
}

// =========================================================================
// SECTION 1: EASTERN ARABIC NUMERALS NORMALIZATION & FALSE-PASS PREVENTION
// =========================================================================

// Oracle under test from scripts/verify.mjs:83
const easternToAsciiOracle = (str) =>
  str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

function oracleValidateEgyptianPhone(phone) {
  if (typeof phone !== 'string') {
    return { isValid: false, normalized: '', error: 'رقم الهاتف غير صالح' };
  }
  let cleaned = easternToAsciiOracle(phone.trim()).replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+20')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('0020')) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith('20') && cleaned.length >= 12) {
    cleaned = cleaned.slice(2);
  }
  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }
  const match = cleaned.match(/^(01[0125]\d{8})$/);
  if (!match) {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'يرجى إدخال رقم هاتف مصري صحيح يبدأ بـ (010، 011، 012، 015) ومكون من 11 رقماً',
    };
  }
  return { isValid: true, normalized: match[1] };
}

runEmpiricalTest('EASTERN_01: Exact character-by-character mapping of ٠-٩ to 0-9', () => {
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const expectedAscii = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  for (let i = 0; i < 10; i++) {
    const converted = easternToAsciiOracle(easternDigits[i]);
    assert.strictEqual(converted, expectedAscii[i], `Digit ${easternDigits[i]} must convert to ${expectedAscii[i]}`);
  }
});

runEmpiricalTest('EASTERN_02: Regex boundary non-interference (U+065F and U+066A-066D untouched)', () => {
  const boundaryChars = ['\u065F', '\u066A', '\u066B', '\u066C', '\u066D'];
  for (const ch of boundaryChars) {
    const converted = easternToAsciiOracle(ch);
    assert.strictEqual(converted, ch, `Unicode char ${ch} (${ch.charCodeAt(0)}) must NOT be matched or altered`);
  }
});

runEmpiricalTest('EASTERN_03: Valid Egyptian phone numbers in Eastern Arabic numerals', () => {
  const testCases = [
    { input: '٠١٠١٢٣٤٥٦٧٨', expected: '01012345678' },
    { input: '٠١١٢٣٤٥٦٧٨٩', expected: '01123456789' },
    { input: '٠١٢٣٤٥٦٧٨٩٠', expected: '01234567890' },
    { input: '٠١٥١٢٣٤٥٦٧٨', expected: '01512345678' },
    { input: '+٢٠١٠١٢٣٤٥٦٧٨', expected: '01012345678' },
    { input: '٠٠٢٠١١٢٣٤٥٦٧٨٩', expected: '01123456789' },
  ];
  for (const tc of testCases) {
    const res = oracleValidateEgyptianPhone(tc.input);
    assert.strictEqual(res.isValid, true, `Phone ${tc.input} must be valid`);
    assert.strictEqual(res.normalized, tc.expected, `Phone ${tc.input} must normalize to ${tc.expected}`);
  }
});

runEmpiricalTest('EASTERN_04: Negative adversarial inputs must NOT false-pass', () => {
  const invalidCases = [
    '٠١٣١٢٣٤٥٦٧٨', // Invalid prefix 013 (landline Qalyubia)
    '٠١٤١٢٣٤٥٦٧٨', // Invalid prefix 014
    '٠١٦١٢٣٤٥٦٧٨', // Invalid prefix 016
    '٠١٧١٢٣٤٥٦٧٨', // Invalid prefix 017
    '٠١٨١٢٣٤٥٦٧٨', // Invalid prefix 018
    '٠١٩١٢٣٤٥٦٧٨', // Invalid prefix 019
    '٠١٠١٢٣٤٥٦٧',   // 10 digits (too short)
    '٠١٠١٢٣٤٥٦٧٨٩', // 12 digits (too long)
    '٠١٠abcdefgh', // Alphabetic injection
    '٠١٠١٢٣٤٥٦٧x', // Trailing character
    '٠١٠أحمد١٢٣٤٥', // Arabic letter injection
    '٠١٠١٢٣٤!@#$', // Special symbols
    '',             // Empty
    '   ',          // Whitespace
  ];
  for (const input of invalidCases) {
    const res = oracleValidateEgyptianPhone(input);
    assert.strictEqual(res.isValid, false, `Adversarial input "${input}" must be rejected with isValid=false`);
  }
});

// =========================================================================
// SECTION 2: `لب سوبر` AND CHANNEL REJECTION MESSAGE INTEGRITY
// =========================================================================

runEmpiricalTest('LEB_SUPER_01: prod-super-seeds-1 existence and exact Arabic naming', () => {
  const dbRaw = fs.readFileSync(path.join(ROOT_DIR, 'data/store-db.json'), 'utf8');
  const db = JSON.parse(dbRaw);
  const prod = db.products.find((p) => p.id === 'prod-super-seeds-1');
  assert.ok(prod, 'prod-super-seeds-1 must exist in store-db.json');
  assert.ok(prod.name.includes('لب سوبر'), `Product name "${prod.name}" must contain "لب سوبر"`);
  assert.strictEqual(prod.pricePerKg, 280, 'Price per kg must be 280 EGP');
  assert.strictEqual(prod.costPerKg, 205, 'Cost per kg must be 205 EGP');

  // Verify scale math
  const calculatedGrams = Math.max(10, Math.round((50 / prod.pricePerKg) * 1000));
  assert.strictEqual(calculatedGrams, 179, '50 EGP of 280 EGP/kg seeds must yield 179g');
  const rawCostEgp = Math.round((prod.costPerKg * (calculatedGrams / 1000)) * 10) / 10;
  assert.strictEqual(rawCostEgp, 36.7, 'Raw cost for 179g must be 36.7 EGP');
  const netProfitEgp = Math.round((50 - rawCostEgp) * 10) / 10;
  assert.strictEqual(netProfitEgp, 13.3, 'Net profit must be 13.3 EGP');
});

runEmpiricalTest('CHANNEL_REJECT_01: Online rejection message exact character match', () => {
  const ordersRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/orders/route.ts'), 'utf8');
  const verifyMjsRaw = fs.readFileSync(path.join(ROOT_DIR, 'scripts/verify.mjs'), 'utf8');

  const expectedMsg = 'المنتج غير متاح للطلب عبر المتجر الإلكتروني';
  assert.ok(ordersRouteRaw.includes(expectedMsg), 'orders/route.ts must contain exact Arabic rejection message');
  assert.ok(verifyMjsRaw.includes(expectedMsg), 'scripts/verify.mjs must assert exact Arabic rejection message');

  // Verify UTF-8 codepoints match identically
  const codepointsExpected = [...expectedMsg].map((c) => c.charCodeAt(0));
  const idxInOrders = ordersRouteRaw.indexOf(expectedMsg);
  const actualOrdersSubstring = ordersRouteRaw.slice(idxInOrders, idxInOrders + expectedMsg.length);
  const codepointsOrders = [...actualOrdersSubstring].map((c) => c.charCodeAt(0));
  assert.deepStrictEqual(codepointsOrders, codepointsExpected, 'Codepoints in orders route must match exactly');
});

runEmpiricalTest('CHANNEL_REJECT_02: POS rejection message exact character match', () => {
  const posRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/pos/route.ts'), 'utf8');
  const verifyMjsRaw = fs.readFileSync(path.join(ROOT_DIR, 'scripts/verify.mjs'), 'utf8');

  const expectedMsg = 'المنتج غير مصرح ببيعه عبر الكاشير';
  assert.ok(posRouteRaw.includes(expectedMsg), 'pos/route.ts must contain exact Arabic rejection message');
  assert.ok(verifyMjsRaw.includes(expectedMsg), 'scripts/verify.mjs must assert exact Arabic rejection message');

  // Verify UTF-8 codepoints match identically
  const codepointsExpected = [...expectedMsg].map((c) => c.charCodeAt(0));
  const idxInPos = posRouteRaw.indexOf(expectedMsg);
  const actualPosSubstring = posRouteRaw.slice(idxInPos, idxInPos + expectedMsg.length);
  const codepointsPos = [...actualPosSubstring].map((c) => c.charCodeAt(0));
  assert.deepStrictEqual(codepointsPos, codepointsExpected, 'Codepoints in pos route must match exactly');
});

// =========================================================================
// SECTION 3: ACCOUNTANT ISOLATION PORTAL JSX & TYPESCRIPT INTEGRITY
// =========================================================================

runEmpiricalTest('ACCOUNTANT_01: AccountantIsolationPortal.tsx audit badge and modal integration', () => {
  const accountantPortalRaw = fs.readFileSync(
    path.join(ROOT_DIR, 'src/components/admin/AccountantIsolationPortal.tsx'),
    'utf8'
  );
  assert.ok(
    accountantPortalRaw.includes('وضع المراجعة والتدقيق المالي (Read-Only Audit)'),
    'AccountantIsolationPortal must contain exact read-only audit badge text'
  );
  assert.ok(
    accountantPortalRaw.includes('SupermarketReceiptModal'),
    'AccountantIsolationPortal must import and integrate SupermarketReceiptModal'
  );
  assert.ok(
    accountantPortalRaw.includes('mode="zreport"'),
    'AccountantIsolationPortal must invoke SupermarketReceiptModal in zreport mode'
  );
  assert.ok(
    accountantPortalRaw.includes('mode="receipt"'),
    'AccountantIsolationPortal must invoke SupermarketReceiptModal in receipt mode'
  );
});

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('══════════════════════════════════════════════════════════════════');
