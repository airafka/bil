$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:3000' }

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "FAILED: $Message" }
    Write-Output "PASS: $Message"
}

function Post-Json {
    param([string]$Path, [hashtable]$Payload)
    if ($Payload.clientId -and -not $Payload.ContainsKey('contractId')) {
        $allContracts = Invoke-RestMethod "$baseUrl/api/references/contracts"
        $matching = @($allContracts | Where-Object { $_.clientId -eq $Payload.clientId })
        $Payload.contractId = if ($matching.Count) { $matching[0].id } else { $allContracts[0].id }
    }
    if ($Path -eq '/api/waybills') {
        foreach ($carriage in $Payload.railwayCarriages) {
            if ($carriage.ContainsKey('containerIds')) {
                $carriage.containers = @($carriage.containerIds | ForEach-Object { @{ containerId = $_; grossWeight = 3200; etsngCodeId = $null } })
                $carriage.Remove('containerIds')
            }
        }
        $Payload.Remove('products')
    }
    $json = $Payload | ConvertTo-Json -Depth 12
    return Invoke-RestMethod -Method Post -Uri "$baseUrl$Path" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

function Assert-Rejected {
    param([string]$Path, [hashtable]$Payload, [int]$ExpectedStatus, [string]$ExpectedCode, [string]$Scenario)
    try {
        Post-Json $Path $Payload | Out-Null
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

function New-Waybill {
    param(
        [string]$Number,
        [int]$Departure,
        [int]$Destination,
        [string]$Payer,
        [string]$CarriageId,
        [array]$ContainerIds,
        [string]$CargoId
    )
    return Post-Json '/api/waybills' @{
        number = $Number
        receivingOrderId = $null
        departureStation = $Departure
        destinationStation = $Destination
        payer = $Payer
        railwayCarriages = @(@{ railwayCarriageId = $CarriageId; containerIds = $ContainerIds })
        products = @(@{ etsngCodeId = $CargoId; weight = 12.500 })
    }
}

function Grouped {
    param([int]$Departure, [int]$Destination, [string]$Payer, [bool]$AvailableOnly)
    return Post-Json '/api/waybills/grouped/page' @{
        filter = @{ departureStation = $Departure; destinationStation = $Destination; payer = $Payer }
        pageInfo = @{ page = 0; size = 20 }
        sortingColumn = 'departureStation'
        sortingDirection = 'ASC'
        availableForReceivingOrderOnly = $AvailableOnly
    }
}

$clients = Invoke-RestMethod "$baseUrl/api/references/clients?limit=100"
$areas = Invoke-RestMethod "$baseUrl/api/references/terminal-areas"
$carriages = Invoke-RestMethod "$baseUrl/api/references/railway-carriages?limit=100"
$containers = Invoke-RestMethod "$baseUrl/api/references/containers?limit=100"
$cargo = Invoke-RestMethod "$baseUrl/api/references/etsng-codes?limit=100"
Assert-True (@($clients).Count -gt 0) 'client reference is available'
Assert-True (@($carriages).Count -ge 5) 'railway carriage reference is available'
Assert-True (@($containers).Count -ge 5) 'container reference is available'

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$departure = 300000 + [int]($stamp % 10000)
$destination = 400000 + [int]($stamp % 10000)
$payer = "TZ4-$stamp"
$clientId = $clients[0].id
$areaId = $areas[0].id

$first = New-Waybill "TZ4-$stamp-A" $departure $destination $payer $carriages[0].id @($containers[0].id, $containers[1].id) $cargo[0].id
$second = New-Waybill "TZ4-$stamp-B" $departure $destination $payer $carriages[1].id @($containers[2].id) $cargo[1].id

$availableBefore = Grouped $departure $destination $payer $true
$availableGroup = @($availableBefore.content)[0]
Assert-True ($availableBefore.totalElements -eq 1) 'available mode returns the expected group'
Assert-True ($availableGroup.waybillCount -eq 2) 'available mode counts only two free waybills'
Assert-True ($availableGroup.railwayCarriageCount -eq 2) 'available mode counts free railway carriages'
Assert-True ($availableGroup.containerCount -eq 3) 'available mode counts free containers'

$railwayPayload = @{
    clientId = $clientId
    terminalAreaId = $areaId
    transportType = 'RAILWAY'
    containers = @()
    waybillIds = @($first.id, $second.id)
}
$railwayOrder = Post-Json '/api/receiving-orders' $railwayPayload
Assert-True ($railwayOrder.status -eq 'DRAFT') 'railway receiving order is created as DRAFT'

$details = Invoke-RestMethod "$baseUrl/api/receiving-orders/$($railwayOrder.id)"
Assert-True ($details.transportType -eq 'RAILWAY') 'railway transport is persisted'
Assert-True (@($details.containers).Count -eq 0) 'railway order has no copied vehicle containers'
Assert-True (@($details.waybills).Count -eq 2) 'railway order details contain both waybills'
Assert-True ((@($details.waybills.railwayCarriages).Count) -ge 2) 'waybill carriage structure is returned'

$availableAfter = Grouped $departure $destination $payer $true
$ordinaryAfter = Grouped $departure $destination $payer $false
Assert-True ($availableAfter.totalElements -eq 0) 'linked waybills disappear from available mode'
Assert-True ($ordinaryAfter.content[0].waybillCount -eq 2) 'ordinary waybill registry still includes linked waybills'

Assert-Rejected '/api/receiving-orders' @{
    clientId = $clientId; terminalAreaId = $areaId; transportType = 'RAILWAY'; containers = @(); waybillIds = @()
} 400 'EMPTY_WAYBILL_LIST' 'empty railway waybill list'
Assert-Rejected '/api/receiving-orders' @{
    clientId = $clientId; terminalAreaId = $areaId; transportType = 'RAILWAY'; containers = @(); waybillIds = @($first.id, $first.id)
} 400 'DUPLICATE_WAYBILL' 'duplicate railway waybill'
Assert-Rejected '/api/receiving-orders' @{
    clientId = $clientId; terminalAreaId = $areaId; transportType = 'RAILWAY'; containers = @(@{ containerId = $containers[0].id; empty = $true; cargo = $null }); waybillIds = @($first.id)
} 400 'CONTAINERS_NOT_ALLOWED_FOR_RAILWAY' 'manual container in railway request'
Assert-Rejected '/api/receiving-orders' @{
    clientId = $clientId; terminalAreaId = $areaId; transportType = 'VEHICLE'; containers = @(@{ containerId = $containers[0].id; empty = $true; cargo = $null }); waybillIds = @($first.id)
} 400 'WAYBILLS_NOT_ALLOWED_FOR_VEHICLE' 'waybill in vehicle request'
Assert-Rejected '/api/receiving-orders' @{
    clientId = $clientId; terminalAreaId = $areaId; transportType = 'RAILWAY'; containers = @(); waybillIds = @('ffffffff-ffff-ffff-ffff-ffffffffffff')
} 404 'WAYBILL_NOT_FOUND' 'unknown waybill'
Assert-Rejected '/api/receiving-orders' $railwayPayload 409 'WAYBILL_ALREADY_LINKED' 'already linked waybill'

$third = New-Waybill "TZ4-$stamp-C" $departure $destination $payer $carriages[2].id @($containers[3].id) $cargo[0].id
$other = New-Waybill "TZ4-$stamp-D" ($departure + 1) $destination $payer $carriages[3].id @($containers[4].id) $cargo[0].id
Assert-Rejected '/api/receiving-orders' @{
    clientId = $clientId; terminalAreaId = $areaId; transportType = 'RAILWAY'; containers = @(); waybillIds = @($third.id, $other.id)
} 400 'WAYBILLS_FROM_DIFFERENT_GROUPS' 'waybills from different groups'
Assert-True ((Grouped $departure $destination $payer $true).content[0].waybills.id -contains $third.id) 'group mismatch rolls back and leaves first waybill free'
Assert-True ((Grouped ($departure + 1) $destination $payer $true).content[0].waybills.id -contains $other.id) 'group mismatch leaves second waybill free'

$vehicleOrder = Post-Json '/api/receiving-orders' @{
    clientId = $clientId
    terminalAreaId = $areaId
    transportType = 'VEHICLE'
    containers = @(@{ containerId = $containers[0].id; empty = $true; cargo = $null })
}
Assert-True ($vehicleOrder.status -eq 'DRAFT') 'legacy vehicle JSON without waybillIds still works'

$race = New-Waybill "TZ4-$stamp-RACE" ($departure + 2) $destination $payer $carriages[4].id @() $cargo[0].id
$raceContract = (Invoke-RestMethod "$baseUrl/api/references/contracts?clientId=$clientId")[0].id
$racePayload = @{ contractId = $raceContract;
    clientId = $clientId; terminalAreaId = $areaId; transportType = 'RAILWAY'; containers = @(); waybillIds = @($race.id)
} | ConvertTo-Json -Depth 8
$httpClient = [System.Net.Http.HttpClient]::new()
$contentOne = [System.Net.Http.StringContent]::new($racePayload, [Text.Encoding]::UTF8, 'application/json')
$contentTwo = [System.Net.Http.StringContent]::new($racePayload, [Text.Encoding]::UTF8, 'application/json')
$taskOne = $httpClient.PostAsync("$baseUrl/api/receiving-orders", $contentOne)
$taskTwo = $httpClient.PostAsync("$baseUrl/api/receiving-orders", $contentTwo)
[System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]@($taskOne, $taskTwo))
$statuses = @([int]$taskOne.Result.StatusCode, [int]$taskTwo.Result.StatusCode) | Sort-Object
Assert-True (($statuses -join ',') -eq '201,409') 'parallel use of one waybill produces one success and one conflict'
$httpClient.Dispose()

$createPage = Invoke-WebRequest -UseBasicParsing "$baseUrl/receiving-orders/new"
$detailsPage = Invoke-WebRequest -UseBasicParsing "$baseUrl/receiving-orders/$($railwayOrder.id)"
Assert-True ($createPage.StatusCode -eq 200) 'receiving order creation route is available'
Assert-True ($detailsPage.StatusCode -eq 200) 'railway order details route is available'

Write-Output 'TZ4 RAILWAY ORDER SMOKE TEST PASSED'


