// Rummy 500 engine checks + full computer-vs-computer games (node tests/rummy_sim.js)
var E = require('../js/rummy-engine.js');
var assert = require('assert');
function C(r, s) { return s * 13 + r - 1; } // r 1..13, s 0..3

// Meld rules
assert(E.asMeld([C(7, 0), C(7, 1), C(7, 2)]).type === 'set');
assert(!E.asMeld([C(7, 0), C(7, 1)]));
assert(E.asRun([C(1, 1), C(2, 1), C(3, 1)]).low === true);
assert(E.meldPoints(E.asRun([C(1, 1), C(2, 1), C(3, 1)])) === 6);
assert(E.meldPoints(E.asRun([C(12, 1), C(13, 1), C(1, 1)])) === 35);
assert(!E.asRun([C(13, 1), C(1, 1), C(2, 1)]), 'no wrap around');
assert(!E.asRun([C(4, 1), C(5, 1), C(6, 2)]), 'same suit only');
assert(E.layOffResult(E.asRun([C(4, 0), C(5, 0), C(6, 0)]), C(7, 0)));
assert(!E.layOffResult(E.asSet([C(9, 0), C(9, 1), C(9, 2), C(9, 3)]), C(9, 0)));
var b = E.bestMelds([C(5, 0), C(6, 0), C(7, 0), C(7, 1), C(7, 2), C(2, 3)]);
assert(b && b.pts >= 18, 'best melds ' + JSON.stringify(b));
assert(E.bestMelds([C(5, 0), C(6, 0), C(7, 0), C(7, 1), C(7, 2)], C(7, 1)).melds.some(function (m) { return m.type === 'set'; }));

// Full games
var games = 0, rounds = 0, turns = 0;
[[2, false], [3, false], [4, false], [4, true]].forEach(function (cfg) {
  for (var lvl = 1; lvl <= 3; lvl++) for (var g = 0; g < 6; g++) {
    var names = []; for (var i = 0; i < cfg[0]; i++) names.push('P' + i);
    var s = E.newGame({ names: names, target: [200, 300, 400, 500][g % 4], teams: cfg[1], level: lvl, deal: [0, 7, 10, 13, 0, 5][g] });
    if (g === 3) assert.strictEqual(s.players[0].hand.length, cfg[0] === 2 ? 13 : cfg[0] === 3 ? 10 : 7);
    var guard = 0;
    while (s.phase !== 'gameover') {
      if (++guard > 40000) throw new Error('game did not finish');
      if (s.phase === 'over') { E.nextRound(s); rounds++; continue; }
      var d = E.aiDraw(s);
      if (d.from === 'stock') assert(E.drawStock(s) !== null);
      else assert(E.drawDiscard(s, d.index).ok, 'ai picked an unusable card');
      var must = s.mustUse;
      E.aiPlay(s);
      turns++;
      // card conservation
      var n = s.stock.length + s.discard.length;
      s.players.forEach(function (p) { n += p.hand.length; });
      s.melds.forEach(function (m) { n += m.cards.length; assert(E.asMeld(m.cards), 'bad meld on table'); });
      assert.strictEqual(n, 52, 'cards lost');
      if (must !== null && must !== undefined) assert(s.melds.some(function (m) { return m.cards.indexOf(must) >= 0; }), 'must-use card not played');
    }
    games++;
  }
});
console.log('ok', games, 'games', rounds, 'rounds', turns, 'turns');
