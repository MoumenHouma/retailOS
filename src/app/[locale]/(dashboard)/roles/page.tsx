import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { RolesView } from "@/components/employees/roles-view";

export default async function RolesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("employees:roles")) {
    return <ForbiddenState />;
  }

  return <RolesView />;
}
