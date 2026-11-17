/* High-Low Jack (Pitch) rules engine. Pure JSON state, no DOM. Cards 0-51: suit = floor(c/13), rank = c%13+1 (A=1 .. K=13).
   House rules used here (the common "4-point pitch"):
   - 6 cards each. Bid 2, 3 or 4 (or pass). If everyone passes, the dealer is stuck with 2.
   - The high bidder leads first; that card's suit is trump.
   - You must follow the suit that was led if you can, but you may always play trump instead.
   - Points: High (highest trump played), Low (lowest trump played, goes to whoever played it),
     Jack (whoever takes the Jack of trump in a trick), Game (most game points in tricks taken: 10=10, A=4, K=3, Q=2, J=1; a tie means nobody gets it).
   - Make your bid and you score what you took. Miss it and your bid comes off your score ("set").
   - First to the target wins. If the bidder makes the bid and crosses the target, the bidder wins even if others cross too. */
var PitchEngine = (function () {
  var SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
  var SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
  var RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  function rank(c) { return c % 13 + 1; }
  function suit(c) { return Math.floor(c / 13); }
  function red(c) { var s = suit(c); return s === 1 || s === 2; }
  function label(c) { return RANKS[rank(c)] + SUITS[suit(c)]; }
  function power(c) { var r = rank(c); return r === 1 ? 14 : r; }
  function gameVal(c) { var r = rank(c); return r === 10 ? 10 : r === 1 ? 4 : r === 13 ? 3 : r === 12 ? 2 : r === 11 ? 1 : 0; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function teamCount(s) { return s.teams ? 2 : s.players.length; }
  function sides(s) {
    var out = [];
    for (var t = 0; t < teamCount(s); t++) out.push({ members: [], score: s.scores[t] });
    s.players.forEach(function (p, i) { out[p.team].members.push(i); });
    return out;
  }

  function newGame(o) {
    var n = o.names.length;
    var s = { gid: Math.random().toString(36).slice(2, 8), target: o.target || 11, teams: !!o.teams && n === 4, level: o.level || 2,
      round: 0, dealer: Math.floor(Math.random() * n), history: [], winner: null,
      players: o.names.map(function (nm, i) { return { name: nm, hand: [], taken: [], team: 0 }; }) };
    s.players.forEach(function (p, i) { p.team = s.teams ? i % 2 : i; });
    s.scores = []; for (var t = 0; t < teamCount(s); t++) s.scores.push(0);
    deal(s);
    return s;
  }
  function deal(s) {
    var n = s.players.length, deck = shuffle(Array.apply(null, Array(52)).map(function (x, i) { return i; }));
    s.round++;
    s.players.forEach(function (p) { p.hand = []; p.taken = []; });
    for (var k = 0; k < 6; k++) for (var j = 1; j <= n; j++) s.players[(s.dealer + j) % n].hand.push(deck.pop());
    s.stock = deck.length; // undealt cards stay hidden
    s.bids = s.players.map(function () { return null; });
    s.high = 0; s.bidder = -1; s.trump = null; s.trick = []; s.lastTrick = null; s.tricks = 0; s.played = [];
    s.phase = 'bid'; s.turn = (s.dealer + 1) % n; s.result = null;
  }
  function nextRound(s) {
    if (s.phase !== 'over') return false;
    s.dealer = (s.dealer + 1) % s.players.length;
    deal(s);
    return true;
  }

  // ---------- bidding ----------
  function minBid(s) { return Math.max(2, s.high + 1); }
  function canPass(s, seat) { return !(seat === s.dealer && s.high === 0); }
  function bid(s, seat, v) {
    if (s.phase !== 'bid' || s.turn !== seat) return false;
    v = +v || 0;
    if (v === 0) { if (!canPass(s, seat)) return false; }
    else { if (v < minBid(s) || v > 4) return false; s.high = v; s.bidder = seat; }
    s.bids[seat] = v;
    if (seat === s.dealer || v === 4) { s.phase = 'play'; s.turn = s.bidder; }
    else s.turn = (seat + 1) % s.players.length;
    return true;
  }

  // ---------- trick play ----------
  function ledSuit(s) { return s.trick.length ? suit(s.trick[0].c) : null; }
  function legal(s, seat) {
    var hand = s.players[seat].hand;
    if (!s.trick.length) return hand.slice();
    var L = ledSuit(s), follow = hand.filter(function (c) { return suit(c) === L; });
    if (!follow.length) return hand.slice();
    return hand.filter(function (c) { return suit(c) === L || suit(c) === s.trump; });
  }
  function beats(a, b, trump) {
    var ta = suit(a) === trump, tb = suit(b) === trump;
    if (ta && !tb) return true;
    if (!ta && tb) return false;
    return suit(a) === suit(b) && power(a) > power(b);
  }
  function trickWinner(trick, trump) {
    var best = trick[0];
    for (var i = 1; i < trick.length; i++) if (beats(trick[i].c, best.c, trump)) best = trick[i];
    return best.s;
  }
  function play(s, seat, c) {
    if (s.phase !== 'play' || s.turn !== seat) return false;
    if (legal(s, seat).indexOf(c) < 0) return false;
    var hand = s.players[seat].hand; hand.splice(hand.indexOf(c), 1);
    if (s.trump === null) s.trump = suit(c);
    s.trick.push({ s: seat, c: c }); s.played.push({ s: seat, c: c });
    var n = s.players.length;
    if (s.trick.length === n) {
      var w = trickWinner(s.trick, s.trump);
      s.trick.forEach(function (t) { s.players[w].taken.push(t.c); });
      s.lastTrick = { cards: s.trick, w: w, n: s.tricks + 1 };
      s.trick = []; s.tricks++; s.turn = w;
      if (s.tricks === 6) score(s);
    } else s.turn = (seat + 1) % n;
    return true;
  }

  // ---------- scoring ----------
  function score(s) {
    var T = s.trump, trumps = s.played.filter(function (p) { return suit(p.c) === T; });
    var hi = trumps[0], lo = trumps[0];
    trumps.forEach(function (p) { if (power(p.c) > power(hi.c)) hi = p; if (power(p.c) < power(lo.c)) lo = p; });
    var jackCard = T * 13 + 10, jack = null;
    s.players.forEach(function (p, i) { if (p.taken.indexOf(jackCard) >= 0) jack = { s: i, c: jackCard }; });
    var nt = teamCount(s), counts = [], pts = [], k;
    for (k = 0; k < nt; k++) { counts.push(0); pts.push(0); }
    s.players.forEach(function (p) { p.taken.forEach(function (c) { counts[p.team] += gameVal(c); }); });
    var top = Math.max.apply(null, counts), tops = counts.filter(function (x) { return x === top; }).length;
    var gameTeam = tops === 1 && top > 0 ? counts.indexOf(top) : null;
    pts[s.players[hi.s].team]++;
    pts[s.players[lo.s].team]++;
    if (jack) pts[s.players[jack.s].team]++;
    if (gameTeam !== null) pts[gameTeam]++;
    var bt = s.players[s.bidder].team, made = pts[bt] >= s.high, delta = [];
    for (k = 0; k < nt; k++) {
      var d = k === bt ? (made ? pts[k] : -s.high) : pts[k];
      s.scores[k] += d; delta.push(d);
    }
    var r = { bidder: s.bidder, bid: s.high, trump: T, made: made, pts: pts, delta: delta, counts: counts,
      high: hi, low: lo, jack: jack, game: gameTeam, scores: s.scores.slice() };
    s.result = r; s.history.push(r);
    // who wins?
    var winner = null;
    if (made && s.scores[bt] >= s.target) winner = bt;
    else {
      var best = -Infinity, ties = 0;
      for (k = 0; k < nt; k++) if (s.scores[k] >= s.target) {
        if (s.scores[k] > best) { best = s.scores[k]; winner = k; ties = 1; } else if (s.scores[k] === best) ties++;
      }
      if (ties > 1) winner = null;
    }
    s.winner = winner;
    s.phase = winner === null ? 'over' : 'gameover';
  }

  // ---------- computer players ----------
  function suitStrength(hand, t) {
    var tr = hand.filter(function (c) { return suit(c) === t; }).map(power).sort(function (a, b) { return b - a; });
    if (!tr.length) return 0;
    var e = 0, top = tr[0], low = tr[tr.length - 1];
    e += top === 14 ? 1 : top === 13 ? 0.65 : top === 12 ? 0.4 : top === 11 ? 0.2 : 0.05;
    e += low === 2 ? 1 : low === 3 ? 0.6 : low === 4 ? 0.35 : low === 5 ? 0.15 : 0;
    if (tr.indexOf(11) >= 0) e += Math.min(0.9, 0.35 + 0.18 * tr.filter(function (p) { return p > 11; }).length + 0.08 * tr.length);
    var tens = hand.filter(function (c) { return rank(c) === 10; }).length, aces = hand.filter(function (c) { return rank(c) === 1; }).length;
    e += Math.min(0.85, 0.15 + 0.1 * tr.length + 0.15 * tens + 0.08 * aces);
    if (tr.length >= 3) e += 0.2;
    if (tr.length >= 4) e += 0.2;
    return e;
  }
  function bestSuit(hand) {
    var best = 0, bv = -1;
    for (var t = 0; t < 4; t++) { var v = suitStrength(hand, t); if (v > bv) { bv = v; best = t; } }
    return { suit: best, value: bv };
  }
  function aiBid(s) {
    var seat = s.turn, hand = s.players[seat].hand, b = bestSuit(hand), est = b.value;
    if (s.level === 1) est += Math.random() * 1.2 - 0.6;
    if (s.level === 3) {
      // a partner who already bid is likely to help
      if (s.teams) { var pt = (seat + 2) % 4; if (s.bids[pt]) est += 0.35; }
      // the dealer bidding last can push a little
      if (seat === s.dealer && s.high > 0) est += 0.25;
    }
    var v = Math.floor(est + 0.15);
    if (v > 4) v = 4;
    if (v >= minBid(s)) return v;
    return canPass(s, seat) ? 0 : 2;
  }
  function unseenTrumpsAbove(s, seat, c) {
    // trumps higher than c that are neither played nor in my hand (they may be in another hand)
    var hand = s.players[seat].hand, played = {};
    s.played.forEach(function (p) { played[p.c] = 1; });
    var out = 0;
    for (var r = power(c) + 1; r <= 14; r++) {
      var card = s.trump * 13 + (r === 14 ? 0 : r - 1);
      if (!played[card] && hand.indexOf(card) < 0) out++;
    }
    return out;
  }
  function cheapest(cards) {
    return cards.slice().sort(function (a, b) { return gameVal(a) - gameVal(b) || power(a) - power(b); })[0];
  }
  function aiPlay(s) {
    var seat = s.turn, L = legal(s, seat), me = s.players[seat];
    if (!L.length) return null;
    if (s.level === 1 && Math.random() < 0.4) return L[Math.floor(Math.random() * L.length)];
    var T = s.trump;
    if (!s.trick.length) {
      if (T === null) { // the pitch: lead the top card of the best suit
        var bs = bestSuit(me.hand).suit, inS = L.filter(function (c) { return suit(c) === bs; });
        return inS.sort(function (a, b) { return power(b) - power(a); })[0];
      }
      var trumps = L.filter(function (c) { return suit(c) === T; }).sort(function (a, b) { return power(b) - power(a); });
      var onBid = s.players[s.bidder].team === me.team;
      if (trumps.length && unseenTrumpsAbove(s, seat, trumps[0]) === 0 && (onBid || s.level === 3) && power(trumps[0]) > 11) return trumps[0];
      var aces = L.filter(function (c) { return suit(c) !== T && rank(c) === 1; });
      if (aces.length) return aces[0];
      var off = L.filter(function (c) { return suit(c) !== T && gameVal(c) < 10; });
      return cheapest(off.length ? off : L);
    }
    var best = s.trick[0];
    for (var i = 1; i < s.trick.length; i++) if (beats(s.trick[i].c, best.c, T)) best = s.trick[i];
    var partnerWins = s.teams && s.players[best.s].team === me.team;
    var last = s.trick.length === s.players.length - 1;
    var pot = s.trick.reduce(function (a, t) { return a + gameVal(t.c); }, 0) + (s.trick.some(function (t) { return t.c === T * 13 + 10; }) ? 20 : 0);
    var winners = L.filter(function (c) { return beats(c, best.c, T); });
    if (partnerWins && (last || (suit(best.c) === T && unseenTrumpsAbove(s, seat, best.c) === 0))) {
      // partner has it: throw them points (but keep our high trumps)
      var gifts = L.filter(function (c) { return !(suit(c) === T && power(c) > 11); }).sort(function (a, b) { return gameVal(b) - gameVal(a); });
      if (gifts.length && gameVal(gifts[0]) > 0) return gifts[0];
      return cheapest(L);
    }
    if (winners.length && !partnerWins) {
      winners.sort(function (a, b) { var ta = suit(a) === T, tb = suit(b) === T; return (ta - tb) || power(a) - power(b); });
      var w = winners[0];
      var worth = last || pot >= 4 || suit(w) !== T || s.level === 1 || unseenTrumpsAbove(s, seat, w) === 0;
      // save the Jack of trump unless it wins for sure
      if (w === T * 13 + 10 && !last && unseenTrumpsAbove(s, seat, w) > 0 && winners.length > 1) w = winners[1];
      if (worth) return w;
    }
    // cannot (or should not) win: dump the least useful card, never the Jack or a 10 if we can help it
    var dump = L.filter(function (c) { return c !== T * 13 + 10 && gameVal(c) < 10; });
    return cheapest(dump.length ? dump : L);
  }

  return { SUITS: SUITS, SUIT_NAMES: SUIT_NAMES, RANKS: RANKS, rank: rank, suit: suit, red: red, label: label, power: power, gameVal: gameVal,
    newGame: newGame, nextRound: nextRound, minBid: minBid, canPass: canPass, bid: bid, legal: legal, play: play, beats: beats,
    sides: sides, teamCount: teamCount, aiBid: aiBid, aiPlay: aiPlay, bestSuit: bestSuit };
})();
if (typeof module !== 'undefined') module.exports = PitchEngine;
