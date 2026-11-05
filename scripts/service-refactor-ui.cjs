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
async function wait(expression){for(let i=0;i<70;i++){if(await evaljs('Boolean('+expression+')'))return;await pause(100)}throw Error('Timeout: '+expression)}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});



const base='http://localhost:3001';
const catalogs=await(await fetch(base+'/api/complex-services')).json();assert.equal(catalogs.length,2);assert.ok(catalogs.every(s=>!s.name.includes('прибывшего автотранспортом')));
const id='a778e704-61fe-4694-b158-f90f195f3dcc';
const detail=await(await fetch(base+'/api/comprehensive-service-orders/'+id)).json();
const errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
for(const width of [1440,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/'+id});
 await wait('document.querySelector(".service-selected-detail dd")');
 assert.equal(await evaljs('document.querySelector(".service-selected-detail dd").textContent'),detail.progress.serviceName);
 assert.equal(await evaljs('document.querySelectorAll(".service-progress section").length'),1);
 for(const tab of ['receiving','shipping','returns','charges']){
  await evaljs(`document.getElementById('service-tab-${tab}').click()`);await pause(150);
  if(tab==='charges')await wait('document.querySelector(".service-charge-totals")');
  assert.equal(await evaljs('document.documentElement.scrollWidth>innerWidth+1'),false);
  assert.equal(await evaljs('document.body.textContent.includes("Создать возвратные заявки")'),false);
 }
 console.log('PASS live tabs',width,'single service, 3 stages, charges, no manual return controls');
}
await send('Page.navigate',{url:base+'/shipping-orders/'+detail.shippingOrders[0].id});
await wait('document.querySelector(".view-page h1")');await pause(350);
assert.equal(await evaljs('document.body.textContent.includes("Возврат в сток собственника")'),false);
assert.deepEqual(errors,[]);console.log('PASS live catalog and shipping card; no JavaScript exceptions');
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
