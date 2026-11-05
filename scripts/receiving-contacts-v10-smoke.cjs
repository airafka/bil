const assert=require('node:assert/strict'); const {execFileSync}=require('node:child_process');
const docker='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const sql=q=>execFileSync(docker,['compose','exec','-T','db','psql','-U','billing','-d','billing_contacts_v10_check','-v','ON_ERROR_STOP=1','-Atc',q],{encoding:'utf8'}).trim();
async function api(path,body,status=200){const r=await fetch('http://127.0.0.1:8086'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
(async()=>{
const [contracts,areas]=await Promise.all(['contracts','terminal-areas'].map(k=>api('/api/references/'+k)));
assert.ok(contracts.every(c=>c.contractType==='Транспортно-экспедиционное обслуживание «ТЭО»'));
assert.equal(sql('select count(*) from receiving_order'),'4');
const cid=crypto.randomUUID();sql(`insert into container(id,code,weight,container_type) values('${cid}','CONTACT${Date.now()}',3000,'STANDARD_40')`);
const base={clientId:contracts[0].clientId,contractId:contracts[0].id,terminalAreaId:areas.find(a=>a.code==='CONTAINER').id,transportType:'VEHICLE',defaultContainerOwnerId:contracts[0].clientId,containers:[{containerId:cid,empty:true}],authorizedRepresentative:'  Иванов Иван  ',phone:' +7 (999) 123-45-67 ',email:' test@example.com ',comment:' Первая строка\nВторая строка '};
await api('/api/receiving-orders',{...base,email:'invalid'},400);
await api('/api/receiving-orders',{...base,comment:'x'.repeat(4001)},400);
const created=await api('/api/receiving-orders',base,201);const detail=await api('/api/receiving-orders/'+created.id);
for(const k of ['authorizedRepresentative','phone','email','comment'])assert.equal(detail[k],base[k].trim());
assert.equal(detail.contractType,contracts[0].contractType);
assert.equal(sql(`select email from receiving_order where id='${created.id}'`),'test@example.com');
console.log('PASS: V10 preserves documents, all contracts TEO, contacts POST/GET/SQL, email and length validation');
})().catch(e=>{console.error(e);process.exit(1)});
