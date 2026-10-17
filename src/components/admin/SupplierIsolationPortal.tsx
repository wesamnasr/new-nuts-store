'use client';

import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Layers,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { Category, Product } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';

interface SupplierIsolationPortalProps {
  products: Product[];
  categories: Category[];
  saving: boolean;
  onUpdateStorePayload: (
    payload: Record<string, unknown>,
    successMsg: string
  ) => Promise<void>;
}

interface SupplyDraftRow {
  costPerKg: number;
  packagingCost: number;
  origin: string;
  inStock: boolean;
}

export default function SupplierIsolationPortal({
  products,
  categories,
  saving,
  onUpdateStorePayload,
}: SupplierIsolationPortalProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [drafts, setDrafts] = useState<Record<string, SupplyDraftRow>>({});

  const getRowValues = (prod: Product): SupplyDraftRow => {
    if (drafts[prod.id]) return drafts[prod.id];
    const fallbackKiloPrice =
      prod.pricePerKg ?? prod.weights.find((w) => w.grams === 1000)?.price ?? 400;
    return {
      costPerKg: prod.costPerKg ?? Math.round(fallbackKiloPrice * 0.68),
      packagingCost: prod.packagingCost ?? 0,
      origin: prod.origin || 'محمصة حفصة',
      inStock: prod.inStock,
    };
  };

  const handleFieldChange = (
    prod: Product,
    field: keyof SupplyDraftRow,
    value: number | string | boolean
  ) => {
    const current = getRowValues(prod);
    setDrafts((prev) => ({
      ...prev,
      [prod.id]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const row = drafts[p.id];
      const currentInStock = row ? row.inStock : p.inStock;
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (stockFilter === 'in' && !currentInStock) return false;
      if (stockFilter === 'out' && currentInStock) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, drafts, categoryFilter, stockFilter, search]);

  const inStockCount = useMemo(
    () => products.filter((p) => (drafts[p.id] ? drafts[p.id].inStock : p.inStock)).length,
    [products, drafts]
  );
  const outOfStockCount = products.length - inStockCount;

  const avgSupplyCost = useMemo(() => {
    if (products.length === 0) return 0;
    const sum = products.reduce((acc, p) => {
      const row = drafts[p.id];
      const c =
        row?.costPerKg ??
        p.costPerKg ??
        Math.round((p.pricePerKg ?? p.weights[0]?.price ?? 400) * 0.68);
      return acc + c;
    }, 0);
    return Math.round(sum / products.length);
  }, [products, drafts]);

  const handleSaveSingleProductSupply = async (prod: Product) => {
    const row = getRowValues(prod);
    const updatedProducts = products.map((p) =>
      p.id === prod.id
        ? {
            ...p,
            costPerKg: Math.max(0, Number(row.costPerKg) || 0),
            packagingCost: Math.max(0, Number(row.packagingCost) || 0),
            origin: String(row.origin || p.origin).trim(),
            inStock: Boolean(row.inStock),
          }
        : p
    );
    await onUpdateStorePayload(
      { products: updatedProducts },
      `📦 تم تحديث بيانات توريد ومخزون "${prod.name}" بنجاح`
    );
  };

  const handleSaveAllSupplyChanges = async () => {
    const updatedProducts = products.map((p) => {
      const row = drafts[p.id];
      if (!row) return p;
      return {
        ...p,
        costPerKg: Math.max(0, Number(row.costPerKg) || 0),
        packagingCost: Math.max(0, Number(row.packagingCost) || 0),
        origin: String(row.origin || p.origin).trim(),
        inStock: Boolean(row.inStock),
      };
    });
    await onUpdateStorePayload(
      { products: updatedProducts },
      '📦 تم حفظ كافة تحديثات شيت التوريد وحالة المخزون بنجاح ✅'
    );
    setDrafts({});
  };

  const modifiedCount = Object.keys(drafts).length;

  return (
    <div className="space-y-4">
      {/* Role Isolation Security Notice */}
      <div className="bg-gradient-to-l from-amber-950 via-brand-950 to-brand-900 text-white p-4 rounded-2xl border border-gold-500/30 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white">
                بوابة المورد المعزولة — إدارة التوريد وتكاليف الخامات والمخزون
              </h2>
              <span className="text-[10px] font-black bg-amber-500 text-brand-950 px-2 py-0.5 rounded-full">
                صلاحية: المورد (Supplier)
              </span>
            </div>
            <p className="text-[11px] text-brand-200 mt-0.5">
              يقتصر هذا الدور على تحديث تكلفة توريد الكيلو (شيت الجملة)، تكلفة التغليف، بلد المنشأ، وتوافر الأصناف بالمخزن — مع عزل تام عن فواتير العملاء، صافي الأرباح، وإعدادات المتجر.
            </p>
          </div>
        </div>

        {modifiedCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrafts({})}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-brand-100 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تراجع ({modifiedCount})</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAllSupplyChanges}
              className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-brand-950 text-xs font-black flex items-center gap-1.5 shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>حفظ جميع تعديلات التوريد ({modifiedCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Supplier KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs">
          <div className="flex items-center justify-between text-brand-600 text-[11px] font-bold">
            <span>إجمالي أصناف الكتالوج</span>
            <Package className="w-4 h-4 text-brand-800" />
          </div>
          <div className="text-lg font-black text-brand-950 mt-1">{products.length} صنف</div>
          <div className="text-[10px] text-brand-500 mt-0.5">
            موزعة على {categories.length} أقسام توريد
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-pistachio-200 shadow-2xs">
          <div className="flex items-center justify-between text-pistachio-700 text-[11px] font-bold">
            <span>أصناف متوفرة بالمخزن</span>
            <CheckCircle2 className="w-4 h-4 text-pistachio-600" />
          </div>
          <div className="text-lg font-black text-pistachio-700 mt-1">{inStockCount} صنف</div>
          <div className="text-[10px] text-pistachio-600 mt-0.5">جاهزة للتحميص والتعبئة</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-red-200 shadow-2xs">
          <div className="flex items-center justify-between text-red-700 text-[11px] font-bold">
            <span>نواقص تحتاج توريد</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-lg font-black text-red-700 mt-1">{outOfStockCount} صنف</div>
          <div className="text-[10px] text-red-600 mt-0.5">غير متوفرة حالياً بالمخزن</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 text-[11px] font-bold">
            <span>متوسط تكلفة التوريد / كجم</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-black text-brand-950 mt-1">{avgSupplyCost} ج.م</div>
          <div className="text-[10px] text-brand-600 mt-0.5">متوسط شيت الجملة للأصناف</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-brand-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الصنف أو بلد المنشأ..."
            className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold"
          >
            <option value="all">كل الأقسام ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-brand-50 p-1 rounded-xl border border-brand-200">
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                stockFilter === 'all' ? 'bg-brand-900 text-white' : 'text-brand-700'
              }`}
            >
              الكل ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('in')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                stockFilter === 'in' ? 'bg-pistachio-700 text-white' : 'text-pistachio-700'
              }`}
            >
              متوفر ({inStockCount})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('out')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                stockFilter === 'out' ? 'bg-red-600 text-white' : 'text-red-700'
              }`}
            >
              نواقص ({outOfStockCount})
            </button>
          </div>
        </div>
      </div>

      {/* Supply Cost & Stock Table */}
      <div className="bg-white rounded-2xl border border-brand-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-brand-950 text-white font-extrabold border-b border-brand-800">
                <th className="p-3 whitespace-nowrap">الصنف والقسم</th>
                <th className="p-3 whitespace-nowrap">بلد المنشأ / دفعة التوريد</th>
                <th className="p-3 whitespace-nowrap">تكلفة توريد الكيلو (ج.م)</th>
                <th className="p-3 whitespace-nowrap">تكلفة التغليف / العبوة (ج.م)</th>
                <th className="p-3 whitespace-nowrap text-center">حالة المخزن</th>
                <th className="p-3 whitespace-nowrap text-center">حفظ التوريد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredProducts.map((prod) => {
                const row = getRowValues(prod);
                const catName =
                  categories.find((c) => c.id === prod.categoryId)?.name || prod.categoryId;
                const isModified = Boolean(drafts[prod.id]);

                return (
                  <tr
                    key={prod.id}
                    className={`transition ${
                      isModified ? 'bg-amber-50/70' : 'hover:bg-brand-50/60'
                    }`}
                  >
                    <td className="p-3 min-w-[210px]">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getSafeImageUrl(prod.image)}
                          alt={prod.name}
                          className="w-10 h-10 rounded-xl object-cover bg-brand-100 border border-brand-200 shrink-0"
                        />
                        <div>
                          <div className="font-extrabold text-brand-950">{prod.name}</div>
                          <span className="inline-block text-[10px] font-bold bg-brand-100 text-brand-800 px-2 py-0.5 rounded mt-0.5">
                            {catName}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 min-w-[160px]">
                      <input
                        type="text"
                        value={row.origin}
                        onChange={(e) => handleFieldChange(prod, 'origin', e.target.value)}
                        className="w-full bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-brand-950"
                      />
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={row.costPerKg}
                          onChange={(e) =>
                            handleFieldChange(prod, 'costPerKg', Number(e.target.value))
                          }
                          className="w-28 bg-brand-50 border border-brand-300 rounded-xl px-2.5 py-1.5 text-xs font-black text-brand-950 font-mono"
                        />
                        <span className="text-[10px] text-brand-600 font-bold">ج.م / كجم</span>
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={row.packagingCost}
                          onChange={(e) =>
                            handleFieldChange(prod, 'packagingCost', Number(e.target.value))
                          }
                          className="w-24 bg-brand-50 border border-brand-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-brand-950 font-mono"
                        />
                        <span className="text-[10px] text-brand-600 font-bold">ج.م</span>
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap text-center">
                      <button
                        type="button"
                        onClick={() => handleFieldChange(prod, 'inStock', !row.inStock)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition ${
                          row.inStock
                            ? 'bg-pistachio-50 text-pistachio-700 border-pistachio-300 hover:bg-pistachio-100'
                            : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                        }`}
                      >
                        {row.inStock ? 'متوفر بالمخزن ✓' : 'نافد (يحتاج توريد) ✕'}
                      </button>
                    </td>

                    <td className="p-3 whitespace-nowrap text-center">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveSingleProductSupply(prod)}
                        className="bg-brand-900 hover:bg-brand-950 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl inline-flex items-center gap-1 shadow-2xs disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5 text-gold-400" />
                        <span>حفظ</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
