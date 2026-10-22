import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker,{ GameSession } from '../cloudflare/worker.js';

// Réponses fictives : les vrais indices sont exclusivement des secrets Cloudflare.
const rewards={A:'21',B:'34',C:'56'};
class MemoryContext {
 constructor(){this.values=new Map();this.storage={get:async k=>structuredClone(this.values.get(k)),put:async(k,v)=>this.values.set(k,structuredClone(v)),delete:async k=>this.values.delete(k),setAlarm:async t=>{this.alarm=t;},deleteAll:async()=>this.values.clear()};}
 blockConcurrencyWhile(fn){return fn();}
}
function setup(){const objects=new Map(),env={REWARDS_JSON:JSON.stringify(rewards),ALLOWED_ORIGIN:'https://example.org'};env.SESSIONS={idFromName:n=>n,get(id){if(!objects.has(id))objects.set(id,new GameSession(new MemoryContext(),env));return objects.get(id);}};return {env,objects};}
function api(env,path,body={},extra={}){return worker.fetch(new Request('https://service.test'+path,{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json',...extra},body:JSON.stringify(body)}),env);}
test('une session ne révèle aucun indice avant treize paniers calculés par le serveur',async()=>{
 const {env,objects}=setup();
 const r=await api(env,'/session',{ref:'A'});assert.equal(r.status,200);const s=await r.json();assert.equal(s.score,0);assert.equal(s.reward,undefined);
 const bad=await api(env,'/reward',{session:s.session,score:13});assert.equal(bad.status,403);
 const object=objects.get('game:'+s.session),saved=await object.ctx.storage.get('game');assert.equal(saved.score,0);
});
test('le basket renvoie son indice après treize tirs dans sa durée, sans double comptage',async()=>{
 const {env,objects}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  for(const [ref,expected] of [['A',rewards.A]]){
   const s=await (await api(env,'/session',{ref})).json();
   assert.equal(s.duration,{A:15000,B:13000,C:11000}[ref]);
   for(let seq=0;seq<13;seq++){
    // Appuis irréguliers, sans attendre une position particulière de la visée.
    time+=180+(seq%4)*70;
    const response=await api(env,'/shot',{session:s.session,seq,score:100});assert.equal(response.status,200);
    const shot=await response.json();assert.equal(shot.hit,true);assert.equal(shot.score,seq+1);assert.equal(shot.reward,undefined);
    if(seq===11)assert.equal((await api(env,'/reward',{session:s.session})).status,403);
    const replay=await (await api(env,'/shot',{session:s.session,seq})).json();assert.equal(replay.score,seq+1);
   }
   assert.ok(time<s.deadline);
   const result=await (await api(env,'/reward',{session:s.session})).json();assert.equal(result.reward,expected);assert.equal(result.position,{A:'left',B:'center',C:'right'}[ref]);
  }
 }finally{Date.now=realNow;}
});
test('chaque tir accepté marque, avec délai entre tirs et expiration toujours imposés',async()=>{
 const {env,objects}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const s=await (await api(env,'/session',{ref:'A'})).json(),obj=objects.get('game:'+s.session),state=await obj.ctx.storage.get('game');
  time+=180;
  const shot=await (await api(env,'/shot',{session:s.session,seq:0})).json();assert.equal(shot.hit,true);assert.equal(shot.score,1);
  assert.equal((await api(env,'/shot',{session:s.session,seq:1})).status,429);
  assert.equal((await api(env,'/shot',{session:s.session,seq:2})).status,409);
  time=state.startedAt+15000;assert.equal((await api(env,'/shot',{session:s.session,seq:1})).status,410);
  await obj.alarm();assert.equal((await api(env,'/reward',{session:s.session})).status,410);
 }finally{Date.now=realNow;}
});
test('configuration absente, référence invalide, sessions inventées et origines étrangères sont refusées',async()=>{
 const {env}=setup();
 assert.equal((await api(env,'/session',{ref:'A'},{Origin:'https://evil.test'})).status,403);
 assert.equal((await api(env,'/session',{ref:'toString'})).status,400);
 assert.equal((await api(env,'/shot',{session:'x',seq:0})).status,400);
 assert.equal((await api(env,'/reward',{session:crypto.randomUUID()})).status,410);
 const preflight=await worker.fetch(new Request('https://service.test/session',{method:'OPTIONS',headers:{Origin:env.ALLOWED_ORIGIN}}),env);assert.equal(preflight.status,204);
 delete env.REWARDS_JSON;assert.equal((await api(env,'/session',{ref:'A'})).status,503);
});
test('limite réseau et nettoyage du compteur',async()=>{
 const {env}=setup(),obj=new GameSession(new MemoryContext(),env);
 for(let n=0;n<600;n++)assert.equal((await obj.fetch(new Request('https://internal/rate',{method:'POST'}))).status,200);
 assert.equal((await obj.fetch(new Request('https://internal/rate',{method:'POST'}))).status,429);
 await obj.alarm();assert.equal((await obj.fetch(new Request('https://internal/rate',{method:'POST'}))).status,200);
});
test('un tir à l’extrémité de l’ancienne jauge marque aussi un panier',async()=>{
 const {env,objects}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const session=await (await api(env,'/session',{ref:'A'})).json(),obj=objects.get('game:'+session.session),state=await obj.ctx.storage.get('game');
  time+=400;
  for(let steps=0;steps<1000;steps++){
   const distance=Math.abs(.5+.44*Math.sin((time-state.startedAt)/300+state.phase)-state.target);
   if(distance>.43)break;
   time+=5;
  }
  const shot=await (await api(env,'/shot',{session:session.session,seq:0})).json();assert.equal(shot.hit,true);assert.equal(shot.score,1);
 }finally{Date.now=realNow;}
});
test('les nouveaux identifiants et les anciens liens se résolvent sans transmettre les indices ni leur position',async()=>{
 const {env}=setup();
 for(const [legacy,token] of Object.entries({A:'tfn3j5u4',B:'vgyx24v5',C:'emhvcxu4',empty:'4ubsj88k'})){
  for(const body of [{token},{legacy}]){
   const r=await api(env,'/resolve',body);assert.equal(r.status,200);
   assert.deepEqual(await r.json(),legacy==='empty'?{token,kind:'empty'}:{token,kind:'game',duration:{A:15000,B:30000,C:30000}[legacy],activity:{A:'basket',B:'puzzle',C:'runner'}[legacy],...(legacy==='A'?{journey:true}:{})});
  }
 }
 for(const body of [{token:'toString'},{token:'xxxxxxxx'},{legacy:'toString'},{}])assert.equal((await api(env,'/resolve',body)).status,400);
 assert.equal((await api(env,'/resolve',{token:'tfn3j5u4'},{Origin:'https://evil.test'})).status,403);
});
test('la durée propre au QR est imposée par le serveur, même si le client en propose une autre',async()=>{
 const {env}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  for(const [ref,token,duration] of [['A','tfn3j5u4',15000]]){
   for(const body of [{ref,duration:999999},{token,ref:'A',duration:999999}]){
    const response=await api(env,'/session',body);assert.equal(response.status,200);
    const s=await response.json();assert.equal(s.duration,duration);assert.equal(s.deadline-s.startedAt,duration);
    time=s.deadline-1;
    const accepted=await api(env,'/shot',{session:s.session,seq:0,duration:999999});assert.equal(accepted.status,200);
    const shot=await accepted.json();assert.equal(shot.hit,true);assert.equal(shot.duration,duration);assert.equal(shot.deadline,s.deadline);
    time=s.deadline;
    assert.equal((await api(env,'/shot',{session:s.session,seq:1,duration:999999})).status,410);
   }
  }
 }finally{Date.now=realNow;}
});
test('une ancienne partie sans durée enregistrée conserve quinze secondes et les mêmes indices',async()=>{
 const {env,objects}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const s=await (await api(env,'/session',{ref:'A'})).json(),obj=objects.get('game:'+s.session),saved=await obj.ctx.storage.get('game');
  saved.ref='C';delete saved.duration;await obj.ctx.storage.put('game',saved);
  time=s.startedAt+11000;
  const accepted=await api(env,'/shot',{session:s.session,seq:0});assert.equal(accepted.status,200);
  const shot=await accepted.json();assert.equal(shot.duration,15000);assert.equal(shot.deadline,s.startedAt+15000);assert.equal(shot.score,1);
  const replay=await (await api(env,'/shot',{session:s.session,seq:0})).json();assert.equal(replay.duration,15000);assert.equal(replay.score,1);
  for(let seq=1;seq<13;seq++){
   time+=180;assert.equal((await api(env,'/shot',{session:s.session,seq})).status,200);
  }
  const reward=await (await api(env,'/reward',{session:s.session})).json();assert.equal(reward.reward,rewards.C);
  time=s.startedAt+15000;
  assert.equal((await api(env,'/shot',{session:s.session,seq:13})).status,410);
 }finally{Date.now=realNow;}
});

test('le puzzle B vérifie les échanges, les doublons et les neuf pièces avant de révéler son indice',async()=>{
 const {env}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const s=await (await api(env,'/session',{token:'vgyx24v5',ref:'A',duration:999999})).json();
  assert.equal(s.activity,'puzzle');assert.equal(s.duration,30000);assert.equal(s.goal,9);assert.equal(new Set(s.board).size,9);assert.equal(s.score,3);
  assert.equal((await api(env,'/reward',{session:s.session,score:9,board:[0,1,2,3,4,5,6,7,8]})).status,403);
  assert.equal((await api(env,'/shot',{session:s.session,seq:0})).status,400);
  assert.equal((await api(env,'/puzzle',{session:s.session,seq:0,from:-1,to:8})).status,400);
  assert.equal((await api(env,'/puzzle',{session:s.session,seq:0,from:2,to:2})).status,400);
  let board=s.board,seq=0;
  for(let i=0;i<9;i++)if(board[i]!==i){
   const body={session:s.session,seq,from:i,to:board.indexOf(i)};time+=400;
   const response=await api(env,'/puzzle',body);assert.equal(response.status,200);const d=await response.json();board=d.board;seq=d.seq;
   const replay=await (await api(env,'/puzzle',body)).json();assert.deepEqual(replay.board,board);assert.equal(replay.seq,seq);
  }
  assert.deepEqual(board,[0,1,2,3,4,5,6,7,8]);
  const reward=await (await api(env,'/reward',{session:s.session})).json();assert.deepEqual(reward,{reward:rewards.B,position:'center'});
  const expired=await (await api(env,'/session',{ref:'B'})).json();time=expired.deadline;
  assert.equal((await api(env,'/puzzle',{session:expired.session,seq:0,from:0,to:1})).status,410);
  assert.equal((await api(env,'/reward',{session:expired.session,score:9})).status,403);
 }finally{Date.now=realNow;}
});

test('la course C dure trente secondes et impose les sauts avant chacun des obstacles',async()=>{
 const {env}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const s=await (await api(env,'/session',{token:'emhvcxu4',ref:'A',duration:999999})).json();
  assert.equal(s.activity,'runner');assert.equal(s.duration,30000);assert.equal(s.goal,7);
  assert.equal((await api(env,'/reward',{session:s.session,score:13,completed:true})).status,403);
  assert.equal((await api(env,'/finish',{session:s.session})).status,403);
  assert.equal((await api(env,'/shot',{session:s.session,seq:0})).status,400);
  assert.equal((await api(env,'/puzzle',{session:s.session,seq:0,from:0,to:1})).status,400);
  let seq=0;
  for(const obstacle of s.obstacles){
   time=s.startedAt+obstacle-500;const body={session:s.session,seq};
   const r=await api(env,'/jump',body);assert.equal(r.status,200);const jump=await r.json();seq=jump.seq;
   const replay=await (await api(env,'/jump',body)).json();assert.deepEqual(replay.jumps,jump.jumps);
   assert.equal((await api(env,'/jump',{session:s.session,seq})).status,429);
  }
  time=s.deadline-1;assert.equal((await api(env,'/finish',{session:s.session})).status,403);
  time=s.deadline;const done=await api(env,'/finish',{session:s.session});assert.equal(done.status,200);assert.equal((await done.json()).completed,true);
  assert.deepEqual(await (await api(env,'/reward',{session:s.session})).json(),{reward:rewards.C,position:'right'});
  const lost=await (await api(env,'/session',{ref:'C'})).json();time=lost.startedAt+lost.obstacles[0]+1;
  assert.equal((await api(env,'/jump',{session:lost.session,seq:0})).status,410);
  time=lost.deadline;assert.equal((await api(env,'/finish',{session:lost.session,completed:true})).status,410);
  assert.equal((await api(env,'/reward',{session:lost.session})).status,403);
 }finally{Date.now=realNow;}
});
test('la référence est imposée par le jeton serveur, et le QR sans indice ne peut pas ouvrir de partie',async()=>{
 const {env,objects}=setup();
 for(const [expected,token] of Object.entries({A:'tfn3j5u4',B:'vgyx24v5',C:'emhvcxu4'})){
  const r=await api(env,'/session',{token,ref:'C'});assert.equal(r.status,200);const s=await r.json();
  assert.equal((await objects.get('game:'+s.session).ctx.storage.get('game')).ref,expected);
  assert.equal((await api(env,'/reward',{session:s.session})).status,403);
 }
 for(const token of ['4ubsj88k','xxxxxxxx','toString'])assert.equal((await api(env,'/session',{token,ref:'A'})).status,400);
});

test('le parcours unique impose A puis B puis C, conserve les indices et partage les vies entre les défis',async()=>{
 const {env}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const opened=await (await api(env,'/journey',{token:'tfn3j5u4'})).json(),session=opened.session;
  assert.equal(opened.journey.stage,0);assert.equal(opened.journey.lives,3);assert.deepEqual(opened.journey.clues,[]);
  assert.equal((await api(env,'/journey/next',{session,stage:0})).status,403);
  let a=await (await api(env,'/journey/start',{session,ref:'C',stage:2})).json();assert.equal(a.activity,'basket');
  assert.equal((await (await api(env,'/journey/start',{session})).json()).run,a.run);
  assert.equal((await api(env,'/journey/fail',{session,run:a.run})).status,409);
  assert.equal((await api(env,'/reward',{session,run:a.run,score:13})).status,403);
  for(let seq=0;seq<13;seq++){time+=200;assert.equal((await api(env,'/shot',{session,run:a.run,seq})).status,200);}
  const ra=await (await api(env,'/reward',{session,run:a.run})).json();assert.equal(ra.journey.phase,'revealed');assert.equal(ra.journey.clues.length,1);assert.equal(ra.journey.lives,3);
  assert.equal((await (await api(env,'/reward',{session,run:a.run})).json()).journey.clues.length,1);
  const next=await (await api(env,'/journey/next',{session,stage:0})).json();assert.equal(next.journey.stage,1);assert.equal(next.journey.clues[0].reward,rewards.A);
  assert.equal((await (await api(env,'/journey/next',{session,stage:0})).json()).journey.stage,1);
  let b=await (await api(env,'/journey/start',{session})).json();assert.equal(b.activity,'puzzle');assert.equal(b.duration,30000);
  assert.equal((await api(env,'/shot',{session,run:a.run,seq:0})).status,409);
  time=b.deadline;let loss=await (await api(env,'/journey/fail',{session,run:b.run})).json();assert.equal(loss.journey.lives,2);assert.equal(loss.journey.stage,1);
  assert.equal((await (await api(env,'/journey/fail',{session,run:b.run})).json()).journey.lives,2);
  assert.equal((await (await api(env,'/journey',{token:'tfn3j5u4',session})).json()).journey.lives,2);
  b=await (await api(env,'/journey/start',{session})).json();let board=b.board,seq=0;
  for(let i=0;i<9;i++)if(board[i]!==i){time+=200;const d=await (await api(env,'/puzzle',{session,run:b.run,seq,from:i,to:board.indexOf(i)})).json();board=d.board;seq=d.seq;}
  const rb=await (await api(env,'/reward',{session,run:b.run})).json();assert.equal(rb.journey.clues.length,2);assert.equal(rb.journey.lives,2);
  await api(env,'/journey/next',{session,stage:1});
  let c=await (await api(env,'/journey/start',{session})).json();time=c.startedAt+4501;
  loss=await (await api(env,'/journey/fail',{session,run:c.run})).json();assert.equal(loss.journey.lives,1);assert.equal(loss.journey.stage,2);
  c=await (await api(env,'/journey/start',{session})).json();seq=0;
  for(const at of c.obstacles){time=c.startedAt+at-500;const d=await (await api(env,'/jump',{session,run:c.run,seq})).json();seq=d.seq;}
  time=c.deadline;assert.equal((await api(env,'/finish',{session,run:c.run})).status,200);
  const rc=await (await api(env,'/reward',{session,run:c.run})).json();assert.equal(rc.journey.phase,'complete');assert.equal(rc.journey.lives,1);assert.deepEqual(rc.journey.clues.map(c=>c.reward),[rewards.A,rewards.B,rewards.C]);
  const resumed=await (await api(env,'/journey',{token:'tfn3j5u4',session})).json();assert.equal(resumed.journey.phase,'complete');assert.equal(resumed.journey.clues.length,3);
  assert.equal((await api(env,'/journey/start',{session})).status,409);
 }finally{Date.now=realNow;}
});

test('trois échecs donnent une seule seconde tentative ; recharger ou doubler un appel ne remet pas les vies à zéro',async()=>{
 const {env}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const opened=await (await api(env,'/journey',{token:'tfn3j5u4'})).json(),session=opened.session;
  for(let attempt=1;attempt<=2;attempt++){
   for(let n=0;n<3;n++){
    const s=await (await api(env,'/journey/start',{session})).json();
    const playing=await (await api(env,'/journey',{session,token:'tfn3j5u4'})).json();assert.equal(playing.run,s.run);assert.equal(playing.deadline,s.deadline);
    if(attempt===2&&n===0){const replay=await (await api(env,'/journey/restart',{session,attempt:1})).json();assert.equal(replay.run,s.run);assert.equal(replay.journey.phase,'playing');}
    time=s.deadline;
    const failed=await (await api(env,'/journey/fail',{session,run:s.run})).json();assert.equal(failed.journey.lives,2-n);assert.equal(failed.journey.attempt,attempt);
    const replay=await (await api(env,'/journey/fail',{session,run:s.run})).json();assert.equal(replay.journey.lives,2-n);
   }
   const stopped=await (await api(env,'/journey',{session,token:'tfn3j5u4'})).json();assert.equal(stopped.journey.phase,attempt===1?'failed':'locked');
   assert.equal((await api(env,'/journey/start',{session})).status,409);
   if(attempt===1){const restarted=await (await api(env,'/journey/restart',{session,attempt:1})).json();assert.equal(restarted.journey.attempt,2);assert.equal(restarted.journey.lives,3);assert.equal(restarted.journey.stage,0);assert.deepEqual(restarted.journey.clues,[]);}
  }
  assert.equal((await api(env,'/journey/restart',{session,attempt:2})).status,403);
  const locked=await (await api(env,'/journey',{session,token:'tfn3j5u4'})).json();assert.equal(locked.journey.phase,'locked');assert.equal(locked.journey.lives,0);
  assert.equal((await api(env,'/journey',{token:'vgyx24v5'})).status,400);
 }finally{Date.now=realNow;}
});
