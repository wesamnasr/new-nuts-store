'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Store, Gift, Crown, ShoppingBag } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

/**
 * Mobile-First Fixed 5-Icon Bottom Navigation Bar (UX Constitution Section 4.1)
 * Keeps the 5 core customer destinations inside the thumb zone on screens < lg.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount, setIsCartOpen } = useStore();

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

  const navLinks = [
    { href: '/', label: 'الرئيسية', icon: Home, match: pathname === '/' },
    { href: '/shop', label: 'المتجر', icon: Store, match: pathname?.startsWith('/shop') || pathname?.startsWith('/product') },
    { href: '/build-box', label: 'صمّم بوكسك', icon: Gift, match: pathname?.startsWith('/build-box') },
    { href: '/vip', label: 'محفظة VIP', icon: Crown, match: pathname?.startsWith('/vip') },
  ];

  return (
    <nav
      aria-label="التنقل السريع للهاتف"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E8DFD3] shadow-[0_-6px_20px_-8px_rgba(35,23,16,0.12)] print:hidden"
    >
      <div className="grid grid-cols-5 items-center max-w-lg mx-auto px-1 py-1">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition ${
                item.match
                  ? 'text-[#231710] font-extrabold bg-[#FAF6F0]'
                  : 'text-[#6E5D4F] hover:text-[#231710] font-medium'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${item.match ? 'text-[#9A6836]' : 'text-[#6E5D4F]'}`}
              />
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[#231710] hover:bg-[#FAF6F0] font-bold transition cursor-pointer relative"
          aria-label="فتح سلة المشتريات"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-[#231710]" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4AF37] text-[#231710] text-[10px] font-black flex items-center justify-center tabular-nums leading-none border border-white">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-none">السلة</span>
        </button>
      </div>
    </nav>
  );
}
