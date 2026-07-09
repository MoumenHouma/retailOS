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

interface Warehouse {
  id: string;
  name: string;
}
interface Zone {
  id: string;
  name: string;
  code: string;
}

const formSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
});
type FormValues = z.infer<typeof formSchema>;

async function fetchWarehouses(): Promise<{ data: Warehouse[] }> {
  const response = await fetch("/api/warehouses");
  if (!response.ok) throw new Error("Failed to load warehouses");
  return response.json();
}

async function fetchZones(warehouseId: string): Promise<{ data: Zone[] }> {
  const response = await fetch(`/api/warehouse-zones?warehouseId=${warehouseId}`);
  if (!response.ok) throw new Error("Failed to load zones");
  return response.json();
}

export function ZonesTab() {
  const t = useTranslations("warehouses.zones");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState("");
  const [open, setOpen] = useState(false);

  const { data: warehousesData } = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const warehouses = warehousesData?.data ?? [];

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse-zones", warehouseId],
    queryFn: () => fetchZones(warehouseId),
    enabled: !!warehouseId,
  });
  const zones = data?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", code: "" },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/warehouse-zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, warehouseId }),
    });
    if (!response.ok) {
      toast.error(t("form.error"));
      return;
    }
    toast.success(t("form.success"));
    form.reset();
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["warehouse-zones", warehouseId] });
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;
    const response = await fetch(`/api/warehouse-zones/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error?.message ?? t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["warehouse-zones", warehouseId] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={t("selectWarehouse")} />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!warehouseId}>
              <Plus />
              {t("newZone")}
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
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.code")}</FormLabel>
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

      {!warehouseId && <p className="text-sm text-muted-foreground">{t("selectWarehouseFirst")}</p>}

      {warehouseId && (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.code")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-destructive">
                    {t("loadError")}
                  </TableCell>
                </TableRow>
              )}
              {!isError && !isLoading && zones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell>{zone.code}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(zone.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
