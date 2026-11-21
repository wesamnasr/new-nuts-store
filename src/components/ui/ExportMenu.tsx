'use client';

import React, { useEffect, useRef, useState, type JSX } from 'react';
import { ChevronDown, Download } from 'lucide-react';

export interface ExportMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface ExportMenuProps {
  label?: string;
  items: ExportMenuItem[];
  className?: string;
}

export function ExportMenu({
  label = 'تصدير ▾',
  items,
  className = '',
}: ExportMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const hasCustomArrow = label.includes('▾') || label.includes('▼');

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500)/0.5)] whitespace-nowrap"
      >
        <Download className="w-4 h-4 shrink-0 text-[var(--theme-accent)]" />
        <span>{label}</span>
        {!hasCustomArrow && (
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full mt-1.5 end-0 z-40 min-w-[240px] max-w-[320px] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-xl p-1.5 space-y-0.5"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onClick();
              }}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl text-right flex items-start gap-2.5 text-xs font-bold text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {item.icon && (
                <span className="shrink-0 mt-0.5 text-[var(--theme-accent)]">
                  {item.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block leading-snug">{item.label}</span>
                {item.description && (
                  <span className="block text-[11px] font-normal text-[var(--theme-text-muted)] mt-0.5 leading-snug">
                    {item.description}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
