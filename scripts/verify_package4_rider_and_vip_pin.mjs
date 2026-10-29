import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Ensure execution under tsx so TypeScript Next.js route handlers can be imported directly
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
const {
  validateVipPinFormat,
  hashVipPin,
  verifyVipPin,
  sanitizeVipMember,
} = await import('../src/lib/vip-pin.ts');
const { getDbAsync, withDbTransaction } = await import('../src/lib/db.ts');
const { generateAdminToken, normalizeAdminRole, verifyAdminToken } = await import('../src/lib/auth.ts');
const { GET: vipGET, POST: vipPOST } = await import('../src/app/api/vip/route.ts');
const { GET: riderOrdersGET, PATCH: riderOrdersPATCH } = await import('../src/app/api/rider/orders/route.ts');
const { POST: ordersPOST, PATCH: ordersPATCH } = await import('../src/app/api/orders/route.ts');
const { POST: posPOST } = await import('../src/app/api/pos/route.ts');
const { POST: loginPOST } = await import('../src/app/api/admin/login/route.ts');

console.log('==================================================================');
console.log('  PACKAGE 4 VERIFICATION: RIDER PORTAL & VIP WALLET 4-DIGIT PIN');
console.log('==================================================================\n');

const originalDbRaw = fs.readFileSync(DB_PATH, 'utf8');

try {
  // ──────────────────────────────────────────────────────────────────────────
  // Check 1: 4-Digit VIP PIN Validation, Scrypt Hashing & Sanitization
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ Check 1: VIP PIN Format Validation, Scrypt Hashing & Sanitization...');
  assert.equal(validateVipPinFormat('5599'), true, '5599 must be valid');
  assert.equal(validateVipPinFormat('0000'), true, '0000 must be valid');
  assert.equal(validateVipPinFormat('123'), false, '3 digits must fail');
  assert.equal(validateVipPinFormat('12345'), false, '5 digits must fail');
  assert.equal(validateVipPinFormat('abcd'), false, 'Letters must fail');

  const hashedPin = hashVipPin('7890');
  assert.ok(hashedPin.startsWith('scrypt$'), 'PIN hash must use scrypt format');
  assert.equal(verifyVipPin('7890', hashedPin), true, 'Correct PIN must verify true');
  assert.equal(verifyVipPin('7891', hashedPin), false, 'Wrong PIN must verify false');

  const testVipMember = {
    phone: '01011223344',
    customerName: 'حفصة عميل ذهبي',
    pointsBalance: 150,
    totalSpent: 1500,
    ordersCount: 3,
    tier: 'gold',
    joinedAt: new Date().toISOString(),
    transactions: [],
    pinHash: hashedPin,
  };

  const sanitized = sanitizeVipMember(testVipMember);
  assert.equal(sanitized.pinHash, undefined, 'pinHash must be strictly stripped');
  assert.equal(sanitized.hasPin, true, 'hasPin must be true');
  console.log('  ✓ VIP PIN scrypt engine & zero hash leakage sanitization verified.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // Check 2: VIP API (/api/vip) action: 'set_pin' & 'verify_pin'
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ Check 2: /api/vip "set_pin" & "verify_pin" Lifecycle...');
  const testPhone = '01099887766';

  // Set PIN for the first time
  const setPinReq = new NextRequest('http://localhost:3000/api/vip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'set_pin',
      phone: testPhone,
      pin: '3344',
      customerName: 'عميل اختبار البندر',
    }),
  });
  const setPinRes = await vipPOST(setPinReq);
  assert.equal(setPinRes.status, 200, 'set_pin must succeed with 200');
  const setPinData = await setPinRes.json();
  assert.equal(setPinData.success, true);
  assert.equal(setPinData.member.hasPin, true);
  assert.equal(setPinData.member.pinHash, undefined, 'API must never leak pinHash');

  // Verify PIN Probe
  const verifyValidReq = new NextRequest('http://localhost:3000/api/vip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify_pin',
      phone: testPhone,
      pin: '3344',
    }),
  });
  const verifyValidRes = await vipPOST(verifyValidReq);
  const verifyValidData = await verifyValidRes.json();
  assert.equal(verifyValidData.valid, true, 'Correct PIN must verify true');

  const verifyInvalidReq = new NextRequest('http://localhost:3000/api/vip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify_pin',
      phone: testPhone,
      pin: '9999',
    }),
  });
  const verifyInvalidRes = await vipPOST(verifyInvalidReq);
  const verifyInvalidData = await verifyInvalidRes.json();
  assert.equal(verifyInvalidData.valid, false, 'Incorrect PIN must verify false');
  console.log('  ✓ /api/vip PIN registration, modification & verification verified.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // Check 3: Protected Order VIP Wallet Redemption in /api/orders
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ Check 3: Protected VIP Wallet Redemption with 4-Digit PIN in /api/orders...');
  const db = await getDbAsync();
  const sampleProduct = db.products[0];

  // Try redeeming VIP wallet without PIN (should fail with 400)
  const orderNoPinReq = new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'عميل اختبار البندر',
      customerPhone: testPhone,
      governorate: 'المنيا',
      address: 'بندر بني مزار - حي الزراعيين',
      deliveryMethod: 'bandar_fast',
      items: [
        {
          productId: sampleProduct.id,
          productName: sampleProduct.name,
          weightLabel: '250 جم',
          weightId: sampleProduct.weights[0]?.id || 'w-250',
          roastOption: 'محمص مملح',
          unitPrice: 150,
          quantity: 1,
        },
      ],
      useVipWallet: true,
      paymentMethod: 'vip_wallet',
    }),
  });
  const orderNoPinRes = await ordersPOST(orderNoPinReq);
  assert.equal(orderNoPinRes.status, 400, 'Redeeming VIP points without PIN must be rejected (400)');
  const orderNoPinData = await orderNoPinRes.json();
  assert.ok(orderNoPinData.error.includes('PIN'), 'Error must mention VIP PIN requirement');

  // Try redeeming VIP wallet with wrong PIN (should fail with 400)
  const orderWrongPinReq = new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'عميل اختبار البندر',
      customerPhone: testPhone,
      governorate: 'المنيا',
      address: 'بندر بني مزار - حي الزراعيين',
      deliveryMethod: 'bandar_fast',
      items: [
        {
          productId: sampleProduct.id,
          productName: sampleProduct.name,
          weightLabel: '250 جم',
          weightId: sampleProduct.weights[0]?.id || 'w-250',
          roastOption: 'محمص مملح',
          unitPrice: 150,
          quantity: 1,
        },
      ],
      useVipWallet: true,
      vipPin: '0000',
      paymentMethod: 'vip_wallet',
    }),
  });
  const orderWrongPinRes = await ordersPOST(orderWrongPinReq);
  assert.equal(orderWrongPinRes.status, 400, 'Redeeming VIP points with wrong PIN must be rejected (400)');

  // Redeem with correct PIN '3344' (should succeed with 201)
  const orderCorrectPinReq = new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'عميل اختبار البندر',
      customerPhone: testPhone,
      governorate: 'المنيا',
      address: 'بندر بني مزار - حي الزراعيين',
      deliveryMethod: 'bandar_fast',
      items: [
        {
          productId: sampleProduct.id,
          productName: sampleProduct.name,
          weightLabel: '250 جم',
          weightId: sampleProduct.weights[0]?.id || 'w-250',
          roastOption: 'محمص مملح',
          unitPrice: 150,
          quantity: 1,
        },
      ],
      useVipWallet: true,
      vipPin: '3344',
      paymentMethod: 'vip_wallet',
    }),
  });
  const orderCorrectPinRes = await ordersPOST(orderCorrectPinReq);
  assert.equal(orderCorrectPinRes.status, 201, 'Redeeming VIP points with correct PIN must succeed (201)');
  const orderCorrectData = await orderCorrectPinRes.json();
  assert.ok(orderCorrectData.order.vipWalletRedeemed > 0, 'Wallet redemption amount must be recorded');
  const createdOrderId = orderCorrectData.order.id;
  console.log('  ✓ Orders API strictly enforces 4-Digit PIN before releasing customer cashback.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // Check 4: Rider Orders API (/api/rider/orders) & RBAC Isolation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ Check 4: /api/rider/orders Security, Cost Stripping & Order Completion...');

  // Authenticate rider via /api/admin/login
  const riderLoginReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: db.settings.riderUsername || 'rider_delivery',
      password: db.settings.riderPassword || 'Rider#Hafsa2026',
    }),
  });
  const riderLoginRes = await loginPOST(riderLoginReq);
  assert.equal(riderLoginRes.status, 200, 'Rider login must succeed (200)');
  const riderLoginData = await riderLoginRes.json();
  const riderToken = riderLoginData.token;
  assert.equal(riderLoginData.role, 'delivery_rider');
  assert.equal(riderLoginData.redirectTo, '/rider');

  // Authenticate cashier via /api/admin/login
  const cashierLoginReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: db.settings.cashierUsername || 'cashier_pos',
      password: db.settings.cashierPassword || 'Cash#Pos2026',
    }),
  });
  const cashierLoginRes = await loginPOST(cashierLoginReq);
  assert.equal(cashierLoginRes.status, 200);
  const cashierToken = (await cashierLoginRes.json()).token;

  // 401 Unauthenticated check
  const unauthRiderReq = new NextRequest('http://localhost:3000/api/rider/orders');
  const unauthRiderRes = await riderOrdersGET(unauthRiderReq);
  assert.equal(unauthRiderRes.status, 401, 'Unauthenticated rider access must return 401');

  // 403 Cashier access rejection to /api/rider/orders
  const cashierRiderReq = new NextRequest('http://localhost:3000/api/rider/orders', {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const cashierRiderRes = await riderOrdersGET(cashierRiderReq);
  assert.equal(cashierRiderRes.status, 403, 'Cashier must be rejected from rider portal (403)');

  // Authenticated Rider Orders fetch
  const riderReq = new NextRequest('http://localhost:3000/api/rider/orders?type=all', {
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  const riderRes = await riderOrdersGET(riderReq);
  assert.equal(riderRes.status, 200, 'Authenticated rider fetch must return 200');
  const riderData = await riderRes.json();
  assert.ok(Array.isArray(riderData.orders), 'Orders must be returned as array');
  assert.ok(riderData.stats, 'Stats summary must be included');

  // Verify internal costs are stripped
  for (const o of riderData.orders) {
    assert.equal(o.rawCostTotal, undefined, 'rawCostTotal must be stripped for rider');
    assert.equal(o.netProfitEgp, undefined, 'netProfitEgp must be stripped for rider');
  }

  // Rider marks order as delivered
  const riderDeliverReq = new NextRequest('http://localhost:3000/api/rider/orders', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${riderToken}`,
    },
    body: JSON.stringify({
      orderId: createdOrderId,
      status: 'delivered',
      riderNotes: 'تم التسليم باليد للعميل في حي الزراعيين',
      cashCollected: 0,
    }),
  });
  const riderDeliverRes = await riderOrdersPATCH(riderDeliverReq);
  assert.equal(riderDeliverRes.status, 200, 'Rider PATCH to delivered must succeed (200)');
  const riderDeliverData = await riderDeliverRes.json();
  assert.equal(riderDeliverData.order.status, 'delivered', 'Order status must be updated to delivered');
  assert.ok(riderDeliverData.order.deliveredAt, 'deliveredAt timestamp must be recorded');
  console.log('  ✓ /api/rider/orders role isolation, wholesale cost stripping & delivery completion verified.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // Check 5: Rider Assignment from Admin & POS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ Check 5: Rider Assignment Handlers from Admin & POS...');
  const adminLoginReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: db.settings.adminUsername || 'admin_hafsa',
      password: db.settings.adminPassword || 'Hafsa#Admin2026',
    }),
  });
  const adminLoginRes = await loginPOST(adminLoginReq);
  assert.equal(adminLoginRes.status, 200);
  const adminToken = (await adminLoginRes.json()).token;

  // Admin assigns rider in /api/orders
  const assignReq = new NextRequest('http://localhost:3000/api/orders', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      orderId: createdOrderId,
      riderId: 'staff-primary-delivery_rider',
      riderName: 'أحمد مندوب التوصيل',
    }),
  });
  const assignRes = await ordersPATCH(assignReq);
  assert.equal(assignRes.status, 200, 'Admin rider assignment must succeed (200)');
  const assignData = await assignRes.json();
  assert.equal(assignData.order.riderId, 'staff-primary-delivery_rider');
  assert.equal(assignData.order.riderName, 'أحمد مندوب التوصيل');

  // POS assigns rider via action 'assign_rider'
  const posAssignReq = new NextRequest('http://localhost:3000/api/pos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    },
    body: JSON.stringify({
      action: 'assign_rider',
      orderId: createdOrderId,
      riderId: 'staff-primary-delivery_rider',
      riderName: 'أحمد مندوب التوصيل',
    }),
  });
  const posAssignRes = await posPOST(posAssignReq);
  assert.equal(posAssignRes.status, 200, 'POS rider assignment action must succeed (200)');
  console.log('  ✓ Admin and POS order rider assignment workflows verified.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // Check 6: UI & AGENTS.md Compliance Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ Check 6: UI Codebase & AGENTS.md Compliance Audit...');
  const riderPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/rider/page.tsx'), 'utf8');
  assert.ok(
    !riderPageRaw.includes('role-select') &&
    !riderPageRaw.includes('<select') &&
    !riderPageRaw.includes('اختر الدور') &&
    !riderPageRaw.includes('اختر دورك'),
    'Rider login screen must NOT leak role selector tabs or buttons'
  );
  assert.ok(
    riderPageRaw.includes('أدخل اسم المستخدم') && riderPageRaw.includes('أدخل كلمة المرور'),
    'Rider login inputs must strictly be neutral Username and Password'
  );
  assert.ok(
    riderPageRaw.includes('bandar_fast') && riderPageRaw.includes('villages_scheduled'),
    'Rider dashboard must present Bandar fast and villages scheduled batch tabs'
  );

  const checkoutRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/checkout/page.tsx'), 'utf8');
  assert.ok(
    checkoutRaw.includes('vipPin') && checkoutRaw.includes('الرمز السري لمحفظة VIP'),
    'Checkout page must include 4-digit PIN input'
  );

  const vipPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/vip/page.tsx'), 'utf8');
  assert.ok(
    vipPageRaw.includes('handleSavePin') && vipPageRaw.includes('أمان المحفظة'),
    'VIP page must include PIN security card'
  );
  console.log('  ✓ UI forms strictly follow AGENTS.md security guidelines.\n');

  console.log('==================================================================');
  console.log('🎉 ALL PACKAGE 4 RIDER & VIP PIN CHECKS PASSED SUCCESSFULLY!');
  console.log('==================================================================\n');
} finally {
  if (originalDbRaw && fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, originalDbRaw, 'utf8');
  }
}
