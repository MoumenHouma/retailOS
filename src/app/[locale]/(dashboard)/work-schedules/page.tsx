import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { WorkSchedulesView } from "@/components/employees/work-schedules-view";

export default async function WorkSchedulesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("employees:schedule")) {
    return <ForbiddenState />;
  }

  return <WorkSchedulesView />;
}
