import { Order } from '@/types/store';

export const POS_OFFLINE_QUEUE_STORAGE_KEY = 'nuts_pos_offline_queue';

export interface PosOfflineQueueItem extends Order {
  queuedAt: string;
  offlineSyncStatus?: 'pending' | 'syncing' | 'failed';
}

/**
 * Retrieves the current offline queue from localStorage safely.
 */
export function getPosOfflineQueue(): PosOfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(POS_OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read POS offline queue:', err);
    return [];
  }
}

/**
 * Adds an offline invoice to the local storage queue.
 */
export function enqueuePosOfflineInvoice(order: Order): PosOfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const queue = getPosOfflineQueue();
    const item: PosOfflineQueueItem = {
      ...order,
      queuedAt: new Date().toISOString(),
      offlineSyncStatus: 'pending',
    };
    // Prevent duplicate entries
    const existingIndex = queue.findIndex(
      (q) => q.id === item.id || q.orderNumber === item.orderNumber
    );
    if (existingIndex >= 0) {
      queue[existingIndex] = item;
    } else {
      queue.push(item);
    }
    localStorage.setItem(POS_OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    return queue;
  } catch (err) {
    console.error('Failed to enqueue POS offline invoice:', err);
    return [];
  }
}

/**
 * Removes one or more invoices from the offline queue by ID or orderNumber.
 */
export function removePosOfflineInvoices(idsOrNumbers: string[]): PosOfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const queue = getPosOfflineQueue();
    const remaining = queue.filter(
      (item) => !idsOrNumbers.includes(item.id) && !idsOrNumbers.includes(item.orderNumber)
    );
    localStorage.setItem(POS_OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    return remaining;
  } catch (err) {
    console.error('Failed to remove synced invoices from offline queue:', err);
    return [];
  }
}

/**
 * Clears the entire offline queue.
 */
export function clearPosOfflineQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(POS_OFFLINE_QUEUE_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear POS offline queue:', err);
  }
}

/**
 * Synchronizes all pending offline invoices to /api/pos.
 */
export async function syncPosOfflineQueue(token?: string): Promise<{
  success: boolean;
  syncedCount: number;
  remainingCount: number;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { success: false, syncedCount: 0, remainingCount: 0, error: 'Window not available' };
  }

  const queue = getPosOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, remainingCount: 0 };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/pos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'sync_offline_invoices',
        invoices: queue,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        syncedCount: 0,
        remainingCount: queue.length,
        error: errData.error || 'فشلت مزامنة طابور الطوارئ',
      };
    }

    const data = await res.json();
    const syncedOrders: Order[] = data.syncedOrders || [];
    const syncedIdentifiers = syncedOrders.map((o) => o.orderNumber || o.id);
    const remaining = removePosOfflineInvoices(syncedIdentifiers);

    return {
      success: true,
      syncedCount: syncedOrders.length,
      remainingCount: remaining.length,
    };
  } catch (err: any) {
    console.error('syncPosOfflineQueue network error:', err);
    return {
      success: false,
      syncedCount: 0,
      remainingCount: queue.length,
      error: err.message || 'خطأ في الاتصال بالشبكة أثناء المزامنة',
    };
  }
}
