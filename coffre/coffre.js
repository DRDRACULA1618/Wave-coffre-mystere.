(() => {
 'use strict';
 const $=id=>document.getElementById(id),digits=[...document.querySelectorAll('.digit')],keys=[...document.querySelectorAll('.keys button')];
 // Empreinte locale : cela masque la lecture immédiate mais ne protège pas contre une recherche exhaustive.
 const EXPECTED='44ae8b6a1ce8a8b97b52d683849836403e4374306a3e97bbfe2a06fffe7d67e2';
 let code='',busy=false,won=false;
 function draw(){digits.forEach((d,i)=>{d.textContent=code[i]||'';d.classList.toggle('active',!busy&&!won&&i===code.length);});keys.forEach(k=>k.disabled=busy||won);$('code').setAttribute('aria-label',code?'Code saisi : '+code.split('').join(' '):'Code vide en trois blocs de deux chiffres');}
 async function check(){
   busy=true;draw();
   try{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));const value=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
     if(value===EXPECTED){won=true;$('entry').hidden=true;$('victory').hidden=false;WaveUI.win();WaveUI.confetti();busy=false;draw();return;}
     $('message').textContent='Ce n’est pas la bonne combinaison. Réessaie.';$('code').classList.add('wrong');WaveUI.tone(150,.16,.035);
     setTimeout(()=>{code='';busy=false;$('code').classList.remove('wrong');draw();},650);
   }catch{busy=false;code='';$('message').textContent='Ouvre cette page depuis son adresse HTTPS pour jouer.';draw();}
 }
 function add(n){if(busy||won||code.length>=6)return;code+=n;$('message').textContent='';draw();if(code.length===6)check();}
 function erase(all=false){if(busy||won)return;code=all?'':code.slice(0,-1);$('message').textContent='';draw();}
 document.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>add(b.dataset.n));$('clear').onclick=()=>erase(true);$('back').onclick=()=>erase();
 $('sound').onclick=async()=>{$('sound').textContent=await WaveUI.enableSound()?'Son activé ✓':'Vérifie le volume et le mode silencieux';};
 $('reset').onclick=()=>{if(!confirm('Préparer une nouvelle tentative ?'))return;won=false;busy=false;code='';$('victory').hidden=true;$('entry').hidden=false;$('message').textContent='';draw();};
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(/^\d$/.test(e.key)){e.preventDefault();add(e.key);}else if(e.key==='Backspace'){e.preventDefault();erase();}});
 if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').then(async()=>{const ready=await navigator.serviceWorker.ready;const worker=ready.active;function status(e){if(e.data?.type==='CACHE_READY'){$('offline').textContent='Hors connexion prêt · Teste cette page en mode avion.';navigator.serviceWorker.removeEventListener('message',status);}}navigator.serviceWorker.addEventListener('message',status);worker?.postMessage({type:'CACHE_STATUS'});}).catch(()=>{$('offline').textContent='Mode hors connexion indisponible sur ce navigateur.';});}else $('offline').textContent='Garde une connexion pour ouvrir cette page.';
 draw();
})();
