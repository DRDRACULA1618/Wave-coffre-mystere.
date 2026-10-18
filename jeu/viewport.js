(() => {
 'use strict';
 const viewport=window.visualViewport;
 function fit(){
  const height=Math.floor(viewport?.height||window.innerHeight||document.documentElement.clientHeight);
  const width=Math.floor(viewport?.width||window.innerWidth||document.documentElement.clientWidth);
  document.documentElement.style.setProperty('--game-viewport-height',height+'px');
  document.documentElement.style.setProperty('--game-viewport-width',width+'px');
  document.body.classList.toggle('short-game',height<600);
  document.body.classList.toggle('tiny-game',height<480);
  document.body.classList.toggle('micro-game',height<380);
 }
 fit();viewport?.addEventListener('resize',fit);
 window.addEventListener('resize',fit);window.addEventListener('orientationchange',fit);window.addEventListener('pageshow',fit);
})();
