import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <FileQuestion className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("notFoundDescription")}</p>
    </div>
  );
}
