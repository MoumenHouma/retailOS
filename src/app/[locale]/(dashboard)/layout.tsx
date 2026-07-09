import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-e border-[var(--color-border)] bg-[var(--color-muted)] p-4">
        <div className="mb-6 text-lg font-semibold">RetailOS</div>
        <nav className="flex flex-col gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Link href={`/${locale}/products`} className="hover:text-[var(--color-foreground)]">
            Produits
          </Link>
          <Link href={`/${locale}/inventory`} className="hover:text-[var(--color-foreground)]">
            Inventaire
          </Link>
          <Link href={`/${locale}/suppliers`} className="hover:text-[var(--color-foreground)]">
            Fournisseurs
          </Link>
          <Link href={`/${locale}/pos`} className="hover:text-[var(--color-foreground)]">
            Point de vente
          </Link>
          <Link href={`/${locale}/sales`} className="hover:text-[var(--color-foreground)]">
            Ventes
          </Link>
          <Link href={`/${locale}/purchase-orders`} className="hover:text-[var(--color-foreground)]">
            Achats
          </Link>
          <Link href={`/${locale}/supplier-quotes`} className="hover:text-[var(--color-foreground)]">
            Devis fournisseurs
          </Link>
          <Link href={`/${locale}/invoices`} className="hover:text-[var(--color-foreground)]">
            Finances
          </Link>
          <span>Rapports</span>
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {session.user.email}
          </span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
