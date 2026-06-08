# ============================================================
# Stage 1: Build
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including dev deps for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ============================================================
# Stage 2: Production
# (Debian-based — Playwright's Chromium does NOT run on Alpine/musl)
# ============================================================
FROM node:22-bookworm-slim AS production

ENV NODE_ENV=production
# Install Playwright browsers to a shared path
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Copy only package manifests and install prod deps (includes playwright)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install Chromium + its system libraries for Playwright (token auto-refresh)
RUN npx playwright install --with-deps chromium

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Node 22 has native fetch — use it for the healthcheck (no wget needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main"]
