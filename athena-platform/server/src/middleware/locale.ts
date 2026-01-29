import { NextFunction, Request, Response } from 'express';
import { SupportedLocale, SUPPORTED_LOCALES } from '../services/i18n.service';

const DEFAULT_LOCALE: SupportedLocale = 'en';

function normalizeLocale(locale?: string | string[] | null): SupportedLocale {
  if (!locale) return DEFAULT_LOCALE;

  const value = Array.isArray(locale) ? locale[0] : locale;
  if (!value) return DEFAULT_LOCALE;

  const normalized = value.trim();
  if (!normalized) return DEFAULT_LOCALE;

  if (SUPPORTED_LOCALES.includes(normalized as SupportedLocale)) {
    return normalized as SupportedLocale;
  }

  const base = normalized.split('-')[0];
  if (SUPPORTED_LOCALES.includes(base as SupportedLocale)) {
    return base as SupportedLocale;
  }

  return DEFAULT_LOCALE;
}

function parseAcceptLanguage(header?: string): SupportedLocale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .split(',')
    .map((part) => part.trim().split(';')[0])
    .filter(Boolean);

  for (const candidate of candidates) {
    const resolved = normalizeLocale(candidate);
    if (resolved !== DEFAULT_LOCALE || candidate.startsWith('en')) {
      return resolved;
    }
  }

  return DEFAULT_LOCALE;
}

export function localeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const queryLocale = req.query.locale as string | undefined;
  const headerLocale = req.headers['x-locale'] as string | undefined;
  const acceptLanguage = req.headers['accept-language'] as string | undefined;

  const resolved = queryLocale
    ? normalizeLocale(queryLocale)
    : headerLocale
      ? normalizeLocale(headerLocale)
      : parseAcceptLanguage(acceptLanguage);
  (req as any).locale = resolved;
  next();
}
