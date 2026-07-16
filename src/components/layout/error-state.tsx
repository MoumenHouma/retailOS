"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    logger.error("client_error_boundary", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h1 className="text-lg font-semibold">{t("errorTitle")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("errorDescription")}</p>
      <Button className="mt-2" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
