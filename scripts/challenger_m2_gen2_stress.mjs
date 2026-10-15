/**
 * Challenger M2 Generation 2: Comprehensive Adversarial Stress Test Suite
 * 
 * Verifies Worker M2 Gen 2's remediation across:
 * 1. Backdoor Rejection Across All Layers (verifyAdminToken, verifyAdminRequest, PUT /api/store, PATCH /api/orders)
 * 2. Cryptographic Token Verification (HMAC-SHA256, Password rotation, Timing-safe comparison)
 * 3. CSV Injection Neutralization (CWE-1236, Number preservation, Arabic preservation, BOM offset 0)
 * 4. Active Session Verification & Cookie Security (GET /api/admin/login, POST /api/admin/logout)
 * 
 * Execution:
 *   npx tsx scripts/challenger_m2_gen2_stress.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

// System Under Test Modules
import {
  generateAdminToken,
  verifyAdminToken,
  extractAdminToken,
  verifyAdminRequest,
  sanitizePublicStoreData,
} from '../src/lib/auth.ts';
import {
  escapeCsvField,
  generateOrdersCsv,
  CSV_ORDER_HEADERS,
} from '../src/lib/csv.ts';
import { GET as getStore, PUT as putStore } from '../src/app/api/store/route.ts';
import { GET as getOrders, PATCH as patchOrders } from '../src/app/api/orders/route.ts';
import { GET as getAdminLogin, POST as postAdminLogin } from '../src/app/api/admin/login/route.ts';
import { POST as postAdminLogout } from '../src/app/api/admin/logout/route.ts';
import { getDb, saveDb } from '../src/lib/db.ts';

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

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function check(desc, condition, extraInfo = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${desc}`);
  } else {
    failedChecks++;
    failures.push({ desc, extraInfo });
    console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${desc} ${extraInfo}`);
  }
}

function suite(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
}

async function runChallengerM2Gen2Suite() {
  console.log(`\n${colors.bold}${colors.yellow}==================================================================`);
  console.log(`  CHALLENGER M2 GEN 2: ADVERSARIAL STRESS TEST HARNESS`);
  console.log(`  Target: Milestone 2 Remediation & Security Hardening Verification`);
  console.log(`==================================================================${colors.reset}`);

  // Snapshot database for pristine restoration
  let originalDbRaw = '';
  if (fs.existsSync(DB_PATH)) {
    originalDbRaw = fs.readFileSync(DB_PATH, 'utf8');
  }

  try {
    const db = getDb();
    const currentAdminPassword = db.settings?.adminPassword || 'admin';

    // ═════════════════════════════════════════════════════════════════════════
    // DIMENSION 1: Backdoor Rejection Stress Test
    // ═════════════════════════════════════════════════════════════════════════
    suite('Dimension 1: Backdoor Rejection Stress Test');

    const formerBackdoorStrings = [
      'admin-auth-session-valid-token',
      'session-token-admin-verified',
      ' admin-auth-session-valid-token ',
      ' session-token-admin-verified ',
      'ADMIN-AUTH-SESSION-VALID-TOKEN',
      'SESSION-TOKEN-ADMIN-VERIFIED',
      'admin-auth-session-valid-token-extended',
      'pre-session-token-admin-verified',
    ];

    // 1.1 Direct verifyAdminToken rejection
    console.log('\n--- 1.1: Direct verifyAdminToken Backdoor String Rejection ---');
    for (const bStr of formerBackdoorStrings) {
      const isVerified = verifyAdminToken(bStr);
      check(`verifyAdminToken rejects former backdoor string: "${bStr}"`, isVerified === false, `Result: ${isVerified}`);
    }

    // 1.2 Encoded backdoor strings (e.g. Base64URL-encoded former backdoor string or JSON with backdoor as sig)
    console.log('\n--- 1.2: Encoded & Structured Backdoor Variations Rejection ---');
    const base64Backdoor1 = Buffer.from('admin-auth-session-valid-token').toString('base64url');
    const base64Backdoor2 = Buffer.from('session-token-admin-verified').toString('base64url');
    const jsonWithBackdoorSig = Buffer.from(JSON.stringify({ expiresAt: Date.now() + 100000, sig: 'admin-auth-session-valid-token' })).toString('base64url');
    const jsonWithBackdoorSig2 = Buffer.from(JSON.stringify({ expiresAt: Date.now() + 100000, sig: 'session-token-admin-verified' })).toString('base64url');

    check('verifyAdminToken rejects Base64URL-encoded former backdoor string 1', verifyAdminToken(base64Backdoor1) === false);
    check('verifyAdminToken rejects Base64URL-encoded former backdoor string 2', verifyAdminToken(base64Backdoor2) === false);
    check('verifyAdminToken rejects token with backdoor string as signature', verifyAdminToken(jsonWithBackdoorSig) === false);
    check('verifyAdminToken rejects token with backdoor string 2 as signature', verifyAdminToken(jsonWithBackdoorSig2) === false);

    // 1.3 verifyAdminRequest Rejection Across All Header Formats
    console.log('\n--- 1.3: verifyAdminRequest Backdoor Rejection (Bearer, x-admin-token, Cookie) ---');
    for (const bStr of ['admin-auth-session-valid-token', 'session-token-admin-verified']) {
      // 1.3a Authorization: Bearer <bStr>
      const bearerReq = new Request('http://localhost:3000/api/store', {
        headers: { Authorization: `Bearer ${bStr}` },
      });
      const bearerRes = verifyAdminRequest(bearerReq);
      check(`verifyAdminRequest rejects Authorization: Bearer "${bStr}"`, bearerRes.isAuthenticated === false);
      check(`verifyAdminRequest returns 401 error message for Bearer "${bStr}"`, bearerRes.error === 'غير مصرح لك بالوصول (401 Unauthorized)');

      // 1.3b Authorization: <bStr> (raw)
      const rawAuthReq = new Request('http://localhost:3000/api/store', {
        headers: { Authorization: bStr },
      });
      const rawAuthRes = verifyAdminRequest(rawAuthReq);
      check(`verifyAdminRequest rejects raw Authorization: "${bStr}"`, rawAuthRes.isAuthenticated === false);

      // 1.3c x-admin-token: <bStr>
      const xTokenReq = new Request('http://localhost:3000/api/store', {
        headers: { 'x-admin-token': bStr },
      });
      const xTokenRes = verifyAdminRequest(xTokenReq);
      check(`verifyAdminRequest rejects x-admin-token: "${bStr}"`, xTokenRes.isAuthenticated === false);

      // 1.3d Cookie: admin_session=<bStr>
      const cookieReq = new Request('http://localhost:3000/api/store', {
        headers: { Cookie: `admin_session=${bStr}` },
      });
      const cookieRes = verifyAdminRequest(cookieReq);
      check(`verifyAdminRequest rejects Cookie: admin_session="${bStr}"`, cookieRes.isAuthenticated === false);
    }

    // 1.4 API Endpoints (PUT /api/store and PATCH /api/orders) Backdoor Rejection
    console.log('\n--- 1.4: API Route Handlers (PUT /api/store & PATCH /api/orders) Rejection ---');
    for (const bStr of ['admin-auth-session-valid-token', 'session-token-admin-verified']) {
      // PUT /api/store with Bearer backdoor
      const putReqBearer = new NextRequest('http://localhost:3000/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bStr}` },
        body: JSON.stringify({ settings: { storeName: 'Backdoor Attack' } }),
      });
      const putResBearer = await putStore(putReqBearer);
      const putBodyBearer = await putResBearer.json();
      check(`PUT /api/store with Bearer "${bStr}" returns HTTP 401`, putResBearer.status === 401);
      check(`PUT /api/store with Bearer "${bStr}" returns 401 error message`, putBodyBearer.error === 'غير مصرح لك بالوصول (401 Unauthorized)');

      // PUT /api/store with x-admin-token backdoor
      const putReqX = new NextRequest('http://localhost:3000/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': bStr },
        body: JSON.stringify({ settings: { storeName: 'Backdoor Attack' } }),
      });
      const putResX = await putStore(putReqX);
      check(`PUT /api/store with x-admin-token "${bStr}" returns HTTP 401`, putResX.status === 401);

      // PUT /api/store with Cookie backdoor
      const putReqCookie = new NextRequest('http://localhost:3000/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${bStr}` },
        body: JSON.stringify({ settings: { storeName: 'Backdoor Attack' } }),
      });
      const putResCookie = await putStore(putReqCookie);
      check(`PUT /api/store with Cookie admin_session="${bStr}" returns HTTP 401`, putResCookie.status === 401);

      // PATCH /api/orders with Bearer backdoor
      const patchReqBearer = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bStr}` },
        body: JSON.stringify({ orderId: 'ord-1', status: 'delivered' }),
      });
      const patchResBearer = await patchOrders(patchReqBearer);
      const patchBodyBearer = await patchResBearer.json();
      check(`PATCH /api/orders with Bearer "${bStr}" returns HTTP 401`, patchResBearer.status === 401);
      check(`PATCH /api/orders with Bearer "${bStr}" returns 401 error message`, patchBodyBearer.error === 'غير مصرح لك بالوصول (401 Unauthorized)');

      // PATCH /api/orders with x-admin-token backdoor
      const patchReqX = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': bStr },
        body: JSON.stringify({ orderId: 'ord-1', status: 'delivered' }),
      });
      const patchResX = await patchOrders(patchReqX);
      check(`PATCH /api/orders with x-admin-token "${bStr}" returns HTTP 401`, patchResX.status === 401);

      // PATCH /api/orders with Cookie backdoor
      const patchReqCookie = new NextRequest('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${bStr}` },
        body: JSON.stringify({ orderId: 'ord-1', status: 'delivered' }),
      });
      const patchResCookie = await patchOrders(patchReqCookie);
      check(`PATCH /api/orders with Cookie admin_session="${bStr}" returns HTTP 401`, patchResCookie.status === 401);
    }

    // 1.5 Tampered Signatures, Expired Tokens, Forged Payloads, Empty & Null
    console.log('\n--- 1.5: Adversarial Token Mutations (Tampered, Expired, Malformed, Null) ---');
    const validSession = generateAdminToken(currentAdminPassword);
    const validDecoded = JSON.parse(Buffer.from(validSession.token, 'base64url').toString('utf-8'));

    // 1.5a Tamper signature last char
    const tamperedLastCharSig = { ...validDecoded, sig: validDecoded.sig.slice(0, -1) + (validDecoded.sig.endsWith('0') ? '1' : '0') };
    const tamperedLastCharToken = Buffer.from(JSON.stringify(tamperedLastCharSig)).toString('base64url');
    check('verifyAdminToken rejects token with tampered last character of signature', verifyAdminToken(tamperedLastCharToken) === false);

    // 1.5b Tamper signature first char
    const tamperedFirstCharSig = { ...validDecoded, sig: (validDecoded.sig.startsWith('a') ? 'b' : 'a') + validDecoded.sig.slice(1) };
    const tamperedFirstCharToken = Buffer.from(JSON.stringify(tamperedFirstCharSig)).toString('base64url');
    check('verifyAdminToken rejects token with tampered first character of signature', verifyAdminToken(tamperedFirstCharToken) === false);

    // 1.5c Truncated signature (length mismatch)
    const truncatedSig = { ...validDecoded, sig: validDecoded.sig.slice(0, 32) };
    const truncatedToken = Buffer.from(JSON.stringify(truncatedSig)).toString('base64url');
    check('verifyAdminToken rejects token with truncated signature (32 hex chars)', verifyAdminToken(truncatedToken) === false);

    // 1.5d Extended signature (length mismatch)
    const extendedSig = { ...validDecoded, sig: validDecoded.sig + 'abcd' };
    const extendedToken = Buffer.from(JSON.stringify(extendedSig)).toString('base64url');
    check('verifyAdminToken rejects token with extended signature (68 hex chars)', verifyAdminToken(extendedToken) === false);

    // 1.5e Expired token (expiresAt 1000ms ago)
    const expiredPayload = { expiresAt: Date.now() - 1000, sig: validDecoded.sig };
    const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    check('verifyAdminToken rejects expired token (1s ago)', verifyAdminToken(expiredToken) === false);

    // 1.5f Expired token with re-calculated signature for past timestamp
    const pastTimestamp = Date.now() - 86400000; // 24 hours ago
    const pastPayload = `${pastTimestamp}:${currentAdminPassword}:golden-oasis-admin-secret-salt-v1`;
    const pastSig = crypto.createHmac('sha256', 'golden-oasis-admin-secret-salt-v1').update(pastPayload).digest('hex');
    const validPastExpiredToken = Buffer.from(JSON.stringify({ expiresAt: pastTimestamp, sig: pastSig })).toString('base64url');
    check('verifyAdminToken rejects token with valid HMAC signature but expired timestamp', verifyAdminToken(validPastExpiredToken) === false);

    // 1.5g Forged payload with future timestamp signed with incorrect secret salt
    const futureTimestamp = Date.now() + 86400000;
    const forgedSaltSig = crypto.createHmac('sha256', 'wrong-secret-salt').update(`${futureTimestamp}:${currentAdminPassword}:wrong-secret-salt`).digest('hex');
    const forgedSaltToken = Buffer.from(JSON.stringify({ expiresAt: futureTimestamp, sig: forgedSaltSig })).toString('base64url');
    check('verifyAdminToken rejects token signed with forged secret salt', verifyAdminToken(forgedSaltToken) === false);

    // 1.5h Malformed JSON types in payload
    const nonNumberExpiresAt = Buffer.from(JSON.stringify({ expiresAt: '2026-12-31', sig: validDecoded.sig })).toString('base64url');
    check('verifyAdminToken rejects non-number expiresAt', verifyAdminToken(nonNumberExpiresAt) === false);

    const nonStringSig = Buffer.from(JSON.stringify({ expiresAt: futureTimestamp, sig: 123456789 })).toString('base64url');
    check('verifyAdminToken rejects non-string sig', verifyAdminToken(nonStringSig) === false);

    const emptyObjectToken = Buffer.from(JSON.stringify({})).toString('base64url');
    check('verifyAdminToken rejects empty JSON object token', verifyAdminToken(emptyObjectToken) === false);

    const arrayToken = Buffer.from(JSON.stringify(['expiresAt', 12345])).toString('base64url');
    check('verifyAdminToken rejects JSON array token', verifyAdminToken(arrayToken) === false);

    // 1.5i Null, undefined, empty string, garbage strings
    check('verifyAdminToken rejects empty string ""', verifyAdminToken('') === false);
    check('verifyAdminToken rejects whitespace "   "', verifyAdminToken('   ') === false);
    check('verifyAdminToken rejects null', verifyAdminToken(null) === false);
    check('verifyAdminToken rejects undefined', verifyAdminToken(undefined) === false);
    check('verifyAdminToken rejects numeric input 12345', verifyAdminToken(12345) === false);
    check('verifyAdminToken rejects non-base64url garbage "!@#$%^&*"', verifyAdminToken('!@#$%^&*') === false);


    // ═════════════════════════════════════════════════════════════════════════
    // DIMENSION 2: Cryptographic Token Verification
    // ═════════════════════════════════════════════════════════════════════════
    suite('Dimension 2: Cryptographic Token Verification');

    // 2.1 Valid HMAC-SHA256 tokens generated with correct password vs incorrect password
    console.log('\n--- 2.1: Password Correctness & Rotation Verification ---');
    const correctSession = generateAdminToken(currentAdminPassword);
    check('Token generated with correct password verifies true', verifyAdminToken(correctSession.token, currentAdminPassword) === true);

    const wrongPasswordToken = generateAdminToken('completely_wrong_pass_123');
    check('Token generated with incorrect password fails verification against current password', verifyAdminToken(wrongPasswordToken.token, currentAdminPassword) === false);

    // 2.2 Password Rotation Test: Token invalidated when password rotates
    console.log('\n--- 2.2: Dynamic Password Rotation Invalidation ---');
    const originalPassword = db.settings.adminPassword;
    try {
      db.settings.adminPassword = 'new-super-secure-pass-2026';
      saveDb(db);

      // Token generated under old password must now FAIL
      check('Old token fails verification after admin password is changed in DB', verifyAdminToken(correctSession.token) === false);

      // Token generated under new password must SUCCEED
      const newSession = generateAdminToken('new-super-secure-pass-2026');
      check('New token succeeds verification after password change in DB', verifyAdminToken(newSession.token) === true);
    } finally {
      db.settings.adminPassword = originalPassword;
      saveDb(db);
      check('DB password restored to original state', getDb().settings.adminPassword === originalPassword);
    }

    // 2.3 Timing-Safe Comparison Integrity
    console.log('\n--- 2.3: Timing-Safe Comparison Integrity ---');
    // Ensure that timingSafeEqual does not throw error on differing string lengths because of length pre-check
    const differingLengths = [0, 1, 10, 63, 65, 128];
    for (const len of differingLengths) {
      const dummySig = 'a'.repeat(len);
      const tokenWithDummySig = Buffer.from(JSON.stringify({ expiresAt: Date.now() + 100000, sig: dummySig })).toString('base64url');
      let threw = false;
      let result = null;
      try {
        result = verifyAdminToken(tokenWithDummySig, currentAdminPassword);
      } catch {
        threw = true;
      }
      check(`verifyAdminToken safely rejects sig of length ${len} without throwing timingSafeEqual length error`, !threw && result === false);
    }


    // ═════════════════════════════════════════════════════════════════════════
    // DIMENSION 3: CSV Injection Neutralization (CWE-1236)
    // ═════════════════════════════════════════════════════════════════════════
    suite('Dimension 3: CSV Injection Neutralization (CWE-1236)');

    console.log('\n--- 3.1: Formula Injection Trigger Neutralization ---');
    const injectionTriggers = [
      { input: '=cmd|\' /C calc\'!A0', expectedPrefix: "'=cmd" },
      { input: '+SUM(1+1)*cmd|\' /C calc\'!A0', expectedPrefix: "'+SUM" },
      { input: '-1+1', expectedPrefix: "'-1+1" },
      { input: '@SUM(A1:A10)', expectedPrefix: "'@SUM" },
      { input: '\tcalc', expectedPrefix: "'\tcalc" },
      { input: '\rcalc', expectedPrefix: "'\rcalc" }, // \r preserved then triggers formula
      { input: '   =SUM(A1)', expectedPrefix: "'   =SUM" }, // leading spaces before formula
      { input: '  +12345', expectedPrefix: "'  +12345" },
      { input: ' -formula', expectedPrefix: "' -formula" },
      { input: ' @alert(1)', expectedPrefix: "' @alert(1)" },
    ];

    for (const { input, expectedPrefix } of injectionTriggers) {
      const escaped = escapeCsvField(input);
      check(`escapeCsvField prepends single quote to trigger "${input.replace(/[\r\t\n]/g, ' ')}"`, escaped.startsWith(`"${expectedPrefix}`));
      check(`escapeCsvField wraps neutralized string in double quotes`, escaped.startsWith('"') && escaped.endsWith('"'));
    }

    console.log('\n--- 3.2: Preservation of Legitimate Numbers ---');
    const regularNumbers = [
      { num: 1200, expected: '"1200"' },
      { num: 0, expected: '"0"' },
      { num: 45.5, expected: '"45.5"' },
      { num: 999999, expected: '"999999"' },
      { num: -50, expected: '"-50"' }, // Negative primitive number preserved without single quote
    ];

    for (const { num, expected } of regularNumbers) {
      const escaped = escapeCsvField(num);
      check(`escapeCsvField preserves primitive number ${num} as ${expected} without single quote prefix`, escaped === expected, `Got: ${escaped}`);
    }

    console.log('\n--- 3.3: Preservation of Standard Arabic Text ---');
    const arabicTexts = [
      { text: 'فستق أمريكي جامبو محمص', expected: '"فستق أمريكي جامبو محمص"' },
      { text: 'محمص مملح', expected: '"محمص مملح"' },
      { text: 'القاهرة، جمهورية مصر العربية', expected: '"القاهرة، جمهورية مصر العربية"' },
      { text: 'محمد "أبو العز" الشافعي', expected: '"محمد ""أبو العز"" الشافعي"' }, // Double quotes escaped per RFC 4180
      { text: 'ملاحظة أولى\nملاحظة ثانية', expected: '"ملاحظة أولى ملاحظة ثانية"' }, // Newline flattened
    ];

    for (const { text, expected } of arabicTexts) {
      const escaped = escapeCsvField(text);
      check(`escapeCsvField preserves Arabic text "${text.replace(/\n/g, ' ')}" correctly without mangling`, escaped === expected, `Got: ${escaped}`);
    }

    console.log('\n--- 3.4: Orders CSV Export & UTF-8 BOM Verification ---');
    const adversarialOrders = [
      {
        id: 'ord-adv-1',
        orderNumber: '=cmd|calc!A0', // Injected orderNumber
        createdAt: '2026-10-14T10:00:00.000Z',
        customerName: '+SUM(1+2)',   // Injected customerName
        customerPhone: '01012345678',
        customerAltPhone: '-100',    // Injected customerAltPhone
        governorate: '@Cairo',       // Injected governorate
        address: '\tStreet 9',       // Injected address
        subtotal: 1200,              // Numeric
        shippingCost: 50,            // Numeric
        discountAmount: 100,         // Numeric
        couponCode: '=DISCOUNT',     // Injected couponCode
        total: 1150,                 // Numeric
        paymentMethod: 'vodafone_cash',
        paymentReference: '+VF12345',// Injected paymentReference
        status: 'pending',
        notes: '-Call before delivery\n+Urgent', // Injected notes
        items: [
          {
            cartItemId: 'item-1',
            productId: 'custom-mix',
            productName: 'علبة مشكلة مخصصة',
            weightId: 'custom-1000',
            weightLabel: '1 كجم مخصص',
            roastOption: 'تشكيلة فاخرة',
            unitPrice: 1200,
            quantity: 1,
            isCustomMix: true,
            boxCapacityGrams: 1000,
            customBreakdown: [
              {
                productId: 'prod-pistachio-1',
                productName: 'فستق أمريكي جامبو',
                roastOption: 'محمص مملح',
                percentage: 50,
                weightGrams: 500,
                priceContribution: 600,
              },
              {
                productId: 'prod-cashew-1',
                productName: 'كاجو جامبو ملكي',
                roastOption: 'محمص بدون ملح',
                percentage: 50,
                weightGrams: 500,
                priceContribution: 600,
              },
            ],
          },
        ],
      },
    ];

    const csvOutput = generateOrdersCsv(adversarialOrders);

    // Byte offset 0 UTF-8 BOM verification
    const csvBuffer = Buffer.from(csvOutput, 'utf8');
    check('CSV output starts with UTF-8 BOM character (\\uFEFF)', csvOutput.startsWith('\uFEFF'));
    check('Byte 0 is 0xEF', csvBuffer[0] === 0xef);
    check('Byte 1 is 0xBB', csvBuffer[1] === 0xbb);
    check('Byte 2 is 0xBF', csvBuffer[2] === 0xbf);

    // Neutralization inside generated CSV
    check('Injected orderNumber neutralized in CSV ("\'=cmd|calc!A0")', csvOutput.includes('"\'=cmd|calc!A0"'));
    check('Injected customerName neutralized in CSV ("\'+SUM(1+2)")', csvOutput.includes("'\'+SUM(1+2)\"") || csvOutput.includes('"\' +SUM(1+2)"') || csvOutput.includes('"\' +SUM(1+2)"') || csvOutput.includes('"\' +SUM(1+2)"') || csvOutput.includes('"\'+SUM(1+2)"'));
    check('Injected address neutralized in CSV ("\'\tStreet 9")', csvOutput.includes('"\'\tStreet 9"'));
    check('Injected couponCode neutralized in CSV ("\'=DISCOUNT")', csvOutput.includes('"\'=DISCOUNT"'));
    check('Injected paymentReference neutralized in CSV ("\'+VF12345")', csvOutput.includes('"\'+VF12345"'));
    check('Numeric subtotal preserved without single quote ("1200")', csvOutput.includes('"1200"'));
    check('Numeric shippingCost preserved without single quote ("50")', csvOutput.includes('"50"'));
    check('Numeric total preserved without single quote ("1150")', csvOutput.includes('"1150"'));

    // Check all 17 headers
    for (const hdr of CSV_ORDER_HEADERS) {
      check(`CSV contains required Arabic header "${hdr}"`, csvOutput.includes(`"${hdr}"`));
    }


    // ═════════════════════════════════════════════════════════════════════════
    // DIMENSION 4: Active Session Verification & Cookie Security
    // ═════════════════════════════════════════════════════════════════════════
    suite('Dimension 4: Active Session Verification & Cookie Security');

    // 4.1 GET /api/admin/login Active Session Endpoint
    console.log('\n--- 4.1: GET /api/admin/login Active Session Verification ---');
    // 4.1a Unauthenticated request
    const unauthGetReq = new NextRequest('http://localhost:3000/api/admin/login', { method: 'GET' });
    const unauthGetRes = await getAdminLogin(unauthGetReq);
    const unauthGetBody = await unauthGetRes.json();
    check('GET /api/admin/login without credentials returns HTTP 401', unauthGetRes.status === 401);
    check('GET /api/admin/login without credentials returns authenticated: false', unauthGetBody.authenticated === false);
    check('GET /api/admin/login without credentials returns 401 error message', unauthGetBody.error === 'غير مصرح لك بالوصول (401 Unauthorized)');

    // 4.1b Request with former backdoor token in Bearer header
    const backdoorGetReq = new NextRequest('http://localhost:3000/api/admin/login', {
      method: 'GET',
      headers: { Authorization: 'Bearer admin-auth-session-valid-token' },
    });
    const backdoorGetRes = await getAdminLogin(backdoorGetReq);
    check('GET /api/admin/login with backdoor Bearer returns HTTP 401', backdoorGetRes.status === 401);

    // 4.1c Request with valid Bearer token
    const validGetReq = new NextRequest('http://localhost:3000/api/admin/login', {
      method: 'GET',
      headers: { Authorization: `Bearer ${correctSession.token}` },
    });
    const validGetRes = await getAdminLogin(validGetReq);
    const validGetBody = await validGetRes.json();
    check('GET /api/admin/login with valid Bearer token returns HTTP 200', validGetRes.status === 200);
    check('GET /api/admin/login with valid Bearer token returns authenticated: true', validGetBody.authenticated === true);
    check('GET /api/admin/login with valid Bearer token returns token string', validGetBody.token === correctSession.token);

    // 4.1d Request with valid admin_session cookie
    const validCookieReq = new NextRequest('http://localhost:3000/api/admin/login', {
      method: 'GET',
      headers: { Cookie: `admin_session=${correctSession.token}` },
    });
    const validCookieRes = await getAdminLogin(validCookieReq);
    const validCookieBody = await validCookieRes.json();
    check('GET /api/admin/login with valid cookie returns HTTP 200', validCookieRes.status === 200);
    check('GET /api/admin/login with valid cookie returns authenticated: true', validCookieBody.authenticated === true);

    // 4.2 POST /api/admin/login Cookie Flags Verification
    console.log('\n--- 4.2: POST /api/admin/login Cookie Security Attributes ---');
    const loginReq = new NextRequest('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: currentAdminPassword }),
    });
    const loginRes = await postAdminLogin(loginReq);
    const loginBody = await loginRes.json();
    check('POST /api/admin/login with correct password returns HTTP 200', loginRes.status === 200);
    check('POST /api/admin/login returns success: true and token', loginBody.success === true && typeof loginBody.token === 'string');

    const setCookieHeader = loginRes.headers.get('set-cookie') || '';
    const cookieObj = loginRes.cookies.get('admin_session');
    check('POST /api/admin/login sets admin_session cookie', Boolean(cookieObj) && setCookieHeader.includes('admin_session='));
    check('admin_session cookie is marked HttpOnly (XSS protection)', cookieObj?.httpOnly === true && /HttpOnly/i.test(setCookieHeader));
    check('admin_session cookie has SameSite=Lax (CSRF mitigation)', cookieObj?.sameSite === 'lax' && /SameSite=lax/i.test(setCookieHeader));
    check('admin_session cookie has Path=/', cookieObj?.path === '/' && /Path=\//i.test(setCookieHeader));
    check('admin_session cookie has Max-Age of 24h (86400s)', cookieObj?.maxAge === 86400 && /Max-Age=86400/i.test(setCookieHeader));

    // 4.3 POST /api/admin/logout Cookie Clearance
    console.log('\n--- 4.3: POST /api/admin/logout Cookie Clearance ---');
    const logoutReq = new NextRequest('http://localhost:3000/api/admin/logout', { method: 'POST' });
    const logoutRes = await postAdminLogout();
    const logoutBody = await logoutRes.json();
    check('POST /api/admin/logout returns HTTP 200', logoutRes.status === 200);
    check('POST /api/admin/logout returns success: true', logoutBody.success === true);

    const logoutCookieHeader = logoutRes.headers.get('set-cookie') || '';
    check('POST /api/admin/logout sets empty value for admin_session', /admin_session=(?:;|(?=[^;]*Max-Age=0))/i.test(logoutCookieHeader) || logoutCookieHeader.includes('admin_session=;'));
    check('POST /api/admin/logout sets Max-Age=0 to immediately expire cookie', /Max-Age=0/i.test(logoutCookieHeader));
    check('POST /api/admin/logout retains HttpOnly attribute', /HttpOnly/i.test(logoutCookieHeader));
    check('POST /api/admin/logout retains Path=/', /Path=\//i.test(logoutCookieHeader));

  } finally {
    // Restore pristine database state
    if (originalDbRaw && fs.existsSync(DB_PATH)) {
      try {
        fs.writeFileSync(DB_PATH, originalDbRaw, 'utf8');
      } catch (err) {
        console.error('Failed to restore database state:', err);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SUMMARY REPORTING
  // ═════════════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}${colors.yellow}==================================================================`);
  console.log(`  CHALLENGER M2 GEN 2 EMPIRICAL STRESS TEST RESULTS`);
  console.log(`==================================================================${colors.reset}`);
  console.log(`  Total Checks Executed : ${totalChecks}`);
  console.log(`  Passed Checks         : ${passedChecks}`);
  console.log(`  Failed Checks         : ${failedChecks}`);
  const passRate = ((passedChecks / totalChecks) * 100).toFixed(2);
  console.log(`  Pass Rate             : ${passRate}%\n`);

  if (failedChecks === 0) {
    console.log(`${colors.bold}${colors.green}🎉 ALL ${totalChecks} ADVERSARIAL CHECKS PASSED WITH ZERO DEFECTS!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.bold}${colors.red}❌ ${failedChecks} CHECKS FAILED!${colors.reset}\n`);
    for (const f of failures.slice(0, 20)) {
      console.error(`  - ${f.desc} (${f.extraInfo})`);
    }
    process.exit(1);
  }
}

runChallengerM2Gen2Suite().catch((err) => {
  console.error('Fatal Test Exception in Challenger M2 Gen 2 Runner:', err);
  process.exit(1);
});
