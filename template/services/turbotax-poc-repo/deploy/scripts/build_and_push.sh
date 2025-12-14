#!/usr/bin/env bash
set -euo pipefail

# Build and push a docker image to ECR
# Usage: ./build_and_push.sh <aws-account-id> <aws-region> <ecr-repo-name> <tag>

AWS_ACCOUNT_ID=${1:?account id}
AWS_REGION=${2:-us-east-1}
ECR_REPO=${3:-turbotax-poc}
TAG=${4:-latest}

REPO_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${TAG}

echo "Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "Building image ${REPO_URI}"
docker build -t ${REPO_URI} -f ../../turbotax-poc/Dockerfile ../../turbotax-poc

echo "Pushing image"
docker push ${REPO_URI}

echo "Done: ${REPO_URI}"
