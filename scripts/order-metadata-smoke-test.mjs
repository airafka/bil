import assert from 'node:assert/strict'

// Creates test orders. Point BASE_URL at a separate dev stack with V37 applied.
assert.ok(process.env.BASE_URL, 'Set BASE_URL to an isolated dev stack; this test creates orders')
const base = process.env.BASE_URL.replace(/\/$/, '')
async function call(path, body, expected = 200) {
  const response = await fetch(base + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const result = await response.json()
  assert.equal(response.status, expected, JSON.stringify(result))
  return result
}

const [clients, contracts, containers, areas] = await Promise.all([
  '/api/references/clients', '/api/references/contracts', '/api/references/containers', '/api/references/terminal-areas',
].map(path => call(path)))
const contract = contracts.find(item => clients.some(client => client.id === item.clientId))
const area = areas.find(item => item.code === 'CONTAINER')
assert.ok(contract && containers.length && area, 'Dev seed is required')
const common = {
  clientId: contract.clientId, contractId: contract.id, terminalAreaId: area.id,
  transportType: 'VEHICLE', containers: [{ containerId: containers[0].id, empty: true, cargo: null }],
}
const cases = [
  { kind: 'receiving', date: 'arrivalAt', party: 'consignor', value: '2026-10-29T10:45', name: 'Тестовый отправитель', other: ['departureAt', 'consignee'] },
  { kind: 'shipping', date: 'departureAt', party: 'consignee', value: '2026-10-30T15:20', name: 'Тестовый получатель', other: ['arrivalAt', 'consignor'] },
]
for (const item of cases) {
  const path = `/api/${item.kind}-orders`
  const payload = { ...common, [item.date]: item.value, [item.party]: `  ${item.name}  ` }
  const created = await call(path, payload, 201)
  const details = await call(`${path}/${created.id}`)
  assert.equal(details[item.date].slice(0, 16), item.value, 'Local datetime must not shift')
  assert.equal(details[item.party], item.name)
  for (const field of item.other) assert.equal(details[field], null)

  const legacy = await call(path, common, 201)
  const legacyDetails = await call(`${path}/${legacy.id}`)
  assert.equal(legacyDetails[item.date], null)
  assert.equal(legacyDetails[item.party], null)
  await call(path, { ...payload, [item.party]: 'А'.repeat(256) }, 400)
  await call(path, { ...payload, [item.date]: 'invalid-date' }, 400)
}
console.log('PASS: receiving/shipping metadata persisted, local time preserved, old payloads supported, invalid input rejected')
