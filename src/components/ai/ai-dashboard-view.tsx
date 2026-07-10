"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertTriangle, Gauge, Lightbulb, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ScenarioSimulator } from "@/components/ai/scenario-simulator";

interface DashboardSummary {
  pendingRecommendations: number;
  forecastAccuracyAvg: string | null;
  topSuppliers: { id: string; name: string; rating: string | null }[];
  expiringBatchCount: number;
}

async function fetchSummary(): Promise<DashboardSummary | null> {
  const response = await fetch("/api/ai/dashboard-summary");
  if (!response.ok) return null;
  const body: { data: DashboardSummary } = await response.json();
  return body.data;
}

export function AiDashboardView() {
  const t = useTranslations("aiDashboard");

  const { data: summary } = useQuery({ queryKey: ["ai", "dashboard-summary"], queryFn: fetchSummary });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("tiles.pendingRecommendations")}
          value={summary?.pendingRecommendations ?? "—"}
          icon={Lightbulb}
          tone={summary && summary.pendingRecommendations > 0 ? "warning" : "default"}
        />
        <StatTile
          label={t("tiles.forecastAccuracy")}
          value={summary?.forecastAccuracyAvg ? `${Number(summary.forecastAccuracyAvg).toFixed(1)}%` : "—"}
          icon={Gauge}
        />
        <StatTile
          label={t("tiles.expiringBatches")}
          value={summary?.expiringBatchCount ?? "—"}
          icon={AlertTriangle}
          tone={summary && summary.expiringBatchCount > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("tiles.topSupplierRating")}
          value={summary?.topSuppliers[0]?.rating ?? "—"}
          icon={Star}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/ai-forecasts">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardContent className="p-4">
              <h3 className="font-medium">{t("links.forecasts")}</h3>
              <p className="text-sm text-muted-foreground">{t("links.forecastsDescription")}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/supplier-ranking">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardContent className="p-4">
              <h3 className="font-medium">{t("links.supplierRanking")}</h3>
              <p className="text-sm text-muted-foreground">{t("links.supplierRankingDescription")}</p>
            </CardContent>
          </Card>
        </Link>
        <Card className="h-full">
          <CardContent className="p-4">
            <h3 className="font-medium">{t("links.topSuppliers")}</h3>
            <ul className="mt-1 text-sm text-muted-foreground">
              {summary?.topSuppliers.map((s) => (
                <li key={s.id}>
                  {s.name} — {s.rating}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <ScenarioSimulator />
    </div>
  );
}
