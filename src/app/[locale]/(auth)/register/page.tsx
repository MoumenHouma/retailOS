import { RegisterForm } from "@/components/layout/register-form";
import { isDesktopEdition } from "@/lib/edition";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <RegisterForm locale={locale} isDesktop={isDesktopEdition()} />
    </main>
  );
}
