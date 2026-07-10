"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { formatDa, daToCentimes, centimesToDa } from "@/lib/currency";

interface ProductOption {
  id: string;
  name: string;
  sellingPrice: number;
}

async function searchProducts(q: string): Promise<ProductOption[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q, isActive: "true", pageSize: "10", sort: "name", order: "asc" });
  const response = await fetch(`/api/products?${params.toString()}`);
  if (!response.ok) return [];
  const body: { data: ProductOption[] } = await response.json();
  return body.data;
}

export function SetCustomerPriceDialog({
  customerId,
  onSaved,
}: {
  customerId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("customerPricing.form");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(handle);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ["customer-price-product-search", debounced],
    queryFn: () => searchProducts(debounced),
    enabled: debounced.trim().length > 0,
  });

  function handlePick(product: ProductOption) {
    setSelected(product);
    setPrice(String(centimesToDa(product.sellingPrice)));
    setQuery(product.name);
    setShowResults(false);
  }

  function reset() {
    setSelected(null);
    setQuery("");
    setDebounced("");
    setPrice("");
  }

  async function handleSubmit() {
    if (!selected || !price) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selected.id, price: daToCentimes(Number(price)) }),
      });
      if (!response.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("success"));
      reset();
      setOpen(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("product")}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(null);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                placeholder={t("searchProduct")}
                className="pl-8"
              />
              {showResults && debounced.trim().length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                  {results.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">{t("noProductsFound")}</p>
                  ) : (
                    <ul className="max-h-72 overflow-auto py-1">
                      {results.map((product) => (
                        <li key={product.id}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handlePick(product)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                          >
                            <span>{product.name}</span>
                            <span className="text-muted-foreground">{formatDa(product.sellingPrice)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("price")}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={!selected}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" disabled={!selected || !price || submitting} onClick={handleSubmit}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
