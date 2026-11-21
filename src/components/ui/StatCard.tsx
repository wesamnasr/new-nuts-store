'use client';

import React, { type JSX } from 'react';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: { label: string; tone?: 'positive' | 'negative' | 'warning' | 'neutral' };
  tone?: 'default' | 'emerald' | 'amber' | 'rose' | 'accent';
  onClick?: () => void;
  className?: string;
}

const TONE_SURFACE_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-[var(--theme-surface)] border-[var(--theme-border)]',
  emerald: 'bg-[var(--theme-surface)] border-emerald-500/30',
  amber: 'bg-[var(--theme-surface)] border-amber-500/35',
  rose: 'bg-[var(--theme-surface)] border-rose-500/35',
  accent: 'bg-[var(--theme-surface)] border-[rgb(var(--gold-500)/0.4)]',
};

const TONE_ICON_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-[var(--theme-surface-muted)] text-[var(--theme-text)]',
  emerald: 'bg-emerald-500/15 text-emerald-700 ds-tone-positive',
  amber: 'bg-amber-500/15 text-amber-800 ds-tone-warning',
  rose: 'bg-rose-500/15 text-rose-700 ds-tone-negative',
  accent: 'bg-[rgb(var(--gold-500)/0.15)] text-[var(--theme-accent)]',
};

const TREND_TONE_CLASSES: Record<NonNullable<NonNullable<StatCardProps['trend']>['tone']>, string> = {
  positive: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 ds-tone-positive',
  negative: 'bg-rose-500/15 text-rose-700 border-rose-500/25 ds-tone-negative',
  warning: 'bg-amber-500/15 text-amber-800 border-amber-500/30 ds-tone-warning',
  neutral: 'bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)] border-[var(--theme-border)]',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  tone = 'default',
  onClick,
  className = '',
}: StatCardProps): JSX.Element {
  const baseClasses = [
    'rounded-2xl border p-4 text-right transition-all duration-150',
    'text-[var(--theme-text)] shadow-sm',
    TONE_SURFACE_CLASSES[tone],
    onClick
      ? 'w-full min-h-[44px] cursor-pointer hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500)/0.5)]'
      : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="text-xs font-bold text-[var(--theme-text-muted)] leading-snug">
          {title}
        </div>
        <div className="text-xl sm:text-2xl font-black text-[var(--theme-text)] tabular-nums leading-tight break-words">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {trend && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold tabular-nums ${
                  TREND_TONE_CLASSES[trend.tone ?? 'neutral']
                }`}
              >
                {trend.label}
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-[var(--theme-text-muted)] leading-snug">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
      {icon && (
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TONE_ICON_CLASSES[tone]}`}
        >
          {icon}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

export default StatCard;
