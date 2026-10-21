import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker,{ GameSession } from '../cloudflare/worker.js';

// Réponses fictives : les vrais indices sont exclusivement des secrets Cloudflare.
const rewards={A:'21',B:'34',C:'56'};
class MemoryContext {
 constructor(){this.values=new Map();this.storage={get:async k=>structuredClone(this.values.get(k)),put:async(k,v)=>this.values.set(k,structuredClone(v)),setAlarm:async t=>{this.alarm=t;},deleteAll:async()=>this.values.clear()};}
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
test('les trois références renvoient chacune leur réponse après treize tirs dans leur durée, sans double comptage',async()=>{
 const {env,objects}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  for(const [ref,expected] of Object.entries(rewards)){
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
  const s=await (await api(env,'/session',{ref:'B'})).json(),obj=objects.get('game:'+s.session),state=await obj.ctx.storage.get('game');
  time+=180;
  const shot=await (await api(env,'/shot',{session:s.session,seq:0})).json();assert.equal(shot.hit,true);assert.equal(shot.score,1);
  assert.equal((await api(env,'/shot',{session:s.session,seq:1})).status,429);
  assert.equal((await api(env,'/shot',{session:s.session,seq:2})).status,409);
  time=state.startedAt+13000;assert.equal((await api(env,'/shot',{session:s.session,seq:1})).status,410);
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
   assert.deepEqual(await r.json(),legacy==='empty'?{token,kind:'empty'}:{token,kind:'game',duration:{A:15000,B:13000,C:11000}[legacy]});
  }
 }
 for(const body of [{token:'toString'},{token:'xxxxxxxx'},{legacy:'toString'},{}])assert.equal((await api(env,'/resolve',body)).status,400);
 assert.equal((await api(env,'/resolve',{token:'tfn3j5u4'},{Origin:'https://evil.test'})).status,403);
});
test('la durée propre au QR est imposée par le serveur, même si le client en propose une autre',async()=>{
 const {env}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  for(const [ref,token,duration] of [['A','tfn3j5u4',15000],['B','vgyx24v5',13000],['C','emhvcxu4',11000]]){
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
  const s=await (await api(env,'/session',{ref:'C'})).json(),obj=objects.get('game:'+s.session),saved=await obj.ctx.storage.get('game');
  assert.equal(s.duration,11000);delete saved.duration;await obj.ctx.storage.put('game',saved);
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
test('la référence est imposée par le jeton serveur, et le QR sans indice ne peut pas ouvrir de partie',async()=>{
 const {env,objects}=setup();
 for(const [expected,token] of Object.entries({A:'tfn3j5u4',B:'vgyx24v5',C:'emhvcxu4'})){
  const r=await api(env,'/session',{token,ref:'C'});assert.equal(r.status,200);const s=await r.json();
  assert.equal((await objects.get('game:'+s.session).ctx.storage.get('game')).ref,expected);
  assert.equal((await api(env,'/reward',{session:s.session})).status,403);
 }
 for(const token of ['4ubsj88k','xxxxxxxx','toString'])assert.equal((await api(env,'/session',{token,ref:'A'})).status,400);
});
