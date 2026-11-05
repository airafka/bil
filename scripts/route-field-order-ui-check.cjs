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


const base='http://localhost:3000';
async function check(selector,name){
 await wait(`document.querySelector('${selector} section.ui-section-divider select')?.options.length>1`);
 await evaljs(`for(const s of document.querySelectorAll('${selector} section.ui-section-divider select')){s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}))}`);await pause(200);
 for(const width of [1440,640,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await pause(150);
 const result=await evaljs(`(()=>{const root=document.querySelector('${selector}'),ref=root.querySelector('.route-reference-section'),fields=[...root.querySelectorAll('input:not([readonly]):not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(e=>e.getBoundingClientRect().height>0);return {fields:fields.length,below:fields.every(e=>e.getBoundingClientRect().bottom<=ref.getBoundingClientRect().top+1),overflow:root.scrollWidth>root.clientWidth+1,refs:ref.innerText,readonly:[...ref.querySelectorAll('input')].every(e=>e.readOnly||e.disabled)}})()`);
 assert.ok(result.fields>=5,JSON.stringify(result));assert.ok(result.below,JSON.stringify(result));assert.equal(result.overflow,false);assert.ok(result.readonly);assert.ok(result.refs.includes('Телефон'));console.log(name,width,'PASS');
 }
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'route-field-order-'+name+'.png'),Buffer.from(shot.data,'base64'));
}
await send('Page.navigate',{url:base+'/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506'});
await wait("!!document.getElementById('service-tab-returns')");await evaljs("document.getElementById('service-tab-returns').click()");await wait("!![...document.querySelectorAll('#service-panel-returns button')].find(x=>x.textContent==='Создать рейс')");await evaljs("[...document.querySelectorAll('#service-panel-returns button')].find(x=>x.textContent==='Создать рейс').click()");await check('.route-side-dialog','drawer');
await send('Page.navigate',{url:base+'/routes/new'});await wait("!!document.querySelector('#route-create-form .route-reference-section')");await check('#route-create-form','page');
await send('Page.navigate',{url:base+'/receiving-orders/dab80b9b-e401-402d-84d2-79eae4da62e2'});await wait(`!!document.querySelector('button[aria-label="Редактировать"]')`);await evaljs(`document.querySelector('button[aria-label="Редактировать"]').click()`);await wait("!![...document.querySelectorAll('button')].find(x=>x.textContent==='Рейс')");await evaljs("[...document.querySelectorAll('button')].find(x=>x.textContent==='Рейс').click()");await wait("!!document.querySelector('.route-picker-actions button')");await evaljs("document.querySelector('.route-picker-actions button').click()");await check('.route-picker-dialog','picker');
await send('Browser.close').catch(()=>{});ws.close();console.log('PASS: no application data saved');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
