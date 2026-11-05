const assert=require('node:assert/strict'),fs=require('fs'),{execFileSync}=require('node:child_process');
const d='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',db='billing_route_cleanup_v19_check',base='http://127.0.0.1:8095';
function sql(s){return execFileSync(d,['exec','billing-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim()}
function snapshot(){return sql("select json_build_object('orders',(select json_agg(o order by id) from shipping_order o),'receiving',(select json_agg(o order by id) from receiving_order o),'routes',(select json_agg(o order by id) from route o),'consignees',(select json_agg(json_build_object('id',o.id,'name',p.name) order by o.id) from shipping_order o left join client_related_entity p on p.id=o.consignee_id))")}
(async()=>{
assert.equal(sql('select current_database()'),db);assert.equal((await fetch(base+'/actuator/health')).status,200);
const before=snapshot();execFileSync(d,['exec','billing-db-1','psql','-U','billing','-d',db,'-v','ON_ERROR_STOP=1','-f','/tmp/route-catalog-cleanup.sql']);assert.equal(snapshot(),before);
for(const [kind,prefix] of [['carriers','18000000'],['drivers','18000001'],['vehicles','18000002']]){for(const suffix of ['', '?activeOnly=true']){const rows=await (await fetch(base+'/api/transport-catalogs/'+kind+suffix)).json();assert.equal(rows.length,12);assert.ok(rows.every(x=>x.id.startsWith(prefix)));}}
assert.equal(sql('select count(*) from client_related_entity where transport_catalog_archived'),'5');
assert.equal((await fetch(base+'/api/transport-catalogs/carriers/a15e16a2-c417-44fd-a108-abdaa765e239')).status,404);
const area=(await (await fetch(base+'/api/references/terminal-areas')).json()).find(x=>x.code==='CONTAINER').id;
const r=await fetch(base+'/api/routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({routeType:'SHIPPING',transportType:'VEHICLE',terminalAreaId:area,departureAt:'2026-11-04T12:00:00Z',carrierId:'a15e16a2-c417-44fd-a108-abdaa765e239',driverId:'18000001-0000-4000-8000-000000000001',vehicleId:'18000002-0000-4000-8000-000000000001',orderIds:[]})});assert.equal(r.status,409);
console.log('PASS: exactly 12 visible records per catalog, archived carrier cannot be selected, documents/routes/consignee names unchanged');
console.log(sql("select number,id,comprehensive_service_order_id from receiving_order where route_id is null and order_status='DRAFT'"));
})().catch(e=>{console.error(e);process.exit(1)});
