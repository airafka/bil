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
for(const id of ['8069f730-ea6f-4033-9445-9a706607404e','079ea76e-2c83-4011-bf3b-650371d1986a']){
 const data=await(await fetch(base+'/api/comprehensive-service-orders/'+id)).json(),p=data.progress;
 const expected=[[data.receivingOrder.status==='COMPLETED'?1:0,1,p.accepted,p.total],[p.shippingOrdersCompleted,p.shippingOrderCount,p.shippingCompleted,p.shippingCreated],[p.returnOrdersCompleted,p.returnOrderCount,p.returnCompleted,p.returnCreated]];
 for(const [width,expanded] of [[1920,false],[1440,false],[1280,true],[1024,false],[768,false],[360,false],[320,false]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/comprehensive-service-orders/'+id});await wait('document.querySelector(".service-progress-metrics")');
  await evaljs(`(()=>{if(document.querySelector('.app-shell').dataset.menuExpanded!==String(${expanded}))document.querySelector('.menu-toggle').click()})()`);await pause(120);
  const info=await evaljs(`(()=>{const cards=[...document.querySelectorAll('.service-progress > section')];return {titles:cards.map(c=>c.querySelector('h2').textContent),values:cards.map(c=>[...c.querySelectorAll('strong,.service-progress-total')].map(x=>Number(x.textContent))),labels:cards.map(c=>[...c.querySelectorAll('dt')].map(x=>x.textContent)),positions:cards.map(c=>({y:c.getBoundingClientRect().y,w:c.getBoundingClientRect().width})),overflow:document.documentElement.scrollWidth>innerWidth+1,wide:cards.some(c=>c.scrollWidth>c.clientWidth+1),missing:!!document.querySelector('.service-progress-missing'),workspace:document.querySelector('.content').clientWidth-parseFloat(getComputedStyle(document.querySelector('.content')).paddingLeft)-parseFloat(getComputedStyle(document.querySelector('.content')).paddingRight)}})()`);
  assert.deepEqual(info.titles,['Поставка - ЖД','Вывоз - Авто','Поставка - Авто']);assert.deepEqual(info.values,expected);assert.deepEqual(info.labels,[['Заявки','КТК'],['Заявки','КТК'],['Заявки','КТК']]);assert.equal(info.overflow,false);assert.equal(info.wide,false);assert.equal(info.missing,p.shippingMissing>0);
  if(info.workspace>900){assert.equal(info.positions[0].y,info.positions[2].y);assert.ok(Math.abs(info.positions[0].w-info.positions[2].w)<2)}else assert.ok(info.positions[2].y>info.positions[0].y);
  if(id==='8069f730-ea6f-4033-9445-9a706607404e'&&[1440,360].includes(width))fs.writeFileSync(path.join(dir,'progress-cards-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  console.log('PASS stages',data.order.code,width,expanded);
 }
}
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
