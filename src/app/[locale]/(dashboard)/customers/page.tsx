import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { CustomersView } from "@/components/customers/customers-view";

export default async function CustomersPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("customers:read")) {
    return <ForbiddenState />;
  }

  return <CustomersView />;
}
