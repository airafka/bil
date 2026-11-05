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
await send('Page.navigate',{url:'http://localhost:3019/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506'});
await wait("!!document.getElementById('service-tab-returns')");await evaljs("document.getElementById('service-tab-returns').click()");await wait("!![...document.querySelectorAll('#service-panel-returns button')].find(x=>x.textContent==='Создать рейс')");await evaljs("[...document.querySelectorAll('#service-panel-returns button')].find(x=>x.textContent==='Создать рейс').click()");
await wait("document.querySelector('.route-side-dialog[open] select')?.options.length===13");
await evaljs("for(const s of document.querySelectorAll('.route-side-dialog select')){s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}))}");
await pause(200);
async function check(selector,label){
 for(const width of [1280,1024,853,640,480,360,320]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(900*width/1280),deviceScaleFactor:1,mobile:false});await pause(100);
 const metrics=await evaljs(`(()=>{const d=document.querySelector('${selector}'),box=d.getBoundingClientRect(),header=d.querySelector('.route-dialog-heading'),body=d.querySelector('.route-drawer-body')||d.querySelector('form'),section=d.querySelector('.ui-form-section'),fields=[...d.querySelectorAll('.horizontal-field')],comment=d.querySelector('textarea').closest('label');const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,right:b.right}};return {inTable:!!d.closest('td'),nestedForm:!!body.closest('form')?.parentElement.closest('form'),dialog:r(d),header:r(header),buttons:[...header.querySelectorAll('button')].map(r),section:r(section),fields:fields.map(r),comment:r(comment),controls:[...d.querySelectorAll('select')].map(r),body:{height:body.clientHeight,scroll:body.scrollHeight},wide:d.scrollWidth>d.clientWidth+1,labels:fields.map(f=>r(f.firstElementChild))}})()`);
 assert.equal(metrics.inTable,false,label+' must escape table');assert.equal(metrics.nestedForm,false);assert.equal(metrics.wide,false,label+' horizontal overflow '+width);
 assert.ok(metrics.header.bottom<=metrics.dialog.bottom+.5,label+' header visible '+width);
 for(const b of metrics.buttons){assert.equal(Math.round(b.height),40);assert.ok(b.x>=-.5&&b.right<=width+.5,'button horizontal visibility')};assert.equal(Math.round(metrics.buttons.at(-1).width),40);
 for(let i=1;i<metrics.fields.length;i++)assert.ok(metrics.fields[i].y>=metrics.fields[i-1].bottom-.5,label+' fields overlap '+width);
 assert.ok(metrics.comment.y>=metrics.section.bottom-.5,label+' comment overlaps logistics '+width);
 // Reference fields now occupy a separate section below the comment.
 for(const c of metrics.controls){assert.equal(Math.round(c.height),40);assert.ok(c.width>200,'field width '+width)}
 for(let i=0;i<metrics.labels.length;i++)assert.ok(metrics.labels[i].right<=metrics.fields[i].right+.5,'label overflow');
 console.log(label+' width '+width+': PASS; action buttons 40px; no overlap/overflow');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:640,height:700,deviceScaleFactor:1,mobile:false});await pause(100);const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'route-layout-'+label+'.png'),Buffer.from(shot.data,'base64'));
}
await check('.route-side-dialog','service');
await evaljs("document.querySelector('.route-side-dialog .close-button').click()");
await send('Page.navigate',{url:'http://localhost:3019/receiving-orders/dab80b9b-e401-402d-84d2-79eae4da62e2'});
await wait("!!document.querySelector('button[aria-label=\"Редактировать\"]')");
await evaljs("document.querySelector('button[aria-label=\"Редактировать\"]').click()");
await wait("!![...document.querySelectorAll('button')].find(x=>x.textContent==='Рейс')");await evaljs("[...document.querySelectorAll('button')].find(x=>x.textContent==='Рейс').click()");
await wait("!!document.querySelector('.route-picker-actions button')");await evaljs("document.querySelector('.route-picker-actions button').click()");
await wait("document.querySelector('.route-picker-dialog select')?.options.length===13");
await evaljs("for(const s of document.querySelectorAll('.route-picker-dialog select')){s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}))}");
await check('.route-picker-dialog','order');
await send('Browser.close').catch(()=>{});ws.close();console.log('PASS: both route drawers, 100–400% equivalent CSS viewport widths, no writes to application data');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
