import { getOfflineDb } from "@/lib/offline-db";

const PAGE_SIZE = 100;
// Safety cap (~2000 products) so a runaway catalog can't loop forever.
const MAX_PAGES = 20;

interface ProductApiRow {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number;
  tvaRate: number;
  isActive: boolean;
}

/**
 * Pulls the full active product catalog into the local Dexie cache so
 * product search still works offline. Called on mount and every 5 minutes
 * while online (ARCHITECTURE.md §7.2's "Periodic sync (every 5 min)").
 */
export async function syncProductCatalog(): Promise<void> {
  const db = getOfflineDb();
  const all: ProductApiRow[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      isActive: "true",
      sort: "name",
      order: "asc",
    });
    const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) break;

    const body: { data: ProductApiRow[] } = await response.json();
    all.push(...body.data);
    if (body.data.length < PAGE_SIZE) break;
    page += 1;
  }

  await db.transaction("rw", db.localProducts, async () => {
    await db.localProducts.clear();
    if (all.length > 0) {
      await db.localProducts.bulkPut(all);
    }
  });
}
