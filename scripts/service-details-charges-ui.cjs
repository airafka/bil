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
const id='a778e704-61fe-4694-b158-f90f195f3dcc';
const detail=await(await fetch(base+'/api/comprehensive-service-orders/'+id)).json();
const charges=await(await fetch(base+'/api/billing-charges?page=0&size=20&comprehensiveServiceOrderId='+id)).json();
for(const width of [1920,1440,1024,640,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/'+id});
 await wait('document.querySelector(".service-selected-detail dd")');
 assert.equal(await evaljs('document.querySelector(".service-selected-detail dd").textContent'),detail.progress.serviceName);
 await evaljs('document.getElementById("service-tab-receiving").click()');
 const headers=await evaljs('[...document.querySelectorAll(".service-initial-metadata-table th")].map(x=>x.textContent)');
 assert.deepEqual(headers,['№','Номер заявки','Дата и время поставки','Грузоотправитель','Груз','Рейс','Статус']);
 assert.equal(await evaljs('document.querySelector(".service-initial-metadata-table tbody tr").cells.length'),7);
 await evaljs('document.getElementById("service-tab-charges").click()');
 await wait('document.querySelector(".service-charge-table tbody tr")');await pause(300);
 const layout=await evaljs(`(()=>{const d=document.querySelector('.service-charge-totals'),a=d.children[0],b=d.children[1],t=document.querySelector('.service-charge-table');return{totals:[...d.querySelectorAll('dd')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1,gap:b.getBoundingClientRect().left-a.getBoundingClientRect().right,border:getComputedStyle(b).borderLeftWidth,topBorder:getComputedStyle(b).borderTopWidth,columns:[...t.querySelectorAll('th')].map(x=>Math.round(x.getBoundingClientRect().width)),records:t.classList.contains('responsive-table--records'),rows:t.tBodies[0].rows.length}})()`);
 const fmt=n=>n.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
 assert.deepEqual(layout.totals,[fmt(charges.totalWithoutVat),fmt(charges.totalWithVat)]);assert.equal(layout.rows,charges.items.length);assert.equal(layout.overflow,false);
 if(width>=1024){assert.equal(layout.border,'1px');assert.ok(layout.gap<=21);assert.equal(layout.columns[0],120);assert.equal(layout.columns[1],140)}else {assert.equal(layout.topBorder,'1px');assert.equal(layout.records,true)}
 if(width===1440||width===360)fs.writeFileSync(path.join(dir,'service-details-charges-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 console.log('PASS',width,JSON.stringify(layout));
}
await send('Page.navigate',{url:base+'/comprehensive-service-orders/079ea76e-2c83-4011-bf3b-650371d1986a'});
await wait('document.querySelector("button[aria-label=Редактировать]")');
await evaljs('document.getElementById("service-tab-receiving").click(); document.querySelector("button[aria-label=Редактировать]").click()');
await wait('document.querySelector("#service-panel-receiving input[type=datetime-local]")');
assert.equal(await evaljs('document.querySelector(".service-initial-metadata-table tbody tr").cells.length'),7);
assert.ok(await evaljs('Boolean(document.querySelector("#service-panel-receiving select"))'));
console.log('PASS rail date/sender editing without saving');
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
