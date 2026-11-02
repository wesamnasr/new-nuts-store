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
  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً ${storeName}، أود الاستفسار عن موقع الفرع والطلبات.`
  )}`;

  const storeZones = [
    {
      Icon: Award,
      title: 'ركن المكسرات والتسالي',
      desc: 'تشكيلة واسعة من المكسرات الفاخرة والتسالي المحمصة يومياً بالهواء الساخن.',
    },
    {
      Icon: Coffee,
      title: 'ركن تحميص وطحن البن',
      desc: 'تحميص وطحن فوري لحبوب البن المختارة بالدرجة والتحويجة المفضلة.',
    },
    {
      Icon: Leaf,
      title: 'ركن العسل والتمور',
      desc: 'عسل نحل طبيعي وتمور فاخرة ومكسرات بالعسل الجبلي.',
    },
    {
      Icon: Gift,
      title: 'بوكسات الضيافة والسهرة',
      desc: 'علب مقسمة وتشكيلات مخصصة للسهرات والهدايا والضيافة.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Calm Light Page Header */}
      <div className="bg-white border-b border-[#E8E0D5] py-10 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-2">
          <span className="text-xs font-bold text-[#9A6836]">عن المحمصة والفرع</span>
          <h1 className="font-cairo text-2xl sm:text-3xl font-bold text-[#231710]">
            تحميص يومي طازج في قلب بني مزار
          </h1>
          <p className="text-sm text-[#5C4A3D] max-w-xl mx-auto">
            نعتني بكل تفصيلة من انتقاء الحبوب والمكسرات وحتى التغليف المحكم ليصلك الطعم الأصيل طازجاً في كل مرة.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10">
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
                {settings?.address || 'بني مزار — أمام مسجد الزراعيين'}
              </h2>
            </div>

            <div className="space-y-2.5 text-sm text-[#5C4A3D]">
              <p className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#9A6836] shrink-0" />
                <span>{settings?.address || 'بني مزار - أمام مسجد الزراعيين'}</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#9A6836] shrink-0" />
                <span>{settings?.workingHours || 'يومياً من 9 صباحاً حتى 1 بعد منتصف الليل'}</span>
              </p>
              <p className="flex items-center gap-2.5 tabular-nums">
                <Phone className="w-4 h-4 text-[#9A6836] shrink-0" />
                <span>خدمة العملاء: {settings?.supportPhone || '01100699524'}</span>
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
                href={settings?.googleMapsUrl || 'https://maps.google.com/?q=Bani+Mazar+Minya+Egypt'}
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
