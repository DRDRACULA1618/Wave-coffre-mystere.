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
test('les trois références renvoient chacune leur réponse après treize vrais tirs en quinze secondes, sans double comptage',async()=>{
 const {env,objects}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  for(const [ref,expected] of Object.entries(rewards)){
   const s=await (await api(env,'/session',{ref})).json(),obj=objects.get('game:'+s.session);
   for(let seq=0;seq<13;seq++){
    const state=await obj.ctx.storage.get('game');
    // Attend le passage dans la cible à partir d’au moins 0,4 seconde après le dernier tir.
    time+=400;
    while(Math.abs(.5+.44*Math.sin((time-state.startedAt)/220+state.phase)-state.target)>.05)time+=5;
    const response=await api(env,'/shot',{session:s.session,seq,score:100});assert.equal(response.status,200);
    const shot=await response.json();assert.equal(shot.hit,true);assert.equal(shot.score,seq+1);assert.equal(shot.reward,undefined);
    if(seq===11)assert.equal((await api(env,'/reward',{session:s.session})).status,403);
    const replay=await (await api(env,'/shot',{session:s.session,seq})).json();assert.equal(replay.score,seq+1);
   }
   const result=await (await api(env,'/reward',{session:s.session})).json();assert.equal(result.reward,expected);assert.equal(result.position,{A:'left',B:'center',C:'right'}[ref]);
  }
 }finally{Date.now=realNow;}
});
test('un tir manqué ne donne pas de point ; délai entre tirs et expiration sont imposés',async()=>{
 const {env,objects}=setup(),realNow=Date.now;let time=1900000000000;Date.now=()=>time;
 try{
  const s=await (await api(env,'/session',{ref:'B'})).json(),obj=objects.get('game:'+s.session),state=await obj.ctx.storage.get('game');
  time+=400;while(Math.abs(.5+.44*Math.sin((time-state.startedAt)/220+state.phase)-state.target)<.2)time+=5;
  const miss=await (await api(env,'/shot',{session:s.session,seq:0})).json();assert.equal(miss.hit,false);assert.equal(miss.score,0);
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
