import assert from 'node:assert/strict'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const call = async (path, body, status = 200) => {
  const response = await fetch(base + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const result = await response.json()
  assert.equal(response.status, status, JSON.stringify(result))
  return result
}
const clients = await call('/api/references/clients')
const contracts = await call('/api/references/contracts')
const containers = await call('/api/references/containers')
const cargoCodes = await call('/api/references/etsng-codes')
const carriages = await call('/api/references/railway-carriages')
const areas = await call('/api/references/terminal-areas')
const client = clients[0]
const contract = contracts.find(item => item.clientId === client.id)
assert.ok(contract && containers.length >= 3 && carriages.length, 'Use an isolated dev stack with seed data')
const areaId = areas.find(item => item.code === 'CONTAINER').id
const waybill = ids => call('/api/waybills', {
  departureStation: 11111, destinationStation: 999999, payer: 'SERVICE-FLOW-SMOKE',
  railwayCarriages: ids.length ? [{ railwayCarriageId: carriages[0].id, containers: ids.map(containerId => ({ containerId, grossWeight: 13200 + containers.findIndex(c => c.id === containerId) * 1000, etsngCodeId: cargoCodes[0].id })) }] : [],
}, 201)
const totals = async () => Promise.all(['/api/service-orders', '/api/receiving-orders', '/api/shipping-orders'].map(async path => (await call(path)).totalElements))
const first = await waybill([containers[0].id, containers[1].id])
const second = await waybill([containers[0].id, containers[2].id])
const payload = { clientId: client.id, contractId: contract.id, waybillIds: [first.id, second.id] }
const before = await totals()
const service = await call('/api/service-orders', payload, 201)
assert.deepEqual(await totals(), [before[0] + 1, before[1] + 1, before[2] + 3])
assert.equal(service.shippingOrders.length, 3, 'Unique containers create exactly one removal each')
assert.equal(service.receivingOrder.transportType, 'RAILWAY')
assert.equal(service.receivingOrder.contractId, contract.id)
assert.equal(service.receivingOrder.serviceOrderId, service.order.id)
assert.equal(service.receivingOrder.waybills.length, 2)
const seen = new Set()
for (const removal of service.shippingOrders) {
  const order = await call(`/api/shipping-orders/${removal.id}`)
  assert.equal(order.serviceOrderId, service.order.id)
  assert.equal(order.sourceReceivingOrderId, service.receivingOrder.id)
  assert.equal(order.clientId, client.id)
  assert.equal(order.contractId, contract.id)
  assert.equal(order.transportType, 'VEHICLE')
  assert.equal(order.containers.length, 1)
  assert.equal(order.containers[0].empty, false)
  assert.equal(order.containers[0].cargo.etsngCodeId, cargoCodes[0].id)
  assert.equal(order.containers[0].cargo.weight, 10000 + containers.findIndex(c => c.id === order.containers[0].containerId) * 1000)
  assert.ok(!('driverFullName' in order) && !('vehicleNumber' in order))
  seen.add(order.containers[0].containerId)
}
assert.equal(seen.size, 3)
assert.equal((await call(`/api/service-orders/${service.order.id}`)).shippingOrders.length, 3)
console.log('PASS: contract inherited; railway receiving + 3 unique vehicle removals with per-container cargo and mass; parent/source links')

// Late validation failure after creating receiving must roll back every row and waybill link.
const empty = await waybill([])
const beforeInvalid = await totals()
const failure = await call('/api/service-orders', { ...payload, waybillIds: [empty.id] }, 400)
assert.equal(failure.code, 'SERVICE_ORDER_CONTAINERS_REQUIRED')
assert.deepEqual(await totals(), beforeInvalid)
const available = await call('/api/waybills/grouped/page', {
  filter: { payer: 'SERVICE-FLOW-SMOKE' }, pageInfo: { page: 0, size: 100 }, availableForReceivingOrderOnly: true,
})
assert.ok(available.content.some(group => group.waybills.some(item => item.id === empty.id)))
await call('/api/service-orders', payload, 409)
assert.deepEqual(await totals(), beforeInvalid)
const otherContract = contracts.find(item => item.clientId !== client.id)
assert.ok(otherContract)
const mismatch = await call('/api/service-orders', { ...payload, contractId: otherContract.id }, 400)
assert.equal(mismatch.code, 'CONTRACT_CLIENT_MISMATCH')
await call('/api/service-orders', { clientId: client.id, waybillIds: [empty.id] }, 400)
assert.deepEqual(await totals(), beforeInvalid)
console.log('PASS: no partial data for empty source, used waybill, missing contract or wrong client contract')

const concurrentBill = await waybill([containers[0].id])
const concurrentPayload = { ...payload, waybillIds: [concurrentBill.id] }
const beforeConcurrent = await totals()
const statuses = await Promise.all([1, 2].map(async () => (await fetch(base + '/api/service-orders', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(concurrentPayload),
})).status))
assert.deepEqual(statuses.sort(), [201, 409])
assert.deepEqual(await totals(), beforeConcurrent.map(value => value + 1))
console.log('PASS: concurrent creation creates one parent, one receiving and one removal')

const standalone = await call('/api/shipping-orders', {
  clientId: client.id, contractId: contract.id, terminalAreaId: areaId, transportType: 'VEHICLE',
  containers: [{ containerId: containers[0].id, empty: true, cargo: null }],
}, 201)
assert.equal((await call('/api/shipping-orders/' + standalone.id)).serviceOrderId ?? null, null)
console.log('PASS: standalone orders still work with a contract and no driver/vehicle fields')

