# ===========================================
# ATHENA NODE.JS SERVER - DOCKERFILE
# ===========================================
# Multi-stage build for production optimization

# =====================
# STAGE 1: BASE
# =====================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    ffmpeg \
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
FROM base AS production

ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user
RUN addgroup -g 1001 -S athena && \
    adduser -S athena -u 1001 -G athena

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create necessary directories
RUN mkdir -p uploads logs && \
    chown -R athena:athena /app

USER athena

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start server
CMD ["node", "dist/index.js"]

# =====================
# STAGE 5: DEVELOPMENT
# =====================
FROM deps AS development

ENV NODE_ENV=development
ENV PORT=3001

# Install additional dev tools
RUN npm install -g nodemon ts-node

# Copy source code
COPY . .

EXPOSE 3001

# Use nodemon for hot reload
CMD ["npm", "run", "dev"]
