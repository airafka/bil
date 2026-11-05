const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const base='http://127.0.0.1:8094',db='billing_route_catalog_v18_check';
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
function sql(s){return execFileSync(docker,['exec','billing-db-1','psql','-U','billing','-d',db,'-v','ON_ERROR_STOP=1','-At','-c',s],{encoding:'utf8'}).trim()}
async function api(p,method='GET',body,status=200){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body==null?undefined:JSON.stringify(body)});const t=await r.text();assert.equal(r.status,status,method+' '+p+' '+t);return t?JSON.parse(t):null}
const id=(g,i)=>`1800000${g}-0000-4000-8000-${String(i).padStart(12,'0')}`;
(async()=>{
 assert.equal(sql('select current_database()'),db);
 const before=sql("select json_build_object('receiving',(select json_agg(o order by id) from receiving_order o),'shipping',(select json_agg(o order by id) from shipping_order o),'invoices',(select json_agg(o order by id) from payment_invoice o),'routes',(select json_agg(to_jsonb(r)-'client_related_entity_id'-'client_driver_id'-'client_vehicle_id' order by id) from route r))");
 execFileSync(docker,['exec','billing-db-1','psql','-U','billing','-d',db,'-v','ON_ERROR_STOP=1','-f','/tmp/route-catalog-demo.sql']);
 const after=sql("select json_build_object('receiving',(select json_agg(o order by id) from receiving_order o),'shipping',(select json_agg(o order by id) from shipping_order o),'invoices',(select json_agg(o order by id) from payment_invoice o),'routes',(select json_agg(to_jsonb(r)-'client_related_entity_id'-'client_driver_id'-'client_vehicle_id' order by id) from route r))");assert.equal(after,before,'seed changed unrelated route/order/invoice data');
 for(const [kind,group] of [['carriers',0],['drivers',1],['vehicles',2]]){const rows=await api('/api/transport-catalogs/'+kind);assert.equal(rows.filter(x=>x.id.startsWith('1800000'+group)).length,12);}
 const routes=await api('/api/routes');const area=(await api('/api/references/terminal-areas')).find(a=>a.code==='CONTAINER').id;
 for(const r of routes){if(r.transportType==='VEHICLE'){assert.ok(r.phoneNumber);assert.ok(r.poaNumber);assert.ok(r.insuranceNumber);assert.equal(!!r.trailerNumber,r.withTrailer)}else{assert.equal(r.carrierId??null,null);assert.equal(r.driverId??null,null);assert.equal(r.vehicleId??null,null)}}
 const payload={routeType:'SHIPPING',transportType:'VEHICLE',terminalAreaId:area,departureAt:'2026-11-04T10:00:00Z',carrierId:id(0,1),driverId:id(1,1),vehicleId:id(2,1),comment:'catalog-check',orderIds:[]};
 for(const k of ['carrierId','driverId','vehicleId'])await api('/api/routes','POST',{...payload,[k]:null},400);
 await api('/api/routes','POST',{...payload,transportType:'RAILWAY'},400);
 const rail=await api('/api/routes','POST',{...payload,transportType:'RAILWAY',carrierId:null,driverId:null,vehicleId:null},201);assert.equal(rail.route.withTrailer??null,null);
 const created=await api('/api/routes','POST',payload,201);assert.equal(created.route.trailerNumber,'АВ1001716');assert.equal(created.route.phoneNumber,'+79001234501');
 const driver=await api('/api/transport-catalogs/drivers/'+id(1,1));
 await api('/api/transport-catalogs/drivers/'+driver.id,'PUT',{...driver,phoneNumber:'abc'},400);
 await api('/api/transport-catalogs/drivers/'+driver.id,'PUT',{...driver,phoneNumber:'+79991234567',active:false});
 const lookup=await api('/api/transport-catalogs/drivers?activeOnly=true');assert.ok(!lookup.some(d=>d.id===driver.id));
 await api('/api/routes','POST',payload,409);
 const edited=await api('/api/routes/'+created.route.id,'PUT',{...payload,comment:'updated'});assert.equal(edited.route.phoneNumber,'+79991234567');assert.equal(edited.route.comment,'updated');
 const other=await api('/api/routes','POST',{...payload,driverId:id(1,2),vehicleId:id(2,2)},201);assert.equal(other.route.withTrailer,false);assert.equal(other.route.trailerNumber??null,null);
 await api('/api/routes/'+other.route.id,'PUT',payload,409);
 await api('/api/transport-catalogs/drivers/'+driver.id,'DELETE',null,409);
 const vehicle=await api('/api/transport-catalogs/vehicles/'+id(2,1));
 await api('/api/transport-catalogs/vehicles/'+vehicle.id,'PUT',{...vehicle,trailerNumber:null},400);
 const updated=await api('/api/transport-catalogs/vehicles/'+vehicle.id,'PUT',{...vehicle,withTrailer:false});assert.equal(updated.trailerNumber??null,null);
 const noTrailer=(await api('/api/routes/'+created.route.id)).route;assert.equal(noTrailer.withTrailer,false);assert.equal(noTrailer.trailerNumber??null,null);
 await api('/api/transport-catalogs/vehicles','POST',{name:'wrong',active:true,withTrailer:false},400);
 const v=await api('/api/transport-catalogs/vehicles','POST',{name:' a 987 bc 777 ',active:true,withTrailer:true,trailerNumber:'ab 9876 777',insuranceNumber:'ХХХ 1234567890'},201);assert.equal(v.name,'А987ВС777');assert.equal(v.trailerNumber,'АВ9876777');
 await api('/api/transport-catalogs/vehicles','POST',{name:'А987ВС777',active:true,withTrailer:false},409);
 await api('/api/transport-catalogs/vehicles/'+v.id,'DELETE',null,204);
 sql("update route set status='COMPLETED' where id='"+other.route.id+"'");
 await api('/api/routes/'+other.route.id,'PUT',{...payload,driverId:id(1,2)},409);
 // Failure assigning an unavailable order must roll back the changed logistics/comment.
 const unavailable=sql("select id from shipping_order where route_id is not null limit 1");
 if(unavailable){await api('/api/routes/'+created.route.id,'PUT',{...payload,driverId:id(1,2),comment:'must rollback',orderIds:[unavailable]},409);assert.equal((await api('/api/routes/'+created.route.id)).route.comment,'updated');}
 console.log('PASS: migration/seed preserves documents; 12 records each; existing route fill; active selection; auto details; trailer validation/normalization; FK protection; draft editing; rollback; railway rules');
})().catch(e=>{console.error(e);process.exit(1)});
