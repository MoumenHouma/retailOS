import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { SupplierCatalogView } from "@/components/purchasing/supplier-catalog-view";

export default async function SupplierCatalogPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    return <ForbiddenState />;
  }

  return <SupplierCatalogView />;
}
