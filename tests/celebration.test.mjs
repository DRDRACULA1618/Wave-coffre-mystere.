import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function ui(reduced){
 let painted=0,frames=0,removed=0,timerDuration=0;
 const ctx=new Proxy({fillRect(){painted++;}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={style:{},setAttribute(){},getContext:()=>ctx,remove(){removed++;}};
 const sandbox={window:{matchMedia:()=>({matches:reduced}),visualViewport:{width:393,height:670},devicePixelRatio:3},document:{querySelector:()=>null,createElement:()=>canvas,body:{append(){}}},innerWidth:393,innerHeight:800,performance:{now:()=>1000},Math,Array,setTimeout(fn,duration){timerDuration=duration;return 1;},clearTimeout(){},requestAnimationFrame(){frames++;return 1;},cancelAnimationFrame(){}};
 vm.runInNewContext(fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8'),sandbox);
 return {api:sandbox.window.WaveUI,canvas,state:()=>({painted,frames,removed,timerDuration})};
}
test('les confettis sont visibles immédiatement, avant toute animation, dans la hauteur utile du mobile',()=>{
 const view=ui(false),stop=view.api.confetti();assert.ok(view.state().painted>0);assert.equal(view.state().frames,1);assert.equal(view.state().timerDuration,16000);assert.equal(view.canvas.height,1340);assert.equal(view.canvas.style.height,'670px');stop();assert.equal(view.state().removed,1);
});
test('le réglage Réduire les animations conserve un décor de confettis visible et fixe',()=>{
 const view=ui(true);view.api.confetti();assert.ok(view.state().painted>0);assert.equal(view.state().frames,0);assert.equal(view.state().removed,0);assert.equal(view.state().timerDuration,16000);
});
