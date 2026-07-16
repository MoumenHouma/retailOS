import { Skeleton } from "@/components/ui/skeleton";

export function DetailPageSkeleton({ statTiles = 4 }: { statTiles?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      {statTiles > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: statTiles }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      )}
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
