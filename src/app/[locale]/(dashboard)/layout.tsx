import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isDesktopEdition } from "@/lib/edition";
import { DesktopMenuBridge } from "@/components/layout/desktop-menu-bridge";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { RecommendationsBell } from "@/components/ai/recommendations-bell";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const edition = isDesktopEdition() ? "desktop" : "web";

  return (
    <div className="flex min-h-screen">
      {edition === "web" && (
        <aside className="flex w-60 shrink-0 flex-col border-e border-border bg-card p-4">
          <div className="mb-6 px-3 text-lg font-semibold text-foreground">RetailOS</div>
          <SidebarNav edition={edition} />
        </aside>
      )}
      <div className="flex-1">
        {/* Desktop edition drops the sidebar entirely in favor of a native
            Windows menu bar — this mounts the bridge that builds it and
            relays clicks back into the app's own router. Renders no DOM. */}
        {edition === "desktop" && <DesktopMenuBridge />}
        <header
          // Draggable so the app's own header row moves the window in the
          // desktop shell (stock OS titlebar sits above it unchanged) — inert
          // markup in the web build. Tauri only intercepts drag gestures on
          // the region itself, not its interactive children, but that needs
          // confirming on a real Windows build, not just code review.
          data-tauri-drag-region={edition === "desktop" ? "" : undefined}
          className="flex items-center justify-end gap-2 border-b border-border px-6 py-3"
        >
          {edition !== "desktop" && (
            <RecommendationsBell canView={session.user.permissions.includes("ai:view_recommendations")} />
          )}
          <LocaleSwitcher />
          <ThemeToggle />
          <UserMenu
            name={session.user.name ?? session.user.email ?? ""}
            email={session.user.email ?? ""}
            locale={locale}
          />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
