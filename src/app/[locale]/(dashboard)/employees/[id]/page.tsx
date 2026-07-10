import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { EmployeeDetailView } from "@/components/employees/employee-detail-view";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user.permissions.includes("employees:read")) {
    return <ForbiddenState />;
  }

  return <EmployeeDetailView id={id} />;
}
