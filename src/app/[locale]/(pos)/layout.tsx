import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Deliberately outside (dashboard) — no sidebar. ARCHITECTURE.md §4.4's POS
// mockup is a dedicated full-screen terminal, not a dashboard content pane.
export default async function PosLayout({
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

  return <div className="min-h-screen bg-[var(--color-background)]">{children}</div>;
}
