const fs=require('fs'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
const f=JSON.parse(fs.readFileSync('manual-return-results.json','utf8')),base='http://localhost:8191/api';
assert.match(f.db,/^billing_next_manual_return_\d{8}_\d{6}$/);
async function api(p,method='GET',body,status=200){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,p+JSON.stringify(data));return data}
(async()=>{
 const parent=await api('/comprehensive-service-orders/'+f.root),foreign=await api('/comprehensive-service-orders/'+f.foreign.serviceOrderId),same=await api('/comprehensive-service-orders/'+f.sameCustomer.serviceOrderId);
 for(const service of [parent,foreign,same]){
  const charges=await api('/billing-charges?comprehensiveServiceOrderId='+service.order.id+'&size=100');
  assert.equal(charges.totalWithoutVat,service.totalWithoutVat);assert.equal(charges.totalWithVat,service.totalWithVat);
  const period=charges.items[0].performedAt.slice(0,7);
  const candidates=await api('/payment-invoices/available-charges?'+new URLSearchParams({clientId:service.order.clientId,contractId:service.order.contractId,period}));
  const chosen=candidates.items.filter(c=>c.comprehensiveServiceOrderId===service.order.id);assert.equal(chosen.length,charges.total);
  const invoice=await api('/payment-invoices','POST',{clientId:service.order.clientId,contractId:service.order.contractId,period,chargeIds:chosen.map(c=>c.id),requestKey:randomUUID()},201);
  assert.equal(invoice.invoice.amountWithVat,service.totalWithVat);assert.equal(invoice.items.length,chosen.length);
 }
 const draft=await api('/comprehensive-service-orders/'+f.ui);
 const shipping=draft.shippingOrders.find(s=>s.id!==f.uiShipping);
 const detail=await api('/shipping-orders/'+shipping.id);
 const ret=await api('/shipping-orders/'+shipping.id+'/returns','POST',{containerIds:detail.containers.map(c=>c.containerId),useCurrentClient:false,clientId:f.other.client_id,contractId:f.other.id},201);
 const error=await api('/comprehensive-service-orders/'+f.ui+'/transport-metadata','PATCH',{orders:[{id:ret.receivingOrderId,kind:'RETURN_RECEIVING',plannedAt:'2026-11-06T12:00:00',partyName:foreign.order.clientName,originalPlannedAt:null,originalPartyName:null}]},409);
 assert.equal(error.code,'SERVICE_ORDER_NOT_AVAILABLE');
 await api('/comprehensive-service-orders/'+ret.serviceOrderId+'/transport-metadata','PATCH',{orders:[{id:ret.receivingOrderId,kind:'RETURN_RECEIVING',plannedAt:'2026-11-06T12:00:00',partyName:foreign.order.clientName,originalPlannedAt:null,originalPartyName:null}]});
 f.draftAuto=ret;fs.writeFileSync('manual-return-results.json',JSON.stringify(f,null,2));
 console.log('PASS invoices and totals for each customer/contract; foreign returns cannot be edited through original service; own auto-return metadata saves');
})().catch(e=>{console.error(e);process.exitCode=1});
