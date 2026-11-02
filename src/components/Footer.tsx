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
  Coffee,
  MessageCircle,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';

export default function Footer() {
  const { storeData, cartCount } = useStore();
  const pathname = usePathname();

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
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً ${storeName}، أود الاستفسار عن الطلبات والمنتجات.`
  )}`;

  return (
    <footer
      className={`bg-[#F4EFE6] text-[#231710] border-t border-[#E8E0D5] mt-16 ${
        cartCount > 0 ? 'pb-24 sm:pb-16' : 'pb-8'
      }`}
    >
      {/* Calm Service Pillars */}
      <div className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E8E0D5] flex items-center justify-center text-[#231710] shrink-0">
              <Coffee className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h4 className="font-cairo font-bold text-[#231710] text-sm">
                {pageContent.footerFeatures[0]?.title || 'تحميص وطحن يومي طازج'}
              </h4>
              <p className="text-xs text-[#6E5D4F]">تعبئة محكمة تحفظ النكهة والقرمشة</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E8E0D5] flex items-center justify-center text-[#231710] shrink-0">
              <Truck className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h4 className="font-cairo font-bold text-[#231710] text-sm">
                {pageContent.footerFeatures[2]?.title || 'توصيل سريع لبندر وقرى بني مزار'}
              </h4>
              <p className="text-xs text-[#6E5D4F]">مندوب خاص للطلبات المحلية وشحن للمحافظات</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E8E0D5] flex items-center justify-center text-[#231710] shrink-0">
              <ShieldCheck className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h4 className="font-cairo font-bold text-[#231710] text-sm">
                {pageContent.footerFeatures[1]?.title || 'مكافآت كاش باك 5% لأعضاء VIP'}
              </h4>
              <p className="text-xs text-[#6E5D4F]">رصيد تلقائي برقم الهاتف مع كل طلب</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Column 1: Brand & Branch Contact */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-[#E8E0D5] text-[#231710] flex items-center justify-center">
              <Coffee className="w-4 h-4 stroke-[1.75]" />
            </div>
            <h3 className="font-cairo text-base font-bold text-[#231710]">
              {storeName}
            </h3>
          </div>
          <div className="space-y-2 text-xs text-[#5C4A3D]">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#9A6836] shrink-0 mt-0.5" />
              <span>{settings?.address || 'بني مزار — أمام مسجد الزراعيين'}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#9A6836] shrink-0" />
              <a href={`tel:${settings?.supportPhone || '01100699524'}`} className="tabular-nums hover:text-[#231710] transition">
                {settings?.supportPhone || '01100699524'}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#9A6836] shrink-0" />
              <span>{settings?.workingHours || 'يومياً من 9 صباحاً حتى 1 بعد منتصف الليل'}</span>
            </p>
          </div>
          <div className="pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition"
            >
              <MessageCircle className="w-4 h-4 text-[#3B6E4C]" />
              <span>تواصل معنا عبر واتساب</span>
            </a>
          </div>
        </div>

        {/* Column 2: Primary Storefront Links */}
        <div>
          <h4 className="font-cairo text-sm font-bold text-[#231710] mb-3">
            التسوق والأقسام
          </h4>
          <ul className="space-y-2 text-xs text-[#5C4A3D] font-medium">
            <li>
              <Link href="/shop" className="hover:text-[#231710] transition">
                المتجر وجميع الأصناف
              </Link>
            </li>
            <li>
              <Link href="/build-box" className="hover:text-[#231710] transition">
                صمّم بوكس السهرة
              </Link>
            </li>
            <li>
              <Link href="/coffee-blender" className="hover:text-[#231710] transition">
                معمل توليفة البن
              </Link>
            </li>
            <li>
              <Link href="/track" className="hover:text-[#231710] transition">
                تتبع حالة الطلب
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Secondary Links (Moved cleanly out of header) */}
        <div>
          <h4 className="font-cairo text-sm font-bold text-[#231710] mb-3">
            خدمة العملاء والفرع
          </h4>
          <ul className="space-y-2 text-xs text-[#5C4A3D] font-medium">
            <li>
              <Link href="/vip" className="hover:text-[#231710] transition">
                محفظة ومكافآت حفصة VIP
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[#231710] transition">
                عنوان الفرع ومواعيد العمل
              </Link>
            </li>
            <li>
              <Link href="/checkout" className="hover:text-[#231710] transition">
                إتمام الطلب والشحن
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Payment Methods */}
        <div>
          <h4 className="font-cairo text-sm font-bold text-[#231710] mb-3">
            وسائل الدفع المتاحة
          </h4>
          <div className="space-y-2 text-xs text-[#5C4A3D]">
            <div className="bg-white px-3 py-2 rounded-xl border border-[#E8E0D5]">
              الدفع النقدي عند الاستلام
            </div>
            <div className="bg-white px-3 py-2 rounded-xl border border-[#E8E0D5]">
              فودافون كاش وإنستا باي
            </div>
            <div className="bg-white px-3 py-2 rounded-xl border border-[#E8E0D5]">
              استبدال نقاط محفظة VIP
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#E8E0D5] py-4 px-4 text-center text-xs text-[#6E5D4F]">
        © {new Date().getFullYear()} {storeName} — بني مزار، المنيا
      </div>
    </footer>
  );
}
