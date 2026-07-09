"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DeliveryItem {
  id: string;
  product: { name: string };
  quantityDelivered: number;
  returnItems: { quantity: number }[];
}

interface Delivery {
  id: string;
  deliveryNumber: string;
  items: DeliveryItem[];
}

async function fetchDeliveries(poId: string): Promise<Delivery[]> {
  const response = await fetch(`/api/purchase-orders/${poId}/deliveries`);
  if (!response.ok) throw new Error("Failed to load deliveries");
  const body: { data: Delivery[] } = await response.json();
  return body.data;
}

function remaining(item: DeliveryItem) {
  const alreadyReturned = item.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
  return item.quantityDelivered - alreadyReturned;
}

export function PurchaseReturnDialog({
  poId,
  trigger,
  onReturned,
}: {
  poId: string;
  trigger: React.ReactNode;
  onReturned?: () => void;
}) {
  const t = useTranslations("purchaseOrders.returns");
  const [open, setOpen] = useState(false);
  const [deliveryId, setDeliveryId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: deliveries } = useQuery({
    queryKey: ["purchase-order-deliveries", poId],
    queryFn: () => fetchDeliveries(poId),
    enabled: open,
  });

  const receivedDeliveries = (deliveries ?? []).filter((delivery) =>
    delivery.items.some((item) => remaining(item) > 0),
  );
  const selectedDelivery = receivedDeliveries.find((delivery) => delivery.id === deliveryId);

  async function handleSubmit() {
    if (!selectedDelivery) return;
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([deliveryItemId, quantity]) => ({ deliveryItemId, quantity }));

    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${poId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalDeliveryId: selectedDelivery.id,
          reason: reason || undefined,
          items,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("error"));
        return;
      }

      toast.success(t("success"));
      setQuantities({});
      setReason("");
      setDeliveryId("");
      setOpen(false);
      onReturned?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("returnAction")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Select
            value={deliveryId}
            onValueChange={(value) => {
              setDeliveryId(value);
              setQuantities({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("selectDelivery")} />
            </SelectTrigger>
            <SelectContent>
              {receivedDeliveries.map((delivery) => (
                <SelectItem key={delivery.id} value={delivery.id}>
                  {delivery.deliveryNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {receivedDeliveries.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noDeliveries")}</p>
          )}

          {selectedDelivery?.items.map((item) => {
            const max = remaining(item);
            if (max <= 0) return null;
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex-1">
                  <p>{item.product.name}</p>
                  <p className="text-muted-foreground">{t("delivered", { quantity: item.quantityDelivered })}</p>
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

          {selectedDelivery && (
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("reason")} />
          )}

          <DialogFooter>
            <Button type="button" onClick={handleSubmit} disabled={submitting || !selectedDelivery}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
