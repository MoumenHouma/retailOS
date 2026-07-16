"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDa } from "@/lib/currency";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";

type PoStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  status: PoStatus;
  total: number;
  createdAt: string;
  supplier: { name: string };
  items: { id: string }[];
}

interface PurchaseOrdersResponse {
  data: PurchaseOrderRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 20;

async function fetchPurchaseOrders(params: {
  q: string;
  status: PoStatus | "all";
  page: number;
}): Promise<PurchaseOrdersResponse> {
  const searchParams = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
  if (params.q) searchParams.set("q", params.q);
  if (params.status !== "all") searchParams.set("status", params.status);
  const response = await fetch(`/api/purchase-orders?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load purchase orders");
  return response.json();
}

export function PurchaseOrdersView() {
  const t = useTranslations("purchaseOrders");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<PoStatus | "all">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["purchase-orders", { q: debouncedSearch, status, page }],
    queryFn: () => fetchPurchaseOrders({ q: debouncedSearch, status, page }),
    placeholderData: (previous) => previous,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        action={
          <Button asChild>
            <Link href="/purchase-orders/new">
              <Plus />
              {t("newPurchaseOrder")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-52">
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
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as PoStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.all")}</SelectItem>
            <SelectItem value="draft">{t("status.draft")}</SelectItem>
            <SelectItem value="pending_approval">{t("status.pending_approval")}</SelectItem>
            <SelectItem value="approved">{t("status.approved")}</SelectItem>
            <SelectItem value="ordered">{t("status.ordered")}</SelectItem>
            <SelectItem value="partially_received">{t("status.partially_received")}</SelectItem>
            <SelectItem value="received">{t("status.received")}</SelectItem>
            <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.poNumber")}</TableHead>
              <TableHead>{t("table.supplier")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead className="text-right">{t("table.items")}</TableHead>
              <TableHead className="text-right">{t("table.total")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRowsSkeleton columns={6} />}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive">
                  {t("loadError")}
                </TableCell>
              </TableRow>
            )}
            {!isError && !isLoading && orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {orders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">
                  <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                    {po.poNumber}
                  </Link>
                </TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{po.items.length}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(po.total)}</TableCell>
                <TableCell>
                  <StatusBadge domain="po" status={po.status}>
                    {t(`status.${po.status}`)}
                  </StatusBadge>
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
