// Mutates only the prepared billing_service_metadata_check copy, backend port 8096.
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const db='billing_service_metadata_check',base='http://127.0.0.1:8096/api',service='2480ed6b-ea1d-49ac-83c4-9108b03a1506';
function sql(s){return execFileSync(docker,['exec','billing-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim()}
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
const path='/comprehensive-service-orders/'+service;
async function current(){const r=await api(path);assert.equal(r.status,200);return r.data}
function changes(data,date,party){return [...data.shippingOrders.map(o=>({id:o.id,kind:'SHIPPING',originalPlannedAt:o.plannedAt||null,originalPartyName:o.consignee||null,plannedAt:date,partyName:party})),...data.returnOrders.map(o=>({id:o.id,kind:'RETURN_RECEIVING',originalPlannedAt:o.plannedAt||null,originalPartyName:o.consignor||null,plannedAt:date,partyName:party}))]}
async function patch(orders){return api(path+'/transport-metadata','PATCH',{orders})}
(async()=>{
 assert.equal(sql('select current_database()'),db);
 const original=await current(),shipping=original.shippingOrders[0].id,returnId=original.returnOrders[0].id;
 assert.equal(original.shippingOrders[0].status,'DRAFT');assert.equal(original.returnOrders[0].status,'DRAFT');
 const first=changes(original,'2026-11-05T09:30:00','  ООО "Тест реквизитов"  ');
 let r=await patch(first);assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.shippingOrders[0].consignee,'ООО "Тест реквизитов"');assert.equal(r.data.returnOrders[0].consignor,'ООО "Тест реквизитов"');
 const sh=(await api('/shipping-orders/'+shipping)).data,re=(await api('/receiving-orders/'+returnId)).data;
 assert.equal(sh.departureAt,'2026-11-05T09:30:00');assert.equal(re.arrivalAt,'2026-11-05T09:30:00');assert.equal(sh.consignee,re.consignor);
 console.log('PASS: both tabs saved together, values visible in underlying order cards');
 let before=await current(),items=changes(before,'2026-11-06T11:00:00','Другой получатель');
 items[1].originalPartyName='outdated';r=await patch(items);assert.equal(r.status,409);assert.equal(r.data.code,'ORDER_METADATA_CHANGED');assert.deepEqual(await current(),before);
 console.log('PASS: stale value rejects the entire batch, no partial updates');
 for(const invalid of [{id:'dab80b9b-e401-402d-84d2-79eae4da62e2',kind:'RETURN_RECEIVING'},{id:original.receivingOrder.id,kind:'RETURN_RECEIVING'}]){
   r=await patch([changes(before,null,null)[0],{...changes(before,null,null)[1],...invalid}]);assert.equal(r.status,409);assert.equal(r.data.code,'SERVICE_ORDER_NOT_AVAILABLE');assert.deepEqual(await current(),before);
 }
 r=await patch([items[0],items[0]]);assert.equal(r.status,400);assert.deepEqual(await current(),before);
 r=await patch([{...items[0],partyName:'А'.repeat(256)}]);assert.equal(r.status,400);assert.deepEqual(await current(),before);
 console.log('PASS: foreign/initial orders, duplicate rows and oversized party names rejected');
 sql(`update receiving_order set order_status='CONFIRMED' where id='${returnId}'`);
 const confirmed=await current();r=await patch(changes(confirmed,'2026-11-08T10:00:00','Не сохранить'));assert.equal(r.status,409);assert.equal(r.data.code,'ORDER_NOT_DRAFT');assert.deepEqual(await current(),confirmed);
 sql(`update receiving_order set order_status='DRAFT' where id='${returnId}'`);
 console.log('PASS: confirmation after form opening blocks all changes');
 r=await patch(changes(await current(),null,null));assert.equal(r.status,200);assert.equal(r.data.shippingOrders[0].plannedAt,undefined);assert.equal(r.data.returnOrders[0].consignor,undefined);
 console.log('PASS: draft metadata can remain blank');
 const restore=changes(await current(),null,null).map(item=>{const old=item.kind==='SHIPPING'?original.shippingOrders.find(o=>o.id===item.id):original.returnOrders.find(o=>o.id===item.id);return {...item,plannedAt:old.plannedAt||null,partyName:old.consignee||old.consignor||null}});
 assert.equal((await patch(restore)).status,200);assert.deepEqual(await current(),original);
 console.log('PASS: test copy restored to original metadata');
})().catch(e=>{console.error(e);process.exit(1)});
