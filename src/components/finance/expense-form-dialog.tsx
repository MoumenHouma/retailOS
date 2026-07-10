"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { centimesToDa, daToCentimes } from "@/lib/currency";

export interface ExpenseEditData {
  id: string;
  storeId: string | null;
  categoryId: string;
  description: string;
  amount: number;
  tvaRate: number;
  expenseDate: string;
  paymentMethod: string;
  reference: string | null;
  supplierId: string | null;
  notes: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
}
interface StoreOption {
  id: string;
  name: string;
}
interface SupplierOption {
  id: string;
  name: string;
}

async function fetchCategories(): Promise<CategoryOption[]> {
  interface Node extends CategoryOption {
    children: Node[];
  }
  const response = await fetch("/api/expense-categories");
  if (!response.ok) return [];
  const body: { data: Node[] } = await response.json();
  const flat: CategoryOption[] = [];
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      flat.push({ id: node.id, name: node.name });
      walk(node.children);
    }
  };
  walk(body.data);
  return flat;
}

async function fetchStores(): Promise<StoreOption[]> {
  const response = await fetch("/api/stores");
  if (!response.ok) return [];
  const body: { data: StoreOption[] } = await response.json();
  return body.data;
}

async function fetchSuppliers(): Promise<SupplierOption[]> {
  const response = await fetch("/api/suppliers?pageSize=100&isActive=true");
  if (!response.ok) return [];
  const body: { data: SupplierOption[] } = await response.json();
  return body.data;
}

const formSchema = z.object({
  categoryId: z.string().uuid(),
  storeId: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().min(1),
  amount: z.coerce.number().min(0),
  tvaRate: z.enum(["0", "9", "19"]),
  expenseDate: z.string().min(1),
  paymentMethod: z.enum(["CASH", "CARD", "CHECK", "TRANSFER", "MIXED"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function ExpenseFormDialog({ onSaved, expense }: { onSaved: () => void; expense?: ExpenseEditData }) {
  const t = useTranslations("expenses.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const isEdit = !!expense;

  const { data: categories = [] } = useQuery({ queryKey: ["expense-categories-flat"], queryFn: fetchCategories });
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-active"], queryFn: fetchSuppliers });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: expense
      ? {
          categoryId: expense.categoryId,
          storeId: expense.storeId ?? "",
          supplierId: expense.supplierId ?? "",
          description: expense.description,
          amount: centimesToDa(expense.amount),
          tvaRate: String(expense.tvaRate) as "0" | "9" | "19",
          expenseDate: expense.expenseDate.slice(0, 10),
          paymentMethod: expense.paymentMethod as FormValues["paymentMethod"],
          reference: expense.reference ?? "",
          notes: expense.notes ?? "",
        }
      : {
          categoryId: "",
          storeId: "",
          supplierId: "",
          description: "",
          amount: 0,
          tvaRate: "0",
          expenseDate: new Date().toISOString().slice(0, 10),
          paymentMethod: "CASH",
          reference: "",
          notes: "",
        },
  });

  async function onSubmit(values: FormValues) {
    const payload = {
      categoryId: values.categoryId,
      storeId: values.storeId || undefined,
      supplierId: values.supplierId || undefined,
      description: values.description,
      amount: daToCentimes(values.amount),
      tvaRate: Number(values.tvaRate),
      expenseDate: values.expenseDate,
      paymentMethod: values.paymentMethod,
      reference: values.reference || undefined,
      notes: values.notes || undefined,
    };

    const response = await fetch(isEdit ? `/api/expenses/${expense.id}` : "/api/expenses", {
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("descriptionLabel")}</FormLabel>
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
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCategory")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
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
                name="storeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("store")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("allStores")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores.map((store) => (
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
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("amount")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tvaRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tvaRate")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="9">9%</SelectItem>
                        <SelectItem value="19">19%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("expenseDate")}</FormLabel>
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
                    <FormLabel>{t("paymentMethod")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CASH">{t("paymentMethods.CASH")}</SelectItem>
                        <SelectItem value="CARD">{t("paymentMethods.CARD")}</SelectItem>
                        <SelectItem value="CHECK">{t("paymentMethods.CHECK")}</SelectItem>
                        <SelectItem value="TRANSFER">{t("paymentMethods.TRANSFER")}</SelectItem>
                        <SelectItem value="MIXED">{t("paymentMethods.MIXED")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("supplier")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("noSupplier")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
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
            </div>
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
