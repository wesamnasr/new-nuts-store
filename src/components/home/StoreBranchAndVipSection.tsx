'use client';

import React from 'react';
import Link from 'next/link';
import {
  Crown,
  QrCode,
  Star,
  CheckCircle2,
  MapPin,
  ArrowLeft,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function StoreBranchAndVipSection() {
  const { activeVipMember } = useStore();

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* 1. Compact VIP Club Callout Banner (Links cleanly to /vip without duplicating form) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-l from-[#231710] via-[#312016] to-[#231710] rounded-3xl p-6 sm:p-8 text-[#FAF6F0] border-2 border-[#D4AF37] shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-[#D4AF37] text-[#231710] px-3 py-1 rounded-full text-xs font-black">
              <Crown className="w-3.5 h-3.5" />
              <span>محفظة ونادي عملاء «حفصة VIP» • فرع بني مزار</span>
            </div>
            <h2 className="font-cairo text-2xl sm:text-3xl font-black text-white">
              اجمع 5% كاش باك فوري في محفظتك مع كل طلب!
            </h2>
            <p className="text-xs sm:text-sm text-[#F3ECE1]/85 leading-relaxed">
              سواء اشتريت من الموقع أو من كاشير المحل أمام مسجد الزراعيين، رقم موبايلك هو محفظتك
              الذهبية. كل طلب فوق 150 ج.م يضيف 5% رصيد نقدي فوري يمكنك الخصم به في طلبك القادم!
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/vip"
                className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs sm:text-sm px-5 py-3 rounded-xl shadow flex items-center gap-2 transition"
              >
                <Crown className="w-4 h-4" />
                <span>
                  {activeVipMember
                    ? `عرض محفظتي (${activeVipMember.pointsBalance} ج.م)`
                    : 'اشترك مجاناً أو استعلم عن رصيدك برقم الموبايل'}
                </span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-gradient-to-br from-[#D4AF37] via-[#C88A4B] to-[#9A652A] text-[#231710] rounded-2xl p-5 shadow-xl border border-white/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest block opacity-80">
                    HAFSA ROASTERY • VIP CLUB
                  </span>
                  <h3 className="font-cairo text-lg font-black">
                    {activeVipMember
                      ? activeVipMember.customerName
                      : 'بطاقة عضوية حفصة الذهبية'}
                  </h3>
                </div>
                <QrCode className="w-9 h-9 text-[#231710]" />
              </div>

              <div className="bg-[#231710] text-[#FAF6F0] rounded-xl p-3 flex items-center justify-between tabular-nums">
                <div>
                  <span className="text-[10px] text-[#D4AF37] block font-bold">
                    الرصيد المتاح للاستبدال
                  </span>
                  <span className="font-cairo text-2xl font-black text-white">
                    {activeVipMember
                      ? `${activeVipMember.pointsBalance} ج.م`
                      : '15 ج.م هدية انضمام'}
                  </span>
                </div>
                <Link
                  href="/vip"
                  className="bg-[#D4AF37] text-[#231710] px-3 py-1.5 rounded-lg text-[11px] font-black"
                >
                  افتح المحفظة ←
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Customer Reviews & Store Location Summary */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-[#E6DFD3] shadow-xs space-y-3">
            <div className="flex items-center gap-1 text-[#D4AF37]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#D4AF37]" />
              ))}
            </div>
            <p className="text-xs text-[#231710] leading-relaxed font-medium">
              «ما شاء الله فرع يشرف بني مزار كلها! بوكس الـ 125 جنيه فكرة عبقرية وموفر جداً للسهرة،
              وتوليفة البن الوسط المحوج ريحتها بتجيب لآخر الشارع.»
            </p>
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E6DFD3]">
              <span className="font-cairo font-black text-[#231710]">د. محمد عبد الرحمن</span>
              <span className="text-[#3B6E4C] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> عميل موثق - شارع العاشر
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E6DFD3] shadow-xs space-y-3">
            <div className="flex items-center gap-1 text-[#D4AF37]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#D4AF37]" />
              ))}
            </div>
            <p className="text-xs text-[#231710] leading-relaxed font-medium">
              «أول مرة ألاقي محمصة في المنيا بتخليني أصمم توليفة القهوة بالجرام وأختار نوع الطحنة
              للإسبريسو! والتوصيل لشرق المحطة وصل في 25 دقيقة بس.»
            </p>
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E6DFD3]">
              <span className="font-cairo font-black text-[#231710]">م. سارة محمود</span>
              <span className="text-[#3B6E4C] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> عميلة موثقة - شرق المحطة
              </span>
            </div>
          </div>

          <div className="bg-[#231710] text-[#FAF6F0] rounded-2xl p-5 border-2 border-[#D4AF37] shadow-md flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-black">
                <MapPin className="w-4 h-4" />
                <span>عنوان الفرع ومواعيد العمل</span>
              </div>
              <h3 className="font-cairo text-base font-black text-white">
                محمصة حفصة — مركز بني مزار (أمام مسجد الزراعيين)
              </h3>
              <p className="text-xs text-[#F3ECE1]/85 leading-relaxed">
                وسط البلد، بجوار موقف القيس وشارع الجمهورية. متاح الاستلام الفوري من الفرع أو التوصيل
                السريع لبندر وقرى المركز.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <a
                href="https://maps.google.com/?q=Bani+Mazar+Minya+Egypt"
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-[#D4AF37] text-[#231710] text-center py-2.5 rounded-xl text-xs font-black"
              >
                📍 افتح الموقع على Google Maps
              </a>
              <Link
                href="/about"
                className="px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold"
              >
                قصتنا والفرع
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
