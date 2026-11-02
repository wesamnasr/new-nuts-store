'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Coffee, Gift, MapPin } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function HeroSection() {
  const { storeData } = useStore();
  const settings = storeData?.settings;

  return (
    <section className="bg-[#FAF6F0] border-b border-[#E8E0D5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Right Editorial Copy Column */}
        <div className="lg:col-span-7 space-y-6 text-right">
          <div className="inline-flex items-center gap-2 bg-white border border-[#E8E0D5] text-[#5C4A3D] px-3.5 py-1.5 rounded-full text-xs font-medium">
            <MapPin className="w-3.5 h-3.5 text-[#9A6836]" />
            <span>{settings?.address || 'بني مزار — أمام مسجد الزراعيين'}</span>
          </div>

          <div className="space-y-3">
            <h1 className="font-cairo text-3xl sm:text-4xl lg:text-[44px] font-bold leading-[1.28] text-[#231710] tracking-tight">
              أصل التحميصة ومزاج القهوة الطازجة يومياً
            </h1>
            <p className="text-sm sm:text-base text-[#5C4A3D] leading-relaxed max-w-xl">
              نختار أجود حبوب البن والمكسرات النخب الأول، نحمّصها ونطحنها طازجة حسب طلبك في فرع بني مزار لتصلك بكامل نكهتها وقرمشتها.
            </p>
          </div>

          {/* Calm Primary & Secondary CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/shop"
              className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-sm px-6 py-3.5 rounded-xl flex items-center gap-2 transition"
            >
              <span>تصفح المتجر</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <Link
              href="/build-box"
              className="bg-white hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-sm px-5 py-3.5 rounded-xl flex items-center gap-2 transition"
            >
              <Gift className="w-4 h-4 text-[#9A6836]" />
              <span>بوكس السهرة</span>
            </Link>

            <Link
              href="/coffee-blender"
              className="text-[#5C4A3D] hover:text-[#231710] font-cairo font-bold text-sm px-3 py-3 rounded-xl flex items-center gap-1.5 transition"
            >
              <Coffee className="w-4 h-4 text-[#9A6836]" />
              <span>معمل توليفة البن</span>
            </Link>
          </div>
        </div>

        {/* Left Framed Artisanal Visual */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl bg-white p-2.5 border border-[#E8E0D5] shadow-xs">
            <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-[#F4EFE6]">
              <img
                src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=85"
                alt="محمصة حفصة للبن والمكسرات - بني مزار"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
