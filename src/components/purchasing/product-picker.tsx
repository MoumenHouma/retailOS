"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDa } from "@/lib/currency";

export interface PickedProduct {
  id: string;
  name: string;
  sellingPrice: number;
  tvaRate: number;
}

interface SearchProduct extends PickedProduct {
  barcode: string | null;
}

async function searchProducts(q: string): Promise<SearchProduct[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q, isActive: "true", pageSize: "10", sort: "name", order: "asc" });
  const response = await fetch(`/api/products?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to search products");
  const body: { data: SearchProduct[] } = await response.json();
  return body.data;
}

export function ProductPicker({ onPick }: { onPick: (product: PickedProduct) => void }) {
  const t = useTranslations("purchaseOrders.form");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(handle);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ["purchasing-product-search", debounced],
    queryFn: () => searchProducts(debounced),
    enabled: debounced.trim().length > 0,
  });

  function handlePick(product: SearchProduct) {
    onPick(product);
    setQuery("");
    setDebounced("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("addProductPlaceholder")}
        className="pl-8"
      />
      {open && debounced.trim().length > 0 && (
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
  );
}
