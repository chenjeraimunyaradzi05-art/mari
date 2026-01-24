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

// Validate environment variables before anything else
import { validateEnvironmentOrExit } from './utils/env';
validateEnvironmentOrExit();

// Initialize Sentry for error monitoring (must be early)
import { initSentry, Sentry } from './utils/sentry';
initSentry();

import { prisma } from './utils/prisma';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import jobRoutes from './routes/job.routes';
import postRoutes from './routes/post.routes';
import organizationRoutes from './routes/organization.routes';
import courseRoutes from './routes/course.routes';
import mentorRoutes from './routes/mentor.routes';
import subscriptionRoutes from './routes/subscription.routes';
import aiRoutes from './routes/ai.routes';
import mediaRoutes from './routes/media.routes';
import notificationRoutes from './routes/notification.routes';
import messageRoutes from './routes/message.routes';
import adminRoutes from './routes/admin.routes';
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
import channelRoutes from './routes/channel.routes';
import apprenticeshipRoutes from './routes/apprenticeship.routes';
import skillsMarketplaceRoutes from './routes/skills-marketplace.routes';
import safetyRoutes from './routes/safety.routes';
import conciergeRoutes from './routes/concierge.routes';
import salaryRoutes from './routes/salary.routes';
import paymentsRoutes from './routes/payments.routes';
import mentorSchedulingRoutes from './routes/mentor-scheduling.routes';
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
import complianceRoutes from './routes/compliance.routes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { responseTimeMiddleware } from './middleware/responseTime';
// import { createOpenSearchMiddleware } from './middleware/opensearch-sync'; // Disabled - needs OpenSearch
import { createRateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { register } from './utils/metrics';

// Import services
import { initializeSocketHandlers } from './services/socket.service';
// import { initializeOpenSearch } from './utils/opensearch'; // Disabled - needs OpenSearch
import { presenceService } from './services/presence.service';
// Workers are dynamically imported to avoid Redis connection when disabled
// import { startAllWorkers, stopAllWorkers } from './services/workers.service';

// Initialize Express app
const app: Application = express();
const httpServer = createServer(app);

// Trust proxy when running behind load balancers (production or explicit override)
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Hide Express signature
app.disable('x-powered-by');

// Graceful shutdown flag
let isShuttingDown = false;

// ===========================================
// INITIALIZE SERVICES
// ===========================================

// Initialize OpenSearch for full-text search (disabled)
// initializeOpenSearch();

// Note: OpenSearch sync is handled via Prisma middleware extension
// See: prisma client extensions or use queueSearchIndexing in services

// Initialize background workers (video processing, notifications, etc.)
// Disabled by default - requires Redis. Set ENABLE_WORKERS=true to enable
if (process.env.ENABLE_WORKERS === 'true') {
  import('./services/workers.service').then(({ startAllWorkers }) => {
    startAllWorkers().catch((err: Error) => {
      logger.error('Failed to start background workers', err);
    });
  });
}

const fallbackOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
];

const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([
  ...envOrigins,
  ...fallbackOrigins,
]));

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// ===========================================
// MIDDLEWARE
// ===========================================

// CORS - Allow multiple origins for development and configurable production list
// CORS must come before other middleware that might respond to requests
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Log rejected origins for debugging
    logger.warn('CORS rejected origin', { origin, allowedOrigins });
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Security headers (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request correlation ID
app.use(requestIdMiddleware);

// Response time tracking + Prometheus metrics
app.use(responseTimeMiddleware);

// Request logging with correlation ID
app.use((req: Request, _res: Response, next: NextFunction) => {
  // Keep this at debug to avoid double-logging in production.
  // The response time middleware logs a completion line with duration.
  logger.debug('request start', { requestId: req.requestId, method: req.method, path: req.path });
  next();
});

// Rate limiting
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

const limiter = rateLimit({
  windowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) ? rateLimitMax : 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path === '/metrics' || req.path.startsWith('/webhooks'),
});

if (rateLimitEnabled) {
  app.use('/api/', limiter);
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
    if (!provided || provided !== expected) {
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
console.log('Mounting static uploads at /uploads from:', uploadsPath);
app.use('/uploads', (req, res, next) => {
  console.log(`Static file request: ${req.method} ${req.path}`);
  next();
}, express.static(uploadsPath));

// ===========================================
// ROUTES
// ===========================================

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
    if (metricsToken) {
      const auth = req.headers.authorization;
      const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
      const headerToken = typeof req.headers['x-metrics-token'] === 'string' ? req.headers['x-metrics-token'] : null;
      const provided = bearer || headerToken;

      if (!provided || provided !== metricsToken) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    }

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end();
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
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
app.use('/api/mentoring', mentorSchedulingRoutes);
app.use('/api/safety/dv', dvSafeRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/money', moneyRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/housing', housingRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/community-support', communitySupportRoutes);
app.use('/api/ai', aiAlgorithmsRoutes);
app.use('/api/feature-flags', featureFlagsRoutes);
app.use('/api/connect', connectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/references', referenceRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/groups', groupChatRoutes); // Group chat specific routes
app.use('/api/gdpr', gdprRoutes);
app.use('/api/compliance', complianceRoutes);

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

  socket.on('join_room', (userId: string) => {
    socket.join(userId);
    logger.debug(`User ${userId} joined their room`);
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

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  httpServer.listen(PORT, () => {
    logger.info(`🚀 ATHENA Server running on port ${PORT}`);
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
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

export default app;
