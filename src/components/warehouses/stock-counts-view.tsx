"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CountStatus = "in_progress" | "pending_review" | "approved" | "cancelled";

interface CountRow {
  id: string;
  countNumber: string;
  status: CountStatus;
  startedAt: string;
  store: { name: string };
  items: { id: string }[];
}

interface CountsResponse {
  data: CountRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 20;

async function fetchCounts(params: { status: CountStatus | "all"; page: number }): Promise<CountsResponse> {
  const searchParams = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
  if (params.status !== "all") searchParams.set("status", params.status);
  const response = await fetch(`/api/stock-counts?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load stock counts");
  return response.json();
}

export function StockCountsView() {
  const t = useTranslations("stockCounts");
  const [status, setStatus] = useState<CountStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["stock-counts", { status, page }],
    queryFn: () => fetchCounts({ status, page }),
    placeholderData: (previous) => previous,
  });

  const counts = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        action={
          <Button asChild>
            <Link href="/stock-counts/new">
              <Plus />
              {t("newCount")}
            </Link>
          </Button>
        }
      />

      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value as CountStatus | "all");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter.all")}</SelectItem>
          <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
          <SelectItem value="pending_review">{t("status.pending_review")}</SelectItem>
          <SelectItem value="approved">{t("status.approved")}</SelectItem>
          <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.countNumber")}</TableHead>
              <TableHead>{t("table.store")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead className="text-right">{t("table.items")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
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
            {!isError && !isLoading && counts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {counts.map((count) => (
              <TableRow key={count.id}>
                <TableCell className="font-medium">
                  <Link href={`/stock-counts/${count.id}`} className="hover:underline">
                    {count.countNumber}
                  </Link>
                </TableCell>
                <TableCell>{count.store.name}</TableCell>
                <TableCell>{new Date(count.startedAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{count.items.length}</TableCell>
                <TableCell>
                  <StatusBadge domain="count" status={count.status}>
                    {t(`status.${count.status}`)}
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
