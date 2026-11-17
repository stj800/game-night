var M=require('../js/mahjong.js'); var fails=0;
// worst case: a matching pair stacked on itself, plus other stuck piles
function T(id,x,y,z,m){return {id:id,x:x,y:y,z:z,face:{suit:'dot',n:m},match:'dot'+m};}
var cases=[ [T(0,0,0,0,1),T(1,0,0,1,1)],
  [T(0,0,0,0,1),T(1,0,0,1,1),T(2,2,0,0,2),T(3,2,0,1,2)],
  [T(0,0,0,0,1),T(1,2,0,0,2),T(2,4,0,0,1),T(3,6,0,0,2)] ];
cases.forEach(function(tiles,i){var r=M._reshuffle(tiles);var av=M._available(tiles).length;console.log('case',i,r,'pairs now',av);if(!r||!av)fails++;
  // and the result is fully clearable by random play
  var live=tiles.map(function(t){return Object.assign({},t);}); var guard=0; while(live.some(function(t){return !t.gone;})&&guard++<50){var ps=M._available(live); if(!ps.length){var rr=M._reshuffle(live); if(!rr){fails++;break;} continue;} ps[0][0].gone=ps[0][1].gone=true;} });
// random end-games from real boards: play randomly until stuck, then shuffle; must always be able to finish
M._LAYOUTS.forEach(function(L){var finished=0,T2=150;for(var k=0;k<T2;k++){var g=M._newGame(L);var guard=0;while(g.some(function(t){return !t.gone;})&&guard++<500){var ps=M._available(g);if(!ps.length){if(!M._reshuffle(g)){fails++;break;}continue;}var p=ps[Math.floor(Math.random()*ps.length)];p[0].gone=p[1].gone=true;}if(!g.some(function(t){return !t.gone;}))finished++;}console.log(L.name,'finished with shuffles',finished+'/'+T2);if(finished<T2)fails++;});
console.log(fails?fails+' FAILURES':'ALL PASS');
