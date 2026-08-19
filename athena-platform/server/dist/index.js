"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = exports.app = exports.io = void 0;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables FIRST
dotenv_1.default.config();
// We will load secrets (AWS Secrets Manager) at startup and then validate env
const env_1 = require("./utils/env");
const secrets_1 = require("./utils/secrets");
// Initialize Sentry import (initialization will run after secrets loaded)
const sentry_1 = require("./utils/sentry");
const prisma_1 = require("./utils/prisma");
const session_service_1 = require("./services/session.service");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const securityHeaders_1 = require("./middleware/securityHeaders");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const job_routes_1 = __importDefault(require("./routes/job.routes"));
const post_routes_1 = __importDefault(require("./routes/post.routes"));
const organization_routes_1 = __importDefault(require("./routes/organization.routes"));
const course_routes_1 = __importDefault(require("./routes/course.routes"));
const mentor_routes_1 = __importDefault(require("./routes/mentor.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const media_routes_1 = __importDefault(require("./routes/media.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const referral_routes_1 = __importDefault(require("./routes/referral.routes"));
const employer_routes_1 = __importDefault(require("./routes/employer.routes"));
const education_routes_1 = __importDefault(require("./routes/education.routes"));
const creator_routes_1 = __importDefault(require("./routes/creator.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const engagement_routes_1 = __importDefault(require("./routes/engagement.routes"));
const formation_routes_1 = __importDefault(require("./routes/formation.routes"));
const event_routes_1 = __importDefault(require("./routes/event.routes"));
const group_routes_1 = __importDefault(require("./routes/group.routes"));
const status_routes_1 = __importDefault(require("./routes/status.routes"));
const webhook_routes_1 = __importDefault(require("./routes/webhook.routes"));
const algorithm_routes_1 = __importDefault(require("./routes/algorithm.routes"));
const verification_routes_1 = __importDefault(require("./routes/verification.routes"));
const appeal_routes_1 = __importDefault(require("./routes/appeal.routes"));
const trust_routes_1 = __importDefault(require("./routes/trust.routes"));
const region_routes_1 = __importDefault(require("./routes/region.routes"));
const video_routes_1 = __importDefault(require("./routes/video.routes"));
const channel_routes_1 = __importDefault(require("./routes/channel.routes"));
const apprenticeship_routes_1 = __importDefault(require("./routes/apprenticeship.routes"));
const skills_marketplace_routes_1 = __importDefault(require("./routes/skills-marketplace.routes"));
const safety_routes_1 = __importDefault(require("./routes/safety.routes"));
const concierge_routes_1 = __importDefault(require("./routes/concierge.routes"));
const salary_routes_1 = __importDefault(require("./routes/salary.routes"));
const payments_routes_1 = __importDefault(require("./routes/payments.routes"));
const mentor_scheduling_routes_1 = __importDefault(require("./routes/mentor-scheduling.routes"));
const dv_safe_routes_1 = __importDefault(require("./routes/dv-safe.routes"));
const accounting_routes_1 = __importDefault(require("./routes/accounting.routes"));
const tax_routes_1 = __importDefault(require("./routes/tax.routes"));
const inventory_routes_1 = __importDefault(require("./routes/inventory.routes"));
const money_routes_1 = __importDefault(require("./routes/money.routes"));
const business_routes_1 = __importDefault(require("./routes/business.routes"));
const housing_routes_1 = __importDefault(require("./routes/housing.routes"));
const finance_routes_1 = __importDefault(require("./routes/finance.routes"));
const impact_routes_1 = __importDefault(require("./routes/impact.routes"));
const community_support_routes_1 = __importDefault(require("./routes/community-support.routes"));
const ai_algorithms_routes_1 = __importDefault(require("./routes/ai-algorithms.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const feature_flags_routes_1 = __importDefault(require("./routes/feature-flags.routes"));
const connect_routes_1 = __importDefault(require("./routes/connect.routes"));
const invoice_routes_1 = __importDefault(require("./routes/invoice.routes"));
const reference_routes_1 = __importDefault(require("./routes/reference.routes"));
const feed_routes_1 = __importDefault(require("./routes/feed.routes"));
const group_chat_routes_1 = __importDefault(require("./routes/group-chat.routes"));
const gdpr_routes_1 = __importDefault(require("./routes/gdpr.routes"));
const compliance_routes_1 = __importDefault(require("./routes/compliance.routes"));
// livestream routes require schema additions (StreamKey, LiveStream models) — not yet ready
// import livestreamRoutes from './routes/livestream.routes';
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
const requestId_1 = require("./middleware/requestId");
const responseTime_1 = require("./middleware/responseTime");
const locale_1 = require("./middleware/locale");
const logger_1 = require("./utils/logger");
const metrics_1 = require("./utils/metrics");
const origins_1 = require("./utils/origins");
// Import services
const socket_service_1 = require("./services/socket.service");
const opensearch_1 = require("./utils/opensearch");
const presence_service_1 = require("./services/presence.service");
const worker_config_1 = require("./utils/worker-config");
// Workers are dynamically imported to avoid Redis connection when disabled
// import { startAllWorkers, stopAllWorkers } from './services/workers.service';
// Initialize Express app
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Trust proxy — requests always arrive through a reverse proxy
// (Next.js dev server locally, load balancer / Netlify in production).
// Without this, req.ip is always 127.0.0.1 and rate limiters treat
// every user as the same person.
app.set('trust proxy', 1);
// Hide Express signature
app.disable('x-powered-by');
// Graceful shutdown flag
let isShuttingDown = false;
const isProductionRuntime = process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.RENDER_ENV === 'production';
async function startBackgroundWorkersIfEnabled() {
    if (process.env.ENABLE_WORKERS !== 'true') {
        return;
    }
    const workerConfig = (0, worker_config_1.validateWorkerStartupConfiguration)();
    if (!workerConfig.ok) {
        const message = workerConfig.errors.join('; ');
        logger_1.logger.error('Worker startup configuration invalid', { message });
        if (isProductionRuntime) {
            throw new Error(message);
        }
        return;
    }
    try {
        const { startAllWorkers } = await Promise.resolve().then(() => __importStar(require('./services/workers.service')));
        await startAllWorkers();
    }
    catch (err) {
        logger_1.logger.error('Failed to start background workers', err);
        if (isProductionRuntime) {
            throw err;
        }
    }
}
async function initializeSearchIfConfigured() {
    if (!(0, opensearch_1.isOpenSearchEnabled)()) {
        logger_1.logger.info('OpenSearch disabled; Prisma search fallback is active');
        return;
    }
    const connected = await (0, opensearch_1.initializeOpenSearch)();
    if (!connected && isProductionRuntime && process.env.OPENSEARCH_ENABLED === 'true') {
        throw new Error('OpenSearch is enabled but could not be initialized');
    }
}
// ===========================================
// INITIALIZE SERVICES
// ===========================================
// Note: OpenSearch sync is handled via Prisma middleware extension
// See: prisma client extensions or use queueSearchIndexing in services
function logCorsRejection(origin) {
    logger_1.logger.warn('CORS rejected origin', { origin, allowedOrigins: (0, origins_1.getAllowedOrigins)() });
}
// Initialize Socket.IO
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if ((0, origins_1.isCorsOriginAllowed)(origin)) {
                callback(null, true);
            }
            else {
                logCorsRejection(origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io = io;
// ===========================================
// MIDDLEWARE
// ===========================================
// CORS - Allow multiple origins for development and configurable production list
// CORS must come before other middleware that might respond to requests
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if ((0, origins_1.isCorsOriginAllowed)(origin)) {
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
// Cookie parser (for refresh token cookie handling)
app.use((0, cookie_parser_1.default)());
// Custom security headers (before helmet for ordering)
app.use(securityHeaders_1.securityHeaders);
// Security headers (after CORS)
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Static uploads - mounted later after body parsing for logging
// Request correlation ID
app.use(requestId_1.requestIdMiddleware);
// Response time tracking + Prometheus metrics
app.use(responseTime_1.responseTimeMiddleware);
// Locale detection for i18n
app.use(locale_1.localeMiddleware);
// Request logging with correlation ID
app.use((req, _res, next) => {
    // Keep this at debug to avoid double-logging in production.
    // The response time middleware logs a completion line with duration.
    logger_1.logger.debug('request start', { requestId: req.requestId, method: req.method, path: req.path });
    next();
});
// Rate limiting
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const limiter = (0, express_rate_limit_1.default)({
    windowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 15 * 60 * 1000,
    max: Number.isFinite(rateLimitMax) ? rateLimitMax : 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/metrics' || req.path.startsWith('/webhooks'),
    validate: { xForwardedForHeader: false },
});
// Strict rate limiter for authentication endpoints (brute-force protection)
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 10 : 100, // relaxed in dev
    message: { success: false, message: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
});
// Lenient limiter just for /refresh — high enough not to interfere with
// active sessions, low enough to cap leaked-token replay loops.
const refreshLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 30 : 300,
    message: { success: false, message: 'Too many refresh requests, please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
});
// Stricter limiter for password reset (prevent email enumeration)
const passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 password reset requests per hour
    message: { success: false, message: 'Too many password reset attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
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
app.use('/api/webhooks', webhook_routes_1.default);
// Legacy webhook endpoint (deprecated). Stripe signature verification is not reliable
// here because this server parses JSON for most routes; use /api/webhooks/stripe.
app.post('/api/subscriptions/webhook', (req, res) => {
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
    logger_1.logger.warn('Deprecated Stripe webhook endpoint called', {
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files from uploads directory
const uploadsPath = path_1.default.join(process.cwd(), 'uploads');
const publicUploadFolders = new Set(['avatars', 'covers', 'posts', 'videos']);
logger_1.logger.info('Mounting static uploads', { path: uploadsPath });
app.use('/uploads', (req, res, next) => {
    const normalizedPath = req.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const folder = normalizedPath.split('/')[0];
    if (folder && !publicUploadFolders.has(folder)) {
        return res.status(404).json({
            success: false,
            message: 'Not found',
        });
    }
    logger_1.logger.debug('Static file request', { method: req.method, path: req.path });
    next();
}, express_1.default.static(uploadsPath));
// ===========================================
// ROUTES
// ===========================================
// Root endpoint — API info
app.get('/', (_req, res) => {
    res.status(200).json({
        name: 'ATHENA API',
        status: 'running',
        version: process.env.npm_package_version || '1.0.0',
        health: '/health',
        docs: '/api',
    });
});
// Health check
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
    });
});
// Liveness probe (process is up)
app.get('/livez', (_req, res) => {
    res.status(200).json({
        status: 'live',
        timestamp: new Date().toISOString(),
    });
});
// Readiness probe (dependencies are reachable)
app.get('/readyz', async (_req, res) => {
    // Return 503 during graceful shutdown drain period
    if (isShuttingDown) {
        return res.status(503).json({
            status: 'shutting_down',
            timestamp: new Date().toISOString(),
        });
    }
    try {
        // Minimal DB check
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
        });
    }
});
// Dev-only endpoint to validate 5xx metrics and alerting behavior
if (process.env.NODE_ENV !== 'production') {
    app.get('/__test/500', (_req, _res, next) => {
        next(new Error('Test 500 error'));
    });
}
// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
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
            if (!provided || provided !== metricsToken) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
        }
        res.set('Content-Type', metrics_1.register.contentType);
        res.end(await metrics_1.register.metrics());
    }
    catch (err) {
        res.status(500).end();
    }
});
// API routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/jobs', job_routes_1.default);
app.use('/api/posts', post_routes_1.default);
app.use('/api/organizations', organization_routes_1.default);
app.use('/api/courses', course_routes_1.default);
app.use('/api/mentors', mentor_routes_1.default);
app.use('/api/subscriptions', subscription_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/media', media_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/messages', message_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/referrals', referral_routes_1.default);
app.use('/api/employer', employer_routes_1.default);
app.use('/api/education', education_routes_1.default);
app.use('/api/creator', creator_routes_1.default);
app.use('/api/formation', formation_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/engagement', engagement_routes_1.default);
app.use('/api/events', event_routes_1.default);
app.use('/api/groups', group_routes_1.default);
app.use('/api/status', status_routes_1.default);
app.use('/api/algorithms', algorithm_routes_1.default);
app.use('/api/verification', verification_routes_1.default);
app.use('/api/appeals', appeal_routes_1.default);
app.use('/api/trust-score', trust_routes_1.default);
app.use('/api/regions', region_routes_1.default);
app.use('/api/video', video_routes_1.default);
app.use('/api/channels', channel_routes_1.default);
app.use('/api/apprenticeships', apprenticeship_routes_1.default);
app.use('/api/skills-marketplace', skills_marketplace_routes_1.default);
app.use('/api/safety', safety_routes_1.default);
app.use('/api/concierge', concierge_routes_1.default);
app.use('/api/salary', salary_routes_1.default);
app.use('/api/payments', payments_routes_1.default);
app.use('/api/mentoring', mentor_scheduling_routes_1.default);
app.use('/api/safety/dv', dv_safe_routes_1.default);
app.use('/api/accounting', accounting_routes_1.default);
app.use('/api/tax', tax_routes_1.default);
app.use('/api/inventory', inventory_routes_1.default);
app.use('/api/money', money_routes_1.default);
app.use('/api/business', business_routes_1.default);
app.use('/api/housing', housing_routes_1.default);
app.use('/api/finance', finance_routes_1.default);
app.use('/api/impact', impact_routes_1.default);
app.use('/api/community-support', community_support_routes_1.default);
app.use('/api/ai-algorithms', ai_algorithms_routes_1.default);
app.use('/api/feature-flags', feature_flags_routes_1.default);
app.use('/api/connect', connect_routes_1.default);
app.use('/api/invoices', invoice_routes_1.default);
app.use('/api/references', reference_routes_1.default);
app.use('/api/feed', feed_routes_1.default);
app.use('/api/groups', group_chat_routes_1.default); // Group chat specific routes
app.use('/api/gdpr', gdpr_routes_1.default);
app.use('/api/compliance', compliance_routes_1.default);
// app.use('/api/livestream', livestreamRoutes); // Needs schema additions first
// Health routes (comprehensive health checks)
app.use('/health', health_routes_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
    });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// ===========================================
// SOCKET.IO - Real-time notifications & messaging
// ===========================================
// Initialize comprehensive Socket.IO handlers
(0, socket_service_1.initializeSocketHandlers)(io);
// Legacy basic handlers for backward compatibility
io.on('connection', (socket) => {
    logger_1.logger.debug(`Basic socket connected: ${socket.id}`);
    socket.on('join_room', (requestedRoom) => {
        const authenticatedSocket = socket;
        const ownUserRoom = authenticatedSocket.userId ? `user:${authenticatedSocket.userId}` : null;
        const legacyOwnRoom = authenticatedSocket.userId;
        if (!ownUserRoom || (requestedRoom !== ownUserRoom && requestedRoom !== legacyOwnRoom)) {
            logger_1.logger.warn('Rejected legacy socket room join', {
                socketId: socket.id,
                userId: authenticatedSocket.userId,
                requestedRoom,
            });
            socket.emit('join_room:error', { message: 'Not authorized to join room' });
            return;
        }
        socket.join(ownUserRoom);
        logger_1.logger.debug(`User ${authenticatedSocket.userId} joined their room`);
    });
    socket.on('disconnect', () => {
        logger_1.logger.debug(`Socket disconnected: ${socket.id}`);
    });
});
// ===========================================
// SERVER START
// ===========================================
/**
 * Main startup function — exported so start.ts (crash-safe wrapper) can call it.
 * Also called directly when this file is the entry point (require.main === module).
 */
async function startServer() {
    console.log('[ATHENA] Starting server process...');
    console.log(`[ATHENA] NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);
    // Startup sequence: load secrets, validate env, init Sentry, ensure DB
    try {
        await (0, secrets_1.loadSecretsIfConfigured)();
    }
    catch (err) {
        logger_1.logger.warn('Failed loading external secrets, continuing with process.env');
    }
    (0, env_1.validateEnvironmentOrExit)();
    // Initialize Sentry now that secrets/DSN may be available
    (0, sentry_1.initSentry)();
    await initializeSearchIfConfigured();
    // Ensure DB connection with retry/backoff
    try {
        await (0, prisma_1.connectWithRetry)(8, 750);
        logger_1.logger.info('Database connected');
    }
    catch (err) {
        logger_1.logger.error('Failed to connect to database after retries', { err });
        // Don't exit — let the server start so /health and /readyz can report status.
        // /readyz will return 503 if DB is unreachable.
    }
    await startBackgroundWorkersIfEnabled();
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
        logger_1.logger.info(`🚀 ATHENA Server running on port ${PORT}`);
        logger_1.logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        // Periodic session cleanup — remove expired sessions every 6 hours
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        setInterval(() => {
            session_service_1.sessionService.cleanupExpiredSessions().catch((err) => {
                logger_1.logger.error('Session cleanup failed', { error: err });
            });
        }, SIX_HOURS);
        // Run once at startup too
        session_service_1.sessionService.cleanupExpiredSessions().catch(() => { });
    });
    // ===========================================
    // GRACEFUL SHUTDOWN
    // ===========================================
    const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);
    async function gracefulShutdown(signal) {
        logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
        isShuttingDown = true;
        // Give load balancers time to stop routing traffic
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Stop background workers (only if enabled)
        if (process.env.ENABLE_WORKERS === 'true') {
            try {
                const { stopAllWorkers } = await Promise.resolve().then(() => __importStar(require('./services/workers.service')));
                await stopAllWorkers();
                logger_1.logger.info('Background workers stopped');
            }
            catch (err) {
                logger_1.logger.error('Error stopping workers', err);
            }
        }
        // Cleanup presence service (remove all presence data for this instance)
        try {
            await presence_service_1.presenceService.cleanup();
            logger_1.logger.info('Presence service cleaned up');
        }
        catch (err) {
            logger_1.logger.error('Error cleaning up presence service', err);
        }
        // Close Socket.IO connections
        io.close(() => {
            logger_1.logger.info('Socket.IO connections closed');
        });
        // Close HTTP server (stop accepting new connections)
        httpServer.close(async () => {
            logger_1.logger.info('HTTP server closed');
            // Disconnect Prisma
            try {
                await prisma_1.prisma.$disconnect();
                logger_1.logger.info('Prisma disconnected');
            }
            catch (err) {
                logger_1.logger.error('Error disconnecting Prisma', err);
            }
            logger_1.logger.info('Graceful shutdown complete');
            process.exit(0);
        });
        // Force exit if shutdown takes too long
        setTimeout(() => {
            logger_1.logger.error(`Shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`);
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
    }
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    // Capture unhandled errors with Sentry
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('Uncaught Exception:', error);
        sentry_1.Sentry.captureException(error);
    });
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('Unhandled Rejection:', reason);
        sentry_1.Sentry.captureException(reason);
    });
}
// Auto-start when run directly (e.g. `node dist/index.js`)
if (require.main === module) {
    startServer();
}
exports.default = app;
//# sourceMappingURL=index.js.map