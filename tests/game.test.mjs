import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function game(search='?id=A',apiUrl='',fetchFn){
 const elements=new Map(),dots=Array.from({length:5},()=>({classList:{toggle(){}}}));let time=1900000000000,frame;
 const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,style:{},dataset:{},classList:{toggle(){}},getContext:()=>context2d});return elements.get(id);};
 get('result').hidden=true;get('shoot').disabled=true;
 const FakeDate=class extends Date{static now(){return time;}};
 const math=Object.create(Math);math.random=()=>0;
 const sandbox={document:{getElementById:get,querySelectorAll:()=>dots,addEventListener(){}},location:{search},window:{WAVE_CONFIG:{apiUrl}},URLSearchParams,performance:{now:()=>time},Date:FakeDate,Math:math,AbortSignal,fetch:fetchFn,requestAnimationFrame:f=>frame=f,WaveUI:{tone(){},win(){},confetti(){},enableSound:async()=>true}};
 vm.runInNewContext(fs.readFileSync(new URL('../jeu/game.js',import.meta.url),'utf8'),sandbox);
 return {get,step(ms){time+=ms;frame(time);},advance(ms){time+=ms;},time:()=>time};
}
test('référence absente : pas de démarrage et aucune réponse divulguée',()=>{
 const g=game('');assert.equal(g.get('start').disabled,true);assert.match(g.get('mode').textContent,/Scanne/);assert.equal(g.get('reward').textContent,'');
});
test('mode entraînement : cinq paniers déclenchent la fin sans divulguer un faux indice',async()=>{
 const g=game();await g.get('start').onclick();assert.equal(g.get('cover').hidden,true);assert.match(g.get('mode').textContent,/entraînement/);
 const started=g.time();g.step(0);
 for(let score=0;score<5;score++){
  const target=parseFloat(g.get('zone').style.left)/100+.095;
  while(Math.abs(.5+.44*Math.sin((g.time()-started)/570)-target)>.06)g.advance(5);
  await g.get('shoot').onclick();g.step(900);g.step(1200);
 }
 assert.equal(g.get('score').textContent,'5 / 5');assert.equal(g.get('result').hidden,false);assert.equal(g.get('play').hidden,true);assert.equal(g.get('reward').textContent,'');assert.match(g.get('resultNote').textContent,/activé/);
});
test('le temps écoulé termine le défi ; un nouvel essai remet le score à zéro',async()=>{
 const g=game();await g.get('start').onclick();g.step(60001);assert.equal(g.get('cover').hidden,false);assert.equal(g.get('shoot').disabled,true);assert.match(g.get('coverTitle').textContent,/écoulé/);await g.get('start').onclick();assert.equal(g.get('score').textContent,'0 / 5');assert.equal(g.get('timer').textContent,'01:00');
});
test('service inaccessible : erreur visible, aucun repli vers des indices locaux',async()=>{
 const g=game('?id=C','https://service.test',async()=>{throw Error('Hors ligne');});await g.get('start').onclick();assert.equal(g.get('cover').hidden,false);assert.equal(g.get('shoot').disabled,true);assert.equal(g.get('reward').textContent,'');assert.match(g.get('coverTitle').textContent,/indisponible/);
});
test('mode connecté : la réponse du serveur décide du score et du résultat',async()=>{
 let seq=0,serverTime=1900000000000,calls=[];
 const fetchFn=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(url.endsWith('/reward'))return Response.json({reward:'42',position:'right'});const d={session:'test',score:url.endsWith('/session')?0:++seq,seq,phase:0,target:.3,startedAt:1900000000000,deadline:1900000060000,serverNow:serverTime,hit:true};return Response.json(d);};
 const g=game('?id=C','https://service.test',fetchFn);await g.get('start').onclick();assert.equal(calls[0].body.ref,'C');
 for(let n=0;n<5;n++){serverTime=g.time();await g.get('shoot').onclick();g.step(900);g.step(1200);}
 await new Promise(r=>setTimeout(r,0));assert.equal(g.get('score').textContent,'5 / 5');assert.equal(g.get('reward').textContent,'42');assert.equal(g.get('result').dataset.position,'right');assert.equal(calls.filter(c=>c.url.endsWith('/reward')).length,1);assert.ok(calls.filter(c=>c.url.endsWith('/shot')).every(c=>!('score' in c.body)));
});
