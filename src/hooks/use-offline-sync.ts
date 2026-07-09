"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getOfflineDb, type LocalQueuedSale } from "@/lib/offline-db";
import { useOnlineStatus } from "@/hooks/use-online-status";

export interface QueueSaleInput {
  storeId: string;
  posSessionId: string;
  customerId: string | null;
  items: { productId: string; productName: string; quantity: number; discountAmount: number }[];
  payments: { paymentMethod: "CASH" | "CARD" | "CHECK" | "TRANSFER"; amount: number; reference: string | null }[];
  discountAmount: number;
  notes: string | null;
}

async function pushOne(sale: LocalQueuedSale): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch("/api/pos/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: sale.storeId,
      posSessionId: sale.posSessionId,
      customerId: sale.customerId,
      items: sale.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        discountAmount: item.discountAmount,
      })),
      payments: sale.payments,
      discountAmount: sale.discountAmount,
      notes: sale.notes,
      isOffline: true,
    }),
  });

  if (response.ok) return { ok: true };
  const body = await response.json().catch(() => null);
  return { ok: false, message: body?.error?.message ?? `HTTP ${response.status}` };
}

/**
 * Client-side offline sale queue (ARCHITECTURE.md §7): sales rung up while
 * the POS terminal can't reach the server are written to a local Dexie
 * queue instead of POSTed immediately. On reconnect, queued sales are
 * pushed to the server in order (oldest first); the server is authoritative
 * for stock, so a sale that no longer has enough stock comes back flagged
 * as a conflict for the cashier to resolve rather than silently dropped or
 * retried forever.
 */
export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const syncingRef = useRef(false);

  const pendingSales = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return getOfflineDb().queuedSales.where("status").equals("pending").sortBy("createdAt");
  }, [], []);

  const conflictSales = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return getOfflineDb().queuedSales.where("status").equals("conflict").sortBy("createdAt");
  }, [], []);

  const syncPendingSales = useCallback(async () => {
    if (syncingRef.current || typeof window === "undefined") return;
    syncingRef.current = true;
    try {
      const db = getOfflineDb();
      const queued = await db.queuedSales.where("status").equals("pending").sortBy("createdAt");

      for (const sale of queued) {
        await db.queuedSales.update(sale.localId, { status: "syncing" });
        const result = await pushOne(sale);

        if (result.ok) {
          await db.queuedSales.delete(sale.localId);
        } else {
          await db.queuedSales.update(sale.localId, { status: "conflict", conflictMessage: result.message });
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Fire once whenever connectivity is (re)confirmed — covers both the
  // offline->online transition and simply loading the POS screen with a
  // queue left over from a previous session.
  useEffect(() => {
    if (isOnline) {
      syncPendingSales();
    }
  }, [isOnline, syncPendingSales]);

  const queueSale = useCallback(async (input: QueueSaleInput): Promise<string> => {
    const localId = crypto.randomUUID();
    await getOfflineDb().queuedSales.add({
      localId,
      storeId: input.storeId,
      posSessionId: input.posSessionId,
      customerId: input.customerId,
      items: input.items,
      payments: input.payments,
      discountAmount: input.discountAmount,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    return localId;
  }, []);

  const retryConflict = useCallback(
    async (localId: string) => {
      await getOfflineDb().queuedSales.update(localId, { status: "pending", conflictMessage: undefined });
      await syncPendingSales();
    },
    [syncPendingSales],
  );

  const discardConflict = useCallback(async (localId: string) => {
    await getOfflineDb().queuedSales.delete(localId);
  }, []);

  return {
    isOnline,
    pendingCount: pendingSales?.length ?? 0,
    conflictSales: conflictSales ?? [],
    queueSale,
    retryConflict,
    discardConflict,
  };
}
