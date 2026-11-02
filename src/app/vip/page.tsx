'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  Calculator,
  Phone,
  User,
  Lock,
  Wallet,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { calculateVipCashback } from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';
import { VipMember } from '@/types/store';
import { updateUrlQueryParams, useBrowserUrlSync } from '@/lib/url-sync';

export default function VipWalletPage() {
  const {
    storeData,
    activeVipMember,
    setActiveVipPhone,
    addFlashPromoToCart,
    setIsCartOpen,
    refreshStore,
  } = useStore();

  const [phoneInput, setPhoneInput] = useState(activeVipMember?.phone || '');
  const [nameInput, setNameInput] = useState('');
  const [lookedUpMember, setLookedUpMember] = useState<VipMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [pinInput, setPinInput] = useState('');
  const [oldPinInput, setOldPinInput] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [simOrderAmount, setSimOrderAmount] = useState<number>(300);

  useBrowserUrlSync((params) => {
    const pParam = params.get('phone');
    if (pParam) {
      setPhoneInput(pParam);
      setActiveVipPhone(pParam);
    }
    const simParam = Number(params.get('sim'));
    if (simParam && simParam >= 150) {
      setSimOrderAmount(simParam);
    }
  });

  const currentMember = lookedUpMember || activeVipMember || null;

  const vipPromos = useMemo(
    () => (storeData?.promotions || []).filter((p) => p.active),
    [storeData?.promotions]
  );

  const handleLookupOrJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneInput.trim(),
          customerName: nameInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'رقم الموبايل غير صحيح' });
      } else if (data.member) {
        setLookedUpMember(data.member);
        setActiveVipPhone(data.member.phone);
        updateUrlQueryParams({ phone: data.member.phone });
        await refreshStore();
        setFeedback({
          type: 'success',
          text: data.isNew
            ? `تم تفعيل محفظة حفصة VIP وإضافة ${data.member.pointsBalance} ج.م رصيد ترحيبي.`
            : `تم فتح محفظة ${data.member.customerName} (الرصيد المتاح: ${data.member.pointsBalance} ج.م).`,
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء الاتصال بالخادم' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember?.phone) return;
    if (!pinInput.trim() || !/^\d{4}$/.test(pinInput.trim())) {
      setPinFeedback({
        type: 'error',
        text: 'يجب أن يتكون الرمز السري من 4 أرقام عددية فقط',
      });
      return;
    }
    setPinLoading(true);
    setPinFeedback(null);
    try {
      const res = await fetch('/api/vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_pin',
          phone: currentMember.phone,
          pin: pinInput.trim(),
          oldPin: oldPinInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinFeedback({ type: 'error', text: data.error || 'فشل حفظ الرمز السري' });
      } else {
        setPinFeedback({
          type: 'success',
          text: 'تم تأمين محفظتك بنجاح بالرمز السري المكون من 4 أرقام.',
        });
        if (data.member) {
          setLookedUpMember(data.member);
        }
        setPinInput('');
        setOldPinInput('');
        await refreshStore();
      }
    } catch {
      setPinFeedback({ type: 'error', text: 'حدث خطأ أثناء حفظ الرمز السري' });
    } finally {
      setPinLoading(false);
    }
  };

  const simulatedCashback = calculateVipCashback(simOrderAmount, 150, 5);

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Calm Light Page Header */}
      <div className="bg-white border-b border-[#E8E0D5] py-8 sm:py-10 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#9A6836]">
              <Wallet className="w-4 h-4" />
              <span>محفظة ومكافآت حفصة VIP</span>
            </div>
            <h1 className="font-cairo text-2xl sm:text-3xl font-bold text-[#231710] leading-snug">
              اكسب 5% كاش باك تلقائي برقم هاتفك مع كل طلب
            </h1>
            <p className="text-sm text-[#5C4A3D] max-w-xl leading-relaxed">
              أدخل رقم هاتفك للاستعلام عن رصيد نقاطك الحالي أو لتفعيل محفظتك مجاناً واستخدام الرصيد عند الدفع أونلاين أو في الفرع.
            </p>

            {/* Phone Lookup / Free Registration Form */}
            <form
              onSubmit={handleLookupOrJoin}
              className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#E8E0D5] flex flex-col sm:flex-row gap-2.5 max-w-xl"
            >
              <div className="relative sm:w-44">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="الاسم (للعضو الجديد)"
                  className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl py-2.5 pr-8 pl-3 text-xs text-[#231710] placeholder-[#8A7968] focus:outline-none"
                />
                <User className="w-3.5 h-3.5 text-[#8A7968] absolute right-2.5 top-3" />
              </div>

              <div className="relative flex-1">
                <input
                  type="tel"
                  dir="ltr"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="رقم الموبايل (11 رقم)"
                  className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl py-2.5 pr-8 pl-3 text-xs text-[#231710] placeholder-[#8A7968] focus:outline-none text-right tabular-nums"
                />
                <Phone className="w-3.5 h-3.5 text-[#8A7968] absolute right-2.5 top-3" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition shrink-0"
              >
                {loading ? 'جاري التحقق...' : 'فتح المحفظة'}
              </button>
            </form>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold border max-w-xl ${
                  feedback.type === 'success'
                    ? 'bg-[#EEF5F0] border-[#D4E8DA] text-[#2F5A3D]'
                    : 'bg-red-50 border-red-200 text-[#B83B2B]'
                }`}
              >
                {feedback.text}
              </div>
            )}
          </div>

          {/* Calm Artisanal Digital VIP Card */}
          <div className="lg:col-span-5">
            {currentMember ? (
              <div className="bg-[#FAF6F0] rounded-2xl p-6 border border-[#E8E0D5] space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-[#9A6836] block">
                      عضوية {currentMember.tier === 'platinum' ? 'بلاتينيوم' : 'ذهبية'}
                    </span>
                    <h2 className="font-cairo text-xl font-bold text-[#231710] mt-0.5">
                      {currentMember.customerName}
                    </h2>
                    <span className="text-xs text-[#6E5D4F] tabular-nums block mt-0.5">
                      {currentMember.phone}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-[#E8E0D5] text-center">
                    <QrCode className="w-12 h-12 text-[#231710] mx-auto" />
                    <span className="text-[9px] font-bold text-[#6E5D4F] block mt-0.5 font-mono">
                      {currentMember.qrCodeValue}
                    </span>
                  </div>
                </div>

                {/* Balance Box */}
                <div className="bg-white rounded-xl p-4 border border-[#E8E0D5] flex items-center justify-between tabular-nums">
                  <div>
                    <span className="text-xs text-[#6E5D4F] block">
                      الرصيد النقدي المتاح
                    </span>
                    <span className="font-cairo text-2xl font-bold text-[#231710]">
                      {currentMember.pointsBalance} <span className="text-xs font-medium text-[#6E5D4F]">ج.م</span>
                    </span>
                  </div>

                  <Link
                    href="/checkout"
                    className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs px-4 py-2.5 rounded-xl transition"
                  >
                    استخدم الرصيد
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
                  <div className="bg-white rounded-xl p-3 border border-[#E8E0D5]">
                    <span className="text-[11px] text-[#6E5D4F] block">إجمالي المشتريات</span>
                    <span className="font-cairo text-sm font-bold text-[#231710]">
                      {currentMember.totalSpent} ج.م
                    </span>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-[#E8E0D5]">
                    <span className="text-[11px] text-[#6E5D4F] block">عدد الطلبات</span>
                    <span className="font-cairo text-sm font-bold text-[#231710]">
                      {currentMember.ordersCount} طلبات
                    </span>
                  </div>
                </div>

                {/* 4-Digit Security PIN Section */}
                <div className="bg-white rounded-xl p-4 border border-[#E8E0D5] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-cairo text-xs font-bold text-[#231710]">
                          أمان المحفظة (الرمز السري 4 أرقام)
                        </h4>
                        <span className="text-[11px] text-[#6E5D4F] block">
                          {currentMember.hasPin
                            ? 'المحفظة محمية برمز سري عند الصرف أونلاين'
                            : 'عيّن رمزاً من 4 أرقام لحماية رصيدك عند الدفع'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
                      {currentMember.hasPin ? 'مؤمن' : 'غير معيّن'}
                    </span>
                  </div>

                  {pinFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-xs font-bold border ${
                        pinFeedback.type === 'success'
                          ? 'bg-[#EEF5F0] border-[#D4E8DA] text-[#2F5A3D]'
                          : 'bg-red-50 border-red-200 text-[#B83B2B]'
                      }`}
                    >
                      {pinFeedback.text}
                    </div>
                  )}

                  <form onSubmit={handleSavePin} className="flex flex-col sm:flex-row gap-2">
                    {currentMember.hasPin && (
                      <input
                        type="password"
                        maxLength={4}
                        inputMode="numeric"
                        pattern="\d{4}"
                        value={oldPinInput}
                        onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="الرمز الحالي"
                        className="bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs text-[#231710] focus:outline-none font-mono text-center tracking-widest sm:w-28"
                      />
                    )}

                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      pattern="\d{4}"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder={currentMember.hasPin ? 'الرمز الجديد (4 أرقام)' : 'عيّن رمز 4 أرقام'}
                      className="bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs text-[#231710] focus:outline-none font-mono text-center tracking-widest flex-1"
                      required
                    />

                    <button
                      type="submit"
                      disabled={pinLoading}
                      className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shrink-0"
                    >
                      {pinLoading ? 'جاري الحفظ...' : currentMember.hasPin ? 'تحديث الرمز' : 'حفظ الرمز'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-[#FAF6F0] rounded-2xl p-6 border border-[#E8E0D5] space-y-3 text-right">
                <h3 className="font-cairo text-base font-bold text-[#231710]">
                  كيف تعمل محفظة حفصة VIP؟
                </h3>
                <ul className="space-y-2 text-xs text-[#5C4A3D] leading-relaxed">
                  <li>• تُربط المحفظة برقم هاتفك مباشرة بدون بطاقات بلاستيكية.</li>
                  <li>• تحصل على 5% كاش باك نقدي تلقائياً على الطلبات من 150 ج.م فأكثر.</li>
                  <li>• يمكنك حماية رصيدك برمز سري (PIN) من 4 أرقام وصرفه في أي وقت.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Transaction History + Cashback Calculator + Active Offers */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Transaction History */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-[#E8E0D5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3">
              <div>
                <h3 className="font-cairo text-base sm:text-lg font-bold text-[#231710]">
                  سجل حركات المحفظة
                </h3>
                <p className="text-xs text-[#6E5D4F]">
                  سجل نقاط الكاش باك المكتسبة والمستبدلة
                </p>
              </div>
              <span className="text-xs font-bold text-[#5C4A3D] bg-[#FAF6F0] border border-[#E8E0D5] px-3 py-1 rounded-xl tabular-nums">
                {currentMember?.transactions?.length || 0} حركات
              </span>
            </div>

            {!currentMember?.transactions || currentMember.transactions.length === 0 ? (
              <p className="text-xs text-[#6E5D4F] py-8 text-center">
                {currentMember ? 'لا توجد حركات مسجلة بعد لهذا الرقم.' : 'أدخل رقم موبايلك بالأعلى لعرض سجل الحركات.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {currentMember.transactions.map((tx) => {
                  const isEarned = tx.type === 'earned' || tx.type === 'manual_cashier';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isEarned
                              ? 'bg-[#EEF5F0] text-[#3B6E4C]'
                              : 'bg-red-50 text-[#B83B2B]'
                          }`}
                        >
                          {isEarned ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#231710] truncate">
                            {tx.description}
                          </div>
                          <div className="text-[11px] text-[#6E5D4F] tabular-nums">
                            {new Date(tx.date).toLocaleDateString('ar-EG')}
                            {tx.orderNumber ? ` • طلب #${tx.orderNumber}` : ''}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`font-cairo text-sm font-bold shrink-0 tabular-nums ${
                          isEarned ? 'text-[#3B6E4C]' : 'text-[#B83B2B]'
                        }`}
                      >
                        {isEarned ? `+${tx.amountEgp}` : `-${tx.amountEgp}`} ج.م
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive 5% Cashback Calculator */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#E8E0D5] space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#9A6836]" />
              <h3 className="font-cairo text-base sm:text-lg font-bold text-[#231710]">
                حاسبة الكاش باك (5%)
              </h3>
            </div>
            <p className="text-xs text-[#5C4A3D] leading-relaxed">
              حرّك المؤشر لمعرفة قيمة الرصيد المضاف لمحفظتك حسب قيمة الطلب:
            </p>

            <div className="bg-[#FAF6F0] rounded-xl p-4 border border-[#E8E0D5] space-y-3 tabular-nums">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#6E5D4F]">قيمة المشتريات</span>
                <span className="font-cairo text-lg font-bold text-[#231710]">
                  {simOrderAmount} ج.م
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={1500}
                step={25}
                value={simOrderAmount}
                onChange={(e) => setSimOrderAmount(Number(e.target.value))}
                className="w-full accent-[#231710] cursor-pointer"
              />
              <div className="pt-2.5 border-t border-[#E8E0D5] flex items-center justify-between">
                <span className="text-xs font-bold text-[#231710]">
                  الكاش باك المكتسب:
                </span>
                <span className="font-cairo text-base font-bold text-[#3B6E4C]">
                  {simulatedCashback > 0
                    ? `+${simulatedCashback} ج.م`
                    : 'يبدأ من طلبات 150 ج.م'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Active VIP Offers */}
        {vipPromos.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-[#E8E0D5] space-y-4">
            <div>
              <span className="text-xs font-bold text-[#9A6836] block">
                باقات مختارة
              </span>
              <h3 className="font-cairo text-lg sm:text-xl font-bold text-[#231710]">
                عروض وباقات التوفير لأعضاء VIP
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vipPromos.map((promo) => (
                <div
                  key={promo.id}
                  className="bg-[#FAF6F0] rounded-xl p-4 border border-[#E8E0D5] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h4 className="font-cairo text-sm font-bold text-[#231710]">
                      {promo.title}
                    </h4>
                    <p className="text-xs text-[#6E5D4F]">{promo.subtitle}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#E8E0D5] tabular-nums">
                    <div>
                      {promo.originalPrice && (
                        <span className="text-xs text-[#8A7968] line-through block">
                          {promo.originalPrice} ج.م
                        </span>
                      )}
                      <span className="font-cairo text-base font-bold text-[#231710]">
                        {promo.promoPrice} ج.م
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        addFlashPromoToCart(
                          promo.id,
                          promo.title,
                          promo.promoPrice,
                          getSafeImageUrl(promo.image)
                        );
                        setIsCartOpen(true);
                      }}
                      className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>أضف للسلة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
