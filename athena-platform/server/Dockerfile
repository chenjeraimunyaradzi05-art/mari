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
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/athena_dev
ENV DIRECT_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/athena_dev
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

# The full node_modules from the deps stage, dev dependencies included, and it
# has to stay that way. An earlier comment here claimed this was a pruned
# production tree, which was never true and was an invitation to "fix" it with
# `npm ci --omit=dev`: `prisma` is a devDependency, and `dist/start.js` shells
# out to `npx prisma migrate deploy` before it boots the server. Prune the dev
# tree and every deploy fails at the migration step, on the host, at the moment
# it is least convenient.
#
# It also carries the ffmpeg binary that the ffmpeg-static package downloads at
# install time. That binary is what video-pipeline.service.ts spawns to make a
# poster frame and an H.264 rendition of every reel, so without it reels publish
# as uploaded with the reason recorded in processingError.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# `uploads` is a scratch directory, not storage. utils/media-storage.ts writes a
# member's avatars, post images, reels and resumes here only when
# AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not both set; with them, every
# file goes to S3 and nothing durable is ever written below. No volume is
# mounted on it on purpose — Render and Fly replace this container on every
# deploy, and a second instance cannot read the first one's disk, so anything
# that lands here is already lost. Mounting a volume would hide that rather than
# fix it. The AWS credentials are required in production and
# /health/launch-readiness fails without them; see DEPLOYMENT_GUIDE.md.
#
# The pipeline also needs somewhere to write while it works: video-pipeline
# builds each rendition under the OS temp directory and deletes it afterwards,
# which is what this directory being scratch means in practice.
RUN mkdir -p uploads logs && \
    chown -R athena:athena /app

USER athena

EXPOSE 5000

# Health checks are defined by the deployment platform. Keep this image portable.

# Start via crash-safe wrapper (migrations run inside start.js)
CMD ["node", "dist/start.js"]
