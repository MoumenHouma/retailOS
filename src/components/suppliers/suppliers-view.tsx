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
import { SupplierFormDialog, type SupplierEditData } from "@/components/suppliers/supplier-form-dialog";
import { LinkedProductsDialog } from "@/components/suppliers/linked-products-dialog";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  wilaya: string | null;
  phone: string | null;
  leadTimeDays: number;
  notes: string | null;
  isActive: boolean;
}

function toEditData(supplier: Supplier): SupplierEditData {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    city: supplier.city,
    wilaya: supplier.wilaya,
    leadTimeDays: supplier.leadTimeDays,
    notes: supplier.notes,
  };
}

interface SuppliersResponse {
  data: Supplier[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

type StatusFilter = "all" | "active" | "inactive";
type SortOption = "name:asc" | "name:desc" | "createdAt:desc" | "createdAt:asc";

const PAGE_SIZE = 20;

async function fetchSuppliers(params: {
  q: string;
  status: StatusFilter;
  sort: SortOption;
  page: number;
}): Promise<SuppliersResponse> {
  const [sort, order] = params.sort.split(":") as [string, string];
  const searchParams = new URLSearchParams({
    sort,
    order,
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
  });
  if (params.q) searchParams.set("q", params.q);
  if (params.status !== "all") searchParams.set("isActive", String(params.status === "active"));

  const response = await fetch(`/api/suppliers?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load suppliers");
  return response.json();
}

export function SuppliersView() {
  const t = useTranslations("suppliers");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("name:asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const queryKey = ["suppliers", { q: debouncedSearch, status, sort, page }];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchSuppliers({ q: debouncedSearch, status, sort, page }),
    placeholderData: (previous) => previous,
  });

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;

    const response = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }

  const suppliers = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <SupplierFormDialog
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["suppliers"] })}
        />
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
          value={status}
          onValueChange={(value) => {
            setStatus(value as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
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
              <TableHead>{t("table.city")}</TableHead>
              <TableHead>{t("table.wilaya")}</TableHead>
              <TableHead>{t("table.phone")}</TableHead>
              <TableHead>{t("table.leadTime")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-destructive">
                  {t("loadError")}
                </TableCell>
              </TableRow>
            )}
            {!isError && !isLoading && suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.city ?? "—"}</TableCell>
                <TableCell>{supplier.wilaya ?? "—"}</TableCell>
                <TableCell>{supplier.phone ?? "—"}</TableCell>
                <TableCell>{supplier.leadTimeDays}</TableCell>
                <TableCell>
                  <Badge variant={supplier.isActive ? "default" : "secondary"}>
                    {supplier.isActive ? t("status.active") : t("status.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <LinkedProductsDialog supplierId={supplier.id} supplierName={supplier.name} />
                  <SupplierFormDialog
                    supplier={toEditData(supplier)}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ["suppliers"] })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(supplier.id)}
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
            <span>{t("pagination.pageInfo", { page: meta.page, totalPages: meta.totalPages })}</span>
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
    </div>
  );
}
