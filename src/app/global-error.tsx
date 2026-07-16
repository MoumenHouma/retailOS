"use client";

import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
          <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Quelque chose s&apos;est mal passé. Vous pouvez réessayer ou recharger la page.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
