import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function element(){return {textContent:'',hidden:false,disabled:false,dataset:{},style:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},onclick:null};}
function vault(){
 const elements=new Map(),digits=Array.from({length:6},element),numbers=Array.from({length:10},(_,i)=>({...element(),dataset:{n:String(i)}}));
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 get('victory').hidden=true;
 const handlers={},timers=[];let wins=0;
 const document={getElementById:get,querySelectorAll:s=>s==='.digit'?digits:s==='[data-n]'?numbers:[...numbers,element(),element()],addEventListener:(name,fn)=>handlers[name]=fn};
 const context={document,crypto:globalThis.crypto,TextEncoder,Uint8Array,Array,confirm:()=>true,setTimeout:fn=>timers.push(fn),navigator:{},WaveUI:{tone(){},win(){wins++;},confetti(){},enableSound:async()=>true}};
 vm.runInNewContext(fs.readFileSync(new URL('../coffre/coffre.js',import.meta.url),'utf8'),context);
 return {get,digits,handlers,timers,numbers,wins:()=>wins};
}
const tick=()=>new Promise(r=>setTimeout(r,15));
test('le sixième chiffre déclenche seul la victoire ; le clavier est verrouillé puis réinitialisable',async()=>{
 const v=vault();const code=process.env.WAVE_TEST_CODE;assert.match(code||'',/^\d{6}$/,'Passer la combinaison via WAVE_TEST_CODE sans la publier dans les tests.');
 for(const n of code.slice(0,5))v.numbers[Number(n)].onclick();assert.equal(v.get('victory').hidden,true);assert.equal(v.wins(),0);
 v.numbers[Number(code[5])].onclick();await tick();assert.equal(v.wins(),1);assert.equal(v.get('entry').hidden,true);assert.ok(v.numbers.every(n=>n.disabled));
 v.get('reset').onclick();assert.equal(v.get('entry').hidden,false);assert.equal(v.get('victory').hidden,true);assert.ok(v.digits.every(n=>n.textContent===''));assert.ok(v.numbers.every(n=>!n.disabled));
});
test('mauvaise combinaison, effacement et clavier ordinateur',async()=>{
 const v=vault();for(const n of '000000')v.numbers[Number(n)].onclick();await tick();assert.equal(v.wins(),0);assert.match(v.get('message').textContent,/Réessaie/);v.timers.forEach(fn=>fn());assert.ok(v.digits.every(n=>n.textContent===''));
 v.handlers.keydown({key:'2',preventDefault(){}});assert.equal(v.digits[0].textContent,'2');v.handlers.keydown({key:'Backspace',preventDefault(){}});assert.equal(v.digits[0].textContent,'');
 v.numbers[3].onclick();v.numbers[4].onclick();v.get('clear').onclick();assert.ok(v.digits.every(n=>n.textContent===''));
});
