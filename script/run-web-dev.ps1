$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$webDir = Join-Path $repoRoot "web"
$envFile = Join-Path $webDir ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile. Add web/.env.local before running the dev server."
  exit 1
}

Set-Location $webDir
corepack pnpm dev
exit $LASTEXITCODE
