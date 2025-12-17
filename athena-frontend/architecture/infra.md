# ATHENA Frontend - Infra & Deployment Plan (draft)

This document outlines recommended choices for hosting, infra, and deployment for the ATHENA frontend reference implementation.

Goals:

- Fast iteration for frontend team
- Predictable hosting costs
- Secure connections to backend APIs
- Observability and deploy safety


Recommendations (MVP):

- Hosting: Vercel (Next.js first-class) for frontend; use Vercel for staging and prod. Self-host on Docker+k8s (EKS/GKE) if advanced control required.
- CDN: Vercel CDN + Cloudflare in front for WAF and Edge rules.
- Object Storage: AWS S3 for media with CloudFront or Cloudflare as CDN.
- Database: PostgreSQL (managed, e.g., AWS RDS or Neon). Add pgvector for embedding search in product later.
- Caching: Redis (managed) for sessions and rate limiting.
- Media Processing: AWS Elastic Transcoder / MediaConvert or ECR-based FFmpeg workers in ECS/Fargate.
- Streaming: Use a managed ingest (Mux, Agora) or an open-source stack with Nginx-RTMP + S3/HLS output.
- Payments: Stripe for payments and payouts.
- Observability: Sentry for errors, Datadog for infrastructure metrics and tracing.
- CI/CD: GitHub Actions with protected branches and required checks.
- Secrets: GitHub Secrets or HashiCorp Vault for secret storage.

Next steps:

- Create IaC templates (Terraform) for RDS, S3, Redis, and a minimal VPC.
- Prepare a staging environment with limited capacity for E2E testing.
- Cost estimate and runbook for scaling media pipeline.
