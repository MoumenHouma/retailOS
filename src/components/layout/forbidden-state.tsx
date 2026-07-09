import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function ForbiddenState() {
  const t = await getTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
      <ShieldAlert className="h-8 w-8" />
      <p>{t("forbidden")}</p>
    </div>
  );
}
