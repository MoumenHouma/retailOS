"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDa } from "@/lib/currency";

interface SessionReport {
  saleCount: number;
  returnCount: number;
  grossSales: number;
  totalRefunds: number;
  netSales: number;
  paymentsByMethod: Record<string, number>;
}

async function fetchReport(sessionId: string): Promise<SessionReport> {
  const response = await fetch(`/api/pos/sessions/${sessionId}/report`);
  if (!response.ok) throw new Error("Failed to load report");
  const body: { data: SessionReport } = await response.json();
  return body.data;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "cash",
  CARD: "card",
  CHECK: "check",
  TRANSFER: "transfer",
};

export function SessionReportDialog({ sessionId }: { sessionId: string }) {
  const t = useTranslations("pos.report");
  const tPayment = useTranslations("pos.payment");
  const [open, setOpen] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ["pos-session-report", sessionId],
    queryFn: () => fetchReport(sessionId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {report && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("saleCount")}</span>
              <span className="tabular-nums">{report.saleCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("grossSales")}</span>
              <span className="tabular-nums">{formatDa(report.grossSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("totalRefunds")} ({report.returnCount})
              </span>
              <span className="tabular-nums">{formatDa(report.totalRefunds)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>{t("netSales")}</span>
              <span className="tabular-nums">{formatDa(report.netSales)}</span>
            </div>
            <div className="mt-2 border-t border-border pt-2">
              {Object.entries(report.paymentsByMethod).map(([method, amount]) => (
                <div key={method} className="flex justify-between text-muted-foreground">
                  <span>{tPayment(METHOD_LABELS[method] ?? method)}</span>
                  <span className="tabular-nums">{formatDa(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
