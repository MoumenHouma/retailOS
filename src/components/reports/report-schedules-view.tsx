"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface ScheduledReport {
  id: string;
  reportType: string;
  name: string;
  format: string;
  frequency: string;
  recipientEmails: string[];
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: "success" | "failed" | null;
}

async function fetchSchedules(): Promise<{ data: ScheduledReport[] }> {
  const response = await fetch("/api/report-schedules");
  if (!response.ok) throw new Error("Failed to load report schedules");
  return response.json();
}

const formSchema = z.object({
  name: z.string().min(1),
  reportType: z.enum(["sales", "inventory", "purchase", "financial", "employee"]),
  format: z.enum(["pdf", "xlsx", "csv"]),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipientEmails: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

function CreateScheduleDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("reportSchedules.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", reportType: "sales", format: "pdf", frequency: "weekly", recipientEmails: "" },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/report-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        recipientEmails: values.recipientEmails.split(",").map((e) => e.trim()).filter(Boolean),
      }),
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
                    <Input {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="reportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reportType")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["sales", "inventory", "purchase", "financial", "employee"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`reportTypes.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("format")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["pdf", "xlsx", "csv"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("frequency")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["daily", "weekly", "monthly"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`frequencies.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="recipientEmails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("recipientEmails")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="a@b.com, c@d.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

export function ReportSchedulesView() {
  const t = useTranslations("reportSchedules");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["report-schedules"], queryFn: fetchSchedules });
  const schedules = data?.data ?? [];

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;
    const response = await fetch(`/api/report-schedules/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        action={<CreateScheduleDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["report-schedules"] })} />}
      />

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.reportType")}</TableHead>
              <TableHead>{t("table.frequency")}</TableHead>
              <TableHead>{t("table.lastRun")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && schedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{t(`reportTypes.${s.reportType}`)}</TableCell>
                <TableCell>{t(`frequencies.${s.frequency}`)}</TableCell>
                <TableCell>
                  {s.lastRunAt ? (
                    <Badge variant={s.lastRunStatus === "success" ? "success" : "destructive"}>
                      {new Date(s.lastRunAt).toLocaleString()}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{t("neverRun")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
