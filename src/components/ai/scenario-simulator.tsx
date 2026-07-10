"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDa } from "@/lib/currency";

interface ScenarioResult {
  baseline: { revenue: number; cogs: number; grossMargin: number; netProfit: number };
  projected: { revenue: number; cogs: number; grossMargin: number; netProfit: number };
  delta: { revenue: number; cogs: number; grossMargin: number; netProfit: number };
}

export function ScenarioSimulator() {
  const t = useTranslations("scenarioSimulation");
  const [priceChangePct, setPriceChangePct] = useState(0);
  const [demandChangePct, setDemandChangePct] = useState(0);
  const [costChangePct, setCostChangePct] = useState(0);

  const [from] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to] = useState(() => new Date().toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: async (): Promise<ScenarioResult> => {
      const response = await fetch("/api/ai/scenarios/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, priceChangePct, demandChangePct, costChangePct }),
      });
      if (!response.ok) throw new Error("simulate failed");
      const body: { data: ScenarioResult } = await response.json();
      return body.data;
    },
  });

  const chartData = mutation.data
    ? [
        { name: t("chart.revenue"), baseline: mutation.data.baseline.revenue, projected: mutation.data.projected.revenue },
        { name: t("chart.grossMargin"), baseline: mutation.data.baseline.grossMargin, projected: mutation.data.projected.grossMargin },
        { name: t("chart.netProfit"), baseline: mutation.data.baseline.netProfit, projected: mutation.data.projected.netProfit },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <h2 className="font-medium">{t("title")}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label>{t("priceChange")}</Label>
          <Input
            type="number"
            value={priceChangePct}
            onChange={(e) => setPriceChangePct(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("demandChange")}</Label>
          <Input
            type="number"
            value={demandChangePct}
            onChange={(e) => setDemandChangePct(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("costChange")}</Label>
          <Input
            type="number"
            value={costChangePct}
            onChange={(e) => setCostChangePct(Number(e.target.value))}
          />
        </div>
      </div>
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-fit">
        {mutation.isPending ? t("simulating") : t("simulate")}
      </Button>

      {mutation.data && (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatDa(value)} />
                <Bar dataKey="baseline" fill="var(--color-muted-foreground, #94a3b8)" />
                <Bar dataKey="projected" fill="var(--color-chart-1, #6366f1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("netProfitDelta")}: {formatDa(mutation.data.delta.netProfit)}
          </p>
        </>
      )}
    </div>
  );
}
