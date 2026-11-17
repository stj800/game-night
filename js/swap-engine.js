/* Fruit Swap rules engine (no DOM). Board positions are [row, col].
   Cell: { t: fruit 0-5 | -1 star | -2 nut, sp: null | 'row' | 'col' | 'bomb' | 'star' }
   Layers per position: hole (mask false), jelly 0-2, crate hp 0-2 (a crate fills the position). */
var SwapEngine = (function () {
  var N = 8;

  function rnd(k) { return Math.floor(Math.random() * k); }
  function key(r, c) { return r * N + c; }

  // ---------- Levels ----------
  // Layout chars: '.' fruit, '#' hole, 'j' jelly, 'J' double jelly, 'c' crate, 'C' strong crate, 'n' nut
  function fill(ch) { var a = []; for (var i = 0; i < 8; i++) a.push(ch.repeat(8)); return a; }
  var FULL = fill('.');
  var LEVELS = [
    // World 1: Sunny Orchard
    { moves: 20, kinds: 5, goals: { score: 3000 }, layout: FULL, tip: 'Match 3 or more fruits. Reach the target score.' },
    { moves: 20, kinds: 5, goals: { collect: [[0, 15], [1, 15]] }, layout: FULL, tip: 'Collect the fruit shown at the top.' },
    { moves: 22, kinds: 5, goals: { jelly: 1 }, layout: ['........', '........', '..jjjj..', '..jjjj..', '..jjjj..', '..jjjj..', '........', '........'], tip: 'Clear the pink jelly by making matches on top of it.' },
    { moves: 22, kinds: 5, goals: { score: 6000 }, layout: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'], tip: 'Match 4 in a row for a striped fruit. It clears a whole line!' },
    { moves: 24, kinds: 5, goals: { nuts: 2 }, layout: ['..n..n..', '........', '........', '........', '........', '........', '........', '........'], tip: 'Bring the acorns down to the bottom row.' },
    { moves: 25, kinds: 5, goals: { crates: 1 }, layout: ['........', '........', '........', 'cccccccc', '........', '........', '........', '........'], tip: 'Make matches next to the crates to break them.' },
    { moves: 40, kinds: 5, goals: { jelly: 1 }, layout: fill('j'), tip: 'Match in an L or T shape for a bomb fruit. It blasts a 3 x 3 area!' },
    { moves: 25, kinds: 5, goals: { boss: { hp: 170, every: 3, spawn: 2, name: 'Wormzilla', icon: 0x1F41B, taunt: 'Munch munch!' } }, layout: FULL, tip: 'BOSS FIGHT! Every fruit you pop hurts Wormzilla. Power-ups hit extra hard. Every few moves it fights back with crates.' },
    // World 2: Tropical Sunset
    { moves: 32, kinds: 5, goals: { jelly: 1 }, layout: ['........', '.jjjjjj.', '.jJJJJj.', '.jJ..Jj.', '.jJ..Jj.', '.jJJJJj.', '.jjjjjj.', '........'], tip: 'Dark jelly takes two hits.' },
    { moves: 32, kinds: 5, goals: { nuts: 3 }, layout: ['.n..n..n', '........', '........', '..c..c..', '........', '........', '........', '........'] },
    { moves: 32, kinds: 5, goals: { crates: 1 }, layout: ['........', '.CCCCCC.', '.C....C.', '.C....C.', '.C....C.', '.C....C.', '.CCCCCC.', '........'], tip: 'Strong crates take two hits.' },
    { moves: 32, kinds: 6, goals: { jelly: 1, collect: [[5, 18]] }, layout: ['........', '.jj..jj.', '.jj..jj.', '...jj...', '...jj...', '.jj..jj.', '.jj..jj.', '........'] },
    { moves: 22, kinds: 6, goals: { score: 9000 }, layout: FULL, tip: 'Swap two power-ups together for a giant combo!' },
    { moves: 32, kinds: 5, goals: { jelly: 1 }, layout: ['#.j.j.j#', '.j.j.j.j', 'j.j.j.j.', '.j.j.j.j', 'j.j.j.j.', '.j.j.j.j', 'j.j.j.j.', '#j.j.j.#'] },
    { moves: 34, kinds: 5, goals: { nuts: 3 }, layout: ['n.n..n.n', '........', '#......#', '##....##', '##....##', '#......#', '........', '........'] },
    { moves: 28, kinds: 5, goals: { boss: { hp: 240, every: 3, spawn: 3, name: 'Captain Crab', icon: 0x1F980, taunt: 'Pinch pinch!' } }, layout: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'], tip: 'BOSS FIGHT! Captain Crab throws three crates at a time. Break them fast.' },
    // World 3: Berry Night
    { moves: 42, kinds: 5, goals: { jelly: 1 }, layout: ['JJJJJJJJ', 'J......J', 'J.jjjj.J', 'J.j##j.J', 'J.j##j.J', 'J.jjjj.J', 'J......J', 'JJJJJJJJ'] },
    { moves: 30, kinds: 6, goals: { collect: [[0, 25], [2, 25]], crates: 1 }, layout: ['........', 'c.c.c.c.', '........', '.c.c.c.c', '........', 'c.c.c.c.', '........', '........'] },
    { moves: 34, kinds: 5, goals: { nuts: 3, jelly: 1 }, layout: ['n..nn..n', '........', '........', '........', 'jjjjjjjj', 'jjjjjjjj', 'jjjjjjjj', 'jjjjjjjj'] },
    { moves: 28, kinds: 6, goals: { score: 12000 }, layout: ['###..###', '###..###', '........', '........', '........', '........', '###..###', '###..###'] },
    { moves: 42, kinds: 5, goals: { crates: 1 }, layout: ['CCCCCCCC', 'CCCCCCCC', '........', '........', '........', '........', 'CCCCCCCC', 'CCCCCCCC'] },
    { moves: 44, kinds: 5, goals: { jelly: 1, collect: [[1, 20], [4, 20]] }, layout: fill('J') },
    { moves: 36, kinds: 6, goals: { nuts: 4, crates: 1 }, layout: ['nn.nn.nn', '........', 'c.cc.cc.', '........', '.cc.cc.c', '........', '........', '........'] },
    { moves: 32, kinds: 5, goals: { boss: { hp: 260, every: 2, spawn: 2, name: 'The Midnight Bat', icon: 0x1F987, taunt: 'You will never win!', final: true } }, layout: ['#......#', '........', '........', '...##...', '...##...', '........', '........', '#......#'], tip: 'THE FINAL BOSS! The Midnight Bat strikes every 2 moves. Save your power-ups and combos for this one.' }
  ];
  LEVELS.forEach(function (L, i) {
    L.n = i + 1;
    L.world = i < 8 ? 1 : i < 16 ? 2 : 3;
    var base = L.goals.score || L.moves * 320;
    L.boss = L.goals.boss || null;
    L.stars = [L.goals.score || 1, Math.round(base * 1.5 / 100) * 100, Math.round(base * 2.2 / 100) * 100];
  });

  // ---------- Board setup ----------
  function newFruit(st) { return { t: rnd(st.kinds), sp: null }; }
  function playable(st, r, c) { return r >= 0 && r < N && c >= 0 && c < N && st.mask[r][c] && !st.crate[r][c]; }

  function create(L) {
    var st = { kinds: L.kinds, mask: [], cells: [], jelly: [], crate: [], nutsGoal: L.goals.nuts || 0, nutsOut: 0, nutsDone: 0 };
    for (var r = 0; r < N; r++) {
      st.mask.push([]); st.cells.push([]); st.jelly.push([]); st.crate.push([]);
      for (var c = 0; c < N; c++) {
        var ch = L.layout[r][c];
        st.mask[r].push(ch !== '#');
        st.jelly[r].push(ch === 'j' ? 1 : ch === 'J' ? 2 : 0);
        st.crate[r].push(ch === 'c' ? 1 : ch === 'C' ? 2 : 0);
        st.cells[r].push(null);
      }
    }
    var nuts = [];
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (L.layout[r][c] === 'n') nuts.push([r, c]);
    for (var tries = 0; tries < 200; tries++) {
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
        if (!playable(st, r, c)) { st.cells[r][c] = null; continue; }
        var t;
        do { t = rnd(st.kinds); } while (
          (c >= 2 && same(st, r, c - 1, t) && same(st, r, c - 2, t)) || (r >= 2 && same(st, r - 1, c, t) && same(st, r - 2, c, t)));
        st.cells[r][c] = { t: t, sp: null };
      }
      nuts.forEach(function (p) { st.cells[p[0]][p[1]] = { t: -2, sp: null }; });
      if (findMove(st)) break;
    }
    st.nutsOut = nuts.length;
    return st;
  }
  function same(st, r, c, t) { var x = st.cells[r] && st.cells[r][c]; return !!x && x.t === t; }

  // ---------- Matching ----------
  function runs(st) {
    var out = [];
    function scan(get, len) {
      for (var a = 0; a < N; a++) {
        var b = 0;
        while (b < N) {
          var p = get(a, b), x = p && cellAt(st, p);
          if (!x || x.t < 0) { b++; continue; }
          var e = b;
          while (e + 1 < N) { var q = get(a, e + 1), y = q && cellAt(st, q); if (!y || y.t !== x.t) break; e++; }
          if (e - b >= 2) { var cells = []; for (var k = b; k <= e; k++) cells.push(get(a, k)); out.push({ cells: cells, dir: len, t: x.t }); }
          b = e + 1;
        }
      }
    }
    scan(function (r, c) { return [r, c]; }, 'h');
    scan(function (c, r) { return [r, c]; }, 'v');
    return out;
  }
  function cellAt(st, p) { return playable(st, p[0], p[1]) ? st.cells[p[0]][p[1]] : null; }

  // Group runs that touch into shapes (an L or T is one shape)
  function shapes(rs) {
    var groups = [];
    rs.forEach(function (run) {
      var hit = groups.filter(function (g) { return g.t === run.t && run.cells.some(function (p) { return g.keys[key(p[0], p[1])]; }); });
      var g = hit[0] || { t: run.t, keys: {}, runs: [] };
      if (!hit[0]) groups.push(g);
      for (var i = 1; i < hit.length; i++) { hit[i].runs.forEach(function (x) { g.runs.push(x); }); Object.assign(g.keys, hit[i].keys); groups.splice(groups.indexOf(hit[i]), 1); }
      g.runs.push(run);
      run.cells.forEach(function (p) { g.keys[key(p[0], p[1])] = true; });
    });
    return groups;
  }

  function areaOf(st, p, sp) {
    var out = [], r = p[0], c = p[1], i, j;
    if (sp === 'row') for (i = 0; i < N; i++) out.push([r, i]);
    else if (sp === 'col') for (i = 0; i < N; i++) out.push([i, c]);
    else if (sp === 'bomb') for (i = -1; i <= 1; i++) for (j = -1; j <= 1; j++) out.push([r + i, c + j]);
    else if (sp === 'bigbomb') for (i = -2; i <= 2; i++) for (j = -2; j <= 2; j++) out.push([r + i, c + j]);
    else if (sp === 'cross') { for (i = 0; i < N; i++) { out.push([r, i]); out.push([i, c]); } }
    else if (sp === 'bigcross') { for (i = 0; i < N; i++) for (j = -1; j <= 1; j++) { out.push([r + j, i]); out.push([i, c + j]); } }
    else if (sp === 'all') for (i = 0; i < N; i++) for (j = 0; j < N; j++) out.push([i, j]);
    return out.filter(function (q) { return q[0] >= 0 && q[0] < N && q[1] >= 0 && q[1] < N && st.mask[q[0]][q[1]]; });
  }

  function presentTypes(st) {
    var seen = {};
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { var x = cellAt(st, [r, c]); if (x && x.t >= 0) seen[x.t] = true; }
    return Object.keys(seen).map(Number);
  }

  // Clear a set of positions, setting off any power-ups caught in it.
  // creations: [{r,c,t,sp}] power-ups born from this match (they replace the fruit at that spot).
  function explode(st, kills, creations, stats) {
    var killed = {}, queue = [], cleared = [], blasts = [];
    function add(p) {
      if (p[0] < 0 || p[0] >= N || p[1] < 0 || p[1] >= N || !st.mask[p[0]][p[1]]) return;
      var k = key(p[0], p[1]); if (killed[k]) return; killed[k] = true; queue.push([p[0], p[1]]);
    }
    kills.forEach(add);
    var born = {}; (creations || []).forEach(function (cr) { born[key(cr.r, cr.c)] = cr; });
    for (var qi = 0; qi < queue.length; qi++) {
      var p = queue[qi], x = st.cells[p[0]][p[1]];
      if (!x || x.fired || born[key(p[0], p[1])]) continue;
      if (x.sp === 'row' || x.sp === 'col' || x.sp === 'bomb') {
        x.fired = true; blasts.push({ r: p[0], c: p[1], sp: x.sp });
        areaOf(st, p, x.sp).forEach(add);
      } else if (x.sp === 'star') {
        x.fired = true; var types = presentTypes(st); blasts.push({ r: p[0], c: p[1], sp: 'star' });
        if (types.length) { var tt = types[rnd(types.length)]; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { var y = cellAt(st, [r, c]); if (y && y.t === tt) add([r, c]); } }
      }
    }
    var crateHit = {};
    function hitCrate(r, c) {
      if (r < 0 || r >= N || c < 0 || c >= N || !st.crate[r][c] || crateHit[key(r, c)]) return;
      crateHit[key(r, c)] = true; st.crate[r][c]--; stats.points += 200;
      if (!st.crate[r][c]) stats.cratesBroken++;
    }
    queue.forEach(function (p) {
      var r = p[0], c = p[1], k = key(r, c);
      if (st.crate[r][c]) { hitCrate(r, c); return; } // a blast hits the crate directly
      var x = st.cells[r][c];
      if (!x) return;
      if (x.t === -2) return; // acorns are never destroyed
      if (st.jelly[r][c]) { st.jelly[r][c]--; stats.points += 100; }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { hitCrate(r + d[0], c + d[1]); });
      if (x.t >= 0) stats.collected[x.t] = (stats.collected[x.t] || 0) + 1;
      var was = { t: x.t, sp: x.sp }, pos = [r, c]; pos.was = was;
      if (born[k]) { st.cells[r][c] = { t: born[k].t, sp: born[k].sp }; }
      else { st.cells[r][c] = null; cleared.push(pos); }
      stats.points += 60 * (stats.combo || 1);
    });
    var fruitHits = cleared.filter(function (p) { return p.was && p.was.t !== -2; }).length + (creations || []).length;
    stats.damage = (stats.damage || 0) + fruitHits + blasts.length * 6;
    return { cleared: cleared, blasts: blasts, created: creations || [], damage: fruitHits + blasts.length * 6 };
  }

  function matchStep(st, focus, stats) {
    var rs = runs(st); if (!rs.length) return null;
    var kills = [], creations = [];
    shapes(rs).forEach(function (g) {
      var cells = Object.keys(g.keys).map(function (k) { k = +k; return [Math.floor(k / N), k % N]; });
      cells.forEach(function (p) { kills.push(p); });
      var longest = Math.max.apply(null, g.runs.map(function (x) { return x.cells.length; }));
      var hasH = g.runs.some(function (x) { return x.dir === 'h'; }), hasV = g.runs.some(function (x) { return x.dir === 'v'; });
      var sp = longest >= 5 ? 'star' : (hasH && hasV) ? 'bomb' : longest === 4 ? (g.runs[0].dir === 'h' ? 'col' : 'row') : null;
      if (!sp) return;
      var at = null;
      if (focus) focus.forEach(function (f) { if (g.keys[key(f[0], f[1])]) at = f; });
      if (!at && sp === 'bomb') { // corner where the lines cross
        var counts = {}; g.runs.forEach(function (x) { x.cells.forEach(function (p) { var k = key(p[0], p[1]); counts[k] = (counts[k] || 0) + 1; }); });
        Object.keys(counts).forEach(function (k) { if (counts[k] > 1) at = [Math.floor(k / N), k % N]; });
      }
      if (!at) { var run = g.runs[0]; at = run.cells[Math.floor(run.cells.length / 2)]; }
      creations.push({ r: at[0], c: at[1], t: sp === 'star' ? -1 : g.t, sp: sp });
    });
    return explode(st, kills, creations, stats);
  }

  // Swapping two power-ups (or a star with anything) is a move even without a match
  function comboSwap(st, a, b, stats) {
    var A = st.cells[a[0]][a[1]], B = st.cells[b[0]][b[1]];
    if (!A || !B || A.t === -2 || B.t === -2) return null;
    var sa = A.sp, sb = B.sp, kills = [];
    if (sa === 'star' && sb === 'star') { stats.label = 'Fruit storm!'; return explode(st, areaOf(st, b, 'all'), null, stats); }
    if (sa === 'star' || sb === 'star') {
      var star = sa === 'star' ? a : b, other = sa === 'star' ? b : a, O = st.cells[other[0]][other[1]];
      st.cells[star[0]][star[1]].fired = true;
      kills.push(star);
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var x = cellAt(st, [r, c]);
        if (x && x.t === O.t) {
          if (O.sp === 'row' || O.sp === 'col') x.sp = Math.random() < 0.5 ? 'row' : 'col';
          else if (O.sp === 'bomb') x.sp = 'bomb';
          kills.push([r, c]);
        }
      }
      stats.label = O.sp ? 'Fruit storm!' : 'Star blast!';
      return explode(st, kills, null, stats);
    }
    if (!sa || !sb) return null;
    var bombs = (sa === 'bomb') + (sb === 'bomb');
    A.fired = B.fired = true; kills.push(a, b);
    var area = bombs === 2 ? 'bigbomb' : bombs === 1 ? 'bigcross' : 'cross';
    stats.label = bombs === 2 ? 'Mega blast!' : bombs === 1 ? 'Super stripes!' : 'Criss-cross!';
    areaOf(st, b, area).forEach(function (p) { kills.push(p); });
    return explode(st, kills, null, stats);
  }

  function swap(st, a, b) { var t = st.cells[a[0]][a[1]]; st.cells[a[0]][a[1]] = st.cells[b[0]][b[1]]; st.cells[b[0]][b[1]] = t; }
  function canSwap(st, a, b) {
    return playable(st, a[0], a[1]) && playable(st, b[0], b[1]) && st.cells[a[0]][a[1]] && st.cells[b[0]][b[1]] &&
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  }
  function isValidMove(st, a, b) {
    if (!canSwap(st, a, b)) return false;
    var A = st.cells[a[0]][a[1]], B = st.cells[b[0]][b[1]];
    if (A.t !== -2 && B.t !== -2 && (A.sp === 'star' || B.sp === 'star' || (A.sp && B.sp))) return true;
    swap(st, a, b); var ok = runs(st).length > 0; swap(st, a, b);
    return ok;
  }
  function findMove(st) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (isValidMove(st, [r, c], [r, c + 1])) return [[r, c], [r, c + 1]];
      if (isValidMove(st, [r, c], [r + 1, c])) return [[r, c], [r + 1, c]];
    }
    return null;
  }

  // ---------- Gravity: fruit drop straight down, passing holes and crates ----------
  function gravity(st) {
    var falls = [];
    for (var c = 0; c < N; c++) {
      var slots = []; for (var r = 0; r < N; r++) if (playable(st, r, c)) slots.push(r);
      var items = [];
      for (var i = slots.length - 1; i >= 0; i--) { var x = st.cells[slots[i]][c]; if (x) items.push({ x: x, from: slots[i] }); }
      var S = slots.length - items.length;
      for (i = slots.length - 1; i >= 0; i--) {
        var row = slots[i], k = slots.length - 1 - i;
        if (k < items.length) {
          st.cells[row][c] = items[k].x;
          if (items[k].from !== row) falls.push({ r: row, c: c, d: row - items[k].from });
        } else {
          var nut = st.nutsGoal && st.nutsOut + st.nutsDone < st.nutsGoal && Math.random() < 0.12;
          if (nut) st.nutsOut++;
          st.cells[row][c] = nut ? { t: -2, sp: null } : newFruit(st);
          falls.push({ r: row, c: c, d: row - slots[0] + S - i });
        }
      }
    }
    return falls;
  }

  // Acorns that reach the bottom of their column are collected
  function collectNuts(st) {
    var got = [];
    for (var c = 0; c < N; c++) {
      var bottom = -1; for (var r = N - 1; r >= 0; r--) if (playable(st, r, c)) { bottom = r; break; }
      if (bottom >= 0 && st.cells[bottom][c] && st.cells[bottom][c].t === -2) {
        var p = [bottom, c]; p.was = { t: -2, sp: null }; got.push(p);
        st.cells[bottom][c] = null; st.nutsOut--; st.nutsDone++;
      }
    }
    return got;
  }

  function shuffle(st) {
    var pos = [], items = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (playable(st, r, c) && st.cells[r][c] && st.cells[r][c].t !== -2) { pos.push([r, c]); items.push(st.cells[r][c]); }
    for (var tries = 0; tries < 60; tries++) {
      for (var i = items.length - 1; i > 0; i--) { var j = rnd(i + 1); var t = items[i]; items[i] = items[j]; items[j] = t; }
      pos.forEach(function (p, k) { st.cells[p[0]][p[1]] = items[k]; });
      if (!runs(st).length && findMove(st)) return;
    }
    pos.forEach(function (p) { st.cells[p[0]][p[1]] = newFruit(st); });
  }

  // The boss fights back: turns n random fruits into crates
  function bossAttack(st, n) {
    var spots = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { var x = cellAt(st, [r, c]); if (x && x.t >= 0 && !x.sp) spots.push([r, c]); }
    var out = [];
    for (var k = 0; k < n && spots.length; k++) {
      var p = spots.splice(rnd(spots.length), 1)[0];
      st.cells[p[0]][p[1]] = null; st.crate[p[0]][p[1]] = 1; out.push(p);
    }
    return out;
  }

  function jellyLeft(st) { var n = 0; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) n += st.jelly[r][c]; return n; }
  function cratesLeft(st) { var n = 0; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (st.crate[r][c]) n++; return n; }

  return { N: N, LEVELS: LEVELS, create: create, runs: runs, matchStep: matchStep, comboSwap: comboSwap, swap: swap,
    canSwap: canSwap, isValidMove: isValidMove, findMove: findMove, gravity: gravity, collectNuts: collectNuts,
    shuffle: shuffle, explode: explode, bossAttack: bossAttack, playable: playable, jellyLeft: jellyLeft, cratesLeft: cratesLeft };
})();
if (typeof module !== 'undefined') module.exports = SwapEngine;
