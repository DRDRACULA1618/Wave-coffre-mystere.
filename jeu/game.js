(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('court'),ctx=canvas.getContext('2d');ctx.scale(2,2);
  const params=new URLSearchParams(location.search),ref=params.get('id');
  const token=(location.pathname||'').match(/\/s\/([a-z0-9]{8})\/?$/)?.[1]||'';
  const api=(window.WAVE_CONFIG?.apiUrl||'').replace(/\/$/,'');
  // Vue de dos : la nageoire droite est à droite de l’écran.
  const BALL_START={x:246,y:278,r:16};
  const GAME={goal:13,duration:15000,aimSpeed:300,hitRadius:.45,shotCooldown:180,flightDuration:120,flightEnd:160};
  let state='ready',score=0,phase=0,target=.5,epoch=0,deadline=0,flight=null,lastShot=-Infinity,session='',seq=0,clockOffset=0,pending=false;
  const practice=!api&&!token,now=()=>Date.now()+clockOffset;
  let valid=!token&&['A','B','C'].includes(ref),resolved=!token;
  let soundOptOut=false,lastCountdown=-1;
  $('mode').textContent=!valid?'Scanne un QR code du jeu pour commencer.':practice?'Entraînement · Indices à activer':'';
  $('start').disabled=!valid;
  const mascot=new Image();let mascotReady=false;
  $('start').disabled=true;
  mascot.onload=()=>{mascotReady=true;$('start').disabled=!valid;};
  mascot.onerror=()=>{$('coverTitle').textContent='Visuel indisponible';$('coverText').textContent='Recharge la page pour charger le pingouin Wave.';};
  mascot.src='../assets/pingouin-wave-dos.png';
  async function request(path,body){
    const before=Date.now();const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    let data;try{data=await r.json();}catch{throw new Error('Le service est momentanément indisponible.');}
    if(!r.ok)throw new Error(data.error||'Connexion interrompue. Réessaie.');
    if(typeof data.serverNow==='number')clockOffset=data.serverNow-(before+Date.now())/2;
    return data;
  }
  function accept(d){score=d.score;seq=d.seq;phase=d.phase;target=d.target;epoch=d.startedAt;deadline=d.deadline;}
  function aim(t){return .5+.44*Math.sin((t-epoch)/GAME.aimSpeed+phase);}
  function stats(){const s=Math.max(0,Math.ceil((deadline-now())/1000));$('score').textContent=score+' / '+GAME.goal;if(state==='playing'){$('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');if(s>0&&s<=3&&s!==lastCountdown){lastCountdown=s;WaveUI.tone(620,.045,.015);}}$('timerBox').classList.toggle('urgent',state==='playing'&&s<=5);document.querySelectorAll('.progress i').forEach((d,i)=>d.classList.toggle('on',i<score));}
  function fail(title,text){state='lost';flight=null;pending=false;$('shoot').disabled=true;$('cover').hidden=false;$('coverTitle').textContent=title;$('coverText').textContent=text;$('start').textContent='Réessayer';$('start').disabled=false;}
  async function start(){
    if(token&&!resolved){await resolveScan();return;}
    if(!mascotReady||!valid||state==='starting'||state==='playing')return;state='starting';$('start').disabled=true;$('coverText').textContent='Prépare-toi…';
    if(!soundOptOut)WaveUI.enableSound().then(ok=>{if(soundOptOut){WaveUI.disableSound();return;}$('sound').textContent=ok?'Son : activé':'Activer le son';if(!ok)soundOptOut=true;});
    try{
      if(practice){clockOffset=0;epoch=Date.now();deadline=epoch+GAME.duration;phase=Math.random()*6;target=.5;score=0;seq=0;}
      else{const d=await request('/session',token?{token}:{ref});session=d.session;accept(d);}
      flight=null;lastShot=-Infinity;lastCountdown=-1;pending=false;state='playing';$('feedback').textContent='';$('cover').hidden=true;$('shoot').disabled=false;$('start').disabled=false;stats();
    }catch(e){fail('Connexion indisponible',e.message);}
  }
  async function resolveScan(){
    $('start').disabled=true;
    try{
      if(!api)throw new Error('Le service est momentanément indisponible.');
      const d=await request('/resolve',{token});
      if(d.kind!=='game'&&d.kind!=='empty')throw new Error('QR code inconnu.');
      resolved=true;$('loadingCard').hidden=true;
      if(d.kind==='empty'){
        state='empty';$('gameCard').hidden=true;$('emptyCard').hidden=false;
        document.body.classList.remove('game-page');
        return;
      }
      valid=true;$('gameCard').hidden=false;$('mode').textContent='';
      $('coverTitle').textContent='À toi de jouer !';$('coverText').textContent='Appuie sur « Tirer ! » : chaque tir compte. Marque 13 paniers en 15 secondes.';
      $('start').textContent='Commencer le défi';$('start').disabled=!mascotReady;state='ready';
    }catch(e){
      $('loadingCard').hidden=true;$('gameCard').hidden=false;
      fail('Connexion indisponible',e.message);
    }
  }
  async function reveal(){
    $('retryReward').hidden=true;
    try{const d=await request('/reward',{session});if(!/^\d{2}$/.test(d.reward)||!['left','center','right'].includes(d.position))throw new Error('Indice indisponible.');$('reward').textContent=d.reward;$('result').dataset.position=d.position;$('resultText').textContent='Ton indice est :';$('resultNote').textContent='Garde cet écran et poursuis la chasse !';}
    catch{$('resultText').textContent='Défi réussi, ton indice est conservé quelques minutes.';$('resultNote').textContent='Vérifie ta connexion puis réessaie de l’afficher.';$('retryReward').hidden=false;}
  }
  async function win(){state='won';$('shoot').disabled=true;$('play').hidden=true;$('result').hidden=false;WaveUI.win();WaveUI.confetti();if(practice){$('resultText').textContent='Entraînement réussi !';$('resultNote').textContent='L’indice sera révélé ici lorsque le jeu sera activé.';$('result').dataset.position='center';}else await reveal();}
  async function shoot(){
    if(state!=='playing'||flight||pending||now()-lastShot<GAME.shotCooldown)return;
    if(now()>=deadline){fail('Le temps est écoulé !','Tu as marqué '+score+' panier(s) sur '+GAME.goal+'. Retente le défi !');return;}
    lastShot=now();pending=true;$('shoot').disabled=true;$('feedback').textContent='';
    try{
      let hit;
      if(practice){hit=true;score++;seq++;}
      else{const d=await request('/shot',{session,seq});hit=d.hit;accept(d);}
      if(state!=='playing')return;
      flight={at:performance.now(),hit,x:hit?195:305};pending=false;WaveUI.shootSound();
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
    const lift=flight?Math.sin(Math.min((t-flight.at)/GAME.flightDuration,1)*Math.PI)*8:Math.sin(t/800)*1.5;
    if(mascotReady){const h=172,w=h*mascot.naturalWidth/mascot.naturalHeight;ellipse(195,390,49,7,'#1eb7e15c');ctx.drawImage(mascot,195-w/2,224-lift,w,h);}
    if(flight){const p=Math.min((t-flight.at)/GAME.flightDuration,1),x=BALL_START.x+(flight.x-BALL_START.x)*p,y=BALL_START.y+(83-BALL_START.y)*p-110*4*p*(1-p);if(p<1)ball(x,y,BALL_START.r-10*p,t/170);else if(p<1.2)ball(flight.x,83+(p-1)*60,10,t/170);}
    else ball(BALL_START.x,BALL_START.y-lift,BALL_START.r,t/2500);
    ctx.strokeStyle='#f28324';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(195,83,34,6,0,0,Math.PI*2);ctx.stroke();
  }
  function frame(t){
    if(state==='empty')return;
    court(t);
    if(state==='playing'){
      if(flight&&t-flight.at>=GAME.flightEnd){const hit=flight.hit;flight=null;$('feedback').textContent=hit?'Panier ! 🏀':'Presque ! Ajuste ton timing.';if(hit)WaveUI.basketSound();else WaveUI.missSound();stats();if(score>=GAME.goal){win();}else{$('shoot').disabled=false;}}
      if(state==='playing'&&now()>=deadline&&!flight&&!pending){$('timer').textContent='00:00';fail('Le temps est écoulé !','Tu as marqué '+score+' panier(s) sur '+GAME.goal+'. Retente le défi pour découvrir ton indice.');}
      if(state==='playing')stats();
    }
    const marker=state==='playing'?aim(now()):.3;$('marker').style.left=(marker*100)+'%';$('zone').style.left=((target-GAME.hitRadius)*100)+'%';$('zone').style.width=(GAME.hitRadius*200)+'%';
    requestAnimationFrame(frame);
  }
  $('start').onclick=start;$('shoot').onclick=shoot;$('retryReward').onclick=reveal;
  $('sound').onclick=async()=>{if(!soundOptOut){soundOptOut=true;WaveUI.disableSound();$('sound').textContent='Son : coupé';}else{const enabled=await WaveUI.enableSound();soundOptOut=!enabled;$('sound').textContent=enabled?'Son : activé':'Activer le son';}};
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.target.tagName!=='BUTTON'&&state==='playing'){e.preventDefault();shoot();}});
  requestAnimationFrame(frame);
  if(token)resolveScan();
})();
