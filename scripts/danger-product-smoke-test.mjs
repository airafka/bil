import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
assert.equal(process.env.BASE_URL, 'http://127.0.0.1:8084', 'Run only against the isolated test database')
const base=process.env.BASE_URL
const sql=q=>execFileSync('docker',['exec','billing-danger-db','psql','-U','billing','-d','billing_danger_test','-v','ON_ERROR_STOP=1','-At','-c',q],{encoding:'utf8'}).trim()
async function api(path,body,status=200,method='POST') {
 const response=await fetch(base+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const value=await response.json();assert.equal(response.status,status,path+': '+JSON.stringify(value));return value
}
const [products,classes,contracts,containers,cars,cargo,areas]=await Promise.all(['danger-products','hazard-classes','contracts','containers','railway-carriages','etsng-codes','terminal-areas'].map(k=>api('/api/references/'+k)))
const safe=products.find(p=>p.identifier===-1),none=classes.find(c=>c.name==='Отсутствует')
assert.equal(safe.name,'неопасный груз');assert.equal(safe.dangerClassId,none.id);assert.equal(safe.dangerClassCode,'0')
assert.equal(sql(`select code||'|'||code_danger_class||'|'||group_name from danger_class where id='${none.id}'`),'Отсутствует|0|Отсутствует')
// Additional reference fixtures exist only in this disposable clone, never in the working database.
const dangerClass=crypto.randomUUID(),dangerProduct=crypto.randomUUID()
sql(`insert into danger_class(id,code,code_danger_class,group_name) values ('${dangerClass}','Тестовый класс','9','Тест'); insert into danger_product(id,identifier,name,danger_class_id) values ('${dangerProduct}',999999,'Тестовый опасный груз','${dangerClass}')`)
const contract=contracts[0],container=containers.find(c=>c.type==='STANDARD_40'),payer='DANGER-'+crypto.randomUUID()
const product={etsngCodeId:cargo[0].id,weight:'1500',dangerProductId:dangerProduct,signDanger:'Отсутствует'}
const body={departureStation:1001,destinationStation:2001,payer,products:[product],railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:container.id,grossWeight:'6000',netWeight:'1500',owner:'Владелец строкой'}]}]}
const bill=await api('/api/waybills',body,201)
let groups=await api('/api/waybills/grouped/page',{filter:{payer}})
let row=groups.content[0].waybills.find(w=>w.id===bill.id).products[0]
assert.equal(row.dangerProductId,dangerProduct);assert.equal(row.hazardClassId,dangerClass);assert.equal(row.hazardClassName,'Тестовый класс');assert.equal(row.signDanger,'Отсутствует')
assert.equal(row.dangerProductIdentifier,999999);assert.equal(row.dangerClassCode,'9')
const railway=await api('/api/receiving-orders',{clientId:contract.clientId,contractId:contract.id,terminalAreaId:areas[0].id,transportType:'RAILWAY',waybillIds:[bill.id]},201)
const receivingRailway=await api('/api/receiving-orders/'+railway.id)
assert.equal(receivingRailway.waybills[0].products[0].hazardClassId,dangerClass)
assert.equal(receivingRailway.waybills[0].products[0].signDanger,'Отсутствует')
const vehicleBody={clientId:contract.clientId,contractId:contract.id,terminalAreaId:areas[0].id,transportType:'VEHICLE',containers:[{containerId:container.id,empty:false,cargo:{etsngCodeId:cargo[0].id,weight:'1500'},hazardClassId:dangerClass}]}
for(const kind of ['receiving','shipping']) {
 const order=await api('/api/'+kind+'-orders',vehicleBody,201)
 let details=await api('/api/'+kind+'-orders/'+order.id)
 assert.equal(details.containers[0].hazardClassId,dangerClass)
 await api('/api/'+kind+'-orders/'+order.id+'/containers',{containers:[{containerId:container.id,hazardClassId:none.id}]},200,'PATCH')
 details=await api('/api/'+kind+'-orders/'+order.id)
 assert.equal(details.containers[0].hazardClassId,none.id);assert.equal(details.containers[0].hazardClassName,'Отсутствует')
}
const createWith=async p=>api('/api/waybills',{...body,products:[p]},201)
const defaultBill=await createWith({etsngCodeId:cargo[0].id,weight:'1500',signDanger:'Тестовый класс'})
assert.equal(sql(`select danger_product_id from waybill_product where waybill_id='${defaultBill.id}'`),safe.id,'text must not classify products')
for(const value of ['', '   ', '-1', '999999']) {
 const b=await createWith({etsngCodeId:cargo[0].id,weight:'1500',danger_product:value})
 assert.equal(sql(`select danger_product_id from waybill_product where waybill_id='${b.id}'`),value==='999999'?dangerProduct:safe.id)
}
const count=sql('select count(*) from waybill')
for(const invalid of [{danger_product:'abc'},{danger_product:'2147483648'},{danger_product:'1234567'},{dangerProductId:crypto.randomUUID()},{dangerProductId:dangerProduct,danger_product:'-1'},{hazardClassId:dangerClass}]) {
 await api('/api/waybills',{...body,products:[{etsngCodeId:cargo[0].id,weight:'1500',...invalid}]},400)
}
assert.equal(sql('select count(*) from waybill'),count,'invalid classification must not create a partial waybill')
assert.equal(sql("select count(*) from pg_constraint where (conrelid='waybill_product'::regclass and confrelid='danger_product'::regclass) or (conrelid in ('receiving_order_container'::regclass,'shipping_order_container'::regclass,'danger_product'::regclass) and confrelid='danger_class'::regclass)"),'4')
console.log('PASS: exact seeds; Waybill → DangerProduct → DangerClass; independent text; UUID/identifier/default inputs; receiving and shipping direct class selection; railway detailed read; invalid input rollback; four FK constraints')
