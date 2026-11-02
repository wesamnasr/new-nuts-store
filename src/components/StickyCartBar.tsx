'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, ArrowLeft, Truck, Check } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

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

  const freeThreshold = storeData?.settings.freeShippingThreshold || 300;
  const remainingForFree = Math.max(0, freeThreshold - cartSubtotal);
  const netSubtotal = Math.max(0, cartSubtotal - discountAmount);

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 z-40 pointer-events-none flex justify-center sm:justify-start">
      <div className="pointer-events-auto bg-[#231710] text-[#FAF6F0] border border-[#3A281D] rounded-2xl px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-4 w-full sm:w-auto sm:min-w-[340px] max-w-md">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex items-center gap-3 text-right min-w-0 cursor-pointer"
        >
          <div className="relative w-9 h-9 rounded-xl bg-white/10 text-[#FAF6F0] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
            <span className="absolute -top-1.5 -right-1.5 bg-[#FAF6F0] text-[#231710] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center tabular-nums">
              {cartCount}
            </span>
          </div>

          <div className="min-w-0 leading-snug">
            <div className="text-sm font-bold text-white tabular-nums whitespace-nowrap">
              {netSubtotal} ج.م
            </div>
            <div className="text-[11px] text-[#E8E0D5]/80 truncate flex items-center gap-1">
              {remainingForFree === 0 ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-medium">مؤهل للشحن المجاني</span>
                </>
              ) : (
                <>
                  <Truck className="w-3 h-3 text-[#C88A4B] shrink-0" />
                  <span>باقي {remainingForFree} ج.م للشحن المجاني</span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="bg-white/10 hover:bg-white/15 text-[#FAF6F0] text-xs font-medium px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap"
          >
            السلة
          </button>
          <Link
            href="/checkout"
            className="bg-[#FAF6F0] hover:bg-white text-[#231710] text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1 transition whitespace-nowrap"
          >
            <span>إتمام الطلب</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
