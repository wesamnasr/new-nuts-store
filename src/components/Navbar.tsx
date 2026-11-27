'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Menu,
  X,
  Search,
  User,
  LayoutGrid,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { useAdLandingMode } from '@/lib/ad-mode';
import {
  getCurrencySymbol,
  getResolvedFeatureFlags,
  getResolvedPageContent,
  getSafeImageUrl,
  stripUiEmojis,
} from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';

export default function Navbar() {
  const {
    storeData,
    themeConfig,
    cartCount,
    cartSubtotal,
    setIsCartOpen,
    activeVipMember,
  } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const isAdMode = useAdLandingMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const topBarsRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isStaffRoute =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/pos') ||
    pathname?.startsWith('/cashier') ||
    pathname?.startsWith('/supplier') ||
    pathname?.startsWith('/accountant') ||
    pathname?.startsWith('/rider');

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const featureFlags = getResolvedFeatureFlags(settings);
  const currency = getCurrencySymbol(settings);
  const freeShippingThreshold = settings?.freeShippingThreshold || 300;
  const cleanAnnouncement = stripUiEmojis(
    settings?.announcementText ||
      'نقوم بالتوصيل السريع والشحن لجميع المحافظات بأعلى جودة تغليف'
  );
  const showAnnouncement = Boolean(
    pageContent.showAnnouncementBar &&
      cleanAnnouncement &&
      !announcementDismissed
  );

  useEffect(() => {
    if (isStaffRoute || !topBarsRef.current) return;
    const el = topBarsRef.current;
    const syncHeight = () => {
      document.documentElement.style.setProperty(
        '--navbar-height',
        `${el.offsetHeight}px`
      );
    };
    syncHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [isStaffRoute, showAnnouncement, cleanAnnouncement, searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
      return () => window.clearTimeout(timer);
    }
  }, [searchOpen]);

  if (isStaffRoute) {
    return null;
  }

  const storeName = stripUiEmojis(
    settings?.storeName || 'محمصة حفصة للبن والمكسرات'
  );

  // Distraction-Free Minimal Header for Paid Ad Traffic (?ad=1 / fbclid / ttclid / utm_source)
  if (isAdMode) {
    return (
      <header className="sticky top-0 z-40 print:hidden bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFD3] shadow-[0_4px_18px_-12px_rgba(35,23,16,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[56px] flex items-center justify-between gap-2">
          <Link href="/" className="inline-flex items-center gap-2 shrink-0">
            <span className="w-9 h-9 rounded-full ring-1 ring-[#D4AF37]/50 bg-[#FAF7F2] shadow-2xs overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={getSafeImageUrl('/images/brand/hafsa-sticker-gold.png')}
                alt={storeName}
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </span>
            <span className="font-cairo text-sm sm:text-base font-black text-[#261A13] whitespace-nowrap">
              {storeName}
            </span>
          </Link>

          <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-cairo font-extrabold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>شحن لكل مصر • دفع عند الاستلام</span>
          </span>
        </div>
      </header>
    );
  }

  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً ${storeName} (بني مزار)، أود الاستفسار عن الطلبات والمنتجات المتاحة.`
  )}`;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchInput.trim())}`);
    } else {
      router.push('/shop');
    }
    setSearchOpen(false);
    setMobileMenuOpen(false);
  };

  const isDarkNavbar = themeConfig?.navbarStyle === 'dark_royal';
  // Harmonized from legacy roast accent (#682e28) into calm warm espresso & ivory tokens
  const navLinks: Array<{
    href: string;
    label: string;
    badgeText?: string;
    badgeBg?: string;
    enabled: boolean;
  }> = [
    { href: '/', label: 'الرئيسية', enabled: true },
    {
      href: '/#special-offers',
      label: 'العروض',
      badgeText: 'خصومات',
      badgeBg: isDarkNavbar
        ? 'bg-[#E5B869] text-[#231710]'
        : 'bg-[#FBF3E4] text-[#9A6836] border border-[#EBD8B8]',
      enabled: true,
    },
    {
      href: '/shop?cat=cat-luxury-nuts',
      label: 'المكسرات',
      enabled: true,
    },
    {
      href: '/shop?cat=cat-coffee-bar',
      label: 'ركن القهوة والبار',
      badgeText: 'طازج',
      badgeBg: isDarkNavbar
        ? 'bg-[#3B6E4C] text-white'
        : 'bg-[#EEF5F0] text-[#3B6E4C] border border-[#D4E8DA]',
      enabled: true,
    },
    {
      href: '/shop?cat=cat-coffee-espresso',
      label: 'البن والمحمصة',
      enabled: true,
    },
    {
      href: '/build-box',
      label: featureFlags.boxesModuleLabel || 'صمّم بوكسك',
      enabled: featureFlags.enableCustomBoxes,
    },
    {
      href: '/shop?cat=cat-quick-cups',
      label: 'كوبايات التسلية',
      enabled: true,
    },
    {
      href: '/shop?cat=cat-honey-spices',
      label: 'التمور والعسل',
      enabled: true,
    },
    {
      href: '/track',
      label: 'تتبع الطلب',
      enabled: true,
    },
  ].filter((item) => item.enabled);

  const marqueeItems = [
    cleanAnnouncement,
    `توصيل فوري 30 دقيقة داخل بندر بني مزار • شحن مجاني فوق ${freeShippingThreshold} ${currency}`,
    'دورية حفصة اليومية لقرى بني مزار (القيس، صندفا، بني علي، شلقام، أبشاق — 2 ظهراً و8 مساءً)',
    '5% كاش باك تلقائي في محفظة حفصة VIP للفواتير فوق 150 ج.م',
  ];

  return (
    <>
      <header className="sticky top-0 z-40 print:hidden">
        <div ref={topBarsRef}>
          {/* 1. Calm Warm Espresso Announcement Strip */}
          {showAnnouncement && (
            <div className="bg-[#261A13] text-[#F5EFE6] border-b border-white/10 text-xs h-9 px-3 flex items-center justify-between gap-2 overflow-hidden">
              <div className="flex-1 overflow-hidden relative">
                <div className="zain-marquee-track flex items-center gap-8 whitespace-nowrap font-cairo font-medium text-[11px] sm:text-xs text-[#F5EFE6]/95">
                  {[...marqueeItems, ...marqueeItems].map((msg, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 shrink-0"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5B869]" />
                      <span>{msg}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnnouncementDismissed(true)}
                className="text-[#F5EFE6]/70 hover:text-white p-1 rounded-lg transition shrink-0 cursor-pointer"
                aria-label="إغلاق شريط الإعلان"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 2. Harmonious Translucent Ivory / Roasted Espresso Header */}
          <div
            className={`transition-colors duration-300 backdrop-blur-md ${
              isDarkNavbar
                ? 'bg-[#231710]/95 text-[#FAF7F2] border-b border-white/10 shadow-sm'
                : 'bg-[#FAF7F2]/95 text-[#261A13] border-b border-[#E8DFD3] shadow-[0_4px_20px_-12px_rgba(35,23,16,0.08)]'
            }`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[66px] lg:min-h-[74px] py-2 flex items-center justify-between gap-3">
              {/* Mobile Menu Trigger (Mobile/Tablet Only) */}
              <div className="flex lg:hidden items-center justify-start min-w-[84px]">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  className={`min-h-[42px] min-w-[42px] flex items-center justify-center p-2 rounded-xl transition cursor-pointer ${
                    isDarkNavbar
                      ? 'text-[#FAF7F2] hover:bg-white/10'
                      : 'text-[#261A13] hover:bg-[#EFE8DD]'
                  }`}
                  aria-label="القائمة"
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Brand Emblem & Full Store Name (Centered on Mobile, Right-Anchored on Desktop) */}
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 group py-0.5 shrink-0"
              >
                <span
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shrink-0 overflow-hidden ${
                    isDarkNavbar
                      ? 'ring-2 ring-[#E5B869]/55 bg-[#231710]'
                      : 'ring-1 ring-[#D4AF37]/50 bg-[#FAF7F2] shadow-2xs'
                  }`}
                >
                  <img
                    src={getSafeImageUrl('/images/brand/hafsa-sticker-gold.png')}
                    alt={storeName}
                    width={44}
                    height={44}
                    className="w-full h-full object-contain"
                  />
                </span>
                <div className="flex flex-col text-right">
                  <span
                    className={`font-cairo text-sm sm:text-base lg:text-[18px] font-black tracking-tight whitespace-nowrap ${
                      isDarkNavbar ? 'text-[#FAF7F2]' : 'text-[#261A13]'
                    }`}
                  >
                    {storeName}
                  </span>
                  <span
                    className={`text-[10px] xl:text-[11px] font-medium hidden sm:block whitespace-nowrap ${
                      isDarkNavbar ? 'text-[#FAF7F2]/70' : 'text-[#78685A]'
                    }`}
                  >
                    {stripUiEmojis(
                      pageContent.headerSubtitle ||
                        'بني مزار — أمام مسجد الزراعيين • تحميص يومي طازج'
                    )}
                  </span>
                </div>
              </Link>

              {/* Single-Line Desktop Navigation Links */}
              <nav
                aria-label="التنقل الرئيسي"
                className="hidden lg:flex items-center justify-center gap-1 xl:gap-1.5 flex-1 min-w-0"
              >
                {navLinks.slice(0, 6).map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname?.startsWith(item.href.split('?')[0]);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative px-2.5 xl:px-3 py-1.5 rounded-xl text-xs xl:text-[13px] font-cairo whitespace-nowrap transition-all duration-200 ${
                        isDarkNavbar
                          ? isActive
                            ? 'bg-white/12 text-[#E5B869] font-extrabold'
                            : 'text-[#FAF7F2]/90 hover:text-[#E5B869] hover:bg-white/5 font-bold'
                          : isActive
                            ? 'bg-[#EFE8DD] text-[#261A13] font-extrabold'
                            : 'text-[#5E4D40] hover:text-[#261A13] hover:bg-[#F3ECE1]/80 font-bold'
                      }`}
                    >
                      {item.badgeText && (
                        <span
                          className={`absolute -top-2 left-1.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full leading-tight ${item.badgeBg}`}
                        >
                          {item.badgeText}
                        </span>
                      )}
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Left Zone: Search + Account/VIP + Cart */}
              <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 min-w-[84px] lg:min-w-0">
                <button
                  type="button"
                  onClick={() => setSearchOpen((v) => !v)}
                  className={`min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-xl transition cursor-pointer ${
                    isDarkNavbar
                      ? 'text-[#FAF7F2] hover:bg-white/10'
                      : searchOpen
                        ? 'bg-[#EFE8DD] text-[#261A13]'
                        : 'text-[#5E4D40] hover:text-[#261A13] hover:bg-[#EFE8DD]/70'
                  }`}
                  aria-label="البحث في المتجر"
                  title="البحث في المتجر"
                >
                  <Search className="w-5 h-5" />
                </button>

                {featureFlags.enableVipWallet ? (
                  <Link
                    href="/vip"
                    className={`hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition tabular-nums ${
                      isDarkNavbar
                        ? 'bg-white/10 hover:bg-white/20 text-[#FAF7F2]'
                        : 'bg-white hover:bg-[#F3ECE1] text-[#261A13] border border-[#E8DFD3]'
                    }`}
                    title="حساب ومكافآت VIP"
                  >
                    <Wallet className="w-4 h-4 text-[#9A6836]" />
                    {activeVipMember ? (
                      <span>
                        {activeVipMember.pointsBalance} {currency}
                      </span>
                    ) : (
                      <span className="hidden xl:inline">حسابي</span>
                    )}
                  </Link>
                ) : (
                  <Link
                    href="/track"
                    className={`hidden sm:inline-flex items-center justify-center min-h-[40px] min-w-[40px] p-2 rounded-xl transition ${
                      isDarkNavbar
                        ? 'text-[#FAF7F2] hover:bg-white/10'
                        : 'text-[#5E4D40] hover:text-[#261A13] hover:bg-[#EFE8DD]/70'
                    }`}
                    title="تتبع الطلب"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className={`relative inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-2xs ${
                    isDarkNavbar
                      ? 'bg-[#E5B869] hover:bg-[#DBA954] text-[#231710]'
                      : 'bg-[#261A13] hover:bg-[#3A281E] text-[#FAF7F2]'
                  }`}
                  aria-label="سلة المشتريات"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span
                    className={`text-[11px] font-black min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center leading-none tabular-nums ${
                      isDarkNavbar
                        ? 'bg-[#231710] text-[#FAF7F2]'
                        : 'bg-[#E5B869] text-[#231710]'
                    }`}
                  >
                    {cartCount}
                  </span>
                  <span className="hidden md:inline tabular-nums">
                    {cartSubtotal > 0 ? `${cartSubtotal} ${currency}` : 'العربة'}
                  </span>
                </button>
              </div>
            </div>

            {/* Expandable Instant Search Bar */}
            {searchOpen && (
              <div
                className={`storefront-dropdown-enter border-t px-4 py-3 ${
                  isDarkNavbar
                    ? 'border-white/10 bg-[#1B120C]'
                    : 'border-[#E8DFD3] bg-white/95'
                }`}
              >
                <form
                  onSubmit={handleSearchSubmit}
                  className="max-w-2xl mx-auto flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="ابحث عن فستق، كاجو، لوز، تمور، قهوة، بوكسات..."
                      aria-label="ابحث عن منتج"
                      className="w-full min-h-[42px] bg-[#FAF7F2] text-[#261A13] placeholder-[#8A7968] border border-[#E8DFD3] focus:border-[#9A6836] focus:bg-white rounded-xl py-2 pr-10 pl-3 text-xs sm:text-sm font-medium focus:outline-none transition"
                    />
                    <Search className="w-4 h-4 text-[#9A6836] absolute right-3 top-3 pointer-events-none" />
                  </div>
                  <button
                    type="submit"
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#261A13] hover:bg-[#3A281E] text-[#FAF7F2] font-cairo font-extrabold text-xs transition cursor-pointer shrink-0"
                  >
                    بحث
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Slide-Down Drawer Menu */}
        {mobileMenuOpen && (
          <div className="storefront-dropdown-enter lg:hidden border-b border-[#E8DFD3] bg-[#FAF7F2] px-4 pt-3 pb-5 space-y-3 shadow-lg">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ابحث عن منتج أو قسم..."
                aria-label="ابحث عن منتج أو قسم"
                className="w-full min-h-[42px] bg-white border border-[#E8DFD3] rounded-xl py-2 pr-9 pl-3 text-xs text-[#261A13] focus:outline-none focus:border-[#9A6836] transition"
              />
              <Search className="w-4 h-4 text-[#9A6836] absolute right-3 top-3" />
            </form>

            <div className="divide-y divide-[#EAE0D3] bg-white rounded-2xl border border-[#E8DFD3] px-3.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between min-h-[44px] py-2 text-sm font-cairo font-bold text-[#261A13] hover:text-[#9A6836] transition"
                >
                  <span>{link.label}</span>
                  {link.badgeText && (
                    <span
                      className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${link.badgeBg}`}
                    >
                      {link.badgeText}
                    </span>
                  )}
                </Link>
              ))}
              {featureFlags.enableCoffeeBlender && (
                <Link
                  href="/coffee-blender"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center min-h-[44px] py-2 text-sm font-cairo font-bold text-[#261A13] hover:text-[#9A6836] transition"
                >
                  {featureFlags.blenderModuleLabel || 'معمل التوليفات'}
                </Link>
              )}
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center min-h-[44px] py-2 text-sm font-medium text-[#5E4D40] hover:text-[#9A6836] transition"
              >
                عنوان الفرع والتواصل
              </Link>
            </div>

            <div className="pt-1">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full min-h-[42px] py-2.5 px-3 rounded-xl bg-[#3B6E4C] hover:bg-[#2F5A3D] text-white text-xs font-cairo font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <span>تواصل مباشر عبر واتساب</span>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* 3. Mobile Sticky Bottom 4-Tab Bar (المنتجات | العربة | حسابي | البحث) */}
      <nav
        aria-label="شريط التنقل السفلي للموبايل"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E8DFD3] h-[58px] grid grid-cols-4 px-1.5 shadow-[0_-4px_18px_rgba(35,23,16,0.06)] print:hidden"
      >
        <Link
          href="/shop"
          className={`flex flex-col items-center justify-center gap-0.5 my-1 rounded-xl text-[11px] font-cairo font-bold transition ${
            pathname?.startsWith('/shop')
              ? 'bg-[#EFE8DD] text-[#261A13]'
              : 'text-[#5E4D40] hover:text-[#261A13]'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>المنتجات</span>
        </Link>

        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="relative flex flex-col items-center justify-center gap-0.5 my-1 rounded-xl text-[11px] font-cairo font-bold text-[#5E4D40] hover:text-[#261A13] transition cursor-pointer"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#261A13] text-[#FAF7F2] text-[11px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center tabular-nums leading-none">
                {cartCount}
              </span>
            )}
          </div>
          <span>العربة</span>
        </button>

        <Link
          href={featureFlags.enableVipWallet ? '/vip' : '/track'}
          className={`flex flex-col items-center justify-center gap-0.5 my-1 rounded-xl text-[11px] font-cairo font-bold transition ${
            pathname?.startsWith('/vip') || pathname?.startsWith('/track')
              ? 'bg-[#EFE8DD] text-[#261A13]'
              : 'text-[#5E4D40] hover:text-[#261A13]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>حسابي</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            setSearchOpen((prev) => !prev);
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className={`flex flex-col items-center justify-center gap-0.5 my-1 rounded-xl text-[11px] font-cairo font-bold transition cursor-pointer ${
            searchOpen
              ? 'bg-[#EFE8DD] text-[#261A13]'
              : 'text-[#5E4D40] hover:text-[#261A13]'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>البحث</span>
        </button>
      </nav>
    </>
  );
}
