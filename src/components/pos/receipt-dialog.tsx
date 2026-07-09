"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDa } from "@/lib/currency";
import type { CompletedSale } from "@/components/pos/payment-dialog";

export function ReceiptDialog({
  sale,
  onNewSale,
}: {
  sale: CompletedSale | null;
  onNewSale: () => void;
}) {
  const t = useTranslations("pos.receipt");

  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onNewSale()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("saleNumber", { number: sale.saleNumber })}</p>
            <div className="flex justify-between text-lg font-semibold">
              <span>{formatDa(sale.total)}</span>
            </div>
            {sale.changeDue > 0 && (
              <p className="text-sm text-muted-foreground">{formatDa(sale.changeDue)}</p>
            )}
            <Button type="button" onClick={onNewSale} autoFocus>
              {t("newSale")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
