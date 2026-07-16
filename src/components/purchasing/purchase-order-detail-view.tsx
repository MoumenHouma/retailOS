"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { ReceiveDeliveryDialog } from "@/components/purchasing/receive-delivery-dialog";
import { PurchaseReturnDialog } from "@/components/purchasing/purchase-return-dialog";
import { DetailPageSkeleton } from "@/components/ui/page-skeleton";

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

interface DeliveryRow {
  id: string;
  deliveryNumber: string;
  deliveredAt: string | null;
  items: { id: string; product: { name: string }; quantityDelivered: number }[];
}

interface ReturnRow {
  id: string;
  returnNumber: string;
  createdAt: string;
  totalRefunded: number;
  items: { id: string; product: { name: string }; quantity: number }[];
}

async function fetchPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  const response = await fetch(`/api/purchase-orders/${id}`);
  if (!response.ok) throw new Error("Failed to load purchase order");
  const body: { data: PurchaseOrderDetail } = await response.json();
  return body.data;
}

async function fetchDeliveries(id: string): Promise<DeliveryRow[]> {
  const response = await fetch(`/api/purchase-orders/${id}/deliveries`);
  if (!response.ok) throw new Error("Failed to load deliveries");
  const body: { data: DeliveryRow[] } = await response.json();
  return body.data;
}

async function fetchReturns(id: string): Promise<ReturnRow[]> {
  const response = await fetch(`/api/purchase-orders/${id}/returns`);
  if (!response.ok) throw new Error("Failed to load returns");
  const body: { data: ReturnRow[] } = await response.json();
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

  const deliveriesQuery = useQuery({
    queryKey: ["purchase-order-deliveries", id],
    queryFn: () => fetchDeliveries(id),
  });
  const returnsQuery = useQuery({
    queryKey: ["purchase-order-returns", id],
    queryFn: () => fetchReturns(id),
  });

  function refreshAfterReceivingOrReturn() {
    queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
    queryClient.invalidateQueries({ queryKey: ["purchase-order-deliveries", id] });
    queryClient.invalidateQueries({ queryKey: ["purchase-order-returns", id] });
  }

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

  if (isLoading) return <DetailPageSkeleton statTiles={0} />;
  if (isError || !purchaseOrder) return <p className="text-destructive">{t("loadError")}</p>;

  const editable = purchaseOrder.status === "draft" || purchaseOrder.status === "pending_approval";

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={purchaseOrder.poNumber}
          action={
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t("form.cancelEdit")}
            </Button>
          }
        />
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
      <PageHeader
        title={purchaseOrder.poNumber}
        description={`${purchaseOrder.supplier.name} — ${purchaseOrder.store.name}`}
        action={
          <StatusBadge domain="po" status={purchaseOrder.status}>
            {t(`status.${purchaseOrder.status}`)}
          </StatusBadge>
        }
      />

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
        {(purchaseOrder.status === "ordered" || purchaseOrder.status === "partially_received") && (
          <ReceiveDeliveryDialog
            poId={id}
            items={purchaseOrder.items}
            onReceived={refreshAfterReceivingOrReturn}
            trigger={<Button disabled={busy}>{t("deliveries.receiveAction")}</Button>}
          />
        )}
        {(purchaseOrder.status === "partially_received" || purchaseOrder.status === "received") &&
          (deliveriesQuery.data?.length ?? 0) > 0 && (
            <PurchaseReturnDialog
              poId={id}
              onReturned={refreshAfterReceivingOrReturn}
              trigger={
                <Button variant="outline" disabled={busy}>
                  {t("returns.returnAction")}
                </Button>
              }
            />
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

      {(deliveriesQuery.data?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t("deliveries.title")}</h2>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("deliveries.table.number")}</TableHead>
                  <TableHead>{t("deliveries.table.deliveredAt")}</TableHead>
                  <TableHead>{t("deliveries.table.items")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveriesQuery.data!.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-medium">{delivery.deliveryNumber}</TableCell>
                    <TableCell>
                      {delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {delivery.items.map((item) => `${item.product.name} (${item.quantityDelivered})`).join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {(returnsQuery.data?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t("returns.title")}</h2>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("returns.table.number")}</TableHead>
                  <TableHead>{t("returns.table.date")}</TableHead>
                  <TableHead>{t("returns.table.items")}</TableHead>
                  <TableHead className="text-right">{t("returns.table.totalRefunded")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnsQuery.data!.map((purchaseReturn) => (
                  <TableRow key={purchaseReturn.id}>
                    <TableCell className="font-medium">{purchaseReturn.returnNumber}</TableCell>
                    <TableCell>{new Date(purchaseReturn.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {purchaseReturn.items.map((item) => `${item.product.name} (${item.quantity})`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDa(purchaseReturn.totalRefunded)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
