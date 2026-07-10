"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Download, Receipt, TrendingUp, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDa } from "@/lib/currency";

interface SalesReport {
  buckets: { period: string; revenue: number; saleCount: number }[];
  topProducts: { productId: string; productName: string; quantitySold: number; revenue: number }[];
  summary: { totalRevenue: number; saleCount: number; averageBasket: number };
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export function SalesReportView() {
  const t = useTranslations("reports.sales");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());

  const params = useMemo(() => new URLSearchParams({ from, to, granularity: "daily" }), [from, to]);

  const query = useQuery({
    queryKey: ["sales-report", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return (await res.json()) as { data: SalesReport };
    },
  });

  const report = query.data?.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sales-report-from">{t("from")}</Label>
          <Input id="sales-report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sales-report-to">{t("to")}</Label>
          <Input id="sales-report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {(["pdf", "xlsx", "csv"] as const).map((format) => (
            <Button key={format} variant="outline" size="sm" asChild>
              <a href={`/api/reports/sales?format=${format}&${params.toString()}`}>
                <Download className="h-4 w-4" />
                {format.toUpperCase()}
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={t("summary.totalRevenue")} value={formatDa(report?.summary.totalRevenue ?? 0)} icon={TrendingUp} />
        <StatTile label={t("summary.saleCount")} value={report?.summary.saleCount ?? 0} icon={Receipt} />
        <StatTile label={t("summary.averageBasket")} value={formatDa(report?.summary.averageBasket ?? 0)} icon={ShoppingBag} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("buckets.title")}</h2>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("buckets.period")}</TableHead>
                <TableHead className="text-right">{t("buckets.revenue")}</TableHead>
                <TableHead className="text-right">{t("buckets.saleCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.buckets ?? []).map((b) => (
                <TableRow key={b.period}>
                  <TableCell>{b.period}</TableCell>
                  <TableCell className="text-right">{formatDa(b.revenue)}</TableCell>
                  <TableCell className="text-right">{b.saleCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("topProducts.title")}</h2>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("topProducts.product")}</TableHead>
                <TableHead className="text-right">{t("topProducts.quantitySold")}</TableHead>
                <TableHead className="text-right">{t("topProducts.revenue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.topProducts ?? []).map((p) => (
                <TableRow key={p.productId}>
                  <TableCell>{p.productName}</TableCell>
                  <TableCell className="text-right">{p.quantitySold}</TableCell>
                  <TableCell className="text-right">{formatDa(p.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
