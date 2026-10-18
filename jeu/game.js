(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('court'),ctx=canvas.getContext('2d');ctx.scale(2,2);
  const params=new URLSearchParams(location.search),ref=params.get('id');
  const api=(window.WAVE_CONFIG?.apiUrl||'').replace(/\/$/,'');
  let state='ready',score=0,phase=0,target=.7,epoch=0,deadline=0,flight=null,lastShot=-Infinity,session='',seq=0,clockOffset=0,pending=false;
  const practice=!api,valid=['A','B','C'].includes(ref),now=()=>Date.now()+clockOffset;
  $('mode').textContent=!valid?'Scanne un QR code du jeu pour commencer.':practice?'Mode entraînement · Les indices seront disponibles après l’activation du jeu.':'';
  $('start').disabled=!valid;
  async function request(path,body){
    const before=Date.now();const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    let data;try{data=await r.json();}catch{throw new Error('Le service est momentanément indisponible.');}
    if(!r.ok)throw new Error(data.error||'Connexion interrompue. Réessaie.');
    if(typeof data.serverNow==='number')clockOffset=data.serverNow-(before+Date.now())/2;
    return data;
  }
  function accept(d){score=d.score;seq=d.seq;phase=d.phase;target=d.target;epoch=d.startedAt;deadline=d.deadline;}
  function aim(t){return .5+.44*Math.sin((t-epoch)/570+phase);}
  function stats(){const s=Math.max(0,Math.ceil((deadline-now())/1000));$('score').textContent=score+' / 5';if(state==='playing')$('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');$('timerBox').classList.toggle('urgent',state==='playing'&&s<=10);document.querySelectorAll('.progress i').forEach((d,i)=>d.classList.toggle('on',i<score));}
  function fail(title,text){state='lost';flight=null;pending=false;$('shoot').disabled=true;$('cover').hidden=false;$('coverTitle').textContent=title;$('coverText').textContent=text;$('start').textContent='Réessayer';$('start').disabled=false;}
  async function start(){
    if(state==='starting'||state==='playing')return;state='starting';$('start').disabled=true;$('coverText').textContent='Prépare-toi…';
    try{
      if(practice){clockOffset=0;epoch=Date.now();deadline=epoch+60000;phase=Math.random()*6;target=.3+Math.random()*.4;score=0;seq=0;}
      else{const d=await request('/session',{ref});session=d.session;accept(d);}
      flight=null;lastShot=-Infinity;pending=false;state='playing';$('feedback').textContent='';$('cover').hidden=true;$('shoot').disabled=false;$('start').disabled=false;stats();
    }catch(e){fail('Connexion indisponible',e.message);}
  }
  async function reveal(){
    $('retryReward').hidden=true;
    try{const d=await request('/reward',{session});if(!/^\d{2}$/.test(d.reward)||!['left','center','right'].includes(d.position))throw new Error('Indice indisponible.');$('reward').textContent=d.reward;$('result').dataset.position=d.position;$('resultText').textContent='Ton indice est :';$('resultNote').textContent='Garde cet écran et poursuis la chasse !';}
    catch{$('resultText').textContent='Défi réussi, ton indice est conservé quelques minutes.';$('resultNote').textContent='Vérifie ta connexion puis réessaie de l’afficher.';$('retryReward').hidden=false;}
  }
  async function win(){state='won';$('shoot').disabled=true;$('play').hidden=true;$('result').hidden=false;WaveUI.win();WaveUI.confetti();if(practice){$('resultText').textContent='Entraînement réussi !';$('resultNote').textContent='L’indice sera révélé ici lorsque le jeu sera activé.';$('result').dataset.position='center';}else await reveal();}
  async function shoot(){
    if(state!=='playing'||flight||pending||now()-lastShot<1150)return;
    if(now()>=deadline){fail('Le temps est écoulé !','Tu as marqué '+score+' panier(s) sur 5. Retente le défi !');return;}
    const t=now(),a=aim(t);lastShot=t;pending=true;$('shoot').disabled=true;$('feedback').textContent='';
    try{
      let hit;
      if(practice){hit=Math.abs(a-target)<=.095;if(hit)score++;seq++;}
      else{const d=await request('/shot',{session,seq});hit=d.hit;accept(d);}
      if(state!=='playing')return;
      flight={at:performance.now(),hit,x:hit?195:195+(a<target?-110:110)};pending=false;WaveUI.tone(300,.08,.025);
    }catch(e){pending=false;fail('Connexion interrompue','Ta partie ne peut pas continuer. Relance le défi lorsque la connexion revient.');}
  }
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function ball(x,y,r,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ellipse(0,0,r,r,'#ffa132');ctx.strokeStyle='#804420';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.moveTo(-r,0);ctx.lineTo(r,0);ctx.moveTo(0,-r);ctx.lineTo(0,r);ctx.moveTo(-r*.65,-r*.75);ctx.quadraticCurveTo(r*.4,0,-r*.65,r*.75);ctx.moveTo(r*.65,-r*.75);ctx.quadraticCurveTo(-r*.4,0,r*.65,r*.75);ctx.stroke();ctx.restore();}
  function court(t){
    const g=ctx.createLinearGradient(0,0,0,410);g.addColorStop(0,'#55d4f3');g.addColorStop(1,'#b4edfc');ctx.fillStyle=g;ctx.fillRect(0,0,390,410);
    ctx.fillStyle='#ffffff22';ctx.beginPath();ctx.moveTo(110,0);ctx.lineTo(280,0);ctx.lineTo(390,410);ctx.lineTo(0,410);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,290);ctx.lineTo(91,150);ctx.lineTo(299,150);ctx.lineTo(390,290);ctx.moveTo(130,150);ctx.lineTo(103,245);ctx.quadraticCurveTo(195,315,287,245);ctx.lineTo(260,150);ctx.moveTo(103,245);ctx.lineTo(287,245);ctx.stroke();
    ctx.beginPath();ctx.ellipse(195,410,210,90,0,Math.PI,Math.PI*2);ctx.stroke();ctx.setLineDash([8,8]);ctx.beginPath();ctx.ellipse(195,245,92,27,0,Math.PI,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#20add3';ctx.fillRect(192,75,6,75);ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(145,24,100,69,4);ctx.fill();ctx.strokeStyle='#00b5df';ctx.strokeRect(177,43,37,36);
    ctx.strokeStyle='#8ebaca';ctx.lineWidth=1.5;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(165+i*12,83);ctx.lineTo(178+i*7,126);ctx.stroke();}for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(195,90+j*10,28-j*4,4,0,0,Math.PI*2);ctx.stroke();}
    const lift=flight?Math.sin(Math.min((t-flight.at)/800,1)*Math.PI)*8:Math.sin(t/800)*1.5;
    ctx.save();ctx.translate(195,320-lift);ellipse(0,69,58,11,'#1eb7e15c');ellipse(-22,63,21,8,'#ffab31');ellipse(22,63,21,8,'#ffab31');ellipse(-35,0,13,41,'#073750');ellipse(35,0,13,41,'#073750');ellipse(0,15,45,55,'#073750');ellipse(0,-28,32,33,'#073750');ctx.strokeStyle='#285974';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-23,32,Math.PI*1.12,Math.PI*1.88);ctx.stroke();ctx.restore();
    if(flight){const p=Math.min((t-flight.at)/800,1),x=195+(flight.x-195)*p,y=270+(83-270)*p-110*4*p*(1-p);if(p<1)ball(x,y,20-10*p,t/170);else if(p<1.2)ball(flight.x,83+(p-1)*60,10,t/170);}
    else ball(195,270,21,t/2500);
    ctx.strokeStyle='#f28324';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(195,83,34,6,0,0,Math.PI*2);ctx.stroke();
  }
  function frame(t){
    court(t);
    if(state==='playing'){
      if(flight&&t-flight.at>=850){const hit=flight.hit;flight=null;$('feedback').textContent=hit?'Panier ! 🏀':'Presque ! Ajuste ton timing.';if(hit)WaveUI.tone(780,.18,.04);stats();if(score>=5){win();}else{if(practice&&hit)target=.22+Math.random()*.56;$('shoot').disabled=false;}}
      if(state==='playing'&&now()>=deadline&&!flight&&!pending){$('timer').textContent='00:00';fail('Le temps est écoulé !','Tu as marqué '+score+' panier(s) sur 5. Retente le défi pour découvrir ton indice.');}
      if(state==='playing')stats();
    }
    const marker=state==='playing'?aim(now()):.3;$('marker').style.left=(marker*100)+'%';$('zone').style.left=((target-.095)*100)+'%';$('zone').style.width='19%';
    requestAnimationFrame(frame);
  }
  $('start').onclick=start;$('shoot').onclick=shoot;$('retryReward').onclick=reveal;
  $('sound').onclick=async()=>{$('sound').textContent=await WaveUI.enableSound()?'Son activé ✓':'Vérifie le son du téléphone';};
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.target.tagName!=='BUTTON'&&state==='playing'){e.preventDefault();shoot();}});
  requestAnimationFrame(frame);
})();
