var S=require('../js/swap.js');
function grid(rows){return rows.map(function(r){return r.split('').map(function(ch){return {t:+ch,sp:null};});});}
var base=['01234501','12345012','23450123','34501234','45012345','50123450','01234501','12345012'];
// horizontal line: row 3 = 3 4 5 0 1 2 3 4 ; make 0 0 x 0 -> swap
var g=grid(base); g[3][0]={t:0,sp:null};g[3][1]={t:0,sp:null};g[3][2]={t:9,sp:null};g[3][3]={t:0,sp:null};g[2][2]={t:0,sp:null};
console.log('runs before', S._runs(g).length);
S._swap(g,[2,2],[3,2]); var r=S._runs(g); console.log('vertical-swap -> horizontal run', JSON.stringify(r));
var g2=grid(base); g2[3][0]={t:0,sp:null};g2[3][1]={t:0,sp:null};g2[3][3]={t:7,sp:null};g2[3][2]={t:7,sp:null};g2[3][3]={t:0,sp:null};
// row 3: 0 0 7 0 ... swap (3,2)<->(3,3)? that gives 0 0 0 7 -> horizontal run via horizontal swap
S._swap(g2,[3,2],[3,3]); console.log('horizontal-swap', JSON.stringify(S._runs(g2)));
// count runs by direction over random play
var h=0,v=0; for(var i=0;i<300;i++){var f=S._fresh(6); var m=S._findMove(f); S._swap(f,m[0],m[1]); S._runs(f).forEach(function(x){x.dir==='h'?h++:v++;});}
console.log('h',h,'v',v);
