'use client';

import React, { useState, type JSX } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';

export interface FilterToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  activeFiltersCount?: number;
  onResetFilters?: () => void;
  primarySlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  advancedChildren?: React.ReactNode;
  defaultAdvancedOpen?: boolean;
  className?: string;
}

export function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'ابحث بالاسم أو الكود أو الرقم...',
  activeFiltersCount = 0,
  onResetFilters,
  primarySlot,
  actionsSlot,
  advancedChildren,
  defaultAdvancedOpen = false,
  className = '',
}: FilterToolbarProps): JSX.Element {
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(defaultAdvancedOpen);
  const showReset = Boolean(
    onResetFilters && (activeFiltersCount > 0 || searchValue.trim().length > 0)
  );

  return (
    <div
      dir="rtl"
      className={`rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 space-y-3 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[210px]">
          <Search className="w-4 h-4 text-[var(--theme-text-muted)] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full min-h-[40px] ps-9 pe-9 py-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[rgb(var(--gold-500)/0.45)]"
          />
          {searchValue.length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="مسح البحث"
              className="absolute end-1.5 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-black/5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {primarySlot && (
          <div className="flex flex-wrap items-center gap-2">{primarySlot}</div>
        )}

        {advancedChildren && (
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            aria-expanded={advancedOpen}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              advancedOpen || activeFiltersCount > 0
                ? 'border-[rgb(var(--gold-500)/0.55)] bg-[rgb(var(--gold-500)/0.12)] text-[var(--theme-text)]'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-[var(--theme-accent)]" />
            <span>فلاتر متقدمة</span>
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[rgb(var(--gold-500))] text-[#231710] text-[11px] font-black tabular-nums">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                advancedOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}

        {showReset && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>إعادة ضبط</span>
          </button>
        )}

        {actionsSlot && (
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            {actionsSlot}
          </div>
        )}
      </div>

      {advancedChildren && advancedOpen && (
        <div className="pt-3 border-t border-[var(--theme-border)]">
          {advancedChildren}
        </div>
      )}
    </div>
  );
}

export default FilterToolbar;
