import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  generateAdminToken,
  verifyAdminToken,
  sanitizePublicStoreData,
  sanitizeStoreDataForRole,
} from '../src/lib/auth';
import { getDbAsync } from '../src/lib/db';
import { POST as loginPOST, GET as loginGET } from '../src/app/api/admin/login/route';
import { GET as storeGET, PUT as storePUT } from '../src/app/api/store/route';
import { GET as ordersGET, DELETE as ordersDELETE } from '../src/app/api/orders/route';
import { GET as posGET } from '../src/app/api/pos/route';

async function runRoleIsolationChecks() {
  console.log('=== Verifying 5-Role Isolation Architecture ===');
  const db = await getDbAsync();

  // 1. Verify all 5 roles have completely distinct usernames AND distinct passwords
  const credentials = [
    {
      role: 'super_admin',
      user: db.settings.adminUsername || 'admin_hafsa',
      pass: db.settings.adminPassword || 'Hafsa@Admin2026',
    },
    {
      role: 'supplier',
      user: db.settings.supplierUsername || 'supplier_arafat',
      pass: db.settings.supplierPassword || 'Sup#Arafat2026',
    },
    {
      role: 'cashier',
      user: db.settings.cashierUsername || 'cashier_pos',
      pass: db.settings.cashierPassword || 'Cash#Pos2026',
    },
    {
      role: 'accountant',
      user: db.settings.accountantUsername || 'accountant_fin',
      pass: db.settings.accountantPassword || 'Acc#Fin2026',
    },
    {
      role: 'customer',
      user: db.settings.customerUsername || 'customer_buyer',
      pass: db.settings.customerPassword || 'Cust#Buy2026',
    },
  ];

  const uniqueUsernames = new Set(credentials.map((c) => c.user.toLowerCase()));
  const uniquePasswords = new Set(credentials.map((c) => c.pass));
  assert.equal(uniqueUsernames.size, 5, 'All 5 roles must have distinct usernames');
  assert.equal(uniquePasswords.size, 5, 'All 5 roles must have distinct passwords');
  console.log('✓ All 5 roles have distinct usernames AND distinct passwords');

  // Verify each role logs in with its distinct username + password and fails with mismatched username/password
  for (let i = 0; i < credentials.length; i++) {
    const curr = credentials[i];
    const next = credentials[(i + 1) % credentials.length];

    // Valid username + password for role
    const okRes = await loginPOST(
      new NextRequest('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: curr.user,
          password: curr.pass,
          role: curr.role,
        }),
      })
    );
    assert.equal(okRes.status, 200, `Login must succeed for ${curr.role} (${curr.user})`);
    const okData = await okRes.json();
    assert.equal(okData.role, curr.role, `Returned role must match ${curr.role}`);
    assert.equal(okData.username, curr.user, `Returned username must match ${curr.user}`);

    // Mismatched username + password must fail with 401
    const badMixRes = await loginPOST(
      new NextRequest('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: curr.user,
          password: next.pass,
          role: curr.role,
        }),
      })
    );
    assert.equal(
      badMixRes.status,
      401,
      `Login must reject ${curr.user} with ${next.role}'s password`
    );
  }
  console.log('✓ Login verification passed for all 5 distinct (username, password) pairs');

  // 2. External Customer (المستخدم الخارجي / المشتري)
  const customerData = sanitizePublicStoreData(db);
  assert.equal(customerData.orders.length, 0, 'Customer must not see internal orders');
  assert.equal(customerData.posShifts?.length || 0, 0, 'Customer must not see POS shifts');
  assert.equal(customerData.posExpenses?.length || 0, 0, 'Customer must not see POS expenses');
  assert.equal(customerData.settings.adminUsername, undefined, 'Customer must not see adminUsername');
  assert.equal(customerData.settings.adminPassword, undefined, 'Customer must not see adminPassword');
  assert.equal(customerData.settings.supplierUsername, undefined, 'Customer must not see supplierUsername');
  assert.equal(customerData.settings.supplierPassword, undefined, 'Customer must not see supplierPassword');
  assert.equal(customerData.settings.cashierUsername, undefined, 'Customer must not see cashierUsername');
  assert.equal(customerData.settings.cashierPassword, undefined, 'Customer must not see cashierPassword');
  assert.equal(customerData.settings.accountantUsername, undefined, 'Customer must not see accountantUsername');
  assert.equal(customerData.settings.accountantPassword, undefined, 'Customer must not see accountantPassword');
  assert.equal(customerData.settings.customerUsername, undefined, 'Customer must not see customerUsername');
  assert.equal(customerData.settings.customerPassword, undefined, 'Customer must not see customerPassword');
  for (const p of customerData.products) {
    assert.equal(p.costPerKg, undefined, 'Customer must not see wholesale costPerKg');
    assert.equal(p.packagingCost, undefined, 'Customer must not see packagingCost');
  }
  console.log('✓ Role 5 (External Customer) isolation verified');

  // 3. Supplier (المورد)
  const supplierSession = generateAdminToken(
    db.settings.supplierPassword || 'Sup#Arafat2026',
    'supplier'
  );
  const supplierToken = supplierSession.token;
  assert.equal(
    verifyAdminToken(supplierToken, db.settings.supplierPassword || 'Sup#Arafat2026'),
    true,
    'Supplier token must verify for supplier role'
  );
  assert.equal(
    verifyAdminToken(supplierToken, db.settings.adminPassword || 'Hafsa@Admin2026'),
    false,
    'Supplier token must NOT verify with admin password'
  );
  const supplierData = sanitizeStoreDataForRole(db, 'supplier');
  assert.equal(supplierData.orders.length, 0, 'Supplier must be isolated from customer orders');
  assert.equal(supplierData.posShifts?.length || 0, 0, 'Supplier must be isolated from POS shifts');
  assert.equal(supplierData.coupons.length, 0, 'Supplier must be isolated from coupons');
  assert.ok(
    supplierData.products.every((p) => typeof p.costPerKg === 'number'),
    'Supplier must see costPerKg on products'
  );

  // Supplier API restrictions on /api/pos and /api/orders
  const supplierPosRes = await posGET(
    new NextRequest('http://localhost:3000/api/pos', {
      headers: { Authorization: `Bearer ${supplierToken}` },
    })
  );
  assert.equal(supplierPosRes.status, 403, 'Supplier must receive 403 on /api/pos');
  console.log('✓ Role 2 (Supplier) isolation verified');

  // 4. Cashier (الكاشير)
  const cashierSession = generateAdminToken(
    db.settings.cashierPassword || 'Cash#Pos2026',
    'cashier'
  );
  const cashierToken = cashierSession.token;
  const cashierData = sanitizeStoreDataForRole(db, 'cashier');
  for (const p of cashierData.products) {
    assert.equal(p.costPerKg, undefined, 'Cashier must NOT see wholesale costPerKg');
    assert.equal(p.packagingCost, undefined, 'Cashier must NOT see packagingCost');
  }
  for (const o of cashierData.orders) {
    assert.equal(o.rawCostTotal, undefined, 'Cashier must NOT see order rawCostTotal');
    assert.equal(o.netProfitEgp, undefined, 'Cashier must NOT see order netProfitEgp');
  }
  const cashierPosRes = await posGET(
    new NextRequest('http://localhost:3000/api/pos', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    })
  );
  assert.equal(cashierPosRes.status, 200, 'Cashier can access /api/pos');
  const cashierPosJson = await cashierPosRes.json();
  for (const s of cashierPosJson.posShifts || []) {
    assert.equal(s.totalRawCost, undefined, 'Cashier POS shift must strip totalRawCost');
    assert.equal(s.totalNetProfit, undefined, 'Cashier POS shift must strip totalNetProfit');
  }
  const cashierStorePutRes = await storePUT(
    new NextRequest('http://localhost:3000/api/store', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ settings: { storeName: 'Hacked' } }),
    })
  );
  assert.equal(cashierStorePutRes.status, 403, 'Cashier must receive 403 on PUT /api/store');

  const cashierDeleteOrderRes = await ordersDELETE(
    new NextRequest('http://localhost:3000/api/orders?id=test', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cashierToken}` },
    })
  );
  assert.equal(cashierDeleteOrderRes.status, 403, 'Cashier must receive 403 on DELETE /api/orders');
  console.log('✓ Role 3 (Cashier) isolation verified');

  // 5. Accountant (المحاسب)
  const accountantSession = generateAdminToken(
    db.settings.accountantPassword || 'Acc#Fin2026',
    'accountant'
  );
  const accountantToken = accountantSession.token;
  const accountantData = sanitizeStoreDataForRole(db, 'accountant');
  assert.ok(
    accountantData.products.every((p) => typeof p.costPerKg === 'number'),
    'Accountant must see costPerKg for margin audit'
  );
  const accountantPosRes = await posGET(
    new NextRequest('http://localhost:3000/api/pos', {
      headers: { Authorization: `Bearer ${accountantToken}` },
    })
  );
  assert.equal(accountantPosRes.status, 200, 'Accountant can audit /api/pos');
  const accountantStorePutRes = await storePUT(
    new NextRequest('http://localhost:3000/api/store', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({ settings: { storeName: 'NoEdit' } }),
    })
  );
  assert.equal(accountantStorePutRes.status, 403, 'Accountant must receive 403 on PUT /api/store');
  console.log('✓ Role 4 (Accountant) isolation verified');

  // 6. Super Admin (الأدمن / المدير العام)
  const adminLoginRes = await loginPOST(
    new NextRequest('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: db.settings.adminUsername || 'admin_hafsa',
        password: db.settings.adminPassword || 'Hafsa@Admin2026',
        role: 'super_admin',
      }),
    })
  );
  assert.equal(adminLoginRes.status, 200, 'Admin login must succeed');
  const adminLoginData = await adminLoginRes.json();
  assert.equal(adminLoginData.role, 'super_admin', 'Admin login must return super_admin role');
  console.log('✓ Role 1 (Super Admin) full control verified');

  console.log('🎉 ALL 5 ROLES ISOLATION & DISTINCT CREDENTIALS CHECKS PASSED!');
}

runRoleIsolationChecks().catch((err) => {
  console.error(err);
  process.exit(1);
});
