# Deploy PR playbook

This short playbook prepares a clean PR branch that adds OIDC-based CI and Terraform remote state instructions so you (or the deploy operator) can run a safe one-click deploy.

Recommended branch name: `deploy/aws-demo` or `deploy/turbotax/aws-demo`.

Steps for preparing the PR (local):

1. Create a local branch and push it to the remote:

```bash
git checkout -b deploy/aws-demo
# ensure your work tree includes the contents of services/turbotax-poc-repo/deploy
git add services/turbotax-poc-repo/deploy
git commit -m "deploy: add terraform & cloudformation + OIDC workflow for AWS demo"
git push origin deploy/aws-demo
```

2. Open a Pull Request targeting `main` (or the desired deploy branch). In the PR description include the deploy steps below and a note that the `AWS_ROLE_TO_ASSUME` secret and `AWS_ACCOUNT_ID` + `AWS_REGION` + `ECR_REPOSITORY` should be set in repo secrets.

Required repo secrets for OIDC workflow (if you prefer OIDC approach):
- AWS_ROLE_TO_ASSUME — ARN of the role with OIDC trust to GitHub and permissions to deploy
- AWS_ACCOUNT_ID — numeric AWS account ID
- AWS_REGION — e.g., us-east-1
- ECR_REPOSITORY — e.g., turbotax-poc

If you prefer the older credentials-based flow (less recommended for long-term):
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

3. (Optional) Prepare remote Terraform state (must create S3 bucket + DynamoDB lock table). Terraform backend example is in `deploy/terraform/backend.tf` — fill `bucket` and `dynamodb_table` once created.

4. Once the PR is created and secrets are set, trigger the workflow (push to branch or click 'Run workflow' / workflow_dispatch on the `deploy-aws-oidc.yml` workflow).

5. CI builds and pushes an image into ECR then calls `terraform apply` which will create or update the ECS service. The workflow will pass the `container_image` override pointing to the image just pushed.

Notes
- The PR contains both Terraform and CloudFormation deploy assets — choose which mechanism you want to provision infra with and follow steps accordingly.
- If you prefer to run Terraform manually, use the helper scripts in `deploy/scripts` in this repo.
