export declare function getAllowedOrigins(): string[];
export declare function arePreviewOriginsEnabled(): boolean;
export declare function isCorsOriginAllowed(origin: string | undefined): boolean;
export declare function getTrustedOriginFromHeaders(headers: {
    origin?: string | string[];
    referer?: string | string[];
}): string | undefined;
//# sourceMappingURL=origins.d.ts.map