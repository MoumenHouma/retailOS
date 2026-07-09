"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TransferStatus = "draft" | "pending" | "in_transit" | "received" | "cancelled";

interface TransferRow {
  id: string;
  transferNumber: string;
  status: TransferStatus;
  createdAt: string;
  fromStore: { name: string };
  toStore: { name: string };
  items: { id: string }[];
}

interface TransfersResponse {
  data: TransferRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 20;
const STATUS_BADGE_VARIANT: Record<TransferStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending: "secondary",
  in_transit: "default",
  received: "default",
  cancelled: "destructive",
};

async function fetchTransfers(params: { status: TransferStatus | "all"; page: number }): Promise<TransfersResponse> {
  const searchParams = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
  if (params.status !== "all") searchParams.set("status", params.status);
  const response = await fetch(`/api/stock-transfers?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load transfers");
  return response.json();
}

export function StockTransfersView() {
  const t = useTranslations("stockTransfers");
  const [status, setStatus] = useState<TransferStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["stock-transfers", { status, page }],
    queryFn: () => fetchTransfers({ status, page }),
    placeholderData: (previous) => previous,
  });

  const transfers = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/stock-transfers/new">
            <Plus />
            {t("newTransfer")}
          </Link>
        </Button>
      </div>

      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value as TransferStatus | "all");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter.all")}</SelectItem>
          <SelectItem value="draft">{t("status.draft")}</SelectItem>
          <SelectItem value="pending">{t("status.pending")}</SelectItem>
          <SelectItem value="in_transit">{t("status.in_transit")}</SelectItem>
          <SelectItem value="received">{t("status.received")}</SelectItem>
          <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.transferNumber")}</TableHead>
              <TableHead>{t("table.from")}</TableHead>
              <TableHead>{t("table.to")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead className="text-right">{t("table.items")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
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
            {!isError && !isLoading && transfers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {transfers.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell className="font-medium">
                  <Link href={`/stock-transfers/${transfer.id}`} className="hover:underline">
                    {transfer.transferNumber}
                  </Link>
                </TableCell>
                <TableCell>{transfer.fromStore.name}</TableCell>
                <TableCell>{transfer.toStore.name}</TableCell>
                <TableCell>{new Date(transfer.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{transfer.items.length}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[transfer.status]}>{t(`status.${transfer.status}`)}</Badge>
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
