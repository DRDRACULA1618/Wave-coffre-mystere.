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

export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(origin!==env.ALLOWED_ORIGIN)return json({error:'Origine non autorisée.'},403);
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const respond=r=>{const h=new Headers(r.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});};
  if(request.method!=='POST')return respond(json({error:'Méthode non autorisée.'},405));
  const path=new URL(request.url).pathname;
  if(!['/resolve','/session','/shot','/puzzle','/jump','/finish','/reward'].includes(path))return respond(json({error:'Adresse inconnue.'},404));
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
    return respond(json(ref==='empty'?{token,kind:'empty'}:{token,kind:'game',duration:durations[ref],activity:activities[ref]}));
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
   if(body.ref==='B'){s.activity='puzzle';s.board=puzzleBoard();s.score=puzzleScore(s.board);}
   if(body.ref==='C'){s.activity='runner';s.jumps=[];s.completed=false;s.crashed=false;}
   await store.put('game',s);await store.setAlarm(now+600000);return json(snapshot(s,now));
  }
  const s=await store.get('game');if(!s||now>s.startedAt+600000)return json({error:'Cette partie a expiré. Relance le défi.'},410);
  if(path==='/reward'){
   if(s.activity==='runner'?!s.completed:s.score<(s.activity==='puzzle'?9:GOAL))return json({error:s.activity==='puzzle'?'Reconstitue le pingouin pour obtenir ton indice.':s.activity==='runner'?'Évite les obstacles pendant trente secondes pour obtenir ton indice.':'Marque treize paniers pour obtenir ton indice.'},403);
   let rewards;try{rewards=JSON.parse(this.env.REWARDS_JSON);}catch{return json({error:'Indice indisponible.'},503);}
   return json({reward:rewards[s.ref],position:positions[s.ref]});
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
