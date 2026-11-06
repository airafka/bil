// One-time cleanup explicitly requested for manual returns. Never called by application startup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const db=process.argv[2],backup=path.resolve(process.argv[3]||'');
assert.ok(db==='billing_next'||/^billing_next_manual_return_\d{8}_\d{6}$/.test(db||''),'Only the new copy or its dedicated test DB');
assert.equal(process.argv[4],'--clear-orders-for-manual-returns');
assert.ok(fs.statSync(backup).isFile()&&fs.statSync(backup).size>10000,'A custom-format backup is required');
assert.equal(fs.readFileSync(backup).subarray(0,5).toString(),'PGDMP');
if(db==='billing_next')assert.ok(Date.now()-fs.statSync(backup).mtimeMs<30*60*1000,'Take a fresh backup immediately before cleanup');
const output=path.join(path.dirname(backup),'cleanup-manual-return-'+db+'.json');
assert.ok(!fs.existsSync(output),'One-time cleanup has already completed');
const command=args=>execFileSync(docker,args,{encoding:'utf8',windowsHide:true}).trim();
const running=command(['ps','--format','{{.Names}}']).split('\n');
assert.ok(!running.includes(db==='billing_next'?'billing-next-backend-1':'billing-next-manual-return-test'),'Stop the corresponding backend before cleanup');
const sql=q=>command(['exec','billing-next-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',q]);
const tables=['payment_invoice_line','payment_invoice','billing_charge','service_execution','container_movement','container_owner_history','container_owner','service_order_container','service_order','receiving_order_container_item','shipping_order_container_item','receiving_order_container','shipping_order_container','shipping_order_railway_carriage','shipping_order_source_container','shipping_order','receiving_order','comprehensive_service_order_tariff','comprehensive_service_order','route'];
const all=sql("select tablename from pg_tables where schemaname='public' order by tablename").split('\n');
assert.ok(all.every(t=>/^[a-z_]+$/.test(t)));
const preserved=all.filter(t=>!tables.includes(t)&&t!=='waybill');
const hashSql=t=>`select md5(coalesce(string_agg(row_to_json(t)::text,'|' order by row_to_json(t)::text),'')) from ${t} t`;
const waybillSql="select md5(coalesce(string_agg((to_jsonb(w)-'receiving_order_id')::text,'|' order by id),'')) from waybill w";
const hashes=Object.fromEntries(preserved.map(t=>[t,sql(hashSql(t))]));
const waybillHash=sql(waybillSql);
const before=Object.fromEntries(tables.map(t=>[t,Number(sql(`select count(*) from ${t}`))]));
const sequenceSnapshot=()=>sql("select string_agg(sequencename||':'||coalesce(last_value::text,'null'),'|' order by sequencename) from pg_sequences where schemaname='public'");
const sequences=sequenceSnapshot();
const predeleted=tables.slice(0,9);
sql(`BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE ${all.join(',')} IN ACCESS EXCLUSIVE MODE;
UPDATE waybill SET receiving_order_id=NULL WHERE receiving_order_id IS NOT NULL;
${predeleted.map(t=>'DELETE FROM '+t+';').join('\n')}
DELETE FROM receiving_order WHERE service_role='RETURN_RECEIVING';
${tables.filter(t=>!predeleted.includes(t)).map(t=>'DELETE FROM '+t+';').join('\n')}
DO $$ BEGIN
${Object.entries(hashes).map(([t,h])=>`IF (${hashSql(t)})<>'${h}' THEN RAISE EXCEPTION 'Preserved table changed: ${t}'; END IF;`).join('\n')}
IF (${waybillSql})<>'${waybillHash}' THEN RAISE EXCEPTION 'Waybill data changed'; END IF;
${tables.map(t=>`IF EXISTS(SELECT 1 FROM ${t}) THEN RAISE EXCEPTION 'Not empty: ${t}'; END IF;`).join('\n')}
END $$;
COMMIT;`);
assert.equal(sequenceSnapshot(),sequences,'Sequences must not be reset');
fs.writeFileSync(output,JSON.stringify({db,backup,backupSha256:crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex'),before,preservedHashes:hashes,waybillHash,sequences,completedAt:new Date().toISOString()},null,2));
console.log('PASS cleanup: '+JSON.stringify(before));
