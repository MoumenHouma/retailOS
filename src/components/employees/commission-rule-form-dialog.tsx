"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

const formSchema = z.object({
  name: z.string().min(1).max(100),
  scope: z.enum(["global", "employee"]),
  targetEmployeeId: z.string().optional(),
  rateType: z.enum(["percentage", "fixed"]),
  rateValue: z.coerce.number().min(0),
});
type FormValues = z.infer<typeof formSchema>;

async function fetchAllEmployees(): Promise<EmployeeOption[]> {
  const response = await fetch("/api/employees?pageSize=100");
  if (!response.ok) throw new Error("Failed to load employees");
  const body: { data: EmployeeOption[] } = await response.json();
  return body.data;
}

export function CommissionRuleFormDialog({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations("commissionRules.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const employeesQuery = useQuery({ queryKey: ["employees-all"], queryFn: fetchAllEmployees, enabled: open });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", scope: "global", targetEmployeeId: "", rateType: "percentage", rateValue: 0 },
  });

  const scope = form.watch("scope");
  const rateType = form.watch("rateType");

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/commission-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        scope: values.scope,
        targetEmployeeId: values.scope === "employee" ? values.targetEmployeeId || undefined : undefined,
        rateType: values.rateType,
        rateValue: values.rateType === "percentage" ? values.rateValue : Math.round(values.rateValue * 100),
      }),
    });

    if (!response.ok) {
      toast.error(t("error"));
      return;
    }

    toast.success(t("success"));
    form.reset();
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
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
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("scope")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="global">{t("scopes.global")}</SelectItem>
                      <SelectItem value="employee">{t("scopes.employee")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {scope === "employee" && (
              <FormField
                control={form.control}
                name="targetEmployeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("targetEmployee")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(employeesQuery.data ?? []).map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("rateType")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">{t("rateTypes.percentage")}</SelectItem>
                        <SelectItem value="fixed">{t("rateTypes.fixed")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rateValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {rateType === "percentage" ? t("rateValuePercent") : t("rateValueFixed")}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
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
