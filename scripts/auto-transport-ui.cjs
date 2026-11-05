const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const dir=__dirname,profile=path.join(dir,'route-layout-test-profile-'+Date.now());fs.mkdirSync(profile);
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{}await pause(100)}assert.ok(port,'Headless browser startup');
const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(x=>x.type==='page');const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)}});
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
async function evaljs(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function wait(expression){for(let i=0;i<70;i++){if(await evaljs(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});



const base='http://localhost:3185';
const get=async p=>(await fetch(base+'/api'+p)).json();
const post=async(p,b)=>{const r=await fetch(base+'/api'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v};
const svc=(await get('/comprehensive-service-orders/available-services'))[0];
const client=(await get('/references/tariff-clients'))[0];const contract=(await get('/references/contracts?activeTariffsOnly=true')).find(c=>c.clientId===client.id);
const w=await post('/waybills/generate',{standard20:0,standard40:1});
const s=await post('/comprehensive-service-orders',{clientId:client.id,contractId:contract.id,complexServiceId:svc.id,defaultContainerOwnerId:client.id,waybillIds:[w.id]});
await send('Page.navigate',{url:base+'/comprehensive-service-orders/'+s.order.id});await wait("!!document.getElementById('service-tab-receiving')");
assert.equal(await evaljs("document.querySelectorAll('button[aria-label=\"Заполнить заявки и создать рейсы\"]').length"),0);
for(const tab of ['receiving','shipping','returns']) {
 await evaljs(`document.getElementById('service-tab-${tab}').click()`);
 await wait("!!document.querySelector('button[aria-label=\"Заполнить заявки и создать рейсы\"]:not(:disabled)')");
 assert.equal(await evaljs("document.querySelectorAll('button[aria-label=\"Заполнить заявки и создать рейсы\"]').length"),1);
 await evaljs("document.querySelector('button[aria-label=\"Заполнить заявки и создать рейсы\"]').click()");
 await wait(`!!document.querySelector('#service-panel-${tab} a[href^="/routes/"]')`);
 assert.equal(await evaljs(`document.querySelector('#service-panel-${tab}').textContent.includes('Не указаны')`),false);
 assert.equal(await evaljs(`document.querySelector('#service-panel-${tab}').textContent.includes('Не указан')`),false);
}
for(const width of [1440,640,360]) {
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(250);
 const result=await evaljs(`(()=>{const b=document.querySelector('button[aria-label="Заполнить заявки и создать рейсы"]'),r=b.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth+1,screen:innerWidth}})()`);
 assert.ok(result.width>=32&&result.height>=32&&result.right<=result.screen&&!result.overflow,JSON.stringify(result));
 if(width===1440)fs.writeFileSync(path.join(dir,'auto-transport-ui.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
}
console.log('PASS one icon button per section; actual clicks populate dates/parties and route links; layout1440/640/360');ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
