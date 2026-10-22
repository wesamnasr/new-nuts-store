'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  ArrowLeft,
  Truck,
  CheckCircle2,
  Home,
  Store,
  Gift,
  Crown,
} from 'lucide-react';
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
    pathname?.startsWith('/accountant')
  ) {
    return null;
  }

  const freeThreshold = storeData?.settings.freeShippingThreshold || 300;
  const remainingForFree = Math.max(0, freeThreshold - cartSubtotal);
  const netSubtotal = Math.max(0, cartSubtotal - discountAmount);

  return (
    <>
      {/* Compact Floating Cart Summary Pill on the Right Side when items are in cart */}
      {cartCount > 0 && !isCartOpen && !pathname?.startsWith('/checkout') && (
        <div className="fixed bottom-16 lg:bottom-3.5 right-3 sm:right-4 z-40 pointer-events-none">
          <div className="pointer-events-auto bg-[#231710]/95 backdrop-blur-md text-white border border-[#D4AF37]/50 rounded-2xl px-2.5 py-1.5 shadow-xl flex items-center gap-2 w-fit max-w-[calc(100vw-1.5rem)]">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 text-right min-w-0 cursor-pointer group"
            >
              <div className="relative w-7 h-7 rounded-xl bg-[#D4AF37] text-[#231710] flex items-center justify-center shrink-0 shadow group-hover:scale-105 transition">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="absolute -top-1 -right-1 bg-white text-[#231710] text-[8.5px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[#231710] shadow tabular-nums">
                  {cartCount}
                </span>
              </div>

              <div className="min-w-0 leading-tight">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-black text-[#D4AF37] tabular-nums whitespace-nowrap">
                    {netSubtotal} ج.م
                  </span>
                </div>
                <div className="text-[9px] text-[#F3ECE1]/90 truncate flex items-center gap-0.5">
                  {remainingForFree === 0 ? (
                    <>
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-bold">شحن مجاني 🎉</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-2.5 h-2.5 text-[#D4AF37] shrink-0" />
                      <span>باقي {remainingForFree} ج للشحن</span>
                    </>
                  )}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] text-[10px] font-black px-2.5 py-1 rounded-lg transition cursor-pointer shadow-sm whitespace-nowrap"
              >
                عرض السلة
              </button>
              <Link
                href="/checkout"
                className="bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-0.5 transition whitespace-nowrap"
              >
                <span>إتمام الطلب</span>
                <ArrowLeft className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Mobile Bottom App Bar (Section 4.11 & Acceptance Criterion #2) */}
      <nav
        aria-label="شريط التنقل السريع للموبايل"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#231710] text-[#FAF6F0] border-t border-[#D4AF37]/40 shadow-[0_-4px_20px_rgba(35,23,16,0.3)] h-14 px-2 flex items-center justify-around"
      >
        <Link
          href="/"
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-extrabold transition ${
            pathname === '/' ? 'text-[#D4AF37]' : 'text-[#FAF6F0]/80 hover:text-white'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>الرئيسية</span>
        </Link>

        <Link
          href="/shop"
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-extrabold transition ${
            pathname === '/shop' ? 'text-[#D4AF37]' : 'text-[#FAF6F0]/80 hover:text-white'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>المتجر</span>
        </Link>

        <Link
          href="/build-box"
          className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-black transition ${
            pathname === '/build-box' || pathname === '/custom-box'
              ? 'bg-[#D4AF37] text-[#231710] shadow-md'
              : 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>صمّم بوكسك</span>
        </Link>

        <Link
          href="/vip"
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-extrabold transition ${
            pathname === '/vip' ? 'text-[#D4AF37]' : 'text-[#FAF6F0]/80 hover:text-white'
          }`}
        >
          <Crown className="w-4 h-4 text-[#D4AF37]" />
          <span>محفظة VIP</span>
        </Link>

        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="relative flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl bg-[#C88A4B]/25 border border-[#D4AF37]/40 text-[#FAF6F0] text-[10px] font-black cursor-pointer"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#D4AF37] text-[#231710] text-[8.5px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            )}
          </div>
          <span className="tabular-nums text-[9.5px] text-[#D4AF37]">
            {cartSubtotal > 0 ? `${cartSubtotal} ج` : 'السلة'}
          </span>
        </button>
      </nav>
    </>
  );
}
