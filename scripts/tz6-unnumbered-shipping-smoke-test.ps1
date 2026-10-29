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
    $json = $Payload | ConvertTo-Json -Depth 14
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

function Base-Payload {
    param([string]$FillingType)
    return @{
        clientId = $clientId
        terminalAreaId = $areaId
        transportType = 'RAILWAY'
        fillingType = $FillingType
        containers = @()
        waybillIds = @()
        railwayCarriages = @()
        railwayCarriageQuantities = @()
        containerQuantities = @()
    }
}

$clients = Invoke-RestMethod "$baseUrl/api/references/clients?limit=100"
$areas = Invoke-RestMethod "$baseUrl/api/references/terminal-areas"
$carriages = Invoke-RestMethod "$baseUrl/api/references/railway-carriages?limit=100"
$carriageTypes = Invoke-RestMethod "$baseUrl/api/references/railway-carriage-types?limit=100"
$containers = Invoke-RestMethod "$baseUrl/api/references/containers?limit=100"
$cargo = Invoke-RestMethod "$baseUrl/api/references/etsng-codes?limit=100"
Assert-True (@($clients).Count -gt 0) 'client reference is available'
Assert-True (@($areas).Count -gt 0) 'container terminal area is available'
Assert-True (@($carriages).Count -ge 2) 'numbered railway carriages are available'
Assert-True (@($carriageTypes).Count -gt 0) 'railway carriage type reference is available'
Assert-True (@($containers).Count -ge 3) 'numbered containers are available'
Assert-True (@($cargo).Count -ge 2) 'cargo reference is available'

$clientId = $clients[0].id
$areaId = $areas[0].id
$loadedContainer = @{ containerId = $containers[0].id; empty = $false; cargo = @{ etsngCodeId = $cargo[0].id; weight = 24500.125 } }
$emptyContainer = @{ containerId = $containers[1].id; empty = $true; cargo = $null }
$emptyQuantity = @{ quantity = 3; type = 'STANDARD_20'; empty = $true; items = @() }
$loadedQuantity = @{
    quantity = 2
    type = 'STANDARD_40'
    empty = $false
    items = @(
        @{ etsngCodeId = $cargo[0].id; weight = 30000.000 },
        @{ etsngCodeId = $cargo[1].id; weight = 1250.500 }
    )
}

$onlyCarriagesPayload = Base-Payload 'RAILWAY_CARRIAGE'
$onlyCarriagesPayload.railwayCarriages = @(
    @{ railwayCarriageId = $carriages[0].id; containers = @() },
    @{ railwayCarriageId = $carriages[1].id; containers = @() }
)
$onlyCarriagesPayload.containerQuantities = @($emptyQuantity, $loadedQuantity)
$onlyCarriages = Post-Json $onlyCarriagesPayload
$onlyCarriagesDetails = Invoke-RestMethod "$baseUrl/api/shipping-orders/$($onlyCarriages.id)"
Assert-True ($onlyCarriagesDetails.fillingType -eq 'RAILWAY_CARRIAGE') 'RAILWAY_CARRIAGE filling type is persisted'
Assert-True (@($onlyCarriagesDetails.railwayCarriages).Count -eq 2) 'numbered carriages are returned without numbered containers'
Assert-True (@($onlyCarriagesDetails.railwayCarriages[0].containers).Count -eq 0) 'numbered carriage can exist without KTK'
Assert-True (@($onlyCarriagesDetails.containerQuantities).Count -eq 2) 'container quantity groups are returned'
Assert-True (@($onlyCarriagesDetails.containerQuantities | Where-Object { -not $_.empty }).items.Count -eq 2) 'multiple planned cargo items are returned'

$onlyContainersPayload = Base-Payload 'CONTAINER'
$onlyContainersPayload.railwayCarriageQuantities = @(@{ quantity = 4; typeId = $carriageTypes[0].id })
$onlyContainersPayload.containers = @($loadedContainer, $emptyContainer)
$onlyContainers = Post-Json $onlyContainersPayload
$onlyContainersDetails = Invoke-RestMethod "$baseUrl/api/shipping-orders/$($onlyContainers.id)"
Assert-True ($onlyContainersDetails.fillingType -eq 'CONTAINER') 'CONTAINER filling type is persisted'
Assert-True (@($onlyContainersDetails.railwayCarriageQuantities).Count -eq 1) 'planned carriage quantity is returned'
Assert-True (-not [string]::IsNullOrWhiteSpace($onlyContainersDetails.railwayCarriageQuantities[0].typeName)) 'carriage type is resolved from reference'
Assert-True (@($onlyContainersDetails.containers).Count -eq 2) 'numbered containers are returned without numbered carriage'

$nonePayload = Base-Payload 'NONE'
$nonePayload.railwayCarriageQuantities = @(@{ quantity = 5; typeId = $null })
$nonePayload.containerQuantities = @($emptyQuantity, $loadedQuantity)
$none = Post-Json $nonePayload
$noneDetails = Invoke-RestMethod "$baseUrl/api/shipping-orders/$($none.id)"
Assert-True ($noneDetails.fillingType -eq 'NONE') 'NONE filling type is persisted'
Assert-True (@($noneDetails.railwayCarriages).Count -eq 0) 'NONE has no numbered carriages'
Assert-True (@($noneDetails.containers).Count -eq 0) 'NONE has no numbered containers'
Assert-True ($noneDetails.railwayCarriageQuantities[0].typeId -eq $null) 'unknown carriage type is supported'

$legacyVehicle = Post-Json @{
    clientId = $clientId
    terminalAreaId = $areaId
    transportType = 'VEHICLE'
    containers = @($emptyContainer)
}
$legacyVehicleDetails = Invoke-RestMethod "$baseUrl/api/shipping-orders/$($legacyVehicle.id)"
Assert-True ($legacyVehicleDetails.fillingType -eq 'ALL') 'legacy vehicle request defaults to ALL'

$missingCarriages = Base-Payload 'RAILWAY_CARRIAGE'
$missingCarriages.containerQuantities = @($emptyQuantity)
Assert-Rejected $missingCarriages 400 'RAILWAY_CARRIAGES_REQUIRED' 'RAILWAY_CARRIAGE without numbered carriages'
$missingContainerQuantities = Base-Payload 'RAILWAY_CARRIAGE'
$missingContainerQuantities.railwayCarriages = @(@{ railwayCarriageId = $carriages[0].id; containers = @() })
Assert-Rejected $missingContainerQuantities 400 'CONTAINER_QUANTITIES_REQUIRED' 'RAILWAY_CARRIAGE without container quantities'
$mixedCarriages = Base-Payload 'CONTAINER'
$mixedCarriages.railwayCarriages = @(@{ railwayCarriageId = $carriages[0].id; containers = @() })
$mixedCarriages.railwayCarriageQuantities = @(@{ quantity = 1; typeId = $null })
$mixedCarriages.containers = @($emptyContainer)
Assert-Rejected $mixedCarriages 400 'NUMBERED_RAILWAY_CARRIAGES_NOT_ALLOWED' 'mixed numbered and quantity carriages'
$zeroQuantity = Base-Payload 'NONE'
$zeroQuantity.railwayCarriageQuantities = @(@{ quantity = 0; typeId = $null })
$zeroQuantity.containerQuantities = @($emptyQuantity)
Assert-Rejected $zeroQuantity 400 'INVALID_QUANTITY' 'zero railway carriage quantity'
$duplicateUnknownTypes = Base-Payload 'NONE'
$duplicateUnknownTypes.railwayCarriageQuantities = @(
    @{ quantity = 1; typeId = $null },
    @{ quantity = 2; typeId = $null }
)
$duplicateUnknownTypes.containerQuantities = @($emptyQuantity)
Assert-Rejected $duplicateUnknownTypes 400 'DUPLICATE_RAILWAY_CARRIAGE_TYPE' 'duplicate unknown railway carriage type'
$cargoForEmpty = Base-Payload 'NONE'
$cargoForEmpty.railwayCarriageQuantities = @(@{ quantity = 1; typeId = $null })
$cargoForEmpty.containerQuantities = @(@{ quantity = 1; type = 'STANDARD_20'; empty = $true; items = @(@{ etsngCodeId = $cargo[0].id; weight = 10 }) })
Assert-Rejected $cargoForEmpty 400 'CARGO_FOR_EMPTY_CONTAINER' 'cargo for empty quantity group'
$invalidFillingType = Base-Payload 'UNKNOWN'
Assert-Rejected $invalidFillingType 400 'INVALID_FILLING_TYPE' 'unknown filling type'

$beforeUnknownReference = (Invoke-RestMethod "$baseUrl/api/shipping-orders?page=0&size=1").totalElements
$unknownReference = Base-Payload 'CONTAINER'
$unknownReference.railwayCarriageQuantities = @(@{ quantity = 1; typeId = 'ffffffff-ffff-ffff-ffff-ffffffffffff' })
$unknownReference.containers = @($emptyContainer)
Assert-Rejected $unknownReference 404 'REFERENCE_NOT_FOUND' 'unknown railway carriage type'
$afterUnknownReference = (Invoke-RestMethod "$baseUrl/api/shipping-orders?page=0&size=1").totalElements
Assert-True ($afterUnknownReference -eq $beforeUnknownReference) 'failed child reference leaves no partial shipping order'

$registry = Invoke-RestMethod "$baseUrl/api/shipping-orders?page=0&size=100"
Assert-True (@($registry.items | Where-Object { $_.id -eq $none.id -and $_.fillingType -eq 'NONE' }).Count -eq 1) 'common registry returns filling type'
$createPage = Invoke-WebRequest -UseBasicParsing "$baseUrl/shipping-orders/new"
$detailsPage = Invoke-WebRequest -UseBasicParsing "$baseUrl/shipping-orders/$($none.id)"
Assert-True ($createPage.StatusCode -eq 200) 'shipping creation route is available'
Assert-True ($detailsPage.StatusCode -eq 200) 'unnumbered shipping details route is available'

Write-Output 'TZ6 UNNUMBERED SHIPPING SMOKE TEST PASSED'

