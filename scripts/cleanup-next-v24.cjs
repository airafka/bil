const fs=require('fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const db=process.argv[2];assert.ok(['billing_next_v24_check','billing_next'].includes(db),'Fixed new-copy DBs only');
const marker='C:/Users/Green-0482/Documents/ChatGPT/Билинг/bil-next/database/cleanup-v24-'+db+'.json';
assert.ok(!fs.existsSync(marker),'One-time cleanup already completed');
function sql(q){return execFileSync(docker,['exec','billing-next-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim()}
const tables=['payment_invoice_line','payment_invoice','billing_charge','service_execution','container_movement','container_owner_history','container_owner','service_order_container','service_order','receiving_order_container_item','shipping_order_container_item','receiving_order_container','shipping_order_container','shipping_order_railway_carriage','shipping_order_source_container','shipping_order','receiving_order','comprehensive_service_order_tariff','comprehensive_service_order','route'];
const preserved=['client','contract','complex_service_catalog','complex_service_tariff','container','railway_carriage','waybill_container','waybill_product','waybill_railway_carriage','waybill_zpu','client_related_entity','client_driver','client_vehicle','etsng_code','danger_class','danger_product','seal_type','payer','railway_station','railway_carriage_model','railway_carriage_type','terminal_area_catalog'];
const hashes=()=>Object.fromEntries(preserved.map(t=>[t,sql(`select md5(coalesce(string_agg(row_to_json(t)::text,'|' order by row_to_json(t)::text),'')) from ${t} t`)]));
const waybills=()=>sql("select md5(coalesce(string_agg((to_jsonb(w)-'receiving_order_id')::text,'|' order by id),'')) from waybill w");
const before=Object.fromEntries(tables.map(t=>[t,Number(sql(`select count(*) from ${t}`))])), retained=hashes(),waybillHash=waybills();
sql(`BEGIN;
UPDATE waybill SET receiving_order_id=NULL WHERE receiving_order_id IS NOT NULL;
DELETE FROM payment_invoice_line; DELETE FROM payment_invoice; DELETE FROM billing_charge; DELETE FROM service_execution;
DELETE FROM container_movement; DELETE FROM container_owner_history; DELETE FROM container_owner;
DELETE FROM service_order_container; DELETE FROM service_order;
DELETE FROM receiving_order WHERE service_role='RETURN_RECEIVING';
${tables.filter(t=>!['payment_invoice_line','payment_invoice','billing_charge','service_execution','container_movement','container_owner_history','container_owner','service_order_container','service_order'].includes(t)).map(t=>'DELETE FROM '+t+';').join('\n')}
COMMIT;`);
assert.deepEqual(hashes(),retained);assert.equal(waybills(),waybillHash);
for(const t of tables)assert.equal(sql(`select count(*) from ${t}`),'0',t);
fs.writeFileSync(marker,JSON.stringify({db,before,preservedHashes:retained,waybillHash,completedAt:new Date().toISOString()},null,2));
console.log('PASS cleanup; reference tables and waybill content unchanged; sequences retained',JSON.stringify(before));
