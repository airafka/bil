$ErrorActionPreference = 'Stop'
node (Join-Path $PSScriptRoot 'waybill-mass-smoke-test.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
