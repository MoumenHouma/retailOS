import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, APP_TIME_ZONE } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import { cairo, lexend, sourceSans3 } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "RetailOS",
  description: "The Retail Operating System for Algeria",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className={`antialiased ${lexend.variable} ${sourceSans3.variable} ${cairo.variable}`}>
        <Providers messages={messages} locale={locale} timeZone={APP_TIME_ZONE}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
