(() => {
 'use strict';
 const $=id=>document.getElementById(id),digits=[...document.querySelectorAll('.digit')],keys=[...document.querySelectorAll('.keys button')];
 // Empreinte locale : cela masque la lecture immédiate mais ne protège pas contre une recherche exhaustive.
 const EXPECTED='44ae8b6a1ce8a8b97b52d683849836403e4374306a3e97bbfe2a06fffe7d67e2';
 const MAX_ATTEMPTS=2,STORAGE_KEY='wave-coffre-mystere-round-v1';
 let code='',busy=false,won=false,attempts=0,stopCelebration=null;
 try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(saved&&Number.isInteger(saved.attempts)&&saved.attempts>=0&&saved.attempts<=MAX_ATTEMPTS){attempts=saved.attempts;won=saved.won===true&&attempts>0;}}catch{}
 const locked=()=>!won&&attempts>=MAX_ATTEMPTS;
 function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({attempts,won}));}catch{}}
 function draw(){digits.forEach((d,i)=>{d.textContent=code[i]||'';d.classList.toggle('active',!busy&&!won&&!locked()&&i===code.length);});keys.forEach(k=>k.disabled=busy||won||locked());$('code').setAttribute('aria-label',code?'Code saisi : '+code.split('').join(' '):'Code vide en trois blocs de deux chiffres');const left=MAX_ATTEMPTS-attempts;$('attempts').textContent=left+' tentative'+(left>1?'s':'')+' restante'+(left>1?'s':'');$('resetLocked').hidden=!locked();if(locked())$('message').textContent='Tes 2 tentatives sont utilisées. Fais appel à l’équipe Wave.';}
 async function check(){
   busy=true;draw();
   try{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));const value=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
     attempts++;
     if(value===EXPECTED){won=true;save();$('entry').hidden=true;$('victory').hidden=false;WaveUI.win();stopCelebration=WaveUI.confetti()||null;busy=false;draw();return;}
     save();$('message').textContent=locked()?'Tes 2 tentatives sont utilisées. Fais appel à l’équipe Wave.':'Ce n’est pas la bonne combinaison. Il te reste 1 tentative. Réessaie.';$('code').classList.add('wrong');WaveUI.tone(150,.16,.035);draw();
     setTimeout(()=>{code='';busy=false;$('code').classList.remove('wrong');draw();},650);
   }catch{busy=false;code='';$('message').textContent='Ouvre cette page depuis son adresse HTTPS pour jouer.';draw();}
 }
 function add(n){if(busy||won||locked()||code.length>=6)return;code+=n;$('message').textContent='';draw();if(code.length===6)check();}
 function erase(all=false){if(busy||won||locked())return;code=all?'':code.slice(0,-1);$('message').textContent='';draw();}
 document.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>add(b.dataset.n));$('clear').onclick=()=>erase(true);$('back').onclick=()=>erase();
 $('sound').onclick=async()=>{$('sound').textContent=await WaveUI.enableSound()?'Son activé ✓':'Vérifie le volume et le mode silencieux';};
 function reset(){if(busy||!confirm('Équipe Wave : remettre 2 tentatives à disposition ?'))return;stopCelebration?.();stopCelebration=null;won=false;busy=false;code='';attempts=0;save();$('victory').hidden=true;$('entry').hidden=false;$('message').textContent='';draw();}
 $('reset').onclick=reset;$('resetLocked').onclick=reset;
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(/^\d$/.test(e.key)){e.preventDefault();add(e.key);}else if(e.key==='Backspace'){e.preventDefault();erase();}});
 if('serviceWorker' in navigator){const hadController=!!navigator.serviceWorker.controller;let refreshed=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController&&!refreshed){refreshed=true;location.reload();}});navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{});}
 $('entry').hidden=won;$('victory').hidden=!won;draw();if(won)stopCelebration=WaveUI.confetti()||null;
})();
