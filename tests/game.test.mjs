import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker,{GameSession} from '../cloudflare/worker.js';

function game(search='?id=A',apiUrl='',fetchFn,pathname='/jeu/',tracker,storage=new Map()){
 const elements=new Map(),dots=Array.from({length:13},()=>({classList:{toggle(){}}}));let time=1900000000000,frame;
 const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const node=()=>({textContent:'',hidden:false,disabled:false,style:{},dataset:{},children:[],classList:{toggle(){}},setAttribute(){},append(child){this.children.push(child);this.firstChild=this.children[0];},replaceChildren(...children){this.children=children;this.firstChild=children[0];},getContext:()=>context2d});
 const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
 get('result').hidden=true;get('shoot').disabled=true;
 const FakeDate=class extends Date{static now(){return time;}};
 const math=Object.create(Math);math.random=()=>0;
 class LoadedImage{constructor(){this.naturalWidth=1046;this.naturalHeight=1503;}set src(value){this.url=value;this.onload?.();}}
 const sandbox={Image:LoadedImage,document:{createElement:node,getElementById:get,querySelectorAll:()=>dots,addEventListener(){},body:{classList:{remove(){},add(){},toggle(){}}}},location:{search,pathname},window:{WAVE_CONFIG:{apiUrl},WaveHunt:tracker},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URLSearchParams,performance:{now:()=>time},Date:FakeDate,Math:math,AbortSignal,fetch:fetchFn,requestAnimationFrame:f=>frame=f,WaveUI:{tone(){},shootSound(){},basketSound(){},missSound(){},isSoundEnabled:()=>true,disableSound(){},win(){},confetti(){},enableSound:async()=>true}};
 for(const name of ['puzzle','runner'])vm.runInNewContext(fs.readFileSync(new URL('../jeu/'+name+'.js',import.meta.url),'utf8'),sandbox);
 vm.runInNewContext(fs.readFileSync(new URL('../jeu/game.js',import.meta.url),'utf8'),sandbox);
 return {get,step(ms){time+=ms;frame(time);},advance(ms){time+=ms;},time:()=>time};
}
test('référence absente : pas de démarrage et aucune réponse divulguée',()=>{
 const g=game('');assert.equal(g.get('start').disabled,true);assert.match(g.get('mode').textContent,/Scanne/);assert.equal(g.get('reward').textContent,'');
});

test('le puzzle mobile B échange deux pièces au toucher et ne révèle son indice qu’une fois complet',async()=>{
 let board=[1,0,2,3,5,4,7,6,8],seq=0;const calls=[];
 const fetchFn=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  if(url.endsWith('/resolve'))return Response.json({kind:'game',activity:'puzzle',duration:30000});
  if(url.endsWith('/reward'))return Response.json({reward:'34',position:'center'});
  if(url.endsWith('/puzzle')){assert.equal(body.seq,seq);[board[body.from],board[body.to]]=[board[body.to],board[body.from]];seq++;}
  return Response.json({session:'test',activity:'puzzle',duration:30000,startedAt:1900000000000,deadline:1900000030000,board:[...board],seq,score:board.filter((p,i)=>p===i).length});
 };
 const g=game('','https://service.test',fetchFn,'/s/vgyx24v5/');await new Promise(r=>setTimeout(r,0));
 assert.equal(g.get('shoot').hidden,true);assert.equal(g.get('puzzleBoard').hidden,false);assert.equal(g.get('timer').textContent,'00:30');
 await g.get('start').onclick();assert.equal(g.get('puzzleBoard').children.length,9);assert.equal(g.get('score').textContent,'3 / 9');
 for(const [a,b] of [[0,1],[4,5],[6,7]]){await g.get('puzzleBoard').children[a].onclick();await g.get('puzzleBoard').children[b].onclick();g.step(100);}
 assert.equal(g.get('result').hidden,false);assert.equal(g.get('reward').textContent,'34');assert.equal(g.get('result').dataset.position,'center');
 assert.equal(calls.filter(c=>c.url.endsWith('/shot')).length,0);assert.equal(calls.filter(c=>c.url.endsWith('/reward')).length,1);
});

test('le puzzle expiré désactive ses pièces, conserve l’indice caché et autorise un nouvel essai',async()=>{
 const g=game('?id=B');await g.get('start').onclick();g.step(30000);
 assert.match(g.get('coverTitle').textContent,/écoulé/);assert.equal(g.get('puzzleBoard').children[0].disabled,true);assert.equal(g.get('reward').textContent,'');
 await g.get('start').onclick();assert.equal(g.get('puzzleBoard').children[0].disabled,false);assert.equal(g.get('timer').textContent,'00:30');
});

test('la course C se gagne après trente secondes et sept obstacles évités au bouton Sauter',async()=>{
 let seq=0,jumps=[],g;const calls=[];const start=1900000000000,obstacles=[4500,8200,11900,15600,19300,23000,26700];
 const fetchFn=async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/resolve'))return Response.json({kind:'game',activity:'runner',duration:30000});
  if(url.endsWith('/reward'))return Response.json({reward:'56',position:'right'});
  if(url.endsWith('/jump')){jumps.push(g.time()-start);seq++;}
  return Response.json({session:'test',activity:'runner',duration:30000,startedAt:start,deadline:start+30000,jumps,obstacles,seq,score:obstacles.filter(at=>at<=g.time()-start).length});
 };
 g=game('','https://service.test',fetchFn,'/s/emhvcxu4/');await new Promise(r=>setTimeout(r,0));await g.get('start').onclick();
 assert.equal(g.get('shoot').textContent,'Sauter !');assert.equal(g.get('timer').textContent,'00:30');
 for(const at of obstacles){g.advance(start+at-500-g.time());g.step(0);await g.get('shoot').onclick();g.step(500);}
 assert.equal(g.get('result').hidden,true);g.advance(start+30000-g.time());g.step(0);await new Promise(r=>setTimeout(r,0));
 assert.equal(g.get('result').hidden,false);assert.equal(g.get('reward').textContent,'56');assert.equal(g.get('result').dataset.position,'right');assert.equal(calls.filter(u=>u.endsWith('/finish')).length,1);
});

test('un obstacle touché dans la course entraîne une défaite et aucune révélation',async()=>{
 const g=game('?id=C');await g.get('start').onclick();g.step(4501);
 assert.match(g.get('coverTitle').textContent,/Obstacle touché/);assert.equal(g.get('shoot').disabled,true);assert.equal(g.get('reward').textContent,'');
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
 await new Promise(r=>setTimeout(r,0));assert.equal(g.get('score').textContent,'13 / 13');assert.equal(g.get('reward').textContent,'42');assert.equal(g.get('result').dataset.position,'right');assert.equal(g.get('resultTitle').textContent,'TROUVE LE CODE');assert.match(g.get('resultProgress').textContent,/réuni 1 indice sur 3/);assert.match(g.get('resultProgress').textContent,/Encore 2/);assert.match(g.get('resultNote').textContent,/capture d’écran/);assert.match(g.get('resultNote').textContent,/prochain QR code/);assert.equal(calls.filter(c=>c.url.endsWith('/reward')).length,1);assert.ok(calls.filter(c=>c.url.endsWith('/shot')).every(c=>!('score' in c.body)));
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
 assert.match(g.get('resultNote').textContent,/3 indices.*coffre/);assert.doesNotMatch(g.get('resultNote').textContent,/prochain QR/);assert.equal(g.get('resultProgress').textContent,'Tu as réuni les 3 indices pour trouver le code à 6 chiffres !');
});

function journeyHarness(initialOrder){
 const objects=new Map(),storage=new Map(),origin='https://example.org',env={ALLOWED_ORIGIN:origin,REWARDS_JSON:JSON.stringify({A:'21',B:'34',C:'56'})};let current;
 env.SESSIONS={idFromName:n=>n,get(id){if(!objects.has(id)){
  const values=new Map(),ctx={blockConcurrencyWhile:fn=>fn(),storage:{get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),deleteAll:async()=>values.clear(),setAlarm:async()=>{}}};
  if(initialOrder&&id.startsWith('game:'))values.set('journey',{stage:0,attempt:1,lives:3,phase:'ready',clues:[],order:initialOrder});
  objects.set(id,new GameSession(ctx,env));
 }return objects.get(id);}};
 async function fetchFn(url,options){
  const original=Date.now;Date.now=()=>current?.time()||1900000000000;
  try{return await worker.fetch(new Request(url,{...options,headers:{...options.headers,Origin:origin}}),env);}
  finally{Date.now=original;}
 }
 return {storage,open(){const previous=current?.time()||1900000000000;current=game('','https://service.test',fetchFn,'/s/tfn3j5u4/',undefined,storage);current.advance(previous-current.time());return current;},async saved(){const id=storage.get('wave-journey-id-v1');return objects.get('game:'+id).ctx.storage.get('game');}};
}
async function settle(){for(let i=0;i<5;i++)await new Promise(r=>setTimeout(r,1));}

test('un ancien parcours A-B-C reprend avec ses vies communes et ses trois indices conservés',async()=>{
 const h=journeyHarness(['A','B','C']),g=h.open();await settle();
 assert.match(g.get('journeyStatus').textContent,/Tentative 1\/2 · Vies 3\/3 · Défi 1\/3/);
 await g.get('start').onclick();
 for(let i=0;i<13;i++){await g.get('shoot').onclick();g.step(200);}await settle();
 assert.equal(g.get('reward').textContent,'21');assert.equal(g.get('nextChallenge').hidden,false);assert.match(g.get('resultNote').textContent,/prochain jeu/);assert.doesNotMatch(g.get('resultNote').textContent,/scanne/);
 await g.get('nextChallenge').onclick();assert.equal(g.get('challengeTitle').textContent,'Le puzzle du pingouin');assert.equal(g.get('result').hidden,true);
 await g.get('start').onclick();g.step(30000);await settle();assert.match(g.get('journeyStatus').textContent,/Vies 2\/3 · Défi 2\/3/);
 await g.get('start').onclick();
 for(let i=0;i<9;i++){
  const board=(await h.saved()).board;if(board[i]===i)continue;
  await g.get('puzzleBoard').children[i].onclick();await g.get('puzzleBoard').children[board.indexOf(i)].onclick();g.step(100);
 }
 await settle();assert.equal(g.get('reward').textContent,'34');assert.match(g.get('journeyClues').textContent,/21 · 34/);
 await g.get('nextChallenge').onclick();await g.get('start').onclick();g.step(4501);await settle();assert.match(g.get('journeyStatus').textContent,/Vies 1\/3 · Défi 3\/3/);
 await g.get('start').onclick();const run=await h.saved();
 for(const at of [4500,8200,11900,15600,19300,23000,26700]){g.advance(run.startedAt+at-500-g.time());g.step(0);await g.get('shoot').onclick();g.step(500);}
 g.advance(run.startedAt+30000-g.time());g.step(0);await settle();
 assert.equal(g.get('reward').textContent,'56');assert.equal(g.get('journeyVault').hidden,false);assert.equal(g.get('nextChallenge').hidden,true);assert.match(g.get('journeyClues').textContent,/21 · 34 · 56/);
 const reloaded=h.open();await settle();assert.equal(reloaded.get('journeyVault').hidden,false);assert.match(reloaded.get('journeyStatus').textContent,/Vies 1\/3/);
});

test('le même navigateur retrouve ses vies, propose une seconde chance puis bloque après deux parcours perdus',async()=>{
 const h=journeyHarness();let g=h.open();await settle();await g.get('start').onclick();g.step(30000);await settle();
 assert.match(g.get('journeyStatus').textContent,/Vies 2\/3/);const id=h.storage.get('wave-journey-id-v1');
 g=h.open();await settle();assert.equal(h.storage.get('wave-journey-id-v1'),id);assert.match(g.get('journeyStatus').textContent,/Vies 2\/3/);
 for(let n=0;n<2;n++){await g.get('start').onclick();g.step(30000);await settle();}
 assert.equal(g.get('start').textContent,'Recommencer le parcours');assert.equal(g.get('start').disabled,false);
 await g.get('start').onclick();assert.match(g.get('journeyStatus').textContent,/Tentative 2\/2 · Vies 3\/3 · Défi 1\/3/);
 for(let n=0;n<3;n++){await g.get('start').onclick();g.step(30000);await settle();}
 assert.equal(g.get('start').disabled,true);assert.match(g.get('coverTitle').textContent,/deux tentatives/);
 g=h.open();await settle();assert.equal(g.get('start').disabled,true);assert.match(g.get('journeyStatus').textContent,/Tentative 2\/2 · Vies 0\/3/);
});

test('les nouveaux parcours enchaînent puzzle-course-basket et affichent les indices dans leur ordre de découverte',async()=>{
 const h=journeyHarness();let g=h.open();await settle();
 assert.equal(g.get('challengeTitle').textContent,'Le puzzle du pingouin');assert.equal(g.get('timer').textContent,'00:30');
 await g.get('start').onclick();
 for(let i=0;i<9;i++){
  const board=(await h.saved()).board;if(board[i]===i)continue;
  await g.get('puzzleBoard').children[i].onclick();await g.get('puzzleBoard').children[board.indexOf(i)].onclick();g.step(100);
 }
 await settle();assert.equal(g.get('reward').textContent,'34');assert.equal(g.get('result').dataset.position,'center');assert.equal(g.get('nextChallenge').textContent,'Continuer vers la course');assert.equal(g.get('journeyClues').textContent,'Indices trouvés : 34');
 g=h.open();await settle();assert.equal(g.get('reward').textContent,'34');assert.equal(g.get('result').dataset.position,'center');
 await g.get('nextChallenge').onclick();assert.equal(g.get('challengeTitle').textContent,'La course sur la banquise');await g.get('start').onclick();const run=await h.saved();
 for(const at of [4500,8200,11900,15600,19300,23000,26700]){g.advance(run.startedAt+at-500-g.time());g.step(0);await g.get('shoot').onclick();g.step(500);}
 g.advance(run.startedAt+30000-g.time());g.step(0);await settle();
 assert.equal(g.get('reward').textContent,'56');assert.equal(g.get('nextChallenge').textContent,'Continuer vers le basket');assert.equal(g.get('result').dataset.position,'right');
 await g.get('nextChallenge').onclick();assert.match(g.get('challengeTitle').textContent,/13 paniers/);await g.get('start').onclick();
 for(let i=0;i<13;i++){await g.get('shoot').onclick();g.step(200);}await settle();
 assert.equal(g.get('reward').textContent,'21');assert.equal(g.get('result').dataset.position,'left');assert.equal(g.get('journeyClues').textContent,'Indices trouvés : 34 · 56 · 21');assert.match(g.get('resultNote').textContent,/bon ordre/);assert.equal(g.get('journeyVault').hidden,false);
 g=h.open();await settle();assert.equal(g.get('reward').textContent,'21');assert.equal(g.get('result').dataset.position,'left');assert.equal(g.get('journeyClues').textContent,'Indices trouvés : 34 · 56 · 21');
});
