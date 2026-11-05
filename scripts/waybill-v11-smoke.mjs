import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const sql=q=>execFileSync(docker,['compose','exec','-T','db','psql','-U','billing','-d','billing_waybill_v11_check','-v','ON_ERROR_STOP=1','-Atc',q],{encoding:'utf8'}).trim();
async function api(path,body,status=200){const res=await fetch('http://127.0.0.1:8088'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data;}
assert.equal(sql('select count(*) from waybill'),'2');
assert.equal(sql("select count(*) from waybill where created_at is null and shipment_type='CONTAINER' and status='IN_TRANSIT'"),'2');
assert.equal((await api('/api/waybills/available')).totalElements,0);
const [cars,cargo,contracts,areas]=await Promise.all(['railway-carriages','etsng-codes','contracts','terminal-areas'].map(k=>api('/api/references/'+k)));
const docs=[];
for(let i=0;i<22;i++){
const cid=crypto.randomUUID();sql(`insert into container(id,code,weight,container_type) values('${cid}','V11-${i}',3000,'STANDARD_40')`);
docs.push(await api('/api/waybills',{number:'V11-'+String(i).padStart(3,'0'),departureStation:1001,destinationStation:2001,payer:i===21?'V11-OTHER':'V11-PAYER',products:[{etsngCodeId:cargo[0].id,weight:1000}],railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:cid,grossWeight:4000,netWeight:1000}]}]},201));
}
const first=await api('/api/waybills/available?page=0&size=20'),second=await api('/api/waybills/available?page=1&size=20');
assert.equal(first.totalElements,22);assert.equal(first.content.length,20);assert.equal(second.content.length,2);assert.equal(first.totalPages,2);
assert.equal(new Set([...first.content,...second.content].map(r=>r.waybill.id)).size,22);
for(const row of first.content){assert.ok(row.waybill.createdAt);assert.equal(row.waybill.shipmentType,'CONTAINER');assert.equal(row.waybill.status,'IN_TRANSIT');assert.equal(row.waybill.railwayCarriages.length,1);assert.equal(row.waybill.containers.length,1);}
const base={clientId:contracts[0].clientId,contractId:contracts[0].id,defaultContainerOwnerId:contracts[0].clientId,terminalAreaId:areas.find(a=>a.code==='CONTAINER').id,transportType:'RAILWAY',waybillIds:[docs[0].id,docs[1].id]};
const receipt=await api('/api/receiving-orders',base,201);
assert.equal((await api('/api/receiving-orders/'+receipt.id)).waybills.length,2);
assert.equal((await api('/api/waybills/available')).totalElements,20);
assert.equal(sql(`select count(*) from receiving_order_container where receiving_order_id='${receipt.id}'`),'0');
await api('/api/receiving-orders',{...base,waybillIds:[docs[2].id,docs[21].id]},400);
console.log('PASS: V11 preserves old documents and unknown dates; defaults, date, pagination, availability, full composition, same-group validation, railway creation without copying containers');
