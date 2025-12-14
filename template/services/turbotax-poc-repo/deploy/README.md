# Deploying TurboTax POC to AWS (One-click demo)

This directory contains the deploy-related artifacts and example CI for launching a demo AWS environment for the TurboTax microservice (POC).

Included:

- terraform/ — Terraform module to create ECR, ECS Fargate service, ALB, Secrets Manager, IAM roles.
- cloudformation/ — CloudFormation stack for single-file deploy alternative.
- scripts/ — Local helper scripts to build & push images to ECR and run terraform apply.
- .github/workflows/deploy-aws.yml — GitHub Actions workflow example to build container, push to ECR and run terraform apply.

Quick one-click plan (summary)
1. Create an AWS account or use an existing account with privileges for ECR/ECS/IAM/SecretsManager/ALB.
2. Configure GitHub repository secrets (see below).
3. Push your image branch / tag or use manual dispatch of workflow — GitHub Actions builds and pushes the Docker image and runs Terraform to update ECS service.

- Required GitHub secrets for the OIDC workflow (add to the repository):
- AWS_ACCESS_KEY_ID — key of a deploy user with permissions to ECR/ECS/IAM/SecretsManager/ELB
- AWS_SECRET_ACCESS_KEY — corresponding secret
- AWS_REGION — recommended region (e.g. us-east-1)
- AWS_ACCOUNT_ID — numeric account id
- ECR_REPOSITORY — name of ECR repository to push to (e.g. turbotax-poc)

OR (preferred): Use GitHub OIDC and an IAM role with trust for token.actions.githubusercontent.com and create the `AWS_ROLE_TO_ASSUME` repository secret (role ARN). When you use OIDC you do not need to add long-lived AWS keys.

Recommended secrets for the microservice (store in Secrets Manager / or set as env vars):
- TURBOTAX_MASTER_KEY
- INTUIT_CLIENT_ID
- INTUIT_CLIENT_SECRET

Local quick demo steps (manual)
1. Build and push container image (uses default AWS cli credentials):

```bash
cd services/turbotax-poc-repo/deploy/scripts
./build_and_push.sh <ACCOUNT_ID> <REGION> <REPO_NAME> <TAG>
```

2. Run terraform apply (with proper credentials):

```bash
./terraform_apply.sh <REGION> <ACCOUNT_ID> <IMAGE_URI>
```

Notes and next steps
- For real demos you should use OIDC / short-lived credentials and least-privilege IAM role for the GitHub Actions runner.
	- See `deploy/docs/OIDC-setup.md` and `deploy/docs/iam-policy-example.json` for sample trust policy and IAM policy to attach to the role.
- Add monitoring/observability, autoscaling and a private placement (VPC connectors) for production.
