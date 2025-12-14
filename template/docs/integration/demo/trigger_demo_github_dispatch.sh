#!/usr/bin/env bash
# Trigger the `Deploy demo to gh-pages` workflow in this repository.
# Usage (bash):
#   # with gh CLI (preferred)
#   ./trigger_demo_github_dispatch.sh MansaAkubari source-code deploy-demo-gh-pages.yml main
#
#   # or using curl and a personal access token (GITHUB_TOKEN in env)
#   GITHUB_TOKEN=ghp_xxx ./trigger_demo_github_dispatch.sh MansaAkubari source-code deploy-demo-gh-pages.yml main

set -euo pipefail

OWNER=${1:-}
REPO=${2:-}
WORKFLOW=${3:-}
REF=${4:-main}

if [ -z "$OWNER" ] || [ -z "$REPO" ] || [ -z "$WORKFLOW" ]; then
  echo "Usage: $0 <owner> <repo> <workflow-filename> [ref]"
  exit 2
fi

if command -v gh >/dev/null 2>&1; then
  echo "Using gh CLI to run workflow $WORKFLOW -> $OWNER/$REPO#$REF"
  gh workflow run "$WORKFLOW" --repo "$OWNER/$REPO" --ref "$REF"
  exit $?
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "gh not installed and GITHUB_TOKEN not set. Install gh or export GITHUB_TOKEN to call the API." >&2
  exit 2
fi

URL="https://api.github.com/repos/$OWNER/$REPO/actions/workflows/$WORKFLOW/dispatches"
BODY=$(jq -n --arg ref "$REF" '{ref: $ref}')

echo "Dispatching workflow via API: $URL"
curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" -d "$BODY" "$URL"
echo "Workflow dispatch requested — check Actions in GitHub for run status."
