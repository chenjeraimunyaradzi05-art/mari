import winston from 'winston';
import {
  SENSITIVE_KEY,
  USER_AGENT_KEY,
  USER_AGENT_MAX_LENGTH,
  REDACTED,
  clip,
  clipUserAgent,
  redactSensitive,
  scrubText,
} from './log-scrub';

// What the scrubber offers is re-exported here so that the code that logs has
// one place to look. The scrubber itself lives in log-scrub.ts, which depends
// on nothing, so that the error-report hooks can use it without the logger.
export { USER_AGENT_MAX_LENGTH, clip, clipUserAgent, redactSensitive, scrubText };

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const redact = winston.format((info) => {
  const record = info as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === 'level' || key === 'timestamp') continue;
    // The message is the one field that is not matched by key, but it is text
    // like any other: `Sent reference request to her@example.org` is a message.
    if (key === 'message') {
      if (typeof record.message === 'string') record.message = scrubText(record.message);
      continue;
    }
    record[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : USER_AGENT_KEY.test(key) && typeof record[key] === 'string'
        ? clipUserAgent(record[key])
        : redactSensitive(record[key]);
  }
  return info;
});

// Pretty format for development. errors() runs first, so an Error given to
// the logger arrives with its message and stack as plain fields, which is the
// shape redact() can clean.
export const developmentFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  redact(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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
export const productionFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  redact(),
  winston.format.timestamp(),
  winston.format.json()
);

/**
 * The development log files are capped: they used to grow without limit, and
 * two of them reached 2.4 GB each inside a synced folder. Five 5 MB files per
 * log, the oldest dropped, is plenty for a day's work. Production writes to
 * the console only; how long the host keeps that is the host's plan (see the
 * on-call runbook).
 */
const DEV_FILE_LIMITS = { maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true };

export const logger = winston.createLogger({
  level: isProd ? 'info' : isTest ? 'error' : 'debug',
  format: isProd ? productionFormat : developmentFormat,
  transports: isTest
    ? [new winston.transports.Console({ silent: true })]
    : [
        new winston.transports.Console(),
        ...(isProd
          ? []
          : [
              new winston.transports.File({ filename: 'logs/error.log', level: 'error', ...DEV_FILE_LIMITS }),
              new winston.transports.File({ filename: 'logs/combined.log', ...DEV_FILE_LIMITS }),
            ]),
      ],
});
