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
    <div className="fixed bottom-3 inset-x-3 z-30 max-w-2xl mx-auto pointer-events-none">
      <div className="pointer-events-auto bg-brand-950/95 backdrop-blur-md text-white border border-gold-500/40 rounded-2xl p-2.5 sm:px-4 sm:py-3 shadow-2xl flex items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex items-center gap-2.5 text-right min-w-0 cursor-pointer group"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gold-500 text-brand-950 flex items-center justify-center shrink-0 shadow group-hover:scale-105 transition">
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 bg-white text-brand-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-brand-950 shadow">
              {cartCount}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-black text-gold-400">
                {netSubtotal} ج.م
              </span>
              {discountAmount > 0 && (
                <span className="text-[10px] text-pistachio-400 font-bold">
                  (وفرت {discountAmount} ج.م)
                </span>
              )}
            </div>
            <div className="text-[10px] text-brand-200 truncate flex items-center gap-1">
              {remainingForFree === 0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-pistachio-400 shrink-0" />
                  <span className="text-pistachio-300 font-bold">شحن مجاني مفعّل 🎉</span>
                </>
              ) : (
                <>
                  <Truck className="w-3 h-3 text-gold-400 shrink-0" />
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
            className="bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold px-3 py-2 rounded-xl transition cursor-pointer"
          >
            السلة
          </button>
          <Link
            href="/checkout"
            className="bg-gradient-to-l from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-brand-950 text-[11px] sm:text-xs font-black px-3.5 py-2 rounded-xl shadow flex items-center gap-1 transition"
          >
            <span>إتمام الطلب</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
