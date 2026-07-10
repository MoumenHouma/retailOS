"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Download, Package, AlertTriangle, PackageX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDa } from "@/lib/currency";

interface InventoryReport {
  rows: {
    productId: string;
    productName: string;
    storeName: string;
    quantityOnHand: number;
    stockValue: number;
    isLowStock: boolean;
    isOverstock: boolean;
  }[];
  summary: { totalStockValue: number; lowStockCount: number; overstockCount: number; skuCount: number };
  expiringBatches: { productId: string; productName: string; daysUntilExpiry: number }[];
}

export function InventoryReportView() {
  const t = useTranslations("reports.inventory");

  const query = useQuery({
    queryKey: ["inventory-report"],
    queryFn: async () => {
      const res = await fetch("/api/reports/inventory");
      if (!res.ok) throw new Error("Failed to fetch");
      return (await res.json()) as { data: InventoryReport };
    },
  });

  const report = query.data?.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        action={
          <div className="flex gap-2">
            {(["pdf", "xlsx", "csv"] as const).map((format) => (
              <Button key={format} variant="outline" size="sm" asChild>
                <a href={`/api/reports/inventory?format=${format}`}>
                  <Download className="h-4 w-4" />
                  {format.toUpperCase()}
                </a>
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatTile label={t("summary.totalStockValue")} value={formatDa(report?.summary.totalStockValue ?? 0)} icon={Package} />
        <StatTile label={t("summary.skuCount")} value={report?.summary.skuCount ?? 0} icon={Package} />
        <StatTile
          label={t("summary.lowStockCount")}
          value={report?.summary.lowStockCount ?? 0}
          icon={AlertTriangle}
          tone={(report?.summary.lowStockCount ?? 0) > 0 ? "warning" : "default"}
        />
        <StatTile
          label={t("summary.expiringCount")}
          value={report?.expiringBatches.length ?? 0}
          icon={PackageX}
          tone={(report?.expiringBatches.length ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead>{t("table.store")}</TableHead>
              <TableHead className="text-right">{t("table.quantity")}</TableHead>
              <TableHead className="text-right">{t("table.value")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(report?.rows ?? []).map((r) => (
              <TableRow key={`${r.productId}`}>
                <TableCell>{r.productName}</TableCell>
                <TableCell>{r.storeName}</TableCell>
                <TableCell className="text-right">{r.quantityOnHand}</TableCell>
                <TableCell className="text-right">{formatDa(r.stockValue)}</TableCell>
                <TableCell className="flex gap-1">
                  {r.isLowStock && <Badge variant="warning">{t("table.lowStock")}</Badge>}
                  {r.isOverstock && <Badge variant="outline">{t("table.overstock")}</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
