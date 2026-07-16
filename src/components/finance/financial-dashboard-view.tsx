"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";
import { fetchJsonData } from "@/lib/fetch-json";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";

interface RevenueBucket {
  period: string;
  revenue: number;
  tvaAmount: number;
  total: number;
  saleCount: number;
}

interface ProfitAndLoss {
  revenue: number;
  cogs: number;
  grossMargin: number;
  operatingExpenses: number;
  netProfit: number;
}

interface TvaSummary {
  collected: number;
  paidPurchases: number;
  paidExpenses: number;
  paidTotal: number;
  net: number;
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FinancialDashboardView() {
  const t = useTranslations("financialDashboard");
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");

  const params = new URLSearchParams({ from, to });
  const revenueParams = new URLSearchParams({ from, to, granularity });

  const revenueQuery = useQuery({
    queryKey: ["finance-revenue-dashboard", from, to, granularity],
    queryFn: () => fetchJsonData<RevenueBucket[]>(`/api/finance/revenue-dashboard?${revenueParams.toString()}`),
  });
  const plQuery = useQuery({
    queryKey: ["finance-profit-loss", from, to],
    queryFn: () => fetchJsonData<ProfitAndLoss>(`/api/finance/profit-loss?${params.toString()}`),
  });
  const tvaQuery = useQuery({
    queryKey: ["finance-tva-summary", from, to],
    queryFn: () => fetchJsonData<TvaSummary>(`/api/finance/tva-summary?${params.toString()}`),
  });

  const revenueBuckets = revenueQuery.data?.data ?? [];
  const pl = plQuery.data?.data;
  const tva = tvaQuery.data?.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finance-from">{t("from")}</Label>
          <Input id="finance-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finance-to">{t("to")}</Label>
          <Input id="finance-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("granularity")}</Label>
          <Select value={granularity} onValueChange={(value) => setGranularity(value as typeof granularity)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t("granularityOptions.daily")}</SelectItem>
              <SelectItem value="weekly">{t("granularityOptions.weekly")}</SelectItem>
              <SelectItem value="monthly">{t("granularityOptions.monthly")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("profitAndLoss.title")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label={t("profitAndLoss.revenue")}
            value={formatDa(pl?.revenue ?? 0)}
            icon={TrendingUp}
            loading={plQuery.isLoading}
          />
          <StatTile
            label={t("profitAndLoss.cogs")}
            value={formatDa(pl?.cogs ?? 0)}
            icon={TrendingDown}
            loading={plQuery.isLoading}
          />
          <StatTile
            label={t("profitAndLoss.grossMargin")}
            value={formatDa(pl?.grossMargin ?? 0)}
            icon={Wallet}
            loading={plQuery.isLoading}
          />
          <StatTile
            label={t("profitAndLoss.operatingExpenses")}
            value={formatDa(pl?.operatingExpenses ?? 0)}
            icon={Receipt}
            loading={plQuery.isLoading}
          />
          <StatTile
            label={t("profitAndLoss.netProfit")}
            value={formatDa(pl?.netProfit ?? 0)}
            icon={TrendingUp}
            tone={(pl?.netProfit ?? 0) < 0 ? "destructive" : "default"}
            loading={plQuery.isLoading}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("tvaSummary.title")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile
            label={t("tvaSummary.collected")}
            value={formatDa(tva?.collected ?? 0)}
            icon={TrendingUp}
            loading={tvaQuery.isLoading}
          />
          <StatTile
            label={t("tvaSummary.paidPurchases")}
            value={formatDa(tva?.paidPurchases ?? 0)}
            icon={TrendingDown}
            loading={tvaQuery.isLoading}
          />
          <StatTile
            label={t("tvaSummary.paidExpenses")}
            value={formatDa(tva?.paidExpenses ?? 0)}
            icon={TrendingDown}
            loading={tvaQuery.isLoading}
          />
          <StatTile
            label={t("tvaSummary.net")}
            value={formatDa(tva?.net ?? 0)}
            icon={Wallet}
            loading={tvaQuery.isLoading}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("revenueDashboard.title")}</h2>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("revenueDashboard.table.period")}</TableHead>
                <TableHead className="text-right">{t("revenueDashboard.table.revenue")}</TableHead>
                <TableHead className="text-right">{t("revenueDashboard.table.tva")}</TableHead>
                <TableHead className="text-right">{t("revenueDashboard.table.total")}</TableHead>
                <TableHead className="text-right">{t("revenueDashboard.table.saleCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueQuery.isLoading && <TableRowsSkeleton columns={5} rows={4} />}
              {!revenueQuery.isLoading && revenueBuckets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t("revenueDashboard.empty")}
                  </TableCell>
                </TableRow>
              )}
              {revenueBuckets.map((bucket) => (
                <TableRow key={bucket.period}>
                  <TableCell className="font-medium">{bucket.period}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDa(bucket.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDa(bucket.tvaAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDa(bucket.total)}</TableCell>
                  <TableCell className="text-right">{bucket.saleCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
