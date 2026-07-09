"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductPicker, type PickedProduct } from "@/components/purchasing/product-picker";

interface StoreOption {
  id: string;
  name: string;
}

interface EditableLine {
  productId: string;
  productName: string;
  quantityRequested: number;
}

async function fetchStores(): Promise<StoreOption[]> {
  const response = await fetch("/api/stores");
  if (!response.ok) throw new Error("Failed to load stores");
  const body: { data: StoreOption[] } = await response.json();
  return body.data;
}

export function StockTransferForm() {
  const t = useTranslations("stockTransfers.form");
  const router = useRouter();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStores().then(setStores).catch(() => toast.error(t("loadStoresError")));
  }, [t]);

  function handleAddProduct(product: PickedProduct) {
    if (lines.some((line) => line.productId === product.id)) return;
    setLines((prev) => [...prev, { productId: product.id, productName: product.name, quantityRequested: 1 }]);
  }

  function updateQuantity(productId: string, quantity: number) {
    setLines((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, quantityRequested: quantity } : line)),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!fromStoreId || !toStoreId) {
      toast.error(t("storesRequired"));
      return;
    }
    if (fromStoreId === toStoreId) {
      toast.error(t("sameStoreError"));
      return;
    }
    if (lines.length === 0) {
      toast.error(t("itemsRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/stock-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromStoreId,
          toStoreId,
          notes: notes || null,
          items: lines.map((line) => ({ productId: line.productId, quantityRequested: line.quantityRequested })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("error"));
        return;
      }

      const body: { data: { id: string } } = await response.json();
      toast.success(t("success"));
      router.push(`/stock-transfers/${body.data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label>{t("fromStore")}</Label>
          <Select value={fromStoreId} onValueChange={setFromStoreId}>
            <SelectTrigger>
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
          <Label>{t("toStore")}</Label>
          <Select value={toStoreId} onValueChange={setToStoreId}>
            <SelectTrigger>
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
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t("notes")}</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("items")}</Label>
        <ProductPicker onPick={handleAddProduct} />

        {lines.length > 0 && (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="w-28 text-center">{t("quantity")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.productId}>
                    <TableCell className="font-medium">{line.productName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantityRequested}
                        onChange={(event) =>
                          updateQuantity(line.productId, Math.max(1, Number(event.target.value) || 1))
                        }
                        className="text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.productId)}>
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

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
