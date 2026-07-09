"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDa } from "@/lib/currency";
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";

interface PurchaseOrderItem {
  id: string;
  productId: string;
  product: { name: string };
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  tvaRate: number;
  total: number;
}

interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  status: string;
  supplierId: string;
  supplier: { name: string };
  storeId: string;
  store: { name: string };
  expectedDeliveryDate: string | null;
  notes: string | null;
  subtotal: number;
  tvaAmount: number;
  total: number;
  items: PurchaseOrderItem[];
}

async function fetchPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  const response = await fetch(`/api/purchase-orders/${id}`);
  if (!response.ok) throw new Error("Failed to load purchase order");
  const body: { data: PurchaseOrderDetail } = await response.json();
  return body.data;
}

async function postAction(id: string, action: string) {
  const response = await fetch(`/api/purchase-orders/${id}/${action}`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Action failed");
  }
}

export function PurchaseOrderDetailView({ id }: { id: string }) {
  const t = useTranslations("purchaseOrders");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: authSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: purchaseOrder, isLoading, isError } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => fetchPurchaseOrder(id),
  });

  const canApprove = authSession?.user.permissions.includes("purchases:approve") ?? false;

  async function runAction(action: string, successKey: string) {
    setBusy(true);
    try {
      await postAction(id, action);
      toast.success(t(successKey));
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actionError"));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  if (isError || !purchaseOrder) return <p className="text-destructive">{t("loadError")}</p>;

  const editable = purchaseOrder.status === "draft" || purchaseOrder.status === "pending_approval";

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{purchaseOrder.poNumber}</h1>
          <Button variant="outline" onClick={() => setEditing(false)}>
            {t("form.cancelEdit")}
          </Button>
        </div>
        <PurchaseOrderForm
          storeId={purchaseOrder.storeId}
          purchaseOrder={{
            id: purchaseOrder.id,
            supplierId: purchaseOrder.supplierId,
            expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
            notes: purchaseOrder.notes,
            items: purchaseOrder.items,
          }}
          onSaved={() => {
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{purchaseOrder.poNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {purchaseOrder.supplier.name} — {purchaseOrder.store.name}
          </p>
        </div>
        <Badge>{t(`status.${purchaseOrder.status}`)}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>
            {t("actions.edit")}
          </Button>
        )}
        {purchaseOrder.status === "draft" && (
          <Button onClick={() => runAction("submit", "actions.submitSuccess")} disabled={busy}>
            {t("actions.submit")}
          </Button>
        )}
        {purchaseOrder.status === "pending_approval" && canApprove && (
          <Button onClick={() => runAction("approve", "actions.approveSuccess")} disabled={busy}>
            {t("actions.approve")}
          </Button>
        )}
        {purchaseOrder.status === "approved" && (
          <Button onClick={() => runAction("order", "actions.orderSuccess")} disabled={busy}>
            {t("actions.markOrdered")}
          </Button>
        )}
        {(purchaseOrder.status === "draft" ||
          purchaseOrder.status === "pending_approval" ||
          purchaseOrder.status === "approved") && (
          <Button
            variant="outline"
            onClick={() => runAction("cancel", "actions.cancelSuccess")}
            disabled={busy}
          >
            {t("actions.cancel")}
          </Button>
        )}
      </div>

      {purchaseOrder.expectedDeliveryDate && (
        <p className="text-sm text-muted-foreground">
          {t("expectedDeliveryDate")}: {new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}
        </p>
      )}
      {purchaseOrder.notes && <p className="text-sm text-muted-foreground">{purchaseOrder.notes}</p>}

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("form.product")}</TableHead>
              <TableHead className="text-right">{t("table.ordered")}</TableHead>
              <TableHead className="text-right">{t("table.received")}</TableHead>
              <TableHead className="text-right">{t("form.unitPrice")}</TableHead>
              <TableHead className="text-right">{t("form.lineTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrder.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product.name}</TableCell>
                <TableCell className="text-right">{item.quantityOrdered}</TableCell>
                <TableCell className="text-right">{item.quantityReceived}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(item.unitPrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="ms-auto flex w-64 flex-col gap-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{t("form.subtotal")}</span>
          <span className="tabular-nums">{formatDa(purchaseOrder.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("form.tva")}</span>
          <span className="tabular-nums">{formatDa(purchaseOrder.tvaAmount)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>{t("form.total")}</span>
          <span className="tabular-nums">{formatDa(purchaseOrder.total)}</span>
        </div>
      </div>
    </div>
  );
}
