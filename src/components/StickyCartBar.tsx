'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, ArrowLeft, Truck, CheckCircle2 } from 'lucide-react';
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
    cartCount === 0 ||
    isCartOpen ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/checkout')
  ) {
    return null;
  }

  const freeThreshold = storeData?.settings.freeShippingThreshold || 1000;
  const remainingForFree = Math.max(0, freeThreshold - cartSubtotal);
  const netSubtotal = Math.max(0, cartSubtotal - discountAmount);

  return (
    <div className="fixed bottom-2.5 inset-x-3 z-30 max-w-xl mx-auto pointer-events-none">
      <div className="pointer-events-auto bg-brand-950/95 backdrop-blur-md text-white border border-gold-500/40 rounded-xl p-2 sm:px-3.5 sm:py-2.5 shadow-xl flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex items-center gap-2 text-right min-w-0 cursor-pointer group"
        >
          <div className="relative w-8 h-8 rounded-lg bg-gold-500 text-brand-950 flex items-center justify-center shrink-0 shadow group-hover:scale-105 transition">
            <ShoppingBag className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 bg-white text-brand-950 text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-brand-950 shadow">
              {cartCount}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-xs sm:text-sm font-extrabold text-gold-400">
                {netSubtotal} ج.م
              </span>
              {discountAmount > 0 && (
                <span className="text-[9.5px] text-pistachio-400 font-bold">
                  (وفرت {discountAmount} ج.م)
                </span>
              )}
            </div>
            <div className="text-[9.5px] text-brand-200 truncate flex items-center gap-1">
              {remainingForFree === 0 ? (
                <>
                  <CheckCircle2 className="w-2.5 h-2.5 text-pistachio-400 shrink-0" />
                  <span className="text-pistachio-300 font-bold">شحن مجاني مفعّل 🎉</span>
                </>
              ) : (
                <>
                  <Truck className="w-2.5 h-2.5 text-gold-400 shrink-0" />
                  <span>باقي {remainingForFree} ج.م للشحن المجاني</span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
          >
            السلة
          </button>
          <Link
            href="/checkout"
            className="bg-gradient-to-l from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-brand-950 text-[10px] sm:text-[11px] font-extrabold px-3 py-1.5 rounded-lg shadow flex items-center gap-1 transition"
          >
            <span>إتمام الطلب</span>
            <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
