"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { centimesToDa, daToCentimes, formatDa } from "@/lib/currency";
import { usePosCartStore } from "@/stores/pos-cart-store";
import type { QueueSaleInput } from "@/hooks/use-offline-sync";

const paymentFormSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "CHECK", "TRANSFER"]),
  amountReceived: z.coerce.number().min(0),
  reference: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export interface CompletedSale {
  id: string;
  saleNumber: string;
  total: number;
  totalPaid: number;
  changeDue: number;
  isQueued?: boolean;
}

export function PaymentDialog({
  open,
  onOpenChange,
  storeId,
  posSessionId,
  total,
  isOnline,
  queueSale,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  posSessionId: string;
  total: number;
  isOnline: boolean;
  queueSale: (input: QueueSaleInput) => Promise<string>;
  onCompleted: (sale: CompletedSale) => void;
}) {
  const t = useTranslations("pos.payment");
  const [submitting, setSubmitting] = useState(false);
  const lines = usePosCartStore((state) => state.lines);
  const discountAmount = usePosCartStore((state) => state.discountAmount);
  const customer = usePosCartStore((state) => state.customer);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { paymentMethod: "CASH", amountReceived: centimesToDa(total), reference: "" },
  });

  useEffect(() => {
    if (open) form.reset({ paymentMethod: "CASH", amountReceived: centimesToDa(total), reference: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, total]);

  const method = useWatch({ control: form.control, name: "paymentMethod" });
  const amountReceivedDa = useWatch({ control: form.control, name: "amountReceived" });
  const amountReceived = daToCentimes(amountReceivedDa || 0);
  const changeDue = method === "CASH" ? Math.max(0, amountReceived - total) : 0;

  async function onSubmit(values: PaymentFormValues) {
    const amount = values.paymentMethod === "CASH" ? daToCentimes(values.amountReceived) : total;
    if (amount < total) {
      toast.error(t("insufficientPayment"));
      return;
    }

    const payment = {
      paymentMethod: values.paymentMethod,
      amount,
      reference: values.reference || null,
    };

    setSubmitting(true);
    try {
      if (!isOnline) {
        // No network round-trip possible — park the sale in the local
        // Dexie queue instead. There's no real server-assigned sale
        // number yet, so the receipt shows a local reference until sync
        // (see useOfflineSync, which pushes this automatically on reconnect).
        const localId = await queueSale({
          storeId,
          posSessionId,
          customerId: customer?.id ?? null,
          discountAmount,
          items: lines.map((line) => ({
            productId: line.productId,
            productName: line.name,
            quantity: line.quantity,
            discountAmount: line.discountAmount,
          })),
          payments: [payment],
          notes: null,
        });
        onCompleted({
          id: localId,
          saleNumber: `HORS-LIGNE-${localId.slice(0, 8).toUpperCase()}`,
          total,
          totalPaid: amount,
          changeDue: method === "CASH" ? changeDue : 0,
          isQueued: true,
        });
        return;
      }

      const response = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          posSessionId,
          customerId: customer?.id ?? null,
          discountAmount,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            discountAmount: line.discountAmount,
          })),
          payments: [payment],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("insufficientPayment"));
        return;
      }

      const body: { data: CompletedSale } = await response.json();
      onCompleted(body.data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex justify-between text-lg font-semibold">
              <span>{t("title")}</span>
              <span className="tabular-nums">{formatDa(total)}</span>
            </div>
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("method")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CASH">{t("cash")}</SelectItem>
                      <SelectItem value="CARD">{t("card")}</SelectItem>
                      <SelectItem value="CHECK">{t("check")}</SelectItem>
                      <SelectItem value="TRANSFER">{t("transfer")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {method === "CASH" && (
              <>
                <FormField
                  control={form.control}
                  name="amountReceived"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("amountReceived")}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("changeDue")}</span>
                  <span className="tabular-nums">{formatDa(changeDue)}</span>
                </div>
              </>
            )}
            {method !== "CASH" && (
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reference")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("submitting") : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
