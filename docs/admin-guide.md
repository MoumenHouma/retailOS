# RetailOS — Guide administrateur

Déploiement, sauvegardes, variables d'environnement, et dépannage pour une installation en production. Cible : un déploiement mono-VM via docker-compose (voir `ARCHITECTURE.md` — « faible complexité DevOps » est un choix délibéré pour le marché algérien, pas un raccourci).

## Déploiement

Prérequis sur la VM cible : Docker + Docker Compose, un fichier `.env` complet (voir la section variables d'environnement ci-dessous), et un checkout git du dépôt.

```bash
./scripts/deploy.sh
```

Ce script : récupère le dernier code (`git pull`), construit les images (`docker-compose.prod.yml`), applique les migrations (`prisma migrate deploy` — jamais `migrate dev` en production), démarre les services, puis vérifie que `/api/health/ready` répond avant de considérer le déploiement réussi.

`docker-compose.prod.yml` diffère de `docker-compose.yml` (dev) sur trois points : pas de montage de volumes source (le code est figé au build), l'image `app` utilise le `Dockerfile` de production (build Next.js standalone, pas `next dev`), et les mots de passe/secrets sont exigés explicitement (le déploiement échoue si `POSTGRES_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` ou `INTERNAL_TOKEN` sont absents).

Il n'y a pas de pipeline Kubernetes/Terraform/CI-déploiement — un choix délibéré, pas un oubris, cohérent avec le reste de l'architecture.

## Sauvegarde et restauration

```bash
./scripts/backup.sh    # dump Postgres compressé + miroir MinIO dans ./backups
./scripts/restore.sh ./backups/db-20260710-030000.sql.gz
```

Planifiez une sauvegarde quotidienne via crontab (voir le commentaire en tête de `backup.sh` pour la ligne exacte). `restore.sh` demande une confirmation explicite avant d'écraser la base courante.

## Variables d'environnement

En plus des variables déjà documentées dans `.env.example` (base de données, Redis, MinIO, moteur IA, temps réel), Phase 6 ajoute :

| Variable | Rôle | Défaut dev |
|---|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Envoi des rapports programmés par e-mail | Vide — les envois sont journalisés, pas envoyés |
| `SENTRY_DSN` | Suivi des erreurs (`@sentry/nextjs`) | Vide — le SDK ne fait rien tant que ce n'est pas renseigné |
| `APP_URL` | Origine autorisée pour le CORS du serveur temps réel | `http://localhost:3000` |

`SENTRY_DSN` peut pointer vers Sentry SaaS, une instance Sentry auto-hébergée, ou [GlitchTip](https://glitchtip.com/) (alternative open source compatible avec l'API Sentry) — pertinent vu le contexte à budget contraint de ce marché.

## Surveillance (« monitoring »)

Pas de nouvelle pile d'observabilité (pas de Prometheus/Grafana) pour cette phase — hors budget pour une cible mono-VM. La surveillance repose sur :

- `docker compose -f docker-compose.prod.yml ps` — état de santé de chaque service (chacun a son propre `healthcheck`).
- `docker compose -f docker-compose.prod.yml logs -f <service>` — logs en direct ; les lignes structurées JSON de `src/lib/logger.ts` sont grep-ables.
- `GET /api/health/ready` — sonde de disponibilité réelle (touche la base de données), à distinguer de `GET /api/health` qui reste volontairement sans base de données (utilisé par le heartbeat de synchronisation hors-ligne du POS).
- Sentry (si `SENTRY_DSN` est configuré) — alerte en temps réel sur les erreurs serveur.

## Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| `docker compose ps` montre un service `unhealthy` | Le service n'a pas encore démarré, ou une dépendance (Postgres/Redis) n'est pas prête | Attendre `start_period`, puis lire `docker compose logs <service>` |
| Migration bloquée / erreur RLS | Une politique `ENABLE ROW LEVEL SECURITY` manque sur une nouvelle table | Vérifier la section « Migration/RLS notes » du plan de phase concerné |
| `429 Too Many Requests` inattendu | Limite de débit (Phase 6 Chunk B, `src/middleware.ts`) déclenchée par un usage légitime intensif | Ajuster `AUTH_LIMIT`/`DEFAULT_LIMIT` dans `src/middleware.ts` si nécessaire |
| Rapport programmé jamais reçu par e-mail | `SMTP_HOST` non configuré (comportement de dev par défaut) | Vérifier les logs (`email.log_fallback`) ; configurer `SMTP_*` pour un envoi réel |
| Erreur `RLS` / données d'un autre tenant visibles | Requête directe `psql` sans filtre `tenant_id`/`deleted_at`, ou usage de `prismaSuperuser` hors des 3 sites légitimes (`auth.ts`, `register/route.ts`, `prisma/seed.ts`) | Auditer l'usage de `prismaSuperuser` avant toute autre hypothèse |

Pour la documentation utilisateur final, voir [`user-guide.md`](./user-guide.md).
