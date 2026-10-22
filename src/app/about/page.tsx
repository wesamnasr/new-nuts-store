'use client';

import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Phone,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function AboutPage() {
  const { storeData } = useStore();
  const settings = storeData?.settings;

  const storeZones = [
    {
      icon: '🥜',
      title: 'بنك المكسرات والتسالي',
      desc: '24 عين زجاجية للمكسرات الفاخرة والتسالي الطازجة.',
    },
    {
      icon: '☕',
      title: 'ركن البن والصوامع النحاسية',
      desc: 'تحميص وطحن فوري بالدرجة والتحويجة المفضلة.',
    },
    {
      icon: '🍯',
      title: 'خلية العسل الطبيعي',
      desc: 'عسل نحل طبيعي ومكسرات بالعسل الجبلي.',
    },
    {
      icon: '🥤',
      title: 'استاند السعادة السريع',
      desc: 'كاسات سناك ومكسرات وشوكولاتة جاهزة.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Hero Banner */}
      <div className="bg-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37]/50 py-8 sm:py-10 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-3.5 py-1 rounded-full text-xs font-black">
            <Sparkles className="w-3.5 h-3.5" />
            <span>محمصة حفصة • HAFSA ROASTERY</span>
          </div>
          <h1 className="font-cairo text-2xl sm:text-3xl font-black text-white">
            تحميص يومي طازج في قلب بني مزار
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* 4 Architectural Store Zones */}
        <div className="space-y-4">
          <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#231710] text-center">
            أركان المحمصة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {storeZones.map((zone, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-2"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#F3ECE1] border border-[#D4AF37] flex items-center justify-center text-xl">
                  {zone.icon}
                </div>
                <h3 className="font-cairo text-sm font-black text-[#231710]">
                  {zone.title}
                </h3>
                <p className="text-xs text-[#6E5D4F]">{zone.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Location & Interactive Map Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#D4AF37] shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="bg-[#231710] text-[#D4AF37] text-xs font-black px-3 py-1 rounded-full inline-block">
              📍 موقع الفرع ومواعيد العمل
            </span>
            <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#231710]">
              فرع بني مزار — أمام مسجد الزراعيين
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-[#231710]">
              <p className="flex items-center gap-2 font-bold">
                <MapPin className="w-4 h-4 text-[#C88A4B] shrink-0" />
                <span>
                  {settings?.address || 'بني مزار - أمام مسجد الزراعيين'}
                </span>
              </p>
              <p className="flex items-center gap-2 font-bold">
                <Clock className="w-4 h-4 text-[#C88A4B] shrink-0" />
                <span>
                  {settings?.workingHours || 'يومياً من 9 صباحاً حتى 1 صباحاً'}
                </span>
              </p>
              <p className="flex items-center gap-2 font-bold tabular-nums">
                <Phone className="w-4 h-4 text-[#C88A4B] shrink-0" />
                <span>واتساب وخدمة العملاء: {settings?.supportPhone || '01000000000'}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <a
                href="https://maps.google.com/?q=Bani+Mazar+Minya+Egypt"
                target="_blank"
                rel="noreferrer"
                className="bg-[#231710] text-[#D4AF37] font-cairo font-black text-xs px-5 py-3 rounded-2xl shadow"
              >
                📍 خرائط جوجل
              </a>
              <Link
                href="/build-box"
                className="bg-[#D4AF37] text-[#231710] font-cairo font-black text-xs px-5 py-3 rounded-2xl shadow"
              >
                🎁 صمّم بوكس السهرة
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-[#E6DFD3] h-64 sm:h-72 bg-[#F3ECE1] relative flex items-center justify-center">
              <iframe
                title="موقع محمصة حفصة - بني مزار"
                src="https://www.google.com/maps?q=28.5036,30.8004&hl=ar&z=15&output=embed"
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
