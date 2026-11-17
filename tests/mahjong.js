var M=require('../js/mahjong.js'); var fails=0;
function solve(tiles){ // replay a random order of free pairs with backtracking-free greedy; deal guarantees a path exists, but greedy may fail -> count only crashes
  var live=tiles.map(function(t){return Object.assign({},t);}); var steps=0;
  while(live.some(function(t){return !t.gone;})){var ps=M._available(live); if(!ps.length) return false; var p=ps[Math.floor(Math.random()*ps.length)]; p[0].gone=p[1].gone=true; steps++;}
  return true;}
M._LAYOUTS.forEach(function(L){var ok=0,greedy=0,T=200,t0=Date.now();for(var i=0;i<T;i++){var g=M._newGame(L); if(!g){fails++;continue;} ok++;
  // every face pair count even per match group
  var cnt={}; g.forEach(function(t){cnt[t.match]=(cnt[t.match]||0)+1;}); if(Object.keys(cnt).some(function(k){return cnt[k]%2;})) fails++;
  if(solve(g)) greedy++;}
  console.log(L.name,L.pos.length,'tiles: dealt',ok+'/'+T,'random-play cleared',Math.round(greedy/T*100)+'%', ((Date.now()-t0)/T).toFixed(1)+'ms/deal');});
// reshuffle keeps it solvable
var g=M._newGame(M._LAYOUTS[1]); for(var k=0;k<10;k++){var ps=M._available(g); ps[0][0].gone=ps[0][1].gone=true;} console.log('reshuffle ok', M._reshuffle(g), 'pairs avail', M._available(g).length);
console.log(fails?fails+' FAILURES':'ALL PASS');
