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
      <div className="max-w-6xl mx-auto px-4 py-14 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-brand-900 text-gold-400 flex items-center justify-center mx-auto animate-spin text-xl">
          {pageContent.logoEmoji || '🌰'}
        </div>
        <p className="text-sm font-extrabold text-brand-900">
          جاري تحضير المكسرات الطازجة...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10 pb-8">
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

          <div className="relative max-w-5xl mx-auto px-3 sm:px-5 lg:px-6 py-9 lg:py-14 text-center space-y-5">
            <div
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold mx-auto shadow-sm border ${
                isDarkTheme
                  ? 'bg-gold-500/20 border-gold-400/50 text-gold-400'
                  : 'bg-white/90 border-brand-300 text-brand-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-gold-500" />
              <span>{pageContent.heroBadge}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-snug max-w-3xl mx-auto">
              {pageContent.heroTitlePrefix}{' '}
              <span
                className={
                  isDarkTheme
                    ? 'text-transparent bg-clip-text bg-gradient-to-l from-gold-400 to-amber-200'
                    : 'text-brand-700 underline decoration-gold-500/60 decoration-4 underline-offset-8'
                }
              >
                {pageContent.heroTitleHighlight}
              </span>{' '}
              {pageContent.heroTitleSuffix}
            </h1>

            <p
              className={`text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto font-semibold ${
                isDarkTheme ? 'text-brand-100' : 'text-brand-800'
              }`}
            >
              {pageContent.heroDescription || settings?.tagline}
            </p>

            {/* Centered CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link
                href="/custom-box"
                className={`font-black px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-1.5 text-xs sm:text-sm ${
                  isDarkTheme
                    ? 'bg-gradient-to-l from-gold-400 to-gold-500 text-brand-950 ring-2 ring-gold-400/30'
                    : 'bg-brand-900 hover:bg-brand-950 text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-gold-400" />
                <span>{pageContent.heroPrimaryCtaText}</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <a
                href="#catalog"
                className={`font-bold px-5 py-3 rounded-xl transition flex items-center gap-1.5 text-xs sm:text-sm border ${
                  isDarkTheme
                    ? 'bg-white/15 hover:bg-white/25 border-white/30 text-white'
                    : 'bg-white hover:bg-brand-100 border-brand-300 text-brand-950 shadow-xs'
                }`}
              >
                <span>{pageContent.heroSecondaryCtaText}</span>
              </a>
            </div>

            {/* Bottom Panoramic Bar: Stats + VIP Offer Card */}
            <div
              className={`pt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-right backdrop-blur-md border rounded-2xl p-4 mt-4 ${
                isDarkTheme
                  ? 'bg-white/10 border-gold-500/30'
                  : 'bg-white/95 border-brand-300 shadow-md'
              }`}
            >
              <div
                className={`lg:col-span-6 grid grid-cols-3 gap-3 text-center border-b lg:border-b-0 lg:border-l pb-3 lg:pb-0 lg:pl-4 ${
                  isDarkTheme ? 'border-white/15' : 'border-brand-200'
                }`}
              >
                {pageContent.heroStats.map((st, idx) => (
                  <div key={idx}>
                    <div
                      className={`text-base sm:text-xl font-black ${
                        isDarkTheme ? 'text-gold-400' : 'text-brand-900'
                      }`}
                    >
                      {st.value}
                    </div>
                    <div
                      className={`text-[10px] sm:text-[11px] font-bold ${
                        isDarkTheme ? 'text-brand-100' : 'text-brand-700'
                      }`}
                    >
                      {st.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="lg:col-span-6 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold bg-gold-500 text-white px-2 py-0.5 rounded-full">
                    {pageContent.heroFeaturedBadge}
                  </span>
                  <h3
                    className={`font-black text-xs sm:text-sm mt-1 ${
                      isDarkTheme ? 'text-white' : 'text-brand-950'
                    }`}
                  >
                    {pageContent.heroFeaturedTitle}
                  </h3>
                  <p
                    className={`text-[11px] ${
                      isDarkTheme ? 'text-brand-200' : 'text-brand-700'
                    }`}
                  >
                    {pageContent.heroFeaturedSubtitle}
                  </p>
                </div>
                <button
                  onClick={openFeaturedHeroProduct}
                  className={`font-black text-xs px-4 py-2.5 rounded-xl shrink-0 shadow transition ${
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
        <section className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Main Right Bento Card */}
            <div
              className={`lg:col-span-7 rounded-2xl p-5 sm:p-7 border shadow-xl flex flex-col justify-between space-y-5 ${
                isDarkTheme
                  ? 'bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white border-gold-500/30'
                  : 'bg-gradient-to-br from-brand-200 via-brand-100 to-white text-brand-950 border-brand-300'
              }`}
            >
              <div className="space-y-3.5">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                    isDarkTheme
                      ? 'bg-gold-500/20 border-gold-400/40 text-gold-400'
                      : 'bg-white border-brand-300 text-brand-900 shadow-2xs'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-gold-500" />
                  <span>{pageContent.heroBadge}</span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-snug">
                  {pageContent.heroTitlePrefix}{' '}
                  <span
                    className={
                      isDarkTheme
                        ? 'text-transparent bg-clip-text bg-gradient-to-l from-gold-400 to-amber-200'
                        : 'text-brand-600 underline decoration-gold-500/60 decoration-4 underline-offset-4'
                    }
                  >
                    {pageContent.heroTitleHighlight}
                  </span>{' '}
                  {pageContent.heroTitleSuffix}
                </h1>

                <p
                  className={`text-xs sm:text-sm leading-relaxed font-semibold ${
                    isDarkTheme ? 'text-brand-100' : 'text-brand-800'
                  }`}
                >
                  {pageContent.heroDescription || settings?.tagline}
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Link
                    href="/custom-box"
                    className={`font-black px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 text-xs sm:text-sm ${
                      isDarkTheme
                        ? 'bg-gradient-to-l from-gold-400 to-gold-500 text-brand-950'
                        : 'bg-brand-900 hover:bg-brand-950 text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-gold-400" />
                    <span>{pageContent.heroPrimaryCtaText}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                  <a
                    href="#catalog"
                    className={`font-bold px-4 py-2.5 rounded-xl transition text-xs sm:text-sm border ${
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
                className={`grid grid-cols-3 gap-2.5 pt-4 border-t ${
                  isDarkTheme ? 'border-white/15' : 'border-brand-300'
                }`}
              >
                {pageContent.heroStats.map((st, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-2.5 border ${
                      isDarkTheme
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/85 border-brand-200'
                    }`}
                  >
                    <div
                      className={`text-sm sm:text-base font-black ${
                        isDarkTheme ? 'text-gold-400' : 'text-brand-900'
                      }`}
                    >
                      {st.value}
                    </div>
                    <div
                      className={`text-[10px] font-bold ${
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
              <div className="relative h-full min-h-[240px] rounded-2xl overflow-hidden shadow-lg border border-brand-200 bg-brand-950">
                <img
                  src={getSafeImageUrl(pageContent.heroImage)}
                  alt="تشكيلة مكسرات فاخرة"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-3 inset-x-3 flex items-end justify-between gap-2 text-white">
                  <div>
                    <span className="text-[10px] font-extrabold bg-gold-500 text-white px-2 py-0.5 rounded-full">
                      {pageContent.heroFeaturedBadge}
                    </span>
                    <h3 className="font-black text-sm mt-1 text-white">{pageContent.heroFeaturedTitle}</h3>
                    <p className="text-[10px] text-gray-200">{pageContent.heroFeaturedSubtitle}</p>
                  </div>
                  <button
                    onClick={openFeaturedHeroProduct}
                    className="bg-gold-500 hover:bg-gold-400 text-white font-black text-[11px] px-3.5 py-2 rounded-xl shrink-0 shadow transition"
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
          <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 py-7 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Text Column */}
            <div className="lg:col-span-7 space-y-4">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                  isDarkTheme
                    ? 'bg-gold-500/20 border-gold-400/40 text-gold-400'
                    : 'bg-white/90 border-brand-300 text-brand-900 shadow-2xs'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-gold-500" />
                <span>{pageContent.heroBadge}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-snug">
                {pageContent.heroTitlePrefix}{' '}
                <span
                  className={
                    isDarkTheme
                      ? 'text-transparent bg-clip-text bg-gradient-to-l from-gold-400 to-amber-200'
                      : 'text-brand-700 underline decoration-gold-500/60 decoration-4 underline-offset-8'
                  }
                >
                  {pageContent.heroTitleHighlight}
                </span>{' '}
                {pageContent.heroTitleSuffix}
              </h1>

              <p
                className={`text-xs sm:text-sm leading-relaxed max-w-xl font-semibold ${
                  isDarkTheme ? 'text-brand-100' : 'text-brand-800'
                }`}
              >
                {pageContent.heroDescription || settings?.tagline}
              </p>

              {/* Quick CTA Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Link
                  href="/custom-box"
                  className={`font-black px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-1.5 text-xs sm:text-sm ${
                    isDarkTheme
                      ? 'bg-gradient-to-l from-gold-400 to-gold-500 text-brand-950 ring-2 ring-gold-400/30'
                      : 'bg-brand-900 hover:bg-brand-950 text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-gold-400" />
                  <span>{pageContent.heroPrimaryCtaText}</span>
                  <ArrowLeft className="w-4 h-4" />
                </Link>

                <a
                  href="#catalog"
                  className={`font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 text-xs sm:text-sm border ${
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
                className={`pt-3 grid grid-cols-3 gap-3 border-t max-w-md ${
                  isDarkTheme ? 'border-white/15' : 'border-brand-300'
                }`}
              >
                {pageContent.heroStats.map((st, idx) => (
                  <div key={idx}>
                    <div
                      className={`text-base sm:text-lg font-black ${
                        isDarkTheme ? 'text-gold-400' : 'text-brand-900'
                      }`}
                    >
                      {st.value}
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
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
              <div className="relative rounded-2xl overflow-hidden shadow-xl border-2 border-brand-300 bg-brand-900">
                <img
                  src={getSafeImageUrl(pageContent.heroImage)}
                  alt="تشكيلة مكسرات فاخرة"
                  className="w-full h-[240px] sm:h-[290px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Floating Featured Offer inside Hero Image */}
                <div className="absolute bottom-3 inset-x-3 bg-white/95 backdrop-blur-md text-brand-950 p-3 rounded-xl shadow-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold bg-pistachio-100 text-pistachio-700 px-2 py-0.5 rounded-full">
                      {pageContent.heroFeaturedBadge}
                    </span>
                    <h3 className="font-black text-xs sm:text-sm mt-0.5">
                      {pageContent.heroFeaturedTitle}
                    </h3>
                    <p className="text-[10px] text-brand-700">{pageContent.heroFeaturedSubtitle}</p>
                  </div>
                  <button
                    onClick={openFeaturedHeroProduct}
                    className="bg-brand-900 hover:bg-brand-950 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg shrink-0 shadow transition"
                  >
                    اطلبه الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Unified Product Catalog with Occasion Concierge, Category Tabs, Filters & Search */}
      <section id="catalog" className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 scroll-mt-20">
        {/* Interactive Occasion & Craving Concierge */}
        <div className="bg-gradient-to-l from-brand-950 via-brand-900 to-brand-950 text-white rounded-2xl p-3.5 sm:p-4 border border-gold-500/30 shadow-md mb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gold-500/20 border border-gold-400/40 flex items-center justify-center text-sm">
                🧭
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-gold-400">
                  مستشار الواحة الذكي — اختر مناسبتك أو هدفك اليوم
                </h3>
                <p className="text-[10px] text-brand-200">
                  اضغط على المناسبة لترشيح أنسب الأصناف ودرجة التحميص المثالية لك فوراً
                </p>
              </div>
            </div>
            {selectedOccasion !== 'all' && (
              <button
                type="button"
                onClick={() => handleSelectOccasion('all')}
                className="text-[10px] font-bold text-gold-400 hover:underline bg-white/10 px-2.5 py-1 rounded-lg"
              >
                عرض كل الأصناف ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {OCCASION_PRESETS.map((occ) => {
              const isActive = selectedOccasion === occ.id;
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => handleSelectOccasion(occ.id)}
                  className={`text-right p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-gradient-to-l from-gold-400 to-amber-300 text-brand-950 border-gold-300 shadow-md scale-[1.01]'
                      : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
                  }`}
                >
                  <div className="text-[11px] font-black leading-snug">{occ.label}</div>
                  <div
                    className={`text-[9px] mt-1 line-clamp-1 font-semibold ${
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
            <div className="bg-white/10 border border-gold-400/30 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-amber-200">
                {OCCASION_PRESETS.find((o) => o.id === selectedOccasion)?.tip}
              </span>
              <Link
                href="/custom-box"
                className="bg-gold-500 hover:bg-gold-400 text-brand-950 font-black text-[10px] px-3 py-1 rounded-lg shrink-0 transition flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>كوّن علبة لهذه المناسبة</span>
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-brand-200 shadow-xs mb-5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-brand-950 flex items-center gap-1.5">
                <span>🥜 تشكيلة المكسرات والأصناف الطازجة</span>
              </h2>
              <p className="text-[11px] text-brand-600 mt-0.5">
                اختر القسم والوزن ودرجة التحميص المفضلة لك مباشرة
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="w-3.5 h-3.5 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن بندق، فستق، عين جمل، كاجو..."
                className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-9 pl-3 py-2 text-xs font-semibold focus:outline-none focus:border-brand-700"
              />
            </div>
          </div>

          {/* Filter Pills Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2.5 border-t border-brand-100">
            {/* Unified Category Tabs with Product Counts (horizontally scrollable on mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedOccasion('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedCategory === 'all' && selectedOccasion === 'all'
                    ? 'bg-brand-900 text-white shadow-xs'
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
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-brand-900 text-white shadow-xs'
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
                <div className="flex items-center gap-1 text-[11px] font-bold text-brand-700 shrink-0">
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>التحميص:</span>
                </div>
                {(['all', 'محمص مملح', 'محمص بدون ملح', 'نيء طبيعي'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRoastFilter(r)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap shrink-0 transition cursor-pointer ${
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
                className="bg-brand-50 border border-brand-200 text-brand-900 text-[11px] font-bold rounded-lg px-2.5 py-1 focus:outline-none shrink-0"
              >
                <option value="featured">الأكثر تميزاً</option>
                <option value="price-asc">السعر: الأقل أولاً</option>
                <option value="price-desc">السعر: الأعلى أولاً</option>
                <option value="rating">الأعلى تقييماً</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-brand-200 space-y-2.5">
            <div className="text-3xl">🔍</div>
            <h3 className="text-base font-extrabold text-brand-950">
              لا توجد منتجات مطابقة لبحثك حالياً
            </h3>
            <p className="text-xs text-brand-600">
              جرب تغيير الفلتر أو عرض جميع أقسام المكسرات
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedOccasion('all');
                setSelectedRoastFilter('all');
                setSearchQuery('');
              }}
              className="bg-brand-900 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Active Coupons Strip (Compact) */}
      {pageContent.showCouponsSection &&
        storeData?.coupons &&
        storeData.coupons.filter((c) => c.active).length > 0 && (
          <section className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6">
            <div className="bg-pistachio-50 border border-dashed border-pistachio-500 rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-center lg:text-right">
                <span className="text-[11px] font-extrabold text-pistachio-700 bg-white px-2.5 py-0.5 rounded-full border border-pistachio-200 shrink-0">
                  {pageContent.couponsBannerBadge}
                </span>
                <h3 className="text-xs sm:text-sm font-black text-brand-950">
                  {pageContent.couponsBannerTitle}
                </h3>
              </div>

              <div className="flex flex-wrap justify-center gap-2.5">
                {storeData.coupons
                  .filter((c) => c.active)
                  .map((coupon) => (
                    <div
                      key={coupon.id}
                      className="bg-white px-3 py-1.5 rounded-xl border border-pistachio-200 shadow-2xs flex items-center gap-2.5"
                    >
                      <div>
                        <span className="text-xs font-black text-brand-950 font-mono tracking-wider ml-1.5">
                          {coupon.code}
                        </span>
                        <span className="text-[10px] text-brand-600">{coupon.description}</span>
                      </div>
                      <button
                        onClick={() => copyCoupon(coupon.code)}
                        className="bg-pistachio-600 hover:bg-pistachio-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition"
                      >
                        نسخ
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
    </div>
  );
}
