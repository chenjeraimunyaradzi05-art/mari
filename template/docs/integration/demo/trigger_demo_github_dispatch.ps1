<#
Trigger the `Deploy demo to gh-pages` workflow in this repository.

Usage (PowerShell):
  # with gh CLI (preferred)
  ./trigger_demo_github_dispatch.ps1 -RepoOwner "MansaAkubari" -RepoName "source-code" -Workflow "deploy-demo-gh-pages.yml" -Ref "main"

  # or using curl and a personal access token (GITHUB_TOKEN in env)
  $env:GITHUB_TOKEN = "ghp_xxx"; ./trigger_demo_github_dispatch.ps1 -RepoOwner "MansaAkubari" -RepoName "source-code" -Workflow "deploy-demo-gh-pages.yml" -Ref "main"

Notes:
  - The script will try to use the GitHub CLI (`gh`) if present. If `gh` is not installed it falls back to the Actions API using $env:GITHUB_TOKEN.
  - The token needs `workflow` or repo-level rights to dispatch workflows (repo scopes / workflow scope on PAT or GITHUB_TOKEN in Actions).
#>

param(
  [Parameter(Mandatory=$true)] [string] $RepoOwner,
  [Parameter(Mandatory=$true)] [string] $RepoName,
  [Parameter(Mandatory=$true)] [string] $Workflow,
  [Parameter(Mandatory=$false)] [string] $Ref = 'main'
)

function Use-GhCli {
  try { gh --version > $null 2>&1; return $true } catch { return $false }
}

if (Use-GhCli) {
  Write-Host "Using gh CLI to dispatch workflow: $Workflow -> $RepoOwner/$RepoName#$Ref"
  gh workflow run $Workflow --repo "$RepoOwner/$RepoName" --ref $Ref
  exit $LASTEXITCODE
}

if (-not $env:GITHUB_TOKEN) {
  Write-Error "gh CLI not found and GITHUB_TOKEN is not set. Install gh (https://cli.github.com/) or export GITHUB_TOKEN."
  exit 2
}

$url = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/workflows/$Workflow/dispatches"
$body = @{ ref = $Ref } | ConvertTo-Json -Depth 3

Write-Host "Dispatching workflow via GitHub API: $url"

$resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "token $env:GITHUB_TOKEN"; 'User-Agent' = 'DemoTriggerScript' } -Body $body -ContentType 'application/json' -ErrorAction Stop
Write-Host "Workflow dispatch requested (HTTP OK). Check GitHub Actions > Workflows for status."
