import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const base = process.env.BASE_URL
assert.equal(base, 'http://localhost:8083', 'This destructive fixture test requires the isolated alignment backend on 8083')
function sql(query) {
  return execFileSync('docker', ['exec', 'billing-alignment-db', 'psql', '-U', 'billing', '-d', 'billing_alignment_fresh', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], { encoding: 'utf8' }).trim()
}
async function call(path, body, expected = 200, method = 'POST') {
  const response = await fetch(base + path, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = response.status === 204 ? null : await response.json()
  assert.equal(response.status, expected, path + ': ' + JSON.stringify(data))
  return data
}
const fixture = '45000000-0000-0000-0000-000000000001'
sql(`insert into danger_class(id,code) values('${fixture}','ALIGN TEST') on conflict do nothing;
 insert into seal_type(id,code) values('${fixture}','ALIGN SEAL') on conflict do nothing;
 insert into complex_service_tariff(id,complex_service_id,client_id,contract_id,coefficient)
 select gen_random_uuid(),s.id,c.client_id,c.id,1 from complex_service_catalog s cross join contract c on conflict do nothing;`)
const [clients, contracts, containers, cars, cargos] = await Promise.all(['clients','contracts','containers','railway-carriages','etsng-codes'].map(key => call('/api/references/' + key)))
const contract = contracts[0], c40 = containers.find(c => c.type === 'STANDARD_40'), c20 = containers.filter(c => c.type === 'STANDARD_20')
assert.ok(c40 && c20.length >= 2)
function request(rows, products = [{ etsngCodeId: cargos[0].id, weight: '1500', signDanger: 'ALIGN TEST' }]) {
  return { departureStation: 1001, destinationStation: 2001, payer: 'ALIGN TEST PAYER', products,
    railwayCarriages: [{ railwayCarriageId: cars[0].id, containers: rows.map(c => ({ containerId: c.id, grossWeight: '6000', netWeight: '1500', owner: clients[0].name, sealNumbers: '0001; 0002', sealTypeId: fixture })) }] }
}
await call('/api/waybills', request([c40], []), 400)
const multi = [{ etsngCodeId: cargos[0].id, weight: '600', signDanger: 'ALIGN TEST' }, { etsngCodeId: cargos[1].id, weight: '900', signDanger: 'ALIGN TEST' }]
await call('/api/waybills', request([c40,c20[0]], multi), 400)
await call('/api/waybills', { ...request([c40]), railwayCarriages: [{ railwayCarriageId: cars[0].id, containers: [{ containerId: c40.id, grossWeight: '6000', netWeight: '6001' }] }] }, 400)
assert.equal(sql('select count(*) from waybill'), '0', 'invalid requests roll back')
const bill = await call('/api/waybills', { ...request([c40], multi), number:'ALIGN-MANUAL-1' }, 201)
assert.equal(bill.number,'ALIGN-MANUAL-1')
assert.equal(sql('select count(*) from waybill_product'), '2')
assert.equal(sql('select count(*) from waybill_zpu'), '2')
assert.equal(sql('select count(*) from waybill_container'), '1')
assert.equal(sql('select net_weight from waybill_container'), '1500.000')
let grouped = await call('/api/waybills/grouped/page', { filter: { payer: 'ALIGN TEST PAYER' } })
assert.equal(grouped.content[0].containerCount, 1)
assert.equal(grouped.content[0].waybills[0].containers.length, 1)
assert.equal(grouped.content[0].waybills[0].products.length, 2)
assert.deepEqual(grouped.content[0].waybills[0].products.map(p => p.weight).sort((a,b)=>a-b), [600,900])
await call('/api/references/containers/' + c40.id + '/tare-weight', { tareWeight: 3500 }, 200, 'PATCH')
grouped = await call('/api/waybills/grouped/page', { filter: { payer: 'ALIGN TEST PAYER' } })
assert.equal(grouped.content[0].waybills[0].containers[0].netWeight, 1500, 'net is a snapshot')
let service = await call('/api/comprehensive-service-orders', { clientId: contract.clientId, contractId: contract.id, waybillIds: [bill.id] }, 201)
assert.equal(service.shippingOrders.length, 1)
const shippingId = service.shippingOrders[0].id
const ship = await call('/api/shipping-orders/' + shippingId)
assert.equal(ship.containers.length, 1)
assert.equal(ship.containers[0].hazardClassId ?? null, null, 'danger sign is not a container danger class')
assert.equal(ship.containers[0].ownerClientId ?? null, null)
await call('/api/shipping-orders/'+shippingId+'/containers', { containers:[{containerId:c40.id,ownerClientId:clients[0].id,sealNumbers:'0001, 0002',sealTypeId:fixture}] },200,'PATCH')
assert.equal(ship.containers[0].cargoItems.length, 2)
assert.deepEqual(ship.containers[0].cargoItems.map(c => c.weight).sort((a,b)=>a-b), [600,900])
const receiving = await call('/api/receiving-orders/' + service.receivingOrder.id)
assert.equal(receiving.waybills[0].products.length, 2)
assert.equal(receiving.waybills[0].railwayCarriages[0].containers.length, 1)
const returns = await Promise.all([1,2].map(() => call('/api/shipping-orders/' + shippingId + '/returns', { containerIds: [c40.id] })))
assert.equal(returns[0].id, returns[1].id)
const back = await call('/api/receiving-orders/' + returns[0].id)
assert.equal(back.containers[0].empty, true)
assert.equal(back.containers[0].ownerClientId, clients[0].id)
assert.equal(back.containers[0].sealNumbers, '0001, 0002')
async function complete(resource, id) {
  await call(`/api/${resource}/${id}/status`, { expectedStatus:'DRAFT', status:'CONFIRMED' }, 200, 'PATCH')
  await call(`/api/${resource}/${id}/status`, { expectedStatus:'CONFIRMED', status:'COMPLETED' }, 200, 'PATCH')
}
await call(`/api/receiving-orders/${back.id}/status`, { expectedStatus:'DRAFT',status:'CONFIRMED' },200,'PATCH')
await call(`/api/receiving-orders/${back.id}/status`, { expectedStatus:'CONFIRMED',status:'COMPLETED' },409,'PATCH')
await complete('receiving-orders', receiving.id)
await complete('shipping-orders', shippingId)
await call(`/api/receiving-orders/${back.id}/status`, { expectedStatus:'CONFIRMED',status:'COMPLETED' },200,'PATCH')
let charges = await call('/api/billing-charges?comprehensiveServiceOrderId='+service.order.id)
assert.equal(charges.total, 2, 'billing remains per container, not per cargo')
const period = new Date().toLocaleDateString('sv-SE',{ timeZone:'Europe/Moscow' }).slice(0,7)
const invoice = await call('/api/payment-invoices', { clientId: contract.clientId,contractId:contract.id,period,chargeIds:charges.items.map(c=>c.id),requestKey:crypto.randomUUID() },201)
await call('/api/payment-invoices/'+invoice.invoice.id)
await call('/api/payment-invoices/'+invoice.invoice.id, {},204,'DELETE')
const emptyPayload=request([c20[0]])
emptyPayload.railwayCarriages[0].containers[0].netWeight='0'
emptyPayload.products[0].weight='0'
emptyPayload.products[0]={etsngCodeId:cargos[0].id,weight:'0',signDanger:'Произвольный признак'}
const emptyBill=await call('/api/waybills',emptyPayload,201)
const emptyGroup=await call('/api/waybills/grouped/page',{filter:{payer:emptyPayload.payer}})
assert.equal(emptyGroup.content.flatMap(g=>g.waybills).find(w=>w.id===emptyBill.id).products[0].signDanger,'Произвольный признак')
const bill20=await call('/api/waybills',request(c20.slice(0,2)),201)
service=await call('/api/comprehensive-service-orders',{clientId:contract.clientId,contractId:contract.id,waybillIds:[bill20.id]},201)
assert.equal(service.shippingOrders.length,0)
service=await call('/api/comprehensive-service-orders/'+service.order.id+'/shipping-orders',{containerIds:c20.slice(0,2).map(c=>c.id)},201)
assert.equal(service.shippingOrders.length,1)
assert.equal((await call('/api/shipping-orders/'+service.shippingOrders[0].id)).containers.length,2)
const ship20 = await call('/api/shipping-orders/'+service.shippingOrders[0].id)
const route = await call('/api/routes', { routeType:'SHIPPING', transportType:'VEHICLE', terminalAreaId:ship20.terminalArea.id,
  departureAt:'2026-10-31T12:00:00+03:00', carrier:'ALIGN CARRIER', driverName:'ALIGN DRIVER', vehicleNumber:'A001AA', orderIds:[ship20.id] },201)
assert.equal(route.route.carrier, 'ALIGN CARRIER')
assert.equal(sql('select count(*) from route where client_related_entity_id is not null and client_driver_id is not null and client_vehicle_id is not null'),'1')
const manual = await call('/api/shipping-orders', { clientId:contract.clientId,contractId:contract.id,terminalAreaId:ship20.terminalArea.id,
  transportType:'VEHICLE',containers:[{containerId:c40.id,empty:true}],departureAt:'2026-10-31T14:30',consignee:'ALIGN CONSIGNEE'},201)
assert.equal((await call('/api/shipping-orders/'+manual.id)).consignee,'ALIGN CONSIGNEE')
for(const endpoint of ['receiving-orders','shipping-orders','comprehensive-service-orders','routes','billing-charges','payment-invoices','references/railway-carriages/page']) await call('/api/'+endpoint)
console.log('PASS: schema bootstrap, products cardinality, explicit net snapshot, normalized ZPU, no duplicated containers, all cargo items transferred, 40/20-foot shipping, parallel returns, status prerequisites, billing and invoices')
