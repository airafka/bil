// Mutates only a freshly restored, explicitly named V26 test database on port 8190.
const assert=require('node:assert/strict'),fs=require('fs'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const db=process.env.REFACTOR_TEST_DB,base='http://localhost:8190/api';
assert.match(db||'',/^billing_next_refactor_\d{8}_\d{6}$/);
const testContainer=JSON.parse(execFileSync(docker,['inspect','billing-next-refactor-backend'],{encoding:'utf8',windowsHide:true}))[0];
assert.ok(testContainer.Config.Env.includes('DB_NAME='+db),'Test backend must use the prepared database');
assert.ok(testContainer.NetworkSettings.Ports['8080/tcp'].some(p=>p.HostPort==='8190'));
const sql=q=>execFileSync(docker,['exec','billing-next-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',windowsHide:true}).trim();
async function api(p,method='GET',body,status=200){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,p+': '+text);return text?JSON.parse(text):null}
const json=q=>JSON.parse(sql(q));
(async()=>{
 assert.equal(sql("select version from flyway_schema_history where success order by installed_rank desc limit 1"),'26');
 assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and ((table_name in ('complex_service_catalog','comprehensive_service_order_tariff') and column_name='purpose') or (table_name='service_execution' and column_name in ('family','accepted_container_count')) or (table_name='receiving_order' and column_name='a_complex_service_id'))"),'0');
 const options=await api('/comprehensive-service-orders/available-services');assert.equal(options.length,2);
 const wagon=options.find(o=>o.maxWaybillContainers===39),train=options.find(o=>o.minWaybillContainers===40);
 assert.equal((await api('/complex-services')).length,2);
 await api('/complex-services/6f0cef12-5bde-4e05-9087-a9ca60b9488a','GET',undefined,404);
 const results=[];
 for(const selected of [wagon,train]){
  const tariff=json(`select row_to_json(t) from (select t.id,t.client_id,t.contract_id,round(c.price_without_vat*t.coefficient,2) without_vat,round(c.price_with_vat*t.coefficient,2) with_vat from complex_service_tariff t join complex_service_catalog c on c.id=t.complex_service_id where c.id='${selected.id}' and t.active limit 1)t`);
  const count=selected===wagon?4:40;
  const bill=await api('/waybills/generate','POST',{standard20:2,standard40:count-2},201);
  const payload={complexServiceId:selected.id,clientId:tariff.client_id,contractId:tariff.contract_id,defaultContainerOwnerId:tariff.client_id,waybillIds:[bill.id]};
  const mismatch=await api('/comprehensive-service-orders','POST',{...payload,complexServiceId:selected===wagon?train.id:wagon.id},400);assert.equal(mismatch.code,'SERVICE_WAYBILL_CONTAINER_COUNT_MISMATCH');
  await api('/comprehensive-service-orders','POST',{...payload,complexServiceId:'6f0cef12-5bde-4e05-9087-a9ca60b9488a'},400);
  let s=await api('/comprehensive-service-orders','POST',payload,201);const id=s.order.id,apiPath='/comprehensive-service-orders/'+id;
  assert.equal(s.shippingOrders.length,count-2);assert.equal(s.returnOrders.length,count-2);assert.equal(s.selectableContainers.length,2);
  assert.equal(s.progress.serviceName,selected.name);assert.ok(!('returnServiceName' in s.progress));
  const charges=()=>Number(sql(`select count(*) from service_execution where comprehensive_service_order_id='${id}'`));
  const action=(section,action,status=200)=>api(apiPath+'/complete-section','POST',{section,action},status);
  const prepare=section=>api(apiPath+'/prepare-transport','POST',{section});
  // The selected snapshot must survive catalog renaming, repricing and tariff deactivation.
  sql(`update complex_service_catalog set name='Проверка ${selected.id}',price_without_vat=price_without_vat+100,price_with_vat=price_with_vat+200 where id='${selected.id}';update complex_service_tariff set coefficient=coefficient+1,active=false where id='${tariff.id}'`);
  for(const section of ['INITIAL_RECEIVING','SHIPPING','RETURN_RECEIVING'])await prepare(section);
  await action('SHIPPING','CONFIRM_ROUTES',409);
  await action('INITIAL_RECEIVING','CONFIRM_ROUTES');s=await action('INITIAL_RECEIVING','COMPLETE_ORDERS');assert.equal(charges(),0);assert.equal(s.progress.accepted,count);
  await action('RETURN_RECEIVING','CONFIRM_ROUTES',409);
  await action('SHIPPING','CONFIRM_ROUTES');s=await action('SHIPPING','COMPLETE_ORDERS');assert.equal(charges(),0);assert.notEqual(s.order.status,'COMPLETED');
  await action('RETURN_RECEIVING','CONFIRM_ROUTES');
  if(selected===wagon){
   const snapshot=sql(`select row_to_json(t) from comprehensive_service_order_tariff t where comprehensive_service_order_id='${id}'`);
   sql(`delete from comprehensive_service_order_tariff where comprehensive_service_order_id='${id}'`);
   try {const error=await action('RETURN_RECEIVING','COMPLETE_ORDERS',409);assert.equal(error.code,'TARIFF_SNAPSHOT_NOT_FOUND');assert.equal(charges(),0);assert.ok((await api(apiPath)).returnOrders.every(o=>o.status==='CONFIRMED'));}
   finally{sql(`insert into comprehensive_service_order_tariff select * from json_populate_record(null::comprehensive_service_order_tariff,'${snapshot.replaceAll("'","''")}')`)}
  }
  s=await action('RETURN_RECEIVING','COMPLETE_ORDERS');assert.equal(charges(),count-2);assert.notEqual(s.order.status,'COMPLETED');
  const ids=s.selectableContainers.map(c=>c.containerId);
  s=await api(apiPath+'/shipping-orders','POST',{containerIds:ids},201);
  assert.equal(s.shippingOrders.length,count-1);assert.equal(s.returnOrders.length,count-1);assert.equal(s.selectableContainers.length,0);
  await api(apiPath+'/shipping-orders','POST',{containerIds:ids},409);
  for(const section of ['SHIPPING','RETURN_RECEIVING']){await prepare(section);await action(section,'CONFIRM_ROUTES');s=await action(section,'COMPLETE_ORDERS')}
  assert.equal(s.order.status,'COMPLETED');assert.equal(charges(),count);assert.equal(s.progress.returnCompleted,count);
  await Promise.all([action('RETURN_RECEIVING','COMPLETE_ORDERS'),action('RETURN_RECEIVING','COMPLETE_ORDERS')]);assert.equal(charges(),count);
  const billings=await api('/billing-charges?size=100&comprehensiveServiceOrderId='+id);
  assert.equal(billings.total,count);assert.equal(billings.totalWithoutVat,tariff.without_vat*count);assert.equal(billings.totalWithVat,tariff.with_vat*count);
  assert.ok(billings.items.every(c=>c.amountWithVat===tariff.with_vat&&!('family' in c)));
  results.push({id,count,priceWithVat:tariff.with_vat});console.log('PASS full lifecycle',selected.name,count,'KTK; frozen prices, late KTK20, idempotency');
 }
 fs.writeFileSync('service-refactor-results.json',JSON.stringify(results,null,2));
 console.log('PASS obsolete service/schema removed; no charges before return; missing snapshot blocks atomically; both workflows complete');
})().catch(e=>{console.error(e);process.exitCode=1});
