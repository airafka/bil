// Prepared test copy only; never point this at the working database.
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const d='C:/Users/Green-0482/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',db='billing_client_parties_check',base='http://127.0.0.1:8097/api';
const id='2480ed6b-ea1d-49ac-83c4-9108b03a1506',path='/comprehensive-service-orders/'+id;
function sql(s){return execFileSync(d,['exec','billing-db-1','psql','-U','billing','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim()}
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
(async()=>{
assert.equal(sql('select current_database()'),db);
const clients=(await api('/references/clients?limit=100')).data;assert.equal(clients.length,6);
assert.equal(sql('select count(*) from receiving_order o where not exists(select 1 from client c where c.name=o.consignor)'),'0');
assert.equal(sql('select count(*) from shipping_order o left join client_related_entity p on p.id=o.consignee_id where not exists(select 1 from client c where c.name=p.name)'),'0');
assert.equal((await api('/transport-catalogs/carriers')).data.length,12);
let card=(await api(path)).data;
function batch(name){return [
 ...card.shippingOrders.map(o=>({id:o.id,kind:'SHIPPING',plannedAt:o.plannedAt||null,originalPlannedAt:o.plannedAt||null,originalPartyName:o.consignee||null,partyName:name})),
 ...card.returnOrders.map(o=>({id:o.id,kind:'RETURN_RECEIVING',plannedAt:o.plannedAt||null,originalPlannedAt:o.plannedAt||null,originalPartyName:o.consignor||null,partyName:name}))]}
let r=await api(path+'/transport-metadata','PATCH',{orders:batch('ООО "Смартлог"')});assert.equal(r.status,200,JSON.stringify(r.data));card=r.data;
assert.equal(card.shippingOrders[0].consignee,'ООО "Смартлог"');assert.equal(card.returnOrders[0].consignor,'ООО "Смартлог"');
let items=batch('ПАО "ТрансКонтейнер"');items[1].partyName='случайный текст';r=await api(path+'/transport-metadata','PATCH',{orders:items});assert.equal(r.status,400);assert.equal(r.data.code,'CARGO_PARTY_CLIENT_NOT_FOUND');assert.deepEqual((await api(path)).data,card);
assert.equal(sql("select count(*) from client_related_entity where name='случайный текст'"),'0');
console.log('PASS: client options, all 15 existing cargo parties valid, atomic batch validation, carriers unchanged');
for(const [kind,o,partyField,dateField] of [['shipping',card.shippingOrders[0],'consignee','departureAt'],['receiving',card.returnOrders[0],'consignor','arrivalAt']]){
 const p='/'+kind+'-orders/'+o.id,old=(await api(p)).data;
 r=await api(p+'/containers','PATCH',{containers:[],metadata:{plannedAt:old[dateField]||null,[partyField]:'ПАО "СИБУР Холдинг"'}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data[partyField],'ПАО "СИБУР Холдинг"');
 r=await api(p+'/containers','PATCH',{containers:[],metadata:{plannedAt:old[dateField]||null,[partyField]:'несуществующий клиент'}});assert.equal(r.status,400);assert.equal((await api(p)).data[partyField],'ПАО "СИБУР Холдинг"');
}
assert.equal((await api('/transport-catalogs/carriers')).data.length,12);assert.equal((await api('/references/clients')).data.length,6);
console.log('PASS: both individual card endpoints accept directory clients and reject arbitrary text');
})().catch(e=>{console.error(e);process.exit(1)});
