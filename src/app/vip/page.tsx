'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Crown,
  QrCode,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  ShoppingBag,
  Calculator,
  Phone,
  User,
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

  const [phoneInput, setPhoneInput] = useState(activeVipMember?.phone || '01012345678');
  const [nameInput, setNameInput] = useState('');
  const [lookedUpMember, setLookedUpMember] = useState<VipMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Interactive Cashback Calculator state
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

  const currentMember = lookedUpMember || activeVipMember || storeData?.vipMembers?.[0] || null;

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
            ? `🎉 مبروك! تم تفعيل بطاقة حفصة VIP الذهبية وإضافة ${data.member.pointsBalance} ج.م هدية ترحيبية.`
            : `👑 تم فتح محفظة ${data.member.customerName} بنجاح (الرصيد المتاح: ${data.member.pointsBalance} ج.م).`,
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء الاتصال بالخادم' });
    } finally {
      setLoading(false);
    }
  };

  const simulatedCashback = calculateVipCashback(simOrderAmount, 150, 5);

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Luxury Header */}
      <div className="bg-gradient-to-b from-[#231710] via-[#2F1E14] to-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37]/50 py-8 sm:py-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-[#D4AF37] text-[#231710] px-3.5 py-1 rounded-full text-xs font-black">
              <Crown className="w-4 h-4" />
              <span>محفظة حفصة VIP</span>
            </div>
            <h1 className="font-cairo text-2xl sm:text-4xl font-black text-white leading-tight">
              محفظتك الذهبية للكاش باك الفوري (5%)
            </h1>
            <p className="hidden">
              بدون بطاقات بلاستيكية أو تعقيد! رقم موبايلك هو حسابك في محمصة حفصة. اكسب 5% كاش باك
              نقدي على كل طلب من 150 ج.م، واستبدل نقاطك كخصم فوري عند الدفع أونلاين أو عبر مسح
              الـ QR Code عند الكاشير أمام مسجد الزراعيين.
            </p>

            {/* Phone Lookup / Free Registration Form */}
            <form
              onSubmit={handleLookupOrJoin}
              className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-[#D4AF37]/40 flex flex-col sm:flex-row gap-2.5 max-w-xl"
            >
              <div className="relative sm:w-44">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="الاسم (للعضو الجديد)"
                  className="w-full bg-[#231710]/80 border border-[#D4AF37]/40 rounded-xl py-2.5 pr-8 pl-3 text-xs text-white placeholder-[#F3ECE1]/60 focus:outline-none focus:border-[#D4AF37]"
                />
                <User className="w-3.5 h-3.5 text-[#D4AF37] absolute right-2.5 top-3" />
              </div>

              <div className="relative flex-1">
                <input
                  type="tel"
                  dir="ltr"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="01012345678"
                  className="w-full bg-[#231710]/80 border border-[#D4AF37]/40 rounded-xl py-2.5 pr-8 pl-3 text-xs text-white placeholder-[#F3ECE1]/60 focus:outline-none focus:border-[#D4AF37] text-right tabular-nums"
                />
                <Phone className="w-3.5 h-3.5 text-[#D4AF37] absolute right-2.5 top-3" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs px-5 py-2.5 rounded-xl shadow cursor-pointer transition shrink-0"
              >
                {loading ? 'جاري التحقق...' : 'فتح المحفظة / تسجيل مجاني'}
              </button>
            </form>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs font-extrabold border max-w-xl ${
                  feedback.type === 'success'
                    ? 'bg-[#3B6E4C]/30 border-emerald-400 text-emerald-200'
                    : 'bg-[#B83B2B]/30 border-red-400 text-red-200'
                }`}
              >
                {feedback.text}
              </div>
            )}
          </div>

          {/* Digital Gold VIP Card with Scannable Store QR Code */}
          <div className="lg:col-span-5">
            {currentMember && (
              <div className="bg-gradient-to-br from-[#D4AF37] via-[#C88A4B] to-[#8C5A23] text-[#231710] rounded-3xl p-6 shadow-2xl border-2 border-white/40 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black tracking-widest uppercase block opacity-85">
                      HAFSA ROASTERY • {currentMember.tier === 'platinum' ? 'PLATINUM VIP' : 'GOLD VIP'}
                    </span>
                    <h2 className="font-cairo text-xl font-black text-[#231710] mt-0.5">
                      {currentMember.customerName}
                    </h2>
                    <span className="text-xs font-black tabular-nums block mt-0.5">
                      📱 {currentMember.phone}
                    </span>
                  </div>

                  {/* Simulated SVG QR Code for Cashier Scanner */}
                  <div className="bg-white p-2 rounded-2xl shadow-md border border-[#231710]/20 text-center">
                    <QrCode className="w-14 h-14 text-[#231710] mx-auto" />
                    <span className="text-[8px] font-black text-[#231710] block mt-0.5 font-mono">
                      {currentMember.qrCodeValue}
                    </span>
                  </div>
                </div>

                {/* Balance Box */}
                <div className="bg-[#231710] text-[#FAF6F0] rounded-2xl p-4 flex items-center justify-between tabular-nums">
                  <div>
                    <span className="text-[10.5px] text-[#D4AF37] font-bold block">
                      الرصيد النقدي المتاح للاستبدال الفوري
                    </span>
                    <span className="font-cairo text-3xl font-black text-white">
                      {currentMember.pointsBalance} <span className="text-sm text-[#D4AF37]">ج.م</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">
                      (يعادل {currentMember.pointsBalance * 10} نقطة ذهبية • كل 10 نقاط = 1 ج.م)
                    </span>
                  </div>

                  <Link
                    href="/checkout"
                    className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition"
                  >
                    استخدم الرصيد في الطلب ←
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-extrabold tabular-nums">
                  <div className="bg-white/25 rounded-xl p-2.5">
                    <span className="text-[10px] block opacity-80">إجمالي المشتريات</span>
                    <span className="font-cairo text-sm font-black">
                      {currentMember.totalSpent} ج.م
                    </span>
                  </div>
                  <div className="bg-white/25 rounded-xl p-2.5">
                    <span className="text-[10px] block opacity-80">عدد الطلبات</span>
                    <span className="font-cairo text-sm font-black">
                      {currentMember.ordersCount} طلبات
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Transaction History + Cashback Calculator + Secret VIP Offers */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Transaction History (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-[#E6DFD3] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6DFD3] pb-3">
              <div>
                <h3 className="font-cairo text-base sm:text-lg font-black text-[#231710]">
                  سجل حركات محفظة حفصة VIP
                </h3>
                <p className="text-xs text-[#6E5D4F]">
                  جميع نقاط الكاش باك المكتسبة والمستبدلة في الموقع أو فرع بني مزار
                </p>
              </div>
              <span className="text-xs font-black text-[#3B6E4C] bg-[#3B6E4C]/10 px-3 py-1 rounded-full tabular-nums">
                {currentMember?.transactions?.length || 0} حركات
              </span>
            </div>

            {!currentMember?.transactions || currentMember.transactions.length === 0 ? (
              <p className="text-xs text-[#6E5D4F] py-6 text-center">
                لا توجد حركات مسجلة بعد لهذا الرقم.
              </p>
            ) : (
              <div className="space-y-2.5">
                {currentMember.transactions.map((tx) => {
                  const isEarned = tx.type === 'earned' || tx.type === 'manual_cashier';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FAF6F0] border border-[#E6DFD3]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isEarned
                              ? 'bg-[#3B6E4C]/15 text-[#3B6E4C]'
                              : 'bg-[#B83B2B]/15 text-[#B83B2B]'
                          }`}
                        >
                          {isEarned ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-[#231710] truncate">
                            {tx.description}
                          </div>
                          <div className="text-[10px] text-[#6E5D4F] tabular-nums">
                            {new Date(tx.date).toLocaleDateString('ar-EG')}
                            {tx.orderNumber ? ` • طلب #${tx.orderNumber}` : ''}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`font-cairo text-sm font-black shrink-0 tabular-nums ${
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

          {/* Interactive 5% Cashback Calculator (5 cols) */}
          <div className="lg:col-span-5 bg-[#F3ECE1] rounded-3xl p-5 sm:p-6 border border-[#D4AF37] space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#C88A4B]" />
              <h3 className="font-cairo text-base sm:text-lg font-black text-[#231710]">
                حاسبة الكاش باك الفوري (5%)
              </h3>
            </div>
            <p className="text-xs text-[#6E5D4F] leading-relaxed">
              حرّك المؤشر لتعرف قيمة الكاش باك النقدي الذي يضاف فوراً لمحفظتك عند الشراء من محمصة حفصة:
            </p>

            <div className="bg-white rounded-2xl p-4 border border-[#E6DFD3] space-y-3 tabular-nums">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#6E5D4F]">قيمة فاتورة مشترياتك:</span>
                <span className="font-cairo text-lg font-black text-[#231710]">
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
              <div className="pt-2 border-t border-[#E6DFD3] flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#231710]">
                  رصيد الكاش باك الفوري (5%):
                </span>
                <span className="font-cairo text-xl font-black text-[#3B6E4C]">
                  {simulatedCashback > 0
                    ? `+${simulatedCashback} ج.م (${simulatedCashback * 10} نقطة)`
                    : 'يبدأ من طلبات 150 ج.م'}
                </span>
              </div>
            </div>

            <div className="bg-[#231710] text-[#FAF6F0] rounded-2xl p-4 space-y-1.5 text-xs">
              <div className="font-cairo font-black text-[#D4AF37]">
                💡 كيف تستخدم نقاطك في فرع بني مزار؟
              </div>
              <p className="text-[11px] text-[#F3ECE1]/85 leading-relaxed">
                أعطِ الكاشير رقم موبايلك أو اعرض رمز الـ QR Code الموجود أعلى الصفحة ليتم خصم
                رصيدك مباشرة من فاتورتك داخل المحل!
              </p>
            </div>
          </div>
        </div>

        {/* Secret VIP Offers Table */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-[#D4AF37] shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-[#C88A4B] block">
                🔒 عروض حصرية لأعضاء نادي حفصة VIP
              </span>
              <h3 className="font-cairo text-lg sm:text-xl font-black text-[#231710]">
                جدول عروض أعضاء VIP السرية وباقات التوفير
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vipPromos.map((promo) => (
              <div
                key={promo.id}
                className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E6DFD3] flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <span className="bg-[#231710] text-[#D4AF37] text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    {promo.badgeText || 'عرض VIP'}
                  </span>
                  <h4 className="font-cairo text-sm font-black text-[#231710]">
                    {promo.title}
                  </h4>
                  <p className="text-xs text-[#6E5D4F]">{promo.subtitle}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E6DFD3] tabular-nums">
                  <div>
                    <span className="text-[10px] text-[#6E5D4F] line-through block">
                      {promo.originalPrice} ج.م
                    </span>
                    <span className="font-cairo text-base font-black text-[#3B6E4C]">
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
                    className="bg-[#231710] text-[#D4AF37] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>اطلب العرض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
