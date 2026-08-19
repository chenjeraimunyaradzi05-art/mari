"use strict";
/**
 * Shared Hooks for ATHENA Platform
 * Step 82: Extract common logic into shared package
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPLICATION_STATUS_DISPLAY = exports.JOB_TYPES_DISPLAY = exports.EXPERIENCE_LEVELS = exports.COUNTRIES = exports.storage = exports.ValidationPatterns = void 0;
exports.validateEmail = validateEmail;
exports.validatePassword = validatePassword;
exports.formatCurrency = formatCurrency;
exports.formatNumber = formatNumber;
exports.formatCompactNumber = formatCompactNumber;
exports.formatDate = formatDate;
exports.formatRelativeTime = formatRelativeTime;
exports.formatSalaryRange = formatSalaryRange;
exports.truncate = truncate;
exports.slugify = slugify;
exports.capitalizeFirst = capitalizeFirst;
exports.titleCase = titleCase;
exports.initials = initials;
exports.groupBy = groupBy;
exports.uniqueBy = uniqueBy;
exports.sortBy = sortBy;
exports.debounce = debounce;
exports.throttle = throttle;
exports.retry = retry;
exports.buildQueryString = buildQueryString;
exports.parseQueryString = parseQueryString;
// ==========================================
// VALIDATION UTILITIES
// ==========================================
exports.ValidationPatterns = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+?[\d\s-()]{10,}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
    slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    postcode: {
        AU: /^\d{4}$/,
        UK: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
        US: /^\d{5}(-\d{4})?$/,
        NZ: /^\d{4}$/,
    },
};
function validateEmail(email) {
    return exports.ValidationPatterns.email.test(email);
}
function validatePassword(password) {
    const errors = [];
    if (password.length < 8)
        errors.push('Password must be at least 8 characters');
    if (!/[a-z]/.test(password))
        errors.push('Password must contain a lowercase letter');
    if (!/[A-Z]/.test(password))
        errors.push('Password must contain an uppercase letter');
    if (!/\d/.test(password))
        errors.push('Password must contain a number');
    if (!/[@$!%*?&]/.test(password))
        errors.push('Password must contain a special character');
    return { valid: errors.length === 0, errors };
}
// ==========================================
// FORMATTING UTILITIES
// ==========================================
function formatCurrency(amount, currency = 'AUD', locale = 'en-AU') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
    }).format(amount);
}
function formatNumber(num, options) {
    return new Intl.NumberFormat('en', options).format(num);
}
function formatCompactNumber(num) {
    if (num >= 1000000)
        return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000)
        return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}
function formatDate(date, format = 'medium', locale = 'en-AU') {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (format === 'relative') {
        return formatRelativeTime(d);
    }
    const dateFormatOptions = {
        short: { month: 'short', day: 'numeric' },
        medium: { year: 'numeric', month: 'short', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
    };
    const options = dateFormatOptions[format];
    return new Intl.DateTimeFormat(locale, options).format(d);
}
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);
    if (diffSec < 60)
        return 'just now';
    if (diffMin < 60)
        return `${diffMin}m ago`;
    if (diffHour < 24)
        return `${diffHour}h ago`;
    if (diffDay < 7)
        return `${diffDay}d ago`;
    if (diffWeek < 4)
        return `${diffWeek}w ago`;
    if (diffMonth < 12)
        return `${diffMonth}mo ago`;
    return `${diffYear}y ago`;
}
function formatSalaryRange(min, max, currency = 'AUD') {
    if (!min && !max)
        return 'Not specified';
    if (min && max) {
        return `${formatCurrency(min, currency)} - ${formatCurrency(max, currency)}`;
    }
    if (min)
        return `From ${formatCurrency(min, currency)}`;
    return `Up to ${formatCurrency(max, currency)}`;
}
// ==========================================
// STRING UTILITIES
// ==========================================
function truncate(str, maxLength, suffix = '...') {
    if (str.length <= maxLength)
        return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
}
function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
function titleCase(str) {
    return str
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
function initials(name, maxLength = 2) {
    return name
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase())
        .slice(0, maxLength)
        .join('');
}
// ==========================================
// ARRAY UTILITIES
// ==========================================
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const keyValue = String(item[key]);
        (result[keyValue] = result[keyValue] || []).push(item);
        return result;
    }, {});
}
function uniqueBy(array, key) {
    const seen = new Set();
    return array.filter((item) => {
        const value = item[key];
        if (seen.has(value))
            return false;
        seen.add(value);
        return true;
    });
}
function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal)
            return order === 'asc' ? -1 : 1;
        if (aVal > bVal)
            return order === 'asc' ? 1 : -1;
        return 0;
    });
}
// ==========================================
// DEBOUNCE / THROTTLE
// ==========================================
function debounce(func, wait) {
    let timeoutId = null;
    return function (...args) {
        if (timeoutId)
            clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), wait);
    };
}
function throttle(func, limit) {
    let inThrottle = false;
    return function (...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
async function retry(fn, options = {}) {
    const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2, shouldRetry = () => true, } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts || !shouldRetry(error)) {
                throw error;
            }
            const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
// ==========================================
// LOCAL STORAGE HELPERS
// ==========================================
exports.storage = {
    get(key, defaultValue) {
        if (typeof window === 'undefined')
            return defaultValue ?? null;
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue ?? null;
        }
        catch {
            return defaultValue ?? null;
        }
    },
    set(key, value) {
        if (typeof window === 'undefined')
            return;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        }
        catch {
            // Storage full or unavailable
        }
    },
    remove(key) {
        if (typeof window === 'undefined')
            return;
        localStorage.removeItem(key);
    },
    clear() {
        if (typeof window === 'undefined')
            return;
        localStorage.clear();
    },
};
// ==========================================
// URL UTILITIES
// ==========================================
function buildQueryString(params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
                value.forEach((v) => searchParams.append(key, String(v)));
            }
            else {
                searchParams.set(key, String(value));
            }
        }
    });
    return searchParams.toString();
}
function parseQueryString(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};
    params.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}
// ==========================================
// CONSTANTS
// ==========================================
exports.COUNTRIES = {
    AU: { name: 'Australia', code: 'AU', currency: 'AUD', locale: 'en-AU' },
    NZ: { name: 'New Zealand', code: 'NZ', currency: 'NZD', locale: 'en-NZ' },
    UK: { name: 'United Kingdom', code: 'GB', currency: 'GBP', locale: 'en-GB' },
    US: { name: 'United States', code: 'US', currency: 'USD', locale: 'en-US' },
    CA: { name: 'Canada', code: 'CA', currency: 'CAD', locale: 'en-CA' },
    SG: { name: 'Singapore', code: 'SG', currency: 'SGD', locale: 'en-SG' },
};
exports.EXPERIENCE_LEVELS = [
    { value: 'entry', label: 'Entry Level (0-2 years)' },
    { value: 'mid', label: 'Mid Level (3-5 years)' },
    { value: 'senior', label: 'Senior (6-10 years)' },
    { value: 'lead', label: 'Lead/Principal (10+ years)' },
    { value: 'executive', label: 'Executive' },
];
exports.JOB_TYPES_DISPLAY = {
    FULL_TIME: 'Full Time',
    PART_TIME: 'Part Time',
    CONTRACT: 'Contract',
    INTERNSHIP: 'Internship',
    CASUAL: 'Casual',
};
exports.APPLICATION_STATUS_DISPLAY = {
    PENDING: 'Pending Review',
    REVIEWING: 'Under Review',
    REVIEWED: 'Reviewed',
    SHORTLISTED: 'Shortlisted',
    INTERVIEW: 'Interview',
    OFFER: 'Offer Extended',
    OFFERED: 'Offer Extended',
    REJECTED: 'Not Selected',
    WITHDRAWN: 'Withdrawn',
};
