import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "destructive";
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            tone === "warning" && "bg-warning/15 text-warning",
            tone === "destructive" && "bg-destructive/15 text-destructive",
            tone === "default" && "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex flex-col gap-1">
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums leading-tight">{value}</span>
          )}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
