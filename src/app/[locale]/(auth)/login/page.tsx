import { redirect } from "next/navigation";
import { LoginForm } from "@/components/layout/login-form";
import { prismaSuperuser } from "@/lib/prisma";

// Forces this route out of the static-prerender pass — without it, `next
// build` tries to run tenant.count() at build time with no DB reachable
// (confirmed live: "Can't reach database server at `postgres:5432`").
export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // First-run desktop install: no tenant provisioned yet, so send the
  // owner to registration instead of an empty login form. No-op for an
  // already-provisioned hosted-web-app tenant.
  const tenantCount = await prismaSuperuser.tenant.count();
  if (tenantCount === 0) {
    redirect(`/${locale}/register`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <LoginForm locale={locale} />
    </main>
  );
}
