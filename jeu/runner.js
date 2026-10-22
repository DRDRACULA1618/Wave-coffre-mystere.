(() => {
 'use strict';
 const obstacles=[4500,8200,11900,15600,19300,23000,26700],jumpDuration=1200;
 const safe=(at,jumps)=>jumps.some(t=>at-t>=120&&at-t<=1050);
 const collision=(elapsed,jumps)=>obstacles.some(at=>at<=elapsed&&!safe(at,jumps));
 function create(ctx){
  const image=new Image();
  const ready=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Le pingouin n’a pas pu être chargé. Recharge la page.'));});
  image.src='../assets/pingouin-wave-original.png';
  function draw(elapsed,jumps){
   ctx.save();ctx.setTransform(2,0,0,2,0,0);
   ctx.fillStyle='#dff8ff';ctx.fillRect(0,0,390,410);
   ctx.fillStyle='#a9e3f4';
   for(let i=0;i<4;i++){const x=((i*160-elapsed*.012)%640+640)%640-90;ctx.beginPath();ctx.moveTo(x,286);ctx.lineTo(x+50,181);ctx.lineTo(x+102,286);ctx.closePath();ctx.fill();}
   ctx.fillStyle='#68c9e5';ctx.fillRect(0,324,390,86);ctx.fillStyle='#fff';ctx.fillRect(0,324,390,14);
   ctx.strokeStyle='#b6e7f4';ctx.lineWidth=2;
   for(let i=0;i<7;i++){const x=((i*90-elapsed*.07)%630+630)%630-90;ctx.beginPath();ctx.moveTo(x,338);ctx.lineTo(x+22,370);ctx.lineTo(x+10,398);ctx.stroke();}
   const last=jumps.at(-1),age=last===undefined?jumpDuration:elapsed-last;
   const lift=age>=0&&age<jumpDuration?Math.sin(age/jumpDuration*Math.PI)*112:0;
   const bob=lift?0:Math.sin(elapsed/90)*2;
   if(image.complete||image.naturalWidth||image.width){ctx.save();ctx.translate(78,325-lift-bob);ctx.rotate(lift?-.08:Math.sin(elapsed/100)*.035);ctx.drawImage(image,722,3,766,1130,-31,-96,65,96);ctx.restore();}
   for(const at of obstacles){const x=78+(at-elapsed)*.12;if(x<-50||x>440)continue;ctx.fillStyle='#2799c2';ctx.beginPath();ctx.moveTo(x-18,324);ctx.lineTo(x-13,294);ctx.lineTo(x+5,282);ctx.lineTo(x+19,306);ctx.lineTo(x+22,324);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-13,294);ctx.lineTo(x+5,282);ctx.lineTo(x+15,300);ctx.stroke();}
   ctx.restore();
  }
  return {ready,draw};
 }
 window.WaveRunner=Object.freeze({obstacles,jumpDuration,collision,create});
})();
