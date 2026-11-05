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


const base='http://localhost:3031',ids=JSON.parse(fs.readFileSync(path.join(dir,'order-waybill-test-ids.json'),'utf8'));
for(const kind of ['receiving','shipping']){
 await send('Page.navigate',{url:base+'/'+kind+'-orders/'+ids[kind]});await wait("!![...document.querySelectorAll('dt')].find(e=>e.textContent==='Номер транспортной накладной')");
 for(const width of [1440,640]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(100);
 const values=await evaljs("Object.fromEntries([...document.querySelectorAll('dt')].map(e=>[e.textContent,e.nextElementSibling.textContent]))");assert.equal(values['Номер транспортной накладной'],'00123/ТН-А');assert.equal(values['Валюта стоимости груза'],'RUB');assert.notEqual(values['Дата создания'],'Не указана');
 const positions=await evaljs("Object.fromEntries([...document.querySelectorAll('dt')].map(e=>[e.textContent,{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}]))");if(width===1440){assert.ok(positions['Номер заявки'].y<positions['Дата создания'].y);assert.ok(positions['Дата создания'].y<positions['Клиент'].y);assert.ok(positions['Клиент'].y<positions['Договор'].y);assert.ok(positions['Площадка'].x<positions['Валюта стоимости груза'].x);assert.ok(positions['Транспорт'].y<positions['Номер транспортной накладной'].y)}
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'order-main-'+kind+'-'+width+'.png'),Buffer.from(shot.data,'base64'));console.log(kind,width,'view PASS');}
 await send('Page.navigate',{url:base+'/'+kind+'-orders/new'});await wait("!![...document.querySelectorAll('label')].find(e=>e.textContent.includes('Номер транспортной накладной'))?.querySelector('input')");
 assert.equal(await evaljs("[...document.querySelectorAll('label')].find(e=>e.textContent.includes('Номер транспортной накладной')).querySelector('input').maxLength"),255);assert.ok(await evaljs("document.body.textContent.includes('RUB')"));console.log(kind,'creation field PASS');
}
await send('Browser.close').catch(()=>{});ws.close();console.log('PASS: view and creation for both order kinds');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
