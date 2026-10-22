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
      {/* 1. Compact VIP Club Callout Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-l from-[#231710] via-[#312016] to-[#231710] rounded-3xl p-6 sm:p-7 text-[#FAF6F0] border-2 border-[#D4AF37] shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-[#D4AF37] text-[#231710] px-3 py-1 rounded-full text-xs font-black">
              <Crown className="w-3.5 h-3.5" />
              <span>محفظة حفصة VIP</span>
            </div>
            <h2 className="font-cairo text-2xl sm:text-3xl font-black text-white">
              5% كاش باك فوري في محفظتك برقم الموبايل
            </h2>
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <Link
                href="/vip"
                className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs sm:text-sm px-5 py-3 rounded-xl shadow flex items-center gap-2 transition"
              >
                <Crown className="w-4 h-4" />
                <span>
                  {activeVipMember
                    ? `عرض محفظتي (${activeVipMember.pointsBalance} ج.م)`
                    : 'استعلم عن رصيدك أو اشترك مجاناً'}
                </span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-gradient-to-br from-[#D4AF37] via-[#C88A4B] to-[#9A652A] text-[#231710] rounded-2xl p-4 shadow-xl border border-white/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest block opacity-80">
                    HAFSA VIP
                  </span>
                  <h3 className="font-cairo text-base font-black">
                    {activeVipMember
                      ? activeVipMember.customerName
                      : 'بطاقة عضوية حفصة الذهبية'}
                  </h3>
                </div>
                <QrCode className="w-8 h-8 text-[#231710]" />
              </div>

              <div className="bg-[#231710] text-[#FAF6F0] rounded-xl p-3 flex items-center justify-between tabular-nums">
                <div>
                  <span className="text-[10px] text-[#D4AF37] block font-bold">
                    الرصيد المتاح
                  </span>
                  <span className="font-cairo text-xl font-black text-white">
                    {activeVipMember
                      ? `${activeVipMember.pointsBalance} ج.م`
                      : '15 ج.م هدية انضمام'}
                  </span>
                </div>
                <Link
                  href="/vip"
                  className="bg-[#D4AF37] text-[#231710] px-3 py-1.5 rounded-lg text-[11px] font-black"
                >
                  المحفظة ←
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Customer Reviews & Store Location Summary */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E6DFD3] shadow-xs flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[#D4AF37]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#D4AF37]" />
                ))}
              </div>
              <p className="text-xs text-[#231710] leading-relaxed font-medium">
                «بوكس الـ 125 جنيه موفر جداً للسهرة، وتوليفة البن الوسط المحوج ممتازة.»
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E6DFD3]">
              <span className="font-cairo font-black text-[#231710]">د. محمد عبد الرحمن</span>
              <span className="text-[#3B6E4C] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> عميل موثق
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E6DFD3] shadow-xs flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[#D4AF37]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#D4AF37]" />
                ))}
              </div>
              <p className="text-xs text-[#231710] leading-relaxed font-medium">
                «تصميم توليفة القهوة بالجرام فكرة رائعة، والتوصيل وصل في 25 دقيقة.»
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E6DFD3]">
              <span className="font-cairo font-black text-[#231710]">م. سارة محمود</span>
              <span className="text-[#3B6E4C] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> عميلة موثقة
              </span>
            </div>
          </div>

          <div className="bg-[#231710] text-[#FAF6F0] rounded-2xl p-4 border-2 border-[#D4AF37] shadow-md flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#D4AF37] text-xs font-black">
                <MapPin className="w-3.5 h-3.5" />
                <span>عنوان الفرع</span>
              </div>
              <h3 className="font-cairo text-sm sm:text-base font-black text-white">
                بني مزار — أمام مسجد الزراعيين
              </h3>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="https://maps.google.com/?q=Bani+Mazar+Minya+Egypt"
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-[#D4AF37] text-[#231710] text-center py-2 rounded-xl text-xs font-black"
              >
                📍 الخريطة
              </a>
              <Link
                href="/about"
                className="px-3.5 py-2 rounded-xl border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold"
              >
                عن المحمصة
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
