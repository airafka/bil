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



const base='http://localhost:3032';const service=await(await fetch(base+'/api/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506')).json();
async function check(label){await pause(300);const wide=await evaljs("[...document.querySelectorAll('table,.table-wrap,.order-container-scroll,.route-picker-scroll')].filter(e=>e.getBoundingClientRect().width>0&&e.scrollWidth>e.clientWidth+2).map(e=>({class:e.className,w:e.clientWidth,sw:e.scrollWidth}))");assert.equal(wide.length,0,label+JSON.stringify(wide));}
for(const width of [1920,1280,640,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 for(const [kind,id]of [['receiving',service.receivingOrder.id],['shipping',service.shippingOrders[0].id]]){
 await send('Page.navigate',{url:base+'/'+kind+'-orders/'+id});await wait("!!document.querySelector('.view-tabs button')");const tabs=await evaljs("document.querySelectorAll('.view-tabs button').length");for(let i=0;i<tabs;i++){await evaljs('document.querySelectorAll(".view-tabs button")['+i+'].click()');await check(width+' '+kind+' tab'+i)}
 }
 await send('Page.navigate',{url:base+'/waybills/new'});await wait("!!document.querySelector('h1')");const buttons=await evaljs("[...document.querySelectorAll('.stepper button')].map(e=>e.textContent)");for(const name of buttons){await evaljs('[...document.querySelectorAll(".stepper button")].find(e=>e.textContent==='+JSON.stringify(name)+').click()');await check(width+' waybill create '+name)}
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506'});await wait("!!document.querySelector('.service-progress')");await pause(200);
 const widths=await evaljs("(()=>{const p=document.querySelector('.service-progress'),first=p.firstElementChild;return {parent:p.clientWidth,card:first.getBoundingClientRect().width}})()");assert.ok(Math.abs(widths.card-(width>1100?(widths.parent-12)/2:widths.parent))<2);
 await evaljs("document.querySelector('.service-progress > section:nth-child(2)')?.remove()");await pause(100);assert.equal(await evaljs("document.querySelector('.service-progress > section').getBoundingClientRect().width"),widths.card);
 await evaljs("document.getElementById('service-tab-receiving').click()");await check(width+' initial');const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'responsive-service-'+width+'.png'),Buffer.from(shot.data,'base64'));
 await evaljs("document.querySelector('button[aria-label=\"Редактировать\"]').click()");await wait("!!document.querySelector('#service-panel-receiving input[type=\"datetime-local\"]')");await evaljs("(()=>{const e=document.querySelector('#service-panel-receiving input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2032-05-06T12:30');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()");await check(width+' initial edit');assert.equal(await evaljs("document.querySelector('#service-panel-receiving input').value"),'2032-05-06T12:30');console.log(width+' details, half-card and edit state PASS');
}
await send('Browser.close').catch(()=>{});ws.close();console.log('PASS: no data saved');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
