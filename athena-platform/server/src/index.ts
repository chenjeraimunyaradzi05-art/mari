import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

// We will load secrets (AWS Secrets Manager) at startup and then validate env
import { validateEnvironmentOrExit } from './utils/env';
import { loadSecretsIfConfigured } from './utils/secrets';

// Initialize Sentry import (initialization will run after secrets loaded)
import { initSentry, Sentry } from './utils/sentry';

import { prisma, connectWithRetry } from './utils/prisma';
import { sessionService } from './services/session.service';
import cookieParser from 'cookie-parser';
import { securityHeaders } from './middleware/securityHeaders';
import { trustedProxyIdentity } from './middleware/trustedProxy';
import { SharedRateLimitStore } from './utils/rate-limit-store';
import { secretMatches } from './utils/secret-compare';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import jobRoutes from './routes/job.routes';
import postRoutes from './routes/post.routes';
import postSocialRoutes from './routes/post-social.routes';
import postRepostRoutes from './routes/post-repost.routes';
import followRequestRoutes from './routes/follow-request.routes';
import closeFriendRoutes from './routes/close-friends.routes';
import postInsightsRoutes from './routes/post-insights.routes';
import storyHighlightRoutes from './routes/story-highlights.routes';
import { startScheduledPostPublisher } from './services/scheduled-posts.service';
import organizationRoutes from './routes/organization.routes';
import courseRoutes from './routes/course.routes';
import mentorRoutes from './routes/mentor.routes';
import subscriptionRoutes from './routes/subscription.routes';
import aiRoutes from './routes/ai.routes';
import mediaRoutes from './routes/media.routes';
import notificationRoutes from './routes/notification.routes';
import messageRoutes from './routes/message.routes';
import adminRoutes from './routes/admin.routes';
import adminSeedRoutes from './routes/admin-seed.routes';
import adminOperationsRoutes from './routes/admin-operations.routes';
import adminConfigRoutes from './routes/admin-config.routes';
import adminImpactRoutes from './routes/admin-impact.routes';
import adminCatalogueRoutes from './routes/admin-catalogue.routes';
import adminGrantsRoutes from './routes/admin-grants.routes';
import adminFormationRoutes from './routes/admin-formation.routes';
import adminMarketingRoutes from './routes/admin-marketing.routes';
import marketingRoutes from './routes/marketing.routes';
import blogRoutes from './routes/blog.routes';
import adminBlogRoutes from './routes/admin-blog.routes';
import feedbackRoutes from './routes/feedback.routes';
import adminFeedbackRoutes from './routes/admin-feedback.routes';
import bankingRoutes from './routes/banking.routes';
import referralRoutes from './routes/referral.routes';
import employerRoutes from './routes/employer.routes';
import educationRoutes from './routes/education.routes';
import creatorRoutes from './routes/creator.routes';
import analyticsRoutes from './routes/analytics.routes';
import searchRoutes from './routes/search.routes';
import engagementRoutes from './routes/engagement.routes';
import formationRoutes from './routes/formation.routes';
import eventRoutes from './routes/event.routes';
import groupRoutes from './routes/group.routes';
import statusRoutes from './routes/status.routes';
import webhookRoutes from './routes/webhook.routes';
import algorithmRoutes from './routes/algorithm.routes';
import verificationRoutes from './routes/verification.routes';
import appealRoutes from './routes/appeal.routes';
import trustRoutes from './routes/trust.routes';
import regionRoutes from './routes/region.routes';
import videoRoutes from './routes/video.routes';
import soundRoutes from './routes/sound.routes';
import topicRoutes from './routes/topic.routes';
import livestreamRoutes from './routes/livestream.routes';
import channelRoutes from './routes/channel.routes';
import { startMessageExpirySweeper } from './services/message-expiry.service';
import { startGrantReminderSweeper } from './services/strategy/grant-reminders.service';
import { startWealthNudgeSweeper } from './services/strategy/wealth-nudges.service';
import apprenticeshipRoutes from './routes/apprenticeship.routes';
import skillsMarketplaceRoutes from './routes/skills-marketplace.routes';
import safetyRoutes from './routes/safety.routes';
import conciergeRoutes from './routes/concierge.routes';
import salaryRoutes from './routes/salary.routes';
import paymentsRoutes from './routes/payments.routes';
import dvSafeRoutes from './routes/dv-safe.routes';
import accountingRoutes from './routes/accounting.routes';
import taxRoutes from './routes/tax.routes';
import inventoryRoutes from './routes/inventory.routes';
import moneyRoutes from './routes/money.routes';
import businessRoutes from './routes/business.routes';
import housingRoutes from './routes/housing.routes';
import financeRoutes from './routes/finance.routes';
import impactRoutes from './routes/impact.routes';
import communitySupportRoutes from './routes/community-support.routes';
import aiAlgorithmsRoutes from './routes/ai-algorithms.routes';
import healthRoutes from './routes/health.routes';
import featureFlagsRoutes from './routes/feature-flags.routes';
import connectRoutes from './routes/connect.routes';
import invoiceRoutes from './routes/invoice.routes';
import referenceRoutes from './routes/reference.routes';
import feedRoutes from './routes/feed.routes';
import groupChatRoutes from './routes/group-chat.routes';
import gdprRoutes from './routes/gdpr.routes';
import strategyRoutes from './routes/strategy.routes';
import wellnessRoutes from './routes/wellness.routes';
import automotiveRoutes from './routes/automotive.routes';
import { startAutomotiveSweeper } from './services/automotive/automotive-reminders.service';
import { startEscrowExpirySweeper } from './services/escrow-expiry.service';
import { startCarCatalogue } from './services/automotive/automotive-catalogue';
import { startWellnessSweeper } from './services/wellness/wellness-reminders.service';
import { startWellnessCatalogue } from './services/wellness/wellness-catalogue';
import complianceRoutes from './routes/compliance.routes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { responseTimeMiddleware } from './middleware/responseTime';
import { localeMiddleware } from './middleware/locale';
// import { createOpenSearchMiddleware } from './middleware/opensearch-sync'; // Disabled - needs OpenSearch
import { createRateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { bestEffort } from './utils/best-effort';
import { register } from './utils/metrics';
import { getAllowedOrigins, isCorsOriginAllowed } from './utils/origins';
import { getMaintenanceState } from './services/feature-flags.service';

// Import services
import { initializeSocketHandlers } from './services/socket.service';
import { initializeOpenSearch, isOpenSearchEnabled } from './utils/opensearch';
import { presenceService } from './services/presence.service';
import { validateWorkerStartupConfiguration } from './utils/worker-config';
// Workers are dynamically imported to avoid Redis connection when disabled
// import { startAllWorkers, stopAllWorkers } from './services/workers.service';

// Initialize Express app
const app: Application = express();
const httpServer = createServer(app);

// Trust proxy — requests always arrive through a reverse proxy
// (Next.js dev server locally, load balancer / Netlify in production).
// Without this, req.ip is always 127.0.0.1 and rate limiters treat
// every user as the same person.
app.set('trust proxy', 1);

// Hide Express signature
app.disable('x-powered-by');

// Graceful shutdown flag
let isShuttingDown = false;

const isProductionRuntime =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER_ENV === 'production';

async function startBackgroundWorkersIfEnabled(): Promise<void> {
  if (process.env.ENABLE_WORKERS !== 'true') {
    return;
  }

  const workerConfig = validateWorkerStartupConfiguration();
  if (!workerConfig.ok) {
    const message = workerConfig.errors.join('; ');
    logger.error('Worker startup configuration invalid', { message });
    if (isProductionRuntime) {
      throw new Error(message);
    }
    return;
  }

  try {
    const { startAllWorkers } = await import('./services/workers.service');
    await startAllWorkers();
  } catch (err) {
    logger.error('Failed to start background workers', err);
    if (isProductionRuntime) {
      throw err;
    }
  }
}

async function initializeSearchIfConfigured(): Promise<void> {
  if (!isOpenSearchEnabled()) {
    logger.info('OpenSearch disabled; Prisma search fallback is active');
    return;
  }

  const connected = await initializeOpenSearch();
  if (!connected && isProductionRuntime && process.env.OPENSEARCH_ENABLED === 'true') {
    throw new Error('OpenSearch is enabled but could not be initialized');
  }
}

// ===========================================
// INITIALIZE SERVICES
// ===========================================

// Note: OpenSearch sync is handled via Prisma middleware extension
// See: prisma client extensions or use queueSearchIndexing in services

function logCorsRejection(origin: string | undefined) {
  logger.warn('CORS rejected origin', { origin, allowedOrigins: getAllowedOrigins() });
}

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logCorsRejection(origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ===========================================
// MIDDLEWARE
// ===========================================

// CORS - Allow multiple origins for development and configurable production list
// CORS must come before other middleware that might respond to requests
app.use(cors({
  origin: (origin, callback) => {
    if (isCorsOriginAllowed(origin)) {
      return callback(null, true);
    }
    // Log rejected origins for debugging
    logCorsRejection(origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Debug-Auth',
    'X-Health-Token',
    'X-Metrics-Token',
  ],
}));

// The visitor's real address, when the web proxy proves it sent the request.
// Ahead of every limiter, lockout and session record that keys on req.ip.
app.use(trustedProxyIdentity);

// Cookie parser (for refresh token cookie handling)
app.use(cookieParser());

// Custom security headers (before helmet for ordering)
app.use(securityHeaders);

// Security headers (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Static uploads - mounted later after body parsing for logging

// Request correlation ID
app.use(requestIdMiddleware);

// Response time tracking + Prometheus metrics
app.use(responseTimeMiddleware);

// Locale detection for i18n
app.use(localeMiddleware);

// Request logging with correlation ID
app.use((req: Request, _res: Response, next: NextFunction) => {
  // Keep this at debug to avoid double-logging in production.
  // The response time middleware logs a completion line with duration.
  logger.debug('request start', { requestId: req.requestId, method: req.method, path: req.path });
  next();
});

// Rate limiting
// The switch exists for local tooling; production never runs without limits.
const rateLimitEnabled = process.env.NODE_ENV === 'production' || process.env.RATE_LIMIT_ENABLED !== 'false';
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
// Production keeps the strict budget. Outside production it is relaxed, the way
// authLimiter below already does: one homepage load fans out to six API calls,
// so 100 per 15 minutes trips during any E2E run or manual QA pass and the app
// starts serving 429s to the developer testing it. RATE_LIMIT_MAX still wins.
const rateLimitMax = parseInt(
  process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '100' : '2000'),
  10
);

// Counters live in Redis when it is configured, so every instance of the
// API draws on the same budget per caller; in the process otherwise.
const limiter = rateLimit({
  windowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) ? rateLimitMax : 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path === '/metrics' || req.path.startsWith('/webhooks'),
  validate: { xForwardedForHeader: false },
  store: new SharedRateLimitStore('rl:api:'),
});

// Strict rate limiter for authentication endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // relaxed in dev
  message: { success: false, message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: new SharedRateLimitStore('rl:auth:'),
});

// Lenient limiter just for /refresh — high enough not to interfere with
// active sessions, low enough to cap leaked-token replay loops.
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 30 : 300,
  message: { success: false, message: 'Too many refresh requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: new SharedRateLimitStore('rl:refresh:'),
});

// Stricter limiter for password reset (prevent email enumeration)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset requests per hour
  message: { success: false, message: 'Too many password reset attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: new SharedRateLimitStore('rl:reset:'),
});

if (rateLimitEnabled) {
  app.use('/api/', limiter);
  // Apply stricter limits to auth endpoints
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/refresh', refreshLimiter);
  app.use('/api/auth/forgot-password', passwordResetLimiter);
  app.use('/api/auth/resend-verification', passwordResetLimiter);
  app.use('/api/auth/reset-password', passwordResetLimiter);
}

// Stripe webhooks require the raw request body; mount before express.json.
app.use('/api/webhooks', webhookRoutes);

// Legacy webhook endpoint (deprecated). Stripe signature verification is not reliable
// here because this server parses JSON for most routes; use /api/webhooks/stripe.
app.post('/api/subscriptions/webhook', (req: Request, res: Response) => {
  const expected = process.env.INTERNAL_WEBHOOK_DISABLE_KEY;
  const provided = typeof req.headers['x-internal-webhook-disable-key'] === 'string'
    ? req.headers['x-internal-webhook-disable-key']
    : undefined;

  // If configured, keep this endpoint silent unless the shared secret matches.
  // This prevents Stripe retries from noisy errors while still allowing deploy-time checks.
  if (expected) {
    if (!secretMatches(provided, expected)) {
      return res.status(204).send();
    }

    return res.status(200).json({
      success: false,
      deprecated: true,
      message: 'Disabled. Use /api/webhooks/stripe',
    });
  }

  // If not configured, preserve visible behavior for easier local debugging.
  logger.warn('Deprecated Stripe webhook endpoint called', {
    requestId: req.requestId,
    ip: req.ip,
    path: req.path,
  });
  return res.status(410).json({
    success: false,
    deprecated: true,
    message: 'Deprecated. Use /api/webhooks/stripe',
  });
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
const uploadsPath = path.join(process.cwd(), 'uploads');
const publicUploadFolders = new Set(['avatars', 'covers', 'posts', 'videos']);
logger.info('Mounting static uploads', { path: uploadsPath });
app.use('/uploads', (req, res, next) => {
  const normalizedPath = req.path.replace(/\\/g, '/').replace(/^\/+/, '');
  const folder = normalizedPath.split('/')[0];

  if (folder && !publicUploadFolders.has(folder)) {
    return res.status(404).json({
      success: false,
      message: 'Not found',
    });
  }

  logger.debug('Static file request', { method: req.method, path: req.path });
  next();
}, express.static(uploadsPath, {
  // No dotfiles, no directory listings, and every file served as a file: a
  // sandboxed document with nothing it may load, never sniffed into a page.
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => {
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// ===========================================
// ROUTES
// ===========================================

// Root endpoint — API info
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'ATHENA API',
    status: 'running',
    version: process.env.npm_package_version || '1.0.0',
    health: '/health',
    docs: '/api',
  });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Liveness probe (process is up)
app.get('/livez', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'live',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (dependencies are reachable)
app.get('/readyz', async (_req: Request, res: Response) => {
  // Return 503 during graceful shutdown drain period
  if (isShuttingDown) {
    return res.status(503).json({
      status: 'shutting_down',
      timestamp: new Date().toISOString(),
    });
  }
  try {
    // Minimal DB check
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
    });
  }
});

// Dev-only endpoint to validate 5xx metrics and alerting behavior
if (process.env.NODE_ENV !== 'production') {
  app.get('/__test/500', (_req: Request, _res: Response, next: NextFunction) => {
    next(new Error('Test 500 error'));
  });
}

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metricsToken = process.env.METRICS_TOKEN;
    if (process.env.NODE_ENV === 'production' && !metricsToken) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (metricsToken) {
      const auth = req.headers.authorization;
      const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
      const headerToken = typeof req.headers['x-metrics-token'] === 'string' ? req.headers['x-metrics-token'] : null;
      const provided = bearer || headerToken;

      if (!secretMatches(provided, metricsToken)) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    }

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end();
  }
});

// Public maintenance state. The client's /maintenance page and its API client
// both need to read this while the gate below is answering 503 to everything
// else, so it is declared ahead of the gate and left unauthenticated.
app.get('/api/maintenance', async (_req: Request, res: Response) => {
  res.status(200).json(await getMaintenanceState());
});

// Paths that stay open while the platform is closed. Operators have to be able
// to sign in and turn maintenance back off, and the client has to be able to
// find out why it is being refused; everything else waits.
const MAINTENANCE_OPEN_PATHS = [
  '/admin',
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/me',
  '/feature-flags/active',
  '/maintenance',
];

// Mounted on /api only, and after the webhook router: Stripe retries a rejected
// webhook for days, so dropping payment events during a ten-minute deploy would
// cost more than it saves.
app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await getMaintenanceState();
    if (!state.enabled) return next();

    if (MAINTENANCE_OPEN_PATHS.some((open) => req.path === open || req.path.startsWith(open + '/'))) {
      return next();
    }

    // Retry-After is in seconds and has to be an integer; without an announced
    // end time, ask clients back in a minute rather than in a tight loop.
    const retryAfterSeconds = state.endsAt
      ? Math.max(30, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 1000))
      : 60;

    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(503).json({
      success: false,
      message: state.message,
      maintenance: {
        enabled: true,
        message: state.message,
        startedAt: state.startedAt,
        endsAt: state.endsAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', followRequestRoutes);
app.use('/api/users', closeFriendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
// Reactions, polls, comment likes, pins and the "mine" listings sit ahead of
// the post routes so `me/scheduled` is never read as a post id.
app.use('/api/posts', postSocialRoutes);
app.use('/api/posts', postRepostRoutes);
app.use('/api/posts', postInsightsRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
// Mounted before adminRoutes: that router applies authenticate() to every path
// beneath /api/admin, which would reject seed requests before they are reached.
// The seed router gates itself (non-production + ALLOW_DB_SEEDING + token).
app.use('/api/admin/seed', adminSeedRoutes);
// Mounted ahead of adminRoutes. It guards each route individually rather than
// with router.use, so the /api/admin paths it does not own fall straight
// through to adminRoutes without being authenticated twice.
app.use('/api/admin', adminOperationsRoutes);
// Runtime facts and recorded revenue for the admin console; guards each route
// itself, like the operations router.
app.use('/api/admin', adminConfigRoutes);
// Impact catalogues (programs, bridging, DV services, partners, First Nations)
// and the overseas-credentials queue; guards each route itself, like the
// operations router.
app.use('/api/admin', adminImpactRoutes);
// The catalogue editors (accelerator cohorts, investors, insurance products,
// investor introductions) guard each route themselves, like the operations router.
app.use('/api/admin', adminCatalogueRoutes);
// Grant programmes (the directory's only write path) guard each route themselves
// too; the application reviews under /admin/grants/applications stay in adminRoutes.
app.use('/api/admin', adminGrantsRoutes);
// Business formation decisions and refunds. Same arrangement as the routers
// above: it guards each route itself, so it can sit in front of adminRoutes
// without re-authenticating every /api/admin request it does not handle.
app.use('/api/admin', adminFormationRoutes);
// The marketing hub guards its own routes, like the operations router.
app.use('/api/admin/marketing', adminMarketingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin/blog', adminBlogRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin/feedback', adminFeedbackRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/formation', formationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/status/highlights', storyHighlightRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/algorithms', algorithmRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/appeals', appealRoutes);
app.use('/api/trust-score', trustRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/apprenticeships', apprenticeshipRoutes);
app.use('/api/skills-marketplace', skillsMarketplaceRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/concierge', conciergeRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/safety/dv', dvSafeRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/money', moneyRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/housing', housingRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/strategy', strategyRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/automotive', automotiveRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/community-support', communitySupportRoutes);
app.use('/api/ai-algorithms', aiAlgorithmsRoutes);
app.use('/api/feature-flags', featureFlagsRoutes);
app.use('/api/connect', connectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/references', referenceRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/groups', groupChatRoutes); // Group chat specific routes
app.use('/api/gdpr', gdprRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/sounds', soundRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/livestream', livestreamRoutes);

// Health routes (comprehensive health checks)
app.use('/health', healthRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Error handler
app.use(errorHandler);

// ===========================================
// SOCKET.IO - Real-time notifications & messaging
// ===========================================

// Initialize comprehensive Socket.IO handlers
initializeSocketHandlers(io);

// Legacy basic handlers for backward compatibility
io.on('connection', (socket) => {
  logger.debug(`Basic socket connected: ${socket.id}`);

  socket.on('join_room', (requestedRoom: string) => {
    const authenticatedSocket = socket as typeof socket & { userId?: string };
    const ownUserRoom = authenticatedSocket.userId ? `user:${authenticatedSocket.userId}` : null;
    const legacyOwnRoom = authenticatedSocket.userId;

    if (!ownUserRoom || (requestedRoom !== ownUserRoom && requestedRoom !== legacyOwnRoom)) {
      logger.warn('Rejected legacy socket room join', {
        socketId: socket.id,
        userId: authenticatedSocket.userId,
        requestedRoom,
      });
      socket.emit('join_room:error', { message: 'Not authorized to join room' });
      return;
    }

    socket.join(ownUserRoom);
    logger.debug(`User ${authenticatedSocket.userId} joined their room`);
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

// Export app/server for test harnesses and integration usage.
export { app, httpServer };

// ===========================================
// SERVER START
// ===========================================

/**
 * Main startup function — exported so start.ts (crash-safe wrapper) can call it.
 * Also called directly when this file is the entry point (require.main === module).
 */
export async function startServer() {
  // The boot banner was two console.log lines, so the first thing the server
  // ever said was the only thing it said outside the logger: no timestamp, no
  // level, and no JSON in production, where every other line is searchable.
  // The record is assembled key by key because passing the variables straight
  // in put nodeEnv and port in it holding undefined whenever they were unset,
  // which is not the same as leaving them out: the dev formatter then printed
  // a bare "{}" after the message, and the record itself claimed to carry two
  // facts it did not have. Unset variables are left out; the listen callback
  // below reports the effective values.
  const startupContext: Record<string, string> = {};
  if (process.env.NODE_ENV) {
    startupContext.nodeEnv = process.env.NODE_ENV;
  }
  if (process.env.PORT) {
    startupContext.port = process.env.PORT;
  }
  logger.info('Starting server process', startupContext);

  // Startup sequence: load secrets, validate env, init Sentry, ensure DB
  //
  // Continuing on process.env is right — a secrets manager being unreachable
  // should not stop a server whose environment may already hold everything it
  // needs. What was wrong is that the catch bound the error and threw it away,
  // so the line said loading had failed and never said why: a bad role, an
  // unreachable endpoint and a malformed secret payload all read identically,
  // at the one moment in the process where the answer decides whether the
  // server is about to come up half-configured.
  await bestEffort('startup.load-external-secrets', () => loadSecretsIfConfigured());

  validateEnvironmentOrExit();

  // Initialize Sentry now that secrets/DSN may be available
  initSentry();

  await initializeSearchIfConfigured();

  // Ensure DB connection with retry/backoff
  try {
    await connectWithRetry(8, 750);
    logger.info('Database connected');
  } catch (err) {
    logger.error('Failed to connect to database after retries', { err });
    // Don't exit — let the server start so /health and /readyz can report status.
    // /readyz will return 503 if DB is unreachable.
  }

  await startBackgroundWorkersIfEnabled();

  const PORT = process.env.PORT || 5000;

  httpServer.listen(PORT, () => {
    logger.info(`🚀 ATHENA Server running on port ${PORT}`);
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Periodic session cleanup — remove expired sessions every 6 hours
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(() => {
      void bestEffort('session-cleanup.scheduled', () => sessionService.cleanupExpiredSessions());
    }, SIX_HOURS);
    // Run once at startup too, because the interval above does not fire for
    // another six hours and this is the only sweep until then.
    //
    // It is the very same call as the one in the interval, and the two used to
    // disagree about whether anyone should hear when it failed: the interval
    // logged through logger.error, this one was `.catch(() => {})`. So the run
    // most likely to fail — at boot, while the connection pool is still coming
    // up — was the one run that failed in complete silence, and the expired
    // session rows it exists to delete just stayed in the table with nothing
    // anywhere saying why. That inconsistency between two copies of one call is
    // the whole argument for this helper, so both go through it now rather than
    // only this one. That moves the scheduled run from error to warn: a sweep
    // that retries in six hours is not worth waking anyone for, and having the
    // two copies agree is worth more than the level they used to disagree on.
    //
    // Deliberately not awaited: the listen callback is not async and the server
    // is already accepting requests, so the sweep finishes in its own time.
    // Nothing is left to catch, because bestEffort resolves rather than rejects.
    void bestEffort('session-cleanup.startup', () => sessionService.cleanupExpiredSessions());

    // Disappearing messages: delete what has expired, once a minute.
    // Without Redis the rate limits, the locks and the caches are per process,
    // which holds on one instance and quietly stops holding on two.
    if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
      logger.error('REDIS_URL is not set: rate limits and scheduled-sweep locks are per instance on this deployment');
    }
    startMessageExpirySweeper();
    // Grant applications left in draft: a nudge a week out and the day before.
    startGrantReminderSweeper();
    // Insurance a year on, and a mix that has drifted: a nudge each, daily sweep.
    startWealthNudgeSweeper();
    // Wellness: doses due, refills, the day-after-a-visit check-in, circle check-ins, goal reviews.
    startWellnessSweeper();
    startWellnessCatalogue();
    startAutomotiveSweeper();
    // Escrow holds outliving the card authorisation behind them: warn while
    // there is still time to act.
    startEscrowExpirySweeper();
    startCarCatalogue();
    // Scheduled posts: publish what has come due, once a minute.
    startScheduledPostPublisher();
  });

  // ===========================================
  // GRACEFUL SHUTDOWN
  // ===========================================

  const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);

  async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    isShuttingDown = true;

    // Give load balancers time to stop routing traffic
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Stop background workers (only if enabled)
    if (process.env.ENABLE_WORKERS === 'true') {
      try {
        const { stopAllWorkers } = await import('./services/workers.service');
        await stopAllWorkers();
        logger.info('Background workers stopped');
      } catch (err) {
        logger.error('Error stopping workers', err);
      }
    }

    // Cleanup presence service (remove all presence data for this instance)
    try {
      await presenceService.cleanup();
      logger.info('Presence service cleaned up');
    } catch (err) {
      logger.error('Error cleaning up presence service', err);
    }

    // Close Socket.IO connections
    io.close(() => {
      logger.info('Socket.IO connections closed');
    });

    // Close HTTP server (stop accepting new connections)
    httpServer.close(async () => {
      logger.info('HTTP server closed');

      // Disconnect Prisma
      try {
        await prisma.$disconnect();
        logger.info('Prisma disconnected');
      } catch (err) {
        logger.error('Error disconnecting Prisma', err);
      }

      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      logger.error(`Shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Capture unhandled errors with Sentry
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    Sentry.captureException(error);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    Sentry.captureException(reason as Error);
  });
}

// Auto-start when run directly (e.g. `node dist/index.js`)
if (require.main === module) {
  startServer();
}

export default app;
