import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import { validateEgyptianPhone } from '@/lib/validation';
import { calculateVipCashback } from '@/lib/pricing';
import { verifyAdminRequest } from '@/lib/auth';
import { VipMember } from '@/types/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get('phone')?.trim();
  const db = await getDbAsync();

  if (!rawPhone) {
    const auth = verifyAdminRequest(request);
    if (auth.isAuthenticated) {
      return NextResponse.json({ vipMembers: db.vipMembers || [] });
    }
    return NextResponse.json({ error: 'يرجى إدخال رقم الموبايل للاستعلام عن محفظة حفصة VIP' }, { status: 400 });
  }

  const phoneVal = validateEgyptianPhone(rawPhone);
  const normalized = phoneVal.isValid ? phoneVal.normalized : rawPhone.replace(/\D/g, '');

  const member = (db.vipMembers || []).find(
    (m) => m.phone === normalized || m.qrCodeValue === rawPhone
  );

  if (!member) {
    return NextResponse.json(
      { found: false, phone: normalized, message: 'الرقم غير مسجل بعد في نادي حفصة VIP — يمكنك تفعيل محفظتك الذهبية مجاناً الآن!' },
      { status: 200 }
    );
  }

  return NextResponse.json({ found: true, member });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDbAsync();
    if (!Array.isArray(db.vipMembers)) {
      db.vipMembers = [];
    }

    const action = body.action || 'register';

    // 1. Cashier / Admin POS Sync inside Bani Mazar Store
    if (action === 'cashier_sync') {
      const auth = verifyAdminRequest(request);
      if (!auth.isAuthenticated) {
        return NextResponse.json(
          { error: 'غير مصرح لك بتعديل أرصدة محفظة VIP (401 Unauthorized)' },
          { status: 401 }
        );
      }

      const phoneVal = validateEgyptianPhone(String(body.phone || ''));
      if (!phoneVal.isValid) {
        return NextResponse.json(
          { error: phoneVal.error || 'رقم الموبايل غير صحيح' },
          { status: 400 }
        );
      }

      const normalizedPhone = phoneVal.normalized;
      const nowIso = new Date().toISOString();
      let memberIndex = db.vipMembers.findIndex((m) => m.phone === normalizedPhone);

      if (memberIndex === -1) {
        const newMember: VipMember = {
          phone: normalizedPhone,
          customerName: String(body.customerName || 'عميل فرع بني مزار').trim(),
          pointsBalance: 0,
          totalSpent: 0,
          ordersCount: 0,
          tier: 'gold',
          qrCodeValue: `HAFSA-VIP-${normalizedPhone}`,
          joinedAt: nowIso,
          transactions: [],
        };
        db.vipMembers.unshift(newMember);
        memberIndex = 0;
      }

      const member = db.vipMembers[memberIndex];
      if (!Array.isArray(member.transactions)) {
        member.transactions = [];
      }

      const syncMode = body.syncMode || 'invoice_cashback'; // 'invoice_cashback' | 'redeem_points' | 'manual_add'
      if (syncMode === 'invoice_cashback') {
        const invoiceAmount = Math.max(0, Number(body.amount) || 0);
        const cashback = calculateVipCashback(
          invoiceAmount,
          db.settings.vipMinOrderForCashback || 150,
          db.settings.vipCashbackPercentage || 5
        );
        const pointsAdded = cashback > 0 ? cashback : Math.max(1, Math.round(invoiceAmount * 0.05));
        member.pointsBalance += pointsAdded;
        member.totalSpent += invoiceAmount;
        member.ordersCount += 1;
        if (member.totalSpent >= 1500) member.tier = 'platinum';

        member.transactions.unshift({
          id: `vip-pos-${Date.now()}`,
          type: 'earned',
          amountEgp: pointsAdded,
          description:
            body.description ||
            `كاش باك مشتريات كاشير فرع بني مزار (${invoiceAmount} ج.م)`,
          date: nowIso,
        });
      } else if (syncMode === 'redeem_points') {
        const redeemAmount = Math.max(0, Number(body.amount) || 0);
        if (redeemAmount > member.pointsBalance) {
          return NextResponse.json(
            { error: `رصيد العميل الحالي (${member.pointsBalance} ج.م) أقل من المبلغ المطلوب خصمه (${redeemAmount} ج.م)` },
            { status: 400 }
          );
        }
        member.pointsBalance -= redeemAmount;
        member.transactions.unshift({
          id: `vip-pos-redeem-${Date.now()}`,
          type: 'redeemed',
          amountEgp: redeemAmount,
          description:
            body.description ||
            `خصم فوري من كاشير فرع بني مزار بقيمة ${redeemAmount} ج.م`,
          date: nowIso,
        });
      } else if (syncMode === 'manual_add') {
        const bonusAmount = Math.max(0, Number(body.amount) || 0);
        member.pointsBalance += bonusAmount;
        member.transactions.unshift({
          id: `vip-pos-bonus-${Date.now()}`,
          type: 'manual_cashier',
          amountEgp: bonusAmount,
          description:
            body.description ||
            `إضافة رصيد هدية من إدارة محمصة حفصة (${bonusAmount} ج.م)`,
          date: nowIso,
        });
      }

      await saveDbAsync(db);
      return NextResponse.json({ success: true, member });
    }

    // 2. Public Customer Registration / Lookup in Hafsa VIP Club
    const phoneVal = validateEgyptianPhone(String(body.phone || ''));
    if (!phoneVal.isValid) {
      return NextResponse.json(
        { error: phoneVal.error || 'يرجى إدخال رقم موبايل مصري صحيح (11 رقم)' },
        { status: 400 }
      );
    }

    const normalizedPhone = phoneVal.normalized;
    const existing = db.vipMembers.find((m) => m.phone === normalizedPhone);
    if (existing) {
      return NextResponse.json({ found: true, isNew: false, member: existing });
    }

    const nowIso = new Date().toISOString();
    const customerName = String(body.customerName || 'عضو نادي حفصة الذهبي').trim();
    const welcomeBonus = 15; // 15 EGP welcome cashback gift for new VIP members in Bani Mazar

    const newMember: VipMember = {
      phone: normalizedPhone,
      customerName,
      pointsBalance: welcomeBonus,
      totalSpent: 0,
      ordersCount: 0,
      tier: 'gold',
      qrCodeValue: `HAFSA-VIP-${normalizedPhone}`,
      joinedAt: nowIso,
      transactions: [
        {
          id: `vip-welcome-${Date.now()}`,
          type: 'earned',
          amountEgp: welcomeBonus,
          description: 'هدية ترحيبية مجانية عند الانضمام لنادي عملاء حفصة VIP — فرع بني مزار',
          date: nowIso,
        },
      ],
    };

    db.vipMembers.unshift(newMember);
    await saveDbAsync(db);

    return NextResponse.json({ found: true, isNew: true, member: newMember }, { status: 201 });
  } catch (error) {
    console.error('Error in VIP API:', error);
    return NextResponse.json({ error: 'حدث خطأ في خدمة محفظة حفصة VIP' }, { status: 500 });
  }
}
