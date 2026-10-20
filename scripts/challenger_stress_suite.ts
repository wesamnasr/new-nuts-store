/**
 * Empirical Challenger Adversarial Stress Suite for Milestone 4
 * Validates:
 * 1. Financial Calculation Engine (src/lib/financials.ts)
 *    - Arithmetic precision, IEEE-754 drift elimination
 *    - Edge cases (0 revenue, cancelled orders, empty orders, custom mix, partitioned box)
 *    - Shift drawer reconciliation (expectedCash, variance, types)
 *    - Date range filters (all, today, this_week, this_month, custom)
 * 2. Accountant RBAC Read-Only Invariants (7 mutation routes)
 *    - POST /api/pos
 *    - PUT /api/store
 *    - PATCH /api/orders
 *    - DELETE /api/orders
 *    - POST /api/supply-invoices
 *    - PATCH /api/supply-invoices
 *    - POST /api/vip (cashier_sync)
 * 3. Accountant Unredacted Read Access
 *    - GET /api/pos (full costs & net profits preserved, vs cashier redacted)
 *    - GET /api/store (full costs, orders, shifts preserved; passwords stripped)
 *    - GET /api/supply-invoices (all invoices returned)
 * 4. CSV Export Security & Excel Compatibility
 *    - UTF-8 BOM (\uFEFF)
 *    - RFC 4180 CRLF (\r\n)
 *    - CWE-1236 Formula Injection neutralization
 */

import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  roundCurrency,
  roundPercentage,
  isOnlineOrder,
  isPosOrder,
  filterItemsByDateRange,
  calculateOrderCogs,
  calculateChannelMetrics,
  calculateShiftAudit,
  calculateSupplyInvoicesFinancials,
  calculateFinancialSummary,
  generateFinancialSummaryCsv,
  generateShiftsAuditCsv,
  generateExpensesLedgerCsv,
  generateSupplyLedgerCsv,
} from '../src/lib/financials';
import { escapeCsvField } from '../src/lib/csv';
import { generateAdminToken } from '../src/lib/auth';
import { getDb } from '../src/lib/db';

// Route handlers
import { POST as postPos, GET as getPos } from '../src/app/api/pos/route';
import { PUT as putStore, GET as getStore } from '../src/app/api/store/route';
import { PATCH as patchOrders, DELETE as deleteOrders } from '../src/app/api/orders/route';
import { POST as postSupply, PATCH as patchSupply, GET as getSupply } from '../src/app/api/supply-invoices/route';
import { POST as postVip } from '../src/app/api/vip/route';

import type { Order, Product, PosShift, PosExpense, SupplyInvoice, VipMember } from '../src/types/store';

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err: any) {
    failed++;
    failures.push(`${name}: ${err.message}`);
    console.error(`  ✗ [FAIL] ${name}\n    Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('CHALLENGER M4 ADVERSARIAL STRESS SUITE STARTING');
  console.log('======================================================\n');

  const db = getDb();
  const accountantPassword = db.settings.accountantPassword || 'Acc#Fin2026';
  const cashierPassword = db.settings.cashierPassword || 'Cash#Pos2026';
  const superAdminPassword = db.settings.adminPassword || 'Hafsa@Admin2026';

  const accountantToken = generateAdminToken(accountantPassword, 'accountant').token;
  const cashierToken = generateAdminToken(cashierPassword, 'cashier').token;
  const superAdminToken = generateAdminToken(superAdminPassword, 'super_admin').token;

  // ---------------------------------------------------------------------------
  // SECTION 1: FINANCIAL CALCULATION ENGINE ARITHMETIC PRECISION & IEEE-754 DRIFT
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 1: Financial Calculation Engine Precision & Drift ---');

  runTest('roundCurrency handles IEEE-754 floating point drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004
    assert.strictEqual(roundCurrency(0.1 + 0.2), 0.3);
    // 19.994 vs 19.995
    assert.strictEqual(roundCurrency(19.994), 19.99);
    assert.strictEqual(roundCurrency(19.995), 20);
    // Boundary and special numbers
    assert.strictEqual(roundCurrency(0.001), 0);
    assert.strictEqual(roundCurrency(0.005), 0.01);
    assert.strictEqual(roundCurrency(-0.005), -0); // Math.round(-0.5) is -0
    assert.strictEqual(roundCurrency(NaN), 0);
    assert.strictEqual(roundCurrency(Infinity), 0);
    assert.strictEqual(roundCurrency(-Infinity), 0);
  });

  runTest('roundPercentage handles exact 1-decimal rounding', () => {
    // 1/3 = 0.3333333333333333 -> 33.3%
    assert.strictEqual(roundPercentage((1 / 3) * 100), 33.3);
    // 2/3 = 0.6666666666666666 -> 66.7%
    assert.strictEqual(roundPercentage((2 / 3) * 100), 66.7);
    assert.strictEqual(roundPercentage(0), 0);
    assert.strictEqual(roundPercentage(100), 100);
    assert.strictEqual(roundPercentage(NaN), 0);
  });

  // ---------------------------------------------------------------------------
  // SECTION 2: EDGE CASES & ZERO-DIVISION GUARDS
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Financial Edge Cases & Zero Division Protection ---');

  runTest('Zero revenue calculates 0% margins and 0 avgTicket without NaN/Infinity', () => {
    const emptyMetrics = calculateChannelMetrics([], 'online');
    assert.strictEqual(emptyMetrics.orderCount, 0);
    assert.strictEqual(emptyMetrics.grossRevenue, 0);
    assert.strictEqual(emptyMetrics.grossProfit, 0);
    assert.strictEqual(emptyMetrics.grossMarginPercent, 0);
    assert.strictEqual(emptyMetrics.avgTicket, 0);

    const zeroRevenueOrders: Order[] = [
      {
        id: 'zero-1',
        orderNumber: 'ORD-ZERO',
        customerName: 'تجربة',
        customerPhone: '01011112222',
        governorate: 'المنيا',
        address: 'بني مزار',
        items: [],
        subtotal: 0,
        shippingCost: 0,
        discountAmount: 0,
        total: 0,
        paymentMethod: 'cash_on_delivery',
        status: 'delivered',
        createdAt: new Date().toISOString(),
      },
    ];

    const metricsWithZero = calculateChannelMetrics(zeroRevenueOrders, 'online');
    assert.strictEqual(metricsWithZero.orderCount, 1);
    assert.strictEqual(metricsWithZero.grossRevenue, 0);
    assert.strictEqual(metricsWithZero.grossProfit, 0);
    assert.strictEqual(metricsWithZero.grossMarginPercent, 0);
    assert.strictEqual(metricsWithZero.avgTicket, 0);

    const summaryZero = calculateFinancialSummary({ orders: zeroRevenueOrders });
    assert.strictEqual(summaryZero.totalRevenue, 0);
    assert.strictEqual(summaryZero.grossMarginPercent, 0);
    assert.strictEqual(summaryZero.netMarginPercent, 0);
    assert.strictEqual(Number.isNaN(summaryZero.grossMarginPercent), false);
    assert.strictEqual(Number.isNaN(summaryZero.netMarginPercent), false);
  });

  runTest('Cancelled orders are strictly excluded from revenues, COGS and profits', () => {
    const orders: Order[] = [
      {
        id: 'ord-active',
        orderNumber: 'ORD-001',
        customerName: 'عميل نشط',
        customerPhone: '01011112222',
        governorate: 'المنيا',
        address: 'بني مزار',
        items: [{ productId: 'p1', productName: 'فستق', unitPrice: 100, quantity: 2 }],
        subtotal: 200,
        shippingCost: 20,
        discountAmount: 0,
        total: 220,
        rawCostTotal: 120,
        paymentMethod: 'cash_on_delivery',
        status: 'delivered',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-cancelled',
        orderNumber: 'ORD-002',
        customerName: 'عميل ملغي',
        customerPhone: '01033334444',
        governorate: 'المنيا',
        address: 'بني مزار',
        items: [{ productId: 'p1', productName: 'فستق', unitPrice: 500, quantity: 5 }],
        subtotal: 2500,
        shippingCost: 50,
        discountAmount: 0,
        total: 2550,
        rawCostTotal: 1500,
        paymentMethod: 'cash_on_delivery',
        status: 'cancelled', // Must be excluded!
        createdAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateChannelMetrics(orders, 'online');
    assert.strictEqual(metrics.orderCount, 1, 'Cancelled order must not be counted in orderCount');
    assert.strictEqual(metrics.grossRevenue, 220, 'Cancelled order total must not be included');
    assert.strictEqual(metrics.cogs, 120, 'Cancelled order COGS must not be included');
    assert.strictEqual(metrics.grossProfit, 100);
  });

  runTest('COGS evaluation handles empty orders, custom mix, partitioned box, and catalog fallbacks', () => {
    const products: Product[] = [
      {
        id: 'prod-almond',
        name: 'لوز محمص',
        slug: 'roasted-almonds',
        category: 'nuts',
        costPerKg: 350,
        packagingCost: 5,
        stockKg: 50,
        showOnline: true,
        showInPos: true,
        inStock: true,
        variants: [],
      },
      {
        id: 'prod-cashew',
        name: 'كاجو جامبو',
        slug: 'cashew-jumbo',
        category: 'nuts',
        costPerKg: 500,
        packagingCost: 5,
        stockKg: 40,
        showOnline: true,
        showInPos: true,
        inStock: true,
        variants: [],
      },
    ];

    // Empty items
    assert.strictEqual(calculateOrderCogs({} as Order, products), 0);
    assert.strictEqual(calculateOrderCogs({ items: [] } as unknown as Order, products), 0);

    // Custom Mix Box: 50% almond (500g) + 50% cashew (500g) = 0.5*350 + 0.5*500 = 175 + 250 = 425
    const customMixOrder: Order = {
      id: 'mix-1',
      orderNumber: 'MIX-001',
      customerName: 'عميل بوكس',
      customerPhone: '01011112222',
      governorate: 'المنيا',
      address: 'بني مزار',
      items: [
        {
          productId: 'custom-mix-box',
          productName: 'علبة مكسرات مشكلة',
          quantity: 1,
          isCustomMix: true,
          boxCapacityGrams: 1000,
          customBreakdown: [
            { productId: 'prod-almond', productName: 'لوز', percentage: 50, weightGrams: 500 },
            { productId: 'prod-cashew', productName: 'كاجو', percentage: 50, weightGrams: 500 },
          ],
        },
      ],
      subtotal: 600,
      shippingCost: 0,
      discountAmount: 0,
      total: 600,
      paymentMethod: 'cash_on_delivery',
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };
    assert.strictEqual(calculateOrderCogs(customMixOrder, products), 425);

    // Partitioned Box: 4 slots: 2 almond slots (100g each @ 350/kg = 35*2 = 70) + 2 cashew slots (100g each @ 500/kg = 50*2 = 100) = 170
    const partitionedOrder: Order = {
      id: 'part-1',
      orderNumber: 'PART-001',
      customerName: 'عميل مقسم',
      customerPhone: '01011112222',
      governorate: 'المنيا',
      address: 'بني مزار',
      items: [
        {
          productId: 'box-roqan-4',
          productName: 'بوكس روقان 4 خانات',
          quantity: 1,
          isPartitionedBox: true,
          partitionedSlots: [
            { slotIndex: 1, productId: 'prod-almond', productName: 'لوز', slotGrams: 100, costPerKg: 350 },
            { slotIndex: 2, productId: 'prod-almond', productName: 'لوز', slotGrams: 100, costPerKg: 350 },
            { slotIndex: 3, productId: 'prod-cashew', productName: 'كاجو', slotGrams: 100, costPerKg: 500 },
            { slotIndex: 4, productId: 'prod-cashew', productName: 'كاجو', slotGrams: 100, costPerKg: 500 },
          ],
        },
      ],
      subtotal: 250,
      shippingCost: 0,
      discountAmount: 0,
      total: 250,
      paymentMethod: 'cash_on_delivery',
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };
    assert.strictEqual(calculateOrderCogs(partitionedOrder, products), 170);

    // Precomputed rawCostTotal priority
    const precomputedOrder: Order = {
      ...partitionedOrder,
      rawCostTotal: 199.99,
    };
    assert.strictEqual(calculateOrderCogs(precomputedOrder, products), 199.99);
  });

  // ---------------------------------------------------------------------------
  // SECTION 3: POS SHIFT DRAWER RECONCILIATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: POS Shift Drawer Reconciliation ---');

  runTest('Drawer reconciliation computes expected cash and accurate variance types', () => {
    // 1. Balanced: opening 500 + cashSales 1000 - expenses 200 = 1300 expected, actual = 1300 -> variance 0
    const balancedShift: PosShift = {
      id: 'shift-b',
      cashierId: 'c1',
      cashierName: 'كاشير 1',
      openingCash: 500,
      cashSalesTotal: 1000,
      cardSales: 300,
      expensesTotal: 200,
      actualClosingCash: 1300,
      status: 'closed',
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
    };
    const auditB = calculateShiftAudit(balancedShift);
    assert.strictEqual(auditB.expectedCashInDrawer, 1300);
    assert.strictEqual(auditB.variance, 0);
    assert.strictEqual(auditB.varianceType, 'balanced');

    // 2. Shortage: expected 1300, actual 1250 -> variance -50, type 'shortage'
    const shortageShift: PosShift = {
      ...balancedShift,
      id: 'shift-s',
      actualClosingCash: 1250,
    };
    const auditS = calculateShiftAudit(shortageShift);
    assert.strictEqual(auditS.variance, -50);
    assert.strictEqual(auditS.varianceType, 'shortage');

    // 3. Surplus: expected 1300, actual 1380 -> variance +80, type 'surplus'
    const surplusShift: PosShift = {
      ...balancedShift,
      id: 'shift-sur',
      actualClosingCash: 1380,
    };
    const auditSur = calculateShiftAudit(surplusShift);
    assert.strictEqual(auditSur.variance, 80);
    assert.strictEqual(auditSur.varianceType, 'surplus');

    // 4. Open shift (no actual cash counted yet)
    const openShift: PosShift = {
      ...balancedShift,
      id: 'shift-open',
      status: 'open',
      actualClosingCash: undefined,
      actualCash: undefined,
    };
    const auditOpen = calculateShiftAudit(openShift);
    assert.strictEqual(auditOpen.expectedCashInDrawer, 1300);
    assert.strictEqual(auditOpen.actualClosingCash, undefined);
    assert.strictEqual(auditOpen.variance, 0);
    assert.strictEqual(auditOpen.varianceType, 'balanced');
  });

  // ---------------------------------------------------------------------------
  // SECTION 4: DATE RANGE FILTERING LOGIC
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Date Range Filtering Engine ---');

  runTest('Date range filters correctly partition items by preset', () => {
    const now = new Date();
    const todayStr = now.toISOString();
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgoStr = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgoStr = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const items = [
      { id: '1', createdAt: todayStr },
      { id: '2', createdAt: yesterdayStr },
      { id: '3', createdAt: tenDaysAgoStr },
      { id: '4', createdAt: sixtyDaysAgoStr },
    ];

    // 'all'
    assert.strictEqual(filterItemsByDateRange(items, { preset: 'all' }).length, 4);

    // 'today'
    const todayFiltered = filterItemsByDateRange(items, { preset: 'today' });
    assert.strictEqual(todayFiltered.length, 1);
    assert.strictEqual(todayFiltered[0].id, '1');

    // 'this_week' (last 7 rolling days)
    const weekFiltered = filterItemsByDateRange(items, { preset: 'this_week' });
    // today + yesterday should be within 7 days
    assert.strictEqual(weekFiltered.some((i) => i.id === '1'), true);
    assert.strictEqual(weekFiltered.some((i) => i.id === '2'), true);
    assert.strictEqual(weekFiltered.some((i) => i.id === '3'), false); // 10 days ago is out

    // 'custom'
    const customFiltered = filterItemsByDateRange(items, {
      preset: 'custom',
      startDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      endDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    // Only item 3 (10 days ago) falls into this range
    assert.strictEqual(customFiltered.length, 1);
    assert.strictEqual(customFiltered[0].id, '3');
  });

  // ---------------------------------------------------------------------------
  // SECTION 5: ACCOUNTANT RBAC READ-ONLY INVARIANTS (ALL 7 MUTATION ROUTES)
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 5: Accountant RBAC Read-Only Invariants (7 Routes) ---');

  await runTest('1. POST /api/pos returns 403 Forbidden for accountant token', async () => {
    const req = new Request('http://localhost:3000/api/pos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({ action: 'create_invoice' }),
    });

    const res = await postPos(req);
    assert.strictEqual(res.status, 403, 'POST /api/pos must return 403 for accountant');
    const data = await res.json();
    assert.ok(data.error.includes('عزل الأدوار') || data.error.includes('المحاسب'));
  });

  await runTest('2. PUT /api/store returns 403 Forbidden for accountant token', async () => {
    const req = new NextRequest('http://localhost:3000/api/store', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({ settings: { storeName: 'تغيير غير مصرح به' } }),
    });

    const res = await putStore(req);
    assert.strictEqual(res.status, 403, 'PUT /api/store must return 403 for accountant');
    const data = await res.json();
    assert.ok(data.error.includes('403 Forbidden') || data.error.includes('عزل الأدوار'));
  });

  await runTest('3. PATCH /api/orders returns 403 Forbidden for accountant token', async () => {
    const req = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({ orderId: 'ord-test', status: 'delivered' }),
    });

    const res = await patchOrders(req);
    assert.strictEqual(res.status, 403, 'PATCH /api/orders must return 403 for accountant');
    const data = await res.json();
    assert.ok(data.error.includes('عزل الأدوار'));
  });

  await runTest('4. DELETE /api/orders returns 403 Forbidden for accountant token', async () => {
    const req = new NextRequest('http://localhost:3000/api/orders?orderId=ord-test', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accountantToken}`,
      },
    });

    const res = await deleteOrders(req);
    assert.strictEqual(res.status, 403, 'DELETE /api/orders must return 403 for accountant');
    const data = await res.json();
    assert.ok(data.error.includes('403 Forbidden') || data.error.includes('عزل الأدوار'));
  });

  await runTest('5. POST /api/supply-invoices returns 403 Forbidden for accountant token', async () => {
    const req = new Request('http://localhost:3000/api/supply-invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: 'p1', productName: 'بندق', quantityKg: 10, costPerKg: 300 }],
      }),
    });

    const res = await postSupply(req);
    assert.strictEqual(res.status, 403, 'POST /api/supply-invoices must return 403 for accountant');
    const data = await res.json();
    assert.ok(data.error.includes('403 Forbidden') || data.error.includes('تدقيق وقراءة فقط'));
  });

  await runTest('6. PATCH /api/supply-invoices returns 403 Forbidden for accountant token', async () => {
    const req = new Request('http://localhost:3000/api/supply-invoices', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({ invoiceId: 'inv-test', status: 'approved' }),
    });

    const res = await patchSupply(req);
    assert.strictEqual(res.status, 403, 'PATCH /api/supply-invoices must return 403 for accountant');
    const data = await res.json();
    assert.ok(data.error.includes('403 Forbidden') || data.error.includes('تدقيق وقراءة فقط'));
  });

  await runTest('7. POST /api/vip (cashier_sync) returns 403 Forbidden for accountant token', async () => {
    const req = new NextRequest('http://localhost:3000/api/vip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({
        action: 'cashier_sync',
        phone: '01123456789',
        orderAmount: 200,
        cashbackEarned: 10,
      }),
    });

    const res = await postVip(req);
    assert.strictEqual(res.status, 403, 'POST /api/vip cashier_sync must return 403 for accountant');
    const data = await res.json();
    assert.ok(data.error.includes('403 Forbidden') || data.error.includes('عزل الأدوار'));
  });

  // ---------------------------------------------------------------------------
  // SECTION 6: ACCOUNTANT UNREDACTED READ ACCESS & PASSWORD PRIVACY
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 6: Accountant Unredacted Read Access & Password Privacy ---');

  await runTest('GET /api/pos provides unredacted profits and costs to accountant vs sanitized for cashier', async () => {
    // Accountant Request
    const accReq = new Request('http://localhost:3000/api/pos', {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    const accRes = await getPos(accReq);
    assert.strictEqual(accRes.status, 200);
    const accData = await accRes.json();

    // Cashier Request
    const cashReq = new Request('http://localhost:3000/api/pos', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const cashRes = await getPos(cashReq);
    assert.strictEqual(cashRes.status, 200);
    const cashData = await cashRes.json();

    // If there are shifts or orders with cost/profit, verify accountant can see them
    if (accData.activeShift) {
      assert.strictEqual(typeof accData.activeShift.openingCash, 'number');
    }
    // Check recentPosOrders sanitization
    if (accData.recentPosOrders && accData.recentPosOrders.length > 0) {
      const accOrder = accData.recentPosOrders.find((o: Order) => typeof o.rawCostTotal === 'number');
      const cashOrder = cashData.recentPosOrders.find((o: Order) => o.id === accOrder?.id);
      if (accOrder && cashOrder) {
        assert.ok(accOrder.rawCostTotal !== undefined, 'Accountant MUST see rawCostTotal');
        assert.strictEqual(cashOrder.rawCostTotal, undefined, 'Cashier MUST NOT see rawCostTotal');
      }
    }
  });

  await runTest('GET /api/store returns unredacted catalog & orders to accountant, with all passwords stripped', async () => {
    const req = new NextRequest('http://localhost:3000/api/store', {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    const res = await getStore(req);
    assert.strictEqual(res.status, 200);
    const storeData = await res.json();

    // Verify unredacted product costs
    assert.ok(Array.isArray(storeData.products) && storeData.products.length > 0);
    const productWithCost = storeData.products.find((p: Product) => typeof p.costPerKg === 'number');
    assert.ok(productWithCost, 'Accountant must see product costPerKg');
    assert.ok(productWithCost.costPerKg > 0);

    // Verify unredacted orders, posShifts, posExpenses
    assert.ok(Array.isArray(storeData.orders), 'Accountant must receive orders array');
    assert.ok(Array.isArray(storeData.posShifts), 'Accountant must receive posShifts array');
    assert.ok(Array.isArray(storeData.posExpenses), 'Accountant must receive posExpenses array');

    // CRITICAL SECURITY INVARIANT: All passwords must be stripped!
    const settings = storeData.settings;
    assert.strictEqual(settings.adminPassword, undefined, 'adminPassword must be stripped');
    assert.strictEqual(settings.supplierPassword, undefined, 'supplierPassword must be stripped');
    assert.strictEqual(settings.cashierPassword, undefined, 'cashierPassword must be stripped');
    assert.strictEqual(settings.accountantPassword, undefined, 'accountantPassword must be stripped');
    assert.strictEqual(settings.adminUsername, undefined, 'adminUsername must be stripped');
  });

  await runTest('GET /api/supply-invoices returns all vendor invoices for accountant', async () => {
    const req = new Request('http://localhost:3000/api/supply-invoices', {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    const res = await getSupply(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.invoices));
  });

  // ---------------------------------------------------------------------------
  // SECTION 7: CSV EXPORT SECURITY & EXCEL COMPATIBILITY
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 7: CSV Export Security & Arabic Excel Compatibility ---');

  runTest('CSV generators prepend UTF-8 BOM (\\uFEFF) and use RFC 4180 CRLF line endings', () => {
    const summary = calculateFinancialSummary({});
    const csvSummary = generateFinancialSummaryCsv(summary);

    const dummyShift: PosShift = {
      id: 'shift-1',
      cashierName: 'كاشير التجربة',
      openingCash: 500,
      cashSalesTotal: 1000,
      expensesTotal: 50,
      actualClosingCash: 1450,
      status: 'closed',
      openedAt: new Date().toISOString(),
    };
    const dummyExpense: PosExpense = {
      id: 'exp-1',
      title: 'أكياس تعبئة',
      amount: 45,
      category: 'packaging',
      createdAt: new Date().toISOString(),
    };
    const dummyInvoice: SupplyInvoice = {
      id: 'inv-1',
      invoiceNumber: 'SUP-001',
      supplierName: 'مورد عرفات',
      status: 'approved',
      createdAt: new Date().toISOString(),
      totalAmount: 5000,
      items: [
        { productId: 'p1', productName: 'لوز', quantityKg: 10, costPerKg: 500, totalCost: 5000 },
      ],
    };

    const csvShifts = generateShiftsAuditCsv([dummyShift]);
    const csvExpenses = generateExpensesLedgerCsv([dummyExpense]);
    const csvSupply = generateSupplyLedgerCsv([dummyInvoice]);

    for (const [name, csv] of [
      ['summary', csvSummary],
      ['shifts', csvShifts],
      ['expenses', csvExpenses],
      ['supply', csvSupply],
    ]) {
      // Must start with BOM \uFEFF (charCode 0xFEFF)
      assert.strictEqual(
        csv.charCodeAt(0),
        0xfeff,
        `${name} CSV must begin with UTF-8 BOM \\uFEFF`
      );
      // Must use CRLF
      assert.ok(csv.includes('\r\n'), `${name} CSV must use CRLF (\\r\\n) line endings`);
      // Must not contain unescaped lone LFs (except as part of CRLF)
      const nonCrlfLf = csv.replace(/\r\n/g, '').includes('\n');
      assert.strictEqual(nonCrlfLf, false, `${name} CSV must not contain lone LF`);
    }

    // Also verify empty datasets still prepend BOM
    assert.strictEqual(generateShiftsAuditCsv([]).charCodeAt(0), 0xfeff);
    assert.strictEqual(generateExpensesLedgerCsv([]).charCodeAt(0), 0xfeff);
    assert.strictEqual(generateSupplyLedgerCsv([]).charCodeAt(0), 0xfeff);
  });

  runTest('CWE-1236 Formula Injection triggers are thoroughly neutralized with single-quote prefix', () => {
    const maliciousTriggers = [
      '=cmd|\' /C calc\'!A0',
      '+1+2',
      '-5+10',
      '@SUM(A1:A10)',
      '\tDDE("cmd";"/C calc";"__dummy__")',
      '\r=1+1',
      '   =HYPERLINK("http://attacker.com")',
      '   +cmd',
      '   -calc',
      '   @leak',
    ];

    for (const payload of maliciousTriggers) {
      const escaped = escapeCsvField(payload);
      assert.ok(
        escaped.startsWith("\"'") || escaped.startsWith("\" '"),
        `Payload "${payload}" must be prepended with single quote to neutralize formula injection. Got: ${escaped}`
      );
    }

    // Legitimate numbers must NOT have single quote prepended
    assert.strictEqual(escapeCsvField(100.5), '"100.5"');
    assert.strictEqual(escapeCsvField(0), '"0"');
    assert.strictEqual(escapeCsvField(-25.5), '"-25.5"');

    // Legitimate Arabic strings without formula triggers must NOT have single quote prepended
    assert.strictEqual(escapeCsvField('محمصة حفصة للبن والمكسرات'), '"محمصة حفصة للبن والمكسرات"');
    assert.strictEqual(escapeCsvField('بني مزار - المنيا'), '"بني مزار - المنيا"');
  });

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`CHALLENGER STRESS SUITE COMPLETED`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error('Failed Tests:');
    for (const f of failures) {
      console.error(`- ${f}`);
    }
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
