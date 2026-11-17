/* Brick Blast: an original brick-breaker. Your finger (anywhere on the screen) moves the paddle; tap to launch. */
var Breakout = (function () {
  var h = UI.h;
  var LEVELS = [
    { value: 1, label: 'Beginner', speed: 5.2, paddle: 0.26, lives: 5, note: 'Slow ball, wide paddle, 5 lives.' },
    { value: 2, label: 'Intermediate', speed: 6.6, paddle: 0.21, lives: 3, note: 'Faster ball, 3 lives. Catch the power-ups.' },
    { value: 3, label: 'Advanced', speed: 8.0, paddle: 0.17, lives: 3, note: 'Quick ball, narrow paddle. Good luck.' }
  ];
  var COLORS = ['#ff5d73', '#ff8a3d', '#ffcf3f', '#3ee08f', '#3fb4ff', '#b06bff', '#ff6bd6'];
  // Brick patterns ('#' brick, '2' tough brick that takes 2 hits, '.' empty). Stages cycle and speed up.
  var STAGES = [
    ['##########', '##########', '##########', '##########', '##########'],
    ['.########.', '##########', '###2222###', '##########', '.########.'],
    ['#.#.#.#.#.', '.#.#.#.#.#', '#.#.#.#.#.', '.#.#.#.#.#', '##########', '2222222222'],
    ['....##....', '...####...', '..######..', '.###22###.', '##########', '2########2'],
    ['2########2', '#2######2#', '##2####2##', '###2##2###', '####22####', '##########'],
    ['##########', '#........#', '#.222222.#', '#.2....2.#', '#.222222.#', '#........#', '##########']
  ];
  var POWERS = [
    { k: 'wide', label: 'WIDE', color: '#3ee08f' }, { k: 'multi', label: 'x3', color: '#3fb4ff' },
    { k: 'slow', label: 'SLOW', color: '#ffcf3f' }, { k: 'life', label: '+1', color: '#ff6bd6' }
  ];

  function setup(root) {
    var cfg = UI.store('bb_cfg') || { level: 1 }, bests = UI.store('bb_best') || {};
    root.appendChild(UI.topbar('Brick Blast', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note + (bests[cfg.level] ? ' Your best: ' + bests[cfg.level].toLocaleString() + '.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn breakout', text: 'Play', onclick: function () { UI.store('bb_cfg', cfg); location.hash = '#/breakout/play'; } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>Bounce the ball off your paddle to smash every brick. Clear the board to reach the next stage. Do not let the ball fall past your paddle.</p>' +
      '<h3>Controls</h3><ul><li><b>Slide your finger anywhere on the screen</b> and the paddle follows it.</li><li><b>Tap</b> to launch the ball.</li>' +
      '<li>Where the ball hits the paddle aims it: the edges send it off at an angle.</li></ul>' +
      '<h3>Power-ups</h3><ul><li><b>WIDE</b>: bigger paddle.</li><li><b>x3</b>: three balls at once.</li><li><b>SLOW</b>: slows the ball for a while.</li><li><b>+1</b>: an extra life.</li></ul>' +
      '<p>Silver-ringed bricks take two hits.</p>' }));
  }

  function play(appRoot) {
    // Everything lives in one full-screen container so finger drags work anywhere, and the listeners die with the screen
    var root = h('div', { class: 'arcadescreen' }); appRoot.appendChild(root);
    var cfg = UI.store('bb_cfg') || { level: 1 }, L = LEVELS[cfg.level - 1];
    root.appendChild(UI.topbar('Brick Blast', '#/breakout', Swap.soundToggles()));
    var stats = h('div', { class: 'arcadebar' });
    var canvas = h('canvas', { class: 'arcadecanvas' });
    var zone = h('div', { class: 'touchzone' }, canvas);
    root.appendChild(stats); root.appendChild(zone);
    root.appendChild(h('p', { class: 'touchhint', text: 'Slide your finger anywhere to move the paddle. Tap to launch.' }));
    var ctx = canvas.getContext('2d'), W = 360, H = 520, dpr = 1;
    var paddle, balls, bricks, drops, parts, score, lives, stage, over, launched, slowUntil, wideUntil, raf, lastT = 0, msg = null;

    function size() {
      var w = Math.min(zone.clientWidth || 360, 560), hh = Math.min(window.innerHeight - 230, w * 1.45);
      W = Math.max(280, Math.floor(w)); H = Math.max(380, Math.floor(hh));
      dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function buildStage() {
      var pat = STAGES[(stage - 1) % STAGES.length], rows = pat.length, cols = 10;
      var bw = (W - 20) / cols, bh = Math.max(14, Math.min(22, H * 0.04));
      bricks = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var ch = pat[r][c]; if (ch === '.') continue;
        bricks.push({ x: 10 + c * bw + 2, y: 60 + r * (bh + 4), w: bw - 4, h: bh, hp: ch === '2' ? 2 : 1, color: COLORS[(r + stage) % COLORS.length] });
      }
    }
    function speed() { return L.speed * (1 + (stage - 1) * 0.06) * (Date.now() < slowUntil ? 0.65 : 1) * (W / 360); }
    function resetBall() {
      launched = false;
      balls = [{ x: paddle.x, y: paddle.y - 10, vx: 0, vy: 0, r: Math.max(6, W * 0.018) }];
    }
    function start() {
      stage = 1; score = 0; lives = L.lives; over = false; slowUntil = 0; wideUntil = 0; drops = []; parts = [];
      size();
      paddle = { x: W / 2, y: H - 34, w: W * L.paddle, h: 14 };
      buildStage(); resetBall(); msg = { text: 'Tap to launch', until: Infinity };
    }
    function launch() {
      if (launched || over) return;
      launched = true; msg = null;
      var s = speed(), ang = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
      balls.forEach(function (b) { b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s; });
      Sound.play('swap');
    }

    // --- touch / mouse: the paddle follows the finger anywhere on the screen
    function moveTo(clientX) {
      var r = canvas.getBoundingClientRect();
      paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, (clientX - r.left) * (W / r.width)));
      if (!launched) balls.forEach(function (b) { b.x = paddle.x; });
    }
    var downAt = 0, downX = 0;
    function onDown(e) { if (e.target.closest && e.target.closest('button, a, input')) return; e.preventDefault(); downAt = Date.now(); downX = e.clientX; moveTo(e.clientX); }
    function onMove(e) { if (e.target.closest && e.target.closest('button, a, input')) return; if (e.pointerType === 'mouse' || downAt) { e.preventDefault(); moveTo(e.clientX); } }
    function onUp(e) { if (downAt && Date.now() - downAt < 350 && Math.abs(e.clientX - downX) < 15) launch(); else if (!launched && downAt) launch(); downAt = 0; }
    root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove); root.addEventListener('pointerup', onUp);
    function onKey(e) {
      if (!document.body.contains(canvas)) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'ArrowLeft') paddle.x = Math.max(paddle.w / 2, paddle.x - 24); else if (e.key === 'ArrowRight') paddle.x = Math.min(W - paddle.w / 2, paddle.x + 24);
      else if (e.key === ' ' || e.key === 'ArrowUp') launch(); else return;
      if (!launched) balls.forEach(function (b) { b.x = paddle.x; });
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);

    function burst(x, y, color, n) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20, color: color }); } }

    function step(dt) {
      var pw = W * L.paddle * (Date.now() < wideUntil ? 1.5 : 1);
      paddle.w += (pw - paddle.w) * 0.2;
      if (!launched) return;
      var sub = 4;
      for (var s = 0; s < sub; s++) {
        balls.forEach(function (b) {
          b.x += b.vx * dt / sub; b.y += b.vy * dt / sub;
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
          if (b.y < b.r + 40) { b.y = b.r + 40; b.vy = Math.abs(b.vy); }
          // paddle
          if (b.vy > 0 && b.y + b.r >= paddle.y && b.y + b.r <= paddle.y + paddle.h + 8 && Math.abs(b.x - paddle.x) <= paddle.w / 2 + b.r) {
            var off = (b.x - paddle.x) / (paddle.w / 2), ang = -Math.PI / 2 + off * 1.05, sp = speed();
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.y = paddle.y - b.r;
            Sound.play('land'); UI.vibrate(6);
          }
          // bricks
          for (var i = 0; i < bricks.length; i++) {
            var k = bricks[i];
            if (b.x + b.r < k.x || b.x - b.r > k.x + k.w || b.y + b.r < k.y || b.y - b.r > k.y + k.h) continue;
            var ox = Math.min(b.x + b.r - k.x, k.x + k.w - (b.x - b.r)), oy = Math.min(b.y + b.r - k.y, k.y + k.h - (b.y - b.r));
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            k.hp--;
            if (k.hp <= 0) {
              bricks.splice(i, 1); score += 10 * stage; burst(k.x + k.w / 2, k.y + k.h / 2, k.color, 12); Sound.play('pop', 1 + (score % 7));
              if (Math.random() < (cfg.level === 1 ? 0.14 : 0.1)) { var p = POWERS[Math.floor(Math.random() * POWERS.length)]; drops.push({ x: k.x + k.w / 2, y: k.y, p: p }); }
            } else { score += 5; Sound.play('land'); }
            break;
          }
        });
      }
      balls = balls.filter(function (b) { return b.y - b.r < H; });
      if (!balls.length) {
        lives--; Sound.play('blast'); UI.vibrate([30, 40, 30]);
        if (lives <= 0) { gameOver(); return; }
        resetBall(); msg = { text: lives + (lives === 1 ? ' life' : ' lives') + ' left. Tap to launch', until: Infinity };
      }
      drops.forEach(function (d) { d.y += 2.4 * dt; });
      drops = drops.filter(function (d) {
        if (d.y > paddle.y - 6 && d.y < paddle.y + 18 && Math.abs(d.x - paddle.x) < paddle.w / 2 + 14) { power(d.p); return false; }
        return d.y < H + 20;
      });
      if (!bricks.length) {
        stage++; score += 250; Sound.play('win'); UI.confetti();
        msg = { text: 'Stage ' + stage + '! Tap to launch', until: Infinity };
        buildStage(); resetBall();
      }
    }
    function power(p) {
      Sound.play('special');
      msg = { text: p.label + '!', until: Date.now() + 1200 };
      if (p.k === 'wide') wideUntil = Date.now() + 12000;
      else if (p.k === 'slow') slowUntil = Date.now() + 9000;
      else if (p.k === 'life') lives++;
      else if (p.k === 'multi' && balls.length) {
        var b = balls[0], add = [];
        [-0.4, 0.4].forEach(function (da) { var a = Math.atan2(b.vy, b.vx) + da, sp = Math.hypot(b.vx, b.vy); add.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r }); });
        balls = balls.concat(add);
      }
    }
    function gameOver() {
      over = true;
      var bests = UI.store('bb_best') || {}, isBest = !bests[cfg.level] || score > bests[cfg.level];
      if (isBest && score) { bests[cfg.level] = score; UI.store('bb_best', bests); UI.confetti(); }
      UI.modal({ big: isBest && score ? '\uD83C\uDFC6' : '\uD83E\uDDF1', title: isBest && score ? 'New best score!' : 'Game over',
        text: score.toLocaleString() + ' points. You reached stage ' + stage + '.',
        buttons: [{ label: 'Play again', cls: 'breakout', fn: start }, { label: 'Back to menu', fn: function () { location.hash = '#/breakout'; } }] });
    }

    function roundRect(x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw() {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0f4a'); g.addColorStop(1, '#0b0726');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = '700 15px -apple-system, sans-serif'; ctx.textAlign = 'left';
      bricks.forEach(function (k) {
        roundRect(k.x, k.y, k.w, k.h, 5); ctx.fillStyle = k.color; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(k.x + 4, k.y + 3, k.w - 8, 3);
        if (k.hp > 1) { ctx.strokeStyle = '#e8e8f4'; ctx.lineWidth = 2.5; roundRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2, 5); ctx.stroke(); }
      });
      drops.forEach(function (d) {
        roundRect(d.x - 18, d.y - 9, 36, 18, 9); ctx.fillStyle = d.p.color; ctx.fill();
        ctx.fillStyle = '#1b1446'; ctx.font = '800 11px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.p.label, d.x, d.y + 4);
      });
      var pg = ctx.createLinearGradient(paddle.x - paddle.w / 2, 0, paddle.x + paddle.w / 2, 0); pg.addColorStop(0, '#ff4f9a'); pg.addColorStop(1, '#ffb03d');
      roundRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h, 7); ctx.fillStyle = pg; ctx.fill();
      balls.forEach(function (b) {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.shadowColor = '#9be7ff'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
      });
      parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life / 50); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); }); ctx.globalAlpha = 1;
      if (msg && Date.now() < msg.until) { ctx.fillStyle = '#fff'; ctx.font = '800 20px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg.text, W / 2, H * 0.62); }
      stats.innerHTML = '';
      [['SCORE', score.toLocaleString()], ['STAGE', stage], ['LIVES', '\u2665'.repeat(Math.min(lives, 6))]].forEach(function (s) {
        stats.appendChild(h('div', null, [h('div', { class: 'bdlabel', text: s[0] }), h('div', { class: 'bdval', text: String(s[1]) })]));
      });
    }
    function loop(t) {
      if (!document.body.contains(canvas)) { document.removeEventListener('keydown', onKey); return; }
      var dt = lastT ? Math.min(2.5, (t - lastT) / 16.67) : 1; lastT = t;
      if (!over && !document.hidden) step(dt);
      parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.08 * dt; p.life -= dt; }); parts = parts.filter(function (p) { return p.life > 0; });
      draw();
      raf = requestAnimationFrame(loop);
    }
    start();
    Sound.playMusic('blocks', canvas);
    root.addEventListener('pointerdown', function first() { if (!document.body.contains(canvas)) { root.removeEventListener('pointerdown', first); return; } Sound.playMusic('blocks', canvas); });
    window.addEventListener('resize', function rs() {
      if (!document.body.contains(canvas)) { window.removeEventListener('resize', rs); return; }
      var oldW = W; size(); var k = W / oldW; paddle.x *= k; paddle.y = H - 34; bricks.forEach(function (b) { b.x *= k; b.w *= k; }); });
    raf = requestAnimationFrame(loop);
  }
  return { setup: setup, play: play };
})();
