# =============================================================================
# Stage 1: Install dependencies
# =============================================================================
FROM node:22-alpine AS deps

# node-pty and better-sqlite3 require native compilation
RUN apk add --no-cache python3 make g++ git

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

# Copy workspace config and lockfile first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Build
# =============================================================================
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Build shared package first (produces dist/ with declarations)
RUN pnpm --filter @axy/shared build

# Build server (tsc -> dist/)
RUN pnpm --filter @axy/server build

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM node:22-alpine AS runner

# git is needed by simple-git, bash/curl for Claude CLI installer
# docker-cli for self-update (static binary, compatible with Alpine/musl)
RUN apk add --no-cache git bash curl docker-cli docker-cli-compose

# Install Claude CLI (requires npm which comes with node)
RUN npm install -g @anthropic-ai/claude-code || true

WORKDIR /app

# Copy workspace config (needed for pnpm workspace resolution)
COPY package.json pnpm-workspace.yaml VERSION ./

# Copy shared package (source + built output, needed for imports)
COPY --from=builder /app/packages/shared ./packages/shared

# Copy server built output
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

# Copy production node_modules
# Root node_modules contains hoisted deps
COPY --from=deps /app/node_modules ./node_modules
# Server-specific node_modules (native modules like node-pty, better-sqlite3)
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# Create data directory for projects
RUN mkdir -p /data/projects

WORKDIR /app/apps/server

ENV NODE_ENV=production

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3456/api/health || exit 1

CMD ["node", "dist/index.js"]
