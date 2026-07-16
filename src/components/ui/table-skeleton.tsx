import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

export function TableRowsSkeleton({
  rows = 6,
  columns,
}: {
  rows?: number;
  columns: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <TableRow key={`skeleton-${row}`}>
          {Array.from({ length: columns }).map((__, col) => (
            <TableCell key={col}>
              <Skeleton className="h-4 w-full max-w-32" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
