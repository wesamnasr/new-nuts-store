'use client';

import React from 'react';
import Link from 'next/link';
import { Wallet, MapPin, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function StoreBranchAndVipSection() {
  const { activeVipMember, storeData } = useStore();
  const settings = storeData?.settings;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Calm VIP Cashback Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E0D5] flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#9A6836]">
              <Wallet className="w-4 h-4" />
              <span>محفظة ومكافآت حفصة VIP</span>
            </div>
            <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
              استرد 5% كاش باك تلقائياً برقم هاتفك مع كل طلب
            </h2>
            <p className="text-xs sm:text-sm text-[#5C4A3D] leading-relaxed">
              تُضاف النقاط إلى محفظتك الرقمية تلقائياً عند الشراء من الموقع أو كاشير الفرع، ويمكنك خصمها من قيمة طلبك القادم.
            </p>
          </div>

          <div className="pt-4 border-t border-[#F0EAE0] flex flex-wrap items-center justify-between gap-3">
            <div className="tabular-nums">
              <span className="text-xs text-[#6E5D4F] block">
                {activeVipMember ? `مرحباً ${activeVipMember.customerName}` : 'مكافأة التسجيل الأولى'}
              </span>
              <span className="font-cairo text-base font-bold text-[#231710]">
                {activeVipMember
                  ? `الرصيد المتاح: ${activeVipMember.pointsBalance} ج.م`
                  : 'انضمام مجاني فوري برقم الموبايل'}
              </span>
            </div>

            <Link
              href="/vip"
              className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition"
            >
              <span>{activeVipMember ? 'عرض المحفظة' : 'استعلم عن محفظتك'}</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 2. Calm Branch Location Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E0D5] flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#9A6836]">
              <MapPin className="w-4 h-4" />
              <span>فرع المحمصة الرئيسي</span>
            </div>
            <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
              {settings?.address || 'بني مزار — أمام مسجد الزراعيين'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5C4A3D] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#8A7968] shrink-0" />
              <span>{settings?.workingHours || 'يومياً من 9 صباحاً حتى 1 بعد منتصف الليل'}</span>
            </p>
          </div>

          <div className="pt-4 border-t border-[#F0EAE0] flex flex-wrap items-center gap-3">
            <a
              href={settings?.googleMapsUrl || 'https://maps.google.com/?q=Bani+Mazar+Minya+Egypt'}
              target="_blank"
              rel="noreferrer"
              className="bg-[#FAF6F0] hover:bg-[#F4EFE6] border border-[#E8E0D5] text-[#231710] font-cairo font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition"
            >
              <span>الموقع على الخريطة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Link
              href="/about"
              className="text-xs sm:text-sm font-cairo font-bold text-[#5C4A3D] hover:text-[#231710] px-3 py-2.5 transition"
            >
              تفاصيل الفرع والتواصل
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
