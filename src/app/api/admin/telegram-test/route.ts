import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { sendRawTelegramMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  // 1. Enforce strict Admin authentication
  const auth = verifyAdminRequest(request, ['super_admin']);
  if (!auth) {
    return NextResponse.json(
      { error: 'غير مصرح لك بإجراء هذا الاختبار (صلاحية المدير العام مطلوبة)' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const db = await getDbAsync();
    const settings = db.settings || {};

    const token = body.token || settings.telegramBotToken;
    const chatId = body.chatId || settings.telegramChatId;

    if (!token || !chatId) {
      return NextResponse.json(
        {
          success: false,
          error: 'يرجى إدخال توكن البوت (Bot Token) ومعرّف المحادثة (Chat ID) أولاً.',
        },
        { status: 400 }
      );
    }

    const testMessage = `🎉 <b>تجربة ربط بوت تلجرام بنجاح!</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>المصدر:</b> محمصة حفصة للبن والمكسرات — فرع بني مزار
👑 <b>المرسل:</b> المدير العام (${auth.displayName || auth.username || 'admin'})
⚡ <b>حالة الاتصال:</b> نشط ويعمل بنسبة 100%
⏰ <b>التوقيت:</b> ${new Date().toLocaleString('ar-EG')}`;

    const result = await sendRawTelegramMessage(token, chatId, testMessage, 6000);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'تم إرسال رسالة الاختبار بنجاح إلى تلجرام! تفقد محادثة البوت الآن ✅',
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'فشل الاتصال بسيرفر تلجرام. تأكد من صحة التوكن وChat ID.',
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `خطأ في معالجة طلب الاختبار: ${err?.message || err}`,
      },
      { status: 500 }
    );
  }
}
