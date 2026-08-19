type EnvLike = Record<string, string | undefined>;
declare const DATABASE_URL_KEYS: readonly ["DATABASE_URL", "NETLIFY_DB_URL", "NETLIFY_DATABASE_URL", "NEON_DATABASE_URL"];
declare const DIRECT_DATABASE_URL_KEYS: readonly ["DIRECT_DATABASE_URL", "DATABASE_DIRECT_URL", "DIRECT_URL", "NEON_DIRECT_DATABASE_URL"];
type DatabaseUrlSource = (typeof DATABASE_URL_KEYS)[number] | (typeof DIRECT_DATABASE_URL_KEYS)[number] | 'derived';
export interface ResolvedDatabaseUrls {
    databaseUrl?: string;
    databaseUrlSource?: DatabaseUrlSource;
    directDatabaseUrl?: string;
    directDatabaseUrlSource?: DatabaseUrlSource;
    directDatabaseUrlWasDerived: boolean;
}
export declare function isPostgresConnectionString(value: string): boolean;
export declare function isNeonConnectionString(value: string): boolean;
export declare function deriveDirectDatabaseUrl(databaseUrl?: string | null): string | undefined;
export declare function resolveDatabaseUrls(env?: EnvLike): ResolvedDatabaseUrls;
export declare function applyDatabaseUrlDefaults(env?: EnvLike): ResolvedDatabaseUrls;
export {};
//# sourceMappingURL=database-url.d.ts.map