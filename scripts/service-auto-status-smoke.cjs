const {execFileSync}=require('child_process');const assert=require('assert/strict');const {randomUUID}=require('crypto');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
// Deliberately fixed to an isolated copy; never use the primary database/backend.
const db='billing_route_lifecycle_check', base='http://localhost:8091/api';
function sql(q){return execFileSync(docker,['exec','billing-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim()}
async function api(path,method='GET',body,expected=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();let data;try{data=JSON.parse(t)}catch{data=t}assert.equal(r.status,expected,`${method} ${path}: ${t}`);return data}
async function main(){
 const template=JSON.parse(sql("select row_to_json(x) from (select client_id,contract_id,terminal_area_catalog_id from receiving_order limit 1)x"));
 function order(kind){const id=randomUUID();const table=kind==='receiving'?'receiving_order':'shipping_order';sql(`insert into ${table}(id,client_id,contract_id,terminal_area_catalog_id,transport_type,order_status) values ('${id}','${template.client_id}','${template.contract_id}','${template.terminal_area_catalog_id}','VEHICLE','DRAFT')`);return id}
 async function route(kind,ids){return (await api('/routes','POST',{routeType:kind.toUpperCase(),transportType:'VEHICLE',terminalAreaId:template.terminal_area_catalog_id,departureAt:'2026-11-04T12:00:00+03:00',carrier:'Тест',driverName:'Тест',vehicleNumber:'TEST',orderIds:ids},201)).route.id}
 async function metadata(kind,id,date,consignor){return api(`/${kind}-orders/${id}/containers`,'PATCH',{containers:[],metadata:{plannedAt:date,consignor,consignee:consignor}})}
 async function finish(kind,id,status=200){return api(`/${kind}-orders/${id}/events`,'POST',{eventCode:kind==='receiving'?'UNLOAD_FINISH':'LOAD_FINISH'},status)}
 const a=order('receiving'),b=order('receiving');
 assert.ok(!(await api('/receiving-orders/'+a)).routeId);
 await api('/receiving-orders/'+a+'/status','PATCH',{expectedStatus:'DRAFT',status:'CONFIRMED'},409);
 await finish('receiving',a,409);
 const r=await route('receiving',[a,b]);
 const missing=await api('/routes/'+r+'/confirm','POST',undefined,400);assert.match(JSON.stringify(missing),/Грузоотправитель/);
 await metadata('receiving',a,'2026-11-04T12:00','Проверка');
 await metadata('receiving',b,'2026-11-04T12:00','  ');
 await api('/routes/'+r+'/confirm','POST',undefined,400);
 assert.equal((await api('/receiving-orders/'+a)).status,'DRAFT');assert.equal((await api('/routes/'+r)).route.status,'DRAFT');
 await metadata('receiving',b,'2026-11-04T12:00','Проверка');
 const confirmed=await api('/routes/'+r+'/confirm','POST');assert.equal(confirmed.route.status,'CONFIRMED');assert.ok(confirmed.orders.every(o=>o.status==='CONFIRMED'));
 await api('/routes/'+r+'/confirm','POST',undefined,409);
 await api('/receiving-orders/'+a+'/containers','PATCH',{containers:[],metadata:{plannedAt:null,consignor:null}},409);
 await finish('receiving',a);assert.equal((await api('/routes/'+r)).route.status,'CONFIRMED');await finish('receiving',a);
 await finish('receiving',b);assert.equal((await api('/routes/'+r)).route.status,'COMPLETED');
 const sh1=order('shipping'),sh2=order('shipping');const sr=await route('shipping',[sh1,sh2]);
 const shippingMissing=await api('/routes/'+sr+'/confirm','POST',undefined,400);assert.match(JSON.stringify(shippingMissing),/Дата и время вывоза/);
 await metadata('shipping',sh1,'2026-11-04T13:00',null);await metadata('shipping',sh2,'2026-11-04T13:00',null);
 const noConsignee=await api('/routes/'+sr+'/confirm','POST',undefined,400);assert.match(JSON.stringify(noConsignee),/Грузополучатель/);
 await metadata('shipping',sh1,'2026-11-04T13:00','Получатель');await metadata('shipping',sh2,'2026-11-04T13:00','   ');
 await api('/routes/'+sr+'/confirm','POST',undefined,400);assert.ok((await api('/routes/'+sr)).orders.every(o=>o.status==='DRAFT'));
 await metadata('shipping',sh2,'2026-11-04T13:00','Получатель');assert.equal((await api('/shipping-orders/'+sh2)).consignee,'Получатель');
 await api('/routes/'+sr+'/confirm','POST');await Promise.all([finish('shipping',sh1),finish('shipping',sh2)]);assert.equal((await api('/routes/'+sr)).route.status,'COMPLETED');
 const empty=await route('receiving',[]);await api('/routes/'+empty+'/confirm','POST',undefined,409);
 const container=randomUUID();sql(`insert into container(id,code,container_type) values ('${container}','T-${container.slice(0,8)}',(select container_type from container limit 1))`);
 const payload={clientId:template.client_id,contractId:template.contract_id,terminalAreaId:template.terminal_area_catalog_id,transportType:'VEHICLE',defaultContainerOwnerId:template.client_id,containers:[{containerId:container,empty:true,ownerClientId:template.client_id}],waybillIds:[],railwayCarriages:[]};
 const physical1=await api('/receiving-orders','POST',payload,201),physical2=await api('/receiving-orders','POST',payload,201);
 for(const o of [physical1,physical2]) await metadata('receiving',o.id,'2026-11-04T12:00','Тест');
 const conflictRoute=await route('receiving',[physical1.id,physical2.id]);
 await api('/routes/'+conflictRoute+'/confirm','POST',undefined,409);
 assert.ok((await api('/routes/'+conflictRoute)).orders.every(o=>o.status==='DRAFT'));
 assert.equal(sql(`select count(*) from container_owner where container_id='${container}'`),'0');
 assert.equal(sql(`select count(*) from container_owner_history where container_id='${container}'`),'0');
 const service=randomUUID();sql(`insert into comprehensive_service_order(id,client_id,contract_id) values ('${service}','${template.client_id}','${template.contract_id}')`);
 const initial=order('receiving');sql(`update receiving_order set comprehensive_service_order_id='${service}',order_status='COMPLETED',transport_type='RAILWAY' where id='${initial}'`);
 const source1=order('shipping'),source2=order('shipping');sql(`update shipping_order set order_status='COMPLETED',source_receiving_order_id='${initial}',comprehensive_service_order_id='${service}' where id in ('${source1}','${source2}')`);
 const ret1=order('receiving'),ret2=order('receiving');
 for(const [ret,source] of [[ret1,source1],[ret2,source2]])sql(`update receiving_order set order_status='CONFIRMED',service_role='RETURN_RECEIVING',source_shipping_order_id='${source}',comprehensive_service_order_id='${service}' where id='${ret}'`);
 await api('/comprehensive-service-orders/'+service+'/status','PATCH',{expectedStatus:'DRAFT',status:'CONFIRMED'},409);
 await finish('receiving',ret1);assert.equal(sql(`select status from comprehensive_service_order where id='${service}'`),'DRAFT');
 await finish('receiving',ret2);assert.equal(sql(`select status from comprehensive_service_order where id='${service}'`),'COMPLETED');
 console.log('PASS: automatic service completion after last child; real create without route/date/consignor; stock reservation rollback; optional route, direct-confirm guard, required fields, atomic confirmation, metadata lock, partial/final completion, concurrent completion, repeat completion, empty route');
}
main().catch(e=>{console.error(e);process.exitCode=1});
