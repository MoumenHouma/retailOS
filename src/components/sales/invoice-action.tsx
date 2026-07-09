"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoiceAction({ saleId, invoiceId }: { saleId: string; invoiceId: string | null }) {
  const t = useTranslations("sales.invoice");
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [localInvoiceId, setLocalInvoiceId] = useState(invoiceId);

  async function handleGenerate() {
    // Opened synchronously, inside the click's call stack — a browser's
    // popup blocker treats window.open() called after an `await` as not
    // user-gesture-triggered and silently blocks it. Redirect this
    // already-open tab once the invoice id comes back instead.
    const pdfWindow = window.open("", "_blank");

    setGenerating(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId }),
      });
      if (!response.ok) {
        pdfWindow?.close();
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? t("error"));
        return;
      }
      const body: { data: { id: string } } = await response.json();
      setLocalInvoiceId(body.data.id);
      queryClient.invalidateQueries({ queryKey: ["pos-sales-history"] });
      toast.success(t("success"));
      if (pdfWindow) {
        pdfWindow.location.href = `/api/invoices/${body.data.id}/pdf`;
      }
    } finally {
      setGenerating(false);
    }
  }

  if (localInvoiceId) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <a href={`/api/invoices/${localInvoiceId}/pdf`} target="_blank" rel="noopener noreferrer">
          <FileText className="h-4 w-4" />
          {t("view")}
        </a>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
      {generating ? t("generating") : t("generate")}
    </Button>
  );
}
