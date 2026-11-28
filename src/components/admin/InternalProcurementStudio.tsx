'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Scale,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Printer,
  Clock,
  Package,
  X,
} from 'lucide-react';
import { Order, Product, SupplyInvoice } from '@/types/store';
import { getProductStockUnitLabel, isUnitProduct } from '@/lib/pricing';
import { formatWhatsAppPhone } from '@/lib/validation';

interface DraftLine {
  productId: string;
  quantity: number;
  actualScaleQty: string;
  unitCost: number;
}

interface InternalProcurementStudioProps {
  products: Product[];
  orders?: Order[];
  supplyInvoices: SupplyInvoice[];
  storeName?: string;
  currency?: string;
  canCreate?: boolean;
  onCreated: () => void;
}

export default function InternalProcurementStudio({
  products,
  orders = [],
  supplyInvoices,
  storeName = 'محمصة حفصة للبن والمكسرات',
  currency = 'ج.م',
  canCreate = true,
  onCreated,
}: InternalProcurementStudioProps) {
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showTrafficMonitor, setShowTrafficMonitor] = useState(false);

  // Known suppliers from historical invoices
  const knownSuppliers = useMemo(() => {
    const names = new Set<string>(['عرفات لتجارة المكسرات والبن', 'مورد محمصة حفصة الرئيسي']);
    for (const inv of supplyInvoices) {
      if (inv.supplierName?.trim()) names.add(inv.supplierName.trim());
    }
    return Array.from(names);
  }, [supplyInvoices]);

  const [supplierName, setSupplierName] = useState(knownSuppliers[0] || '');
  const [newSupplierMode, setNewSupplierMode] = useState(false);
  const [supplierWhatsapp, setSupplierWhatsapp] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => {
    const first = products[0];
    return first
      ? [
          {
            productId: first.id,
            quantity: isUnitProduct(first) ? 10 : 5,
            actualScaleQty: '',
            unitCost:
              (isUnitProduct(first) ? first.unitCost : first.costPerKg) ??
              Math.round((first.pricePerKg || 300) * 0.65),
          },
        ]
      : [];
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Burn-rate (<4 days) & 10-day freshness traffic-light analysis
  const trafficRows = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const consumedMap = new Map<string, number>();

    for (const ord of orders) {
      if (ord.status === 'cancelled') continue;
      const t = new Date(ord.createdAt).getTime();
      if (Number.isNaN(t) || t < thirtyDaysAgo) continue;
      for (const it of ord.items || []) {
        const prod = products.find((p) => p.id === it.productId);
        if (!prod) continue;
        const unit = isUnitProduct(prod);
        const qty = unit
          ? it.quantity || 1
          : ((it.customWeightGrams || 250) * (it.quantity || 1)) / 1000;
        consumedMap.set(prod.id, (consumedMap.get(prod.id) || 0) + qty);
      }
    }

    return products.map((prod) => {
      const unit = isUnitProduct(prod);
      const unitLabel = getProductStockUnitLabel(prod);
      const stock = typeof prod.stockKg === 'number' ? Math.max(0, prod.stockKg) : 0;
      const consumed30d = consumedMap.get(prod.id) || 0;
      const dailyRate = consumed30d > 0 ? consumed30d / 30 : unit ? 1 : 0.75;
      const daysRemaining = dailyRate > 0 ? Math.round((stock / dailyRate) * 10) / 10 : 999;

      const stockStatus: 'critical' | 'warning' | 'safe' =
        stock <= 0 || daysRemaining < 4
          ? 'critical'
          : daysRemaining <= 7 || stock <= 5
            ? 'warning'
            : 'safe';

      const lastDateMs = prod.lastRestockedAt ? new Date(prod.lastRestockedAt).getTime() : NaN;
      const daysSinceRestock = Number.isNaN(lastDateMs)
        ? null
        : Math.max(0, Math.floor((now - lastDateMs) / (24 * 60 * 60 * 1000)));
      const freshnessStatus: 'rotate' | 'fresh' =
        daysSinceRestock !== null && daysSinceRestock >= 10 ? 'rotate' : 'fresh';

      const suggestedOrderQty = unit
        ? Math.max(5, Math.ceil(dailyRate * 14 - stock))
        : Math.max(5, Math.ceil((dailyRate * 14 - stock) * 2) / 2);

      return {
        prod,
        unitLabel,
        stock,
        daysRemaining,
        stockStatus,
        daysSinceRestock,
        freshnessStatus,
        suggestedOrderQty,
      };
    });
  }, [products, orders]);

  const criticalItems = useMemo(
    () => trafficRows.filter((r) => r.stockStatus === 'critical'),
    [trafficRows]
  );
  const warningItems = useMemo(
    () => trafficRows.filter((r) => r.stockStatus === 'warning'),
    [trafficRows]
  );
  const staleFreshnessItems = useMemo(
    () => trafficRows.filter((r) => r.freshnessStatus === 'rotate'),
    [trafficRows]
  );

  // Live variance & >5% price hike analysis for draft invoice lines
  const analyzedLines = useMemo(() => {
    return lines.map((ln) => {
      const prod = products.find((p) => p.id === ln.productId);
      const unit = isUnitProduct(prod);
      const unitLabel = getProductStockUnitLabel(prod);
      const prevCost =
        prod?.lastPurchaseCostPerKg ??
        (unit ? prod?.unitCost ?? prod?.costPerKg : prod?.costPerKg) ??
        0;
      const priceChangePct =
        prevCost > 0 && ln.unitCost > 0
          ? Math.round(((ln.unitCost - prevCost) / prevCost) * 1000) / 10
          : 0;
      const parsedScale = ln.actualScaleQty.trim() !== '' ? Number(ln.actualScaleQty) : null;
      const variance =
        parsedScale !== null && Number.isFinite(parsedScale)
          ? Math.round((parsedScale - ln.quantity) * 1000) / 1000
          : null;
      const effectiveQty = parsedScale !== null && Number.isFinite(parsedScale) ? parsedScale : ln.quantity;
      const lineTotal = Math.round(effectiveQty * ln.unitCost * 100) / 100;
      return {
        ...ln,
        prod,
        unit,
        unitLabel,
        prevCost,
        priceChangePct,
        isPriceHikeOver5: priceChangePct > 5,
        variance,
        lineTotal,
      };
    });
  }, [lines, products]);

  const draftGrandTotal = analyzedLines.reduce((s, r) => s + r.lineTotal, 0);
  const priceHikeLines = analyzedLines.filter((r) => r.isPriceHikeOver5);

  const handleSubmitInternalReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || analyzedLines.length === 0) {
      setFeedback({ type: 'error', text: 'يرجى تحديد اسم المورد وإضافة صنف واحد على الأقل' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const token =
        typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') || '' : '';
      const res = await fetch('/api/supply-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplierName: supplierName.trim(),
          supplierId: supplierName.trim().toLowerCase().replace(/\s+/g, '-'),
          autoApprove,
          notes: notes.trim(),
          items: analyzedLines.map((ln) => ({
            productId: ln.productId,
            productName: ln.prod?.name,
            sellingMode: ln.unit ? 'unit' : 'weight',
            unitLabel: ln.unitLabel,
            quantityKg: ln.quantity,
            unitsCount: ln.unit ? ln.quantity : undefined,
            actualScaleQty: ln.actualScaleQty.trim() !== '' ? Number(ln.actualScaleQty) : undefined,
            costPerKg: ln.unitCost,
            unitCost: ln.unit ? ln.unitCost : undefined,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'تعذر حفظ فاتورة التوريد' });
        return;
      }
      const hikeWarn =
        Array.isArray(data.priceHikeAlerts) && data.priceHikeAlerts.length > 0
          ? ` — تنبيه ارتفاع سعر شراء >5% في ${data.priceHikeAlerts.length} صنف!`
          : '';
      setFeedback({
        type: 'success',
        text: `${data.message || 'تم تسجيل فاتورة التوريد بنجاح'}${hikeWarn}`,
      });
      setNotes('');
      setShowReceiptForm(false);
      onCreated();
    } catch {
      setFeedback({ type: 'error', text: 'تعذر الاتصال بالخادم أثناء تسجيل فاتورة التوريد' });
    } finally {
      setSubmitting(false);
    }
  };

  const buildShortagePoText = () => {
    const shortageList = [...criticalItems, ...warningItems];
    if (shortageList.length === 0) return '';
    const dateStr = new Date().toLocaleDateString('ar-EG');
    const header = `أمر توريد أصناف ناقصة — ${storeName}\nالتاريخ: ${dateStr}\n------------------------`;
    const body = shortageList
      .map(
        (r, i) =>
          `${i + 1}. ${r.prod.name}: مطلوب ${r.suggestedOrderQty} ${r.unitLabel} (الرصيد الحالي: ${r.stock} ${r.unitLabel})`
      )
      .join('\n');
    return `${header}\n${body}\n------------------------\nيرجى تأكيد التوريد وموعد التسليم.`;
  };

  const handleOpenWhatsAppPo = () => {
    const text = buildShortagePoText();
    if (!text) return;
    const phone = supplierWhatsapp.trim() ? formatWhatsAppPhone(supplierWhatsapp.trim()) : '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePrintShortagePo = () => {
    const text = buildShortagePoText();
    if (!text) return;
    const win = window.open('', '_blank', 'width=720,height=680');
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>أمر توريد نواقص</title><style>body{font-family:Cairo,Tahoma,sans-serif;padding:24px;white-space:pre-wrap;line-height:1.8;color:#231710}</style></head><body>${text}</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 200);
  };

  return (
    <div className="space-y-3">
      {/* Quick Action Bar for Internal Procurement Officer (No External Supplier Login) */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] p-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B91C1C] text-white font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>نواقص حرجة (&lt;4 أيام): {criticalItems.length}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B45309] text-white font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>قرب حد الطلب: {warningItems.length}</span>
          </span>
          {staleFreshnessItems.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-bold">
              <Package className="w-3.5 h-3.5 text-[#B45309]" />
              <span>تحتاج تدوير طزاجة (≥10 أيام): {staleFreshnessItems.length}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTrafficMonitor((v) => !v)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Package className="w-3.5 h-3.5 text-[#9A6836]" />
            <span>
              {showTrafficMonitor
                ? 'إخفاء إشارات المخزون والطزاجة'
                : 'إشارات المرور وأمر التوريد بالواتساب'}
            </span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setShowReceiptForm((v) => !v);
                setFeedback(null);
              }}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#c5a02d] text-[#231710] border border-[#B89220] text-xs font-cairo font-extrabold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>إدخال واستلام فاتورة توريد داخلية</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold border flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-[#166534]'
              : 'bg-red-50 border-red-200 text-[#B91C1C]'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* A. Internal 1-Step Supply Invoice Receipt Form (Scale Variance + >5% Hike Alert) */}
      {showReceiptForm && canCreate && (
        <form
          onSubmit={handleSubmitInternalReceipt}
          className="bg-white rounded-2xl border-2 border-[#C88A4B]/50 p-4 sm:p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
            <div>
              <h3 className="font-cairo font-bold text-sm sm:text-base text-[#231710] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#9A6836]" />
                <span>إدخال واستلام فاتورة توريد داخلية (مع مطابقة الميزان وتنبيه الأسعار)</span>
              </h3>
              <p className="text-[11px] text-[#6B5B4E]">
                لا حاجة لدخول المورد — مسؤول التوريدات يسجل الفاتورة ويطابق الوزن الفعلي على ميزان المحمصة فوراً
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReceiptForm(false)}
              className="w-8 h-8 rounded-lg bg-[#FAF6F0] hover:bg-red-50 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#231710]">اسم المورد:</label>
                <button
                  type="button"
                  onClick={() => {
                    setNewSupplierMode((v) => !v);
                    if (!newSupplierMode) setSupplierName('');
                    else setSupplierName(knownSuppliers[0] || '');
                  }}
                  className="text-[11px] font-bold text-[#9A6836] hover:underline cursor-pointer"
                >
                  {newSupplierMode ? 'اختيار من المسجلين' : '+ إضافة مورد جديد'}
                </button>
              </div>
              {newSupplierMode ? (
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="اكتب اسم المورد الجديد..."
                  className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                />
              ) : (
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                >
                  {knownSuppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1">
                ملاحظات الاستلام (اختياري):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="رقم فاتورة المورد أو ملاحظة الوزن..."
                className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs outline-none"
              />
            </div>

            <div className="flex items-end">
              <label className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-bold text-[#231710] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="accent-[#166534] w-4 h-4"
                />
                <span>اعتماد فوري بالمخزون وتحديث تاريخ الطزاجة</span>
              </label>
            </div>
          </div>

          {/* Lines Table with Actual Scale Weight & >5% Hike Alert */}
          <div className="space-y-2">
            {analyzedLines.map((ln, idx) => (
              <div
                key={idx}
                className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 space-y-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-[#6B5B4E] mb-1">الصنف:</label>
                    <select
                      value={ln.productId}
                      onChange={(e) => {
                        const p = products.find((x) => x.id === e.target.value);
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  productId: e.target.value,
                                  unitCost:
                                    (isUnitProduct(p) ? p?.unitCost : p?.costPerKg) ??
                                    Math.round((p?.pricePerKg || 300) * 0.65),
                                }
                              : row
                          )
                        );
                      }}
                      className="w-full min-h-[38px] bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({getProductStockUnitLabel(p)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#6B5B4E] mb-1">
                      كمية الفاتورة ({ln.unitLabel}):
                    </label>
                    <input
                      type="number"
                      step={ln.unit ? '1' : '0.1'}
                      min="0.1"
                      value={ln.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, quantity: Math.max(0, Number(e.target.value) || 0) } : r
                          )
                        )
                      }
                      className="w-full min-h-[38px] bg-white border border-[#E8E0D5] rounded-lg px-2 py-1.5 text-xs font-bold tabular-nums outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#9A6836] mb-1">
                      الوزن الفعلي بالميزان:
                    </label>
                    <input
                      type="number"
                      step={ln.unit ? '1' : '0.05'}
                      min="0"
                      value={ln.actualScaleQty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, actualScaleQty: e.target.value } : r
                          )
                        )
                      }
                      placeholder={String(ln.quantity)}
                      className="w-full min-h-[38px] bg-white border border-[#C88A4B]/70 rounded-lg px-2 py-1.5 text-xs font-bold tabular-nums outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#6B5B4E] mb-1">
                      سعر الشراء ({currency}/{ln.unitLabel}):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={ln.unitCost}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, unitCost: Math.max(0, Number(e.target.value) || 0) } : r
                          )
                        )
                      }
                      className="w-full min-h-[38px] bg-white border border-[#E8E0D5] rounded-lg px-2 py-1.5 text-xs font-bold tabular-nums outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-[#231710] tabular-nums">
                      {ln.lineTotal.toFixed(2)} {currency}
                    </span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-2 rounded-lg text-[#B91C1C] hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Weight Variance + >5% Price Hike Warning Badges */}
                {(ln.variance !== null || ln.isPriceHikeOver5) && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    {ln.variance !== null && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                          Math.abs(ln.variance) < 0.001
                            ? 'bg-[#166534] text-white'
                            : ln.variance < 0
                              ? 'bg-[#B91C1C] text-white'
                              : 'bg-[#B45309] text-white'
                        }`}
                      >
                        {Math.abs(ln.variance) < 0.001 ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {Math.abs(ln.variance) < 0.001
                            ? 'وزن الميزان مطابق للفاتورة 100%'
                            : ln.variance < 0
                              ? `عجز وزن عن فاتورة المورد: ${ln.variance} ${ln.unitLabel}`
                              : `زيادة وزن عن الفاتورة: +${ln.variance} ${ln.unitLabel}`}
                        </span>
                      </span>
                    )}

                    {ln.isPriceHikeOver5 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B45309] text-white">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          تنبيه ارتفاع سعر الشراء +{ln.priceChangePct}% عن آخر توريد ({ln.prevCost} ←{' '}
                          {ln.unitCost} {currency}) — راجع سعر البيع!
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {priceHikeLines.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-3.5 py-2.5 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" />
              <span>
                تنبيه هامش الربح: يوجد {priceHikeLines.length} أصناف ارتفع سعر شرائها بأكثر من 5% عن آخر توريد — يُرجى مراجعة أسعار بيعها للحفاظ على هامش 18%.
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E8E0D5]">
            <button
              type="button"
              onClick={() => {
                const nextProd = products[lines.length % products.length] || products[0];
                if (!nextProd) return;
                setLines((prev) => [
                  ...prev,
                  {
                    productId: nextProd.id,
                    quantity: isUnitProduct(nextProd) ? 10 : 5,
                    actualScaleQty: '',
                    unitCost:
                      (isUnitProduct(nextProd) ? nextProd.unitCost : nextProd.costPerKg) ??
                      Math.round((nextProd.pricePerKg || 300) * 0.65),
                  },
                ]);
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#E8E0D5] text-xs font-bold text-[#231710] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صنف آخر للفاتورة</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="text-left tabular-nums">
                <span className="text-[11px] text-[#6B5B4E] block">الإجمالي الفعلي</span>
                <strong className="font-cairo text-lg font-black text-[#231710]">
                  {draftGrandTotal.toFixed(2)} {currency}
                </strong>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#166534] hover:bg-[#14532d] disabled:opacity-50 text-white font-cairo font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'جارٍ الحفظ...' : 'حفظ فاتورة التوريد'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* B. Traffic-Light Inventory (<4 days) & 10-Day Freshness + 1-Click WhatsApp Shortage PO */}
      {showTrafficMonitor && (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E0D5] pb-3">
            <div>
              <h3 className="font-cairo font-bold text-sm sm:text-base text-[#231710]">
                نظام إشارات المرور للمخزون والطزاجة + أمر توريد النواقص عبر واتساب
              </h3>
              <p className="text-[11px] text-[#6B5B4E]">
                مراقبة أيام التغطية لكل صنف وتاريخ آخر تعبئة (10 أيام للتدوير) وتجهيز أمر توريد فوري للمورد
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="tel"
                value={supplierWhatsapp}
                onChange={(e) => setSupplierWhatsapp(e.target.value)}
                placeholder="رقم واتساب المورد (اختياري)..."
                className="min-h-[38px] w-44 bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs font-bold tabular-nums outline-none"
              />
              <button
                type="button"
                disabled={criticalItems.length + warningItems.length === 0}
                onClick={handleOpenWhatsAppPo}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#166534] hover:bg-[#14532d] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  أمر توريد للنواقص واتساب ({criticalItems.length + warningItems.length})
                </span>
              </button>
              <button
                type="button"
                disabled={criticalItems.length + warningItems.length === 0}
                onClick={handlePrintShortagePo}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F3ECE1] disabled:opacity-40 text-[#231710] border border-[#E8E0D5] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة أمر التوريد</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 rounded-xl border border-[#E8E0D5]">
            <table className="w-full text-right text-xs tabular-nums">
              <thead className="sticky top-0 bg-[#FAF6F0] border-b border-[#E8E0D5] font-bold text-[#231710]">
                <tr>
                  <th className="py-2.5 px-3">الصنف</th>
                  <th className="py-2.5 px-3">الرصيد الحالي</th>
                  <th className="py-2.5 px-3">حالة الكمية (إشارة المرور)</th>
                  <th className="py-2.5 px-3">حالة الطزاجة (10 أيام)</th>
                  <th className="py-2.5 px-3">الكمية المقترحة للطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DF] bg-white">
                {trafficRows
                  .sort((a, b) => a.daysRemaining - b.daysRemaining)
                  .map((r) => (
                    <tr key={r.prod.id} className="hover:bg-[#FAF6F0]/60">
                      <td className="py-2 px-3 font-bold text-[#231710]">{r.prod.name}</td>
                      <td className="py-2 px-3 font-bold">
                        {r.stock} {r.unitLabel}
                      </td>
                      <td className="py-2 px-3">
                        {r.stockStatus === 'critical' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#B91C1C] text-white text-[11px] font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            <span>ينفد خلال أقل من 4 أيام — اطلب الآن</span>
                          </span>
                        ) : r.stockStatus === 'warning' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#B45309] text-white text-[11px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>قرب حد الطلب</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#166534] text-white text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>رصيد آمن</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {r.freshnessStatus === 'rotate' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#B45309] text-white text-[11px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>مر {r.daysSinceRestock} أيام على التعبئة — يُنصح بالتدوير</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#166534] border border-emerald-200 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>
                              طازج
                              {r.daysSinceRestock !== null ? ` (${r.daysSinceRestock} يوم)` : ''}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-black text-[#9A6836]">
                        {r.stockStatus !== 'safe'
                          ? `${r.suggestedOrderQty} ${r.unitLabel}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
