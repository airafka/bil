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
for(const width of [1920,1440,1280,1024,720,640,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/comprehensive-service-orders/new'});await wait(`document.querySelector('${service}')?.options.length===3`);
 await choose(service,data.wagon.id);await open(service);
 const r=await evaljs(`(()=>{const s=document.querySelector('${service}'),o=s.selectedOptions[0],b=o.getBoundingClientRect(),p=getComputedStyle(s,'::picker(select)'),f=[...document.querySelector('.form-fields-column').querySelectorAll('select')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,w:r.width}});return {fill:getComputedStyle(o).backgroundColor,radius:p.borderRadius,appearance:getComputedStyle(s).appearance,popupWidth:parseFloat(p.width),option:{x:b.x,right:b.right,y:b.y,bottom:b.bottom},fields:f,height:s.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
 assert.equal(r.fill,'rgb(237, 244, 255)');assert.equal(r.radius,'8px');assert.equal(r.appearance,'base-select');assert.equal(r.overflow,false,JSON.stringify({width,r}));assert.ok(r.option.x>=0&&r.option.right<=width);assert.ok(r.option.y>=0&&r.option.bottom<=1000);assert.ok(Math.abs(r.popupWidth-r.fields[0].w)<2);for(const f of r.fields){assert.ok(Math.abs(f.x-r.fields[0].x)<1);assert.ok(Math.abs(f.w-r.fields[0].w)<1);}
 if(width===1440||width===360)fs.writeFileSync(path.join(dir,'unified-select-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await key('Escape');await wait('!document.querySelector("select:open")');
 await open('.form-fields-column label:nth-child(3) select');
 const clientFill=await evaljs("(()=>{const s=document.querySelector('select:open');return {appearance:getComputedStyle(s).appearance,radius:getComputedStyle(s,'::picker(select)').borderRadius,fill:getComputedStyle(s.querySelector('option:focus')||s.options[1]).backgroundColor}})()");assert.equal(clientFill.radius,'8px');assert.equal(clientFill.appearance,'base-select');assert.equal(clientFill.fill,'rgb(237, 244, 255)');
 await key('Escape');console.log('PASS shared service/client picker',width,r.fields[0].w,r.height);
}
// Cross-section smoke: actual shared native pickers in registries and forms.
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
for(const route of ['container-owners','receiving-orders/new','shipping-orders/new','service-orders/new','routes/new','waybills/create','payment-invoices/new']){
 await send('Page.navigate',{url:base+'/'+route});await wait('document.querySelector("select:not(:disabled)")');await pause(150);
 const selector='select:not(:disabled)';await open(selector);
 assert.equal(await evaljs("getComputedStyle(document.querySelector('select:open'),'::picker(select)').borderRadius"),'8px');
 assert.equal(await evaljs("[...document.querySelectorAll('select')].every(s=>getComputedStyle(s).appearance==='base-select')"),true);
 await key('Escape');console.log('PASS picker in',route);
}
// The service mismatch is shown only after Next on the waybill step.
for(const [selected,correct,bill] of [[data.wagon,data.train,data.ui40],[data.train,data.wagon,data.ui39]]){
 await send('Page.navigate',{url:base+'/comprehensive-service-orders/new'});await wait(`document.querySelector('${service}')?.options.length===3`);
 await choose(service,selected.id);await choose('.form-fields-column label:nth-child(3) select',data.tariff.client_id);await choose('select[aria-label="Собственник КТК по умолчанию"]',data.tariff.client_id);await choose('.form-fields-column label:nth-child(5) select',data.tariff.contract_id);
 await click('.page-header .primary-button');await wait(`document.querySelector('input[aria-label="Выбрать накладную ${bill.number}"]')`);await click(`input[aria-label="Выбрать накладную ${bill.number}"]`);
 assert.equal(await evaljs("document.body.textContent.includes('Количество КТК не соответствует')"),false);
 await click('.page-header .primary-button');await wait(`document.body.textContent.includes(${JSON.stringify('Необходимо выбрать услугу «'+correct.name+'».')})`);assert.equal(await evaljs("document.querySelector('.step.current').textContent"),'Накладные ЭТРАН');
 await click('.notification-close');await click('.page-header .secondary-button');await choose(service,correct.id);await click('.page-header .primary-button');await click('.page-header .primary-button');await wait("document.querySelector('.step.current').textContent==='Вагоны'");console.log('PASS validation exactly on Next',bill.number);
}
ws.close();chrome.kill();
})().catch(e=>{console.error(e);chrome.kill();process.exitCode=1});
