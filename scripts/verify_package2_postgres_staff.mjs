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
  RELATIONAL_TABLES,
  buildRelationalSyncStatements,
} = await import('../src/lib/postgres-schema.ts');
const { getDbAsync } = await import('../src/lib/db.ts');
const {
  generateAdminToken,
  verifyAdminToken,
  verifyPasswordConstantTime,
  sanitizePublicStoreData,
  sanitizeStoreDataForRole,
} = await import('../src/lib/auth.ts');
const { POST: loginPOST, GET: loginGET } = await import('../src/app/api/admin/login/route.ts');
const {
  GET: staffGET,
  POST: staffPOST,
  PATCH: staffPATCH,
  DELETE: staffDELETE,
} = await import('../src/app/api/admin/staff/route.ts');
const { GET: posGET, POST: posPOST } = await import('../src/app/api/pos/route.ts');
const {
  GET: supplyGET,
  POST: supplyPOST,
} = await import('../src/app/api/supply-invoices/route.ts');
const { PUT: storePUT } = await import('../src/app/api/store/route.ts');

function makeReq(url, method = 'GET', token = '', bodyObj = undefined) {
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

async function runPackage2Verification() {
  const backupRaw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf8') : null;

  try {
    console.log('=== Verifying Package 2: Neon Relational Engine & Multi-Staff RBAC ===');

    // 1. Relational Schema & Atomic Parameterized Sync Builder
    assert.strictEqual(RELATIONAL_TABLES.length, 10, 'Must define all 10 relational tables');
    const db = await getDbAsync();
    const stmts = buildRelationalSyncStatements(db, 2, 1);
    assert.ok(stmts.length >= 10, 'Must generate relational upsert/cleanup statements for all tables');
    assert.ok(
      stmts[0].text.includes("WHERE id = 'main' AND version = $3"),
      'First statement must enforce optimistic version concurrency check when expectedVersion is supplied'
    );

    // 2. Primary 5 Staff Accounts Initialized with scrypt Hashes
    assert.ok(Array.isArray(db.staffAccounts), 'db.staffAccounts must be initialized');
    assert.ok(db.staffAccounts.length >= 5, 'Must initialize at least 5 primary staff accounts');
    const primaryRoles = new Set(
      db.staffAccounts.filter((a) => a.isPrimary).map((a) => a.role)
    );
    for (const r of ['super_admin', 'accountant', 'cashier', 'supplier', 'delivery_rider']) {
      assert.ok(primaryRoles.has(r), `Primary staff account must exist for role ${r}`);
    }
    for (const acc of db.staffAccounts) {
      assert.ok(
        acc.passwordHash.startsWith('scrypt$'),
        `Account ${acc.username} passwordHash must be scrypt-hashed`
      );
    }
    const primaryAdmin = db.staffAccounts.find(
      (a) => a.isPrimary && a.role === 'super_admin'
    );
    assert.ok(
      verifyPasswordConstantTime(db.settings.adminPassword, primaryAdmin.passwordHash),
      'Primary admin scrypt hash must match configured adminPassword'
    );

    // 3. Data Projection Sanitization (Zero passwordHash Leakage)
    const pubProj = sanitizePublicStoreData(db);
    assert.deepStrictEqual(pubProj.staffAccounts, [], 'Public store data must hide staffAccounts');

    for (const nonAdminRole of ['supplier', 'cashier', 'accountant', 'delivery_rider']) {
      const roleProj = sanitizeStoreDataForRole(db, nonAdminRole);
      assert.deepStrictEqual(
        roleProj.staffAccounts,
        [],
        `Role ${nonAdminRole} projection must hide staffAccounts`
      );
    }

    const adminProj = sanitizeStoreDataForRole(db, 'super_admin');
    assert.ok(adminProj.staffAccounts.length >= 5);
    for (const safeAcc of adminProj.staffAccounts) {
      assert.strictEqual(
        'passwordHash' in safeAcc,
        false,
        'super_admin projection must strip passwordHash from staffAccounts'
      );
    }

    // 4. RBAC Enforcement on /api/admin/staff
    const unauthStaffRes = await staffGET(makeReq('http://localhost/api/admin/staff', 'GET'));
    assert.strictEqual(unauthStaffRes.status, 401, 'Unauthenticated GET /api/admin/staff -> 401');

    const cashierLegacyToken = generateAdminToken(db.settings.cashierPassword, 'cashier').token;
    const forbiddenStaffRes = await staffGET(
      makeReq('http://localhost/api/admin/staff', 'GET', cashierLegacyToken)
    );
    assert.strictEqual(forbiddenStaffRes.status, 403, 'Cashier GET /api/admin/staff -> 403');

    // Login as super_admin via /api/admin/login
    const adminLoginRes = await loginPOST(
      makeReq('http://localhost/api/admin/login', 'POST', '', {
        username: db.settings.adminUsername,
        password: db.settings.adminPassword,
      })
    );
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login must succeed');
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    assert.ok(adminToken, 'Admin login must return session token');

    // 5. Create Multiple Staff Accounts Across Roles (2nd Cashier, 2nd Supplier, Delivery Rider)
    const createCashier2Res = await staffPOST(
      makeReq('http://localhost/api/admin/staff', 'POST', adminToken, {
        displayName: 'محمود كاشير الوردية المسائية',
        username: 'cashier_shift_two',
        password: 'Shift2#Pass2026',
        role: 'cashier',
        phone: '01099887766',
      })
    );
    assert.strictEqual(createCashier2Res.status, 201, 'Creating 2nd cashier must return 201');
    const cashier2Acc = (await createCashier2Res.json()).account;
    assert.strictEqual(cashier2Acc.username, 'cashier_shift_two');
    assert.strictEqual('passwordHash' in cashier2Acc, false);

    // Duplicate username must return 409
    const dupRes = await staffPOST(
      makeReq('http://localhost/api/admin/staff', 'POST', adminToken, {
        displayName: 'مكرر',
        username: 'CASHIER_SHIFT_TWO',
        password: 'Shift2#Pass2026',
        role: 'cashier',
      })
    );
    assert.strictEqual(dupRes.status, 409, 'Case-insensitive duplicate username must return 409');

    // Create 2nd Supplier
    const createSupplier2Res = await staffPOST(
      makeReq('http://localhost/api/admin/staff', 'POST', adminToken, {
        displayName: 'مؤسسة البن الكولومبي للتوريد',
        username: 'supplier_colombia_two',
        password: 'ColSup#2026',
        role: 'supplier',
      })
    );
    assert.strictEqual(createSupplier2Res.status, 201);
    const supplier2Acc = (await createSupplier2Res.json()).account;

    // Create Delivery Rider
    const createRiderRes = await staffPOST(
      makeReq('http://localhost/api/admin/staff', 'POST', adminToken, {
        displayName: 'كابتن طارق دليفري البندر',
        username: 'rider_tarek_one',
        password: 'RiderTarek#2026',
        role: 'delivery_rider',
      })
    );
    assert.strictEqual(createRiderRes.status, 201);
    const riderAcc = (await createRiderRes.json()).account;

    // 6. Credential-Driven Role Resolution & Operational Attribution
    const c2LoginRes = await loginPOST(
      makeReq('http://localhost/api/admin/login', 'POST', '', {
        username: 'cashier_shift_two',
        password: 'Shift2#Pass2026',
      })
    );
    assert.strictEqual(c2LoginRes.status, 200);
    const c2Login = await c2LoginRes.json();
    assert.strictEqual(c2Login.role, 'cashier');
    assert.strictEqual(c2Login.redirectTo, '/pos');
    assert.strictEqual(c2Login.displayName, 'محمود كاشير الوردية المسائية');

    // Open shift & create invoice as 2nd cashier -> verify attribution
    const openShiftRes = await posPOST(
      makeReq('http://localhost/api/pos', 'POST', c2Login.token, {
        action: 'open_shift',
        openingCash: 750,
      })
    );
    assert.strictEqual(openShiftRes.status, 200);
    const openedShift = (await openShiftRes.json()).activeShift;
    assert.strictEqual(openedShift.cashierId, 'cashier_shift_two');
    assert.strictEqual(openedShift.cashierName, 'محمود كاشير الوردية المسائية');

    const sampleProd = db.products.find((p) => p.showInPos !== false) || db.products[0];
    const posInvRes = await posPOST(
      makeReq('http://localhost/api/pos', 'POST', c2Login.token, {
        action: 'create_invoice',
        items: [
          {
            productId: sampleProd.id,
            productName: sampleProd.name,
            weightId: sampleProd.weights[0].id,
            weightLabel: sampleProd.weights[0].label,
            unitPrice: sampleProd.weights[0].price,
            quantity: 1,
          },
        ],
        paymentMethod: 'cod',
      })
    );
    assert.strictEqual(posInvRes.status, 201);
    const createdPosOrder = (await posInvRes.json()).order;
    assert.strictEqual(createdPosOrder.cashierId, 'cashier_shift_two');
    assert.strictEqual(createdPosOrder.cashierName, 'محمود كاشير الوردية المسائية');

    // Multi-Supplier Isolation: 2nd supplier creates invoice & only sees their own invoices
    const s2LoginRes = await loginPOST(
      makeReq('http://localhost/api/admin/login', 'POST', '', {
        username: 'supplier_colombia_two',
        password: 'ColSup#2026',
      })
    );
    const s2Login = await s2LoginRes.json();
    assert.strictEqual(s2Login.role, 'supplier');
    assert.strictEqual(s2Login.redirectTo, '/supplier');

    const s2CreateInvRes = await supplyPOST(
      makeReq('http://localhost/api/supply-invoices', 'POST', s2Login.token, {
        items: [{ productId: sampleProd.id, quantityKg: 5, costPerKg: 310 }],
      })
    );
    assert.strictEqual(s2CreateInvRes.status, 201);
    const s2Inv = (await s2CreateInvRes.json()).invoice;
    assert.strictEqual(s2Inv.supplierId, 'supplier_colombia_two');
    assert.strictEqual(s2Inv.supplierName, 'مؤسسة البن الكولومبي للتوريد');

    const s2GetRes = await supplyGET(
      makeReq('http://localhost/api/supply-invoices', 'GET', s2Login.token)
    );
    const s2Scoped = (await s2GetRes.json()).invoices;
    assert.ok(s2Scoped.length >= 1);
    assert.ok(
      s2Scoped.every((inv) => inv.supplierId === 'supplier_colombia_two'),
      'Secondary supplier must ONLY see their own supply invoices'
    );

    // Delivery Rider RBAC Isolation
    const rLoginRes = await loginPOST(
      makeReq('http://localhost/api/admin/login', 'POST', '', {
        username: 'rider_tarek_one',
        password: 'RiderTarek#2026',
      })
    );
    const rLogin = await rLoginRes.json();
    assert.strictEqual(rLogin.role, 'delivery_rider');
    assert.strictEqual(rLogin.redirectTo, '/rider');

    const riderPosRes = await posGET(makeReq('http://localhost/api/pos', 'GET', rLogin.token));
    assert.strictEqual(riderPosRes.status, 403, 'Delivery rider must be blocked from /api/pos');
    const riderStorePutRes = await storePUT(
      makeReq('http://localhost/api/store', 'PUT', rLogin.token, { coupons: [] })
    );
    assert.strictEqual(riderStorePutRes.status, 403, 'Delivery rider must be blocked from PUT /api/store');

    // 7. Instant Session Revocation & Lockout Protection
    const suspendRes = await staffPATCH(
      makeReq('http://localhost/api/admin/staff', 'PATCH', adminToken, {
        id: cashier2Acc.id,
        active: false,
      })
    );
    assert.strictEqual(suspendRes.status, 200);
    assert.strictEqual(
      verifyAdminToken(c2Login.token),
      false,
      'Suspended staff token must be immediately invalidated'
    );
    const suspendedPosRes = await posGET(
      makeReq('http://localhost/api/pos', 'GET', c2Login.token)
    );
    assert.strictEqual(suspendedPosRes.status, 401, 'Suspended token must receive 401');

    const suspendedReloginRes = await loginPOST(
      makeReq('http://localhost/api/admin/login', 'POST', '', {
        username: 'cashier_shift_two',
        password: 'Shift2#Pass2026',
      })
    );
    assert.strictEqual(suspendedReloginRes.status, 403, 'Suspended staff login must receive 403');

    // Lockout protection: cannot deactivate sole active super_admin
    const lockoutRes = await staffPATCH(
      makeReq('http://localhost/api/admin/staff', 'PATCH', adminToken, {
        id: 'staff-primary-super_admin',
        active: false,
      })
    );
    assert.strictEqual(lockoutRes.status, 400, 'Must prevent deactivating last active super_admin');

    // Primary deletion protection
    const delPrimaryRes = await staffDELETE(
      makeReq('http://localhost/api/admin/staff?id=staff-primary-cashier', 'DELETE', adminToken)
    );
    assert.strictEqual(delPrimaryRes.status, 400, 'Must prevent deleting foundational primary account');

    // Clean up custom test staff accounts
    for (const id of [cashier2Acc.id, supplier2Acc.id, riderAcc.id]) {
      const delRes = await staffDELETE(
        makeReq(`http://localhost/api/admin/staff?id=${id}`, 'DELETE', adminToken)
      );
      assert.strictEqual(delRes.status, 200);
    }

    console.log('✅ ALL PACKAGE 2 RELATIONAL ENGINE & MULTI-STAFF RBAC CHECKS PASSED!');
  } finally {
    if (backupRaw !== null) {
      fs.writeFileSync(DB_PATH, backupRaw, 'utf8');
    }
  }
}

await runPackage2Verification();
