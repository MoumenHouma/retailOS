"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { centimesToDa, daToCentimes } from "@/lib/currency";

export interface EmployeeEditData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  position: string | null;
  department: string | null;
  hireDate: string | null;
  salary: number | null;
  contractType: string;
  userId: string | null;
}

interface LinkableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const NO_LINKED_USER = "__none__";

const formSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  address: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hireDate: z.string().optional(),
  salary: z.coerce.number().min(0).optional(),
  contractType: z.enum(["cdi", "cdd", "interim", "freelance"]),
  userId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

async function fetchLinkableUsers(): Promise<LinkableUser[]> {
  const response = await fetch("/api/employees/available-users");
  if (!response.ok) throw new Error("Failed to load users");
  const body: { data: LinkableUser[] } = await response.json();
  return body.data;
}

// Salary is null when the API redacted it for a session without
// employees:payroll — that session also can't submit a salary change, so
// the field is simply omitted from the payload rather than sent as 0.
export function EmployeeFormDialog({
  onSaved,
  employee,
  canEditPayroll,
}: {
  onSaved: () => void;
  employee?: EmployeeEditData;
  canEditPayroll: boolean;
}) {
  const t = useTranslations("employees.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const isEdit = !!employee;

  const usersQuery = useQuery({ queryKey: ["employees-linkable-users"], queryFn: fetchLinkableUsers, enabled: open });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: employee
      ? {
          firstName: employee.firstName,
          lastName: employee.lastName,
          phone: employee.phone ?? "",
          email: employee.email ?? "",
          address: employee.address ?? "",
          position: employee.position ?? "",
          department: employee.department ?? "",
          hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : "",
          salary: employee.salary != null ? centimesToDa(employee.salary) : undefined,
          contractType: employee.contractType as FormValues["contractType"],
          userId: employee.userId ?? NO_LINKED_USER,
        }
      : {
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          address: "",
          position: "",
          department: "",
          hireDate: "",
          contractType: "cdi",
          userId: NO_LINKED_USER,
        },
  });

  async function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone || undefined,
      email: values.email || undefined,
      address: values.address || undefined,
      position: values.position || undefined,
      department: values.department || undefined,
      hireDate: values.hireDate || undefined,
      contractType: values.contractType,
      userId: values.userId === NO_LINKED_USER ? null : values.userId,
    };
    if (canEditPayroll && values.salary !== undefined) {
      payload.salary = daToCentimes(values.salary);
    }

    const response = await fetch(isEdit ? `/api/employees/${employee.id}` : "/api/employees", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      toast.error(isEdit ? t("editError") : t("error"));
      return;
    }

    toast.success(isEdit ? t("editSuccess") : t("success"));
    if (!isEdit) form.reset();
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label={t("editTitle")}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus />
            {t("title")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("title")}</DialogTitle>
          <DialogDescription>{isEdit ? t("editDescription") : t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("firstName")}</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lastName")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("position")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("department")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hireDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("hireDate")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contractType")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cdi">{t("contractTypes.cdi")}</SelectItem>
                        <SelectItem value="cdd">{t("contractTypes.cdd")}</SelectItem>
                        <SelectItem value="interim">{t("contractTypes.interim")}</SelectItem>
                        <SelectItem value="freelance">{t("contractTypes.freelance")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("linkedUser")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_LINKED_USER}>{t("noLinkedUser")}</SelectItem>
                        {(usersQuery.data ?? []).map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canEditPayroll && (
                <FormField
                  control={form.control}
                  name="salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("salary")}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("address")}</FormLabel>
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
                {form.formState.isSubmitting
                  ? isEdit
                    ? t("editSubmitting")
                    : t("submitting")
                  : isEdit
                    ? t("editSubmit")
                    : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
