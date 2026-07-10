"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FinancialPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
  closedAt: string | null;
}

async function fetchPeriods(): Promise<{ data: FinancialPeriod[] }> {
  const response = await fetch("/api/financial-periods");
  if (!response.ok) throw new Error("Failed to load financial periods");
  return response.json();
}

const formSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

function CreatePeriodDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("financialPeriods.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", startDate: "", endDate: "" },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/financial-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error?.message ?? t("error"));
      return;
    }

    toast.success(t("success"));
    form.reset();
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("namePlaceholder")} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("startDate")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("endDate")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
      </DialogContent>
    </Dialog>
  );
}

export function FinancialPeriodsView() {
  const t = useTranslations("financialPeriods");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["financial-periods"],
    queryFn: fetchPeriods,
  });
  const periods = data?.data ?? [];

  async function handleClose(id: string) {
    if (!window.confirm(t("close.confirm"))) return;
    const response = await fetch(`/api/financial-periods/${id}/close`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error?.message ?? t("close.error"));
      return;
    }
    toast.success(t("close.success"));
    queryClient.invalidateQueries({ queryKey: ["financial-periods"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        action={<CreatePeriodDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["financial-periods"] })} />}
      />

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.startDate")}</TableHead>
              <TableHead>{t("table.endDate")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && periods.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {periods.map((period) => (
              <TableRow key={period.id}>
                <TableCell className="font-medium">{period.name}</TableCell>
                <TableCell>{new Date(period.startDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(period.endDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={period.status === "open" ? "default" : "secondary"}>
                    {period.status === "open" ? t("status.open") : t("status.closed")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {period.status === "open" && (
                    <Button variant="ghost" size="sm" onClick={() => handleClose(period.id)}>
                      <Lock className="h-4 w-4" />
                      {t("close.action")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
