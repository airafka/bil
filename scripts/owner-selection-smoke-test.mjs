import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
assert.equal(process.env.BASE_URL, 'http://localhost:8084', 'Use the isolated billing_owner_test database and port 8084')
const base=process.env.BASE_URL
const sql=q=>execFileSync('docker',['exec','billing-owner-db','psql','-U','billing','-d','billing_owner_test','-v','ON_ERROR_STOP=1','-At','-c',q],{encoding:'utf8'}).trim()
async function api(path,body,status=200,method='POST') {
 const response=await fetch(base+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const value=await response.json();assert.equal(response.status,status,path+': '+JSON.stringify(value));return value
}
const [clients,contracts,containers,cars,products,areas]=await Promise.all(['clients','contracts','containers','railway-carriages','etsng-codes','terminal-areas'].map(k=>api('/api/references/'+k)))
assert.ok(clients.length>=2)
const contract=contracts[0], container=containers.find(c=>c.type==='STANDARD_40'), payer='OWNER-'+crypto.randomUUID()
const counterpartiesBefore=sql('select count(*) from client_related_entity')
const body={departureStation:1001,destinationStation:2001,payer,products:[{etsngCodeId:products[0].id,weight:'1500'}],railwayCarriages:[{railwayCarriageId:cars[0].id,containers:[{containerId:container.id,grossWeight:'6000',netWeight:'1500',owner:clients[0].name}]}]}
const bill=await api('/api/waybills',body,201)
const groups=await api('/api/waybills/grouped/page',{filter:{payer}})
const row=groups.content[0].waybills[0].containers[0]
assert.equal(row.owner,clients[0].name)
assert.equal(row.ownerClientId??null,null,'matching text must never resolve to a client ID')
const service=await api('/api/comprehensive-service-orders',{clientId:contract.clientId,contractId:contract.id,waybillIds:[bill.id]},201)
const shipId=service.shippingOrders[0].id
let ship=await api('/api/shipping-orders/'+shipId)
assert.equal(ship.containers[0].ownerClientId??null,null,'derived shipping owner is selected separately')
await api('/api/shipping-orders/'+shipId+'/containers',{containers:[{containerId:container.id,ownerClientId:clients[1].id}]},200,'PATCH')
ship=await api('/api/shipping-orders/'+shipId)
assert.equal(ship.containers[0].ownerClientId,clients[1].id)
assert.equal(ship.containers[0].ownerClientName,clients[1].name)
const returned=await api('/api/shipping-orders/'+shipId+'/returns',{containerIds:[container.id]})
const receiving=await api('/api/receiving-orders/'+returned.id)
assert.equal(receiving.containers[0].ownerClientId,clients[1].id)
const manual=await api('/api/receiving-orders',{clientId:contract.clientId,contractId:contract.id,terminalAreaId:areas[0].id,transportType:'VEHICLE',containers:[{containerId:container.id,empty:true,ownerClientId:clients[0].id}]},201)
assert.equal((await api('/api/receiving-orders/'+manual.id)).containers[0].ownerClientId,clients[0].id)
assert.equal(sql('select count(*) from client_related_entity'),counterpartiesBefore,'owner selection must not create counterparties')
body.railwayCarriages[0].containers[0].owner='Неизвестный справочнику собственник'
const another=await api('/api/waybills',body,201)
assert.equal(sql(`select owner from waybill_container wc join waybill_railway_carriage rc on rc.id=wc.waybill_railway_carriage_id where rc.waybill_id='${another.id}'`),body.railwayCarriages[0].containers[0].owner)
body.railwayCarriages[0].containers[0].ownerClientId=clients[0].id
await api('/api/waybills',body,400)
assert.equal(sql("select count(*) from pg_constraint where conname in ('receiving_order_container_owner_container_id_fkey','shipping_order_container_owner_container_id_fkey') and confrelid='client'::regclass"),'2')
console.log('PASS: arbitrary string owner, no name matching, explicit client selection in shipping/receiving, return copies selected client, no counterparty creation, both FKs reference client')
