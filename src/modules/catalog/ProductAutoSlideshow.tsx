'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pause,
  Play,
  Images,
} from 'lucide-react';
import { getSafeImageUrl } from '@/lib/defaults';

interface ProductAutoSlideshowProps {
  images: string[];
  productName: string;
  discountPercent?: number | null;
  badgeText?: string;
  originText?: string;
  autoPlayIntervalMs?: number;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
}

export default function ProductAutoSlideshow({
  images,
  productName,
  discountPercent,
  badgeText,
  originText,
  autoPlayIntervalMs = 3500,
  selectedIndex,
  onSelectIndex,
}: ProductAutoSlideshowProps) {
  const safeImages = React.useMemo(() => {
    const cleaned = (images || [])
      .map((u) => getSafeImageUrl(u))
      .filter(Boolean);
    return cleaned.length > 0 ? Array.from(new Set(cleaned)) : [getSafeImageUrl('')];
  }, [images]);

  const [internalIndex, setInternalIndex] = useState(0);
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const activeIndex =
    typeof selectedIndex === 'number' &&
    selectedIndex >= 0 &&
    selectedIndex < safeImages.length
      ? selectedIndex
      : internalIndex < safeImages.length
        ? internalIndex
        : 0;

  const goToIndex = useCallback(
    (nextIdx: number, manual = false) => {
      const normalized =
        ((nextIdx % safeImages.length) + safeImages.length) % safeImages.length;
      setInternalIndex(normalized);
      if (manual && onSelectIndex) {
        onSelectIndex(normalized);
      }
    },
    [safeImages.length, onSelectIndex]
  );

  // Sync when controlled selectedIndex changes externally (e.g. URL query param)
  useEffect(() => {
    if (
      typeof selectedIndex === 'number' &&
      selectedIndex >= 0 &&
      selectedIndex < safeImages.length
    ) {
      setInternalIndex(selectedIndex);
    }
  }, [selectedIndex, safeImages.length]);

  // Automatic slideshow rotation when product has multiple images
  useEffect(() => {
    if (safeImages.length <= 1 || !isAutoPlayEnabled || isHoverPaused) {
      return;
    }

    const timer = window.setInterval(() => {
      setInternalIndex((prev) => {
        const next = (prev + 1) % safeImages.length;
        return next;
      });
    }, autoPlayIntervalMs);

    return () => window.clearInterval(timer);
  }, [safeImages.length, isAutoPlayEnabled, isHoverPaused, autoPlayIntervalMs]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    setIsHoverPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    const endX = e.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    setIsHoverPaused(false);

    if (startX === null || endX === null || safeImages.length <= 1) return;
    const diff = endX - startX;
    if (Math.abs(diff) > 40) {
      // In RTL, swipe right/left naturally cycles slides
      if (diff > 0) {
        goToIndex(activeIndex + 1, true);
      } else {
        goToIndex(activeIndex - 1, true);
      }
    }
  };

  const hasMultiple = safeImages.length > 1;

  return (
    <div className="space-y-3 select-none">
      {/* Main Studio Frame (4:3 above-the-fold friendly on mobile, square on desktop) */}
      <div
        className="relative rounded-2xl overflow-hidden bg-white border border-[#E8DFD3] aspect-[4/3] sm:aspect-square shadow-[0_6px_24px_-12px_rgba(35,23,16,0.08)] group"
        onMouseEnter={() => setIsHoverPaused(true)}
        onMouseLeave={() => setIsHoverPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Cross-fading layered slides for silky-smooth auto-slideshow */}
        {safeImages.map((imgUrl, idx) => {
          const isCurrent = idx === activeIndex;
          return (
            <img
              key={`${imgUrl}-${idx}`}
              src={imgUrl}
              alt={`${productName} - صورة ${idx + 1}`}
              loading={idx === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                isCurrent
                  ? 'opacity-100 scale-100 z-10'
                  : 'opacity-0 scale-[1.03] z-0 pointer-events-none'
              }`}
            />
          );
        })}

        {/* Top-Right Discount & Feature Badges */}
        <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
          {discountPercent && discountPercent > 0 && (
            <span className="bg-[#B84A39] text-[#FAF7F2] text-xs font-extrabold px-3 py-1 rounded-full shadow-xs tabular-nums">
              -{discountPercent}%
            </span>
          )}
          {badgeText && (
            <span className="bg-[#2C1D14]/92 backdrop-blur-xs text-[#FAF7F2] text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
              {badgeText}
            </span>
          )}
        </div>

        {/* Top-Left Slideshow Controls & Counter */}
        {hasMultiple && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAutoPlayEnabled((prev) => !prev)}
              className="bg-white/95 hover:bg-white text-[#261A13] border border-[#E8DFD3] px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
              title={isAutoPlayEnabled ? 'إيقاف التقليب التلقائي' : 'تشغيل التقليب التلقائي'}
              aria-label={isAutoPlayEnabled ? 'إيقاف التقليب التلقائي' : 'تشغيل التقليب التلقائي'}
            >
              {isAutoPlayEnabled ? (
                <Pause className="w-3 h-3 text-[#9A6836]" />
              ) : (
                <Play className="w-3 h-3 text-[#9A6836]" />
              )}
              <span className="tabular-nums">
                {activeIndex + 1} / {safeImages.length}
              </span>
            </button>
          </div>
        )}

        {/* Right / Left Manual Navigation Arrows */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={() => goToIndex(activeIndex - 1, true)}
              aria-label="الصورة السابقة"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-[#261A13] text-[#261A13] hover:text-[#FAF7F2] border border-[#E8DFD3] shadow-sm flex items-center justify-center transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goToIndex(activeIndex + 1, true)}
              aria-label="الصورة التالية"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-[#261A13] text-[#261A13] hover:text-[#FAF7F2] border border-[#E8DFD3] shadow-sm flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Bottom Origin Pill & Pagination Dots */}
        <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
          {originText ? (
            <span className="pointer-events-auto bg-white/95 backdrop-blur-xs text-[#261A13] border border-[#E8DFD3] text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs max-w-[70%] truncate">
              <MapPin className="w-3 h-3 text-[#9A6836] shrink-0" />
              <span className="truncate">{originText}</span>
            </span>
          ) : (
            <span />
          )}

          {hasMultiple && (
            <div className="pointer-events-auto flex items-center gap-1.5 bg-[#261A13]/45 backdrop-blur-xs px-2.5 py-1.5 rounded-full">
              {safeImages.map((_, idx) => {
                const isDotActive = idx === activeIndex;
                return (
                  <button
                    key={`dot-${idx}`}
                    type="button"
                    onClick={() => goToIndex(idx, true)}
                    aria-label={`عرض الصورة ${idx + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      isDotActive
                        ? 'w-5 bg-[#E5B869]'
                        : 'w-2 bg-white/60 hover:bg-white/90'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Thumbnails Strip */}
      {hasMultiple && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#6E5D4F] px-0.5">
            <span className="inline-flex items-center gap-1 font-medium">
              <Images className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>صور المنتج ({safeImages.length}) • تقليب تلقائي</span>
            </span>
            <span className="text-[#8A7968]">اضغط على أي صورة للتكبير والمعاينة</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {safeImages.map((imgUrl, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={`thumb-${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => goToIndex(idx, true)}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'border-[#9A6836] ring-2 ring-[#9A6836]/20 scale-[1.02]'
                      : 'border-[#E8DFD3] opacity-70 hover:opacity-100 hover:border-[#C88A4B]'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${productName} مصغرة ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
