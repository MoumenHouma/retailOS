import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { InventoryView } from "@/components/inventory/inventory-view";

export default async function InventoryPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    return <ForbiddenState />;
  }

  return <InventoryView />;
}
