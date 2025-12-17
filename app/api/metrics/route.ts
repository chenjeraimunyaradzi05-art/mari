import { NextResponse } from 'next/server';
import { getMetricsSnapshot } from '@/lib/metrics';

// Expose a simple Prometheus-style text format for scraping
export async function GET() {
  const snapshot = getMetricsSnapshot();
  // Basic exposition
  const lines: string[] = [];
  lines.push('# HELP app_overall_avg_latency_ms Average latency (ms) across endpoints');
  lines.push('# TYPE app_overall_avg_latency_ms gauge');
  lines.push(`app_overall_avg_latency_ms ${snapshot.overall.avgLatencyMs}`);

  lines.push('# HELP app_overall_error_rate Percentage errors across endpoints');
  lines.push('# TYPE app_overall_error_rate gauge');
  lines.push(`app_overall_error_rate ${snapshot.overall.errorRate}`);

  lines.push('# HELP app_endpoint_avg_latency_ms Average latency (ms) by endpoint');
  lines.push('# TYPE app_endpoint_avg_latency_ms gauge');
  snapshot.endpoints.forEach((e) => {
    const name = e.name.replace(/"/g, '\\"');
    lines.push(`app_endpoint_avg_latency_ms{endpoint="${name}"} ${e.avgLatencyMs}`);
  });

  lines.push('# HELP app_endpoint_error_rate Endpoint error rate percentage');
  lines.push('# TYPE app_endpoint_error_rate gauge');
  snapshot.endpoints.forEach((e) => {
    const name = e.name.replace(/"/g, '\\"');
    lines.push(`app_endpoint_error_rate{endpoint="${name}"} ${e.errorRate}`);
  });

  const body = lines.join('\n') + '\n';
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/plain; version=0.0.4' } });
}
