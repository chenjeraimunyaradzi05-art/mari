"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_url_1 = require("../utils/database-url");
describe('database URL helpers', () => {
    const pooledNeonUrl = 'postgresql://athena:secret@ep-autumn-tree-a7yj09fh-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&pool_timeout=15';
    it('derives the direct Neon host from a pooled Neon URL', () => {
        const directUrl = (0, database_url_1.deriveDirectDatabaseUrl)(pooledNeonUrl);
        expect(directUrl).toBe('postgresql://athena:secret@ep-autumn-tree-a7yj09fh.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15');
    });
    it('keeps an explicit direct URL ahead of derived fallbacks', () => {
        const resolved = (0, database_url_1.resolveDatabaseUrls)({
            DATABASE_URL: pooledNeonUrl,
            DIRECT_DATABASE_URL: 'postgresql://athena:secret@direct.example.com/neondb?sslmode=require',
        });
        expect(resolved.directDatabaseUrl).toBe('postgresql://athena:secret@direct.example.com/neondb?sslmode=require');
        expect(resolved.directDatabaseUrlWasDerived).toBe(false);
    });
    it('normalizes a canonical pooled Neon database URL for Prisma', () => {
        const env = {
            DATABASE_URL: 'postgresql://athena:secret@ep-autumn-tree-a7yj09fh-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
        };
        (0, database_url_1.applyDatabaseUrlDefaults)(env);
        expect(env.DATABASE_URL).toBe('postgresql://athena:secret@ep-autumn-tree-a7yj09fh-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15&pool_timeout=15');
        expect(env.DIRECT_DATABASE_URL).toBe('postgresql://athena:secret@ep-autumn-tree-a7yj09fh.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15');
    });
    it('applies Netlify and Neon aliases to the canonical Prisma env keys', () => {
        const env = {
            NEON_DATABASE_URL: pooledNeonUrl,
        };
        const resolved = (0, database_url_1.applyDatabaseUrlDefaults)(env);
        expect(resolved.directDatabaseUrlWasDerived).toBe(true);
        expect(env.DATABASE_URL).toBe('postgresql://athena:secret@ep-autumn-tree-a7yj09fh-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&pool_timeout=15&channel_binding=require&connect_timeout=15');
        expect(env.DIRECT_DATABASE_URL).toContain('ep-autumn-tree-a7yj09fh.ap-southeast-2.aws.neon.tech');
        expect(env.DIRECT_DATABASE_URL).not.toContain('-pooler.');
        expect(env.DIRECT_DATABASE_URL).toContain('channel_binding=require');
        expect(env.DIRECT_DATABASE_URL).toContain('connect_timeout=15');
        expect(env.ATHENA_DIRECT_DATABASE_URL_DERIVED).toBe('true');
    });
});
//# sourceMappingURL=database-url.test.js.map