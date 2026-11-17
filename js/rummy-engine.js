/* Rummy 500 rules engine. Pure functions on a plain JSON state (no DOM), so it can be saved,
   tested in node, and later shared over a network for online play. Cards are 0..51:
   suit = floor(c/13) (spades, hearts, diamonds, clubs), rank = c%13+1 (1 = Ace ... 13 = King). */
var RummyEngine = (function () {
  var SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
  var RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  function rank(c) { return c % 13 + 1; }
  function suit(c) { return Math.floor(c / 13); }
  function red(c) { var s = suit(c); return s === 1 || s === 2; }
  function label(c) { return RANKS[rank(c)] + SUITS[suit(c)]; }
  // Value of a card left in your hand (and of most melded cards)
  function value(c) { var r = rank(c); return r === 1 ? 15 : r >= 10 ? 10 : r; }

  // ---------- melds ----------
  function asRun(cards) {
    if (cards.length < 3 || cards.length > 13) return null;
    var s = suit(cards[0]);
    for (var i = 1; i < cards.length; i++) if (suit(cards[i]) !== s) return null;
    function tryAce(high) {
      var arr = cards.slice().sort(function (a, b) { return v(a) - v(b); });
      function v(c) { var r = rank(c); return r === 1 && high ? 14 : r; }
      for (var k = 1; k < arr.length; k++) if (v(arr[k]) !== v(arr[k - 1]) + 1) return null;
      return { type: 'run', cards: arr, low: !high && rank(arr[0]) === 1 };
    }
    return tryAce(false) || tryAce(true);
  }
  function asSet(cards) {
    if (cards.length < 3 || cards.length > 4) return null;
    for (var i = 1; i < cards.length; i++) if (rank(cards[i]) !== rank(cards[0])) return null;
    return { type: 'set', cards: cards.slice().sort(function (a, b) { return a - b; }) };
  }
  function asMeld(cards) { return asSet(cards) || asRun(cards); }
  // Points a card scores once it is on the table: an Ace at the bottom of A-2-3 is worth 1
  function meldValue(c, m) { return rank(c) === 1 && m.type === 'run' && m.low ? 1 : value(c); }
  function meldPoints(m) { var t = 0; m.cards.forEach(function (c) { t += meldValue(c, m); }); return t; }
  function layOffResult(m, c) {
    if (m.type === 'set') return rank(c) === rank(m.cards[0]) && m.cards.length < 4 ? asSet(m.cards.concat([c])) : null;
    return asRun(m.cards.concat([c]));
  }
  function layOffTarget(melds, c) {
    for (var i = 0; i < melds.length; i++) if (layOffResult(melds[i], c)) return i;
    return -1;
  }

  // Every meld that can be made from a hand
  function candidates(hand) {
    var out = [], byRank = {}, bySuit = [{}, {}, {}, {}];
    hand.forEach(function (c) { (byRank[rank(c)] = byRank[rank(c)] || []).push(c); bySuit[suit(c)][rank(c)] = c; });
    Object.keys(byRank).forEach(function (r) {
      var cs = byRank[r];
      if (cs.length === 3) out.push(cs.slice());
      if (cs.length === 4) { out.push(cs.slice()); for (var k = 0; k < 4; k++) out.push(cs.filter(function (_, j) { return j !== k; })); }
    });
    bySuit.forEach(function (m) {
      function at(v) { return m[v === 14 ? 1 : v]; }
      for (var a = 1; a <= 12; a++) {
        if (at(a) === undefined) continue;
        var run = [at(a)];
        for (var b = a + 1; b <= 14 && run.length < 13; b++) {
          if (at(b) === undefined) break;
          run.push(at(b));
          if (run.length >= 3) out.push(run.slice());
        }
      }
    });
    return out.map(function (cs) { var m = asMeld(cs); m.pts = meldPoints(m); return m; });
  }

  // Best set of non-overlapping melds (most points). must = a card that has to be in one of them.
  function bestMelds(hand, must) {
    var cands = candidates(hand), byCard = {};
    cands.forEach(function (m) { m.cards.forEach(function (c) { (byCard[c] = byCard[c] || []).push(m); }); });
    var order = hand.slice().sort(function (a, b) { return a - b; });
    var used = {}, pick = [], best = { pts: -1, melds: [] }, nodes = 0;
    function go(k, pts) {
      if (++nodes > 40000) return;
      while (k < order.length && used[order[k]]) k++;
      if (k >= order.length) {
        if (must !== undefined && must !== null && !used[must]) return;
        if (pts > best.pts) best = { pts: pts, melds: pick.slice() };
        return;
      }
      var c = order[k];
      (byCard[c] || []).forEach(function (m) {
        for (var i = 0; i < m.cards.length; i++) if (used[m.cards[i]]) return;
        m.cards.forEach(function (x) { used[x] = true; }); pick.push(m);
        go(k + 1, pts + m.pts);
        pick.pop(); m.cards.forEach(function (x) { used[x] = false; });
      });
      if (c !== must) { used[c] = 'left'; go(k + 1, pts); used[c] = false; }
    }
    go(0, 0);
    return best.pts < 0 ? null : best;
  }

  // Can this card be played right away (in a meld with the hand, or laid off on the table)?
  function canUse(hand, card, melds) {
    if (layOffTarget(melds, card) >= 0) return true;
    return !!bestMelds(hand, card);
  }

  // ---------- game state ----------
  function shuffle(a, rnd) { rnd = rnd || Math.random; for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // opts: { names: [...], target: 500, teams: bool, level: 1-3 }
  function newGame(opts) {
    var s = { gid: Math.random().toString(36).slice(2, 8), target: opts.target || 500, teams: !!opts.teams, deal: opts.deal || 0, level: opts.level || 2, round: 0, dealer: opts.names.length - 1,
      players: opts.names.map(function (n, i) { return { name: n, score: 0, hand: [], table: 0, team: opts.teams ? i % 2 : i }; }),
      history: [] };
    deal(s, opts.rnd);
    return s;
  }
  function deal(s, rnd) {
    var deck = []; for (var i = 0; i < 52; i++) deck.push(i);
    shuffle(deck, rnd);
    var n = s.players.length, per = s.deal ? Math.min(s.deal, n === 2 ? 13 : n === 3 ? 10 : 7) : (n === 2 ? 13 : 7);
    s.round++; s.dealer = (s.dealer + 1) % n;
    s.players.forEach(function (p) { p.hand = []; p.table = 0; });
    for (var k = 0; k < per; k++) for (var p = 0; p < n; p++) s.players[(s.dealer + 1 + p) % n].hand.push(deck.pop());
    s.discard = [deck.pop()]; s.stock = deck; s.melds = [];
    s.turn = (s.dealer + 1) % n; s.phase = 'draw'; s.mustUse = null; s.tookTop = null; s.result = null; s.log = [];
  }
  function cur(s) { return s.players[s.turn]; }
  function removeCards(hand, cards) { cards.forEach(function (c) { var i = hand.indexOf(c); if (i >= 0) hand.splice(i, 1); }); }

  function drawStock(s) {
    if (s.phase !== 'draw' || !s.stock.length) return null;
    var c = s.stock.pop(); cur(s).hand.push(c); s.phase = 'play'; s.tookTop = null; s.mustUse = null;
    return c;
  }
  // Take discard[index] and every card above it. A card below the top must be used right away.
  function drawDiscard(s, index) {
    if (s.phase !== 'draw' || index < 0 || index >= s.discard.length) return { ok: false };
    var picked = s.discard.slice(index), card = picked[0], deep = index < s.discard.length - 1;
    var hand = cur(s).hand;
    if (deep && !canUse(hand.concat(picked), card, s.melds)) return { ok: false, why: 'unusable' };
    s.discard = s.discard.slice(0, index);
    picked.forEach(function (c) { hand.push(c); });
    s.phase = 'play'; s.mustUse = deep ? card : null; s.tookTop = deep ? null : card;
    return { ok: true, picked: picked };
  }
  function meld(s, cards) {
    if (s.phase !== 'play') return null;
    var p = cur(s);
    for (var i = 0; i < cards.length; i++) if (p.hand.indexOf(cards[i]) < 0) return null;
    var m = asMeld(cards); if (!m) return null;
    m.by = s.turn; m.pts = meldPoints(m);
    s.melds.push(m); removeCards(p.hand, cards); p.table += m.pts;
    if (cards.indexOf(s.mustUse) >= 0) s.mustUse = null;
    checkOut(s);
    return m;
  }
  function layOff(s, card, mi) {
    if (s.phase !== 'play') return null;
    var p = cur(s), m = s.melds[mi];
    if (!m || p.hand.indexOf(card) < 0) return null;
    var nm = layOffResult(m, card); if (!nm) return null;
    m.cards = nm.cards; if (nm.type === 'run') m.low = nm.low;
    m.pts = meldPoints(m);
    removeCards(p.hand, [card]); p.table += meldValue(card, m);
    if (card === s.mustUse) s.mustUse = null;
    checkOut(s);
    return m;
  }
  function canDiscard(s, card) {
    if (s.phase !== 'play' || s.mustUse !== null) return false;
    var hand = cur(s).hand;
    if (hand.indexOf(card) < 0) return false;
    if (card === s.tookTop && hand.length > 1) return false;
    return true;
  }
  function discard(s, card) {
    if (!canDiscard(s, card)) return false;
    removeCards(cur(s).hand, [card]); s.discard.push(card);
    if (!cur(s).hand.length || !s.stock.length) { endRound(s, cur(s).hand.length ? 'stock' : 'out'); return true; }
    s.turn = (s.turn + 1) % s.players.length; s.phase = 'draw'; s.mustUse = null; s.tookTop = null;
    return true;
  }
  function checkOut(s) { if (s.phase === 'play' && !cur(s).hand.length) endRound(s, 'out'); }
  function handPoints(h) { var t = 0; h.forEach(function (c) { t += value(c); }); return t; }

  // Scores: per player (or per team when playing teams)
  function sides(s) {
    var out = [];
    s.players.forEach(function (p, i) {
      var k = p.team;
      if (!out[k]) out[k] = { members: [], score: 0 };
      out[k].members.push(i); out[k].score += p.score;
    });
    return out;
  }
  function endRound(s, how) {
    s.phase = 'over';
    var rows = s.players.map(function (p, i) { var hp = handPoints(p.hand); return { i: i, table: p.table, hand: hp, net: p.table - hp }; });
    rows.forEach(function (r) { s.players[r.i].score += r.net; });
    s.result = { how: how, by: s.turn, rows: rows };
    s.history.push(rows.map(function (r) { return r.net; }));
    var sd = sides(s), top = -Infinity, winners = [];
    sd.forEach(function (x, k) { if (x.score >= s.target) { if (x.score > top) { top = x.score; winners = [k]; } else if (x.score === top) winners.push(k); } });
    if (winners.length === 1) { s.phase = 'gameover'; s.winner = winners[0]; }
  }
  function nextRound(s, rnd) { if (s.phase === 'over') deal(s, rnd); }

  // ---------- computer player ----------
  function partnerOf(s, i) { if (!s.teams) return -1; return (i + 2) % s.players.length; }
  function bestPts(h) { var b = bestMelds(h); return b ? b.pts : 0; }

  // Returns { from: 'stock' } or { from: 'discard', index }
  function aiDraw(s, rnd) {
    rnd = rnd || Math.random;
    var lvl = s.level, hand = cur(s).hand, base = bestPts(hand), top = s.discard.length - 1;
    if (top >= 0) {
      var t = s.discard[top], gain = bestPts(hand.concat([t])) - base;
      if ((gain > 0 || layOffTarget(s.melds, t) >= 0) && (lvl > 1 || rnd() < 0.7)) return { from: 'discard', index: top };
    }
    if (lvl >= 2 && s.discard.length > 1) {
      var bestI = -1, bestG = lvl === 3 ? 6 : 12, lo = lvl === 3 ? 0 : Math.max(0, top - 5);
      for (var i = top - 1; i >= lo; i--) {
        var picked = s.discard.slice(i), all = hand.concat(picked), card = picked[0];
        var r = bestMelds(all, card), pts;
        if (r) pts = r.pts;
        else if (layOffTarget(s.melds, card) >= 0) pts = bestPts(all.filter(function (c) { return c !== card; })) + value(card);
        else continue;
        var inMeld = {}; if (r) r.melds.forEach(function (m) { m.cards.forEach(function (c) { inMeld[c] = 1; }); });
        var dead = 0; picked.forEach(function (c) { if (!inMeld[c] && c !== card) dead += value(c); });
        var g = pts - base - dead * (s.stock.length < 12 ? 0.9 : 0.45);
        if (g > bestG) { bestG = g; bestI = i; }
      }
      if (bestI >= 0) return { from: 'discard', index: bestI };
    }
    return { from: 'stock' };
  }

  // Plays the whole "after drawing" part of the turn. Returns a list of actions for the UI to animate.
  function aiPlay(s, rnd) {
    rnd = rnd || Math.random;
    var acts = [], p = cur(s), lvl = s.level, me = s.turn;
    // Melds
    var b = bestMelds(p.hand, s.mustUse !== null && layOffTarget(s.melds, s.mustUse) < 0 ? s.mustUse : undefined);
    if (b) b.melds.forEach(function (m) {
      if (s.phase !== 'play') return;
      if (lvl === 1 && m.type === 'run' && rnd() < 0.35 && m.cards.indexOf(s.mustUse) < 0) return; // beginners miss some runs
      var cards = m.cards.slice();
      // Keep one card in hand so there is something to discard, unless the meld finishes the hand
      if (meld(s, cards)) acts.push({ t: 'meld', cards: cards });
    });
    // Lay offs (repeat: one layoff can open another)
    var again = true;
    while (again && s.phase === 'play') {
      again = false;
      for (var k = 0; k < p.hand.length; k++) {
        var c = p.hand[k], mi = layOffTarget(s.melds, c);
        if (mi < 0) continue;
        if (lvl === 1 && rnd() < 0.3 && c !== s.mustUse) continue;
        if (p.hand.length === 1 && s.mustUse === null) {
          // Laying off the last card also goes out, that is fine
        }
        if (layOff(s, c, mi)) { acts.push({ t: 'layoff', card: c, meld: mi }); again = true; break; }
      }
    }
    if (s.phase !== 'play') return acts;
    var d = aiDiscard(s, rnd);
    discard(s, d); acts.push({ t: 'discard', card: d });
    return acts;
  }

  function aiDiscard(s, rnd) {
    rnd = rnd || Math.random;
    var p = cur(s), lvl = s.level, hand = p.hand;
    var options = hand.filter(function (c) { return canDiscard(s, c); });
    if (!options.length) options = hand.slice();
    if (lvl === 1 && rnd() < 0.3) return options[Math.floor(rnd() * options.length)];
    var next = s.players[(s.turn + 1) % s.players.length], nextIsFriend = s.teams && next.team === p.team;
    function keep(c) {
      var k = 0, r = rank(c), su = suit(c);
      hand.forEach(function (o) {
        if (o === c) return;
        if (rank(o) === r) k += 10;
        if (suit(o) === su) { var d = Math.abs(rank(o) - r); if (d === 1 || d === 12) k += 8; else if (d === 2 || d === 11) k += 4; }
      });
      k -= value(c) * (lvl === 1 ? 0.2 : 0.6);
      if (lvl === 3 && !nextIsFriend) {
        if (layOffTarget(s.melds, c) >= 0) k += 14;      // anyone could lay it off
        if (s.discard.length && rank(s.discard[s.discard.length - 1]) === r) k += 3;
      }
      return k;
    }
    var best = options[0], bv = Infinity;
    options.forEach(function (c) { var v = keep(c) + rnd() * 0.5; if (v < bv) { bv = v; best = c; } });
    return best;
  }

  return { SUITS: SUITS, RANKS: RANKS, rank: rank, suit: suit, red: red, label: label, value: value,
    asMeld: asMeld, asRun: asRun, asSet: asSet, meldPoints: meldPoints, meldValue: meldValue, layOffResult: layOffResult,
    layOffTarget: layOffTarget, candidates: candidates, bestMelds: bestMelds, canUse: canUse, handPoints: handPoints,
    newGame: newGame, nextRound: nextRound, drawStock: drawStock, drawDiscard: drawDiscard, meld: meld, layOff: layOff,
    canDiscard: canDiscard, discard: discard, sides: sides, partnerOf: partnerOf, aiDraw: aiDraw, aiPlay: aiPlay, aiDiscard: aiDiscard };
})();
if (typeof module !== 'undefined') module.exports = RummyEngine;
