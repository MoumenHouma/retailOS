import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { ExpensesView } from "@/components/finance/expenses-view";

export default async function ExpensesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("finance:expense")) {
    return <ForbiddenState />;
  }

  return <ExpensesView />;
}
