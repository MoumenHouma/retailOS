"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForecastsTab } from "@/components/ai/forecasts-tab";
import { InventoryOptimizationTab } from "@/components/ai/inventory-optimization-tab";
import { WastePreventionTab } from "@/components/ai/waste-prevention-tab";

// Note: useAiNotifications() is mounted once, globally, by
// RecommendationsBell in the dashboard shell layout — not called again here,
// to avoid opening a second concurrent Socket.io connection.
export function ForecastView() {
  const t = useTranslations("aiForecasts");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs defaultValue="forecasts">
        <TabsList>
          <TabsTrigger value="forecasts">{t("tabs.forecasts")}</TabsTrigger>
          <TabsTrigger value="inventoryOptimization">{t("tabs.inventoryOptimization")}</TabsTrigger>
          <TabsTrigger value="wastePrevention">{t("tabs.wastePrevention")}</TabsTrigger>
        </TabsList>
        <TabsContent value="forecasts">
          <ForecastsTab />
        </TabsContent>
        <TabsContent value="inventoryOptimization">
          <InventoryOptimizationTab />
        </TabsContent>
        <TabsContent value="wastePrevention">
          <WastePreventionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
