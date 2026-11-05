const fs=require('fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const d='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const [mode,db]=process.argv.slice(2);if(!['billing','billing_service_numbering_v20_final_check'].includes(db)||!['before','after'].includes(mode))throw Error('Invalid mode/database');
function sql(s){return execFileSync(d,['exec','billing-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim()}
const tables=sql("select tablename from pg_tables where schemaname='public' and tablename<>'flyway_schema_history' order by tablename").split('\n');
const checks=tables.map(t=>{if(!/^[a-z0-9_]+$/.test(t))throw Error('Unexpected table');const row=t==='comprehensive_service_order'?"to_jsonb(t)-'code'":t==='payment_invoice_line'?"to_jsonb(t)-'comprehensive_service_order_code'":'to_jsonb(t)';return `select '${t}' as name, count(*)||':'||coalesce(md5(string_agg((${row})::text,',' order by (${row})::text)),'empty') as value from ${t} t`}).join(' union all ');
const snapshot={tables:sql(checks),sequences:sql("select 'order:'||last_value||':'||is_called from order_code_seq union all select 'transport:'||last_value||':'||is_called from transport_order_number_seq union all select 'route:'||last_value||':'||is_called from route_code_seq")};
const file='service-numbering-'+db+'-before.json';
if(mode==='before'){snapshot.numbers=JSON.parse(sql('select json_agg(json_build_object(\'id\',id,\'code\',code) order by code,id) from comprehensive_service_order'));fs.writeFileSync(file,JSON.stringify(snapshot,null,2));console.log('Saved baseline '+db);}
else{
 const old=JSON.parse(fs.readFileSync(file));assert.equal(snapshot.tables,old.tables);assert.equal(snapshot.sequences,old.sequences);
 const numbers=JSON.parse(sql('select json_agg(json_build_object(\'id\',id,\'code\',code) order by code,id) from comprehensive_service_order'));
 assert.deepEqual(numbers,old.numbers.map((r,i)=>({...r,code:2841+i})));
 assert.equal(sql('select last_value||\':\'||is_called from comprehensive_service_order_number_seq'),(2841+numbers.length)+':false');
 assert.equal(sql("select success from flyway_schema_history where version='20'"),'t');
 assert.equal(sql('select count(*) from payment_invoice_line l join comprehensive_service_order o on o.id=l.comprehensive_service_order_id where l.comprehensive_service_order_code<>o.code'),'0');
 if(db==='billing_service_numbering_v20_final_check'){
  const inserted=sql("begin; insert into comprehensive_service_order(id,client_id,contract_id) select gen_random_uuid(),client_id,contract_id from comprehensive_service_order order by code limit 1 returning code; rollback;");assert.ok(inserted.split('\n').includes(String(2841+numbers.length)),inserted);
  assert.equal(sql("select nextval('comprehensive_service_order_number_seq')"),String(2842+numbers.length));
 }
 console.log('PASS: '+numbers.map(x=>x.code).join(', ')+', UUIDs/all other tables/other sequences unchanged'+(db==='billing'?', next '+(2841+numbers.length):', default and explicit nextval verified'));
}
