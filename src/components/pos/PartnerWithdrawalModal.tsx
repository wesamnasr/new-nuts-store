'use client';

import React, { useState, useMemo } from 'react';
import { X, Users, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';
import { Product } from '@/types/store';
import { getProductStockUnitLabel, isUnitProduct } from '@/lib/pricing';
import { DEFAULT_PARTNERS } from '@/lib/defaults';

interface PartnerWithdrawalModalProps {
  isOpen: boolean;
  products: Product[];
  partners?: Array<{ id: string; name: string; sharePercent: number }>;
  currencySymbol?: string;
  onClose: () => void;
  onSubmitWithdrawal: (payload: {
    partnerId: string;
    partnerName: string;
    productId: string;
    quantityKgOrUnits: number;
    notes: string;
    managerPin: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export default function PartnerWithdrawalModal({
  isOpen,
  products,
  partners = DEFAULT_PARTNERS,
  currencySymbol = 'ج.م',
  onClose,
  onSubmitWithdrawal,
}: PartnerWithdrawalModalProps) {
  const [partnerId, setPartnerId] = useState(partners[0]?.id || 'partner-1');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [qtyInput, setQtyInput] = useState<string>('0.5');
  const [notes, setNotes] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || products[0],
    [products, productId]
  );
  const isUnit = isUnitProduct(selectedProduct);
  const unitLabel = getProductStockUnitLabel(selectedProduct);
  const parsedQty = Math.max(0, parseFloat(qtyInput) || 0);
  const unitCost =
    typeof selectedProduct?.costPerKg === 'number' && selectedProduct.costPerKg > 0
      ? selectedProduct.costPerKg
      : selectedProduct?.pricePerKg
        ? Math.round(selectedProduct.pricePerKg * 0.68)
        : 200;
  const totalCost = Math.round(parsedQty * unitCost * 100) / 100;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || parsedQty <= 0) {
      setErr('يرجى إدخال كمية مسحوبة أكبر من صفر');
      return;
    }
    if (pin.trim().length < 4) {
      setErr('يرجى إدخال كود المدير السري (4 أرقام على الأقل)');
      return;
    }
    setBusy(true);
    setErr(null);
    const partnerObj = partners.find((p) => p.id === partnerId) || partners[0];
    const res = await onSubmitWithdrawal({
      partnerId: partnerObj.id,
      partnerName: partnerObj.name,
      productId: selectedProduct.id,
      quantityKgOrUnits: parsedQty,
      notes: notes.trim(),
      managerPin: pin.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'تعذر تسجيل مسحوب الشريك');
      return;
    }
    setPin('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-md rounded-2xl border border-[#E8E0D5] shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between border-b border-[#E8E0D5] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center text-[#9A6836]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cairo font-bold text-sm text-[#231710]">
                تسجيل مسحوبات الشركاء (بسعر التكلفة)
              </h3>
              <p className="text-[11px] text-[#6B5B4E]">
                تُخصم من المخزون فوراً ومن نصيب الشريك في توزيع الـ 25% عند المحاسب
              </p>
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

        {err && (
          <div className="bg-red-50 border border-red-200 text-[#B91C1C] rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {/* Partner Selector */}
        <div>
          <label className="block text-xs font-bold text-[#231710] mb-1.5">
            اختر الشريك:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {partners.map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() => setPartnerId(pt.id)}
                className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold border text-right transition cursor-pointer ${
                  partnerId === pt.id
                    ? 'bg-[#231710] text-white border-[#231710]'
                    : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#F3ECE1]'
                }`}
              >
                {pt.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Selector */}
        <div>
          <label className="block text-xs font-bold text-[#231710] mb-1">
            الصنف المسحوب:
          </label>
          <select
            value={selectedProduct?.id || ''}
            onChange={(e) => {
              const nextId = e.target.value;
              setProductId(nextId);
              const p = products.find((x) => x.id === nextId);
              setQtyInput(isUnitProduct(p) ? '1' : '0.5');
            }}
            className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (متاح: {p.stockKg ?? 0} {getProductStockUnitLabel(p)})
              </option>
            ))}
          </select>
        </div>

        {/* Quantity + Quick Presets */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[#231710]">
            الكمية المسحوبة ({unitLabel}):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.05"
              step={isUnit ? '1' : '0.05'}
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              className="flex-1 min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-sm font-black text-center tabular-nums outline-none"
            />
            <span className="text-xs font-bold text-[#6B5B4E] shrink-0">{unitLabel}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(isUnit ? [1, 2, 3, 5] : [0.25, 0.5, 1, 2]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQtyInput(String(preset))}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#231710] hover:text-white border border-[#E8E0D5] text-xs font-bold tabular-nums cursor-pointer transition"
              >
                {preset} {unitLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Cost Preview */}
        <div className="bg-[#F3ECE1] border border-[#E8E0D5] rounded-xl p-3 flex items-center justify-between tabular-nums">
          <div className="text-xs text-[#6B5B4E]">
            سعر التكلفة: <strong className="text-[#231710]">{unitCost} {currencySymbol}/{unitLabel}</strong>
          </div>
          <div className="text-left">
            <span className="text-[11px] text-[#6B5B4E] block">القيمة المخصومة من حصة الشريك</span>
            <span className="font-cairo font-black text-lg text-[#9A6836]">
              {totalCost.toFixed(2)} {currencySymbol}
            </span>
          </div>
        </div>

        {/* Notes + Manager PIN */}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظة (مثال: ضيافة منزلية / مسحوب شخصي)..."
          className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs outline-none"
        />

        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#231710] mb-1">
            <Lock className="w-3.5 h-3.5 text-[#9A6836]" />
            <span>كود المدير السري (PIN) للاعتماد:</span>
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="••••"
            className="w-full min-h-[44px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-center text-base font-black tracking-widest outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={busy || parsedQty <= 0}
          className="w-full min-h-[52px] bg-[#231710] hover:bg-[#3A271C] disabled:opacity-40 text-white font-cairo font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{busy ? 'جارٍ التسجيل...' : 'اعتماد مسحوب الشريك وخصم المخزون'}</span>
        </button>
      </form>
    </div>
  );
}
