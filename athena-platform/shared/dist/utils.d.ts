/**
 * Shared Hooks for ATHENA Platform
 * Step 82: Extract common logic into shared package
 */
export declare const ValidationPatterns: {
    email: RegExp;
    phone: RegExp;
    password: RegExp;
    url: RegExp;
    slug: RegExp;
    postcode: {
        AU: RegExp;
        UK: RegExp;
        US: RegExp;
        NZ: RegExp;
    };
};
export declare function validateEmail(email: string): boolean;
export declare function validatePassword(password: string): {
    valid: boolean;
    errors: string[];
};
export declare function formatCurrency(amount: number, currency?: string, locale?: string): string;
export declare function formatNumber(num: number, options?: Intl.NumberFormatOptions): string;
export declare function formatCompactNumber(num: number): string;
export declare function formatDate(date: string | Date, format?: 'short' | 'medium' | 'long' | 'relative', locale?: string): string;
export declare function formatRelativeTime(date: Date): string;
export declare function formatSalaryRange(min?: number, max?: number, currency?: string): string;
export declare function truncate(str: string, maxLength: number, suffix?: string): string;
export declare function slugify(str: string): string;
export declare function capitalizeFirst(str: string): string;
export declare function titleCase(str: string): string;
export declare function initials(name: string, maxLength?: number): string;
export declare function groupBy<T>(array: T[], key: keyof T): Record<string, T[]>;
export declare function uniqueBy<T>(array: T[], key: keyof T): T[];
export declare function sortBy<T>(array: T[], key: keyof T, order?: 'asc' | 'desc'): T[];
export declare function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
export declare function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void;
export interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: any) => boolean;
}
export declare function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
export declare const storage: {
    get<T>(key: string, defaultValue?: T): T | null;
    set<T>(key: string, value: T): void;
    remove(key: string): void;
    clear(): void;
};
export declare function buildQueryString(params: Record<string, any>): string;
export declare function parseQueryString(queryString: string): Record<string, string>;
export declare const COUNTRIES: {
    AU: {
        name: string;
        code: string;
        currency: string;
        locale: string;
    };
    NZ: {
        name: string;
        code: string;
        currency: string;
        locale: string;
    };
    UK: {
        name: string;
        code: string;
        currency: string;
        locale: string;
    };
    US: {
        name: string;
        code: string;
        currency: string;
        locale: string;
    };
    CA: {
        name: string;
        code: string;
        currency: string;
        locale: string;
    };
    SG: {
        name: string;
        code: string;
        currency: string;
        locale: string;
    };
};
export declare const EXPERIENCE_LEVELS: {
    value: string;
    label: string;
}[];
export declare const JOB_TYPES_DISPLAY: {
    FULL_TIME: string;
    PART_TIME: string;
    CONTRACT: string;
    INTERNSHIP: string;
    CASUAL: string;
};
export declare const APPLICATION_STATUS_DISPLAY: {
    PENDING: string;
    REVIEWING: string;
    REVIEWED: string;
    SHORTLISTED: string;
    INTERVIEW: string;
    OFFER: string;
    OFFERED: string;
    REJECTED: string;
    WITHDRAWN: string;
};
//# sourceMappingURL=utils.d.ts.map