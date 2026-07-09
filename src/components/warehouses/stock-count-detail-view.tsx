"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CountItem {
  id: string;
  product: { name: string };
  systemQuantity: number;
  countedQuantity: number;
  difference: number;
  adjustmentStatus: string;
}

interface CountDetail {
  id: string;
  countNumber: string;
  status: string;
  notes: string | null;
  store: { name: string };
  items: CountItem[];
}

async function fetchCount(id: string): Promise<CountDetail> {
  const response = await fetch(`/api/stock-counts/${id}`);
  if (!response.ok) throw new Error("Failed to load stock count");
  const body: { data: CountDetail } = await response.json();
  return body.data;
}

async function postAction(id: string, action: string) {
  const response = await fetch(`/api/stock-counts/${id}/${action}`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Action failed");
  }
}

export function StockCountDetailView({ id }: { id: string }) {
  const t = useTranslations("stockCounts");
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: count, isLoading, isError } = useQuery({
    queryKey: ["stock-count", id],
    queryFn: () => fetchCount(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["stock-count", id] });
  }

  async function handleCountedChange(itemId: string, value: number) {
    const response = await fetch(`/api/stock-counts/${id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countedQuantity: value }),
    });
    if (!response.ok) {
      toast.error(t("countEntryError"));
      return;
    }
    invalidate();
  }

  async function runAction(action: string, successKey: string) {
    setBusy(true);
    try {
      await postAction(id, action);
      toast.success(t(successKey));
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionError"));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  if (isError || !count) return <p className="text-destructive">{t("loadError")}</p>;

  const editable = count.status === "in_progress";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{count.countNumber}</h1>
          <p className="text-sm text-muted-foreground">{count.store.name}</p>
        </div>
        <Badge>{t(`status.${count.status}`)}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {count.status === "in_progress" && (
          <Button onClick={() => runAction("submit", "actions.submitSuccess")} disabled={busy}>
            {t("actions.submit")}
          </Button>
        )}
        {count.status === "pending_review" && (
          <Button onClick={() => runAction("approve", "actions.approveSuccess")} disabled={busy}>
            {t("actions.approve")}
          </Button>
        )}
        {(count.status === "in_progress" || count.status === "pending_review") && (
          <Button variant="outline" onClick={() => runAction("cancel", "actions.cancelSuccess")} disabled={busy}>
            {t("actions.cancel")}
          </Button>
        )}
      </div>

      {count.notes && <p className="text-sm text-muted-foreground">{count.notes}</p>}

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead className="text-right">{t("table.system")}</TableHead>
              <TableHead className="text-right">{t("table.counted")}</TableHead>
              <TableHead className="text-right">{t("table.difference")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {count.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product.name}</TableCell>
                <TableCell className="text-right">{item.systemQuantity}</TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      defaultValue={item.countedQuantity}
                      className="w-24 text-right"
                      onBlur={(event) => {
                        const value = Math.max(0, Number(event.target.value) || 0);
                        if (value !== item.countedQuantity) handleCountedChange(item.id, value);
                      }}
                    />
                  ) : (
                    item.countedQuantity
                  )}
                </TableCell>
                <TableCell
                  className={
                    "text-right tabular-nums " +
                    (item.difference > 0
                      ? "text-emerald-600"
                      : item.difference < 0
                        ? "text-destructive"
                        : "text-muted-foreground")
                  }
                >
                  {item.difference > 0 ? `+${item.difference}` : item.difference}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
