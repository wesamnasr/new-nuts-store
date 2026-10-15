'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Truck,
  ShieldCheck,
  Sparkles,
  PackageSearch,
  Settings,
  Menu,
  X,
  PhoneCall,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent, STORE_THEMES } from '@/lib/defaults';

export default function Navbar() {
  const { storeData, cartCount, cartSubtotal, setIsCartOpen, themeConfig } = useStore();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const freeThreshold = settings?.freeShippingThreshold || 1000;
  const remainingForFree = Math.max(0, freeThreshold - cartSubtotal);

  const currentPreset = STORE_THEMES.find((t) => t.id === themeConfig.themeId) || STORE_THEMES[0];
  const isDarkTheme = Boolean(currentPreset.isDark);
  const navStyle = themeConfig.navbarStyle;
  const isDarkRoyal = navStyle === 'dark_royal' || isDarkTheme;
  const isFloating = navStyle === 'floating';

  return (
    <header
      className={`sticky top-0 z-40 transition-all ${
        isFloating ? 'pb-2 bg-transparent' : 'shadow-sm'
      }`}
    >
      {/* Top Promotional Announcement Bar */}
      {pageContent.showAnnouncementBar && (
        <div
          className={`text-[11px] sm:text-xs py-1.5 px-3 border-b ${
            isDarkTheme
              ? 'bg-brand-950 text-white border-gold-500/20'
              : 'bg-brand-200 text-brand-950 border-brand-300 font-bold'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-1.5 font-extrabold text-center">
            <Sparkles className="w-3.5 h-3.5 text-gold-500 shrink-0" />
            <span>
              {settings?.announcementText ||
                '🔥 شحن مجاني لجميع المحافظات للطلبات فوق 1000 ج.م | استخدم كود NUTS10 لخصم 10%'}
            </span>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div
        className={
          isFloating
            ? 'max-w-6xl mx-auto px-3 sm:px-5 pt-2'
            : isDarkRoyal
              ? 'bg-brand-950 text-white border-b border-gold-500/30 shadow-md'
              : 'bg-brand-50/95 backdrop-blur-md border-b border-brand-200'
        }
      >
        <div
          className={`max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 transition-all ${
            isFloating
              ? 'bg-white/95 backdrop-blur-md border border-brand-200 shadow-lg rounded-2xl'
              : ''
          }`}
        >
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group min-w-0">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm border shrink-0 group-hover:scale-105 transition ${
                isDarkRoyal
                  ? 'bg-gold-500 text-brand-950 border-gold-400'
                  : 'bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 border-gold-500/40'
              }`}
            >
              <span className="text-base sm:text-lg" role="img" aria-label="nuts">
                {pageContent.logoEmoji || '🌰'}
              </span>
            </div>
            <div className="min-w-0">
              <span
                className={`text-sm sm:text-base lg:text-lg font-extrabold tracking-tight block leading-tight truncate ${
                  isDarkRoyal ? 'text-white' : 'text-brand-950'
                }`}
              >
                {settings?.storeName || 'محمصة الواحة الذهبية'}
              </span>
              <span
                className={`text-[10px] font-medium hidden sm:block truncate ${
                  isDarkRoyal ? 'text-gold-400' : 'text-brand-700'
                }`}
              >
                {pageContent.headerSubtitle || 'مكسرات فاخرة • تحميص يومي طازج'}
              </span>
            </div>
          </Link>

          {/* Desktop Links (Streamlined to distinct destinations) */}
          <nav
            className={`hidden lg:flex items-center gap-5 text-xs font-bold ${
              isDarkRoyal ? 'text-brand-100' : 'text-brand-900'
            }`}
          >
            <Link
              href="/"
              className={`transition py-1 ${
                pathname === '/'
                  ? isDarkRoyal
                    ? 'text-gold-400 border-b-2 border-gold-400'
                    : 'text-brand-600 border-b-2 border-brand-600'
                  : isDarkRoyal
                    ? 'hover:text-gold-400'
                    : 'hover:text-brand-600'
              }`}
            >
              المتجر والأصناف
            </Link>
            <Link
              href="/custom-box"
              className={`transition py-1 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-black shadow-xs ${
                pathname === '/custom-box'
                  ? 'bg-gold-500 text-brand-950 border border-gold-400 ring-2 ring-gold-400/30'
                  : isDarkRoyal
                    ? 'bg-white/10 text-gold-400 hover:bg-white/20 border border-gold-400/40'
                    : 'bg-gold-500/15 text-brand-950 hover:bg-gold-500/25 border border-gold-400/40'
              }`}
            >
              <Sparkles className="w-3 h-3 text-gold-500" />
              <span>كوّن علبتك بنفسك</span>
            </Link>
            <Link
              href="/track-order"
              className={`transition py-1 flex items-center gap-1 ${
                pathname === '/track-order'
                  ? isDarkRoyal
                    ? 'text-gold-400 border-b-2 border-gold-400'
                    : 'text-brand-600 border-b-2 border-brand-600'
                  : isDarkRoyal
                    ? 'hover:text-gold-400'
                    : 'hover:text-brand-600'
              }`}
            >
              <PackageSearch className="w-3.5 h-3.5" />
              تتبع طلبك
            </Link>
          </nav>

          {/* Actions: Cart + Mobile Menu Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm hover:shadow transition active:scale-95 cursor-pointer ${
                isDarkRoyal
                  ? 'bg-gold-500 hover:bg-gold-400 text-brand-950'
                  : 'bg-brand-900 hover:bg-brand-950 text-white'
              }`}
              aria-label="سلة المشتريات"
            >
              <div className="relative">
                <ShoppingBag
                  className={`w-4 h-4 ${isDarkRoyal ? 'text-brand-950' : 'text-gold-400'}`}
                />
                {cartCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow ${
                      isDarkRoyal
                        ? 'bg-brand-950 text-gold-400'
                        : 'bg-gold-500 text-brand-950'
                    }`}
                  >
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="text-right hidden sm:block">
                <span
                  className={`text-[10px] block leading-none ${
                    isDarkRoyal ? 'text-brand-900 font-bold' : 'text-brand-200'
                  }`}
                >
                  السلة
                </span>
                <span
                  className={`text-xs font-extrabold ${
                    isDarkRoyal ? 'text-brand-950' : 'text-white'
                  }`}
                >
                  {cartSubtotal > 0 ? `${cartSubtotal} ج.م` : 'فارغة'}
                </span>
              </div>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden p-2 rounded-lg border cursor-pointer ${
                isDarkRoyal
                  ? 'border-white/20 text-white hover:bg-white/10'
                  : 'border-brand-200 text-brand-900 hover:bg-brand-100'
              }`}
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* One-Tap Mobile & Tablet Quick Navigation Strip */}
        <div
          className={`lg:hidden px-3 py-1.5 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar border-t ${
            isFloating
              ? 'mt-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-brand-200 shadow-xs'
              : isDarkRoyal
                ? 'border-white/10 bg-brand-900/60'
                : 'border-brand-200/70 bg-white/60'
          }`}
        >
          <Link
            href="/"
            className={`flex-1 text-center py-1 px-2 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition ${
              pathname === '/'
                ? isDarkRoyal
                  ? 'bg-gold-500 text-brand-950 shadow-2xs'
                  : 'bg-brand-900 text-white shadow-2xs'
                : isDarkRoyal
                  ? 'text-brand-100 hover:bg-white/10'
                  : 'text-brand-800 hover:bg-brand-100'
            }`}
          >
            🥜 المتجر
          </Link>
          <Link
            href="/custom-box"
            className={`flex-1 text-center py-1 px-2 rounded-lg text-[11px] font-extrabold whitespace-nowrap flex items-center justify-center gap-1 transition ${
              pathname === '/custom-box'
                ? 'bg-gold-500 text-brand-950 shadow-2xs'
                : isDarkRoyal
                  ? 'bg-white/10 text-gold-400 border border-gold-400/30'
                  : 'bg-amber-50 text-brand-950 border border-gold-400/40'
            }`}
          >
            <Sparkles className="w-3 h-3 text-gold-500 shrink-0" />
            <span>كوّن علبتك</span>
          </Link>
          <Link
            href="/track-order"
            className={`flex-1 text-center py-1 px-2 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition ${
              pathname === '/track-order'
                ? isDarkRoyal
                  ? 'bg-gold-500 text-brand-950 shadow-2xs'
                  : 'bg-brand-900 text-white shadow-2xs'
                : isDarkRoyal
                  ? 'text-brand-100 hover:bg-white/10'
                  : 'text-brand-800 hover:bg-brand-100'
            }`}
          >
            📦 تتبع طلبك
          </Link>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            className={`lg:hidden border-t px-3 pt-2 pb-4 space-y-1.5 text-xs ${
              isDarkRoyal
                ? 'bg-brand-950 border-white/15 text-white'
                : 'bg-brand-50 border-brand-200 text-brand-950'
            }`}
          >
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg font-bold ${
                isDarkRoyal ? 'hover:bg-white/10 text-white' : 'hover:bg-brand-100 text-brand-950'
              }`}
            >
              🥜 المتجر والأصناف
            </Link>
            <Link
              href="/custom-box"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-lg font-black text-xs flex items-center gap-1.5 border ${
                pathname === '/custom-box'
                  ? 'bg-brand-900 text-gold-400 border-brand-900'
                  : isDarkRoyal
                    ? 'bg-white/10 text-gold-400 border-gold-400/30'
                    : 'bg-gold-500/15 text-brand-950 border-gold-400/30 hover:bg-gold-500/25'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              <span>كوّن علبتك بنفسك</span>
            </Link>
            <Link
              href="/track-order"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg font-bold ${
                isDarkRoyal ? 'hover:bg-white/10 text-white' : 'hover:bg-brand-100 text-brand-950'
              }`}
            >
              📦 تتبع طلبك
            </Link>
            {settings?.supportPhone && (
              <a
                href={`tel:${settings.supportPhone}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold ${
                  isDarkRoyal ? 'text-gold-400' : 'text-brand-700'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                خدمة العملاء: {settings.supportPhone}
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
