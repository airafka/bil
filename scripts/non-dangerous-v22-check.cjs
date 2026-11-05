const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const mode=process.argv[2];
const db=mode==='live'?'billing':'billing_non_dangerous_v22_check';
const base=mode==='live'?'http://localhost:8080':'http://localhost:8100';
function sql(q,d=db){return execFileSync(docker,['exec','billing-db-1','psql','-U','billing','-d',d,'-v','ON_ERROR_STOP=1','-Atc',q],{encoding:'utf8'}).trim();}
function snapshot(d){
 const tables=sql("select tablename from pg_tables where schemaname='public' and tablename not in ('danger_class','danger_product','flyway_schema_history') order by tablename",d).split('\n');
 const q=tables.map(t=>`select '${t}' as name,md5(coalesce(string_agg(x,chr(10) order by x),'')) as digest from (select row_to_json(t)::text x from public."${t}" t) q`).join(' UNION ALL ');
 return {tables:sql(q,d),sequences:sql("select sequencename,last_value from pg_sequences where schemaname='public' order by sequencename",d),products:sql('select id,identifier from danger_product order by id',d),oldClasses:sql("select * from danger_class where code<>'Неопасный груз' order by id",d)};
}
async function main(){
 if(mode==='before'){fs.writeFileSync('non-dangerous-v22-before.json',JSON.stringify(snapshot('billing'),null,2));return;}
 assert.deepEqual(snapshot(db),JSON.parse(fs.readFileSync('non-dangerous-v22-before.json')));
 assert.equal(sql("select count(*) from danger_class where code='Неопасный груз' and code_danger_class='0'"),'1');
 assert.equal(sql("select count(*) from danger_product p join danger_class c on c.id=p.danger_class_id where p.identifier=-1 and c.code='Неопасный груз'"),'1');
 assert.equal(sql("select count(*) from waybill_product_details where danger_product_identifier=-1 and danger_class_name='Неопасный груз'"),'6');
 assert.equal(sql("select count(*) from waybill_product_details where danger_product_identifier=-1 and danger_class_name is distinct from 'Неопасный груз'"),'0');
 async function api(path,body){const r=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
 const refs=await api('/api/references/hazard-classes');assert.ok(refs.some(x=>x.name==='Неопасный груз'));assert.ok(refs.some(x=>x.name==='Отсутствует'));
 const grouped=await api('/api/waybills/grouped/page',{pageInfo:{page:0,size:100}});
 let seen=0;function scan(obj){if(!obj||typeof obj!=='object')return;if(obj.dangerProductIdentifier===-1){assert.equal(obj.hazardClassName,'Неопасный груз');assert.equal(obj.dangerProductName,'Неопасный груз');seen++;}Object.values(obj).forEach(scan);}
 scan(grouped);assert.ok(seen>=6,`Expected all 6 products, found ${seen}`);
 const receiptIds=sql('select distinct receiving_order_id from waybill where receiving_order_id is not null').split('\n');
 for(const id of receiptIds){const receipt=await api('/api/receiving-orders/'+id);assert.ok(JSON.stringify(receipt).includes('Неопасный груз'));}
 console.log(`PASS ${mode}: 6 waybill products resolve non-dangerous class via FK, reference API and ${receiptIds.length} railway receipts; all other tables/sequences unchanged`);
}
main().catch(e=>{console.error(e);process.exit(1)});
