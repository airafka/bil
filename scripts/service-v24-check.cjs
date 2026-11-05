const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const db='billing_next_v24_check',base='http://localhost:8184/api';
function sql(q){return execFileSync(docker,['exec','billing-next-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim()}
async function api(p,method='GET',body,status=200){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,`${p}: ${text}`);return text?JSON.parse(text):null}
const scalar=(q)=>JSON.parse(sql('select row_to_json(x) from ('+q+')x'));
(async()=>{
 const opts=await api('/comprehensive-service-orders/available-services');assert.equal(opts.length,1);const service=opts[0].id;
 const tariff=scalar(`select t.client_id,t.contract_id,t.id,round(c.price_with_vat*t.coefficient,2) as price from complex_service_tariff t join complex_service_catalog c on c.id=t.complex_service_id where c.id='${service}' and t.active limit 1`);
 sql(`update complex_service_tariff set active=false where complex_service_id<>'${service}'`);
 assert.ok((await api('/references/tariff-clients')).some(c=>c.id===tariff.client_id));assert.ok((await api('/references/contracts?activeTariffsOnly=true')).some(c=>c.id===tariff.contract_id));
 const w=await api('/waybills/generate','POST',{standard20:2,standard40:1},201);
 const payload={clientId:tariff.client_id,contractId:tariff.contract_id,complexServiceId:service,defaultContainerOwnerId:tariff.client_id,waybillIds:[w.id]};
 await api('/comprehensive-service-orders','POST',{...payload,complexServiceId:'626df5f3-e629-4eb0-9369-ea724120ac7c'},400);
 await api('/comprehensive-service-orders','POST',{...payload,complexServiceId:null},400);
 let s=await api('/comprehensive-service-orders','POST',payload,201),id=s.order.id;
 assert.equal(s.shippingOrders.length,1);assert.equal(s.returnOrders.length,1);assert.equal(s.selectableContainers.length,2);assert.ok(!s.progress.returnServiceName);
 assert.equal(sql(`select count(*) from comprehensive_service_order_tariff where comprehensive_service_order_id='${id}'`),'1');
 const ids=s.selectableContainers.map(c=>c.containerId);
 s=await api('/comprehensive-service-orders/'+id+'/shipping-orders','POST',{containerIds:ids},201);
 assert.equal(s.shippingOrders.length,2);assert.equal(s.returnOrders.length,2);assert.equal(s.selectableContainers.length,0);
 await api('/comprehensive-service-orders/'+id+'/shipping-orders','POST',{containerIds:ids},409);
 sql(`update complex_service_catalog set name='Переименованная услуга проверки' where id='${service}';update complex_service_tariff set coefficient=coefficient+1 where id='${tariff.id}'`);
 assert.equal((await api('/comprehensive-service-orders/'+id)).progress.initialServiceName,'Переименованная услуга проверки');
 const party=(await api('/references/clients'))[0].name;
 const changes=[{id:s.receivingOrder.id,kind:'INITIAL_RECEIVING'},...s.shippingOrders.map(o=>({id:o.id,kind:'SHIPPING'})),...s.returnOrders.map(o=>({id:o.id,kind:'RETURN_RECEIVING'}))].map(o=>({...o,plannedAt:'2026-11-06T10:00:00',partyName:party,originalPlannedAt:null,originalPartyName:null}));
 await api('/comprehensive-service-orders/'+id+'/transport-metadata','PATCH',{orders:changes});
 const area=sql("select id from terminal_area_catalog where code='CONTAINER'");
 const logistics={carrierId:sql('select id from client_related_entity where active and not transport_catalog_archived limit 1'),driverId:sql('select id from client_driver where active limit 1'),vehicleId:sql('select id from client_vehicle where active limit 1')};
 async function confirm(kind,transport,orders){const r=await api('/routes','POST',{routeType:kind,transportType:transport,terminalAreaId:area,departureAt:'2026-11-06T10:00:00+03:00',orderIds:orders,...(transport==='VEHICLE'?logistics:{})},201);await api('/routes/'+r.route.id+'/confirm','POST');}
 const finish=(kind,id)=>api('/'+kind+'-orders/'+id+'/events','POST',{eventCode:kind==='receiving'?'UNLOAD_FINISH':'LOAD_FINISH'});
 const charges=()=>sql(`select count(*) from service_execution where comprehensive_service_order_id='${id}'`);
 await confirm('RECEIVING','RAILWAY',[s.receivingOrder.id]);await finish('receiving',s.receivingOrder.id);assert.equal(charges(),'0');
 await confirm('SHIPPING','VEHICLE',s.shippingOrders.map(o=>o.id));for(const o of s.shippingOrders)await finish('shipping',o.id);assert.equal(charges(),'0');
 assert.notEqual((await api('/comprehensive-service-orders/'+id)).order.status,'COMPLETED');
 await confirm('RECEIVING','VEHICLE',s.returnOrders.map(o=>o.id));await finish('receiving',s.returnOrders[0].id);assert.notEqual((await api('/comprehensive-service-orders/'+id)).order.status,'COMPLETED');
 await finish('receiving',s.returnOrders[1].id);await finish('receiving',s.returnOrders[1].id);
 assert.equal((await api('/comprehensive-service-orders/'+id)).order.status,'COMPLETED');assert.equal(charges(),'3');
 assert.equal(sql(`select count(*) from service_execution e join billing_charge b on b.service_execution_id=e.id where e.comprehensive_service_order_id='${id}' and e.complex_service_id='${service}' and b.price_with_vat=${tariff.price}`),'3');
 console.log('PASS: selected service, one tariff, no B dependency, automatic 40/20 returns, duplicate guard, rename independence, snapshot pricing, real route/stock lifecycle, billing only on return, final completion, idempotency');
 require('fs').writeFileSync('service-v24-result.json',JSON.stringify({id,initial:s.receivingOrder.id,tariff},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
