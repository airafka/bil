$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts/docker-command.ps1')
$dockerCommand = Resolve-BillingDocker
& $dockerCommand compose --project-directory $PSScriptRoot -f (Join-Path $PSScriptRoot 'compose.yaml') -p billing-next up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Не удалось запустить новую копию' }
Write-Host 'Новая копия: http://localhost:3001 (или FRONTEND_PORT из .env)'
