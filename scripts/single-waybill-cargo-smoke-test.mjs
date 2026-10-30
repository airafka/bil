import assert from 'node:assert/strict'
const base = process.env.BASE_URL
if (!base) throw new Error('Set BASE_URL to an isolated test stack')
async function call(path, body, status = 200) {
  const response = await fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  assert.equal(response.status, status, JSON.stringify(result))
  return result
}
const containers = await call('/api/references/containers')
const cars = await call('/api/references/railway-carriages')
const cargos = await call('/api/references/etsng-codes')
assert.ok(containers.length >= 3 && cars.length && cargos.length >= 2)
const payer = `SINGLE-CARGO-${Date.now()}`
const rows = containers.slice(0, 3).map((c, i) => ({ containerId: c.id, grossWeight: (Number(c.tareWeight) + [100.125, 200.25, 0][i]).toFixed(3) }))
const payload = { payer, departureStation: 11111, destinationStation: 999999, etsngCodeId: cargos[0].id,
  railwayCarriages: [{ railwayCarriageId: cars[0].id, containers: rows }] }
const find = async id => (await call('/api/waybills/grouped/page', { filter: { payer }, pageInfo: { page: 0, size: 100 } }))
  .content.flatMap(group => group.waybills).find(bill => bill.id === id)
const created = await call('/api/waybills', payload, 201)
const bill = await find(created.id)
assert.equal(bill.products.length, 1)
assert.equal(bill.products[0].etsngCodeId, cargos[0].id)
assert.equal(bill.products[0].weight, 300.375)
for (const [i, row] of rows.entries()) {
  const c = bill.containers.find(c => c.containerId === row.containerId)
  assert.equal(c.grossWeight, Number(row.grossWeight))
  assert.equal(c.netWeight, [100.125, 200.25, 0][i])
  assert.equal(c.etsngCodeId ?? null, i === 2 ? null : cargos[0].id)
}
assert.equal(bill.railwayCarriages[0].containers.length, 3)
const clients = await call('/api/references/clients')
const contracts = await call('/api/references/contracts')
const contract = contracts.find(c => clients.some(client => client.id === c.clientId))
const service = await call('/api/service-orders', { clientId: contract.clientId, contractId: contract.id, waybillIds: [created.id] }, 201)
const delivery = await call('/api/receiving-orders/' + service.receivingOrder.id)
assert.equal(delivery.waybills[0].products.length, 1)
assert.equal(delivery.waybills[0].products[0].weight, 300.375)
assert.equal(delivery.waybills[0].railwayCarriages.flatMap(c => c.containers).length, 3)
for (const removal of service.shippingOrders) {
  const detail = await call('/api/shipping-orders/' + removal.id)
  const c = detail.containers[0], index = rows.findIndex(row => row.containerId === c.containerId)
  if (index === 2) { assert.equal(c.empty, true); assert.equal(c.cargo ?? null, null) }
  else { assert.equal(c.cargo.etsngCodeId, cargos[0].id); assert.equal(c.cargo.weight, [100.125, 200.25][index]) }
}
const invalid = [
  [{ ...payload, etsngCodeId: null }, 'ETSNG_CODE_REQUIRED'],
  [{ ...payload, etsngCodeId: '00000000-0000-0000-0000-000000000001' }, 'ETSNG_CODE_NOT_FOUND', 404],
  [{ ...payload, railwayCarriages: [{ ...payload.railwayCarriages[0], containers: [{ ...rows[0], etsngCodeId: cargos[1].id }] }] }, 'SINGLE_WAYBILL_CARGO'],
  [{ ...payload, railwayCarriages: [{ ...payload.railwayCarriages[0], containers: [rows[2]] }] }, 'CARGO_FOR_EMPTY_CONTAINER'],
  [{ ...payload, railwayCarriages: [{ ...payload.railwayCarriages[0], containers: [{ ...rows[0], grossWeight: '1' }] }] }, 'GROSS_BELOW_TARE'],
]
for (const [data, code, status = 400] of invalid) assert.equal((await call('/api/waybills', { ...data, payer: payer + '-FAILED' }, status)).code, code)
assert.equal((await call('/api/waybills/grouped/page', { filter: { payer: payer + '-FAILED' } })).totalElements, 0)
const empty = await call('/api/waybills', { ...payload, etsngCodeId: null, railwayCarriages: [{ ...payload.railwayCarriages[0], containers: [rows[2]] }] }, 201)
assert.equal((await find(empty.id)).products.length, 0)
const legacy = await call('/api/waybills', { ...payload, etsngCodeId: undefined, railwayCarriages: [{ ...payload.railwayCarriages[0], containers: rows.map((row, i) => ({ ...row, etsngCodeId: i === 2 ? null : cargos[0].id })) }] }, 201)
assert.equal((await find(legacy.id)).products.length, 1)
assert.equal((await find(legacy.id)).products[0].weight, 300.375)
console.log('PASS: common cargo, distinct masses, empty KTK, grouped API, receiving details, service flow, legacy payload, conflicts and rollback')
