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
const f=JSON.parse(fs.readFileSync(path.join(dir,'bulk-return-results.json'),'utf8'));
const get=async p=>{const r=await fetch(base+'/api'+p);assert.equal(r.status,200);return r.json()};
let posts=0;await send('Network.enable');ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='POST'&&m.params.request.url.endsWith('/returns'))posts++});
const page='/comprehensive-service-orders/'+f.ui;
async function clickButton(text){await evaljs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await pause(100)}
async function choose(label,value){await evaljs(`(()=>{const s=document.querySelector('select[aria-label="${label}"]');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(100)}
for(const width of [360,640,1024,1440,1920]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+page});await wait('document.querySelector("#service-tab-shipping")');
 await evaljs('document.querySelector("#service-tab-shipping").click()');
 await wait('document.querySelector("#service-panel-shipping tbody tr")');
 assert.equal(await evaljs('document.documentElement.scrollWidth>innerWidth+1'),false);
 await clickButton('Создать возврат');await wait('document.querySelector("dialog[open]")');
 assert.equal(await evaljs('document.querySelectorAll(".return-container-table tbody tr").length'),6);
 assert.equal(await evaljs('document.querySelector("dialog button[type=submit]").disabled'),true);
 await evaljs('document.querySelector(".return-container-table thead input").click()');
 assert.equal(await evaljs('document.querySelectorAll(".return-container-table tbody input:checked").length'),6);
 await evaljs('document.querySelector(".return-container-table tbody input").click()');
 assert.equal(await evaljs('document.querySelector(".return-container-table thead input").indeterminate'),true);
 const fit=await evaljs(`(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,overflow:d.scrollWidth>d.clientWidth+1}})()`);
 assert.ok(fit.left>=0&&fit.right<=width+1&&!fit.overflow,JSON.stringify({width,fit}));
 if(width===360||width===1440)fs.writeFileSync(path.join(dir,'bulk-return-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaljs(`document.querySelector('[aria-label="Закрыть форму возврата"]').click()`);await wait('!document.querySelector("dialog")');
 console.log('PASS bulk toolbar, selection, indeterminate state and layout',width);
}
assert.equal(posts,0);
await clickButton('Создать возврат');await wait('document.querySelector("dialog[open]")');
await evaljs('Array.from(document.querySelectorAll(".return-container-table tbody input")).slice(0,3).forEach(e=>e.click())');
await evaljs('(()=>{const checkbox=document.querySelector(".return-current-client input");if(checkbox.checked)checkbox.click()})()');
await wait(`document.querySelector('select[aria-label="Клиент возврата"]')?.options.length>1`);
await choose('Клиент возврата',f.other.client_id);await choose('Договор возврата',f.other.contract_id);
await evaljs('(()=>{const form=document.querySelector("dialog form");form.requestSubmit();form.requestSubmit()})()');
await wait('!document.querySelector("dialog")');await wait('document.body.textContent.includes("Созданы возвратные заявки: 3")');
assert.equal(posts,1);
const parent=await get(page);assert.equal(parent.returnOrders.length,3);assert.ok(parent.returnOrders.every(r=>r.containerIds.length===1));
const child=parent.returnOrders[0].comprehensiveServiceOrderId;assert.ok(parent.returnOrders.every(r=>r.comprehensiveServiceOrderId===child));assert.notEqual(child,f.ui);
await clickButton('Показать возвраты');await wait('document.querySelector("#service-panel-returns:not([hidden])")');assert.equal(await evaljs('document.querySelectorAll("#service-panel-returns tbody tr").length'),3);
await evaljs('document.querySelector("#service-tab-shipping").click()');await clickButton('Создать возврат');await wait('document.querySelector("dialog[open]")');
assert.equal(await evaljs('document.querySelectorAll(".return-container-table tbody tr").length'),3);
await evaljs(`document.querySelector('[aria-label="Закрыть форму возврата"]').click()`);
await send('Page.navigate',{url:base+'/comprehensive-service-orders/'+child});await wait('document.querySelector("#service-tab-returns")');
assert.equal(await evaljs('document.querySelectorAll("[role=tab]").length'),3);
await evaljs('document.querySelector("#service-tab-returns").click()');await wait('document.querySelectorAll("#service-panel-returns tbody tr").length===3');
console.log('PASS three selected KTK -> three returns in one auto service; one POST on double submit; parent refresh and remaining options');
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
