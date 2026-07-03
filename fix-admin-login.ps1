# fix-admin-login.ps1
# One-shot: makes the four Super Admins able to sign in.
#   1. Applies migration 0013 (must_change_password column).
#   2. Creates/updates the admin accounts with 07-format phones + passwords,
#      forces them active, and clears any lockout.
#
# Run from the repo root in PowerShell:
#   .\fix-admin-login.ps1
#
# Requirements: Docker Desktop running (alfayo-postgres container up).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "== 1/2  Applying migration 0013 (must_change_password) ==" -ForegroundColor Cyan
$mig = "packages/db/migrations/0013_auth_must_change_password.sql"
if (Test-Path $mig) {
    docker cp $mig alfayo-postgres:/tmp/0013.sql
    docker exec alfayo-postgres bash -c "psql -U alfayo -d alfayo_dev -f /tmp/0013.sql"
    Write-Host "   migration applied (safe to re-run - uses IF NOT EXISTS)." -ForegroundColor Green
} else {
    Write-Host "   migration file not found at $mig" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "== 2/2  Setting admin logins ==" -ForegroundColor Cyan
pnpm --filter @an/auth set:admins

Write-Host ""
Write-Host "Done. Sign in with:" -ForegroundColor Green
Write-Host "   Dan Ngure       ADMIN001     / ADMIN001"
Write-Host "   Benson Imoli    0725967858   / 29580321"
Write-Host "   Irene Mkamburi  0715562217   / 38583776"
Write-Host "   Alfayo Nelson   0743327286   / 0743327286  (temp password)"
