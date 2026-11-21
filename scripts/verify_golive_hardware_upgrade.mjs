import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isRunningUnderTsx = Boolean(
  process.env.TSX_EXEC_ACTIVE || process.execArgv.some((arg) => arg.includes('tsx'))
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

process.env.HAFSA_LOCAL_DB_ONLY = '1';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err?.stack || err?.message || err}`);
  }
}

console.log('==================================================================');
console.log('  GO-LIVE HARDWARE & PRODUCTION SECURITY VERIFICATION SUITE');
console.log('==================================================================');

// 1. Live Runtime Tests of Pure-TS Pricing, Barcode & Catalog Modules
const pricing = await import('../src/lib/pricing.ts');
const catalogCsv = await import('../src/modules/catalog/catalog-csv.ts');

await check('GL_01: Unknown scale barcode PLU returns null instead of silently selling products[0]', () => {
  const catalog = [
    {
      id: 'p-1',
      slug: 'cashew',
      name: 'كاجو ملكي',
      subtitle: '',
      categoryId: 'cat-1',
      description: '',
      image: '',
      origin: '',
      nutritionalHighlight: '',
      caloriesPer100g: 0,
      proteinPer100g: '0g',
      roastOptions: ['سادة'],
      pluCode: 1,
      pricePerKg: 800,
      costPerKg: 600,
      inStock: true,
      featured: false,
      rating: 5,
      reviewsCount: 0,
      weights: pricing.generateWeightsFromKiloPrice(800),
    },
  ];
  // Valid PLU 0001 -> matches p-1
  const validScan = pricing.parseScaleBarcode('200001002507', catalog);
  assert.ok(validScan, 'Valid PLU 0001 must resolve');
  assert.equal(validScan.product.id, 'p-1');
  assert.equal(validScan.barcodeKind, 'scale_weight');

  // Unknown PLU 9999 -> MUST return null (never products[0]!)
  const unknownScan = pricing.parseScaleBarcode('209999002500', catalog);
  assert.equal(unknownScan, null, 'Unknown PLU 9999 must return null');
});

await check('GL_02: Datalogic 20-Beam Scanner handles Windows Arabic keyboard layout & Eastern numerals', () => {
  // Eastern Arabic numerals ٦٢٢٣٠٠١٢٣٤٥٦٧ -> 6223001234567
  const normDigits = pricing.normalizeBarcodeScanInput('٦٢٢٣٠٠١٢٣٤٥٦٧');
  assert.equal(normDigits, '6223001234567');

  // POS order code scanned while Windows keyboard is set to Arabic ("حخس-1042" -> "POS-1042")
  const normOrderCode = pricing.normalizeBarcodeScanInput('حخس-١٠٤٢');
  assert.equal(normOrderCode, 'POS-1042');

  // Physical KeyboardEvent.code mapping ignores OS layout completely
  assert.equal(pricing.mapPhysicalScannerKeyToAscii({ code: 'Digit6', key: '٦', shiftKey: false }), '6');
  assert.equal(pricing.mapPhysicalScannerKeyToAscii({ code: 'Numpad9', key: '9', shiftKey: false }), '9');
  assert.equal(pricing.mapPhysicalScannerKeyToAscii({ code: 'KeyP', key: 'ح', shiftKey: true }), 'P');
  assert.equal(pricing.mapPhysicalScannerKeyToAscii({ code: 'Minus', key: '-', shiftKey: false }), '-');
});

await check('GL_03: Rapid Barcode Upsert & Market CSV Import/Export preserve weights, stock & prices', () => {
  const categories = [
    { id: 'cat-market', name: 'بقالة وسوبرماركت', slug: 'market', description: '', icon: 'Box', image: '' },
  ];

  // 1) Scan new unit product
  const step1 = catalogCsv.upsertRapidScannedProduct(
    {
      barcode: '6223005551112',
      name: 'نسكافيه جولد 100 جم',
      categoryId: 'cat-market',
      sellingMode: 'unit',
      retailPrice: 165,
      costPrice: 135,
      stockQty: 24,
      unitLabel: 'برطمان',
    },
    [],
    categories
  );
  assert.equal(step1.isUpdate, false);
  assert.equal(step1.nextProducts.length, 1);
  assert.equal(step1.product.unitPrice, 165);
  assert.equal(step1.product.stockKg, 24);

  // 2) Re-scan existing barcode with stock increment (+12) -> total 36
  const step2 = catalogCsv.upsertRapidScannedProduct(
    {
      barcode: '٦٢٢٣٠٠٥٥٥١١١٢',
      name: 'نسكافيه جولد 100 جم',
      categoryId: 'cat-market',
      sellingMode: 'unit',
      retailPrice: 170,
      costPrice: 138,
      stockQty: 12,
      unitLabel: 'برطمان',
      stockOperation: 'increment',
    },
    step1.nextProducts,
    categories
  );
  assert.equal(step2.isUpdate, true);
  assert.equal(step2.nextProducts.length, 1);
  assert.equal(step2.product.stockKg, 36);
  assert.equal(step2.product.unitPrice, 170);

  // 3) Export to CSV and re-import with an additional row
  const exportedCsv = catalogCsv.generateCatalogProductsCsv(step2.nextProducts, categories);
  assert.ok(exportedCsv.startsWith('\uFEFF'), 'Catalog CSV must include UTF-8 BOM for Excel');
  const augmentedCsv =
    exportedCsv +
    '\r\n200055,جبنة رومي قديمة,بقالة وسوبرماركت,وزن,320,260,15,كجم,نعم,نعم';
  const imported = catalogCsv.parseCatalogProductsCsv(augmentedCsv, step2.nextProducts, categories);
  assert.equal(imported.createdCount, 1);
  assert.equal(imported.updatedCount, 1);
  assert.equal(imported.mergedProducts.length, 2);
  const cheese = imported.mergedProducts.find((p) => p.barcode === '200055');
  assert.ok(cheese && cheese.weights.length === 4, 'Weight product from CSV must generate 4 standard weights');
});

await check('GL_04: Security Backdoors Closed (x-demo-quick-entry disabled, upload-image & telegram-test auth fixed)', () => {
  const loginRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/admin/login/route.ts'), 'utf8');
  assert.ok(
    loginRaw.includes("process.env.MIZAN_ALLOW_DEMO_QUICK_ENTRY === '1'"),
    'x-demo-quick-entry must be locked behind explicit MIZAN_ALLOW_DEMO_QUICK_ENTRY === "1"'
  );

  for (const portalFile of [
    'src/app/admin/page.tsx',
    'src/app/pos/page.tsx',
    'src/app/supplier/page.tsx',
    'src/app/rider/page.tsx',
  ]) {
    const raw = fs.readFileSync(path.join(ROOT_DIR, portalFile), 'utf8');
    assert.ok(
      !raw.includes('x-demo-quick-entry'),
      `${portalFile} must NOT inject x-demo-quick-entry bypass header`
    );
  }

  const uploadRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/admin/upload-image/route.ts'), 'utf8');
  assert.ok(
    uploadRaw.includes('!auth.isAuthenticated') && uploadRaw.includes('await getDbAsync()'),
    'upload-image route must hydrate DB on cold start and check !auth.isAuthenticated'
  );

  const tgTestRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/admin/telegram-test/route.ts'), 'utf8');
  assert.ok(
    tgTestRaw.includes('!auth.isAuthenticated'),
    'telegram-test route must check !auth.isAuthenticated'
  );

  const authRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/auth.ts'), 'utf8');
  assert.ok(
    authRaw.includes('process.env.ADMIN_SESSION_SECRET') && authRaw.includes('process.env.ADMIN_JWT_SECRET'),
    'auth.ts must accept both ADMIN_SESSION_SECRET and ADMIN_JWT_SECRET'
  );
});

await check('GL_05: POS Idempotency, SKU Cart Deduplication, Offline Shift Guard & Rongta 58mm/80mm Support', () => {
  const posApiRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/pos/route.ts'), 'utf8');
  assert.ok(
    posApiRaw.includes('cleanClientOrderId') && posApiRaw.includes('deduplicated: true'),
    '/api/pos must enforce server-side clientOrderId idempotency'
  );

  const posPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/pos/page.tsx'), 'utf8');
  assert.ok(
    posPageRaw.includes('`pos-sku-${product.id}-${weightId}`'),
    'pos/page.tsx must assign deterministic cartItemId for SKU scans so quantities merge'
  );
  assert.ok(
    posPageRaw.includes('clientOrderId') && posPageRaw.includes('AbortController'),
    'pos/page.tsx must pass clientOrderId and enforce timeout fallback on USB Wi-Fi drops'
  );
  assert.ok(
    posPageRaw.includes('pendingOffline.length > 0') && posPageRaw.includes('syncPosOfflineQueue(posToken)'),
    'handleCloseShift must auto-sync and guard against unsynced offline invoices'
  );

  const receiptRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/SupermarketReceiptModal.tsx'), 'utf8');
  assert.ok(
    receiptRaw.includes('thermalPaperWidthMm === 58') && receiptRaw.includes('52mm'),
    'SupermarketReceiptModal must support 58mm Rongta paper width alongside 80mm'
  );

  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'src/app/api/admin/backup/route.ts')),
    '/api/admin/backup full snapshot endpoint must exist'
  );
  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'scripts/launch_mizan_pos_kiosk.bat')),
    'Windows 4GB-RAM silent printing kiosk launcher .bat must exist'
  );
});

await check('GL_06: Live API Route Runtime Tests (Login Security, Upload Auth, POS Idempotency & Backup API)', async () => {
  const dbPath = path.join(ROOT_DIR, 'data', 'store-db.json');
  const originalDbRaw = fs.readFileSync(dbPath, 'utf8');
  try {
    const { NextRequest } = await import('next/server');
    const { generateAdminToken } = await import('../src/lib/auth.ts');
    const { getDbAsync } = await import('../src/lib/db.ts');
    const { POST: loginPOST } = await import('../src/app/api/admin/login/route.ts');
    const { POST: uploadPOST } = await import('../src/app/api/admin/upload-image/route.ts');
    const { GET: backupGET } = await import('../src/app/api/admin/backup/route.ts');
    const { POST: posPOST } = await import('../src/app/api/pos/route.ts');

    // 1) Unauthenticated x-demo-quick-entry MUST be rejected with 401
    const bypassReq = new NextRequest('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-quick-entry': '1',
      },
      body: JSON.stringify({ username: '', password: '' }),
    });
    const bypassRes = await loginPOST(bypassReq);
    assert.equal(bypassRes.status, 401, 'x-demo-quick-entry without env flag MUST return 401');

    // 2) Unauthenticated /api/admin/upload-image MUST be rejected with 401 (previously returned 400 due to !auth bug!)
    const unauthUploadReq = new NextRequest('http://localhost:3000/api/admin/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=' }),
    });
    const unauthUploadRes = await uploadPOST(unauthUploadReq);
    assert.equal(unauthUploadRes.status, 401, 'Unauthenticated upload-image MUST return 401');

    // 3) Super Admin Full Backup GET returns 200 with all collections, Cashier gets 403
    const db = await getDbAsync();
    const adminPass = db.settings?.adminPassword || 'Hafsa@Admin2026';
    const cashierPass = db.settings?.cashierPassword || 'Cash#Pos2026';
    const adminSession = generateAdminToken(adminPass, 'super_admin');
    const cashierSession = generateAdminToken(cashierPass, 'cashier');

    const cashierBackupRes = await backupGET(
      new NextRequest('http://localhost:3000/api/admin/backup', {
        method: 'GET',
        headers: { Authorization: `Bearer ${cashierSession.token}` },
      })
    );
    assert.equal(cashierBackupRes.status, 403, 'Cashier must be blocked from full DB backup');

    const adminBackupRes = await backupGET(
      new NextRequest('http://localhost:3000/api/admin/backup', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminSession.token}` },
      })
    );
    assert.equal(adminBackupRes.status, 200, 'Super admin must receive 200 on full DB backup');
    const backupJson = await adminBackupRes.json();
    assert.equal(backupJson.backupVersion, 2);
    assert.ok(Array.isArray(backupJson.data?.products) && Array.isArray(backupJson.data?.posShifts));

    // 4) POS create_invoice Idempotency: submitting the exact same clientOrderId twice depletes stock ONLY ONCE
    const targetProd = db.products.find((p) => p.showInPos !== false && p.inStock && (p.stockKg || 0) > 2);
    assert.ok(targetProd, 'Must find an in-stock POS product for idempotency test');
    const stockBefore = targetProd.stockKg;
    const idemKey = `pos-idem-test-${Date.now()}`;
    const invoiceBody = {
      action: 'create_invoice',
      clientOrderId: idemKey,
      registerId: 'reg-1',
      paymentMethod: 'cod',
      cashTendered: 500,
      items: [
        {
          cartItemId: `pos-sku-${targetProd.id}-w-250`,
          productId: targetProd.id,
          productName: targetProd.name,
          productImage: targetProd.image || '',
          weightId: 'w-250',
          weightLabel: 'ربع كيلو (250 جم)',
          roastOption: 'سادة',
          unitPrice: 100,
          quantity: 1,
          customWeightGrams: 250,
        },
      ],
    };

    const posRes1 = await posPOST(
      new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierSession.token}`,
        },
        body: JSON.stringify(invoiceBody),
      })
    );
    assert.equal(posRes1.status, 201, 'First create_invoice with clientOrderId must return 201');
    const posJson1 = await posRes1.json();
    const dbAfterFirst = await getDbAsync();
    const stockAfterFirst = dbAfterFirst.products.find((p) => p.id === targetProd.id).stockKg;

    // Duplicate retry (simulating USB Wi-Fi retry)
    const posRes2 = await posPOST(
      new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierSession.token}`,
        },
        body: JSON.stringify(invoiceBody),
      })
    );
    assert.equal(posRes2.status, 200, 'Duplicate retry with same clientOrderId must return 200');
    const posJson2 = await posRes2.json();
    assert.equal(posJson2.deduplicated, true, 'Duplicate retry must flag deduplicated: true');
    assert.equal(posJson2.order.orderNumber, posJson1.order.orderNumber, 'Must return exact same orderNumber');

    const dbAfterSecond = await getDbAsync();
    const stockAfterSecond = dbAfterSecond.products.find((p) => p.id === targetProd.id).stockKg;
    assert.equal(
      stockAfterSecond,
      stockAfterFirst,
      `Stock must NOT be depleted twice on retry (before=${stockBefore}, first=${stockAfterFirst}, second=${stockAfterSecond})`
    );
  } finally {
    fs.writeFileSync(dbPath, originalDbRaw, 'utf8');
  }
});

console.log('------------------------------------------------------------------');
console.log(`  Summary: ${passed} passed, ${failed} failed`);
console.log('==================================================================');

process.exit(failed > 0 ? 1 : 0);
