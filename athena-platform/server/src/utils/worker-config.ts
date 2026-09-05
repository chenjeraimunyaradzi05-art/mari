export interface WorkerStartupValidationResult {
  ok: boolean;
  errors: string[];
}

export interface WorkerStartupValidationOptions {
  forceEnabled?: boolean;
  requireEnableFlag?: boolean;
}

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.RENDER_ENV === 'production'
  );
}

export function isConfiguredEnv(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

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

function canSimulateWorker(feature: string): boolean {
  if (!isProductionRuntime()) return true;
  return process.env.WORKER_ALLOW_SIMULATION === 'true' || process.env[`${feature}_ALLOW_SIMULATION`] === 'true';
}

export function resolveWorkerRedisUrl(): string {
  if (isConfiguredEnv('REDIS_URL')) {
    return process.env.REDIS_URL!.trim();
  }

  if (isProductionRuntime()) {
    throw new Error('REDIS_URL is required before background workers can start in production');
  }

  return process.env.REDIS_URL?.trim() || 'redis://localhost:6379';
}

export function validateWorkerStartupConfiguration(
  options: WorkerStartupValidationOptions = {}
): WorkerStartupValidationResult {
  const errors: string[] = [];
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

  // Push and data export run in this process (push.service, data-export.service).
  // PUSH_NOTIFICATION_PROVIDER_URL and DATA_EXPORT_PROCESSOR_URL are optional
  // overrides for deployments with an external service, never requirements.

  return { ok: errors.length === 0, errors };
}
