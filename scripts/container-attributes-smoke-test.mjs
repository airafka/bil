import assert from 'node:assert/strict'
const base = process.env.BASE_URL
assert.ok(base, 'Set BASE_URL to an isolated test stack')
const sealTypeId = process.env.TEST_SEAL_TYPE_ID
const hazardClassId = process.env.TEST_HAZARD_CLASS_ID
const modelId = process.env.TEST_MODEL_ID
assert.ok(sealTypeId && hazardClassId && modelId, 'Seed isolated test catalogs and set TEST_*_ID')
async function call(path, body, expected = 200, method = 'POST') {
  const response = await fetch(base + path, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  assert.equal(response.status, expected, path + ': ' + JSON.stringify(result))
  return result
}
const [clients, contracts, containers, areas, cars, types] = await Promise.all([
  'clients', 'contracts', 'containers', 'terminal-areas', 'railway-carriages', 'railway-carriage-kinds',
].map(p => call('/api/references/' + p)))
const contract = contracts.find(c => clients.some(client => client.id === c.clientId))
const c = containers.find(c => c.type === 'STANDARD_20')
const c2 = containers.find(item => item.id !== c.id && item.type === 'STANDARD_20')
assert.ok(contract && c && c2 && cars.length)
const missing = '00000000-0000-0000-0000-000000000999'
const attrs = { ownerClientId: clients[0].id, sealNumbers: '0001, 0002', sealTypeId, hazardClassId }
const common = { clientId: contract.clientId, contractId: contract.id, terminalAreaId: areas[0].id, transportType: 'VEHICLE', containers: [{ containerId: c.id, empty: true, cargo: null, ...attrs }] }
const equal = (row, expected = attrs) => {
  for (const [key,value] of Object.entries(expected)) assert.equal(row[key],value,key)
  assert.equal(row.ownerClientName, clients[0].name)
  assert.equal(row.sealTypeName, 'TEST-SEAL')
}
const viewIds = {}
for (const kind of ['receiving','shipping']) {
  const path='/api/'+kind+'-orders'
  const created=await call(path,common,201)
  viewIds[kind]=created.id
  equal((await call(path+'/'+created.id)).containers[0])
  const legacy=await call(path,{...common,containers:[{containerId:c.id,empty:true,cargo:null}]},201)
  assert.equal((await call(path+'/'+legacy.id)).containers[0].ownerClientId ?? null,null)
  for (const key of ['ownerClientId','sealTypeId','hazardClassId']) {
    await call(path,{...common,containers:[{...common.containers[0],[key]:missing}]},404)
  }
  await call(path,{...common,containers:[{...common.containers[0],sealNumbers:'1'.repeat(1001)}]},400)
  const patch={containers:[{containerId:c.id,...attrs,sealNumbers:'  0009  '}]}
  equal((await call(path+'/'+created.id+'/containers',patch,200,'PATCH')).containers[0],{...attrs,sealNumbers:'0009'})
  await call(path+'/'+created.id+'/containers',{containers:[{containerId:c.id,...attrs,sealNumbers:'ROLLBACK'},{containerId:c2.id,...attrs}]},404,'PATCH')
  assert.equal((await call(path+'/'+created.id)).containers[0].sealNumbers,'0009')
  await call(path+'/'+created.id+'/containers',{containers:[patch.containers[0],patch.containers[0]]},400,'PATCH')
  assert.equal((await call(path+'/'+created.id)).containers[0].sealNumbers,'0009')
  const cleared=await call(path+'/'+created.id+'/containers',{containers:[{containerId:c.id,ownerClientId:null,sealNumbers:' ',sealTypeId:null,hazardClassId:null}]},200,'PATCH')
  assert.equal(cleared.containers[0].sealNumbers ?? null,null)
  await call(path+'/'+created.id+'/containers',{containers:[{containerId:c.id,...attrs}]},200,'PATCH')
  await call(path+'/'+created.id+'/status',{status:'CONFIRMED',expectedStatus:'DRAFT'},200,'PATCH')
  await call(path+'/'+created.id+'/containers',patch,409,'PATCH')
}
const rail={...common,transportType:'RAILWAY',fillingType:'ALL',containers:[],railwayCarriages:[{railwayCarriageId:cars[0].id,containers:common.containers}]}
const shipping=await call('/api/shipping-orders',rail,201)
equal((await call('/api/shipping-orders/'+shipping.id)).railwayCarriages[0].containers[0])
equal((await call('/api/shipping-orders/'+shipping.id+'/containers',{containers:[{containerId:c.id,...attrs,sealNumbers:'0010'}]},200,'PATCH')).railwayCarriages[0].containers[0],{...attrs,sealNumbers:'0010'})
const railTop=await call('/api/shipping-orders',{...common,transportType:'RAILWAY',fillingType:'CONTAINER',railwayCarriageQuantities:[{quantity:1,typeId:types[0].id}]},201)
equal((await call('/api/shipping-orders/'+railTop.id)).containers[0])
const payer='ATTRIBUTES-'+Date.now()
const billPayload={payer,departureStation:11111,destinationStation:999999,railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:c.id,grossWeight:String(c.tareWeight),ownerClientId:attrs.ownerClientId,sealNumbers:attrs.sealNumbers,sealTypeId}]}]}
const created=await call('/api/waybills',billPayload,201)
const grouped=await call('/api/waybills/grouped/page',{filter:{payer},pageInfo:{page:0,size:100}})
const bill=grouped.content.flatMap(g=>g.waybills).find(b=>b.id===created.id)
const billAttrs={ownerClientId:attrs.ownerClientId,sealNumbers:attrs.sealNumbers,sealTypeId}
equal(bill.containers[0],billAttrs)
equal(bill.railwayCarriages[0].containers[0],billAttrs)
assert.equal(bill.products.length,0)
for(const key of ['ownerClientId','sealTypeId']) {
  await call('/api/waybills',{...billPayload,railwayCarriages:[{...billPayload.railwayCarriages[0],containers:[{...billPayload.railwayCarriages[0].containers[0],[key]:missing}]}]},404)
}
const receiving=await call('/api/receiving-orders',{...common,transportType:'RAILWAY',containers:[],waybillIds:[created.id]},201)
equal((await call('/api/receiving-orders/'+receiving.id)).waybills[0].railwayCarriages[0].containers[0],billAttrs)
assert.deepEqual(types.map(t=>t.name).sort(),['Платформа 40 - футов','Платформа 80 - футов'])
const wagonPatch={modelId,loadCapacity:'68000.125',nextDepotRepairDate:'2027-02-20',carriageTypeId:types[0].id}
const wagon=await call('/api/references/railway-carriages/'+cars[0].id,wagonPatch,200,'PATCH')
assert.equal(wagon.loadCapacity,68000.125)
assert.equal(wagon.modelName,'TEST-MODEL')
assert.equal(wagon.nextDepotRepairDate,'2027-02-20')
assert.equal(wagon.carriageTypeName,types[0].name)
const page=await call('/api/references/railway-carriages/page?size=100')
assert.ok(page.items.find(w=>w.id===cars[0].id))
for(const loadCapacity of ['-1','0','1.0001'])await call('/api/references/railway-carriages/'+cars[0].id,{...wagonPatch,loadCapacity},400,'PATCH')
await call('/api/references/railway-carriages/'+cars[0].id,{...wagonPatch,nextDepotRepairDate:'bad-date'},400,'PATCH')
await call('/api/references/railway-carriages/'+cars[0].id,{...wagonPatch,modelId:missing},404,'PATCH')
await call('/api/references/railway-carriages/'+cars[0].id,{...wagonPatch,carriageTypeId:missing},400,'PATCH')
const clear=await call('/api/references/railway-carriages/'+cars[0].id,{modelId:null,loadCapacity:null,nextDepotRepairDate:null,carriageTypeId:null},200,'PATCH')
assert.equal(clear.loadCapacity ?? null,null)
assert.equal(clear.modelId ?? null,null)
console.log('PASS: receiving/shipping vehicle and railway fields, waybill fields, shared catalogs, wagon updates, old payloads, invalid references, length, rollback, draft-only edits, clearing')
console.log(JSON.stringify(viewIds))
