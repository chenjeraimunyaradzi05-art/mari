# ===========================================
# ATHENA NODE.JS SERVER - DOCKERFILE
# ===========================================
# Multi-stage build for production optimization

# =====================
# STAGE 1: BASE
# =====================
FROM node:20-alpine AS base

# Install system dependencies needed by sharp and other native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# =====================
# STAGE 2: DEPENDENCIES
# =====================
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# =====================
# STAGE 3: BUILDER
# =====================
FROM deps AS builder

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# =====================
# STAGE 4: PRODUCTION
# =====================
FROM node:20-alpine AS production

ENV NODE_ENV=production
ENV PORT=5000
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Install runtime system deps
# libstdc++ and libgcc are needed by native modules (sharp, bcrypt, etc.)
# that were compiled in the deps stage against these shared libraries.
RUN apk add --no-cache curl libstdc++ libgcc && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S athena && \
    adduser -S athena -u 1001 -G athena

# Copy production node_modules (prune dev deps)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create necessary directories
RUN mkdir -p uploads logs && \
    chown -R athena:athena /app

USER athena

EXPOSE 5000

# Railway provides its own healthcheck via railway.json (healthcheckPath: /health)
# Do NOT add a Docker HEALTHCHECK — it conflicts with Railway's dynamic PORT.

# Start via crash-safe wrapper (migrations run inside start.js)
CMD ["node", "dist/start.js"]
