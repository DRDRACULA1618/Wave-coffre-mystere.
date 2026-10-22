(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('court'),ctx=canvas.getContext('2d');ctx.scale(2,2);
  const params=new URLSearchParams(location.search),ref=params.get('id');
  const token=(location.pathname||'').match(/\/s\/([a-z0-9]{8})\/?$/)?.[1]||'';
  const api=(window.WAVE_CONFIG?.apiUrl||'').replace(/\/$/,'');
  // Vue de dos : la nageoire droite est à droite de l’écran.
  const BALL_START={x:246,y:278,r:16};
  const GAME={goal:13,duration:15000,aimSpeed:300,hitRadius:.45,shotCooldown:180,flightDuration:120,flightEnd:160};
  let duration=({A:15000,B:30000,C:30000})[ref]||GAME.duration;
  let activity='basket',goal=13,puzzle=null,board=[],runner=null,jumps=[];
  let state='ready',score=0,phase=0,target=.5,epoch=0,deadline=0,flight=null,lastShot=-Infinity,session='',seq=0,clockOffset=0,pending=false;
  let journey=null,run='',journeyBusy=false;
  const journeyKey='wave-journey-id-v1',stageActivities=['basket','puzzle','runner'];
  const practice=!api&&!token,now=()=>Date.now()+clockOffset;
  let valid=!token&&['A','B','C'].includes(ref),resolved=!token;
  let soundOptOut=false,lastCountdown=-1;
  $('mode').textContent=!valid?'Scanne un QR code du jeu pour commencer.':practice?'Entraînement · Indices à activer':'';
  $('start').disabled=!valid;
  const mascot=new Image();let mascotReady=false;
  $('start').disabled=true;
  mascot.onload=()=>{mascotReady=true;$('start').disabled=!valid||journeyBusy||journey?.phase==='locked';};
  mascot.onerror=()=>{$('coverTitle').textContent='Visuel indisponible';$('coverText').textContent='Recharge la page pour charger le pingouin Wave.';};
  mascot.src='../assets/pingouin-wave-dos.png';
  async function request(path,body){
    const before=Date.now();const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    let data;try{data=await r.json();}catch{throw new Error('Le service est momentanément indisponible.');}
    if(!r.ok){const e=new Error(data.error||'Connexion interrompue. Réessaie.');e.status=r.status;e.details=data;throw e;}
    if(typeof data.serverNow==='number')clockOffset=data.serverNow-(before+Date.now())/2;
    return data;
  }
  function gameBody(extra={}){return {session,...(journey?{run}:{}),...extra};}
  function applyJourney(d){
    if(!d.journey)return;
    journey=d.journey;if(d.run)run=d.run;window.WAVE_JOURNEY_ACTIVE=true;
    document.body.classList.add('journey-mode');$('journeyStatus').hidden=false;
    $('journeyStatus').textContent='Tentative '+journey.attempt+'/2 · Vies '+journey.lives+'/3 · Défi '+(journey.stage+1)+'/3';
    const found=journey.clues.length;
    $('huntStatus').textContent=found===3?'3/3 indices trouvés ! Ouvre le coffre.':found+'/3 indices trouvés · '+(3-found)+' à gagner.';
    $('journeyClues').hidden=found===0;
    $('journeyClues').textContent='Tes indices : '+['left','center','right'].map(p=>journey.clues.find(c=>c.position===p)?.reward||'— —').join(' · ');
  }
  function paintReward(d){
    applyJourney(d);
    $('reward').textContent=d.reward;$('result').dataset.position=d.position;
    $('resultTitle').textContent='TROUVE LE CODE';$('resultText').textContent='Tu as trouvé un indice !';
    const found=journey?journey.clues.length:window.WaveHunt?.record(d.position)||1;
    $('result').dataset.found=String(found);
    $('resultProgress').textContent=found===3?'Tu as réuni les 3 indices pour trouver le code à 6 chiffres !':'Tu as réuni '+found+' '+(found===1?'indice':'indices')+' sur 3. Encore '+(3-found)+' '+(found===2?'autre':'autres')+' pour trouver le code à 6 chiffres.';
    $('resultNote').textContent=journey?(found===3?'Tes 3 indices sont réunis !\nTu peux maintenant ouvrir le coffre.':'Fais une capture d’écran de cet indice.\nPuis continue vers le prochain jeu.'):(found===3?'Fais une capture d’écran de cet indice.\nTes 3 indices sont réunis : rejoins le coffre !':'Fais une capture d’écran de cet indice.\nPuis scanne le prochain QR code.');
    $('nextChallenge').hidden=!journey||journey.phase==='complete';
    $('nextChallenge').textContent=journey?.stage===0?'Continuer vers le puzzle':'Continuer vers la course';
    $('journeyVault').hidden=!journey||journey.phase!=='complete';
  }
  function prepareJourney(d){
    applyJourney(d);state='ready';flight=null;pending=false;score=0;seq=0;puzzle?.setEnabled(false);
    setActivity(stageActivities[journey.stage]);setDuration(({A:15000,B:30000,C:30000})[journey.ref]);
    stats();
    $('loadingCard').hidden=true;$('gameCard').hidden=false;$('emptyCard').hidden=true;
    $('mode').textContent='Défi '+(journey.stage+1)+' sur 3 · 3 vies partagées entre les jeux';
    $('result').hidden=true;$('play').hidden=false;$('cover').hidden=false;$('shoot').disabled=true;
    document.body.classList.remove('game-won');$('nextChallenge').hidden=true;$('journeyVault').hidden=true;
    $('reward').textContent='';$('result').dataset.position='';
    if(['revealed','complete'].includes(journey.phase)){
      state='won';document.body.classList.add('game-won');$('play').hidden=true;$('result').hidden=false;
      const clue=journey.clues.find(c=>c.position===['left','center','right'][journey.stage]);
      if(clue)paintReward(clue);return;
    }
    $('coverTitle').textContent=journey.phase==='locked'?'Tes deux tentatives sont terminées':journey.phase==='failed'?'Tu as utilisé tes 3 vies':'À toi de jouer !';
    if(journey.phase==='locked')$('coverText').textContent='Merci d’avoir participé ! Fais appel à l’équipe Wave.';
    else if(journey.phase==='failed')$('coverText').textContent='Tu as une seconde chance : recommence les trois jeux avec 3 nouvelles vies.';
    else if(journey.phase==='playing')$('coverText').textContent='Reprends ton défi. Le chronomètre de cette manche continue à s’écouler.';
    else if(journey.stage===0)$('coverText').textContent+=' Tu as 3 vies pour les 3 jeux, et une seconde tentative du parcours.';
    $('start').textContent=journey.phase==='failed'?'Recommencer le parcours':journey.phase==='playing'?'Reprendre le défi':'Commencer le défi';
    $('start').disabled=journey.phase==='locked'||!mascotReady;
  }
  async function loadJourney(){
    let saved='';try{saved=localStorage.getItem(journeyKey)||'';}catch{}
    let d;try{d=await request('/journey',{token,...(saved?{session:saved}:{})});}
    catch(e){if(saved&&e.status===410)d=await request('/journey',{token});else throw e;}
    session=d.session;try{localStorage.setItem(journeyKey,session);}catch{}
    prepareJourney(d);
  }
  async function nextChallenge(){
    if(!journey||journeyBusy)return;journeyBusy=true;$('nextChallenge').disabled=true;
    try{prepareJourney(await request('/journey/next',{session,stage:journey.stage}));}
    catch(e){$('resultNote').textContent=e.message+' Appuie à nouveau pour continuer.';}
    finally{journeyBusy=false;$('nextChallenge').disabled=false;}
  }
  async function chargeLife(title,text){
    state='accounting';$('start').disabled=true;
    try{
      const d=await request('/journey/fail',gameBody());prepareJourney(d);
      if(journey.phase==='ready'){state='lost';$('coverTitle').textContent=title;$('coverText').textContent=text+' Il te reste '+journey.lives+' vie'+(journey.lives>1?'s':'')+' pour finir le parcours.';$('start').textContent='Réessayer ce défi';}
    }catch(e){
      if(e.details?.journey)prepareJourney(e.details);
      else{state='lost';$('coverText').textContent='Vérifie ta connexion. Ta progression sera vérifiée avant de reprendre.';$('start').textContent='Reprendre le défi';$('start').disabled=false;}
    }
  }
  function setDuration(value){
    if(![15000,13000,11000,30000].includes(value))throw new Error('Durée du défi indisponible. Réessaie.');
    duration=value;
    $('challengeTitle').textContent=activity==='puzzle'?'Le puzzle du pingouin':activity==='runner'?'La course sur la banquise':'13 paniers. '+duration/1000+' secondes.';
    if(state!=='playing')$('timer').textContent='00:'+String(duration/1000).padStart(2,'0');
    $('coverText').textContent=activity==='puzzle'?'Reconstitue le pingouin en 30 secondes. Touche deux pièces pour les échanger.':activity==='runner'?'Cours pendant 30 secondes. Appuie sur « Sauter ! » pour éviter les obstacles.':'Appuie sur « Tirer ! » : chaque tir compte. Marque 13 paniers en '+duration/1000+' secondes.';
  }
  function setActivity(value){
    activity=['puzzle','runner'].includes(value)?value:'basket';goal=activity==='puzzle'?9:activity==='runner'?7:13;
    document.body.classList.toggle('puzzle-mode',activity==='puzzle');document.body.classList.toggle('runner-mode',activity==='runner');
    $('court').hidden=activity==='puzzle';$('puzzleBoard').hidden=activity!=='puzzle';$('puzzleModel').hidden=activity!=='puzzle';$('shoot').hidden=activity==='puzzle';
    $('scoreLabel').textContent=activity==='puzzle'?'PIÈCES':activity==='runner'?'OBSTACLES':'PANIERS';
    $('gameHint').textContent=activity==='puzzle'?'TOUCHE DEUX PIÈCES POUR LES ÉCHANGER':activity==='runner'?'APPUIE SUR SAUTER AVANT L’OBSTACLE':'APPUIE SUR TIRER POUR MARQUER';
    $('shoot').textContent=activity==='runner'?'Sauter !':'Tirer !';
    document.querySelectorAll('.progress i').forEach((d,i)=>d.hidden=i>=goal);
    if(activity==='puzzle'&&!puzzle){if(!window.WavePuzzle)throw new Error('Recharge la page pour charger le puzzle.');puzzle=window.WavePuzzle.create($('puzzleBoard'),swap);}
    if(activity==='runner'&&!runner){if(!window.WaveRunner)throw new Error('Recharge la page pour charger la course.');runner=window.WaveRunner.create(ctx);runner.ready.catch(()=>{});}
  }
  function accept(d){if(d.activity&&d.activity!==activity)setActivity(d.activity);score=d.score;seq=d.seq;phase=d.phase;target=d.target;epoch=d.startedAt;deadline=d.deadline;if(activity==='puzzle'){board=d.board;puzzle.render(board);}if(activity==='runner')jumps=d.jumps;setDuration(d.duration||d.deadline-d.startedAt);}
  function aim(t){return .5+.44*Math.sin((t-epoch)/GAME.aimSpeed+phase);}
  function stats(){const s=Math.max(0,Math.ceil((deadline-now())/1000));$('score').textContent=score+' / '+goal;if(state==='playing'){$('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');if(s>0&&s<=3&&s!==lastCountdown){lastCountdown=s;WaveUI.tone(620,.045,.015);}}$('timerBox').classList.toggle('urgent',state==='playing'&&s<=5);document.querySelectorAll('.progress i').forEach((d,i)=>d.classList.toggle('on',i<score));}
  function fail(title,text,consume=false){if(journey&&state==='accounting')return;state='lost';flight=null;pending=false;puzzle?.setEnabled(false);$('shoot').disabled=true;$('cover').hidden=false;$('coverTitle').textContent=title;$('coverText').textContent=text;$('start').textContent='Réessayer';$('start').disabled=false;if(journey&&consume)chargeLife(title,text);}
  async function start(){
    if(token&&!resolved){await resolveScan();return;}
    if(journey?.phase==='locked'||journeyBusy)return;
    if(journey?.phase==='failed'){
      journeyBusy=true;$('start').disabled=true;
      try{prepareJourney(await request('/journey/restart',{session,attempt:journey.attempt}));}
      catch(e){if(e.details?.journey)prepareJourney(e.details);else{$('coverText').textContent=e.message;$('start').disabled=false;}}
      finally{journeyBusy=false;}return;
    }
    if(!mascotReady||!valid||state==='starting'||state==='playing')return;state='starting';$('start').disabled=true;$('coverText').textContent='Prépare-toi…';
    if(!soundOptOut)WaveUI.enableSound().then(ok=>{if(soundOptOut){WaveUI.disableSound();return;}$('sound').textContent=ok?'Son : activé':'Activer le son';if(!ok)soundOptOut=true;});
    try{
      if(activity==='runner')await runner.ready;
      if(practice){clockOffset=0;epoch=Date.now();deadline=epoch+duration;phase=Math.random()*6;target=.5;score=0;seq=0;if(activity==='puzzle'){board=window.WavePuzzle.scramble();score=board.filter((p,i)=>p===i).length;puzzle.render(board);}if(activity==='runner')jumps=[];}
      else{const d=await request(journey?'/journey/start':'/session',journey?{session}:token?{token}:{ref});if(d.session)session=d.session;applyJourney(d);accept(d);if(d.won){await win();return;}}
      flight=null;lastShot=-Infinity;lastCountdown=-1;pending=false;state='playing';$('feedback').textContent='';$('cover').hidden=true;$('shoot').disabled=false;$('start').disabled=false;stats();
      puzzle?.setEnabled(activity==='puzzle');
    }catch(e){if(e.details?.journey)prepareJourney(e.details);else fail('Connexion indisponible',e.message);}
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
        document.body.classList.remove('game-page');document.body.classList.add('empty-page');
        return;
      }
      if(d.journey){valid=true;journeyBusy=true;try{await loadJourney();}finally{journeyBusy=false;if(journey)$('start').disabled=journey.phase==='locked'||!mascotReady;}return;}
      setActivity(d.activity);setDuration(d.duration||GAME.duration);
      valid=true;$('gameCard').hidden=false;$('mode').textContent='Un indice se cache ici. Réunis les 3 !';
      $('coverTitle').textContent='À toi de jouer !';
      $('start').textContent='Commencer le défi';$('start').disabled=!mascotReady;state='ready';
    }catch(e){
      resolved=false;valid=false;
      $('loadingCard').hidden=true;$('gameCard').hidden=false;
      fail('Connexion indisponible',e.message);
    }
  }
  async function reveal(){
    $('retryReward').hidden=true;
    try{
      const d=await request('/reward',gameBody());
      if(!/^\d{2}$/.test(d.reward)||!['left','center','right'].includes(d.position))throw new Error('Indice indisponible.');
      paintReward(d);
    }
    catch{$('resultText').textContent='Défi réussi, ton indice est conservé quelques minutes.';$('resultNote').textContent='Vérifie ta connexion puis réessaie de l’afficher.';$('retryReward').hidden=false;}
  }
  async function win(){state='won';puzzle?.setEnabled(false);document.body.classList.add('game-won');$('shoot').disabled=true;$('play').hidden=true;$('result').hidden=false;$('resultNote').textContent='Ton indice arrive…';WaveUI.win();WaveUI.confetti();if(practice){$('resultText').textContent='Entraînement réussi !';$('resultNote').textContent='L’indice sera révélé ici lorsque le jeu sera activé.';$('result').dataset.position='center';}else await reveal();}
  async function swap(from,to){
    if(state!=='playing'||pending)return;
    if(now()>=deadline){fail('Le temps est écoulé !','Retente le puzzle pour découvrir ton indice.',true);return;}
    pending=true;
    try{
      if(practice){[board[from],board[to]]=[board[to],board[from]];score=board.filter((p,i)=>p===i).length;seq++;puzzle.render(board);}
      else accept(await request('/puzzle',gameBody({seq,from,to})));
      if(state!=='playing')return;pending=false;stats();WaveUI.tone(540,.04,.012);
      if(score===9)await win();else puzzle.setEnabled(true);
    }catch(e){fail('Puzzle interrompu',e.message,e.status===410);}
  }
  async function jump(){
    if(state!=='playing'||pending||now()>=deadline)return;
    const elapsed=now()-epoch;if(jumps.length&&elapsed-jumps.at(-1)<1200)return;
    jumps.push(elapsed);pending=true;WaveUI.shootSound();
    try{if(practice)seq++;else accept(await request('/jump',gameBody({seq})));pending=false;}
    catch(e){fail('Course interrompue',e.message,e.status===410);}
  }
  async function finishRun(){state='finishing';$('shoot').disabled=true;$('timer').textContent='00:00';
    try{if(!practice)accept(await request('/finish',gameBody()));await win();}
    catch(e){fail('Retente la course !',e.message,e.status===410);}
  }
  async function shoot(){
    if(state!=='playing'||flight||pending||now()-lastShot<GAME.shotCooldown)return;
    if(now()>=deadline){fail('Le temps est écoulé !','Tu as marqué '+score+' panier(s) sur '+GAME.goal+'. Retente le défi !',true);return;}
    lastShot=now();pending=true;$('shoot').disabled=true;$('feedback').textContent='';
    try{
      let hit;
      if(practice){hit=true;score++;seq++;}
      else{const d=await request('/shot',gameBody({seq}));hit=d.hit;accept(d);}
      if(state!=='playing')return;
      flight={at:performance.now(),hit,x:hit?195:305};pending=false;WaveUI.shootSound();
    }catch(e){pending=false;fail('Connexion interrompue',e.status===410?e.message:'Ta partie ne peut pas continuer. Relance le défi lorsque la connexion revient.',e.status===410);}
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
    if(activity!=='basket'){
      const elapsed=state==='ready'||state==='starting'?0:Math.min(duration,Math.max(0,now()-epoch));
      if(activity==='runner')runner.draw(elapsed,jumps);
      if(state==='playing'){
        if(activity==='runner'){
          score=window.WaveRunner.obstacles.filter(at=>at<=elapsed).length;
          if(window.WaveRunner.collision(elapsed,jumps))fail('Obstacle touché !','Appuie sur « Sauter ! » un peu avant l’obstacle. Retente la course !',true);
          else if(now()>=deadline&&!pending)finishRun();
          $('shoot').disabled=pending||(jumps.length>0&&elapsed-jumps.at(-1)<1200)||state!=='playing';
        }else if(now()>=deadline&&!pending)fail('Le temps est écoulé !','Retente le puzzle pour découvrir ton indice.',true);
        stats();
      }
      requestAnimationFrame(frame);return;
    }
    court(t);
    if(state==='playing'){
      if(flight&&t-flight.at>=GAME.flightEnd){const hit=flight.hit;flight=null;$('feedback').textContent=hit?'Panier ! 🏀':'Presque ! Ajuste ton timing.';if(hit)WaveUI.basketSound();else WaveUI.missSound();stats();if(score>=GAME.goal){win();}else{$('shoot').disabled=false;}}
      if(state==='playing'&&now()>=deadline&&!flight&&!pending){$('timer').textContent='00:00';fail('Le temps est écoulé !','Tu as marqué '+score+' panier(s) sur '+GAME.goal+'. Retente le défi pour découvrir ton indice.',true);}
      if(state==='playing')stats();
    }
    const marker=state==='playing'?aim(now()):.3;$('marker').style.left=(marker*100)+'%';$('zone').style.left=((target-GAME.hitRadius)*100)+'%';$('zone').style.width=(GAME.hitRadius*200)+'%';
    requestAnimationFrame(frame);
  }
  $('start').onclick=start;$('shoot').onclick=()=>activity==='runner'?jump():shoot();$('retryReward').onclick=reveal;
  $('nextChallenge').onclick=nextChallenge;
  $('sound').onclick=async()=>{if(!soundOptOut){soundOptOut=true;WaveUI.disableSound();$('sound').textContent='Son : coupé';}else{const enabled=await WaveUI.enableSound();soundOptOut=!enabled;$('sound').textContent=enabled?'Son : activé':'Activer le son';}};
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.target.tagName!=='BUTTON'&&state==='playing'&&activity!=='puzzle'){e.preventDefault();activity==='runner'?jump():shoot();}});
  requestAnimationFrame(frame);
  if(!token){if(practice&&['B','C'].includes(ref))setActivity(ref==='B'?'puzzle':'runner');setDuration(duration);}
  if(token)resolveScan();
})();
