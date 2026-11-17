/* Block Drop: an original falling-block puzzle (9 wide x 18 tall, gem blocks) */
var Blocks = (function () {
  var h = UI.h, COLS = 9, ROWS = 18;
  var LEVELS = [
    { value: 1, label: 'Beginner', speed: 950, note: 'Slow start. Plenty of time to think.' },
    { value: 2, label: 'Intermediate', speed: 600, note: 'A steady pace that keeps speeding up.' },
    { value: 3, label: 'Advanced', speed: 320, note: 'Fast from the first block. Hold on.' }
  ];
  var SHAPES = [
    [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[0, 1, 1], [1, 1, 0]],
    [[1, 1, 0], [0, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]]
  ];
  var COLORS = [null, '#ff5d73', '#ffcf3f', '#3ee08f', '#3fb4ff', '#b06bff', '#ff8a3d', '#ff6bd6'];

  function rotate(m) {
    var out = [];
    for (var c = 0; c < m[0].length; c++) { var row = []; for (var r = m.length - 1; r >= 0; r--) row.push(m[r][c]); out.push(row); }
    return out;
  }

  function setup(root) {
    var cfg = UI.store('bd_cfg') || { level: 1 };
    var bests = UI.store('bd_best') || {};
    root.appendChild(UI.topbar('Block Drop', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note + (bests[cfg.level] ? ' Your best: ' + bests[cfg.level] + ' points.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn blocks', text: 'Start', onclick: function () { UI.store('bd_cfg', cfg); location.hash = '#/blocks/play'; } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>Blocks fall from the top. Slide and turn them so they fill whole rows. A full row clears and scores points. Clear 2, 3 or 4 rows at once for big bonuses. The game ends when the stack reaches the top.</p>' +
      '<h3>Controls</h3><ul><li><b>Tap the board</b> to turn the block.</li><li><b>Drag left or right</b> to slide it.</li>' +
      '<li><b>Flick down</b> to drop it all the way.</li><li>Or use the buttons under the board.</li></ul>' +
      '<p>Every 8 rows you clear, the level goes up and blocks fall faster.</p>' }));
  }

  function play(appRoot) {
    // One full-screen container: finger gestures work ANYWHERE on the screen, not just on the board
    var root = h('div', { class: 'arcadescreen' }); appRoot.appendChild(root);
    var cfg = UI.store('bd_cfg') || { level: 1 };
    var L = LEVELS[cfg.level - 1];
    root.appendChild(UI.topbar('Block Drop', '#/blocks', Swap.soundToggles()));
    var stats = h('div', { class: 'bdstats' });
    var canvas = h('canvas', { class: 'bdcanvas' });
    var nextC = h('canvas', { class: 'bdnext', width: 120, height: 80 });
    var wrap = h('div', { class: 'bdwrap' }, [canvas, h('div', { class: 'bdside' }, [h('div', { class: 'bdlabel', text: 'NEXT' }), nextC, stats])]);
    root.appendChild(wrap);
    var ctl = h('div', { class: 'bdctl' });
    root.appendChild(ctl);

    var grid, piece, next, bag = [], score = 0, lines = 0, lvl = 1, over = false, paused = false;
    var dropMs, acc = 0, lastT = 0, flash = null, raf = 0;
    var ctx = canvas.getContext('2d'), nctx = nextC.getContext('2d'), cell = 20;

    function size() {
      var w = Math.min(wrap.clientWidth - 92, (window.innerHeight - 280) * COLS / ROWS);
      cell = Math.max(14, Math.floor(w / COLS));
      var dpr = window.devicePixelRatio || 1;
      canvas.width = cell * COLS * dpr; canvas.height = cell * ROWS * dpr;
      canvas.style.width = cell * COLS + 'px'; canvas.style.height = cell * ROWS + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nextC.width = 80 * dpr; nextC.height = 60 * dpr; nextC.style.width = '80px'; nextC.style.height = '60px';
      nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function newBag() { var b = [0, 1, 2, 3, 4, 5, 6]; for (var i = 6; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
    function take() { if (!bag.length) bag = newBag(); var k = bag.pop(); return { m: SHAPES[k], color: k + 1 }; }
    function spawn() {
      piece = next || take(); next = take();
      piece.x = Math.floor((COLS - piece.m[0].length) / 2); piece.y = 0;
      if (hits(piece.m, piece.x, piece.y)) end();
    }
    function hits(m, x, y) {
      for (var r = 0; r < m.length; r++) for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var gx = x + c, gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
      return false;
    }
    function move(dx) { if (busy()) return; if (!hits(piece.m, piece.x + dx, piece.y)) { piece.x += dx; draw(); } }
    function turn() {
      if (busy()) return;
      var m = rotate(piece.m), kicks = [0, -1, 1, -2, 2];
      for (var i = 0; i < kicks.length; i++) if (!hits(m, piece.x + kicks[i], piece.y)) { piece.m = m; piece.x += kicks[i]; UI.vibrate(5); draw(); return; }
    }
    function soft() { if (busy()) return; if (!hits(piece.m, piece.x, piece.y + 1)) { piece.y++; score += 1; acc = 0; draw(); } else lock(); }
    function hard() {
      if (busy()) return;
      var n = 0; while (!hits(piece.m, piece.x, piece.y + 1)) { piece.y++; n++; }
      score += n * 2; UI.vibrate(15); lock();
    }
    function busy() { return over || paused || flash; }

    function lock() {
      piece.m.forEach(function (row, r) { row.forEach(function (v, c) { if (v && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = piece.color; }); });
      var full = [];
      for (var r = 0; r < ROWS; r++) if (grid[r].every(function (v) { return v; })) full.push(r);
      if (full.length) {
        flash = { rows: full, t: 0 };
        UI.vibrate(full.length > 1 ? 40 : 20);
        setTimeout(function () {
          full.forEach(function (r) { grid.splice(r, 1); grid.unshift(new Array(COLS).fill(0)); });
          var pts = [0, 100, 300, 500, 800][full.length] * lvl;
          score += pts; lines += full.length;
          if (full.length >= 3) UI.toast(full.length === 4 ? 'FOUR rows! +' + pts : 'Triple! +' + pts);
          var nl = Math.floor(lines / 8) + 1;
          if (nl > lvl) { lvl = nl; UI.toast('Level ' + lvl + '!'); }
          dropMs = Math.max(90, L.speed * Math.pow(0.85, lvl - 1));
          flash = null; spawn(); draw();
        }, 220);
      } else spawn();
      draw();
    }

    function block(c, x, y, s, color, alpha) {
      c.globalAlpha = alpha || 1;
      var r = Math.max(3, s * 0.22);
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x + r, y); c.arcTo(x + s, y, x + s, y + s, r); c.arcTo(x + s, y + s, x, y + s, r);
      c.arcTo(x, y + s, x, y, r); c.arcTo(x, y, x + s, y, r); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(x + s * 0.18, y + s * 0.14, s * 0.5, s * 0.16);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(x + s * 0.12, y + s * 0.78, s * 0.76, s * 0.1);
      c.globalAlpha = 1;
    }

    function draw() {
      var W = cell * COLS, H = cell * ROWS;
      ctx.fillStyle = '#0d0a2a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      for (var x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, H); ctx.stroke(); }
      for (var y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(W, y * cell + 0.5); ctx.stroke(); }
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (!grid[r][c]) continue;
        var isFlash = flash && flash.rows.indexOf(r) >= 0;
        block(ctx, c * cell + 1, r * cell + 1, cell - 2, isFlash ? '#ffffff' : COLORS[grid[r][c]]);
      }
      if (piece && !over) piece.m.forEach(function (row, rr) { row.forEach(function (v, cc) {
        if (v && piece.y + rr >= 0) block(ctx, (piece.x + cc) * cell + 1, (piece.y + rr) * cell + 1, cell - 2, COLORS[piece.color]);
      }); });
      nctx.clearRect(0, 0, 80, 60);
      if (next) {
        var s = 16, ox = (80 - next.m[0].length * s) / 2, oy = (60 - next.m.length * s) / 2;
        next.m.forEach(function (row, rr) { row.forEach(function (v, cc) { if (v) block(nctx, ox + cc * s, oy + rr * s, s - 2, COLORS[next.color]); }); });
      }
      stats.innerHTML = '';
      [['SCORE', score], ['ROWS', lines], ['LEVEL', lvl]].forEach(function (p) {
        stats.appendChild(h('div', { class: 'bdlabel', text: p[0] })); stats.appendChild(h('div', { class: 'bdval', text: String(p[1]) }));
      });
      if (paused && !over) {
        ctx.fillStyle = 'rgba(13,10,42,0.75)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px -apple-system, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Paused', W / 2, H / 2);
      }
    }

    function loop(t) {
      if (!document.body.contains(canvas)) return;
      if (!lastT) lastT = t;
      var dt = t - lastT; lastT = t;
      if (!busy() && piece) {
        acc += dt;
        if (acc >= dropMs) { acc = 0; if (!hits(piece.m, piece.x, piece.y + 1)) { piece.y++; draw(); } else lock(); }
      }
      raf = requestAnimationFrame(loop);
    }

    function end() {
      over = true;
      var bests = UI.store('bd_best') || {}, isBest = !bests[cfg.level] || score > bests[cfg.level];
      if (isBest && score > 0) { bests[cfg.level] = score; UI.store('bd_best', bests); UI.confetti(); }
      setTimeout(function () {
        UI.modal({ big: isBest && score > 0 ? '\uD83C\uDFC6' : '\uD83E\uDDF1', title: isBest && score > 0 ? 'New best score!' : 'Game over',
          text: score + ' points, ' + lines + ' rows cleared, level ' + lvl + '.',
          buttons: [{ label: 'Play again', cls: 'blocks', fn: start }, { label: 'Back to menu', fn: function () { location.hash = '#/blocks'; } }] });
      }, 300);
    }

    function start() {
      grid = []; for (var r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
      bag = []; next = null; score = 0; lines = 0; lvl = 1; over = false; paused = false; flash = null;
      dropMs = L.speed; acc = 0;
      spawn(); draw();
    }

    // Buttons with hold-to-repeat
    function holdBtn(label, aria, fn, repeat) {
      var b = h('button', { html: label, 'aria-label': aria }), timer = null, iv = null;
      function stop() { clearTimeout(timer); clearInterval(iv); timer = iv = null; }
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); fn();
        if (repeat) timer = setTimeout(function () { iv = setInterval(fn, 55); }, 180);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, stop); });
      return b;
    }
    ctl.appendChild(holdBtn('&#9664;', 'Left', function () { move(-1); }, true));
    ctl.appendChild(holdBtn('&#10227;', 'Turn', turn, false));
    ctl.appendChild(holdBtn('&#9654;', 'Right', function () { move(1); }, true));
    ctl.appendChild(holdBtn('&#9660;', 'Down', soft, true));
    ctl.appendChild(holdBtn('&#10515;', 'Drop', hard, false));
    root.appendChild(h('div', { class: 'toolbar two' }, [
      UI.tbtn('&#10074;&#10074;', 'Pause', function () { if (!over) { paused = !paused; if (paused) Sound.stopMusic(); else Sound.playMusic('blocks', canvas); draw(); } }),
      UI.tbtn('&#10227;', 'Restart', function () { UI.modal({ title: 'Restart?', text: 'Your score resets.', buttons: [{ label: 'Restart', cls: 'blocks', fn: start }, { label: 'Keep playing' }] }); })]));

    // Touch gestures anywhere on the screen (Steve 11/17: thumbs, not arrow buttons):
    //   drag left/right = slide, drag down slowly = drop faster, quick flick down = drop all the way, tap = turn
    var sx = 0, sy = 0, st = 0, movedCols = 0, movedRows = 0, dragged = false, pid = null;
    function isUi(e) { return e.target.closest && e.target.closest('button, a, input'); }
    root.addEventListener('pointerdown', function (e) {
      if (isUi(e)) return; e.preventDefault();
      sx = e.clientX; sy = e.clientY; st = Date.now(); movedCols = 0; movedRows = 0; dragged = false; pid = e.pointerId;
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    });
    root.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== pid) return;
      e.preventDefault();
      var step = Math.max(18, cell);
      var cols = Math.round((e.clientX - sx) / step);
      while (cols > movedCols) { move(1); movedCols++; dragged = true; }
      while (cols < movedCols) { move(-1); movedCols--; dragged = true; }
      var rows = Math.floor((e.clientY - sy) / step);
      if (Math.abs(e.clientX - sx) < step && (Date.now() - st) > 180) { while (rows > movedRows) { soft(); movedRows++; dragged = true; } }
    });
    function endTouch(e) {
      if (!st || e.pointerId !== pid) return;
      var dy = e.clientY - sy, dt = Date.now() - st, dx = e.clientX - sx;
      if (e.type !== 'pointercancel') {
        if (!movedRows && !movedCols && dy > 50 && dy / dt > 0.5) hard();
        else if (!dragged && Math.abs(dx) < 10 && Math.abs(dy) < 10) turn();
      }
      st = 0; pid = null;
    }
    root.addEventListener('pointerup', endTouch); root.addEventListener('pointercancel', endTouch);
    function onKey(e) {
      if (!document.body.contains(canvas)) { document.removeEventListener('keydown', onKey); return; }
      var k = e.key;
      if (k === 'ArrowLeft') move(-1); else if (k === 'ArrowRight') move(1); else if (k === 'ArrowUp') turn();
      else if (k === 'ArrowDown') soft(); else if (k === ' ') hard(); else if (k === 'p') { paused = !paused; draw(); } else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', function vis() {
      if (!document.body.contains(canvas)) { document.removeEventListener('visibilitychange', vis); return; }
      if (document.hidden && !over) { paused = true; draw(); }
    });

    // Music lives only on this screen: start now, and again on the first tap (phones need a tap before sound)
    Sound.playMusic('blocks', canvas);
    root.addEventListener('pointerdown', function first() {
      if (!document.body.contains(canvas)) { root.removeEventListener('pointerdown', first); return; }
      if (!paused && !over) Sound.playMusic('blocks', canvas);
    });
    size(); start();
    window.addEventListener('resize', function rs() { if (!document.body.contains(canvas)) { window.removeEventListener('resize', rs); return; } size(); draw(); });
    raf = requestAnimationFrame(loop);
  }

  return { setup: setup, play: play };
})();
