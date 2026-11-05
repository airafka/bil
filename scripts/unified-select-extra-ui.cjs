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



const base='http://localhost:3190';
const data=JSON.parse(fs.readFileSync(path.join(dir,'train-service-test-data.json'),'utf8'));
async function key(key,code=key){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:({Escape:27,Enter:13,Tab:9,ArrowDown:40,ArrowUp:38,Home:36,End:35})[key]});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:({Escape:27,Enter:13,Tab:9,ArrowDown:40,ArrowUp:38,Home:36,End:35})[key]});}
async function click(selector){await evaljs(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);const r=await evaljs(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...r,button:'left',clickCount:1});}
async function open(selector){await click(selector);await wait(`document.querySelector(${JSON.stringify(selector)}).matches(':open')`);}
async function choose(selector,value){await open(selector);await click(selector+' option[value="'+value+'"]');await wait(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}&&!document.querySelector(${JSON.stringify(selector)}).matches(':open')`);}
const service='select[aria-label="Услуга"]';
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:base+'/payment-invoices/new'});await wait('document.querySelector("select:not(:disabled)")');
await choose('.invoice-filters label:nth-child(1) select',data.tariff.client_id);await choose('.invoice-filters label:nth-child(2) select',data.tariff.contract_id);await wait('document.querySelector(".ui-multi-trigger:not(:disabled)")');
await click('.ui-multi-trigger');await wait('document.querySelector(".ui-multi-option input")');await click('.ui-multi-option input');
assert.equal(await evaljs("getComputedStyle(document.querySelector('.ui-multi-option[data-selected=true]')).backgroundColor"),'rgb(237, 244, 255)');assert.equal(await evaljs("getComputedStyle(document.querySelector('.ui-multi-options')).borderRadius"),'8px');await key('Escape');console.log('PASS multiple selection styling');
await send('Page.navigate',{url:base+'/railway-carriages'});await wait('document.querySelector(".row-actions-button")');await click('.row-actions-button');await wait('document.querySelector(".row-actions-menu:popover-open")');
assert.equal(await evaljs("getComputedStyle(document.querySelector('.row-actions-menu:popover-open')).borderRadius"),'8px');
const menuRect=await evaljs("(()=>{const r=document.querySelector('.row-actions-menu:popover-open [role=menuitem]').getBoundingClientRect();return {x:r.x+20,y:r.y+15}})()");await send('Input.dispatchMouseEvent',{type:'mouseMoved',...menuRect});
assert.equal(await evaljs("getComputedStyle(document.querySelector('.row-actions-menu:popover-open [role=menuitem]')).backgroundColor"),'rgb(237, 244, 255)');
await click('.row-actions-menu:popover-open [role=menuitem]');await wait('document.querySelector("td select")');await open('td select');
assert.equal(await evaljs("getComputedStyle(document.querySelector('select:open'),'::picker(select)').borderRadius"),'8px');await key('Escape');console.log('PASS table menu and table select');
await send('Page.navigate',{url:base+'/receiving-orders/new'});await wait('document.querySelector("select:not(:disabled)")');
await choose('.form-fields-column label:nth-child(2) select',data.tariff.client_id);await choose('.form-fields-column label:nth-child(3) select',data.tariff.contract_id);
await evaljs("[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='VEHICLE')).setAttribute('data-check','transport')");await choose('select[data-check=transport]','VEHICLE');await choose('select[aria-label="Собственник КТК по умолчанию"]',data.tariff.client_id);await click('.page-header .primary-button');await wait('document.querySelector(".route-picker-actions button")');await click('.route-picker-actions button');await wait('document.querySelector("[role=dialog] select:not(:disabled)")');await open('[role=dialog] select:not(:disabled)');
assert.equal(await evaljs("getComputedStyle(document.querySelector('select:open'),'::picker(select)').borderRadius"),'8px');await key('Escape');assert.equal(await evaljs("!!document.querySelector('[role=dialog]')"),true);console.log('PASS dialog select and Escape leaves dialog open');
await send('Page.navigate',{url:base+'/comprehensive-service-orders/new'});await wait(`document.querySelector('${service}')?.options.length===3`);await choose(service,data.wagon.id);
fs.writeFileSync(path.join(dir,'unified-form-final.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
