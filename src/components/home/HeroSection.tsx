'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  getResolvedFeatureFlags,
  getResolvedPageContent,
  getSafeImageUrl,
  stripUiEmojis,
} from '@/lib/defaults';

interface BannerSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  image: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
}

export default function HeroSection() {
  const { storeData } = useStore();
  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const featureFlags = getResolvedFeatureFlags(settings);
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';

  const customHeroHeadline = [
    pageContent.heroTitlePrefix,
    pageContent.heroTitleHighlight,
    pageContent.heroTitleSuffix,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const slides: BannerSlide[] = [
    {
      id: 'slide-main',
      badge:
        pageContent.heroBadge || 'محمصة حفصة — بني مزار • تحميص يومي طازج 100%',
      title:
        customHeroHeadline ||
        'أصل التحميصة ومزاج القهوة الفاخر.. الآن في قلب بني مزار',
      subtitle:
        pageContent.heroDescription ||
        '24 عين مكسرات وتسالي محمصة يومياً، 4 صوامع بن طازج وركن إسبريسو، وتوصيل فوري خلال 30 دقيقة للبندر ودورتين يومياً للقرى.',
      image: getSafeImageUrl(
        pageContent.heroImage || '/images/products/royal-mix.jpg'
      ),
      primaryCta: {
        label: pageContent.heroPrimaryCtaText || 'صمّم بوكس السهرة (125 ج)',
        href: featureFlags.enableCustomBoxes ? '/build-box' : '/shop',
      },
      secondaryCta: {
        label: 'تصفح المتجر',
        href: '/shop',
      },
    },
    {
      id: 'slide-coffee-bar',
      badge: 'ركن القهوة والبار الطازج — أمام مسجد الزراعيين',
      title: 'قهوتك مطحونة قدام عينك.. تركي وإسبريسو وآيس كوفي من 25 ج.م',
      subtitle:
        'اطلب قهوتك التركي على الرمل أو الإسبريسو الإيطالي أو الآيس لاتيه طازجاً ليصلك لباب بيتك أو مكتبك في بندر بني مزار خلال 30 دقيقة.',
      image: getSafeImageUrl('/images/branch/store-interior.jpg'),
      primaryCta: {
        label: 'تصفح ركن القهوة والبار',
        href: '/shop?cat=cat-coffee-bar',
      },
      secondaryCta: {
        label: featureFlags.enableCoffeeBlender
          ? featureFlags.blenderModuleLabel || 'اعمل توليفة قهوتك'
          : 'قسم البن والمحمصة',
        href: featureFlags.enableCoffeeBlender
          ? '/coffee-blender'
          : '/shop?cat=cat-coffee-espresso',
      },
    },
    {
      id: 'slide-offers',
      badge: 'بوكسات السهرة المقسمة وهدايا المناسبات في بني مزار',
      title: 'سهرتك أحلى مع بوكس «لمة الخميس» وهدايا حفصة الفاخرة',
      subtitle:
        'اختر بوكس 4 خانات بـ 125 ج.م أو بوكس العيلة 6 خانات بـ 250 ج.م أو صمّم بوكسك بنفسك مع 5% كاش باك تلقائي في محفظة حفصة VIP.',
      image: getSafeImageUrl('/images/products/pistachio.jpg'),
      primaryCta: {
        label: 'تصفح العروض والخصومات',
        href: '#special-offers',
      },
      secondaryCta: {
        label: 'كوبايات التسلية السريعة',
        href: '/shop?cat=cat-quick-cups',
      },
    },
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartXRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  const current = slides[activeSlide] || slides[0];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    const endX = e.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    setPaused(false);
    if (startX === null || endX === null || slides.length <= 1) return;
    const diff = endX - startX;
    if (Math.abs(diff) > 40) {
      setActiveSlide((prev) =>
        diff > 0 ? (prev + 1) % slides.length : (prev - 1 + slides.length) % slides.length
      );
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3 sm:pt-5 space-y-4">
      {/* Harmonious Rounded Hero Showcase Frame */}
      <div
        className="relative w-full min-h-[360px] sm:min-h-[440px] lg:min-h-[490px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#231710] shadow-[0_18px_45px_-16px_rgba(35,23,16,0.18)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Cross-fading Background Slides */}
        {slides.map((slide, idx) => {
          const isCurrent = idx === activeSlide;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <img
                src={slide.image}
                alt={`${storeName} - ${slide.title}`}
                loading={idx === 0 ? 'eager' : 'lazy'}
                className={`w-full h-full object-cover object-center transition-transform duration-1000 ease-out ${
                  isCurrent ? 'scale-100' : 'scale-[1.04]'
                }`}
              />
              {/* Soft Warm Roasted-Espresso Gradient Overlay for Comfortable Eye Contrast */}
              <div className="absolute inset-0 bg-gradient-to-l from-[#1E130D]/90 via-[#2B1C13]/72 to-[#1E130D]/30" />
            </div>
          );
        })}

        {/* Slide Content */}
        <div className="relative z-20 px-5 sm:px-10 lg:px-14 h-full min-h-[360px] sm:min-h-[440px] lg:min-h-[490px] flex items-center py-10 sm:py-14">
          <div className="max-w-2xl space-y-4 sm:space-y-5 text-right text-[#FAF7F2]">
            <div className="inline-flex items-center gap-2 bg-white/14 backdrop-blur-md text-[#F4D393] border border-white/20 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-cairo font-bold">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#E5B869]" />
              <span>{stripUiEmojis(current.badge)}</span>
            </div>

            <h1 className="font-cairo text-2xl sm:text-3xl lg:text-[38px] font-black leading-[1.45] sm:leading-[1.4] text-[#FAF7F2]">
              {stripUiEmojis(current.title)}
            </h1>

            <p className="text-xs sm:text-base text-[#FAF7F2]/85 leading-relaxed max-w-xl font-normal">
              {stripUiEmojis(current.subtitle)}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={current.primaryCta.href}
                className="min-h-[46px] bg-[#E5B869] hover:bg-[#DBA954] text-[#231710] font-cairo font-black text-xs sm:text-sm px-6 py-3 rounded-xl sm:rounded-2xl flex items-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.98]"
              >
                <span>{stripUiEmojis(current.primaryCta.label)}</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <Link
                href={current.secondaryCta.href}
                className="min-h-[46px] bg-white/12 hover:bg-white/22 backdrop-blur-md text-[#FAF7F2] border border-white/25 font-cairo font-bold text-xs sm:text-sm px-5 py-3 rounded-xl sm:rounded-2xl flex items-center gap-2 transition-all duration-200"
              >
                <span>{stripUiEmojis(current.secondaryCta.label)}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Desktop Left/Right Arrows */}
        <button
          type="button"
          onClick={() =>
            setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length)
          }
          aria-label="البانر السابق"
          className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/15 hover:bg-white/95 text-[#FAF7F2] hover:text-[#231710] border border-white/20 items-center justify-center backdrop-blur-md transition cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveSlide((prev) => (prev + 1) % slides.length)}
          aria-label="البانر التالي"
          className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/15 hover:bg-white/95 text-[#FAF7F2] hover:text-[#231710] border border-white/20 items-center justify-center backdrop-blur-md transition cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Bottom Slider Pagination Dots */}
        <div className="absolute bottom-4 inset-x-0 z-30 flex items-center justify-center gap-2">
          {slides.map((s, idx) => {
            const active = idx === activeSlide;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlide(idx)}
                aria-label={`انتقل إلى الشريحة ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  active
                    ? 'w-8 bg-[#E5B869]'
                    : 'w-2 bg-white/50 hover:bg-white/85'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Calm Elevated Trust & Value Highlights Bar */}
      <div className="bg-white rounded-2xl border border-[#E8DFD3] px-4 sm:px-6 py-4 shadow-[0_4px_20px_-10px_rgba(35,23,16,0.06)] grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#F6F1EA] border border-[#EAE0D3] text-[#9A6836] flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </span>
          <div>
            <div className="font-cairo font-extrabold text-[#261A13]">
              تحميص طازج يومياً
            </div>
            <div className="text-[11px] text-[#6E5D4F]">
              قرمشة مثالية وتعبئة فورية
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#F6F1EA] border border-[#EAE0D3] text-[#9A6836] flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </span>
          <div>
            <div className="font-cairo font-extrabold text-[#261A13]">
              جميع الأوزان والكميات
            </div>
            <div className="text-[11px] text-[#6E5D4F]">
              ١٢٥ جم • ٢٥٠ جم • ٥٠٠ جم • ١ كجم
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#F6F1EA] border border-[#EAE0D3] text-[#9A6836] flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4" />
          </span>
          <div>
            <div className="font-cairo font-extrabold text-[#261A13]">
              توصيل سريع لباب البيت
            </div>
            <div className="text-[11px] text-[#6E5D4F]">
              شحن محلي وجميع المحافظات
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#EEF5F0] border border-[#D4E8DA] text-[#3B6E4C] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div>
            <div className="font-cairo font-extrabold text-[#261A13]">
              الدفع عند الاستلام
            </div>
            <div className="text-[11px] text-[#6E5D4F]">
              أو فودافون كاش وإنستا باي
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
