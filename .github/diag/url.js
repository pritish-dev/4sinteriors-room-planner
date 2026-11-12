(async()=>{try{const l=await (await fetch('http://localhost:9222/json')).json();console.log('offline page url:',l.map(x=>x.url).join(' | '))}catch(e){console.log('err',e.message)}})();
