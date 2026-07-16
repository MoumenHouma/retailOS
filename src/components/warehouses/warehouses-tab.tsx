"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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

interface Store {
  id: string;
  name: string;
}
interface Warehouse {
  id: string;
  name: string;
  address: string | null;
  store: { name: string };
}

const formSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

async function fetchWarehouses(): Promise<{ data: Warehouse[] }> {
  const response = await fetch("/api/warehouses");
  if (!response.ok) throw new Error("Failed to load warehouses");
  return response.json();
}

async function fetchStores(): Promise<{ data: Store[] }> {
  const response = await fetch("/api/stores");
  if (!response.ok) throw new Error("Failed to load stores");
  return response.json();
}

export function WarehousesTab() {
  const t = useTranslations("warehouses.warehouses");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const { data: storesData } = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const warehouses = data?.data ?? [];
  const stores = storesData?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { storeId: "", name: "", address: "" },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, address: values.address || undefined }),
    });
    if (!response.ok) {
      toast.error(t("form.error"));
      return;
    }
    toast.success(t("form.success"));
    form.reset();
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["warehouses"] });
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;
    const response = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error?.message ?? t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["warehouses"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              {t("newWarehouse")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("form.title")}</DialogTitle>
              <DialogDescription>{t("form.description")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.store")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("form.selectStore")} />
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.name")}</FormLabel>
                      <FormControl>
                        <Input {...field} autoFocus />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.address")}</FormLabel>
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
                    {form.formState.isSubmitting ? t("form.submitting") : t("form.submit")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.store")}</TableHead>
              <TableHead>{t("table.address")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-destructive">
                  {t("loadError")}
                </TableCell>
              </TableRow>
            )}
            {!isError && !isLoading && warehouses.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell className="font-medium">{warehouse.name}</TableCell>
                <TableCell>{warehouse.store.name}</TableCell>
                <TableCell>{warehouse.address ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(warehouse.id)}
                    aria-label={t("delete.confirm")}
                  >
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
