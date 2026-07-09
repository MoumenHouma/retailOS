import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { SalesHistoryView } from "@/components/sales/sales-history-view";

export default async function SalesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("pos:operate")) {
    return <ForbiddenState />;
  }

  return <SalesHistoryView />;
}
