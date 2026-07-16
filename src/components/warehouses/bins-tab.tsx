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
}
interface Bin {
  id: string;
  code: string;
  notes: string | null;
}

const formSchema = z.object({
  code: z.string().min(1).max(20),
  notes: z.string().optional(),
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
async function fetchBins(zoneId: string): Promise<{ data: Bin[] }> {
  const response = await fetch(`/api/warehouse-bins?zoneId=${zoneId}`);
  if (!response.ok) throw new Error("Failed to load bins");
  return response.json();
}

export function BinsTab() {
  const t = useTranslations("warehouses.bins");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [open, setOpen] = useState(false);

  const { data: warehousesData } = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const warehouses = warehousesData?.data ?? [];

  const { data: zonesData } = useQuery({
    queryKey: ["warehouse-zones", warehouseId],
    queryFn: () => fetchZones(warehouseId),
    enabled: !!warehouseId,
  });
  const zones = zonesData?.data ?? [];

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse-bins", zoneId],
    queryFn: () => fetchBins(zoneId),
    enabled: !!zoneId,
  });
  const bins = data?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "", notes: "" },
  });

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/warehouse-bins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, zoneId, notes: values.notes || undefined }),
    });
    if (!response.ok) {
      toast.error(t("form.error"));
      return;
    }
    toast.success(t("form.success"));
    form.reset();
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["warehouse-bins", zoneId] });
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;
    const response = await fetch(`/api/warehouse-bins/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["warehouse-bins", zoneId] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <Select
            value={warehouseId}
            onValueChange={(value) => {
              setWarehouseId(value);
              setZoneId("");
            }}
          >
            <SelectTrigger className="w-56">
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
          <Select value={zoneId} onValueChange={setZoneId} disabled={!warehouseId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("selectZone")} />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!zoneId}>
              <Plus />
              {t("newBin")}
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
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.code")}</FormLabel>
                      <FormControl>
                        <Input {...field} autoFocus />
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
                      <FormLabel>{t("form.notes")}</FormLabel>
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

      {!zoneId && <p className="text-sm text-muted-foreground">{t("selectZoneFirst")}</p>}

      {zoneId && (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.code")}</TableHead>
                <TableHead>{t("table.notes")}</TableHead>
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
              {!isError && !isLoading && bins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {bins.map((bin) => (
                <TableRow key={bin.id}>
                  <TableCell className="font-medium">{bin.code}</TableCell>
                  <TableCell className="text-muted-foreground">{bin.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(bin.id)}
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
      )}
    </div>
  );
}
