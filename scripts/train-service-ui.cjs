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



const data=JSON.parse(fs.readFileSync(path.join(dir,'train-service-test-data.json'),'utf8')),base='http://localhost:3189';
const select='select[aria-label="Услуга"]';
async function choose(index,value){await evaljs(`(()=>{const s=document.querySelector('.form-fields-column').querySelectorAll('select')[${index}];s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function next(){await evaljs("document.querySelector('.page-header .primary-button').click()");}
for(const width of [1920,1440,1280,1024,640,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/comprehensive-service-orders/new'});
 await wait(`document.querySelector('${select}')?.options.length===3`);
 await choose(0,data.wagon.id);
 const layout=await evaljs(`(()=>{const fields=[...document.querySelector('.form-fields-column').querySelectorAll('select')].map(s=>{const r=s.getBoundingClientRect();return {left:r.left,width:r.width}});const v=document.querySelector('.ui-wrapping-value');return {fields,overflow:document.documentElement.scrollWidth>innerWidth+1,label:v.textContent,clipped:v.scrollWidth>v.clientWidth+1,height:v.getBoundingClientRect().height}})()`);
 assert.equal(layout.overflow,false,JSON.stringify({width,layout}));assert.equal(layout.clipped,false);assert.equal(layout.label,data.wagon.name);
 for(const f of layout.fields){assert.ok(Math.abs(f.left-layout.fields[0].left)<1);assert.ok(Math.abs(f.width-layout.fields[0].width)<1);}
 if(width===1440||width===360)fs.writeFileSync(path.join(dir,'train-form-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 console.log('PASS form geometry',width,JSON.stringify(layout.fields[0]));
}
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
for(const [selected,correct,bill] of [[data.wagon,data.train,data.ui40],[data.train,data.wagon,data.ui39]]){
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/new'});await wait(`document.querySelector('${select}')?.options.length===3`);
 await choose(0,selected.id);await choose(1,data.tariff.client_id);await choose(2,data.tariff.client_id);
 await wait(`document.querySelector('.form-fields-column').querySelectorAll('select')[3].options.length>1`);await choose(3,data.tariff.contract_id);
 await next();await wait(`document.querySelector('input[aria-label="Выбрать накладную ${bill.number}"]')`);
 await evaljs(`document.querySelector('input[aria-label="Выбрать накладную ${bill.number}"]').click()`);await next();
 await wait(`document.body.textContent.includes(${JSON.stringify('Необходимо выбрать услугу «'+correct.name+'».')})`);
 assert.equal(await evaljs("document.querySelector('.step.current').textContent"),'Накладные ЭТРАН');
 if(selected.id===data.wagon.id)fs.writeFileSync(path.join(dir,'train-validation.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaljs("document.querySelector('.page-header .secondary-button').click()");await wait(`document.querySelector('${select}')`);await choose(0,correct.id);await next();await wait("document.querySelector('.step.current').textContent==='Накладные ЭТРАН'");await next();await wait("document.querySelector('.step.current').textContent==='Вагоны'");
 console.log('PASS Next blocks mismatch and preserves waybill on correction',bill.number);
}
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
