var E=require('../js/swap-engine.js');
function allMoves(s){var out=[];for(var r=0;r<8;r++)for(var c=0;c<8;c++){if(E.isValidMove(s,[r,c],[r,c+1]))out.push([[r,c],[r,c+1]]);if(E.isValidMove(s,[r,c],[r+1,c]))out.push([[r,c],[r+1,c]]);}return out;}
function goalsMet(L,s,st){var g=L.goals;if(g.score&&st.points<g.score)return false;if(g.jelly&&E.jellyLeft(s))return false;if(g.crates&&E.cratesLeft(s))return false;if(g.nuts&&s.nutsDone<g.nuts)return false;if(g.collect)for(var i=0;i<g.collect.length;i++)if((st.collected[g.collect[i][0]]||0)<g.collect[i][1])return false;return true;}
function score(L,s,mv){ // simple greedy: prefer specials, jelly spots, low rows, crates nearby
  var a=mv[0],b=mv[1],v=Math.random()*2+ (a[0]+b[0])*0.6; var A=s.cells[a[0]][a[1]],B=s.cells[b[0]][b[1]];
  if(A.sp||B.sp)v+=20; [a,b].forEach(function(p){v+=s.jelly[p[0]][p[1]]*4;});
  if(L.goals.nuts){[a,b].forEach(function(p){for(var r=0;r<p[0];r++)if(s.cells[r][p[1]]&&s.cells[r][p[1]].t===-2)v+=12;});}
  if(L.goals.crates){[a,b].forEach(function(p){[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var r=p[0]+d[0],c=p[1]+d[1];if(r>=0&&r<8&&c>=0&&c<8&&s.crate[r][c])v+=6;});});}
  return v;}
function play(L){var s=E.create(L),st={points:0,collected:{},cratesBroken:0,combo:1};
 for(var m=0;m<L.moves;m++){var ms=allMoves(s);if(!ms.length){E.shuffle(s);m--;continue;}ms.sort(function(x,y){return score(L,s,y)-score(L,s,x);});var mv=ms[0];
  st.combo=1;var res=E.comboSwap(s,mv[0],mv[1],st);if(!res){E.swap(s,mv[0],mv[1]);E.matchStep(s,mv,st);} 
  for(var g=0;g<60;g++){E.gravity(s);var n=E.collectNuts(s);if(n.length){st.points+=1000*n.length;continue;}st.combo++;if(!E.matchStep(s,null,st))break;}
  if(goalsMet(L,s,st))return {win:true,left:L.moves-m-1,pts:st.points};}
 return {win:false,pts:st.points};}
E.LEVELS.forEach(function(L){var w=0,left=0,T=30;for(var i=0;i<T;i++){var r=play(L);if(r.win){w++;left+=r.left;}}console.log('L'+L.n,JSON.stringify(L.goals),'win '+Math.round(w/T*100)+'%','avg moves left '+(w?(left/w).toFixed(1):'-'));});
