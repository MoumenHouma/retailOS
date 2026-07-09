"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";

interface StockLevelRow {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  isLowStock: boolean;
  product: { name: string; barcode: string | null; minStockLevel: number };
  store: { id: string; name: string };
}

interface StockMovementRow {
  id: string;
  movementType: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  product: { name: string };
  store: { name: string };
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const ALL = "__all__";
const PAGE_SIZE = 20;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

const MOVEMENT_TYPES = [
  "PURCHASE_IN",
  "SALE_OUT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "RETURN_OUT",
  "WRITE_OFF",
] as const;

export function InventoryView() {
  const t = useTranslations("inventory");
  const queryClient = useQueryClient();

  const [storeFilter, setStoreFilter] = useState(ALL);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [levelsPage, setLevelsPage] = useState(1);

  const [movementStoreFilter, setMovementStoreFilter] = useState(ALL);
  const [movementTypeFilter, setMovementTypeFilter] = useState(ALL);
  const [movementsPage, setMovementsPage] = useState(1);

  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: () => fetchJson<{ data: { id: string; name: string }[] }>("/api/stores"),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "all"],
    queryFn: () =>
      fetchJson<{ data: { id: string; name: string; sku: string | null }[] }>(
        "/api/products?pageSize=100",
      ),
  });

  const levelsQuery = useQuery({
    queryKey: ["stock-levels", { storeFilter, lowStockOnly, levelsPage }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(levelsPage), pageSize: String(PAGE_SIZE) });
      if (storeFilter !== ALL) params.set("storeId", storeFilter);
      if (lowStockOnly) params.set("lowStockOnly", "true");
      return fetchJson<Paginated<StockLevelRow>>(`/api/stock-levels?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });

  const movementsQuery = useQuery({
    queryKey: ["stock-movements", { movementStoreFilter, movementTypeFilter, movementsPage }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(movementsPage),
        pageSize: String(PAGE_SIZE),
      });
      if (movementStoreFilter !== ALL) params.set("storeId", movementStoreFilter);
      if (movementTypeFilter !== ALL) params.set("movementType", movementTypeFilter);
      return fetchJson<Paginated<StockMovementRow>>(`/api/stock-movements?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });

  const stores = storesQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const levels = levelsQuery.data?.data ?? [];
  const levelsMeta = levelsQuery.data?.meta;
  const movements = movementsQuery.data?.data ?? [];
  const movementsMeta = movementsQuery.data?.meta;

  function refreshAfterAdjustment() {
    queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
    queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {stores.length > 0 && products.length > 0 ? (
          <StockAdjustmentDialog products={products} stores={stores} onAdjusted={refreshAfterAdjustment} />
        ) : (
          <Button disabled>{t("adjustStock")}</Button>
        )}
      </div>

      <Tabs defaultValue="levels">
        <TabsList>
          <TabsTrigger value="levels">{t("tabs.levels")}</TabsTrigger>
          <TabsTrigger value="movements">{t("tabs.movements")}</TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={storeFilter}
              onValueChange={(value) => {
                setStoreFilter(value);
                setLevelsPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filter.allStores")}</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="low-stock-only"
                checked={lowStockOnly}
                onCheckedChange={(checked) => {
                  setLowStockOnly(checked === true);
                  setLevelsPage(1);
                }}
              />
              <Label htmlFor="low-stock-only">{t("filter.lowStockOnly")}</Label>
            </div>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("levels.table.product")}</TableHead>
                  <TableHead>{t("levels.table.store")}</TableHead>
                  <TableHead>{t("levels.table.onHand")}</TableHead>
                  <TableHead>{t("levels.table.reserved")}</TableHead>
                  <TableHead>{t("levels.table.available")}</TableHead>
                  <TableHead>{t("levels.table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levelsQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-destructive">
                      {t("levels.loadError")}
                    </TableCell>
                  </TableRow>
                )}
                {!levelsQuery.isError && !levelsQuery.isLoading && levels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t("levels.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {levels.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.product.name}</TableCell>
                    <TableCell>{row.store.name}</TableCell>
                    <TableCell>{row.quantityOnHand}</TableCell>
                    <TableCell>{row.quantityReserved}</TableCell>
                    <TableCell>{row.quantityAvailable}</TableCell>
                    <TableCell>
                      <Badge variant={row.isLowStock ? "destructive" : "default"}>
                        {row.isLowStock ? t("levels.lowStock") : t("levels.ok")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {levelsMeta && levelsMeta.totalPages > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("pagination.total", { count: levelsMeta.total })}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={levelsPage <= 1}
                  onClick={() => setLevelsPage((current) => Math.max(1, current - 1))}
                >
                  {t("pagination.previous")}
                </Button>
                <span>
                  {t("pagination.pageInfo", { page: levelsMeta.page, totalPages: levelsMeta.totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={levelsPage >= levelsMeta.totalPages}
                  onClick={() => setLevelsPage((current) => Math.min(levelsMeta.totalPages, current + 1))}
                >
                  {t("pagination.next")}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={movementStoreFilter}
              onValueChange={(value) => {
                setMovementStoreFilter(value);
                setMovementsPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filter.allStores")}</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={movementTypeFilter}
              onValueChange={(value) => {
                setMovementTypeFilter(value);
                setMovementsPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filter.allTypes")}</SelectItem>
                {MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`movementTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("movements.table.date")}</TableHead>
                  <TableHead>{t("movements.table.product")}</TableHead>
                  <TableHead>{t("movements.table.store")}</TableHead>
                  <TableHead>{t("movements.table.type")}</TableHead>
                  <TableHead>{t("movements.table.quantity")}</TableHead>
                  <TableHead>{t("movements.table.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-destructive">
                      {t("movements.loadError")}
                    </TableCell>
                  </TableRow>
                )}
                {!movementsQuery.isError && !movementsQuery.isLoading && movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t("movements.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {movements.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.createdAt).toLocaleString("fr-DZ")}</TableCell>
                    <TableCell className="font-medium">{row.product.name}</TableCell>
                    <TableCell>{row.store.name}</TableCell>
                    <TableCell>{t(`movementTypes.${row.movementType}`)}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{row.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {movementsMeta && movementsMeta.totalPages > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("pagination.total", { count: movementsMeta.total })}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={movementsPage <= 1}
                  onClick={() => setMovementsPage((current) => Math.max(1, current - 1))}
                >
                  {t("pagination.previous")}
                </Button>
                <span>
                  {t("pagination.pageInfo", {
                    page: movementsMeta.page,
                    totalPages: movementsMeta.totalPages,
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={movementsPage >= movementsMeta.totalPages}
                  onClick={() =>
                    setMovementsPage((current) => Math.min(movementsMeta.totalPages, current + 1))
                  }
                >
                  {t("pagination.next")}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
