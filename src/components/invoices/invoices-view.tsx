"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDa } from "@/lib/currency";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  customerName: string | null;
  netToPay: number;
}

interface InvoicesResponse {
  data: InvoiceRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 20;

async function fetchInvoices(page: number): Promise<InvoicesResponse> {
  const response = await fetch(`/api/invoices?page=${page}&pageSize=${PAGE_SIZE}`);
  if (!response.ok) throw new Error("Failed to load invoices");
  return response.json();
}

export function InvoicesView() {
  const t = useTranslations("invoices");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoices", page],
    queryFn: () => fetchInvoices(page),
    placeholderData: (previous) => previous,
  });

  const invoices = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.number")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead>{t("table.customer")}</TableHead>
              <TableHead className="text-right">{t("table.netToPay")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive">
                  {t("loadError")}
                </TableCell>
              </TableRow>
            )}
            {!isError && !isLoading && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                <TableCell>{invoice.customerName ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(invoice.netToPay)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4" />
                      {t("table.view")}
                    </a>
                  </Button>
                </TableCell>
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
