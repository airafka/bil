import assert from 'node:assert/strict'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
async function get(path) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, path)
  return response.json()
}
const clients = await get('/api/references/clients')
const contracts = await get('/api/references/contracts')
const areas = await get('/api/references/terminal-areas')
const area = areas.find(item => item.code === 'CONTAINER')
assert.ok(clients.length && area, 'Development references exist')

// Regression: a standalone unnumbered removal may contain several empty containers.
const payload = {
  clientId: clients[0].id,
  contractId: contracts.find(item => item.clientId === clients[0].id).id,
  terminalAreaId: area.id,
  transportType: 'VEHICLE',
  fillingType: 'VEHICLE_UNNUMBERED',
  containerQuantities: [{ quantity: 3, type: 'STANDARD_20', empty: true, items: [] }],
}
const response = await fetch(`${base}/api/shipping-orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
})
assert.equal(response.status, 201, await response.clone().text())
const created = await response.json()
const details = await get(`/api/shipping-orders/${created.id}`)
assert.equal(details.containerQuantities[0].quantity, 3)
assert.equal(details.transportType, 'VEHICLE')
assert.equal(details.fillingType, 'VEHICLE_UNNUMBERED')

for (const route of ['/api/services', '/api/complex-services']) {
  assert.equal((await fetch(`${base}${route}`)).status, 404, `${route} removed`)
}
console.log('PASS: standalone unnumbered removal with 3 containers; obsolete service catalog API endpoints removed')
