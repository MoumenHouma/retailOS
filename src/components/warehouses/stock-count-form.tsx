"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductPicker, type PickedProduct } from "@/components/purchasing/product-picker";

interface StoreOption {
  id: string;
  name: string;
}

async function fetchStores(): Promise<StoreOption[]> {
  const response = await fetch("/api/stores");
  if (!response.ok) throw new Error("Failed to load stores");
  const body: { data: StoreOption[] } = await response.json();
  return body.data;
}

export function StockCountForm() {
  const t = useTranslations("stockCounts.form");
  const router = useRouter();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<PickedProduct[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStores().then(setStores).catch(() => toast.error(t("loadStoresError")));
  }, [t]);

  function handleAddProduct(product: PickedProduct) {
    if (products.some((p) => p.id === product.id)) return;
    setProducts((prev) => [...prev, product]);
  }

  function removeProduct(productId: string) {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!storeId) {
      toast.error(t("storeRequired"));
      return;
    }
    if (products.length === 0) {
      toast.error(t("itemsRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/stock-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          notes: notes || null,
          productIds: products.map((p) => p.id),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("error"));
        return;
      }

      const body: { data: { id: string } } = await response.json();
      toast.success(t("success"));
      router.push(`/stock-counts/${body.data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Label>{t("store")}</Label>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={t("selectStore")} />
          </SelectTrigger>
          <SelectContent>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t("notes")}</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("productsToCount")}</Label>
        <ProductPicker onPick={handleAddProduct} />

        {products.length > 0 && (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {products.map((product) => (
              <li key={product.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{product.name}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(product.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
