"use client";

import { useEffect } from "react";
import { syncProductCatalog } from "@/lib/product-cache-sync";

// ARCHITECTURE.md §7.2: "Periodic sync (every 5 min): Pull product updates, price changes".
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function useProductCatalogSync(isOnline: boolean) {
  useEffect(() => {
    if (!isOnline) return;

    syncProductCatalog().catch(() => {});
    const interval = setInterval(() => {
      syncProductCatalog().catch(() => {});
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOnline]);
}
