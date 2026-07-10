"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SupplierOption {
  id: string;
  name: string;
  rating: string | null;
}

const CRITERIA = ["price", "quality", "delivery", "reliability", "paymentTerms", "productRange"] as const;
const SAATY_SCALE = [1 / 9, 1 / 7, 1 / 5, 1 / 3, 1, 3, 5, 7, 9];

interface RankedSupplier {
  supplierId: string;
  supplierName: string;
  score: number;
}

async function fetchSuppliers(): Promise<SupplierOption[]> {
  const response = await fetch("/api/suppliers?pageSize=100&isActive=true");
  if (!response.ok) return [];
  const body: { data: SupplierOption[] } = await response.json();
  return body.data;
}

function buildPairwiseMatrix(pairValues: Record<string, number>): number[][] {
  const n = CRITERIA.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = pairValues[`${i}-${j}`] ?? 1;
      matrix[i]![j] = value;
      matrix[j]![i] = 1 / value;
    }
  }
  return matrix;
}

export function SupplierRankingView() {
  const t = useTranslations("supplierRanking");
  const queryClient = useQueryClient();

  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<"ahp_topsis" | "ahp_promethee">("ahp_topsis");
  const [pairValues, setPairValues] = useState<Record<string, number>>({});
  const [evaluationPeriod, setEvaluationPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  });
  const [results, setResults] = useState<{ ranked: RankedSupplier[]; consistencyRatio: number | null } | null>(
    null,
  );
  const [selectedHistorySupplier, setSelectedHistorySupplier] = useState<string>("");

  const { data: suppliers = [] } = useQuery({ queryKey: ["ai", "mcda-suppliers"], queryFn: fetchSuppliers });

  const { data: history = [] } = useQuery({
    queryKey: ["ai", "supplier-rating", selectedHistorySupplier],
    queryFn: async () => {
      const response = await fetch(`/api/suppliers/${selectedHistorySupplier}/rating`);
      const body: { data: { history: { evaluatedAt: string; supplierScores: Record<string, number> }[] } } =
        await response.json();
      return body.data.history.map((h) => ({
        evaluatedAt: h.evaluatedAt.slice(0, 10),
        score: h.supplierScores[selectedHistorySupplier] ?? 0,
      }));
    },
    enabled: !!selectedHistorySupplier,
  });

  const pairs = useMemo(() => {
    const list: { i: number; j: number; a: string; b: string }[] = [];
    for (let i = 0; i < CRITERIA.length; i++) {
      for (let j = i + 1; j < CRITERIA.length; j++) {
        list.push({ i, j, a: CRITERIA[i]!, b: CRITERIA[j]! });
      }
    }
    return list;
  }, []);

  function toggleSupplier(id: string) {
    setSelectedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRunEvaluation() {
    if (selectedSuppliers.size < 2) {
      toast.error(t("selectAtLeastTwo"));
      return;
    }
    const pairwiseMatrix = buildPairwiseMatrix(pairValues);
    const response = await fetch("/api/suppliers/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierIds: [...selectedSuppliers],
        method,
        pairwiseMatrix,
        evaluationPeriod,
      }),
    });
    if (!response.ok) {
      toast.error(t("runError"));
      return;
    }
    const body: { data: { ranked: RankedSupplier[]; consistencyRatio: number | null } } = await response.json();
    setResults(body.data);
    toast.success(t("runSuccess"));
    queryClient.invalidateQueries({ queryKey: ["ai", "mcda-suppliers"] });
  }

  async function handleGeneratePurchaseRecommendations() {
    const response = await fetch("/api/ai/purchase-recommendations/generate", { method: "POST" });
    if (!response.ok) {
      toast.error(t("purchaseRecommendations.error"));
      return;
    }
    const body: { data: { created: number } } = await response.json();
    toast.success(t("purchaseRecommendations.success", { count: body.data.created }));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <h2 className="font-medium">{t("selectSuppliers")}</h2>
        <div className="flex flex-wrap gap-3">
          {suppliers.map((supplier) => (
            <label key={supplier.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedSuppliers.has(supplier.id)}
                onCheckedChange={() => toggleSupplier(supplier.id)}
              />
              {supplier.name}
              {supplier.rating && <Badge variant="secondary">{supplier.rating}</Badge>}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <h2 className="font-medium">{t("ahp.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("ahp.description")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pairs.map(({ i, j, a, b }) => (
            <div key={`${i}-${j}`} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {t(`criteria.${a}`)} {t("ahp.vs")} {t(`criteria.${b}`)}
              </span>
              <Select
                value={String(pairValues[`${i}-${j}`] ?? 1)}
                onValueChange={(value) =>
                  setPairValues((prev) => ({ ...prev, [`${i}-${j}`]: Number(value) }))
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAATY_SCALE.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value < 1 ? `1/${Math.round(1 / value)}` : value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ahp_topsis">{t("method.ahpTopsis")}</SelectItem>
            <SelectItem value="ahp_promethee">{t("method.ahpPromethee")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleRunEvaluation}>{t("runEvaluation")}</Button>
        <Button variant="secondary" onClick={handleGeneratePurchaseRecommendations}>
          {t("purchaseRecommendations.generate")}
        </Button>
      </div>

      {results && (
        <div className="flex flex-col gap-3">
          {results.consistencyRatio !== null && (
            <Badge variant={results.consistencyRatio >= 0.1 ? "warning" : "success"}>
              {t("ahp.consistencyRatio")}: {results.consistencyRatio.toFixed(3)}
              {results.consistencyRatio >= 0.1 ? ` (${t("ahp.inconsistentWarning")})` : ""}
            </Badge>
          )}
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.rank")}</TableHead>
                  <TableHead>{t("table.supplier")}</TableHead>
                  <TableHead className="text-right">{t("table.score")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.ranked.map((row, index) => (
                  <TableRow
                    key={row.supplierId}
                    className="cursor-pointer"
                    onClick={() => setSelectedHistorySupplier(row.supplierId)}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.supplierName}</TableCell>
                    <TableCell className="text-right">{row.score.toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {selectedHistorySupplier && history.length > 0 && (
        <div className="h-64 rounded-md border border-border p-4">
          <h2 className="mb-2 font-medium">{t("scoreHistory")}</h2>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="evaluatedAt" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="var(--color-chart-1, #6366f1)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
