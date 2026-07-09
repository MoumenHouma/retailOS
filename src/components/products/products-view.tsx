"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductFormDialog, type ProductEditData } from "@/components/products/product-form-dialog";
import { CategoriesTab } from "@/components/products/categories-tab";
import { BrandsTab } from "@/components/products/brands-tab";
import { UnitsTab } from "@/components/products/units-tab";
import { formatDa } from "@/lib/currency";
import { flattenCategories, type CategoryNode } from "@/lib/categories";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  costPrice: number | null;
  sellingPrice: number;
  tvaRate: number;
  minStockLevel: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  unit: { id: string; name: string; abbreviation: string };
}

function toEditData(product: Product): ProductEditData {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    unitId: product.unit.id,
    categoryId: product.category?.id ?? null,
    brandId: product.brand?.id ?? null,
    costPrice: product.costPrice,
    sellingPrice: product.sellingPrice,
    tvaRate: product.tvaRate,
    minStockLevel: product.minStockLevel,
  };
}

interface ProductsResponse {
  data: Product[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

type StatusFilter = "all" | "active" | "inactive";
type SortOption =
  | "name:asc"
  | "name:desc"
  | "sellingPrice:asc"
  | "sellingPrice:desc"
  | "createdAt:desc"
  | "createdAt:asc";

const ALL = "__all__";
const PAGE_SIZE = 20;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

async function fetchProducts(params: {
  q: string;
  status: StatusFilter;
  categoryId: string;
  brandId: string;
  sort: SortOption;
  page: number;
}): Promise<ProductsResponse> {
  const [sort, order] = params.sort.split(":") as [string, string];
  const searchParams = new URLSearchParams({
    sort,
    order,
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
  });
  if (params.q) searchParams.set("q", params.q);
  if (params.status !== "all") searchParams.set("isActive", String(params.status === "active"));
  if (params.categoryId !== ALL) searchParams.set("categoryId", params.categoryId);
  if (params.brandId !== ALL) searchParams.set("brandId", params.brandId);

  const response = await fetch(`/api/products?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load products");
  return response.json();
}

export function ProductsView() {
  const t = useTranslations("products");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [categoryId, setCategoryId] = useState(ALL);
  const [brandId, setBrandId] = useState(ALL);
  const [sort, setSort] = useState<SortOption>("name:asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const unitsQuery = useQuery({
    queryKey: ["units"],
    queryFn: () =>
      fetchJson<{ data: { id: string; name: string; abbreviation: string }[] }>("/api/units"),
  });
  const categoriesQuery = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => fetchJson<{ data: CategoryNode[] }>("/api/product-categories"),
  });
  const brandsQuery = useQuery({
    queryKey: ["brands", "all"],
    queryFn: () => fetchJson<{ data: { id: string; name: string }[] }>("/api/brands?pageSize=100"),
  });

  const flatCategories = flattenCategories(categoriesQuery.data?.data ?? []);

  const queryKey = ["products", { q: debouncedSearch, status, categoryId, brandId, sort, page }];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchProducts({ q: debouncedSearch, status, categoryId, brandId, sort, page }),
    placeholderData: (previous) => previous,
  });

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;

    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const products = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{t("tabs.products")}</TabsTrigger>
          <TabsTrigger value="categories">{t("tabs.categories")}</TabsTrigger>
          <TabsTrigger value="brands">{t("tabs.brands")}</TabsTrigger>
          <TabsTrigger value="units">{t("tabs.units")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="flex flex-col gap-4">
          <div className="flex justify-end">
            {unitsQuery.data ? (
              <ProductFormDialog
                units={unitsQuery.data.data}
                categories={flatCategories}
                brands={brandsQuery.data?.data ?? []}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
              />
            ) : (
              <Button disabled>{t("newProduct")}</Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t("searchPlaceholder")}
                className="pl-8"
              />
            </div>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filter.allCategories")}</SelectItem>
                {flatCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {"— ".repeat(category.depth)}
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={brandId}
              onValueChange={(value) => {
                setBrandId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filter.allBrands")}</SelectItem>
                {(brandsQuery.data?.data ?? []).map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as StatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                <SelectItem value="active">{t("filter.active")}</SelectItem>
                <SelectItem value="inactive">{t("filter.inactive")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(value as SortOption);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name:asc">{t("sort.nameAsc")}</SelectItem>
                <SelectItem value="name:desc">{t("sort.nameDesc")}</SelectItem>
                <SelectItem value="sellingPrice:asc">{t("sort.priceAsc")}</SelectItem>
                <SelectItem value="sellingPrice:desc">{t("sort.priceDesc")}</SelectItem>
                <SelectItem value="createdAt:desc">{t("sort.createdAtDesc")}</SelectItem>
                <SelectItem value="createdAt:asc">{t("sort.createdAtAsc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.sku")}</TableHead>
                  <TableHead>{t("table.category")}</TableHead>
                  <TableHead>{t("table.brand")}</TableHead>
                  <TableHead>{t("table.unit")}</TableHead>
                  <TableHead>{t("table.price")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isError && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-destructive">
                      {t("loadError")}
                    </TableCell>
                  </TableRow>
                )}
                {!isError && !isLoading && products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                )}
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku ?? "—"}</TableCell>
                    <TableCell>{product.category?.name ?? "—"}</TableCell>
                    <TableCell>{product.brand?.name ?? "—"}</TableCell>
                    <TableCell>{product.unit.abbreviation}</TableCell>
                    <TableCell>{formatDa(product.sellingPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        {product.isActive ? t("status.active") : t("status.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {unitsQuery.data && (
                        <ProductFormDialog
                          units={unitsQuery.data.data}
                          categories={flatCategories}
                          brands={brandsQuery.data?.data ?? []}
                          product={toEditData(product)}
                          onSaved={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product.id)}
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

          {meta && meta.totalPages > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("pagination.total", { count: meta.total })}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  {t("pagination.previous")}
                </Button>
                <span>
                  {t("pagination.pageInfo", { page: meta.page, totalPages: meta.totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
                >
                  {t("pagination.next")}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="brands">
          <BrandsTab />
        </TabsContent>
        <TabsContent value="units">
          <UnitsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
