const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.connectOverCDP('http://localhost:9222');
  const p=b.contexts()[0].pages()[0];
  const logs=[];p.on('console',m=>logs.push(m.type()+': '+m.text()));p.on('pageerror',e=>logs.push('pageerror: '+e.message));
  console.log('url',p.url());
  console.log('locked',await p.evaluate(()=>document.documentElement.className));
  // direct network probe from inside the WebView
  console.log('probe',await p.evaluate(async()=>{try{const r=await fetch('https://script.google.com/macros/s/AKfycby4BXBlxp8fzQrXYR1U8OGt9GVM6ysEkoMVRtskw8_zc0JRzGKcoVd_GZgdl-1NZ_zlMA/exec',{method:'POST',body:JSON.stringify({action:'login',username:'zz_diag_nobody',password:'x'}),headers:{'Content-Type':'text/plain'},redirect:'follow'});return r.status+' '+(await r.text()).slice(0,200)}catch(e){return 'FETCH ERROR: '+e}}));
  await p.fill('input[name=username]','zz_diag_nobody');await p.fill('input[name=password]','x');
  await p.click('#gateBtn');
  await p.waitForFunction(()=>document.getElementById('gateBtn').textContent==='Sign in',null,{timeout:90000}).catch(()=>{});
  console.log('gateErr:',await p.textContent('#gateErr'));
  console.log('logs',logs);
  process.exit(0);
})().catch(e=>{console.log('cdp error',e.message);process.exit(0)});
