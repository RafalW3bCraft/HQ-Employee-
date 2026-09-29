# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — compile TypeScript to JavaScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY backend/package*.json ./

# Install ALL dependencies (including devDeps for TypeScript compile)
RUN npm ci

# Copy source
COPY backend/ ./

# Compile TypeScript
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production runner
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only (no devDeps, no TypeScript, no tsx)
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Copy public assets served by the backend (voice-tester.html)
COPY backend/public ./public

# ── Ownership ────────────────────────────────────────────────────────────────
RUN chown -R appuser:appgroup /app

USER appuser

# ── Port ─────────────────────────────────────────────────────────────────────
# Cloud Run injects PORT at runtime. Do NOT hardcode 3000 here.
# The application binds to 0.0.0.0:$PORT via src/index.ts -> config.PORT.
EXPOSE 3000

# ── Health check ─────────────────────────────────────────────────────────────
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health/live || exit 1

# ── Entrypoint ───────────────────────────────────────────────────────────────
# Use exec form to ensure PID 1 receives SIGTERM from Cloud Run for graceful shutdown.
# Node's default signal handling will allow in-flight requests to complete.
CMD ["node", "dist/index.js"]
