"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProductSearch } from "@/components/pos/product-search";
import { CartPanel } from "@/components/pos/cart-panel";
import { CustomerPicker } from "@/components/pos/customer-picker";
import { OpenSessionForm } from "@/components/pos/open-session-form";
import { CloseSessionDialog } from "@/components/pos/close-session-dialog";
import { PaymentDialog, type CompletedSale } from "@/components/pos/payment-dialog";
import { ReceiptDialog } from "@/components/pos/receipt-dialog";
import { HeldSalesDialog } from "@/components/pos/held-sales-dialog";
import { SessionReportDialog } from "@/components/pos/session-report-dialog";
import { toast } from "sonner";
import { cartTotals, usePosCartStore } from "@/stores/pos-cart-store";

interface PosSessionData {
  id: string;
  terminalName: string;
  openedAt: string;
  openingCash: number;
}

async function fetchCurrentSession(storeId: string): Promise<PosSessionData | null> {
  const response = await fetch(`/api/pos/sessions?storeId=${storeId}`);
  if (!response.ok) throw new Error("Failed to load session");
  const body: { data: PosSessionData | null } = await response.json();
  return body.data;
}

export function PosView() {
  const t = useTranslations("pos");
  const tCommon = useTranslations("common");
  const { data: authSession } = useSession();
  const queryClient = useQueryClient();
  const storeId = authSession?.user.storeId ?? null;

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  const lines = usePosCartStore((state) => state.lines);
  const discountAmount = usePosCartStore((state) => state.discountAmount);
  const customer = usePosCartStore((state) => state.customer);
  const clearCart = usePosCartStore((state) => state.clear);
  const totals = cartTotals(lines, discountAmount);
  const [holding, setHolding] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["pos-session", storeId],
    queryFn: () => fetchCurrentSession(storeId!),
    enabled: !!storeId,
  });

  function invalidateSession() {
    queryClient.invalidateQueries({ queryKey: ["pos-session", storeId] });
  }

  function handleSaleCompleted(sale: CompletedSale) {
    setPaymentOpen(false);
    setCompletedSale(sale);
    clearCart();
  }

  async function handleHold() {
    if (!storeId || !session || lines.length === 0) return;
    setHolding(true);
    try {
      const response = await fetch("/api/pos/sales/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          posSessionId: session.id,
          customerId: customer?.id ?? null,
          discountAmount,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            discountAmount: line.discountAmount,
          })),
        }),
      });
      if (!response.ok) {
        toast.error(t("hold.error"));
        return;
      }
      clearCart();
      toast.success(t("hold.success"));
    } finally {
      setHolding(false);
    }
  }

  if (!storeId) {
    return <p className="p-6 text-muted-foreground">{t("noStore")}</p>;
  }

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">{t("session.loading")}</p>;
  }

  if (!session) {
    return <OpenSessionForm storeId={storeId} onOpened={invalidateSession} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("session.cashierLabel")}: {authSession?.user.name} — {session.terminalName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SessionReportDialog sessionId={session.id} />
          <CloseSessionDialog sessionId={session.id} onClosed={invalidateSession} />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-3 overflow-hidden">
        <div className="col-span-2 flex flex-col gap-4 overflow-hidden border-e border-border p-4">
          <ProductSearch />
          <Separator />
          <div className="flex-1 overflow-hidden">
            <CartPanel />
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <CustomerPicker />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={lines.length === 0 || holding}
              onClick={handleHold}
            >
              {holding ? t("hold.holding") : t("hold.hold")}
            </Button>
            <HeldSalesDialog storeId={storeId} />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={lines.length === 0}>
                {t("cart.clear")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("cart.clearConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("cart.clearConfirmDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={clearCart}>{t("cart.clear")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            type="button"
            size="lg"
            className="mt-auto"
            disabled={lines.length === 0}
            onClick={() => setPaymentOpen(true)}
          >
            {t("cart.pay")}
          </Button>
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        storeId={storeId}
        posSessionId={session.id}
        total={totals.total}
        onCompleted={handleSaleCompleted}
      />
      <ReceiptDialog sale={completedSale} onNewSale={() => setCompletedSale(null)} />
    </div>
  );
}
