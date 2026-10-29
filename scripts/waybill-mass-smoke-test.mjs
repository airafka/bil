import assert from 'node:assert/strict'
const base = process.env.BASE_URL ?? 'http://localhost:3000'
async function call(path, body, status = 200, method = 'POST') {
  const response = await fetch(base + path, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  assert.equal(response.status, status, JSON.stringify(result))
  return result
}
const refs = await call('/api/references/containers')
const cars = await call('/api/references/railway-carriages')
const cargo = await call('/api/references/etsng-codes')
assert.ok(refs.length >= 2 && cars.length && cargo.length)
const [first, second] = refs
const setTare = value => call(`/api/references/containers/${first.id}/tare-weight`, { tareWeight: value }, 200, 'PATCH')
await setTare('3200')
const payer = `MASS-${Date.now()}`
const payload = containers => ({ departureStation: 11111, destinationStation: 999999, payer,
  railwayCarriages: [{ railwayCarriageId: cars[0].id, containers }] })
const container = { containerId: first.id, grossWeight: '25000.125', etsngCodeId: cargo[0].id, tareWeight: 1, netWeight: 42 }
const find = async id => {
  const groups = await call('/api/waybills/grouped/page', { filter: { payer }, pageInfo: { page: 0, size: 100 } })
  return groups.content.flatMap(group => group.waybills).find(bill => bill.id === id)
}
const total = async () => (await call('/api/waybills/grouped/page', { pageInfo: { page: 0, size: 1 } })).totalElements
try {
  const bill = await call('/api/waybills', payload([container, { containerId: second.id, grossWeight: '3200', etsngCodeId: null }]), 201)
  const details = await find(bill.id)
  assert.equal(details.containers.length, 2)
  const loaded = details.containers.find(c => c.containerId === first.id)
  assert.equal(loaded.grossWeight, 25000.125)
  assert.equal(loaded.tareWeight, 3200)
  assert.equal(loaded.netWeight, 21800.125)
  assert.equal(details.products.length, 1)
  assert.equal(details.products[0].weight, 21800.125)
  assert.equal(details.containers.find(c => c.containerId === second.id).netWeight, 0)
  console.log('PASS: kg precision, per-KTK net and derived product mass; supplied net/tare cannot override calculation')
  const beforeInvalid = await total()
  const invalid = [
    [{ ...container, grossWeight: '3199.999' }, 'GROSS_BELOW_TARE'],
    [{ ...container, grossWeight: '0' }, 'GROSS_WEIGHT_REQUIRED'],
    [{ ...container, grossWeight: '3200.0001' }, 'INVALID_WEIGHT_SCALE'],
    [{ ...container, grossWeight: '25000', etsngCodeId: null }, 'ETSNG_CODE_REQUIRED'],
    [{ ...container, grossWeight: '3200' }, 'CARGO_FOR_EMPTY_CONTAINER'],
  ]
  for (const [row, code] of invalid) {
    const problem = await call('/api/waybills', { ...payload([row]), payer: 'FAILED-' + payer }, 400)
    assert.equal(problem.code, code)
  }
  const duplicate = await call('/api/waybills', payload([container, container]), 400)
  assert.equal(duplicate.code, 'DUPLICATE_CONTAINER')
  assert.equal(await total(), beforeInvalid)
  console.log('PASS: below-tare, precision, missing cargo, cargo for empty KTK, duplicates and atomic rollback')
  await call(`/api/references/containers/${first.id}/tare-weight`, { tareWeight: 0 }, 400, 'PATCH')
  await setTare('3400')
  assert.equal((await find(bill.id)).containers.find(c => c.containerId === first.id).tareWeight, 3400)
  assert.equal((await find(bill.id)).containers.find(c => c.containerId === first.id).netWeight, 21600.125)
  const next = await call('/api/waybills', payload([container]), 201)
  assert.equal((await find(next.id)).containers[0].netWeight, 21600.125)
  console.log('PASS: tare is read live from the container reference for every waybill')
  const clients = await call('/api/references/clients'), contracts = await call('/api/references/contracts')
  const service = await call('/api/service-orders', {
    clientId: clients[0].id, contractId: contracts.find(c => c.clientId === clients[0].id).id, waybillIds: [bill.id],
  }, 201)
  const nested = service.receivingOrder.waybills[0].railwayCarriages.flatMap(c => c.containers).find(c => c.containerId === first.id)
  assert.equal(nested.netWeight, 21600.125)
  assert.equal(service.shippingOrders.length, 2)
  const removals = await Promise.all(service.shippingOrders.map(row => call('/api/shipping-orders/' + row.id)))
  const loadedRemoval = removals.find(order => order.containers[0].containerId === first.id)
  const emptyRemoval = removals.find(order => order.containers[0].containerId === second.id)
  assert.equal(loadedRemoval.containers[0].empty, false)
  assert.equal(loadedRemoval.containers[0].cargo.etsngCodeId, cargo[0].id)
  assert.equal(loadedRemoval.containers[0].cargo.weight, 21600.125)
  assert.equal(emptyRemoval.containers[0].empty, true)
  assert.equal(emptyRemoval.containers[0].cargo ?? null, null)
  const row = service.shippingOrders.find(row => row.containerId === first.id)
  assert.equal(row.weight, 21600.125)
  assert.equal(row.empty, false)
  await setTare('3200')
  assert.equal((await call('/api/shipping-orders/' + loadedRemoval.id)).containers[0].cargo.weight, 21600.125)
  assert.equal((await find(bill.id)).containers.find(c => c.containerId === first.id).netWeight, 21800.125)
  console.log('PASS: each removal inherits its own cargo and calculated weight; empty KTK stays empty; saved removal cargo is fixed')
} finally { await setTare('3200') }
