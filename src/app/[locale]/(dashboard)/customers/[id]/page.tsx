import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user.permissions.includes("customers:read")) {
    return <ForbiddenState />;
  }

  return <CustomerDetailView id={id} />;
}
