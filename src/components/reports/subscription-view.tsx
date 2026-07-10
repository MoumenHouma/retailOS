"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SubscriptionInfo {
  name: string;
  subscriptionPlan: string;
  subscriptionStatus: "trial" | "active" | "suspended" | "cancelled";
  subscriptionEndsAt: string | null;
}

const STATUS_VARIANT: Record<SubscriptionInfo["subscriptionStatus"], "default" | "warning" | "destructive"> = {
  trial: "warning",
  active: "default",
  suspended: "destructive",
  cancelled: "destructive",
};

export function SubscriptionView() {
  const t = useTranslations("subscription");

  const query = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/subscription");
      if (!res.ok) throw new Error("Failed to fetch");
      return (await res.json()) as { data: SubscriptionInfo };
    },
  });

  const info = query.data?.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />

      <Card className="max-w-md">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("plan")}</span>
            <span className="font-semibold capitalize">{info?.subscriptionPlan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("status")}</span>
            {info && (
              <Badge variant={STATUS_VARIANT[info.subscriptionStatus]}>
                {t(`statuses.${info.subscriptionStatus}`)}
              </Badge>
            )}
          </div>
          {info?.subscriptionEndsAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("endsAt")}</span>
              <span>{new Date(info.subscriptionEndsAt).toLocaleDateString()}</span>
            </div>
          )}
          <Button variant="outline" asChild>
            <a href="mailto:support@retailos.local?subject=Demande%20de%20changement%20d%27abonnement">
              {t("requestChange")}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
