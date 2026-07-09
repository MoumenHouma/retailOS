"use client";

import { useTranslations } from "next-intl";
import { navGroups } from "@/config/nav";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 text-sm">
      {navGroups.map((group, index) => (
        <div key={group.labelKey ?? `group-${index}`} className="flex flex-col gap-1">
          {group.labelKey && (
            <span className="px-3 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(group.labelKey)}
            </span>
          )}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
