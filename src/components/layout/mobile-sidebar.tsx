"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function MobileSidebar({ edition }: { edition: "web" | "desktop" }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label={t("openMenu")}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <SheetContent side="left" className="w-72 overflow-y-auto p-4">
        <SheetTitle className="mb-4 px-3 text-lg font-semibold">{t("appName")}</SheetTitle>
        <div onClick={() => setOpen(false)}>
          <SidebarNav edition={edition} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
