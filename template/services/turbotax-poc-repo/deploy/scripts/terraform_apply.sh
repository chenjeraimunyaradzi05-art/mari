#!/usr/bin/env bash
set -euo pipefail

# Run terraform apply for the local repo terraform directory
# Usage: ./terraform_apply.sh <aws-region> <aws-account-id> [image-uri]

AWS_REGION=${1:-us-east-1}
AWS_ACCOUNT_ID=${2:?account id}
IMAGE_URI=${3:-}

pushd $(dirname "$0")/..
cd terraform

export AWS_REGION=${AWS_REGION}

terraform init

if [[ -n "${IMAGE_URI}" ]]; then
  terraform apply -auto-approve -var="container_image=${IMAGE_URI}" -var="aws_account_id=${AWS_ACCOUNT_ID}"
else
  terraform apply -auto-approve -var="aws_account_id=${AWS_ACCOUNT_ID}"
fi

popd
