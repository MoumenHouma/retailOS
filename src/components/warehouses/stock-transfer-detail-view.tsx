"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TransferItem {
  id: string;
  product: { name: string };
  quantityRequested: number;
  quantitySent: number;
  quantityReceived: number;
}

interface TransferDetail {
  id: string;
  transferNumber: string;
  status: string;
  notes: string | null;
  fromStore: { name: string };
  toStore: { name: string };
  items: TransferItem[];
}

async function fetchTransfer(id: string): Promise<TransferDetail> {
  const response = await fetch(`/api/stock-transfers/${id}`);
  if (!response.ok) throw new Error("Failed to load transfer");
  const body: { data: TransferDetail } = await response.json();
  return body.data;
}

async function postAction(id: string, action: string, body?: unknown) {
  const response = await fetch(`/api/stock-transfers/${id}/${action}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error?.message ?? "Action failed");
  }
}

export function StockTransferDetailView({ id }: { id: string }) {
  const t = useTranslations("stockTransfers");
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: transfer, isLoading, isError } = useQuery({
    queryKey: ["stock-transfer", id],
    queryFn: () => fetchTransfer(id),
  });

  async function runAction(action: string, successKey: string, body?: unknown) {
    setBusy(true);
    try {
      await postAction(id, action, body);
      toast.success(t(successKey));
      queryClient.invalidateQueries({ queryKey: ["stock-transfer", id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionError"));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  if (isError || !transfer) return <p className="text-destructive">{t("loadError")}</p>;

  const sendItems = transfer.items.map((item) => ({ itemId: item.id }));
  const receiveItems = transfer.items.map((item) => ({ itemId: item.id }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{transfer.transferNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {transfer.fromStore.name} → {transfer.toStore.name}
          </p>
        </div>
        <Badge>{t(`status.${transfer.status}`)}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {transfer.status === "draft" && (
          <Button onClick={() => runAction("approve", "actions.approveSuccess")} disabled={busy}>
            {t("actions.approve")}
          </Button>
        )}
        {transfer.status === "pending" && (
          <Button
            onClick={() => runAction("send", "actions.sendSuccess", { items: sendItems })}
            disabled={busy}
          >
            {t("actions.send")}
          </Button>
        )}
        {transfer.status === "in_transit" && (
          <Button
            onClick={() => runAction("receive", "actions.receiveSuccess", { items: receiveItems })}
            disabled={busy}
          >
            {t("actions.receive")}
          </Button>
        )}
        {(transfer.status === "draft" || transfer.status === "pending") && (
          <Button variant="outline" onClick={() => runAction("cancel", "actions.cancelSuccess")} disabled={busy}>
            {t("actions.cancel")}
          </Button>
        )}
      </div>

      {transfer.notes && <p className="text-sm text-muted-foreground">{transfer.notes}</p>}

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("form.product")}</TableHead>
              <TableHead className="text-right">{t("table.requested")}</TableHead>
              <TableHead className="text-right">{t("table.sent")}</TableHead>
              <TableHead className="text-right">{t("table.received")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfer.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product.name}</TableCell>
                <TableCell className="text-right">{item.quantityRequested}</TableCell>
                <TableCell className="text-right">{item.quantitySent}</TableCell>
                <TableCell className="text-right">{item.quantityReceived}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
