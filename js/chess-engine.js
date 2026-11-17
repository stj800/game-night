/* Chess rules + computer opponent. Square index = row*8+col, row 0 = rank 8. */
var ChessEngine = (function () {
  var FILES = 'abcdefgh';
  var VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  var PST = {
    P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
        0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
        -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
        -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
        0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
        20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    KE: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30,
        -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30,
        -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
  };
  var KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  var KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var BD = [[-1,-1],[-1,1],[1,-1],[1,1]];
  var RD = [[-1,0],[1,0],[0,-1],[0,1]];

  function colorOf(p) { return p ? (p === p.toUpperCase() ? 'w' : 'b') : null; }
  function typeOf(p) { return p ? p.toUpperCase() : null; }
  function sqName(i) { return FILES[i % 8] + (8 - Math.floor(i / 8)); }

  function fromPlacement(rows, turn, castle) {
    // rows: array of 8 strings of 8 chars, '.' = empty
    var b = [];
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var ch = rows[r][c];
      b.push(ch === '.' ? null : ch);
    }
    return { b: b, turn: turn || 'w', castle: castle || { K: false, Q: false, k: false, q: false }, ep: -1, half: 0, full: 1 };
  }

  function initial() {
    return fromPlacement(['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'],
      'w', { K: true, Q: true, k: true, q: true });
  }

  function clone(s) {
    return { b: s.b.slice(), turn: s.turn, castle: { K: s.castle.K, Q: s.castle.Q, k: s.castle.k, q: s.castle.q },
      ep: s.ep, half: s.half, full: s.full };
  }

  function attacked(s, sq, by) {
    var b = s.b, r = Math.floor(sq / 8), c = sq % 8, i, rr, cc, p;
    // pawns
    var pr = by === 'w' ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      for (var dc = -1; dc <= 1; dc += 2) {
        cc = c + dc;
        if (cc >= 0 && cc < 8) { p = b[pr * 8 + cc]; if (p === (by === 'w' ? 'P' : 'p')) return true; }
      }
    }
    for (i = 0; i < 8; i++) {
      rr = r + KN[i][0]; cc = c + KN[i][1];
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p === (by === 'w' ? 'N' : 'n')) return true; }
      rr = r + KG[i][0]; cc = c + KG[i][1];
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p === (by === 'w' ? 'K' : 'k')) return true; }
    }
    var sets = [[BD, 'B'], [RD, 'R']];
    for (var si = 0; si < 2; si++) {
      var dirs = sets[si][0], t = sets[si][1];
      for (i = 0; i < 4; i++) {
        rr = r + dirs[i][0]; cc = c + dirs[i][1];
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          p = b[rr * 8 + cc];
          if (p) {
            if (colorOf(p) === by && (typeOf(p) === t || typeOf(p) === 'Q')) return true;
            break;
          }
          rr += dirs[i][0]; cc += dirs[i][1];
        }
      }
    }
    return false;
  }

  function kingSq(s, color) {
    var k = color === 'w' ? 'K' : 'k';
    for (var i = 0; i < 64; i++) if (s.b[i] === k) return i;
    return -1;
  }

  function inCheck(s, color) {
    var k = kingSq(s, color);
    return k >= 0 && attacked(s, k, color === 'w' ? 'b' : 'w');
  }

  function pseudo(s, onlyFrom) {
    var moves = [], b = s.b, me = s.turn, opp = me === 'w' ? 'b' : 'w';
    function add(f, t, fl, pr) { moves.push({ f: f, t: t, p: b[f], c: fl === 'ep' ? b[t + (me === 'w' ? 8 : -8)] : b[t], fl: fl || 'n', pr: pr || null }); }
    for (var f = 0; f < 64; f++) {
      if (onlyFrom !== undefined && f !== onlyFrom) continue;
      var p = b[f];
      if (!p || colorOf(p) !== me) continue;
      var t = typeOf(p), r = Math.floor(f / 8), c = f % 8, i, rr, cc, to;
      if (t === 'P') {
        var dir = me === 'w' ? -1 : 1, start = me === 'w' ? 6 : 1, last = me === 'w' ? 0 : 7;
        rr = r + dir;
        if (rr >= 0 && rr < 8) {
          to = rr * 8 + c;
          if (!b[to]) {
            if (rr === last) ['Q', 'R', 'B', 'N'].forEach(function (x) { add(f, to, 'pr', x); });
            else add(f, to);
            if (r === start && !b[(r + 2 * dir) * 8 + c]) add(f, (r + 2 * dir) * 8 + c, 'dbl');
          }
          for (var d = -1; d <= 1; d += 2) {
            cc = c + d;
            if (cc < 0 || cc > 7) continue;
            to = rr * 8 + cc;
            if (b[to] && colorOf(b[to]) === opp) {
              if (rr === last) ['Q', 'R', 'B', 'N'].forEach(function (x) { add(f, to, 'pr', x); });
              else add(f, to);
            } else if (to === s.ep) add(f, to, 'ep');
          }
        }
      } else if (t === 'N' || t === 'K') {
        var offs = t === 'N' ? KN : KG;
        for (i = 0; i < 8; i++) {
          rr = r + offs[i][0]; cc = c + offs[i][1];
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          to = rr * 8 + cc;
          if (!b[to] || colorOf(b[to]) === opp) add(f, to);
        }
        if (t === 'K') {
          var home = me === 'w' ? 60 : 4, R = me === 'w' ? 'R' : 'r';
          if (f === home && !attacked(s, f, opp)) {
            if ((me === 'w' ? s.castle.K : s.castle.k) && b[home + 3] === R && !b[home + 1] && !b[home + 2] &&
                !attacked(s, home + 1, opp) && !attacked(s, home + 2, opp)) add(f, home + 2, 'ck');
            if ((me === 'w' ? s.castle.Q : s.castle.q) && b[home - 4] === R && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
                !attacked(s, home - 1, opp) && !attacked(s, home - 2, opp)) add(f, home - 2, 'cq');
          }
        }
      } else {
        var dirs = t === 'B' ? BD : t === 'R' ? RD : BD.concat(RD);
        for (i = 0; i < dirs.length; i++) {
          rr = r + dirs[i][0]; cc = c + dirs[i][1];
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            to = rr * 8 + cc;
            if (b[to]) { if (colorOf(b[to]) === opp) add(f, to); break; }
            add(f, to);
            rr += dirs[i][0]; cc += dirs[i][1];
          }
        }
      }
    }
    return moves;
  }

  function make(s, m) {
    var n = clone(s), b = n.b, me = s.turn;
    b[m.t] = m.pr ? (me === 'w' ? m.pr : m.pr.toLowerCase()) : m.p;
    b[m.f] = null;
    if (m.fl === 'ep') b[m.t + (me === 'w' ? 8 : -8)] = null;
    if (m.fl === 'ck') { b[m.t - 1] = b[m.t + 1]; b[m.t + 1] = null; }
    if (m.fl === 'cq') { b[m.t + 1] = b[m.t - 2]; b[m.t - 2] = null; }
    n.ep = m.fl === 'dbl' ? (m.f + m.t) / 2 : -1;
    var t = typeOf(m.p);
    if (t === 'K') { if (me === 'w') { n.castle.K = n.castle.Q = false; } else { n.castle.k = n.castle.q = false; } }
    [m.f, m.t].forEach(function (x) {
      if (x === 63) n.castle.K = false; if (x === 56) n.castle.Q = false;
      if (x === 7) n.castle.k = false; if (x === 0) n.castle.q = false;
    });
    n.half = (t === 'P' || m.c) ? 0 : s.half + 1;
    if (me === 'b') n.full = s.full + 1;
    n.turn = me === 'w' ? 'b' : 'w';
    return n;
  }

  function legal(s, onlyFrom) {
    var me = s.turn;
    return pseudo(s, onlyFrom).filter(function (m) { return !inCheck(make(s, m), me); });
  }

  function san(s, m, all) {
    var out;
    if (m.fl === 'ck') out = 'O-O';
    else if (m.fl === 'cq') out = 'O-O-O';
    else {
      var t = typeOf(m.p), cap = !!m.c;
      if (t === 'P') out = (cap ? FILES[m.f % 8] + 'x' : '') + sqName(m.t) + (m.pr ? '=' + m.pr : '');
      else {
        var amb = (all || legal(s)).filter(function (o) { return o.t === m.t && o.f !== m.f && o.p === m.p; });
        var dis = '';
        if (amb.length) {
          var sameFile = amb.some(function (o) { return o.f % 8 === m.f % 8; });
          var sameRank = amb.some(function (o) { return Math.floor(o.f / 8) === Math.floor(m.f / 8); });
          if (!sameFile) dis = FILES[m.f % 8];
          else if (!sameRank) dis = String(8 - Math.floor(m.f / 8));
          else dis = sqName(m.f);
        }
        out = t + dis + (cap ? 'x' : '') + sqName(m.t);
      }
    }
    var n = make(s, m);
    if (inCheck(n, n.turn)) out += legal(n).length ? '+' : '#';
    return out;
  }

  function key(s) {
    return s.b.map(function (p) { return p || '.'; }).join('') + s.turn +
      (s.castle.K ? 'K' : '') + (s.castle.Q ? 'Q' : '') + (s.castle.k ? 'k' : '') + (s.castle.q ? 'q' : '') + s.ep;
  }

  function insufficient(s) {
    var minors = [], other = false;
    for (var i = 0; i < 64; i++) {
      var p = s.b[i]; if (!p) continue;
      var t = typeOf(p);
      if (t === 'K') continue;
      if (t === 'N' || t === 'B') minors.push(t); else { other = true; break; }
    }
    return !other && minors.length <= 1;
  }

  // ---- Evaluation + search ----
  function isEndgame(b) {
    var q = 0, minor = 0;
    for (var i = 0; i < 64; i++) {
      var p = b[i]; if (!p) continue; var t = typeOf(p);
      if (t === 'Q') q++; else if (t === 'R' || t === 'B' || t === 'N') minor++;
    }
    return q === 0 || (q <= 2 && minor <= 2);
  }

  function evaluate(s) {
    var b = s.b, score = 0, end = isEndgame(b), wb = 0, bb = 0;
    for (var i = 0; i < 64; i++) {
      var p = b[i]; if (!p) continue;
      var t = typeOf(p), w = p === t;
      var idx = w ? i : (7 - Math.floor(i / 8)) * 8 + (i % 8);
      var table = t === 'K' ? (end ? PST.KE : PST.K) : PST[t];
      var v = VAL[t] + table[idx];
      if (t === 'B') { if (w) wb++; else bb++; }
      score += w ? v : -v;
    }
    if (wb >= 2) score += 30; if (bb >= 2) score -= 30;
    return s.turn === 'w' ? score : -score;
  }

  function orderScore(m) {
    var sc = 0;
    if (m.c) sc += 10 * VAL[typeOf(m.c)] - VAL[typeOf(m.p)] + 1000;
    if (m.pr) sc += VAL[m.pr] + 800;
    return sc;
  }

  var MATE = 100000, nodes = 0, deadline = 0, aborted = false;

  function quiesce(s, alpha, beta, depth) {
    nodes++;
    var stand = evaluate(s);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (depth <= 0) return alpha;
    var ms = pseudo(s).filter(function (m) { return m.c || m.pr; });
    ms.sort(function (a, b) { return orderScore(b) - orderScore(a); });
    for (var i = 0; i < ms.length; i++) {
      var n = make(s, ms[i]);
      if (inCheck(n, s.turn)) continue;
      var v = -quiesce(n, -beta, -alpha, depth - 1);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function search(s, depth, alpha, beta, ply, useQ) {
    nodes++;
    if ((nodes & 1023) === 0 && Date.now() > deadline) aborted = true;
    if (aborted) return 0;
    if (depth <= 0) return useQ ? quiesce(s, alpha, beta, 4) : evaluate(s);
    var ms = pseudo(s);
    ms.sort(function (a, b) { return orderScore(b) - orderScore(a); });
    var any = false;
    for (var i = 0; i < ms.length; i++) {
      var n = make(s, ms[i]);
      if (inCheck(n, s.turn)) continue;
      any = true;
      var v = -search(n, depth - 1, -beta, -alpha, ply + 1, useQ);
      if (aborted) return 0;
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    if (!any) return inCheck(s, s.turn) ? -MATE + ply : 0;
    if (s.half >= 100) return 0;
    return alpha;
  }

  // level: 1 beginner, 2 intermediate, 3 advanced
  function bestMove(s, level, history) {
    var moves = legal(s);
    if (!moves.length) return null;
    var cfg = level === 1 ? { depth: 1, q: false, noise: 160, random: 0.25, time: 400 }
      : level === 2 ? { depth: 2, q: true, noise: 30, random: 0, time: 1200 }
      : { depth: 5, q: true, noise: 0, random: 0, time: 2500 };
    if (cfg.random && Math.random() < cfg.random) return moves[Math.floor(Math.random() * moves.length)];
    deadline = Date.now() + cfg.time; nodes = 0; aborted = false;
    var repeatKeys = history || {};
    var best = moves[0], ordered = moves.slice().sort(function (a, b) { return orderScore(b) - orderScore(a); });
    for (var d = 1; d <= cfg.depth; d++) {
      var bestThis = null, bestVal = -Infinity, alpha = -Infinity;
      for (var i = 0; i < ordered.length; i++) {
        var n = make(s, ordered[i]);
        // With noise every root move needs an exact score (full window), not a cutoff bound.
        var v = -search(n, d - 1, -Infinity, cfg.noise ? Infinity : -alpha, 1, cfg.q);
        if (aborted) break;
        if (repeatKeys[key(n)] >= 1 && v > -50) v -= 40; // avoid drawing by repetition when not losing
        if (cfg.noise) v += Math.floor((Math.random() - 0.5) * cfg.noise);
        if (v > bestVal) { bestVal = v; bestThis = ordered[i]; }
        if (v > alpha) alpha = v;
      }
      if (aborted && d > 1) break;
      if (bestThis) {
        best = bestThis;
        ordered.splice(ordered.indexOf(bestThis), 1);
        ordered.unshift(bestThis);
      }
      if (bestVal > MATE - 100) break;
    }
    return best;
  }

  return { initial: initial, fromPlacement: fromPlacement, legal: legal, make: make, inCheck: inCheck, san: san,
    key: key, insufficient: insufficient, bestMove: bestMove, colorOf: colorOf, typeOf: typeOf, sqName: sqName,
    kingSq: kingSq, attacked: attacked, evaluate: evaluate };
})();
if (typeof module !== 'undefined') module.exports = ChessEngine;
