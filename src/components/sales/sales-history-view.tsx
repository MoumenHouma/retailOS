"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { ReturnDialog } from "@/components/pos/return-dialog";

interface SaleRow {
  id: string;
  saleNumber: string;
  total: number;
  createdAt: string;
  customer: { name: string } | null;
  items: { id: string }[];
}

interface SalesResponse {
  data: SaleRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 20;

async function fetchSales(params: { q: string; page: number }): Promise<SalesResponse> {
  const searchParams = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
  if (params.q) searchParams.set("q", params.q);
  const response = await fetch(`/api/pos/sales?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load sales");
  return response.json();
}

export function SalesHistoryView() {
  const t = useTranslations("sales");
  const { data: authSession } = useSession();
  const canRefund = authSession?.user.permissions.includes("pos:refund") ?? false;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const queryKey = ["pos-sales-history", { q: debouncedSearch, page }];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchSales({ q: debouncedSearch, page }),
    placeholderData: (previous) => previous,
  });

  const sales = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t("searchPlaceholder")}
          className="pl-8"
        />
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.saleNumber")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead>{t("table.customer")}</TableHead>
              <TableHead className="text-right">{t("table.items")}</TableHead>
              <TableHead className="text-right">{t("table.total")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
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
            {!isError && !isLoading && sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">{sale.saleNumber}</TableCell>
                <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                <TableCell>{sale.customer?.name ?? t("walkInCustomer")}</TableCell>
                <TableCell className="text-right">{sale.items.length}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(sale.total)}</TableCell>
                <TableCell className="text-right">
                  {canRefund && (
                    <ReturnDialog
                      saleId={sale.id}
                      onReturned={() => queryClient.invalidateQueries({ queryKey: ["pos-sales-history"] })}
                      trigger={
                        <Button variant="ghost" size="sm">
                          {t("table.return")}
                        </Button>
                      }
                    />
                  )}
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
