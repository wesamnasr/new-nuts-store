'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Coffee,
  Layers,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Truck,
  Users,
  Utensils,
  Wallet,
} from 'lucide-react';
import {
  CustomExpenseCategory,
  DeliveryCompany,
  DiningHall,
  EmployeeRecord,
  PrepMethodOption,
  Product,
  ProductAddonOption,
  ProductBomRecipe,
  Warehouse,
  WarehouseTransfer,
} from '@/types/store';
import { isUnitProduct } from '@/lib/pricing';

interface ErpMasterModulesStudioProps {
  products: Product[];
  currency: string;
  canMutate: boolean;
  enableHallsAndTables: boolean;
  enableBlindShiftClose: boolean;
  onRefreshStore: () => void;
  showToast: (title: string, subtitle?: string) => void;
}

type ErpSection = 'warehouses' | 'bom' | 'modifiers' | 'hr_delivery' | 'halls_controls';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  let token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token') || '';
  if (!token) {
    try {
      const raw = localStorage.getItem('nuts_admin_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) token = parsed.token;
      }
    } catch {}
  }
  return token ? { Authorization: `Bearer ${token}`, 'x-admin-token': token } : {};
}

export default function ErpMasterModulesStudio({
  products,
  currency,
  canMutate,
  enableHallsAndTables,
  enableBlindShiftClose,
  onRefreshStore,
  showToast,
}: ErpMasterModulesStudioProps) {
  const [section, setSection] = useState<ErpSection>('warehouses');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [bomRecipes, setBomRecipes] = useState<ProductBomRecipe[]>([]);
  const [prepMethods, setPrepMethods] = useState<PrepMethodOption[]>([]);
  const [productAddons, setProductAddons] = useState<ProductAddonOption[]>([]);
  const [deliveryCompanies, setDeliveryCompanies] = useState<DeliveryCompany[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [diningHalls, setDiningHalls] = useState<DiningHall[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CustomExpenseCategory[]>([]);

  // Local toggles mirror
  const [hallsFlag, setHallsFlag] = useState(enableHallsAndTables);
  const [blindFlag, setBlindFlag] = useState(enableBlindShiftClose);

  // Forms
  const [newWhName, setNewWhName] = useState('');
  const [newWhAddr, setNewWhAddr] = useState('');
  const [trfFrom, setTrfFrom] = useState('');
  const [trfTo, setTrfTo] = useState('');
  const [trfProd, setTrfProd] = useState('');
  const [trfQty, setTrfQty] = useState('2');
  const [trfNotes, setTrfNotes] = useState('');

  const [bomParent, setBomParent] = useState('');
  const [bomRaw, setBomRaw] = useState('');
  const [bomGrams, setBomGrams] = useState('12');

  const [pmName, setPmName] = useState('');
  const [pmGroup, setPmGroup] = useState('التحويج والطحن');
  const [pmPrice, setPmPrice] = useState('0');
  const [adName, setAdName] = useState('');
  const [adPrice, setAdPrice] = useState('10');

  const [dcName, setDcName] = useState('');
  const [dcPhone, setDcPhone] = useState('');
  const [dcComm, setDcComm] = useState('0');

  const [empName, setEmpName] = useState('');
  const [empJob, setEmpJob] = useState('كاشير / باريستا');
  const [empPhone, setEmpPhone] = useState('');
  const [empSalary, setEmpSalary] = useState('4500');

  const [expLabel, setExpLabel] = useState('');
  const [expBudget, setExpBudget] = useState('0');

  const [hallName, setHallName] = useState('');
  const [tableName, setTableName] = useState('');
  const [selectedHallId, setSelectedHallId] = useState('');

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/erp-modules', {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses || []);
        setTransfers(data.warehouseTransfers || []);
        setBomRecipes(data.bomRecipes || []);
        setPrepMethods(data.prepMethods || []);
        setProductAddons(data.productAddons || []);
        setDeliveryCompanies(data.deliveryCompanies || []);
        setEmployees(data.employees || []);
        setDiningHalls(data.diningHalls || []);
        setExpenseCategories(data.expenseCategories || []);
        if ((data.warehouses || []).length >= 2) {
          setTrfFrom((prev) => prev || data.warehouses[1].id);
          setTrfTo((prev) => prev || data.warehouses[0].id);
        }
        if ((data.diningHalls || []).length > 0) {
          setSelectedHallId((prev) => prev || data.diningHalls[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    setHallsFlag(enableHallsAndTables);
    setBlindFlag(enableBlindShiftClose);
  }, [enableHallsAndTables, enableBlindShiftClose]);

  const saveCollection = async (collection: string, items: unknown[], successMsg: string) => {
    if (!canMutate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/erp-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'save_collection', collection, items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل الحفظ');
      showToast(successMsg);
      await fetchModules();
      onRefreshStore();
    } catch (e: unknown) {
      showToast('تعذر الحفظ', e instanceof Error ? e.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/erp-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'transfer_stock',
          fromWarehouseId: trfFrom,
          toWarehouseId: trfTo,
          productId: trfProd,
          quantityKg: Number(trfQty),
          notes: trfNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'تعذر التحويل');
      showToast(`تم التحويل المخزني #${json.transfer.transferNumber} بنجاح`);
      setTrfNotes('');
      await fetchModules();
      onRefreshStore();
    } catch (e: unknown) {
      showToast('خطأ في التحويل المخزني', e instanceof Error ? e.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlags = async (nextHalls: boolean, nextBlind: boolean) => {
    if (!canMutate) return;
    setHallsFlag(nextHalls);
    setBlindFlag(nextBlind);
    const res = await fetch('/api/admin/erp-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        action: 'toggle_feature_flags',
        enableHallsAndTables: nextHalls,
        enableBlindShiftClose: nextBlind,
      }),
    });
    if (res.ok) {
      showToast('تم تحديث إعدادات التشغيل والرقابة بنجاح');
      onRefreshStore();
    }
  };

  const tabs: Array<{ id: ErpSection; label: string; icon: React.ReactNode }> = [
    { id: 'warehouses', label: 'المخازن والتحويل المخزني', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'bom', label: 'مكونات الأصناف (BOM)', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'modifiers', label: 'طرق التجهيز والإضافات', icon: <Coffee className="w-3.5 h-3.5" /> },
    { id: 'hr_delivery', label: 'شركات التوصيل والموظفين والمصروفات', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'halls_controls', label: 'الصالات والطاولات والتقفيل الأعمى', icon: <Utensils className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1.5 bg-[#FAF6F0] p-1.5 rounded-xl border border-[#E8E0D5]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSection(t.id)}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              section === t.id ? 'bg-[#231710] text-white' : 'text-[#6B5644] hover:text-[#231710]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs font-bold text-[#6B5644]">جاري تحميل بيانات الوحدات...</div>
      ) : (
        <>
          {/* 1. Multi-Warehouses & Stock Transfers */}
          {section === 'warehouses' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Warehouses List + Add */}
                <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                  <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#9A6836]" /> تكويد المخازن والفروع ({warehouses.length})
                  </h3>
                  {canMutate && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newWhName.trim()) return;
                        const next: Warehouse[] = [
                          ...warehouses,
                          {
                            id: `wh-${Date.now()}`,
                            code: `WH-${warehouses.length + 1}`,
                            name: newWhName.trim(),
                            address: newWhAddr.trim(),
                            active: true,
                          },
                        ];
                        setNewWhName('');
                        setNewWhAddr('');
                        saveCollection('warehouses', next, 'تم إضافة المخزن بنجاح');
                      }}
                      className="flex flex-wrap gap-2"
                    >
                      <input
                        value={newWhName}
                        onChange={(e) => setNewWhName(e.target.value)}
                        placeholder="اسم المخزن (مثلاً: مخزن التوريد الخلفي)"
                        className="flex-1 min-w-[160px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
                      />
                      <input
                        value={newWhAddr}
                        onChange={(e) => setNewWhAddr(e.target.value)}
                        placeholder="الموقع / العنوان"
                        className="w-36 bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs"
                      />
                      <button
                        disabled={saving}
                        type="submit"
                        className="bg-[#231710] text-white px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> إضافة
                      </button>
                    </form>
                  )}
                  <div className="space-y-1.5">
                    {warehouses.map((w) => (
                      <div key={w.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs">
                        <div>
                          <span className="font-bold text-[#231710]">{w.name}</span>
                          <span className="mr-2 font-mono text-[10px] text-[#6B5644]">{w.code}</span>
                          {w.isPosBranch && (
                            <span className="mr-2 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              نقطة البيع
                            </span>
                          )}
                        </div>
                        {canMutate && warehouses.length > 1 && !w.isPosBranch && (
                          <button
                            type="button"
                            onClick={() =>
                              saveCollection(
                                'warehouses',
                                warehouses.filter((x) => x.id !== w.id),
                                'تم حذف المخزن'
                              )
                            }
                            className="text-red-600 p-1 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stock Transfer Form */}
                <form onSubmit={handleTransferStock} className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                  <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                    <ArrowLeftRight className="w-4 h-4 text-[#9A6836]" /> تنفيذ تحويل مخزني بين المخازن
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={trfFrom} onChange={(e) => setTrfFrom(e.target.value)} className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold">
                      <option value="">من مخزن...</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <select value={trfTo} onChange={(e) => setTrfTo(e.target.value)} className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold">
                      <option value="">إلى مخزن...</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <select required value={trfProd} onChange={(e) => setTrfProd(e.target.value)} className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold">
                    <option value="">اختر الصنف للتحويل...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (إجمالي الرصيد: {p.stockKg ?? 0} {isUnitProduct(p) ? p.unitLabel || 'قطعة' : 'كجم'})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={trfQty}
                      onChange={(e) => setTrfQty(e.target.value)}
                      placeholder="الكمية (كجم أو قطعة)"
                      className="bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
                    />
                    <input
                      value={trfNotes}
                      onChange={(e) => setTrfNotes(e.target.value)}
                      placeholder="ملاحظة (تغذية بار العرض...)"
                      className="bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  {canMutate && (
                    <button
                      disabled={saving}
                      type="submit"
                      className="w-full bg-[#231710] hover:bg-[#3A271C] text-white py-2.5 rounded-xl text-xs font-bold"
                    >
                      اعتماد التحويل المخزني فوراً
                    </button>
                  )}
                </form>
              </div>

              {/* Transfers History */}
              <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#FAF6F0] border-b border-[#E8E0D5] font-bold">
                    <tr>
                      <th className="p-2.5">رقم التحويل</th>
                      <th className="p-2.5">الصنف</th>
                      <th className="p-2.5">من مخزن</th>
                      <th className="p-2.5">إلى مخزن</th>
                      <th className="p-2.5">الكمية</th>
                      <th className="p-2.5">بواسطة / التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE2]">
                    {transfers.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-[#6B5644]">لا توجد حركات تحويل مخزني مسجلة بعد</td></tr>
                    ) : (
                      transfers.map((tr) => (
                        <tr key={tr.id}>
                          <td className="p-2.5 font-mono font-bold">{tr.transferNumber}</td>
                          <td className="p-2.5 font-bold">{tr.productName}</td>
                          <td className="p-2.5">{tr.fromWarehouseName}</td>
                          <td className="p-2.5 font-bold text-emerald-700">{tr.toWarehouseName}</td>
                          <td className="p-2.5 font-bold">{tr.quantityKg} {tr.unitLabel || 'كجم'}</td>
                          <td className="p-2.5 text-[#6B5644]">{tr.transferredBy} • {new Date(tr.createdAt).toLocaleString('ar-EG')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. BOM Recipes ("مكونات الأصناف") */}
          {section === 'bom' && (
            <div className="space-y-4">
              {canMutate && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const pObj = products.find((p) => p.id === bomParent);
                    const rObj = products.find((p) => p.id === bomRaw);
                    if (!pObj || !rObj || Number(bomGrams) <= 0) return;
                    const existing = bomRecipes.find((r) => r.parentProductId === pObj.id);
                    const newIng = {
                      rawProductId: rObj.id,
                      rawProductName: rObj.name,
                      deductGramsOrUnits: Number(bomGrams),
                      isUnitRaw: isUnitProduct(rObj),
                    };
                    const next: ProductBomRecipe[] = existing
                      ? bomRecipes.map((r) =>
                          r.parentProductId === pObj.id
                            ? {
                                ...r,
                                ingredients: [
                                  ...r.ingredients.filter((i) => i.rawProductId !== rObj.id),
                                  newIng,
                                ],
                                updatedAt: new Date().toISOString(),
                              }
                            : r
                        )
                      : [
                          {
                            id: `bom-${Date.now()}`,
                            parentProductId: pObj.id,
                            parentProductName: pObj.name,
                            ingredients: [newIng],
                            updatedAt: new Date().toISOString(),
                          },
                          ...bomRecipes,
                        ];
                    saveCollection('bomRecipes', next, 'تم حفظ شجرة المكونات (BOM) وتفعيل الخصم التلقائي عند البيع');
                  }}
                  className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3"
                >
                  <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#9A6836]" /> ربط مكون خام بصنف (الخصم المعياري التلقائي بالجرام)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select required value={bomParent} onChange={(e) => setBomParent(e.target.value)} className="bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold">
                      <option value="">الصنف المباع (مشروب / بوكس) *</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select required value={bomRaw} onChange={(e) => setBomRaw(e.target.value)} className="bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold">
                      <option value="">المكون الخام المخصوم (بن / مكسرات) *</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      required
                      type="number"
                      min="1"
                      value={bomGrams}
                      onChange={(e) => setBomGrams(e.target.value)}
                      placeholder="الكمية (جم أو عدد)"
                      className="bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
                    />
                    <button disabled={saving} type="submit" className="bg-[#231710] text-white rounded-xl text-xs font-bold py-2">
                      إضافة للخصم التلقائي
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {bomRecipes.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF6F0] rounded-xl text-xs text-[#6B5644]">
                    لا توجد شجرة مكونات مسجلة بعد — اربط مثلاً «فنجان قهوة تركي» بـ 12 جرام من «بن تركي سادة» ليتم خصمها تلقائياً مع كل فاتورة.
                  </div>
                ) : (
                  bomRecipes.map((rec) => (
                    <div key={rec.id} className="bg-white border border-[#E8E0D5] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-[#231710]">{rec.parentProductName}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {rec.ingredients.map((ing) => (
                            <span key={ing.rawProductId} className="bg-[#FAF6F0] border border-[#E8E0D5] px-2.5 py-1 rounded-lg text-[11px] font-bold">
                              {ing.rawProductName}: {ing.deductGramsOrUnits} {ing.isUnitRaw ? 'وحدة' : 'جم'}
                            </span>
                          ))}
                        </div>
                      </div>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() =>
                            saveCollection('bomRecipes', bomRecipes.filter((x) => x.id !== rec.id), 'تم حذف الوصفة')
                          }
                          className="text-red-600 p-1.5 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. Dynamic Prep Methods & Paid Add-ons */}
          {section === 'modifiers' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Prep Methods */}
              <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-[#9A6836]" /> تكويد طرق التجهيز والتحويج والطحن
                </h3>
                {canMutate && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!pmName.trim()) return;
                      saveCollection(
                        'prepMethods',
                        [...prepMethods, { id: `pm-${Date.now()}`, name: pmName.trim(), groupName: pmGroup, extraPrice: Number(pmPrice || 0), active: true }],
                        'تمت إضافة طريقة التجهيز'
                      );
                      setPmName('');
                      setPmPrice('0');
                    }}
                    className="grid grid-cols-3 gap-2"
                  >
                    <input required value={pmName} onChange={(e) => setPmName(e.target.value)} placeholder="الطريقة (محوج ملكي...)" className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold" />
                    <input value={pmGroup} onChange={(e) => setPmGroup(e.target.value)} placeholder="التصنيف" className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs" />
                    <div className="flex gap-1">
                      <input type="number" value={pmPrice} onChange={(e) => setPmPrice(e.target.value)} placeholder="+سعر" className="w-16 bg-white border border-[#E8E0D5] rounded-xl px-2 py-2 text-xs font-bold" />
                      <button type="submit" className="flex-1 bg-[#231710] text-white rounded-xl text-xs font-bold">إضافة</button>
                    </div>
                  </form>
                )}
                <div className="space-y-1.5">
                  {prepMethods.map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs">
                      <div>
                        <span className="font-bold">{m.name}</span>
                        <span className="mr-2 text-[#6B5644]">({m.groupName})</span>
                        {m.extraPrice > 0 && <span className="mr-2 font-bold text-[#9A6836]">+{m.extraPrice} {currency}</span>}
                      </div>
                      {canMutate && (
                        <button type="button" onClick={() => saveCollection('prepMethods', prepMethods.filter((x) => x.id !== m.id), 'تم الحذف')} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Paid Addons */}
              <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                <h3 className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#9A6836]" /> تكويد الإضافات المدفوعة (للكاشير)
                </h3>
                {canMutate && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!adName.trim()) return;
                      saveCollection(
                        'productAddons',
                        [...productAddons, { id: `ad-${Date.now()}`, name: adName.trim(), extraPrice: Number(adPrice || 0), active: true }],
                        'تمت إضافة الإضافة بنجاح'
                      );
                      setAdName('');
                    }}
                    className="flex gap-2"
                  >
                    <input required value={adName} onChange={(e) => setAdName(e.target.value)} placeholder="اسم الإضافة (حبهان، صوص، تغليف...)" className="flex-1 bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold" />
                    <input type="number" value={adPrice} onChange={(e) => setAdPrice(e.target.value)} placeholder="السعر" className="w-20 bg-white border border-[#E8E0D5] rounded-xl px-2 py-2 text-xs font-bold" />
                    <button type="submit" className="bg-[#231710] text-white px-4 rounded-xl text-xs font-bold">إضافة</button>
                  </form>
                )}
                <div className="space-y-1.5">
                  {productAddons.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs">
                      <div>
                        <span className="font-bold">{a.name}</span>
                        <span className="mr-2 font-bold text-emerald-700">+{a.extraPrice} {currency}</span>
                      </div>
                      {canMutate && (
                        <button type="button" onClick={() => saveCollection('productAddons', productAddons.filter((x) => x.id !== a.id), 'تم الحذف')} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Delivery Companies, Employees & Custom Expense Categories */}
          {section === 'hr_delivery' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Delivery Companies */}
              <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                <h3 className="font-cairo font-bold text-sm flex items-center gap-1.5"><Truck className="w-4 h-4 text-[#9A6836]" /> شركات التوصيل</h3>
                {canMutate && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!dcName.trim()) return;
                      saveCollection('deliveryCompanies', [...deliveryCompanies, { id: `dc-${Date.now()}`, name: dcName.trim(), phone: dcPhone, commissionPercent: Number(dcComm || 0), active: true }], 'تمت إضافة شركة التوصيل');
                      setDcName('');
                      setDcPhone('');
                    }}
                    className="space-y-2"
                  >
                    <input required value={dcName} onChange={(e) => setDcName(e.target.value)} placeholder="اسم الشركة (طلبات / مكتب توصيل...)" className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold" />
                    <div className="flex gap-2">
                      <input value={dcPhone} onChange={(e) => setDcPhone(e.target.value)} placeholder="الهاتف" className="flex-1 bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs" />
                      <input type="number" value={dcComm} onChange={(e) => setDcComm(e.target.value)} placeholder="عمولة %" className="w-20 bg-white border border-[#E8E0D5] rounded-xl px-2 py-2 text-xs font-bold" />
                    </div>
                    <button type="submit" className="w-full bg-[#231710] text-white py-2 rounded-xl text-xs font-bold">إضافة شركة</button>
                  </form>
                )}
                <div className="space-y-1.5">
                  {deliveryCompanies.map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs">
                      <div><b>{c.name}</b> <span className="text-[#6B5644]">({c.commissionPercent}%)</span></div>
                      {canMutate && <button type="button" onClick={() => saveCollection('deliveryCompanies', deliveryCompanies.filter((x) => x.id !== c.id), 'تم الحذف')} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Employees & Payroll */}
              <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                <h3 className="font-cairo font-bold text-sm flex items-center gap-1.5"><Users className="w-4 h-4 text-[#9A6836]" /> تكويد الموظفين والرواتب</h3>
                {canMutate && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!empName.trim()) return;
                      saveCollection('employees', [...employees, { id: `emp-${Date.now()}`, code: `EMP-${employees.length + 1}`, name: empName.trim(), jobTitle: empJob, phone: empPhone, monthlySalary: Number(empSalary || 0), active: true }], 'تمت إضافة الموظف');
                      setEmpName('');
                      setEmpPhone('');
                    }}
                    className="space-y-2"
                  >
                    <input required value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="اسم الموظف *" className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={empJob} onChange={(e) => setEmpJob(e.target.value)} placeholder="الوظيفة" className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs" />
                      <input type="number" value={empSalary} onChange={(e) => setEmpSalary(e.target.value)} placeholder="الراتب الشهري" className="bg-white border border-[#E8E0D5] rounded-xl px-2.5 py-2 text-xs font-bold" />
                    </div>
                    <button type="submit" className="w-full bg-[#231710] text-white py-2 rounded-xl text-xs font-bold">حفظ موظف</button>
                  </form>
                )}
                <div className="space-y-1.5">
                  {employees.map((em) => (
                    <div key={em.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs">
                      <div><b>{em.name}</b> — {em.jobTitle} <span className="font-bold text-emerald-700">({em.monthlySalary} {currency})</span></div>
                      {canMutate && <button type="button" onClick={() => saveCollection('employees', employees.filter((x) => x.id !== em.id), 'تم الحذف')} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Expense Categories */}
              <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                <h3 className="font-cairo font-bold text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4 text-[#9A6836]" /> تكويد بنود المصروفات</h3>
                {canMutate && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!expLabel.trim()) return;
                      const key = `custom_${Date.now()}`;
                      saveCollection('expenseCategories', [...expenseCategories, { id: `ec-${Date.now()}`, key, label: expLabel.trim(), monthlyBudget: Number(expBudget || 0), active: true }], 'تمت إضافة بند المصروف');
                      setExpLabel('');
                      setExpBudget('0');
                    }}
                    className="space-y-2"
                  >
                    <input required value={expLabel} onChange={(e) => setExpLabel(e.target.value)} placeholder="اسم البند (إيجار، إعلانات، صيانة...)" className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold" />
                    <input type="number" value={expBudget} onChange={(e) => setExpBudget(e.target.value)} placeholder="الميزانية الشهرية (اختياري)" className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs" />
                    <button type="submit" className="w-full bg-[#231710] text-white py-2 rounded-xl text-xs font-bold">إضافة بند مصروف</button>
                  </form>
                )}
                <div className="space-y-1.5">
                  {expenseCategories.map((ec) => (
                    <div key={ec.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E8E0D5] text-xs">
                      <span className="font-bold">{ec.label}</span>
                      {canMutate && ec.key.startsWith('custom_') && (
                        <button type="button" onClick={() => saveCollection('expenseCategories', expenseCategories.filter((x) => x.id !== ec.id), 'تم الحذف')} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. Optional Halls/Tables & Blind Shift Close Control */}
          {section === 'halls_controls' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E8E0D5] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blindFlag}
                    disabled={!canMutate}
                    onChange={(e) => handleToggleFlags(hallsFlag, e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#231710]"
                  />
                  <div>
                    <div className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-[#B83B2B]" /> تفعيل التقفيل الأعمى الإجباري للشيفت (Blind Close)
                    </div>
                    <p className="text-xs text-[#6B5644] mt-1">
                      عند تفعيله، يختفي رصيد النقدية المتوقع في الدرج عن الكاشير تماماً أثناء تقفيل الوردية حتى يقوم بعدّ الدرج الفعلي وإدخاله أولاً، ثم يظهر الفارق للمدير والمحاسب فقط.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E8E0D5] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hallsFlag}
                    disabled={!canMutate}
                    onChange={(e) => handleToggleFlags(e.target.checked, blindFlag)}
                    className="mt-1 h-4 w-4 accent-[#231710]"
                  />
                  <div>
                    <div className="font-cairo font-bold text-sm text-[#231710] flex items-center gap-1.5">
                      <Utensils className="w-4 h-4 text-[#9A6836]" /> تفعيل نظام الصالات والطاولات على الكاشير
                    </div>
                    <p className="text-xs text-[#6B5644] mt-1">
                      مخفي افتراضياً للمحامص العادية للحفاظ على سرعة الواجهة — فعّله لأي محمصة بها كافيه أو عند بيع النظام لمطعم أو كافيه.
                    </p>
                  </div>
                </label>
              </div>

              {hallsFlag && (
                <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
                  <h3 className="font-cairo font-bold text-sm flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-700" /> تكويد الصالات والطاولات</h3>
                  {canMutate && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!hallName.trim()) return;
                          saveCollection('diningHalls', [...diningHalls, { id: `hall-${Date.now()}`, name: hallName.trim(), tables: [], active: true }], 'تمت إضافة الصالة');
                          setHallName('');
                        }}
                        className="flex gap-2"
                      >
                        <input required value={hallName} onChange={(e) => setHallName(e.target.value)} placeholder="اسم صالة جديدة (الصالة الداخلية...)" className="flex-1 bg-white border rounded-xl px-3 py-2 text-xs font-bold" />
                        <button type="submit" className="bg-[#231710] text-white px-3.5 rounded-xl text-xs font-bold">إضافة صالة</button>
                      </form>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!tableName.trim() || !selectedHallId) return;
                          const next = diningHalls.map((h) =>
                            h.id === selectedHallId
                              ? { ...h, tables: [...h.tables, { id: `tbl-${Date.now()}`, name: tableName.trim(), capacity: 4, active: true }] }
                              : h
                          );
                          saveCollection('diningHalls', next, 'تمت إضافة الطاولة');
                          setTableName('');
                        }}
                        className="flex gap-2"
                      >
                        <select value={selectedHallId} onChange={(e) => setSelectedHallId(e.target.value)} className="bg-white border rounded-xl px-2 py-2 text-xs font-bold">
                          {diningHalls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                        <input required value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="اسم الطاولة (T1...)" className="flex-1 bg-white border rounded-xl px-3 py-2 text-xs font-bold" />
                        <button type="submit" className="bg-[#9A6836] text-white px-3.5 rounded-xl text-xs font-bold">إضافة طاولة</button>
                      </form>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {diningHalls.map((h) => (
                      <div key={h.id} className="bg-white rounded-xl p-3 border border-[#E8E0D5]">
                        <div className="font-bold text-xs text-[#231710] mb-2">{h.name} ({h.tables.length} طاولة)</div>
                        <div className="flex flex-wrap gap-1.5">
                          {h.tables.map((t) => (
                            <span key={t.id} className="bg-[#FAF6F0] border border-[#E8E0D5] px-2.5 py-1 rounded-lg text-[11px] font-bold">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
