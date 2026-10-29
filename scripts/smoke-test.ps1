$ErrorActionPreference = 'Stop'
$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:3000' }

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "FAILED: $Message" }
    Write-Output "PASS: $Message"
}

function Post-Order {
    param([string]$Path, [hashtable]$Payload)
    if ($Payload.clientId -and -not $Payload.ContainsKey('contractId')) {
        $allContracts = Invoke-RestMethod "$baseUrl/api/references/contracts"
        $matching = @($allContracts | Where-Object { $_.clientId -eq $Payload.clientId })
        $Payload.contractId = if ($matching.Count) { $matching[0].id } else { $allContracts[0].id }
    }
    $json = $Payload | ConvertTo-Json -Depth 8
    return Invoke-RestMethod -Method Post -Uri "$baseUrl$Path" -ContentType 'application/json' -Body $json
}

function Assert-Rejected {
    param([string]$Path, [hashtable]$Payload, [string]$Scenario, [int[]]$ExpectedStatus = @(400, 404, 409))
    try {
        Post-Order -Path $Path -Payload $Payload | Out-Null
        throw "FAILED: $Scenario was accepted"
    }
    catch {
        $status = [int]$_.Exception.Response.StatusCode
        Assert-True -Condition ($status -in $ExpectedStatus) -Message "$Scenario rejected with HTTP $status"
    }
}

function New-ValidPayload {
    param([string]$ClientId, [string]$TerminalAreaId, [string]$TransportType, [array]$Containers)
    return @{
        clientId = $ClientId
        terminalAreaId = $TerminalAreaId
        transportType = $TransportType
        containers = $Containers
    }
}

$clients = Invoke-RestMethod "$baseUrl/api/references/clients?limit=100"
$containers = Invoke-RestMethod "$baseUrl/api/references/containers?limit=100"
$cargo = Invoke-RestMethod "$baseUrl/api/references/etsng-codes?limit=100"
$areas = Invoke-RestMethod "$baseUrl/api/references/terminal-areas"
$transportTypes = Invoke-RestMethod "$baseUrl/api/references/transport-types"

Assert-True ($clients.Count -ge 3) 'at least 3 development clients are available'
Assert-True ($containers.Count -ge 10) 'at least 10 development containers are available'
Assert-True ($cargo.Count -ge 5) 'at least 5 development cargo codes are available'
Assert-True ($areas.Count -eq 1 -and $areas[0].code -eq 'CONTAINER') 'only the container terminal area is available'
Assert-True (($transportTypes.value -contains 'VEHICLE') -and ($transportTypes.value -contains 'RAILWAY')) 'vehicle and railway transport types are available'

$validClient = $clients[0].id
$validArea = $areas[0].id
$validContainer = $containers[0].id
$validCargo = $cargo[0].id
$missingId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
$loaded = @{ containerId = $validContainer; empty = $false; cargo = @{ etsngCodeId = $validCargo; weight = 24500.125 } }
$empty = @{ containerId = $containers[1].id; empty = $true; cargo = $null }

$receiving = Post-Order '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @($loaded))
$shipping = Post-Order '/api/shipping-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @($empty))
Assert-True ($receiving.status -eq 'DRAFT' -and $receiving.code -gt 0) 'receiving order has generated number and DRAFT status'
Assert-True ($shipping.status -eq 'DRAFT' -and $shipping.code -gt 0) 'shipping order has generated number and DRAFT status'

$receivingDetails = Invoke-RestMethod "$baseUrl/api/receiving-orders/$($receiving.id)"
$shippingDetails = Invoke-RestMethod "$baseUrl/api/shipping-orders/$($shipping.id)"
Assert-True ($receivingDetails.terminalArea.code -eq 'CONTAINER' -and $receivingDetails.transportType -eq 'VEHICLE') 'receiving order persists terminal area and vehicle transport'
Assert-True ($shippingDetails.terminalArea.code -eq 'CONTAINER' -and $shippingDetails.transportType -eq 'VEHICLE') 'shipping order persists terminal area and vehicle transport'

$beforeInvalid = (Invoke-RestMethod "$baseUrl/api/receiving-orders?page=0&size=100").totalElements
Assert-Rejected '/api/receiving-orders' @{
    clientId = $validClient; transportType = 'VEHICLE'; containers = @($empty)
} 'missing terminal area' @(400)
Assert-Rejected '/api/receiving-orders' @{
    clientId = $validClient; terminalAreaId = $validArea; containers = @($empty)
} 'missing transport type' @(400)
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $missingId 'VEHICLE' @($empty)) 'missing terminal area reference' @(404)
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'PLANE' @($empty)) 'unknown transport type' @(400)
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @()) 'empty container list'
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @(
    @{ containerId = $validContainer; empty = $true; cargo = $null },
    @{ containerId = $validContainer; empty = $true; cargo = $null }
)) 'duplicate container'
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @(
    @{ containerId = $validContainer; empty = $true; cargo = @{ etsngCodeId = $validCargo; weight = 1 } }
)) 'cargo for empty container'
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @(
    @{ containerId = $validContainer; empty = $false; cargo = $null }
)) 'missing cargo for loaded container'
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @(
    @{ containerId = $validContainer; empty = $false; cargo = @{ etsngCodeId = $validCargo; weight = 0 } }
)) 'non-positive weight'
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $missingId $validArea 'VEHICLE' @($empty)) 'missing client'
Assert-Rejected '/api/receiving-orders' (New-ValidPayload $validClient $validArea 'VEHICLE' @(
    @{ containerId = $missingId; empty = $true; cargo = $null }
)) 'missing container'

$afterInvalid = (Invoke-RestMethod "$baseUrl/api/receiving-orders?page=0&size=100").totalElements
Assert-True ($beforeInvalid -eq $afterInvalid) 'invalid requests leave the order registry unchanged'

$receivingPage = Invoke-WebRequest -UseBasicParsing "$baseUrl/receiving-orders"
$shippingCreatePage = Invoke-WebRequest -UseBasicParsing "$baseUrl/shipping-orders/new"
Assert-True ($receivingPage.StatusCode -eq 200) 'receiving registry route is available'
Assert-True ($shippingCreatePage.StatusCode -eq 200) 'shipping creation route is available'

Write-Output 'SMOKE TEST PASSED'

