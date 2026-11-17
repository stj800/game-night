var E = require('../js/chess-engine.js');
var rows='r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR'.split('/').map(function(r){return r.replace(/\d/g,function(d){return '.'.repeat(+d);});});
var s=E.fromPlacement(rows,'w',{K:true,Q:true,k:true,q:true});
var m=E.legal(s).filter(function(m){return E.san(s,m)==='Qxf7#';})[0];
var n=E.make(s,m); console.log('black legal', E.legal(n).length, E.inCheck(n,'b'));
for(var i=0;i<5;i++){var b=E.bestMove(s,2);console.log(E.san(s,b));}
