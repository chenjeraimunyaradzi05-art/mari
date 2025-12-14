## GitHub OIDC role + minimal IAM policy for deploy

This file describes the minimal steps to create an IAM role that GitHub Actions can assume via OIDC. Using OIDC avoids long-lived AWS keys and is recommended for CI deploys.

1. Create an IAM role with a trust policy that allows the GitHub Actions OIDC provider (sts:AssumeRoleWithWebIdentity) for this repository. Example trust condition (replace my-org and repo name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:sub": "repo:<GITHUB_ORG>/<REPO>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

2. Attach an IAM policy granting the least privilege needed for ECR/ECS/Fargate/ELB/SecretsManager/CloudWatch. Minimal demo policy example (NOT production ready; adapt to principle of least privilege):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:GetAuthorizationToken","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["ecs:UpdateService","ecs:RegisterTaskDefinition","ecs:CreateService","ecs:DescribeServices","ecs:DescribeTaskDefinition","ecs:RunTask"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["iam:PassRole"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["elasticloadbalancing:CreateListener","elasticloadbalancing:CreateTargetGroup","elasticloadbalancing:RegisterTargets","elasticloadbalancing:DescribeTargetGroups","elasticloadbalancing:DescribeListeners"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["secretsmanager:CreateSecret","secretsmanager:PutSecretValue","secretsmanager:GetSecretValue"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"], "Resource": "*" }
  ]
}
```

3. In GitHub Settings (org or repository), configure the environment or workflow to use the role's ARN by adding a repository secret such as `AWS_ROLE_TO_ASSUME` (role ARN) and then update the workflow to call `aws-actions/configure-aws-credentials` with `role-to-assume` and `web-identity-token-file` support.

See the `deploy-aws-oidc.yml` workflow added in this repo for an example usage.
