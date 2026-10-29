import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import { validateEgyptianPhone } from '@/lib/validation';
import { calculateVipCashback } from '@/lib/pricing';
import { verifyAdminRequest } from '@/lib/auth';
import { VipMember } from '@/types/store';
import {
  validateVipPinFormat,
  hashVipPin,
  verifyVipPin,
  sanitizeVipMember,
} from '@/lib/vip-pin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get('phone')?.trim();
  const db = await getDbAsync();

  if (!rawPhone) {
    const auth = verifyAdminRequest(request);
    if (auth.isAuthenticated) {
      if (auth.role === 'delivery_rider') {
        return NextResponse.json(
          { error: 'عزل الأدوار: مندوب التوصيل غير مصرح له باستعراض دليل أعضاء VIP (403 Forbidden)' },
          { status: 403 }
        );
      }
      return NextResponse.json({
        vipMembers: (db.vipMembers || []).map(sanitizeVipMember),
      });
    }
    return NextResponse.json(
      { error: 'يرجى إدخال رقم الموبايل للاستعلام عن محفظة حفصة VIP' },
      { status: 400 }
    );
  }

  const phoneVal = validateEgyptianPhone(rawPhone);
  const normalized = phoneVal.isValid ? phoneVal.normalized : rawPhone.replace(/\D/g, '');

  const member = (db.vipMembers || []).find(
    (m) => m.phone === normalized || m.qrCodeValue === rawPhone
  );

  if (!member) {
    return NextResponse.json(
      {
        found: false,
        phone: normalized,
        message: 'الرقم غير مسجل بعد في نادي حفصة VIP — يمكنك تفعيل محفظتك الذهبية مجاناً الآن!',
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ found: true, member: sanitizeVipMember(member) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await getDbAsync();

    const action = body.action || 'register';

    // 1. PIN Management (Set / Reset / Change 4-digit PIN)
    if (action === 'set_pin') {
      const phoneVal = validateEgyptianPhone(String(body.phone || ''));
      if (!phoneVal.isValid) {
        return NextResponse.json(
          { error: phoneVal.error || 'يرجى إدخال رقم موبايل مصري صحيح' },
          { status: 400 }
        );
      }

      const rawPin = String(body.pin || '').trim();
      if (!validateVipPinFormat(rawPin)) {
        return NextResponse.json(
          { error: 'يجب أن يتكون الرمز السري لمحفظة VIP من 4 أرقام عددية فقط (مثال: 5599)' },
          { status: 400 }
        );
      }

      const auth = verifyAdminRequest(request);
      const isStaffAdmin = auth.isAuthenticated && (auth.role === 'super_admin' || auth.role === 'admin' || auth.role === 'cashier');

      return await withDbTransaction(async (db) => {
        if (!Array.isArray(db.vipMembers)) {
          db.vipMembers = [];
        }

        const normalizedPhone = phoneVal.normalized;
        let member = db.vipMembers.find((m) => m.phone === normalizedPhone);

        if (!member) {
          const nowIso = new Date().toISOString();
          const newMember: VipMember = {
            phone: normalizedPhone,
            customerName: String(body.customerName || 'عضو نادي حفصة VIP').trim(),
            pointsBalance: 15,
            totalSpent: 0,
            ordersCount: 0,
            tier: 'gold',
            qrCodeValue: `HAFSA-VIP-${normalizedPhone}`,
            joinedAt: nowIso,
            pinHash: hashVipPin(rawPin),
            transactions: [
              {
                id: `vip-welcome-${Date.now()}`,
                type: 'earned',
                amountEgp: 15,
                description: 'هدية ترحيبية مجانية عند الانضمام لنادي حفصة VIP',
                date: nowIso,
              },
            ],
          };
          db.vipMembers.unshift(newMember);
          return NextResponse.json({
            success: true,
            isNew: true,
            message: 'تم إنشاء محفظة VIP وتعيين الرمز السري بنجاح',
            member: sanitizeVipMember(newMember),
          });
        }

        // If member already has a PIN and not called by staff, require oldPin for change
        if (member.pinHash && !isStaffAdmin) {
          const oldPin = String(body.oldPin || '').trim();
          if (!oldPin || !verifyVipPin(oldPin, member.pinHash)) {
            return NextResponse.json(
              { error: 'الرمز السري الحالي غير صحيح، يرجى إدخال الرمز السابق أو مراجعة كاشير الفرع لتصفيره' },
              { status: 401 }
            );
          }
        }

        member.pinHash = hashVipPin(rawPin);
        return NextResponse.json({
          success: true,
          message: 'تم تحديث الرمز السري لمحفظة VIP بنجاح وتم تأمين رصيدك',
          member: sanitizeVipMember(member),
        });
      });
    }

    // 2. PIN Verification Probe
    if (action === 'verify_pin') {
      const phoneVal = validateEgyptianPhone(String(body.phone || ''));
      if (!phoneVal.isValid) {
        return NextResponse.json(
          { error: phoneVal.error || 'رقم الموبايل غير صحيح' },
          { status: 400 }
        );
      }

      const db = await getDbAsync();
      const member = (db.vipMembers || []).find((m) => m.phone === phoneVal.normalized);
      if (!member) {
        return NextResponse.json({ found: false, hasPin: false, valid: false });
      }

      if (!member.pinHash) {
        return NextResponse.json({ found: true, hasPin: false, valid: false });
      }

      const rawPin = String(body.pin || '').trim();
      const isValid = verifyVipPin(rawPin, member.pinHash);
      return NextResponse.json({
        found: true,
        hasPin: true,
        valid: isValid,
        message: isValid ? 'الرمز السري صحيح' : 'الرمز السري غير صحيح',
      });
    }

    // 3. Cashier / Admin POS Sync inside Bani Mazar Store
    if (action === 'cashier_sync') {
      const auth = verifyAdminRequest(request);
      if (!auth.isAuthenticated) {
        return NextResponse.json(
          { error: 'غير مصرح لك بتعديل أرصدة محفظة VIP (401 Unauthorized)' },
          { status: 401 }
        );
      }
      if (auth.role === 'accountant' || auth.role === 'supplier' || auth.role === 'delivery_rider') {
        return NextResponse.json(
          { error: 'عزل الأدوار: هذا الدور غير مصرح له بتعديل أرصدة محفظة VIP (403 Forbidden)' },
          { status: 403 }
        );
      }

      const phoneVal = validateEgyptianPhone(String(body.phone || ''));
      if (!phoneVal.isValid) {
        return NextResponse.json(
          { error: phoneVal.error || 'رقم الموبايل غير صحيح' },
          { status: 400 }
        );
      }

      return await withDbTransaction(async (db) => {
        if (!Array.isArray(db.vipMembers)) {
          db.vipMembers = [];
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

        const syncMode = body.syncMode || 'invoice_cashback';
        if (syncMode === 'set_pin') {
          const rawPin = String(body.pin || '').trim();
          if (!validateVipPinFormat(rawPin)) {
            return NextResponse.json(
              { error: 'يجب أن يتكون الرمز السري من 4 أرقام عددية' },
              { status: 400 }
            );
          }
          member.pinHash = hashVipPin(rawPin);
          return NextResponse.json({
            success: true,
            message: 'تم تعيين الرمز السري للعميل بنجاح',
            member: sanitizeVipMember(member),
          });
        } else if (syncMode === 'invoice_cashback') {
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

        return NextResponse.json({ success: true, member: sanitizeVipMember(member) });
      });
    }

    // 4. Public Customer Registration / Lookup in Hafsa VIP Club
    const phoneVal = validateEgyptianPhone(String(body.phone || ''));
    if (!phoneVal.isValid) {
      return NextResponse.json(
        { error: phoneVal.error || 'يرجى إدخال رقم موبايل مصري صحيح (11 رقم)' },
        { status: 400 }
      );
    }

    return await withDbTransaction(async (db) => {
      if (!Array.isArray(db.vipMembers)) {
        db.vipMembers = [];
      }

      const normalizedPhone = phoneVal.normalized;
      const existing = db.vipMembers.find((m) => m.phone === normalizedPhone);
      if (existing) {
        return NextResponse.json({
          found: true,
          isNew: false,
          member: sanitizeVipMember(existing),
        });
      }

      const nowIso = new Date().toISOString();
      const customerName = String(body.customerName || 'عضو نادي حفصة الذهبي').trim();
      const welcomeBonus = 15;
      const candidatePin = body.pin ? String(body.pin).trim() : undefined;
      const pinHash = candidatePin && validateVipPinFormat(candidatePin) ? hashVipPin(candidatePin) : undefined;

      const newMember: VipMember = {
        phone: normalizedPhone,
        customerName,
        pointsBalance: welcomeBonus,
        totalSpent: 0,
        ordersCount: 0,
        tier: 'gold',
        qrCodeValue: `HAFSA-VIP-${normalizedPhone}`,
        joinedAt: nowIso,
        pinHash,
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
      return NextResponse.json(
        { found: true, isNew: true, member: sanitizeVipMember(newMember) },
        { status: 201 }
      );
    });
  } catch (error) {
    console.error('Error in VIP API:', error);
    return NextResponse.json({ error: 'حدث خطأ في خدمة محفظة حفصة VIP' }, { status: 500 });
  }
}
