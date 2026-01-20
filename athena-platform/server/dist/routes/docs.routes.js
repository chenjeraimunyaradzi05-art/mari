"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const endpoints = [
    // Health & System
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'GET', path: '/livez', description: 'Liveness probe' },
    { method: 'GET', path: '/readyz', description: 'Readiness probe (checks DB)' },
    { method: 'GET', path: '/metrics', description: 'Prometheus metrics' },
    { method: 'GET', path: '/api/docs', description: 'API documentation (this endpoint)' },
    // Auth
    { method: 'POST', path: '/api/auth/register', description: 'Register new user', rateLimit: '10/15min' },
    { method: 'POST', path: '/api/auth/login', description: 'Login', rateLimit: '5/15min' },
    { method: 'POST', path: '/api/auth/refresh', description: 'Refresh access token', rateLimit: '30/15min' },
    { method: 'POST', path: '/api/auth/logout', description: 'Logout', auth: true },
    { method: 'GET', path: '/api/auth/me', description: 'Get current user', auth: true },
    { method: 'POST', path: '/api/auth/forgot-password', description: 'Request password reset', rateLimit: '5/15min' },
    { method: 'POST', path: '/api/auth/reset-password', description: 'Reset password with token', rateLimit: '5/15min' },
    { method: 'GET', path: '/api/auth/verify-email', description: 'Verify email with token' },
    { method: 'POST', path: '/api/auth/resend-verification', description: 'Resend verification email', auth: true },
    // Users
    { method: 'GET', path: '/api/users/me', description: 'Get current user profile', auth: true },
    { method: 'PATCH', path: '/api/users/me', description: 'Update current user profile', auth: true },
    { method: 'GET', path: '/api/users/me/export', description: 'DSAR: Export user data', auth: true },
    { method: 'DELETE', path: '/api/users/me', description: 'DSAR: Delete account', auth: true },
    { method: 'GET', path: '/api/users/:id', description: 'Get user by ID' },
    { method: 'GET', path: '/api/users/search', description: 'Search users' },
    // Jobs
    { method: 'GET', path: '/api/jobs', description: 'List jobs' },
    { method: 'GET', path: '/api/jobs/:id', description: 'Get job by ID' },
    { method: 'POST', path: '/api/jobs', description: 'Create job', auth: true },
    { method: 'PATCH', path: '/api/jobs/:id', description: 'Update job', auth: true },
    { method: 'DELETE', path: '/api/jobs/:id', description: 'Delete job', auth: true },
    { method: 'POST', path: '/api/jobs/:id/apply', description: 'Apply to job', auth: true },
    { method: 'POST', path: '/api/jobs/:id/save', description: 'Save job', auth: true },
    // Posts
    { method: 'GET', path: '/api/posts', description: 'List posts' },
    { method: 'GET', path: '/api/posts/:id', description: 'Get post by ID' },
    { method: 'POST', path: '/api/posts', description: 'Create post', auth: true },
    { method: 'PATCH', path: '/api/posts/:id', description: 'Update post', auth: true },
    { method: 'DELETE', path: '/api/posts/:id', description: 'Delete post', auth: true },
    { method: 'POST', path: '/api/posts/:id/like', description: 'Like/unlike post', auth: true },
    { method: 'POST', path: '/api/posts/:id/comments', description: 'Add comment', auth: true },
    // Organizations
    { method: 'GET', path: '/api/organizations', description: 'List organizations' },
    { method: 'GET', path: '/api/organizations/:slug', description: 'Get organization by slug' },
    { method: 'POST', path: '/api/organizations', description: 'Create organization', auth: true },
    // Courses
    { method: 'GET', path: '/api/courses', description: 'List courses' },
    { method: 'GET', path: '/api/courses/:id', description: 'Get course by ID' },
    { method: 'POST', path: '/api/courses/:id/enroll', description: 'Enroll in course', auth: true },
    // Mentors
    { method: 'GET', path: '/api/mentors', description: 'List mentors' },
    { method: 'GET', path: '/api/mentors/:id', description: 'Get mentor by ID' },
    { method: 'POST', path: '/api/mentors', description: 'Become a mentor', auth: true },
    { method: 'POST', path: '/api/mentors/:id/book', description: 'Book mentor session', auth: true },
    // Education
    { method: 'GET', path: '/api/education/providers', description: 'List education providers' },
    { method: 'GET', path: '/api/education/providers/:slug', description: 'Get provider by slug' },
    { method: 'POST', path: '/api/education/applications', description: 'Apply to provider', auth: true },
    { method: 'GET', path: '/api/education/applications', description: 'List my applications', auth: true },
    // Subscriptions
    { method: 'GET', path: '/api/subscriptions', description: 'Get current subscription', auth: true },
    { method: 'POST', path: '/api/subscriptions/checkout', description: 'Create checkout session', auth: true },
    { method: 'POST', path: '/api/subscriptions/portal', description: 'Create billing portal session', auth: true },
    // Notifications
    { method: 'GET', path: '/api/notifications', description: 'List notifications', auth: true },
    { method: 'PATCH', path: '/api/notifications/:id/read', description: 'Mark notification as read', auth: true },
    // Messages
    { method: 'GET', path: '/api/messages', description: 'List conversations', auth: true },
    { method: 'GET', path: '/api/messages/:id', description: 'Get conversation', auth: true },
    { method: 'POST', path: '/api/messages', description: 'Send message', auth: true },
    // AI
    { method: 'POST', path: '/api/ai/chat', description: 'AI chat', auth: true },
    { method: 'POST', path: '/api/ai/resume-optimize', description: 'AI resume optimizer', auth: true },
    { method: 'POST', path: '/api/ai/career-path', description: 'AI career path generator', auth: true },
    // Media
    { method: 'POST', path: '/api/media/upload', description: 'Upload file', auth: true },
    // Referrals
    { method: 'GET', path: '/api/referrals', description: 'Get referral stats', auth: true },
    { method: 'GET', path: '/api/referrals/list', description: 'List referrals', auth: true },
    // Admin (requires ADMIN role)
    { method: 'GET', path: '/api/admin/stats', description: 'Platform stats', auth: true },
    { method: 'GET', path: '/api/admin/users', description: 'List users', auth: true },
    { method: 'PATCH', path: '/api/admin/users/:id', description: 'Update user', auth: true },
    { method: 'GET', path: '/api/admin/audit-logs', description: 'List audit logs', auth: true },
    { method: 'GET', path: '/api/admin/content/posts', description: 'List posts for moderation', auth: true },
    { method: 'PATCH', path: '/api/admin/content/posts/:id', description: 'Moderate post', auth: true },
];
router.get('/', (_req, res) => {
    res.json({
        name: 'ATHENA Platform API',
        version: process.env.npm_package_version || '1.0.0',
        description: 'Career development and professional networking platform',
        baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
        endpoints,
        notes: {
            auth: 'Endpoints marked with auth=true require Bearer token in Authorization header',
            rateLimit: 'Some endpoints have stricter rate limits to prevent abuse',
            pagination: 'List endpoints support ?page=1&limit=20 query parameters',
            correlation: 'All requests return X-Request-Id header for support correlation',
        },
    });
});
exports.default = router;
//# sourceMappingURL=docs.routes.js.map