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
const service='2480ed6b-ea1d-49ac-83c4-9108b03a1506';
await send('Page.navigate',{url:'http://localhost:3020/comprehensive-service-orders/'+service});
await wait('!!document.querySelector("button[aria-label=\\"Редактировать\\"]")');
const click=text=>evaljs(`[...document.querySelectorAll('button')].find(x=>x.textContent===${JSON.stringify(text)}).click()`);
const tab=id=>evaljs(`document.getElementById('service-tab-${id}').click()`);
const field=(label,value)=>evaljs(`(()=>{const e=document.querySelector('input[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
await tab('shipping');
const widths=await evaljs("[...document.querySelectorAll('#service-panel-shipping thead th')].map(x=>x.getBoundingClientRect().width)");
await evaljs('document.querySelector("button[aria-label=\\"Редактировать\\"]").click()');
await wait('!!document.querySelector("input[aria-label=\\"Грузополучатель 28561\\"]")');
assert.deepEqual(await evaljs("[...document.querySelectorAll('#service-panel-shipping thead th')].map(x=>x.getBoundingClientRect().width)"),widths);
await field('Дата и время вывоза 28561','2026-11-07T10:15');await field('Грузополучатель 28561','Получатель UI');
await tab('returns');await field('Дата и время поставки 28562','2026-11-08T11:45');await field('Грузоотправитель 28562','Отправитель UI');
await tab('shipping');assert.equal(await evaljs('document.querySelector("input[aria-label=\\"Грузополучатель 28561\\"]").value'),'Получатель UI');
for(const width of [1440,1024,640]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await pause(100);
 const m=await evaljs(`(()=>{const t=document.querySelector('#service-panel-shipping table'),w=t.parentElement;return {row:t.querySelector('tbody tr').getBoundingClientRect().height,inputs:[...t.querySelectorAll('input')].map(e=>e.getBoundingClientRect().height),scroll:getComputedStyle(w).overflowX,page:document.documentElement.scrollWidth,viewport:innerWidth}})()`);
 assert.equal(m.row,36);assert.ok(m.inputs.every(h=>h===30));assert.ok(['auto','scroll'].includes(m.scroll));assert.ok(m.page<=m.viewport+1,JSON.stringify(m));console.log('PASS: '+width+'px table geometry, 36px rows, 30px controls, inner scrolling');
}
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
fs.writeFileSync(path.join(dir,'service-metadata-edit.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await click('Отмена');await wait('!document.querySelector("input[aria-label=\\"Грузополучатель 28561\\"]")');
assert.ok(!(await evaljs('document.querySelector("#service-panel-shipping").textContent')).includes('Получатель UI'));
await evaljs('document.querySelector("button[aria-label=\\"Редактировать\\"]").click()');await wait('!!document.querySelector("input[aria-label=\\"Грузополучатель 28561\\"]")');
await field('Дата и время вывоза 28561','2026-11-07T10:15');await field('Грузополучатель 28561','Получатель UI');
await tab('returns');await field('Дата и время поставки 28562','2026-11-08T11:45');await field('Грузоотправитель 28562','Отправитель UI');
await click('Сохранить');await wait('!!document.querySelector("button[aria-label=\\"Редактировать\\"]")');
const data=await(await fetch('http://localhost:8096/api/comprehensive-service-orders/'+service)).json();
assert.equal(data.shippingOrders[0].consignee,'Получатель UI');assert.equal(data.shippingOrders[0].plannedAt,'2026-11-07T10:15:00');assert.equal(data.returnOrders[0].consignor,'Отправитель UI');assert.equal(data.returnOrders[0].plannedAt,'2026-11-08T11:45:00');
await send('Page.reload');await wait('!!document.querySelector("button[aria-label=\\"Редактировать\\"]")');await tab('returns');assert.ok((await evaljs('document.querySelector("#service-panel-returns").textContent')).includes('Отправитель UI'));
console.log('PASS: pencil, tab draft persistence, cancel, save both tabs and browser reload');
await send('Browser.close').catch(()=>{});ws.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});