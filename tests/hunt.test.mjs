import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../hunt.js',import.meta.url),'utf8'),key='wave-hunt-found-v1';
function hunt(storage=new Map(),blocked=false){
 const elements=new Map(),events={};
 const get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:id==='result'});return elements.get(id);};
 const window={addEventListener:(name,fn)=>events[name]=fn};
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,value)=>{if(blocked)throw Error('Stockage indisponible');storage.set(k,value);}};
 vm.runInNewContext(source,{window,localStorage,document:{getElementById:get},Set,Object,JSON});
 return {tracker:window.WaveHunt,get,events,storage};
}
test('chaque indice unique est compté une seule fois et le suivi est retrouvé sur les autres pages',()=>{
 const a=hunt();assert.equal(a.tracker.count(),0);assert.match(a.get('huntStatus').textContent,/encore 3/);
 assert.equal(a.tracker.record('left'),1);assert.equal(a.tracker.record('left'),1);assert.match(a.get('huntStatus').textContent,/1\/3 indice trouvé — encore 2/);
 const b=hunt(a.storage);assert.equal(b.tracker.count(),1);assert.equal(b.tracker.record('center'),2);assert.match(b.get('huntStatus').textContent,/encore 1/);
 assert.equal(b.tracker.record('right'),3);assert.match(b.get('huntStatus').textContent,/3\/3.*Rejoins le coffre/);assert.match(b.get('emptyNext').textContent,/Rejoins le coffre/);
 assert.deepEqual(JSON.parse(a.storage.get(key)).sort(),['center','left','right']);
});
test('la lecture seule et une page sans indice ne font pas avancer le compteur ; les valeurs invalides sont ignorées',()=>{
 const data=new Map([[key,JSON.stringify(['left','left','wrong',42])]]),p=hunt(data);
 assert.equal(p.tracker.count(),1);assert.equal(p.tracker.record('wrong'),1);assert.equal(p.tracker.record('15'),1);
 p.tracker.render();assert.equal(p.tracker.count(),1);
 const corrupted=hunt(new Map([[key,'{invalide']]));assert.equal(corrupted.tracker.count(),0);assert.equal(corrupted.tracker.record('center'),1);
});
test('une victoire complète invite à rejoindre le coffre et le stockage bloqué ne casse pas la page',()=>{
 const p=hunt(undefined,true);p.tracker.record('left');assert.equal(p.tracker.count(),1);assert.match(p.get('huntStatus').textContent,/encore 2/);
 p.tracker.record('center');p.get('result').hidden=false;p.get('reward').textContent='42';p.tracker.record('right');
 assert.match(p.get('resultNote').textContent,/capture d’écran/);assert.match(p.get('resultNote').textContent,/3 indices.*coffre/);
 assert.doesNotMatch(p.get('resultNote').textContent,/prochain QR/);
});
test('les autres onglets et le retour sur une page rafraîchissent le suivi',()=>{
 const p=hunt();p.storage.set(key,JSON.stringify(['left','center']));p.events.storage({key});assert.match(p.get('huntStatus').textContent,/encore 1/);
 p.storage.set(key,JSON.stringify(['left','center','right']));p.events.pageshow();assert.match(p.get('huntStatus').textContent,/3\/3/);
});
