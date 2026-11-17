var E=require('../js/swap-engine.js');
function allMoves(s){var out=[];for(var r=0;r<8;r++)for(var c=0;c<8;c++){if(E.isValidMove(s,[r,c],[r,c+1]))out.push([[r,c],[r,c+1]]);if(E.isValidMove(s,[r,c],[r+1,c]))out.push([[r,c],[r+1,c]]);}return out;}
function sc(s,mv){var A=s.cells[mv[0][0]][mv[0][1]],B=s.cells[mv[1][0]][mv[1][1]];return (A.sp||B.sp?20:0)+(mv[0][0]+mv[1][0])*0.6+Math.random()*2;}
[8,16,24].forEach(function(n){var L=E.LEVELS[n-1],B=L.goals.boss,w=0,T=40,left=0;for(var t=0;t<T;t++){var s=E.create(L),st={points:0,collected:{},combo:1,damage:0};var won=false;
 for(var m=0;m<L.moves+5;m++){var ms=allMoves(s);if(!ms.length){E.shuffle(s);m--;continue;}ms.sort(function(x,y){return sc(s,y)-sc(s,x);});var mv=ms[0];st.combo=1;
  if(!E.comboSwap(s,mv[0],mv[1],st)){E.swap(s,mv[0],mv[1]);E.matchStep(s,mv,st);}
  for(var g=0;g<60;g++){E.gravity(s);if(E.collectNuts(s).length)continue;st.combo++;if(!E.matchStep(s,null,st))break;}
  if(st.damage>=B.hp){won=true;left+=L.moves-m-1;break;}
  if((m+1)%B.every===0){E.bossAttack(s,B.spawn);if(!E.findMove(s))E.shuffle(s);}}
 if(won)w++;}console.log('L'+n,B.name,'hp',B.hp,'win (with +5)',Math.round(w/T*100)+'%','avg left',(left/Math.max(1,w)).toFixed(1));});
