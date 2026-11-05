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


const base='http://localhost:3032',failures=[];
async function check(label){await pause(200);const r=await evaljs("(()=>{const shown=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;return {page:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('table,.table-wrap,.order-container-scroll,.route-picker-scroll,.view-data-table,.cargo-table')].filter(shown).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,cls:e.className,w:e.clientWidth,sw:e.scrollWidth})),tables:[...document.querySelectorAll('table')].filter(shown).length}})()");if(r.page||r.wide.length)failures.push({label,...r});console.log(label,JSON.stringify(r));}
for(const width of [1920,1280,640,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 for(const page of ['receiving-orders','shipping-orders','comprehensive-service-orders','routes','waybills','containers','railway-carriages','transport-drivers','transport-vehicles','complex-services','service-orders','container-owners','billing-charges','payment-invoices']){
 await send('Page.navigate',{url:base+'/'+page});await wait("!!document.querySelector('.page-header')");await pause(200);await check(width+' '+page);
 }
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506'});await wait("!!document.getElementById('service-tab-receiving')");
 for(const tab of ['receiving','shipping','returns']){await evaljs("document.getElementById('service-tab-"+tab+"').click()");await check(width+' service '+tab)}
 await evaljs("document.querySelector('button[aria-label=\"Редактировать\"]').click()");for(const tab of ['receiving','shipping','returns']){await evaljs("document.getElementById('service-tab-"+tab+"').click()");await check(width+' service edit '+tab)}
}
fs.writeFileSync(path.join(dir,'responsive-table-failures.json'),JSON.stringify(failures,null,2));
await send('Browser.close').catch(()=>{});ws.close();assert.equal(failures.length,0,JSON.stringify(failures));console.log('PASS: responsive tables, no data saved');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
