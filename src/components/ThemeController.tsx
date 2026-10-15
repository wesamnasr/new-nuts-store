'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Palette,
  X,
  Layout,
  Sparkles,
  Check,
  RotateCcw,
  Layers,
  Square,
  PanelTop,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { STORE_THEMES } from '@/lib/defaults';
import {
  BorderRadiusStyle,
  CardStyle,
  HeroLayoutStyle,
  NavbarStyle,
  StoreThemeId,
} from '@/types/store';

export default function ThemeController() {
  const { themeConfig, setThemeOverride, showToast } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  if (!themeConfig.showThemeSwitcher) {
    return null;
  }

  const currentPreset =
    STORE_THEMES.find((t) => t.id === themeConfig.themeId) || STORE_THEMES[0];

  const handleSelectTheme = (id: StoreThemeId) => {
    const preset = STORE_THEMES.find((t) => t.id === id);
    if (!preset) return;
    setThemeOverride({
      themeId: preset.id,
      heroLayout: preset.defaults.heroLayout,
      navbarStyle: preset.defaults.navbarStyle,
      cardStyle: preset.defaults.cardStyle,
      borderRadius: preset.defaults.borderRadius,
    });
    showToast(`تم تطبيق ثيم: ${preset.name}`, preset.subtitle);
  };

  return (
    <>
      {/* Floating Theme Studio Trigger Button (Bottom-Left) */}
      <div className="fixed bottom-3.5 left-3.5 z-40 flex items-center gap-1.5">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="group bg-brand-950 hover:bg-brand-900 text-white px-2.5 py-2 rounded-full shadow-lg border border-gold-500/60 flex items-center gap-1.5 transition-all hover:scale-105"
          title="تغيير ثيم وشكل الموقع"
        >
          <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-gold-500 to-amber-300 text-brand-950 flex items-center justify-center shadow-xs">
            <Palette className="w-3 h-3" />
          </span>
          <div className="text-right hidden sm:block">
            <span className="block text-[9px] text-gold-400 font-extrabold leading-none">
              مظهر وثيم الموقع
            </span>
            <span className="block text-[10px] font-black text-white leading-tight mt-0.5">
              {currentPreset.name}
            </span>
          </div>
        </button>
      </div>

      {/* Slide-Over Theme & Layout Studio Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white text-brand-950 w-full max-w-sm h-full overflow-y-auto shadow-2xl border-r border-brand-200 flex flex-col justify-between">
            {/* Header */}
            <div>
              <div className="sticky top-0 z-10 bg-brand-950 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-gold-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gold-500 text-brand-950 flex items-center justify-center font-black">
                    <Palette className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black flex items-center gap-1">
                      <span>استوديو الثيمات وتخطيط الموقع</span>
                      <Sparkles className="w-3 h-3 text-gold-400" />
                    </h3>
                    <p className="text-[9.5px] text-brand-200">
                      غيّر ألوان وهندسة وتخطيط الموقع بالكامل بضغطة زر
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3.5 space-y-4">
                {/* 1. Theme Presets (3 Light + 3 Dark) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-brand-950 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-gold-500" />
                      <span>1. اختر الثيم (3 فاتح بخط غامق • 3 غامق بخط فاتح)</span>
                    </label>
                    <button
                      onClick={() => {
                        setThemeOverride(null);
                        showToast('تمت استعادة المظهر الافتراضي للمتجر');
                      }}
                      className="text-[10px] font-extrabold text-brand-600 hover:text-brand-950 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>افتراضي المتجر</span>
                    </button>
                  </div>

                  {/* Group A: 3 Light Themes with Dark Fonts */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-black text-brand-800 bg-brand-100/80 px-2.5 py-1 rounded-lg flex items-center justify-between">
                      <span>☀️ ثيمات فاتحة بخطوط غامقة (3 ثيمات)</span>
                      <span className="text-[10px] font-bold">خلفية فاتحة • نص داكن</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {STORE_THEMES.filter((t) => !t.isDark).map((theme) => {
                        const isSelected = themeConfig.themeId === theme.id;
                        return (
                          <button
                            key={theme.id}
                            onClick={() => handleSelectTheme(theme.id)}
                            className={`w-full text-right p-2.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-gold-500 bg-brand-50 shadow-sm ring-2 ring-gold-500/20'
                                : 'border-brand-100 hover:border-brand-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Live Background + Font Contrast Preview */}
                              <div
                                className="w-12 h-12 rounded-xl shrink-0 p-1.5 flex flex-col items-center justify-between shadow-inner border border-black/15"
                                style={{
                                  backgroundColor: theme.swatches.bg,
                                  color: theme.swatches.primary,
                                }}
                              >
                                <span className="text-xs font-black leading-none mt-0.5">
                                  أبجد
                                </span>
                                <div className="flex items-center gap-1 w-full justify-center">
                                  <span
                                    className="w-3.5 h-2 rounded-xs"
                                    style={{ backgroundColor: theme.swatches.primary }}
                                  />
                                  <span
                                    className="w-3.5 h-2 rounded-xs"
                                    style={{ backgroundColor: theme.swatches.secondary }}
                                  />
                                  <span
                                    className="w-3.5 h-2 rounded-xs"
                                    style={{ backgroundColor: theme.swatches.accent }}
                                  />
                                </div>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-brand-950">
                                    {theme.name}
                                  </span>
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-brand-950">
                                    {theme.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] font-bold text-brand-700 mt-0.5">
                                  {theme.subtitle}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-gold-500 text-white'
                                  : 'border border-brand-200 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group B: 3 Dark Themes with Light Fonts */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-black text-brand-800 bg-brand-100/80 px-2.5 py-1 rounded-lg flex items-center justify-between">
                      <span>🌙 ثيمات غامقة بخطوط فاتحة (3 ثيمات)</span>
                      <span className="text-[10px] font-bold">خلفية داكنة • نص مضيء</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {STORE_THEMES.filter((t) => t.isDark).map((theme) => {
                        const isSelected = themeConfig.themeId === theme.id;
                        return (
                          <button
                            key={theme.id}
                            onClick={() => handleSelectTheme(theme.id)}
                            className={`w-full text-right p-2.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-gold-500 bg-brand-50 shadow-sm ring-2 ring-gold-500/20'
                                : 'border-brand-100 hover:border-brand-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Live Background + Font Contrast Preview */}
                              <div
                                className="w-12 h-12 rounded-xl shrink-0 p-1.5 flex flex-col items-center justify-between shadow-inner border border-white/20"
                                style={{
                                  backgroundColor: theme.swatches.bg,
                                  color: theme.swatches.primary,
                                }}
                              >
                                <span className="text-xs font-black leading-none mt-0.5">
                                  أبجد
                                </span>
                                <div className="flex items-center gap-1 w-full justify-center">
                                  <span
                                    className="w-3.5 h-2 rounded-xs"
                                    style={{ backgroundColor: theme.swatches.primary }}
                                  />
                                  <span
                                    className="w-3.5 h-2 rounded-xs"
                                    style={{ backgroundColor: theme.swatches.secondary }}
                                  />
                                  <span
                                    className="w-3.5 h-2 rounded-xs"
                                    style={{ backgroundColor: theme.swatches.accent }}
                                  />
                                </div>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-brand-950">
                                    {theme.name}
                                  </span>
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-gold-500/20 text-brand-900">
                                    {theme.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] font-bold text-brand-700 mt-0.5">
                                  {theme.subtitle}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-gold-500 text-white'
                                  : 'border border-brand-200 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Hero Layout Selector */}
                <div className="space-y-2 pt-2 border-t border-brand-100">
                  <label className="text-xs font-black text-brand-950 flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-gold-500" />
                    <span>2. تخطيط الواجهة الرئيسية (Hero Layout)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'split', label: 'مقسوم كلاسيكي', desc: 'نص + صورة جانبية' },
                        { id: 'centered', label: 'بانر ملكي مركزي', desc: 'توسيط بانورامي فخم' },
                        { id: 'showcase', label: 'عرض سينمائي شبكي', desc: 'بطاقات تفاعلية مزدوجة' },
                      ] as { id: HeroLayoutStyle; label: string; desc: string }[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setThemeOverride({ heroLayout: item.id })}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          themeConfig.heroLayout === item.id
                            ? 'bg-brand-950 text-gold-400 border-brand-950 font-black shadow-xs'
                            : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100 font-bold'
                        }`}
                      >
                        <div className="text-[11px]">{item.label}</div>
                        <div className="text-[9px] opacity-75 mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Navbar Style Selector */}
                <div className="space-y-2 pt-2 border-t border-brand-100">
                  <label className="text-xs font-black text-brand-950 flex items-center gap-1.5">
                    <PanelTop className="w-3.5 h-3.5 text-gold-500" />
                    <span>3. تصميم شريط التنقل العلوي (Header)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'classic', label: 'كلاسيكي ممتد' },
                        { id: 'floating', label: 'عائم كبسولي' },
                        { id: 'dark_royal', label: 'ملكي داكن' },
                      ] as { id: NavbarStyle; label: string }[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setThemeOverride({ navbarStyle: item.id })}
                        className={`py-2 px-2.5 rounded-xl border text-[11px] transition ${
                          themeConfig.navbarStyle === item.id
                            ? 'bg-brand-950 text-gold-400 border-brand-950 font-black'
                            : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100 font-bold'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Card Style Selector */}
                <div className="space-y-2 pt-2 border-t border-brand-100">
                  <label className="text-xs font-black text-brand-950 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-gold-500" />
                    <span>4. تصميم بطاقات المنتجات (Card Style)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'classic', label: 'كلاسيكي متوازن' },
                        { id: 'editorial', label: 'إطار مجلات فاخر' },
                        { id: 'soft_elevated', label: 'عائم بظل ناعم' },
                      ] as { id: CardStyle; label: string }[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setThemeOverride({ cardStyle: item.id })}
                        className={`py-2 px-2.5 rounded-xl border text-[11px] transition ${
                          themeConfig.cardStyle === item.id
                            ? 'bg-brand-950 text-gold-400 border-brand-950 font-black'
                            : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100 font-bold'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Border Radius Geometry */}
                <div className="space-y-2 pt-2 border-t border-brand-100">
                  <label className="text-xs font-black text-brand-950 flex items-center gap-1.5">
                    <Square className="w-3.5 h-3.5 text-gold-500" />
                    <span>5. هندسة الحواف والأزرار (Corner Geometry)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'rounded', label: 'دائري متوازن' },
                        { id: 'sharp', label: 'حواف حادة فاخرة' },
                        { id: 'pill', label: 'انسيابي كبسولي' },
                      ] as { id: BorderRadiusStyle; label: string }[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setThemeOverride({ borderRadius: item.id })}
                        className={`py-2 px-2.5 rounded-xl border text-[11px] transition ${
                          themeConfig.borderRadius === item.id
                            ? 'bg-brand-950 text-gold-400 border-brand-950 font-black'
                            : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100 font-bold'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-brand-50 border-t border-brand-200 flex items-center justify-between gap-2">
              <span className="text-[10px] text-brand-700 font-semibold">
                💡 يمكنك تثبيت الثيم لجميع الزوار من لوحة الأدمن
              </span>
              <button
                onClick={() => setOpen(false)}
                className="bg-brand-900 hover:bg-brand-950 text-gold-400 font-black text-xs px-4 py-2 rounded-xl transition"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
