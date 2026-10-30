# Multi-stage production Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root and workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/apps/admin/package.json ./frontend/apps/admin/

# Install all dependencies including dev dependencies needed for Vite build
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build the Admin SPA into public/admin
RUN pnpm run build:admin

# Prune dev dependencies for production runtime
RUN pnpm prune --prod

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy runtime files from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public

# Create logs directory
RUN mkdir -p logs && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "src/index.js"]
