import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { ProductsView } from "@/components/products/products-view";

export default async function ProductsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("products:read")) {
    return <ForbiddenState />;
  }

  return <ProductsView />;
}
