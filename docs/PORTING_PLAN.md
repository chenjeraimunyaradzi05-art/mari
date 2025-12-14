Porting Plan — PHP → JavaScript
================================

Goal
----
Complete port of all PHP `routes` and `app/Http/Controllers` into JavaScript handlers and controllers, targetting Next.js `src/app/api` for API routes and `src/lib/controllers` for server-side controller code.

Phases
------
1. Scaffold: auto-generate JS stubs from PHP sources (done). Stubs include original PHP method bodies as comments for easy manual porting.
2. Core API pass: manually port security-critical controllers (`Auth`, `User`, `Social`, `Posts`, `Leads`) and add tests. (next)
3. Batch porting: convert controllers in batches of 50, replacing stubs and adding tests per batch.
4. Frontend/page controllers: port view-controller logic or refactor into server components.
5. Middleware & auth: implement middleware equivalents and connect to next-auth or custom auth layer.
6. CI: add a job to run `tools/port_php_to_js.cjs` and failing PRs which add PHP controllers without JS stubs.

Immediate next actions I will take (with your approval):
- Port `AuthController` and its dependencies into `src/app/api/auth` (login/register/refresh/logout), wiring to existing user store or adding a minimal token implementation for API usage.
- Add tests for those endpoints and run the full test suite.
- Open PRs per batch to keep changes reviewable.
