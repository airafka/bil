const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const d='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',base='http://localhost:8185/api';
const sql=q=>execFileSync(d,['exec','billing-next-db-1','psql','-U','billing','-d','billing_next_auto_transport_check','-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim();
async function api(p,method='GET',body,status=200){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,text);return JSON.parse(text)}
const json=q=>JSON.parse(sql('select coalesce(json_agg(t),\'[]\'::json) from ('+q+')t'));
(async()=>{
 const service=(await api('/comprehensive-service-orders/available-services'))[0].id;
 const t=json(`select client_id,contract_id from complex_service_tariff where complex_service_id='${service}' and active limit 1`)[0];
 const w=await api('/waybills/generate','POST',{standard20:2,standard40:2},201);
 let s=await api('/comprehensive-service-orders','POST',{complexServiceId:service,clientId:t.client_id,contractId:t.contract_id,defaultContainerOwnerId:t.client_id,waybillIds:[w.id]},201);
 const id=s.order.id,path='/comprehensive-service-orders/'+id+'/prepare-transport';
 const prep=section=>api(path,'POST',{section});
 await api(path,'POST',{section:'main'},400);await api('/comprehensive-service-orders/00000000-0000-0000-0000-000000000001/prepare-transport','POST',{section:'SHIPPING'},404);
 const initial=await prep('INITIAL_RECEIVING');assert.ok(initial.receivingOrder.routeId);assert.equal(initial.receivingOrder.consignor,s.order.clientName);
 assert.ok(initial.shippingOrders.every(o=>!o.plannedAt));assert.ok(initial.returnOrders.every(o=>!o.plannedAt));
 const receipt=json(`select r.plan_receiving_date_time as planned,route.data_time as time,route.transport_type as transport,route.client_driver_id as driver from receiving_order r join route on route.id=r.route_id where r.id='${s.receivingOrder.id}'`)[0];
 assert.equal(receipt.transport,'RAILWAY');assert.equal(receipt.driver,null);assert.equal(sql(`select abs(extract(epoch from (plan_receiving_date_time-(current_timestamp at time zone 'Europe/Moscow'))))<120 from receiving_order where id='${s.receivingOrder.id}'`),'t');
 const driverStates=json('select id,active from client_driver');sql('update client_driver set active=false');
 try {await api(path,'POST',{section:'SHIPPING'},409);assert.equal(sql(`select count(*) from shipping_order where comprehensive_service_order_id='${id}' and (route_id is not null or planned_shipping_date_time is not null or consignee_id is not null)`),'0')}
 finally{for(const row of driverStates)sql(`update client_driver set active=${row.active} where id='${row.id}'`)}
 await Promise.all([prep('SHIPPING'),prep('SHIPPING')]);
 const sh=json(`select id,route_id,consignee_id,planned_shipping_date_time from shipping_order where comprehensive_service_order_id='${id}'`);assert.equal(sh.length,2);assert.ok(sh.every(o=>o.route_id&&o.consignee_id&&o.planned_shipping_date_time));assert.equal(new Set(sh.map(o=>o.route_id)).size,2);
 assert.equal(sql(`select count(*) from route where id in (select route_id from shipping_order where comprehensive_service_order_id='${id}') and client_driver_id is not null and client_vehicle_id is not null and client_related_entity_id is not null`),'2');
 assert.equal(sql(`select count(*) from receiving_order where comprehensive_service_order_id='${id}' and service_role='RETURN_RECEIVING' and route_id is not null`),'0');
 await prep('RETURN_RECEIVING');
 const linked=sql(`select string_agg(route_id::text,',' order by id) from receiving_order where comprehensive_service_order_id='${id}'`);await prep('RETURN_RECEIVING');assert.equal(sql(`select string_agg(route_id::text,',' order by id) from receiving_order where comprehensive_service_order_id='${id}'`),linked);
 const custom=(await api('/references/clients')).find(c=>c.name!==s.order.clientName).name;
 // Fixed test fixture values; confirmed documents must not be touched.
 sql(`update receiving_order set order_status='CONFIRMED',plan_receiving_date_time='2020-01-01',consignor='${custom.replaceAll("'","''")}' where id='${s.receivingOrder.id}'`);
 await prep('INITIAL_RECEIVING');assert.equal(sql(`select plan_receiving_date_time::date from receiving_order where id='${s.receivingOrder.id}'`),'2020-01-01');
 const ret=s.returnOrders[0].id;sql(`update receiving_order set consignor='${custom.replaceAll("'","''")}' where id='${ret}'`);await prep('RETURN_RECEIVING');assert.equal(sql(`select consignor from receiving_order where id='${ret}'`),custom);
 s=await api('/comprehensive-service-orders/'+id+'/shipping-orders','POST',{containerIds:s.selectableContainers.map(c=>c.containerId)},201);await prep('SHIPPING');await prep('RETURN_RECEIVING');
 assert.equal(sql(`select count(*) from shipping_order where comprehensive_service_order_id='${id}' and route_id is not null`),'3');
 assert.equal(sql(`select count(*) from receiving_order where comprehensive_service_order_id='${id}' and service_role='RETURN_RECEIVING' and route_id is not null`),'3');
 require('fs').writeFileSync('auto-transport-result.json',JSON.stringify({id}));
 console.log('PASS per-section isolation, Moscow time, party fill/preservation, auto/rail routes, atomic catalog failure, concurrent repeat without duplicates, confirmed untouched, late KTK20');
})().catch(e=>{console.error(e);process.exitCode=1});
