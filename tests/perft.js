var E = require('../js/chess-engine.js');
function fen(f){var p=f.split(' ');var rows=p[0].split('/').map(function(r){return r.replace(/\d/g,function(d){return '.'.repeat(+d);});});
var s=E.fromPlacement(rows,p[1],{K:p[2].indexOf('K')>=0,Q:p[2].indexOf('Q')>=0,k:p[2].indexOf('k')>=0,q:p[2].indexOf('q')>=0});
if(p[3]!=='-'){s.ep=(8-(+p[3][1]))*8+'abcdefgh'.indexOf(p[3][0]);}return s;}
function perft(s,d){if(d===0)return 1;var n=0;E.legal(s).forEach(function(m){n+=perft(E.make(s,m),d-1);});return n;}
var t=Date.now();
console.log('start d3', perft(E.initial(),3), 'expect 8902');
console.log('start d4', perft(E.initial(),4), 'expect 197281');
var kp=fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
console.log('kiwi d1', perft(kp,1),'expect 48'); console.log('kiwi d2', perft(kp,2),'expect 2039'); console.log('kiwi d3', perft(kp,3),'expect 97862');
var p3=fen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -'); console.log('pos3 d4', perft(p3,4),'expect 43238');
var p5=fen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -'); console.log('pos5 d3', perft(p5,3),'expect 62379');
console.log('ms', Date.now()-t);
[1,2,3].forEach(function(l){var t0=Date.now();var m=E.bestMove(E.initial(),l);console.log('level',l,E.sqName(m.f)+E.sqName(m.t),Date.now()-t0,'ms');});
var t1=Date.now();var m=E.bestMove(kp,3);console.log('kiwi L3',E.sqName(m.f)+E.sqName(m.t),Date.now()-t1,'ms');
// mate in 1: white Qh5xf7
var mt=fen('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq -');[2,3].forEach(function(l){var mv=E.bestMove(mt,l);console.log('mate-in-1 L'+l,E.san(mt,mv));});
