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
const summaries=(await(await fetch(base+'/api/comprehensive-service-orders?size=50')).json()).items;
const details=await Promise.all(summaries.map(async s=>(await(await fetch(base+'/api/comprehensive-service-orders/'+s.id)).json())));
const draft=details.find(d=>d.selectableContainers.length&&d.order.status!=='COMPLETED');assert.ok(draft);
let charged,charges;for(const d of details){const c=await(await fetch(base+'/api/billing-charges?page=0&size=20&comprehensiveServiceOrderId='+d.order.id)).json();if(c.total){charged=d;charges=c;break}}assert.ok(charged);
for(const width of [1920,1440,640,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/'+draft.order.id});await wait('document.getElementById("service-tab-charges")');
 assert.deepEqual(await evaljs('[...document.querySelectorAll("[role=tab]")].map(t=>t.textContent)'),['Основное','Заявки на поставку - ЖД','Заявки на вывоз - Авто','Заявки на поставку - Авто','Начисления']);
 assert.equal(await evaljs('!!document.querySelector("#service-panel-main .billing-charges-panel")'),false);
 await evaljs('document.getElementById("service-tab-shipping").click()');await wait('document.querySelector(".service-pending-table")');await pause(100);
 const r=await evaljs('(()=>{const t=document.querySelector(".service-pending-table"),h=t.querySelectorAll("thead th"),header=document.querySelector(".service-pending-card .bulk-return-heading");return {choice:h[0].getBoundingClientRect().width,number:h[1].getBoundingClientRect().width,records:t.classList.contains("responsive-table--records"),gap:t.parentElement.getBoundingClientRect().top-header.getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,rows:t.tBodies[0].rows.length}})()');
 assert.equal(r.overflow,false);assert.equal(r.rows,draft.selectableContainers.length);assert.ok(Math.abs(r.gap-12)<2);if(width>=640){assert.equal(r.records,false);assert.equal(r.choice,44);assert.equal(r.number,220)}else assert.equal(r.records,true);
 await evaljs('document.querySelector(".service-pending-table input").click()');assert.equal(await evaljs('document.querySelector(".service-pending-card .primary-button").disabled'),false);
 if(width===1440){await evaljs('document.querySelector(".service-pending-card").scrollIntoView({block:"center"})');fs.writeFileSync(path.join(dir,'pending-containers-final.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 await evaljs('document.getElementById("service-tab-charges").click()');await wait('document.querySelector("#service-panel-charges .service-section-empty")');assert.equal(await evaljs('document.querySelector("#service-panel-charges").textContent.includes("Начислений пока нет")'),true);assert.equal(await evaljs('!!document.querySelector(".service-section-actions")'),false);assert.equal(await evaljs('!!document.querySelector(".service-pending-card")'),false);
 await evaljs('document.getElementById("service-tab-shipping").click()');assert.equal(await evaljs('document.querySelector(".service-pending-table input").checked'),true);
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/'+charged.order.id});await wait('document.getElementById("service-tab-charges")');await evaljs('document.getElementById("service-tab-charges").click()');await wait('document.querySelector("#service-panel-charges tbody tr")');
 assert.equal(await evaljs('document.querySelectorAll("#service-panel-charges tbody tr").length'),charges.items.length);
 const amount=charges.totalWithVat.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});assert.ok(await evaljs('document.querySelector("#service-panel-charges").textContent.includes('+JSON.stringify(amount)+')'));
 assert.equal(await evaljs('document.documentElement.scrollWidth>innerWidth+1'),false);
 if(width===1440)fs.writeFileSync(path.join(dir,'charges-tab-final.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 console.log('PASS tabs and pending layout',width,JSON.stringify(r));
}
await evaljs('document.getElementById("service-tab-main").focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});await wait('document.getElementById("service-tab-charges").getAttribute("aria-selected")==="true"');console.log('PASS keyboard tabs');
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
