'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Menu,
  X,
  Search,
  Coffee,
  MessageCircle,
  Wallet,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent, stripUiEmojis } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';

export default function Navbar() {
  const {
    storeData,
    cartCount,
    cartSubtotal,
    setIsCartOpen,
    activeVipMember,
  } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const topBarsRef = useRef<HTMLDivElement | null>(null);

  const isStaffRoute =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/pos') ||
    pathname?.startsWith('/cashier') ||
    pathname?.startsWith('/supplier') ||
    pathname?.startsWith('/accountant') ||
    pathname?.startsWith('/rider');

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const cleanAnnouncement = stripUiEmojis(
    settings?.announcementText ||
      'تحميص طازج يومياً في فرع بني مزار — توصيل سريع لبندر وقرى المركز'
  );
  const showAnnouncement = Boolean(pageContent.showAnnouncementBar && cleanAnnouncement);

  useEffect(() => {
    if (isStaffRoute || !topBarsRef.current) return;
    const el = topBarsRef.current;
    const syncHeight = () => {
      document.documentElement.style.setProperty('--navbar-height', `${el.offsetHeight}px`);
    };
    syncHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [isStaffRoute, showAnnouncement, cleanAnnouncement]);

  if (isStaffRoute) {
    return null;
  }

  const whatsappNumber = formatWhatsAppPhone(settings?.whatsappNumber);
  const storeName = stripUiEmojis(settings?.storeName || 'محمصة حفصة للبن والمكسرات');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً ${storeName}، أود الاستفسار عن الطلبات والمنتجات المتاحة.`
  )}`;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchInput.trim())}`);
      setMobileMenuOpen(false);
    } else {
      router.push('/shop');
    }
  };

  // Strictly 4 primary navigation links in the main header per approved design
  const primaryLinks = [
    { href: '/shop', label: 'المتجر' },
    { href: '/build-box', label: 'بوكس السهرة' },
    { href: '/coffee-blender', label: 'توليفة البن' },
    { href: '/track', label: 'تتبع الطلب' },
  ];

  return (
    <header className="sticky top-0 z-40">
      <div ref={topBarsRef}>
        {/* Subtle Calm Top Strip */}
        {showAnnouncement && (
          <div className="bg-[#F4EFE6] text-[#5C4A3D] border-b border-[#E8E0D5] text-xs h-8 px-4 flex items-center">
            <div className="max-w-7xl mx-auto w-full text-center font-medium truncate">
              {cleanAnnouncement}
            </div>
          </div>
        )}

        {/* Main Minimal Artisanal Header */}
        <div className="bg-white/95 backdrop-blur-md border-b border-[#E8E0D5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Clean Typographic Brand Mark */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center text-[#231710] group-hover:border-[#231710]/30 transition shrink-0">
              <Coffee className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <span className="font-cairo text-sm sm:text-base font-bold text-[#231710] tracking-tight block truncate">
                {storeName}
              </span>
              <span className="text-[11px] text-[#78685A] hidden sm:block truncate">
                بني مزار — أمام مسجد الزراعيين
              </span>
            </div>
          </Link>

          {/* Calm Search Input (Desktop) */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex items-center flex-1 max-w-xs relative"
          >
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث عن بن، مكسرات، عسل..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl py-2 pr-9 pl-3 text-xs text-[#231710] placeholder-[#8A7968] focus:outline-none transition"
            />
            <Search className="w-4 h-4 text-[#8A7968] absolute right-3 pointer-events-none" />
          </form>

          {/* 4 Primary Text Links Only */}
          <nav className="hidden lg:flex items-center gap-6">
            {primaryLinks.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`py-1 text-sm transition border-b-2 ${
                    isActive
                      ? 'text-[#231710] font-bold border-[#231710]'
                      : 'text-[#5C4A3D] hover:text-[#231710] font-medium border-transparent'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Calm Actions: WhatsApp + Active VIP Balance (if logged in) + Cart + Mobile Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8E0D5] bg-white hover:bg-[#FAF6F0] text-[#231710] text-xs font-medium transition"
              title="تواصل عبر واتساب"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#3B6E4C]" />
              <span className="hidden xl:inline">واتساب</span>
            </a>

            {activeVipMember && (
              <Link
                href="/vip"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#F4EFE6] border border-[#E8E0D5] text-[#231710] text-xs font-bold transition tabular-nums"
                title="رصيد محفظة VIP"
              >
                <Wallet className="w-3.5 h-3.5 text-[#9A6836]" />
                <span>{activeVipMember.pointsBalance} ج.م</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] text-xs font-bold transition cursor-pointer"
              aria-label="سلة المشتريات"
            >
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="bg-[#FAF6F0] text-[#231710] text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums">
                  {cartCount}
                </span>
              )}
              <span className="hidden sm:inline tabular-nums">
                {cartSubtotal > 0 ? `${cartSubtotal} ج.م` : 'السلة'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border border-[#E8E0D5] bg-white text-[#231710] hover:bg-[#FAF6F0] cursor-pointer"
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Clean Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#E8E0D5] bg-white px-4 pt-3 pb-5 space-y-3 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث عن بن، مكسرات، عسل..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl py-2.5 pr-9 pl-3 text-xs text-[#231710] focus:outline-none focus:border-[#231710]"
            />
            <Search className="w-4 h-4 text-[#8A7968] absolute right-3 top-3" />
          </form>

          <div className="divide-y divide-[#F0EAE0]">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 text-sm font-bold text-[#231710] hover:text-[#9A6836] transition"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/vip"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#5C4A3D] hover:text-[#231710] transition"
            >
              محفظة ومكافآت VIP
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#5C4A3D] hover:text-[#231710] transition"
            >
              عنوان الفرع والتواصل
            </Link>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 px-3 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] text-[#231710] text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4 text-[#3B6E4C]" />
              <span>تواصل عبر واتساب</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
