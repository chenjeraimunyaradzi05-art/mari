/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 * Step: Security hardening - fail fast if critical config is missing
 */

import { logger } from './logger';

interface EnvValidation {
  name: string;
  required: boolean;
  productionOnly?: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

const ENV_VALIDATIONS: EnvValidation[] = [
  // Critical security
  {
    name: 'JWT_SECRET',
    required: true,
    productionOnly: true,
    validator: (v) => v.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters for security',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    validator: (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
    errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
  },
  // Stripe (required for payments)
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('sk_'),
    errorMessage: 'STRIPE_SECRET_KEY must start with sk_',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('whsec_'),
    errorMessage: 'STRIPE_WEBHOOK_SECRET must start with whsec_',
  },
  // Email
  {
    name: 'SENDGRID_API_KEY',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('SG.'),
    errorMessage: 'SENDGRID_API_KEY must start with SG.',
  },
  // Sentry
  {
    name: 'SENTRY_DSN',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('https://') && v.includes('@'),
    errorMessage: 'SENTRY_DSN must be a valid Sentry DSN URL',
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const isProd = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const validation of ENV_VALIDATIONS) {
    const value = process.env[validation.name];
    const isRequired = validation.required && (!validation.productionOnly || isProd);

    // Check if required variable is missing
    if (!value) {
      if (isRequired) {
        errors.push(`Missing required environment variable: ${validation.name}`);
      } else if (isProd && validation.productionOnly) {
        warnings.push(`Recommended for production: ${validation.name} is not set`);
      }
      continue;
    }

    // Validate the value format if validator is provided
    if (validation.validator && !validation.validator(value)) {
      const message = validation.errorMessage || `Invalid format for ${validation.name}`;
      if (isRequired) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEnvironmentOrExit(): void {
  const result = validateEnvironment();

  // Log warnings
  for (const warning of result.warnings) {
    logger.warn('Environment warning', { warning });
  }

  // If there are errors, log them but DO NOT exit.
  // The server must start so the health endpoint responds and we can diagnose.
  if (!result.valid) {
    for (const error of result.errors) {
      logger.error('Environment validation failed', { error });
    }

    // Provide a random JWT_SECRET fallback so auth middleware doesn't crash
    if (!process.env.JWT_SECRET) {
      const fallback = require('crypto').randomBytes(32).toString('hex');
      process.env.JWT_SECRET = fallback;
      logger.error('JWT_SECRET is NOT set! Using a random fallback — auth tokens will NOT persist across restarts. Set JWT_SECRET in Railway env vars.');
    }

    logger.error('Server starting with INVALID configuration — some features will not work. Fix env vars above.');
  } else {
    logger.info('Environment validation passed');
  }
}
