/* Galaxy Guard: an original alien-formation shooter. Slide your finger anywhere to move; your ship fires on its own. */
var Invaders = (function () {
  var h = UI.h;
  var LEVELS = [
    { value: 1, label: 'Beginner', march: 0.45, enemyFire: 0.006, fire: 330, lives: 5, note: 'Slow aliens, quick shots, 5 ships.' },
    { value: 2, label: 'Intermediate', march: 0.65, enemyFire: 0.010, fire: 400, lives: 3, note: 'Faster march, more alien fire.' },
    { value: 3, label: 'Advanced', march: 0.85, enemyFire: 0.015, fire: 460, lives: 3, note: 'Fast and furious. Use your shields.' }
  ];
  // Three original alien types: body color, eye color, points
  var TYPES = [
    { body: '#ff5d73', dark: '#b8233c', pts: 30 },
    { body: '#ffcf3f', dark: '#c48a12', pts: 20 },
    { body: '#3ee08f', dark: '#18a558', pts: 10 }
  ];

  function setup(root) {
    var cfg = UI.store('gg_cfg') || { level: 1 }, bests = UI.store('gg_best') || {};
    root.appendChild(UI.topbar('Galaxy Guard', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note + (bests[cfg.level] ? ' Your best: ' + bests[cfg.level].toLocaleString() + '.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn invaders', text: 'Play', onclick: function () { UI.store('gg_cfg', cfg); location.hash = '#/invaders/play'; } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>A fleet of aliens marches back and forth, stepping closer each time it reaches the edge. Blast them all before they reach the ground. Every wave is faster.</p>' +
      '<h3>Controls</h3><ul><li><b>Slide your finger anywhere on the screen</b>: your ship follows it left and right.</li><li>Your ship <b>fires automatically</b>.</li>' +
      '<li>On a computer: arrow keys to move.</li></ul>' +
      '<h3>Tips</h3><ul><li>Hide under the shields when the aliens fire. Shields crumble as they get hit.</li>' +
      '<li>The fewer aliens left, the faster they move.</li><li>Hit the mystery ship that crosses the top for a big bonus.</li></ul>' }));
  }

  function play(appRoot) {
    var cfg = UI.store('gg_cfg') || { level: 1 }, L = LEVELS[cfg.level - 1];
    var root = h('div', { class: 'arcadescreen' }); appRoot.appendChild(root);
    root.appendChild(UI.topbar('Galaxy Guard', '#/invaders', Swap.soundToggles()));
    var stats = h('div', { class: 'arcadebar' }), canvas = h('canvas', { class: 'arcadecanvas' });
    root.appendChild(stats); root.appendChild(h('div', { class: 'touchzone' }, canvas));
    root.appendChild(h('p', { class: 'touchhint', text: 'Slide your finger anywhere to move. Your ship fires on its own.' }));
    var ctx = canvas.getContext('2d'), W = 360, H = 560, stars = [];
    var ship, aliens, shots, bombs, shields, parts, saucer, score, lives, wave, over, dir, stepTimer, lastShot = 0, targetX = null, keys = {}, lastT = 0, banner = null, frame = 0, hitUntil = 0;

    function size() {
      var w = Math.min(root.clientWidth || 360, 520), hh = Math.max(420, Math.min(window.innerHeight - 200, w * 1.55));
      W = Math.floor(w); H = Math.floor(hh);
      var dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = []; for (var i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.3, tw: Math.random() * 6 });
    }
    function buildWave() {
      aliens = [];
      var cols = 8, rows = 5, gap = W / (cols + 2.4), size = gap * 0.62;
      var top = 60 + Math.min(4, wave - 1) * 16;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var t = r === 0 ? 0 : r < 3 ? 1 : 2;
        aliens.push({ x: gap * 1.2 + c * gap, y: top + r * gap * 0.82, s: size, t: t, alive: true });
      }
      shields = [];
      var n = 4, bw = W * 0.13, cell = Math.max(4, Math.floor(bw / 8));
      for (var k = 0; k < n; k++) {
        var cx = W * (k + 0.5) / n, y0 = H - 110;
        for (var yy = 0; yy < 4; yy++) for (var xx = 0; xx < 8; xx++) {
          if (yy === 3 && (xx >= 3 && xx <= 4)) continue; // arch
          if (yy === 0 && (xx === 0 || xx === 7)) continue; // rounded top
          shields.push({ x: cx - bw / 2 + xx * cell, y: y0 + yy * cell, w: cell, h: cell, hp: 3 });
        }
      }
      dir = 1; stepTimer = 0; bombs = []; shots = []; saucer = null;
      banner = { text: 'Wave ' + wave, until: Date.now() + 1500 };
    }
    function start() {
      size(); score = 0; lives = L.lives; wave = 1; over = false; parts = [];
      ship = { x: W / 2, y: H - 40, w: 34 }; buildWave();
    }
    function burst(x, y, colors, n) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = Math.random() * 3; parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 25 + Math.random() * 25, c: colors[i % colors.length] }); } }

    // --- touch: the ship follows the finger anywhere on the screen
    function setTarget(e) { var r = canvas.getBoundingClientRect(); targetX = (e.clientX - r.left) * (W / r.width); }
    function isUi(e) { return e.target.closest && e.target.closest('button, a, input'); }
    root.addEventListener('pointerdown', function (e) { if (isUi(e)) return; e.preventDefault(); setTarget(e); try { root.setPointerCapture(e.pointerId); } catch (err) {} });
    root.addEventListener('pointermove', function (e) { if (isUi(e)) return; if (e.pointerType === 'mouse' || e.buttons || targetX !== null) { e.preventDefault(); setTarget(e); } });
    function onKey(e) {
      if (!document.body.contains(canvas)) { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      keys[e.key] = e.type === 'keydown'; targetX = null; e.preventDefault();
    }
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);

    function living() { return aliens.filter(function (a) { return a.alive; }); }
    function step(dt) {
      frame += dt;
      // ship movement
      var spd = 7 * dt;
      if (targetX !== null) ship.x += Math.max(-spd * 1.4, Math.min(spd * 1.4, targetX - ship.x));
      if (keys.ArrowLeft) ship.x -= spd; if (keys.ArrowRight) ship.x += spd;
      ship.x = Math.max(ship.w / 2, Math.min(W - ship.w / 2, ship.x));
      // auto-fire
      if (Date.now() > hitUntil && Date.now() - lastShot > L.fire) { lastShot = Date.now(); shots.push({ x: ship.x, y: ship.y - 16, vy: -9 }); Sound.play('land'); }
      shots.forEach(function (s) { s.y += s.vy * dt; }); shots = shots.filter(function (s) { return s.y > 30; });
      // formation march: speeds up as aliens fall
      var live = living(), total = aliens.length, frac = live.length / total;
      var march = L.march * (1 + (wave - 1) * 0.15) * (1 + (1 - frac) * 2.6) * (W / 360);
      var minX = Infinity, maxX = -Infinity, maxY = 0;
      live.forEach(function (a) { minX = Math.min(minX, a.x - a.s / 2); maxX = Math.max(maxX, a.x + a.s / 2); maxY = Math.max(maxY, a.y + a.s / 2); });
      var dx = dir * march * dt;
      if ((dir > 0 && maxX + dx > W - 6) || (dir < 0 && minX + dx < 6)) { dir = -dir; live.forEach(function (a) { a.y += 14; }); Sound.play('land'); }
      else live.forEach(function (a) { a.x += dx; });
      if (maxY > H - 120 && shields.length) shields = shields.filter(function (b) { return !live.some(function (a) { return Math.abs(a.x - b.x) < a.s / 2 && Math.abs(a.y - b.y) < a.s / 2; }); });
      if (maxY >= ship.y - 14) { lives = 0; end(); return; }
      // alien fire from the bottom alien of each column
      var cols = {};
      live.forEach(function (a) { var k = Math.round(a.x / 4); if (!cols[k] || cols[k].y < a.y) cols[k] = a; });
      Object.keys(cols).forEach(function (k) { if (Math.random() < L.enemyFire * dt * (1 + (wave - 1) * 0.2)) { var a = cols[k]; bombs.push({ x: a.x, y: a.y + a.s / 2, vy: 3.2 + wave * 0.15 }); } });
      bombs.forEach(function (b) { b.y += b.vy * dt; }); bombs = bombs.filter(function (b) { return b.y < H; });
      // mystery saucer
      if (!saucer && Math.random() < 0.0015 * dt) saucer = { x: Math.random() < 0.5 ? -30 : W + 30, y: 38, vx: 0 };
      if (saucer) { if (!saucer.vx) saucer.vx = saucer.x < 0 ? 2 : -2; saucer.x += saucer.vx * dt; if (saucer.x < -40 || saucer.x > W + 40) saucer = null; }
      // collisions: shots
      shots = shots.filter(function (s) {
        for (var i = 0; i < live.length; i++) {
          var a = live[i];
          if (a.alive && Math.abs(s.x - a.x) < a.s / 2 && Math.abs(s.y - a.y) < a.s / 2) {
            a.alive = false; score += TYPES[a.t].pts; burst(a.x, a.y, [TYPES[a.t].body, '#fff'], 14); Sound.play('pop', 1 + a.t * 2); return false;
          }
        }
        if (saucer && Math.abs(s.x - saucer.x) < 22 && Math.abs(s.y - saucer.y) < 12) {
          var bonus = [100, 150, 200, 300][Math.floor(Math.random() * 4)]; score += bonus; burst(saucer.x, saucer.y, ['#ff6bd6', '#ffcf3f', '#fff'], 30);
          banner = { text: '+' + bonus + '!', until: Date.now() + 1000 }; Sound.play('special'); saucer = null; return false;
        }
        for (var j = 0; j < shields.length; j++) { var b = shields[j]; if (s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h) { b.hp--; return false; } }
        return true;
      });
      // collisions: bombs
      bombs = bombs.filter(function (bm) {
        for (var j = 0; j < shields.length; j++) { var b = shields[j]; if (bm.x > b.x - 1 && bm.x < b.x + b.w + 1 && bm.y > b.y && bm.y < b.y + b.h) { b.hp--; return false; } }
        if (Date.now() > hitUntil && Math.abs(bm.x - ship.x) < ship.w / 2 && bm.y > ship.y - 10 && bm.y < ship.y + 12) {
          lives--; hitUntil = Date.now() + 1600; burst(ship.x, ship.y, ['#3fb4ff', '#fff', '#ffcf3f'], 34); Sound.play('blast'); UI.vibrate([40, 50, 40]);
          if (lives <= 0) end();
          return false;
        }
        return true;
      });
      shields = shields.filter(function (b) { return b.hp > 0; });
      if (!living().length) { wave++; score += 500; Sound.play('win'); buildWave(); }
    }
    function end() {
      if (over) return; over = true;
      var bests = UI.store('gg_best') || {}, isBest = !bests[cfg.level] || score > bests[cfg.level];
      if (isBest && score) { bests[cfg.level] = score; UI.store('gg_best', bests); UI.confetti(); }
      setTimeout(function () {
        UI.modal({ big: isBest && score ? '\uD83C\uDFC6' : '\uD83D\uDC7E', title: isBest && score ? 'New best score!' : 'Game over',
          text: score.toLocaleString() + ' points. You reached wave ' + wave + '.',
          buttons: [{ label: 'Play again', cls: 'invaders', fn: start }, { label: 'Back to menu', fn: function () { location.hash = '#/invaders'; } }] });
      }, 700);
    }
    // Original cartoon alien: round body, big eyes, wiggling antennae and feet
    function drawAlien(a) {
      var T = TYPES[a.t], s = a.s, wig = Math.sin(frame * 0.15 + a.x * 0.05) * s * 0.06;
      ctx.save(); ctx.translate(a.x, a.y);
      ctx.strokeStyle = T.dark; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.28); ctx.lineTo(-s * 0.28 + wig, -s * 0.5); ctx.moveTo(s * 0.18, -s * 0.28); ctx.lineTo(s * 0.28 - wig, -s * 0.5); ctx.stroke();
      ctx.fillStyle = T.body; ctx.beginPath(); ctx.arc(-s * 0.28 + wig, -s * 0.52, s * 0.07, 0, Math.PI * 2); ctx.arc(s * 0.28 - wig, -s * 0.52, s * 0.07, 0, Math.PI * 2); ctx.fill();
      var g = ctx.createRadialGradient(-s * 0.12, -s * 0.15, s * 0.05, 0, 0, s * 0.5); g.addColorStop(0, '#fff'); g.addColorStop(0.25, T.body); g.addColorStop(1, T.dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.dark; for (var f = -1; f <= 1; f++) { ctx.beginPath(); ctx.ellipse(f * s * 0.22, s * 0.32 + (f === 0 ? wig : -wig), s * 0.08, s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-s * 0.13, -s * 0.04, s * 0.11, 0, Math.PI * 2); ctx.arc(s * 0.13, -s * 0.04, s * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1446'; ctx.beginPath(); ctx.arc(-s * 0.11 + wig * 0.4, -s * 0.03, s * 0.05, 0, Math.PI * 2); ctx.arc(s * 0.15 + wig * 0.4, -s * 0.03, s * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function draw() {
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d0533'); bg.addColorStop(0.7, '#1c0b4d'); bg.addColorStop(1, '#3a1670');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      stars.forEach(function (s) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(frame * 0.05 + s.tw); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.s, s.s); }); ctx.globalAlpha = 1;
      ctx.fillStyle = '#2b9d6e'; ctx.fillRect(0, H - 16, W, 16); ctx.fillStyle = '#3ee08f'; ctx.fillRect(0, H - 16, W, 3);
      shields.forEach(function (b) { ctx.fillStyle = b.hp === 3 ? '#3fb4ff' : b.hp === 2 ? '#2a7fd0' : '#1d4f8c'; ctx.fillRect(b.x, b.y, b.w - 0.5, b.h - 0.5); });
      aliens.forEach(function (a) { if (a.alive) drawAlien(a); });
      if (saucer) {
        ctx.save(); ctx.translate(saucer.x, saucer.y);
        ctx.fillStyle = '#ff6bd6'; ctx.beginPath(); ctx.ellipse(0, 3, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(155,231,255,0.85)'; ctx.beginPath(); ctx.ellipse(0, -2, 10, 8, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#ffcf3f'; [-12, 0, 12].forEach(function (x) { ctx.beginPath(); ctx.arc(x, 5, 2.2, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      }
      shots.forEach(function (s) { ctx.fillStyle = '#fff6a8'; ctx.shadowColor = '#ffcf3f'; ctx.shadowBlur = 10; ctx.fillRect(s.x - 1.5, s.y - 7, 3, 12); ctx.shadowBlur = 0; });
      bombs.forEach(function (b) { ctx.fillStyle = '#ff5d73'; ctx.shadowColor = '#ff5d73'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; });
      if (!(Date.now() < hitUntil && Math.floor(Date.now() / 120) % 2)) {
        ctx.save(); ctx.translate(ship.x, ship.y);
        var sg = ctx.createLinearGradient(0, -16, 0, 12); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#3fb4ff');
        ctx.fillStyle = sg; ctx.shadowColor = '#3fb4ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(7, -4); ctx.lineTo(17, 6); ctx.lineTo(17, 11); ctx.lineTo(-17, 11); ctx.lineTo(-17, 6); ctx.lineTo(-7, -4); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.restore();
      }
      parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life / 45); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
      if (banner && Date.now() < banner.until) { ctx.fillStyle = '#fff'; ctx.font = '800 26px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(banner.text, W / 2, H * 0.45); }
      stats.innerHTML = '';
      [['SCORE', score.toLocaleString()], ['WAVE', wave], ['SHIPS', '\u25B2'.repeat(Math.max(0, Math.min(lives, 6)))]].forEach(function (s) {
        stats.appendChild(h('div', null, [h('div', { class: 'bdlabel', text: s[0] }), h('div', { class: 'bdval', text: String(s[1]) })]));
      });
    }
    function loop(t) {
      if (!document.body.contains(canvas)) return;
      var dt = lastT ? Math.min(2.5, (t - lastT) / 16.67) : 1; lastT = t;
      if (!over && !document.hidden) step(dt);
      parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(function (p) { return p.life > 0; });
      draw();
      requestAnimationFrame(loop);
    }
    start();
    Sound.playMusic('tropical', canvas);
    root.addEventListener('pointerdown', function () { if (document.body.contains(canvas)) Sound.playMusic('tropical', canvas); });
    window.addEventListener('resize', function rs() { if (!document.body.contains(canvas)) { window.removeEventListener('resize', rs); return; } var k = W; size(); k = W / k; ship.x *= k; ship.y = H - 40; });
    requestAnimationFrame(loop);
  }
  return { setup: setup, play: play };
})();
