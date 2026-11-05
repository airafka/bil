const fs=require('fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const [db,mode,file]=process.argv.slice(2);
assert.ok(db==='billing_next'||/^billing_next_refactor_\d{8}_\d{6}$/.test(db));
const sql=q=>execFileSync(docker,['exec','billing-next-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',windowsHide:true}).trim();
const removed={complex_service_catalog:['purpose'],comprehensive_service_order_tariff:['purpose'],receiving_order:['a_complex_service_id'],service_execution:['family','accepted_container_count']};
const old='6f0cef12-5bde-4e05-9087-a9ca60b9488a';
const tables=sql("select tablename from pg_tables where schemaname='public' and tablename<>'flyway_schema_history' order by tablename").split('\n');
const state={};
for(const table of tables){
 const value='to_jsonb(t)'+(removed[table]||[]).map(k=>`-'${k}'`).join('');
 const filter=table==='complex_service_catalog'?`where id<>'${old}'`:table==='complex_service_tariff'?`where complex_service_id<>'${old}'`:'';
 state[table]=sql(`select count(*)||':'||md5(coalesce(string_agg(v::text,E'\\n' order by v::text),'')) from(select ${value} v from "${table}" t ${filter})x`);
}
if(mode==='capture')fs.writeFileSync(file,JSON.stringify(state,null,2));
else {assert.equal(mode,'verify');assert.deepEqual(state,JSON.parse(fs.readFileSync(file,'utf8')));}
console.log('PASS',mode,db,tables.length+' tables; all retained fields and rows fingerprinted');
