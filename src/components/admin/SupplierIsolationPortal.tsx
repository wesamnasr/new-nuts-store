'use client';

import React, { useMemo, useState } from 'react';
import {
  Truck,
  Package,
  Search,
  Save,
  CheckCircle2,
  XCircle,
  Globe2,
  Layers,
  DollarSign,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Send,
  FileText,
  Clock,
  Trash2,
  X,
} from 'lucide-react';
import { Category, Product, SupplyInvoice } from '@/types/store';
import {
  updateUrlQueryParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';

interface SupplierIsolationPortalProps {
  products: Product[];
  categories: Category[];
  supplyInvoices?: SupplyInvoice[];
  onSaveSupplyProducts?: (updatedProducts: Product[]) => Promise<void>;
  onUpdateStorePayload?: (payload: Record<string, unknown>, msg: string) => Promise<void>;
  onInvoiceCreated?: (invoice: SupplyInvoice) => void;
  isSaving?: boolean;
  saving?: boolean;
}

interface DraftInvoiceItem {
  productId: string;
  quantityKg: number;
  costPerKg: number;
}

export function SupplierIsolationPortal({
  products,
  categories,
  supplyInvoices = [],
  onSaveSupplyProducts,
  onUpdateStorePayload,
  onInvoiceCreated,
  isSaving,
  saving,
}: SupplierIsolationPortalProps) {
  const effectiveSaving = Boolean(isSaving || saving);
  const handleSaveProducts = async (updatedProducts: Product[]) => {
    if (onSaveSupplyProducts) {
      await onSaveSupplyProducts(updatedProducts);
    } else if (onUpdateStorePayload) {
      await onUpdateStorePayload(
        { products: updatedProducts },
        'تم حفظ تعديلات تكلفة التوريد والمخزون بنجاح'
      );
    }
  };
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'shortage'>('all');

  // Supply Invoice Creation Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useBrowserUrlSync((params) => {
    const sf = params.get('subtab');
    if (sf && ['all', 'in_stock', 'out_of_stock', 'shortage'].includes(sf)) {
      setStockFilter(sf as 'all' | 'in_stock' | 'out_of_stock' | 'shortage');
    } else if (!sf) {
      setStockFilter('all');
    }
    const cf = params.get('cat');
    setCategoryFilter(cf || 'all');
    const modal = params.get('modal');
    setShowInvoiceModal(modal === 'supply_invoice');
  });
  const [draftItems, setDraftItems] = useState<DraftInvoiceItem[]>([
    {
      productId: products[0]?.id || '',
      quantityKg: 10,
      costPerKg: products[0]?.costPerKg || 100,
    },
  ]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [invoiceFeedback, setInvoiceFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  React.useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  const shortageProducts = useMemo(() => {
    return localProducts.filter((p) => !p.inStock || (typeof p.stockKg === 'number' && p.stockKg < 10));
  }, [localProducts]);

  const filteredProducts = useMemo(() => {
    return localProducts.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.origin || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
      const isShortage = !p.inStock || (typeof p.stockKg === 'number' && p.stockKg < 10);
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in_stock' && p.inStock) ||
        (stockFilter === 'out_of_stock' && !p.inStock) ||
        (stockFilter === 'shortage' && isShortage);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [localProducts, searchQuery, categoryFilter, stockFilter]);

  const stats = useMemo(() => {
    const totalItems = localProducts.length;
    const inStockCount = localProducts.filter((p) => p.inStock).length;
    const outOfStockCount = totalItems - inStockCount;
    const avgWholesaleCost =
      totalItems > 0
        ? Math.round(
            localProducts.reduce((acc, p) => acc + (p.costPerKg || 0), 0) / totalItems
          )
        : 0;
    return { totalItems, inStockCount, outOfStockCount, avgWholesaleCost };
  }, [localProducts]);

  const handleFieldChange = (
    productId: string,
    field: 'costPerKg' | 'packagingCost' | 'origin' | 'inStock',
    value: number | string | boolean
  ) => {
    setLocalProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, [field]: value } : p))
    );
  };

  const openQuickRestockModal = (product?: Product) => {
    if (product) {
      setDraftItems([
        {
          productId: product.id,
          quantityKg: 25,
          costPerKg: product.costPerKg || 120,
        },
      ]);
    } else if (draftItems.length === 0 && localProducts[0]) {
      setDraftItems([
        {
          productId: localProducts[0].id,
          quantityKg: 10,
          costPerKg: localProducts[0].costPerKg || 100,
        },
      ]);
    }
    setInvoiceFeedback(null);
    setShowInvoiceModal(true);
    updateUrlQueryParams({ modal: 'supply_invoice' });
  };

  const handleAddDraftRow = () => {
    const firstProd = localProducts[0];
    setDraftItems((prev) => [
      ...prev,
      {
        productId: firstProd?.id || '',
        quantityKg: 10,
        costPerKg: firstProd?.costPerKg || 100,
      },
    ]);
  };

  const handleRemoveDraftRow = (idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDraftItemChange = (
    idx: number,
    field: keyof DraftInvoiceItem,
    val: string | number
  ) => {
    setDraftItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === 'productId') {
          const matched = localProducts.find((p) => p.id === val);
          return {
            ...item,
            productId: String(val),
            costPerKg: matched?.costPerKg || item.costPerKg,
          };
        }
        return { ...item, [field]: Number(val) };
      })
    );
  };

  const draftTotalAmount = useMemo(() => {
    return draftItems.reduce(
      (sum, item) => sum + (Number(item.quantityKg) || 0) * (Number(item.costPerKg) || 0),
      0
    );
  }, [draftItems]);

  const handleSubmitSupplyInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draftItems.length === 0) return;
    setSubmittingInvoice(true);
    setInvoiceFeedback(null);

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
          items: draftItems.map((it) => {
            const prod = localProducts.find((p) => p.id === it.productId);
            return {
              productId: it.productId,
              productName: prod?.name || 'صنف توريد',
              quantityKg: Number(it.quantityKg),
              costPerKg: Number(it.costPerKg),
            };
          }),
          notes: invoiceNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInvoiceFeedback({
          type: 'error',
          message: data.error || 'تعذر إرسال فاتورة التوريد',
        });
      } else {
        setInvoiceFeedback({
          type: 'success',
          message: 'تم إرسال فاتورة التوريد بنجاح وهي الآن قيد مراجعة واعتماد الإدارة',
        });
        if (onInvoiceCreated && data.invoice) {
          onInvoiceCreated(data.invoice);
        }
        setInvoiceNotes('');
        setTimeout(() => {
          setShowInvoiceModal(false);
          setInvoiceFeedback(null);
        }, 1200);
      }
    } catch {
      setInvoiceFeedback({
        type: 'error',
        message: 'حدث خطأ في الاتصال بالخادم أثناء إرسال الفاتورة',
      });
    } finally {
      setSubmittingInvoice(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Supplier Header Banner */}
      <div className="bg-gradient-to-l from-amber-900 via-brand-900 to-brand-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-amber-500/30 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black mb-3">
              <Truck className="w-4 h-4" />
              <span>بوابة المورد والتوريدات</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-serif mb-2">
              أسعار الجملة والنواقص والتوريدات
            </h2>
            <p className="hidden">
              تحديث تكلفة الكيلو بالجملة، تكلفة التغليف، بلد المنشأ، متابعة نواقص المخزون، وإرسال فواتير التوريد الجديدة لاعتماد الإدارة وإضافتها للمخزون الفعلي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openQuickRestockModal()}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-sm shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء فاتورة توريد جديدة</span>
            </button>
            <button
              type="button"
              disabled={effectiveSaving}
              onClick={() => handleSaveProducts(localProducts)}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{effectiveSaving ? 'جاري حفظ بيانات التوريد...' : 'حفظ تعديلات التوريد والمخزون'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-brand-500">إجمالي الأصناف الموردة</span>
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-brand-900">{stats.totalItems} صنف</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-brand-500">أصناف متوفرة بالمخزن</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{stats.inStockCount} متاح</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-brand-500">أصناف نافذة / غير متوفرة</span>
            <XCircle className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600">{stats.outOfStockCount} نافذ</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">تنبيهات النواقص (&lt; 10 كجم)</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700">{shortageProducts.length} صنف</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-brand-500">متوسط تكلفة الكيلو (جملة)</span>
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-brand-900">{stats.avgWholesaleCost} ج.م</p>
        </div>
      </div>

      {/* Shortage Alerts Strip */}
      {shortageProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>تنبيهات النواقص ({shortageProducts.length} أصناف)</span>
            </div>
            <button
              type="button"
              onClick={() => setStockFilter(stockFilter === 'shortage' ? 'all' : 'shortage')}
              className="text-xs font-black text-amber-800 underline cursor-pointer"
            >
              {stockFilter === 'shortage' ? 'عرض كل الأصناف' : 'فلترة الجدول على النواقص فقط'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {shortageProducts.slice(0, 8).map((sp) => (
              <div
                key={sp.id}
                className="bg-white rounded-xl p-3 border border-amber-200 flex items-center justify-between gap-2 shadow-xs"
              >
                <div>
                  <p className="font-black text-brand-900 text-xs">{sp.name}</p>
                  <p className="text-[11px] text-rose-600 font-bold">
                    المخزون الحالي: {sp.stockKg ?? 0} كجم
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openQuickRestockModal(sp)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-[11px] shrink-0 cursor-pointer"
                >
                  + توريد سريع
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-brand-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-brand-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الصنف أو بلد المنشأ..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-brand-200 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => {
              const val = e.target.value;
              setCategoryFilter(val);
              updateUrlQueryParams({ cat: val === 'all' ? null : val });
            }}
            className="px-3.5 py-2.5 rounded-xl border border-brand-200 text-sm bg-white text-brand-800 font-bold"
          >
            <option value="all">كل الأقسام ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => {
              const val = e.target.value as 'all' | 'in_stock' | 'out_of_stock' | 'shortage';
              setStockFilter(val);
              updateUrlQueryParams({ subtab: val === 'all' ? null : val });
            }}
            className="px-3.5 py-2.5 rounded-xl border border-brand-200 text-sm bg-white text-brand-800 font-bold"
          >
            <option value="all">كل حالات المخزون</option>
            <option value="in_stock">متوفر فقط</option>
            <option value="out_of_stock">نافذ فقط</option>
            <option value="shortage">النواقص الحرجة (&lt; 10 كجم)</option>
          </select>
        </div>
      </div>

      {/* Supply Products Table */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-brand-50 text-brand-700 text-xs font-black uppercase border-b border-brand-100">
              <tr>
                <th className="px-4 py-4">الصنف</th>
                <th className="px-4 py-4">القسم</th>
                <th className="px-4 py-4">المخزون (كجم)</th>
                <th className="px-4 py-4">بلد المنشأ / التوريد</th>
                <th className="px-4 py-4">تكلفة الكيلو جملة (ج.م)</th>
                <th className="px-4 py-4">تكلفة التغليف (ج.م)</th>
                <th className="px-4 py-4">حالة التوفر</th>
                <th className="px-4 py-4">إجراء سريع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredProducts.map((product) => {
                const catName =
                  categories.find((c) => c.id === product.categoryId)?.name || product.categoryId;
                return (
                  <tr key={product.id} className="hover:bg-brand-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-brand-900">{product.name}</td>
                    <td className="px-4 py-3.5 text-xs text-brand-600">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 font-bold">
                        <Layers className="w-3 h-3 text-amber-600" />
                        {catName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-black text-brand-900">
                      {product.stockKg ?? 50} كجم
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="relative w-36">
                        <Globe2 className="w-3.5 h-3.5 text-brand-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={product.origin || ''}
                          onChange={(e) =>
                            handleFieldChange(product.id, 'origin', e.target.value)
                          }
                          placeholder="مثال: إيران / مصر"
                          className="w-full pr-8 pl-2 py-1.5 rounded-lg border border-brand-200 text-xs font-bold"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        min={0}
                        value={product.costPerKg ?? 0}
                        onChange={(e) =>
                          handleFieldChange(
                            product.id,
                            'costPerKg',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-28 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/40 text-brand-900 font-black text-sm focus:outline-none focus:border-amber-600"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        min={0}
                        value={product.packagingCost ?? 0}
                        onChange={(e) =>
                          handleFieldChange(
                            product.id,
                            'packagingCost',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-24 px-3 py-1.5 rounded-lg border border-brand-200 text-brand-800 font-bold text-sm"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleFieldChange(product.id, 'inStock', !product.inStock)
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          product.inStock
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {product.inStock ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>متوفر بالمخزن</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>غير متوفر (نافذ)</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => openQuickRestockModal(product)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-black text-xs border border-amber-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>توريد دفعة</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Supply Invoices Section */}
      {supplyInvoices.length > 0 && (
        <div className="bg-white rounded-3xl border border-brand-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-brand-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-brand-900">
                آخر فواتير التوريد المرسلة ({supplyInvoices.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => openQuickRestockModal()}
              className="text-xs font-black text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              + إرسال فاتورة جديدة
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-brand-50 text-brand-600 text-xs font-black uppercase">
                <tr>
                  <th className="px-4 py-3">رقم الفاتورة</th>
                  <th className="px-4 py-3">الأصناف</th>
                  <th className="px-4 py-3">الإجمالي</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {supplyInvoices.slice(0, 10).map((inv) => (
                  <tr key={inv.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3 font-mono font-black text-brand-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-brand-700">
                      {inv.items.map((it) => `${it.productName} (${it.quantityKg} كجم)`).join('، ')}
                    </td>
                    <td className="px-4 py-3 font-black text-brand-900">
                      {inv.totalAmount.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                          inv.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : inv.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {inv.status === 'approved'
                          ? 'معتمدة وتمت إضافتها للمخزون'
                          : inv.status === 'rejected'
                          ? 'مرفوضة'
                          : 'قيد مراجعة الإدارة'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-500">
                      {new Date(inv.createdAt).toLocaleString('ar-EG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Creating a New Supply Invoice */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-brand-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-brand-100 pb-4">
              <div>
                <span className="text-xs font-black text-amber-600">نظام التوريد الذري</span>
                <h3 className="text-xl font-black text-brand-900">
                  إرسال فاتورة توريد جديدة لاعتماد الإدارة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplyInvoice} className="space-y-4">
              <div className="space-y-3">
                {draftItems.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-brand-50/50 p-3 rounded-2xl border border-brand-100"
                  >
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-black text-brand-600 mb-1">
                        الصنف المورد
                      </label>
                      <select
                        value={row.productId}
                        onChange={(e) =>
                          handleDraftItemChange(idx, 'productId', e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-brand-200 bg-white text-xs font-bold"
                      >
                        {localProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (المخزون: {p.stockKg ?? 0} كجم)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-black text-brand-600 mb-1">
                        الكمية (كجم)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        required
                        value={row.quantityKg}
                        onChange={(e) =>
                          handleDraftItemChange(idx, 'quantityKg', e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-brand-200 bg-white text-xs font-black"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-black text-brand-600 mb-1">
                        سعر الكيلو جملة (ج.م)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required
                        value={row.costPerKg}
                        onChange={(e) =>
                          handleDraftItemChange(idx, 'costPerKg', e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-brand-200 bg-white text-xs font-black"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {draftItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRow(idx)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddDraftRow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-800 font-black text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف آخر للفاتورة</span>
              </button>

              <div>
                <label className="block text-xs font-black text-brand-700 mb-1">
                  ملاحظات الشحنة / التوريد (اختياري)
                </label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="مثال: دفعة تحميص طازجة - توريد مخزن بني مزار..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-200 text-xs font-bold"
                />
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-sm font-black text-amber-900">
                  إجمالي قيمة فاتورة التوريد:
                </span>
                <span className="text-xl font-black text-amber-900">
                  {draftTotalAmount.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              {invoiceFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-black ${
                    invoiceFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {invoiceFeedback.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-brand-100">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-brand-50 text-brand-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submittingInvoice ? 'جاري الإرسال...' : 'إرسال الفاتورة لاعتماد الإدارة'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierIsolationPortal;
