$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts/docker-command.ps1')
$dockerCommand = Resolve-BillingDocker
& $dockerCommand compose --project-directory $PSScriptRoot -f (Join-Path $PSScriptRoot 'compose.yaml') -p billing-next stop
if ($LASTEXITCODE -ne 0) { throw 'Не удалось остановить новую копию' }
