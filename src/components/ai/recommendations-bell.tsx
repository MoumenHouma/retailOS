"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAiNotifications } from "@/hooks/use-ai-notifications";
import { useAiNotificationsStore } from "@/stores/ai-notifications";

interface RecommendationRow {
  id: string;
  title: string;
  priority: string;
  isRead: boolean;
}

async function fetchUnactioned(): Promise<RecommendationRow[]> {
  const response = await fetch("/api/ai/recommendations?isActioned=false&pageSize=10");
  if (!response.ok) return [];
  const body: { data: RecommendationRow[] } = await response.json();
  return body.data;
}

/**
 * Lives in the shared dashboard shell (not scoped to AI pages) — a
 * recommendation should be visible from anywhere in the app, same as any
 * real product's notification bell. Reads from ai_recommendations, the
 * same table Chunk B/C write to; the unread badge counter comes from
 * live Socket.io pushes (useAiNotificationsStore), the dropdown contents
 * come from a poll-on-open fetch.
 */
export function RecommendationsBell({ canView }: { canView: boolean }) {
  const t = useTranslations("recommendationsFeed");
  useAiNotifications();
  const queryClient = useQueryClient();
  const unreadCount = useAiNotificationsStore((s) => s.unreadCount);
  const markAllRead = useAiNotificationsStore((s) => s.markAllRead);

  const { data: recommendations = [] } = useQuery({
    queryKey: ["ai", "recommendations-bell"],
    queryFn: fetchUnactioned,
    enabled: canView,
    refetchInterval: 60000,
  });

  if (!canView) return null;

  async function handleAction(id: string) {
    await fetch(`/api/ai/recommendations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActioned: true }),
    });
    queryClient.invalidateQueries({ queryKey: ["ai", "recommendations-bell"] });
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("title")}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recommendations.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">{t("empty")}</div>
        )}
        {recommendations.map((rec) => (
          <DropdownMenuItem
            key={rec.id}
            className="flex flex-col items-start gap-1"
            onSelect={(e) => e.preventDefault()}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm">{rec.title}</span>
              <Badge variant={rec.priority === "urgent" ? "destructive" : "secondary"}>{rec.priority}</Badge>
            </div>
            <Button size="sm" variant="link" className="h-auto p-0" onClick={() => handleAction(rec.id)}>
              {t("markActioned")}
            </Button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
