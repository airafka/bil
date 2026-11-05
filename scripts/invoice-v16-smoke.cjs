const assert=require('node:assert/strict');const fs=require('fs');
const base='http://127.0.0.1:8090';
async function api(path,method='GET',body,status=200){const r=await fetch(base+'/api/payment-invoices'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();assert.equal(r.status,status,`${method} ${path}: ${raw}`);return raw?JSON.parse(raw):null}
(async()=>{
const list=await api('');const initial=await api('/'+list.items[0].id);const id=initial.invoice.id;const filters={clientId:initial.invoice.clientId,contractId:initial.invoice.contractId,period:initial.invoice.period};const qs=new URLSearchParams(filters);const original=initial.items[0].id;
const candidates=(await api('/'+id+'/available-charges?'+qs)).items;assert(candidates.some(x=>x.id===original));const extra=candidates.find(x=>x.id!==original).id;
let updated=await api('/'+id,'PUT',{...filters,chargeIds:[original,extra],version:0});assert.equal(updated.invoice.code,initial.invoice.code);assert.equal(updated.items.length,2);assert.equal(updated.invoice.version,1);assert.deepEqual(updated.items.find(x=>x.id===original),initial.items[0]);
await api('/'+id,'PUT',{...filters,chargeIds:[original],version:0},409);await api('/'+id+'/paid','POST',{version:0},409);
await api('/'+id,'PUT',{...filters,chargeIds:[],version:1},400);
await api('/'+id,'PUT',{...filters,chargeIds:[original,original],version:1},400);
await api('/'+id,'PUT',{...filters,period:'2025-01',chargeIds:[original],version:1},409);
assert.equal((await api('/'+id)).invoice.version,1);
updated=await api('/'+id,'PUT',{...filters,chargeIds:[original],version:1});assert.equal(updated.items.length,1);
const ownCandidates=(await api('/'+id+'/available-charges?'+qs)).items;assert(ownCandidates.some(x=>x.id===extra));
const other=await api('','POST',{...filters,chargeIds:[extra],requestKey:crypto.randomUUID()},201);
await api('/'+id,'PUT',{...filters,chargeIds:[original,extra],version:2},409);
assert.equal((await api('/'+id)).invoice.version,2);
const race=await Promise.all([fetch(base+'/api/payment-invoices/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...filters,chargeIds:[original],version:2})}),fetch(base+'/api/payment-invoices/'+id+'/paid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:2})})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
let current=await api('/'+id);if(current.invoice.status==='DRAFT')current=await api('/'+id+'/paid','POST',{version:current.invoice.version});assert.equal(current.invoice.status,'PAID');assert(current.invoice.paidAt);
const repeat=await api('/'+id+'/paid','POST',{version:current.invoice.version});assert.equal(repeat.invoice.version,current.invoice.version);
await api('/'+id,'PUT',{...filters,chargeIds:[original],version:current.invoice.version},409);await api('/'+id,'DELETE',undefined,409);
await api('/'+id+'/available-charges?'+qs,'GET',undefined,409);
await api('/'+other.invoice.id,'DELETE',undefined,204);assert((await api('/available-charges?'+qs)).items.some(x=>x.id===extra));
const ui=await api('','POST',{...filters,chargeIds:[extra],requestKey:crypto.randomUUID()},201);
fs.writeFileSync('invoice-v16-fixture.json',JSON.stringify({paidId:id,draftId:ui.invoice.id,filters},null,2));
console.log('PASS: editing, stable code/snapshots, totals, stale version, empty/duplicate/out-of-period, reservation conflict, edit/pay race, paid lock, idempotent payment, delete/release; UI draft '+ui.invoice.id);
})().catch(e=>{console.error(e);process.exit(1)});
