"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StoreOption {
  id: string;
  name: string;
}

interface OptimizedProduct {
  id: string;
  name: string;
  reorderPoint: number | null;
  safetyStock: number | null;
}

async function fetchStores(): Promise<StoreOption[]> {
  const response = await fetch("/api/stores");
  if (!response.ok) return [];
  const body: { data: StoreOption[] } = await response.json();
  return body.data;
}

async function fetchOptimizedProducts(): Promise<OptimizedProduct[]> {
  const response = await fetch("/api/products?pageSize=100&isActive=true");
  if (!response.ok) return [];
  const body: { data: OptimizedProduct[] } = await response.json();
  return body.data.filter((p) => p.reorderPoint !== null || p.safetyStock !== null);
}

export function InventoryOptimizationTab() {
  const t = useTranslations("inventoryOptimization");
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");

  const { data: stores = [] } = useQuery({ queryKey: ["ai", "stores"], queryFn: fetchStores });
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["ai", "optimized-products"],
    queryFn: fetchOptimizedProducts,
  });

  async function handleRecompute() {
    if (!storeId) {
      toast.error(t("selectStoreFirst"));
      return;
    }
    const response = await fetch("/api/ai/inventory-optimization/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId }),
    });
    if (!response.ok) {
      toast.error(t("recomputeError"));
      return;
    }
    const body: { data: { recomputed: number } } = await response.json();
    toast.success(t("recomputeSuccess", { count: body.data.recomputed }));
    queryClient.invalidateQueries({ queryKey: ["ai", "optimized-products"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("selectStore")} />
          </SelectTrigger>
          <SelectContent>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleRecompute}>{t("recompute")}</Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead className="text-right">{t("table.reorderPoint")}</TableHead>
              <TableHead className="text-right">{t("table.safetyStock")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && products.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell className="text-right">{product.reorderPoint ?? "—"}</TableCell>
                <TableCell className="text-right">{product.safetyStock ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
