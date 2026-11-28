'use client';

import React, { useState, useEffect } from 'react';
import { Lock, X, Delete, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ManagerPinModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  errorMessage?: string | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void | Promise<void>;
}

export default function ManagerPinModal({
  isOpen,
  title = 'اعتماد بكود المدير السري (PIN)',
  subtitle = 'هذه العملية الحساسة تتطلب إدخال كود المدير السري للتوثيق في سجل الرقابة.',
  actionLabel = 'اعتماد وتنفيذ',
  errorMessage,
  loading = false,
  onClose,
  onConfirm,
}: ManagerPinModalProps) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter' && pin.length >= 4 && !loading) {
        e.preventDefault();
        void onConfirm(pin);
      } else if (/^[0-9]$/.test(e.key) && pin.length < 8) {
        e.preventDefault();
        setPin((prev) => prev + e.key);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, pin, loading, onClose, onConfirm]);

  if (!isOpen) return null;

  const appendDigit = (d: string) => {
    if (pin.length >= 8) return;
    setPin((prev) => prev + d);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl border border-[#E8E0D5] shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-2 border-b border-[#E8E0D5] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[#9A6836]" />
            </div>
            <div>
              <h3 className="font-cairo font-bold text-sm text-[#231710]">{title}</h3>
              <p className="text-[11px] text-[#6B5B4E] mt-0.5 leading-snug">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#FAF6F0] hover:bg-red-50 text-[#231710] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Masked PIN Display */}
        <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-2.5 min-h-[28px]">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, idx) => (
              <span
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border transition ${
                  idx < pin.length
                    ? 'bg-[#231710] border-[#231710] scale-110'
                    : 'bg-white border-[#C88A4B]/60'
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-[#6B5B4E] mt-1.5">
            أدخل الكود باللمس أو بلوحة المفاتيح (الافتراضي: 1234)
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-[#B91C1C] rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Touch Keypad (56x56px minimum touch targets per UX Constitution) */}
        <div className="grid grid-cols-3 gap-2.5 dir-ltr" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => appendDigit(digit)}
              className="min-h-[56px] rounded-xl bg-[#FAF6F0] hover:bg-[#231710] hover:text-white text-[#231710] border border-[#E8E0D5] font-cairo font-black text-lg tabular-nums transition cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="min-h-[56px] rounded-xl bg-red-50 hover:bg-red-100 text-[#B91C1C] border border-red-200 font-cairo font-bold text-xs transition cursor-pointer"
          >
            مسح الكل
          </button>
          <button
            type="button"
            onClick={() => appendDigit('0')}
            className="min-h-[56px] rounded-xl bg-[#FAF6F0] hover:bg-[#231710] hover:text-white text-[#231710] border border-[#E8E0D5] font-cairo font-black text-lg tabular-nums transition cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((prev) => prev.slice(0, -1))}
            aria-label="حذف رقم"
            className="min-h-[56px] rounded-xl bg-[#F3ECE1] hover:bg-[#E8E0D5] text-[#231710] border border-[#E8E0D5] flex items-center justify-center transition cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          disabled={loading || pin.length < 4}
          onClick={() => void onConfirm(pin)}
          className="w-full min-h-[52px] bg-[#166534] hover:bg-[#14532d] disabled:opacity-40 text-white font-cairo font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{loading ? 'جارٍ التحقق...' : actionLabel}</span>
        </button>
      </div>
    </div>
  );
}
