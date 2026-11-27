'use client';

import React, { useRef, useState } from 'react';
import {
  Megaphone,
  Copy,
  Check,
  ExternalLink,
  Video,
  Sparkles,
  Camera,
  Upload,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { Product } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';
import { buildAdLandingUrl } from '@/lib/ad-mode';
import { compressAndUploadAdminImage } from '@/lib/admin-image-upload';

interface ProductAdStudioEditorProps {
  product: Product;
  onChange: (patch: Partial<Product>) => void;
}

export default function ProductAdStudioEditor({
  product,
  onChange,
}: ProductAdStudioEditorProps) {
  const [expanded, setExpanded] = useState(
    Boolean(
      product.videoUrl ||
        product.adHeadline ||
        (product.adHighlights && product.adHighlights.length > 0) ||
        (product.proofImages && product.proofImages.length > 0)
    )
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [uploadingProofCount, setUploadingProofCount] = useState(0);
  const [proofError, setProofError] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://hafsahnuts.com';
  const relativeAdUrl = buildAdLandingUrl(product.slug || product.id);
  const fullAdUrl = buildAdLandingUrl(product.slug || product.id, undefined, origin);

  const cleanProofImages = Array.from(
    new Set(
      (product.proofImages || [])
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter(Boolean)
    )
  );

  const handleCopyAdLink = async () => {
    try {
      await navigator.clipboard.writeText(fullAdUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Fallback copy unavailable
    }
  };

  const handleProofFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setProofError(null);
    const files = Array.from(fileList);
    setUploadingProofCount(files.length);

    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const url = await compressAndUploadAdminImage(file);
        if (url) uploaded.push(url);
      }
      if (uploaded.length > 0) {
        onChange({
          proofImages: Array.from(new Set([...cleanProofImages, ...uploaded])),
        });
      }
    } catch (err: unknown) {
      setProofError(err instanceof Error ? err.message : 'تعذر رفع صور تجارب العملاء');
    } finally {
      setUploadingProofCount(0);
      if (proofInputRef.current) proofInputRef.current.value = '';
    }
  };

  const handleAddProofUrl = () => {
    const clean = proofUrlInput.trim();
    if (!clean) return;
    onChange({
      proofImages: Array.from(new Set([...cleanProofImages, clean])),
    });
    setProofUrlInput('');
  };

  const handleRemoveProofImage = (idx: number) => {
    onChange({
      proofImages: cleanProofImages.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="mt-3 rounded-2xl border border-[#CBE2D3] bg-[#F4FBF6]/80 p-3.5 space-y-3 font-cairo">
      {/* Header + 1-Click Copy Ad URL */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-right cursor-pointer"
        >
          <span className="w-7 h-7 rounded-lg bg-[#15803D] text-white flex items-center justify-center shrink-0">
            <Megaphone className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="text-xs font-extrabold text-[#14532D]">
              إعدادات صفحة الهبوط والإعلانات الممولة (الوضع الأساسي المباشر)
            </div>
            <div className="text-[10px] text-[#3B6E4C]">
              الرابط المباشر + فيديو المشهور + العنوان التسويقي + سكرين شوت العملاء
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#15803D] transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyAdLink}
            className="px-3 py-1.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'تم النسخ!' : 'نسخ رابط الإعلان المباشر'}</span>
          </button>
          <a
            href={relativeAdUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#14532D] border border-[#BBF7D0] text-[11px] font-bold flex items-center gap-1 transition"
          >
            <ExternalLink className="w-3 h-3" />
            <span>معاينة الصفحة</span>
          </a>
        </div>
      </div>

      {/* Always-visible compact ad URL preview */}
      <div className="bg-white rounded-xl border border-[#D4E8DA] px-3 py-1.5 flex items-center justify-between gap-2">
        <code className="text-[11px] font-mono text-[#14532D] truncate" dir="ltr">
          {fullAdUrl}
        </code>
      </div>

      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Video / Reel URL */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#231710] mb-1">
              <Video className="w-3.5 h-3.5 text-[#15803D]" />
              <span>رابط فيديو المنتج أو ريل المشهور (MP4 / يوتيوب / فيسبوك ريل)</span>
            </label>
            <input
              type="url"
              dir="ltr"
              value={product.videoUrl || ''}
              onChange={(e) => onChange({ videoUrl: e.target.value })}
              placeholder="https://youtube.com/shorts/... أو رابط فيديو MP4"
              className="w-full min-h-[38px] bg-white border border-[#D4E8DA] focus:border-[#15803D] rounded-xl px-3 py-1.5 text-xs font-mono text-[#231710] outline-none"
            />
          </div>

          {/* Ad Headline */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#231710] mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>عنوان الإعلان التسويقي الجذاب (اختياري — اتركه فارغاً للافتراضي)</span>
            </label>
            <input
              type="text"
              value={product.adHeadline || ''}
              onChange={(e) => onChange({ adHeadline: e.target.value })}
              placeholder="مثال: سوداني حفصة الجامبو المستورد — قرمشة طازجة من المحمصة لبيتك"
              className="w-full min-h-[38px] bg-white border border-[#D4E8DA] focus:border-[#15803D] rounded-xl px-3 py-1.5 text-xs text-[#231710] outline-none"
            />
          </div>

          {/* 3 Bullet Highlights */}
          <div>
            <label className="block text-xs font-bold text-[#231710] mb-1">
              ٣ مميزات سريعة للمنتج (سطر لكل ميزة — اختياري)
            </label>
            <textarea
              rows={3}
              value={(product.adHighlights || []).join('\n')}
              onChange={(e) =>
                onChange({
                  adHighlights: e.target.value.split('\n').slice(0, 3),
                })
              }
              placeholder={
                'حباية جامبو فرز أول منقية بالواحدة بدون ولا حباية محروقة\nتحميص يومي على الهادي وتغليف حراري يحفظ القرمشة\nشحن سريع لكل مصر والدفع عند الاستلام بعد المعاينة'
              }
              className="w-full bg-white border border-[#D4E8DA] focus:border-[#15803D] rounded-xl px-3 py-2 text-xs text-[#231710] outline-none leading-relaxed"
            />
          </div>

          {/* Customer Proof Screenshots Uploader */}
          <div className="space-y-2 pt-1 border-t border-[#D4E8DA]">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#231710]">
                <Camera className="w-3.5 h-3.5 text-[#15803D]" />
                <span>صور تجارب العملاء وسكرين شوت الواتساب ({cleanProofImages.length})</span>
              </label>
            </div>

            {proofError && (
              <div className="flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{proofError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                ref={proofInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleProofFilesSelected(e.target.files)}
              />
              <button
                type="button"
                disabled={uploadingProofCount > 0}
                onClick={() => proofInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 shrink-0"
              >
                {uploadingProofCount > 0 ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الرفع...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صور سكرين شوت</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={proofUrlInput}
                  onChange={(e) => setProofUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddProofUrl();
                    }
                  }}
                  placeholder="أو الصق رابط صورة شهادة عميل..."
                  className="w-full min-h-[38px] bg-white border border-[#D4E8DA] rounded-xl px-2.5 py-1 text-xs font-mono text-[#231710] outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddProofUrl}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F2] border border-[#D4E8DA] text-[#231710] text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            {cleanProofImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                {cleanProofImages.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative rounded-xl overflow-hidden border border-[#D4E8DA] bg-white p-1"
                  >
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#FAF7F2]">
                      <img
                        src={getSafeImageUrl(url)}
                        alt={`إثبات عميل ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveProofImage(idx)}
                        title="حذف الصورة"
                        className="absolute top-1 left-1 bg-red-600 hover:bg-red-700 text-white p-1 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
