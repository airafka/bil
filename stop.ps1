$ErrorActionPreference = 'Stop'
& 'C:\Users\Green-0482\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe' compose --project-directory $PSScriptRoot -f (Join-Path $PSScriptRoot 'compose.yaml') -p billing-next stop
if ($LASTEXITCODE -ne 0) { throw 'Не удалось остановить новую копию' }
