import { randomUUID } from 'crypto';

interface MetricsSnapshot {
  requests: number;
  errors: number;
  avgLatency: number;
  p95Latency: number;
  timestamp: string;
}

// Simple in-memory metrics store (in production, use Prometheus/Datadog)
const metricsStore = {
  requests: 0,
  errors: 0,
  latencies: [] as number[],
};

export function ensureCorrelationId(existingId: string | null): string {
  return existingId || randomUUID();
}

export function recordApiMetric(name: string, latencyMs: number, isError: boolean) {
  metricsStore.requests++;
  if (isError) metricsStore.errors++;
  metricsStore.latencies.push(latencyMs);
  
  // Keep only last 1000 latencies to prevent memory leak
  if (metricsStore.latencies.length > 1000) {
    metricsStore.latencies.shift();
  }
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const latencies = [...metricsStore.latencies].sort((a, b) => a - b);
  const avgLatency = latencies.length 
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
    : 0;
  
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies.length ? latencies[p95Index] : 0;

  return {
    requests: metricsStore.requests,
    errors: metricsStore.errors,
    avgLatency,
    p95Latency,
    timestamp: new Date().toISOString(),
  };
}
