import { ApiError } from '../middleware/errorHandler';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g;
const PUBLIC_UPLOAD_PATH = /^\/uploads\/(?:avatars|covers|posts|videos)\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;
const AUTH_MEDIA_PATH = /^\/api\/media\/local\/(?:documents|resumes)\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;
const UPLOAD_KEY = /^(?:avatars|covers|posts|videos|documents|resumes)\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

const SAFE_ATTACHMENT_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const CONTENT_LIMITS = {
  directMessage: 4000,
  groupMessage: 4000,
  post: 10000,
  shareTitle: 200,
  shareDescription: 1000,
  shareMessage: 2000,
  comment: 2000,
  channelName: 100,
  channelDescription: 2000,
  channelMessage: 5000,
  videoTitle: 200,
  videoDescription: 5000,
  shortLabel: 120,
} as const;

export type SanitizedAttachment = {
  url?: string;
  key?: string;
  name?: string;
  contentType?: string;
  size?: number;
};

type TextOptions = {
  field?: string;
  maxLength: number;
  allowEmpty?: boolean;
};

type UrlOptions = {
  field?: string;
  allowRelativeUploads?: boolean;
  allowAuthenticatedMedia?: boolean;
  requireHttpsInProduction?: boolean;
};

function fieldLabel(field = 'value') {
  return field;
}

export function normalizeUserText(raw: unknown, options: TextOptions): string {
  const field = fieldLabel(options.field);
  if (typeof raw !== 'string') {
    throw new ApiError(400, `${field} must be text`);
  }

  const normalized = raw
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .trim();

  if (!options.allowEmpty && normalized.length === 0) {
    throw new ApiError(400, `${field} is required`);
  }

  if (normalized.length > options.maxLength) {
    throw new ApiError(400, `${field} must be ${options.maxLength} characters or fewer`);
  }

  return normalized;
}

export function normalizeOptionalUserText(raw: unknown, options: TextOptions): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  return normalizeUserText(raw, { ...options, allowEmpty: true }) || undefined;
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function normalizeSafeUrl(raw: unknown, options: UrlOptions = {}): string {
  const field = fieldLabel(options.field || 'url');
  if (typeof raw !== 'string') {
    throw new ApiError(400, `${field} must be a URL`);
  }

  const value = raw.trim();
  if (!value) {
    throw new ApiError(400, `${field} is required`);
  }

  if (value.length > 2048) {
    throw new ApiError(400, `${field} must be 2048 characters or fewer`);
  }

  if (options.allowRelativeUploads && PUBLIC_UPLOAD_PATH.test(value)) {
    return value;
  }

  if (options.allowAuthenticatedMedia && AUTH_MEDIA_PATH.test(value)) {
    return value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, `${field} must be a valid URL`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ApiError(400, `${field} must use http or https`);
  }

  if (url.username || url.password) {
    throw new ApiError(400, `${field} must not contain embedded credentials`);
  }

  const requireHttps = options.requireHttpsInProduction ?? true;
  if (requireHttps && process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !isLocalDevelopmentHost(url.hostname)) {
    throw new ApiError(400, `${field} must use https in production`);
  }

  return url.toString();
}

export function normalizeMediaUrls(raw: unknown, field = 'mediaUrls', maxCount = 10): string[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new ApiError(400, `${field} must be an array`);
  }

  if (raw.length > maxCount) {
    throw new ApiError(400, `${field} supports up to ${maxCount} items`);
  }

  return raw.map((url, index) =>
    normalizeSafeUrl(url, {
      field: `${field}[${index}]`,
      allowRelativeUploads: true,
    })
  );
}

function normalizeUploadKey(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw !== 'string') {
    throw new ApiError(400, `${field} must be text`);
  }

  const key = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (key.length > 512 || !UPLOAD_KEY.test(key) || key.includes('..')) {
    throw new ApiError(400, `${field} is not a valid upload key`);
  }

  return key;
}

export function normalizeMessageAttachments(raw: unknown, field = 'attachments', maxCount = 5): SanitizedAttachment[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new ApiError(400, `${field} must be an array`);
  }

  if (raw.length > maxCount) {
    throw new ApiError(400, `${field} supports up to ${maxCount} items`);
  }

  const attachments = raw.map((item, index): SanitizedAttachment => {
    if (typeof item === 'string') {
      return {
        url: normalizeSafeUrl(item, {
          field: `${field}[${index}].url`,
          allowRelativeUploads: true,
          allowAuthenticatedMedia: true,
        }),
      };
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ApiError(400, `${field}[${index}] must be an attachment object`);
    }

    const attachment = item as Record<string, unknown>;
    const url = attachment.url === undefined
      ? undefined
      : normalizeSafeUrl(attachment.url, {
          field: `${field}[${index}].url`,
          allowRelativeUploads: true,
          allowAuthenticatedMedia: true,
        });
    const key = normalizeUploadKey(attachment.key, `${field}[${index}].key`);
    const name = normalizeOptionalUserText(attachment.name, {
      field: `${field}[${index}].name`,
      maxLength: CONTENT_LIMITS.shortLabel,
      allowEmpty: true,
    });

    const contentType = attachment.contentType === undefined
      ? undefined
      : normalizeUserText(attachment.contentType, {
          field: `${field}[${index}].contentType`,
          maxLength: 120,
        }).toLowerCase();

    if (contentType && !SAFE_ATTACHMENT_CONTENT_TYPES.has(contentType)) {
      throw new ApiError(400, `${field}[${index}].contentType is not supported`);
    }

    const size = attachment.size === undefined ? undefined : Number(attachment.size);
    if (size !== undefined && (!Number.isInteger(size) || size < 0 || size > 25 * 1024 * 1024)) {
      throw new ApiError(400, `${field}[${index}].size is invalid`);
    }

    if (!url && !key) {
      throw new ApiError(400, `${field}[${index}] requires a url or key`);
    }

    return {
      ...(url ? { url } : {}),
      ...(key ? { key } : {}),
      ...(name ? { name } : {}),
      ...(contentType ? { contentType } : {}),
      ...(size !== undefined ? { size } : {}),
    };
  });

  return attachments.length > 0 ? attachments : undefined;
}

export function normalizeStringList(raw: unknown, field: string, maxCount = 20, maxItemLength = 64): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new ApiError(400, `${field} must be an array`);
  }

  if (raw.length > maxCount) {
    throw new ApiError(400, `${field} supports up to ${maxCount} items`);
  }

  return raw.map((item, index) =>
    normalizeUserText(item, {
      field: `${field}[${index}]`,
      maxLength: maxItemLength,
    })
  );
}

export function parseBoundedInteger(raw: unknown, field: string, fallback: number, min: number, max: number): number {
  const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function parseOptionalDate(raw: unknown, field: string): Date | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw !== 'string') {
    throw new ApiError(400, `${field} must be a date string`);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${field} must be a valid date`);
  }

  return date;
}
