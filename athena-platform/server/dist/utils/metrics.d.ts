import client from 'prom-client';
export declare const register: client.Registry<"text/plain; version=0.0.4; charset=utf-8">;
/**
 * HTTP request counter: total requests labeled by method, path, and status code.
 */
export declare const httpRequestsTotal: client.Counter<"status" | "path" | "method">;
/**
 * HTTP request duration histogram (seconds).
 * Buckets optimized for typical web latency (5ms to 10s).
 */
export declare const httpRequestDurationSeconds: client.Histogram<"status" | "path" | "method">;
export { client };
//# sourceMappingURL=metrics.d.ts.map