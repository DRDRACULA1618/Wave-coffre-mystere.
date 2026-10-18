(() => {
 'use strict';
 const $=id=>document.getElementById(id),api=(window.WAVE_CONFIG?.apiUrl||'').replace(/\/$/,'');
 const legacy=document.body.dataset.legacy==='empty'?'empty':new URLSearchParams(location.search).get('id');
 let pending=false;
 async function open(){
  if(pending)return;pending=true;$('retry').hidden=true;$('message').textContent='Chargement de ton QR code…';
  try{
   if(!api)throw new Error('Le service est momentanément indisponible.');
   const r=await fetch(api+'/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({legacy}),signal:AbortSignal.timeout(10000)});
   const d=await r.json();
   if(!r.ok||!/^[a-z0-9]{8}$/.test(d.token))throw new Error(d.error||'QR code inconnu.');
   // Remplace l'entrée d'historique : pas de boucle au bouton Retour.
   location.replace(new URL('../s/'+d.token+'/',location.href).href);
  }catch(e){$('message').textContent=e.message||'Connexion interrompue. Réessaie.';$('retry').hidden=false;}
  finally{pending=false;}
 }
 $('retry').onclick=open;open();
})();
