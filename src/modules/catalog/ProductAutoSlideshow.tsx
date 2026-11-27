'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pause,
  Play,
  Images,
  Video,
  ExternalLink,
} from 'lucide-react';
import { getSafeImageUrl } from '@/lib/defaults';

interface ProductAutoSlideshowProps {
  images: string[];
  productName: string;
  discountPercent?: number | null;
  badgeText?: string;
  originText?: string;
  videoUrl?: string;
  videoPoster?: string;
  autoPlayIntervalMs?: number;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
}

type VideoEmbedKind = 'mp4' | 'youtube' | 'facebook' | 'external';

interface MediaSlideItem {
  type: 'image' | 'video';
  src: string;
  poster?: string;
  embedKind?: VideoEmbedKind;
  embedUrl?: string;
}

function parseVideoEmbed(rawUrl: string): { embedKind: VideoEmbedKind; embedUrl?: string } {
  const clean = rawUrl.trim();
  const lower = clean.toLowerCase();

  if (
    /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(lower) ||
    lower.startsWith('data:video/') ||
    lower.startsWith('blob:')
  ) {
    return { embedKind: 'mp4', embedUrl: clean };
  }

  // YouTube watch / short / shorts URLs
  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) {
        return {
          embedKind: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`,
        };
      }
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      let id = parsed.searchParams.get('v') || '';
      if (!id && parsed.pathname.includes('/shorts/')) {
        id = parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      } else if (!id && parsed.pathname.includes('/embed/')) {
        id = parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
      }
      if (id) {
        return {
          embedKind: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`,
        };
      }
    }
    if (host === 'facebook.com' || host === 'm.facebook.com' || host === 'fb.watch' || host === 'web.facebook.com') {
      return {
        embedKind: 'facebook',
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(clean)}&show_text=false`,
      };
    }
  } catch {
    // Non-standard URL string: fall back to external play link
  }

  return { embedKind: 'external', embedUrl: clean };
}

export default function ProductAutoSlideshow({
  images,
  productName,
  discountPercent,
  badgeText,
  originText,
  videoUrl,
  videoPoster,
  autoPlayIntervalMs = 3500,
  selectedIndex,
  onSelectIndex,
}: ProductAutoSlideshowProps) {
  const safeImages = useMemo(() => {
    const cleaned = (images || []).map((u) => getSafeImageUrl(u)).filter(Boolean);
    return cleaned.length > 0 ? Array.from(new Set(cleaned)) : [getSafeImageUrl('')];
  }, [images]);

  const mediaItems = useMemo<MediaSlideItem[]>(() => {
    const heroImage = safeImages[0];
    const items: MediaSlideItem[] = [{ type: 'image', src: heroImage }];

    const cleanVideo = videoUrl?.trim();
    if (cleanVideo) {
      const parsed = parseVideoEmbed(cleanVideo);
      items.push({
        type: 'video',
        src: cleanVideo,
        poster: videoPoster?.trim() ? getSafeImageUrl(videoPoster) : heroImage,
        embedKind: parsed.embedKind,
        embedUrl: parsed.embedUrl,
      });
    }

    for (const extraImg of safeImages.slice(1)) {
      items.push({ type: 'image', src: extraImg });
    }

    return items;
  }, [safeImages, videoUrl, videoPoster]);

  const videoIndex = useMemo(
    () => mediaItems.findIndex((m) => m.type === 'video'),
    [mediaItems]
  );

  const [internalIndex, setInternalIndex] = useState(0);
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const activeIndex =
    typeof selectedIndex === 'number' &&
    selectedIndex >= 0 &&
    selectedIndex < mediaItems.length
      ? selectedIndex
      : internalIndex < mediaItems.length
        ? internalIndex
        : 0;

  const activeItem = mediaItems[activeIndex] || mediaItems[0];

  const goToIndex = useCallback(
    (nextIdx: number, manual = false) => {
      const normalized = ((nextIdx % mediaItems.length) + mediaItems.length) % mediaItems.length;
      setInternalIndex(normalized);
      if (manual && onSelectIndex) {
        onSelectIndex(normalized);
      }
    },
    [mediaItems.length, onSelectIndex]
  );

  // Sync when controlled selectedIndex changes externally (e.g. URL query param)
  useEffect(() => {
    if (
      typeof selectedIndex === 'number' &&
      selectedIndex >= 0 &&
      selectedIndex < mediaItems.length
    ) {
      setInternalIndex(selectedIndex);
    }
  }, [selectedIndex, mediaItems.length]);

  // Automatic slideshow rotation when product has multiple images and active slide is not a video
  useEffect(() => {
    if (
      mediaItems.length <= 1 ||
      !isAutoPlayEnabled ||
      isHoverPaused ||
      activeItem?.type === 'video'
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setInternalIndex((prev) => (prev + 1) % mediaItems.length);
    }, autoPlayIntervalMs);

    return () => window.clearInterval(timer);
  }, [mediaItems.length, isAutoPlayEnabled, isHoverPaused, activeItem?.type, autoPlayIntervalMs]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    setIsHoverPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    const endX = e.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    setIsHoverPaused(false);

    if (startX === null || endX === null || mediaItems.length <= 1) return;
    const diff = endX - startX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        goToIndex(activeIndex + 1, true);
      } else {
        goToIndex(activeIndex - 1, true);
      }
    }
  };

  const hasMultiple = mediaItems.length > 1;

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
        {mediaItems.map((item, idx) => {
          const isCurrent = idx === activeIndex;

          if (item.type === 'video') {
            return (
              <div
                key={`video-slide-${idx}`}
                className={`absolute inset-0 w-full h-full bg-[#16100C] flex flex-col items-center justify-center transition-opacity duration-500 ${
                  isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {isCurrent && item.embedKind === 'mp4' && (
                  <video
                    src={item.src}
                    poster={item.poster}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-[#16100C]"
                  />
                )}

                {isCurrent && item.embedKind === 'youtube' && item.embedUrl && (
                  <iframe
                    src={item.embedUrl}
                    title={`فيديو ${productName}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                )}

                {isCurrent && item.embedKind === 'facebook' && item.embedUrl && (
                  <div className="relative w-full h-full flex flex-col">
                    <iframe
                      src={item.embedUrl}
                      title={`فيديو ${productName}`}
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full flex-1 border-0 bg-[#16100C]"
                    />
                    <a
                      href={item.src}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#231710] text-[#FAF7F2] text-[11px] font-bold py-1.5 px-3 flex items-center justify-center gap-1.5 hover:bg-[#3A271C] transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#E5B869]" />
                      <span>فتح الفيديو مباشرة لو لم يظهر داخل المتصفح</span>
                    </a>
                  </div>
                )}

                {isCurrent && item.embedKind === 'external' && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {item.poster && (
                      <img
                        src={item.poster}
                        alt={`فيديو ${productName}`}
                        className="absolute inset-0 w-full h-full object-cover opacity-45"
                      />
                    )}
                    <a
                      href={item.src}
                      target="_blank"
                      rel="noreferrer"
                      className="relative z-10 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#15803D] hover:bg-[#166534] text-white font-cairo font-extrabold text-sm shadow-lg transition"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>تشغيل فيديو التجربة الآن</span>
                    </a>
                  </div>
                )}
              </div>
            );
          }

          return (
            <img
              key={`${item.src}-${idx}`}
              src={item.src}
              alt={`${productName} - صورة ${idx + 1}`}
              loading={idx === 0 ? 'eager' : 'lazy'}
              fetchPriority={idx === 0 ? 'high' : 'auto'}
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                isCurrent
                  ? 'opacity-100 scale-100 z-10'
                  : 'opacity-0 scale-[1.03] z-0 pointer-events-none'
              }`}
            />
          );
        })}

        {/* Top-Right Discount & Feature Badges */}
        {activeItem?.type !== 'video' && (
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
        )}

        {/* Top-Left Slideshow Controls & Video Quick-Jump Pill */}
        {hasMultiple && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
            {videoIndex !== -1 && activeIndex !== videoIndex && (
              <button
                type="button"
                onClick={() => goToIndex(videoIndex, true)}
                className="bg-[#15803D] hover:bg-[#166534] text-white px-2.5 py-1 rounded-full text-[11px] font-cairo font-extrabold flex items-center gap-1 shadow-sm transition cursor-pointer"
              >
                <Play className="w-3 h-3 fill-white shrink-0" />
                <span>شاهد فيديو المنتج</span>
              </button>
            )}
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
                {activeIndex + 1} / {mediaItems.length}
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
              aria-label="الشريحة السابقة"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-[#261A13] text-[#261A13] hover:text-[#FAF7F2] border border-[#E8DFD3] shadow-sm flex items-center justify-center transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goToIndex(activeIndex + 1, true)}
              aria-label="الشريحة التالية"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-[#261A13] text-[#261A13] hover:text-[#FAF7F2] border border-[#E8DFD3] shadow-sm flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Bottom Origin Pill & Pagination Dots (hidden while watching video so controls stay unobstructed) */}
        {activeItem?.type !== 'video' && (
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
                {mediaItems.map((m, idx) => {
                  const isDotActive = idx === activeIndex;
                  return (
                    <button
                      key={`dot-${idx}`}
                      type="button"
                      onClick={() => goToIndex(idx, true)}
                      aria-label={m.type === 'video' ? 'عرض فيديو المنتج' : `عرض الصورة ${idx + 1}`}
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
        )}
      </div>

      {/* Interactive Thumbnails Strip */}
      {hasMultiple && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#6E5D4F] px-0.5">
            <span className="inline-flex items-center gap-1 font-medium">
              {videoIndex !== -1 ? (
                <Video className="w-3.5 h-3.5 text-[#15803D]" />
              ) : (
                <Images className="w-3.5 h-3.5 text-[#9A6836]" />
              )}
              <span>
                {videoIndex !== -1
                  ? `فيديو وصور المنتج (${mediaItems.length})`
                  : `صور المنتج (${mediaItems.length}) • تقليب تلقائي`}
              </span>
            </span>
            <span className="text-[#8A7968]">اضغط على أي شريحة للمعاينة</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {mediaItems.map((item, idx) => {
              const isSelected = idx === activeIndex;
              if (item.type === 'video') {
                return (
                  <button
                    key={`thumb-video-${idx}`}
                    type="button"
                    onClick={() => goToIndex(idx, true)}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer bg-[#231710] ${
                      isSelected
                        ? 'border-[#15803D] ring-2 ring-[#15803D]/25 scale-[1.02]'
                        : 'border-[#E8DFD3] opacity-85 hover:opacity-100 hover:border-[#15803D]'
                    }`}
                  >
                    {item.poster && (
                      <img
                        src={item.poster}
                        alt={`فيديو ${productName}`}
                        className="w-full h-full object-cover opacity-55"
                      />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/30">
                      <span className="w-6 h-6 rounded-full bg-[#15803D] text-white flex items-center justify-center shadow">
                        <Play className="w-3 h-3 fill-white" />
                      </span>
                      <span className="text-[9px] font-cairo font-extrabold text-white">
                        فيديو
                      </span>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={`thumb-${item.src}-${idx}`}
                  type="button"
                  onClick={() => goToIndex(idx, true)}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'border-[#9A6836] ring-2 ring-[#9A6836]/20 scale-[1.02]'
                      : 'border-[#E8DFD3] opacity-70 hover:opacity-100 hover:border-[#C88A4B]'
                  }`}
                >
                  <img
                    src={item.src}
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
