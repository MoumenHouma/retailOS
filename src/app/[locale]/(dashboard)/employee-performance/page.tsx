import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { EmployeePerformanceView } from "@/components/employees/employee-performance-view";

export default async function EmployeePerformancePage() {
  const session = await auth();

  if (!session?.user.permissions.includes("reports:view")) {
    return <ForbiddenState />;
  }

  return <EmployeePerformanceView />;
}
