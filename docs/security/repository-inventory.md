# ATHENA Repository Inventory
_Version 1.1 — 2026-09-06. The map of every code line in this repository, its status, and its owner. The 1.0 inventory of 2026-08-18 described a workspace with three web lines and two backends; the consolidation it recommended has happened. `athena-platform` is the only line, and the superseded projects were moved out by `cleanup-quarantine.ps1` (its manifest, `CLEANUP-MANIFEST.md`, sits at the repository root untracked)._

## Active code

| Line | Stack | Role | Deploy | Status |
|---|---|---|---|---|
| `athena-platform/client` | Next.js 16, React 18, React Query, Zustand, Tailwind | The web app at athena-life.netlify.app | Netlify, built from `main` on push (`netlify.toml`) | Active |
| `athena-platform/server` | Express, TypeScript, Prisma 6 on Neon Postgres, Socket.IO, Stripe | The API, workers and webhooks | Containerised; Prisma migrations apply on deploy | Active |
| `athena-platform/mobile` | Expo SDK 54, React Native 0.81 | The phone app | EAS build | Active, behind the web app on features |
| `athena-platform/ml` | FastAPI | Career, mentor-match, safety and feed models; used by the API only when `ML_SERVICE_URL` is set | Separate service | Optional |
| `athena-platform/shared` | TypeScript | Types and hooks shared by web and mobile | — | Active |
| `athena-platform/infrastructure`, `athena-platform/scripts` | Terraform, operational scripts | Provisioning and operations | — | Reference |

## Documentation and governance

| Path | What it is |
|---|---|
| `docs/security/` | This folder: threat model, authorisation matrix, data inventory, retention, incident response and its template, privacy impact assessment, AI system card, trust-claims register |
| `SECURITY.md` | Vulnerability disclosure policy |
| `SECURITY-HARDENING-CHANGELOG.md` | The security fixes applied during the 2026-08 audit, kept as the record (its paths name the pre-consolidation layout) |
| `athena-platform/client/public/.well-known/security.txt` | Machine-readable disclosure endpoint, served at the well-known path |
| Root reports (`ATHENA_PLATFORM_CAPABILITY_REPORT.md`, `ATHENA_GAP_REPORT.md`, blueprints) | Planning documents kept at the repository root and not tracked; they are the founder's working papers |

## Superseded lines

`athena-frontend` (a second web app), `app-backend` (a Laravel-conversion Express backend), `auth-service` (a JSON-file auth mock that must never be deployed), `packages` (a UI kit and SDKs), and the old `code`, `guide`, `app-frontend`, `database`, `e2e` and `lang` folders were quarantined by `cleanup-quarantine.ps1`. Nothing in this repository imports them. Security changes now happen in one place.

## Secrets

Environment files are not tracked. The server reads its local env file (untracked, beside `athena-platform/server/.env.example`) and the production template is `athena-platform/server/.env.production.template`; the client reads `athena-platform/client/.env.local` locally and Netlify's environment in production. The check-env script (`athena-platform/server/scripts/check-env.js`) compares an env file with what the server reads. Any secret that ever lived in the OneDrive-synced working tree, including the pre-consolidation `.env` files listed in the 1.0 inventory, is to be treated as exposed and rotated.

## CI/CD

`athena-platform/.github/workflows` carries the client build and Netlify deploy, the server checks (typecheck, lint, jest, API contract, doc references, dead interactions, launch readiness), the mobile build, Playwright end-to-end tests and the security audit workflow (`docs/security/security-audit.workflow.yml` is its source).
