"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDa } from "@/lib/currency";
import { usePosCartStore } from "@/stores/pos-cart-store";

interface SearchProduct {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number;
  tvaRate: number;
  isActive: boolean;
}

interface ProductsResponse {
  data: SearchProduct[];
}

async function searchProducts(q: string): Promise<SearchProduct[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q, isActive: "true", pageSize: "10", sort: "name", order: "asc" });
  const response = await fetch(`/api/products?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to search products");
  const body: ProductsResponse = await response.json();
  return body.data;
}

export function ProductSearch() {
  const t = useTranslations("pos");
  const addProduct = usePosCartStore((state) => state.addProduct);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(handle);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ["pos-product-search", debounced],
    queryFn: () => searchProducts(debounced),
    enabled: debounced.trim().length > 0,
  });

  function handleAdd(product: SearchProduct) {
    addProduct(product);
    setQuery("");
    setDebounced("");
    setOpen(false);
    inputRef.current?.focus();
  }

  // A scanner types the barcode then sends Enter — if there's exactly one
  // match, treat Enter as "add it" instead of requiring a click.
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const [first] = results;
    if (event.key === "Enter" && first) {
      event.preventDefault();
      handleAdd(first);
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={t("searchPlaceholder")}
        className="pl-8 text-base"
      />
      {open && debounced.trim().length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("searchEmpty")}</p>
          ) : (
            <ul className="max-h-72 overflow-auto py-1">
              {results.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleAdd(product)}
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
