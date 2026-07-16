"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { navGroups } from "@/config/nav";
import { useRouter } from "@/i18n/navigation";

/**
 * Renders nothing — mounted only in the desktop edition (see
 * (dashboard)/layout.tsx) in place of the web edition's <SidebarNav>.
 * Resolves navGroups (src/config/nav.ts, the same source sidebar-nav.tsx
 * reads) into a translated structure and hands it to Tauri's native window
 * menu, then relays menu clicks back into the app's own i18n-aware router so
 * navigation stays a client-side SPA transition rather than a full reload.
 *
 * Both Tauri calls are wrapped in .catch(() => {}) so exercising this code
 * path in an ordinary browser (e.g. RETAILOS_EDITION=desktop under `pnpm
 * dev`, with no real Tauri webview backing window.__TAURI_INTERNALS__)
 * degrades to a silent no-op instead of throwing.
 */
export function DesktopMenuBridge() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    const groups = navGroups
      .map((group) => ({
        label: group.labelKey ? t(group.labelKey) : null,
        items: group.items
          .filter((item) => !item.desktopHidden)
          .map((item) => ({ id: item.href, label: t(item.labelKey) })),
      }))
      .filter((group) => group.items.length > 0);

    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("set_app_menu", { groups }))
      .catch(() => {});
  }, [locale, t]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<string>("menu-navigate", (event) => {
          router.push(event.payload);
        }),
      )
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => unlisten?.();
  }, [router]);

  return null;
}
