"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { daToCentimes, formatDa } from "@/lib/currency";

interface SupplierProductLink {
  id: string;
  supplierSku: string | null;
  unitPrice: number | null;
  minOrderQuantity: number;
  isPreferred: boolean;
  product: { id: string; name: string; sku: string | null };
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

async function fetchLinks(supplierId: string): Promise<{ data: SupplierProductLink[] }> {
  const response = await fetch(`/api/suppliers/${supplierId}/products`);
  if (!response.ok) throw new Error("Failed to load linked products");
  return response.json();
}

async function fetchProducts(): Promise<{ data: ProductOption[] }> {
  const response = await fetch("/api/products?pageSize=100");
  if (!response.ok) throw new Error("Failed to load products");
  return response.json();
}

const linkFormSchema = z.object({
  productId: z.string().min(1),
  supplierSku: z.string().optional(),
  unitPrice: z.string().optional(),
  minOrderQuantity: z.coerce.number().int().min(1),
  deliveryTimeDays: z.string().optional(),
  isPreferred: z.boolean(),
});
type LinkFormValues = z.infer<typeof linkFormSchema>;

export function LinkedProductsDialog({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const t = useTranslations("suppliers.linkedProducts");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const linksKey = ["supplier-products", supplierId];
  const linksQuery = useQuery({
    queryKey: linksKey,
    queryFn: () => fetchLinks(supplierId),
    enabled: open,
  });
  const productsQuery = useQuery({
    queryKey: ["products", "all"],
    queryFn: fetchProducts,
    enabled: open,
  });
  const links = linksQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      productId: "",
      supplierSku: "",
      unitPrice: "",
      minOrderQuantity: 1,
      deliveryTimeDays: "",
      isPreferred: false,
    },
  });
  const selectedProductId = useWatch({ control: form.control, name: "productId" });

  async function onSubmit(values: LinkFormValues) {
    const payload = {
      productId: values.productId,
      supplierSku: values.supplierSku || undefined,
      unitPrice: values.unitPrice ? daToCentimes(Number(values.unitPrice)) : undefined,
      minOrderQuantity: values.minOrderQuantity,
      deliveryTimeDays: values.deliveryTimeDays ? Number(values.deliveryTimeDays) : undefined,
      isPreferred: values.isPreferred,
    };
    const response = await fetch(`/api/suppliers/${supplierId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      toast.error(t("form.error"));
      return;
    }
    toast.success(t("form.success"));
    form.reset();
    queryClient.invalidateQueries({ queryKey: linksKey });
  }

  async function handleSetPreferred(linkId: string) {
    const response = await fetch(`/api/suppliers/${supplierId}/products/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPreferred: true }),
    });
    if (!response.ok) {
      toast.error(t("form.error"));
      return;
    }
    queryClient.invalidateQueries({ queryKey: linksKey });
  }

  async function handleRemove(linkId: string) {
    if (!window.confirm(t("delete.confirm"))) return;
    const response = await fetch(`/api/suppliers/${supplierId}/products/${linkId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: linksKey });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" aria-label={t("trigger")} onClick={() => setOpen(true)}>
        <Link2 className="h-4 w-4" />
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { name: supplierName })}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.product")}</TableHead>
                <TableHead>{t("table.supplierSku")}</TableHead>
                <TableHead>{t("table.unitPrice")}</TableHead>
                <TableHead>{t("table.minOrderQty")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linksQuery.isError && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-destructive">
                    {t("loadError")}
                  </TableCell>
                </TableRow>
              )}
              {!linksQuery.isError && !linksQuery.isLoading && links.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">
                    {link.product.name}
                    {link.isPreferred && (
                      <Badge variant="default" className="ml-2">
                        {t("preferredBadge")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{link.supplierSku ?? "—"}</TableCell>
                  <TableCell>{link.unitPrice != null ? formatDa(link.unitPrice) : "—"}</TableCell>
                  <TableCell>{link.minOrderQuantity}</TableCell>
                  <TableCell className="text-right">
                    {!link.isPreferred && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetPreferred(link.id)}
                        aria-label={t("preferredBadge")}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(link.id)}
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.product")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                          {product.sku ? ` (${product.sku})` : ""}
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
                name="supplierSku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.supplierSku")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.unitPrice")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minOrderQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.minOrderQuantity")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.deliveryTimeDays")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isPreferred"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <Label className="!mt-0">{t("form.isPreferred")}</Label>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting || !selectedProductId}>
              {form.formState.isSubmitting ? t("form.submitting") : t("form.submit")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
