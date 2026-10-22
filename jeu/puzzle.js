(() => {
 'use strict';
 function valid(board){return Array.isArray(board)&&board.length===9&&new Set(board).size===9&&board.every(n=>Number.isInteger(n)&&n>=0&&n<9);}
 function scramble(){return [1,0,2,3,5,4,7,6,8];}
 function create(element,onSwap){
  let board=scramble(),selected=-1,enabled=false;
  const tiles=Array.from({length:9},(_,i)=>{
   const button=document.createElement('button');button.type='button';button.className='puzzle-tile';
   const image=document.createElement('img');image.src='../assets/pingouin-wave-original.svg';image.alt='';image.draggable=false;button.append(image);
   button.onclick=async()=>{
    if(!enabled)return;
    if(selected===i){selected=-1;draw();return;}
    if(selected<0){selected=i;draw();return;}
    const from=selected;selected=-1;setEnabled(false);await onSwap(from,i);
   };
   return button;
  });
  element.replaceChildren(...tiles);
  function draw(){tiles.forEach((tile,i)=>{
   const piece=board[i];tile.firstChild.style.left=-(piece%3)*100+'%';tile.firstChild.style.top=-Math.floor(piece/3)*100+'%';
   tile.disabled=!enabled;tile.classList.toggle('selected',selected===i);tile.classList.toggle('placed',piece===i);
   tile.setAttribute('aria-label','Pièce à la ligne '+(Math.floor(i/3)+1)+', colonne '+(i%3+1)+(piece===i?', bien placée':''));tile.setAttribute('aria-pressed',String(selected===i));
  });}
  function setEnabled(value){enabled=value;if(!value)selected=-1;draw();}
  return {render(value){if(!valid(value))throw new Error('Puzzle indisponible. Réessaie.');board=[...value];selected=-1;draw();},setEnabled};
 }
 window.WavePuzzle=Object.freeze({valid,scramble,create});
})();
