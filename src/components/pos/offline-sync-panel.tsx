"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDa } from "@/lib/currency";
import type { LocalQueuedSale } from "@/lib/offline-db";

export function OfflineSyncPanel({
  isOnline,
  pendingCount,
  conflictSales,
  onRetry,
  onDiscard,
}: {
  isOnline: boolean;
  pendingCount: number;
  conflictSales: LocalQueuedSale[];
  onRetry: (localId: string) => void;
  onDiscard: (localId: string) => void;
}) {
  const t = useTranslations("pos.offline");
  const [open, setOpen] = useState(false);
  const hasAnything = pendingCount > 0 || conflictSales.length > 0;

  if (isOnline && !hasAnything) return null;

  return (
    <div className="flex items-center gap-2">
      {!isOnline && (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" />
          {t("offlineBadge")}
        </Badge>
      )}
      {hasAnything && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {conflictSales.length > 0
                ? t("conflictsBadge", { count: conflictSales.length })
                : t("pendingBadge", { count: pendingCount })}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              {pendingCount > 0 && (
                <p className="text-sm text-muted-foreground">{t("pendingCount", { count: pendingCount })}</p>
              )}
              {conflictSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noConflicts")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {conflictSales.map((sale) => (
                    <li key={sale.localId} className="rounded-md border border-destructive/50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {formatDa(sale.payments.reduce((sum, payment) => sum + payment.amount, 0))}
                        </span>
                        <span className="text-muted-foreground">{new Date(sale.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-destructive">{sale.conflictMessage}</p>
                      <div className="mt-2 flex gap-2">
                        <Button type="button" size="sm" onClick={() => onRetry(sale.localId)}>
                          {t("retry")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onDiscard(sale.localId)}
                        >
                          {t("discard")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
