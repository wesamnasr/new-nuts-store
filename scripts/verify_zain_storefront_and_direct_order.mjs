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
const DB_PATH = path.join(ROOT_DIR, 'data', 'store-db.json');

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
console.log('  ZAIN STOREFRONT, AUTO-SLIDESHOW & DIRECT PRODUCT ORDER SUITE');
console.log('==================================================================');

const originalDbRaw = fs.readFileSync(DB_PATH, 'utf8');

try {
  // 1. Zain Landing Page Structure, Palette & Floating WhatsApp
  await check('ZN_01: Landing page mirrors Zain Nuts structure, #682e28 header, circular categories & #59ce72 FloatingWhatsApp', () => {
    const pageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/page.tsx'), 'utf8');
    const pageLines = pageRaw.split(/\r?\n/).length;
    assert.ok(pageLines < 100, `src/app/page.tsx must stay < 100 lines (found ${pageLines})`);
    assert.ok(pageRaw.includes('HeroSection'), 'HomePage must render HeroSection');
    assert.ok(pageRaw.includes('CategoriesGridSection'), 'HomePage must render CategoriesGridSection');
    assert.ok(pageRaw.includes('SpecialOffersAndBoxesSection'), 'HomePage must render SpecialOffersAndBoxesSection');
    assert.ok(pageRaw.includes('BestSellersSection'), 'HomePage must render BestSellersSection');
    assert.ok(pageRaw.includes('ZainLandingSections'), 'HomePage must render ZainLandingSections');

    const navbarRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Navbar.tsx'), 'utf8');
    assert.ok(navbarRaw.includes('#682e28'), 'Navbar must use Zain rich brown #682e28');
    assert.ok(navbarRaw.includes('zain-marquee-track'), 'Navbar must include scrolling announcement marquee');
    assert.ok(navbarRaw.includes('شريط التنقل السفلي للموبايل'), 'Navbar must include mobile sticky bottom 4-tab bar');

    const catsRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/home/CategoriesGridSection.tsx'), 'utf8');
    assert.ok(catsRaw.includes('تسوق من الأقسام'), 'CategoriesGridSection must display "تسوق من الأقسام"');
    assert.ok(catsRaw.includes('rounded-full'), 'CategoriesGridSection must use circular category thumbnails');

    const landingExtraRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/modules/storefront/ZainLandingSections.tsx'), 'utf8');
    assert.ok(landingExtraRaw.includes('الأسئلة الشائعة'), 'ZainLandingSections must include FAQ accordion');
    assert.ok(landingExtraRaw.includes('آراء عملائنا'), 'ZainLandingSections must include WhatsApp customer reviews');

    const floatingWaRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/FloatingWhatsApp.tsx'), 'utf8');
    assert.ok(floatingWaRaw.includes('#59ce72'), 'FloatingWhatsApp must render #59ce72 floating launcher');
    assert.ok(!floatingWaRaw.includes('return null;\n}'), 'FloatingWhatsApp must not unconditionally return null');
  });

  // 2. Weight & Quantity Preservation
  await check('ZN_02: All existing product weight/quantity options (125g, 250g, 500g, 1000g & units) are 100% preserved', async () => {
    const db = JSON.parse(originalDbRaw);
    const weightProducts = db.products.filter((p) => p.sellingMode !== 'unit');
    assert.ok(weightProducts.length > 0, 'Must have weight-based products');
    for (const p of weightProducts) {
      const grams = p.weights.map((w) => w.grams || w.weightGrams);
      assert.deepEqual(grams, [125, 250, 500, 1000], `Weights preserved on ${p.id}`);
    }

    const cardRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/ProductCard.tsx'), 'utf8');
    assert.ok(cardRaw.includes('resolvedWeights.map'), 'ProductCard must render all resolvedWeights');
    const detailRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/product/ProductDetailClient.tsx'), 'utf8');
    assert.ok(detailRaw.includes('availableWeights.map'), 'ProductDetailClient must render all availableWeights');
  });

  // 3. Multi-Image Gallery & Auto-Slideshow
  await check('ZN_03: Multi-image gallery seeded in DB, editable in Admin, and auto-advancing in ProductAutoSlideshow', async () => {
    const db = JSON.parse(originalDbRaw);
    const multiImageProducts = db.products.filter((p) => Array.isArray(p.gallery) && p.gallery.length >= 2);
    assert.ok(
      multiImageProducts.length >= 20,
      `Expected >= 20 products with multi-image gallery, found ${multiImageProducts.length}`
    );

    const slideshowRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/modules/catalog/ProductAutoSlideshow.tsx'), 'utf8');
    assert.ok(slideshowRaw.includes('window.setInterval'), 'ProductAutoSlideshow must auto-advance slides via setInterval');
    assert.ok(slideshowRaw.includes('autoPlayIntervalMs = 3500'), 'ProductAutoSlideshow must default to 3500ms interval');

    const adminRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/admin/page.tsx'), 'utf8');
    assert.ok(adminRaw.includes('ProductGalleryEditor'), 'Admin page must integrate ProductGalleryEditor');

    const authLib = await import('../src/lib/auth.ts');
    const sanitized = authLib.sanitizePublicStoreData(db);
    assert.ok(
      Array.isArray(sanitized.products[0].gallery) && sanitized.products[0].gallery.length >= 2,
      'sanitizePublicStoreData must preserve product.gallery array for public storefront'
    );
  });

  // 4. Direct In-Page Ordering via POST /api/orders (Ad Landing Flow)
  await check('ZN_04: Direct product page order submits cleanly with Name + Eastern-digit Mobile & deducts stock atomically', async () => {
    const detailRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/product/ProductDetailClient.tsx'), 'utf8');
    assert.ok(detailRaw.includes('<DirectProductOrderForm'), 'ProductDetailClient must embed DirectProductOrderForm');

    const formRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/modules/orders/DirectProductOrderForm.tsx'), 'utf8');
    assert.ok(formRaw.includes("fetch('/api/orders'"), 'DirectProductOrderForm must POST directly to /api/orders');
    assert.ok(formRaw.includes('id="direct-order-box"'), 'DirectProductOrderForm must expose #direct-order-box anchor');

    const ordersRoute = await import('../src/app/api/orders/route.ts');
    const dbBefore = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const targetProduct = dbBefore.products.find((p) => p.inStock && p.sellingMode !== 'unit' && p.stockKg >= 2);
    assert.ok(targetProduct, 'Must find an in-stock weight product for E2E direct order test');

    const chosenWeight = targetProduct.weights.find((w) => (w.grams || w.weightGrams) === 500) || targetProduct.weights[0];
    const stockBefore = targetProduct.stockKg;

    const req = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'عميل إعلان مباشر',
        customerPhone: '٠١٠١٢٣٤٥٦٧٨',
        governorate: 'المنطقة المركزية ومحيط الفرع',
        deliveryMethod: 'bandar_fast',
        address: 'المنطقة المركزية — شارع الجمهورية بجوار البنك',
        notes: 'طلب سريع مباشر من صفحة المنتج',
        paymentMethod: 'cod',
        items: [
          {
            cartItemId: `direct-${targetProduct.id}-${chosenWeight.id}`,
            productId: targetProduct.id,
            productName: targetProduct.name,
            productImage: targetProduct.image,
            weightId: chosenWeight.id,
            weightLabel: chosenWeight.label,
            customWeightGrams: chosenWeight.weightGrams || chosenWeight.grams || 500,
            roastOption: targetProduct.roastOptions?.[0] || '',
            unitPrice: chosenWeight.price,
            quantity: 1,
          },
        ],
      }),
    });

    const res = await ordersRoute.POST(req);
    assert.equal(res.status, 201, 'Direct order POST /api/orders must return HTTP 201');
    const body = await res.json();
    assert.ok(body.order?.orderNumber, 'Created order must return orderNumber');
    assert.equal(body.order.customerPhone, '01012345678', 'Eastern Arabic mobile digits must normalize to 01012345678');

    const dbAfter = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const updatedProduct = dbAfter.products.find((p) => p.id === targetProduct.id);
    const expectedDeltaKg = (chosenWeight.weightGrams || chosenWeight.grams || 500) / 1000;
    assert.ok(
      Math.abs((stockBefore - updatedProduct.stockKg) - expectedDeltaKg) < 0.001,
      `Stock must decrease by ${expectedDeltaKg}kg (before=${stockBefore}, after=${updatedProduct.stockKg})`
    );
  });
} finally {
  // Always restore store-db.json cleanly
  fs.writeFileSync(DB_PATH, originalDbRaw, 'utf8');
}

console.log('==================================================================');
console.log(`  TOTAL: ${passed} passed, ${failed} failed`);
console.log('==================================================================');

process.exit(failed > 0 ? 1 : 0);
