const BASE=new URL('./',self.location.href),ROOT=new URL('../',BASE);
const PREFIX='wave-coffre-'+encodeURIComponent(BASE.pathname)+'-',CACHE=PREFIX+'v3-wave-transparent';
const FILES=['./','index.html','coffre.js','manifest.webmanifest'].map(p=>new URL(p,BASE).href).concat(['style.css','ui.js','assets/pingouin-wave-original.svg'].map(p=>new URL(p,ROOT).href));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='CACHE_STATUS')e.source?.postMessage({type:'CACHE_READY'});});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==ROOT.origin)return;e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(e.request,{ignoreSearch:true});if(cached)return cached;try{return await fetch(e.request);}catch{if(e.request.mode==='navigate')return (await c.match(BASE.href))||Response.error();return Response.error();}}));});
