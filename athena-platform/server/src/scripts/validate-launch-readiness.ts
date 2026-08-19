import fs from 'fs';
import path from 'path';

export interface LaunchReadinessDocCheck {
  name: string;
  ok: boolean;
  details?: string;
}

export interface LaunchReadinessDocValidationResult {
  ok: boolean;
  checks: LaunchReadinessDocCheck[];
}

export function validateLaunchReadinessDocs(): LaunchReadinessDocValidationResult {
  const root = path.resolve(__dirname, '..', '..');
  const routeFile = path.join(root, 'src', 'routes', 'health.routes.ts');
  const workerConfigFile = path.join(root, 'src', 'utils', 'worker-config.ts');
  const workerEntryFile = path.join(root, 'src', 'workers', 'index.ts');
  const productionEnvTemplateFile = path.join(root, '.env.production.template');

  const checks: LaunchReadinessDocCheck[] = [];

  const routeContent = fs.existsSync(routeFile) ? fs.readFileSync(routeFile, 'utf8') : '';
  checks.push({
    name: 'launch-readiness-route',
    ok: routeContent.includes('/launch-readiness') && routeContent.includes('REDIS_URL') && routeContent.includes('VIDEO_PROCESSOR_URL'),
    details: 'Launch readiness route and worker env checks should be present',
  });

  const workerContent = fs.existsSync(workerConfigFile) ? fs.readFileSync(workerConfigFile, 'utf8') : '';
  checks.push({
    name: 'worker-env-config',
    ok: workerContent.includes('REDIS_URL') && workerContent.includes('VIDEO_PROCESSOR_URL') && workerContent.includes('PUSH_NOTIFICATION_PROVIDER_URL') && workerContent.includes('DATA_EXPORT_PROCESSOR_URL'),
    details: 'Worker startup validation should cover Redis and provider URLs',
  });

  const workerEntryContent = fs.existsSync(workerEntryFile) ? fs.readFileSync(workerEntryFile, 'utf8') : '';
  checks.push({
    name: 'dedicated-worker-startup',
    ok:
      workerEntryContent.includes('validateWorkerStartupConfiguration') &&
      workerEntryContent.includes('requireEnableFlag') &&
      workerEntryContent.includes('resolveWorkerRedisUrl'),
    details: 'Dedicated worker process should validate production worker config before opening Redis',
  });

  const productionEnvTemplateContent = fs.existsSync(productionEnvTemplateFile)
    ? fs.readFileSync(productionEnvTemplateFile, 'utf8')
    : '';
  checks.push({
    name: 'production-worker-env-template',
    ok:
      productionEnvTemplateContent.includes('ENABLE_WORKERS=true') &&
      productionEnvTemplateContent.includes('VIDEO_PROCESSOR_URL') &&
      productionEnvTemplateContent.includes('PUSH_NOTIFICATION_PROVIDER_URL') &&
      productionEnvTemplateContent.includes('DATA_EXPORT_PROCESSOR_URL'),
    details: 'Production env template should document explicit worker enablement and provider URLs',
  });

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

if (require.main === module) {
  const result = validateLaunchReadinessDocs();

  for (const check of result.checks) {
    const status = check.ok ? 'PASS' : 'FAIL';
    console.log(`${status} ${check.name}: ${check.details || ''}`.trim());
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}
