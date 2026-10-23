const GOAL=13,DURATION=15000,MIN_SHOT_INTERVAL=150;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const positions={A:'left',B:'center',C:'right'};
const durations=Object.freeze({A:15000,B:30000,C:30000});
const activities=Object.freeze({A:'basket',B:'puzzle',C:'runner'});
const obstacles=[4500,8200,11900,15600,19300,23000,26700];
const safeJump=(at,jumps)=>jumps.some(t=>at-t>=120&&at-t<=1050);
function runnerCrash(s,now){const elapsed=Math.min(now-s.startedAt,sessionDuration(s));return obstacles.some(at=>at<=elapsed&&!safeJump(at,s.jumps));}
const puzzleScore=board=>board.reduce((n,p,i)=>n+(p===i),0);
function puzzleBoard(){const board=[0,1,2,3,4,5,6,7,8],order=[...board];for(let i=8;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}for(let i=0;i<6;i+=2){const a=order[i],b=order[i+1];[board[a],board[b]]=[board[b],board[a]];}return board;}
// Identifiants d'accès neutres : leur signification n'est jamais envoyée dans une URL.
const scanRoutes=Object.freeze({tfn3j5u4:'A',vgyx24v5:'B',emhvcxu4:'C','4ubsj88k':'empty'});
// Les parties déjà ouvertes avant cette mise à jour gardent leurs quinze secondes.
const sessionDuration=s=>s.duration??DURATION;
const snapshot=(s,now)=>({score:s.score,seq:s.seq,phase:s.phase,target:s.target,startedAt:s.startedAt,duration:sessionDuration(s),deadline:s.startedAt+sessionDuration(s),serverNow:now,...(s.activity==='puzzle'?{activity:'puzzle',board:s.board,goal:9}:s.activity==='runner'?{activity:'runner',jumps:s.jumps,obstacles,goal:obstacles.length,completed:s.completed}:{})});
const refs=['B','C','A'],legacyRefs=['A','B','C'],journeyLifetime=48*3600000;
const journeyOrder=j=>j.order||legacyRefs;
const gameWon=s=>s&&(s.activity==='runner'?s.completed===true:s.score>=(s.activity==='puzzle'?9:GOAL));
function makeGame(ref,now){
 const s={ref,duration:durations[ref],startedAt:now,score:0,seq:0,phase:Math.random()*Math.PI*2,target:.5,lastShot:0,lastResponse:null};
 if(ref==='B'){s.activity='puzzle';s.board=puzzleBoard();s.score=puzzleScore(s.board);}
 if(ref==='C'){s.activity='runner';s.jumps=[];s.completed=false;s.crashed=false;}
 return s;
}
const journeyView=(j,s,now)=>({journey:{stage:j.stage,ref:journeyOrder(j)[j.stage],order:journeyOrder(j),attempt:j.attempt,lives:j.lives,maxAttempts:2,maxLives:3,phase:j.phase,clues:j.clues},serverNow:now,...(j.phase==='playing'&&s?{...snapshot(s,now),activity:s.activity||'basket',run:s.run,won:gameWon(s)}:{})});
async function normalizeJourney(store,j,now){
 const s=await store.get('game');
 if(j.phase==='playing'&&s){
  if(s.activity==='runner'&&!s.crashed&&now>=s.startedAt+s.duration&&!runnerCrash(s,now)){s.completed=true;await store.put('game',s);}
  const lost=!gameWon(s)&&(now>=s.startedAt+s.duration||(s.activity==='runner'&&(s.crashed||runnerCrash(s,now))));
  if(lost&&!s.failed){s.failed=true;j.lives--;j.phase=j.lives>0?'ready':j.attempt===1?'failed':'locked';await store.put('game',s);await store.put('journey',j);}
 }
 return s;
}

export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(origin!==env.ALLOWED_ORIGIN)return json({error:'Origine non autorisée.'},403);
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const respond=r=>{const h=new Headers(r.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});};
  if(request.method!=='POST')return respond(json({error:'Méthode non autorisée.'},405));
  const path=new URL(request.url).pathname;
  if(!['/resolve','/session','/shot','/puzzle','/jump','/finish','/reward','/journey','/journey/start','/journey/fail','/journey/next','/journey/restart'].includes(path))return respond(json({error:'Adresse inconnue.'},404));
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
    const firstRef=ref==='A'?refs[0]:ref;
    return respond(json(ref==='empty'?{token,kind:'empty'}:{token,kind:'game',duration:durations[firstRef],activity:activities[firstRef],...(ref==='A'?{journey:true}:{})}));
   }
   let rewards;try{rewards=JSON.parse(env.REWARDS_JSON);}catch{return respond(json({error:'Le jeu sera bientôt disponible.'},503));}
   if(!Object.keys(positions).every(k=>/^\d{2}$/.test(rewards?.[k])))return respond(json({error:'Le jeu sera bientôt disponible.'},503));
   if(path==='/journey'){
    if(body.token!=='tfn3j5u4')return respond(json({error:'Scanne le QR du parcours.'},400));
    const existing=Object.hasOwn(body,'session');
    if(existing&&(typeof body.session!=='string'||!/^[-a-f0-9]{36}$/.test(body.session)))return respond(json({error:'Parcours inconnu.'},400));
    const session=existing?body.session:crypto.randomUUID(),stub=env.SESSIONS.get(env.SESSIONS.idFromName('game:'+session));
    if(!existing){
     const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||'unknown'));
     const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
     const gate=env.SESSIONS.get(env.SESSIONS.idFromName('rate:'+digest)),limit=await gate.fetch(new Request('https://internal/rate',{method:'POST'}));if(!limit.ok)return respond(limit);
    }
    const r=await stub.fetch(new Request('https://internal/journey',{method:'POST',body:JSON.stringify({create:!existing})}));
    return respond(json({...await r.json(),session},r.status));
   }
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
  let journey=await store.get('journey');
  if(path==='/journey'){
   if(!journey){if(!body.create)return json({error:'Ce parcours a expiré.'},410);journey={stage:0,order:[...refs],attempt:1,lives:3,phase:'ready',clues:[]};await store.put('journey',journey);await store.setAlarm(now+journeyLifetime);}
   else if(!journey.order){journey.order=journey.stage===0&&journey.phase==='ready'&&journey.clues.length===0?[...refs]:[...legacyRefs];await store.put('journey',journey);}
   const s=await normalizeJourney(store,journey,now);return json(journeyView(journey,s,now));
  }
  if(path.startsWith('/journey/')){
   if(!journey)return json({error:'Parcours inconnu.'},410);
   let s=await normalizeJourney(store,journey,now);
   if(path==='/journey/start'){
    if(journey.phase==='playing')return json(journeyView(journey,s,now));
    if(journey.phase!=='ready')return json({error:'Ce parcours ne peut pas démarrer.',...journeyView(journey,s,now)},409);
    s=makeGame(journeyOrder(journey)[journey.stage],now);s.run=crypto.randomUUID();journey.phase='playing';
    await store.put('game',s);await store.put('journey',journey);await store.setAlarm(now+journeyLifetime);return json(journeyView(journey,s,now));
   }
   if(path==='/journey/fail'){
    if(!s||body.run!==s.run)return json({error:'Cette manche n’est plus active.',...journeyView(journey,s,now)},409);
    if(journey.phase==='playing')return json({error:'La manche est toujours en cours.',...journeyView(journey,s,now)},409);
    return json(journeyView(journey,s,now));
   }
   if(path==='/journey/next'){
    if(Number.isInteger(body.stage)&&journey.stage===body.stage+1)return json(journeyView(journey,s,now));
    if(journey.phase!=='revealed'||body.stage!==journey.stage||journey.stage>=2)return json({error:'Termine le défi en cours pour continuer.'},403);
    journey.stage++;journey.phase='ready';await store.put('journey',journey);await store.delete('game');return json(journeyView(journey,null,now));
   }
   if(path==='/journey/restart'){
    if(journey.attempt===2&&body.attempt===1)return json(journeyView(journey,s,now));
    if(journey.phase!=='failed'||journey.attempt!==1||body.attempt!==1)return json({error:'Les deux tentatives sont utilisées.',...journeyView(journey,s,now)},403);
    journey={stage:0,order:[...refs],attempt:2,lives:3,phase:'ready',clues:[]};await store.put('journey',journey);await store.delete('game');return json(journeyView(journey,null,now));
   }
   return json({error:'Adresse inconnue.'},404);
  }
  if(path==='/start'){
   if(!Object.hasOwn(positions,body.ref))return json({error:'QR code inconnu.'},400);
   if(await store.get('game'))return json({error:'Partie déjà créée.'},409);
   const s=makeGame(body.ref,now);
   await store.put('game',s);await store.setAlarm(now+600000);return json(snapshot(s,now));
  }
  const s=await store.get('game');if(!s||(!journey&&now>s.startedAt+600000))return json({error:'Cette partie a expiré. Relance le défi.'},410);
  if(journey&&(body.run!==s.run||!['playing','revealed','complete'].includes(journey.phase)))return json({error:'Cette manche n’est plus active.'},409);
  if(path==='/reward'){
   if(s.activity==='runner'?!s.completed:s.score<(s.activity==='puzzle'?9:GOAL))return json({error:s.activity==='puzzle'?'Reconstitue le pingouin pour obtenir ton indice.':s.activity==='runner'?'Évite les obstacles pendant trente secondes pour obtenir ton indice.':'Marque treize paniers pour obtenir ton indice.'},403);
   let rewards;try{rewards=JSON.parse(this.env.REWARDS_JSON);}catch{return json({error:'Indice indisponible.'},503);}
   if(journey){
    if(!journey.clues.some(c=>c.position===positions[s.ref]))journey.clues.push({reward:rewards[s.ref],position:positions[s.ref]});
    journey.phase=journey.stage===2?'complete':'revealed';await store.put('journey',journey);
   }
   return json({reward:rewards[s.ref],position:positions[s.ref],...(journey?journeyView(journey,s,now):{})});
  }
  if(path==='/jump'||path==='/finish'){
   if(s.activity!=='runner')return json({error:'Ce défi n’est pas une course.'},400);
   if(s.crashed||runnerCrash(s,now)){s.crashed=true;await store.put('game',s);return json({error:'Obstacle touché ! Retente la course.'},410);}
   s.score=obstacles.filter(at=>at<=Math.min(now-s.startedAt,sessionDuration(s))).length;
   if(path==='/finish'){
    if(now<s.startedAt+sessionDuration(s))return json({error:'Continue jusqu’à la fin des trente secondes.'},403);
    s.completed=true;await store.put('game',s);return json(snapshot(s,now));
   }
   if(!Number.isInteger(body.seq))return json({error:'Saut invalide.'},400);
   if(body.seq===s.seq-1&&s.lastResponse)return json(s.lastResponse);
   if(body.seq!==s.seq)return json({error:'Saut déjà traité. Relance la course.'},409);
   if(now>=s.startedAt+sessionDuration(s))return json({error:'La course est terminée.'},410);
   const elapsed=now-s.startedAt;
   if(s.jumps.length&&elapsed-s.jumps.at(-1)<1200)return json({error:'Attends que le pingouin retombe.'},429);
   s.jumps.push(elapsed);s.seq++;
   const response=snapshot(s,now);s.lastResponse=response;await store.put('game',s);return json(response);
  }
  if(path==='/puzzle'){
   if(s.activity!=='puzzle')return json({error:'Ce défi n’est pas un puzzle.'},400);
   if(!Number.isInteger(body.seq)||!Number.isInteger(body.from)||!Number.isInteger(body.to)||body.from<0||body.from>8||body.to<0||body.to>8||body.from===body.to)return json({error:'Échange invalide.'},400);
   if(body.seq===s.seq-1&&s.lastResponse)return json(s.lastResponse);
   if(body.seq!==s.seq)return json({error:'Échange déjà traité. Relance le puzzle.'},409);
   if(now>=s.startedAt+sessionDuration(s))return json({error:'Le temps est écoulé.'},410);
   if(s.score===9)return json({error:'Puzzle déjà terminé.'},409);
   [s.board[body.from],s.board[body.to]]=[s.board[body.to],s.board[body.from]];
   s.score=puzzleScore(s.board);s.seq++;
   const response=snapshot(s,now);s.lastResponse=response;await store.put('game',s);return json(response);
  }
  if(path!=='/shot')return json({error:'Adresse inconnue.'},404);
  if(s.activity==='puzzle'||s.activity==='runner')return json({error:'Utilise les commandes de ce défi.'},400);
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
