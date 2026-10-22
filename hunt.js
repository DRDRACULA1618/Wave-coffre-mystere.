(() => {
 'use strict';
 const key='wave-hunt-found-v1',positions=['left','center','right'];
 let memory=new Set(),storageFailed=false;
 function read(){
  if(storageFailed)return new Set(memory);
  try{
   const raw=localStorage.getItem(key),data=raw?JSON.parse(raw):[];
   return new Set(Array.isArray(data)?data.filter(p=>positions.includes(p)):[]);
  }catch{storageFailed=true;return new Set(memory);}
 }
 function count(){return read().size;}
 function render(){
  if(window.WAVE_JOURNEY_ACTIVE)return;
  const found=count(),remaining=3-found;
  const status=document.getElementById('huntStatus');
  if(status)status.textContent=found===3?'3/3 indices trouvés ! Rejoins le coffre.':found+'/3 '+(found===1?'indice trouvé':'indices trouvés')+' — encore '+remaining+' à trouver.';
  const next=document.getElementById('emptyNext');
  if(next)next.textContent=found===3?'Tu as les 3 indices !\nRejoins le coffre.':'Scanne le prochain\nQR code !';
  const note=document.getElementById('resultNote'),result=document.getElementById('result'),reward=document.getElementById('reward');
  if(result?.dataset)result.dataset.found=String(found);
  const progress=document.getElementById('resultProgress');
  if(progress)progress.textContent=found===3?'Tu as réuni les 3 indices pour trouver le code à 6 chiffres !':found===0?'3 indices différents à réunir.':'Tu as réuni '+found+' '+(found===1?'indice':'indices')+' sur 3. Encore '+remaining+' '+(remaining===1?'autre':'autres')+' pour trouver le code à 6 chiffres.';
  if(note&&result&&!result.hidden&&/^\d{2}$/.test(reward?.textContent||''))note.textContent=found===3?'Fais une capture d’écran de cet indice.\nTes 3 indices sont réunis : rejoins le coffre !':'Fais une capture d’écran de cet indice.\nPuis scanne le prochain QR code.';
 }
 function record(position){
  if(!positions.includes(position))return count();
  const found=read();found.add(position);memory=found;
  try{localStorage.setItem(key,JSON.stringify([...found]));}catch{storageFailed=true;}
  render();return found.size;
 }
 window.WaveHunt=Object.freeze({count,record,render});
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)render();});
 window.addEventListener('pageshow',render);
 render();
})();
