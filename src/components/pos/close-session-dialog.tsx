"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { daToCentimes, formatDa } from "@/lib/currency";

const closeSessionFormSchema = z.object({
  closingCash: z.coerce.number().min(0),
});

type CloseSessionFormValues = z.infer<typeof closeSessionFormSchema>;

interface ClosedSessionResult {
  expectedCash: number;
  cashDifference: number;
}

export function CloseSessionDialog({ sessionId, onClosed }: { sessionId: string; onClosed: () => void }) {
  const t = useTranslations("pos.session");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ClosedSessionResult | null>(null);

  const form = useForm<CloseSessionFormValues>({
    resolver: zodResolver(closeSessionFormSchema),
    defaultValues: { closingCash: 0 },
  });

  async function onSubmit(values: CloseSessionFormValues) {
    const response = await fetch(`/api/pos/sessions/${sessionId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingCash: daToCentimes(values.closingCash) }),
    });

    if (!response.ok) {
      toast.error(t("closeError"));
      return;
    }

    const body: { data: ClosedSessionResult } = await response.json();
    setResult(body.data);
    toast.success(t("closeSuccess"));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && result) onClosed();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {t("close")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("closeTitle")}</DialogTitle>
          <DialogDescription>{t("closeDescription")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("expectedCash")}</span>
              <span className="tabular-nums">{formatDa(result.expectedCash)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>{t("difference")}</span>
              <span className="tabular-nums">{formatDa(result.cashDifference)}</span>
            </div>
            <Button type="button" className="mt-4" onClick={() => setOpen(false)}>
              {t("closeSubmit")}
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="closingCash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("closingCash")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? t("closing") : t("closeSubmit")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
