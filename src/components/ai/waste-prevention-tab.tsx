"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ExpirationRisk {
  batchId: string;
  productId: string;
  productName: string;
  quantityRemaining: number;
  daysUntilExpiry: number;
}

async function fetchRisks(): Promise<ExpirationRisk[]> {
  const response = await fetch("/api/ai/waste-predictions");
  if (!response.ok) return [];
  const body: { data: ExpirationRisk[] } = await response.json();
  return body.data;
}

export function WastePreventionTab() {
  const t = useTranslations("wastePrevention");
  const queryClient = useQueryClient();

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ["ai", "waste-risks"],
    queryFn: fetchRisks,
  });

  async function handleGenerate() {
    const response = await fetch("/api/ai/waste-predictions/generate", { method: "POST" });
    if (!response.ok) {
      toast.error(t("generateError"));
      return;
    }
    const body: { data: { created: number } } = await response.json();
    toast.success(t("generateSuccess", { count: body.data.created }));
    queryClient.invalidateQueries({ queryKey: ["ai", "waste-risks"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={handleGenerate}>{t("generate")}</Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead className="text-right">{t("table.quantity")}</TableHead>
              <TableHead className="text-right">{t("table.daysUntilExpiry")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && risks.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {risks.map((risk) => (
              <TableRow key={risk.batchId}>
                <TableCell>{risk.productName}</TableCell>
                <TableCell className="text-right">{risk.quantityRemaining}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={risk.daysUntilExpiry <= 3 ? "destructive" : "secondary"}>
                    {risk.daysUntilExpiry}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
