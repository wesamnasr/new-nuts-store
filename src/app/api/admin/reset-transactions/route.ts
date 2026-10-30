import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/auth';
import { withDbTransaction } from '@/lib/db';
import { DatabaseSchema } from '@/types/store';
import { sendRawTelegramMessage, escapeTelegramHtml } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export interface ResetTransactionsRequestPayload {
  confirmationText: string;
  clearOrders?: boolean;
  clearShifts?: boolean;
  clearExpenses?: boolean;
  clearSupplyInvoices?: boolean;
  clearVipMembers?: boolean;
}

export async function POST(request: NextRequest) {
  // 1. Strict Authentication & Role Guard: Super Admin ONLY
  const auth = verifyAdminRequest(request, ['super_admin']);
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: auth.error || 'غير مصرح - يلزم تسجيل الدخول كمدير عام' },
      { status: auth.statusCode || 401 }
    );
  }

  try {
    const body: ResetTransactionsRequestPayload = await request.json().catch(() => ({}));
    const rawConfirmation = typeof body.confirmationText === 'string' ? body.confirmationText.trim() : '';

    // 2. Strict Confirmation Text Guard
    const validConfirmations = [
      'تصفير العمليات التجريبية',
      'CONFIRM_PURGE_TEST_DATA',
      'CONFIRM_RESET',
    ];

    if (!validConfirmations.includes(rawConfirmation)) {
      return NextResponse.json(
        {
          error:
            'نص التأكيد غير صحيح. يرجى كتابة «تصفير العمليات التجريبية» للمتابعة وحماية النظام من الحذف غير المقصود.',
          requiredConfirmation: 'تصفير العمليات التجريبية',
        },
        { status: 400 }
      );
    }

    const clearOrders = body.clearOrders !== false;
    const clearShifts = body.clearShifts !== false;
    const clearExpenses = body.clearExpenses !== false;
    const clearSupplyInvoices = body.clearSupplyInvoices !== false;
    const clearVipMembers = body.clearVipMembers !== false;

    // 3. Atomic Database Purge Transaction (Neon Postgres + Local State)
    const outcome = await withDbTransaction(async (db: DatabaseSchema) => {
      const countsBefore = {
        orders: Array.isArray(db.orders) ? db.orders.length : 0,
        posShifts: Array.isArray(db.posShifts) ? db.posShifts.length : 0,
        posExpenses: Array.isArray(db.posExpenses) ? db.posExpenses.length : 0,
        supplyInvoices: Array.isArray(db.supplyInvoices) ? db.supplyInvoices.length : 0,
        vipMembers: Array.isArray(db.vipMembers) ? db.vipMembers.length : 0,
      };

      if (clearOrders) {
        db.orders = [];
      }
      if (clearShifts) {
        db.posShifts = [];
      }
      if (clearExpenses) {
        db.posExpenses = [];
      }
      if (clearSupplyInvoices) {
        db.supplyInvoices = [];
      }
      if (clearVipMembers) {
        db.vipMembers = [];
      }

      // Catalog & System Integrity Assertion: Ensure core entities were NOT compromised
      if (!Array.isArray(db.products) || db.products.length === 0) {
        throw new Error('فشل التحقق من سلامة النظام: لا يمكن تصفير الكتالوج الرئيسي');
      }
      if (!Array.isArray(db.categories) || db.categories.length === 0) {
        throw new Error('فشل التحقق من سلامة النظام: لا يمكن تصفير الأقسام الرئيسية');
      }
      if (!Array.isArray(db.staffAccounts) || db.staffAccounts.length === 0) {
        throw new Error('فشل التحقق من سلامة النظام: حسابات الموظفين يجب أن تبقى سليمة 100%');
      }

      return {
        purged: countsBefore,
        preserved: {
          productsCount: db.products.length,
          categoriesCount: db.categories.length,
          staffAccountsCount: db.staffAccounts.length,
          couponsCount: Array.isArray(db.coupons) ? db.coupons.length : 0,
          shippingRatesCount: Array.isArray(db.shippingRates) ? db.shippingRates.length : 0,
        },
        settings: db.settings,
      };
    });

    const nowIso = new Date().toISOString();
    const adminDisplayName = auth.displayName || auth.username || 'المدير العام';

    // 4. Instant Telegram Security Notification Dispatch
    if (
      outcome.settings?.telegramNotificationsEnabled &&
      outcome.settings.telegramBotToken &&
      outcome.settings.telegramChatId
    ) {
      const storeName = outcome.settings.storeName || 'محمصة حفصة للبن والمكسرات';
      const telegramHtml = `🛡️ <b>تنبيه أمني عاجل — تصفير العمليات وتجهيز الافتتاح</b>
🏬 <b>المتجر:</b> ${escapeTelegramHtml(storeName)} — فرع بني مزار
👤 <b>المنفذ:</b> ${escapeTelegramHtml(adminDisplayName)} (صلاحية: المدير العام)
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>البيانات التي تم تصفيرها بنجاح:</b>
  • الطلبات المحذوفة: <b>${outcome.purged.orders}</b> طلب
  • الورديات المصفرة: <b>${outcome.purged.posShifts}</b> وردية
  • المصروفات المصفرة: <b>${outcome.purged.posExpenses}</b> مصروف
  • فواتير التوريد: <b>${outcome.purged.supplyInvoices}</b> فاتورة
  • أعضاء VIP التجريبيين: <b>${outcome.purged.vipMembers}</b> عضو
━━━━━━━━━━━━━━━━━━━━
📦 <b>البيانات المحمية 100%:</b>
  • الكتالوج: <b>${outcome.preserved.productsCount}</b> منتج
  • حسابات الموظفين: <b>${outcome.preserved.staffAccountsCount}</b> حساب نشط
⏰ <b>التوقيت:</b> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

      sendRawTelegramMessage(
        outcome.settings.telegramBotToken,
        outcome.settings.telegramChatId,
        telegramHtml
      ).catch((err) => console.error('Failed to dispatch reset alert to Telegram:', err));
    }

    return NextResponse.json({
      success: true,
      message:
        'تم تصفير العمليات التجريبية وتجهيز الفرع للافتتاح الرسمي بنجاح مع الحفاظ التام على الكتالوج والإعدادات وحسابات الموظفين.',
      purged: outcome.purged,
      preserved: outcome.preserved,
      executedBy: adminDisplayName,
      timestamp: nowIso,
    });
  } catch (error: any) {
    console.error('Pre-launch reset transactions error:', error);
    return NextResponse.json(
      { error: error?.message || 'حدث خطأ داخلي أثناء معالجة تصفير العمليات' },
      { status: 500 }
    );
  }
}
