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



const base='http://localhost:3001',failures=[],results=[];
const registry=['receiving-orders','shipping-orders','comprehensive-service-orders','service-orders','routes','waybills','containers','railway-carriages','transport-carriers','transport-drivers','transport-vehicles','complex-services','container-owners','billing-charges','payment-invoices'];
const forms=['receiving-orders/new','shipping-orders/new','comprehensive-service-orders/new','service-orders/new','routes/new','waybills/create','waybills/generate','complex-services/new','payment-invoices/new','transport-carriers/new','transport-drivers/new','transport-vehicles/new'];
const service=await(await fetch(base+'/api/comprehensive-service-orders/8069f730-ea6f-4033-9445-9a706607404e')).json();
const cards=['comprehensive-service-orders/'+service.order.id,'receiving-orders/'+service.receivingOrder.id,'shipping-orders/'+service.shippingOrders[0].id,'receiving-orders/'+service.returnOrders[0].id,'payment-invoices/8e870259-0d41-4229-9fcf-e6b5eab2c966','complex-services/626df5f3-e629-4eb0-9369-ea724120ac7c'];
async function check(label){await pause(90);const r=await evaljs(`(()=>{const shown=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;const c=document.querySelector('.content'),p=c?.firstElementChild;return {page:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('.content table,.table-wrap,.order-container-scroll,.route-picker-scroll,.form-fields-grid,.details-grid,.form-workspace,.view-tabs,.stepper,.pagination')].filter(shown).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({cls:e.className,w:e.clientWidth,sw:e.scrollWidth})),fill:p?Math.round(p.getBoundingClientRect().width/(c.clientWidth-parseFloat(getComputedStyle(c).paddingLeft)-parseFloat(getComputedStyle(c).paddingRight))*100):0}})()`);results.push({label,...r});if(r.page||r.wide.length){failures.push({label,...r});console.log('FAIL',label,JSON.stringify(r))}}
for(const [width,expanded] of [[1920,false],[1440,false],[1280,true],[768,true],[360,false],[320,false]]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 for(const route of [...registry,...forms,...cards]){
  await send('Page.navigate',{url:base+'/'+route});await wait('document.querySelector(".content h1")');await pause(150);
  await evaljs(`(()=>{const shell=document.querySelector('.app-shell');if(shell.dataset.menuExpanded!==String(${expanded}))document.querySelector('.menu-toggle').click()})()`);await pause(100);
  await check(width+' '+expanded+' '+route);
  if(registry.includes(route))assert.equal(results.at(-1).fill,100,'Registry should fill workspace: '+route);
  if((route==='receiving-orders'&&[1920,768,360].includes(width))||(route==='comprehensive-service-orders/new'&&width===1280))fs.writeFileSync(path.join(dir,'adaptive-'+width+'-'+route.replaceAll('/','-')+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(cards.includes(route)){
   const labels=await evaljs('[...document.querySelectorAll(".view-tabs button")].filter(x=>!x.disabled).map(x=>x.textContent)');
   for(const label of labels){await evaljs(`[...document.querySelectorAll('.view-tabs button')].find(x=>x.textContent===${JSON.stringify(label)})?.click()`);await pause(100);await check(width+' '+route+' '+label)}
  }
 }
 console.log('DONE width',width,'expanded',expanded);
}
fs.writeFileSync(path.join(dir,'responsive-audit-results.json'),JSON.stringify({failures,results},null,2));console.log('AUDIT',results.length,'checks;',failures.length,'failures');assert.equal(failures.length,0,JSON.stringify(failures));
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
