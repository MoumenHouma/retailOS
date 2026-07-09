"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { centimesToDa, daToCentimes, formatDa } from "@/lib/currency";
import { ProductPicker, type PickedProduct } from "@/components/purchasing/product-picker";

interface SupplierOption {
  id: string;
  name: string;
}

interface EditableLine {
  productId: string;
  productName: string;
  quantityOrdered: number;
  unitPrice: number;
  tvaRate: number;
}

interface ExistingPurchaseOrder {
  id: string;
  supplierId: string;
  expectedDeliveryDate: string | null;
  notes: string | null;
  items: { productId: string; product: { name: string }; quantityOrdered: number; unitPrice: number; tvaRate: number }[];
}

async function fetchSuppliers(): Promise<SupplierOption[]> {
  const response = await fetch("/api/suppliers?pageSize=100&isActive=true");
  if (!response.ok) throw new Error("Failed to load suppliers");
  const body: { data: SupplierOption[] } = await response.json();
  return body.data;
}

async function fetchSupplierPrices(supplierId: string): Promise<Record<string, number>> {
  const response = await fetch(`/api/suppliers/${supplierId}/products`);
  if (!response.ok) return {};
  const body: { data: { productId: string; unitPrice: number | null }[] } = await response.json();
  const map: Record<string, number> = {};
  for (const link of body.data) {
    if (link.unitPrice != null) map[link.productId] = link.unitPrice;
  }
  return map;
}

export function PurchaseOrderForm({
  storeId,
  purchaseOrder,
  onSaved,
}: {
  storeId: string;
  purchaseOrder?: ExistingPurchaseOrder;
  onSaved?: () => void;
}) {
  const t = useTranslations("purchaseOrders.form");
  const router = useRouter();
  const isEdit = !!purchaseOrder;

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState(purchaseOrder?.supplierId ?? "");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(purchaseOrder?.expectedDeliveryDate ?? "");
  const [notes, setNotes] = useState(purchaseOrder?.notes ?? "");
  const [lines, setLines] = useState<EditableLine[]>(
    purchaseOrder?.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantityOrdered: item.quantityOrdered,
      unitPrice: item.unitPrice,
      tvaRate: item.tvaRate,
    })) ?? [],
  );
  const [supplierPrices, setSupplierPrices] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => toast.error(t("loadSuppliersError")));
  }, [t]);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    fetchSupplierPrices(supplierId).then((prices) => {
      if (!cancelled) setSupplierPrices(prices);
    });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tvaAmount = 0;
    for (const line of lines) {
      const lineSubtotal = line.unitPrice * line.quantityOrdered;
      subtotal += lineSubtotal;
      tvaAmount += Math.round((lineSubtotal * line.tvaRate) / 100);
    }
    return { subtotal, tvaAmount, total: subtotal + tvaAmount };
  }, [lines]);

  function handleAddProduct(product: PickedProduct) {
    if (lines.some((line) => line.productId === product.id)) return;
    const unitPrice = supplierPrices[product.id] ?? product.sellingPrice;
    setLines((prev) => [
      ...prev,
      { productId: product.id, productName: product.name, quantityOrdered: 1, unitPrice, tvaRate: product.tvaRate },
    ]);
  }

  function updateLine(productId: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supplierId) {
      toast.error(t("supplierRequired"));
      return;
    }
    if (lines.length === 0) {
      toast.error(t("itemsRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId,
        storeId,
        expectedDeliveryDate: expectedDeliveryDate || null,
        notes: notes || null,
        items: lines.map((line) => ({
          productId: line.productId,
          quantityOrdered: line.quantityOrdered,
          unitPrice: line.unitPrice,
        })),
      };

      const response = await fetch(
        isEdit ? `/api/purchase-orders/${purchaseOrder.id}` : "/api/purchase-orders",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? { ...payload, supplierId: undefined, storeId: undefined } : payload),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("error"));
        return;
      }

      const body: { data: { id: string } } = await response.json();
      toast.success(isEdit ? t("editSuccess") : t("success"));
      if (isEdit) {
        onSaved?.();
      } else {
        router.push(`/purchase-orders/${body.data.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label>{t("supplier")}</Label>
          <Select value={supplierId} onValueChange={setSupplierId} disabled={isEdit}>
            <SelectTrigger>
              <SelectValue placeholder={t("selectSupplier")} />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("expectedDeliveryDate")}</Label>
          <Input
            type="date"
            value={expectedDeliveryDate ?? ""}
            onChange={(event) => setExpectedDeliveryDate(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t("notes")}</Label>
        <Textarea value={notes ?? ""} onChange={(event) => setNotes(event.target.value)} />
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
                  <TableHead className="w-36 text-right">{t("unitPrice")}</TableHead>
                  <TableHead className="text-right">{t("lineTotal")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const lineSubtotal = line.unitPrice * line.quantityOrdered;
                  const lineTotal = lineSubtotal + Math.round((lineSubtotal * line.tvaRate) / 100);
                  return (
                    <TableRow key={line.productId}>
                      <TableCell className="font-medium">{line.productName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantityOrdered}
                          onChange={(event) =>
                            updateLine(line.productId, {
                              quantityOrdered: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                          className="text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={centimesToDa(line.unitPrice)}
                          onChange={(event) =>
                            updateLine(line.productId, {
                              unitPrice: Math.max(0, daToCentimes(Number(event.target.value) || 0)),
                            })
                          }
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDa(lineTotal)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(line.productId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="ms-auto flex w-64 flex-col gap-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span className="tabular-nums">{formatDa(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("tva")}</span>
            <span className="tabular-nums">{formatDa(totals.tvaAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>{t("total")}</span>
            <span className="tabular-nums">{formatDa(totals.total)}</span>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? (isEdit ? t("editSubmitting") : t("submitting")) : isEdit ? t("editSubmit") : t("submit")}
      </Button>
    </form>
  );
}
