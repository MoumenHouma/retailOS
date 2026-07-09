import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { StockCountDetailView } from "@/components/warehouses/stock-count-detail-view";

export default async function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user.permissions.includes("inventory:read")) {
    return <ForbiddenState />;
  }

  return <StockCountDetailView id={id} />;
}
