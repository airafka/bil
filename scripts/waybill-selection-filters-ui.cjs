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
const get=async path=>{const r=await fetch(base+path);assert.equal(r.status,200,path);return r.json()};
const options=await get('/api/waybills/available/options');
const all=await get('/api/waybills/available?size=100');
assert.equal(all.totalElements,all.content.length);
for(const filter of [...options,{departureStation:1001},{destinationStation:2001},{payer:'ФИТ'},{departureStation:999999},{payer:"' OR 1=1 --"}]){
 const expected=all.content.filter(row=>Object.entries(filter).every(([k,v])=>row[k]===v));
 const query=new URLSearchParams({...filter,size:'1'});
 const page=await get('/api/waybills/available?'+query);
 assert.equal(page.totalElements,expected.length);assert.equal(page.totalPages,expected.length);
 assert.deepEqual(page.content.map(x=>x.waybill.id),expected.slice(0,1).map(x=>x.waybill.id));
 if(expected.length>1){query.set('page','1');const second=await get('/api/waybills/available?'+query);assert.deepEqual(second.content.map(x=>x.waybill.id),expected.slice(1,2).map(x=>x.waybill.id));}
}
console.log('PASS server filters, counts, pagination, exact payer matching',options.length,'groups');
const client='71e91145-1513-4d24-b797-25e7f0fb6e8f',contract='3d7434ce-92ab-4114-9fd9-9d959950fb4c';
async function choose(selector,value){await evaljs(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(String(value))};s.dispatchEvent(new Event('change',{bubbles:true}))})()`)}
async function chooseField(label,value){await evaljs(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent.startsWith(${JSON.stringify(label)}));const s=l.querySelector('select');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`)}
async function next(){await evaljs('document.querySelector(".page-header .primary-button").click()');await pause(150)}
const dep='select[aria-label="Станция отправления"]',dst='select[aria-label="Станция назначения"]',payer='select[aria-label="Плательщик"]';
async function chooseFilters(group){await choose(dep,group.departureStation);await choose(dst,group.destinationStation);await choose(payer,group.payer)}
const group=options.find(x=>x.departureStation===1001&&x.destinationStation===2001&&x.payer==='ФИТ');assert.ok(group);
for(const service of [true,false]){
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+(service?'/comprehensive-service-orders/new':'/receiving-orders/new')});
 await wait('document.querySelector(".form-fields-column select")?.options.length>1');
 if(service){await choose('select[aria-label="Услуга"]','fd5f3328-4684-41ee-b098-d7c370c5b175');await pause(150)}
 await chooseField('Клиент:',client);
 await wait('Array.from(document.querySelectorAll("option")).some(o=>o.value==="'+contract+'")');
 await chooseField('Договор:',contract);
 await chooseField('Собственник КТК по умолчанию:',client);
 if(!service)await chooseField('Вид транспорта:','RAILWAY');
 await wait(`document.querySelector('${dep}')?.options.length>1`);
 assert.equal(await evaljs('document.querySelector(".page-header .primary-button").disabled'),true);
 assert.equal(await evaljs(`document.querySelector('${payer}').disabled`),true);
 await choose(dep,group.departureStation);
 assert.equal(await evaljs(`document.querySelector('${payer}').disabled`),true);
 await choose(dst,group.destinationStation);
 assert.deepEqual(await evaljs(`Array.from(document.querySelector('${payer}').options).map(o=>o.value).filter(Boolean)`),options.filter(x=>x.departureStation===group.departureStation&&x.destinationStation===group.destinationStation).map(x=>x.payer).sort((a,b)=>a.localeCompare(b,'ru')));
 await choose(payer,group.payer);
 assert.equal(await evaljs('document.querySelector(".page-header .primary-button").disabled'),false);
 for(const width of [1920,1440,1024,640,360]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await pause(100);
  assert.equal(await evaljs('document.documentElement.scrollWidth>innerWidth+1'),false,`layout ${service} ${width}`);
  if(width===1440||width===360)fs.writeFileSync(path.join(dir,`waybill-filter-${service?'service':'receiving'}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await next();if(!service)await next();
 await wait('document.querySelector(".waybill-selection-table tbody input")');
 const expected=all.content.filter(x=>x.departureStation===group.departureStation&&x.destinationStation===group.destinationStation&&x.payer===group.payer).map(x=>x.waybill.number);
 assert.deepEqual(await evaljs('[...document.querySelectorAll(".waybill-selection-table tbody tr")].map(r=>r.cells[1].textContent)'),expected);
 await evaljs('document.querySelector(".waybill-selection-table thead input").click()');
 assert.equal(await evaljs('[...document.querySelectorAll(".waybill-selection-table tbody input")].every(x=>x.checked)'),true);
 await evaljs('[...document.querySelectorAll(".step")].find(x=>x.textContent==="Основное").click()');
 await wait(`document.querySelector('${dep}')?.options.length>1`);
 assert.equal(await evaljs(`document.querySelector('${payer}').value`),'ФИТ');
 await choose(dst,'1001');
 assert.equal(await evaljs(`document.querySelector('${payer}').value`),'');
 assert.equal(await evaljs(`document.querySelector('${payer}').disabled`),true);
 assert.equal(await evaljs('document.querySelector(".page-header .primary-button").disabled'),true);
 await chooseFilters(group);await next();if(!service)await next();
 await wait('document.querySelector(".waybill-selection-table tbody input")');
 assert.equal(await evaljs('[...document.querySelectorAll(".waybill-selection-table tbody input")].every(x=>!x.checked)'),true);
 await evaljs('[...document.querySelectorAll(".step")].find(x=>x.textContent==="Основное").click()');
 await wait(`document.querySelector('${dep}')?.options.length>1`);
 await choose(payer,'ООО "Логопер"');await next();if(!service)await next();
 await wait('document.querySelector(".waybill-selection-table tbody input")');
 assert.equal(await evaljs('document.querySelectorAll(".waybill-selection-table tbody input").length'),1);
 assert.equal(await evaljs('document.querySelector(".waybill-selection-table tbody input").checked'),false);
 console.log('PASS',service?'service':'receiving','required fields, dependent payer, filtering, select all, reset, back navigation, 5 widths');
}
await send('Page.navigate',{url:base+'/shipping-orders/new'});await wait('document.querySelector(".form-fields-column select")?.options.length>1');
assert.equal(await evaljs(`Boolean(document.querySelector('${dep}'))`),false);
console.log('PASS shipping remains unchanged');
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
