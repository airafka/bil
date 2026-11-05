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

const base='http://localhost:3022';
const number='UI-HIERARCHY-'+Date.now();
const clickText=async(text,scope='document')=>{await evaljs(`[...${scope}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await pause(120)};
const set=async(selector,value)=>{await evaljs(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await pause(80)};
const choose=async(selector,index)=>{const value=await evaljs(`document.querySelector(${JSON.stringify(selector)}).options[${index}].value`);await set(selector,value);return value};
async function screenshot(label,width){await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:false});await pause(150);fs.writeFileSync(path.join(dir,`waybill-hierarchy-${label}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));const metrics=await evaljs(`({page:document.documentElement.scrollWidth,viewport:innerWidth,rows:[...document.querySelectorAll('.composition-item')].map(e=>Math.round(e.getBoundingClientRect().height)),controls:[...document.querySelectorAll('.waybill-draft-table .ui-control')].map(e=>Math.round(e.getBoundingClientRect().height))})`);assert.ok(metrics.page<=metrics.viewport+1,JSON.stringify(metrics));for(const h of metrics.controls)assert.equal(h,30);console.log(label,width,JSON.stringify(metrics));}
await send('Page.navigate',{url:base+'/waybills/create'});await wait(`document.querySelector('.waybill-main-grid select')?.options.length>1 && !document.querySelector('.header-actions .primary-button').disabled`);
await set('.waybill-main-grid input',number);
for(let i=1;i<=3;i++)await choose(`.waybill-main-grid label:nth-child(${i+1}) select`,1);
await evaljs(`document.querySelector('.header-actions .primary-button').click()`);await wait(`!!document.querySelector('.waybill-draft-wagons')`);
await clickText('+ Добавить вагон');await choose('select[aria-label="Номер вагона 1"]',1);
await clickText('+ Добавить вагон');await choose('select[aria-label="Номер вагона 2"]',2);
assert.equal(await evaljs(`document.querySelector('select[aria-label="Номер вагона 2"]').options[1].disabled`),true);
await screenshot('create-wagons',1440);
await evaljs(`document.querySelector('.header-actions .primary-button').click()`);await wait(`!!document.querySelector('.waybill-draft-containers')`);
await evaljs(`document.querySelectorAll('.composition-subgroup .secondary-button')[0].click()`);await pause(100);
await choose('select[aria-label="КТК 1 вагона 1"]',1);await set('input[aria-label="Масса брутто КТК 1 вагона 1"]','4200');await set('input[aria-label="Масса нетто КТК 1 вагона 1"]','900');await set('input[aria-label="Номера ЗПУ КТК 1 вагона 1"]','HIER-001');await choose('select[aria-label="Тип ЗПУ КТК 1 вагона 1"]',1);
await evaljs(`document.querySelectorAll('.composition-subgroup .secondary-button')[0].click()`);await pause(100);
await choose('select[aria-label="КТК 2 вагона 1"]',2);await set('input[aria-label="Масса брутто КТК 2 вагона 1"]','4200');
await evaljs(`document.querySelectorAll('.composition-subgroup .secondary-button')[1].click()`);await pause(100);
await choose('select[aria-label="КТК 1 вагона 2"]',3);await set('input[aria-label="Масса брутто КТК 1 вагона 2"]','4200');
await evaljs(`document.querySelector('.composition-subgroup button').click()`);await pause(100);assert.equal(await evaljs(`document.querySelector('input[aria-label="Масса нетто КТК 1 вагона 1"]')===null`),true);
await evaljs(`document.querySelector('.composition-subgroup button').click()`);await pause(100);assert.equal(await evaljs(`document.querySelector('input[aria-label="Масса нетто КТК 1 вагона 1"]').value`),'900');
for(const w of [1440,1024,640])await screenshot('create-containers',w);
await evaljs(`document.querySelector('.header-actions .primary-button').click()`);await wait(`!!document.querySelector('.waybill-draft-cargo')`);await choose('select[aria-label="Груз 1 по ЕТСНГ"]',1);await screenshot('create-cargo',1440);
assert.ok((await evaljs(`document.querySelector('.waybill-draft-cargo').textContent`)).includes('Неопасный груз'));
await clickText('КТК',"document.querySelector('.waybill-form > .stepper')");assert.equal(await evaljs(`document.querySelector('input[aria-label="Номера ЗПУ КТК 1 вагона 1"]').value`),'HIER-001');
await evaljs(`document.querySelector('.header-actions .primary-button').click()`);await pause(120);await evaljs(`document.querySelector('.header-actions .primary-button').click()`);await wait(`location.pathname==='/waybills' && !!document.querySelector('.expand-button')`);
const response=await(await fetch(base+'/api/waybills/grouped/page',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pageInfo:{page:0,size:20}})})).json();const gi=response.content.findIndex(g=>g.waybills.some(b=>b.number===number));assert.ok(gi>=0);const saved=response.content[gi].waybills.find(b=>b.number===number);assert.equal(saved.railwayCarriages.length,2);assert.equal(saved.containers.length,3);assert.equal(saved.containers.find(c=>c.sealNumbers==='HIER-001').netWeight,900);
await evaljs(`document.querySelectorAll('.expand-button')[${gi}].click()`);await wait(`!!document.querySelector('.waybill-hierarchy-view')`);
assert.equal(await evaljs(`!!document.querySelector('.waybill-chip-grid')`),false);
for(const w of [1440,1024,640])await screenshot('view-containers',w);
await clickText('Вагоны',"document.querySelector('.waybill-hierarchy-view')");await screenshot('view-wagons',1440);
await clickText('Груз',"document.querySelector('.waybill-hierarchy-view')");await screenshot('view-cargo',1440);
console.log('PASS: hierarchy collapse, duplicate prevention, field persistence, UI save to isolated DB, exact net/seal, all view tabs, responsive geometry; created '+number);
await send('Browser.close').catch(()=>{});ws.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
