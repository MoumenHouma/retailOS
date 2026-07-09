"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { formatDa } from "@/lib/currency";

interface SaleItemDetail {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  returnItems: { quantity: number }[];
}

interface SaleDetail {
  id: string;
  saleNumber: string;
  storeId: string;
  items: SaleItemDetail[];
}

async function fetchSale(saleId: string): Promise<SaleDetail> {
  const response = await fetch(`/api/pos/sales/${saleId}`);
  if (!response.ok) throw new Error("Failed to load sale");
  const body: { data: SaleDetail } = await response.json();
  return body.data;
}

export function ReturnDialog({
  saleId,
  trigger,
  onReturned,
}: {
  saleId: string;
  trigger: React.ReactNode;
  onReturned?: () => void;
}) {
  const t = useTranslations("pos.returns");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: sale } = useQuery({
    queryKey: ["pos-sale-detail", saleId],
    queryFn: () => fetchSale(saleId),
    enabled: open,
  });

  function remaining(item: SaleItemDetail) {
    const alreadyReturned = item.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
    return item.quantity - alreadyReturned;
  }

  async function handleSubmit() {
    if (!sale) return;
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/pos/sales/${sale.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: sale.storeId, reason: reason || undefined, items }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("error"));
        return;
      }

      toast.success(t("success"));
      queryClient.invalidateQueries({ queryKey: ["pos-sale-detail", saleId] });
      setQuantities({});
      setReason("");
      setOpen(false);
      onReturned?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{sale ? t("description", { number: sale.saleNumber }) : ""}</DialogDescription>
        </DialogHeader>
        {sale && (
          <div className="flex flex-col gap-3">
            {sale.items.map((item) => {
              const max = remaining(item);
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex-1">
                    <p>{item.productName}</p>
                    <p className="text-muted-foreground">
                      {t("sold", { quantity: item.quantity })} — {formatDa(item.unitPrice)}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    disabled={max <= 0}
                    value={quantities[item.id] ?? 0}
                    onChange={(event) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [item.id]: Math.min(max, Math.max(0, Number(event.target.value) || 0)),
                      }))
                    }
                    className="w-20"
                  />
                </div>
              );
            })}
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("reason")} />
            <DialogFooter>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? t("submitting") : t("submit")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
