"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { centimesToDa, daToCentimes, formatDa } from "@/lib/currency";

interface DebtPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
}

const formSchema = z.object({
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.enum(["CASH", "CARD", "CHECK", "TRANSFER", "MIXED"]),
  paidAt: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

async function fetchPayments(debtId: string): Promise<{ data: DebtPayment[] }> {
  const response = await fetch(`/api/customer-debts/${debtId}/payments`);
  if (!response.ok) throw new Error("Failed to load payments");
  return response.json();
}

export function RecordDebtPaymentDialog({
  debtId,
  remaining,
  onRecorded,
}: {
  debtId: string;
  remaining: number;
  onRecorded: () => void;
}) {
  const t = useTranslations("customerDebts.payments");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["customer-debt-payments", debtId],
    queryFn: () => fetchPayments(debtId),
    enabled: open,
  });
  const payments = data?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: centimesToDa(remaining),
      paymentMethod: "CASH",
      paidAt: new Date().toISOString().slice(0, 10),
    },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch(`/api/customer-debts/${debtId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: daToCentimes(values.amount),
        paymentMethod: values.paymentMethod,
        paidAt: values.paidAt,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error?.message ?? t("error"));
      return;
    }

    toast.success(t("success"));
    form.reset();
    onRecorded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={remaining <= 0}>
          <Wallet className="h-4 w-4" />
          {t("recordPayment")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("remaining", { amount: formatDa(remaining) })}</DialogDescription>
        </DialogHeader>

        {payments.length > 0 && (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("history.date")}</TableHead>
                  <TableHead className="text-right">{t("history.amount")}</TableHead>
                  <TableHead>{t("history.method")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.paidAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(payment.amount)}</TableCell>
                    <TableCell>{payment.paymentMethod}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {remaining > 0 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("amount")}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0.01} step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paidAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("paidAt")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("method")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CASH">{t("methods.CASH")}</SelectItem>
                          <SelectItem value="CARD">{t("methods.CARD")}</SelectItem>
                          <SelectItem value="CHECK">{t("methods.CHECK")}</SelectItem>
                          <SelectItem value="TRANSFER">{t("methods.TRANSFER")}</SelectItem>
                          <SelectItem value="MIXED">{t("methods.MIXED")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? t("submitting") : t("submit")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
