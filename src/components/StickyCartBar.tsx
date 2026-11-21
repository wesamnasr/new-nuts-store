'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, ArrowLeft, Truck, Check } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getCurrencySymbol } from '@/lib/defaults';

export default function StickyCartBar() {
  const {
    cartCount,
    cartSubtotal,
    discountAmount,
    isCartOpen,
    setIsCartOpen,
    storeData,
  } = useStore();
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

  if (cartCount <= 0 || isCartOpen || pathname?.startsWith('/checkout')) {
    return null;
  }

  const currency = getCurrencySymbol(storeData?.settings);
  const freeThreshold = storeData?.settings.freeShippingThreshold || 300;
  const remainingForFree = Math.max(0, freeThreshold - cartSubtotal);
  const netSubtotal = Math.max(0, cartSubtotal - discountAmount);

  return (
    <div className="fixed bottom-[66px] lg:bottom-5 inset-x-3 sm:left-auto sm:right-6 z-40 pointer-events-none flex justify-end sm:justify-start print:hidden">
      <div className="pointer-events-auto bg-[#261A13]/95 backdrop-blur-md text-[#FAF7F2] border border-[#3D2B20] rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-[0_14px_34px_-10px_rgba(35,23,16,0.35)] flex items-center justify-between gap-2.5 sm:gap-4 w-full sm:w-auto sm:min-w-[350px] max-w-md transition-all duration-300">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex items-center gap-2.5 sm:gap-3 text-right min-w-0 flex-1 min-h-[42px] cursor-pointer"
        >
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/12 text-[#FAF7F2] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
            <span className="absolute -top-1.5 -right-1.5 bg-[#E5B869] text-[#231710] text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center tabular-nums leading-none">
              {cartCount}
            </span>
          </div>

          <div className="min-w-0 flex-1 leading-snug">
            <div className="text-xs sm:text-sm font-extrabold text-[#FAF7F2] tabular-nums whitespace-nowrap">
              {netSubtotal} {currency}
            </div>
            <div className="text-[11px] text-[#EDE3D5]/90 flex items-center gap-1 flex-wrap">
              {remainingForFree === 0 ? (
                <>
                  <Check className="w-3 h-3 text-emerald-300 shrink-0" />
                  <span className="text-emerald-200 font-bold">شحن مجاني مفعّل</span>
                </>
              ) : (
                <>
                  <Truck className="w-3 h-3 text-[#E5B869] shrink-0" />
                  <span>باقي {remainingForFree} {currency} للشحن المجاني</span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/checkout"
            className="bg-[#FAF7F2] hover:bg-[#E5B869] text-[#261A13] text-xs font-extrabold min-h-[40px] px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
          >
            <span>إتمام الطلب</span>
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
