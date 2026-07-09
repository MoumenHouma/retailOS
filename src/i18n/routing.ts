import { defineRouting } from "next-intl/routing";

export const APP_TIME_ZONE = "Africa/Algiers";

export const routing = defineRouting({
  locales: ["fr", "ar", "en"],
  defaultLocale: "fr",
});
