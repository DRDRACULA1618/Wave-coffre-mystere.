const GOAL=13,DURATION=15000,MIN_SHOT_INTERVAL=150;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const positions={A:'left',B:'center',C:'right'};
const durations=Object.freeze({A:15000,B:13000,C:11000});
// Identifiants d'accès neutres : leur signification n'est jamais envoyée dans une URL.
const scanRoutes=Object.freeze({tfn3j5u4:'A',vgyx24v5:'B',emhvcxu4:'C','4ubsj88k':'empty'});
// Les parties déjà ouvertes avant cette mise à jour gardent leurs quinze secondes.
const sessionDuration=s=>s.duration??DURATION;
const snapshot=(s,now)=>({score:s.score,seq:s.seq,phase:s.phase,target:s.target,startedAt:s.startedAt,duration:sessionDuration(s),deadline:s.startedAt+sessionDuration(s),serverNow:now});

export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(origin!==env.ALLOWED_ORIGIN)return json({error:'Origine non autorisée.'},403);
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const respond=r=>{const h=new Headers(r.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});};
  if(request.method!=='POST')return respond(json({error:'Méthode non autorisée.'},405));
  const path=new URL(request.url).pathname;
  if(!['/resolve','/session','/shot','/reward'].includes(path))return respond(json({error:'Adresse inconnue.'},404));
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return respond(json({error:'Format incorrect.'},415));
  if(Number(request.headers.get('Content-Length')||0)>2048)return respond(json({error:'Requête trop grande.'},413));
  try{
   const text=await request.text();if(text.length>2048)return respond(json({error:'Requête trop grande.'},413));
   let body;try{body=JSON.parse(text);}catch{return respond(json({error:'Requête invalide.'},400));}
   if(!body||typeof body!=='object'||Array.isArray(body))return respond(json({error:'Requête invalide.'},400));
   if(path==='/resolve'){
    let token=body.token;
    if(Object.hasOwn(body,'legacy'))token=Object.keys(scanRoutes).find(k=>scanRoutes[k]===body.legacy);
    if(typeof token!=='string'||!Object.hasOwn(scanRoutes,token))return respond(json({error:'QR code inconnu.'},400));
    const ref=scanRoutes[token];
    return respond(json(ref==='empty'?{token,kind:'empty'}:{token,kind:'game',duration:durations[ref]}));
   }
   let rewards;try{rewards=JSON.parse(env.REWARDS_JSON);}catch{return respond(json({error:'Le jeu sera bientôt disponible.'},503));}
   if(!Object.keys(positions).every(k=>/^\d{2}$/.test(rewards?.[k])))return respond(json({error:'Le jeu sera bientôt disponible.'},503));
   if(path==='/session'){
    const ref=Object.hasOwn(body,'token')?(typeof body.token==='string'&&Object.hasOwn(scanRoutes,body.token)?scanRoutes[body.token]:undefined):body.ref;
    if(!Object.hasOwn(positions,ref))return respond(json({error:'QR code inconnu.'},400));
    // Limite souple par adresse réseau, conservée une heure sans stocker l’adresse brute.
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
    const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
    const gate=env.SESSIONS.get(env.SESSIONS.idFromName('rate:'+digest));
    const limit=await gate.fetch(new Request('https://internal/rate',{method:'POST'}));
    if(!limit.ok)return respond(limit);
    const session=crypto.randomUUID(),stub=env.SESSIONS.get(env.SESSIONS.idFromName('game:'+session));
    const r=await stub.fetch(new Request('https://internal/start',{method:'POST',body:JSON.stringify({ref})}));
    const d=await r.json();return respond(json({...d,session},r.status));
   }
   if(typeof body.session!=='string'||!/^[-a-f0-9]{36}$/.test(body.session))return respond(json({error:'Partie inconnue.'},400));
   const stub=env.SESSIONS.get(env.SESSIONS.idFromName('game:'+body.session));
   return respond(await stub.fetch(new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body)})));
  }catch{return respond(json({error:'Service momentanément indisponible. Réessaie.'},503));}
 }
};

// Le serveur compte les paniers et contrôle le temps : aucun score fourni par le joueur n’est accepté.
// La visée reste automatisable par un technicien : il s’agit d’une protection légère pour une animation.
export class GameSession {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){return this.ctx.blockConcurrencyWhile(()=>this.handle(request));}
 async handle(request){
  const path=new URL(request.url).pathname,now=Date.now(),store=this.ctx.storage;
  if(path==='/rate'){
   let rate=await store.get('rate');if(!rate||now>=rate.until)rate={count:0,until:now+3600000};
   // Plusieurs joueurs du salon peuvent partager la même connexion.
   if(rate.count>=600)return json({error:'Trop de parties sur cette connexion. Réessaie plus tard.'},429);
   rate.count++;await store.put('rate',rate);await store.setAlarm(rate.until);return json({ok:true});
  }
  const body=await request.json();
  if(path==='/start'){
   if(!Object.hasOwn(positions,body.ref))return json({error:'QR code inconnu.'},400);
   if(await store.get('game'))return json({error:'Partie déjà créée.'},409);
   const s={ref:body.ref,duration:durations[body.ref],startedAt:now,score:0,seq:0,phase:Math.random()*Math.PI*2,target:.5,lastShot:0,lastResponse:null};
   await store.put('game',s);await store.setAlarm(now+600000);return json(snapshot(s,now));
  }
  const s=await store.get('game');if(!s||now>s.startedAt+600000)return json({error:'Cette partie a expiré. Relance le défi.'},410);
  if(path==='/reward'){
   if(s.score<GOAL)return json({error:'Marque treize paniers pour obtenir ton indice.'},403);
   let rewards;try{rewards=JSON.parse(this.env.REWARDS_JSON);}catch{return json({error:'Indice indisponible.'},503);}
   return json({reward:rewards[s.ref],position:positions[s.ref]});
  }
  if(path!=='/shot')return json({error:'Adresse inconnue.'},404);
  if(!Number.isInteger(body.seq))return json({error:'Tir invalide.'},400);
  // Réessayer un appel ne peut jamais compter deux fois le même tir.
  if(body.seq===s.seq-1&&s.lastResponse)return json({...s.lastResponse,duration:sessionDuration(s),deadline:s.startedAt+sessionDuration(s)});
  if(body.seq!==s.seq)return json({error:'Tir déjà traité. Relance le défi.'},409);
  if(now>=s.startedAt+sessionDuration(s))return json({error:'Le temps est écoulé.'},410);
  if(s.score>=GOAL)return json({error:'Défi déjà terminé.'},409);
  if(s.lastShot&&now-s.lastShot<MIN_SHOT_INTERVAL)return json({error:'Attends la fin du tir.'},429);
  // Défi accessible : chaque tir accepté marque, sans test de visée.
  const hit=true;
  if(hit)s.score++;
  s.lastShot=now;s.seq++;
  
  const response={...snapshot(s,now),hit};s.lastResponse=response;
  await store.put('game',s);return json(response);
 }
 async alarm(){await this.ctx.storage.deleteAll();}
}
