'use client';

import React, { useMemo, useState } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  Wallet,
  Smartphone,
  Banknote,
  Calculator,
} from 'lucide-react';
import { PartnerWithdrawal } from '@/types/store';
import { DEFAULT_PARTNERS } from '@/lib/defaults';
import { escapeCsvField } from '@/lib/csv';

interface PartnersAndChannelsPanelProps {
  totalRevenue: number;
  totalCogs: number;
  operatingExpenses: number;
  netOperatingProfit: number;
  expectedCash: number;
  expectedVodafone: number;
  expectedInstapay: number;
  partnerWithdrawals: PartnerWithdrawal[];
  partners?: Array<{ id: string; name: string; sharePercent: number }>;
  currency?: string;
}

const fmtDec = (val: number) =>
  Number(Number.isFinite(val) ? val : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PartnersAndChannelsPanel({
  totalRevenue,
  totalCogs,
  operatingExpenses,
  netOperatingProfit,
  expectedCash,
  expectedVodafone,
  expectedInstapay,
  partnerWithdrawals,
  partners = DEFAULT_PARTNERS,
  currency = 'ج.م',
}: PartnersAndChannelsPanelProps) {
  const [actualCash, setActualCash] = useState<string>(String(Math.round(expectedCash * 100) / 100));
  const [actualVodafone, setActualVodafone] = useState<string>(
    String(Math.round(expectedVodafone * 100) / 100)
  );
  const [actualInstapay, setActualInstapay] = useState<string>(
    String(Math.round(expectedInstapay * 100) / 100)
  );

  const channels = useMemo(() => {
    const rows = [
      {
        id: 'cash',
        label: 'نقدية الدرج والخزينة',
        icon: Banknote,
        expected: Math.round(expectedCash * 100) / 100,
        actual: parseFloat(actualCash) || 0,
        onChange: setActualCash,
      },
      {
        id: 'vodafone',
        label: 'محفظة فودافون كاش',
        icon: Smartphone,
        expected: Math.round(expectedVodafone * 100) / 100,
        actual: parseFloat(actualVodafone) || 0,
        onChange: setActualVodafone,
      },
      {
        id: 'instapay',
        label: 'حساب إنستا باي',
        icon: Wallet,
        expected: Math.round(expectedInstapay * 100) / 100,
        actual: parseFloat(actualInstapay) || 0,
        onChange: setActualInstapay,
      },
    ];
    return rows.map((r) => ({
      ...r,
      diff: Math.round((r.actual - r.expected) * 100) / 100,
    }));
  }, [expectedCash, expectedVodafone, expectedInstapay, actualCash, actualVodafone, actualInstapay]);

  const partnerCards = useMemo(() => {
    const distributable = Math.max(0, netOperatingProfit);
    return partners.map((pt) => {
      const sharePct = pt.sharePercent || 25;
      const grossShare = Math.round(((distributable * sharePct) / 100) * 100) / 100;
      const personalRows = partnerWithdrawals.filter((w) => w.partnerId === pt.id);
      const withdrawalsTotal =
        Math.round(personalRows.reduce((s, w) => s + (Number(w.totalCostEgp) || 0), 0) * 100) /
        100;
      const netPayable = Math.round((grossShare - withdrawalsTotal) * 100) / 100;
      return {
        ...pt,
        sharePct,
        grossShare,
        withdrawalsCount: personalRows.length,
        withdrawalsTotal,
        netPayable,
      };
    });
  }, [partners, netOperatingProfit, partnerWithdrawals]);

  const handleExportPartnersCsv = () => {
    const headers = [
      'الشريك',
      'نسبة الحصة %',
      'إجمالي النصيب من صافي الربح',
      'عدد المسحوبات بالتكلفة',
      'قيمة المسحوبات بالتكلفة',
      'صافي المستحق للصرف',
    ];
    const rows = partnerCards.map((p) => [
      p.name,
      `${p.sharePct}%`,
      p.grossShare.toFixed(2),
      String(p.withdrawalsCount),
      p.withdrawalsTotal.toFixed(2),
      p.netPayable.toFixed(2),
    ]);
    const csv =
      '\uFEFF' +
      [
        ['ملخص معادلة صافي الربح القابل للتوزيع'],
        ['إجمالي المبيعات', totalRevenue.toFixed(2)],
        ['تكلفة البضاعة والتغليف', totalCogs.toFixed(2)],
        ['المصروفات التشغيلية', operatingExpenses.toFixed(2)],
        ['صافي الربح القابل للتوزيع', netOperatingProfit.toFixed(2)],
        [],
        headers,
        ...rows,
      ]
        .map((r) => r.map((c) => escapeCsvField(c)).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hafsa-partners-25pct-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* 1. 3-Channel Financial Reconciliation (Cash / Vodafone Cash / InstaPay) */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E0D5] pb-3">
          <div>
            <h3 className="font-cairo font-bold text-base text-[#231710] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#9A6836]" />
              <span>مطابقة القنوات المالية الثلاثة (التقفيل اليومي)</span>
            </h3>
            <p className="text-xs text-[#6B5A4E]">
              مقارنة المتوقع المسجل بالنظام مقابل الجرد الفعلي للنقدية وكشوف فودافون كاش وإنستاباي
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActualCash(String(Math.round(expectedCash * 100) / 100));
              setActualVodafone(String(Math.round(expectedVodafone * 100) / 100));
              setActualInstapay(String(Math.round(expectedInstapay * 100) / 100));
            }}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#E8E0D5] text-xs font-bold text-[#231710] cursor-pointer"
          >
            مطابقة بالمتوقع
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 tabular-nums">
          {channels.map((ch) => {
            const Icon = ch.icon;
            const isMatch = Math.abs(ch.diff) < 0.01;
            const isShort = ch.diff < -0.01;
            return (
              <div
                key={ch.id}
                className="rounded-2xl bg-[#FAF6F0] border border-[#E8E0D5] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-[#9A6836]" />
                    <span>{ch.label}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs bg-white rounded-xl px-3 py-2 border border-[#E8E0D5]">
                  <span className="text-[#6B5A4E]">المتوقع بالنظام:</span>
                  <strong className="text-[#231710] font-black">
                    {fmtDec(ch.expected)} {currency}
                  </strong>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6B5A4E] mb-1">
                    الرصيد الفعلي المعدود / بالكشف:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={ch.actual}
                    onChange={(e) => ch.onChange(e.target.value)}
                    className="w-full min-h-[40px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-1.5 text-sm font-black text-[#231710] outline-none"
                  />
                </div>

                {/* 3-Signal Status Badge: Color + Icon + Explicit Arabic Text */}
                <div
                  className={`rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between border ${
                    isMatch
                      ? 'bg-[#166534] text-white border-[#166534]'
                      : isShort
                        ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                        : 'bg-[#B45309] text-white border-[#B45309]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isMatch ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{isMatch ? 'مطابق تماماً' : isShort ? 'عجز فعلي' : 'فائض / زيادة'}</span>
                  </span>
                  <span className="font-black">
                    {ch.diff > 0 ? `+${fmtDec(ch.diff)}` : fmtDec(ch.diff)} {currency}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Net Profit Equation & 4-Partner 25% Distribution Dashboard */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E0D5] pb-3">
          <div>
            <h3 className="font-cairo font-bold text-base text-[#231710] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9A6836]" />
              <span>لوحة صافي الربح وتوزيع حصص الشركاء الأربعة (25% لكل شريك)</span>
            </h3>
            <p className="text-xs text-[#6B5A4E]">
              صافي الربح القابل للتوزيع مطروحاً منه المسحوبات الشخصية لكل شريك بسعر التكلفة
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportPartnersCsv}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" />
            <span>تصدير تقرير إكسيل شامل</span>
          </button>
        </div>

        {/* Transparent Step-by-Step Equation Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
          <div className="rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] p-3">
            <span className="text-[11px] font-bold text-[#6B5A4E] block">١. صافي المبيعات</span>
            <strong className="font-cairo text-lg font-black text-[#231710]">
              {fmtDec(totalRevenue)} {currency}
            </strong>
          </div>
          <div className="rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] p-3">
            <span className="text-[11px] font-bold text-[#6B5A4E] block">(−) تكلفة البضاعة والتغليف</span>
            <strong className="font-cairo text-lg font-black text-[#9A6836]">
              −{fmtDec(totalCogs)} {currency}
            </strong>
          </div>
          <div className="rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] p-3">
            <span className="text-[11px] font-bold text-[#6B5A4E] block">(−) المصاريف والتشغيل</span>
            <strong className="font-cairo text-lg font-black text-[#B91C1C]">
              −{fmtDec(operatingExpenses)} {currency}
            </strong>
          </div>
          <div className="rounded-xl bg-[#231710] text-[#FAF6F0] border border-[#231710] p-3">
            <span className="text-[11px] font-bold text-[#D4AF37] block">
              (=) صافي الربح القابل للتوزيع
            </span>
            <strong className="font-cairo text-lg font-black text-white">
              {fmtDec(netOperatingProfit)} {currency}
            </strong>
          </div>
        </div>

        {/* 4 Partner Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 tabular-nums">
          {partnerCards.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-[#FAF6F0] border border-[#E8E0D5] p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-cairo font-bold text-sm text-[#231710]">{p.name}</h4>
                  <span className="text-[11px] font-black bg-[#D4AF37] text-[#231710] px-2 py-0.5 rounded-full">
                    {p.sharePct}%
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#6B5A4E]">
                    <span>نصيب الـ {p.sharePct}%:</span>
                    <strong className="text-[#231710]">
                      {fmtDec(p.grossShare)} {currency}
                    </strong>
                  </div>
                  <div className="flex justify-between text-[#6B5A4E]">
                    <span>مسحوبات بالتكلفة ({p.withdrawalsCount}):</span>
                    <strong className="text-[#B91C1C]">
                      −{fmtDec(p.withdrawalsTotal)} {currency}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#E8E0D5] flex items-center justify-between">
                <span className="text-xs font-bold text-[#231710]">صافي المستحق:</span>
                <span
                  className={`font-cairo font-black text-base ${
                    p.netPayable >= 0 ? 'text-[#166534]' : 'text-[#B91C1C]'
                  }`}
                >
                  {fmtDec(p.netPayable)} {currency}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Partner Withdrawals Ledger */}
        {partnerWithdrawals.length > 0 && (
          <div className="pt-2 space-y-2">
            <h4 className="font-cairo font-bold text-xs text-[#231710]">
              سجل مسحوبات الشركاء بالتكلفة ({partnerWithdrawals.length})
            </h4>
            <div className="overflow-x-auto max-h-64 rounded-xl border border-[#E8E0D5]">
              <table className="w-full text-right text-xs tabular-nums">
                <thead className="sticky top-0 bg-[#FAF6F0] border-b border-[#E8E0D5] text-[#231710] font-bold">
                  <tr>
                    <th className="py-2 px-3">رقم السند</th>
                    <th className="py-2 px-3">الشريك</th>
                    <th className="py-2 px-3">الصنف</th>
                    <th className="py-2 px-3">الكمية</th>
                    <th className="py-2 px-3">قيمة التكلفة</th>
                    <th className="py-2 px-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E9DF] bg-white">
                  {partnerWithdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-[#FAF6F0]/60">
                      <td className="py-2 px-3 font-mono font-bold">{w.withdrawalNumber}</td>
                      <td className="py-2 px-3 font-bold text-[#231710]">{w.partnerName}</td>
                      <td className="py-2 px-3">{w.productName}</td>
                      <td className="py-2 px-3">
                        {w.quantityKgOrUnits} {w.unitLabel}
                      </td>
                      <td className="py-2 px-3 font-bold text-[#B91C1C]">
                        −{fmtDec(w.totalCostEgp)} {currency}
                      </td>
                      <td className="py-2 px-3 text-[#6B5A4E]">
                        {new Date(w.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
