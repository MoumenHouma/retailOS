"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";

interface SupplierOption {
  id: string;
  name: string;
}
interface CatalogRow {
  id: string;
  supplierSku: string | null;
  unitPrice: number | null;
  minOrderQuantity: number;
  isPreferred: boolean;
  supplier: { name: string };
  product: { name: string; sku: string | null };
}
interface CatalogResponse {
  data: CatalogRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const ALL = "__all__";
const PAGE_SIZE = 20;

async function fetchSuppliers(): Promise<{ data: SupplierOption[] }> {
  const response = await fetch("/api/suppliers?pageSize=100&isActive=true");
  if (!response.ok) throw new Error("Failed to load suppliers");
  return response.json();
}

async function fetchCatalog(params: { supplierId: string; page: number }): Promise<CatalogResponse> {
  const searchParams = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
  if (params.supplierId !== ALL) searchParams.set("supplierId", params.supplierId);
  const response = await fetch(`/api/procurement-reports/supplier-catalog?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load supplier catalog");
  return response.json();
}

export function SupplierCatalogView() {
  const t = useTranslations("supplierCatalog");
  const [supplierId, setSupplierId] = useState(ALL);
  const [page, setPage] = useState(1);

  const { data: suppliersData } = useQuery({ queryKey: ["suppliers", "all"], queryFn: fetchSuppliers });
  const suppliers = suppliersData?.data ?? [];

  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-catalog", { supplierId, page }],
    queryFn: () => fetchCatalog({ supplierId, page }),
    placeholderData: (previous) => previous,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Select
        value={supplierId}
        onValueChange={(value) => {
          setSupplierId(value);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("filter.allSuppliers")}</SelectItem>
          {suppliers.map((supplier) => (
            <SelectItem key={supplier.id} value={supplier.id}>
              {supplier.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead>{t("table.supplier")}</TableHead>
              <TableHead>{t("table.supplierSku")}</TableHead>
              <TableHead className="text-right">{t("table.unitPrice")}</TableHead>
              <TableHead className="text-right">{t("table.minOrderQuantity")}</TableHead>
              <TableHead>{t("table.preferred")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive">
                  {t("loadError")}
                </TableCell>
              </TableRow>
            )}
            {!isError && !isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.product.name}</TableCell>
                <TableCell>{row.supplier.name}</TableCell>
                <TableCell>{row.supplierSku ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.unitPrice != null ? formatDa(row.unitPrice) : "—"}
                </TableCell>
                <TableCell className="text-right">{row.minOrderQuantity}</TableCell>
                <TableCell>{row.isPreferred && <Badge>{t("preferredBadge")}</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("pagination.total", { count: meta.total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t("pagination.previous")}
            </Button>
            <span>{t("pagination.pageInfo", { page: meta.page, totalPages: meta.totalPages })}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
            >
              {t("pagination.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
