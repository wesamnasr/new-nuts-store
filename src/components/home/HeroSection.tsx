'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Flame,
  Truck,
  Scale,
  Crown,
  Gift,
  Coffee,
  ArrowLeft,
} from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#231710] via-[#2B1C14] to-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37]/40">
      {/* Decorative Gold Radial Glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #D4AF37 0%, transparent 45%), radial-gradient(circle at 80% 70%, #C88A4B 0%, transparent 50%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Right Text Column */}
        <div className="lg:col-span-7 space-y-5 text-right">
          <div className="inline-flex items-center gap-2 bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-[#D4AF37] px-3.5 py-1.5 rounded-full text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>محمصة حفصة للبن والمكسرات (HAFSA ROASTERY) • مركز بني مزار</span>
          </div>

          <h1 className="font-cairo text-2xl sm:text-4xl lg:text-[42px] font-black leading-[1.25] text-white">
            أصل التحميصة ومزاج القهوة الفاخر..{' '}
            <span className="text-[#D4AF37]">الآن في قلب بني مزار</span>
          </h1>

          <p className="text-sm sm:text-base text-[#F3ECE1]/90 leading-relaxed max-w-2xl">
            من أجود مزارع البن العالمية وأفخر المكسرات الطازجة، نحمّصها لك يومياً بعناية في فرعنا
            أمام مسجد الزراعيين لتصل إليك دافئة ومقرمشة. صمّم بوكس سهرتك أو توليفة قهوتك الخاصة
            في ثوانٍ!
          </p>

          {/* 3 Primary CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/build-box"
              className="bg-gradient-to-l from-[#D4AF37] to-[#C88A4B] hover:opacity-95 text-[#231710] font-cairo font-black text-xs sm:text-sm px-5 py-3.5 rounded-2xl shadow-lg flex items-center gap-2 transition active:scale-95"
            >
              <Gift className="w-4 h-4" />
              <span>🎁 صمّم بوكس السهرة (يبدأ من 125 ج)</span>
            </Link>

            <Link
              href="/coffee-blender"
              className="bg-[#3A2519] hover:bg-[#4A3020] text-[#FAF6F0] border-2 border-[#D4AF37] font-cairo font-black text-xs sm:text-sm px-5 py-3.5 rounded-2xl shadow-md flex items-center gap-2 transition active:scale-95"
            >
              <Coffee className="w-4 h-4 text-[#D4AF37]" />
              <span>☕ اطلب بن وتوليفة خاصة</span>
            </Link>

            <Link
              href="/shop"
              className="bg-white/10 hover:bg-white/20 text-[#FAF6F0] border border-[#FAF6F0]/40 font-cairo font-bold text-xs sm:text-sm px-4 py-3.5 rounded-2xl flex items-center gap-1.5 transition"
            >
              <span>🥜 تصفح المتجر والأقسام</span>
              <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
            </Link>
          </div>

          {/* Live Store Location & Quick Stats */}
          <div className="pt-3 grid grid-cols-3 gap-3 border-t border-white/15 max-w-xl">
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
              <div className="font-cairo text-base sm:text-lg font-black text-[#D4AF37] tabular-nums">
                24 عين
              </div>
              <div className="text-[10.5px] text-[#F3ECE1]/80 font-bold">
                بنك مكسرات وتسالي طازجة
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
              <div className="font-cairo text-base sm:text-lg font-black text-[#D4AF37] tabular-nums">
                4 صوامع
              </div>
              <div className="text-[10.5px] text-[#F3ECE1]/80 font-bold">
                بن نحاسي ومطحن ألماني
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
              <div className="font-cairo text-base sm:text-lg font-black text-emerald-400 tabular-nums">
                30 دقيقة
              </div>
              <div className="text-[10.5px] text-[#F3ECE1]/80 font-bold">
                توصيل لبندر بني مزار
              </div>
            </div>
          </div>
        </div>

        {/* Left Visual Showcase Column */}
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden border-2 border-[#D4AF37] shadow-2xl bg-[#1A110B]">
            <img
              src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=85"
              alt="محمصة حفصة للبن والمكسرات - بني مزار"
              className="w-full h-64 sm:h-80 object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#231710] via-[#231710]/30 to-transparent" />
            <div className="absolute bottom-4 inset-x-4 bg-[#231710]/90 backdrop-blur-md border border-[#D4AF37]/50 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black text-[#D4AF37] block">
                  📍 الفرع الرئيسي — وسط البلد
                </span>
                <h3 className="font-cairo text-xs sm:text-sm font-black text-white">
                  بني مزار — أمام مسجد الزراعيين مباشرة
                </h3>
                <p className="text-[10.5px] text-[#F3ECE1]/80 mt-0.5">
                  مفتوح يومياً من 9 صباحاً حتى 1 بعد منتصف الليل
                </p>
              </div>
              <Link
                href="/build-box"
                className="bg-[#D4AF37] text-[#231710] px-3 py-2 rounded-xl text-[11px] font-black shrink-0 shadow"
              >
                بوكس 125ج ✨
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Value Bar for Bani Mazar */}
      <div className="bg-[#F3ECE1] text-[#231710] border-t border-[#E6DFD3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-xl border border-[#E6DFD3]">
            <div className="w-9 h-9 rounded-xl bg-[#C88A4B]/20 text-[#231710] flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-[#B83B2B]" />
            </div>
            <div>
              <h3 className="font-cairo text-xs font-black text-[#231710]">
                🔥 تحميص يومي طازج
              </h3>
              <p className="text-[10px] text-[#6E5D4F] font-medium">
                مكسرات مقرمشة وبن مطحون لحظة الطلب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-xl border border-[#E6DFD3]">
            <div className="w-9 h-9 rounded-xl bg-[#3B6E4C]/15 text-[#3B6E4C] flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-cairo text-xs font-black text-[#231710]">
                🛵 توصيل لبندر وقرى المركز
              </h3>
              <p className="text-[10px] text-[#6E5D4F] font-medium">
                البندر 30-45 د • دورات يومية للقرى
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-xl border border-[#E6DFD3]">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 text-[#231710] flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-[#C88A4B]" />
            </div>
            <div>
              <h3 className="font-cairo text-xs font-black text-[#231710]">
                ⚖️ أوزان تبدأ من ثمن كيلو
              </h3>
              <p className="text-[10px] text-[#6E5D4F] font-medium">
                ثمن 125ج • ربع 250ج • نصف 500ج • كيلو
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-xl border border-[#E6DFD3]">
            <div className="w-9 h-9 rounded-xl bg-[#231710] text-[#D4AF37] flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-cairo text-xs font-black text-[#231710]">
                👑 كاش باك 5% محفظة VIP
              </h3>
              <p className="text-[10px] text-[#6E5D4F] font-medium">
                نقاط فورية برقم موبايلك في المحل والموقع
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
