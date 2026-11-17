// High-Low Jack engine checks + full computer-vs-computer games (node tests/pitch_sim.js)
var E = require('../js/pitch-engine.js');
var assert = require('assert');
function C(r, s) { return s * 13 + r - 1; } // r 1..13, s 0..3

// Trick rules
assert(E.beats(C(2, 1), C(1, 0), 1), 'any trump beats an off-suit ace');
assert(!E.beats(C(13, 2), C(3, 0), 1), 'off suit, not trump, never wins');
assert(E.beats(C(1, 0), C(13, 0), 1), 'ace high');
assert.strictEqual(E.gameVal(C(10, 3)), 10);
assert.strictEqual(E.gameVal(C(1, 3)), 4);

// Follow suit, but trump is always allowed
var s = E.newGame({ names: ['A', 'B'], target: 11 });
s.phase = 'play'; s.trump = 1; s.turn = 1; s.bidder = 0; s.high = 2;
s.players[1].hand = [C(5, 0), C(9, 1), C(4, 2)];
s.trick = [{ s: 0, c: C(7, 0) }];
var L = E.legal(s, 1);
assert(L.indexOf(C(5, 0)) >= 0 && L.indexOf(C(9, 1)) >= 0 && L.indexOf(C(4, 2)) < 0, 'follow or trump: ' + L);

// Dealer is stuck when everyone passes
s = E.newGame({ names: ['A', 'B', 'C'], target: 11 });
var d = s.dealer;
assert(E.bid(s, s.turn, 0)); assert(E.bid(s, s.turn, 0));
assert.strictEqual(s.turn, d);
assert(!E.bid(s, d, 0), 'stuck dealer cannot pass');
assert(E.bid(s, d, 2)); assert.strictEqual(s.phase, 'play'); assert.strictEqual(s.turn, d);

// Full games
var games = 0, hands = 0, sets = 0, bidsMade = 0;
[[2, false], [3, false], [4, false], [4, true]].forEach(function (cfg) {
  for (var lvl = 1; lvl <= 3; lvl++) for (var g = 0; g < 25; g++) {
    var names = []; for (var i = 0; i < cfg[0]; i++) names.push('P' + i);
    var st = E.newGame({ names: names, target: [7, 11, 15, 21][g % 4], teams: cfg[1], level: lvl });
    var guard = 0;
    while (st.phase !== 'gameover') {
      if (++guard > 5000) throw new Error('game did not finish');
      if (st.phase === 'over') { assert(E.nextRound(st)); continue; }
      if (st.phase === 'bid') { var v = E.aiBid(st); assert(E.bid(st, st.turn, v), 'bad ai bid ' + v); continue; }
      var c = E.aiPlay(st), seat = st.turn;
      assert(E.legal(st, seat).indexOf(c) >= 0, 'ai played an illegal card');
      assert(E.play(st, seat, c));
      // conservation: hands + trick + taken = 6 per player
      var n = st.trick.length;
      st.players.forEach(function (p) { n += p.hand.length + p.taken.length; });
      assert.strictEqual(n, 6 * st.players.length, 'cards lost');
      if (st.result && st.phase !== 'bid' && st.tricks === 6) {
        var r = st.result; hands++;
        if (r.made) bidsMade++; else sets++;
        var total = r.pts.reduce(function (a, b) { return a + b; }, 0);
        assert(total >= 2 && total <= 4, 'points per hand 2..4, got ' + total);
        assert(E.suit(r.high.c) === st.trump && E.suit(r.low.c) === st.trump);
      }
    }
    assert(st.winner !== null && st.scores[st.winner] >= st.target);
    games++;
  }
});
console.log('ok', games, 'games', hands, 'hands', 'bids made', bidsMade, 'set', sets);
