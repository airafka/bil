# Разовое восстановление только в пустую БД новой копии. Ничего не удаляет.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts/docker-command.ps1')
$dockerCommand = Resolve-BillingDocker
$composeArgs = @('compose', '--project-directory', $PSScriptRoot, '-f', (Join-Path $PSScriptRoot 'compose.yaml'), '-p', 'billing-next')
function Invoke-BillingCompose {
    & $dockerCommand @composeArgs @args
    if ($LASTEXITCODE -ne 0) { throw 'Команда Docker Compose завершилась ошибкой. Восстановление остановлено.' }
}
$dump = Join-Path $PSScriptRoot 'database/billing-next-snapshot.dump'
$manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'database/billing-next-snapshot.json') | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Контрольная сумма снимка не совпадает.' }
$config = (Invoke-BillingCompose config --format json) | ConvertFrom-Json
$dbUser = $config.services.db.environment.POSTGRES_USER
$dbName = $config.services.db.environment.POSTGRES_DB
if ($dbName -ne 'billing_next') { throw 'Ожидается POSTGRES_DB=billing_next. Восстановление в другую БД запрещено.' }
$running = @(Invoke-BillingCompose ps --status running --services)
if (($running -contains 'backend') -or ($running -contains 'frontend')) {
    throw 'Сначала остановите backend/frontend новой копии: .\stop.ps1. Восстановление допускается только в пустую БД.'
}
Invoke-BillingCompose up -d --wait db
$tableCount = (Invoke-BillingCompose exec -T db psql -X -U $dbUser -d $dbName -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','S','v','m','f');").Trim()
if ($tableCount -ne '0') { throw 'БД уже содержит таблицы или другие объекты. Данные сохранены, восстановление отменено. Используйте отдельное пустое окружение.' }
Invoke-BillingCompose cp $dump 'db:/tmp/billing-next-snapshot.dump'
Invoke-BillingCompose exec -T db pg_restore -U $dbUser -d $dbName --no-owner --no-acl --single-transaction --exit-on-error /tmp/billing-next-snapshot.dump
Write-Host 'Снимок восстановлен. Для запуска приложения выполните .\start.ps1.'
