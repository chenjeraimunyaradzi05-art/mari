# =============================================================================
# ATHENA workspace cleanup — quarantine script
# =============================================================================
# Moves superseded projects, build caches, logs, and stray files into
# _to_delete\ (preserving their relative paths) so you can review everything
# before deleting the folder yourself. Nothing is ever deleted by this script.
#
# USAGE (from PowerShell):
#   cd "C:\Users\mutir\OneDrive\Desktop\mari"
#   .\cleanup-quarantine.ps1            # DRY RUN — prints what would move
#   .\cleanup-quarantine.ps1 -Apply     # actually moves items into _to_delete\
#
# To undo: move items back from _to_delete\ to their original locations
# (the relative path inside _to_delete\ mirrors the original location).
# See CLEANUP-MANIFEST.md for the reasoning behind every entry.
# =============================================================================

param(
    [switch]$Apply
)

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$quarantine = Join-Path $root '_to_delete'

# --- Superseded / legacy project copies (entire folders) ---------------------
$items = @(
    'code',                              # Dec-2025 legacy workspace (own .git, .env, SQL dumps, moneyman-* copies)
    'guide',                             # Dec-2025 NextAuth prototype (own node_modules, html mockups, "README (2).md")
    'app-frontend',                      # 618 Laravel-blade-to-JSX conversion templates (intermediate artifact)
    'app',                               # standalone admin Next app skeleton, superseded by athena-frontend\app\admin
    'database',                          # converted Laravel migrations, duplicated by app-backend\src\migrations
    'exports',                           # ~2.9 MB of PHP-conversion analysis dumps (php-files-to-convert*.json/csv)
    'e2e',                               # 3 stale specs for the old root app (athena-frontend has its own e2e suite)
    'lang',                              # leftover menu-builder language stubs
    'public',                            # default create-next-app SVGs at repo root (not served by any active app)
    'md',                                # empty folder
    'web',                               # empty folder
    'api',                               # empty folder

    # --- Stray data files at repo root ---------------------------------------
    'bank_statements_good_package.zip',
    'bank_statements_past4_realistic_package.zip',
    'bsb-033-123-----account-----4321---acme-bank.zip',
    'bsb-033-123-----account-----5678---acme-bank.zip',
    'bsb-033-123-----account-----8765---acme-bank.zip',

    # --- One-off PHP-conversion helper scripts (tied to exports\) ------------
    'tools\auth_group_summary.py',
    'tools\backup_group.py',
    'tools\backup_priority_group.py',
    'tools\export_php_files.py',
    'tools\social_group_summary.py',
    'tools\summary_export.py',
    'tools\validate_php_export.py',

    # --- Build caches, reports and runtime logs (all regenerable) ------------
    'athena-frontend\.next',
    'athena-frontend\.codex-logs',
    'athena-frontend\playwright-report-athena',
    'athena-frontend\test-results',
    'athena-frontend\runtime-mock-api.err.log',
    'athena-frontend\runtime-mock-api.out.log',
    'athena-frontend\runtime-smoke.err.log',
    'athena-frontend\runtime-smoke.out.log',
    'athena-frontend\e2e\.auth\storageState.json',   # captured auth session state — should not persist on disk
    'app-backend\runtime-backend.err.log',
    'app-backend\runtime-backend.out.log',
    'app-backend\src\routes\__tests__\Untitled-1.ipynb',
    'auth-service\runtime-auth.err.log',
    'auth-service\runtime-auth.out.log',
    'athena-platform\server\dist',
    'athena-platform\shared\dist',
    'athena-platform\client\.netlify',
    'athena-platform\client\.swc',
    'athena-platform\ml\src\api\services\__pycache__'
)

# NOTE — intentionally NOT quarantined (see CLEANUP-MANIFEST.md):
#   packages\ui\dist and packages\ui\mari-ui-0.1.0.tgz  -> athena-frontend depends on them
#   root package.json / package-lock.json / node_modules -> review manually first
#   athena-platform\server\uploads                       -> may contain real uploaded files
#   active .env / .env.local files                       -> needed to run; ROTATE the secrets instead

$moved = 0; $missing = 0; $failed = 0
$log = New-Object System.Collections.Generic.List[string]
$mode = if ($Apply) { 'APPLY' } else { 'DRY RUN' }
Write-Host "=== ATHENA cleanup ($mode) ===" -ForegroundColor Cyan
Write-Host "Root:       $root"
Write-Host "Quarantine: $quarantine`n"

foreach ($rel in $items) {
    $src = Join-Path $root $rel
    if (-not (Test-Path -LiteralPath $src)) {
        Write-Host "  [skip] not found: $rel" -ForegroundColor DarkGray
        $missing++
        continue
    }
    $dest = Join-Path $quarantine $rel
    if ($Apply) {
        try {
            $destParent = Split-Path -Parent $dest
            if (-not (Test-Path -LiteralPath $destParent)) {
                New-Item -ItemType Directory -Path $destParent -Force | Out-Null
            }
            Move-Item -LiteralPath $src -Destination $dest -Force
            Write-Host "  [moved] $rel" -ForegroundColor Green
            $log.Add("$(Get-Date -Format s)  MOVED  $rel")
            $moved++
        } catch {
            Write-Host "  [FAILED] $rel -> $($_.Exception.Message)" -ForegroundColor Red
            $log.Add("$(Get-Date -Format s)  FAILED $rel : $($_.Exception.Message)")
            $failed++
        }
    } else {
        $size = ''
        try {
            if (Test-Path -LiteralPath $src -PathType Leaf) {
                $size = ' ({0:N0} KB)' -f ((Get-Item -LiteralPath $src).Length / 1KB)
            }
        } catch {}
        Write-Host "  [would move] $rel$size" -ForegroundColor Yellow
        $moved++
    }
}

Write-Host ""
if ($Apply) {
    if (-not (Test-Path -LiteralPath $quarantine)) {
        New-Item -ItemType Directory -Path $quarantine -Force | Out-Null
    }
    $log | Add-Content -Path (Join-Path $quarantine 'MOVED-MANIFEST.txt')
    Write-Host "Done. Moved: $moved  Missing: $missing  Failed: $failed" -ForegroundColor Cyan
    Write-Host "Review _to_delete\ and delete it yourself when satisfied." -ForegroundColor Cyan
    if ($failed -gt 0) {
        Write-Host "Some items failed (often OneDrive file locks) — close editors/pause OneDrive sync and re-run." -ForegroundColor Yellow
    }
} else {
    Write-Host "Dry run complete. $moved item(s) would be moved ($missing not found)." -ForegroundColor Cyan
    Write-Host "Run again with -Apply to perform the moves." -ForegroundColor Cyan
}
