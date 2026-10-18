import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function screen(viewport){
 const properties={},classes={},listeners={};
 const window={innerWidth:390,innerHeight:844,addEventListener:(name,fn)=>listeners[name]=fn};
 if(viewport)window.visualViewport={...viewport,addEventListener:(name,fn)=>listeners['visual-'+name]=fn};
 const document={documentElement:{style:{setProperty:(k,v)=>properties[k]=v},clientWidth:390,clientHeight:844},body:{classList:{toggle:(k,v)=>classes[k]=v}}};
 vm.runInNewContext(fs.readFileSync(new URL('../jeu/viewport.js',import.meta.url),'utf8'),{window,document,Math});
 return {window,properties,classes,listeners};
}
test('le jeu utilise la hauteur visible du navigateur intégré plutôt que la hauteur physique',()=>{
 const phone=screen({width:390,height:560});assert.equal(phone.properties['--game-viewport-height'],'560px');assert.equal(phone.properties['--game-viewport-width'],'390px');assert.equal(phone.classes['short-game'],true);assert.equal(phone.classes['tiny-game'],false);
 phone.window.visualViewport.height=430;phone.listeners['visual-resize']();assert.equal(phone.properties['--game-viewport-height'],'430px');assert.equal(phone.classes['tiny-game'],true);
});
test('le navigateur sans visualViewport et les changements d’orientation restent pris en charge',()=>{
 const phone=screen();assert.equal(phone.properties['--game-viewport-height'],'844px');phone.window.innerHeight=420;phone.window.innerWidth=844;phone.listeners.orientationchange();assert.equal(phone.properties['--game-viewport-height'],'420px');assert.equal(phone.properties['--game-viewport-width'],'844px');assert.equal(phone.classes['tiny-game'],true);
});
