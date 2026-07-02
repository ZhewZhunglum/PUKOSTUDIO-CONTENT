FROM node:22-alpine AS base
# Pin pnpm to 9.x — pnpm 10/11 require Node.js 22+ build-script approval
# that conflicts with our lockfile. pnpm 9 is LTS and works cleanly.
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
# --no-frozen-lockfile: pnpm 11 requires explicit build-script approval in the
# lockfile; allow regeneration so onlyBuiltDependencies in package.json is applied.
RUN pnpm install --no-frozen-lockfile

# ── Development target (default for docker-compose.yml) ──────────────────────
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
EXPOSE 3847
CMD ["pnpm", "dev"]

# ── Production build ──────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time env vars (embedded into client bundle)
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_STORAGE_DOMAIN=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STORAGE_DOMAIN=$NEXT_PUBLIC_STORAGE_DOMAIN
RUN pnpm build

# ── Production runner ─────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.js ./
EXPOSE 3847
CMD ["node_modules/.bin/next", "start", "-p", "3847"]
