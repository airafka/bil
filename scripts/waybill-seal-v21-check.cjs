const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const checkDb='billing_waybill_seal_v21_final_check';
function sql(query, db=checkDb) { return execFileSync(docker,['exec','billing-db-1','psql','-U','billing','-d',db,'-v','ON_ERROR_STOP=1','-Atc',query],{encoding:'utf8'}).trim(); }
function snapshot() {
 const tables=sql("select tablename from pg_tables where schemaname='public' and tablename not in ('seal_type','waybill_zpu','flyway_schema_history') order by tablename",'billing').split('\n');
 const hashes=tables.map(t=>[t,sql(`select md5(coalesce(string_agg(x,chr(10) order by x),'')) from (select row_to_json(t)::text x from public."${t}" t) q`,'billing')]);
 return {hashes,sequences:sql("select sequencename,last_value from pg_sequences where schemaname='public' order by sequencename",'billing'),seals:sql('select id,waybill_container_id,zpu from waybill_zpu order by id','billing')};
}
async function main() {
 const mode=process.argv[2];
 if(mode==='snapshot'){fs.writeFileSync('waybill-seal-v21-before.json',JSON.stringify(snapshot(),null,2));return;}
 if(mode==='compare'){assert.deepEqual(snapshot(),JSON.parse(fs.readFileSync('waybill-seal-v21-before.json')));console.log('PASS live: other tables, sequences and ZPU numbers unchanged');return;}
 assert.equal(sql("select data_type from information_schema.columns where table_name='waybill_zpu' and column_name='zpu_type'"),'uuid');
 assert.equal(sql("select count(*) from information_schema.columns where table_name='waybill_zpu' and column_name in ('seal_type_id','legacy_zpu_type')"),'0');
 assert.equal(sql("select count(*) from waybill_zpu where zpu_type='b2100000-1111-0000-0000-000000000001'"),'1');
 assert.equal(sql("select count(*) from waybill_zpu z join seal_type s on s.id=z.zpu_type where s.code='NEW-TYPE'"),'1');
 assert.equal(sql("select count(*) from waybill_zpu where zpu='EMPTY-TYPE' and zpu_type is null"),'1');
 assert.equal(sql("select count(*) from seal_type where code in ('закрутка','Иностранное ЗПУ')"),'2');
 function rejects(query){let failed=false;try{sql(query);}catch{failed=true;}assert.ok(failed,'FK must reject query');}
 rejects("update waybill_zpu set zpu_type='ffffffff-ffff-ffff-ffff-ffffffffffff'");
 rejects("delete from seal_type where code='EXISTING'");
 async function api(path,body,status=200){const r=await fetch('http://localhost:8099'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
 const [containers,cars,etsng,types]=await Promise.all(['containers','railway-carriages','etsng-codes','seal-types'].map(x=>api('/api/references/'+x)));
 const seal=types.find(x=>x.name==='Иностранное ЗПУ');assert.ok(seal);
 const payload={number:'V21-SEAL-FK',departureStation:1001,destinationStation:2001,payer:'V21 test',products:[{etsngCodeId:etsng[0].id,weight:1000}],railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:containers[0].id,grossWeight:4200,netWeight:1000,sealNumbers:'TEST-A, TEST-B',sealTypeId:seal.id}]}]};
 const created=await api('/api/waybills',payload,201);
 assert.equal(sql(`select count(*) from waybill_zpu where zpu in ('TEST-A','TEST-B') and zpu_type='${seal.id}'`),'2');
 sql(`update seal_type set code='RENAMED-FOREIGN' where id='${seal.id}'`);
 assert.equal(sql("select count(*) from waybill_container_details where seal_numbers='TEST-A, TEST-B' and seal_type_name='RENAMED-FOREIGN'"),'1');
 const page=await api('/api/waybills/available?search=V21-SEAL-FK');
 assert.ok(JSON.stringify(page).includes('RENAMED-FOREIGN'));
 const before=sql('select count(*) from waybill');
 payload.number='V21-INVALID';payload.railwayCarriages[0].containers[0].sealTypeId='ffffffff-ffff-ffff-ffff-ffffffffffff';
 await api('/api/waybills',payload,404);assert.equal(sql('select count(*) from waybill'),before);
 const [contracts,areas]=await Promise.all(['contracts','terminal-areas'].map(x=>api('/api/references/'+x)));
 const receipt=await api('/api/receiving-orders',{clientId:contracts[0].clientId,contractId:contracts[0].id,defaultContainerOwnerId:contracts[0].clientId,terminalAreaId:areas.find(x=>x.code==='CONTAINER').id,transportType:'RAILWAY',waybillIds:[created.id]},201);
 const details=await api('/api/receiving-orders/'+receipt.id);
 assert.ok(JSON.stringify(details).includes('RENAMED-FOREIGN'));assert.ok(JSON.stringify(details).includes(seal.id));
 console.log('PASS: legacy migration, UUID FK, deletion restriction, two references, API create/read, rename by ID, invalid type rollback, railway receiving view');
}
main().catch(e=>{console.error(e);process.exit(1);});
