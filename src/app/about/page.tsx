'use client';

import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Phone,
  Sparkles,
  Coffee,
  Gift,
  Crown,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function AboutPage() {
  const { storeData } = useStore();
  const settings = storeData?.settings;

  const storeZones = [
    {
      icon: '🥜',
      title: 'بنك المكسرات والتسالي (24 عين زجاجية مضاءة)',
      desc: 'مقسم بدقة هندسية إلى 12 عين سفلية للب والتسالي والسوداني، و12 عين علوية للمكسرات الفاخرة والتمور والفواكه المجففة.',
    },
    {
      icon: '☕',
      title: 'ركن البن والـ 4 صوامع النحاسية والمطحن الألماني',
      desc: '4 صوامع نحاسية فاخرة تحفظ حبوب البن (فاتح، وسط، غامق، وإسبريسو) مع طحن فوري لحظة الطلب وتحويجة الحبهان والزعفران.',
    },
    {
      icon: '🍯',
      title: 'ركن خلية العسل الخشبية السداسية',
      desc: 'عرض هندسي مضاء لبرطمانات عسل النحل الطبيعي (سدر جبلي، موالح، حبة البركة) وعسل الطاقة بالمكسرات الملكية.',
    },
    {
      icon: '🥤',
      title: 'استاند السعادة وكاسات الـ Dome Lid الجاهزة',
      desc: 'كاسات سناك ومكسرات وشوكولاتة مستوردة جاهزة للخطف السريع بأسعار تبدأ من 35 ج.م و50 ج.م.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Hero Banner */}
      <div className="bg-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37]/50 py-10 sm:py-14 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-3.5 py-1 rounded-full text-xs font-black">
            <Sparkles className="w-3.5 h-3.5" />
            <span>قصة محمصة حفصة للبن والمكسرات • HAFSA ROASTERY</span>
          </div>
          <h1 className="font-cairo text-2xl sm:text-4xl font-black text-white">
            تجربة التحميص الفاخر ومزاج القهوة الأصيل في قلب بني مزار
          </h1>
          <p className="text-xs sm:text-base text-[#F3ECE1]/85 max-w-3xl mx-auto leading-relaxed">
            انطلقت «محمصة حفصة للبن والمكسرات» من قلب مركز بني مزار (أمام مسجد الزراعيين) لتقدم
            مفهوماً عصرياً يجمع بين فخامة التصميم المعماري (رخام الكالاكاتا والإضاءة الدافئة) وبين
            أعلى معايير النظافة والتحميص اليومي الطازج بأسعار تناسب كل بيت في بني مزار.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10">
        {/* 4 Architectural Store Zones */}
        <div className="space-y-4">
          <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#231710] text-center">
            أركان فرع «محمصة حفصة» في بني مزار
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {storeZones.map((zone, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-5 border border-[#E6DFD3] shadow-xs space-y-2.5"
              >
                <div className="w-11 h-11 rounded-2xl bg-[#F3ECE1] border border-[#D4AF37] flex items-center justify-center text-xl">
                  {zone.icon}
                </div>
                <h3 className="font-cairo text-sm font-black text-[#231710]">
                  {zone.title}
                </h3>
                <p className="text-xs text-[#6E5D4F] leading-relaxed">{zone.desc}</p>
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
            <h2 className="font-cairo text-2xl font-black text-[#231710]">
              تفضل بزيارتنا في فرع بني مزار — أمام مسجد الزراعيين
            </h2>
            <div className="space-y-2.5 text-xs sm:text-sm text-[#231710]">
              <p className="flex items-center gap-2 font-bold">
                <MapPin className="w-4 h-4 text-[#C88A4B] shrink-0" />
                <span>
                  {settings?.address ||
                    'محافظة المنيا - مركز بني مزار - وسط البلد - أمام مسجد الزراعيين مباشرة'}
                </span>
              </p>
              <p className="flex items-center gap-2 font-bold">
                <Clock className="w-4 h-4 text-[#C88A4B] shrink-0" />
                <span>
                  {settings?.workingHours ||
                    'يومياً من الساعة 9:00 صباحاً حتى 1:00 بعد منتصف الليل'}
                </span>
              </p>
              <p className="flex items-center gap-2 font-bold tabular-nums">
                <Phone className="w-4 h-4 text-[#C88A4B] shrink-0" />
                <span>خط الطلبات السريعة والواتساب: {settings?.supportPhone || '01000000000'}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <a
                href="https://maps.google.com/?q=Bani+Mazar+Minya+Egypt"
                target="_blank"
                rel="noreferrer"
                className="bg-[#231710] text-[#D4AF37] font-cairo font-black text-xs px-5 py-3 rounded-2xl shadow"
              >
                📍 افتح الاتجاهات على خرائط جوجل (Google Maps)
              </a>
              <Link
                href="/build-box"
                className="bg-[#D4AF37] text-[#231710] font-cairo font-black text-xs px-5 py-3 rounded-2xl shadow"
              >
                🎁 صمّم بوكس السهرة الآن
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-[#E6DFD3] h-64 sm:h-72 bg-[#F3ECE1] relative flex items-center justify-center">
              <iframe
                title="موقع محمصة حفصة للبن والمكسرات - بني مزار"
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
