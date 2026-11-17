/* Fruit Swap: an original match-3 puzzle */
var Swap = (function () {
  var h = (typeof UI !== 'undefined') ? UI.h : null, N = 8;
  var FRUIT = [0x1F353, 0x1F34B, 0x1F347, 0x1F34A, 0x1FAD0, 0x1F34F].map(function (c) { return String.fromCodePoint(c); });
  var STAR = String.fromCodePoint(0x1F31F);
  var LEVELS = [
    { value: 1, label: 'Beginner', kinds: 5, moves: 30, target: 12000, note: '5 kinds of fruit and 30 moves. Score 12,000 points to win.' },
    { value: 2, label: 'Intermediate', kinds: 6, moves: 25, target: 11000, note: '6 kinds of fruit and 25 moves. Score 11,000 points to win.' },
    { value: 3, label: 'Advanced', kinds: 6, moves: 20, target: 10000, note: '6 kinds of fruit and only 20 moves. Score 10,000 points to win.' }
  ];

  // ---------- pure game logic ----------
  function rnd(k) { return Math.floor(Math.random() * k); }
  function fresh(kinds) {
    var g = [];
    for (var r = 0; r < N; r++) {
      g.push([]);
      for (var c = 0; c < N; c++) {
        var t;
        do { t = rnd(kinds); } while ((c >= 2 && g[r][c - 1].t === t && g[r][c - 2].t === t) || (r >= 2 && g[r - 1][c].t === t && g[r - 2][c].t === t));
        g[r].push({ t: t, sp: null });
      }
    }
    return hasMove(g) ? g : fresh(kinds);
  }
  function runs(g) {
    var out = [];
    for (var r = 0; r < N; r++) {
      var c = 0;
      while (c < N) {
        var e = c; while (e + 1 < N && g[r][e + 1] && g[r][c] && g[r][e + 1].t === g[r][c].t && g[r][c].t >= 0) e++;
        if (e - c >= 2) { var cells = []; for (var k = c; k <= e; k++) cells.push([r, k]); out.push({ cells: cells, dir: 'h' }); }
        c = e + 1;
      }
    }
    for (var c2 = 0; c2 < N; c2++) {
      var r2 = 0;
      while (r2 < N) {
        var e2 = r2; while (e2 + 1 < N && g[e2 + 1][c2] && g[r2][c2] && g[e2 + 1][c2].t === g[r2][c2].t && g[r2][c2].t >= 0) e2++;
        if (e2 - r2 >= 2) { var cells2 = []; for (var k2 = r2; k2 <= e2; k2++) cells2.push([k2, c2]); out.push({ cells: cells2, dir: 'v' }); }
        r2 = e2 + 1;
      }
    }
    return out;
  }
  function swapCells(g, a, b) { var t = g[a[0]][a[1]]; g[a[0]][a[1]] = g[b[0]][b[1]]; g[b[0]][b[1]] = t; }
  function hasMove(g) { return !!findMove(g); }
  function findMove(g) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (g[r][c].sp === 'star') return [[r, c], [r, c + 1 < N ? c + 1 : c - 1]];
      var nb = [[r, c + 1], [r + 1, c]];
      for (var i = 0; i < 2; i++) {
        var b = nb[i]; if (b[0] >= N || b[1] >= N) continue;
        swapCells(g, [r, c], b);
        var ok = runs(g).length > 0;
        swapCells(g, [r, c], b);
        if (ok) return [[r, c], b];
      }
    }
    return null;
  }
  // Clears matches once. Returns {cleared:[[r,c]..], created:[{r,c,sp,t}], points}
  function clearStep(g, focus, combo) {
    var rs = runs(g); if (!rs.length) return null;
    var kill = {}, created = [];
    function mark(r, c) { kill[r + ',' + c] = true; }
    rs.forEach(function (run) {
      run.cells.forEach(function (p) { mark(p[0], p[1]); });
      if (run.cells.length >= 4) {
        var at = run.cells[Math.floor(run.cells.length / 2)];
        if (focus) run.cells.forEach(function (p) { if ((p[0] === focus[0][0] && p[1] === focus[0][1]) || (p[0] === focus[1][0] && p[1] === focus[1][1])) at = p; });
        var big = run.cells.length >= 5;
        created.push({ r: at[0], c: at[1], t: big ? -1 : g[at[0]][at[1]].t, sp: big ? 'star' : (run.dir === 'h' ? 'col' : 'row') });
      }
    });
    // chain special pieces caught in the blast
    var changed = true;
    while (changed) {
      changed = false;
      Object.keys(kill).forEach(function (k) {
        var p = k.split(',').map(Number), cell = g[p[0]][p[1]];
        if (!cell || cell.fired) return;
        if (cell.sp === 'row' || cell.sp === 'col') {
          cell.fired = true;
          for (var i = 0; i < N; i++) { var kk = cell.sp === 'row' ? p[0] + ',' + i : i + ',' + p[1]; if (!kill[kk]) { kill[kk] = true; changed = true; } }
        }
      });
    }
    var cleared = Object.keys(kill).map(function (k) { return k.split(',').map(Number); });
    var keep = {};
    created.forEach(function (cr) { keep[cr.r + ',' + cr.c] = cr; });
    cleared.forEach(function (p) { g[p[0]][p[1]] = keep[p[0] + ',' + p[1]] ? { t: keep[p[0] + ',' + p[1]].t, sp: keep[p[0] + ',' + p[1]].sp } : null; });
    return { cleared: cleared, created: created, points: cleared.length * 60 * combo };
  }
  function starBlast(g, star, other) {
    var target = g[other[0]][other[1]].t, cleared = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (g[r][c] && g[r][c].t === target) cleared.push([r, c]);
    cleared.push(star);
    cleared.forEach(function (p) { g[p[0]][p[1]] = null; });
    return { cleared: cleared, points: cleared.length * 80 };
  }
  function gravity(g, kinds) {
    var falls = [];
    for (var c = 0; c < N; c++) {
      var w = N - 1;
      for (var r = N - 1; r >= 0; r--) {
        if (g[r][c]) { if (w !== r) { g[w][c] = g[r][c]; g[r][c] = null; falls.push({ r: w, c: c, d: w - r }); } w--; }
      }
      var newCount = w + 1;
      for (var r2 = w; r2 >= 0; r2--) { g[r2][c] = { t: rnd(kinds), sp: null }; falls.push({ r: r2, c: c, d: newCount }); }
    }
    return falls;
  }
  function shuffle(g, kinds) {
    var cells = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) cells.push(g[r][c]);
    for (var tries = 0; tries < 50; tries++) {
      for (var i = cells.length - 1; i > 0; i--) { var j = rnd(i + 1); var t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
      for (var k = 0; k < cells.length; k++) g[Math.floor(k / N)][k % N] = cells[k];
      if (!runs(g).length && hasMove(g)) return;
    }
    var f = fresh(kinds); for (var r3 = 0; r3 < N; r3++) g[r3] = f[r3];
  }

  // ---------- screens ----------
  function setup(root) {
    var cfg = UI.store('fs_cfg') || { level: 1 };
    var bests = UI.store('fs_best') || {};
    root.appendChild(UI.topbar('Fruit Swap', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note + (bests[cfg.level] ? ' Your best: ' + bests[cfg.level] + '.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn swap', text: 'Start', onclick: function () { UI.store('fs_cfg', cfg); location.hash = '#/swap/play'; } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>Swap two fruits next to each other to line up 3 or more of the same kind. They pop and new fruit falls in. Reach the target score before you run out of moves.</p>' +
      '<h3>Power-ups</h3><ul><li><b>Match 4</b> in a row: you get a striped fruit. When it pops it clears its whole row or column.</li>' +
      '<li><b>Match 5</b>: you get a star. Swap the star with any fruit to clear every fruit of that kind.</li>' +
      '<li><b>Chain reactions</b> score more: each cascade multiplies your points.</li></ul>' +
      '<h3>Controls</h3><p>Swipe a fruit toward its neighbor, or tap one fruit and then the one next to it. Stuck? Wait a few seconds and the game shows you a move.</p>' }));
  }

  function play(root) {
    var cfg = UI.store('fs_cfg') || { level: 1 }, L = LEVELS[cfg.level - 1];
    root.appendChild(UI.topbar('Fruit Swap', '#/swap'));
    var bar = h('div', { class: 'fsbar' }), meter = h('div', { class: 'fsmeter' }, h('i')), gridEl = h('div', { class: 'fsgrid' });
    root.appendChild(bar); root.appendChild(meter); root.appendChild(gridEl);
    root.appendChild(h('div', { class: 'toolbar two' }, [
      UI.tbtn('&#128161;', 'Show a move', function () { showHint(true); }),
      UI.tbtn('&#10227;', 'Restart', function () { UI.modal({ title: 'Restart?', text: 'Your score resets.', buttons: [{ label: 'Restart', cls: 'swap', fn: start }, { label: 'Keep playing' }] }); })]));
    var g, score, moves, busy, sel, hintTimer, done, tiles = [];

    for (var i = 0; i < N * N; i++) {
      (function (idx) {
        var t = h('div', { class: 'fstile' });
        var sx = 0, sy = 0, down = false;
        t.addEventListener('pointerdown', function (e) { e.preventDefault(); down = true; sx = e.clientX; sy = e.clientY; });
        t.addEventListener('pointermove', function (e) {
          if (!down) return;
          var dx = e.clientX - sx, dy = e.clientY - sy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
            down = false;
            var r = Math.floor(idx / N), c = idx % N, b = Math.abs(dx) > Math.abs(dy) ? [r, c + (dx > 0 ? 1 : -1)] : [r + (dy > 0 ? 1 : -1), c];
            if (b[0] >= 0 && b[0] < N && b[1] >= 0 && b[1] < N) { sel = null; attempt([r, c], b); }
          }
        });
        t.addEventListener('pointerup', function () {
          if (!down) return; down = false;
          var r = Math.floor(idx / N), c = idx % N;
          if (sel && Math.abs(sel[0] - r) + Math.abs(sel[1] - c) === 1) { var a = sel; sel = null; attempt(a, [r, c]); }
          else { sel = sel && sel[0] === r && sel[1] === c ? null : [r, c]; render(); }
        });
        tiles.push(t); gridEl.appendChild(t);
      })(i);
    }

    function render(falls, pops) {
      var fallMap = {}; (falls || []).forEach(function (f) { fallMap[f.r + ',' + f.c] = f.d; });
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var t = tiles[r * N + c], cell = g[r][c], k = r + ',' + c;
        t.className = 'fstile' + (sel && sel[0] === r && sel[1] === c ? ' sel' : '') + (cell && cell.sp ? ' sp-' + cell.sp : '');
        t.textContent = cell ? (cell.sp === 'star' ? STAR : FRUIT[cell.t]) : '';
        if (fallMap[k]) { t.style.setProperty('--d', fallMap[k]); t.classList.add('fall'); void t.offsetWidth; }
      }
      (pops || []).forEach(function (p) { tiles[p[0] * N + p[1]].classList.add('pop'); });
      bar.innerHTML = '';
      bar.appendChild(h('div', null, [h('div', { class: 'bdlabel', text: 'MOVES' }), h('div', { class: 'bdval', text: String(moves) })]));
      bar.appendChild(h('div', null, [h('div', { class: 'bdlabel', text: 'SCORE' }), h('div', { class: 'bdval', text: String(score) })]));
      bar.appendChild(h('div', null, [h('div', { class: 'bdlabel', text: 'TARGET' }), h('div', { class: 'bdval', text: String(L.target) })]));
      meter.firstChild.style.width = Math.min(100, score / L.target * 100) + '%';
    }

    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function resetHint() { clearTimeout(hintTimer); hintTimer = setTimeout(function () { showHint(false); }, 7000); }
    function showHint(now) {
      if (busy || done) return;
      var m = findMove(g); if (!m) return;
      m.forEach(function (p) { var t = tiles[p[0] * N + p[1]]; t.classList.remove('hint'); void t.offsetWidth; t.classList.add('hint'); });
      if (now) resetHint();
    }

    async function attempt(a, b) {
      if (busy || done || !document.body.contains(gridEl)) return;
      busy = true; clearTimeout(hintTimer);
      var A = g[a[0]][a[1]], B = g[b[0]][b[1]];
      if (A.sp === 'star' || B.sp === 'star') {
        var star = A.sp === 'star' ? a : b, other = A.sp === 'star' ? b : a;
        if (g[other[0]][other[1]].sp === 'star') { for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) g[r][c] = null; score += 64 * 100; }
        else { var res = starBlast(g, star, other); score += res.points; render(null, res.cleared); }
        moves--; UI.vibrate(40);
        await wait(240);
        render(gravity(g, L.kinds));
        await wait(300);
        await cascade(null, 2);
      } else {
        swapCells(g, a, b); render();
        if (!runs(g).length) {
          await wait(160); swapCells(g, a, b); render();
          [a, b].forEach(function (p) { tiles[p[0] * N + p[1]].classList.add('nope'); });
          UI.vibrate([10, 30, 10]);
          await wait(300); busy = false; resetHint(); return;
        }
        moves--;
        await cascade([a, b], 1);
      }
      if (!hasMove(g)) { UI.toast('No moves left. Shuffling!'); await wait(500); shuffle(g, L.kinds); render(); }
      busy = false; render(); resetHint(); checkEnd();
    }

    async function cascade(focus, combo) {
      while (true) {
        var step = clearStep(g, focus, combo);
        if (!step) break;
        score += step.points;
        if (combo >= 3) UI.toast(combo >= 5 ? 'Fruit frenzy! x' + combo : 'Combo x' + combo);
        UI.vibrate(combo > 1 ? 20 : 10);
        render(null, step.cleared.filter(function (p) { return !g[p[0]][p[1]]; }));
        await wait(240);
        render(gravity(g, L.kinds));
        await wait(320);
        focus = null; combo++;
      }
    }

    function checkEnd() {
      if (done) return;
      var won = score >= L.target;
      if (!won && moves > 0) return;
      done = true; clearTimeout(hintTimer);
      var bests = UI.store('fs_best') || {};
      var isBest = !bests[cfg.level] || score > bests[cfg.level];
      if (isBest) { bests[cfg.level] = score; UI.store('fs_best', bests); }
      if (won) UI.confetti();
      var stars = won ? (moves >= L.moves * 0.3 ? 3 : moves >= L.moves * 0.1 ? 2 : 1) : 0;
      UI.modal({ big: won ? '\u2B50'.repeat(stars) : '\uD83C\uDF4B',
        title: won ? 'You win!' : 'Out of moves',
        text: won ? 'You hit ' + score.toLocaleString() + ' points with ' + moves + ' moves to spare.' : 'You scored ' + score.toLocaleString() + ' of ' + L.target.toLocaleString() + '. So close. Try again?',
        buttons: [{ label: 'Play again', cls: 'swap', fn: start }, { label: 'Back to menu', fn: function () { location.hash = '#/swap'; } }] });
    }

    function start() {
      g = fresh(L.kinds); score = 0; moves = L.moves; busy = false; sel = null; done = false;
      var all = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) all.push({ r: r, c: c, d: N });
      render(all); resetHint();
    }
    start();
  }

  return { setup: setup, play: play, _fresh: fresh, _runs: runs, _clearStep: clearStep, _gravity: gravity, _findMove: findMove, _swap: swapCells, _hasMove: hasMove };
})();
if (typeof module !== 'undefined') module.exports = Swap;
