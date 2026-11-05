const assert=require('node:assert/strict'),fs=require('fs'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const db='billing_next_train_check',base='http://localhost:8189/api';
function sql(q){return execFileSync(docker,['exec','billing-next-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',windowsHide:true}).trim()}
async function api(p,method='GET',body,status=200){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();assert.equal(r.status,status,p+': '+t);return t?JSON.parse(t):null}
(async()=>{
 const options=await api('/comprehensive-service-orders/available-services');assert.equal(options.length,2);
 const wagon=options.find(s=>s.maxWaybillContainers===39),train=options.find(s=>s.minWaybillContainers===40);assert.ok(wagon&&train);
 const tariff=JSON.parse(sql(`select row_to_json(x) from (select t.client_id,t.contract_id,round(c.price_with_vat*t.coefficient,2) price from complex_service_tariff t join complex_service_catalog c on c.id=t.complex_service_id where c.id='${train.id}' and t.active and exists(select 1 from complex_service_tariff w where w.client_id=t.client_id and w.contract_id=t.contract_id and w.active and w.complex_service_id='${wagon.id}') limit 1)x`));
 const payload=(serviceId,bills)=>({complexServiceId:serviceId,clientId:tariff.client_id,contractId:tariff.contract_id,defaultContainerOwnerId:tariff.client_id,waybillIds:bills.map(b=>b.id)});
 const state=()=>sql(`select json_build_array((select count(*) from comprehensive_service_order),(select count(*) from receiving_order),(select count(*) from shipping_order),(select count(*) from comprehensive_service_order_tariff),(select last_value from comprehensive_service_order_number_seq))`);
 let trainOrder;
 for(const count of [39,40,41]){
   const bill=await api('/waybills/generate','POST',{standard20:count===40?38:count,standard40:count===40?2:0},201);
   const good=count<40?wagon:train,bad=count<40?train:wagon,before=state();
   const err=await api('/comprehensive-service-orders','POST',payload(bad.id,[bill]),400);
   assert.equal(err.code,'SERVICE_WAYBILL_CONTAINER_COUNT_MISMATCH');assert.ok(err.detail.includes(good.name));assert.ok(err.detail.includes(count+' КТК'));assert.equal(state(),before);
   const order=await api('/comprehensive-service-orders','POST',payload(good.id,[bill]),201);
   assert.equal(sql(`select count(*) from comprehensive_service_order_tariff where comprehensive_service_order_id='${order.order.id}' and complex_service_id='${good.id}' and purpose='SELECTED'`),'1');
   if(count===40){trainOrder=order;assert.equal(order.shippingOrders.length,2);assert.equal(order.returnOrders.length,2);assert.equal(order.selectableContainers.length,38)}
   console.log('PASS API boundary',count);
 }
 const b20a=await api('/waybills/generate','POST',{standard20:20,standard40:0},201),b20b=await api('/waybills/generate','POST',{standard20:20,standard40:0},201);
 await api('/comprehensive-service-orders','POST',payload(train.id,[b20a,b20b]),400);
 await api('/comprehensive-service-orders','POST',payload(wagon.id,[b20a,b20b]),201);
 const ui39=await api('/waybills/generate','POST',{standard20:39,standard40:0},201),ui40=await api('/waybills/generate','POST',{standard20:40,standard40:0},201);
 await api('/comprehensive-service-orders','POST',payload(wagon.id,[ui39,ui40]),400);
 await api('/comprehensive-service-orders','POST',payload(train.id,[ui39,ui40]),400);
 console.log('PASS per-waybill counts and mixed selection');
 const id=trainOrder.order.id,apiPath='/comprehensive-service-orders/'+id;
 const twenty=trainOrder.selectableContainers.map(c=>c.containerId);
 for(let i=0;i<twenty.length;i+=2)trainOrder=await api(apiPath+'/shipping-orders','POST',{containerIds:twenty.slice(i,i+2)},201);
 assert.equal(trainOrder.shippingOrders.length,21);assert.equal(trainOrder.returnOrders.length,21);
 const charges=()=>sql(`select count(*) from service_execution where comprehensive_service_order_id='${id}'`);
 for(const section of ['INITIAL_RECEIVING','SHIPPING','RETURN_RECEIVING']){
   await api(apiPath+'/prepare-transport','POST',{section});
   await api(apiPath+'/complete-section','POST',{section,action:'CONFIRM_ROUTES'});
   assert.equal(charges(),'0');
   trainOrder=await api(apiPath+'/complete-section','POST',{section,action:'COMPLETE_ORDERS'});
   assert.equal(charges(),section==='RETURN_RECEIVING'?'40':'0');
 }
 assert.equal(trainOrder.order.status,'COMPLETED');
 await api(apiPath+'/complete-section','POST',{section:'RETURN_RECEIVING',action:'COMPLETE_ORDERS'});assert.equal(charges(),'40');
 assert.equal(sql(`select count(*) from service_execution e join billing_charge b on b.service_execution_id=e.id where e.comprehensive_service_order_id='${id}' and e.complex_service_id='${train.id}' and b.price_with_vat=${tariff.price}`),'40');
 console.log('PASS train lifecycle, automatic 40/20 returns, one selected tariff, billing only on return, completion and idempotency');
 fs.writeFileSync('train-service-test-data.json',JSON.stringify({tariff,wagon,train,ui39,ui40,id},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
