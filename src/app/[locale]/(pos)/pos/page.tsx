import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { PosView } from "@/components/pos/pos-view";

export default async function PosPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("pos:operate")) {
    return <ForbiddenState />;
  }

  return <PosView />;
}
