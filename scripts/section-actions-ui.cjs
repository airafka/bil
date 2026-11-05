const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const dir=__dirname,profile=path.join(dir,'route-layout-test-profile-'+Date.now());fs.mkdirSync(profile);
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
let port;for(let i=0;i<250;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{}await pause(100)}assert.ok(port,'Headless browser startup');
const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(x=>x.type==='page');const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)}});
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
async function evaljs(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function wait(expression){for(let i=0;i<70;i++){if(await evaljs(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});



const base='http://localhost:3186';
const get=async p=>(await fetch(base+'/api'+p)).json();
const post=async(p,b)=>{const r=await fetch(base+'/api'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v};
const svc=(await get('/comprehensive-service-orders/available-services'))[0];const client=(await get('/references/tariff-clients'))[0];const contract=(await get('/references/contracts?activeTariffsOnly=true')).find(c=>c.clientId===client.id);
const w=await post('/waybills/generate',{standard20:0,standard40:2});const s=await post('/comprehensive-service-orders',{clientId:client.id,contractId:contract.id,complexServiceId:svc.id,defaultContainerOwnerId:client.id,waybillIds:[w.id]});
const apiPath='/comprehensive-service-orders/'+s.order.id;
await send('Page.navigate',{url:base+apiPath});await wait("!!document.getElementById('service-tab-receiving')");
const positions=[];
for(const tab of ['receiving','shipping','returns']){
 await evaljs(`document.getElementById('service-tab-${tab}').click()`);
 await wait("!!document.querySelector('button[aria-label=\"Заполнить заявки и создать рейсы\"]:not(:disabled)')");
 await evaljs("document.querySelector('button[aria-label=\"Заполнить заявки и создать рейсы\"]').click()");
 await wait(`!!document.querySelector('#service-panel-${tab} a[href^="/routes/"]')`);
 await wait("!!document.querySelector('button[aria-label=\"Подтвердить все рейсы\"]:not(:disabled)')");
 positions.push(await evaljs(`(()=>{const r=document.querySelector('.service-section-actions').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`));
 await evaljs("document.querySelector('button[aria-label=\"Подтвердить все рейсы\"]').click()");
 await wait("!!document.querySelector('button[aria-label=\"Выполнить все заявки\"]:not(:disabled)')");
 const state=await get(apiPath),rows=tab==='receiving'?[state.receivingOrder]:tab==='shipping'?state.shippingOrders:state.returnOrders;
 assert.ok(rows.every(o=>o.status==='CONFIRMED'),JSON.stringify(rows));
 // The phase survives reopening; it is derived from server state, not a local click counter.
 await send('Page.navigate',{url:base+apiPath});await wait("!!document.getElementById('service-tab-receiving')");await evaljs(`document.getElementById('service-tab-${tab}').click()`);
 await wait("!!document.querySelector('button[aria-label=\"Выполнить все заявки\"]:not(:disabled)')");
 if(tab==='returns')fs.writeFileSync(path.join(dir,'section-actions-ui.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaljs("document.querySelector('button[aria-label=\"Выполнить все заявки\"]').click()");
 await wait(`document.querySelector('#service-panel-${tab}').textContent.includes('Выполнено') && !!document.querySelector('button[aria-label="Выполнить все заявки"]:disabled')`);
 const final=await get(apiPath),done=tab==='receiving'?[final.receivingOrder]:tab==='shipping'?final.shippingOrders:final.returnOrders;assert.ok(done.every(o=>o.status==='COMPLETED'));
}
assert.deepEqual(positions[1],positions[0]);assert.deepEqual(positions[2],positions[0]);assert.equal((await get(apiPath)).order.status,'COMPLETED');
for(const width of [640,360]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(250);assert.equal(await evaljs('document.documentElement.scrollWidth>innerWidth+1'),false)}
console.log('PASS one lifecycle button, first click only confirms, second completes, phase persists on reload, three sections, fixed toolbar position, narrow layout');ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
