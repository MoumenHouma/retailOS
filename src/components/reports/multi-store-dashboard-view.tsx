"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";

interface StoreSummary {
  storeId: string;
  storeName: string;
  isMain: boolean;
  todaySales: number;
  todaySaleCount: number;
  lowStockCount: number;
}

export function MultiStoreDashboardView() {
  const t = useTranslations("multiStore");

  const query = useQuery({
    queryKey: ["multi-store-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/multi-store-dashboard");
      if (!res.ok) throw new Error("Failed to fetch");
      return (await res.json()) as { data: StoreSummary[] };
    },
  });

  const stores = query.data?.data ?? [];
  const totalSales = stores.reduce((sum, s) => sum + s.todaySales, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.store")}</TableHead>
              <TableHead className="text-right">{t("table.todaySales")}</TableHead>
              <TableHead className="text-right">{t("table.saleCount")}</TableHead>
              <TableHead className="text-right">{t("table.lowStock")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map((s) => (
              <TableRow key={s.storeId}>
                <TableCell className="font-medium">
                  {s.storeName} {s.isMain && <Badge variant="outline">{t("table.main")}</Badge>}
                </TableCell>
                <TableCell className="text-right">{formatDa(s.todaySales)}</TableCell>
                <TableCell className="text-right">{s.todaySaleCount}</TableCell>
                <TableCell className="text-right">
                  {s.lowStockCount > 0 ? <Badge variant="warning">{s.lowStockCount}</Badge> : s.lowStockCount}
                </TableCell>
              </TableRow>
            ))}
            {stores.length > 0 && (
              <TableRow className="font-semibold">
                <TableCell>{t("table.total")}</TableCell>
                <TableCell className="text-right">{formatDa(totalSales)}</TableCell>
                <TableCell className="text-right">
                  {stores.reduce((sum, s) => sum + s.todaySaleCount, 0)}
                </TableCell>
                <TableCell className="text-right">
                  {stores.reduce((sum, s) => sum + s.lowStockCount, 0)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
