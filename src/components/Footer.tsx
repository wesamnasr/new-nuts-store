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
  Sparkles,
  Crown,
  Coffee,
  Gift,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent } from '@/lib/defaults';

export default function Footer() {
  const { storeData, cartCount } = useStore();
  const pathname = usePathname();

  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/pos') ||
    pathname?.startsWith('/cashier') ||
    pathname?.startsWith('/supplier') ||
    pathname?.startsWith('/accountant')
  ) {
    return null;
  }

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);

  return (
    <footer
      className={`bg-[#231710] text-[#FAF6F0] border-t-2 border-[#D4AF37]/40 mt-10 ${
        cartCount > 0 ? 'pb-24 lg:pb-14' : 'pb-16 lg:pb-6'
      }`}
    >
      {/* Compact Trust Highlights Banner */}
      <div className="border-b border-[#D4AF37]/20 bg-[#1B110B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="font-cairo font-extrabold text-white text-xs">
              {pageContent.footerFeatures[0]?.title || 'تحميص وطحن يومي طازج'}
            </h4>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3B6E4C]/25 border border-[#3B6E4C]/50 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-cairo font-extrabold text-white text-xs">
              {pageContent.footerFeatures[1]?.title || 'كاش باك 5% محفظة VIP'}
            </h4>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <h4 className="font-cairo font-extrabold text-white text-xs">
              {pageContent.footerFeatures[2]?.title || 'توصيل سريع لبندر وقرى بني مزار'}
            </h4>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="sm:col-span-2 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#231710] flex items-center justify-center font-black">
              ☕
            </div>
            <h3 className="font-cairo text-base font-black text-white">
              {settings?.storeName || 'محمصة حفصة للبن والمكسرات'}
            </h3>
          </div>
          <div className="pt-1 space-y-1.5 text-xs text-[#E6DFD3]">
            <p className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>
                {settings?.address || 'بني مزار — أمام مسجد الزراعيين'}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span className="tabular-nums">
                {settings?.supportPhone || '01000000000'}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>يومياً 9 ص – 1 ص</span>
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-cairo text-xs font-black text-[#D4AF37] mb-2.5">
            روابط سريعة
          </h4>
          <ul className="space-y-1.5 text-xs text-[#E6DFD3]/90 font-medium">
            <li>
              <Link href="/shop" className="hover:text-[#D4AF37] transition flex items-center gap-1.5">
                <span>🥜</span>
                <span>المتجر</span>
              </Link>
            </li>
            <li>
              <Link href="/build-box" className="hover:text-[#D4AF37] transition flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>بوكس السهرة</span>
              </Link>
            </li>
            <li>
              <Link href="/coffee-blender" className="hover:text-[#D4AF37] transition flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>توليفة البن</span>
              </Link>
            </li>
            <li>
              <Link href="/vip" className="hover:text-[#D4AF37] transition flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>محفظة VIP</span>
              </Link>
            </li>
            <li>
              <Link href="/track" className="hover:text-[#D4AF37] transition flex items-center gap-1.5">
                <span>📦</span>
                <span>تتبع الطلب</span>
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-cairo text-xs font-black text-[#D4AF37] mb-2.5">
            وسائل الدفع
          </h4>
          <div className="space-y-1.5 text-[11px] text-[#E6DFD3]">
            <div className="bg-white/5 p-2 rounded-xl border border-[#D4AF37]/25">
              💵 الدفع عند الاستلام
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-[#D4AF37]/25">
              📱 فودافون كاش وإنستا باي
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-[#D4AF37]/25">
              👑 نقاط محفظة VIP
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-3 px-4 text-center text-[11px] text-[#E6DFD3]/70">
        © {new Date().getFullYear()} محمصة حفصة للبن والمكسرات — بني مزار
      </div>
    </footer>
  );
}
