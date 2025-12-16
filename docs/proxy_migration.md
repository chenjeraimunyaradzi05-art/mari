# Proxy Migration (Next.js 16)

Quick summary

- Next.js 16 deprecates the `middleware.ts` file convention in favor of the `proxy.ts` convention.
- This repository migrated to the new proxy pattern: runtime logic now lives in `app/proxy.ts` and there's a small root `proxy.ts` shim that forwards to `app/proxy.ts`.

What changed

- Rate limiting, correlation id handling and security headers are applied in the proxy implementation (`app/proxy.ts`).
- The root `proxy.ts` preserves compatibility for deployments/tools that expect a top-level entry point.
- The legacy `middleware.ts` file has been removed from the project to avoid build-time conflicts and runtime parsing issues.

Why this matters

- Next (Turbopack) expects a `proxy.ts` file to implement behavior that runs on Node.js; using the old `middleware.ts` can cause parsing issues and build errors.
- The proxy file always runs on Node.js and should not export routing segment config or runtime explicitly in the root shim.

Migration checklist

- Replace `middleware.ts` references in docs with `proxy.ts` and point people to `app/proxy.ts` for implementation details.
- If you have custom logic in `middleware.ts` that still exists elsewhere, port it to `app/proxy.ts`.
- Remove any leftover imports or references to `middleware.ts` from other docs or scripts.
- If you need a graceful deprecation window, keep a lightweight shim but ensure it doesn't export disallowed config/runtime values.

Notes

- See `app/proxy.ts` in this repo for a reference implementation (correlation id, rate limiting, next-auth checks, security headers) and `__tests__/integration/middleware.integration.test.ts` for integration examples that validate rate limits and security headers.
- Link: https://nextjs.org/docs/messages/middleware-to-proxy
