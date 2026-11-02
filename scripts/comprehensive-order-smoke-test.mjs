import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
assert.equal(process.env.BASE_URL,'http://127.0.0.1:8085','Use the isolated comprehensive test database')
const base=process.env.BASE_URL
const sql=q=>execFileSync('docker',['exec','billing-comprehensive-db','psql','-U','billing','-d','billing_comprehensive_test','-v','ON_ERROR_STOP=1','-At','-c',q],{encoding:'utf8'}).trim()
async function api(path,body,status=200,method='POST') {
 const r=await fetch(base+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const value=r.status===204?null:await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(value));return value
}
assert.equal(sql("select to_regclass('service_order') is null"),'t')
assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and column_name in ('service_order_id','service_order_code')"),'0')
assert.equal(sql("select count(*) from pg_constraint where confrelid='comprehensive_service_order'::regclass"),'4')
assert.equal((await fetch(base+'/api/service-orders')).status,404)
const [contracts,containers,cars,cargo]=await Promise.all(['contracts','containers','railway-carriages','etsng-codes'].map(k=>api('/api/references/'+k)))
const contract=contracts[0],payer='COMPREHENSIVE-'+crypto.randomUUID()
// Only the isolated database receives fixture tariffs for the complete billing flow.
sql(`insert into complex_service_tariff(id,complex_service_id,client_id,contract_id,coefficient)
 select gen_random_uuid(),s.id,c.client_id,c.id,1 from complex_service_catalog s cross join contract c on conflict do nothing`)
const c40=containers.find(c=>c.type==='STANDARD_40'),c20=containers.filter(c=>c.type==='STANDARD_20').slice(0,2)
assert.equal(c20.length,2)
const bill=await api('/api/waybills',{departureStation:1001,destinationStation:2001,payer,
 products:[{etsngCodeId:cargo[0].id,weight:'4500'}],railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[c40,...c20].map(c=>({containerId:c.id,grossWeight:'6000',netWeight:'1500'}))}]},201)
let service=await api('/api/comprehensive-service-orders',{clientId:contract.clientId,contractId:contract.id,waybillIds:[bill.id]},201)
const id=service.order.id
assert.equal(service.receivingOrder.comprehensiveServiceOrderId,id)
assert.ok(!('serviceOrderId' in service.receivingOrder))
assert.equal(service.shippingOrders.length,1)
const initialShip=service.shippingOrders[0].id
assert.equal((await api('/api/shipping-orders/'+initialShip)).comprehensiveServiceOrderId,id)
service=await api('/api/comprehensive-service-orders/'+id+'/shipping-orders',{containerIds:c20.map(c=>c.id)},201)
assert.equal(service.shippingOrders.length,2)
const listed=await api('/api/comprehensive-service-orders?query='+service.order.code)
assert.ok(listed.items.some(s=>s.id===id))
const ids=service.shippingOrders.map(s=>s.id)
const returns=await api('/api/comprehensive-service-orders/'+id+'/returns',{shippingOrderIds:ids})
assert.equal(returns.length,2)
for(const back of returns)assert.equal((await api('/api/receiving-orders/'+back.id)).comprehensiveServiceOrderId,id)
async function complete(resource,id){
 await api('/api/'+resource+'/'+id+'/status',{expectedStatus:'DRAFT',status:'CONFIRMED'},200,'PATCH')
 await api('/api/'+resource+'/'+id+'/status',{expectedStatus:'CONFIRMED',status:'COMPLETED'},200,'PATCH')
}
await complete('receiving-orders',service.receivingOrder.id)
for(const ship of ids)await complete('shipping-orders',ship)
for(const back of returns)await complete('receiving-orders',back.id)
await complete('comprehensive-service-orders',id)
const charges=await api('/api/billing-charges?comprehensiveServiceOrderId='+id)
assert.ok(charges.items.length>0)
assert.ok(charges.items.every(c=>c.comprehensiveServiceOrderId===id&&!('serviceOrderId' in c)&&c.comprehensiveServiceOrderCode===service.order.code))
const period=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'}).slice(0,7)
const available=await api(`/api/payment-invoices/available-charges?clientId=${contract.clientId}&contractId=${contract.id}&period=${period}`)
assert.ok(JSON.stringify(available).includes('comprehensiveServiceOrderId'))
const invoice=await api('/api/payment-invoices',{clientId:contract.clientId,contractId:contract.id,period,chargeIds:charges.items.map(c=>c.id),requestKey:crypto.randomUUID()},201)
const invoiceDetails=await api('/api/payment-invoices/'+invoice.invoice.id)
assert.ok(invoiceDetails.items.every(l=>l.comprehensiveServiceOrderId===id&&!('serviceOrderId' in l)))
await api('/api/payment-invoices/'+invoice.invoice.id,{},204,'DELETE')
assert.equal((await api('/api/comprehensive-service-orders/'+id)).order.status,'COMPLETED')
console.log('PASS: new table/FKs/columns; old API absent; create/list/detail; automatic/manual shipping; bulk returns; all statuses; billing filter and JSON fields; invoice candidates/create/detail/delete')
