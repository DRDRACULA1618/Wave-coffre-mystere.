import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
function legacyPage(legacy,search){
 const elements=new Map(),requests=[],redirects=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};
 const context={document:{getElementById:get,body:{dataset:legacy?{legacy}:{} }},window:{WAVE_CONFIG:{apiUrl:'https://service.test'}},location:{search,href:'https://example.org/project/'+(legacy?'pas-de-chance/':'jeu/')+search,replace:url=>redirects.push(url)},URL,URLSearchParams,AbortSignal,fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return Response.json({token:{A:'tfn3j5u4',B:'vgyx24v5',C:'emhvcxu4',empty:'4ubsj88k'}[JSON.parse(options.body).legacy]});}};
 vm.runInNewContext(fs.readFileSync(new URL('scan-legacy.js',root),'utf8'),context);
 return {requests,redirects,get};
}
test('les quatre anciens accès remplacent leur URL par leur chemin neutre, en conservant le sous-dossier du dépôt',async()=>{
 for(const [ref,token] of Object.entries({A:'tfn3j5u4',B:'vgyx24v5',C:'emhvcxu4',empty:'4ubsj88k'})){
  const page=legacyPage(ref==='empty'?'empty':'',ref==='empty'?'':'?id='+ref);
  await new Promise(r=>setTimeout(r,0));assert.deepEqual(page.requests[0].body,{legacy:ref});assert.deepEqual(page.redirects,['https://example.org/project/s/'+token+'/']);
 }
});
test('les quatre pages neutres ont le même HTML et leurs ressources se résolvent dans le dépôt',()=>{
 const tokens=['tfn3j5u4','vgyx24v5','emhvcxu4','4ubsj88k'];
 const pages=tokens.map(token=>fs.readFileSync(new URL('s/'+token+'/index.html',root),'utf8'));
 assert.equal(new Set(pages).size,1);
 const doc=pages[0];assert.match(doc,/<base href="\.\.\/\.\.\/jeu\/">/);
 assert.match(doc,/3 indices à réunir pour trouver le code à 6 chiffres/);assert.match(doc,/id="resultProgress"/);assert.doesNotMatch(doc,/premier indice|deuxième indice|troisième indice|indiquant la position du bloc/i);
 for(const [_,src] of doc.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(src==='../../jeu/')continue;
  const path=new URL(src,new URL('jeu/',root));path.search='';assert.ok(fs.existsSync(path),path.href);
 }
 assert.ok(fs.existsSync(new URL('index.html',root)));assert.ok(fs.existsSync(new URL('coffre/index.html',root)));
 for(const token of tokens)assert.ok(!doc.includes(token));
});
