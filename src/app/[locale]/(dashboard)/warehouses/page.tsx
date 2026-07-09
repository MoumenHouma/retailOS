import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { WarehousesView } from "@/components/warehouses/warehouses-view";

export default async function WarehousesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    return <ForbiddenState />;
  }

  return <WarehousesView />;
}
