import Dexie, { type Table } from "dexie";

export interface LocalProduct {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number;
  tvaRate: number;
  isActive: boolean;
}

export interface LocalQueuedSaleItem {
  productId: string;
  productName: string;
  quantity: number;
  discountAmount: number;
}

export interface LocalQueuedSalePayment {
  paymentMethod: "CASH" | "CARD" | "CHECK" | "TRANSFER";
  amount: number;
  reference: string | null;
}

export type QueuedSaleStatus = "pending" | "syncing" | "conflict" | "synced";

export interface LocalQueuedSale {
  localId: string;
  storeId: string;
  posSessionId: string;
  customerId: string | null;
  items: LocalQueuedSaleItem[];
  payments: LocalQueuedSalePayment[];
  discountAmount: number;
  notes: string | null;
  createdAt: string;
  status: QueuedSaleStatus;
  conflictMessage?: string;
}

interface SyncMetaEntry {
  key: string;
  value: string;
}

class OfflineDb extends Dexie {
  localProducts!: Table<LocalProduct, string>;
  queuedSales!: Table<LocalQueuedSale, string>;
  syncMeta!: Table<SyncMetaEntry, string>;

  constructor() {
    super("retailos-pos-offline");
    this.version(1).stores({
      localProducts: "id, name, barcode",
      queuedSales: "localId, status, createdAt",
    });
    // v2: delta product-catalog sync (product-cache-sync.ts) needs somewhere
    // to persist its watermark between syncs. Dexie upgrades existing
    // browsers' IndexedDB in place — no data loss, localProducts/queuedSales
    // schemas are untouched.
    this.version(2).stores({
      localProducts: "id, name, barcode",
      queuedSales: "localId, status, createdAt",
      syncMeta: "key",
    });
  }
}

// IndexedDB doesn't exist during Next.js SSR (client components still get
// an initial server render pass in Node) — constructing Dexie there throws.
// Lazily instantiate on first real (browser-side) use instead of at module
// load. Every caller must only invoke this from an effect or event handler,
// never during render.
let instance: OfflineDb | null = null;

export function getOfflineDb(): OfflineDb {
  if (typeof window === "undefined") {
    throw new Error("offlineDb is only available in the browser");
  }
  if (!instance) {
    instance = new OfflineDb();
  }
  return instance;
}
