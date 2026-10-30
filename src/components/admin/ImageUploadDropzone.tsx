'use client';

import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, CheckCircle2, X, Sparkles, AlertCircle } from 'lucide-react';
import { getSafeImageUrl } from '@/lib/defaults';

interface ImageUploadDropzoneProps {
  currentImage?: string;
  onImageSelected: (url: string) => void;
  label?: string;
  compact?: boolean;
}

interface CompressionStats {
  originalBytes: number;
  compressedBytes: number;
  savedPercent: number;
}

export default function ImageUploadDropzone({
  currentImage,
  onImageSelected,
  label = 'صورة المنتج المضغوطة (WebP)',
  compact = false,
}: ImageUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CompressionStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processAndCompressFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP, إلخ)');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const originalSize = file.size;
    const reader = new FileReader();

    reader.onload = (e) => {
      const src = String(e.target?.result || '');
      if (!src) {
        setIsProcessing(false);
        setError('تعذر قراءة ملف الصورة');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxDim = 640;
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
          setIsProcessing(false);
          onImageSelected(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        let webpDataUrl = canvas.toDataURL('image/webp', 0.82);

        // Fallback to jpeg if webp unsupported
        if (!webpDataUrl.startsWith('data:image/webp')) {
          webpDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        }

        // Estimate compressed bytes from base64 length
        const compressedBytes = Math.round((webpDataUrl.length * 3) / 4);
        const savedPercent =
          originalSize > 0
            ? Math.max(0, Math.round(((originalSize - compressedBytes) / originalSize) * 100))
            : 0;

        setStats({
          originalBytes: originalSize,
          compressedBytes,
          savedPercent,
        });

        setIsProcessing(false);
        onImageSelected(webpDataUrl);
      };

      img.onerror = () => {
        setIsProcessing(false);
        setError('تعذر معالجة أبعاد الصورة');
      };

      img.src = src;
    };

    reader.onerror = () => {
      setIsProcessing(false);
      setError('خطأ أثناء قراءة الملف من الجهاز');
    };

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndCompressFile(file);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-2 font-cairo">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-brand-950 flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5 text-gold-500" />
          <span>{label}</span>
        </label>
        {stats && (
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>وفر {stats.savedPercent}% من الحجم</span>
          </span>
        )}
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-3 transition text-center cursor-pointer ${
          isDragging
            ? 'border-gold-500 bg-gold-50/50'
            : 'border-brand-200 bg-brand-50/60 hover:bg-brand-50 hover:border-brand-300'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              processAndCompressFile(file);
            }
          }}
        />

        {currentImage ? (
          <div className="flex items-center gap-3 text-right">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-brand-200 bg-white shrink-0">
              <img
                src={getSafeImageUrl(currentImage)}
                alt="معاينة الصورة"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 bg-brand-950/80 text-gold-400 text-[9px] font-mono px-1 rounded">
                WebP
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1 text-xs font-black text-brand-950">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">الصورة محددة ومضغوطة بنجاح</span>
              </div>

              {stats ? (
                <div className="text-[10px] text-brand-600 space-y-0.5">
                  <div>الحجم الأصلي: <span className="font-mono">{formatFileSize(stats.originalBytes)}</span></div>
                  <div>الحجم بعد الضغط: <span className="font-mono font-bold text-emerald-700">{formatFileSize(stats.compressedBytes)}</span> (WebP)</div>
                </div>
              ) : (
                <div className="text-[10.5px] text-brand-600 truncate font-mono">
                  {currentImage.startsWith('data:') ? 'بيانات مضغوطة WebP Data URL' : currentImage}
                </div>
              )}

              <div className="text-[10px] text-gold-600 font-bold">
                انقر أو اسحب ملفاً جديداً لاستبدال الصورة
              </div>
            </div>
          </div>
        ) : (
          <div className="py-3 space-y-2">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center mx-auto">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-brand-950 block">
                اضغط لاختيار صورة من الموبايل / الكمبيوتر
              </span>
              <span className="text-[10.5px] text-brand-600 block mt-0.5">
                أو اسحب ملف الصورة هنا (يتم الضغط والتحويل إلى WebP تلقائياً)
              </span>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
            <div className="text-xs font-black text-brand-950 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-brand-900 border-t-transparent rounded-full animate-spin" />
              <span>جاري ضغط وتحويل الصورة إلى WebP...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
