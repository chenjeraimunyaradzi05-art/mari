"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectWithRetry = connectWithRetry;
const serverless_1 = require("@neondatabase/serverless");
const client_1 = require("@prisma/client");
const adapter_neon_1 = require("@prisma/adapter-neon");
const ws_1 = __importDefault(require("ws"));
const database_url_1 = require("./database-url");
const resolvedDatabaseUrls = (0, database_url_1.applyDatabaseUrlDefaults)();
const prismaLog = process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'];
const globalForPrisma = globalThis;
function createPrismaClient() {
    if (resolvedDatabaseUrls.databaseUrl && (0, database_url_1.isNeonConnectionString)(resolvedDatabaseUrls.databaseUrl)) {
        serverless_1.neonConfig.webSocketConstructor = ws_1.default;
        const adapter = new adapter_neon_1.PrismaNeon({ connectionString: resolvedDatabaseUrls.databaseUrl });
        return new client_1.PrismaClient({
            adapter,
            log: prismaLog,
        });
    }
    return new client_1.PrismaClient({
        log: prismaLog,
    });
}
exports.prisma = globalForPrisma.prisma ??
    createPrismaClient();
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prisma;
async function connectWithRetry(maxAttempts = 5, baseDelay = 500) {
    let attempt = 0;
    while (attempt < maxAttempts) {
        try {
            await exports.prisma.$connect();
            return;
        }
        catch (err) {
            attempt++;
            const delay = baseDelay * Math.pow(2, attempt - 1);
            // eslint-disable-next-line no-console
            console.warn(`Prisma connection attempt ${attempt} failed. Retrying in ${delay}ms...`);
            if (attempt >= maxAttempts)
                throw err;
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}
//# sourceMappingURL=prisma.js.map