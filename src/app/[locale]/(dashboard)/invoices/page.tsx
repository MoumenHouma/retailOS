import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { InvoicesView } from "@/components/invoices/invoices-view";

export default async function InvoicesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("finance:read")) {
    return <ForbiddenState />;
  }

  return <InvoicesView />;
}
