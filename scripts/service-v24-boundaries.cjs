const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const d='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
function sql(q){return execFileSync(d,['exec','billing-next-db-1','psql','-U','billing','-d','billing_next_v24_check','-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim()}
async function api(p,b,status=201){const r=await fetch('http://localhost:8184/api'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v}
(async()=>{const service='fd5f3328-4684-41ee-b098-d7c370c5b175';const t=JSON.parse(sql(`select row_to_json(t) from (select id,client_id,contract_id from complex_service_tariff where complex_service_id='${service}' and active limit 1)t`));
 const before=Number(sql('select count(*) from comprehensive_service_order'));const w=await api('/waybills/generate',{standard20:41,standard40:0});const p={complexServiceId:service,clientId:t.client_id,contractId:t.contract_id,defaultContainerOwnerId:t.client_id,waybillIds:[w.id]};
 sql(`update complex_service_tariff set active=false where id='${t.id}'`);
 await api('/comprehensive-service-orders',p,409);assert.equal(sql(`select count(*) from comprehensive_service_order`),String(before));assert.equal(sql(`select receiving_order_id is null from waybill where id='${w.id}'`),'t');
 sql(`update complex_service_tariff set active=true where id='${t.id}'`);
 const s=await api('/comprehensive-service-orders',p);assert.equal(s.selectableContainers.length,41);assert.equal(s.shippingOrders.length,0);assert.equal(s.returnOrders.length,0);
 assert.equal(sql(`select complex_service_id from comprehensive_service_order_tariff where comprehensive_service_order_id='${s.order.id}'`),service);
 const w2=await api('/waybills/generate',{standard20:0,standard40:1});
 await api('/comprehensive-service-orders',{...p,waybillIds:[w2.id],defaultContainerOwnerId:null},400);assert.equal(sql(`select count(*) from comprehensive_service_order`),String(before+1));assert.equal(sql(`select receiving_order_id is null from waybill where id='${w2.id}'`),'t');
 console.log('PASS 41 KTK retain selected service; missing tariff and missing return owner roll back all child creation and waybill binding');
})().catch(e=>{console.error(e);process.exitCode=1});
