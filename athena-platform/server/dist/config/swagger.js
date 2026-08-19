"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'ATHENA Platform API',
            version: '1.0.0',
            description: `
ATHENA is an AI-powered career platform connecting job seekers, employers, mentors, and education providers.

## Authentication

Most endpoints require a Bearer token. Obtain one via \`POST /api/auth/login\`.

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Rate Limiting

API requests are rate-limited to 100 requests per 15 minutes per IP.

## Correlation IDs

All responses include an \`X-Request-Id\` header for tracing.
      `,
            contact: {
                name: 'ATHENA Support',
                email: 'support@athena.com',
            },
            license: {
                name: 'Proprietary',
            },
        },
        servers: [
            {
                url: process.env.API_BASE_URL || 'http://localhost:5000',
                description: 'API Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT access token from /api/auth/login',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error description' },
                        requestId: { type: 'string', example: 'abc123-def456' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        role: { type: 'string', enum: ['USER', 'CREATOR', 'MENTOR', 'EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'] },
                        persona: { type: 'string', enum: ['EARLY_CAREER', 'CAREER_CHANGER', 'RETURNER', 'ENTREPRENEUR', 'EMPLOYER', 'MENTOR'] },
                        avatar: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Job: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        city: { type: 'string' },
                        state: { type: 'string' },
                        type: { type: 'string', enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'CASUAL'] },
                        status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'FILLED'] },
                        salaryMin: { type: 'number', nullable: true },
                        salaryMax: { type: 'number', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
            },
            responses: {
                Unauthorized: {
                    description: 'Missing or invalid authentication token',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                        },
                    },
                },
                Forbidden: {
                    description: 'Insufficient permissions',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                        },
                    },
                },
                NotFound: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                        },
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Authentication and registration' },
            { name: 'Users', description: 'User profile management' },
            { name: 'Jobs', description: 'Job listings and applications' },
            { name: 'Posts', description: 'Community posts and feed' },
            { name: 'Courses', description: 'Learning content' },
            { name: 'Mentors', description: 'Mentorship matching' },
            { name: 'Organizations', description: 'Employer organizations' },
            { name: 'Subscriptions', description: 'Premium subscriptions' },
            { name: 'Admin', description: 'Admin-only endpoints' },
            { name: 'Health', description: 'Health and readiness probes' },
        ],
    },
    apis: ['./src/routes/*.ts', './src/index.ts'],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
//# sourceMappingURL=swagger.js.map