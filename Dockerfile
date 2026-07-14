# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Alfayo Nelson Central Command — @an/web production image
#
# pnpm + turbo monorepo, Next.js 14 web app at apps/web.
# Debian slim (NOT alpine) so @node-rs/argon2 loads its prebuilt glibc binary.
# Railpack/Nixpacks auto-detection is unreliable for this workspace layout, so
# the build is pinned explicitly here. Point Dokploy's Build Type at this file.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Corepack pins the exact pnpm version from root package.json (packageManager).
RUN corepack enable
WORKDIR /app

# ── deps: install the full workspace with a frozen lockfile ───────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json turbo.json ./
RUN pnpm install --frozen-lockfile

# ── build: compile @an/web (transpilePackages pulls in workspace source) ──────
FROM base AS build
COPY --from=deps /app ./
# Copy any remaining root config the build may reference.
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @an/web build

# ── runner: run `next start` from the built workspace ─────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@an/web", "start"]
