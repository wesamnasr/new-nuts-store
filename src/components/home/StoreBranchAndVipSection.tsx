'use client';

import React from 'react';
import Link from 'next/link';
import { Wallet, MapPin, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  getCurrencySymbol,
  getResolvedFeatureFlags,
} from '@/lib/defaults';

export default function StoreBranchAndVipSection() {
  const { activeVipMember, storeData } = useStore();
  const settings = storeData?.settings;
  const featureFlags = getResolvedFeatureFlags(settings);
  const currency = getCurrencySymbol(settings);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div
        className={`grid grid-cols-1 ${
          featureFlags.enableVipWallet ? 'lg:grid-cols-2' : ''
        } gap-6`}
      >
        {/* 1. VIP Cashback Card */}
        {featureFlags.enableVipWallet && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8DFD3] shadow-[0_4px_20px_-10px_rgba(35,23,16,0.06)] hover:border-[#C88A4B]/60 transition-all duration-300 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#9A6836] bg-[#F6F1EA] px-3 py-1 rounded-full border border-[#EAE0D3]">
                <Wallet className="w-4 h-4" />
                <span>محفظة ومكافآت العملاء VIP</span>
              </div>
              <h2 className="font-cairo text-xl sm:text-2xl font-extrabold text-[#261A13]">
                استرد {settings?.vipCashbackPercent ?? 5}% كاش باك تلقائياً برقم هاتفك مع كل طلب
              </h2>
              <p className="text-xs sm:text-sm text-[#5E4D40] leading-relaxed">
                تُضاف النقاط إلى محفظتك الرقمية تلقائياً عند الشراء من الموقع أو كاشير الفرع، ويمكنك خصمها من قيمة طلبك القادم.
              </p>
            </div>

            <div className="pt-4 border-t border-[#F0EAE0] flex flex-wrap items-center justify-between gap-3">
              <div className="tabular-nums">
                <span className="text-xs text-[#6E5D4F] block">
                  {activeVipMember
                    ? `مرحباً ${activeVipMember.customerName}`
                    : 'مكافأة التسجيل الأولى'}
                </span>
                <span className="font-cairo text-base font-extrabold text-[#261A13]">
                  {activeVipMember
                    ? `الرصيد المتاح: ${activeVipMember.pointsBalance} ${currency}`
                    : 'انضمام مجاني فوري برقم الموبايل'}
                </span>
              </div>

              <Link
                href="/vip"
                className="min-h-[44px] bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] font-cairo font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-full flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98]"
              >
                <span>
                  {activeVipMember ? 'عرض المحفظة' : 'استعلم عن محفظتك'}
                </span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* 2. Branch Location Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8DFD3] shadow-[0_4px_20px_-10px_rgba(35,23,16,0.06)] hover:border-[#C88A4B]/60 transition-all duration-300 flex flex-col justify-between gap-5">
          <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
            <div className="space-y-2.5 flex-1">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#9A6836] bg-[#F6F1EA] px-3 py-1 rounded-full border border-[#EAE0D3]">
                <MapPin className="w-4 h-4" />
                <span>فرع محمصة حفصة — بني مزار</span>
              </div>
              <h2 className="font-cairo text-xl sm:text-2xl font-extrabold text-[#261A13]">
                {settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة'}
              </h2>
              <p className="text-xs sm:text-sm text-[#5E4D40] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#9A6836] shrink-0" />
                <span>
                  {settings?.workingHours ||
                    'يومياً من 9 صباحاً حتى 2 بعد منتصف الليل'}
                </span>
              </p>
              <p className="text-xs text-[#6E5D4F] leading-relaxed">
                توصيل فوري داخل بندر بني مزار (30 دقيقة) + دورية حفصة اليومية لقرى المركز (القيس، صندفا، بني علي، شلقام، أبشاق — 2 ظهراً و8 مساءً).
              </p>
            </div>
            <div className="w-full sm:w-28 h-24 sm:h-28 rounded-2xl overflow-hidden border border-[#E8DFD3] shrink-0 bg-[#FAF7F2]">
              <img
                src="/images/branch/store-exterior.jpg"
                alt="واجهة محمصة حفصة — بني مزار أمام مسجد الزراعيين"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#F0EAE0] flex flex-wrap items-center gap-3">
            <a
              href={
                settings?.googleMapsUrl ||
                'https://maps.google.com/?q=28.5036,30.8004'
              }
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] bg-[#FAF7F2] hover:bg-[#261A13] text-[#261A13] hover:text-[#FAF7F2] border border-[#D5C4AE] hover:border-[#261A13] font-cairo font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-full inline-flex items-center gap-1.5 transition-all duration-200"
            >
              <span>الموقع على الخريطة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Link
              href="/about"
              className="min-h-[44px] inline-flex items-center text-xs sm:text-sm font-cairo font-bold text-[#5E4D40] hover:text-[#9A6836] px-3 py-2.5 transition-colors"
            >
              جولة داخل المحل والتواصل
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
