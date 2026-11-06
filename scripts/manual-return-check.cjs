// Mutating checks are restricted to the explicitly prepared manual-return test database.
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const db=process.env.MANUAL_RETURN_TEST_DB,base='http://localhost:8191/api';
assert.match(db||'',/^billing_next_manual_return_\d{8}_\d{6}$/);
const inspected=JSON.parse(execFileSync(docker,['inspect','billing-next-manual-return-test'],{encoding:'utf8',windowsHide:true}))[0];
assert.ok(inspected.Config.Env.includes('DB_NAME='+db));
assert.ok(inspected.NetworkSettings.Ports['8080/tcp'].some(p=>p.HostPort==='8191'));
const sql=q=>execFileSync(docker,['exec','billing-next-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',windowsHide:true}).trim();
const json=q=>JSON.parse(sql(q));
async function response(p,method='GET',body){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
async function api(p,method='GET',body,status=200){const r=await response(p,method,body);assert.equal(r.status,status,p+': '+JSON.stringify(r.body));return r.body}
const section=(id,section,action,status=200)=>api(`/comprehensive-service-orders/${id}/complete-section`,'POST',{section,action},status);
const prepare=(id,section)=>api(`/comprehensive-service-orders/${id}/prepare-transport`,'POST',{section});
const details=id=>api('/comprehensive-service-orders/'+id);
const complete=async(id,part)=>{await prepare(id,part);await section(id,part,'CONFIRM_ROUTES');return section(id,part,'COMPLETE_ORDERS')};
(async()=>{
 assert.equal(sql("select version from flyway_schema_history where success order by installed_rank desc limit 1"),'27');
 const options=await api('/comprehensive-service-orders/available-services');assert.equal(options.length,2);
 const wagon=options.find(o=>o.maxWaybillContainers===39),train=options.find(o=>o.minWaybillContainers===40);
 const auto=json("select row_to_json(c) from complex_service_catalog c where order_workflow='AUTO_RETURN'");
 const tariff=json(`select row_to_json(t) from (select t.*,round(c.price_without_vat*t.coefficient,2) net,round(c.price_with_vat*t.coefficient,2) gross from complex_service_tariff t join complex_service_catalog c on c.id=t.complex_service_id where t.complex_service_id='${wagon.id}' and t.active order by t.id limit 1)t`);
 const other=json(`select row_to_json(c) from (select id,client_id from contract where client_id<>'${tariff.client_id}' order by id limit 1)c`);
 const alternate=json(`select row_to_json(c) from (select id,client_id from contract where client_id='${tariff.client_id}' and id<>'${tariff.contract_id}' order by id limit 1)c`);
 assert.ok(other&&alternate,'Test reference contracts required');
 async function createRail(service=wagon,count=4,standard20=2){
  const t=json(`select row_to_json(t) from (select client_id,contract_id from complex_service_tariff where complex_service_id='${service.id}' and active order by id limit 1)t`);
  const bill=await api('/waybills/generate','POST',{standard20,standard40:count-standard20},201);
  return api('/comprehensive-service-orders','POST',{complexServiceId:service.id,clientId:t.client_id,contractId:t.contract_id,defaultContainerOwnerId:t.client_id,waybillIds:[bill.id]},201);
 }
 let s=await createRail();const root=s.order.id;
 assert.equal(s.returnOrders.length,0);assert.equal(s.shippingOrders.length,2);assert.equal(s.selectableContainers.length,2);
 s=await api(`/comprehensive-service-orders/${root}/shipping-orders`,'POST',{containerIds:s.selectableContainers.map(c=>c.containerId)},201);
 assert.equal(s.returnOrders.length,0);assert.equal(s.shippingOrders.length,3);
 const shipments=await Promise.all(s.shippingOrders.map(o=>api('/shipping-orders/'+o.id)));
 const pair=shipments.find(o=>o.containers.length===2),single=shipments.filter(o=>o.containers.length===1);
 const payload=(shipment,ids,extra={})=>api('/shipping-orders/'+shipment.id+'/returns','POST',{containerIds:ids,useCurrentClient:true,...extra},201);
 const pairIds=pair.containers.map(c=>c.containerId);
 await api('/shipping-orders/'+pair.id+'/returns','POST',{containerIds:[],useCurrentClient:true},400);
 await api('/shipping-orders/'+pair.id+'/returns','POST',{containerIds:[pairIds[0],pairIds[0]],useCurrentClient:true},400);
 await api('/shipping-orders/'+pair.id+'/returns','POST',{containerIds:[single[0].containers[0].containerId],useCurrentClient:true},400);
 // Missing tariffs cannot leave either a return or an orphan AUTO_RETURN parent.
 sql(`update complex_service_tariff set active=false where complex_service_id='${auto.id}'`);
 const parentsBefore=sql('select count(*) from comprehensive_service_order');
 const unavailable=await api('/shipping-orders/'+pair.id+'/returns','POST',{containerIds:[pairIds[1]],useCurrentClient:false,clientId:other.client_id,contractId:other.id},409);
 assert.equal(unavailable.code,'ACTIVE_TARIFFS_REQUIRED');assert.equal(sql('select count(*) from comprehensive_service_order'),parentsBefore);
 await api('/shipping-orders/'+pair.id+'/returns','POST',{containerIds:[pairIds[1]],useCurrentClient:false,clientId:tariff.client_id,contractId:other.id},400);
 for(const c of [other,alternate])sql(`insert into complex_service_tariff(id,complex_service_id,client_id,contract_id,coefficient,active) values('${randomUUID()}','${auto.id}','${c.client_id}','${c.id}',1,true) on conflict(complex_service_id,client_id,contract_id) where active do update set active=true,coefficient=1`);
 const activeAutoIds=json(`select json_agg(id) from complex_service_tariff where complex_service_id='${auto.id}' and active`).map(id=>"'"+id+"'").join(',');
 const contractOptions=await api('/shipping-orders/return-contracts');assert.ok(contractOptions.some(c=>c.contractId===other.id));
 const own=await payload(pair,[pairIds[0]]);assert.equal(own.createdService,false);assert.equal(own.serviceOrderId,root);
 const foreign=await payload(pair,[pairIds[1]],{useCurrentClient:false,clientId:other.client_id,contractId:other.id});assert.equal(foreign.createdService,true);assert.notEqual(foreign.serviceOrderId,root);
 const sameCustomer=await payload(single[0],single[0].containers.map(c=>c.containerId),{useCurrentClient:false,clientId:alternate.client_id,contractId:alternate.id});assert.equal(sameCustomer.createdService,true);
 const race=await Promise.all([1,2].map(()=>response('/shipping-orders/'+single[1].id+'/returns','POST',{containerIds:single[1].containers.map(c=>c.containerId),useCurrentClient:true})));
 assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);assert.equal(race.find(r=>r.status===409).body.code,'RETURN_ALREADY_EXISTS');
 assert.equal((await api('/shipping-orders/'+pair.id)).returnOrders.length,2);
 const autoDetails=await details(foreign.serviceOrderId);assert.equal(autoDetails.order.workflow,'AUTO_RETURN');assert.equal(autoDetails.order.sourceServiceOrderId,root);assert.equal(autoDetails.progress.total,1);assert.equal(autoDetails.returnOrders.length,1);
 const returnDetails=await api('/receiving-orders/'+foreign.receivingOrderId);assert.equal(returnDetails.clientId,other.client_id);assert.equal(returnDetails.containers[0].ownerClientId,tariff.client_id);
 assert.equal(returnDetails.containers[0].empty,true);
 const originalChargeCount=()=>Number(sql(`select count(*) from service_execution where comprehensive_service_order_id='${root}'`));
 assert.equal(originalChargeCount(),0);
 // Parent preparation must not alter foreign return dates/routes.
 await prepare(root,'RETURN_RECEIVING');assert.equal((await api('/receiving-orders/'+foreign.receivingOrderId)).arrivalAt??null,null);
 await prepare(foreign.serviceOrderId,'RETURN_RECEIVING');
 await section(foreign.serviceOrderId,'RETURN_RECEIVING','CONFIRM_ROUTES',409);
 await complete(root,'INITIAL_RECEIVING');assert.equal(originalChargeCount(),0);
 await complete(root,'SHIPPING');assert.equal(originalChargeCount(),0);
 assert.notEqual((await details(root)).order.status,'COMPLETED');
 await section(foreign.serviceOrderId,'RETURN_RECEIVING','CONFIRM_ROUTES');
 // The frozen auto tariff survives subsequent repricing/deactivation; failure rolls stock/status/charges back.
 const snap=sql(`select row_to_json(t) from comprehensive_service_order_tariff t where comprehensive_service_order_id='${foreign.serviceOrderId}'`);
 sql(`delete from comprehensive_service_order_tariff where comprehensive_service_order_id='${foreign.serviceOrderId}'`);
 try { const failure=await section(foreign.serviceOrderId,'RETURN_RECEIVING','COMPLETE_ORDERS',409);assert.equal(failure.code,'TARIFF_SNAPSHOT_NOT_FOUND');assert.equal(originalChargeCount(),0);assert.equal((await api('/receiving-orders/'+foreign.receivingOrderId)).status,'CONFIRMED'); }
 finally {sql(`insert into comprehensive_service_order_tariff select * from json_populate_record(null::comprehensive_service_order_tariff,'${snap.replaceAll("'","''")}')`)}
 sql(`update complex_service_catalog set price_without_vat=price_without_vat+1,price_with_vat=price_with_vat+1 where id='${auto.id}';update complex_service_tariff set active=false where complex_service_id='${auto.id}'`);
 try {
  const done=await section(foreign.serviceOrderId,'RETURN_RECEIVING','COMPLETE_ORDERS');assert.equal(done.order.status,'COMPLETED');assert.equal(done.totalWithoutVat,auto.price_without_vat);assert.equal(done.totalWithVat,auto.price_with_vat);assert.equal(originalChargeCount(),1);
 } finally {sql(`update complex_service_catalog set price_without_vat=${auto.price_without_vat},price_with_vat=${auto.price_with_vat} where id='${auto.id}';update complex_service_tariff set active=true where id in (${activeAutoIds})`)}
 await complete(root,'RETURN_RECEIVING');assert.equal(originalChargeCount(),3);assert.notEqual((await details(root)).order.status,'COMPLETED');
 await complete(sameCustomer.serviceOrderId,'RETURN_RECEIVING');
 s=await details(root);assert.equal(s.order.status,'COMPLETED');assert.equal(s.progress.returnCompleted,4);assert.equal(originalChargeCount(),4);
 assert.equal(s.totalWithoutVat,tariff.net*4);assert.equal(s.totalWithVat,tariff.gross*4);
 await Promise.all([section(root,'RETURN_RECEIVING','COMPLETE_ORDERS'),section(foreign.serviceOrderId,'RETURN_RECEIVING','COMPLETE_ORDERS')]);assert.equal(originalChargeCount(),4);
 const paid=json(`select json_agg(row_to_json(t)) from (select b.client_id,b.contract_id,e.comprehensive_service_order_id from billing_charge b join service_execution e on e.id=b.service_execution_id where e.comprehensive_service_order_id in ('${root}','${foreign.serviceOrderId}','${sameCustomer.serviceOrderId}'))t`);
 assert.equal(paid.length,6);assert.equal(paid.filter(c=>c.client_id===other.client_id).length,1);assert.equal(paid.filter(c=>c.contract_id===alternate.id).length,1);
 assert.equal(sql(`select client_id from container_owner where container_id='${pairIds[1]}'`),tariff.client_id);
 console.log('PASS manual / partial / cross-client / cross-contract returns; concurrency; rollback; frozen tariffs; stock owner; both service statuses and separate charges');
 const trainOrder=await createRail(train,40,2);assert.equal(trainOrder.returnOrders.length,0);assert.equal(trainOrder.shippingOrders.length,38);
 const trainShipment=await api('/shipping-orders/'+trainOrder.shippingOrders[0].id);await payload(trainShipment,trainShipment.containers.map(c=>c.containerId));assert.equal((await details(trainOrder.order.id)).returnOrders.length,1);
 const uiOrder=await createRail();
 fs.writeFileSync('manual-return-results.json',JSON.stringify({db,root,foreign,sameCustomer,train:trainOrder.order.id,ui:uiOrder.order.id,uiShipping:uiOrder.shippingOrders[0].id,other,alternate},null,2));
 console.log('PASS train service, no automatic returns for KTK20/40, UI fixtures ready');
})().catch(e=>{console.error(e);process.exitCode=1});
