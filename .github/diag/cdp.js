const WebSocket=require('ws');
(async()=>{
  const list=await (await fetch('http://localhost:9222/json')).json();
  const t=list.find(x=>x.type==='page')||list[0];console.log('target',t&&t.url);
  const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));
  let id=0;const pend={};const logs=[];
  ws.on('message',m=>{const d=JSON.parse(m);if(d.id&&pend[d.id]){pend[d.id](d);delete pend[d.id]}
    if(d.method==='Runtime.consoleAPICalled')logs.push(d.params.type+': '+d.params.args.map(a=>a.value||a.description).join(' '));
    if(d.method==='Runtime.exceptionThrown')logs.push('EXC: '+JSON.stringify(d.params.exceptionDetails).slice(0,300))});
  const send=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});return r.result&&r.result.result?r.result.result.value:JSON.stringify(r)};
  await send('Runtime.enable');
  console.log('class:',await ev('document.documentElement.className'));
  console.log('probe POST:',await ev(`fetch('https://script.google.com/macros/s/AKfycby4BXBlxp8fzQrXYR1U8OGt9GVM6ysEkoMVRtskw8_zc0JRzGKcoVd_GZgdl-1NZ_zlMA/exec',{method:'POST',body:JSON.stringify({action:'login',username:'zz_diag_nobody',password:'x'}),headers:{'Content-Type':'text/plain'},redirect:'follow'}).then(async r=>r.status+' '+(await r.text()).slice(0,200)).catch(e=>'FETCH ERROR: '+e)`));
  for(const u of ['https://www.google.com/generate_204','https://raw.githubusercontent.com/pritish-dev/4s-orders/master/.apps_script_deployment_id','https://script.google.com/macros/s/AKfycby4BXBlxp8fzQrXYR1U8OGt9GVM6ysEkoMVRtskw8_zc0JRzGKcoVd_GZgdl-1NZ_zlMA/exec?action=ping'])
    console.log('GET',u.slice(0,60),await ev(`fetch('${u}',{mode:'no-cors'}).then(r=>'ok '+r.type+' '+r.status).catch(e=>'ERR '+e)`));
  console.log('jsonp:',await ev(`new Promise(r=>{window.__cb=d=>r('jsonp ok '+JSON.stringify(d).slice(0,80));const s=document.createElement('script');s.onerror=()=>r('jsonp script error');s.src='https://script.google.com/macros/s/AKfycby4BXBlxp8fzQrXYR1U8OGt9GVM6ysEkoMVRtskw8_zc0JRzGKcoVd_GZgdl-1NZ_zlMA/exec?action=getAppSerial&callback=__cb';document.head.appendChild(s);setTimeout(()=>r('jsonp timeout'),40000)})`));
  await ev(`(()=>{const f=document.getElementById('gateForm');f.username.value='zz_diag_nobody';f.password.value='x';document.getElementById('gateBtn').click();return 1})()`);
  console.log('gateErr:',await ev(`new Promise(r=>{const s=Date.now();(function w(){const b=document.getElementById('gateBtn');if((b.textContent==='Sign in'&&Date.now()-s>1500)||Date.now()-s>90000)r(document.getElementById('gateErr').textContent);else setTimeout(w,500)})()})`));
  console.log('logs:',logs);process.exit(0);
})().catch(e=>{console.log('cdp error',e.message);process.exit(0)});
