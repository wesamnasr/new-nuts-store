'use client';

import React, { useEffect, type JSX } from 'react';
import { X } from 'lucide-react';

export interface SlideOverDrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  id?: string;
  widthClassName?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function SlideOverDrawer({
  open,
  onClose,
  title,
  subtitle,
  id,
  widthClassName = 'max-w-2xl',
  footer,
  children,
}: SlideOverDrawerProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      dir="rtl"
      role="presentation"
    >
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        id={id}
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex flex-col h-full w-full ${widthClassName} bg-[var(--theme-surface)] text-[var(--theme-text)] border-s border-[var(--theme-border)] shadow-2xl`}
      >
        <div className="sticky top-0 z-10 shrink-0 px-4 sm:px-6 py-3.5 border-b border-[var(--theme-border)] bg-[var(--theme-surface)] flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-right">
            <h2 className="text-base sm:text-lg font-black text-[var(--theme-text)] leading-snug">
              {title}
            </h2>
            {subtitle && (
              <div className="text-xs text-[var(--theme-text-muted)] mt-0.5 leading-snug">
                {subtitle}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            title="إغلاق"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-black/5 flex items-center justify-center shrink-0 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500)/0.5)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 text-sm text-right">
          {children}
        </div>

        {footer && (
          <div className="sticky bottom-0 z-10 shrink-0 px-4 sm:px-6 py-3.5 border-t border-[var(--theme-border)] bg-[var(--theme-surface)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default SlideOverDrawer;
