"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PoLine {
  id: string;
  product: { name: string };
  quantityOrdered: number;
  quantityReceived: number;
}

interface LineState {
  quantityDelivered: number;
  batchNumber: string;
  expirationDate: string;
}

export function ReceiveDeliveryDialog({
  poId,
  items,
  trigger,
  onReceived,
}: {
  poId: string;
  items: PoLine[];
  trigger: React.ReactNode;
  onReceived?: () => void;
}) {
  const t = useTranslations("purchaseOrders.deliveries");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const outstanding = items.filter((item) => item.quantityOrdered > item.quantityReceived);
  const [lines, setLines] = useState<Record<string, LineState>>({});

  // Reset defaults every time the dialog opens — this dialog's trigger
  // button stays mounted across multiple receive actions as long as the PO
  // stays ordered/partially_received, so without this reset a second
  // delivery would silently resubmit the first delivery's stale line
  // values instead of the newly outstanding quantities. Done inside the
  // open-change handler (a real event, not render or an effect) rather than
  // a lazy useState initializer, which only ever runs once per mount.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLines(
        Object.fromEntries(
          outstanding.map((item) => [
            item.id,
            { quantityDelivered: item.quantityOrdered - item.quantityReceived, batchNumber: "", expirationDate: "" },
          ]),
        ),
      );
    }
  }

  function updateLine(poItemId: string, patch: Partial<LineState>) {
    setLines((prev) => {
      const current = prev[poItemId];
      if (!current) return prev;
      return { ...prev, [poItemId]: { ...current, ...patch } };
    });
  }

  async function handleSubmit() {
    const payloadItems = outstanding
      .flatMap((item) => {
        const line = lines[item.id];
        return line ? [{ poItemId: item.id, ...line }] : [];
      })
      .filter((line) => line.quantityDelivered > 0)
      .map((line) => ({
        poItemId: line.poItemId,
        quantityDelivered: line.quantityDelivered,
        batchNumber: line.batchNumber || undefined,
        expirationDate: line.expirationDate || undefined,
      }));

    if (payloadItems.length === 0) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${poId}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("error"));
        return;
      }

      toast.success(t("success"));
      setOpen(false);
      onReceived?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("receiveAction")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {outstanding.length === 0 && <p className="text-sm text-muted-foreground">{t("nothingOutstanding")}</p>}
          {outstanding.map((item) => {
            const max = item.quantityOrdered - item.quantityReceived;
            const line = lines[item.id];
            if (!line) return null;
            return (
              <div key={item.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">{t("outstanding", { quantity: max })}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{t("quantityReceived")}</label>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      value={line.quantityDelivered}
                      onChange={(event) =>
                        updateLine(item.id, {
                          quantityDelivered: Math.min(max, Math.max(0, Number(event.target.value) || 0)),
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{t("batchNumber")}</label>
                    <Input
                      type="text"
                      value={line.batchNumber}
                      onChange={(event) => updateLine(item.id, { batchNumber: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{t("expirationDate")}</label>
                    <Input
                      type="date"
                      value={line.expirationDate}
                      onChange={(event) => updateLine(item.id, { expirationDate: event.target.value })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={submitting || outstanding.length === 0}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
