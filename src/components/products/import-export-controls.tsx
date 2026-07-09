"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiErrorDetail } from "@/lib/api-response";
import type { ProductImportRow } from "@/lib/validators/products";

interface ImportRowResult {
  row: number;
  success: boolean;
  data?: ProductImportRow;
  errors?: ApiErrorDetail[];
}

interface PreviewResponse {
  data: { rows: ImportRowResult[]; validCount: number; errorCount: number };
}

interface CommitResult {
  row: number;
  success: boolean;
  productId?: string;
  message?: string;
}

interface CommitResponse {
  data: { results: CommitResult[]; committed: number };
}

export function ImportExportControls({ onImported }: { onImported: () => void }) {
  const t = useTranslations("products.importExport");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse["data"] | null>(null);

  function reset() {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/products/import/preview", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("preview failed");
      const body: PreviewResponse = await response.json();
      setPreview(body.data);
    } catch {
      toast.error(t("analyzeError"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    const validRows = preview.rows.filter((r) => r.success && r.data).map((r) => r.data!);
    if (validRows.length === 0) return;

    setImporting(true);
    try {
      const response = await fetch("/api/products/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows, skipErrors: true }),
      });
      if (!response.ok) throw new Error("commit failed");
      const body: CommitResponse = await response.json();
      toast.success(t("importSuccess", { count: body.data.committed }));
      setOpen(false);
      reset();
      onImported();
    } catch {
      toast.error(t("importError"));
    } finally {
      setImporting(false);
    }
  }

  const errorRows = preview?.rows.filter((r) => !r.success) ?? [];

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route */}
        <a href="/api/products/export?format=csv">
          <Download className="h-4 w-4" />
          {t("exportCsv")}
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route */}
        <a href="/api/products/export?format=xlsx">
          <Download className="h-4 w-4" />
          {t("exportXlsx")}
        </a>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4" />
          {t("import")}
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            disabled={analyzing || importing}
            className="text-sm"
          />

          {analyzing && <p className="text-sm text-muted-foreground">{t("analyzing")}</p>}

          {preview && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                {t("validRows", { count: preview.validCount })}
                {preview.errorCount > 0 && ` — ${t("errorRows", { count: preview.errorCount })}`}
              </p>
              {errorRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-xs text-destructive">
                  {errorRows.map((row) => (
                    <div key={row.row}>
                      {t("rowError", {
                        row: row.row,
                        message:
                          row.errors?.map((e) => `${e.field} — ${e.message}`).join(", ") ?? "",
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
            <Button
              type="button"
              disabled={!preview || preview.validCount === 0 || importing}
              onClick={handleConfirmImport}
            >
              {importing
                ? t("importing")
                : t("confirmImport", { count: preview?.validCount ?? 0 })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
