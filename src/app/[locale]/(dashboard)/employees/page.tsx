import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { EmployeesView } from "@/components/employees/employees-view";

export default async function EmployeesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("employees:read")) {
    return <ForbiddenState />;
  }

  return <EmployeesView />;
}
