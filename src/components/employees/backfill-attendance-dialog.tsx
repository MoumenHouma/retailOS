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
  employeeId: z.string().uuid(),
  workDate: z.string().min(1),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  status: z.enum(["present", "late", "absent", "on_leave"]),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

async function fetchAllEmployees(): Promise<EmployeeOption[]> {
  const response = await fetch("/api/employees?pageSize=100");
  if (!response.ok) throw new Error("Failed to load employees");
  const body: { data: EmployeeOption[] } = await response.json();
  return body.data;
}

// Manual backfill entry — lets a manager record a forgotten clock-in/out
// after the fact, distinct from the live clock-in/clock-out flow.
export function BackfillAttendanceDialog({ storeId, onCreated }: { storeId: string; onCreated: () => void }) {
  const t = useTranslations("attendance.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const employeesQuery = useQuery({ queryKey: ["employees-all"], queryFn: fetchAllEmployees, enabled: open });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      workDate: new Date().toISOString().slice(0, 10),
      clockIn: "",
      clockOut: "",
      status: "present",
      notes: "",
    },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: values.employeeId,
        storeId,
        workDate: values.workDate,
        clockIn: values.clockIn ? new Date(`${values.workDate}T${values.clockIn}`).toISOString() : undefined,
        clockOut: values.clockOut ? new Date(`${values.workDate}T${values.clockOut}`).toISOString() : undefined,
        status: values.status,
        notes: values.notes || undefined,
      }),
    });

    if (!response.ok) {
      toast.error(t("error"));
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
        <Button size="sm" variant="outline">
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
            <FormField
              control={form.control}
              name="workDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("workDate")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clockIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("clockIn")}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clockOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("clockOut")}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("status")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="present">{t("statuses.present")}</SelectItem>
                      <SelectItem value="late">{t("statuses.late")}</SelectItem>
                      <SelectItem value="absent">{t("statuses.absent")}</SelectItem>
                      <SelectItem value="on_leave">{t("statuses.on_leave")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
