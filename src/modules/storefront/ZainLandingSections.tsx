'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCheck,
  Coffee,
  Gift,
  HelpCircle,
  MessageCircle,
  Minus,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react';
import { Product } from '@/types/store';
import ProductCard from '@/components/ProductCard';
import { useStore } from '@/context/StoreContext';
import {
  getCurrencySymbol,
  getResolvedFeatureFlags,
  getResolvedPageContent,
  getSafeImageUrl,
} from '@/lib/defaults';

interface ZainLandingSectionsProps {
  products: Product[];
}

interface FaqItem {
  question: string;
  answer: string;
}

interface WhatsAppTestimonial {
  id: string;
  customerName: string;
  city: string;
  time: string;
  message: string;
  orderedItem: string;
}

const WHATSAPP_TESTIMONIALS: ReadonlyArray<WhatsAppTestimonial> = [
  {
    id: 'rev-wa-1',
    customerName: 'أ. محمد عبد الرحمن',
    city: 'بندر بني مزار',
    time: '٩:٤٢ م',
    message:
      'ما شاء الله الطلب وصل خلال نص ساعة بالظبط، الفستق والكاجو تحميصهم طازة جداً والتغليف الحراري حافظ القرمشة كأنه لسه طالع من المحمصة!',
    orderedItem: 'فستق جامبو محمص + كاجو نخب أول',
  },
  {
    id: 'rev-wa-2',
    customerName: 'د. سارة محمود',
    city: 'شرق المحطة — بني مزار',
    time: '٧:١٥ م',
    message:
      'طلبت بوكس لمة الخميس وكوبايات الآيس لاتيه في ثواني من الموقع، الطعم والرائحة تحفة وبوكس الضيافة شرفني جداً قدام ضيوفي.',
    orderedItem: 'بوكس لمة الخميس 4 خانات + آيس سبانيش لاتيه',
  },
  {
    id: 'rev-wa-3',
    customerName: 'م. كريم حسن',
    city: 'قرية القيس — بني مزار',
    time: '٨:١٥ م',
    message:
      'أكتر حاجة عجبتني إن دورية القرى بتوصل في معادها بالظبط وبنفس أسعار المحل، والبن المحوج المخصوص بالحبهان طعمه أصلي بجد.',
    orderedItem: 'بن حفصة المحوج المخصوص + بوكس العيلة 6 خانات',
  },
];

export default function ZainLandingSections({
  products,
}: ZainLandingSectionsProps) {
  const { storeData } = useStore();
  const settings = storeData?.settings;
  const featureFlags = getResolvedFeatureFlags(settings);
  const pageContent = getResolvedPageContent(settings);
  const currency = getCurrencySymbol(settings);
  const freeShippingThreshold = settings?.freeShippingThreshold || 300;

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const onlineProducts = useMemo(
    () => products.filter((p) => p.showOnline !== false),
    [products]
  );

  // 1. Coffee Bar & Quick Cups Row (ركن القهوة والبار وكوبايات التسلية)
  const coffeeBarRow = useMemo(() => {
    return onlineProducts
      .filter(
        (p) =>
          p.categoryId === 'cat-coffee-bar' || p.categoryId === 'cat-quick-cups'
      )
      .slice(0, 4);
  }, [onlineProducts]);

  // 2. Snacks, Dried Fruits & Roastery Treats Row
  const snacksAndDriedRow = useMemo(() => {
    const matched = onlineProducts.filter(
      (p) =>
        p.categoryId === 'cat-snacks' || p.categoryId === 'cat-choco-candy'
    );
    return (matched.length >= 4 ? matched : onlineProducts.slice(4, 8)).slice(
      0,
      4
    );
  }, [onlineProducts]);

  // 3. Dates, Honey & Specialty Coffee Row
  const datesAndCoffeeRow = useMemo(() => {
    const matched = onlineProducts.filter(
      (p) =>
        p.categoryId === 'cat-honey-spices' ||
        p.categoryId === 'cat-coffee-espresso'
    );
    return (matched.length >= 4 ? matched : onlineProducts.slice(8, 12)).slice(
      0,
      4
    );
  }, [onlineProducts]);

  const faqItems: FaqItem[] = useMemo(
    () => [
      {
        question: 'هل المكسرات والبن طازجان وكيف يتم حفظ القرمشة؟',
        answer:
          'نعم، في محمصة حفصة ببني مزار يتم التحميص يومياً والطحن فور الطلب أمام عينك، وتُعبأ المكسرات والبن في أكياس سحاب محكمة الغلق لحفظ الزيوت الطبيعية والقرمشة الطازجة.',
      },
      {
        question: 'كيف يعمل توصيل بندر بني مزار ودورية القرى؟',
        answer:
          'داخل بندر بني مزار نوفر توصيلاً فورياً خلال 30 إلى 45 دقيقة بدون حد أدنى، وللقرى الكبرى (القيس، صندفا، بني علي، شلقام، أبشاق، طمبو، الجندية) نعمل بدورتين يومياً الساعة 2:00 ظهراً و8:00 مساءً بحد أدنى 200 ج.م، مع إمكانية الاستلام المجاني من المحل أمام مسجد الزراعيين.',
      },
      {
        question: 'كيف تعمل محفظة حفصة VIP وكاش باك الـ 5%؟',
        answer:
          'مع أي فاتورة بقيمة 150 ج.م أو أكثر (من كاشير المحل أو الموقع الإلكتروني) يُضاف 5% كاش باك تلقائياً لمحفظة رقم موبايلك، وتقدر تستبدل رصيدك في أي طلب قادم بسهولة.',
      },
      {
        question: 'ما هي طرق الدفع المتوفرة وتكلفة الشحن؟',
        answer: `متاح الدفع النقدي عند الاستلام، وفودافون كاش، وإنستا باي، والخصم من رصيد محفظة حفصة VIP. كما تحصل على شحن مجاني تلقائياً للطلبات فوق ${freeShippingThreshold} ${currency}.`,
      },
    ],
    [freeShippingThreshold, currency]
  );

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* Division 0: ركن القهوة والبار وكوبايات التسلية السريعة */}
      {coffeeBarRow.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold text-[#9A6836] block mb-0.5">
                جديد محمصة حفصة • طازج يومياً من البار
              </span>
              <h2 className="font-cairo text-xl sm:text-2xl lg:text-[26px] font-black text-[#261A13]">
                ركن القهوة والبار وكوبايات التسلية السريعة
              </h2>
              <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
                قهوة تركي ع الرمل، إسبريسو إيطالي، آيس كوفي، وكوبايات مكسرات وكاندي سريعة للتوصيل الفوري في البندر
              </p>
            </div>
            <Link
              href="/shop?cat=cat-coffee-bar"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-cairo font-extrabold text-[#9A6836] hover:text-[#261A13] transition-colors shrink-0"
            >
              <span>تصفح منيو البار بالكامل</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-5">
            {coffeeBarRow.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </section>
      )}
      {/* Division A: التسالي والمقرمشات والفواكه المجففة */}
      {snacksAndDriedRow.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="font-cairo text-xl sm:text-2xl lg:text-[26px] font-black text-[#261A13]">
                تسالي ومقرمشات وفواكه مجففة
              </h2>
              <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
                نكهات مقرمشة مختارة بعناية لسهرات العائلة والضيافة اليومية
              </p>
            </div>
            <Link
              href="/shop?cat=cat-snacks"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-cairo font-extrabold text-[#9A6836] hover:text-[#261A13] transition-colors"
            >
              <span>عرض القسم بالكامل</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-5">
            {snacksAndDriedRow.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </section>
      )}

      {/* Division B: Harmonious Warm Espresso Mid-Page Promotional Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-[#261A13] text-[#FAF7F2] border border-[#3D2B20] shadow-[0_18px_42px_-16px_rgba(35,23,16,0.22)]">
          <img
            src={getSafeImageUrl('/images/products/energy-mix.jpg')}
            alt="بوكسات الضيافة وتوليفات القهوة"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-28"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-[#1F140E]/95 via-[#322016]/88 to-[#462E20]/80" />

          <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 bg-white/12 backdrop-blur-md text-[#E5B869] border border-white/15 text-xs font-cairo font-extrabold px-3.5 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5" />
                <span>تجربة تسوق مخصصة على ذوقك</span>
              </span>
              <h2 className="font-cairo text-xl sm:text-3xl font-black leading-snug text-[#FAF7F2]">
                {featureFlags.enableCoffeeBlender &&
                pageContent.showCoffeeBlenderBanner !== false
                  ? pageContent.coffeeBlenderBannerTitle ||
                    'صمّم بوكس الضيافة المقسم أو ركّب توليفة قهوتك الخاصة بالجرام'
                  : 'شحن مجاني للطلبات العائلية وتغليف هدايا فاخر يليق بضيوفك'}
              </h2>
              <p className="text-xs sm:text-sm text-[#EDE3D5]/90 leading-relaxed">
                {pageContent.coffeeBlenderBannerDescription ||
                  `اختر أصنافك المفضلة واستمتع بشحن مجاني عند الطلب بقيمة ${freeShippingThreshold} ${currency} أو أكثر مع إمكانية الدفع عند الاستلام.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {featureFlags.enableCustomBoxes && (
                <Link
                  href="/build-box"
                  className="min-h-[46px] bg-[#E5B869] hover:bg-[#DBA954] text-[#231710] font-cairo font-black text-xs sm:text-sm px-6 py-3 rounded-full inline-flex items-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm"
                >
                  <Gift className="w-4 h-4" />
                  <span>{featureFlags.boxesModuleLabel || 'صمّم بوكسك الآن'}</span>
                </Link>
              )}

              {featureFlags.enableCoffeeBlender && (
                <Link
                  href="/coffee-blender"
                  className="min-h-[46px] bg-white/10 hover:bg-white/20 border border-white/25 text-[#FAF7F2] font-cairo font-bold text-xs sm:text-sm px-5 py-3 rounded-full inline-flex items-center gap-2 transition-all duration-200"
                >
                  <Coffee className="w-4 h-4 text-[#E5B869]" />
                  <span>
                    {featureFlags.blenderModuleLabel || 'معمل توليفة البن'}
                  </span>
                </Link>
              )}

              {!featureFlags.enableCustomBoxes &&
                !featureFlags.enableCoffeeBlender && (
                  <Link
                    href="/shop"
                    className="min-h-[46px] bg-[#E5B869] hover:bg-[#DBA954] text-[#231710] font-cairo font-black text-xs sm:text-sm px-6 py-3 rounded-full inline-flex items-center gap-2 transition-all duration-200"
                  >
                    <span>تسوق الآن</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                )}
            </div>
          </div>
        </div>
      </section>

      {/* Division C: تمور بجودة فاخرة وعسل وقهوة مختصة */}
      {datesAndCoffeeRow.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="font-cairo text-xl sm:text-2xl lg:text-[26px] font-black text-[#261A13]">
                تمور بجودة فاخرة وقهوة مختصة
              </h2>
              <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
                تمور ملكية محشوة وعسل طبيعي وبن محمص طازج لعشاق المذاق الأصيل
              </p>
            </div>
            <Link
              href="/shop?cat=cat-honey-spices"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-cairo font-extrabold text-[#9A6836] hover:text-[#261A13] transition-colors"
            >
              <span>تصفح التمور والقهوة</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-5">
            {datesAndCoffeeRow.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </section>
      )}

      {/* Division D: Smooth Fluid "الأسئلة الشائعة" Single-Column Accordion */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-cairo font-extrabold text-[#9A6836] bg-[#F6F1EA] border border-[#EAE0D3] px-3 py-1 rounded-full">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>إجابات سريعة وواضحة</span>
          </div>
          <h2 className="font-cairo text-xl sm:text-2xl lg:text-[28px] font-black text-[#261A13]">
            الأسئلة الشائعة
          </h2>
          <div className="w-14 h-1 bg-gradient-to-r from-[#9A6836] to-[#E5B869] rounded-full mx-auto pt-0.5" />
        </div>

        <div className="space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl border bg-white overflow-hidden transition-colors duration-200 ${
                  isOpen
                    ? 'border-[#C88A4B]/60 shadow-[0_6px_22px_-12px_rgba(35,23,16,0.08)]'
                    : 'border-[#E8DFD3]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 text-right hover:bg-[#FAF7F2]/80 transition-colors cursor-pointer"
                >
                  <span className="font-cairo text-sm sm:text-base font-extrabold text-[#261A13]">
                    {item.question}
                  </span>
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                      isOpen
                        ? 'bg-[#2C1D14] text-[#FAF7F2]'
                        : 'bg-[#F6F1EA] text-[#5E4D40] border border-[#EAE0D3]'
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-[#5E4D40] leading-relaxed border-t border-[#F4EFE6]">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Division E: Warm Harmonious "آراء عملائنا" Customer Reviews */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-cairo font-extrabold text-[#3B6E4C] bg-[#F1F7F3] border border-[#D4E6DA] px-3 py-1 rounded-full">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>رسائل وتقييمات حقيقية</span>
          </div>
          <h2 className="font-cairo text-xl sm:text-2xl lg:text-[28px] font-black text-[#261A13]">
            آراء عملائنا
          </h2>
          <p className="text-xs sm:text-sm text-[#6E5D4F]">
            ثقتكم سر تميزنا في تقديم أجود المحمصات الطازجة يومياً
          </p>
          <div className="w-14 h-1 bg-gradient-to-r from-[#9A6836] to-[#E5B869] rounded-full mx-auto pt-0.5" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {WHATSAPP_TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-[#E8DFD3] bg-white p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-[0_4px_20px_-10px_rgba(35,23,16,0.06)] hover:border-[#C88A4B]/50 transition-all duration-300"
            >
              {/* Top Customer Header */}
              <div className="flex items-center justify-between gap-2 border-b border-[#F2ECE3] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#F6F1EA] text-[#9A6836] border border-[#EAE0D3] font-cairo font-extrabold text-xs flex items-center justify-center">
                    {t.customerName.replace('أ. ', '').replace('د. ', '').replace('م. ', '')[0]}
                  </div>
                  <div>
                    <div className="font-cairo text-xs sm:text-sm font-extrabold text-[#261A13]">
                      {t.customerName}
                    </div>
                    <div className="text-[11px] text-[#3B6E4C] font-bold">
                      {t.city}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className="w-3.5 h-3.5 fill-[#D99B26] text-[#D99B26]"
                    />
                  ))}
                </div>
              </div>

              {/* Soft Warm Message Bubble */}
              <div className="bg-[#FAF7F2] rounded-2xl rounded-tr-xs p-3.5 border border-[#EAE0D3] space-y-2">
                <p className="text-xs sm:text-sm text-[#261A13] leading-relaxed">
                  {t.message}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[#6E5D4F] pt-1">
                  <span className="font-bold text-[#9A6836] truncate max-w-[72%]">
                    {t.orderedItem}
                  </span>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <span>{t.time}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-[#3B6E4C]" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
