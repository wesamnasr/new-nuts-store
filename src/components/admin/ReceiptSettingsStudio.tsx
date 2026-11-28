'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Printer,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import {
  Order,
  ReceiptConfig,
  ReceiptDividerStyle,
  ReceiptFontSizeMode,
  ReceiptHeaderStyle,
  StoreSettings,
} from '@/types/store';
import {
  DEFAULT_RECEIPT_CONFIG,
  RECEIPT_DESIGN_PRESETS,
  getCurrencySymbol,
  getOrderPrefix,
  getResolvedReceiptConfig,
} from '@/lib/defaults';
import {
  ThermalReceiptOrderContent,
  buildThermalReceiptPrintHtml,
  getReceiptPaperMetrics,
} from '@/components/receipt/ThermalReceiptDocument';
import ImageUploadDropzone from '@/components/admin/ImageUploadDropzone';

interface ReceiptSettingsStudioProps {
  settings: StoreSettings;
  saving?: boolean;
  onSaveReceiptSettings: (payload: {
    receiptConfig: Required<ReceiptConfig>;
    thermalPaperWidthMm: 58 | 80;
    enableDirectEscPosPrint: boolean;
    autoOpenCashDrawer: boolean;
  }) => Promise<void> | void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type PreviewScenario = 'pos_cash' | 'online_delivery' | 'tax_invoice';
type EditorTab = 'lines' | 'layout' | 'logo';

const BRAND_LOGO_CHOICES = [
  { label: 'أيقونة حفصة (مناسب للطباعة)', url: '/images/brand/hafsa-logo-icon.png' },
  { label: 'الشعار الرئيسي', url: '/images/brand/hafsa-logo-main.png' },
  { label: 'الختم الذهبي', url: '/images/brand/hafsa-sticker-gold.png' },
];

const ALL_LINE_TOGGLE_KEYS: Array<keyof Required<ReceiptConfig>> = [
  'showLogo',
  'showStoreName',
  'showHeaderSubtitle',
  'showAddress',
  'showPhone',
  'showInvoiceTitle',
  'showOrderNumber',
  'showOrderTime',
  'showCustomerName',
  'showPaymentMethod',
  'showCustomerPhone',
  'showCustomerGovernorate',
  'showCustomerAddress',
  'showItemWeight',
  'showItemDetails',
  'showQuantityColumn',
  'showUnitPriceColumn',
  'showItemCount',
  'showSubtotal',
  'showDiscount',
  'showVipRedeemed',
  'showShippingCost',
  'showPaymentBreakdown',
  'showCashTenderedAndChange',
  'showVipCashback',
  'showTaxDetails',
  'showReturnPolicy',
  'showBarcode',
  'showQrCode',
  'showPromoLine',
  'showFooterMessage',
];

export default function ReceiptSettingsStudio({
  settings,
  saving = false,
  onSaveReceiptSettings,
  onNotify,
}: ReceiptSettingsStudioProps) {
  const resolvedSaved = useMemo(() => getResolvedReceiptConfig(settings), [settings]);
  const savedSnapshotKey = useMemo(
    () =>
      JSON.stringify({
        receipt: resolvedSaved,
        esc: Boolean(settings.enableDirectEscPosPrint),
        drawer: settings.autoOpenCashDrawer !== false,
      }),
    [resolvedSaved, settings.enableDirectEscPosPrint, settings.autoOpenCashDrawer]
  );

  const [draft, setDraft] = useState<Required<ReceiptConfig>>(resolvedSaved);
  const [escPosEnabled, setEscPosEnabled] = useState<boolean>(
    Boolean(settings.enableDirectEscPosPrint)
  );
  const [autoDrawerEnabled, setAutoDrawerEnabled] = useState<boolean>(
    settings.autoOpenCashDrawer !== false
  );
  const [previewScenario, setPreviewScenario] = useState<PreviewScenario>('pos_cash');
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('lines');

  const previewRef = useRef<HTMLDivElement>(null);
  const lastSyncedSnapshotKeyRef = useRef<string>(savedSnapshotKey);

  // Only resync local editor draft when the persisted receipt settings actually change on the server
  // (e.g. after pressing Save) — NEVER reset unsaved edits on background 20s polling refreshes!
  useEffect(() => {
    if (savedSnapshotKey === lastSyncedSnapshotKeyRef.current) return;
    lastSyncedSnapshotKeyRef.current = savedSnapshotKey;
    setDraft(resolvedSaved);
    setEscPosEnabled(Boolean(settings.enableDirectEscPosPrint));
    setAutoDrawerEnabled(settings.autoOpenCashDrawer !== false);
  }, [
    savedSnapshotKey,
    resolvedSaved,
    settings.enableDirectEscPosPrint,
    settings.autoOpenCashDrawer,
  ]);

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(draft) !== JSON.stringify(resolvedSaved) ||
      escPosEnabled !== Boolean(settings.enableDirectEscPosPrint) ||
      autoDrawerEnabled !== (settings.autoOpenCashDrawer !== false)
    );
  }, [draft, resolvedSaved, escPosEnabled, autoDrawerEnabled, settings]);

  const enabledLinesCount = useMemo(
    () => ALL_LINE_TOGGLE_KEYS.filter((k) => Boolean(draft[k])).length,
    [draft]
  );

  const metrics = useMemo(() => getReceiptPaperMetrics(draft, false), [draft]);
  const currency = getCurrencySymbol(settings);
  const prefix = getOrderPrefix(settings);

  const sampleOrder = useMemo<Order>(() => {
    const nowIso = new Date().toISOString();
    if (previewScenario === 'online_delivery') {
      return {
        id: 'preview-online',
        orderNumber: `${prefix}-2048`,
        orderSource: 'online',
        customerName: 'أحمد محمود حسن',
        customerPhone: '01094512280',
        governorate: 'بندر بني مزار',
        address: 'شارع الجمهورية — بجوار صيدلية مكة — الدور الثالث',
        items: [
          {
            cartItemId: 's-box',
            productId: 'p-box',
            productName: 'بوكس السهرة المقسم «لمة الخميس»',
            productImage: '',
            weightId: 'box-4',
            weightLabel: '4 خانات',
            roastOption: 'تحميص طازج يومي',
            unitPrice: 125,
            quantity: 1,
            isPartitionedBox: true,
            partitionedSlots: [
              {
                productId: 'p1',
                productName: 'كاجو جامبو',
                productImage: '',
                roastOption: 'مملح',
                slotGrams: 100,
              },
              {
                productId: 'p2',
                productName: 'فستق أمريكي',
                productImage: '',
                roastOption: 'مملح',
                slotGrams: 100,
              },
              {
                productId: 'p3',
                productName: 'لوز مقرمش',
                productImage: '',
                roastOption: 'مدخن',
                slotGrams: 125,
              },
            ],
          },
          {
            cartItemId: 's-pist',
            productId: 'p-pist',
            productName: 'فستق أمريكي جامبو محمص',
            productImage: '',
            weightId: 'w-250',
            weightLabel: 'ربع 250 جم',
            roastOption: 'محمص مملح',
            workerNotes: 'تغليف محكم',
            unitPrice: 215,
            quantity: 1,
          },
        ],
        subtotal: 340,
        shippingCost: 20,
        discountAmount: 25,
        couponCode: 'HAFSA25',
        vipWalletRedeemed: 0,
        vipCashbackEarned: 17,
        total: 335,
        paymentMethod: 'instapay',
        status: 'confirmed',
        createdAt: nowIso,
      };
    }

    if (previewScenario === 'tax_invoice') {
      return {
        id: 'preview-tax',
        orderNumber: `TAX-${prefix}-1092`,
        orderSource: 'pos',
        customerName: 'شركة النور للتجارة والتوزيع',
        customerPhone: '01122334455',
        governorate: 'بني مزار',
        address: 'استلام فوري من كاونتر الفرع',
        items: [
          {
            cartItemId: 't-1',
            productId: 'p-1',
            productName: 'بن تركي محوج وسط فاخر',
            productImage: '',
            weightId: 'w-500',
            weightLabel: 'نصف 500 جم',
            roastOption: 'وسط محوج بالهيل',
            unitPrice: 290,
            quantity: 2,
          },
          {
            cartItemId: 't-2',
            productId: 'p-2',
            productName: 'كاجو فيتنامي ملكي W180',
            productImage: '',
            weightId: 'w-500',
            weightLabel: 'نصف 500 جم',
            roastOption: 'محمص بدون ملح',
            unitPrice: 380,
            quantity: 1,
          },
        ],
        subtotal: 960,
        shippingCost: 0,
        discountAmount: 0,
        taxAmount: 117.89,
        taxRatePercent: settings.taxRatePercent ?? 14,
        taxInclusive: settings.taxPricingMode !== 'exclusive',
        etaReceiptUuid: 'ETA-EG-8F94C21D90A4B77E12',
        total: 960,
        cashTendered: 1000,
        changeDue: 40,
        paymentMethod: 'card',
        status: 'delivered',
        createdAt: nowIso,
      };
    }

    // Default: POS direct counter sale
    return {
      id: 'preview-pos',
      orderNumber: `POS-${prefix}-1042`,
      orderSource: 'pos',
      customerName: 'عميل كاشير VIP',
      customerPhone: '01012345678',
      governorate: 'بني مزار',
      address: 'استلام فوري من كاونتر الفرع',
      items: [
        {
          cartItemId: 'pos-1',
          productId: 'p-coffee',
          productName: 'توليفة حفصة الخاصة',
          productImage: '',
          weightId: 'w-250',
          weightLabel: 'ربع 250 جم',
          roastOption: 'وسط محوج',
          unitPrice: 145,
          quantity: 1,
          isCoffeeBlend: true,
          coffeeBlendSpec: {
            roastLevel: 'medium',
            spicing: 'spiced_cardamom',
            grindType: 'turkish_fine',
            weightGrams: 250,
            baristaLabel: '50% برازيلي + 50% حبشي • تحميص وسط • تحويجة هيل',
          },
        },
        {
          cartItemId: 'pos-2',
          productId: 'p-cashew',
          productName: 'كاجو جامبو ملكي W180',
          productImage: '',
          weightId: 'w-250',
          weightLabel: 'ربع 250 جم',
          roastOption: 'محمص مملح',
          unitPrice: 195,
          quantity: 1,
        },
        {
          cartItemId: 'pos-3',
          productId: 'p-honey',
          productName: 'برطمان عسل سدر جبلي ملكي',
          productImage: '',
          weightId: 'unit-500',
          weightLabel: '500 جم',
          roastOption: '',
          unitPrice: 320,
          quantity: 1,
        },
      ],
      subtotal: 660,
      shippingCost: 0,
      discountAmount: 20,
      vipWalletRedeemed: 15,
      vipCashbackEarned: 31,
      total: 625,
      cashTendered: 700,
      changeDue: 75,
      paymentMethod: 'cod',
      status: 'delivered',
      createdAt: nowIso,
    };
  }, [previewScenario, prefix, settings.taxPricingMode, settings.taxRatePercent]);

  const updateField = <K extends keyof Required<ReceiptConfig>>(
    key: K,
    value: Required<ReceiptConfig>[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetConfig: Partial<ReceiptConfig>) => {
    setDraft((prev) => ({
      ...prev,
      ...presetConfig,
    }));
  };

  const applyMinimalLines = () => {
    setDraft((prev) => ({
      ...prev,
      showLogo: false,
      showStoreName: true,
      showHeaderSubtitle: false,
      showAddress: false,
      showPhone: true,
      showInvoiceTitle: false,
      showOrderNumber: true,
      showOrderTime: true,
      showCustomerName: false,
      showPaymentMethod: true,
      showCustomerPhone: false,
      showCustomerGovernorate: false,
      showCustomerAddress: false,
      showItemWeight: true,
      showItemDetails: false,
      showQuantityColumn: true,
      showUnitPriceColumn: false,
      showItemCount: false,
      showSubtotal: false,
      showDiscount: true,
      showVipRedeemed: true,
      showShippingCost: true,
      showPaymentBreakdown: true,
      showCashTenderedAndChange: true,
      showVipCashback: false,
      showReturnPolicy: false,
      showBarcode: true,
      showQrCode: false,
      showPromoLine: false,
      showFooterMessage: true,
    }));
  };

  const applyShowAllLines = () => {
    setDraft((prev) => ({
      ...prev,
      showLogo: true,
      showStoreName: true,
      showHeaderSubtitle: true,
      showAddress: true,
      showPhone: true,
      showInvoiceTitle: true,
      showOrderNumber: true,
      showOrderTime: true,
      showCustomerName: true,
      showPaymentMethod: true,
      showCustomerPhone: true,
      showCustomerGovernorate: true,
      showCustomerAddress: true,
      showItemWeight: true,
      showItemDetails: true,
      showQuantityColumn: true,
      showUnitPriceColumn: true,
      showItemCount: true,
      showSubtotal: true,
      showDiscount: true,
      showVipRedeemed: true,
      showShippingCost: true,
      showPaymentBreakdown: true,
      showCashTenderedAndChange: true,
      showVipCashback: true,
      showTaxDetails: true,
      showReturnPolicy: true,
      showBarcode: true,
      showQrCode: true,
      showPromoLine: true,
      showFooterMessage: true,
    }));
  };

  const handleResetDefaults = () => {
    setDraft({ ...DEFAULT_RECEIPT_CONFIG });
  };

  const handleSave = async () => {
    await onSaveReceiptSettings({
      receiptConfig: draft,
      thermalPaperWidthMm: draft.paperWidthMm,
      enableDirectEscPosPrint: escPosEnabled,
      autoOpenCashDrawer: autoDrawerEnabled,
    });
  };

  const handleTestPrint = () => {
    if (!previewRef.current) return;
    const html = buildThermalReceiptPrintHtml({
      receiptHtml: previewRef.current.innerHTML,
      title: `معاينة فاتورة تجريبية — ${draft.customStoreName || settings.storeName}`,
      config: draft,
      isSticker: false,
    });

    const desktopBridge = (
      window as unknown as {
        mizanDesktop?: {
          isDesktop?: boolean;
          printSilent?: (p: {
            html: string;
            paperWidthMm?: number;
          }) => Promise<{ ok: boolean; error?: string }>;
        };
      }
    ).mizanDesktop;

    if (desktopBridge?.isDesktop && desktopBridge.printSilent) {
      desktopBridge
        .printSilent({ html, paperWidthMm: draft.paperWidthMm })
        .then((res) => {
          onNotify?.(
            res?.ok
              ? 'تم إرسال الفاتورة التجريبية للطابعة الحرارية مباشرة بنجاح'
              : res?.error || 'تعذر الطباعة المباشرة على الطابعة الحرارية',
            res?.ok ? 'success' : 'error'
          );
        });
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 150);
  };

  const renderLineControl = (opts: {
    toggleKey?: keyof Required<ReceiptConfig>;
    title: string;
    sample?: string;
    textKey?: keyof Required<ReceiptConfig>;
    textPlaceholder?: string;
    textDir?: 'rtl' | 'ltr';
    multiline?: boolean;
    extraTextKey?: keyof Required<ReceiptConfig>;
    extraTextPlaceholder?: string;
  }) => {
    const isToggleable = Boolean(opts.toggleKey);
    const checked = opts.toggleKey ? Boolean(draft[opts.toggleKey]) : true;
    const textVal = opts.textKey ? String(draft[opts.textKey] ?? '') : '';
    const extraTextVal = opts.extraTextKey ? String(draft[opts.extraTextKey] ?? '') : '';

    return (
      <div
        className={`rounded-xl border px-3 py-2.5 transition ${
          checked
            ? 'bg-white border-[#E5DACB]'
            : 'bg-[#FAF6F0]/60 border-[#EDE5DA] opacity-75'
        }`}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-xs font-bold ${
                  checked ? 'text-[#231710]' : 'text-[#8C7A6B] line-through'
                }`}
              >
                {opts.title}
              </span>
              {opts.sample && (
                <span className="text-[10px] text-[#7D6A58] bg-[#FAF6F0] border border-[#EDE5DA] px-1.5 py-0.5 rounded-md truncate max-w-[230px]">
                  {opts.sample}
                </span>
              )}
            </div>
          </div>

          {isToggleable && opts.toggleKey && (
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              onClick={() => updateField(opts.toggleKey!, !checked as never)}
              title={checked ? 'إخفاء هذا السطر من الفاتورة' : 'إظهار هذا السطر في الفاتورة'}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                checked ? 'bg-[#231710] justify-end' : 'bg-[#D6CBC0] justify-start'
              }`}
            >
              <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-all" />
            </button>
          )}
        </div>

        {checked && opts.textKey && (
          <div className="mt-2 space-y-1.5">
            {opts.multiline ? (
              <textarea
                rows={2}
                dir={opts.textDir || 'rtl'}
                value={textVal}
                onChange={(e) => updateField(opts.textKey!, e.target.value as never)}
                placeholder={opts.textPlaceholder}
                className="w-full bg-[#FAF6F0]/60 focus:bg-white border border-[#E8E0D5] focus:border-[#9A6836] rounded-lg px-2.5 py-1.5 text-xs text-[#231710] outline-none transition"
              />
            ) : (
              <input
                type="text"
                dir={opts.textDir || 'rtl'}
                value={textVal}
                onChange={(e) => updateField(opts.textKey!, e.target.value as never)}
                placeholder={opts.textPlaceholder}
                className="w-full bg-[#FAF6F0]/60 focus:bg-white border border-[#E8E0D5] focus:border-[#9A6836] rounded-lg px-2.5 py-1.5 text-xs text-[#231710] outline-none transition"
              />
            )}

            {opts.extraTextKey && (
              <input
                type="text"
                value={extraTextVal}
                onChange={(e) => updateField(opts.extraTextKey!, e.target.value as never)}
                placeholder={opts.extraTextPlaceholder}
                className="w-full bg-[#FAF6F0]/60 focus:bg-white border border-[#E8E0D5] focus:border-[#9A6836] rounded-lg px-2.5 py-1.5 text-xs text-[#231710] outline-none transition"
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const activeColumnsCount =
    2 + (draft.showQuantityColumn ? 1 : 0) + (draft.showUnitPriceColumn ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Top Studio Command Bar */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Receipt className="w-4 h-4 text-[#9A6836]" />
            <h3 className="text-base font-bold text-[#231710]">
              استوديو تصميم وإعدادات الفاتورة الحرارية
            </h3>
            {isDirty ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                تعديلات غير محفوظة
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                متطابق مع الإعداد المحفوظ
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B5644]">
            تحكّم في كل سطر من سطور الفاتورة إظهاراً وإخفاءً وتعديلاً وشاهد التغيير لحظياً في المعاينة الحية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#E8E0D5] text-[#6B5644] hover:text-[#231710] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            type="button"
            onClick={handleTestPrint}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EFE6D8] border border-[#DEC9AF] text-[#231710] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#9A6836]" />
            <span>طباعة بون تجريبي</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="min-h-[38px] px-5 py-1.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ إعدادات الفاتورة'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Controls (7 cols) + Sticky Live Thermal Preview (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* RIGHT: Controls Editor */}
        <div className="xl:col-span-7 space-y-4">
          {/* Quick Design Presets */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C88A4B]" />
                <h4 className="text-xs font-bold text-[#231710]">قوالب فاتورة جاهزة بنقرة واحدة</h4>
              </div>
              <span className="text-[11px] text-[#6B5644]">
                تقدر بعدها تتحكم في أي سطر بشكل فردي
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {RECEIPT_DESIGN_PRESETS.map((preset) => {
                const isSelected =
                  draft.paperWidthMm === preset.config.paperWidthMm &&
                  draft.headerStyle === preset.config.headerStyle &&
                  draft.dividerStyle === preset.config.dividerStyle &&
                  draft.fontSizeMode === preset.config.fontSizeMode;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.config)}
                    className={`text-right p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#231710] text-white border-[#231710]'
                        : 'bg-[#FAF6F0]/70 hover:bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold">{preset.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-white/15 text-[#D4AF37]'
                            : 'bg-white text-[#6B5644] border border-[#E8E0D5]'
                        }`}
                      >
                        {preset.badge}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] mt-1 leading-relaxed ${
                        isSelected ? 'text-white/75' : 'text-[#6B5644]'
                      }`}
                    >
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor Tabs Panel */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
            <div className="p-2 bg-[#FAF6F0]/80 border-b border-[#E8E0D5] flex flex-wrap gap-1.5">
              {[
                {
                  id: 'lines' as const,
                  label: `التحكم بكل سطر (${enabledLinesCount}/${ALL_LINE_TOGGLE_KEYS.length})`,
                  icon: ListChecks,
                },
                { id: 'layout' as const, label: 'الورق والخط والطابعة', icon: SlidersHorizontal },
                { id: 'logo' as const, label: 'الشعار وحجمه', icon: ImageIcon },
              ].map((sec) => {
                const Icon = sec.icon;
                const active = activeEditorTab === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveEditorTab(sec.id)}
                    className={`flex-1 min-w-[140px] min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'bg-[#231710] text-white'
                        : 'text-[#6B5644] hover:bg-white hover:text-[#231710]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 sm:p-5 space-y-5">
              {/* TAB 1: Full Line-by-Line Control (Top to Bottom of Receipt) */}
              {activeEditorTab === 'lines' && (
                <div className="space-y-5">
                  {/* Quick Bulk Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EDE5DA]">
                    <span className="text-xs text-[#6B5644]">
                      مرتّبة بنفس ترتيب ظهورها من أعلى الفاتورة لأسفلها — أوقف أو عدّل أي سطر فوراً
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={applyShowAllLines}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EFE6D8] border border-[#E8E0D5] text-[11px] font-bold text-[#231710] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-emerald-700" />
                        <span>إظهار الكل</span>
                      </button>
                      <button
                        type="button"
                        onClick={applyMinimalLines}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EFE6D8] border border-[#E8E0D5] text-[11px] font-bold text-[#231710] flex items-center gap-1 cursor-pointer"
                      >
                        <EyeOff className="w-3 h-3 text-[#9A6836]" />
                        <span>مختصر أساسي</span>
                      </button>
                    </div>
                  </div>

                  {/* ZONE 1: Header Lines */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#9A6836] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] inline-flex items-center justify-center text-[11px]">
                        1
                      </span>
                      <span>سطور ترويسة الفاتورة</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {renderLineControl({
                        toggleKey: 'showLogo',
                        title: 'شعار المتجر (اللوجو)',
                        sample: `${draft.logoSizePx}px — تعديل الشعار من تبويب الشعار`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showStoreName',
                        title: 'سطر اسم المتجر',
                        textKey: 'customStoreName',
                        textPlaceholder: settings.storeName || 'محمصة حفصة للبن والمكسرات',
                      })}
                      {renderLineControl({
                        toggleKey: 'showHeaderSubtitle',
                        title: 'السطر الفرعي أسفل الاسم',
                        textKey: 'headerSubtitle',
                        textPlaceholder: 'مثال: تحميص يومي طازج — بن مختص ومكسرات',
                      })}
                      {renderLineControl({
                        toggleKey: 'showAddress',
                        title: 'سطر عنوان الفرع',
                        textKey: 'customAddress',
                        textPlaceholder: settings.address || 'مركز بني مزار — أمام مسجد الزراعيين',
                      })}
                      {renderLineControl({
                        toggleKey: 'showPhone',
                        title: 'سطر الهاتف والواتساب',
                        textKey: 'customPhone',
                        textPlaceholder: settings.supportPhone || settings.whatsappNumber || '01107677672',
                      })}
                      {renderLineControl({
                        toggleKey: 'showInvoiceTitle',
                        title: 'شارة عنوان الفاتورة',
                        textKey: 'invoiceTitle',
                        textPlaceholder: 'مثال: فاتورة مبيعات معتمدة',
                      })}
                    </div>
                  </div>

                  {/* ZONE 2: Receipt & Customer Meta Lines */}
                  <div className="space-y-2 pt-3 border-t border-[#EDE5DA]">
                    <div className="text-xs font-bold text-[#9A6836] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] inline-flex items-center justify-center text-[11px]">
                        2
                      </span>
                      <span>سطور بيانات البون والعميل</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {renderLineControl({
                        toggleKey: 'showOrderNumber',
                        title: 'رقم البون / الفاتورة',
                        sample: `بون: #${sampleOrder.orderNumber}`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showOrderTime',
                        title: 'تاريخ ووقت الفاتورة',
                        sample: '٢٨/١١، ١٢:٣٧ م',
                      })}
                      {renderLineControl({
                        toggleKey: 'showCustomerName',
                        title: 'سطر اسم العميل',
                        sample: `العميل: ${sampleOrder.customerName}`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showPaymentMethod',
                        title: 'سطر طريقة الدفع',
                        sample: 'الدفع: نقدي (كاش)',
                      })}
                      {renderLineControl({
                        toggleKey: 'showCustomerPhone',
                        title: 'سطر هاتف العميل',
                        sample: `هاتف: ${sampleOrder.customerPhone}`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showCustomerGovernorate',
                        title: 'المدينة / المحافظة',
                        sample: sampleOrder.governorate,
                      })}
                      {renderLineControl({
                        toggleKey: 'showCustomerAddress',
                        title: 'سطر عنوان التوصيل (لطلبات الأونلاين)',
                        sample: 'العنوان: شارع الجمهورية...',
                      })}
                    </div>
                  </div>

                  {/* ZONE 3: Items Table Columns & Sub-lines */}
                  <div className="space-y-2 pt-3 border-t border-[#EDE5DA]">
                    <div className="text-xs font-bold text-[#9A6836] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] inline-flex items-center justify-center text-[11px]">
                        3
                      </span>
                      <span>أعمدة وسطور جدول الأصناف</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {renderLineControl({
                        toggleKey: 'showItemWeight',
                        title: 'وزن / عبوة الصنف بجانب الاسم',
                        sample: '(ربع 250 جم)',
                      })}
                      {renderLineControl({
                        toggleKey: 'showItemDetails',
                        title: 'سطر تفاصيل التحميص والتوليفة والمكونات',
                        sample: 'وسط محوج • 50% برازيلي...',
                      })}
                      {renderLineControl({
                        toggleKey: 'showQuantityColumn',
                        title: 'عمود الكمية بالجدول',
                        sample: 'كمية',
                      })}
                      {renderLineControl({
                        toggleKey: 'showUnitPriceColumn',
                        title: 'عمود سعر الوحدة بالجدول',
                        sample: 'سعر (إخفاؤه يوسّع الاسم في 58مم)',
                      })}
                    </div>
                  </div>

                  {/* ZONE 4: Totals & Payment Lines */}
                  <div className="space-y-2 pt-3 border-t border-[#EDE5DA]">
                    <div className="text-xs font-bold text-[#9A6836] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] inline-flex items-center justify-center text-[11px]">
                        4
                      </span>
                      <span>سطور الإجماليات والخصومات والدفع</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {renderLineControl({
                        toggleKey: 'showItemCount',
                        title: 'سطر عدد القطع',
                        sample: 'عدد القطع: 3',
                      })}
                      {renderLineControl({
                        toggleKey: 'showSubtotal',
                        title: 'سطر المجموع الفرعي',
                        sample: `المجموع: 660 ${currency}`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showDiscount',
                        title: 'سطر الخصم / الكوبون',
                        sample: `الخصم: -20 ${currency}`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showVipRedeemed',
                        title: 'سطر خصم محفظة VIP',
                        sample: `خصم محفظة VIP: -15 ${currency}`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showTaxDetails',
                        title: 'سطور الضريبة (ض.ق.م والرقم الضريبي)',
                        sample: 'تظهر عند تفعيل الضريبة',
                      })}
                      {renderLineControl({
                        toggleKey: 'showShippingCost',
                        title: 'سطر مصاريف التوصيل',
                        sample: `التوصيل: +20 ${currency}`,
                      })}
                      {renderLineControl({
                        title: 'نص سطر الإجمالي النهائي (ثابت)',
                        textKey: 'totalLabel',
                        textPlaceholder: 'الإجمالي المطلوب:',
                      })}
                      {renderLineControl({
                        toggleKey: 'showPaymentBreakdown',
                        title: 'سطور الدفع المقسم والآجل',
                        sample: 'تفصيل الدفع المقسم / آجل',
                      })}
                      {renderLineControl({
                        toggleKey: 'showCashTenderedAndChange',
                        title: 'سطر المدفوع والباقي',
                        sample: `المدفوع: 700 • الباقي: 75 ${currency}`,
                      })}
                      {renderLineControl({
                        toggleKey: 'showVipCashback',
                        title: 'سطر كاش باك VIP المضاف',
                        sample: `كاش باك VIP المضاف: +31 ${currency}`,
                      })}
                    </div>
                  </div>

                  {/* ZONE 5: Barcode, QR & Footer Lines */}
                  <div className="space-y-2 pt-3 border-t border-[#EDE5DA]">
                    <div className="text-xs font-bold text-[#9A6836] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] inline-flex items-center justify-center text-[11px]">
                        5
                      </span>
                      <span>سطور أسفل الفاتورة والباركود والـ QR</span>
                    </div>
                    <div className="space-y-2">
                      {renderLineControl({
                        toggleKey: 'showReturnPolicy',
                        title: 'صندوق سياسة الاستبدال والاسترجاع',
                        textKey: 'returnPolicyText',
                        multiline: true,
                        textPlaceholder:
                          'الاستبدال أو الاسترجاع خلال 24 ساعة بأصل الفاتورة وفي نفس حالة الشراء.',
                      })}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {renderLineControl({
                          toggleKey: 'showBarcode',
                          title: 'باركود رقم الفاتورة (Code 128)',
                          sample: sampleOrder.orderNumber,
                        })}
                        {renderLineControl({
                          toggleKey: 'showQrCode',
                          title: 'رمز المسح الضوئي (QR Code)',
                          textKey: 'qrCodeUrl',
                          textDir: 'ltr',
                          textPlaceholder: 'https://hafsahnuts.com',
                          extraTextKey: 'qrCodeCaption',
                          extraTextPlaceholder: 'النص أسفل رمز QR (مثال: امسح الكود للطلب الأونلاين)',
                        })}
                      </div>
                      {renderLineControl({
                        toggleKey: 'showPromoLine',
                        title: 'سطر الرسالة الترويجية',
                        textKey: 'promoLine',
                        textPlaceholder: 'اطلب أونلاين من hafsahnuts.com وخد 5% كاش باك في محفظتك!',
                      })}
                      {renderLineControl({
                        toggleKey: 'showFooterMessage',
                        title: 'سطر رسالة الشكر الختامية',
                        textKey: 'footerMessage',
                        textPlaceholder: 'شكراً لتسوقكم معنا • نتشرف بخدمتكم دائماً',
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Paper, Typography & Printer Hardware */}
              {activeEditorTab === 'layout' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Paper Width */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        مقاس رول الطابعة الحرارية
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([80, 58] as const).map((mm) => (
                          <button
                            key={mm}
                            type="button"
                            onClick={() => updateField('paperWidthMm', mm)}
                            className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                              draft.paperWidthMm === mm
                                ? 'bg-[#231710] text-white border-[#231710]'
                                : 'bg-[#FAF6F0]/70 text-[#231710] border-[#E8E0D5] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            <div className="text-xs font-bold">{mm} مم</div>
                            <div
                              className={`text-[10px] mt-0.5 ${
                                draft.paperWidthMm === mm ? 'text-white/75' : 'text-[#6B5644]'
                              }`}
                            >
                              {mm === 80 ? 'عريض سوبرماركت (74mm)' : 'مدمج ضيق RP58 (52mm)'}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font Size Scale */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        حجم خط الفاتورة
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'compact', label: 'مضغوط' },
                            { id: 'normal', label: 'قياسي' },
                            { id: 'large', label: 'كبير واضح' },
                          ] as Array<{ id: ReceiptFontSizeMode; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateField('fontSizeMode', opt.id)}
                            className={`min-h-[42px] px-2 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              draft.fontSizeMode === opt.id
                                ? 'bg-[#231710] text-white border-[#231710]'
                                : 'bg-[#FAF6F0]/70 text-[#231710] border-[#E8E0D5] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Header Style */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        نمط ترويسة الفاتورة
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'classic', label: 'كلاسيكي' },
                            { id: 'boxed', label: 'إطار بارز' },
                            { id: 'minimal', label: 'مبسط سريع' },
                          ] as Array<{ id: ReceiptHeaderStyle; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateField('headerStyle', opt.id)}
                            className={`min-h-[40px] px-2 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              draft.headerStyle === opt.id
                                ? 'bg-[#231710] text-white border-[#231710]'
                                : 'bg-[#FAF6F0]/70 text-[#231710] border-[#E8E0D5] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Divider Style */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#231710]">
                        شكل الخطوط الفاصلة
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'dashed', label: 'متقطع ---' },
                            { id: 'solid', label: 'متصل ───' },
                            { id: 'double', label: 'مزدوج ═══' },
                          ] as Array<{ id: ReceiptDividerStyle; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateField('dividerStyle', opt.id)}
                            className={`min-h-[40px] px-2 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              draft.dividerStyle === opt.id
                                ? 'bg-[#231710] text-white border-[#231710]'
                                : 'bg-[#FAF6F0]/70 text-[#231710] border-[#E8E0D5] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Hardware Printer Controls */}
                  <div className="pt-3 border-t border-[#E8E0D5] space-y-2.5">
                    <div className="text-xs font-bold text-[#231710]">
                      سلوك الطابعة الحرارية ودرج النقدية
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6F0]/75 border border-[#E8E0D5] cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            الطباعة الصامتة المباشرة (ESC/POS)
                          </div>
                          <div className="text-[11px] text-[#6B5644] mt-0.5">
                            إرسال الفاتورة فوراً بدون نافذة معاينة المتصفح
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={escPosEnabled}
                          onClick={() => setEscPosEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            escPosEnabled ? 'bg-[#231710] justify-end' : 'bg-[#D6CBC0] justify-start'
                          }`}
                        >
                          <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-all" />
                        </button>
                      </label>

                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6F0]/75 border border-[#E8E0D5] cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-[#231710]">
                            فتح درج النقدية تلقائياً (RJ11)
                          </div>
                          <div className="text-[11px] text-[#6B5644] mt-0.5">
                            إرسال نبضة فتح الدرج فور إتمام الطباعة
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoDrawerEnabled}
                          onClick={() => setAutoDrawerEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            autoDrawerEnabled
                              ? 'bg-[#231710] justify-end'
                              : 'bg-[#D6CBC0] justify-start'
                          }`}
                        >
                          <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-all" />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Logo Settings */}
              {activeEditorTab === 'logo' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderLineControl({
                      toggleKey: 'showLogo',
                      title: 'إظهار شعار المتجر أعلى الفاتورة',
                      sample: 'أبيض وأسود عالي التباين',
                    })}

                    <div className="p-3 rounded-xl bg-[#FAF6F0]/75 border border-[#E8E0D5] space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-[#231710]">
                        <span>حجم الشعار المطبوع</span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-[#E8E0D5] text-[11px]">
                          {draft.logoSizePx} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={32}
                        max={76}
                        step={2}
                        value={draft.logoSizePx}
                        disabled={!draft.showLogo}
                        onChange={(e) => updateField('logoSizePx', Number(e.target.value))}
                        className="w-full accent-[#231710] cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#FAF6F0]/60 border border-[#E8E0D5] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#231710]">
                        اختيار شعار سريع أو رفع شعار خاص للفاتورة
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {BRAND_LOGO_CHOICES.map((ch) => (
                          <button
                            key={ch.url}
                            type="button"
                            onClick={() => {
                              updateField('showLogo', true);
                              updateField('logoUrl', ch.url);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              draft.logoUrl === ch.url
                                ? 'bg-[#231710] text-white border-[#231710]'
                                : 'bg-white text-[#6B5644] border-[#E8E0D5] hover:text-[#231710]'
                            }`}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ImageUploadDropzone
                      compact
                      label="رفع صورة شعار مخصص للفاتورة"
                      currentImage={draft.logoUrl}
                      onImageSelected={(url) => {
                        updateField('showLogo', true);
                        updateField('logoUrl', url);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEFT: Sticky Live Thermal Paper Preview Stage */}
        <div className="xl:col-span-5 xl:sticky xl:top-20 space-y-3">
          <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden shadow-xs">
            {/* Preview Stage Top Bar */}
            <div className="p-3 bg-[#FAF6F0] border-b border-[#E8E0D5] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <Eye className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span className="text-xs font-bold text-[#231710]">
                    معاينة حية للفاتورة ({draft.paperWidthMm} مم)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[#6B5644]">
                  {activeColumnsCount} أعمدة • خط {metrics.baseFontPx}px
                </span>
              </div>

              {/* Sample Order Scenario Switcher */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'pos_cash' as const, label: 'فاتورة كاشير', icon: Store },
                  { id: 'online_delivery' as const, label: 'طلب توصيل', icon: Truck },
                  { id: 'tax_invoice' as const, label: 'إيصال ضريبي', icon: FileText },
                ].map((sc) => {
                  const Icon = sc.icon;
                  const active = previewScenario === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setPreviewScenario(sc.id)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                        active
                          ? 'bg-[#231710] text-white'
                          : 'bg-white text-[#6B5644] border border-[#E8E0D5] hover:text-[#231710]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{sc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dark Thermal Printer Tray Background */}
            <div className="bg-[#211C19] px-4 py-6 flex flex-col items-center justify-start max-h-[76vh] overflow-y-auto">
              {/* Printer Output Slot Illusion */}
              <div
                className="h-2.5 rounded-full bg-black/75 border border-white/10 shadow-inner mb-[-4px] z-10 transition-all duration-300"
                style={{ width: `${metrics.previewWidthPx + 22}px`, maxWidth: '100%' }}
              />

              {/* Thermal Paper Sheet */}
              <div
                className="bg-white text-black shadow-2xl transition-all duration-300 relative"
                style={{
                  width: `${metrics.previewWidthPx}px`,
                  maxWidth: '100%',
                  padding: draft.paperWidthMm === 58 ? '12px 9px 14px 9px' : '14px 12px 16px 12px',
                }}
              >
                <div ref={previewRef}>
                  <ThermalReceiptOrderContent
                    order={sampleOrder}
                    settings={settings}
                    receiptConfig={draft}
                    forceTaxPreview={previewScenario === 'tax_invoice'}
                  />
                </div>

                {/* Realistic Torn Thermal Paper Bottom Edge */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-2 h-2"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, #ffffff 50%, transparent 50%), linear-gradient(225deg, #ffffff 50%, transparent 50%)',
                    backgroundPosition: '0 0, 0 0',
                    backgroundSize: '10px 10px',
                    backgroundRepeat: 'repeat-x',
                  }}
                />
              </div>

              <div className="mt-5 text-[11px] text-white/60 text-center">
                الشكل المعروض مطابق 100% للنسخة المطبوعة على طابعة {draft.paperWidthMm} مم ({currency})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
