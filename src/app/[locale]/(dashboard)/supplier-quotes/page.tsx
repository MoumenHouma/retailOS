import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { SupplierQuotesView } from "@/components/purchasing/supplier-quotes-view";

export default async function SupplierQuotesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    return <ForbiddenState />;
  }

  return <SupplierQuotesView />;
}
