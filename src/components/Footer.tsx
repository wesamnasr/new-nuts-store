'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MapPin,
  Phone,
  Clock,
  ShieldCheck,
  Truck,
  Store,
  MessageCircle,
  ArrowUp,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  getCityName,
  getResolvedFeatureFlags,
  getResolvedPageContent,
} from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';
import { useAdLandingMode } from '@/lib/ad-mode';

export default function Footer() {
  const { storeData, cartCount } = useStore();
  const pathname = usePathname();
  const isAdMode = useAdLandingMode();

  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/pos') ||
    pathname?.startsWith('/cashier') ||
    pathname?.startsWith('/supplier') ||
    pathname?.startsWith('/accountant') ||
    pathname?.startsWith('/rider')
  ) {
    return null;
  }

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const featureFlags = getResolvedFeatureFlags(settings);
  const cityName = getCityName(settings);
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً ${storeName}، أود الاستفسار عن الطلبات والمنتجات.`
  )}`;

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isAdMode) {
    return (
      <footer className="bg-[#F4EFE6] text-[#261A13] border-t border-[#E6DDD0] mt-10 pb-24 lg:pb-8 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center space-y-3">
          <div className="inline-flex items-center gap-2.5">
            <img
              src="/images/brand/hafsa-sticker-gold.png"
              alt={storeName}
              width={36}
              height={36}
              className="w-9 h-9 rounded-full object-contain ring-1 ring-[#D4AF37]/45 shrink-0"
            />
            <span className="font-cairo text-base font-black text-[#261A13]">
              {storeName}
            </span>
          </div>
          <p className="text-xs text-[#5E4D40]">
            {settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة'} •{' '}
            <a
              href={`tel:${settings?.supportPhone || '01107677672'}`}
              className="font-bold text-[#261A13] tabular-nums hover:text-[#9A6836]"
            >
              {settings?.supportPhone || '01107677672'}
            </a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-cairo font-extrabold transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>تواصل معنا عبر واتساب</span>
            </a>
            <Link
              href="/?mode=store"
              className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#5E4D40] border border-[#E8DFD3] text-xs font-bold transition"
            >
              تصفح باقي منتجات المتجر
            </Link>
          </div>
          <div className="text-[11px] text-[#6E5D4F] pt-2 border-t border-[#E6DDD0]">
            © {new Date().getFullYear()} {storeName} — جميع الحقوق محفوظة
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={`bg-[#F4EFE6] text-[#261A13] border-t border-[#E6DDD0] mt-16 print:hidden ${
        cartCount > 0 ? 'pb-32 lg:pb-16' : 'pb-20 lg:pb-8'
      }`}
    >
      {/* Service Pillars */}
      <div className="border-b border-[#E6DDD0] bg-white/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD3] flex items-center justify-center text-[#9A6836] shrink-0">
              <Store className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h4 className="font-cairo font-extrabold text-[#261A13] text-sm">
                {pageContent.footerFeatures[0]?.title ||
                  'منتجات مختارة بأعلى معايير الجودة'}
              </h4>
              <p className="text-xs text-[#6E5D4F]">
                {pageContent.footerFeatures[0]?.description ||
                  'تحميص يومي وتغليف محكم يحفظ الطزاجة والقرمشة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD3] flex items-center justify-center text-[#9A6836] shrink-0">
              <Truck className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h4 className="font-cairo font-extrabold text-[#261A13] text-sm">
                {pageContent.footerFeatures[2]?.title ||
                  'توصيل محلي سريع وشحن لجميع المحافظات'}
              </h4>
              <p className="text-xs text-[#6E5D4F]">
                {pageContent.footerFeatures[2]?.description ||
                  'تغطية سريعة وشحن آمن لباب المنزل'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#EEF5F0] border border-[#D4E8DA] flex items-center justify-center text-[#3B6E4C] shrink-0">
              <ShieldCheck className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h4 className="font-cairo font-extrabold text-[#261A13] text-sm">
                {pageContent.footerFeatures[1]?.title ||
                  'مكافآت كاش باك لأعضاء VIP'}
              </h4>
              <p className="text-xs text-[#6E5D4F]">
                {pageContent.footerFeatures[1]?.description ||
                  'رصيد تلقائي برقم الهاتف مع كل طلب'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Column 1: Brand & Branch Contact */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-3">
            <img
              src="/images/brand/hafsa-sticker-gold.png"
              alt={storeName}
              width={44}
              height={44}
              className="w-11 h-11 rounded-full object-contain shadow-xs ring-1 ring-[#D4AF37]/45 shrink-0"
            />
            <div>
              <h3 className="font-cairo text-lg font-black text-[#261A13] leading-tight">
                {storeName}
              </h3>
              <span className="text-[11px] font-bold text-[#9A6836]">
                حفصة.. طزاجة تُرى ورائحة لا تُنسى
              </span>
            </div>
          </div>
          <div className="space-y-2 text-xs text-[#5E4D40]">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#9A6836] shrink-0 mt-0.5" />
              <span>
                {settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة'}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#9A6836] shrink-0" />
              <a
                href={`tel:${settings?.supportPhone || '01107677672'}`}
                className="tabular-nums hover:text-[#9A6836] font-bold transition"
              >
                {settings?.supportPhone || '01107677672'}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#9A6836] shrink-0" />
              <span>
                {settings?.workingHours ||
                  'يومياً من 9 صباحاً حتى 2 بعد منتصف الليل'}
              </span>
            </p>
          </div>
          <div className="pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#261A13] hover:bg-[#3A281E] text-[#FAF7F2] text-xs font-cairo font-extrabold transition shadow-2xs"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>تواصل معنا عبر واتساب</span>
            </a>
          </div>
        </div>

        {/* Column 2: Primary Storefront Links */}
        <div>
          <h4 className="font-cairo text-sm font-extrabold text-[#261A13] mb-3">
            التسوق والأقسام
          </h4>
          <ul className="space-y-2 text-xs text-[#5E4D40] font-bold">
            <li>
              <Link href="/shop" className="hover:text-[#9A6836] transition">
                المتجر وجميع الأصناف
              </Link>
            </li>
            <li>
              <Link
                href="/shop?cat=cat-coffee-bar"
                className="hover:text-[#9A6836] transition"
              >
                ركن القهوة والبار
              </Link>
            </li>
            <li>
              <Link
                href="/shop?cat=cat-quick-cups"
                className="hover:text-[#9A6836] transition"
              >
                كوبايات التسلية السريعة
              </Link>
            </li>
            <li>
              <Link
                href="/#special-offers"
                className="hover:text-[#9A6836] transition"
              >
                العروض والخصومات
              </Link>
            </li>
            {featureFlags.enableCustomBoxes && (
              <li>
                <Link
                  href="/build-box"
                  className="hover:text-[#9A6836] transition"
                >
                  {featureFlags.boxesModuleLabel || 'صمّم بوكسك'}
                </Link>
              </li>
            )}
            {featureFlags.enableCoffeeBlender && (
              <li>
                <Link
                  href="/coffee-blender"
                  className="hover:text-[#9A6836] transition"
                >
                  {featureFlags.blenderModuleLabel || 'معمل التوليفات'}
                </Link>
              </li>
            )}
            <li>
              <Link href="/track" className="hover:text-[#9A6836] transition">
                تتبع حالة الطلب
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Secondary Links */}
        <div>
          <h4 className="font-cairo text-sm font-extrabold text-[#261A13] mb-3">
            خدمة العملاء والفرع
          </h4>
          <ul className="space-y-2 text-xs text-[#5E4D40] font-bold">
            {featureFlags.enableVipWallet && (
              <li>
                <Link href="/vip" className="hover:text-[#9A6836] transition">
                  محفظة ومكافآت VIP
                </Link>
              </li>
            )}
            <li>
              <Link href="/about" className="hover:text-[#9A6836] transition">
                عنوان الفرع ومواعيد العمل
              </Link>
            </li>
            <li>
              <Link
                href="/checkout"
                className="hover:text-[#9A6836] transition"
              >
                إتمام الطلب والشحن
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Payment Methods */}
        <div>
          <h4 className="font-cairo text-sm font-extrabold text-[#261A13] mb-3">
            وسائل الدفع المتاحة
          </h4>
          <div className="space-y-2 text-xs text-[#5E4D40] font-bold">
            <div className="bg-white px-3.5 py-2 rounded-xl border border-[#E8DFD3]">
              الدفع النقدي عند الاستلام
            </div>
            <div className="bg-white px-3.5 py-2 rounded-xl border border-[#E8DFD3]">
              فودافون كاش وإنستا باي
            </div>
            {featureFlags.enableVipWallet && (
              <div className="bg-white px-3.5 py-2 rounded-xl border border-[#E8DFD3]">
                استبدال نقاط محفظة VIP
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#E6DDD0] py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E5D4F]">
          <span>
            © {new Date().getFullYear()} {storeName} — {cityName}
          </span>
          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E8DFD3] bg-white hover:bg-[#261A13] text-[#261A13] hover:text-[#FAF7F2] font-cairo font-bold transition cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>العودة للأعلى</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
