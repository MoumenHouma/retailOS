# RetailOS

Système de gestion commerciale multi-tenant (POS, inventaire, achats, facturation conforme DÉCRET 05-468) pour le marché algérien — Next.js 16, Prisma/PostgreSQL avec isolation multi-tenant par RLS, NextAuth, i18n fr/en/ar.

## Démarrage rapide

```bash
docker compose up -d
npx prisma migrate deploy   # ou via le conteneur : docker compose exec app npx prisma migrate deploy
npx prisma db seed          # ou via le conteneur : docker compose exec app npx prisma db seed
```

L'application est accessible sur `http://localhost:3000`. Comptes de démonstration : `admin@tenant-a.demo` / `Demo1234!` (et `tenant-b`).

## Documentation

- [`docs/user-guide.md`](docs/user-guide.md) — parcours complet : créer un compte, ajouter un magasin, des produits, réaliser une vente, consulter les rapports.
- [`docs/admin-guide.md`](docs/admin-guide.md) — déploiement en production, sauvegardes, variables d'environnement, dépannage.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture système et choix techniques.
- [`DATABASE.md`](DATABASE.md) — conception du schéma.
- [`ROADMAP.md`](ROADMAP.md) — plan de développement par phases.
- [`Dev Log.md`](Dev%20Log.md) — journal des sessions de développement (source de vérité sur l'état d'avancement).

## Stack

Next.js 16 (App Router) · Prisma 6 / PostgreSQL 16 · NextAuth v5 · BullMQ / Redis · Python FastAPI (prévisions Prophet) · Socket.io (temps réel) · MinIO (stockage objet) · Tailwind CSS 4 / shadcn/ui.

## Licence

Propriétaire — usage interne.
