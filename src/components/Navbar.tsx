'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Sparkles,
  PackageSearch,
  Menu,
  X,
  PhoneCall,
  Search,
  Crown,
  Coffee,
  Gift,
  MapPin,
  Download,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent } from '@/lib/defaults';

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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/pos') ||
    pathname?.startsWith('/cashier')
  ) {
    return null;
  }

  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchInput.trim())}`);
      setMobileMenuOpen(false);
    } else {
      router.push('/shop');
    }
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const navLinks = [
    { href: '/', label: 'الرئيسية', icon: null },
    { href: '/shop', label: 'المتجر والأقسام', icon: null },
    { href: '/build-box', label: 'صمّم بوكسك', icon: Gift, highlight: 'gold' },
    { href: '/coffee-blender', label: 'توليفة البن', icon: Coffee, highlight: 'espresso' },
    { href: '/vip', label: 'محفظة VIP', icon: Crown, highlight: 'vip' },
    { href: '/track', label: 'تتبع طلبك', icon: PackageSearch },
    { href: '/about', label: 'فرع بني مزار', icon: MapPin },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 shadow-md">
        {/* Section 1A: Top Promotional Announcement Bar */}
        {pageContent.showAnnouncementBar && (
          <div className="bg-[#231710] text-[#FAF6F0] border-b border-[#D4AF37]/30 text-[10.5px] sm:text-xs py-1.5 px-3 overflow-hidden">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold truncate mx-auto">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 animate-pulse" />
                <span className="truncate">
                  {settings?.announcementText ||
                    '🔥 تحميص طازج يومياً | توصيل سريع لبندر بني مزار في 30 دقيقة | استلم نقاط كاش باك 5% في محفظة حفصة VIP مع كل طلب!'}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 shrink-0">
                <Link
                  href="/pos"
                  className="inline-flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-extrabold transition"
                >
                  <span>⚖️ كاشير المحل POS</span>
                </Link>
                <button
                  type="button"
                  onClick={handleInstallPwa}
                  className="inline-flex items-center gap-1 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 rounded-full text-[10px] font-extrabold transition cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>ثبّت تطبيق حفصة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 1B: Smart Glass Header */}
        <div className="bg-[#FAF6F0]/95 backdrop-blur-md border-b border-[#E6DFD3]">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Brand Logo: محمصة حفصة للبن والمكسرات */}
            <Link href="/" className="flex items-center gap-2.5 group min-w-0 shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#231710] via-[#3A2519] to-[#231710] border-2 border-[#D4AF37] flex items-center justify-center shadow-sm group-hover:scale-105 transition shrink-0">
                <span className="text-base sm:text-lg" role="img" aria-label="Hafsa Roastery">
                  ☕
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-cairo text-xs sm:text-sm lg:text-base font-black text-[#231710] tracking-tight truncate">
                    {settings?.storeName || 'محمصة حفصة للبن والمكسرات'}
                  </span>
                  <span className="hidden xl:inline-block text-[9px] font-black tracking-widest bg-[#231710] text-[#D4AF37] px-1.5 py-0.5 rounded border border-[#D4AF37]/40">
                    HAFSA ROASTERY
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#6E5D4F] hidden sm:flex items-center gap-1 truncate">
                  <MapPin className="w-2.5 h-2.5 text-[#C88A4B] shrink-0" />
                  <span>بني مزار — أمام مسجد الزراعيين • تحميص يومي طازج</span>
                </span>
              </div>
            </Link>

            {/* Quick Search Input (Desktop) */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex items-center flex-1 max-w-xs relative"
            >
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ابحث عن بن عميد، فستق، بوكس 125ج، عسل..."
                className="w-full bg-[#F3ECE1] border border-[#E6DFD3] focus:border-[#C88A4B] focus:bg-white rounded-xl py-1.5 pr-8 pl-3 text-xs text-[#231710] placeholder-[#6E5D4F] focus:outline-none transition"
              />
              <Search className="w-3.5 h-3.5 text-[#6E5D4F] absolute right-2.5 pointer-events-none" />
            </form>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2 text-xs font-extrabold">
              {navLinks.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname?.startsWith(item.href);
                const Icon = item.icon;

                if (item.highlight === 'gold') {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-[11px] font-black transition shadow-2xs ${
                        isActive
                          ? 'bg-[#D4AF37] text-[#231710] border border-[#231710]/20'
                          : 'bg-[#D4AF37]/20 hover:bg-[#D4AF37]/35 text-[#231710] border border-[#D4AF37]'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5 text-[#231710]" />}
                      <span>{item.label}</span>
                    </Link>
                  );
                }

                if (item.highlight === 'espresso') {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-[11px] font-black transition shadow-2xs ${
                        isActive
                          ? 'bg-[#231710] text-[#D4AF37] border border-[#D4AF37]'
                          : 'bg-[#231710]/90 hover:bg-[#231710] text-[#FAF6F0] border border-[#C88A4B]/50'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5 text-[#D4AF37]" />}
                      <span>{item.label}</span>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-2 py-1.5 rounded-lg flex items-center gap-1 text-[11.5px] transition ${
                      isActive
                        ? 'text-[#231710] bg-[#F3ECE1] font-black border-b-2 border-[#C88A4B]'
                        : 'text-[#6E5D4F] hover:text-[#231710] hover:bg-[#F3ECE1]/60'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 text-[#C88A4B]" />}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions: VIP Balance Pill (Mobile/Active) + Cart Button + Mobile Menu */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {activeVipMember && (
                <Link
                  href="/vip"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F3ECE1] hover:bg-[#D4AF37]/25 border border-[#D4AF37]/60 text-[#231710] text-[10.5px] font-black transition"
                  title="رصيد محفظة حفصة VIP"
                >
                  <Crown className="w-3.5 h-3.5 text-[#D4AF37] fill-[#D4AF37]" />
                  <span className="bg-[#3B6E4C] text-white px-1.5 py-0.2 rounded-full text-[9.5px] tabular-nums">
                    {activeVipMember.pointsBalance} ج
                  </span>
                </Link>
              )}

              <button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#231710] hover:bg-[#3A2519] text-[#FAF6F0] border border-[#D4AF37]/50 shadow-sm transition active:scale-95 cursor-pointer"
                aria-label="سلة المشتريات"
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#D4AF37] text-[#231710] text-[9.5px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow tabular-nums">
                      {cartCount}
                    </span>
                  )}
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-[9px] text-[#D4AF37] block leading-none font-bold">
                    سلة السهرة
                  </span>
                  <span className="text-xs font-black text-white tabular-nums">
                    {cartSubtotal > 0 ? `${cartSubtotal} ج.م` : '0 ج.م'}
                  </span>
                </div>
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl border border-[#E6DFD3] bg-[#F3ECE1] text-[#231710] hover:bg-[#E6DFD3] cursor-pointer"
                aria-label="القائمة"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Drawer Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-[#E6DFD3] bg-[#FAF6F0] px-4 pt-3 pb-5 space-y-2.5 shadow-xl">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="ابحث عن بن، مكسرات، بوكس 125ج، عسل..."
                  className="w-full bg-white border border-[#E6DFD3] rounded-xl py-2 pr-9 pl-3 text-xs text-[#231710]"
                />
                <Search className="w-4 h-4 text-[#6E5D4F] absolute right-3 top-2.5" />
              </form>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 rounded-xl bg-white border border-[#E6DFD3] text-xs font-extrabold text-[#231710] hover:border-[#C88A4B] flex items-center gap-1.5"
                  >
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E6DFD3]">
                {settings?.supportPhone && (
                  <a
                    href={`tel:${settings.supportPhone}`}
                    className="flex items-center gap-1.5 text-xs font-extrabold text-[#231710]"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-[#C88A4B]" />
                    <span>فرع بني مزار: {settings.supportPhone}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleInstallPwa}
                  className="bg-[#231710] text-[#D4AF37] px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تثبيت التطبيق</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* PWA Install Instructions Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF6F0] border-2 border-[#D4AF37] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-right">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📲</span>
                <h3 className="font-cairo text-base font-black text-[#231710]">
                  ثبّت تطبيق «محمصة حفصة» على موبايلك
                </h3>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-1 rounded-lg hover:bg-[#F3ECE1]"
              >
                <X className="w-4 h-4 text-[#231710]" />
              </button>
            </div>
            <p className="text-xs text-[#6E5D4F] leading-relaxed">
              استمتع بطلب أسرع في ثوانٍ لبندر وقرى بني مزار والوصول الفوري لبطاقة الكاش باك الذهبية (حفصة VIP) من شاشة موبايلك الرئيسية:
            </p>
            <div className="bg-[#F3ECE1] p-3 rounded-xl space-y-2 text-xs text-[#231710] border border-[#E6DFD3]">
              <p className="font-bold">
                • لمستخدمي أندرويد (Chrome): اضغط على قائمة المتصفح (⋮) بالأعلى ثم اختر{' '}
                <strong className="text-[#3B6E4C]">«تثبيت التطبيق / الإضافة إلى الشاشة الرئيسية»</strong>.
              </p>
              <p className="font-bold">
                • لمستخدمي آيفون (Safari): اضغط على زر المشاركة (Share) بالأسفل ثم اختر{' '}
                <strong className="text-[#3B6E4C]">«إضافة إلى الشاشة الرئيسية (Add to Home Screen)»</strong>.
              </p>
            </div>
            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#231710] text-[#D4AF37] font-extrabold text-xs cursor-pointer"
            >
              فهمت، شكراً لك
            </button>
          </div>
        </div>
      )}
    </>
  );
}
