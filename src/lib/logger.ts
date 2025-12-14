import { z } from 'zod';

/**
 * Structured Logging Utility
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const logEntrySchema = z.object({
  timestamp: z.string().datetime(),
  level: z.nativeEnum(LogLevel),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  error: z.any().optional(), // Can't easily validate Error objects with Zod
});

type LogEntry = z.infer<typeof logEntrySchema>;

class Logger {
  private isDev = process.env.NODE_ENV !== 'production';

  private formatLog(entry: LogEntry): string {
    // Validate with Zod (runtime check)
    const result = logEntrySchema.safeParse(entry);
    if (!result.success) {
      console.error('Invalid log entry:', result.error);
    }

    return JSON.stringify({
      ...entry,
      error: entry.error instanceof Error ? {
        message: entry.error.message,
        stack: entry.error.stack,
      } : entry.error,
    });
  }

  debug(message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      context,
    };
    if (this.isDev) console.log(this.formatLog(entry));
  }

  info(message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      context,
    };
    console.log(this.formatLog(entry));
  }

  warn(message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      context,
    };
    console.warn(this.formatLog(entry));
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context,
      error,
    };
    console.error(this.formatLog(entry));
  }
}

export const logger = new Logger();
