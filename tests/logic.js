global.UI={h:function(){},store:function(){}};
var C=require('../js/checkers.js'), S=require('../js/sudoku.js');
// checkers: random self-play games terminate, AI vs random
function playGame(lr,lb){var s=C._initial(),n=0;while(n<400){var ms=C._moves(s);if(!ms.length)return (s.turn==='r'?'black':'red')+' wins in '+n;if(s.quiet>=80)return 'draw '+n;
var lv=s.turn==='r'?lr:lb;var m=lv?C._best(s,lv):ms[Math.floor(Math.random()*ms.length)];s=C._apply(s,m);n++;}return 'cap';}
console.log('L3 red vs random black:',playGame(3,0));
console.log('L1 red vs L3 black:',playGame(1,3));
// forced capture + double jump check
var s=C._initial();s.b=new Array(64).fill(null);s.b[5*8+2]='r';s.b[4*8+3]='b';s.b[2*8+5]='b';s.b[7*8+0]='r';
var ms=C._moves(s);console.log('jump moves',JSON.stringify(ms));
for(var l=1;l<=3;l++){var t=Date.now();var p=S._generate(l);var giv=p.puzzle.filter(Boolean).length;console.log('sudoku L'+l,'givens',giv,'unique',S._count(p.puzzle.slice(),2),Date.now()-t,'ms');}
