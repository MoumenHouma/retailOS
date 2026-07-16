"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertTriangle, Download, TrendingUp, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";
import { fetchJsonData } from "@/lib/fetch-json";

function ExportButtons({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="flex gap-2">
      {(["pdf", "xlsx", "csv"] as const).map((format) => (
        <Button key={format} variant="outline" size="sm" asChild>
          <a href={`${baseUrl}?format=${format}`}>
            <Download className="h-4 w-4" />
            {format.toUpperCase()}
          </a>
        </Button>
      ))}
    </div>
  );
}

interface ReorderSuggestion {
  productId: string;
  productName: string;
  storeName: string;
  quantityOnHand: number;
  minStockLevel: number;
  supplier: { id: string; name: string } | null;
  suggestedQuantity: number | null;
}

interface AnalyticsEntry {
  supplierName?: string;
  categoryName?: string;
  total: number;
}

interface PurchaseAnalytics {
  bySupplier: (AnalyticsEntry & { supplierId: string })[];
  byCategory: (AnalyticsEntry & { categoryId: string | null })[];
}

interface DeliveryPerformanceEntry {
  supplierId: string;
  supplierName: string;
  onTimeCount: number;
  totalCount: number;
  onTimeRate: number;
}

export function ProcurementReportsView() {
  const t = useTranslations("procurementReports");

  const reorderQuery = useQuery({
    queryKey: ["procurement-reorder-suggestions"],
    queryFn: () => fetchJsonData<ReorderSuggestion[]>("/api/procurement-reports/reorder-suggestions"),
  });
  const analyticsQuery = useQuery({
    queryKey: ["procurement-purchase-analytics"],
    queryFn: () => fetchJsonData<PurchaseAnalytics>("/api/procurement-reports/purchase-analytics"),
  });
  const deliveryQuery = useQuery({
    queryKey: ["procurement-delivery-performance"],
    queryFn: () => fetchJsonData<DeliveryPerformanceEntry[]>("/api/procurement-reports/delivery-performance"),
  });

  const reorderSuggestions = reorderQuery.data?.data ?? [];
  const bySupplier = analyticsQuery.data?.data.bySupplier ?? [];
  const byCategory = analyticsQuery.data?.data.byCategory ?? [];
  const deliveryPerformance = deliveryQuery.data?.data ?? [];

  const totalSpend = bySupplier.reduce((sum, row) => sum + row.total, 0);
  const onTimeTotals = deliveryPerformance.reduce(
    (acc, row) => ({ onTime: acc.onTime + row.onTimeCount, total: acc.total + row.totalCount }),
    { onTime: 0, total: 0 },
  );
  const overallOnTimeRate = onTimeTotals.total > 0 ? onTimeTotals.onTime / onTimeTotals.total : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label={t("reorder.title")}
          value={reorderSuggestions.length}
          icon={AlertTriangle}
          tone={reorderSuggestions.length > 0 ? "warning" : "default"}
        />
        <StatTile label={t("spendBySupplier.title")} value={formatDa(totalSpend)} icon={TrendingUp} />
        <StatTile
          label={t("deliveryPerformance.title")}
          value={overallOnTimeRate !== null ? `${Math.round(overallOnTimeRate * 100)}%` : "—"}
          icon={Truck}
        />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("reorder.title")}</h2>
          <ExportButtons baseUrl="/api/procurement-reports/reorder-suggestions" />
        </div>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reorder.table.product")}</TableHead>
                <TableHead>{t("reorder.table.store")}</TableHead>
                <TableHead className="text-right">{t("reorder.table.onHand")}</TableHead>
                <TableHead className="text-right">{t("reorder.table.minLevel")}</TableHead>
                <TableHead>{t("reorder.table.supplier")}</TableHead>
                <TableHead className="text-right">{t("reorder.table.suggestedQuantity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!reorderQuery.isLoading && reorderSuggestions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t("reorder.empty")}
                  </TableCell>
                </TableRow>
              )}
              {reorderSuggestions.map((row) => (
                <TableRow key={`${row.productId}-${row.storeName}`}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell>{row.storeName}</TableCell>
                  <TableCell className="text-right">{row.quantityOnHand}</TableCell>
                  <TableCell className="text-right">{row.minStockLevel}</TableCell>
                  <TableCell>{row.supplier?.name ?? t("reorder.noSupplier")}</TableCell>
                  <TableCell className="text-right">{row.suggestedQuantity ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("spendBySupplier.title")}</h2>
          <ExportButtons baseUrl="/api/procurement-reports/purchase-analytics" />
        </div>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("spendBySupplier.table.supplier")}</TableHead>
                <TableHead className="text-right">{t("spendBySupplier.table.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!analyticsQuery.isLoading && bySupplier.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    {t("spendBySupplier.empty")}
                  </TableCell>
                </TableRow>
              )}
              {bySupplier.map((row) => (
                <TableRow key={row.supplierId}>
                  <TableCell className="font-medium">{row.supplierName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDa(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("spendByCategory.title")}</h2>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("spendByCategory.table.category")}</TableHead>
                <TableHead className="text-right">{t("spendByCategory.table.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!analyticsQuery.isLoading && byCategory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    {t("spendByCategory.empty")}
                  </TableCell>
                </TableRow>
              )}
              {byCategory.map((row) => (
                <TableRow key={row.categoryId ?? "uncategorized"}>
                  <TableCell className="font-medium">{row.categoryName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDa(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("deliveryPerformance.title")}</h2>
          <ExportButtons baseUrl="/api/procurement-reports/delivery-performance" />
        </div>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("deliveryPerformance.table.supplier")}</TableHead>
                <TableHead className="text-right">{t("deliveryPerformance.table.onTime")}</TableHead>
                <TableHead className="text-right">{t("deliveryPerformance.table.total")}</TableHead>
                <TableHead className="text-right">{t("deliveryPerformance.table.rate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!deliveryQuery.isLoading && deliveryPerformance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t("deliveryPerformance.empty")}
                  </TableCell>
                </TableRow>
              )}
              {deliveryPerformance.map((row) => (
                <TableRow key={row.supplierId}>
                  <TableCell className="font-medium">{row.supplierName}</TableCell>
                  <TableCell className="text-right">{row.onTimeCount}</TableCell>
                  <TableCell className="text-right">{row.totalCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(row.onTimeRate * 100)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
