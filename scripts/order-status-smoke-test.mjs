import assert from 'node:assert/strict'
const base='http://localhost:3100/api'
async function call(path,body,status=200,method='POST') { const r=await fetch(base+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await r.json(); assert.equal(r.status,status,JSON.stringify(data)); return data }
const [clients,contracts,containers,cars,cargo]=await Promise.all(['clients','contracts','containers','railway-carriages','etsng-codes'].map(x=>call('/references/'+x)))
const contract=contracts.find(c=>c.clientId===clients[0].id)
const bill=await call('/waybills',{departureStation:1001,destinationStation:2001,payer:'STATUS-TEST',railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:containers[0].id,grossWeight:13200,etsngCodeId:cargo[0].id}]}]},201)
const service=await call('/service-orders',{clientId:clients[0].id,contractId:contract.id,waybillIds:[bill.id]},201)
for(const [resource,id] of [['service-orders',service.order.id],['receiving-orders',service.receivingOrder.id],['shipping-orders',service.shippingOrders[0].id]]) {
 const path='/'+resource+'/'+id
 const readStatus=async()=>{const d=await call(path); return d.order?.status??d.status}
 assert.equal(await readStatus(),'DRAFT')
 const change=(expectedStatus,status,http=200)=>call(path+'/status',{expectedStatus,status},http,'PATCH')
 await change('DRAFT','COMPLETED',409)
 assert.equal(await readStatus(),'DRAFT')
 const results=await Promise.all([1,2].map(()=>fetch(base+path+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedStatus:'DRAFT',status:'CONFIRMED'})})))
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
 assert.equal(await readStatus(),'CONFIRMED')
 await change('CONFIRMED','DRAFT',409)
 await change('DRAFT','CONFIRMED',409)
 await change('CONFIRMED','COMPLETED')
 assert.equal(await readStatus(),'COMPLETED')
 await change('COMPLETED','CONFIRMED',409)
 await change('COMPLETED','COMPLETED',409)
 await change('COMPLETED','UNKNOWN',400)
 await call(path+'/status',{},400,'PATCH')
 console.log('PASS: '+resource+' draft, forward transitions, persistence, invalid transitions, stale/concurrent changes')
}
const updated=await call('/service-orders/'+service.order.id)
assert.equal(updated.receivingOrder.status,'COMPLETED')
assert.equal(updated.shippingOrders[0].status,'COMPLETED')
await call('/receiving-orders/00000000-0000-0000-0000-000000000000/status',{expectedStatus:'DRAFT',status:'CONFIRMED'},404,'PATCH')
console.log('PASS: dashboard statuses and missing order; fixture '+service.order.id)
