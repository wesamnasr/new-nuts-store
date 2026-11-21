import {
  Category,
  Coupon,
  Order,
  PosRegisterConfig,
  PosShift,
  Product,
  StoreSettings,
  VipMember,
} from '@/types/store';

export const POS_OFFLINE_QUEUE_STORAGE_KEY = 'nuts_pos_offline_queue';
export const POS_IDB_NAME = 'mizan_pos_offline_db';
export const POS_IDB_VERSION = 1;

export interface PosOfflineQueueItem extends Order {
  queuedAt: string;
  offlineSyncStatus?: 'pending' | 'syncing' | 'failed';
}

export interface PosOfflineCatalogSnapshot {
  id: 'active_snapshot';
  updatedAt: string;
  products: Product[];
  categories: Category[];
  coupons: Coupon[];
  vipMembers: VipMember[];
  activeShift: PosShift | null;
  posRegisters: PosRegisterConfig[];
  settings?: StoreSettings;
}

function openPosIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(POS_IDB_NAME, POS_IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('catalog_snapshots')) {
          db.createObjectStore('catalog_snapshots', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offline_invoices')) {
          db.createObjectStore('offline_invoices', { keyPath: 'orderNumber' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persists the complete POS catalog, barcodes, VIP balances, coupons, and active shift in IndexedDB
 * so the POS continues operating after a full page reload without internet.
 */
export async function savePosOfflineSnapshot(
  snapshot: Omit<PosOfflineCatalogSnapshot, 'id' | 'updatedAt'>
): Promise<void> {
  const idb = await openPosIndexedDb();
  if (!idb) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = idb.transaction('catalog_snapshots', 'readwrite');
      const store = tx.objectStore('catalog_snapshots');
      store.put({
        ...snapshot,
        id: 'active_snapshot',
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        resolve();
      };
    } catch {
      idb.close();
      resolve();
    }
  });
}

/**
 * Loads the cached POS catalog & shift snapshot from IndexedDB when offline.
 */
export async function loadPosOfflineSnapshot(): Promise<PosOfflineCatalogSnapshot | null> {
  const idb = await openPosIndexedDb();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction('catalog_snapshots', 'readonly');
      const store = tx.objectStore('catalog_snapshots');
      const getReq = store.get('active_snapshot');
      getReq.onsuccess = () => {
        const result = (getReq.result as PosOfflineCatalogSnapshot | undefined) || null;
        idb.close();
        resolve(result);
      };
      getReq.onerror = () => {
        idb.close();
        resolve(null);
      };
    } catch {
      idb.close();
      resolve(null);
    }
  });
}

async function mirrorOfflineInvoiceToIdb(item: PosOfflineQueueItem): Promise<void> {
  const idb = await openPosIndexedDb();
  if (!idb) return;
  try {
    const tx = idb.transaction('offline_invoices', 'readwrite');
    tx.objectStore('offline_invoices').put(item);
    tx.oncomplete = () => idb.close();
    tx.onerror = () => idb.close();
  } catch {
    idb.close();
  }
}

async function deleteOfflineInvoicesFromIdb(idsOrNumbers: string[]): Promise<void> {
  const idb = await openPosIndexedDb();
  if (!idb) return;
  try {
    const tx = idb.transaction('offline_invoices', 'readwrite');
    const store = tx.objectStore('offline_invoices');
    for (const key of idsOrNumbers) {
      store.delete(key);
    }
    tx.oncomplete = () => idb.close();
    tx.onerror = () => idb.close();
  } catch {
    idb.close();
  }
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
 * Adds an offline invoice to localStorage + IndexedDB mirror.
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
    const existingIndex = queue.findIndex(
      (q) => q.id === item.id || q.orderNumber === item.orderNumber
    );
    if (existingIndex >= 0) {
      queue[existingIndex] = item;
    } else {
      queue.push(item);
    }
    localStorage.setItem(POS_OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    void mirrorOfflineInvoiceToIdb(item);
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
    void deleteOfflineInvoicesFromIdb(idsOrNumbers);
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
    void openPosIndexedDb().then((idb) => {
      if (!idb) return;
      const tx = idb.transaction('offline_invoices', 'readwrite');
      tx.objectStore('offline_invoices').clear();
      tx.oncomplete = () => idb.close();
    });
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
