/* Space Rocks: an original space shooter. Touch and hold anywhere: the ship turns toward your finger,
   flies toward it, and fires on its own. Lift your finger to coast. */
var Rocks = (function () {
  var h = UI.h;
  var LEVELS = [
    { value: 1, label: 'Beginner', rocks: 3, speed: 0.7, fire: 170, lives: 5, note: 'Slow rocks, rapid fire, 5 ships.' },
    { value: 2, label: 'Intermediate', rocks: 4, speed: 1.0, fire: 220, lives: 3, note: 'More rocks, 3 ships.' },
    { value: 3, label: 'Advanced', rocks: 5, speed: 1.35, fire: 260, lives: 3, note: 'Fast rocks. Keep moving.' }
  ];
  var ROCK_COLORS = [['#ff6b6b', '#c0392b'], ['#ffb03d', '#d35400'], ['#b06bff', '#6c3fb4'], ['#3fb4ff', '#1f6fd6'], ['#3ee08f', '#18a558'], ['#ff6bd6', '#c0399a']];

  function setup(root) {
    var cfg = UI.store('sr_cfg') || { level: 1 }, bests = UI.store('sr_best') || {};
    root.appendChild(UI.topbar('Space Rocks', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note + (bests[cfg.level] ? ' Your best: ' + bests[cfg.level].toLocaleString() + '.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn rocks', text: 'Play', onclick: function () { UI.store('sr_cfg', cfg); location.hash = '#/rocks/play'; } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>Blast the space rocks before they hit your ship. Big rocks break into smaller, faster pieces. Clear them all for the next wave.</p>' +
      '<h3>Controls</h3><ul><li><b>Touch and hold anywhere</b>: your ship turns toward your finger and flies there.</li>' +
      '<li>While your finger is down, the ship <b>fires automatically</b>.</li><li><b>Lift your finger</b> to coast and keep firing straight ahead.</li>' +
      '<li>On a computer: arrow keys to turn and thrust, space to fire.</li></ul>' +
      '<p>After you lose a ship, the new one blinks: it cannot be hit until it stops blinking.</p>' }));
  }

  function play(appRoot) {
    var cfg = UI.store('sr_cfg') || { level: 1 }, L = LEVELS[cfg.level - 1];
    var root = h('div', { class: 'arcadescreen' }); appRoot.appendChild(root);
    root.appendChild(UI.topbar('Space Rocks', '#/rocks', Swap.soundToggles()));
    var stats = h('div', { class: 'arcadebar' }), canvas = h('canvas', { class: 'arcadecanvas' });
    root.appendChild(stats); root.appendChild(h('div', { class: 'touchzone' }, canvas));
    root.appendChild(h('p', { class: 'touchhint', text: 'Touch and hold anywhere to steer. Your ship fires on its own.' }));
    var ctx = canvas.getContext('2d'), W = 360, H = 560, stars = [];
    var ship, rocks, shots, parts, score, lives, wave, over, lastShot = 0, touch = null, keys = {}, raf, lastT = 0, banner = null;

    function size() {
      var w = Math.min(root.clientWidth || 360, 560), hh = Math.max(380, Math.min(window.innerHeight - 200, w * 1.6));
      W = Math.floor(w); H = Math.floor(hh);
      var dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = []; for (var i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 2 + 0.4 });
    }
    function rock(x, y, size, gen) {
      var n = 9 + Math.floor(Math.random() * 4), pts = [];
      for (var i = 0; i < n; i++) pts.push(0.72 + Math.random() * 0.36);
      var a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 0.9) * L.speed * (1 + (wave - 1) * 0.08) * (gen + 1) * 0.75;
      return { x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: size, pts: pts, rot: 0, spin: (Math.random() - 0.5) * 0.04, c: ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)], gen: gen };
    }
    function newWave() {
      rocks = [];
      var count = L.rocks + wave - 1, big = Math.min(W, H) * 0.12;
      for (var i = 0; i < count; i++) {
        var x, y; do { x = Math.random() * W; y = Math.random() * H; } while (Math.hypot(x - ship.x, y - ship.y) < big * 3);
        rocks.push(rock(x, y, big, 0));
      }
      banner = { text: 'Wave ' + wave, until: Date.now() + 1500 };
    }
    function spawnShip() { ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, safeUntil: Date.now() + 2500, thrust: false }; }
    function start() {
      size(); score = 0; lives = L.lives; wave = 1; over = false; shots = []; parts = []; spawnShip(); newWave();
    }
    function wrap(o) { if (o.x < -o.r) o.x += W + o.r * 2; if (o.x > W + o.r) o.x -= W + o.r * 2; if (o.y < -o.r) o.y += H + o.r * 2; if (o.y > H + o.r) o.y -= H + o.r * 2; }
    function burst(x, y, colors, n, spd) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = Math.random() * (spd || 3); parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 30, c: colors[i % colors.length] }); } }
    function fire() {
      var now = Date.now(); if (now - lastShot < L.fire) return; lastShot = now;
      shots.push({ x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14, vx: Math.cos(ship.a) * 8 + ship.vx, vy: Math.sin(ship.a) * 8 + ship.vy, life: 60, r: 3 });
      Sound.play('land');
    }

    // --- touch: hold anywhere; the ship turns toward the finger, thrusts toward it, auto-fires
    function canvasPoint(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
    function isUi(e) { return e.target.closest && e.target.closest('button, a, input'); }
    root.addEventListener('pointerdown', function (e) { if (isUi(e)) return; e.preventDefault(); touch = canvasPoint(e); try { root.setPointerCapture(e.pointerId); } catch (err) {} });
    root.addEventListener('pointermove', function (e) { if (touch && !isUi(e)) { e.preventDefault(); touch = canvasPoint(e); } });
    ['pointerup', 'pointercancel'].forEach(function (ev) { root.addEventListener(ev, function () { touch = null; }); });
    function onKey(e) {
      if (!document.body.contains(canvas)) { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].indexOf(e.key) < 0) return;
      keys[e.key] = e.type === 'keydown'; e.preventDefault();
    }
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);

    function step(dt) {
      if (!ship) return;
      ship.thrust = false;
      if (touch) {
        var want = Math.atan2(touch.y - ship.y, touch.x - ship.x), diff = Math.atan2(Math.sin(want - ship.a), Math.cos(want - ship.a));
        ship.a += Math.max(-0.16, Math.min(0.16, diff)) * dt;
        var dist = Math.hypot(touch.x - ship.x, touch.y - ship.y);
        if (dist > 40 && Math.abs(diff) < 1.2) { ship.vx += Math.cos(ship.a) * 0.17 * dt; ship.vy += Math.sin(ship.a) * 0.17 * dt; ship.thrust = true; }
        fire();
      } else {
        if (keys.ArrowLeft) ship.a -= 0.08 * dt; if (keys.ArrowRight) ship.a += 0.08 * dt;
        if (keys.ArrowUp) { ship.vx += Math.cos(ship.a) * 0.15 * dt; ship.vy += Math.sin(ship.a) * 0.15 * dt; ship.thrust = true; }
        if (keys[' ']) fire();
      }
      var sp = Math.hypot(ship.vx, ship.vy), max = 6; if (sp > max) { ship.vx *= max / sp; ship.vy *= max / sp; }
      ship.vx *= Math.pow(0.985, dt); ship.vy *= Math.pow(0.985, dt);
      ship.x += ship.vx * dt; ship.y += ship.vy * dt; ship.r = 12; wrap(ship);
      if (ship.thrust && Math.random() < 0.7) parts.push({ x: ship.x - Math.cos(ship.a) * 12, y: ship.y - Math.sin(ship.a) * 12, vx: -Math.cos(ship.a) * 2 + (Math.random() - 0.5), vy: -Math.sin(ship.a) * 2 + (Math.random() - 0.5), life: 14, c: Math.random() < 0.5 ? '#ffcf3f' : '#ff7a2f' });
      shots.forEach(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; wrap(s); });
      shots = shots.filter(function (s) { return s.life > 0; });
      rocks.forEach(function (r) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt; wrap(r); });
      // shots vs rocks
      for (var i = rocks.length - 1; i >= 0; i--) {
        var r = rocks[i];
        for (var j = shots.length - 1; j >= 0; j--) {
          if (Math.hypot(shots[j].x - r.x, shots[j].y - r.y) < r.r) {
            shots.splice(j, 1); rocks.splice(i, 1);
            score += [20, 50, 100][r.gen]; burst(r.x, r.y, r.c, 18, 3.5); Sound.play('pop', 2 + r.gen * 2);
            if (r.gen < 2) for (var k = 0; k < 2; k++) rocks.push(rock(r.x, r.y, r.r * 0.55, r.gen + 1));
            break;
          }
        }
      }
      // rocks vs ship
      if (Date.now() > ship.safeUntil) {
        for (var q = 0; q < rocks.length; q++) {
          if (Math.hypot(rocks[q].x - ship.x, rocks[q].y - ship.y) < rocks[q].r * 0.85 + 9) {
            lives--; burst(ship.x, ship.y, ['#fff', '#9be7ff', '#ffcf3f'], 40, 4.5); Sound.play('blast'); UI.vibrate([40, 50, 40]);
            if (lives <= 0) { ship = null; gameOver(); return; }
            spawnShip(); break;
          }
        }
      }
      if (!rocks.length) { wave++; score += 500; Sound.play('win'); newWave(); ship.safeUntil = Date.now() + 1500; }
    }
    function gameOver() {
      over = true;
      var bests = UI.store('sr_best') || {}, isBest = !bests[cfg.level] || score > bests[cfg.level];
      if (isBest && score) { bests[cfg.level] = score; UI.store('sr_best', bests); UI.confetti(); }
      setTimeout(function () {
        UI.modal({ big: isBest && score ? '\uD83C\uDFC6' : '\uD83D\uDE80', title: isBest && score ? 'New best score!' : 'Game over',
          text: score.toLocaleString() + ' points. You reached wave ' + wave + '.',
          buttons: [{ label: 'Play again', cls: 'rocks', fn: start }, { label: 'Back to menu', fn: function () { location.hash = '#/rocks'; } }] });
      }, 900);
    }
    function draw() {
      var g = ctx.createRadialGradient(W * 0.3, H * 0.2, 10, W / 2, H / 2, Math.max(W, H));
      g.addColorStop(0, '#2a1060'); g.addColorStop(0.5, '#120a35'); g.addColorStop(1, '#05030f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      stars.forEach(function (s) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + s.z * 0.3) + ')'; ctx.fillRect(s.x, s.y, s.z, s.z); });
      rocks.forEach(function (r) {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
        ctx.beginPath();
        r.pts.forEach(function (p, i) { var a = i / r.pts.length * Math.PI * 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r.r * p, Math.sin(a) * r.r * p); });
        ctx.closePath();
        var rg = ctx.createRadialGradient(-r.r * 0.3, -r.r * 0.3, r.r * 0.1, 0, 0, r.r); rg.addColorStop(0, r.c[0]); rg.addColorStop(1, r.c[1]);
        ctx.fillStyle = rg; ctx.shadowColor = r.c[0]; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(r.r * 0.25, r.r * 0.1, r.r * 0.18, 0, Math.PI * 2); ctx.arc(-r.r * 0.3, r.r * 0.35, r.r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      shots.forEach(function (s) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = '#fff6a8'; ctx.shadowColor = '#ffcf3f'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; });
      parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life / 50); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
      if (ship && !(Date.now() < ship.safeUntil && Math.floor(Date.now() / 120) % 2)) {
        ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-11, -10); ctx.lineTo(-6, 0); ctx.lineTo(-11, 10); ctx.closePath();
        var sg = ctx.createLinearGradient(-11, 0, 16, 0); sg.addColorStop(0, '#3fb4ff'); sg.addColorStop(1, '#ffffff');
        ctx.fillStyle = sg; ctx.shadowColor = '#3fb4ff'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
        ctx.restore();
      }
      if (touch) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(touch.x, touch.y, 18, 0, Math.PI * 2); ctx.stroke(); }
      if (banner && Date.now() < banner.until) { ctx.fillStyle = '#fff'; ctx.font = '800 26px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(banner.text, W / 2, H * 0.3); }
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
      raf = requestAnimationFrame(loop);
    }
    start();
    Sound.playMusic('night', canvas);
    root.addEventListener('pointerdown', function () { if (document.body.contains(canvas)) Sound.playMusic('night', canvas); });
    window.addEventListener('resize', function rs() { if (!document.body.contains(canvas)) { window.removeEventListener('resize', rs); return; } size(); });
    raf = requestAnimationFrame(loop);
  }
  return { setup: setup, play: play };
})();
