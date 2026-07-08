import { LoginForm } from "@/components/layout/login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <LoginForm locale={locale} />
    </main>
  );
}
