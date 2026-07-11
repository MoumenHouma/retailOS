# Phase 6 Chunk D: production image. Multi-stage build using Next's
# `output: "standalone"` (already configured in next.config.ts) — no bind
# mounts, no dev server, real env-file usage. Same base image as
# Dockerfile.dev for consistency, but nothing here watches the filesystem.
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
# --ignore-scripts: this stage doesn't have prisma/schema.prisma yet (only
# package.json/lockfile are copied, for layer caching), so package.json's
# `postinstall: prisma generate` would fail here — confirmed live. The
# builder stage below already runs `prisma generate` explicitly once the
# full source is present, so skipping postinstall here is a no-op, not a
# missing step.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
RUN pnpm exec next build --webpack
# This repo has no public/ directory (no static assets checked in yet) —
# confirmed live: the runtime stage's COPY --from=builder .../public fails
# outright if the source path doesn't exist at all. An empty directory
# copies cleanly and costs nothing; real assets can be added later without
# touching this Dockerfile.
RUN mkdir -p public

# Runtime image — only what's needed to run the standalone server.
FROM node:22-slim AS runner
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
