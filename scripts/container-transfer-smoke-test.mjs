import assert from 'node:assert/strict'
assert.ok(process.env.BASE_URL, 'Use an isolated test stack')
const base=process.env.BASE_URL
async function call(path,body,status=200,method='POST') {
  const r=await fetch(base+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data
}
const [clients,contracts,containers,cars,seals,hazards]=await Promise.all(['clients','contracts','containers','railway-carriages','seal-types','hazard-classes'].map(x=>call('/api/references/'+x)))
const contract=contracts.find(c=>clients.some(x=>x.id===c.clientId))
assert.ok(seals.length && hazards.length)
for(const type of ['STANDARD_40','STANDARD_20']) {
  const c=containers.find(x=>x.type===type);assert.ok(c,'Test seed must have '+type)
  const attributes={ownerClientId:clients[0].id,sealNumbers:'000123, 000456',sealTypeId:seals[0].id}
  const bill=await call('/api/waybills',{departureStation:11111,destinationStation:999999,payer:'TRANSFER-'+type+'-'+Date.now(),railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:c.id,grossWeight:String(c.tareWeight),...attributes}]}]},201)
  let service=await call('/api/service-orders',{clientId:contract.clientId,contractId:contract.id,waybillIds:[bill.id]},201)
  if(type==='STANDARD_20') {
    assert.equal(service.shippingOrders.length,0)
    service=await call('/api/service-orders/'+service.order.id+'/shipping-orders',{containerIds:[c.id]},201)
  }
  assert.equal(service.shippingOrders.length,1)
  const shipId=service.shippingOrders[0].id
  const ship=await call('/api/shipping-orders/'+shipId)
  assert.equal(ship.containers.length,1)
  for(const [key,value]of Object.entries(attributes))assert.equal(ship.containers[0][key],value)
  const initial=await call('/api/receiving-orders/'+service.receivingOrder.id)
  assert.equal(initial.containers.length,0)
  assert.equal(initial.waybills[0].railwayCarriages[0].containers[0].sealNumbers,attributes.sealNumbers)
  const updated={...attributes,sealNumbers:'000789',hazardClassId:hazards[0].id}
  await call('/api/shipping-orders/'+shipId+'/containers',{containers:[{containerId:c.id,...updated}]},200,'PATCH')
  const returned=await call('/api/shipping-orders/'+shipId+'/returns',{containerIds:[c.id]})
  const detail=await call('/api/receiving-orders/'+returned.id)
  assert.equal(detail.containers.length,1)
  assert.equal(detail.waybills.length,0)
  assert.equal(detail.containers[0].empty,true)
  assert.equal(detail.containers[0].cargo??null,null)
  for(const [key,value]of Object.entries(updated))assert.equal(detail.containers[0][key],value)
  await call('/api/shipping-orders/'+shipId+'/containers',{containers:[{containerId:c.id,...attributes,sealNumbers:'999999'}]},200,'PATCH')
  const repeated=await call('/api/shipping-orders/'+shipId+'/returns',{containerIds:[c.id]})
  assert.equal(repeated.id,returned.id)
  assert.equal((await call('/api/receiving-orders/'+returned.id)).containers[0].sealNumbers,'000789')
  assert.equal((await call('/api/receiving-orders/'+service.receivingOrder.id)).waybills[0].railwayCarriages[0].containers[0].sealNumbers,'000123, 000456')
}
console.log('PASS: 40-foot automatic and 20-foot selected shipping, attributes copied from waybill, return attributes copied from shipping, independent snapshots, empty return, idempotency, source tables')
