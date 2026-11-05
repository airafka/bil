const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',base='http://localhost:8186/api';
const sql=q=>execFileSync(docker,['exec','billing-next-db-1','psql','-U','billing','-d','billing_next_section_actions_check','-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim();
async function api(p,method='GET',body,status=200){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,text);return JSON.parse(text)}
(async()=>{
 const service=(await api('/comprehensive-service-orders/available-services'))[0].id;
 const t=JSON.parse(sql(`select row_to_json(t) from (select client_id,contract_id from complex_service_tariff where complex_service_id='${service}' and active limit 1)t`));
 const w=await api('/waybills/generate','POST',{standard20:2,standard40:2},201);
 let s=await api('/comprehensive-service-orders','POST',{complexServiceId:service,clientId:t.client_id,contractId:t.contract_id,defaultContainerOwnerId:t.client_id,waybillIds:[w.id]},201);
 const id=s.order.id,path='/comprehensive-service-orders/'+id;
 const action=(section,action,status=200)=>api(path+'/complete-section','POST',{section,action},status);
 const prep=section=>api(path+'/prepare-transport','POST',{section});
 const chargeCount=()=>sql(`select count(*) from service_execution where comprehensive_service_order_id='${id}'`);
 await action('INITIAL_RECEIVING','COMPLETE_ORDERS',409);await action('INITIAL_RECEIVING','CONFIRM_ROUTES',409);
 for(const section of ['INITIAL_RECEIVING','SHIPPING','RETURN_RECEIVING'])await prep(section);
 await action('SHIPPING','CONFIRM_ROUTES',409);
 await action('INITIAL_RECEIVING','COMPLETE_ORDERS',409);
 s=await action('INITIAL_RECEIVING','CONFIRM_ROUTES');assert.equal(s.receivingOrder.status,'CONFIRMED');assert.equal(chargeCount(),'0');assert.ok(s.shippingOrders.every(o=>o.status==='DRAFT'));
 await Promise.all([action('INITIAL_RECEIVING','CONFIRM_ROUTES'),action('INITIAL_RECEIVING','CONFIRM_ROUTES')]);assert.equal((await api(path)).receivingOrder.status,'CONFIRMED');
 s=await action('INITIAL_RECEIVING','COMPLETE_ORDERS');assert.equal(s.receivingOrder.status,'COMPLETED');assert.equal(chargeCount(),'0');
 // Trigger a failure after at least one route has already been confirmed in the batch.
 sql(`create function reject_second_batch_route() returns trigger language plpgsql as $$ begin if NEW.status='CONFIRMED' and exists(select 1 from shipping_order sh where sh.route_id=NEW.id and sh.comprehensive_service_order_id='${id}') and exists(select 1 from shipping_order sh join route r on r.id=sh.route_id where sh.comprehensive_service_order_id='${id}' and r.status='CONFIRMED') then raise exception 'test batch rollback'; end if; return NEW; end $$; create trigger reject_second_batch_route before update on route for each row execute function reject_second_batch_route();`);
 try{await action('SHIPPING','CONFIRM_ROUTES',500)}finally{sql('drop trigger reject_second_batch_route on route; drop function reject_second_batch_route();')}
 assert.equal(sql(`select count(*) from shipping_order where comprehensive_service_order_id='${id}' and order_status<>'DRAFT'`),'0');
 assert.equal(sql(`select count(*) from container_owner where shipping_order_id in (select id from shipping_order where comprehensive_service_order_id='${id}')`),'0');
 s=await action('SHIPPING','CONFIRM_ROUTES');assert.ok(s.shippingOrders.every(o=>o.status==='CONFIRMED'));assert.equal(chargeCount(),'0');
 await action('RETURN_RECEIVING','CONFIRM_ROUTES',409);
 // Completing confirmed orders also rolls back the whole batch on a late failure.
 sql(`create function reject_second_batch_order() returns trigger language plpgsql as $$ begin if NEW.order_status='COMPLETED' and NEW.comprehensive_service_order_id='${id}' and exists(select 1 from shipping_order where comprehensive_service_order_id='${id}' and order_status='COMPLETED') then raise exception 'test completion rollback'; end if; return NEW; end $$; create trigger reject_second_batch_order before update on shipping_order for each row execute function reject_second_batch_order();`);
 try{await action('SHIPPING','COMPLETE_ORDERS',500)}finally{sql('drop trigger reject_second_batch_order on shipping_order; drop function reject_second_batch_order();')}
 assert.equal(sql(`select count(*) from shipping_order where comprehensive_service_order_id='${id}' and order_status='COMPLETED'`),'0');
 s=await action('SHIPPING','COMPLETE_ORDERS');assert.ok(s.shippingOrders.every(o=>o.status==='COMPLETED'));assert.equal(chargeCount(),'0');
 s=await action('RETURN_RECEIVING','CONFIRM_ROUTES');assert.ok(s.returnOrders.every(o=>o.status==='CONFIRMED'));assert.equal(chargeCount(),'0');
 s=await action('RETURN_RECEIVING','COMPLETE_ORDERS');assert.ok(s.returnOrders.every(o=>o.status==='COMPLETED'));assert.equal(chargeCount(),'2');assert.notEqual(s.order.status,'COMPLETED');
 await action('RETURN_RECEIVING','COMPLETE_ORDERS');assert.equal(chargeCount(),'2');
 s=await api(path+'/shipping-orders','POST',{containerIds:s.selectableContainers.map(c=>c.containerId)},201);
 await prep('SHIPPING');await prep('RETURN_RECEIVING');
 const foreign=require('crypto').randomUUID();
 sql(`insert into shipping_order(id,client_id,contract_id,terminal_area_catalog_id,transport_type,route_id,order_status) select '${foreign}',client_id,contract_id,terminal_area_catalog_id,transport_type,route_id,'DRAFT' from shipping_order where comprehensive_service_order_id='${id}' and order_status='DRAFT' limit 1`);
 const conflict=await action('SHIPPING','CONFIRM_ROUTES',409);assert.equal(conflict.code,'SHARED_ROUTE_OUTSIDE_SECTION');sql(`delete from shipping_order where id='${foreign}'`);
 for(const section of ['SHIPPING','RETURN_RECEIVING']){await action(section,'CONFIRM_ROUTES');await action(section,'COMPLETE_ORDERS')}
 assert.equal((await api(path)).order.status,'COMPLETED');assert.equal(chargeCount(),'4');
 await Promise.all([action('RETURN_RECEIVING','COMPLETE_ORDERS'),action('RETURN_RECEIVING','COMPLETE_ORDERS')]);assert.equal(chargeCount(),'4');
 console.log('PASS explicit two phases, no execution on first/repeated confirm, isolated sections, full rollback of late confirmation/completion failures, stock/billing lifecycle, missing/shared route guard, late KTK20, concurrent idempotency');
})().catch(e=>{console.error(e);process.exitCode=1});
