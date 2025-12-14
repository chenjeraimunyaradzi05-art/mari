// Use globalThis.crypto for Edge compatibility
const uuid = () => globalThis.crypto.randomUUID();

export type MetricSnapshot = {
  name: string;
  count: number;
  errorCount: number;
  totalLatencyMs: number;
  lastLatencyMs: number;
};

const registry: Record<string, MetricSnapshot> = {};
type JobMetric = { jobName: string; successes: number; failures: number };
const jobRegistry: Record<string, JobMetric> = {};
type CacheMetric = { name: string; hits: number; misses: number; lastLatencyMs: number };
const cacheRegistry: Record<string, CacheMetric> = {};
type ExperimentMetric = { name: string; buckets: Record<string, number> };
const experimentRegistry: Record<string, ExperimentMetric> = {};

export function recordApiMetric(name: string, latencyMs: number, isError: boolean) {
  const key = name || 'unknown';
  if (!registry[key]) {
    registry[key] = {
      name: key,
      count: 0,
      errorCount: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
    };
  }

  const snapshot = registry[key];
  snapshot.count += 1;
  snapshot.lastLatencyMs = latencyMs;
  snapshot.totalLatencyMs += latencyMs;
  if (isError) snapshot.errorCount += 1;
}

export function getMetricsSnapshot() {
  const snapshots = Object.values(registry).map((s) => ({
    ...s,
    avgLatencyMs: s.count ? Number((s.totalLatencyMs / s.count).toFixed(2)) : 0,
    errorRate: s.count ? Number(((s.errorCount / s.count) * 100).toFixed(2)) : 0,
  }));

  const totals = snapshots.reduce(
    (acc, s) => {
      acc.count += s.count;
      acc.errorCount += s.errorCount;
      acc.totalLatencyMs += s.totalLatencyMs;
      return acc;
    },
    { count: 0, errorCount: 0, totalLatencyMs: 0 }
  );

  const overall = {
    name: 'overall',
    count: totals.count,
    errorCount: totals.errorCount,
    avgLatencyMs: totals.count ? Number((totals.totalLatencyMs / totals.count).toFixed(2)) : 0,
    errorRate: totals.count ? Number(((totals.errorCount / totals.count) * 100).toFixed(2)) : 0,
  };

  return {
    overall,
    endpoints: snapshots,
    jobs: Object.values(jobRegistry),
    caches: Object.values(cacheRegistry),
    experiments: Object.values(experimentRegistry),
  };
}

export function ensureCorrelationId(headerValue?: string | null) {
  return headerValue && headerValue.length > 0 ? headerValue : uuid();
}

export function recordJobMetric(jobName: string, success: boolean) {
  const key = jobName || 'job.unknown';
  if (!jobRegistry[key]) jobRegistry[key] = { jobName: key, successes: 0, failures: 0 };
  if (success) jobRegistry[key].successes += 1; else jobRegistry[key].failures += 1;
}

export function recordCacheMetric(name: string, hit: boolean, latencyMs: number) {
  const key = name || 'cache.unknown';
  if (!cacheRegistry[key]) cacheRegistry[key] = { name: key, hits: 0, misses: 0, lastLatencyMs: 0 };
  const entry = cacheRegistry[key];
  entry.lastLatencyMs = latencyMs;
  if (hit) entry.hits += 1; else entry.misses += 1;
}

export function recordExperimentSplit(name: string, bucket: string) {
  const key = name || 'experiment.unknown';
  if (!experimentRegistry[key]) experimentRegistry[key] = { name: key, buckets: {} };
  const buckets = experimentRegistry[key].buckets;
  buckets[bucket] = (buckets[bucket] ?? 0) + 1;
}
