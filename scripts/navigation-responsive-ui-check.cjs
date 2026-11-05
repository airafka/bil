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



const base='http://localhost:3032';await send('Page.navigate',{url:base+'/receiving-orders'});await wait("!!document.querySelector('.menu-toggle')");await evaljs("localStorage.setItem('billing-menu','expanded')");
for(const width of [1920,1280,800,640,360,320]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/comprehensive-service-orders/2480ed6b-ea1d-49ac-83c4-9108b03a1506'});await wait("!!document.getElementById('service-tab-receiving')");await evaljs("document.getElementById('service-tab-receiving').click()");
 for(let i=0;i<4;i++){
 await evaljs('(()=>{const b=document.querySelectorAll(".nav-section-toggle")['+i+'];if(b?.getAttribute("aria-expanded")==="false")b.click()})()');await pause(150);
 const bad=await evaljs("[...document.querySelectorAll('.nav-children:not([hidden]) .nav-label')].filter(e=>e.getBoundingClientRect().width>0).flatMap(e=>{const r=e.getBoundingClientRect(),p=e.closest('a').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();return t.right>p.right+1||t.height>parseFloat(getComputedStyle(e).lineHeight)+1?[{text:e.textContent,t:{right:t.right,height:t.height},parent:p.right}]:[]})");assert.equal(bad.length,0,JSON.stringify({width,bad}));
 }
 const labels=await evaljs("[...document.querySelectorAll('.nav-label')].map(e=>e.textContent)");assert.ok(labels.includes('Заявка на смену собственника'));assert.ok(labels.includes('Заявка на услугу'));
 assert.equal(await evaljs("[...document.querySelectorAll('#service-panel-receiving table,.service-receiving-table')].filter(e=>e.scrollWidth>e.clientWidth+2).length"),0);
 assert.equal(await evaljs("document.documentElement.scrollWidth>innerWidth+1"),false);
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'navigation-responsive-'+width+'.png'),Buffer.from(shot.data,'base64'));console.log(width+' full labels, no wrapping or horizontal scroll PASS');
}
await send('Browser.close').catch(()=>{});ws.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
