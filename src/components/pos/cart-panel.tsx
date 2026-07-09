"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDa, daToCentimes, centimesToDa } from "@/lib/currency";
import { cartTotals, usePosCartStore } from "@/stores/pos-cart-store";

export function CartPanel() {
  const t = useTranslations("pos.cart");
  const { data: authSession } = useSession();
  const canDiscount = authSession?.user.permissions.includes("pos:discount") ?? false;

  const lines = usePosCartStore((state) => state.lines);
  const discountAmount = usePosCartStore((state) => state.discountAmount);
  const setQuantity = usePosCartStore((state) => state.setQuantity);
  const setLineDiscount = usePosCartStore((state) => state.setLineDiscount);
  const removeLine = usePosCartStore((state) => state.removeLine);
  const setDiscountAmount = usePosCartStore((state) => state.setDiscountAmount);

  const totals = cartTotals(lines, discountAmount);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        {lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="w-28 text-center">{t("quantity")}</TableHead>
                <TableHead className="text-right">{t("unitPrice")}</TableHead>
                {canDiscount && <TableHead className="w-28 text-right">{t("discount")}</TableHead>}
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const lineTotal =
                  line.unitPrice * line.quantity -
                  line.discountAmount +
                  Math.round(
                    ((line.unitPrice * line.quantity - line.discountAmount) * line.tvaRate) / 100,
                  );
                return (
                  <TableRow key={line.productId}>
                    <TableCell className="font-medium">{line.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(line.unitPrice)}</TableCell>
                    {canDiscount && (
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={centimesToDa(line.discountAmount)}
                          onChange={(event) =>
                            setLineDiscount(
                              line.productId,
                              Math.max(0, daToCentimes(Number(event.target.value) || 0)),
                            )
                          }
                          className="h-8 text-right"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">{formatDa(lineTotal)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("remove")}
                        onClick={() => removeLine(line.productId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="shrink-0 space-y-1 border-t border-border p-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{t("subtotal")}</span>
          <span className="tabular-nums">{formatDa(totals.subtotal)}</span>
        </div>
        {canDiscount && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("ticketDiscount")}</span>
            <Input
              type="number"
              min={0}
              value={centimesToDa(discountAmount)}
              onChange={(event) => setDiscountAmount(Math.max(0, daToCentimes(Number(event.target.value) || 0)))}
              className="h-7 w-28 text-right"
            />
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>{t("tva")}</span>
          <span className="tabular-nums">{formatDa(totals.tvaAmount)}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>{t("grandTotal")}</span>
          <span className="tabular-nums">{formatDa(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
