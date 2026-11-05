const {execFileSync}=require('child_process'),assert=require('assert/strict');
const d='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const sql=q=>execFileSync(d,['exec','billing-db-1','psql','-U','billing','-d','billing_return_owner_check','-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim();
const json=q=>JSON.parse(sql('select coalesce(json_agg(t),\'[]\'::json) from ('+q+') t'));
async function post(path,body,status=200){const r=await fetch('http://localhost:8092/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b}
async function main(){
 const sources=json(`select s.id,s.comprehensive_service_order_id as service,s.source_receiving_order_id as initial from shipping_order s where s.source_receiving_order_id is not null and not exists(select 1 from receiving_order r where r.source_shipping_order_id=s.id) order by s.number desc`);assert.ok(sources.length>=3,'Requires prepared copy with three unreturned shipments');
 const clients=json('select id from client order by id limit 2');assert.equal(clients.length,2);
 const [a,b]=clients.map(c=>c.id);
 for(let i=0;i<3;i++){
 const s=sources[i],containers=json(`select container_id from shipping_order_container where shipping_order_id='${s.id}' order by container_id`);
 sql(`update receiving_order set default_container_owner_id='${a}' where id='${s.initial}'; update shipping_order set order_status='${i===2?'CONFIRMED':'DRAFT'}' where id='${s.id}'; update shipping_order_container set owner_container_id='${b}' where shipping_order_id='${s.id}'`);
 const setOwner=owner=>sql(`update waybill_container wc set owner_container_id=${owner} from waybill_railway_carriage rc join waybill w on w.id=rc.waybill_id where wc.waybill_railway_carriage_id=rc.id and w.receiving_order_id='${s.initial}' and wc.container_id in (${containers.map(c=>"'"+c.container_id+"'").join(',')})`);
 if(i===0){sql(`update receiving_order set order_status='DRAFT',default_container_owner_id=null where id='${s.initial}'`);setOwner('null');await post('/shipping-orders/'+s.id+'/returns',{containerIds:containers.map(c=>c.container_id)},409);assert.equal(sql(`select count(*) from receiving_order where source_shipping_order_id='${s.id}'`),'0');sql(`update receiving_order set default_container_owner_id='${b}' where id='${s.initial}'`);setOwner("'"+a+"'")}
 else if(i===1)setOwner('null');else setOwner("'"+a+"'");
 const result=i===0?(await post('/comprehensive-service-orders/'+s.service+'/returns',{shippingOrderIds:[s.id]}))[0]:await post('/shipping-orders/'+s.id+'/returns',{containerIds:containers.map(c=>c.container_id)});
 const rows=json(`select owner_container_id,empty from receiving_order_container where receiving_order_id='${result.id}'`);assert.equal(rows.length,containers.length);assert.ok(rows.every(r=>r.owner_container_id===(i===2?b:a)&&r.empty));assert.equal(result.status,'DRAFT');
 const repeat=await post('/shipping-orders/'+s.id+'/returns',{containerIds:containers.map(c=>c.container_id)});assert.equal(repeat.id,result.id);
 }
 console.log('PASS: draft initial supply; per-KTK owner priority over default and shipment; default fallback; frozen confirmed shipment owner; absent owner validation; bulk and individual creation; idempotency');
}
main().catch(e=>{console.error(e);process.exitCode=1});
