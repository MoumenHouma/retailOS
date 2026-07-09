"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Barcode, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProductBarcode {
  id: string;
  barcode: string;
  barcodeType: string;
  isPrimary: boolean;
}

const BARCODE_TYPES = ["EAN13", "CODE128", "QR", "INTERNAL"] as const;

async function fetchBarcodes(productId: string): Promise<{ data: ProductBarcode[] }> {
  const response = await fetch(`/api/products/${productId}/barcodes`);
  if (!response.ok) throw new Error("Failed to load barcodes");
  return response.json();
}

export function BarcodesDialog({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const t = useTranslations("products.barcodes");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [newType, setNewType] = useState<(typeof BARCODE_TYPES)[number]>("EAN13");
  const [adding, setAdding] = useState(false);

  const queryKey = ["product-barcodes", productId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchBarcodes(productId),
    enabled: open,
  });
  const barcodes = data?.data ?? [];

  async function handleAdd() {
    if (!newBarcode.trim()) return;
    setAdding(true);
    try {
      const response = await fetch(`/api/products/${productId}/barcodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: newBarcode.trim(), barcodeType: newType }),
      });
      if (!response.ok) throw new Error("add failed");
      toast.success(t("addSuccess"));
      setNewBarcode("");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch {
      toast.error(t("addError"));
    } finally {
      setAdding(false);
    }
  }

  async function handleSetPrimary(barcodeId: string) {
    const response = await fetch(`/api/products/${productId}/barcodes/${barcodeId}`, {
      method: "PATCH",
    });
    if (!response.ok) {
      toast.error(t("setPrimaryError"));
      return;
    }
    toast.success(t("setPrimarySuccess"));
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  async function handleDelete(barcodeId: string) {
    if (!window.confirm(t("delete.confirm"))) return;
    const response = await fetch(`/api/products/${productId}/barcodes/${barcodeId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" aria-label={t("trigger")} onClick={() => setOpen(true)}>
        <Barcode className="h-4 w-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { name: productName })}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.barcode")}</TableHead>
                <TableHead>{t("table.type")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-destructive">
                    {t("loadError")}
                  </TableCell>
                </TableRow>
              )}
              {!isError && !isLoading && barcodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {barcodes.map((barcode) => (
                <TableRow key={barcode.id}>
                  <TableCell className="font-medium">
                    {barcode.barcode}
                    {barcode.isPrimary && (
                      <Badge variant="default" className="ml-2">
                        {t("primary")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{barcode.barcodeType}</TableCell>
                  <TableCell className="text-right">
                    {!barcode.isPrimary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetPrimary(barcode.id)}
                        aria-label={t("setPrimary")}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(barcode.id)}
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

        <div className="flex items-center gap-2">
          <Input
            value={newBarcode}
            onChange={(event) => setNewBarcode(event.target.value)}
            placeholder={t("addPlaceholder")}
            className="flex-1"
          />
          <Select value={newType} onValueChange={(value) => setNewType(value as typeof newType)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BARCODE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={adding || !newBarcode.trim()}>
            {adding ? t("adding") : t("addSubmit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
