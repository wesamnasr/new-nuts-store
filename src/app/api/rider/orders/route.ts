import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/auth';
import { Order, OrderStatus } from '@/types/store';

export const dynamic = 'force-dynamic';

function stripOrderCostsForRider(order: Order): Order {
  const copy = { ...order };
  delete copy.rawCostTotal;
  delete copy.netProfitEgp;
  return copy;
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: 'غير مصرح لك بالوصول (401 Unauthorized)' },
      { status: 401 }
    );
  }

  const isRider = auth.role === 'delivery_rider';
  const isAdmin = auth.role === 'super_admin' || auth.role === 'admin';

  if (!isRider && !isAdmin) {
    return NextResponse.json(
      { error: 'عزل الأدوار: بوابة مندوب التوصيل تقتصر على المناديب والإدارة فقط (403 Forbidden)' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filterType = searchParams.get('type') || 'all'; // 'all' | 'bandar_fast' | 'villages_scheduled' | 'delivered'
  const searchQuery = (searchParams.get('q') || '').trim().toLowerCase();

  const db = await getDbAsync();
  const allOrders = Array.isArray(db.orders) ? db.orders : [];

  // Filter orders relevant for this rider
  let riderOrders = allOrders.filter((ord) => {
    // Exclude store pickups and POS in-store orders
    const isDelivery =
      ord.deliveryMethod === 'bandar_fast' ||
      ord.deliveryMethod === 'villages_scheduled' ||
      Boolean(ord.villageName) ||
      Boolean(ord.riderId) ||
      Boolean(ord.address && !ord.address.includes('استلام'));

    if (!isDelivery && ord.orderSource === 'pos') {
      return false;
    }

    if (isRider) {
      const isAssigned =
        ord.riderId === auth.staffId ||
        ord.riderName === auth.username ||
        (!ord.riderId && ord.status !== 'cancelled');
      return isAssigned;
    }

    return true;
  });

  // Apply delivery type filter
  if (filterType === 'bandar_fast') {
    riderOrders = riderOrders.filter(
      (o) =>
        (o.deliveryMethod === 'bandar_fast' || (!o.villageName && !o.deliverySlot)) &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    );
  } else if (filterType === 'villages_scheduled') {
    riderOrders = riderOrders.filter(
      (o) =>
        (o.deliveryMethod === 'villages_scheduled' || Boolean(o.villageName) || Boolean(o.deliverySlot)) &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    );
  } else if (filterType === 'delivered') {
    riderOrders = riderOrders.filter((o) => o.status === 'delivered');
  }

  // Apply search query
  if (searchQuery) {
    riderOrders = riderOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(searchQuery) ||
        (o.customerName || '').toLowerCase().includes(searchQuery) ||
        (o.customerPhone || '').toLowerCase().includes(searchQuery) ||
        (o.address || '').toLowerCase().includes(searchQuery) ||
        (o.villageName || '').toLowerCase().includes(searchQuery)
    );
  }

  // Calculate live rider KPIs
  const baseRiderPool = allOrders.filter((o) => {
    if (isRider) {
      return (
        o.riderId === auth.staffId ||
        o.riderName === auth.username ||
        (!o.riderId && o.status !== 'cancelled')
      );
    }
    return true;
  });

  const totalAssigned = baseRiderPool.length;
  const pendingDelivery = baseRiderPool.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;
  const deliveredToday = baseRiderPool.filter((o) => o.status === 'delivered').length;
  const totalCodToCollect = baseRiderPool
    .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.paymentMethod === 'cod')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  return NextResponse.json({
    success: true,
    orders: riderOrders.map(stripOrderCostsForRider),
    stats: {
      totalAssigned,
      pendingDelivery,
      deliveredToday,
      totalCodToCollect,
    },
    rider: {
      staffId: auth.staffId,
      username: auth.username,
      displayName: auth.displayName || auth.username || 'مندوب التوصيل',
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: 'غير مصرح لك بالوصول (401 Unauthorized)' },
      { status: 401 }
    );
  }

  const isRider = auth.role === 'delivery_rider';
  const isAdmin = auth.role === 'super_admin' || auth.role === 'admin';

  if (!isRider && !isAdmin) {
    return NextResponse.json(
      { error: 'عزل الأدوار: بوابة مندوب التوصيل تقتصر على المناديب والإدارة فقط (403 Forbidden)' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { orderId, status, riderNotes, cashCollected } = body as {
      orderId: string;
      status?: OrderStatus;
      riderNotes?: string;
      cashCollected?: number;
    };

    if (!orderId) {
      return NextResponse.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });
    }

    return await withDbTransaction(async (db) => {
      const orderIndex = db.orders.findIndex((o) => o.id === orderId);
      if (orderIndex === -1) {
        return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
      }

      const targetOrder = db.orders[orderIndex];

      if (isRider) {
        const isAssigned =
          targetOrder.riderId === auth.staffId ||
          targetOrder.riderName === auth.username ||
          !targetOrder.riderId;

        if (!isAssigned) {
          return NextResponse.json(
            { error: 'عزل الأدوار: هذا الطلب مسند لمندوب توصيل آخر' },
            { status: 403 }
          );
        }

        if (status && status !== 'delivered' && status !== 'shipped') {
          return NextResponse.json(
            { error: 'مندوب التوصيل مصرح له فقط بتأكيد استلام الطلب أو التسليم والتحصيل' },
            { status: 403 }
          );
        }
      }

      // Update rider attribution if not set
      if (!targetOrder.riderId && auth.staffId) {
        targetOrder.riderId = auth.staffId;
      }
      if (!targetOrder.riderName && auth.username) {
        targetOrder.riderName = auth.username;
      }

      if (status) {
        targetOrder.status = status;
        if (status === 'delivered') {
          targetOrder.deliveredAt = new Date().toISOString();
        }
      }

      if (typeof riderNotes === 'string') {
        targetOrder.riderNotes = riderNotes;
      }

      if (cashCollected !== undefined) {
        targetOrder.cashCollected = Number(cashCollected) || 0;
      } else if (status === 'delivered' && targetOrder.paymentMethod === 'cod') {
        targetOrder.cashCollected = targetOrder.total;
      }

      return NextResponse.json({
        success: true,
        message: 'تم تحديث حالة الطلب بنجاح',
        order: stripOrderCostsForRider(targetOrder),
      });
    });
  } catch (error) {
    console.error('Error updating rider order:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث حالة الطلب' }, { status: 500 });
  }
}
