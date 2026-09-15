import winston from 'winston';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Keys whose values never belong in a log line. A log is copied, shipped
 * and searched by more people than the database is, so a password or token
 * that lands in one has left the building. Matched on the key, whatever
 * the depth, before any transport sees the record.
 */
const SENSITIVE_KEY =
  /^(password|passwordHash|newPassword|currentPassword|confirmPassword|token|accessToken|refreshToken|idToken|credential|credentials|authorization|cookie|cookies|set-cookie|secret|clientSecret|client_secret|apiKey|api_key|twoFactorCode|twoFactorSecret|recoveryCode|recoveryCodes|otp|privateKey|private_key|jwt|sessionToken|resetToken|verificationToken)$/i;

const REDACTED = '[redacted]';
const MAX_DEPTH = 8;

export function redactSensitive(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH) return '[depth]';
  // Errors, dates and buffers are kept whole: walking their keys would empty them.
  if (value instanceof Error || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(item, depth + 1, seen);
  }
  return out;
}

const redact = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp') continue;
    (info as Record<string, unknown>)[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : redactSensitive((info as Record<string, unknown>)[key]);
  }
  return info;
});

// Pretty format for development
const devFormat = winston.format.combine(
  redact(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Structured JSON format for production (machine-readable)
const prodFormat = winston.format.combine(
  redact(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: isProd ? 'info' : isTest ? 'error' : 'debug',
  format: isProd ? prodFormat : devFormat,
  transports: isTest
    ? [new winston.transports.Console({ silent: true })]
    : [
        new winston.transports.Console(),
        ...(isProd
          ? []
          : [
              new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
              new winston.transports.File({ filename: 'logs/combined.log' }),
            ]),
      ],
});
