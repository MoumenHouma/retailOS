"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { formatDa, centimesToDa, daToCentimes } from "@/lib/currency";
import { ProductPicker, type PickedProduct } from "@/components/purchasing/product-picker";

interface SupplierOption {
  id: string;
  name: string;
}

interface QuoteItem {
  id: string;
  productId: string;
  product: { id: string; name: string };
  quantity: number;
  unitPrice: number;
}

interface Quote {
  id: string;
  supplierId: string;
  supplier: { name: string };
  status: string;
  validUntil: string | null;
  items: QuoteItem[];
}

interface EditableLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

async function fetchSuppliers(): Promise<SupplierOption[]> {
  const response = await fetch("/api/suppliers?pageSize=100&isActive=true");
  if (!response.ok) throw new Error("Failed to load suppliers");
  const body: { data: SupplierOption[] } = await response.json();
  return body.data;
}

async function fetchQuotes(): Promise<Quote[]> {
  const response = await fetch("/api/supplier-quotes");
  if (!response.ok) throw new Error("Failed to load quotes");
  const body: { data: Quote[] } = await response.json();
  return body.data;
}

async function fetchComparison(productIds: string[]): Promise<Quote[]> {
  const response = await fetch(`/api/supplier-quotes/compare?productIds=${productIds.join(",")}`);
  if (!response.ok) throw new Error("Failed to load comparison");
  const body: { data: Quote[] } = await response.json();
  return body.data;
}

function NewQuoteDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("supplierQuotes.form");
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) fetchSuppliers().then(setSuppliers).catch(() => {});
  }, [open]);

  function handleAddProduct(product: PickedProduct) {
    if (lines.some((line) => line.productId === product.id)) return;
    setLines((prev) => [
      ...prev,
      { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.sellingPrice },
    ]);
  }

  function updateLine(productId: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  }

  async function handleSubmit() {
    if (!supplierId || lines.length === 0) {
      toast.error(t("validationError"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/supplier-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          validUntil: validUntil || undefined,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        }),
      });
      if (!response.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("success"));
      setSupplierId("");
      setValidUntil("");
      setLines([]);
      setOpen(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder={t("supplier")} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              placeholder={t("validUntil")}
            />
          </div>

          <ProductPicker onPick={handleAddProduct} />

          {lines.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="w-24 text-center">{t("quantity")}</TableHead>
                  <TableHead className="w-32 text-right">{t("unitPrice")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.productId}>
                    <TableCell>{line.productName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.productId, { quantity: Math.max(1, Number(event.target.value) || 1) })
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
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeLine(line.productId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SupplierQuotesView() {
  const t = useTranslations("supplierQuotes");
  const queryClient = useQueryClient();
  const [comparisonProducts, setComparisonProducts] = useState<PickedProduct[]>([]);

  const { data: quotes = [] } = useQuery({ queryKey: ["supplier-quotes"], queryFn: fetchQuotes });

  const { data: comparison = [] } = useQuery({
    queryKey: ["supplier-quotes-compare", comparisonProducts.map((p) => p.id)],
    queryFn: () => fetchComparison(comparisonProducts.map((p) => p.id)),
    enabled: comparisonProducts.length > 0,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t("title")}
          action={
            <NewQuoteDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["supplier-quotes"] })} />
          }
        />

        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.supplier")}</TableHead>
                <TableHead>{t("table.validUntil")}</TableHead>
                <TableHead className="text-right">{t("table.items")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.supplier.name}</TableCell>
                  <TableCell>
                    {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">{quote.items.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("comparison.title")}</h2>
        <ProductPicker
          onPick={(product) => {
            if (comparisonProducts.some((p) => p.id === product.id)) return;
            setComparisonProducts((prev) => [...prev, product]);
          }}
        />
        {comparisonProducts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {comparisonProducts.map((product) => (
              <Button
                key={product.id}
                variant="secondary"
                size="sm"
                onClick={() => setComparisonProducts((prev) => prev.filter((p) => p.id !== product.id))}
              >
                {product.name} ✕
              </Button>
            ))}
          </div>
        )}

        {comparisonProducts.length > 0 && (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.supplier")}</TableHead>
                  {comparisonProducts.map((product) => (
                    <TableHead key={product.id} className="text-right">
                      {product.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={comparisonProducts.length + 1} className="text-center text-muted-foreground">
                      {t("comparison.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {comparison.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.supplier.name}</TableCell>
                    {comparisonProducts.map((product) => {
                      const item = quote.items.find((i) => i.productId === product.id);
                      return (
                        <TableCell key={product.id} className="text-right tabular-nums">
                          {item ? formatDa(item.unitPrice) : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
