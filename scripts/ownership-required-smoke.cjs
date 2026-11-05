const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:8089'; // Prepared test database only; never the live backend.
async function api(path, method='GET', body) { const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();return {status:r.status,data:t?JSON.parse(t):null}; }
(async()=>{
assert.equal((await api('/actuator/health')).status,200);
const clients=(await api('/api/references/clients')).data;
let client, rows;
for(const c of clients){const result=await api('/api/service-orders/containers/available?clientId='+c.id);assert.equal(result.status,200);if(result.data.items.length>=2){client=c;rows=result.data.items;break}}
assert.ok(client,'Need at least two available containers on the prepared test copy');
const count=async()=> (await api('/api/service-orders')).data.totalElements;
const before=await count();const payload={clientId:client.id,service:'CHANGE_OWNER',comment:'ownership-required-smoke'};
for(const ids of [undefined,null,[],[null]]) {const p={...payload};if(ids!==undefined)p.containerOwnerIds=ids;assert.equal((await api('/api/service-orders','POST',p)).status,400)}
assert.equal(await count(),before);
const invalid=await api('/api/service-orders','POST',{...payload,containerOwnerIds:[rows[0].containerOwnerId,'00000000-0000-0000-0000-000000000001']});assert.equal(invalid.status,404);assert.equal(await count(),before,'Invalid KTK must roll back the entire new order');
const own=await api('/api/service-orders','POST',{...payload,clientId:rows[0].clientId,containerOwnerIds:[rows[0].containerOwnerId]});assert.equal(own.status,409);assert.equal(await count(),before);
const results=await Promise.all([1,2].map(()=>api('/api/service-orders','POST',{...payload,containerOwnerIds:[rows[0].containerOwnerId]})));assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(await count(),before+1);
const created=results.find(r=>r.status===201).data;assert.equal(created.order.status,'DRAFT');assert.equal(created.containers.length,1);
assert.equal((await api('/api/service-orders/'+created.order.id+'/containers','PUT',[])).status,400);assert.equal((await api('/api/service-orders/'+created.order.id)).data.containers.length,1);
const list=(await api('/api/service-orders/containers/available?clientId='+client.id)).data;assert.ok(!list.items.some(r=>r.containerOwnerId===rows[0].containerOwnerId));
const done=await api('/api/service-orders/'+created.order.id+'/accept','POST');assert.equal(done.status,200);assert.equal(done.data.order.status,'DONE');assert.equal((await api('/api/service-orders/'+created.order.id+'/accept','POST')).status,409);
fs.writeFileSync('ownership-required-smoke-result.json',JSON.stringify({client,id:created.order.id,number:created.order.number,checks:12},null,2));console.log('PASS: empty selection rejected, atomic rollback, own-owner rejection, concurrent reservation, nonempty edits, DRAFT → DONE, repeated confirmation rejected');
})().catch(e=>{console.error(e);process.exitCode=1});
