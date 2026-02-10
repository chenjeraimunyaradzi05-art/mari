# ===========================================
# ATHENA NEXT.JS CLIENT - DOCKERFILE
# ===========================================
# Multi-stage build for production optimization

# =====================
# STAGE 1: BASE
# =====================
FROM node:20-alpine AS base

RUN apk add --no-cache curl && rm -rf /var/cache/apk/*

WORKDIR /app

# =====================
# STAGE 2: DEPENDENCIES
# =====================
FROM base AS deps

COPY package*.json ./
RUN npm ci

# =====================
# STAGE 3: BUILDER
# =====================
FROM deps AS builder

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# =====================
# STAGE 4: PRODUCTION
# =====================
FROM node:20-alpine AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN apk add --no-cache curl && rm -rf /var/cache/apk/*

WORKDIR /app

RUN addgroup -g 1001 -S athena && \
    adduser -S athena -u 1001 -G athena

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R athena:athena /app

USER athena

EXPOSE 3000

CMD ["node", "server.js"]
