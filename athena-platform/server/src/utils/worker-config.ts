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

/**
 * Whether the video worker runs the ffmpeg pipeline in its own process
 * (processVideo in services/video-pipeline.service) rather than posting each
 * reel to an external transcoder at VIDEO_PROCESSOR_URL. It is the rule the
 * worker itself applies, named once here so that the code deciding whether a
 * reel may go on the queue asks exactly the question the worker will answer.
 * "Simulation" is the flags' historical name, not what they select: the
 * in-process branch is the real pipeline, the same one that runs with the
 * workers switched off.
 */
export function videoWorkerRunsPipelineInProcess(): boolean {
  return canSimulateWorker('VIDEO_PROCESSING');
}

// Whether startAllWorkers has finished in this process. ENABLE_WORKERS says
// the workers were asked for, not that they came up: outside production a
// worker that cannot reach Redis is logged and skipped, and the API carries on.
// Work handed to a queue in that state would sit in Redis with nobody to take
// it, so a producer asks this instead of reading the flag.
let workersRunningHere = false;

/** Called by startAllWorkers once every worker is ready, and by stopAllWorkers first thing. */
export function markWorkersRunning(running: boolean): void {
  workersRunningHere = running;
}

/** True only between a successful startAllWorkers and the start of stopAllWorkers. */
export function areWorkersRunning(): boolean {
  return workersRunningHere;
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

  // Nothing else to check: the only other queue is scheduled-tasks, whose work
  // (the retention purge, the report-deadline sweep) runs in this process. The
  // push and data-export workers, and the PUSH_NOTIFICATION_PROVIDER_URL and
  // DATA_EXPORT_PROCESSOR_URL overrides they read, went with their queues;
  // push and exports are sent directly by push.service and gdpr.service.

  return { ok: errors.length === 0, errors };
}
