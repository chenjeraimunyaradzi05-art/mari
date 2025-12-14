# Terraform deployment for TurboTax POC (services/turbotax-poc-repo)

This folder contains a small Terraform layout intended to deploy the TurboTax POC microservice to AWS using ECR + ECS Fargate + ALB + Secrets Manager.

Intended audience: dev/demo engineers who want a quick, repeatable demo environment in a real AWS account.

This is not production secure by default — use it to create a demo environment. See the parent docs for production hardening steps.

Files in this folder:
- main.tf — core resources (ECR, ECS cluster, task definition, service, ALB, secrets, roles)
- variables.tf — input variables
- outputs.tf — useful outputs for CI and application configuration
- terraform.tfvars.example — sample variable values

High-level steps (local manual)
1. Install and configure Terraform (>=1.5). Set AWS credentials in environment variables or a profile.
2. Copy terraform.tfvars.example -> terraform.tfvars and fill values (region, account_id, image tag, certificate_arn optional).
3. terraform init
4. terraform plan
5. terraform apply

The GitHub Actions CI we will add later can automate image build, push, and the subsequent terraform apply.
