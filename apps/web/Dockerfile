# =============================================================================
# Stage 1: Install dependencies
# =============================================================================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

# Copy workspace config and lockfile first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Build
# =============================================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1

# Build shared package first
RUN pnpm --filter @axy/shared build

# Build Next.js app (produces .next/standalone thanks to output: 'standalone')
RUN pnpm --filter @axy/web build

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy standalone build output
# Next.js standalone output includes a minimal server and all required node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3457

ENV PORT=3457
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3457 || exit 1

CMD ["node", "apps/web/server.js"]
