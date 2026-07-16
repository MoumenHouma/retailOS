"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";
import { fetchJsonData } from "@/lib/fetch-json";

interface PerformanceRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  salesTotal: number;
  salesCount: number;
  commissionTotal: number;
  shiftsScheduled: number;
  attendanceRecords: number;
  attendanceRate: number | null;
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EmployeePerformanceView() {
  const t = useTranslations("employeePerformance");
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());

  const params = new URLSearchParams({ from, to });
  const performanceQuery = useQuery({
    queryKey: ["employee-performance", from, to],
    queryFn: () => fetchJsonData<PerformanceRow[]>(`/api/employee-performance?${params.toString()}`),
  });
  const rows = performanceQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="performance-from">{t("from")}</Label>
          <Input id="performance-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="performance-to">{t("to")}</Label>
          <Input id="performance-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="flex gap-2">
          {(["pdf", "xlsx", "csv"] as const).map((format) => (
            <Button key={format} variant="outline" size="sm" asChild>
              <a href={`/api/employee-performance?format=${format}&${params.toString()}`}>
                <Download className="h-4 w-4" />
                {format.toUpperCase()}
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.employee")}</TableHead>
              <TableHead className="text-right">{t("table.salesCount")}</TableHead>
              <TableHead className="text-right">{t("table.salesTotal")}</TableHead>
              <TableHead className="text-right">{t("table.commissionTotal")}</TableHead>
              <TableHead className="text-right">{t("table.shiftsScheduled")}</TableHead>
              <TableHead className="text-right">{t("table.attendanceRate")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!performanceQuery.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.employeeId}>
                <TableCell className="font-medium">
                  {row.firstName} {row.lastName}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.salesCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(row.salesTotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(row.commissionTotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.shiftsScheduled}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.attendanceRate !== null ? `${Math.round(row.attendanceRate * 100)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
