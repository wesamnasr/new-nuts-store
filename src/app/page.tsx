'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  Flame,
  ShieldCheck,
  Truck,
  Gift,
  SlidersHorizontal,
  Star,
  CheckCircle2,
  ArrowLeft,
  PackagePlus,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import ProductCard from '@/components/ProductCard';
import { RoastOption } from '@/types/store';
import { getResolvedPageContent, getSafeImageUrl, STORE_THEMES } from '@/lib/defaults';

export default function HomePage() {
  const { storeData, loading, setSelectedProductModal, showToast, themeConfig } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOccasion, setSelectedOccasion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoastFilter, setSelectedRoastFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');

  const OCCASION_PRESETS = [
    {
      id: 'all',
      label: '🌟 كل المناسبات',
      desc: 'استعرض التشكيلة الكاملة',
      tip: '',
    },
    {
      id: 'royal_hospitality',
      label: '👑 ضيافة ملكية وهدايا',
      desc: 'أفخر الأصناف الجامبو وبوكسات VIP',
      tip: '💡 ترشيح المحمصة للضيافة: الفستق الجامبو والكاجو الملكي وبوكس المشكل الملكي VIP هي الأكثر تشريفاً أمام ضيوفك.',
    },
    {
      id: 'keto_diet',
      label: '🥗 كيتو ودايت صحي',
      desc: 'نيء طبيعي وبدون ملح غني بالأوميجا 3',
      tip: '💡 ترشيح الكيتو والدايت: عين الجمل واللوز والبندق النيء طبيعياً بدون أي أملاح أو زيوت مضافة.',
    },
    {
      id: 'energy_focus',
      label: '⚡ طاقة وجيم ومذاكرة',
      desc: 'بروتين عالي وتركيز ذهني',
      tip: '💡 ترشيح الطاقة والتركيز: مزيج عين الجمل واللوز والتمر المحشو باللوز يمنحك بروتيناً وطاقة ذهنية فورية.',
    },
    {
      id: 'family_night',
      label: '🍿 سهرة العائلة والتسالي',
      desc: 'مقرمشات ومكسرات محمصة للسهرة',
      tip: '💡 ترشيح السهرة العائلية: اختار الأوزان العائلية (500 جم أو 1 كجم) لتحصل على أفضل سعر وتكفي الجميع.',
    },
    {
      id: 'ramadan_fruits',
      label: '🍑 فواكه مجففة وتمور',
      desc: 'تين ومشمشية وقراصيا وتمور فاخرة',
      tip: '💡 ترشيح التحلية الطبيعية: فواكه مجففة طرية وتمور ملكية غنية بالألياف والفيتامينات.',
    },
  ];

  const handleSelectOccasion = (occId: string) => {
    setSelectedOccasion(occId);
    setSelectedCategory('all');
    if (occId === 'keto_diet') {
      setSelectedRoastFilter('نيء طبيعي');
    } else {
      setSelectedRoastFilter('all');
    }
  };

  const categories = storeData?.categories || [];
  const products = storeData?.products || [];
  const settings = storeData?.settings;
  const pageContent = getResolvedPageContent(settings);
  const heroLayout = themeConfig.heroLayout || 'split';
  const currentPreset = STORE_THEMES.find((t) => t.id === themeConfig.themeId) || STORE_THEMES[0];
  const isDarkTheme = Boolean(currentPreset.isDark);

  const openFeaturedHeroProduct = () => {
    const vip =
      products.find((p) => p.id === pageContent.heroFeaturedProductId) ||
      products.find((p) => p.id === 'prod-royal-mix-1') ||
      products[0];
    if (vip) setSelectedProductModal(vip);
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
        if (selectedRoastFilter !== 'all' && !p.roastOptions.includes(selectedRoastFilter as RoastOption)) {
          return false;
        }
        if (selectedOccasion !== 'all') {
          const text = `${p.name} ${p.subtitle} ${p.description} ${p.slug}`.toLowerCase();
          if (selectedOccasion === 'royal_hospitality') {
            const match =
              p.categoryId === 'cat-mixed-boxes' ||
              p.featured ||
              text.includes('فستق') ||
              text.includes('كاجو') ||
              text.includes('بندق') ||
              text.includes('ملكي');
            if (!match) return false;
          } else if (selectedOccasion === 'keto_diet') {
            const match =
              p.categoryId === 'cat-raw-nuts' ||
              p.roastOptions.includes('نيء طبيعي') ||
              p.roastOptions.includes('محمص بدون ملح');
            if (!match || p.categoryId === 'cat-dried-fruits') return false;
          } else if (selectedOccasion === 'energy_focus') {
            const match =
              p.caloriesPer100g >= 550 ||
              text.includes('عين جمل') ||
              text.includes('لوز') ||
              text.includes('كاجو') ||
              text.includes('تمر');
            if (!match) return false;
          } else if (selectedOccasion === 'family_night') {
            const match =
              p.categoryId === 'cat-crackers' ||
              p.categoryId === 'cat-mixed-boxes' ||
              p.roastOptions.includes('محمص مملح');
            if (!match) return false;
          } else if (selectedOccasion === 'ramadan_fruits') {
            if (p.categoryId !== 'cat-dried-fruits') return false;
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.subtitle.toLowerCase().includes(q) ||
            p.origin.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') {
          return (a.weights[0]?.price || 0) - (b.weights[0]?.price || 0);
        }
        if (sortBy === 'price-desc') {
          return (b.weights[0]?.price || 0) - (a.weights[0]?.price || 0);
        }
        if (sortBy === 'rating') {
          return b.rating - a.rating;
        }
        return Number(b.featured) - Number(a.featured);
      });
  }, [products, selectedCategory, selectedOccasion, selectedRoastFilter, searchQuery, sortBy]);

  const mixedBoxProducts = useMemo(
    () => products.filter((p) => p.categoryId === 'cat-mixed-boxes'),
    [products]
  );

  const copyCoupon = (code: string) => {
    navigator.clipboard?.writeText(code);
    showToast(`تم نسخ كود الخصم ${code}`, 'يمكنك لصقه في السلة أو صفحة إتمام الطلب');
  };

  if (loading && !storeData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center space-y-2.5">
        <div className="w-10 h-10 rounded-xl bg-brand-900 text-gold-400 flex items-center justify-center mx-auto animate-spin text-lg">
          {pageContent.logoEmoji || '🌰'}
        </div>
        <p className="text-xs font-extrabold text-brand-900">
          جاري تحضير المكسرات الطازجة...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Hero Banner Section (3 Structural Layout Variations + Light/Dark Mode Adaptation) */}
      {heroLayout === 'centered' ? (
        /* Layout 2: Centered Royal Panoramic Banner */
        <section
          className={`relative overflow-hidden border-b ${
            isDarkTheme
              ? 'bg-brand-950 text-white border-gold-500/30'
              : 'bg-gradient-to-b from-brand-200 via-brand-100 to-brand-50 text-brand-950 border-brand-300'
          }`}
        >
          <div className="absolute inset-0">
            <img
              src={getSafeImageUrl(pageContent.heroImage)}
              alt="تشكيلة مكسرات فاخرة"
              className={`w-full h-full object-cover scale-105 ${
                isDarkTheme ? 'opacity-25' : 'opacity-15'
              }`}
            />
            <div
              className={`absolute inset-0 ${
                isDarkTheme
                  ? 'bg-gradient-to-b from-brand-950/90 via-brand-950/80 to-brand-950'
                  : 'bg-gradient-to-b from-brand-100/85 via-brand-50/90 to-brand-100/95'
              }`}
            />
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-9 text-center space-y-3.5">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10.5px] font-bold mx-auto shadow-2xs border ${
                isDarkTheme
                  ? 'bg-gold-500/20 border-gold-400/50 text-gold-400'
                  : 'bg-white/90 border-brand-300 text-brand-900'
              }`}
            >
              <Flame className="w-3 h-3 text-gold-500" />
              <span>{pageContent.heroBadge}</span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold leading-snug max-w-2xl mx-auto">
              {pageContent.heroTitlePrefix}{' '}
              <span
                className={
                  isDarkTheme
                    ? 'text-transparent bg-clip-text bg-gradient-to-l from-gold-400 to-amber-200'
                    : 'text-brand-700 underline decoration-gold-500/60 decoration-2 underline-offset-4'
                }
              >
                {pageContent.heroTitleHighlight}
              </span>{' '}
              {pageContent.heroTitleSuffix}
            </h1>

            <p
              className={`text-[11px] sm:text-xs leading-relaxed max-w-xl mx-auto font-medium ${
                isDarkTheme ? 'text-brand-100' : 'text-brand-800'
              }`}
            >
              {pageContent.heroDescription || settings?.tagline}
            </p>

            {/* Centered CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-0.5">
              <Link
                href="/custom-box"
                className={`font-extrabold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5 text-[11px] sm:text-xs ${
                  isDarkTheme
                    ? 'bg-gradient-to-l from-gold-400 to-gold-500 text-brand-950 ring-1 ring-gold-400/30'
                    : 'bg-brand-900 hover:bg-brand-950 text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                <span>{pageContent.heroPrimaryCtaText}</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
              <a
                href="#catalog"
                className={`font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 text-[11px] sm:text-xs border ${
                  isDarkTheme
                    ? 'bg-white/15 hover:bg-white/25 border-white/30 text-white'
                    : 'bg-white hover:bg-brand-100 border-brand-300 text-brand-950 shadow-2xs'
                }`}
              >
                <span>{pageContent.heroSecondaryCtaText}</span>
              </a>
            </div>

            {/* Bottom Panoramic Bar: Stats + VIP Offer Card */}
            <div
              className={`pt-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center text-right backdrop-blur-md border rounded-xl p-3 mt-3 ${
                isDarkTheme
                  ? 'bg-white/10 border-gold-500/30'
                  : 'bg-white/95 border-brand-300 shadow-sm'
              }`}
            >
              <div
                className={`lg:col-span-6 grid grid-cols-3 gap-2 text-center border-b lg:border-b-0 lg:border-l pb-2.5 lg:pb-0 lg:pl-3 ${
                  isDarkTheme ? 'border-white/15' : 'border-brand-200'
                }`}
              >
                {pageContent.heroStats.map((st, idx) => (
                  <div key={idx}>
                    <div
                      className={`text-sm sm:text-base font-extrabold ${
                        isDarkTheme ? 'text-gold-400' : 'text-brand-900'
                      }`}
                    >
                      {st.value}
                    </div>
                    <div
                      className={`text-[9.5px] sm:text-[10px] font-semibold ${
                        isDarkTheme ? 'text-brand-100' : 'text-brand-700'
                      }`}
                    >
                      {st.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="lg:col-span-6 flex items-center justify-between gap-2.5">
                <div>
                  <span className="text-[9.5px] font-bold bg-gold-500 text-white px-2 py-0.5 rounded-full">
                    {pageContent.heroFeaturedBadge}
                  </span>
                  <h3
                    className={`font-extrabold text-xs mt-0.5 ${
                      isDarkTheme ? 'text-white' : 'text-brand-950'
                    }`}
                  >
                    {pageContent.heroFeaturedTitle}
                  </h3>
                  <p
                    className={`text-[10px] ${
                      isDarkTheme ? 'text-brand-200' : 'text-brand-700'
                    }`}
                  >
                    {pageContent.heroFeaturedSubtitle}
                  </p>
                </div>
                <button
                  onClick={openFeaturedHeroProduct}
                  className={`font-extrabold text-[11px] px-3 py-1.5 rounded-lg shrink-0 shadow-2xs transition ${
                    isDarkTheme
                      ? 'bg-gold-500 hover:bg-gold-400 text-brand-950'
                      : 'bg-brand-900 hover:bg-brand-950 text-white'
                  }`}
                >
                  اطلبه الآن
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : heroLayout === 'showcase' ? (
        /* Layout 3: Bento Grid Cinematic Showcase */
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            {/* Main Right Bento Card */}
            <div
              className={`lg:col-span-7 rounded-2xl p-4 sm:p-5 border shadow-md flex flex-col justify-between space-y-4 ${
                isDarkTheme
                  ? 'bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white border-gold-500/30'
                  : 'bg-gradient-to-br from-brand-200 via-brand-100 to-white text-brand-950 border-brand-300'
              }`}
            >
              <div className="space-y-2.5">
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    isDarkTheme
                      ? 'bg-gold-500/20 border-gold-400/40 text-gold-400'
                      : 'bg-white border-brand-300 text-brand-900 shadow-2xs'
                  }`}
                >
                  <Flame className="w-3 h-3 text-gold-500" />
                  <span>{pageContent.heroBadge}</span>
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold leading-snug">
                  {pageContent.heroTitlePrefix}{' '}
                  <span
                    className={
                      isDarkTheme
                        ? 'text-transparent bg-clip-text bg-gradient-to-l from-gold-400 to-amber-200'
                        : 'text-brand-600 underline decoration-gold-500/60 decoration-2 underline-offset-4'
                    }
                  >
                    {pageContent.heroTitleHighlight}
                  </span>{' '}
                  {pageContent.heroTitleSuffix}
                </h1>

                <p
                  className={`text-[11px] sm:text-xs leading-relaxed font-medium ${
                    isDarkTheme ? 'text-brand-100' : 'text-brand-800'
                  }`}
                >
                  {pageContent.heroDescription || settings?.tagline}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Link
                    href="/custom-box"
                    className={`font-extrabold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 text-[11px] sm:text-xs ${
                      isDarkTheme
                        ? 'bg-gradient-to-l from-gold-400 to-gold-500 text-brand-950'
                        : 'bg-brand-900 hover:bg-brand-950 text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                    <span>{pageContent.heroPrimaryCtaText}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                  <a
                    href="#catalog"
                    className={`font-bold px-3.5 py-2 rounded-xl transition text-[11px] sm:text-xs border ${
                      isDarkTheme
                        ? 'bg-white/15 hover:bg-white/25 border-white/30 text-white'
                        : 'bg-white hover:bg-brand-100 border-brand-300 text-brand-950'
                    }`}
                  >
                    {pageContent.heroSecondaryCtaText}
                  </a>
                </div>
              </div>

              <div
                className={`grid grid-cols-3 gap-2 pt-3 border-t ${
                  isDarkTheme ? 'border-white/15' : 'border-brand-300'
                }`}
              >
                {pageContent.heroStats.map((st, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-2 border ${
                      isDarkTheme
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/85 border-brand-200'
                    }`}
                  >
                    <div
                      className={`text-xs sm:text-sm font-extrabold ${
                        isDarkTheme ? 'text-gold-400' : 'text-brand-900'
                      }`}
                    >
                      {st.value}
                    </div>
                    <div
                      className={`text-[9.5px] font-semibold ${
                        isDarkTheme ? 'text-brand-200' : 'text-brand-700'
                      }`}
                    >
                      {st.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Left Showcase Image Card */}
            <div className="lg:col-span-5">
              <div className="relative h-full min-h-[200px] rounded-2xl overflow-hidden shadow-md border border-brand-200 bg-brand-950">
                <img
                  src={getSafeImageUrl(pageContent.heroImage)}
                  alt="تشكيلة مكسرات فاخرة"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-2.5 inset-x-2.5 flex items-end justify-between gap-2 text-white">
                  <div>
                    <span className="text-[9.5px] font-bold bg-gold-500 text-white px-2 py-0.5 rounded-full">
                      {pageContent.heroFeaturedBadge}
                    </span>
                    <h3 className="font-extrabold text-xs mt-0.5 text-white">{pageContent.heroFeaturedTitle}</h3>
                    <p className="text-[9.5px] text-gray-200">{pageContent.heroFeaturedSubtitle}</p>
                  </div>
                  <button
                    onClick={openFeaturedHeroProduct}
                    className="bg-gold-500 hover:bg-gold-400 text-white font-extrabold text-[10.5px] px-3 py-1.5 rounded-lg shrink-0 shadow transition"
                  >
                    اطلبه الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Layout 1: Default Classic Split Hero */
        <section
          className={`relative overflow-hidden border-b ${
            isDarkTheme
              ? 'bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white border-gold-500/25'
              : 'bg-gradient-to-br from-brand-200 via-brand-100 to-brand-50 text-brand-950 border-brand-300'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-7 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Text Column */}
            <div className="lg:col-span-7 space-y-3">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isDarkTheme
                    ? 'bg-gold-500/20 border-gold-400/40 text-gold-400'
                    : 'bg-white/90 border-brand-300 text-brand-900 shadow-2xs'
                }`}
              >
                <Flame className="w-3 h-3 text-gold-500" />
                <span>{pageContent.heroBadge}</span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold leading-snug">
                {pageContent.heroTitlePrefix}{' '}
                <span
                  className={
                    isDarkTheme
                      ? 'text-transparent bg-clip-text bg-gradient-to-l from-gold-400 to-amber-200'
                      : 'text-brand-700 underline decoration-gold-500/60 decoration-2 underline-offset-4'
                  }
                >
                  {pageContent.heroTitleHighlight}
                </span>{' '}
                {pageContent.heroTitleSuffix}
              </h1>

              <p
                className={`text-[11px] sm:text-xs leading-relaxed max-w-xl font-medium ${
                  isDarkTheme ? 'text-brand-100' : 'text-brand-800'
                }`}
              >
                {pageContent.heroDescription || settings?.tagline}
              </p>

              {/* Quick CTA Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Link
                  href="/custom-box"
                  className={`font-extrabold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5 text-[11px] sm:text-xs ${
                    isDarkTheme
                      ? 'bg-gradient-to-l from-gold-400 to-gold-500 text-brand-950 ring-1 ring-gold-400/30'
                      : 'bg-brand-900 hover:bg-brand-950 text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                  <span>{pageContent.heroPrimaryCtaText}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Link>

                <a
                  href="#catalog"
                  className={`font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 text-[11px] sm:text-xs border ${
                    isDarkTheme
                      ? 'bg-white/15 hover:bg-white/25 border-white/30 text-white'
                      : 'bg-white hover:bg-brand-100 border-brand-300 text-brand-950 shadow-2xs'
                  }`}
                >
                  <span>{pageContent.heroSecondaryCtaText}</span>
                </a>
              </div>

              {/* Trust Stats */}
              <div
                className={`pt-2.5 grid grid-cols-3 gap-2.5 border-t max-w-sm ${
                  isDarkTheme ? 'border-white/15' : 'border-brand-300'
                }`}
              >
                {pageContent.heroStats.map((st, idx) => (
                  <div key={idx}>
                    <div
                      className={`text-sm sm:text-base font-extrabold ${
                        isDarkTheme ? 'text-gold-400' : 'text-brand-900'
                      }`}
                    >
                      {st.value}
                    </div>
                    <div
                      className={`text-[10px] font-semibold ${
                        isDarkTheme ? 'text-brand-200' : 'text-brand-700'
                      }`}
                    >
                      {st.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Visual Showcase */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-xl overflow-hidden shadow-lg border border-brand-300 bg-brand-900">
                <img
                  src={getSafeImageUrl(pageContent.heroImage)}
                  alt="تشكيلة مكسرات فاخرة"
                  className="w-full h-[190px] sm:h-[225px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Floating Featured Offer inside Hero Image */}
                <div className="absolute bottom-2.5 inset-x-2.5 bg-white/95 backdrop-blur-md text-brand-950 p-2.5 rounded-xl shadow-md flex items-center justify-between gap-2.5">
                  <div>
                    <span className="text-[9.5px] font-bold bg-pistachio-100 text-pistachio-700 px-1.5 py-0.5 rounded-full">
                      {pageContent.heroFeaturedBadge}
                    </span>
                    <h3 className="font-extrabold text-xs mt-0.5">
                      {pageContent.heroFeaturedTitle}
                    </h3>
                    <p className="text-[9.5px] text-brand-700">{pageContent.heroFeaturedSubtitle}</p>
                  </div>
                  <button
                    onClick={openFeaturedHeroProduct}
                    className="bg-brand-900 hover:bg-brand-950 text-white font-bold text-[10.5px] px-2.5 py-1.5 rounded-lg shrink-0 shadow-2xs transition"
                  >
                    اطلبه الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 1: Shop by Category Visual Showcase */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-brand-950">
                تسوّق حسب القسم
              </h2>
              <p className="text-[10px] text-brand-600">
                اختر التصنيف المفضل لك لاستعراض أصنافه الطازجة فوراً
              </p>
            </div>
            <a
              href="#catalog"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedOccasion('all');
              }}
              className="text-[10.5px] font-bold text-brand-700 hover:text-brand-950 flex items-center gap-1"
            >
              <span>عرض كل الأصناف ({products.length})</span>
              <ArrowLeft className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <a
                  key={cat.id}
                  href="#catalog"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedOccasion('all');
                  }}
                  className={`group relative rounded-xl overflow-hidden border transition-all duration-300 flex items-center gap-2.5 p-2 bg-white hover:shadow-md ${
                    isSelected
                      ? 'border-gold-500 ring-2 ring-gold-500/20 bg-amber-50/40'
                      : 'border-brand-200/80 hover:border-brand-400'
                  }`}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0 bg-brand-100">
                    <img
                      src={getSafeImageUrl(cat.image)}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-[11px] sm:text-xs font-extrabold text-brand-950 truncate group-hover:text-brand-700 transition">
                        {cat.name}
                      </h3>
                      <span className="text-[8.5px] font-bold bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded-full shrink-0">
                        {count}
                      </span>
                    </div>
                    <p className="text-[9px] text-brand-500 line-clamp-1 mt-0.5">
                      {cat.description}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 2: Unified Product Catalog with Occasion Concierge, Category Tabs, Filters & Search */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
        {/* Interactive Occasion & Craving Concierge */}
        <div className="bg-gradient-to-l from-brand-950 via-brand-900 to-brand-950 text-white rounded-xl p-3 sm:p-3.5 border border-gold-500/30 shadow-xs mb-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-gold-500/20 border border-gold-400/40 flex items-center justify-center text-xs">
                🧭
              </span>
              <div>
                <h3 className="text-xs font-extrabold text-gold-400">
                  مستشار الواحة الذكي — اختر مناسبتك أو هدفك اليوم
                </h3>
                <p className="text-[9.5px] text-brand-200">
                  اضغط على المناسبة لترشيح أنسب الأصناف ودرجة التحميص المثالية لك فوراً
                </p>
              </div>
            </div>
            {selectedOccasion !== 'all' && (
              <button
                type="button"
                onClick={() => handleSelectOccasion('all')}
                className="text-[9.5px] font-bold text-gold-400 hover:underline bg-white/10 px-2 py-0.5 rounded-md"
              >
                عرض كل الأصناف ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {OCCASION_PRESETS.map((occ) => {
              const isActive = selectedOccasion === occ.id;
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => handleSelectOccasion(occ.id)}
                  className={`text-right p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-gradient-to-l from-gold-400 to-amber-300 text-brand-950 border-gold-300 shadow-xs'
                      : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
                  }`}
                >
                  <div className="text-[10.5px] font-extrabold leading-snug">{occ.label}</div>
                  <div
                    className={`text-[8.5px] mt-0.5 line-clamp-1 font-medium ${
                      isActive ? 'text-brand-900' : 'text-brand-200'
                    }`}
                  >
                    {occ.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedOccasion !== 'all' && (
            <div className="bg-white/10 border border-gold-400/30 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px]">
              <span className="font-semibold text-amber-200">
                {OCCASION_PRESETS.find((o) => o.id === selectedOccasion)?.tip}
              </span>
              <Link
                href="/custom-box"
                className="bg-gold-500 hover:bg-gold-400 text-brand-950 font-extrabold text-[9.5px] px-2.5 py-1 rounded-md shrink-0 transition flex items-center gap-1"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>كوّن علبة لهذه المناسبة</span>
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-brand-200 shadow-2xs mb-4 space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-brand-950 flex items-center gap-1.5">
                <span>🥜 تشكيلة المكسرات والأصناف الطازجة</span>
              </h2>
              <p className="text-[10px] text-brand-600 mt-0.5">
                اختر القسم والوزن ودرجة التحميص المفضلة لك مباشرة
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-64">
              <Search className="w-3 h-3 text-brand-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن بندق، فستق، عين جمل، كاجو..."
                className="w-full bg-brand-50 border border-brand-200 rounded-lg pr-8 pl-2.5 py-1.5 text-[11px] font-medium focus:outline-none focus:border-brand-700"
              />
            </div>
          </div>

          {/* Filter Pills Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-2 border-t border-brand-100">
            {/* Unified Category Tabs with Product Counts (horizontally scrollable on mobile) */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0 sm:flex-wrap">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedOccasion('all');
                }}
                className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedCategory === 'all' && selectedOccasion === 'all'
                    ? 'bg-brand-900 text-white shadow-2xs'
                    : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                }`}
              >
                الكل ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedOccasion('all');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-brand-900 text-white shadow-2xs'
                        : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>

            {/* Roast & Sort Filter */}
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-1.5">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 text-[10px] font-bold text-brand-700 shrink-0">
                  <SlidersHorizontal className="w-2.5 h-2.5" />
                  <span>التحميص:</span>
                </div>
                {(['all', 'محمص مملح', 'محمص بدون ملح', 'نيء طبيعي'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRoastFilter(r)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 transition cursor-pointer ${
                      selectedRoastFilter === r
                        ? 'bg-amber-100 text-brand-950 border-brand-700'
                        : 'bg-white text-brand-700 border-brand-200 hover:bg-brand-50'
                    }`}
                  >
                    {r === 'all' ? 'الكل' : r}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-brand-50 border border-brand-200 text-brand-900 text-[10.5px] font-bold rounded-md px-2 py-1 focus:outline-none shrink-0"
              >
                <option value="featured">الأكثر تميزاً</option>
                <option value="price-asc">السعر: الأقل أولاً</option>
                <option value="price-desc">السعر: الأعلى أولاً</option>
                <option value="rating">الأعلى تقييماً</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid — 5 columns on desktop, 4 on md, 3 on sm, 2 on mobile */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center border border-brand-200 space-y-2">
            <div className="text-2xl">🔍</div>
            <h3 className="text-sm font-extrabold text-brand-950">
              لا توجد منتجات مطابقة لبحثك حالياً
            </h3>
            <p className="text-[11px] text-brand-600">
              جرب تغيير الفلتر أو عرض جميع أقسام المكسرات
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedOccasion('all');
                setSelectedRoastFilter('all');
                setSearchQuery('');
              }}
              className="bg-brand-900 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-3.5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3: Interactive "Build Your Own Custom Box" Promo Banner */}
      {pageContent.showCustomBoxBanner && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-l from-brand-950 via-brand-900 to-brand-800 text-white p-4 sm:p-6 border border-gold-500/30 shadow-md">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-7 space-y-2.5">
                <span className="inline-flex items-center gap-1 bg-gold-500/20 border border-gold-400/40 text-gold-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  <PackagePlus className="w-3 h-3" />
                  <span>{pageContent.customBoxBannerBadge}</span>
                </span>
                <h2 className="text-base sm:text-xl font-black text-white">
                  {pageContent.customBoxBannerTitle}
                </h2>
                <p className="text-[11px] text-brand-100 leading-relaxed max-w-xl">
                  {pageContent.customBoxBannerDesc}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {pageContent.customBoxBannerPills.map((pill, idx) => (
                    <span
                      key={idx}
                      className="text-[9.5px] font-bold bg-white/10 border border-white/15 text-brand-100 px-2.5 py-1 rounded-lg"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <div className="pt-1">
                  <Link
                    href="/custom-box"
                    className="inline-flex items-center gap-1.5 bg-gradient-to-l from-gold-400 to-gold-500 hover:from-gold-500 hover:to-gold-600 text-brand-950 font-black text-xs px-4 py-2 rounded-xl shadow-md transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{pageContent.customBoxBannerCta}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* 3 Interactive Box Size Cards */}
              <div className="lg:col-span-5 grid grid-cols-3 gap-2">
                {[
                  { size: '500 جم', title: 'بوكس السهرة', desc: 'يكفي 2-4 أشخاص', tag: 'عملي' },
                  { size: '1 كجم', title: 'بوكس العائلة', desc: 'يكفي 5-8 أشخاص', tag: 'الأكثر طلباً' },
                  { size: '2 كجم', title: 'بوكس الضيافة VIP', desc: 'يكفي +12 شخص', tag: 'توفير أكبر' },
                ].map((b, i) => (
                  <Link
                    key={i}
                    href="/custom-box"
                    className="bg-white/10 hover:bg-white/15 border border-gold-400/30 rounded-xl p-2.5 text-center flex flex-col justify-between gap-1.5 transition group"
                  >
                    <span className="text-[8.5px] font-extrabold bg-gold-500/25 text-gold-300 px-1.5 py-0.5 rounded-full mx-auto">
                      {b.tag}
                    </span>
                    <div className="text-base sm:text-lg font-black text-white group-hover:text-gold-400 transition">
                      {b.size}
                    </div>
                    <div>
                      <div className="text-[10.5px] font-extrabold text-brand-100">{b.title}</div>
                      <div className="text-[8.5px] text-brand-300">{b.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4: Royal Mixed & Gift Boxes Showcase (#mixed-boxes) */}
      {pageContent.showMixedBoxesSection && mixedBoxProducts.length > 0 && (
        <section id="mixed-boxes" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16 space-y-3">
          <div className="bg-gradient-to-l from-amber-50 via-white to-amber-50/60 border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
              <div>
                <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold bg-amber-100 text-brand-900 px-2.5 py-0.5 rounded-full mb-1">
                  <Gift className="w-3 h-3 text-gold-600" />
                  <span>{pageContent.mixedBoxesBadge}</span>
                </span>
                <h2 className="text-sm sm:text-lg font-black text-brand-950">
                  {pageContent.mixedBoxesTitle}
                </h2>
                <p className="text-[10.5px] text-brand-700 mt-0.5 max-w-2xl">
                  {pageContent.mixedBoxesDesc}
                </p>
              </div>
              <Link
                href="/custom-box"
                className="bg-brand-900 hover:bg-brand-950 text-white text-[10.5px] font-extrabold px-3.5 py-2 rounded-xl shrink-0 flex items-center gap-1.5 self-start sm:self-center transition"
              >
                <Sparkles className="w-3 h-3 text-gold-400" />
                <span>أو صمّم بوكس مخصص بنفسك</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {mixedBoxProducts.map((boxProd) => (
                <ProductCard key={boxProd.id} product={boxProd} />
              ))}
            </div>

            {pageContent.mixedBoxesGiftNote && (
              <div className="bg-white/90 border border-amber-200/80 rounded-xl px-3 py-2 text-[10px] font-bold text-brand-800 flex items-center justify-between gap-2">
                <span>{pageContent.mixedBoxesGiftNote}</span>
                <Link href="/checkout" className="text-brand-950 underline font-extrabold shrink-0">
                  إتمام الطلب كهدية ←
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 5: Our 4-Step Fresh Roasting Journey */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-brand-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="text-center max-w-xl mx-auto space-y-0.5">
            <span className="text-[9.5px] font-extrabold text-gold-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              🔥 من المحمصة لباب بيتك
            </span>
            <h2 className="text-sm sm:text-base font-black text-brand-950">
              رحلة الحبة المقرمشة في محمصة الواحة الذهبية
            </h2>
            <p className="text-[10px] text-brand-600">
              نلتزم بمعايير صارمة في كل خطوة لنضمن لك قرمشة وطراوة لا تُقارن
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              {
                step: '01',
                emoji: '🌱',
                title: 'استيراد الفرز الأول',
                desc: 'ننتقي أكبر الحبات حجماً (جامبو) من مزارع كاليفورنيا، تركيا، وتشيلي.',
              },
              {
                step: '02',
                emoji: '🔥',
                title: 'تحميص يومي بالهواء',
                desc: 'تحميص دفعات صغيرة يومياً بالهواء الساخن بدون أي زيوت مهدرجة.',
              },
              {
                step: '03',
                emoji: '🛡️',
                title: 'تغليف حراري ثلاثي',
                desc: 'عبوات معزولة بسحاب محكم الغلق (Zip-Lock) تمنع الرطوبة والهواء.',
              },
              {
                step: '04',
                emoji: '🚚',
                title: 'توصيل سريع لباب البيت',
                desc: 'شحن فوري لجميع محافظات مصر مع إمكانية المعاينة والدفع عند الاستلام.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-brand-50/60 hover:bg-brand-50 rounded-xl p-3 border border-brand-100 transition flex flex-col justify-between space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-[10px] font-black font-mono text-gold-600 bg-white px-2 py-0.5 rounded-md border border-brand-200">
                    خطوة {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-brand-950">{item.title}</h3>
                  <p className="text-[9.5px] text-brand-600 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: Why Choose Us (CMS Trust Features) */}
      {pageContent.showTrustSection && pageContent.trustFeatures.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-brand-700">
                  {pageContent.trustSectionSubheading}
                </span>
                <h2 className="text-sm sm:text-base font-black text-brand-950">
                  {pageContent.trustSectionTitle}
                </h2>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-pistachio-700 bg-pistachio-50 border border-pistachio-200 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                ضمان استبدال فوري 100%
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {pageContent.trustFeatures.map((feat) => (
                <div
                  key={feat.id}
                  className="bg-white rounded-xl p-3 border border-brand-200/80 shadow-2xs flex items-start gap-2.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-sm shrink-0">
                    {feat.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[11px] sm:text-xs font-extrabold text-brand-950">
                      {feat.title}
                    </h3>
                    <p className="text-[9.5px] text-brand-600 mt-0.5 leading-relaxed line-clamp-2">
                      {feat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 7: Verified Customer Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-brand-200 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-black text-brand-950 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-gold-500 fill-gold-500" />
                <span>آراء وتجارب عملائنا الموثقة</span>
              </h2>
              <p className="text-[10px] text-brand-600">
                تقييمات حقيقية من عملاء محمصة الواحة الذهبية في مختلف المحافظات
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-brand-950">
              <span>⭐ 4.9 / 5</span>
              <span className="text-brand-600 font-normal">• +4,500 عميل سعيد</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              {
                name: 'أحمد عبد الرحمن',
                city: 'القاهرة - التجمع الخامس',
                product: 'بوكس المشكل الملكي VIP',
                comment: 'القرمشة والطراوة ممتازة جداً وكأنها لسه خارجة من الفرن حالا، والتغليف شيك جداً للهدايا.',
                rating: 5,
              },
              {
                name: 'مريم الشافعي',
                city: 'الإسكندرية - سموحة',
                product: 'فستق أمريكي جامبو محمص',
                comment: 'أول مرة ألاقي فستق جامبو كل الحبات مفتوحة ومقرمشة بالنظافة دي ومن غير ملح زيادة.',
                rating: 5,
              },
              {
                name: 'د. كريم محمود',
                city: 'الجيزة - الشيخ زايد',
                product: 'عين جمل تشيلي ولوز نيء',
                comment: 'ممتاز للدايت والكيتو، طعمه طازج جداً ومفيش أي مرارة زي اللي بنشتريه معلب من السوبرماركت.',
                rating: 5,
              },
              {
                name: 'نهى الكيلاني',
                city: 'المنصورة',
                product: 'علبة مكسرات مخصصة 1 كجم',
                comment: 'فكرة كوّن علبتك عبقرية! اخترت الأصناف اللي أولادي بيحبوها بالظبط ووصلتني في أقل من 24 ساعة.',
                rating: 5,
              },
            ].map((rev, idx) => (
              <div
                key={idx}
                className="bg-brand-50/50 rounded-xl p-3 border border-brand-100 flex flex-col justify-between space-y-2"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className="w-2.5 h-2.5 text-gold-500 fill-gold-500"
                        />
                      ))}
                    </div>
                    <span className="text-[8.5px] font-bold text-pistachio-700 bg-pistachio-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      طلب موثق
                    </span>
                  </div>
                  <p className="text-[10px] text-brand-800 leading-relaxed">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                </div>

                <div className="pt-1.5 border-t border-brand-100 flex items-center justify-between text-[9px]">
                  <div>
                    <div className="font-extrabold text-brand-950">{rev.name}</div>
                    <div className="text-brand-500">{rev.city}</div>
                  </div>
                  <span className="font-bold text-brand-700 bg-white px-1.5 py-0.5 rounded border border-brand-200/70 truncate max-w-[110px]">
                    {rev.product}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: Active Coupons Strip (Compact) */}
      {pageContent.showCouponsSection &&
        storeData?.coupons &&
        storeData.coupons.filter((c) => c.active).length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-pistachio-50 border border-dashed border-pistachio-500 rounded-xl p-3 flex flex-col lg:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-center lg:text-right">
                <span className="text-[10px] font-extrabold text-pistachio-700 bg-white px-2 py-0.5 rounded-full border border-pistachio-200 shrink-0">
                  {pageContent.couponsBannerBadge}
                </span>
                <h3 className="text-xs font-extrabold text-brand-950">
                  {pageContent.couponsBannerTitle}
                </h3>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {storeData.coupons
                  .filter((c) => c.active)
                  .map((coupon) => (
                    <div
                      key={coupon.id}
                      className="bg-white px-2.5 py-1 rounded-lg border border-pistachio-200 shadow-2xs flex items-center gap-2"
                    >
                      <div>
                        <span className="text-[11px] font-extrabold text-brand-950 font-mono tracking-wider ml-1.5">
                          {coupon.code}
                        </span>
                        <span className="text-[9.5px] text-brand-600">{coupon.description}</span>
                      </div>
                      <button
                        onClick={() => copyCoupon(coupon.code)}
                        className="bg-pistachio-600 hover:bg-pistachio-700 text-white text-[9.5px] font-bold px-2 py-0.5 rounded-md transition"
                      >
                        نسخ
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

      {/* SECTION 9: Quick FAQ Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-brand-200 p-4 sm:p-5 shadow-2xs space-y-3">
          <div>
            <h2 className="text-sm sm:text-base font-black text-brand-950">
              أسئلة شائعة قبل الطلب
            </h2>
            <p className="text-[10px] text-brand-600">
              كل ما تود معرفته عن التحميص، الحفظ، الشحن، وطرق الدفع
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[
              {
                q: 'كيف تضمنون وصول المكسرات مقرمشة وطازجة؟',
                a: 'نحمص المكسرات يومياً حسب الطلب بالهواء الساخن، ونغلفها فوراً في أكياس حرارية ثلاثية الطبقات مزودة بسحاب محكم الغلق يحفظ القرمشة لأشهر.',
              },
              {
                q: 'هل يمكنني خلط عدة أصناف بنسب وتحميصات مختلفة في علبة واحدة؟',
                a: 'نعم! من خلال قسم "كوّن علبتك" يمكنك اختيار حجم العلبة (500 جم، 1 كجم، 2 كجم) وتحديد نسبة كل صنف ودرجة تحميصه بحرية تامة.',
              },
              {
                q: 'ما هي مدة التوصيل وطرق الدفع المتاحة؟',
                a: 'التوصيل خلال 24 ساعة للقاهرة والجيزة و48 ساعة لباقي المحافظات، ومتاح الدفع عند الاستلام أو عبر إنستا باي وفودافون كاش، والشحن مجاني للطلبات فوق 1000 ج.م.',
              },
              {
                q: 'هل يمكن إرسال الطلب كهدية مع كارت إهداء؟',
                a: 'بالتأكيد! في صفحة إتمام الطلب يمكنك تفعيل خيار "إرسال كهدية فاخرة" وكتابة اسم المُهدى إليه ورسالتك الخاصة مجاناً.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="bg-brand-50/50 rounded-xl p-3 border border-brand-100 space-y-1"
              >
                <h3 className="text-[11px] font-extrabold text-brand-950 flex items-center gap-1.5">
                  <span className="text-gold-600">؟</span>
                  <span>{faq.q}</span>
                </h3>
                <p className="text-[9.5px] text-brand-700 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
