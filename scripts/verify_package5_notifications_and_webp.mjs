/**
 * Package 5 Verification Suite: Real-Time Audio Chimes, Telegram Bot Alerts & WebP Uploads
 * Target: محمصة حفصة للبن والمكسرات — فرع بني مزار (HAFSA ROASTERY)
 * Runtime: Node.js v24+ Native ESM
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${name}`);
  } catch (err) {
    console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

async function runPackage5Verification() {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}RUNNING PACKAGE 5 VERIFICATION: AUDIO CHIMES, TELEGRAM BOT & WEBP${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  // 1. Verify Telegram HTML Escaping and Message Formatters
  await test('P5_TEL_01: Telegram HTML Escaper and Rich Arabic Formatters Contract', async () => {
    const telegramLib = await import('../src/lib/telegram.ts');
    
    // HTML Escaper
    assert.equal(
      telegramLib.escapeTelegramHtml('بن محوج <خاص> & مكسرات "فاخرة"'),
      'بن محوج &lt;خاص&gt; &amp; مكسرات "فاخرة"'
    );

    // Dummy Order Formatter
    const dummyOrder = {
      id: 'ord-test-1',
      orderNumber: 'NUT-9988',
      customerName: 'أحمد محمود بني مزار',
      customerPhone: '01012345678',
      address: 'شارع الجمهورية - أمام بنك مصر',
      deliveryMethod: 'bandar_fast',
      paymentMethod: 'cod',
      subtotal: 350,
      shippingCost: 20,
      discountAmount: 15,
      couponCode: 'HAFSA10',
      total: 355,
      items: [
        {
          cartItemId: 'item-1',
          productId: 'prod-pistachio',
          productName: 'فستق أمريكي جامبو محمص',
          weightLabel: '250 جم',
          roastOption: 'محمص مملح',
          unitPrice: 240,
          quantity: 1,
        },
        {
          cartItemId: 'item-2',
          productId: 'prod-coffee-royal',
          productName: 'بن حفصة الملكي مخصوص',
          weightLabel: 'ثمن 125 جم',
          roastOption: 'وسط محوج',
          unitPrice: 110,
          quantity: 1,
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    const orderMsg = telegramLib.formatOrderTelegramMessage(dummyOrder, {
      storeName: 'محمصة حفصة للبن والمكسرات',
    });

    assert.ok(orderMsg.includes('NUT-9988'), 'Must include order number');
    assert.ok(orderMsg.includes('أحمد محمود بني مزار'), 'Must include customer name');
    assert.ok(orderMsg.includes('01012345678'), 'Must include customer phone');
    assert.ok(orderMsg.includes('355 جنيه مصري'), 'Must include total price');
    assert.ok(orderMsg.includes('توصيل فوري لبندر بني مزار'), 'Must include delivery label');
    assert.ok(orderMsg.includes('فستق أمريكي جامبو محمص'), 'Must list ordered items');

    // Supply Invoice Formatter
    const dummyInvoice = {
      id: 'inv-test-1',
      invoiceNumber: 'SUP-7701',
      supplierId: 'staff-supplier-1',
      supplierName: 'الحاج عرفات للمكسرات',
      totalAmount: 12500,
      status: 'pending',
      items: [
        {
          productId: 'prod-cashew',
          productName: 'كاجو فيتنامي محمص جامبو',
          quantityKg: 25,
          costPerKg: 500,
          totalCost: 12500,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const invoiceMsg = telegramLib.formatSupplyInvoiceTelegramMessage(dummyInvoice);
    assert.ok(invoiceMsg.includes('SUP-7701'), 'Must include supply invoice number');
    assert.ok(invoiceMsg.includes('الحاج عرفات للمكسرات'), 'Must include supplier name');
    assert.ok(invoiceMsg.includes('12500 جنيه مصري'), 'Must include total supply amount');
    assert.ok(invoiceMsg.includes('25 كجم'), 'Must include item weight in kg');

    // POS Shift Z-Report Formatter
    const dummyShift = {
      id: 'shift-test-1',
      shiftNumber: 'SHIFT-505',
      cashierName: 'كاشير الفرع الرئيسي',
      shiftPeriod: 'الوردية المسائية',
      status: 'closed',
      ordersCount: 42,
      totalRevenue: 8450,
      startingCash: 500,
      openingCash: 500,
      cashSalesTotal: 6200,
      cardSalesTotal: 1850,
      vodafoneCashTotal: 400,
      instapayTotal: 0,
      vipRedeemedTotal: 0,
      vipCashbackIssuedTotal: 210,
      expensesTotal: 150,
      expectedCashInDrawer: 6550,
      actualClosingCash: 6550,
      variance: 0,
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
    };

    const zReportMsg = telegramLib.formatShiftZReportTelegramMessage(dummyShift);
    assert.ok(zReportMsg.includes('SHIFT-505'), 'Must include shift number');
    assert.ok(zReportMsg.includes('8450 جنيه مصري'), 'Must include total revenue');
    assert.ok(zReportMsg.includes('6550 ج.م'), 'Must include cash drawer amount');
    assert.ok(zReportMsg.includes('1850 ج.م'), 'Must include card sales amount');
    assert.ok(zReportMsg.includes('مطابق تماماً'), 'Must include zero variance success label');
  });

  // 2. Verify Telegram Dispatcher & Settings Guardrails
  await test('P5_TEL_02: Telegram Dispatcher Settings Guardrails & Non-Blocking Resilience', async () => {
    const telegramLib = await import('../src/lib/telegram.ts');

    // Disabled in settings
    const resDisabled = await telegramLib.sendStoreTelegramAlert(
      { telegramNotificationsEnabled: false },
      'new_order',
      {}
    );
    assert.equal(resDisabled.skipped, true, 'Must skip when telegramNotificationsEnabled is false');

    // Missing token
    const resMissing = await telegramLib.sendStoreTelegramAlert(
      { telegramNotificationsEnabled: true, telegramBotToken: '' },
      'new_order',
      {}
    );
    assert.equal(resMissing.skipped, true, 'Must skip when token is missing');

    // Granular toggle off for z-report
    const resZToggle = await telegramLib.sendStoreTelegramAlert(
      {
        telegramNotificationsEnabled: true,
        telegramBotToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
        telegramChatId: '-100123456789',
        telegramNotifyZReport: false,
      },
      'z_report',
      {}
    );
    assert.equal(resZToggle.skipped, true, 'Must skip when telegramNotifyZReport is explicitly false');

    // Dummy/placeholder token safely rejected without unhandled crash
    const resPlaceholder = await telegramLib.sendRawTelegramMessage(
      'YOUR_TELEGRAM_BOT_TOKEN',
      '-100123456789',
      'Test message'
    );
    assert.equal(resPlaceholder.success, false, 'Must reject placeholder token');
  });

  // 3. Verify Audio Chime Module & Frequency Configurations
  await test('P5_AUD_03: Audio Chime Native Synthesis Module & Frequencies Contract', async () => {
    const audioPath = path.join(ROOT_DIR, 'src/lib/audio-chime.ts');
    assert.ok(fs.existsSync(audioPath), 'src/lib/audio-chime.ts must exist');

    const audioRaw = fs.readFileSync(audioPath, 'utf8');
    assert.ok(audioRaw.includes('playOrderAlertChime'), 'Must export playOrderAlertChime');
    assert.ok(audioRaw.includes('playSuccessChime'), 'Must export playSuccessChime');
    assert.ok(audioRaw.includes('playCashierKeyBeep'), 'Must export playCashierKeyBeep');
    assert.ok(audioRaw.includes('isAudioMuted'), 'Must export isAudioMuted');
    assert.ok(audioRaw.includes('setAudioMuted'), 'Must export setAudioMuted');
    assert.ok(audioRaw.includes('toggleAudioMuted'), 'Must export toggleAudioMuted');

    // Verify 3-tone chime notes for incoming orders (D5: 587.33, F#5: 739.99, A5: 880.0)
    assert.ok(audioRaw.includes('587.33') && audioRaw.includes('739.99') && audioRaw.includes('880.0'),
      'playOrderAlertChime must synthesize D5, F#5, A5 musical progression'
    );

    // Verify Web Audio API usage without external mp3 dependencies
    assert.ok(audioRaw.includes('createOscillator') && audioRaw.includes('createGain'),
      'Must use native AudioContext oscillators with exponential decay'
    );
    assert.ok(!audioRaw.includes('.mp3') && !audioRaw.includes('.wav'),
      'Must not rely on external audio files to prevent 404s'
    );
  });

  // 4. Verify WebP Image Upload API Route & Image Dropzone Component
  await test('P5_WBP_04: WebP Image Upload Server Endpoint & ImageUploadDropzone Component', async () => {
    const uploadApiRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/admin/upload-image/route.ts'), 'utf8');
    const dropzoneRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/components/admin/ImageUploadDropzone.tsx'), 'utf8');

    // Verify upload route authentication and limits
    assert.ok(uploadApiRaw.includes("verifyAdminRequest(request, ['super_admin'])"),
      'upload-image route must restrict access strictly to super_admin'
    );
    assert.ok(uploadApiRaw.includes('MAX_IMAGE_BYTES') && uploadApiRaw.includes('image/webp'),
      'upload-image route must enforce size limits and accept webp'
    );
    assert.ok(uploadApiRaw.includes('application/json') && uploadApiRaw.includes('multipart/form-data'),
      'upload-image route must support both base64 JSON and multipart form data'
    );

    // Verify ImageUploadDropzone client component
    assert.ok(dropzoneRaw.includes("toDataURL('image/webp'"),
      'ImageUploadDropzone must compress images to WebP format'
    );
    assert.ok(dropzoneRaw.includes('savedPercent') && dropzoneRaw.includes('formatFileSize'),
      'ImageUploadDropzone must calculate and display compression savings'
    );
  });

  // 5. Verify End-to-End Wiring Across Admin, POS, Rider & Test API
  await test('P5_INT_05: End-to-End Triggers in Orders, Supply Invoices, POS Shifts & Admin Settings UI', async () => {
    const ordersRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/orders/route.ts'), 'utf8');
    const supplyRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/supply-invoices/route.ts'), 'utf8');
    const posRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/pos/route.ts'), 'utf8');
    const adminPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/admin/page.tsx'), 'utf8');
    const posPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/pos/page.tsx'), 'utf8');
    const riderPageRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/rider/page.tsx'), 'utf8');
    const telegramTestRouteRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/app/api/admin/telegram-test/route.ts'), 'utf8');

    // Orders route triggers Telegram alert
    assert.ok(ordersRouteRaw.includes("sendStoreTelegramAlert(db.settings, 'new_order', newOrder)"),
      'orders route must trigger new_order Telegram alert'
    );

    // Supply route triggers Telegram alert
    assert.ok(supplyRouteRaw.includes("sendStoreTelegramAlert(db.settings, 'supply_invoice', newInvoice)"),
      'supply invoices route must trigger supply_invoice Telegram alert'
    );

    // POS route triggers Z-Report alert on close_shift
    assert.ok(posRouteRaw.includes("sendStoreTelegramAlert(db.settings, 'z_report', activeShift)"),
      'pos route must trigger z_report Telegram alert on close_shift'
    );

    // Telegram Test API route
    assert.ok(telegramTestRouteRaw.includes("verifyAdminRequest(request, ['super_admin'])"),
      'telegram-test route must authenticate super_admin'
    );
    assert.ok(telegramTestRouteRaw.includes('sendRawTelegramMessage'),
      'telegram-test route must invoke sendRawTelegramMessage'
    );

    // Audio Chimes & Polling wired in Admin, POS, and Rider
    assert.ok(adminPageRaw.includes('playOrderAlertChime') && adminPageRaw.includes('toggleAudioMuted'),
      'admin/page.tsx must integrate playOrderAlertChime and mute toggle'
    );
    assert.ok(adminPageRaw.includes('إشعارات بوت تلجرام الفورية') && adminPageRaw.includes('handleTestTelegram'),
      'admin/page.tsx must provide Telegram Bot settings card with test button'
    );
    assert.ok(adminPageRaw.includes('<ImageUploadDropzone'),
      'admin/page.tsx product modal must mount ImageUploadDropzone'
    );

    assert.ok(posPageRaw.includes('playOrderAlertChime') && posPageRaw.includes('toggleAudioMuted'),
      'pos/page.tsx must trigger order alert chime and provide mute toggle'
    );

    assert.ok(riderPageRaw.includes('playOrderAlertChime') && riderPageRaw.includes('toggleAudioMuted'),
      'rider/page.tsx must trigger assigned order chime and provide mute toggle'
    );
  });

  console.log(`\n${colors.bold}${colors.green}🎉 ALL PACKAGE 5 NOTIFICATIONS & WEBP CHECKS PASSED SUCCESSFULLY!${colors.reset}\n`);
}

runPackage5Verification().catch((err) => {
  console.error('Package 5 verification failed:', err);
  process.exit(1);
});
