'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, MessageCircle, Usb, Archive } from 'lucide-react';
import { Order, PosReturnRecord, PosShift, StoreSettings } from '@/types/store';
import { formatWhatsAppPhone } from '@/lib/validation';
import { getCityName, getCurrencySymbol, getResolvedReceiptConfig } from '@/lib/defaults';
import { Code128BarcodeSvg } from '@/lib/barcode-svg';
import {
  ThermalReceiptOrderContent,
  buildThermalReceiptPrintHtml,
} from '@/components/receipt/ThermalReceiptDocument';
import {
  openCashDrawerDirect,
  printReceiptElementEscPos,
} from '@/lib/escpos-printer';

export interface StickerPreviewData {
  title: string;
  weightLabel: string;
  roastOrSpec: string;
  price: number;
  barcode: string;
  date: string;
  recipeLines?: string[];
  baristaNotes?: string;
}

interface SupermarketReceiptModalProps {
  order?: Order | null;
  sticker?: StickerPreviewData | null;
  shift?: PosShift | null;
  returnRecord?: PosReturnRecord | null;
  mode?: 'receipt' | 'sticker' | 'zreport' | 'return';
  settings?: StoreSettings;
  autoPrintOnMount?: boolean;
  showProfit?: boolean;
  onClose: () => void;
}

export default function SupermarketReceiptModal({
  order,
  sticker,
  shift,
  returnRecord,
  mode = 'receipt',
  settings,
  autoPrintOnMount = false,
  showProfit = false,
  onClose,
}: SupermarketReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [escPosStatus, setEscPosStatus] = useState<string>('');
  const [escPosBusy, setEscPosBusy] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const receiptConfig = getResolvedReceiptConfig(settings);
  const configuredPaperWidthMm = receiptConfig.paperWidthMm;
  const isNarrow58 = mode === 'sticker' || configuredPaperWidthMm === 58;

  // Print strictly the receipt/sticker/Z-report HTML in an isolated 80mm/58mm auto-height frame
  // so the paper length matches ONLY the items on the receipt (like any supermarket POS).
  // When running inside MizanPOS Desktop (.exe), prints SILENTLY directly to the configured Windows thermal printer!
  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;

    const receiptHtml = receiptRef.current.innerHTML;
    const isSticker = mode === 'sticker';
    const fullHtml = buildThermalReceiptPrintHtml({
      receiptHtml,
      title: order
        ? `فاتورة ${order.orderNumber}`
        : `بون ${receiptConfig.customStoreName.trim() || settings?.storeName || 'المتجر'}`,
      config: receiptConfig,
      isSticker,
    });

    // Native Hybrid Desktop Silent Print (zero dialog, works with any Windows thermal printer)
    const desktopBridge = (window as unknown as {
      mizanDesktop?: {
        isDesktop?: boolean;
        printSilent?: (p: { html: string; paperWidthMm?: number }) => Promise<{ ok: boolean; error?: string }>;
        openCashDrawer?: () => Promise<{ ok: boolean }>;
      };
    }).mizanDesktop;

    if (desktopBridge?.isDesktop && desktopBridge.printSilent) {
      desktopBridge
        .printSilent({ html: fullHtml, paperWidthMm: isNarrow58 ? 58 : 80 })
        .then((res) => {
          setEscPosStatus(
            res?.ok
              ? 'تمت الطباعة الحرارية الصامتة مباشرة عبر نسخة الديسك توب'
              : res?.error || 'تعذر الطباعة الصامتة'
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
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(fullHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 120);
  };

  const handleDirectEscPosPrint = async (kickDrawer?: boolean) => {
    if (!receiptRef.current || escPosBusy) return;
    setEscPosBusy(true);
    setEscPosStatus('');
    try {
      const shouldKick =
        kickDrawer ??
        (settings?.autoOpenCashDrawer !== false &&
          (mode === 'receipt' || mode === 'return'));
      const res = await printReceiptElementEscPos(receiptRef.current, {
        paperWidthMm: isNarrow58 ? 58 : 80,
        openCashDrawer: shouldKick,
        cutPaper: true,
      });
      if (res.success) {
        setEscPosStatus(
          shouldKick
            ? 'تمت الطباعة الحرارية الصامتة وفتح الدرج بنجاح'
            : 'تمت الطباعة الحرارية الصامتة بنجاح'
        );
      } else {
        setEscPosStatus(res.error || 'تعذر الاتصال بالطابعة الحرارية المباشرة');
      }
    } finally {
      setEscPosBusy(false);
    }
  };

  const handleKickDrawerOnly = async () => {
    if (escPosBusy) return;
    setEscPosBusy(true);
    setEscPosStatus('');
    try {
      const desktopBridge = (window as unknown as {
        mizanDesktop?: { isDesktop?: boolean; openCashDrawer?: () => Promise<{ ok: boolean }> };
      }).mizanDesktop;
      if (desktopBridge?.isDesktop && desktopBridge.openCashDrawer) {
        const dRes = await desktopBridge.openCashDrawer();
        setEscPosStatus(
          dRes?.ok ? 'تم فتح درج النقدية عبر نسخة الديسك توب بنجاح' : 'تعذر فتح درج النقدية'
        );
        return;
      }
      const res = await openCashDrawerDirect();
      if (res.success) {
        setEscPosStatus('تم إرسال نبضة فتح درج النقدية (ESC p) بنجاح');
      } else {
        setEscPosStatus(res.error || 'تعذر فتح درج النقدية');
      }
    } finally {
      setEscPosBusy(false);
    }
  };

  useEffect(() => {
    if (!mounted || (!order && !sticker && !shift && !returnRecord)) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, order, sticker, shift, returnRecord, onClose]);

  useEffect(() => {
    if (mounted && autoPrintOnMount && (order || sticker || shift || returnRecord)) {
      const timer = setTimeout(async () => {
        if (settings?.enableDirectEscPosPrint && receiptRef.current) {
          const res = await printReceiptElementEscPos(receiptRef.current, {
            paperWidthMm: isNarrow58 ? 58 : 80,
            openCashDrawer:
              settings?.autoOpenCashDrawer !== false &&
              (mode === 'receipt' || mode === 'return'),
            cutPaper: true,
          });
          if (res.success) {
            setEscPosStatus('تمت الطباعة الصامتة (ESC/POS) تلقائياً');
            return;
          }
        }
        handlePrintReceipt();
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [mounted, autoPrintOnMount, order, sticker, shift, returnRecord]);

  if (!mounted || (!order && !sticker && !shift && !returnRecord)) return null;

  const storePhone = settings?.supportPhone || settings?.whatsappNumber || '01107677672';
  const storeName =
    receiptConfig.customStoreName.trim() || settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const storeAddress = settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة';
  const cityName = getCityName(settings);
  const currency = getCurrencySymbol(settings);

  const isTaxReceipt = Boolean(
    settings?.enableTax || (order?.taxAmount && order.taxAmount > 0)
  );

  const modalContent = (
    <div
      id="supermarket-receipt-portal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto print:static print:bg-white print:p-0 print:block"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body > *:not(#supermarket-receipt-portal) {
                display: none !important;
              }
              #supermarket-receipt-portal {
                position: static !important;
                width: ${isNarrow58 ? '52mm' : '74mm'} !important;
                max-width: ${isNarrow58 ? '52mm' : '74mm'} !important;
                height: fit-content !important;
                min-height: 0 !important;
                margin: 0 auto !important;
                padding: 1.5mm !important;
                background: #ffffff !important;
              }
            }
          `,
        }}
      />

      <div
        className={`flex flex-col items-center max-h-[94vh] w-full ${
          isNarrow58 ? 'max-w-[260px]' : 'max-w-[325px]'
        } print:max-h-none print:max-w-none print:w-full`}
      >
        {/* Top Action Bar (Hidden in Print) */}
        <div className="w-full bg-[#231710] text-white rounded-t-2xl px-3.5 py-2.5 flex items-center justify-between border-b border-[#D4AF37]/40 no-print print:hidden">
          <span className="font-cairo font-black text-xs text-[#D4AF37]">
            {mode === 'sticker'
              ? 'استيكر الميزان'
              : mode === 'zreport'
                ? 'تقرير تقفيل الوردية (Z-Report)'
                : mode === 'return'
                  ? 'إيصال مرتجع مبيعات حراري'
                  : isTaxReceipt
                    ? 'إيصال ضريبي إلكتروني حراري'
                    : 'بون سوبر ماركت حراري'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleKickDrawerOnly}
              disabled={escPosBusy}
              title="فتح درج النقدية مباشرة (ESC p)"
              className="bg-white/10 hover:bg-white/20 text-[#D4AF37] p-1.5 rounded-lg cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="bg-[#D4AF37] hover:bg-[#c9a12b] text-[#231710] font-cairo font-black text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة البون</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white p-1 rounded-lg cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {escPosStatus && (
          <div className="w-full bg-amber-50 text-amber-950 text-[11px] font-cairo font-bold px-3 py-1.5 border-x border-amber-200 text-center no-print print:hidden">
            {escPosStatus}
          </div>
        )}

        {/* Thermal Receipt Paper Roll (Exact Supermarket Width & Auto Height by Items) */}
        <div className="w-full bg-white text-black shadow-2xl overflow-y-auto px-3 py-2.5 border-x border-gray-300 print:shadow-none print:border-0 print:p-0 print:overflow-visible">
          <div id="supermarket-receipt-print-area" ref={receiptRef}>
            {mode === 'sticker' && sticker ? (
              /* COMPACT 58x40mm BARCODE SCALE / BARISTA STICKER */
              <div className="sr-center space-y-1">
                <div className="sr-black text-xs">{storeName}</div>
                <hr className="sr-divider" />
                <div className="sr-black text-sm">{sticker.title}</div>
                <div className="sr-bold text-[11px]">
                  {sticker.weightLabel} • {sticker.roastOrSpec}
                </div>
                {Array.isArray(sticker.recipeLines) && sticker.recipeLines.length > 0 && (
                  <div className="text-[11px] border border-dashed border-black/40 rounded p-1 text-right space-y-0.5 my-1 bg-black/5">
                    <div className="font-bold text-[11px] text-center">مكونات الخلطة / البوكس:</div>
                    {sticker.recipeLines.map((line, idx) => (
                      <div key={idx} className="leading-tight">• {line}</div>
                    ))}
                  </div>
                )}
                {sticker.baristaNotes && (
                  <div className="text-[11px] italic text-center text-black/80">{sticker.baristaNotes}</div>
                )}
                <div className="sr-total-box sr-center">السعر: {sticker.price} ج.م</div>
                <div className="sr-barcode">
                  <Code128BarcodeSvg value={sticker.barcode} height={32} showText={true} />
                </div>
                <div className="text-[11px]">تاريخ التعبئة: {sticker.date} • {cityName}</div>
              </div>
            ) : mode === 'zreport' && shift ? (
              /* COMPACT 80mm SHIFT Z-REPORT SLIP */
              <div>
                <div className="sr-center">
                  <div className="sr-black text-sm">{storeName}</div>
                  <div className="text-[11px] sr-bold">تقرير تقفيل وردية الكاشير (Z-Report)</div>
                  {shift.registerName && (
                    <div className="text-[11px] sr-bold">الجهاز: {shift.registerName}</div>
                  )}
                </div>
                <hr className="sr-divider" />
                <div className="text-[11px]">
                  <div className="sr-row">
                    <span>رقم الوردية:</span>
                    <span className="sr-black">{shift.shiftNumber}</span>
                  </div>
                  <div className="sr-row">
                    <span>الكاشير:</span>
                    <span className="sr-bold">{shift.cashierName}</span>
                  </div>
                  <div className="sr-row">
                    <span>الفترة:</span>
                    <span>{shift.shiftPeriod}</span>
                  </div>
                  <hr className="sr-divider" />
                  <div className="sr-row">
                    <span>رصيد بداية الدرج:</span>
                    <span>{shift.openingCash} ج.م</span>
                  </div>
                  <div className="sr-row">
                    <span>مبيعات الكاش النقدية:</span>
                    <span className="sr-bold">+{shift.cashSalesTotal} ج.م</span>
                  </div>
                  <div className="sr-row">
                    <span>مبيعات ماكينة الفيزا:</span>
                    <span className="sr-bold">+{shift.cardSales || shift.cardSalesTotal || 0} ج.م</span>
                  </div>
                  <div className="sr-row">
                    <span>فودافون كاش + إنستاباي:</span>
                    <span>{shift.vodafoneCashTotal + shift.instapayTotal} ج.م</span>
                  </div>
                  {(shift.creditSalesTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>مبيعات آجلة (ذمم):</span>
                      <span>{shift.creditSalesTotal} ج.م</span>
                    </div>
                  )}
                  {(shift.debtCollectionsCashTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>تحصيل مديونيات نقداً:</span>
                      <span className="sr-bold">+{shift.debtCollectionsCashTotal} ج.م</span>
                    </div>
                  )}
                  <div className="sr-row">
                    <span>مصروفات الدرج النثرية:</span>
                    <span>-{shift.expensesTotal} ج.م</span>
                  </div>
                  {shift && (shift.riderCodSettledTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>توريدات عهدة المناديب (COD):</span>
                      <span className="sr-bold">+{shift.riderCodSettledTotal} ج.م</span>
                    </div>
                  )}
                  {(shift.cashReturnsTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>مرتجعات مبيعات نقدية:</span>
                      <span>-{shift.cashReturnsTotal} ج.م</span>
                    </div>
                  )}
                  <div className="sr-total-box sr-row">
                    <span>النقدية بالدرج:</span>
                    <span>{shift.expectedCashInDrawer} ج.م</span>
                  </div>
                  {((shift.cupsOpeningCount || 0) > 0 || (shift.cupsSoldCount || 0) > 0) && (
                    <div className="text-[11px] border border-dashed border-black/40 rounded p-1 my-1 space-y-0.5">
                      <div className="sr-bold">جرد عدّاد الأكواب الفارغة (بار القهوة):</div>
                      <div className="sr-row">
                        <span>عهدة الأكواب أول الوردية:</span>
                        <span>{shift.cupsOpeningCount || 0}</span>
                      </div>
                      <div className="sr-row">
                        <span>الأكواب المباعة على الكاشير:</span>
                        <span>-{shift.cupsSoldCount || 0}</span>
                      </div>
                      <div className="sr-row sr-bold">
                        <span>الأكواب المتوقعة المتبقية:</span>
                        <span>
                          {shift.cupsExpectedRemaining ??
                            Math.max(0, (shift.cupsOpeningCount || 0) - (shift.cupsSoldCount || 0))}
                        </span>
                      </div>
                      {shift.cupsActualRemaining !== undefined && (
                        <>
                          <div className="sr-row">
                            <span>الجرد الفعلي للأكواب:</span>
                            <span className="sr-bold">{shift.cupsActualRemaining}</span>
                          </div>
                          <div className="sr-row sr-black">
                            <span>فارق الأكواب:</span>
                            <span>
                              {(shift.cupsDifference || 0) > 0
                                ? `+${shift.cupsDifference}`
                                : shift.cupsDifference || 0}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {showProfit && typeof shift.totalNetProfit === 'number' && (
                    <div className="sr-row sr-bold">
                      <span>صافي الربح الفعلي:</span>
                      <span>+{shift.totalNetProfit} ج.م</span>
                    </div>
                  )}
                </div>
                <hr className="sr-divider" />
                <div className="sr-center text-[11px]">
                  تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}
                </div>
              </div>
            ) : mode === 'return' && returnRecord ? (
              /* COMPACT 80mm POS RETURN / REFUND RECEIPT */
              <div>
                <div className="sr-center">
                  <div className="sr-black text-sm">{storeName}</div>
                  <div className="text-[11px] sr-black">إيصال مرتجع مبيعات (بون استرداد)</div>
                  <div className="text-[11px]">ت: {storePhone}</div>
                </div>
                <hr className="sr-divider" />
                <div className="text-[11px]">
                  <div className="sr-row">
                    <span className="sr-black">رقم المرتجع: {returnRecord.returnNumber}</span>
                    <span>{new Date(returnRecord.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="sr-row">
                    <span>الفاتورة الأصلية: #{returnRecord.orderNumber}</span>
                    <span>الموظف: {returnRecord.processedBy}</span>
                  </div>
                  <div className="sr-row">
                    <span>طريقة الرد:</span>
                    <span className="sr-bold">
                      {returnRecord.refundMethod === 'cash'
                        ? 'نقداً من الدرج'
                        : returnRecord.refundMethod === 'vip_wallet'
                          ? 'إضافة بمحفظة VIP'
                          : returnRecord.refundMethod === 'credit_deduction'
                            ? 'خصم مديونية آجلة'
                            : 'رد إلكتروني'}
                    </span>
                  </div>
                  {returnRecord.reason && (
                    <div className="text-[11px] mt-0.5">السبب: {returnRecord.reason}</div>
                  )}
                </div>

                <table className="sr-table">
                  <thead>
                    <tr>
                      <th style={{ width: '58%' }}>الصنف المرتجع</th>
                      <th style={{ width: '16%', textAlign: 'center' }}>كمية</th>
                      <th style={{ width: '26%', textAlign: 'left' }}>المسترد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnRecord.items.map((ri, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="sr-black">
                            {ri.productName}
                            {ri.unitLabel ? ` (${ri.unitLabel})` : ''}
                          </div>
                          <div className="sr-sub">
                            {ri.condition === 'damaged' ? 'حالة: تالف/هالك' : 'حالة: سليم للمخزن'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }} className="sr-bold">
                          {ri.returnQty}
                        </td>
                        <td style={{ textAlign: 'left' }} className="sr-black">
                          {ri.refundAmount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="sr-total-box sr-row">
                  <span>إجمالي المبلغ المسترد:</span>
                  <span>{returnRecord.totalRefundAmount} ج.م</span>
                </div>
                <div className="sr-barcode">
                  <Code128BarcodeSvg value={returnRecord.returnNumber} height={34} showText={true} />
                </div>
                <div className="sr-center text-[11px] sr-bold">
                  شكراً لتعاملكم مع {storeName}
                </div>
              </div>
            ) : (
              order && (
                /* DYNAMIC THERMAL RECEIPT POWERED BY ADMIN RECEIPT STUDIO CONFIG */
                <ThermalReceiptOrderContent
                  order={order}
                  settings={settings}
                  receiptConfig={receiptConfig}
                  shift={shift}
                />
              )
            )}
          </div>
        </div>

        {/* Bottom Action Bar (Hidden in Print) */}
        <div className="w-full bg-[#231710] text-white rounded-b-2xl p-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#D4AF37]/40 no-print print:hidden">
          <button
            type="button"
            autoFocus={!autoPrintOnMount}
            onClick={handlePrintReceipt}
            className="flex-1 min-w-[130px] bg-[#D4AF37] hover:bg-[#c9a12b] text-[#231710] font-cairo font-black text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>طباعة المتصفح</span>
          </button>

          <button
            type="button"
            disabled={escPosBusy}
            onClick={() => handleDirectEscPosPrint()}
            title="طباعة حرارية صامتة مباشرة عبر USB/Serial + فتح الدرج"
            className="bg-white/15 hover:bg-white/25 text-white font-cairo font-bold text-[11px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
          >
            <Usb className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span>{escPosBusy ? 'جارٍ...' : 'ESC/POS + الدرج'}</span>
          </button>

          {order &&
            order.customerPhone &&
            order.customerPhone !== '01000000000' && (
              <a
                href={`https://wa.me/${formatWhatsAppPhone(
                  order.customerPhone
                )}?text=${encodeURIComponent(
                  `فاتورة ${storeName} #${order.orderNumber}\nالإجمالي: ${order.total} ${currency}\nكاش باك VIP: +${
                    order.vipCashbackEarned || 0
                  } ${currency}\nشكراً لزيارتك ${storeName} (${storeAddress})`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[#3B6E4C] hover:bg-[#2f5a3d] text-white font-cairo font-black text-xs px-2.5 py-2 rounded-xl flex items-center gap-1"
                title="إرسال واتساب"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </a>
            )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
