# TurboTax POC — One-Click AWS Demo Plan

This document describes a one-click demo deployment for the TurboTax POC microservice using AWS.
It includes a recommended architecture, minimal security checklist, sample Terraform and CloudFormation options, and CI/CD steps that let you deploy a demo environment quickly.

Overview
--------
- Goal: deploy `services/turbotax-poc` microservice as a secure, demo-grade service on AWS (ECR + ECS Fargate) behind an ALB with HTTPS and Secrets Manager for sensitive env vars.
- Top-level resources: ECR repository, ECS Cluster + Task Definition (Fargate), Application Load Balancer (ALB) + HTTPS listener, Secrets Manager for encrypted secrets, IAM roles for ECS tasks and deployer, and optional Route53 DNS record.

High-level architecture
-----------------------
- GitHub repo (services/turbotax-poc-repo) → GitHub Actions builds Docker image → pushes to ECR.
- GitHub Actions then runs Terraform (or CloudFormation) to provision infra (ECR/ECS/ALB/Secrets/IAM).
- ECS Fargate service runs microservice container(s). ALB health checks ensure service readiness.
- The Laravel application (ATHENA) calls the public ALB URL of the microservice for OAuth flows and projection API; secrets are stored in AWS Secrets Manager and mounted into the task as env vars.

Prerequisites & IAM
-------------------
- An AWS account with admin or delegated rights to the following services:
  - ECR, ECS (Fargate), IAM, Secrets Manager, ALB (ELBv2), CloudWatch, Route53 (optional), STS
- GitHub repository with Actions runner for CI and the following secrets configured:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_REGION (e.g., us-east-1)
  - ECR_REPOSITORY (optional override)

Sensitive configuration (store in AWS Secrets Manager)
---------------------------------------------------
- TURBOTAX_MASTER_KEY: AES master key used for encrypting tokens/PII in microservice
- INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET: Intuit sandbox client credentials
- CALLBACK_URL: public OAuth callback URL that points to microservice /oauth/callback

Network & security choices
--------------------------
- Keep public endpoint behind ALB with HTTPS (automate certificates via AWS Certificate Manager or use pre-provisioned certs).
- Use Secrets Manager for secrets and restrict access to ECS Task Role only.
- Enable CloudWatch logs and set a log retention policy.
- Enable IAM principle of least privilege for runner/deployer roles.

One-click (GitHub Actions) flow — recommended
--------------------------------------------
1. On push to main / on manual_dispatch, GitHub Actions builds Docker image and tags by SHA + semver, pushes to ECR.
2. CI then invokes terraform apply (or CloudFormation change-set) using the same repo to deploy infra (if not already provisioned) or update the ECS service to use new image tag.
3. The action writes/updates SecretsManager secrets for TURBOTAX_MASTER_KEY and the Intuit sandbox client secret (from GitHub encrypted secrets).
4. Smoke test: the CI hits /health or /api/v1/projection endpoint on the deployed endpoint and fails the job on non-2xx.

Terraform and CloudFormation options
-----------------------------------
- Two delivery patterns are provided in this repo (see deploy/terraform and deploy/cloudformation):
  - Terraform: recommended for long-term lifecycle management, reusable variables, and remote state.
  - CloudFormation: single stack (convenient when you want a single-file manual deploy by console or AWS CLI).

Minimum deploy checklist (Pre-Demo)
----------------------------------
1. Create an ECR repository or leave Terraform/CF to create it.
2. Configure GitHub secrets (AWS_*, INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET, TURBOTAX_MASTER_KEY).
3. Configure the expected environment variables in Terraform variables or CloudFormation parameter overrides.
4. Update ATHENA DEV environment to point to TURBOTAX_GATEWAY_URL = <ALB-DNS>/ (or pass through a reverse-proxy route), and ensure the microservice callback URL is whitelisted in Intuit dev console.

Verification checklist post-deploy
--------------------------------
1. Service tasks are running and healthy in ECS.
2. ALB health checks are passing.
3. The microservice /health or / status endpoint returns success.
4. A projection request works via /api/v1/turbotax/projection.

Notes on production-hardening (not required for demo)
----------------------------------------------------
- Add rate limiting, WAF, stricter IAM roles, domain & HTTPS using ACM, private network placement + NAT/egress, VPC endpoints for Secrets Manager, and stronger logging and audit trails.

Where the code lives in this repo
---------------------------------
- services/turbotax-poc (example microservice POC, used for local testing)
- services/turbotax-poc-repo (standalone repo scaffold; deploy will use files under deploy/terraform and deploy/cloudformation)

Next steps for me if you'd like me to continue
---------------------------------------------
1. Add a complete Terraform module (templates) that provisions: ECR, ECS Fargate service, ALB, Secrets Manager, IAM roles, CloudWatch logs, and Route53 optional DNS.
2. Add a CloudFormation template for one-stack deploy.
3. Add GitHub Actions workflow examples to build and push images, then trigger infra updates.

If you'd like, I can now create both the Terraform module and a CloudFormation stack and add the CI scripts + instructions for a true one-click flow. Which should I create first: Terraform or CloudFormation?
