'use client';

import React, { type JSX } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DataTableShellProps {
  totalItems: number;
  currentPage: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  selectedCount?: number;
  onClearSelection?: () => void;
  bulkActionsSlot?: React.ReactNode;
  emptyState?: React.ReactNode;
  footerSlot?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function DataTableShell({
  totalItems,
  currentPage,
  pageSize = 25,
  onPageChange,
  selectedCount = 0,
  onClearSelection,
  bulkActionsSlot,
  emptyState,
  footerSlot,
  className = '',
  children,
}: DataTableShellProps): JSX.Element {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const endItem = Math.min(totalItems, safePage * safePageSize);

  return (
    <div dir="rtl" className={`ds-table-wrap ${className}`.trim()}>
      {selectedCount > 0 && (
        <div className="px-4 py-2.5 border-b border-[var(--theme-border)] bg-[rgb(var(--gold-500)/0.1)] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black text-[var(--theme-text)] tabular-nums">
              تم تحديد {selectedCount} عنصر
            </span>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>إلغاء التحديد</span>
              </button>
            )}
          </div>
          {bulkActionsSlot && (
            <div className="flex flex-wrap items-center gap-2">{bulkActionsSlot}</div>
          )}
        </div>
      )}

      {totalItems === 0 && emptyState ? (
        <div className="p-6 sm:p-10 text-center text-sm text-[var(--theme-text-muted)]">
          {emptyState}
        </div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}

      {(totalItems > 0 || footerSlot) && (
        <div className="px-4 py-3 border-t border-[var(--theme-border)] bg-[var(--theme-surface)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {totalItems > 0 && (
              <span className="text-xs font-medium text-[var(--theme-text-muted)] tabular-nums">
                عرض {startItem}–{endItem} من {totalItems}
              </span>
            )}
            {footerSlot}
          </div>

          {totalItems > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(safePage - 1)}
                disabled={safePage <= 1}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
              >
                <ChevronRight className="w-4 h-4 shrink-0" />
                <span>السابق</span>
              </button>

              <span className="text-xs font-bold text-[var(--theme-text)] tabular-nums px-1.5">
                صفحة {safePage} من {totalPages}
              </span>

              <button
                type="button"
                onClick={() => onPageChange(safePage + 1)}
                disabled={safePage >= totalPages}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataTableShell;
