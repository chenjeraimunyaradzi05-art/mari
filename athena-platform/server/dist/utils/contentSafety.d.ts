export declare const CONTENT_LIMITS: {
    readonly directMessage: 4000;
    readonly groupMessage: 4000;
    readonly post: 10000;
    readonly shareTitle: 200;
    readonly shareDescription: 1000;
    readonly shareMessage: 2000;
    readonly comment: 2000;
    readonly channelName: 100;
    readonly channelDescription: 2000;
    readonly channelMessage: 5000;
    readonly videoTitle: 200;
    readonly videoDescription: 5000;
    readonly shortLabel: 120;
};
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
export declare function normalizeUserText(raw: unknown, options: TextOptions): string;
export declare function normalizeOptionalUserText(raw: unknown, options: TextOptions): string | undefined;
export declare function normalizeSafeUrl(raw: unknown, options?: UrlOptions): string;
export declare function normalizeMediaUrls(raw: unknown, field?: string, maxCount?: number): string[] | undefined;
export declare function normalizeMessageAttachments(raw: unknown, field?: string, maxCount?: number): SanitizedAttachment[] | undefined;
export declare function normalizeStringList(raw: unknown, field: string, maxCount?: number, maxItemLength?: number): string[];
export declare function parseBoundedInteger(raw: unknown, field: string, fallback: number, min: number, max: number): number;
export declare function parseOptionalDate(raw: unknown, field: string): Date | undefined;
export {};
//# sourceMappingURL=contentSafety.d.ts.map