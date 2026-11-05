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
async function check(label){await pause(130);const r=await evaljs(`(()=>{const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;return {page:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('.content table,.table-wrap,.form-workspace,.form-fields-grid,.pagination,.route-picker-dialog,.route-drawer')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({cls:e.className,w:e.clientWidth,sw:e.scrollWidth}))}})()`);assert.equal(r.page,false,label);assert.deepEqual(r.wide,[],label+JSON.stringify(r));}
async function open(route,width,expanded=false){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/'+route});await wait('document.querySelector(".content h1")');await pause(150);await evaljs(`(()=>{if(document.querySelector('.app-shell').dataset.menuExpanded!==String(${expanded}))document.querySelector('.menu-toggle').click()})()`);await pause(100);}
const registries=['receiving-orders','shipping-orders','comprehensive-service-orders','service-orders','routes','waybills','containers','railway-carriages','transport-carriers','transport-drivers','transport-vehicles','complex-services','container-owners','billing-charges','payment-invoices'];
for(const width of [1920,1440,1280]){
 for(const kind of ['receiving','shipping']){
  await open(kind+'-orders',width);await wait('document.querySelector(".transport-order-registry tbody .order-code")');await check(kind+' '+width);
  const geometry=await evaljs(`(()=>{const t=document.querySelector('.transport-order-registry');return {width:t.getBoundingClientRect().width,parent:t.parentElement.getBoundingClientRect().width,columns:[...t.querySelectorAll('th')].map(x=>x.getBoundingClientRect().width)}})()`);assert.ok(Math.abs(geometry.width-geometry.parent)<2);if(geometry.parent>=1180)assert.ok(geometry.columns[2]>geometry.columns[6]*2,'Client width should exceed route width');assert.ok(Math.abs(geometry.columns[0]-48)<1);console.log('PASS fluid columns',kind,width,geometry.columns.map(Math.round));
  if(kind==='receiving'&&width===1920)fs.writeFileSync(path.join(dir,'adaptive-final-wide.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
}
for(const [width,expanded] of [[1024,false],[768,true],[360,false],[320,false]]){
 for(const route of registries){await open(route,width,expanded);await check(width+' '+route);if(route==='receiving-orders'&&[1024,360].includes(width))fs.writeFileSync(path.join(dir,'adaptive-final-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 console.log('PASS all registries',width,expanded);
}
const routes=await(await fetch(base+'/api/routes')).json(),cards=['routes/'+routes[0].id];
for(const kind of ['carriers','drivers','vehicles']){const list=await(await fetch(base+'/api/transport-catalogs/'+kind)).json();if(list.length)cards.push('transport-'+kind+'/'+list[0].id)}
for(const [width,expanded]of [[1280,true],[360,false]]){
 for(const route of cards){await open(route,width,expanded);await check(route+' '+width);for(const label of await evaljs('[...document.querySelectorAll(".view-tabs button")].filter(x=>!x.disabled).map(x=>x.textContent)')){await evaljs(`[...document.querySelectorAll('.view-tabs button')].find(x=>x.textContent===${JSON.stringify(label)}).click()`);await check(route+' '+label+' '+width)}}
 console.log('PASS route and catalog cards',width);
}
await open('comprehensive-service-orders/079ea76e-2c83-4011-bf3b-650371d1986a',1280,true);await wait('document.getElementById("service-tab-receiving")');await evaljs('document.getElementById("service-tab-receiving").click();document.querySelector("button[aria-label=Редактировать]").click()');await wait('document.querySelector(".service-initial-metadata-table input[type=datetime-local]")');
await evaljs(`(()=>{const e=document.querySelector('.service-initial-metadata-table input[type=datetime-local]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2030-01-02T12:34');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
for(const width of [1920,1024,360]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await check('draft editing '+width);assert.equal(await evaljs('document.querySelector(".service-initial-metadata-table input[type=datetime-local]").value'),'2030-01-02T12:34');}
console.log('PASS unsaved input survives resize');
await open('comprehensive-service-orders/new',1280,true);await check('service creation with expanded navigation');
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
