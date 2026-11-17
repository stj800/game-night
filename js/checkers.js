/* Checkers (American rules: 8x8, forced captures, multi-jumps, kings) */
var Checkers = (function () {
  var h = UI.h;
  var LEVELS = [
    { value: 1, label: 'Beginner', note: 'Looks one move ahead and sometimes slips up.' },
    { value: 2, label: 'Intermediate', note: 'Plans a few moves ahead and sets simple traps.' },
    { value: 3, label: 'Advanced', note: 'Thinks deep. Trades smartly and races for kings.' }
  ];

  function initial() {
    var b = [];
    for (var i = 0; i < 64; i++) {
      var r = Math.floor(i / 8), c = i % 8, dark = (r + c) % 2 === 1;
      b.push(dark && r < 3 ? 'b' : dark && r > 4 ? 'r' : null);
    }
    return { b: b, turn: 'r', quiet: 0 };
  }
  function side(p) { return p ? p.toLowerCase() : null; }
  function isKing(p) { return p === 'R' || p === 'B'; }
  function dirsFor(p) {
    if (isKing(p)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    return side(p) === 'r' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  }
  function onB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function jumpsFrom(b, sq, p, path, caps, out) {
    var r = Math.floor(sq / 8), c = sq % 8, found = false, me = side(p);
    dirsFor(p).forEach(function (d) {
      var mr = r + d[0], mc = c + d[1], lr = r + 2 * d[0], lc = c + 2 * d[1];
      if (!onB(lr, lc)) return;
      var mid = mr * 8 + mc, land = lr * 8 + lc;
      if (b[mid] && side(b[mid]) !== me && caps.indexOf(mid) < 0 && !b[land]) {
        found = true;
        var nb = b.slice(); nb[land] = p; nb[sq] = null;
        var crowned = !isKing(p) && ((me === 'r' && lr === 0) || (me === 'b' && lr === 7));
        var np = path.concat([land]), nc = caps.concat([mid]);
        if (crowned) out.push({ path: np, caps: nc, crown: true });
        else jumpsFrom(nb, land, p, np, nc, out);
      }
    });
    if (!found && caps.length) out.push({ path: path, caps: caps });
  }

  function moves(s) {
    var caps = [], steps = [], b = s.b;
    for (var i = 0; i < 64; i++) {
      var p = b[i]; if (!p || side(p) !== s.turn) continue;
      var out = []; jumpsFrom(b, i, p, [i], [], out);
      caps = caps.concat(out);
      if (!caps.length) {
        var r = Math.floor(i / 8), c = i % 8;
        dirsFor(p).forEach(function (d) {
          var nr = r + d[0], nc = c + d[1];
          if (onB(nr, nc) && !b[nr * 8 + nc]) steps.push({ path: [i, nr * 8 + nc], caps: [] });
        });
      }
    }
    return caps.length ? caps : steps;
  }

  function apply(s, m) {
    var b = s.b.slice(), from = m.path[0], to = m.path[m.path.length - 1], p = b[from];
    b[from] = null;
    m.caps.forEach(function (x) { b[x] = null; });
    var r = Math.floor(to / 8);
    if (!isKing(p) && ((p === 'r' && r === 0) || (p === 'b' && r === 7))) p = p.toUpperCase();
    b[to] = p;
    return { b: b, turn: s.turn === 'r' ? 'b' : 'r', quiet: m.caps.length || !isKing(s.b[from]) ? 0 : s.quiet + 1 };
  }

  function evaluate(s, me) {
    var sc = 0;
    for (var i = 0; i < 64; i++) {
      var p = s.b[i]; if (!p) continue;
      var r = Math.floor(i / 8), c = i % 8, v;
      if (isKing(p)) v = 165;
      else v = 100 + (side(p) === 'r' ? (7 - r) : r) * 4 + ((side(p) === 'r' && r === 7) || (side(p) === 'b' && r === 0) ? 12 : 0);
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 5;
      sc += side(p) === me ? v : -v;
    }
    return sc;
  }

  var deadline = 0, aborted = false, nodes = 0;
  function search(s, depth, alpha, beta, me, ply) {
    nodes++;
    if ((nodes & 511) === 0 && Date.now() > deadline) aborted = true;
    if (aborted) return 0;
    var ms = moves(s);
    if (!ms.length) return s.turn === me ? -100000 + ply : 100000 - ply;
    if (depth <= 0 && !ms[0].caps.length) return evaluate(s, me);
    if (depth <= -6) return evaluate(s, me);
    var maxing = s.turn === me;
    ms.sort(function (a, b) { return b.caps.length - a.caps.length; });
    for (var i = 0; i < ms.length; i++) {
      var v = search(apply(s, ms[i]), depth - 1, alpha, beta, me, ply + 1);
      if (maxing) { if (v > alpha) alpha = v; } else { if (v < beta) beta = v; }
      if (alpha >= beta) break;
    }
    return maxing ? alpha : beta;
  }

  function best(s, level) {
    var ms = moves(s);
    if (!ms.length) return null;
    var cfg = level === 1 ? { d: 2, rnd: 0.3, noise: 40, t: 300 } : level === 2 ? { d: 4, rnd: 0, noise: 15, t: 900 } : { d: 9, rnd: 0, noise: 0, t: 2200 };
    if (ms.length === 1) return ms[0];
    if (cfg.rnd && Math.random() < cfg.rnd) return ms[Math.floor(Math.random() * ms.length)];
    deadline = Date.now() + cfg.t; aborted = false; nodes = 0;
    var bestM = ms[0];
    for (var d = 1; d <= cfg.d; d++) {
      var bv = -Infinity, bm = null;
      for (var i = 0; i < ms.length; i++) {
        var v = search(apply(s, ms[i]), d - 1, -Infinity, Infinity, s.turn, 1) + (cfg.noise ? (Math.random() - 0.5) * cfg.noise : 0);
        if (aborted) break;
        if (v > bv) { bv = v; bm = ms[i]; }
      }
      if (aborted) break;
      if (bm) { bestM = bm; ms.splice(ms.indexOf(bm), 1); ms.unshift(bm); }
    }
    return bestM;
  }

  function renderBoard(el, s, o) {
    el.innerHTML = '';
    for (var k = 0; k < 64; k++) {
      var i = o.flipped ? 63 - k : k, r = Math.floor(i / 8), c = i % 8;
      var cls = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      if (o.last && o.last.indexOf(i) >= 0) cls += ' last';
      if (o.hint && o.hint.indexOf(i) >= 0) cls += ' hint';
      if (o.sel === i) cls += ' sel';
      if (o.movable && o.movable.indexOf(i) >= 0) cls += ' mustmove';
      if (o.targets && o.targets.indexOf(i) >= 0) cls += ' target';
      var sq = h('div', { class: cls });
      var p = s.b[i];
      if (p) sq.appendChild(h('div', { class: 'disc ' + (side(p) === 'r' ? 'r' : 'k') + (isKing(p) ? ' king' : '') }));
      (function (idx) { sq.addEventListener('click', function () { o.onTap(idx); }); })(i);
      el.appendChild(sq);
    }
  }

  function setup(root) {
    var cfg = UI.store('ck_cfg') || { mode: 'ai', level: 1 };
    root.appendChild(UI.topbar('Checkers', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note; }
    var lp = h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]);
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Opponent' }),
      UI.seg([{ value: 'ai', label: 'Computer' }, { value: 'pp', label: 'Friend (same phone)' }], cfg.mode,
        function (v) { cfg.mode = v; lp.style.display = v === 'ai' ? '' : 'none'; })]));
    root.appendChild(lp); setNote(); lp.style.display = cfg.mode === 'ai' ? '' : 'none';
    root.appendChild(h('button', { class: 'bigbtn checkers', text: 'Start game', onclick: function () {
      UI.store('ck_cfg', cfg); UI.store('ck_game', { mode: cfg.mode, level: cfg.level, hist: [] }); location.hash = '#/checkers/play';
    } }));
    var saved = UI.store('ck_game');
    if (saved && saved.hist && saved.hist.length) root.appendChild(h('button', { class: 'ghostbtn', text: 'Continue your last game',
      onclick: function () { location.hash = '#/checkers/play'; } }));
    root.appendChild(h('button', { class: 'ghostbtn', text: 'How to play', onclick: function () { location.hash = '#/checkers/learn'; } }));
  }

  function play(root) {
    var g = UI.store('ck_game');
    if (!g) { location.hash = '#/checkers'; return; }
    var ai = g.mode === 'ai', s = initial(), hist = [], sel = -1, last = null, hint = null, thinking = false, over = false;
    g.hist.forEach(function (m) { hist.push(s); s = apply(s, m); last = m.path; });
    root.appendChild(UI.topbar(ai ? 'Checkers vs Computer' : 'Checkers - 2 players', '#/checkers'));
    var statusEl = h('div', { class: 'status' }), boardEl = h('div', { class: 'board checkers-board' });
    var info = h('div', { class: 'players' });
    var undoBtn = UI.tbtn('&#8630;', 'Undo', undo), hintBtn = UI.tbtn('&#128161;', 'Hint', function () {
      if (thinking || over) return; var m = best(s, 2); hint = m ? m.path : null; sel = -1; draw();
    });
    root.appendChild(statusEl); root.appendChild(boardEl); root.appendChild(info);
    root.appendChild(h('div', { class: 'toolbar' }, [undoBtn, hintBtn,
      UI.tbtn('&#128214;', 'Rules', function () { location.hash = '#/checkers/learn'; }),
      UI.tbtn('&#10227;', 'New', function () {
        UI.modal({ title: 'Start a new game?', text: 'This game will end.', buttons: [
          { label: 'New game', cls: 'checkers', fn: function () { location.hash = '#/checkers'; } }, { label: 'Keep playing' }] });
      })]));

    function name(t) { return ai ? (t === 'r' ? 'You (red)' : 'Computer') : (t === 'r' ? 'Red' : 'Black'); }
    function count(t) { return s.b.filter(function (p) { return side(p) === t; }).length; }
    function myMoves() { return moves(s); }

    function draw() {
      var ms = myMoves(), sels = sel >= 0 ? ms.filter(function (m) { return m.path[0] === sel; }) : [];
      var mustCap = ms.length && ms[0].caps.length;
      renderBoard(boardEl, s, { sel: sel, last: last, hint: hint,
        targets: sels.map(function (m) { return m.path[m.path.length - 1]; }),
        movable: mustCap && sel < 0 && (!ai || s.turn === 'r') ? ms.map(function (m) { return m.path[0]; }) : null, onTap: tap });
      var txt;
      if (!ms.length) txt = name(s.turn === 'r' ? 'b' : 'r') + (ai && s.turn === 'b' ? ' win!' : ' wins!');
      else if (s.quiet >= 80) txt = 'Draw';
      else if (thinking) txt = 'Computer is thinking...';
      else txt = (ai ? (s.turn === 'r' ? 'Your move' : 'Computer to move') : name(s.turn) + ' to move') + (mustCap ? ' - you must jump!' : '');
      statusEl.textContent = txt;
      statusEl.className = 'status' + (mustCap || !ms.length ? ' alert' : '');
      info.innerHTML = '';
      info.appendChild(h('div', { class: 'who' + (s.turn === 'r' ? ' active' : '') }, [h('span', { class: 'dot', style: 'background:#e0283f' }), name('r') + ': ' + count('r')]));
      info.appendChild(h('div', { class: 'who' + (s.turn === 'b' ? ' active' : '') }, [h('span', { class: 'dot', style: 'background:#23213a' }), name('b') + ': ' + count('b')]));
      undoBtn.disabled = thinking || !(ai ? hist.some(function (x) { return x.turn === 'r'; }) : hist.length);
      hintBtn.disabled = thinking || over || (ai && s.turn !== 'r');
    }

    function doMove(m) {
      hist.push(s); s = apply(s, m); last = m.path; sel = -1; hint = null;
      g.hist.push(m); UI.store('ck_game', g); UI.vibrate(m.caps.length ? 25 : 10);
      draw();
      var ms = myMoves();
      if (!ms.length || s.quiet >= 80) { setTimeout(end, 400); return; }
      if (ai && s.turn === 'b') {
        thinking = true; draw();
        setTimeout(function () { var mm = best(s, g.level); thinking = false; if (mm && document.body.contains(boardEl)) doMove(mm); }, 400);
      }
    }

    function end() {
      if (over) return; over = true; UI.store('ck_game', null);
      var ms = myMoves(), winner = !ms.length ? (s.turn === 'r' ? 'b' : 'r') : null;
      var win = winner && (!ai || winner === 'r');
      if (win) UI.confetti();
      UI.modal({ big: winner ? (win ? '\uD83C\uDFC6' : '\uD83E\uDD16') : '\uD83E\uDD1D',
        title: winner ? (ai ? (winner === 'r' ? 'You win!' : 'The computer wins') : name(winner) + ' wins!') : 'Draw',
        text: winner ? 'The other side has no moves left.' : '40 moves each with only kings moving and no captures.',
        buttons: [{ label: 'Play again', cls: 'checkers', fn: function () { location.hash = '#/checkers'; } }, { label: 'Look at the board' }] });
    }

    function tap(i) {
      if (thinking || over || (ai && s.turn !== 'r')) return;
      var ms = myMoves();
      if (sel >= 0) {
        var opts = ms.filter(function (m) { return m.path[0] === sel && m.path[m.path.length - 1] === i; });
        if (opts.length) { opts.sort(function (a, b) { return b.caps.length - a.caps.length; }); doMove(opts[0]); return; }
      }
      if (s.b[i] && side(s.b[i]) === s.turn) {
        if (ms.some(function (m) { return m.path[0] === i; })) { sel = sel === i ? -1 : i; UI.vibrate(6); }
        else { sel = -1; if (ms.length && ms[0].caps.length) UI.toast('You have a jump. Jumps are required.'); }
      } else sel = -1;
      draw();
    }

    function undo() {
      if (thinking) return;
      if (over) over = false;
      do { s = hist.pop(); g.hist.pop(); } while (ai && hist.length && s.turn !== 'r');
      last = null; sel = -1; hint = null; UI.store('ck_game', g); draw();
    }

    draw();
    if (ai && s.turn === 'b' && myMoves().length) { thinking = true; draw(); setTimeout(function () { var mm = best(s, g.level); thinking = false; if (mm) doMove(mm); }, 400); }
  }

  function learn(root) {
    root.appendChild(UI.topbar('How to play checkers', '#/checkers'));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>The goal</h3><p>Capture all of your opponent\'s pieces, or leave them with no legal move.</p>' +
      '<h3>Moving</h3><p>Pieces move one square diagonally forward, on the dark squares only. Red moves first.</p>' +
      '<h3>Jumping</h3><p>Capture by jumping diagonally over an enemy piece into the empty square right behind it. ' +
      'If you can jump, you must. The game rings the pieces that can jump. After a jump, if the same piece can jump again, it keeps going in the same turn (a double or triple jump).</p>' +
      '<h3>Kings</h3><p>Reach the far row and your piece is crowned king (it gets a crown). Kings move and jump forward AND backward.</p>' +
      '<h3>Tips</h3><ul><li>Keep your back row filled as long as you can. It stops enemy kings.</li>' +
      '<li>Pieces in the middle are stronger than pieces on the edge.</li>' +
      '<li>Trade pieces when you are ahead.</li><li>Move in pairs so your pieces protect each other.</li></ul>' +
      '<h3>How to move here</h3><p>Tap a piece, then tap a dot. For a multi-jump, tap the final landing square.</p>' }));
    root.appendChild(h('button', { class: 'bigbtn checkers', text: 'Play checkers', onclick: function () { location.hash = '#/checkers'; } }));
  }

  return { setup: setup, play: play, learn: learn, _moves: moves, _apply: apply, _initial: initial, _best: best };
})();
if (typeof module !== 'undefined') module.exports = Checkers;
