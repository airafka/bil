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
 const wagon=(await api('/comprehensive-service-orders/available-services')).find(o=>o.maxWaybillContainers===39);
 const t=json(`select row_to_json(t) from (select client_id,contract_id from complex_service_tariff where complex_service_id='${wagon.id}' and active order by id limit 1)t`);
 const auto=json("select row_to_json(c) from complex_service_catalog c where order_workflow='AUTO_RETURN'");
 const other=json(`select row_to_json(t) from (select client_id,contract_id from complex_service_tariff where complex_service_id='${auto.id}' and active and client_id<>'${t.client_id}' limit 1)t`);
 assert.ok(other);
 async function fixture(){
  const bill=await api('/waybills/generate','POST',{standard20:2,standard40:4},201);
  let s=await api('/comprehensive-service-orders','POST',{complexServiceId:wagon.id,...{clientId:t.client_id,contractId:t.contract_id},defaultContainerOwnerId:t.client_id,waybillIds:[bill.id]},201);
  return api('/comprehensive-service-orders/'+s.order.id+'/shipping-orders','POST',{containerIds:s.selectableContainers.map(c=>c.containerId)},201);
 }
 const s=await fixture(),root=s.order.id,path='/comprehensive-service-orders/'+root+'/returns';
 const available=()=>api(path+'/available-containers');const all=await available();assert.equal(all.length,6);
 const pairId=all.find(a=>all.filter(b=>b.shippingOrderId===a.shippingOrderId).length===2).shippingOrderId;
 const pair=all.filter(c=>c.shippingOrderId===pairId);const one=all.find(c=>c.shippingOrderId!==pairId);
 const chosen=[...pair,one].map(c=>c.containerId),rest=all.filter(c=>!chosen.includes(c.containerId)).map(c=>c.containerId);
 await api(path,'POST',{containerIds:[],useCurrentClient:true},400);
 await api(path,'POST',{containerIds:[chosen[0],chosen[0]],useCurrentClient:true},400);
 await api(path,'POST',{containerIds:[chosen[0],randomUUID()],useCurrentClient:true},409);
 // Failure in the last item must roll back earlier returns and any newly created child service.
 const last=all.at(-1).containerId;
 const previousOwner=sql(`select owner_container_id from waybill_container where container_id='${last}' limit 1`);
 sql(`update receiving_order set default_container_owner_id=null where id='${s.receivingOrder.id}';update waybill_container set owner_container_id=null where container_id='${last}'`);
 const parentsBefore=sql('select count(*) from comprehensive_service_order');
 try {const failure=await api(path,'POST',{containerIds:all.map(c=>c.containerId),useCurrentClient:false,clientId:other.client_id,contractId:other.contract_id},409);assert.equal(failure.code,'RETURN_OWNER_REQUIRED');assert.equal((await details(root)).returnOrders.length,0);assert.equal(sql('select count(*) from comprehensive_service_order'),parentsBefore)}
 finally {sql(`update receiving_order set default_container_owner_id='${t.client_id}' where id='${s.receivingOrder.id}';update waybill_container set owner_container_id='${previousOwner}' where container_id='${last}'`)}
 const payload={containerIds:chosen,useCurrentClient:false,clientId:other.client_id,contractId:other.contract_id};
 const race=await Promise.all([response(path,'POST',payload),response(path,'POST',payload)]);assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 const result=race.find(r=>r.status===201).body;assert.equal(result.returns.length,3);assert.equal(result.createdService,true);
 assert.equal(new Set(result.returns.map(r=>r.receivingOrderId)).size,3);assert.ok(result.returns.every(r=>r.serviceOrderId===result.serviceOrderId));
 const child=await details(result.serviceOrderId);assert.equal(child.returnOrders.length,3);assert.equal(child.progress.returnOrderCount,3);assert.ok(child.returnOrders.every(r=>r.containerIds.length===1));
 assert.equal((await api('/shipping-orders/'+pairId)).returnOrders.length,2);
 assert.equal((await available()).length,3);
 await api(path,'POST',{containerIds:[chosen[0],rest[0]],useCurrentClient:true},409);assert.equal((await available()).length,3);
 const own=await api(path,'POST',{containerIds:rest,useCurrentClient:true},201);assert.equal(own.createdService,false);assert.equal(own.serviceOrderId,root);assert.equal(own.returns.length,3);
 assert.deepEqual(await available(),[]);assert.equal((await details(root)).returnOrders.length,6);
 const complete=async(id,part)=>{await prepare(id,part);await section(id,part,'CONFIRM_ROUTES');return section(id,part,'COMPLETE_ORDERS')};
 await complete(root,'INITIAL_RECEIVING');await complete(root,'SHIPPING');
 await complete(root,'RETURN_RECEIVING');assert.notEqual((await details(root)).order.status,'COMPLETED');
 const finished=await complete(result.serviceOrderId,'RETURN_RECEIVING');assert.equal(finished.order.status,'COMPLETED');assert.equal(finished.totalWithVat,auto.price_with_vat*3);
 const parent=await details(root);assert.equal(parent.order.status,'COMPLETED');assert.equal(parent.progress.returnCompleted,6);
 assert.equal(sql(`select count(*) from service_execution where comprehensive_service_order_id='${root}'`),'6');
 await section(result.serviceOrderId,'RETURN_RECEIVING','COMPLETE_ORDERS');assert.equal(sql(`select count(*) from service_execution where comprehensive_service_order_id='${result.serviceOrderId}'`),'3');
 const ui=await fixture();fs.writeFileSync('bulk-return-results.json',JSON.stringify({db,ui:ui.order.id,root,child:result.serviceOrderId,other},null,2));
 console.log('PASS bulk: separate request per KTK, one auto service per batch, two KTK from one shipment, partial selection, race201/409, all-or-nothing failure, current client, status and charges');
})().catch(e=>{console.error(e);process.exitCode=1});
