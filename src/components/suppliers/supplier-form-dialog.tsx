"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export interface SupplierEditData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  wilaya: string | null;
  leadTimeDays: number;
  notes: string | null;
}

const supplierFormSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  city: z.string().optional(),
  wilaya: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0),
  notes: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export function SupplierFormDialog({
  onSaved,
  supplier,
}: {
  onSaved: () => void;
  supplier?: SupplierEditData;
}) {
  const t = useTranslations("suppliers.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const isEdit = !!supplier;

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          phone: supplier.phone ?? "",
          email: supplier.email ?? "",
          city: supplier.city ?? "",
          wilaya: supplier.wilaya ?? "",
          leadTimeDays: supplier.leadTimeDays,
          notes: supplier.notes ?? "",
        }
      : {
          name: "",
          phone: "",
          email: "",
          city: "",
          wilaya: "",
          leadTimeDays: 3,
          notes: "",
        },
  });

  async function onSubmit(values: SupplierFormValues) {
    const payload = {
      name: values.name,
      phone: values.phone || undefined,
      email: values.email || undefined,
      city: values.city || undefined,
      wilaya: values.wilaya || undefined,
      leadTimeDays: values.leadTimeDays,
      notes: values.notes || undefined,
    };

    const response = await fetch(isEdit ? `/api/suppliers/${supplier.id}` : "/api/suppliers", {
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
            <div className="grid grid-cols-2 gap-4">
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
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("city")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="wilaya"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("wilaya")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="leadTimeDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("leadTimeDays")}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
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
                    <Textarea {...field} />
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
