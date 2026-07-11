import { getOfflineDb } from "@/lib/offline-db";

const LAST_SYNCED_AT_KEY = "productCatalog.lastSyncedAt";

interface ProductCatalogSyncRow {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number;
  tvaRate: number;
  isActive: boolean;
  deleted: boolean;
}

/**
 * Pulls product-catalog changes into the local Dexie cache so product
 * search still works offline. Called on mount and every 5 minutes while
 * online (ARCHITECTURE.md §7.2's "Periodic sync (every 5 min)").
 *
 * Delta, not full-reload: after the first sync, only rows changed since the
 * last watermark are fetched (one lean flat query server-side, no joins —
 * see getProductCatalogSync), and only those rows are upserted/evicted in
 * Dexie. Previously this cleared and rebuilt the entire local table from a
 * fresh 20-request paginated fetch of the whole (up to 2000-product)
 * catalog on every single call.
 */
export async function syncProductCatalog(): Promise<void> {
  const db = getOfflineDb();
  const lastSyncedAt = await db.syncMeta.get(LAST_SYNCED_AT_KEY);

  const params = new URLSearchParams();
  if (lastSyncedAt) params.set("updatedSince", lastSyncedAt.value);

  const response = await fetch(`/api/products/catalog-sync?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) return;

  const body: { data: { items: ProductCatalogSyncRow[]; syncedAt: string } } = await response.json();
  const { items, syncedAt } = body.data;

  await db.transaction("rw", db.localProducts, db.syncMeta, async () => {
    for (const item of items) {
      if (item.deleted || !item.isActive) {
        await db.localProducts.delete(item.id);
      } else {
        await db.localProducts.put({
          id: item.id,
          name: item.name,
          barcode: item.barcode,
          sellingPrice: item.sellingPrice,
          tvaRate: item.tvaRate,
          isActive: item.isActive,
        });
      }
    }
    await db.syncMeta.put({ key: LAST_SYNCED_AT_KEY, value: syncedAt });
  });
}
