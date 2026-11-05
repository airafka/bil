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
const expected=(await(await fetch('http://localhost:8097/api/references/clients?limit=100')).json()).map(c=>c.name);
const goto=async path=>{await send('Page.navigate',{url:'http://localhost:3021'+path})};
const pencil=async()=>{await wait(`!!document.querySelector('button[aria-label="Редактировать"]')`);await evaljs(`document.querySelector('button[aria-label="Редактировать"]').click()`)};
async function check(label){
 const selector=`select[aria-label="${label}"]`;
 await wait(`document.querySelector(${JSON.stringify(selector)})?.options.length===7`);
 const data=await evaljs(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});return {options:[...s.options].filter(o=>!o.hidden).map(o=>o.textContent),style:s.className,placeholder:s.options[0].hidden,disabled:s.disabled}})()`);
 assert.deepEqual(data.options,expected);assert.ok(data.style.includes('ui-select'));assert.equal(data.placeholder,true);assert.equal(data.disabled,false);console.log('PASS: '+label+' — standard select, six client options, hidden blank option');
 return selector;
}
const select=async(selector,value)=>{await evaljs(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`)};
await goto('/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506');await pencil();
const sh=await check('Грузополучатель 28561');await select(sh,'ООО "Смартлог"');
await evaljs(`document.getElementById('service-tab-returns').click()`);
const re=await check('Грузоотправитель 28562');await select(re,'ПАО "ТрансКонтейнер"');
fs.writeFileSync(path.join(dir,'client-parties-service.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaljs(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Сохранить').click()`);await wait(`!!document.querySelector('button[aria-label="Редактировать"]')`);
const data=await(await fetch('http://localhost:8097/api/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506')).json();assert.equal(data.shippingOrders[0].consignee,'ООО "Смартлог"');assert.equal(data.returnOrders[0].consignor,'ПАО "ТрансКонтейнер"');
for(const [kind,id,label] of [['receiving','c163c44d-ccdf-4719-8c1f-e50d15e10c74','Грузоотправитель'],['shipping','7a2a3636-0b47-46d5-92ad-0471d6034c0f','Грузополучатель']]){
 await goto('/'+kind+'-orders/'+id);await pencil();await check(label);
 await goto('/'+kind+'-orders/new');await check(label);
}
console.log('PASS: all six dropdown locations and service batch save');
await send('Browser.close').catch(()=>{});ws.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});