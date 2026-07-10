"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductPicker, type PickedProduct } from "@/components/purchasing/product-picker";

interface StoreOption {
  id: string;
  name: string;
}

interface ForecastPoint {
  forecastDate: string;
  predictedQuantity: number;
  predictedLower: number | null;
  predictedUpper: number | null;
  accuracyMape: number | null;
}

interface BatchStatus {
  queued: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

async function fetchStores(): Promise<StoreOption[]> {
  const response = await fetch("/api/stores");
  if (!response.ok) return [];
  const body: { data: StoreOption[] } = await response.json();
  return body.data;
}

async function fetchForecastPoints(productId: string, storeId: string): Promise<ForecastPoint[]> {
  const params = new URLSearchParams({ productId, storeId });
  const response = await fetch(`/api/ai/forecasts?${params.toString()}`);
  if (!response.ok) return [];
  const body: { data: ForecastPoint[] } = await response.json();
  return body.data;
}

export function ForecastsTab() {
  const t = useTranslations("aiForecasts");
  const queryClient = useQueryClient();

  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [storeId, setStoreId] = useState<string>("");
  const [jobBatchId, setJobBatchId] = useState<string | null>(null);

  const { data: stores = [] } = useQuery({ queryKey: ["ai", "stores"], queryFn: fetchStores });

  const { data: batchStatus } = useQuery<BatchStatus>({
    queryKey: ["ai", "forecast-batch", jobBatchId],
    queryFn: async () => {
      const response = await fetch(`/api/ai/forecasts/jobs/${jobBatchId}`);
      const body: { data: BatchStatus } = await response.json();
      return body.data;
    },
    enabled: !!jobBatchId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.completed + data.failed < data.total) return 2000;
      return false;
    },
  });

  const running = !!batchStatus && batchStatus.completed + batchStatus.failed < batchStatus.total;

  const { data: points = [], refetch: refetchPoints } = useQuery({
    queryKey: ["ai", "forecast-points", product?.id, storeId],
    queryFn: () => fetchForecastPoints(product!.id, storeId),
    enabled: !!product && !!storeId,
  });

  useEffect(() => {
    if (batchStatus && !running && jobBatchId) {
      queryClient.invalidateQueries({ queryKey: ["ai", "forecast-points"] });
      void refetchPoints();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  async function handleRunForecast() {
    if (!product || !storeId) {
      toast.error(t("selectBoth"));
      return;
    }
    const response = await fetch("/api/ai/forecasts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, storeId, horizonDays: 30 }),
    });
    if (!response.ok) {
      toast.error(t("runError"));
      return;
    }
    const body: { data: { jobBatchId: string; jobCount: number } } = await response.json();
    setJobBatchId(body.data.jobBatchId);
    toast.success(t("runStarted"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <ProductPicker onPick={setProduct} />
          {product && <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>}
        </div>

        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("selectStore")} />
          </SelectTrigger>
          <SelectContent>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleRunForecast} disabled={running}>
          {running ? t("running") : t("runForecast")}
        </Button>
      </div>

      {batchStatus && (
        <p className="text-sm text-muted-foreground">
          {t("batchStatus", {
            completed: batchStatus.completed,
            failed: batchStatus.failed,
            total: batchStatus.total,
          })}
        </p>
      )}

      {points.length > 0 && (
        <div className="h-80 rounded-md border border-border p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="forecastDate" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="predictedUpper"
                stroke="none"
                fill="var(--color-chart-1, #6366f1)"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="predictedLower"
                stroke="none"
                fill="var(--color-background, #fff)"
                fillOpacity={1}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="predictedQuantity"
                stroke="var(--color-chart-1, #6366f1)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {points.length === 0 && product && storeId && !running && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
