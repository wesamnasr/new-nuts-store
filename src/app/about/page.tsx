'use client';

import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Phone,
  Award,
  Coffee,
  Leaf,
  Gift,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { formatWhatsAppPhone } from '@/lib/validation';

export default function AboutPage() {
  const { storeData } = useStore();
  const settings = storeData?.settings;
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const cityName = settings?.cityName || 'بني مزار';
  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً ${storeName} (بني مزار)، أود الاستفسار عن موقع الفرع والطلبات.`
  )}`;

  const storeZones = [
    {
      Icon: Award,
      title: 'بنك المكسرات والتسالي (24 عين)',
      desc: 'تشكيلة نخب أول من المكسرات واللب والتسالي المحمصة يومياً بالهواء الساخن مع حفظ القرمشة.',
    },
    {
      Icon: Coffee,
      title: 'ركن القهوة والبار والصوامع الـ 4',
      desc: 'طحن فوري أمام عينك مع مشروبات القهوة التركي والإسبريسو واللاتيه والآيس كوفي طازجة يومياً.',
    },
    {
      Icon: Leaf,
      title: 'خلية النحل والعسل والتمور',
      desc: 'عسل نحل طبيعي بالمكسرات وتمور مجدولة محشوة وتوابل استاند العطار النقية.',
    },
    {
      Icon: Gift,
      title: 'بوكسات السهرة وهدايا المناسبات',
      desc: 'بوكسات مقسمة 4 و6 خانات وكوبايات التسلية السريعة وتغليف هدايا فاخر بنفس اليوم.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Calm Light Page Header with Official Hafsa Logo */}
      <div className="bg-white border-b border-[#E8E0D5] py-10 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <img
            src="/images/brand/hafsa-sticker-gold.png"
            alt={storeName}
            width={88}
            height={88}
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full object-contain shadow-sm ring-2 ring-[#D4AF37]/40"
          />
          <span className="text-xs font-bold text-[#9A6836] block">
            عن محمصة حفصة • {cityName}
          </span>
          <h1 className="font-cairo text-2xl sm:text-3xl font-bold text-[#231710]">
            حفصة.. طزاجة تُرى ورائحة لا تُنسى في قلب {cityName}
          </h1>
          <p className="text-sm text-[#5C4A3D] max-w-xl mx-auto">
            أمام مسجد الزراعيين مباشرة — نجمع بين فخامة المكسرات والكاندي والهدايا مع ركن القهوة والإسبريسو الطازج والطحن الفوري ونظام ولاء 5% كاش باك.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10">
        {/* Visual Store Tour (Real Hafsa Design Showcase) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl overflow-hidden border border-[#E8E0D5] shadow-xs">
            <img
              src="/images/branch/store-exterior.jpg"
              alt="الواجهة الخارجية لمحمصة حفصة — بني مزار أمام مسجد الزراعيين"
              className="w-full h-60 sm:h-72 object-cover"
            />
            <div className="p-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-cairo font-extrabold text-sm text-[#231710]">
                  الواجهة الرئيسية — أمام مسجد الزراعيين مباشرة
                </h3>
                <p className="text-xs text-[#6E5D4F]">
                  بندر بني مزار • سهولة الوصول وخدمة الاستلام الفوري من الفرع
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden border border-[#E8E0D5] shadow-xs">
            <img
              src="/images/branch/store-interior.jpg"
              alt="التصميم الداخلي لركن القهوة والبار وبنك المكسرات بمحمصة حفصة"
              className="w-full h-60 sm:h-72 object-cover"
            />
            <div className="p-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-cairo font-extrabold text-sm text-[#231710]">
                  بنك المكسرات (24 عين) + ركن القهوة والإسبريسو + خلية العسل
                </h3>
                <p className="text-xs text-[#6E5D4F]">
                  تحميص وطحن فوري قدام عينك وتغليف حراري يحفظ القرمشة
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* 4 Store Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {storeZones.map((zone, idx) => {
            const IconComp = zone.Icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-[#E8E0D5] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center text-[#231710]">
                  <IconComp className="w-4 h-4 stroke-[1.75]" />
                </div>
                <h3 className="font-cairo text-base font-bold text-[#231710]">
                  {zone.title}
                </h3>
                <p className="text-xs text-[#5C4A3D] leading-relaxed">{zone.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Location, Contact & Interactive Map Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E0D5] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-[#9A6836]">
                موقع الفرع ومواعيد العمل
              </span>
              <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
                {settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة'}
              </h2>
            </div>

            <div className="space-y-2.5 text-sm text-[#5C4A3D]">
              <p className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#9A6836] shrink-0" />
                <span>{settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة'}</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#9A6836] shrink-0" />
                <span>{settings?.workingHours || 'يومياً من 9 صباحاً حتى 2 بعد منتصف الليل'}</span>
              </p>
              <p className="flex items-center gap-2.5 tabular-nums">
                <Phone className="w-4 h-4 text-[#9A6836] shrink-0" />
                <span>خدمة العملاء والطلبات: {settings?.supportPhone || '01107677672'}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs sm:text-sm px-5 py-3 rounded-xl inline-flex items-center gap-2 transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>تواصل عبر واتساب</span>
              </a>
              <a
                href={settings?.googleMapsUrl || 'https://maps.google.com/?q=28.5036,30.8004'}
                target="_blank"
                rel="noreferrer"
                className="bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs sm:text-sm px-5 py-3 rounded-xl inline-flex items-center gap-2 transition"
              >
                <span>خرائط جوجل</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <Link
                href="/shop"
                className="bg-white hover:bg-[#FAF6F0] text-[#5C4A3D] hover:text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs sm:text-sm px-4 py-3 rounded-xl transition"
              >
                تصفح المتجر
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-[#E8E0D5] h-64 sm:h-72 bg-[#FAF6F0]">
              <iframe
                title={`موقع ${storeName}`}
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
