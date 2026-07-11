"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Banknote, Download, Landmark, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";

interface BalanceSheet {
  assets: { cash: number; accountsReceivable: number; inventoryValue: number; total: number };
  liabilities: { accountsPayable: number; total: number };
  equity: number;
}

interface CashFlow {
  cashIn: { fromSales: number; fromInvoicePayments: number; fromDebtPayments: number; total: number };
  cashOut: { expenses: number; total: number };
  netCashFlow: number;
  purchasesAccrual: number;
}

interface TaxReportBucket {
  period: string;
  collected: number;
  paidPurchases: number;
  paidExpenses: number;
  paidTotal: number;
  net: number;
}

interface ExpenseCategoryRollup {
  categoryId: string;
  categoryName: string;
  parentId: string | null;
  ownAmount: number;
  totalAmount: number;
}

interface MarginAnalysisEntry {
  key: string;
  label: string;
  quantity: number;
  revenue: number;
  margin: number;
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string): Promise<{ data: T }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

// Shared across every tab in this file — one Download button per format,
// same pattern the report retrofit (buildReportExportResponse) established.
function ExportButtons({ baseUrl, params }: { baseUrl: string; params: URLSearchParams }) {
  return (
    <div className="flex gap-2">
      {(["pdf", "xlsx", "csv"] as const).map((format) => {
        const exportParams = new URLSearchParams(params);
        exportParams.set("format", format);
        return (
          <Button key={format} variant="outline" size="sm" asChild>
            <a href={`${baseUrl}?${exportParams.toString()}`}>
              <Download className="h-4 w-4" />
              {format.toUpperCase()}
            </a>
          </Button>
        );
      })}
    </div>
  );
}

export function FinancialReportsView() {
  const t = useTranslations("financialReports");
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [taxBucket, setTaxBucket] = useState<"monthly" | "quarterly">("monthly");
  const [marginGroupBy, setMarginGroupBy] = useState<"product" | "category" | "brand">("product");

  const periodParams = new URLSearchParams({ from, to });
  const taxParams = new URLSearchParams({ from, to, bucket: taxBucket });
  const marginParams = new URLSearchParams({ from, to, groupBy: marginGroupBy });

  const balanceSheetQuery = useQuery({
    queryKey: ["finance-balance-sheet"],
    queryFn: () => fetchJson<BalanceSheet>("/api/finance/balance-sheet"),
  });
  const cashFlowQuery = useQuery({
    queryKey: ["finance-cash-flow", from, to],
    queryFn: () => fetchJson<CashFlow>(`/api/finance/cash-flow?${periodParams.toString()}`),
  });
  const taxReportQuery = useQuery({
    queryKey: ["finance-tax-report", from, to, taxBucket],
    queryFn: () => fetchJson<TaxReportBucket[]>(`/api/finance/tax-report?${taxParams.toString()}`),
  });
  const expenseAnalysisQuery = useQuery({
    queryKey: ["finance-expense-analysis", from, to],
    queryFn: () => fetchJson<ExpenseCategoryRollup[]>(`/api/finance/expense-analysis?${periodParams.toString()}`),
  });
  const marginAnalysisQuery = useQuery({
    queryKey: ["finance-margin-analysis", from, to, marginGroupBy],
    queryFn: () => fetchJson<MarginAnalysisEntry[]>(`/api/finance/margin-analysis?${marginParams.toString()}`),
  });

  const balanceSheet = balanceSheetQuery.data?.data;
  const cashFlow = cashFlowQuery.data?.data;
  const taxBuckets = taxReportQuery.data?.data ?? [];
  const expenseRollups = expenseAnalysisQuery.data?.data ?? [];
  const marginEntries = marginAnalysisQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />

      <Tabs defaultValue="balance-sheet">
        <TabsList>
          <TabsTrigger value="balance-sheet">{t("balanceSheet.title")}</TabsTrigger>
          <TabsTrigger value="cash-flow">{t("cashFlow.title")}</TabsTrigger>
          <TabsTrigger value="tax-report">{t("taxReport.title")}</TabsTrigger>
          <TabsTrigger value="expense-analysis">{t("expenseAnalysis.title")}</TabsTrigger>
          <TabsTrigger value="margin-analysis">{t("marginAnalysis.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("balanceSheet.description")}</p>
            <ExportButtons baseUrl="/api/finance/balance-sheet" params={new URLSearchParams()} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label={t("balanceSheet.cash")} value={formatDa(balanceSheet?.assets.cash ?? 0)} icon={Wallet} />
            <StatTile
              label={t("balanceSheet.accountsReceivable")}
              value={formatDa(balanceSheet?.assets.accountsReceivable ?? 0)}
              icon={Banknote}
            />
            <StatTile
              label={t("balanceSheet.inventoryValue")}
              value={formatDa(balanceSheet?.assets.inventoryValue ?? 0)}
              icon={Landmark}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label={t("balanceSheet.totalAssets")} value={formatDa(balanceSheet?.assets.total ?? 0)} icon={TrendingUp} />
            <StatTile
              label={t("balanceSheet.totalLiabilities")}
              value={formatDa(balanceSheet?.liabilities.total ?? 0)}
              icon={TrendingDown}
            />
            <StatTile
              label={t("balanceSheet.equity")}
              value={formatDa(balanceSheet?.equity ?? 0)}
              icon={Scale}
              tone={(balanceSheet?.equity ?? 0) < 0 ? "destructive" : "default"}
            />
          </div>
        </TabsContent>

        <TabsContent value="cash-flow" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <ExportButtons baseUrl="/api/finance/cash-flow" params={periodParams} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatTile label={t("cashFlow.cashIn")} value={formatDa(cashFlow?.cashIn.total ?? 0)} icon={TrendingUp} />
            <StatTile label={t("cashFlow.cashOut")} value={formatDa(cashFlow?.cashOut.total ?? 0)} icon={TrendingDown} />
            <StatTile
              label={t("cashFlow.netCashFlow")}
              value={formatDa(cashFlow?.netCashFlow ?? 0)}
              icon={Wallet}
              tone={(cashFlow?.netCashFlow ?? 0) < 0 ? "destructive" : "default"}
            />
            <StatTile label={t("cashFlow.purchasesAccrual")} value={formatDa(cashFlow?.purchasesAccrual ?? 0)} icon={Landmark} />
          </div>
        </TabsContent>

        <TabsContent value="tax-report" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <div className="flex flex-col gap-1.5">
              <Label>{t("taxReport.bucket")}</Label>
              <Select value={taxBucket} onValueChange={(value) => setTaxBucket(value as typeof taxBucket)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t("taxReport.bucketOptions.monthly")}</SelectItem>
                  <SelectItem value="quarterly">{t("taxReport.bucketOptions.quarterly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ExportButtons baseUrl="/api/finance/tax-report" params={taxParams} />
          </div>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("taxReport.table.period")}</TableHead>
                  <TableHead className="text-right">{t("taxReport.table.collected")}</TableHead>
                  <TableHead className="text-right">{t("taxReport.table.paidPurchases")}</TableHead>
                  <TableHead className="text-right">{t("taxReport.table.paidExpenses")}</TableHead>
                  <TableHead className="text-right">{t("taxReport.table.net")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!taxReportQuery.isLoading && taxBuckets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("taxReport.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {taxBuckets.map((bucket) => (
                  <TableRow key={bucket.period}>
                    <TableCell className="font-medium">{bucket.period}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(bucket.collected)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(bucket.paidPurchases)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(bucket.paidExpenses)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(bucket.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="expense-analysis" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <ExportButtons baseUrl="/api/finance/expense-analysis" params={periodParams} />
          </div>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("expenseAnalysis.table.category")}</TableHead>
                  <TableHead className="text-right">{t("expenseAnalysis.table.ownAmount")}</TableHead>
                  <TableHead className="text-right">{t("expenseAnalysis.table.totalAmount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!expenseAnalysisQuery.isLoading && expenseRollups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {t("expenseAnalysis.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {expenseRollups.map((row) => (
                  <TableRow key={row.categoryId}>
                    <TableCell className="font-medium">{row.categoryName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(row.ownAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(row.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="margin-analysis" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
              <div className="flex flex-col gap-1.5">
                <Label>{t("marginAnalysis.groupBy")}</Label>
                <Select value={marginGroupBy} onValueChange={(value) => setMarginGroupBy(value as typeof marginGroupBy)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{t("marginAnalysis.groupByOptions.product")}</SelectItem>
                    <SelectItem value="category">{t("marginAnalysis.groupByOptions.category")}</SelectItem>
                    <SelectItem value="brand">{t("marginAnalysis.groupByOptions.brand")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ExportButtons baseUrl="/api/finance/margin-analysis" params={marginParams} />
          </div>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("marginAnalysis.table.label")}</TableHead>
                  <TableHead className="text-right">{t("marginAnalysis.table.quantity")}</TableHead>
                  <TableHead className="text-right">{t("marginAnalysis.table.revenue")}</TableHead>
                  <TableHead className="text-right">{t("marginAnalysis.table.margin")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!marginAnalysisQuery.isLoading && marginEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("marginAnalysis.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {marginEntries.map((entry) => (
                  <TableRow key={entry.key}>
                    <TableCell className="font-medium">{entry.label}</TableCell>
                    <TableCell className="text-right">{entry.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(entry.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(entry.margin)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const t = useTranslations("financialReports");
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reports-from">{t("from")}</Label>
        <Input id="reports-from" type="date" value={from} onChange={(event) => onFrom(event.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reports-to">{t("to")}</Label>
        <Input id="reports-to" type="date" value={to} onChange={(event) => onTo(event.target.value)} />
      </div>
    </div>
  );
}
