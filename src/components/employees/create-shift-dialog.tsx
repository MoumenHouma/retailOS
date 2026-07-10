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

interface Store {
  id: string;
  name: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

const formSchema = z.object({
  employeeId: z.string().uuid(),
  storeId: z.string().uuid(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

async function fetchStores(): Promise<Store[]> {
  const response = await fetch("/api/stores");
  if (!response.ok) throw new Error("Failed to load stores");
  const body: { data: Store[] } = await response.json();
  return body.data;
}

async function fetchAllEmployees(): Promise<EmployeeOption[]> {
  const response = await fetch("/api/employees?pageSize=100");
  if (!response.ok) throw new Error("Failed to load employees");
  const body: { data: EmployeeOption[] } = await response.json();
  return body.data;
}

/**
 * employeeId is the caller-supplied context: the employee-detail Schedule
 * tab passes a fixed one and hides the picker; the store-wide work-schedules
 * grid passes "" and gets an employee dropdown instead, since that view has
 * no single employee in context to default to.
 */
export function CreateShiftDialog({
  employeeId,
  defaultStoreId,
  onCreated,
}: {
  employeeId: string;
  defaultStoreId?: string;
  onCreated: () => void;
}) {
  const t = useTranslations("workSchedules.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const needsEmployeePicker = !employeeId;

  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const employeesQuery = useQuery({
    queryKey: ["employees-all"],
    queryFn: fetchAllEmployees,
    enabled: needsEmployeePicker && open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { employeeId, storeId: defaultStoreId ?? "", startsAt: "", endsAt: "", notes: "" },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/work-shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: values.employeeId,
        storeId: values.storeId,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
        notes: values.notes || undefined,
      }),
    });

    if (!response.ok) {
      toast.error(t("error"));
      return;
    }

    toast.success(t("success"));
    form.reset({ employeeId, storeId: values.storeId, startsAt: "", endsAt: "", notes: "" });
    setOpen(false);
    onCreated();
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
            {needsEmployeePicker && (
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("employee")}</FormLabel>
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
            <FormField
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("store")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(storesQuery.data ?? []).map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("startsAt")}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("endsAt")}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
