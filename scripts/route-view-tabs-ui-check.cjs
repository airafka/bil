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


const base='http://localhost:3000',routes=await(await fetch(base+'/api/routes')).json();
for(const transport of ['VEHICLE','RAILWAY']){
 const route=routes.find(r=>r.transportType===transport&&r.orderCount>0&&r.status==='DRAFT'),details=await(await fetch(base+'/api/routes/'+route.id)).json();assert.ok(route);
 await send('Page.navigate',{url:base+'/routes/'+route.id});await wait("!!document.querySelector('.route-information')");
 for(const width of [1440,640]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(150);
 const m=await evaljs("(()=>{const info=document.querySelector('.route-information'),orders=document.querySelector('.route-linked-orders');return {main:info.getBoundingClientRect().height>0,orders:orders.getBoundingClientRect().height,fields:[...info.querySelectorAll('dt')].map(e=>e.textContent),overflow:info.scrollWidth>info.clientWidth+1,logistics:!!info.querySelector('[aria-label=\"Логистика рейса\"]'),rows:[...info.querySelectorAll('[aria-label=\"Логистика рейса\"] dl>div')].map(e=>({label:e.firstElementChild.textContent,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})),links:[...info.querySelectorAll('a')].map(e=>e.getAttribute('href'))}})()");
 assert.ok(m.main);assert.equal(m.orders,0);assert.equal(m.overflow,false);assert.equal(m.logistics,transport==='VEHICLE');assert.equal(m.fields.length,transport==='VEHICLE'?15:7);
 if(transport==='VEHICLE'&&width===1440){assert.ok(m.rows[0].x<m.rows[1].x);assert.equal(m.rows[0].y,m.rows[1].y);assert.equal(m.rows[2].label,'ФИО водителя-экспедитора:');assert.equal(m.rows[3].label,'Номер страхования:');assert.equal(m.rows[4].label,'Номер телефона:');assert.equal(m.rows[6].label,'Номер доверенности:');assert.equal(m.links.length,2)}
 console.log(transport,width,'main PASS');
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'route-view-'+transport+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
 }
 await evaljs("[...document.querySelectorAll('.view-tabs button')].find(e=>e.textContent==='Заявки').click()");
 assert.equal(await evaljs("document.querySelector('.service-main-panel').getBoundingClientRect().height"),0);
 assert.equal(await evaljs("document.querySelectorAll('.route-linked-orders tbody tr').length"),details.orders.length);
 assert.ok(await evaljs("document.querySelector('.route-linked-orders').getBoundingClientRect().height>0"));
 await evaljs("document.querySelector('button[aria-label=\"Редактировать\"]').click()");await wait("!!document.querySelector('#route-edit-main')");
 await evaljs("[...document.querySelectorAll('.view-tabs button')].find(e=>e.textContent==='Заявки').click()");assert.ok(await evaljs("document.querySelector('.route-linked-orders').getBoundingClientRect().height>0 && !!document.querySelector('.route-assign-section')"));
 await evaljs("[...document.querySelectorAll('button')].find(e=>e.textContent==='Отмена').click()");assert.equal(await evaljs("!!document.querySelector('.route-assign-section')"),false);console.log(transport,'orders and edit/cancel PASS');
}
await send('Browser.close').catch(()=>{});ws.close();console.log('PASS: no data saved');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{chrome.kill()});
