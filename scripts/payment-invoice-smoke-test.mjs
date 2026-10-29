import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

assert.ok(process.env.BASE_URL, 'Set BASE_URL to an isolated test stack with V38 and at least two available charges')
const base = process.env.BASE_URL.replace(/\/$/, '')
async function call(path, body, expected = 200, method = 'POST') {
  const response = await fetch(base + path, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = response.status === 204 ? null : await response.json()
  assert.equal(response.status, expected, JSON.stringify(result))
  return result
}
const created = new Set()
try {
  const source = await call('/api/billing-charges?size=100')
  assert.ok(source.items.length, 'The isolated stack needs performed services and charges')
  const first = source.items[0]
  const service = await call(`/api/service-orders/${first.serviceOrderId}`)
  const filters = {
    clientId: service.order.clientId, contractId: service.order.contractId,
    period: new Date(first.performedAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }).slice(0, 7),
  }
  const available = () => call('/api/payment-invoices/available-charges?' + new URLSearchParams(filters))
  const candidates = await available()
  assert.ok(candidates.items.length >= 2, 'At least two unreserved charges in one client/contract/month are required')
  const [a, b] = candidates.items
  const payload = { ...filters, chargeIds: [a.id], requestKey: randomUUID() }
  await call('/api/payment-invoices', { ...payload, chargeIds: [] }, 400)
  await call('/api/payment-invoices', { ...payload, chargeIds: [a.id, a.id] }, 400)
  await call('/api/payment-invoices', { ...payload, period: '2026-13' }, 400)
  const wrongMonth = filters.period === '2000-01' ? '2000-02' : '2000-01'
  await call('/api/payment-invoices', { ...payload, period: wrongMonth }, 409)
  assert.ok((await available()).items.some(item => item.id === a.id))

  const invoice = await call('/api/payment-invoices', payload, 201)
  created.add(invoice.invoice.id)
  assert.equal(invoice.items.length, 1)
  assert.equal(invoice.invoice.amountWithoutVat, a.amountWithoutVat)
  assert.equal(invoice.invoice.amountWithVat, a.amountWithVat)
  assert.equal(invoice.items[0].serviceName, a.serviceName)
  assert.equal((await call('/api/payment-invoices', payload, 201)).invoice.id, invoice.invoice.id)
  await call('/api/payment-invoices', { ...payload, chargeIds: [b.id] }, 409)
  await call('/api/payment-invoices', { ...payload, requestKey: randomUUID() }, 409)
  await call('/api/payment-invoices', { ...payload, requestKey: randomUUID(), chargeIds: [a.id, b.id] }, 409)
  assert.ok(!(await available()).items.some(item => item.id === a.id))
  assert.ok((await available()).items.some(item => item.id === b.id), 'Failed mixed selection must not reserve valid lines')

  const race = await Promise.all([1, 2].map(async () => {
    const response = await fetch(base + '/api/payment-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...filters, chargeIds: [b.id], requestKey: randomUUID() }) })
    const body = await response.json()
    if (response.status === 201) created.add(body.invoice.id)
    return response.status
  }))
  assert.deepEqual(race.sort(), [201, 409])
  const detail = await call(`/api/payment-invoices/${invoice.invoice.id}`)
  assert.equal(detail.items[0].id, a.id)
  assert.equal(detail.invoice.status, 'DRAFT')
  const listing = await call('/api/payment-invoices')
  assert.ok(listing.items.some(item => item.id === invoice.invoice.id))
  console.log('PASS: exact selection and amounts, month filter, validation, retries, reservation, transaction rollback, concurrent conflict, saved detail and registry')
} finally {
  for (const id of created) await call(`/api/payment-invoices/${id}`, {}, 204, 'DELETE')
}
console.log('PASS: test drafts removed; their charges are available again')
