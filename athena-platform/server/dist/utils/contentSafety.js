"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_LIMITS = void 0;
exports.normalizeUserText = normalizeUserText;
exports.normalizeOptionalUserText = normalizeOptionalUserText;
exports.normalizeSafeUrl = normalizeSafeUrl;
exports.normalizeMediaUrls = normalizeMediaUrls;
exports.normalizeMessageAttachments = normalizeMessageAttachments;
exports.normalizeStringList = normalizeStringList;
exports.parseBoundedInteger = parseBoundedInteger;
exports.parseOptionalDate = parseOptionalDate;
const errorHandler_1 = require("../middleware/errorHandler");
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
exports.CONTENT_LIMITS = {
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
};
function fieldLabel(field = 'value') {
    return field;
}
function normalizeUserText(raw, options) {
    const field = fieldLabel(options.field);
    if (typeof raw !== 'string') {
        throw new errorHandler_1.ApiError(400, `${field} must be text`);
    }
    const normalized = raw
        .replace(/\r\n?/g, '\n')
        .replace(CONTROL_CHARS, '')
        .trim();
    if (!options.allowEmpty && normalized.length === 0) {
        throw new errorHandler_1.ApiError(400, `${field} is required`);
    }
    if (normalized.length > options.maxLength) {
        throw new errorHandler_1.ApiError(400, `${field} must be ${options.maxLength} characters or fewer`);
    }
    return normalized;
}
function normalizeOptionalUserText(raw, options) {
    if (raw === undefined || raw === null || raw === '') {
        return undefined;
    }
    return normalizeUserText(raw, { ...options, allowEmpty: true }) || undefined;
}
function isLocalDevelopmentHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
function normalizeSafeUrl(raw, options = {}) {
    const field = fieldLabel(options.field || 'url');
    if (typeof raw !== 'string') {
        throw new errorHandler_1.ApiError(400, `${field} must be a URL`);
    }
    const value = raw.trim();
    if (!value) {
        throw new errorHandler_1.ApiError(400, `${field} is required`);
    }
    if (value.length > 2048) {
        throw new errorHandler_1.ApiError(400, `${field} must be 2048 characters or fewer`);
    }
    if (options.allowRelativeUploads && PUBLIC_UPLOAD_PATH.test(value)) {
        return value;
    }
    if (options.allowAuthenticatedMedia && AUTH_MEDIA_PATH.test(value)) {
        return value;
    }
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new errorHandler_1.ApiError(400, `${field} must be a valid URL`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new errorHandler_1.ApiError(400, `${field} must use http or https`);
    }
    if (url.username || url.password) {
        throw new errorHandler_1.ApiError(400, `${field} must not contain embedded credentials`);
    }
    const requireHttps = options.requireHttpsInProduction ?? true;
    if (requireHttps && process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !isLocalDevelopmentHost(url.hostname)) {
        throw new errorHandler_1.ApiError(400, `${field} must use https in production`);
    }
    return url.toString();
}
function normalizeMediaUrls(raw, field = 'mediaUrls', maxCount = 10) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (!Array.isArray(raw)) {
        throw new errorHandler_1.ApiError(400, `${field} must be an array`);
    }
    if (raw.length > maxCount) {
        throw new errorHandler_1.ApiError(400, `${field} supports up to ${maxCount} items`);
    }
    return raw.map((url, index) => normalizeSafeUrl(url, {
        field: `${field}[${index}]`,
        allowRelativeUploads: true,
    }));
}
function normalizeUploadKey(raw, field) {
    if (raw === undefined || raw === null || raw === '') {
        return undefined;
    }
    if (typeof raw !== 'string') {
        throw new errorHandler_1.ApiError(400, `${field} must be text`);
    }
    const key = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (key.length > 512 || !UPLOAD_KEY.test(key) || key.includes('..')) {
        throw new errorHandler_1.ApiError(400, `${field} is not a valid upload key`);
    }
    return key;
}
function normalizeMessageAttachments(raw, field = 'attachments', maxCount = 5) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (!Array.isArray(raw)) {
        throw new errorHandler_1.ApiError(400, `${field} must be an array`);
    }
    if (raw.length > maxCount) {
        throw new errorHandler_1.ApiError(400, `${field} supports up to ${maxCount} items`);
    }
    const attachments = raw.map((item, index) => {
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
            throw new errorHandler_1.ApiError(400, `${field}[${index}] must be an attachment object`);
        }
        const attachment = item;
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
            maxLength: exports.CONTENT_LIMITS.shortLabel,
            allowEmpty: true,
        });
        const contentType = attachment.contentType === undefined
            ? undefined
            : normalizeUserText(attachment.contentType, {
                field: `${field}[${index}].contentType`,
                maxLength: 120,
            }).toLowerCase();
        if (contentType && !SAFE_ATTACHMENT_CONTENT_TYPES.has(contentType)) {
            throw new errorHandler_1.ApiError(400, `${field}[${index}].contentType is not supported`);
        }
        const size = attachment.size === undefined ? undefined : Number(attachment.size);
        if (size !== undefined && (!Number.isInteger(size) || size < 0 || size > 25 * 1024 * 1024)) {
            throw new errorHandler_1.ApiError(400, `${field}[${index}].size is invalid`);
        }
        if (!url && !key) {
            throw new errorHandler_1.ApiError(400, `${field}[${index}] requires a url or key`);
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
function normalizeStringList(raw, field, maxCount = 20, maxItemLength = 64) {
    if (raw === undefined || raw === null) {
        return [];
    }
    if (!Array.isArray(raw)) {
        throw new errorHandler_1.ApiError(400, `${field} must be an array`);
    }
    if (raw.length > maxCount) {
        throw new errorHandler_1.ApiError(400, `${field} supports up to ${maxCount} items`);
    }
    return raw.map((item, index) => normalizeUserText(item, {
        field: `${field}[${index}]`,
        maxLength: maxItemLength,
    }));
}
function parseBoundedInteger(raw, field, fallback, min, max) {
    const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
function parseOptionalDate(raw, field) {
    if (raw === undefined || raw === null || raw === '') {
        return undefined;
    }
    if (typeof raw !== 'string') {
        throw new errorHandler_1.ApiError(400, `${field} must be a date string`);
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        throw new errorHandler_1.ApiError(400, `${field} must be a valid date`);
    }
    return date;
}
//# sourceMappingURL=contentSafety.js.map