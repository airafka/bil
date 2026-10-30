import assert from 'node:assert/strict'
assert.ok(process.env.BASE_URL, 'Use an isolated test stack with V44 TEST HAZARD fixture')
const base=process.env.BASE_URL
async function call(path,body,status=200,method='POST') {
 const r=await fetch(base+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const data=await r.json(); assert.equal(r.status,status,JSON.stringify(data));return data
}
const [clients,contracts,containers,cars,cargos]=await Promise.all(['clients','contracts','containers','railway-carriages','etsng-codes'].map(x=>call('/api/references/'+x)))
const contract=contracts.find(c=>clients.some(x=>x.id===c.clientId)); const hazard='44000000-0000-0000-0000-000000000001'
for(const type of ['STANDARD_40','STANDARD_20']) {
 const c=containers.find(c=>c.type===type);assert.ok(c)
 const attrs='/api/references/containers/'+c.id+'/attributes'
 const updated=await call(attrs,{tareWeight:c.tareWeight,loadCapacity:'25000.125'},200,'PATCH');assert.equal(updated.loadCapacity,25000.125)
 await call(attrs,{tareWeight:c.tareWeight,loadCapacity:'-1'},400,'PATCH')
 await call(attrs,{tareWeight:c.tareWeight,loadCapacity:'12.1234'},400,'PATCH')
 assert.equal((await call('/api/references/containers?q='+c.name))[0].loadCapacity,25000.125)
 const gross=c.tareWeight+1000
 const payload={departureStation:11111,destinationStation:999999,payer:'V44-'+type,etsngCodeId:cargos[0].id,hazardClassId:hazard,railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:c.id,grossWeight:gross}]}]}
 await call('/api/waybills',{...payload,hazardClassId:'44000000-0000-0000-0000-000000000099'},404)
 const bill=await call('/api/waybills',payload,201)
 const grouped=await call('/api/waybills/grouped/page',{filter:{payer:payload.payer},pageInfo:{page:0,size:20}})
 const group=grouped.content.find(g=>g.waybills.some(w=>w.id===bill.id));assert.ok(group)
 const gb=group.waybills.find(w=>w.id===bill.id)
 assert.equal(gb.products[0].hazardClassId,hazard);assert.equal(gb.products[0].grossWeight,gross)
 assert.equal(gb.containers[0].type,type);assert.equal(gb.containers[0].loadCapacity,25000.125)
 let service=await call('/api/service-orders',{clientId:contract.clientId,contractId:contract.id,waybillIds:[bill.id]},201)
 if(type==='STANDARD_20') service=await call('/api/service-orders/'+service.order.id+'/shipping-orders',{containerIds:[c.id]},201)
 const receiving=await call('/api/receiving-orders/'+service.receivingOrder.id)
 const product=receiving.waybills[0].products[0];assert.equal(product.hazardClassId,hazard);assert.equal(product.hazardClassName,'V44 TEST HAZARD');assert.equal(product.grossWeight,gross)
 assert.equal(receiving.waybills[0].railwayCarriages[0].containers[0].loadCapacity,25000.125)
 const ship=await call('/api/shipping-orders/'+service.shippingOrders[0].id);assert.equal(ship.containers[0].hazardClassId,hazard)
 const returned=await call('/api/shipping-orders/'+ship.id+'/returns',{containerIds:[c.id]})
 const back=await call('/api/receiving-orders/'+returned.id);assert.equal(back.containers[0].hazardClassId,hazard)
 assert.equal(back.containers[0].empty,true)
 await call(attrs,{tareWeight:c.tareWeight,loadCapacity:null},200,'PATCH')
 assert.equal((await call('/api/references/containers?q='+c.name))[0].loadCapacity ?? null,null)
}
console.log('PASS: capacity save/clear/validation; waybill hazard validation/storage; grouped and receiving APIs; gross weights; hazard transfer to 40ft automatic/20ft selected shipping and return receiving')
