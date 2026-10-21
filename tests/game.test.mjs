import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function game(search='?id=A',apiUrl='',fetchFn,pathname='/jeu/',tracker){
 const elements=new Map(),dots=Array.from({length:13},()=>({classList:{toggle(){}}}));let time=1900000000000,frame;
 const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,style:{},dataset:{},classList:{toggle(){}},getContext:()=>context2d});return elements.get(id);};
 get('result').hidden=true;get('shoot').disabled=true;
 const FakeDate=class extends Date{static now(){return time;}};
 const math=Object.create(Math);math.random=()=>0;
 class LoadedImage{constructor(){this.naturalWidth=1046;this.naturalHeight=1503;}set src(value){this.url=value;this.onload?.();}}
 const sandbox={Image:LoadedImage,document:{getElementById:get,querySelectorAll:()=>dots,addEventListener(){},body:{classList:{remove(){},add(){}}}},location:{search,pathname},window:{WAVE_CONFIG:{apiUrl},WaveHunt:tracker},URLSearchParams,performance:{now:()=>time},Date:FakeDate,Math:math,AbortSignal,fetch:fetchFn,requestAnimationFrame:f=>frame=f,WaveUI:{tone(){},shootSound(){},basketSound(){},missSound(){},isSoundEnabled:()=>true,disableSound(){},win(){},confetti(){},enableSound:async()=>true}};
 vm.runInNewContext(fs.readFileSync(new URL('../jeu/game.js',import.meta.url),'utf8'),sandbox);
 return {get,step(ms){time+=ms;frame(time);},advance(ms){time+=ms;},time:()=>time};
}
test('référence absente : pas de démarrage et aucune réponse divulguée',()=>{
 const g=game('');assert.equal(g.get('start').disabled,true);assert.match(g.get('mode').textContent,/Scanne/);assert.equal(g.get('reward').textContent,'');
});
test('mode entraînement : treize paniers en moins de quinze secondes déclenchent la fin sans divulguer un faux indice',async()=>{
 const g=game();await g.get('start').onclick();assert.equal(g.get('cover').hidden,true);assert.match(g.get('mode').textContent,/entraînement/i);
 const started=g.time();g.step(0);
 for(let score=0;score<13;score++){
  // Aucun alignement du curseur : un simple rythme d’appuis doit suffire.
  await g.get('shoot').onclick();g.step(180);
 }
 assert.ok(g.time()-started<4000,'Les 13 appuis doivent pouvoir se succéder en moins de quatre secondes, sans réseau');assert.equal(g.get('score').textContent,'13 / 13');assert.equal(g.get('result').hidden,false);assert.equal(g.get('play').hidden,true);assert.equal(g.get('reward').textContent,'');assert.match(g.get('resultNote').textContent,/activé/);
});
test('le temps écoulé termine le défi ; un nouvel essai remet le score à zéro',async()=>{
 const g=game();await g.get('start').onclick();g.step(15001);assert.equal(g.get('cover').hidden,false);assert.equal(g.get('shoot').disabled,true);assert.match(g.get('coverTitle').textContent,/écoulé/);await g.get('start').onclick();assert.equal(g.get('score').textContent,'0 / 13');assert.equal(g.get('timer').textContent,'00:15');
});
test('service inaccessible : erreur visible, aucun repli vers des indices locaux',async()=>{
 const g=game('?id=C','https://service.test',async()=>{throw Error('Hors ligne');});await g.get('start').onclick();assert.equal(g.get('cover').hidden,false);assert.equal(g.get('shoot').disabled,true);assert.equal(g.get('reward').textContent,'');assert.match(g.get('coverTitle').textContent,/indisponible/);
});
test('mode connecté : la réponse du serveur décide du score et du résultat',async()=>{
 let seq=0,serverTime=1900000000000,calls=[];
 const fetchFn=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(url.endsWith('/reward'))return Response.json({reward:'42',position:'right'});const d={session:'test',score:url.endsWith('/session')?0:++seq,seq,phase:0,target:.3,startedAt:1900000000000,deadline:1900000015000,serverNow:serverTime,hit:true};return Response.json(d);};
 const g=game('?id=C','https://service.test',fetchFn);await g.get('start').onclick();assert.equal(calls[0].body.ref,'C');
 for(let n=0;n<13;n++){serverTime=g.time();await g.get('shoot').onclick();g.step(350);g.step(50);}
 await new Promise(r=>setTimeout(r,0));assert.equal(g.get('score').textContent,'13 / 13');assert.equal(g.get('reward').textContent,'42');assert.equal(g.get('result').dataset.position,'center');assert.equal(g.get('resultTitle').textContent,'Tu as trouvé un indice !');assert.match(g.get('resultProgress').textContent,/réuni 1 indice sur 3/);assert.match(g.get('resultProgress').textContent,/Encore 2/);assert.match(g.get('resultNote').textContent,/capture d’écran/);assert.match(g.get('resultNote').textContent,/prochain QR code/);assert.equal(calls.filter(c=>c.url.endsWith('/reward')).length,1);assert.ok(calls.filter(c=>c.url.endsWith('/shot')).every(c=>!('score' in c.body)));
});
test('un lien neutre attend sa résolution et lance une partie avec son jeton, même si id est modifié',async()=>{
 const calls=[];
 const fetchFn=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(url.endsWith('/resolve'))return Response.json({kind:'game',token:'tfn3j5u4'});return Response.json({session:'test',score:0,seq:0,phase:0,target:.5,startedAt:1900000000000,deadline:1900000015000,serverNow:1900000000000});};
 const g=game('?id=C','https://service.test',fetchFn,'/Wave-coffre-mystere./s/tfn3j5u4/');
 assert.equal(g.get('start').disabled,true);await new Promise(r=>setTimeout(r,0));
 assert.equal(g.get('start').disabled,false);assert.equal(g.get('gameCard').hidden,false);assert.equal(g.get('loadingCard').hidden,true);
 await g.get('start').onclick();assert.deepEqual(calls.map(c=>c.body),[{token:'tfn3j5u4'},{token:'tfn3j5u4'}]);
 assert.equal(calls[1].url,'https://service.test/session');
});
test('un QR sans indice affiche le résultat dans la même page, sans créer de session',async()=>{
 const calls=[];const g=game('','https://service.test',async(url)=>{calls.push(url);return Response.json({kind:'empty',token:'4ubsj88k'});},'/s/4ubsj88k/');
 await new Promise(r=>setTimeout(r,0));assert.equal(g.get('emptyCard').hidden,false);assert.equal(g.get('gameCard').hidden,true);g.step(1);assert.equal(calls.length,1);
});
test('la résolution interrompue peut être relancée sans démarrer de chronomètre',async()=>{
 let attempts=0;const g=game('','https://service.test',async()=>{if(!attempts++)throw Error('Hors ligne');return Response.json({kind:'game',token:'tfn3j5u4'});},'/s/tfn3j5u4/');
 await new Promise(r=>setTimeout(r,0));assert.match(g.get('coverTitle').textContent,/indisponible/);assert.equal(g.get('start').disabled,false);
 await g.get('start').onclick();assert.equal(attempts,2);assert.equal(g.get('start').textContent,'Commencer le défi');assert.equal(g.get('shoot').disabled,true);
});
test('chaque QR affiche sa durée avant le départ puis expire selon la session serveur',async()=>{
 for(const [token,duration] of [['tfn3j5u4',15000],['vgyx24v5',13000],['emhvcxu4',11000]]){
  const startedAt=1900000000000;
  const fetchFn=async(url)=>Response.json(url.endsWith('/resolve')?{token,kind:'game',duration}:{session:'test',score:0,seq:0,phase:0,target:.5,startedAt,duration,deadline:startedAt+duration,serverNow:startedAt});
  const g=game('','https://service.test',fetchFn,'/s/'+token+'/');await new Promise(r=>setTimeout(r,0));
  assert.equal(g.get('timer').textContent,'00:'+duration/1000);assert.equal(g.get('challengeTitle').textContent,'13 paniers. '+duration/1000+' secondes.');
  assert.match(g.get('coverText').textContent,new RegExp(duration/1000+' secondes'));
  await g.get('start').onclick();g.step(duration-1);assert.equal(g.get('shoot').disabled,false);
  g.step(1);assert.equal(g.get('shoot').disabled,true);assert.match(g.get('coverTitle').textContent,/écoulé/);
 }
});
test('un indice est compté après sa révélation réussie, et le troisième termine la chasse',async()=>{
 let seq=0,rewards=0;const recorded=[];
 const fetchFn=async(url)=>{
  if(url.endsWith('/reward'))return ++rewards===1?Response.json({error:'Réessaie'},{status:503}):Response.json({reward:'42',position:'right'});
  return Response.json({session:'test',score:url.endsWith('/session')?0:++seq,seq,phase:0,target:.5,startedAt:1900000000000,deadline:1900000015000,hit:true});
 };
 const g=game('?id=C','https://service.test',fetchFn,'/jeu/',{record:position=>{recorded.push(position);return 3;}});
 await g.get('start').onclick();assert.equal(recorded.length,0);
 for(let n=0;n<13;n++){await g.get('shoot').onclick();g.step(180);}
 await new Promise(r=>setTimeout(r,0));assert.equal(g.get('retryReward').hidden,false);assert.equal(recorded.length,0);
 await g.get('retryReward').onclick();assert.deepEqual(recorded,['right']);assert.equal(g.get('reward').textContent,'42');
 assert.match(g.get('resultNote').textContent,/3 indices.*coffre/);assert.doesNotMatch(g.get('resultNote').textContent,/prochain QR/);assert.equal(g.get('resultProgress').textContent,'Tes 3 indices sont réunis !');
});
