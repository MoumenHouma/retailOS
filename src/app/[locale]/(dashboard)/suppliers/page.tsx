import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { SuppliersView } from "@/components/suppliers/suppliers-view";

export default async function SuppliersPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("suppliers:read")) {
    return <ForbiddenState />;
  }

  return <SuppliersView />;
}
