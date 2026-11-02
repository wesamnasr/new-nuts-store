'use client';

import React, { useState, useMemo } from 'react';
import {
  Truck,
  Volume2,
  RefreshCw,
  Printer,
  MessageCircle,
  Tag,
  Search,
  Columns3,
  LayoutGrid,
} from 'lucide-react';
import { CartItem, Order, OrderStatus } from '@/types/store';
import { formatWhatsAppPhone } from '@/lib/validation';
import { StickerPreviewData } from '@/components/SupermarketReceiptModal';

interface PosOnlineOrdersPageProps {
  onlineQueueOrders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onPrintOrderReceipt: (order: Order) => void;
  onPrintSticker: (sticker: StickerPreviewData) => void;
  onRefresh: () => void;
  playCashierBeep: (freq?: number, duration?: number) => void;
  deliveryFilter?: 'all' | 'bandar_fast' | 'villages_scheduled' | 'store_pickup';
  onChangeDeliveryFilter?: (
    filter: 'all' | 'bandar_fast' | 'villages_scheduled' | 'store_pickup'
  ) => void;
  availableRiders?: Array<{ id: string; displayName?: string; username?: string }>;
  onAssignRider?: (orderId: string, riderId: string, riderName: string) => Promise<void>;
  onSettleRiderCod?: (payload: { orderId?: string; settleAll?: boolean }) => Promise<void>;
}

export default function PosOnlineOrdersPage({
  onlineQueueOrders,
  onUpdateOrderStatus,
  onPrintOrderReceipt,
  onPrintSticker,
  onRefresh,
  playCashierBeep,
  deliveryFilter: externalDeliveryFilter,
  onChangeDeliveryFilter,
  availableRiders,
  onAssignRider,
  onSettleRiderCod,
}: PosOnlineOrdersPageProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'grid'>('kanban');
  const [internalDeliveryFilter, setInternalDeliveryFilter] = useState<
    'all' | 'bandar_fast' | 'villages_scheduled' | 'store_pickup'
  >('all');
  const deliveryFilter = externalDeliveryFilter ?? internalDeliveryFilter;
  const setDeliveryFilter = (
    val: 'all' | 'bandar_fast' | 'villages_scheduled' | 'store_pickup'
  ) => {
    setInternalDeliveryFilter(val);
    onChangeDeliveryFilter?.(val);
  };
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const unsettledCodOrders = useMemo(
    () =>
      onlineQueueOrders.filter(
        (o) =>
          o.status === 'delivered' &&
          o.paymentMethod === 'cod' &&
          o.orderSource !== 'pos' &&
          !o.riderCodSettled
      ),
    [onlineQueueOrders]
  );

  const unsettledCodTotal = useMemo(
    () =>
      unsettledCodOrders.reduce(
        (sum, o) => sum + Math.max(0, Math.round(Number(o.cashCollected ?? o.total ?? 0))),
        0
      ),
    [unsettledCodOrders]
  );

  const filteredOrders = useMemo(() => {
    return onlineQueueOrders.filter((ord) => {
      if (deliveryFilter !== 'all') {
        const dm =
          ord.deliveryMethod ||
          (ord.address?.includes('استلام')
            ? 'store_pickup'
            : ord.villageName || ord.deliverySlot
              ? 'villages_scheduled'
              : 'bandar_fast');
        if (dm !== deliveryFilter) return false;
      }

      if (viewMode === 'grid' && statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          if (ord.status !== 'pending' && ord.status !== 'confirmed') return false;
        } else if (ord.status !== statusFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          ord.orderNumber.toLowerCase().includes(q) ||
          (ord.customerName || '').toLowerCase().includes(q) ||
          (ord.customerPhone || '').toLowerCase().includes(q) ||
          (ord.address || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [onlineQueueOrders, deliveryFilter, viewMode, statusFilter, searchQuery]);

  // Group into 4 Kanban Stages
  const kanbanColumns = useMemo(() => {
    const newOrders = filteredOrders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed'
    );
    const preparingOrders = filteredOrders.filter(
      (o) => o.status === 'roasting_packing'
    );
    const shippedOrders = filteredOrders.filter((o) => o.status === 'shipped');
    const deliveredOrders = filteredOrders.filter((o) => o.status === 'delivered');

    return [
      {
        id: 'pending',
        title: 'طلبات جديدة (قيد المراجعة)',
        badgeBg: 'bg-[#231710] text-white',
        headerBg: 'bg-white text-[#231710] border-b border-[#E8E0D5]',
        orders: newOrders,
      },
      {
        id: 'roasting_packing',
        title: 'جاري التحميص والتعبئة',
        badgeBg: 'bg-amber-100 text-amber-900',
        headerBg: 'bg-white text-[#231710] border-b border-[#E8E0D5]',
        orders: preparingOrders,
      },
      {
        id: 'shipped',
        title: 'خرج مع الدليفري / جاهز للاستلام',
        badgeBg: 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5]',
        headerBg: 'bg-white text-[#231710] border-b border-[#E8E0D5]',
        orders: shippedOrders,
      },
      {
        id: 'delivered',
        title: 'تم التسليم والتحصيل',
        badgeBg: 'bg-emerald-100 text-emerald-900',
        headerBg: 'bg-white text-[#231710] border-b border-[#E8E0D5]',
        orders: deliveredOrders,
      },
    ];
  }, [filteredOrders]);

  const handlePrintItemStickerFromOrder = (ord: Order, item: CartItem) => {
    let specText = item.roastOption || '';
    if (item.isCoffeeBlend && item.coffeeBlendSpec) {
      specText = item.coffeeBlendSpec.baristaLabel;
    } else if (item.isPartitionedBox && item.partitionedSlots) {
      specText = item.partitionedSlots
        .map((s) => `${s.productName} (${s.slotGrams || s.weightGrams}ج)`)
        .join(' + ');
    }
    onPrintSticker({
      title: `${item.productName} (#${ord.orderNumber})`,
      weightLabel: item.weightLabel,
      roastOrSpec: specText,
      price: item.unitPrice * item.quantity,
      barcode: item.barcodeLabel || `200001002507`,
      date: new Date().toLocaleDateString('ar-EG'),
    });
  };

  const renderOrderCard = (ord: Order) => {
    const dmLabel =
      ord.deliveryMethod === 'store_pickup' || ord.address?.includes('استلام')
        ? 'استلام من الفرع (Click & Collect)'
        : ord.deliveryMethod === 'villages_scheduled' || ord.deliverySlot
          ? `دورة قرى (${ord.deliverySlot || 'مجدول'})`
          : 'دليفري بندر بني مزار الفوري';

    const pmLabel =
      ord.paymentMethod === 'cod'
        ? 'الدفع عند الاستلام (كاش)'
        : ord.paymentMethod === 'vodafone_cash'
          ? 'فودافون كاش'
          : ord.paymentMethod === 'instapay'
            ? 'إنستاباي'
            : 'محفظة VIP';

    return (
      <div
        key={ord.id}
        className="bg-white rounded-2xl p-3.5 border border-[#E8E0D5] hover:border-[#C5B8A8] space-y-2.5 transition"
      >
        {/* Order Header */}
        <div className="flex items-start justify-between gap-2 border-b border-[#E8E0D5] pb-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-cairo font-bold text-sm text-[#231710]">
                #{ord.orderNumber}
              </span>
              <span className="text-xs font-bold text-[#231710]">
                — {ord.customerName}
              </span>
            </div>
            <p className="text-[11px] text-[#6B5B4E] tabular-nums">
              {ord.customerPhone} •{' '}
              {new Date(ord.createdAt).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <span className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0">
            {dmLabel}
          </span>
        </div>

        {/* Address & Notes */}
        <div className="bg-[#FAF6F0] p-2 rounded-xl border border-[#E8E0D5] text-[11px] space-y-1">
          <p className="font-medium text-[#231710]">{ord.address}</p>
          {ord.notes && (
            <p className="text-[#B83B2B] font-bold">ملاحظة العميل: {ord.notes}</p>
          )}
        </div>

        {/* Detailed Items Packing List */}
        <div className="space-y-1.5 text-xs">
          {ord.items.map((item, idx) => (
            <div
              key={idx}
              className="bg-[#FAF6F0]/70 rounded-xl p-2 border border-[#E8E0D5] space-y-1"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-cairo font-bold text-xs text-[#231710]">
                  {item.quantity}× {item.productName}{' '}
                  <span className="text-[10.5px] font-normal text-[#6B5B4E]">
                    ({item.weightLabel})
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0 tabular-nums">
                  <span className="font-bold text-[#231710]">
                    {item.unitPrice * item.quantity} ج
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePrintItemStickerFromOrder(ord, item)}
                    title="طباعة استيكر للصنف / التوليفة"
                    className="p-1 rounded bg-white border border-[#E8E0D5] text-[#9A6836] hover:bg-[#231710] hover:text-white cursor-pointer transition"
                  >
                    <Tag className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="text-[10.5px] text-[#6B5B4E] font-medium">
                {item.roastOption}
                {item.workerNotes && !item.isCoffeeBlend ? ` • ${item.workerNotes}` : ''}
              </div>

              {/* Partitioned Box Slots Breakdown for Worker */}
              {item.isPartitionedBox &&
                item.partitionedSlots &&
                item.partitionedSlots.length > 0 && (
                  <div className="bg-white rounded-lg p-1.5 border border-[#E8E0D5] text-[10px] space-y-0.5">
                    <span className="font-bold text-[#9A6836] block">
                      تعبئة خانات البوكس:
                    </span>
                    {item.partitionedSlots.map((slot, sIdx) => (
                      <div key={sIdx} className="flex justify-between">
                        <span className="font-bold">
                          خ{slot.slotNumber || sIdx + 1}: {slot.productName}
                        </span>
                        <span>
                          {slot.slotGrams || slot.weightGrams}ج ({slot.roastOption})
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              {/* Custom Coffee Blend Barista Spec for Worker */}
              {item.isCoffeeBlend && item.coffeeBlendSpec && (
                <div className="bg-white text-[#231710] border border-[#E8E0D5] rounded-lg p-1.5 text-[10px]">
                  <span className="text-[#9A6836] font-bold">أوردر المطحنة: </span>
                  <span>{item.coffeeBlendSpec.baristaLabel}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Rider Assignment Selector */}
        <div className="bg-[#FAF6F0] rounded-xl p-2 border border-[#E8E0D5] flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-[#6B5B4E] shrink-0">
            المندوب:
          </span>
          {onAssignRider && Array.isArray(availableRiders) && availableRiders.length > 0 ? (
            <select
              value={ord.riderId || ''}
              onChange={(e) => {
                const rId = e.target.value;
                const rObj = (availableRiders || []).find((r) => r.id === rId);
                onAssignRider(ord.id, rId, rObj?.displayName || rObj?.username || '');
              }}
              className="flex-1 bg-white border border-[#E8E0D5] text-[#231710] text-[10px] font-bold rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="">إسناد مندوب توصيل...</option>
              {availableRiders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName || r.username}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] font-bold text-[#231710]">
              {ord.riderName || 'غير مسند'}
            </span>
          )}
        </div>

        {/* Footer: Total, Payment & Action Buttons */}
        <div className="pt-2 border-t border-[#E8E0D5] space-y-2">
          <div className="flex items-center justify-between text-xs tabular-nums">
            <span className="text-[11px] font-medium text-[#6B5B4E]">{pmLabel}</span>
            <span className="font-cairo font-bold text-sm text-[#231710]">
              الإجمالي: {ord.total} ج.م
            </span>
          </div>

          {ord.status === 'delivered' && ord.paymentMethod === 'cod' && (
            <div
              className={`rounded-xl p-2 border flex items-center justify-between gap-2 text-[11px] font-bold ${
                ord.riderCodSettled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span>
                {ord.riderCodSettled
                  ? `تم توريد عهدة الكاش بالدرج (${ord.cashCollected ?? ord.total} ج.م)`
                  : `عهدة كاش بطرف المندوب (${ord.cashCollected ?? ord.total} ج.م)`}
              </span>
              {!ord.riderCodSettled && onSettleRiderCod && (
                <button
                  type="button"
                  disabled={settlingId === ord.id}
                  onClick={async () => {
                    setSettlingId(ord.id);
                    try {
                      await onSettleRiderCod({ orderId: ord.id });
                    } finally {
                      setSettlingId(null);
                    }
                  }}
                  className="bg-[#231710] hover:bg-[#3A271C] text-white px-2.5 py-1 rounded-lg text-[10.5px] font-cairo font-bold shrink-0 cursor-pointer disabled:opacity-50 transition"
                >
                  {settlingId === ord.id ? 'جاري التوريد...' : 'استلام بالدرج'}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1">
            {(ord.status === 'pending' || ord.status === 'confirmed') && (
              <button
                type="button"
                onClick={() => onUpdateOrderStatus(ord.id, 'roasting_packing')}
                className="flex-1 bg-[#231710] hover:bg-[#3A271C] text-white px-2.5 py-1.5 rounded-xl text-[11px] font-cairo font-bold cursor-pointer transition"
              >
                بدء التحضير والطحن
              </button>
            )}

            {ord.status === 'roasting_packing' && (
              <button
                type="button"
                onClick={() => onUpdateOrderStatus(ord.id, 'shipped')}
                className="flex-1 bg-[#231710] hover:bg-[#3A271C] text-white px-2.5 py-1.5 rounded-xl text-[11px] font-cairo font-bold cursor-pointer transition"
              >
                خرج مع الدليفري
              </button>
            )}

            {(ord.status === 'shipped' || ord.status === 'roasting_packing') && (
              <button
                type="button"
                onClick={() => onUpdateOrderStatus(ord.id, 'delivered')}
                className="flex-1 bg-[#3B6E4C] hover:bg-[#2f5a3d] text-white px-2.5 py-1.5 rounded-xl text-[11px] font-cairo font-bold cursor-pointer transition"
              >
                تم التسليم
              </button>
            )}

            <button
              type="button"
              onClick={() => onPrintOrderReceipt(ord)}
              title="طباعة بون التجهيز والفاتورة الحراري"
              className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-2.5 py-1.5 rounded-xl text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>بون</span>
            </button>

            {ord.customerPhone && (
              <a
                href={`https://wa.me/${formatWhatsAppPhone(
                  ord.customerPhone
                )}?text=${encodeURIComponent(
                  `أهلاً بك يا ${ord.customerName} في محمصة حفصة\nطلبك رقم #${ord.orderNumber} بقيمة ${ord.total} ج.م جاري تجهيزه طازجاً الآن!`
                )}`}
                target="_blank"
                rel="noreferrer"
                title="إشعار العميل عبر واتساب"
                className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#3B6E4C] border border-[#E8E0D5] p-1.5 rounded-xl transition"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 0. Unsettled Rider COD Handover Banner */}
      {unsettledCodOrders.length > 0 && onSettleRiderCod && (
        <div className="bg-amber-50 text-amber-950 rounded-2xl p-4 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="bg-amber-200/70 text-amber-950 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold">
                عهدة مناديب بانتظار التوريد للدرج
              </span>
              <span className="text-xs font-bold text-amber-900 tabular-nums">
                {unsettledCodOrders.length} طلب مُسلَّم • إجمالي {unsettledCodTotal} ج.م
              </span>
            </div>
            <p className="text-xs text-amber-800">
              عند استلام نقدية الدليفري من المندوب، اضغط لتوريدها فوراً في درج الكاشير وتحديث معادلة الجرد (Z-Report).
            </p>
          </div>
          <button
            type="button"
            disabled={settlingId === '__ALL__'}
            onClick={async () => {
              setSettlingId('__ALL__');
              try {
                await onSettleRiderCod({ settleAll: true });
              } finally {
                setSettlingId(null);
              }
            }}
            className="bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 tabular-nums transition"
          >
            {settlingId === '__ALL__'
              ? 'جاري توريد العهدة...'
              : `استلام كل عهد المناديب بالدرج (+${unsettledCodTotal} ج.م)`}
          </button>
        </div>
      )}

      {/* 1. Top Control Bar: View Switcher (Kanban vs Grid) + Delivery Type Filters */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8E0D5] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-cairo font-bold text-base sm:text-lg text-[#231710] flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#9A6836]" />
              <span>
                شاشة استلام وتحضير طلبات الموقع الأونلاين ({onlineQueueOrders.length})
              </span>
            </h2>
            <p className="text-xs text-[#6B5B4E]">
              متابعة حية لطلبات بندر بني مزار، دورات القرى المجدولة (2 ظهراً و8 مساءً)، والاستلام من الفرع
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Kanban vs Grid Switcher */}
            <div className="flex items-center bg-[#FAF6F0] p-1 rounded-xl border border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-lg text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  viewMode === 'kanban'
                    ? 'bg-[#231710] text-white'
                    : 'text-[#6B5B4E] hover:text-[#231710]'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>عرض مراحل التحضير (Kanban)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  viewMode === 'grid'
                    ? 'bg-[#231710] text-white'
                    : 'text-[#6B5B4E] hover:text-[#231710]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>عرض بطاقات التجهيز</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => playCashierBeep(880, 0.35)}
              className="bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-3 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Volume2 className="w-4 h-4 text-[#9A6836]" />
              <span>اختبار الجرس</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="bg-[#231710] hover:bg-[#3A271C] text-white px-3.5 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث الطابور</span>
            </button>
          </div>
        </div>

        {/* Delivery Type Filters & Search */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8E0D5]">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'كل طرق التوصيل' },
              { id: 'bandar_fast', label: 'طيار بندر بني مزار الفوري' },
              { id: 'villages_scheduled', label: 'دورات القرى (2 ظهراً / 8 مساءً)' },
              { id: 'store_pickup', label: 'استلام من الفرع (أمام مسجد الزراعيين)' },
            ].map((df) => (
              <button
                key={df.id}
                type="button"
                onClick={() => setDeliveryFilter(df.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-bold cursor-pointer transition ${
                  deliveryFilter === df.id
                    ? 'bg-[#231710] text-white'
                    : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] hover:bg-[#F3ECE1]'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#6B5B4E] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الطلب أو اسم/موبايل العميل..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl pr-8 pl-3 py-1.5 text-xs font-medium outline-none"
            />
          </div>
        </div>

        {/* Status Filter Pills when in Grid Mode */}
        {viewMode === 'grid' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E8E0D5]/70">
            {[
              { id: 'all', label: 'كل الحالات' },
              { id: 'pending', label: 'طلبات جديدة' },
              { id: 'roasting_packing', label: 'جاري التحميص والتعبئة' },
              { id: 'shipped', label: 'خرج مع الدليفري' },
              { id: 'delivered', label: 'تم التسليم' },
            ].map((sf) => (
              <button
                key={sf.id}
                type="button"
                onClick={() => setStatusFilter(sf.id)}
                className={`px-3 py-1 rounded-lg text-xs font-cairo font-bold cursor-pointer transition ${
                  statusFilter === sf.id
                    ? 'bg-[#231710] text-white'
                    : 'bg-[#FAF6F0] text-[#6B5B4E] border border-[#E8E0D5]'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Main Display: Kanban 4-Column Board OR Detailed Grid */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {kanbanColumns.map((col) => (
            <div
              key={col.id}
              className="bg-[#FAF6F0] rounded-2xl border border-[#E8E0D5] overflow-hidden flex flex-col"
            >
              <div
                className={`px-4 py-3 flex items-center justify-between ${col.headerBg}`}
              >
                <h3 className="font-cairo font-bold text-xs sm:text-sm">
                  {col.title}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${col.badgeBg}`}
                >
                  {col.orders.length}
                </span>
              </div>

              <div className="p-3 space-y-3 max-h-[680px] overflow-y-auto">
                {col.orders.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#6B5B4E]">
                    لا توجد طلبات في هذه المرحلة
                  </div>
                ) : (
                  col.orders.map((ord) => renderOrderCard(ord))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-10 text-center text-xs text-[#6B5B4E] border border-[#E8E0D5]">
              لا توجد طلبات أونلاين مطابقة للبحث الحالي
            </div>
          ) : (
            filteredOrders.map((ord) => renderOrderCard(ord))
          )}
        </div>
      )}
    </div>
  );
}
