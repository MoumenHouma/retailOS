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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { centimesToDa, daToCentimes } from "@/lib/currency";
import type { FlatCategory } from "@/lib/categories";

interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
}

interface BrandOption {
  id: string;
  name: string;
}

export interface ProductEditData {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unitId: string;
  categoryId: string | null;
  brandId: string | null;
  costPrice: number | null;
  sellingPrice: number;
  tvaRate: number;
  minStockLevel: number;
}

const NONE = "__none__";

const productFormSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unitId: z.string().min(1),
  categoryId: z.string(),
  brandId: z.string(),
  costPrice: z.string().optional(),
  sellingPrice: z.coerce.number().min(0),
  tvaRate: z.enum(["0", "9", "19"]),
  minStockLevel: z.coerce.number().int().min(0),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export function ProductFormDialog({
  units,
  categories,
  brands,
  onSaved,
  product,
}: {
  units: UnitOption[];
  categories: FlatCategory[];
  brands: BrandOption[];
  onSaved: () => void;
  product?: ProductEditData;
}) {
  const t = useTranslations("products.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const isEdit = !!product;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku ?? "",
          barcode: product.barcode ?? "",
          unitId: product.unitId,
          categoryId: product.categoryId ?? NONE,
          brandId: product.brandId ?? NONE,
          costPrice: product.costPrice != null ? String(centimesToDa(product.costPrice)) : "",
          sellingPrice: centimesToDa(product.sellingPrice),
          tvaRate: String(product.tvaRate) as "0" | "9" | "19",
          minStockLevel: product.minStockLevel,
        }
      : {
          name: "",
          sku: "",
          barcode: "",
          unitId: units[0]?.id ?? "",
          categoryId: NONE,
          brandId: NONE,
          costPrice: "",
          sellingPrice: 0,
          tvaRate: "19",
          minStockLevel: 0,
        },
  });

  async function onSubmit(values: ProductFormValues) {
    const payload = {
      name: values.name,
      sku: values.sku || undefined,
      barcode: values.barcode || undefined,
      unitId: values.unitId,
      categoryId: values.categoryId === NONE ? undefined : values.categoryId,
      brandId: values.brandId === NONE ? undefined : values.brandId,
      costPrice: values.costPrice ? daToCentimes(Number(values.costPrice)) : undefined,
      sellingPrice: daToCentimes(values.sellingPrice),
      tvaRate: Number(values.tvaRate),
      minStockLevel: values.minStockLevel,
    };

    const response = await fetch(isEdit ? `/api/products/${product.id}` : "/api/products", {
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
          <Button disabled={units.length === 0}>
            <Plus />
            {t("title")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("title")}</DialogTitle>
          <DialogDescription>
            {units.length === 0 ? t("noUnit") : isEdit ? t("editDescription") : t("description")}
          </DialogDescription>
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
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("sku")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("barcode")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("unit")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.abbreviation})
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
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("noCategory")}</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {"— ".repeat(category.depth)}
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
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("brand")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("noBrand")}</SelectItem>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
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
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("costPrice")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("sellingPrice")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("minStockLevel")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
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
