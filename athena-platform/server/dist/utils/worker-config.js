"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProductionRuntime = isProductionRuntime;
exports.isConfiguredEnv = isConfiguredEnv;
exports.resolveWorkerRedisUrl = resolveWorkerRedisUrl;
exports.validateWorkerStartupConfiguration = validateWorkerStartupConfiguration;
function isProductionRuntime() {
    return (process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production' ||
        process.env.RENDER_ENV === 'production');
}
function isConfiguredEnv(name) {
    const value = process.env[name];
    if (!value)
        return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized)
        return false;
    return ![
        'changeme',
        'change_me',
        'secret',
        'your-secret',
        'your_secret',
        'not_configured',
        'sk_test_not_configured',
    ].includes(normalized);
}
function canSimulateWorker(feature) {
    if (!isProductionRuntime())
        return true;
    return process.env.WORKER_ALLOW_SIMULATION === 'true' || process.env[`${feature}_ALLOW_SIMULATION`] === 'true';
}
function resolveWorkerRedisUrl() {
    if (isConfiguredEnv('REDIS_URL')) {
        return process.env.REDIS_URL.trim();
    }
    if (isProductionRuntime()) {
        throw new Error('REDIS_URL is required before background workers can start in production');
    }
    return process.env.REDIS_URL?.trim() || 'redis://localhost:6379';
}
function validateWorkerStartupConfiguration(options = {}) {
    const errors = [];
    const workersEnabled = process.env.ENABLE_WORKERS === 'true';
    const shouldValidateWorkers = workersEnabled || options.forceEnabled;
    if (!shouldValidateWorkers) {
        return { ok: true, errors: [] };
    }
    if (isProductionRuntime() && options.requireEnableFlag && !workersEnabled) {
        errors.push('ENABLE_WORKERS=true is required before background workers can start in production');
    }
    if (isProductionRuntime() && !isConfiguredEnv('REDIS_URL')) {
        errors.push('REDIS_URL is required before background workers can start in production');
    }
    if (isProductionRuntime() && !canSimulateWorker('VIDEO_PROCESSING') && !isConfiguredEnv('VIDEO_PROCESSOR_URL')) {
        errors.push('VIDEO_PROCESSOR_URL is required for production video worker processing');
    }
    if (isProductionRuntime() && !canSimulateWorker('PUSH_NOTIFICATION') && !isConfiguredEnv('PUSH_NOTIFICATION_PROVIDER_URL')) {
        errors.push('PUSH_NOTIFICATION_PROVIDER_URL is required for production push notification worker processing');
    }
    if (isProductionRuntime() && !canSimulateWorker('DATA_EXPORT') && !isConfiguredEnv('DATA_EXPORT_PROCESSOR_URL')) {
        errors.push('DATA_EXPORT_PROCESSOR_URL is required for production data export worker processing');
    }
    return { ok: errors.length === 0, errors };
}
//# sourceMappingURL=worker-config.js.map