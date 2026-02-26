# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ---- deps stage ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ---- builder stage ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args become env vars at build time for Next.js public vars
ARG NEXT_PUBLIC_POLL_INTERVAL_MS=15000
ARG NEXT_PUBLIC_OFFLINE_THRESHOLD_S=300
ENV NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS
ENV NEXT_PUBLIC_OFFLINE_THRESHOLD_S=$NEXT_PUBLIC_OFFLINE_THRESHOLD_S

RUN pnpm build

# ---- runner stage ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
