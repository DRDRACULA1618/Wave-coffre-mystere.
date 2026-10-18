window.WaveUI = (() => {
  let audio, sound = false;
  async function enableSound(){
    try{audio ||= new (window.AudioContext || window.webkitAudioContext)();await audio.resume();sound=audio.state==='running';if(sound)tone(440,.05,.015);return sound;}catch{return false;}
  }
  function tone(freq,duration=.15,volume=.08,delay=0){
    if(!sound||audio?.state!=='running')return;
    const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;
    o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration+.02);
  }
  function win(){[523,659,784,1047].forEach((f,i)=>tone(f,.4,.09,i*.16));}
  function confetti(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const c=document.createElement('canvas');c.className='celebration';c.setAttribute('aria-hidden','true');document.body.append(c);
    c.width=innerWidth;c.height=innerHeight;const ctx=c.getContext('2d'),start=performance.now();
    const particles=Array.from({length:95},()=>({x:Math.random()*c.width,y:-Math.random()*c.height,v:80+Math.random()*140,w:5+Math.random()*7,r:Math.random()*6,color:['#fff','#ffa532','#073750','#77edff'][Math.floor(Math.random()*4)]}));
    let last=start;
    function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;ctx.clearRect(0,0,c.width,c.height);for(const p of particles){p.y+=p.v*dt;p.x+=Math.sin(now/500+p.r)*18*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r+now/700);ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,0,p.w,p.w*.6);ctx.restore();}if(now-start<5000)requestAnimationFrame(frame);else c.remove();}requestAnimationFrame(frame);
  }
  return {enableSound,tone,win,confetti};
})();
