import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { AttendanceView } from "@/components/employees/attendance-view";

export default async function AttendancePage() {
  const session = await auth();

  if (!session?.user.permissions.includes("employees:schedule")) {
    return <ForbiddenState />;
  }

  return <AttendanceView />;
}
