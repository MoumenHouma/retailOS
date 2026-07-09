"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDa } from "@/lib/currency";
import { usePosCartStore, type PosCartLine } from "@/stores/pos-cart-store";

interface HeldSaleItem {
  productId: string;
  productName: string;
  productBarcode: string | null;
  quantity: number;
  unitPrice: number;
  tvaRate: number;
  discountAmount: number;
}

interface HeldSale {
  id: string;
  saleNumber: string;
  total: number;
  discountAmount: number;
  createdAt: string;
  items: HeldSaleItem[];
}

async function fetchHeldSales(storeId: string): Promise<HeldSale[]> {
  const response = await fetch(`/api/pos/sales/held?storeId=${storeId}`);
  if (!response.ok) throw new Error("Failed to load held sales");
  const body: { data: HeldSale[] } = await response.json();
  return body.data;
}

export function HeldSalesDialog({ storeId }: { storeId: string }) {
  const t = useTranslations("pos.hold");
  const queryClient = useQueryClient();
  const loadLines = usePosCartStore((state) => state.loadLines);
  const [open, setOpen] = useState(false);

  const { data: heldSales = [] } = useQuery({
    queryKey: ["pos-held-sales", storeId],
    queryFn: () => fetchHeldSales(storeId),
    enabled: open,
  });

  async function handleRecall(sale: HeldSale) {
    const response = await fetch(`/api/pos/sales/${sale.id}/recall`, { method: "POST" });
    if (!response.ok) {
      toast.error(t("recallError"));
      return;
    }

    const lines: PosCartLine[] = sale.items.map((item) => ({
      productId: item.productId,
      name: item.productName,
      barcode: item.productBarcode,
      unitPrice: item.unitPrice,
      tvaRate: item.tvaRate,
      quantity: item.quantity,
      discountAmount: item.discountAmount,
    }));
    loadLines(lines, sale.discountAmount);
    queryClient.invalidateQueries({ queryKey: ["pos-held-sales", storeId] });
    setOpen(false);
    toast.success(t("recallSuccess"));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {t("recall")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        {heldSales.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {heldSales.map((sale) => (
              <li key={sale.id}>
                <button
                  type="button"
                  onClick={() => handleRecall(sale)}
                  className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span>{sale.saleNumber}</span>
                  <span className="text-muted-foreground">
                    {sale.items.length} {t("items")} — {formatDa(sale.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
