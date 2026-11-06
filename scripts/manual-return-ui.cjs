const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const dir=process.cwd(),profile=path.join(dir,'route-layout-test-profile-'+Date.now());fs.mkdirSync(profile);
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



const base='http://localhost:3191';
const fixtures=JSON.parse(fs.readFileSync(path.join(dir,'manual-return-results.json'),'utf8'));
const initial=await(await fetch(base+'/api/shipping-orders/'+fixtures.uiShipping)).json();
assert.equal(initial.returnOrders.length,0,'UI fixture must be a fresh test shipment');
let posts=0;
await send('Network.enable');
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='POST'&&m.params.request.url.endsWith('/returns'))posts++});
async function navigate(url){await send('Page.navigate',{url:base+url});await wait('document.querySelector("h1")&&!document.querySelector(".view-loading")&&!document.querySelector(".service-loading")');await pause(200)}
async function button(text,within='document'){await evaljs(`[...${within}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await pause(100)}
async function choose(label,value){await evaljs(`(()=>{const s=document.querySelector('select[aria-label="${label}"]');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(100)}
for(const width of [360,640,1024,1440,1920]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:false});
 await navigate('/shipping-orders/'+fixtures.uiShipping);
 await button('Создать возврат');await wait('document.querySelector("dialog[open]")');
 assert.equal(await evaljs('document.querySelector(".return-current-client input").checked'),false);
 assert.equal(await evaljs('document.querySelector(".return-container-table tbody input").checked'),true);
 const fit=await evaljs(`(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,overflow:d.scrollWidth>d.clientWidth+1,bodyOverflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
 assert.ok(fit.left>=0&&fit.right<=width+1&&!fit.overflow&&!fit.bodyOverflow,JSON.stringify({width,fit}));
 await evaljs('document.querySelector(".return-container-table tbody input").click()');
 assert.equal(await evaljs('document.querySelector("dialog button[type=submit]").disabled'),true);
 await evaljs('document.querySelector(".return-container-table tbody input").click()');
 await evaljs('(()=>{const checkbox=document.querySelector(".return-current-client input");if(checkbox.checked)checkbox.click()})()');
 await wait(`document.querySelector('select[aria-label="Клиент возврата"]')?.options.length>1`);
 await choose('Клиент возврата',fixtures.other.client_id);await choose('Договор возврата',fixtures.other.id);
 assert.equal(await evaljs('document.querySelector("dialog button[type=submit]").disabled'),false);
 if(width===1440||width===360)fs.writeFileSync(path.join(dir,'manual-return-form-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaljs(`document.querySelector('[aria-label="Закрыть форму возврата"]').click()`);
 await wait('!document.querySelector("dialog")');
 console.log('PASS return form sizing, checkbox and contract choices',width);
}
assert.equal(posts,0);
// Explicitly choose the source customer, then submit twice: only one mutation.
await button('Создать возврат');await wait('document.querySelector("dialog[open]")');
await evaljs('document.querySelector(".return-current-client input").click()');
await evaljs('(()=>{const f=document.querySelector("dialog form");f.requestSubmit();f.requestSubmit()})()');
await wait('!document.querySelector("dialog")');await wait('!Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Создать возврат")');
assert.equal(posts,1);
assert.equal((await(await fetch(base+'/api/shipping-orders/'+fixtures.uiShipping)).json()).returnOrders.length,1);
for(const id of [fixtures.root,fixtures.foreign.serviceOrderId]){
 const auto=id===fixtures.foreign.serviceOrderId;
 for(const width of [360,1024,1920]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:false});
  await navigate('/comprehensive-service-orders/'+id);
  const tabs=await evaljs('Array.from(document.querySelectorAll("[role=tab]")).map(e=>e.textContent.trim())');
  assert.equal(tabs.length,auto?3:5);
  assert.equal(await evaljs('document.querySelectorAll(".service-progress section").length'),auto?1:3);
  await button('Заявки на поставку - Авто');
  await wait('document.querySelector("#service-panel-returns tbody tr")');
  assert.equal(await evaljs('document.documentElement.scrollWidth>innerWidth+1'),false);
  const linked=await evaljs('document.querySelector("#service-panel-returns").textContent');
  assert.ok(linked.includes('Мангуст')||linked.includes('Опт-Логистика'));
  if(width===1920)fs.writeFileSync(path.join(dir,'manual-return-'+(auto?'auto':'rail')+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
}
console.log('PASS single submit, links, separate service tabs, parent return lists and responsive layouts');
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
