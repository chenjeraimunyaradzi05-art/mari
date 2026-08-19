"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const worker_config_1 = require("../utils/worker-config");
(0, globals_1.describe)('validateWorkerStartupConfiguration', () => {
    const originalEnv = { ...process.env };
    (0, globals_1.beforeEach)(() => {
        process.env = { ...originalEnv };
    });
    (0, globals_1.afterEach)(() => {
        process.env = { ...originalEnv };
    });
    (0, globals_1.it)('requires Redis in production when workers are enabled', () => {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_WORKERS = 'true';
        const result = (0, worker_config_1.validateWorkerStartupConfiguration)();
        (0, globals_1.expect)(result.ok).toBe(false);
        (0, globals_1.expect)(result.errors).toEqual(globals_1.expect.arrayContaining([globals_1.expect.stringContaining('REDIS_URL')]));
    });
    (0, globals_1.it)('requires provider URLs when workers are enabled and simulation is disabled in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_WORKERS = 'true';
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.WORKER_ALLOW_SIMULATION = 'false';
        process.env.VIDEO_PROCESSING_ALLOW_SIMULATION = 'false';
        process.env.PUSH_NOTIFICATION_ALLOW_SIMULATION = 'false';
        process.env.DATA_EXPORT_ALLOW_SIMULATION = 'false';
        const result = (0, worker_config_1.validateWorkerStartupConfiguration)();
        (0, globals_1.expect)(result.ok).toBe(false);
        (0, globals_1.expect)(result.errors).toEqual(globals_1.expect.arrayContaining([
            globals_1.expect.stringContaining('VIDEO_PROCESSOR_URL'),
            globals_1.expect.stringContaining('PUSH_NOTIFICATION_PROVIDER_URL'),
            globals_1.expect.stringContaining('DATA_EXPORT_PROCESSOR_URL'),
        ]));
    });
    (0, globals_1.it)('passes when production workers are explicitly configured', () => {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_WORKERS = 'true';
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.VIDEO_PROCESSOR_URL = 'https://processor.example.test';
        process.env.PUSH_NOTIFICATION_PROVIDER_URL = 'https://push.example.test';
        process.env.DATA_EXPORT_PROCESSOR_URL = 'https://export.example.test';
        process.env.WORKER_ALLOW_SIMULATION = 'false';
        process.env.VIDEO_PROCESSING_ALLOW_SIMULATION = 'false';
        process.env.PUSH_NOTIFICATION_ALLOW_SIMULATION = 'false';
        process.env.DATA_EXPORT_ALLOW_SIMULATION = 'false';
        const result = (0, worker_config_1.validateWorkerStartupConfiguration)();
        (0, globals_1.expect)(result.ok).toBe(true);
        (0, globals_1.expect)(result.errors).toEqual([]);
    });
    (0, globals_1.it)('requires the enable flag for dedicated production worker startup', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ENABLE_WORKERS;
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.VIDEO_PROCESSOR_URL = 'https://processor.example.test';
        process.env.PUSH_NOTIFICATION_PROVIDER_URL = 'https://push.example.test';
        process.env.DATA_EXPORT_PROCESSOR_URL = 'https://export.example.test';
        const result = (0, worker_config_1.validateWorkerStartupConfiguration)({
            forceEnabled: true,
            requireEnableFlag: true,
        });
        (0, globals_1.expect)(result.ok).toBe(false);
        (0, globals_1.expect)(result.errors).toEqual(globals_1.expect.arrayContaining([globals_1.expect.stringContaining('ENABLE_WORKERS=true')]));
    });
    (0, globals_1.it)('does not fall back to localhost Redis in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.REDIS_URL;
        (0, globals_1.expect)(() => (0, worker_config_1.resolveWorkerRedisUrl)()).toThrow(/REDIS_URL/);
    });
    (0, globals_1.it)('allows localhost Redis fallback outside production', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.REDIS_URL;
        (0, globals_1.expect)((0, worker_config_1.resolveWorkerRedisUrl)()).toBe('redis://localhost:6379');
    });
});
//# sourceMappingURL=worker-config.test.js.map