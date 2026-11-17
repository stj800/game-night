/* Fruit Swap: level map + level screens (rules live in swap-engine.js) */
var Swap = (function () {
  var h = UI.h, E = SwapEngine, N = E.N;
  function cp(c) { return String.fromCodePoint(c); }
  var FRUIT = [0x1F353, 0x1F34C, 0x1F347, 0x1F34A, 0x1F349, 0x1F34F].map(cp);
  var FRUIT_NAME = ['strawberries', 'bananas', 'grapes', 'oranges', 'watermelons', 'apples'];
  var STAR = cp(0x1F31F), NUT = cp(0x1F330), CRATE = cp(0x1F4E6), HAMMER = cp(0x1F528), GIFT = cp(0x1F381), LOCK = cp(0x1F512);
  var PARTICLE = ['#ff3b5c', '#ffe14d', '#9b5de5', '#ff8c1a', '#ff6f91', '#5fd35f'];
  var CHEERS = ['Juicy!', 'Fresh!', 'Ripe!', 'Fruitastic!', 'Berry good!', 'Smoothie time!'];
  var WORLDS = {
    1: { key: 'orchard', name: 'Sunny Orchard', song: 'orchard', decor: [0x2601, 0x2601, 0x1F333, 0x1F333],
         ground: [0x1F33C, 0x1F337, 0x1F338, 0x1F33C, 0x1F337, 0x1F33B], movers: [{ c: 0x1F98B, k: 'fly' }, { c: 0x1F98B, k: 'fly' }, { c: 0x1F41D, k: 'fly' }] },
    2: { key: 'tropical', name: 'Tropical Sunset', song: 'tropical', decor: [0x1F334, 0x1F334, 0x2600],
         ground: [], movers: [{ c: 0x1FAE7, k: 'rise' }, { c: 0x1FAE7, k: 'rise' }, { c: 0x1FAE7, k: 'rise' }, { c: 0x1F99C, k: 'fly' }] },
    3: { key: 'night', name: 'Berry Night', song: 'night', decor: [0x1F319],
         ground: [], movers: [{ k: 'firefly' }, { k: 'firefly' }, { k: 'firefly' }, { k: 'shoot' }] }
  };

  // ---------- saved progress ----------
  function prog() {
    var p = UI.store('fs_prog') || {};
    p.unlocked = p.unlocked || 1; p.stars = p.stars || {}; p.best = p.best || {};
    p.boosters = p.boosters || { hammer: 2, moves: 1 }; p.gift = p.gift || '';
    return p;
  }
  function saveProg(p) { UI.store('fs_prog', p); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  // ---------- shared scene (themed living background) ----------
  function buildScene(root, W) {
    var scene = h('div', { class: 'fsscene theme-' + W.key });
    W.decor.forEach(function (c, k) { scene.appendChild(h('span', { class: 'decor d' + k, text: cp(c) })); });
    if (W.key === 'night') for (var st = 0; st < 40; st++) {
      var dot = h('i', { class: 'twinkle' }); dot.style.left = Math.random() * 100 + '%'; dot.style.top = Math.random() * 70 + '%';
      dot.style.animationDelay = Math.random() * 3 + 's'; scene.appendChild(dot);
    }
    W.ground.forEach(function (c, k) {
      var fl = h('span', { class: 'groundflower', text: cp(c) });
      fl.style.left = (6 + k * (88 / Math.max(1, W.ground.length - 1))) + '%';
      fl.style.bottom = (1 + (k % 2) * 3 + Math.random() * 2) + '%';
      fl.style.animationDelay = (Math.random() * 2) + 's';
      scene.appendChild(fl);
    });
    root.appendChild(scene);
    var timer = setInterval(function () {
      if (!document.body.contains(scene)) { clearInterval(timer); return; }
      if (document.hidden || scene.querySelectorAll('.mover').length >= 6) return;
      var m = W.movers[Math.floor(Math.random() * W.movers.length)], e;
      if (m.k === 'fly') {
        var ltr = Math.random() < 0.5;
        e = h('span', { class: 'mover fly' + (ltr ? ' ltr' : ' rtl') }, h('span', { class: 'bob', text: cp(m.c) }));
        e.style.top = (Math.random() < 0.5 ? 2 + Math.random() * 14 : 74 + Math.random() * 10) + '%';
        e.style.fontSize = (22 + Math.random() * 12) + 'px';
        e.style.animationDuration = (11 + Math.random() * 8) + 's';
      } else if (m.k === 'rise') {
        e = h('span', { class: 'mover rise', text: cp(m.c) });
        e.style.left = (5 + Math.random() * 90) + '%'; e.style.fontSize = (12 + Math.random() * 16) + 'px';
        e.style.animationDuration = (6 + Math.random() * 5) + 's'; e.style.setProperty('--sway', (Math.random() * 40 - 20) + 'px');
      } else if (m.k === 'firefly') {
        e = h('i', { class: 'mover firefly' });
        e.style.left = (5 + Math.random() * 90) + '%'; e.style.top = (10 + Math.random() * 80) + '%';
        e.style.setProperty('--fx', (Math.random() * 80 - 40) + 'px'); e.style.setProperty('--fy', (Math.random() * 60 - 30) + 'px');
        e.style.animationDuration = (4 + Math.random() * 3) + 's';
      } else {
        e = h('i', { class: 'mover shoot' }); e.style.left = (20 + Math.random() * 70) + '%'; e.style.top = (3 + Math.random() * 18) + '%';
      }
      e.addEventListener('animationend', function (ev) { if (ev.target === e) e.remove(); });
      scene.appendChild(e);
    }, 1400);
    // Start music on the first tap INSIDE this screen only (a listener on #app would outlive the screen)
    scene.parentNode.addEventListener('pointerdown', function first() {
      if (!document.body.contains(scene)) { scene.parentNode && scene.parentNode.removeEventListener('pointerdown', first); return; }
      Sound.playMusic(W.song); Sound.unlockVoice();
    });
    Sound.playMusic(W.song);
    return scene;
  }

  function soundToggles() {
    var musicBtn = h('button', { class: 'soundtoggle' }), sfxBtn = h('button', { class: 'soundtoggle' });
    function paint() {
      musicBtn.innerHTML = (Sound.prefs.music ? '&#127925;' : '&#128263;') + '<span>Music<br><b>' + (Sound.prefs.music ? 'On' : 'Off') + '</b></span>';
      musicBtn.classList.toggle('off', !Sound.prefs.music);
      musicBtn.setAttribute('aria-label', Sound.prefs.music ? 'Mute music' : 'Turn music on');
      sfxBtn.innerHTML = (Sound.prefs.sfx ? '&#128266;' : '&#128263;') + '<span>Sounds<br><b>' + (Sound.prefs.sfx ? 'On' : 'Off') + '</b></span>';
      sfxBtn.classList.toggle('off', !Sound.prefs.sfx);
      sfxBtn.setAttribute('aria-label', Sound.prefs.sfx ? 'Mute sound effects and voice' : 'Turn sound effects and voice on');
    }
    musicBtn.addEventListener('click', function () { Sound.setMusic(!Sound.prefs.music); paint(); });
    sfxBtn.addEventListener('click', function () { Sound.setSfx(!Sound.prefs.sfx); paint(); });
    [musicBtn, sfxBtn].forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); });
    paint();
    return h('div', { class: 'fstoggles' }, [musicBtn, sfxBtn]);
  }

  // ---------- goal text ----------
  function goalChips(L) {
    var out = [], g = L.goals;
    if (g.jelly) out.push({ k: 'jelly', icon: '<i class="jellyicon"></i>', label: 'Clear all the jelly' });
    if (g.crates) out.push({ k: 'crates', icon: CRATE, label: 'Break all the crates' });
    if (g.nuts) out.push({ k: 'nuts', icon: NUT, label: 'Bring ' + g.nuts + ' acorns to the bottom' });
    if (g.collect) g.collect.forEach(function (x) { out.push({ k: 'c' + x[0], t: x[0], need: x[1], icon: FRUIT[x[0]], label: 'Collect ' + x[1] + ' ' + FRUIT_NAME[x[0]] }); });
    if (g.score) out.push({ k: 'score', icon: '&#11088;', label: 'Score ' + g.score.toLocaleString() + ' points' });
    return out;
  }

  // ---------- MAP ----------
  function setup(root) {
    var P = prog(), cur = Math.min(P.unlocked, E.LEVELS.length), W = WORLDS[E.LEVELS[cur - 1].world];
    buildScene(root, W);
    root.appendChild(h('div', { class: 'fxlayer' }));
    root.appendChild(UI.topbar('Fruit Swap', '#/', soundToggles()));
    var giftReady = P.gift !== today();
    root.appendChild(h('div', { class: 'maphead' }, [
      h('div', { class: 'boostcount', html: HAMMER + ' <b>' + P.boosters.hammer + '</b> &nbsp; <span class="plus5">+5</span> <b>' + P.boosters.moves + '</b>' }),
      h('button', { class: 'giftbtn' + (giftReady ? ' ready' : ''), html: GIFT + ' ' + (giftReady ? 'Daily gift!' : 'Gift tomorrow'),
        onclick: function () { if (giftReady) claimGift(); else UI.toast('Your next gift unlocks tomorrow.'); } })
    ]));
    var total = 0; Object.keys(P.stars).forEach(function (k) { total += P.stars[k]; });
    root.appendChild(h('div', { class: 'mapstars', text: '\u2605 ' + total + ' of ' + E.LEVELS.length * 3 + ' stars' }));
    var path = h('div', { class: 'mappath' });
    var lastWorld = 0, curNode = null;
    E.LEVELS.forEach(function (L, i) {
      if (L.world !== lastWorld) { lastWorld = L.world; path.appendChild(h('div', { class: 'worldtitle w' + L.world, text: 'World ' + L.world + ': ' + WORLDS[L.world].name })); }
      var locked = L.n > P.unlocked, stars = P.stars[L.n] || 0;
      var x = 50 + 30 * Math.sin(i * 0.95);
      var node = h('button', { class: 'mapnode w' + L.world + (locked ? ' locked' : '') + (L.n === cur && !P.stars[L.n] ? ' current' : '') + (stars ? ' done' : ''),
        style: 'left:' + x + '%', 'aria-label': 'Level ' + L.n + (locked ? ' locked' : ''),
        onclick: function () { if (locked) UI.toast('Beat level ' + (L.n - 1) + ' to unlock this one.'); else intro(L); } }, [
        h('span', { class: 'num', text: locked ? LOCK : String(L.n) }),
        h('span', { class: 'nstars', text: locked ? '' : ['\u2606\u2606\u2606', '\u2605\u2606\u2606', '\u2605\u2605\u2606', '\u2605\u2605\u2605'][stars] })
      ]);
      var row = h('div', { class: 'maprow' }, node);
      if (i < E.LEVELS.length - 1 && E.LEVELS[i + 1].world === L.world) {
        var nx = 50 + 30 * Math.sin((i + 1) * 0.95);
        row.appendChild(h('i', { class: 'mapdots', style: 'left:' + Math.min(x, nx) + '%;width:' + Math.abs(nx - x) + '%' }));
      }
      path.appendChild(row);
      if (L.n === cur) curNode = row;
    });
    path.appendChild(h('div', { class: 'worldtitle', text: 'More worlds coming soon!' }));
    root.appendChild(path);
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>Swap two fruits next to each other to line up 3 or more. Each level has its own goal, shown at the top. Finish it before you run out of moves. Leftover moves turn into bonus points.</p>' +
      '<h3>Power-ups</h3><ul><li><b>4 in a row:</b> striped fruit, clears a whole line.</li><li><b>L or T shape:</b> bomb fruit, blasts a 3 x 3 area.</li>' +
      '<li><b>5 in a row:</b> star. Swap it with any fruit to clear all of that kind.</li><li><b>Swap two power-ups together</b> for a giant combo.</li></ul>' +
      '<h3>Boosters</h3><p>' + HAMMER + ' Hammer smashes any one fruit or crate. <b>+5</b> gives five extra moves. Earn more with 3-star wins and the daily gift.</p>' }));
    if (curNode) setTimeout(function () { curNode.scrollIntoView({ block: 'center' }); }, 60);

    function claimGift() {
      var P2 = prog(), kind = Math.random() < 0.5 ? 'hammer' : 'moves', n = Math.random() < 0.3 ? 2 : 1;
      P2.boosters[kind] += n; P2.gift = today(); saveProg(P2);
      Sound.play('win'); UI.confetti(); Sound.say('Daily gift!');
      UI.modal({ big: GIFT, title: 'Daily gift!', text: 'You got ' + n + ' ' + (kind === 'hammer' ? 'Hammer' + (n > 1 ? 's' : '') + ' ' + HAMMER : 'extra-moves booster' + (n > 1 ? 's' : '') + ' (+5 moves)') + '. Come back tomorrow for another.',
        buttons: [{ label: 'Thanks!', cls: 'swap', fn: function () { window.dispatchEvent(new HashChangeEvent('hashchange')); } }] });
    }
  }

  function intro(L) {
    var list = h('div', { class: 'goallist' });
    goalChips(L).forEach(function (g) { list.appendChild(h('div', { class: 'goalline', html: '<span class="gi">' + g.icon + '</span>' + g.label })); });
    if (L.tip) list.appendChild(h('p', { class: 'tip', text: 'Tip: ' + L.tip }));
    UI.modal({ title: 'Level ' + L.n, text: L.moves + ' moves', body: list,
      buttons: [{ label: 'Play', cls: 'swap', fn: function () { UI.store('fs_level', L.n); location.hash = '#/swap/play'; } }, { label: 'Not now' }] });
  }

  // ---------- LEVEL ----------
  function play(root) {
    var lvl = UI.store('fs_level') || prog().unlocked, L = E.LEVELS[lvl - 1];
    if (!L) { location.hash = '#/swap'; return; }
    var W = WORLDS[L.world];
    buildScene(root, W);
    var fx = h('div', { class: 'fxlayer' }); root.appendChild(fx);
    root.appendChild(UI.topbar('Level ' + L.n, '#/swap', soundToggles()));
    var goalsEl = h('div', { class: 'fsgoals' });
    var bar = h('div', { class: 'fsbar' }), meter = h('div', { class: 'fsmeter' }, [h('i'), h('b', { class: 'm1' }), h('b', { class: 'm2' }), h('b', { class: 'm3' })]);
    var gridEl = h('div', { class: 'fsgrid' });
    var hammerBtn = h('button', { class: 'boost' }), movesBtn = h('button', { class: 'boost' });
    root.appendChild(goalsEl); root.appendChild(bar); root.appendChild(meter); root.appendChild(gridEl);
    root.appendChild(h('div', { class: 'boostbar' }, [hammerBtn, movesBtn,
      h('button', { class: 'boost', html: '&#128161;<span>Hint</span>', onclick: function () { showHint(true); } })]));

    var tiles = [], st, stats, moves, busy, sel, hintTimer, done, hammerMode, extraUsed;
    for (var i = 0; i < N * N; i++) { var t = h('div', { class: 'fstile' }); tiles.push(t); gridEl.appendChild(t); }

    function score() { return stats.points; }
    function starsFor(sc) { return sc >= L.stars[2] ? 3 : sc >= L.stars[1] ? 2 : 1; }
    function goalState() {
      var g = L.goals, out = {};
      if (g.score) out.score = Math.max(0, g.score - score());
      if (g.jelly) out.jelly = E.jellyLeft(st);
      if (g.crates) out.crates = E.cratesLeft(st);
      if (g.nuts) out.nuts = Math.max(0, g.nuts - st.nutsDone);
      if (g.collect) g.collect.forEach(function (x) { out['c' + x[0]] = Math.max(0, x[1] - (stats.collected[x[0]] || 0)); });
      return out;
    }
    function goalsMet() { var s = goalState(); return Object.keys(s).every(function (k) { return s[k] === 0; }); }

    function paintBoosters() {
      var P = prog();
      hammerBtn.innerHTML = HAMMER + '<span>Hammer</span><em>' + P.boosters.hammer + '</em>';
      hammerBtn.classList.toggle('on', !!hammerMode); hammerBtn.disabled = !P.boosters.hammer && !hammerMode;
      movesBtn.innerHTML = '<b class="plus5">+5</b><span>Moves</span><em>' + P.boosters.moves + '</em>';
      movesBtn.disabled = !P.boosters.moves;
    }
    hammerBtn.addEventListener('click', function () {
      if (busy || done) return;
      if (!hammerMode && !prog().boosters.hammer) return;
      hammerMode = !hammerMode; sel = null; paintBoosters(); render();
      if (hammerMode) UI.toast('Tap any fruit or crate to smash it');
    });
    movesBtn.addEventListener('click', function () {
      if (busy || done) return;
      var P = prog(); if (!P.boosters.moves) return;
      P.boosters.moves--; saveProg(P); moves += 5; Sound.play('special'); cheer('+5 moves!'); paintBoosters(); render();
    });

    function render(falls, pops) {
      var fallMap = {}; (falls || []).forEach(function (f) { fallMap[f.r * N + f.c] = f.d; });
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var k = r * N + c, tl = tiles[k], cell = st.cells[r][c];
        var cls = 'fstile';
        if (!st.mask[r][c]) cls += ' hole';
        if (st.jelly[r][c]) cls += ' jelly' + st.jelly[r][c];
        if (st.crate[r][c]) cls += ' crate' + (st.crate[r][c] > 1 ? ' crate2' : '');
        if (sel && sel[0] === r && sel[1] === c) cls += ' sel';
        if (cell && cell.sp) cls += ' sp-' + cell.sp;
        if (cell && cell.t === -2) cls += ' nut';
        if (hammerMode && (cell || st.crate[r][c])) cls += ' smashable';
        tl.className = cls;
        tl.textContent = st.crate[r][c] ? CRATE : cell ? (cell.t === -2 ? NUT : cell.sp === 'star' ? STAR : FRUIT[cell.t]) : '';
        if (fallMap[k]) { tl.style.setProperty('--d', fallMap[k]); tl.classList.add('fall'); void tl.offsetWidth; }
      }
      (pops || []).forEach(function (p) {
        var tl = tiles[p[0] * N + p[1]];
        if (p.was) { tl.textContent = p.was.t === -2 ? NUT : p.was.sp === 'star' ? STAR : FRUIT[p.was.t]; if (p.was.sp) tl.classList.add('sp-' + p.was.sp); }
        tl.classList.add('pop');
      });
      bar.innerHTML = '';
      bar.appendChild(h('div', null, [h('div', { class: 'bdlabel', text: 'MOVES' }), h('div', { class: 'bdval' + (moves <= 5 ? ' low' : ''), text: String(moves) })]));
      bar.appendChild(h('div', null, [h('div', { class: 'bdlabel', text: 'SCORE' }), h('div', { class: 'bdval', text: score().toLocaleString() })]));
      var top = L.stars[2];
      meter.firstChild.style.width = Math.min(100, score() / top * 100) + '%';
      meter.children[1].style.left = Math.min(97, L.stars[0] / top * 100) + '%';
      meter.children[2].style.left = (L.stars[1] / top * 100) + '%';
      meter.children[3].style.left = '97%';
      [1, 2, 3].forEach(function (n) { meter.children[n].classList.toggle('lit', score() >= L.stars[n - 1] && (n > 1 || goalsMet())); });
      goalsEl.innerHTML = '';
      var gs = goalState();
      goalChips(L).forEach(function (g) {
        var left = gs[g.k], ok = left === 0;
        goalsEl.appendChild(h('div', { class: 'goalchip' + (ok ? ' ok' : ''), html: '<span class="gi">' + g.icon + '</span><b>' + (ok ? '\u2713' : (g.k === 'score' ? left.toLocaleString() : left)) + '</b>' }));
      });
    }

    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    var POP_MS = 640, FALL_MS = 560;

    function fxText(text, cls, x, y) {
      var e = h('div', { class: cls, text: text });
      if (x !== undefined) { e.style.left = x + 'px'; e.style.top = y + 'px'; }
      e.addEventListener('animationend', function () { e.remove(); });
      fx.appendChild(e);
    }
    // Big word on screen, called out in a deep voice
    function cheer(text, speak) {
      fxText(text, 'cheer');
      Sound.say((speak || text).replace(/ x\d+$/, ''));
    }
    function tileCenter(p) { var r = tiles[p[0] * N + p[1]].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; }
    function burst(cells, pts) {
      var sx = 0, sy = 0;
      cells.forEach(function (p) {
        var cc = tileCenter(p); sx += cc[0]; sy += cc[1];
        var color = PARTICLE[p.was && p.was.t >= 0 ? p.was.t : Math.floor(Math.random() * 6)];
        for (var k = 0; k < 6; k++) {
          var d = h('i', { class: 'particle' }), ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 55;
          d.style.left = cc[0] + 'px'; d.style.top = cc[1] + 'px'; d.style.background = color;
          d.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); d.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
          var size = 5 + Math.random() * 7; d.style.width = d.style.height = size + 'px';
          d.addEventListener('animationend', function () { this.remove(); });
          fx.appendChild(d);
        }
      });
      if (cells.length && pts > 0) fxText('+' + pts.toLocaleString(), 'scorefloat', sx / cells.length, sy / cells.length);
    }
    function beams(blasts) {
      var g = gridEl.getBoundingClientRect();
      blasts.forEach(function (b) {
        var cc = tileCenter([b.r, b.c]), e;
        if (b.sp === 'row') { e = h('i', { class: 'beam h' }); e.style.left = g.left + 'px'; e.style.width = g.width + 'px'; e.style.top = cc[1] + 'px'; }
        else if (b.sp === 'col') { e = h('i', { class: 'beam v' }); e.style.top = g.top + 'px'; e.style.height = g.height + 'px'; e.style.left = cc[0] + 'px'; }
        else { e = h('i', { class: 'ring' + (b.sp === 'star' ? ' starring' : '') }); e.style.left = cc[0] + 'px'; e.style.top = cc[1] + 'px'; e.style.width = e.style.height = cc[2] * (b.sp === 'star' ? 8 : 3) + 'px'; }
        e.addEventListener('animationend', function () { e.remove(); });
        fx.appendChild(e);
      });
    }
    function shake(big) { gridEl.classList.remove('shake', 'shakebig'); void gridEl.offsetWidth; gridEl.classList.add(big ? 'shakebig' : 'shake'); }

    // Animate one explosion result, then let fruit fall and acorns drop out
    async function animate(res, combo, fast) {
      var before = res.pointsBefore, gone = res.cleared;
      render(null, gone);
      Sound.play('grow', combo);
      if (res.created.length) Sound.play('special');
      if (res.label) cheer(res.label);
      else if (combo >= 2 && !fast) { cheer(CHEERS[Math.min(combo - 2, CHEERS.length - 1)] + (combo >= 3 ? ' x' + combo : '')); Sound.play('combo', combo); }
      var popMs = fast ? POP_MS * 0.6 : POP_MS;
      await wait(popMs * 0.72);
      if (res.blasts.length) { beams(res.blasts); Sound.play('blast'); shake(res.blasts.length > 1 || res.blasts.some(function (b) { return b.sp !== 'row' && b.sp !== 'col'; })); }
      Sound.play('pop', combo); burst(gone, score() - before);
      if (!res.blasts.length && (combo >= 3 || gone.length >= 6)) shake(combo >= 4);
      await wait(popMs * 0.28);
      await settle(fast);
    }
    async function settle(fast) {
      for (var guard = 0; guard < 20; guard++) {
        render(E.gravity(st));
        setTimeout(function () { Sound.play('land'); }, FALL_MS * 0.55);
        await wait(fast ? FALL_MS * 0.7 : FALL_MS);
        var nuts = E.collectNuts(st);
        if (!nuts.length) break;
        stats.points += 1000 * nuts.length;
        render(null, nuts); Sound.play('combo', 4); cheer('Acorn home!');
        await wait(POP_MS);
      }
    }

    async function cascade(focus, combo) {
      for (var guard = 0; guard < 40; guard++) {
        stats.combo = combo;
        var before = stats.points;
        var step = E.matchStep(st, focus, stats);
        if (!step) break;
        step.pointsBefore = before;
        UI.vibrate(combo > 1 ? 20 : 10);
        await animate(step, combo);
        focus = null; combo++;
      }
    }

    async function afterTurn() {
      if (goalsMet()) { await win(); return; }
      if (moves <= 0) { busy = false; render(); outOfMoves(); return; }
      if (!E.findMove(st)) { UI.toast('No moves left. Shuffling!'); await wait(500); E.shuffle(st); render(); }
      busy = false; render(); resetHint();
    }

    async function attempt(a, b) {
      if (busy || done || !document.body.contains(gridEl)) return;
      if (!E.canSwap(st, a, b)) return;
      busy = true; clearTimeout(hintTimer); sel = null;
      stats.combo = 1; stats.label = null;
      var before = stats.points;
      var combo = E.comboSwap(st, a, b, stats);
      if (combo) {
        moves--; UI.vibrate(40); combo.pointsBefore = before; combo.label = stats.label;
        await animate(combo, 2); await cascade(null, 2);
      } else {
        E.swap(st, a, b); render(); Sound.play('swap');
        if (!E.runs(st).length) {
          Sound.play('nope');
          await wait(170); E.swap(st, a, b); render();
          [a, b].forEach(function (p) { tiles[p[0] * N + p[1]].classList.add('nope'); });
          UI.vibrate([10, 30, 10]); await wait(300); busy = false; resetHint(); return;
        }
        moves--;
        await cascade([a, b], 1);
      }
      await afterTurn();
    }

    async function smash(p) {
      var P = prog(); if (!P.boosters.hammer) { hammerMode = false; paintBoosters(); return; }
      if (!(st.cells[p[0]][p[1]] && st.cells[p[0]][p[1]].t !== -2) && !st.crate[p[0]][p[1]]) { UI.toast('Pick a fruit or a crate'); return; }
      busy = true; hammerMode = false; P.boosters.hammer--; saveProg(P); paintBoosters();
      stats.combo = 1; stats.label = null;
      var before = stats.points, res = E.explode(st, [p], null, stats); res.pointsBefore = before;
      Sound.play('blast'); shake(false);
      await animate(res, 1); await cascade(null, 2); await afterTurn();
    }

    // Gestures on the whole board (pointer capture) so swipes work in every direction
    var drag = null;
    function tileAt(x, y) {
      var rect = gridEl.getBoundingClientRect();
      var c = Math.floor((x - rect.left) / (rect.width / N)), r = Math.floor((y - rect.top) / (rect.height / N));
      return (r >= 0 && r < N && c >= 0 && c < N) ? [r, c] : null;
    }
    gridEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var p = tileAt(e.clientX, e.clientY); if (!p) return;
      drag = { p: p, x: e.clientX, y: e.clientY, id: e.pointerId };
      try { gridEl.setPointerCapture(e.pointerId); } catch (err) {}
    });
    gridEl.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id || hammerMode) return;
      e.preventDefault();
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y, cellW = gridEl.getBoundingClientRect().width / N;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > Math.min(24, cellW * 0.4)) {
        var a = drag.p, b = Math.abs(dx) > Math.abs(dy) ? [a[0], a[1] + (dx > 0 ? 1 : -1)] : [a[0] + (dy > 0 ? 1 : -1), a[1]];
        drag = null; attempt(a, b);
      }
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var p = drag.p; drag = null;
      if (e.type === 'pointercancel' || busy || done) return;
      if (hammerMode) { smash(p); return; }
      if (sel && Math.abs(sel[0] - p[0]) + Math.abs(sel[1] - p[1]) === 1) { var a = sel; sel = null; attempt(a, p); }
      else { sel = sel && sel[0] === p[0] && sel[1] === p[1] ? null : (E.playable(st, p[0], p[1]) ? p : null); render(); }
    }
    gridEl.addEventListener('pointerup', endDrag);
    gridEl.addEventListener('pointercancel', endDrag);

    function resetHint() { clearTimeout(hintTimer); hintTimer = setTimeout(function () { showHint(false); }, 7000); }
    function showHint(now) {
      if (busy || done) return;
      var m = E.findMove(st); if (!m) return;
      m.forEach(function (p) { var tl = tiles[p[0] * N + p[1]]; tl.classList.remove('hint'); void tl.offsetWidth; tl.classList.add('hint'); });
      if (now) resetHint();
    }

    function outOfMoves() {
      var gs = goalState(), parts = [];
      goalChips(L).forEach(function (g) { if (gs[g.k]) parts.push(g.k === 'score' ? gs[g.k].toLocaleString() + ' more points' : gs[g.k] + ' more ' + (g.k === 'jelly' ? 'jelly' : g.k === 'crates' ? 'crates' : g.k === 'nuts' ? 'acorns' : FRUIT_NAME[g.t])); });
      if (!extraUsed) {
        Sound.say('So close!');
        UI.modal({ big: '\uD83D\uDE2E', title: 'So close!', text: 'You still need ' + parts.join(' and ') + '. Keep going with 5 free extra moves?', dismiss: false,
          buttons: [{ label: 'Yes! +5 moves', cls: 'swap', fn: function () { extraUsed = true; moves += 5; Sound.play('special'); cheer('+5 moves!', 'Five more moves!'); render(); resetHint(); } },
            { label: 'No thanks', fn: lose }] });
      } else lose();
    }
    function lose() {
      done = true; clearTimeout(hintTimer); Sound.play('lose');
      UI.modal({ big: '\uD83C\uDF4B', title: 'Out of moves', text: 'Level ' + L.n + ' beat you this time. Every try gets you closer!', dismiss: false,
        buttons: [{ label: 'Try again', cls: 'swap', fn: start }, { label: 'Back to the map', fn: function () { location.hash = '#/swap'; } }] });
    }

    async function win() {
      done = true; clearTimeout(hintTimer); busy = true;
      Sound.play('win'); fxText('Level complete!', 'banner'); Sound.say('Level complete!');
      await wait(1400);
      // Fruit Fiesta: every leftover move becomes a striped fruit that fires for bonus points
      if (moves > 0) {
        cheer('Fruit Fiesta!'); await wait(500);
        var n = Math.min(moves, 15);
        for (var k = 0; k < n && document.body.contains(gridEl); k++) {
          var spots = [];
          for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { var x = st.cells[r][c]; if (E.playable(st, r, c) && x && x.t >= 0 && !x.sp) spots.push([r, c]); }
          if (!spots.length) break;
          var p = spots[Math.floor(Math.random() * spots.length)];
          st.cells[p[0]][p[1]].sp = Math.random() < 0.5 ? 'row' : 'col';
          moves--; stats.points += 300; stats.combo = 1;
          var before = stats.points, res = E.explode(st, [p], null, stats); res.pointsBefore = before;
          await animate(res, 1, true);
        }
        stats.points += Math.max(0, moves) * 300; moves = 0;
        await cascade(null, 2);
        render();
      }
      var P = prog(), stars = starsFor(score()), reward = '';
      var firstWin = !P.stars[L.n];
      P.stars[L.n] = Math.max(P.stars[L.n] || 0, stars);
      P.best[L.n] = Math.max(P.best[L.n] || 0, score());
      if (L.n >= P.unlocked && L.n < E.LEVELS.length) P.unlocked = L.n + 1;
      if (stars === 3 || (firstWin && L.n % 4 === 0)) {
        var kind = Math.random() < 0.5 ? 'hammer' : 'moves'; P.boosters[kind]++;
        reward = 'Reward: +1 ' + (kind === 'hammer' ? 'Hammer ' + HAMMER : '+5 Moves booster');
      }
      saveProg(P);
      UI.confetti();
      var last = L.n === E.LEVELS.length;
      UI.modal({ big: '\u2B50'.repeat(stars) + '\u2606'.repeat(3 - stars), title: last ? 'You beat every level!' : 'Level ' + L.n + ' complete!',
        text: 'Score ' + score().toLocaleString() + '.' + (stars < 3 ? ' Get ' + L.stars[stars].toLocaleString() + ' for ' + (stars + 1) + ' stars.' : ' Perfect!') + (reward ? ' ' + reward + '.' : ''),
        dismiss: false,
        buttons: last ? [{ label: 'Back to the map', cls: 'swap', fn: function () { location.hash = '#/swap'; } }, { label: 'Replay', fn: start }]
          : [{ label: 'Next level \u2192', cls: 'swap', fn: function () { UI.store('fs_level', L.n + 1); window.dispatchEvent(new HashChangeEvent('hashchange')); } },
            { label: 'Replay', fn: start }, { label: 'Map', fn: function () { location.hash = '#/swap'; } }] });
    }

    function start() {
      UI.closeModal();
      st = E.create(L); stats = { points: 0, collected: {}, cratesBroken: 0, combo: 1 };
      moves = L.moves; busy = false; sel = null; done = false; hammerMode = false; extraUsed = false;
      var all = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) all.push({ r: r, c: c, d: N });
      paintBoosters(); render(all); resetHint();
      fxText('Level ' + L.n, 'banner');
    }
    start();
  }

  return { setup: setup, play: play, soundToggles: soundToggles };
})();
