'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Phone, Clock, ShieldCheck, Truck, Sparkles } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent } from '@/lib/defaults';

export default function Footer() {
  const { storeData, cartCount } = useStore();
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);

  return (
    <footer
      className={`bg-brand-950 text-brand-100 border-t border-gold-500/20 mt-10 sm:mt-12 ${
        cartCount > 0 ? 'pb-20 sm:pb-16' : ''
      }`}
    >
      {/* Trust Highlights Banner */}
      <div className="border-b border-brand-800/80 bg-brand-900/50">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-400/30 flex items-center justify-center text-gold-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">
                {pageContent.footerFeatures[0]?.title || 'تحميص يومي طازج 100%'}
              </h4>
              <p className="text-[11px] text-brand-200 mt-0.5 leading-relaxed">
                {pageContent.footerFeatures[0]?.description ||
                  'نحمص المكسرات يومياً بالهواء الساخن بدون أي زيوت مهدرجة للحفاظ على الطعم والقرمشة.'}
              </p>
            </div>
          </div>

          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pistachio-500/20 border border-pistachio-500/30 flex items-center justify-center text-pistachio-500 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">
                {pageContent.footerFeatures[1]?.title || 'تغليف حراري محكم الغلق'}
              </h4>
              <p className="text-[11px] text-brand-200 mt-0.5 leading-relaxed">
                {pageContent.footerFeatures[1]?.description ||
                  'عبوات صحية بسحاب (Zip-lock) تحفظ المكسرات طازجة ومقرمشة لأطول فترة ممكنة.'}
              </p>
            </div>
          </div>

          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-400/30 flex items-center justify-center text-gold-400 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">
                {pageContent.footerFeatures[2]?.title || 'شحن سريع لجميع المحافظات'}
              </h4>
              <p className="text-[11px] text-brand-200 mt-0.5 leading-relaxed">
                {pageContent.footerFeatures[2]?.description ||
                  'توصيل لحد باب البيت مع الدفع عند الاستلام أو عبر إنستا باي وفودافون كاش.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 py-7 sm:py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="sm:col-span-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{pageContent.logoEmoji || '🌰'}</span>
            <h3 className="text-base font-extrabold text-white">
              {settings?.storeName || 'محمصة الواحة الذهبية'}
            </h3>
          </div>
          <p className="text-[11px] text-brand-200 max-w-md leading-relaxed">
            {pageContent.footerDescription}
          </p>
          <div className="pt-1.5 space-y-1 text-[11px] text-brand-200">
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
              <span>{settings?.address || 'القاهرة - مدينة نصر - شارع عباس العقاد'}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gold-400 shrink-0" />
              <span>هاتف وواتساب: {settings?.supportPhone || '01000000000'}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gold-400 shrink-0" />
              <span>{settings?.workingHours || 'يومياً من 10 صباحاً حتى 12 منتصف الليل'}</span>
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-extrabold text-gold-400 mb-2">روابط سريعة</h4>
          <ul className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 text-[11px]">
            <li>
              <Link href="/" className="hover:text-white transition">
                المتجر والأصناف
              </Link>
            </li>
            <li>
              <Link href="/custom-box" className="hover:text-white transition">
                كوّن علبتك بنفسك
              </Link>
            </li>
            <li>
              <Link href="/track-order" className="hover:text-white transition">
                تتبع حالة طلبك
              </Link>
            </li>
            <li>
              <Link href="/checkout" className="hover:text-white transition">
                إتمام الشراء
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-extrabold text-gold-400 mb-2">وسائل الدفع المتاحة</h4>
          <div className="space-y-1.5 text-[11px] text-brand-200">
            {pageContent.enableCod && (
              <div className="bg-brand-900/90 p-2 rounded-lg border border-brand-800">
                💵 الدفع نقداً عند الاستلام (COD)
              </div>
            )}
            {pageContent.enableInstapay && (
              <div className="bg-brand-900/90 p-2 rounded-lg border border-brand-800">
                ⚡ تحويل لحظي عبر تطبيق InstaPay
              </div>
            )}
            {pageContent.enableVodafoneCash && (
              <div className="bg-brand-900/90 p-2 rounded-lg border border-brand-800">
                📱 محافظ إلكترونية (فودافون كاش)
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-brand-900 py-3 px-3 text-center text-[11px] text-brand-300">
        جميع الحقوق محفوظة © {new Date().getFullYear()} {settings?.storeName || 'محمصة الواحة الذهبية'}
      </div>
    </footer>
  );
}
