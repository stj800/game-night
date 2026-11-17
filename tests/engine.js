var E=require('../js/swap-engine.js');
function stats(){return {points:0,collected:{},cratesBroken:0,combo:1};}
var fails=0; function ok(c,m){if(!c){fails++;console.log('FAIL',m);}}
// every level builds with a valid move and no starting matches
E.LEVELS.forEach(function(L){var st=E.create(L);ok(E.findMove(st),'move L'+L.n);ok(!E.runs(st).length,'no start match L'+L.n);});
// L shape -> bomb ; 4 -> striped ; 5 -> star
function blank(){var st=E.create(E.LEVELS[0]);for(var r=0;r<8;r++)for(var c=0;c<8;c++)st.cells[r][c]={t:(r*3+c*2)%5+0,sp:null};return st;}
function clearT(st){for(var r=0;r<8;r++)for(var c=0;c<8;c++)st.cells[r][c]={t:((r%2)*2+(c%2)+((r>>1)%2)*1)%4+1,sp:null};}
var st=E.create(E.LEVELS[0]); for(var r=0;r<8;r++)for(var c=0;c<8;c++)st.cells[r][c]={t:1+((r+c)%2)+ (r%2?2:0),sp:null};
// verify base has no runs
ok(!E.runs(st).length,'base no runs '+E.runs(st).length);
var s1=JSON.parse(JSON.stringify(st)); s1.cells[4][0].t=0;s1.cells[4][1].t=0;s1.cells[4][2].t=0;s1.cells[4][3].t=0;
var r1=E.matchStep(s1,null,stats()); ok(r1&&r1.created[0]&&(r1.created[0].sp==='col'),'4 in row -> col striped '+JSON.stringify(r1&&r1.created));
var s2=JSON.parse(JSON.stringify(st)); [[2,2],[3,2],[4,2],[4,3],[4,4]].forEach(function(p){s2.cells[p[0]][p[1]].t=0;});
var r2=E.matchStep(s2,null,stats()); ok(r2&&r2.created[0]&&r2.created[0].sp==='bomb'&&r2.created[0].r===4&&r2.created[0].c===2,'L -> bomb at corner '+JSON.stringify(r2&&r2.created));
var s3=JSON.parse(JSON.stringify(st)); for(var k=0;k<5;k++)s3.cells[6][k].t=0;
var r3=E.matchStep(s3,null,stats()); ok(r3&&r3.created[0]&&r3.created[0].sp==='star','5 -> star');
// striped fires a row
var s4=JSON.parse(JSON.stringify(st)); s4.cells[1][0]={t:0,sp:'row'}; s4.cells[1][1].t=0; s4.cells[1][2].t=0; s4.cells[0][0].t=3;s4.cells[2][0].t=4;
var x=stats(); var r4=E.matchStep(s4,null,x); ok(r4.cleared.length===8,'row stripe clears 8, got '+r4.cleared.length);
// combo: two bombs
var s5=JSON.parse(JSON.stringify(st)); s5.cells[3][3]={t:1,sp:'bomb'}; s5.cells[3][4]={t:2,sp:'bomb'}; var r5=E.comboSwap(s5,[3,3],[3,4],stats()); ok(r5&&r5.cleared.length===25,'bomb+bomb 5x5 '+(r5&&r5.cleared.length));
// star + fruit clears color
var s6=JSON.parse(JSON.stringify(st)); s6.cells[0][0]={t:-1,sp:'star'}; var t=s6.cells[0][1].t; var cnt=0; for(var r=0;r<8;r++)for(var c=0;c<8;c++)if(s6.cells[r][c].t===t)cnt++;
var r6=E.comboSwap(s6,[0,0],[0,1],stats()); ok(r6.cleared.length===cnt+1,'star clears colour '+r6.cleared.length+' vs '+(cnt+1));
// gravity fills everything, falls positive
var g=E.gravity(s6); var empty=0; for(var r=0;r<8;r++)for(var c=0;c<8;c++)if(!s6.cells[r][c])empty++; ok(empty===0,'gravity fills'); ok(g.every(function(f){return f.d>0;}),'falls positive');
// crates: hit by adjacent match, then break; jelly decrements
var L6=E.LEVELS[5], s7=E.create(L6); var crates0=E.cratesLeft(s7);
// simulate full games with random valid moves on all levels: no crash, goals progress
E.LEVELS.forEach(function(L){var s=E.create(L),st2=stats();for(var m=0;m<L.moves;m++){var mv=E.findMove(s);if(!mv){E.shuffle(s);continue;}var res=E.comboSwap(s,mv[0],mv[1],st2);if(!res){E.swap(s,mv[0],mv[1]);var combo=1;var guard=0;while(guard++<50){st2.combo=combo;var step=E.matchStep(s,combo===1?mv:null,st2);if(!step)break;E.gravity(s);E.collectNuts(s);E.gravity(s);combo++;}}else{E.gravity(s);while(E.matchStep(s,null,st2)){E.gravity(s);E.collectNuts(s);E.gravity(s);}}
 for(var r=0;r<8;r++)for(var c=0;c<8;c++){if(E.playable(s,r,c)&&!s.cells[r][c]){fails++;console.log('hole after move L'+L.n);r=9;break;}}}
 console.log('L'+L.n, 'pts',st2.points,'jelly left',E.jellyLeft(s),'crates left',E.cratesLeft(s),'nuts',s.nutsDone+'/'+(L.goals.nuts||0));});
console.log(fails?fails+' FAILURES':'ALL PASS');
