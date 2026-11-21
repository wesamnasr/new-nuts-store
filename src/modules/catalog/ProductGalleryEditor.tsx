'use client';

import React, { useRef, useState } from 'react';
import {
  Images,
  Upload,
  Plus,
  Trash2,
  Star,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { getSafeImageUrl } from '@/lib/defaults';

export interface PresetGalleryImage {
  label: string;
  url: string;
}

interface ProductGalleryEditorProps {
  primaryImage: string;
  gallery?: string[];
  onChangePrimary: (nextPrimary: string) => void;
  onChangeGallery: (nextGallery: string[]) => void;
  presetImages?: ReadonlyArray<PresetGalleryImage>;
}

async function compressAndUploadSingleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('يرجى اختيار ملفات صور صالحة فقط'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = (e) => {
      const src = String(e.target?.result || '');
      if (!src) {
        reject(new Error('ملف الصورة فارغ'));
        return;
      }

      const img = new window.Image();
      img.onerror = () => reject(new Error('تعذر معالجة أبعاد الصورة'));
      img.onload = () => {
        const maxDim = 720;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        const mime = dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
        if (mime === 'image/jpeg') {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        while (Math.round((dataUrl.length * 3) / 4) > 180 * 1024 && quality > 0.45) {
          quality = Math.round((quality - 0.12) * 100) / 100;
          dataUrl = canvas.toDataURL(mime, quality);
        }

        const token =
          (typeof window !== 'undefined' &&
            (sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token'))) ||
          '';

        if (!token) {
          resolve(dataUrl);
          return;
        }

        fetch('/api/admin/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dataUrl }),
        })
          .then((r) => r.json().catch(() => null))
          .then((json) => {
            resolve(json?.success && json?.url ? String(json.url) : dataUrl);
          })
          .catch(() => resolve(dataUrl));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductGalleryEditor({
  primaryImage,
  gallery = [],
  onChangePrimary,
  onChangeGallery,
  presetImages = [],
}: ProductGalleryEditorProps) {
  const [manualUrl, setManualUrl] = useState('');
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const multiInputRef = useRef<HTMLInputElement | null>(null);

  const cleanPrimary = primaryImage?.trim() || '';
  const cleanGallery = Array.from(
    new Set(
      (gallery || [])
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter((u) => Boolean(u) && u !== cleanPrimary)
    )
  );

  const appendGalleryUrls = (urls: string[]) => {
    const incoming = urls.map((u) => u.trim()).filter(Boolean);
    if (incoming.length === 0) return;

    let nextPrimary = cleanPrimary;
    const remaining: string[] = [];

    for (const url of incoming) {
      if (!nextPrimary) {
        nextPrimary = url;
        onChangePrimary(url);
      } else if (url !== nextPrimary && !cleanGallery.includes(url) && !remaining.includes(url)) {
        remaining.push(url);
      }
    }

    if (remaining.length > 0) {
      onChangeGallery([...cleanGallery, ...remaining]);
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);
    const files = Array.from(fileList);
    setUploadingCount(files.length);

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const uploaded = await compressAndUploadSingleImage(file);
        if (uploaded) {
          uploadedUrls.push(uploaded);
        }
      }
      appendGalleryUrls(uploadedUrls);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الصور الإضافية';
      setErrorMsg(msg);
    } finally {
      setUploadingCount(0);
      if (multiInputRef.current) {
        multiInputRef.current.value = '';
      }
    }
  };

  const handleAddManualUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    appendGalleryUrls([trimmed]);
    setManualUrl('');
    setErrorMsg(null);
  };

  const handleRemoveGalleryImage = (index: number) => {
    const next = cleanGallery.filter((_, idx) => idx !== index);
    onChangeGallery(next);
  };

  const handleMoveGalleryImage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= cleanGallery.length) return;
    const next = [...cleanGallery];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    onChangeGallery(next);
  };

  const handlePromoteToPrimary = (index: number) => {
    const chosen = cleanGallery[index];
    if (!chosen) return;
    const nextGallery = cleanGallery.filter((_, idx) => idx !== index);
    if (cleanPrimary) {
      nextGallery.unshift(cleanPrimary);
    }
    onChangePrimary(chosen);
    onChangeGallery(nextGallery);
  };

  const totalImagesCount = (cleanPrimary ? 1 : 0) + cleanGallery.length;

  return (
    <div className="mt-3 rounded-2xl border border-[#E8E0D5] bg-[#FAF6F0]/75 p-3.5 space-y-3 font-cairo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Images className="w-4 h-4 text-[#682e28]" />
          <span className="text-xs font-bold text-[#231710]">
            معرض الصور المتعددة والسلايد شو التلقائي لصفحة المنتج
          </span>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-[#E8E0D5] text-[#682e28] tabular-nums">
          إجمالي الصور المعروضة: {totalImagesCount} {totalImagesCount === 1 ? 'صورة' : 'صور'}
        </span>
      </div>

      <p className="text-[11px] text-[#6B5A4E] leading-relaxed">
        ارفع أكثر من صورة للمنتج ليتم عرضها بتقليب تلقائي جذاب داخل صفحة المنتج، ويمكنك ترتيب الصور أو اختيار أي صورة لتكون الرئيسية.
      </p>

      {errorMsg && (
        <div className="flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Multi-upload & URL input bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          ref={multiInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <button
          type="button"
          disabled={uploadingCount > 0}
          onClick={() => multiInputRef.current?.click()}
          className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#682e28] hover:bg-[#53231e] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 shrink-0"
        >
          {uploadingCount > 0 ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>جاري ضغط ورفع ({uploadingCount})...</span>
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              <span>رفع صور إضافية للسلايد شو</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5 flex-1">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddManualUrl();
              }
            }}
            placeholder="أو الصق رابط صورة إضافية ثم اضغط إضافة..."
            className="w-full min-h-[38px] bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#231710] outline-none focus:border-[#682e28]"
          />
          <button
            type="button"
            onClick={handleAddManualUrl}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#E8E0D5] text-[#231710] text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة</span>
          </button>
        </div>
      </div>

      {/* Quick Add from Built-in Studio Photos */}
      {presetImages.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-[#6B5A4E] block">
            إضافة سريعة للسلايد شو من مكتبة الصور الجاهزة:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presetImages.map((preset) => {
              const alreadyUsed =
                cleanPrimary === preset.url || cleanGallery.includes(preset.url);
              return (
                <button
                  key={`gal-preset-${preset.url}`}
                  type="button"
                  disabled={alreadyUsed}
                  onClick={() => appendGalleryUrls([preset.url])}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                    alreadyUsed
                      ? 'bg-[#EFE9E0] text-[#9A8978] border-[#E8E0D5] cursor-not-allowed opacity-60'
                      : 'bg-white text-[#231710] border-[#E8E0D5] hover:border-[#682e28] cursor-pointer'
                  }`}
                >
                  <img
                    src={getSafeImageUrl(preset.url)}
                    alt={preset.label}
                    className="w-3.5 h-3.5 rounded object-cover"
                  />
                  <span>+ {preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Slideshow Sequence Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-1">
        {cleanPrimary && (
          <div className="relative rounded-xl overflow-hidden border-2 border-[#682e28] bg-white p-1.5 space-y-1.5">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-[#FAF6F0]">
              <img
                src={getSafeImageUrl(cleanPrimary)}
                alt="الصورة الرئيسية"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-1.5 right-1.5 bg-[#682e28] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                <span>الرئيسية (١)</span>
              </span>
            </div>
            <div className="text-[10px] text-center font-bold text-[#682e28] py-0.5">
              تظهر أولاً في البطاقة والسلايد شو
            </div>
          </div>
        )}

        {cleanGallery.map((imgUrl, idx) => (
          <div
            key={`${imgUrl}-${idx}`}
            className="relative rounded-xl overflow-hidden border border-[#E8E0D5] bg-white p-1.5 space-y-1.5"
          >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-[#FAF6F0]">
              <img
                src={getSafeImageUrl(imgUrl)}
                alt={`صورة سلايد شو ${idx + 2}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-1.5 right-1.5 bg-[#231710]/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums">
                شريحة {idx + 2}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveGalleryImage(idx)}
                title="حذف الصورة من السلايد شو"
                className="absolute top-1.5 left-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-md transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => handleMoveGalleryImage(idx, -1)}
                title="تحريك للأمام"
                className="p-1 rounded-md border border-[#E8E0D5] bg-[#FAF6F0] hover:bg-white text-[#231710] disabled:opacity-35 cursor-pointer"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handlePromoteToPrimary(idx)}
                className="flex-1 text-[10px] font-bold py-1 px-1 rounded-md bg-[#FAF6F0] hover:bg-[#682e28] hover:text-white text-[#231710] border border-[#E8E0D5] transition cursor-pointer truncate"
              >
                تعيين رئيسية
              </button>
              <button
                type="button"
                disabled={idx === cleanGallery.length - 1}
                onClick={() => handleMoveGalleryImage(idx, 1)}
                title="تحريك للخلف"
                className="p-1 rounded-md border border-[#E8E0D5] bg-[#FAF6F0] hover:bg-white text-[#231710] disabled:opacity-35 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
