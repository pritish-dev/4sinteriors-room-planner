const WebSocket=require('ws');
(async()=>{
  const t=(await (await fetch('http://localhost:9222/json')).json()).find(x=>x.type==='page');console.log('page',t.url);
  const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));let id=0;const pend={};
  ws.on('message',m=>{const d=JSON.parse(m);if(d.id&&pend[d.id]){pend[d.id](d);delete pend[d.id]}});
  const ev=e=>new Promise(r=>{const i=++id;pend[i]=d=>r(d.result&&d.result.result?d.result.result.value:JSON.stringify(d));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:e,awaitPromise:true,returnByValue:true}}))});
  console.log('bridge:',await ev('typeof window.RPNative+" "+(window.RPNative&&RPNative.version())'));
  const b64=Buffer.from('%PDF-1.4\n% test\n').toString('base64');
  console.log('save:',await ev(`(RPNative.shareFile('${b64}','Test-items.pdf','application/pdf','save','919876543210','a@b.com','Subj','Text'),'called')`));
  await new Promise(r=>setTimeout(r,2500));
  console.log('whatsapp:',await ev(`(RPNative.shareFile('${b64}','Test-items.pdf','application/pdf','whatsapp','919876543210','a@b.com','Subj','Text'),'called')`));
  await new Promise(r=>setTimeout(r,2500));
  console.log('fullscreen:',await ev(`(RPNative.setFullscreen(true),'called')`));
  process.exit(0)})().catch(e=>{console.log('err',e.message);process.exit(0)});
