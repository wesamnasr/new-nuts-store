'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';

export default function FloatingWhatsApp() {
  const { storeData } = useStore();
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

  const pageContent = getResolvedPageContent(storeData?.settings);
  if (!pageContent.showFloatingWhatsapp) {
    return null;
  }

  const whatsappNumber = formatWhatsAppPhone(storeData?.settings.whatsappNumber);
  const storeName = storeData?.settings.storeName || 'محمصة حفصة للبن والمكسرات';

  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً ${storeName}، ${pageContent.floatingWhatsappMessage}`
  )}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="fixed left-3 sm:left-3.5 bottom-16 lg:bottom-3.5 z-30 flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white px-2.5 py-2 sm:py-1.5 rounded-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
      aria-label="تواصل معنا عبر واتساب"
    >
      <MessageCircle className="w-3.5 h-3.5 fill-white" />
      <span className="text-[10px] font-bold hidden sm:inline">
        {pageContent.floatingWhatsappText}
      </span>
    </a>
  );
}
