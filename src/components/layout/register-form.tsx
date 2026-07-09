"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function RegisterForm({ locale }: { locale: string }) {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json();
      setError(body.error?.message ?? "Une erreur est survenue.");
      return;
    }

    router.push(`/${locale}/login`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {(
        [
          ["businessName", "text"],
          ["nif", "text"],
          ["nis", "text"],
          ["rc", "text"],
          ["ownerFirstName", "text"],
          ["ownerLastName", "text"],
          ["email", "email"],
          ["password", "password"],
        ] as const
      ).map(([field, type]) => (
        <div key={field} className="flex flex-col gap-1">
          <label htmlFor={field} className="text-sm font-medium">
            {t(field)}
          </label>
          <input
            id={field}
            name={field}
            type={type}
            required
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
      >
        {t("submit")}
      </button>
    </form>
  );
}
