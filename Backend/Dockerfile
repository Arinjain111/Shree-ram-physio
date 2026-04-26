# Multi-stage Dockerfile for Backend (Prisma v7)
# ─────────────────────────────────────────────
# Stage 1: Builder — install all deps, generate Prisma client, compile TS
# Stage 2: Production — only production deps + compiled output
# ─────────────────────────────────────────────

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifest files first (layer cache for npm ci)
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/
COPY tsconfig.json ./

# Install ALL dependencies (dev included — needed for tsc, ts-node, prisma CLI)
RUN npm ci

# Copy source AFTER install to maximise cache reuse
COPY src ./src/

# Generate Prisma Client → outputs to src/generated/prisma
# Dummy DB URLs are fine here; the real URL is supplied at runtime.
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Compile TypeScript: src/ → dist/
# (skip the prisma generate step inside npm run build — already done above)
RUN npx tsc && node -e "require('fs').cpSync('src/generated', 'dist/generated', {recursive:true})"


# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy manifest + Prisma config (needed by CLI at runtime for db push)
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Install production deps only.
# prisma, pg, @prisma/adapter-pg, @prisma/client are all in dependencies
# so they ARE installed by --omit=dev.
RUN npm ci --omit=dev

# Copy compiled application (includes dist/generated/prisma from builder stage)
COPY --from=builder /app/dist ./dist

# Expose API port
EXPOSE 3000

# Health check — waits for the /health endpoint to respond 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start command (db push is handled by docker-compose command override)
CMD ["node", "dist/server.js"]
