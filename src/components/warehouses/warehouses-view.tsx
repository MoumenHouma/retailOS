"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WarehousesTab } from "@/components/warehouses/warehouses-tab";
import { ZonesTab } from "@/components/warehouses/zones-tab";
import { BinsTab } from "@/components/warehouses/bins-tab";

export function WarehousesView() {
  const t = useTranslations("warehouses");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} />

      <Tabs defaultValue="warehouses">
        <TabsList>
          <TabsTrigger value="warehouses">{t("tabs.warehouses")}</TabsTrigger>
          <TabsTrigger value="zones">{t("tabs.zones")}</TabsTrigger>
          <TabsTrigger value="bins">{t("tabs.bins")}</TabsTrigger>
        </TabsList>
        <TabsContent value="warehouses">
          <WarehousesTab />
        </TabsContent>
        <TabsContent value="zones">
          <ZonesTab />
        </TabsContent>
        <TabsContent value="bins">
          <BinsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
