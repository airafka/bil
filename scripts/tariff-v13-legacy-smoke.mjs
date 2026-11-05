import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('tariff-v12-ui-fixtures.json','utf8'));
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const sql=q=>execFileSync(docker,['exec','billing-db-1','psql','-U','billing','-d','billing_tariff_v13_all_check','-v','ON_ERROR_STOP=1','-Atc',q],{encoding:'utf8'}).trim();
async function api(p,b,status=200,method='POST'){const r=await fetch('http://127.0.0.1:8089'+p,b===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
await api('/api/complex-services/'+f.serviceId+'/tariffs/'+f.activeTariff,{clientId:f.client,contractId:f.contract,coefficient:'9',active:true},200,'PUT');
const c=crypto.randomUUID();sql(`insert into container(id,code,weight,container_type) values('${c}','LEG-${c.slice(0,8)}',3000,'STANDARD_40')`);
const [cars,cargo]=await Promise.all(['railway-carriages','etsng-codes'].map(k=>api('/api/references/'+k)));
const bill=await api('/api/waybills',{number:'LEG-'+c.slice(0,8),departureStation:1001,destinationStation:2001,payer:'V13',products:[{etsngCodeId:cargo[0].id,weight:1000}],railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:c,grossWeight:4000,netWeight:1000}]}]},201);
const o=await api('/api/comprehensive-service-orders',{clientId:f.client,contractId:f.contract,defaultContainerOwnerId:f.noTariffs,waybillIds:[bill.id]},201);
// Simulate a pre-V13 order only on this test's own new fixture, not on copied historical rows.
sql(`delete from comprehensive_service_order_tariff where comprehensive_service_order_id='${o.order.id}'; update comprehensive_service_order set tariffs_fixed_at=null where id='${o.order.id}'`);
await api('/api/complex-services/'+f.serviceId+'/tariffs/'+f.activeTariff,{clientId:f.client,contractId:f.contract,coefficient:'5',active:true},200,'PUT');
for(const [kind,oid,eventCode] of [['receiving-orders',o.receivingOrder.id,'UNLOAD_FINISH'],['shipping-orders',o.shippingOrders[0].id,'LOAD_FINISH']]){
 await api('/api/'+kind+'/'+oid+'/status',{expectedStatus:'DRAFT',status:'CONFIRMED'},200,'PATCH');
 await api('/api/'+kind+'/'+oid+'/events',{eventCode});
}
assert.equal(sql(`select tariff_id::text||','||coefficient from service_execution where comprehensive_service_order_id='${o.order.id}'`),f.activeTariff+',5.0000');
assert.equal(sql(`select count(*) from comprehensive_service_order_tariff where comprehensive_service_order_id='${o.order.id}'`),'0');
console.log('PASS: legacy orders without creation snapshot use the active tariff at calculation; no invented historical snapshot');
