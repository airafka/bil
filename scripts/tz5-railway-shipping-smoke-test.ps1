$ErrorActionPreference = 'Stop'
$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:3000' }

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "FAILED: $Message" }
    Write-Output "PASS: $Message"
}

function Post-Json {
    param([hashtable]$Payload)
    if ($Payload.clientId -and -not $Payload.ContainsKey('contractId')) {
        $allContracts = Invoke-RestMethod "$baseUrl/api/references/contracts"
        $matching = @($allContracts | Where-Object { $_.clientId -eq $Payload.clientId })
        $Payload.contractId = if ($matching.Count) { $matching[0].id } else { $allContracts[0].id }
    }
    $json = $Payload | ConvertTo-Json -Depth 12
    return Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shipping-orders" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

function Assert-Rejected {
    param([hashtable]$Payload, [int]$ExpectedStatus, [string]$ExpectedCode, [string]$Scenario)
    try {
        Post-Json $Payload | Out-Null
        throw "FAILED: $Scenario was accepted"
    }
    catch {
        $status = [int]$_.Exception.Response.StatusCode
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Dispose()
        Assert-True ($status -eq $ExpectedStatus) "$Scenario returns HTTP $ExpectedStatus"
        Assert-True ($body -match $ExpectedCode) "$Scenario returns $ExpectedCode"
    }
}

function New-RailwayPayload {
    param([array]$RailwayCarriages)
    return @{
        clientId = $clientId
        terminalAreaId = $areaId
        transportType = 'RAILWAY'
        containers = @()
        waybillIds = @()
        railwayCarriages = $RailwayCarriages
    }
}

$clients = Invoke-RestMethod "$baseUrl/api/references/clients?limit=100"
$areas = Invoke-RestMethod "$baseUrl/api/references/terminal-areas"
$carriages = Invoke-RestMethod "$baseUrl/api/references/railway-carriages?limit=100"
$containers = Invoke-RestMethod "$baseUrl/api/references/containers?limit=100"
$cargo = Invoke-RestMethod "$baseUrl/api/references/etsng-codes?limit=100"
Assert-True (@($clients).Count -gt 0) 'client reference is available'
Assert-True (@($areas).Count -gt 0) 'terminal area reference is available'
Assert-True (@($carriages).Count -ge 2) 'at least two railway carriages are available'
Assert-True (@($containers).Count -ge 4) 'at least four containers are available'
Assert-True (@($cargo).Count -gt 0) 'cargo reference is available'

$clientId = $clients[0].id
$areaId = $areas[0].id
$loadedOne = @{ containerId = $containers[0].id; empty = $false; cargo = @{ etsngCodeId = $cargo[0].id; weight = 24500.125 } }
$empty = @{ containerId = $containers[1].id; empty = $true; cargo = $null }
$loadedTwo = @{ containerId = $containers[2].id; empty = $false; cargo = @{ etsngCodeId = $cargo[0].id; weight = 18000.5 } }
$validCarriages = @(
    @{ railwayCarriageId = $carriages[0].id; containers = @($loadedOne, $empty) },
    @{ railwayCarriageId = $carriages[1].id; containers = @($loadedTwo) }
)

$order = Post-Json (New-RailwayPayload $validCarriages)
Assert-True ($order.status -eq 'DRAFT') 'railway shipping order is created as DRAFT'

$details = Invoke-RestMethod "$baseUrl/api/shipping-orders/$($order.id)"
$nestedContainers = @($details.railwayCarriages | ForEach-Object { $_.containers })
Assert-True ($details.transportType -eq 'RAILWAY') 'railway transport is persisted'
Assert-True (@($details.containers).Count -eq 0) 'top-level containers are empty for railway shipping'
Assert-True (@($details.waybills).Count -eq 0) 'waybills are empty for railway shipping'
Assert-True (@($details.railwayCarriages).Count -eq 2) 'details contain two railway carriages'
Assert-True ($nestedContainers.Count -eq 3) 'details contain all three nested containers'
Assert-True (@($nestedContainers | Where-Object { $_.empty }).Count -eq 1) 'empty container state is returned'
Assert-True (@($nestedContainers | Where-Object { -not $_.empty -and $_.cargo }).Count -eq 2) 'loaded containers include cargo'

Assert-Rejected (New-RailwayPayload @()) 400 'RAILWAY_CARRIAGES_REQUIRED' 'empty railway carriage list'
Assert-Rejected (New-RailwayPayload @(
    @{ railwayCarriageId = $carriages[0].id; containers = @() }
)) 400 'EMPTY_RAILWAY_CARRIAGE' 'railway carriage without containers'
Assert-Rejected (New-RailwayPayload @(
    @{ railwayCarriageId = $carriages[0].id; containers = @($empty) },
    @{ railwayCarriageId = $carriages[0].id; containers = @($loadedTwo) }
)) 400 'DUPLICATE_RAILWAY_CARRIAGE' 'duplicate railway carriage'
Assert-Rejected (New-RailwayPayload @(
    @{ railwayCarriageId = $carriages[0].id; containers = @($empty) },
    @{ railwayCarriageId = $carriages[1].id; containers = @($empty) }
)) 400 'DUPLICATE_CONTAINER' 'duplicate container across railway carriages'

$mixedPayload = New-RailwayPayload $validCarriages
$mixedPayload.containers = @($empty)
Assert-Rejected $mixedPayload 400 'CONTAINERS_NOT_ALLOWED_FOR_RAILWAY' 'top-level container in railway shipping'
Assert-Rejected (New-RailwayPayload @(
    @{ railwayCarriageId = $carriages[0].id; containers = @(@{ containerId = $containers[3].id; empty = $true; cargo = @{ etsngCodeId = $cargo[0].id; weight = 10 } }) }
)) 400 'CARGO_FOR_EMPTY_CONTAINER' 'cargo for empty container'
Assert-Rejected (New-RailwayPayload @(
    @{ railwayCarriageId = $carriages[0].id; containers = @(@{ containerId = $containers[3].id; empty = $false; cargo = $null }) }
)) 400 'CARGO_REQUIRED' 'missing cargo for loaded container'
Assert-Rejected (New-RailwayPayload @(
    @{ railwayCarriageId = $carriages[0].id; containers = @(@{ containerId = $containers[3].id; empty = $false; cargo = @{ etsngCodeId = $cargo[0].id; weight = 0 } }) }
)) 400 'VALIDATION_ERROR' 'non-positive cargo weight'

$countBeforeUnknownReference = (Invoke-RestMethod "$baseUrl/api/shipping-orders?page=0&size=1").totalElements
Assert-Rejected (New-RailwayPayload @(
    @{ railwayCarriageId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; containers = @($empty) }
)) 404 'RAILWAY_CARRIAGE_NOT_FOUND' 'unknown railway carriage'
$countAfterUnknownReference = (Invoke-RestMethod "$baseUrl/api/shipping-orders?page=0&size=1").totalElements
Assert-True ($countAfterUnknownReference -eq $countBeforeUnknownReference) 'rejected request creates no partial order'

$vehicle = Post-Json @{
    clientId = $clientId
    terminalAreaId = $areaId
    transportType = 'VEHICLE'
    containers = @($empty)
}
Assert-True ($vehicle.status -eq 'DRAFT') 'legacy vehicle JSON still works'

$createPage = Invoke-WebRequest -UseBasicParsing "$baseUrl/shipping-orders/new"
$detailsPage = Invoke-WebRequest -UseBasicParsing "$baseUrl/shipping-orders/$($order.id)"
Assert-True ($createPage.StatusCode -eq 200) 'shipping order creation route is available'
Assert-True ($detailsPage.StatusCode -eq 200) 'railway shipping details route is available'

Write-Output 'TZ5 RAILWAY SHIPPING SMOKE TEST PASSED'

