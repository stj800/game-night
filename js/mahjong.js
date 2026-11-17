/* Mahjong Solitaire: match pairs of free tiles until the board is clear. */
var Mahjong = (function () {
  var h = (typeof UI !== 'undefined') ? UI.h : null;
  function cp(c) { return String.fromCodePoint(c); }

  // ---------- Tiles ----------
  var NUM = ['\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D', '\u4E03', '\u516B', '\u4E5D']; // 1-9 in Chinese
  var WAN = '\u842C';
  var WINDS = [['\u6771', 'East'], ['\u5357', 'South'], ['\u897F', 'West'], ['\u5317', 'North']];
  var FLOWERS = [[0x1F338, 'Plum blossom'], [0x1F33A, 'Orchid'], [0x1F33C, 'Chrysanthemum'], [0x1F38B, 'Bamboo flower']];
  var SEASONS = [[0x1F331, 'Spring'], [0x2600, 'Summer'], [0x1F341, 'Autumn'], [0x2744, 'Winter']];
  // Each kind: id, match group, label
  var KINDS = [];
  ['dot', 'bam', 'chr'].forEach(function (suit) { for (var n = 1; n <= 9; n++) KINDS.push({ id: suit + n, suit: suit, n: n }); });
  WINDS.forEach(function (w, i) { KINDS.push({ id: 'wind' + i, suit: 'wind', n: i }); });
  ['red', 'green', 'white'].forEach(function (d) { KINDS.push({ id: 'drg' + d, suit: 'drg', n: d }); });
  var SUIT_NAME = { dot: 'Dots', bam: 'Bamboo', chr: 'Characters', wind: 'Winds', drg: 'Dragons', flw: 'Flowers', sea: 'Seasons' };

  // Pip patterns on a 3 x 3 grid for dots and bamboo
  var PIPS = {
    1: [[1, 1]], 2: [[1, 0], [1, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
    7: [[0, 0], [1, 0], [2, 0], [0, 1.5], [2, 1.5], [0, 2.5], [2, 2.5]], 8: [[0, 0], [2, 0], [0, 0.85], [2, 0.85], [0, 1.7], [2, 1.7], [0, 2.55], [2, 2.55]],
    9: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]
  };
  var DOT_COLORS = ['#1f6fd6', '#18a558', '#e0283f'];

  function faceHTML(f) {
    if (f.suit === 'dot' || f.suit === 'bam') {
      var pts = PIPS[f.n], svg = '<svg viewBox="0 0 60 80" class="pips">';
      if (f.suit === 'bam' && f.n === 1) return '<span class="glyph bird">' + cp(0x1F99A) + '</span>';
      if (f.suit === 'dot' && f.n === 1) return svg + '<circle cx="30" cy="40" r="20" fill="#e0283f"/><circle cx="30" cy="40" r="13" fill="#fff"/><circle cx="30" cy="40" r="8" fill="#1f6fd6"/></svg>';
      pts.forEach(function (p, k) {
        var x = 12 + p[0] * 18, y = 12 + p[1] * 26 / (f.n >= 7 ? 1.18 : 1);
        if (f.suit === 'dot') svg += '<circle cx="' + x + '" cy="' + y + '" r="8" fill="' + DOT_COLORS[(k + f.n) % 3] + '"/><circle cx="' + x + '" cy="' + y + '" r="3" fill="#fff"/>';
        else svg += '<rect x="' + (x - 4) + '" y="' + (y - 10) + '" width="8" height="20" rx="4" fill="' + ((f.n === 5 || f.n === 9) && k === 4 || (f.n === 7 && k === 0) ? '#e0283f' : '#18a558') + '"/><rect x="' + (x - 5) + '" y="' + (y - 1) + '" width="10" height="2" fill="#0d6b37"/>';
      });
      return svg + '</svg>';
    }
    if (f.suit === 'chr') return '<span class="chr"><b>' + NUM[f.n - 1] + '</b><i>' + WAN + '</i></span>';
    if (f.suit === 'wind') return '<span class="glyph wind">' + WINDS[f.n][0] + '</span>';
    if (f.suit === 'drg') {
      if (f.n === 'red') return '<span class="glyph drg red">\u4E2D</span>';
      if (f.n === 'green') return '<span class="glyph drg green">\u767C</span>';
      return '<span class="whitedragon"></span>';
    }
    if (f.suit === 'flw') return '<span class="glyph emoji">' + cp(FLOWERS[f.n][0]) + '</span><small class="corner">' + (f.n + 1) + '</small>';
    return '<span class="glyph emoji">' + cp(SEASONS[f.n][0]) + String.fromCharCode(0xFE0F) + '</span><small class="corner">' + (f.n + 1) + '</small>';
  }
  function faceName(f) {
    if (f.suit === 'dot' || f.suit === 'bam' || f.suit === 'chr') return f.n + ' of ' + SUIT_NAME[f.suit];
    if (f.suit === 'wind') return WINDS[f.n][1] + ' Wind';
    if (f.suit === 'drg') return (f.n === 'red' ? 'Red' : f.n === 'green' ? 'Green' : 'White') + ' Dragon';
    if (f.suit === 'flw') return FLOWERS[f.n][1] + ' (any flower matches)';
    return SEASONS[f.n][1] + ' (any season matches)';
  }

  // ---------- Layouts (tile units; layers stack upward) ----------
  function rect(z, x0, y0, w, hgt) { var out = []; for (var y = 0; y < hgt; y++) for (var x = 0; x < w; x++) out.push({ x: (x0 + x) * 2, y: (y0 + y) * 2, z: z }); return out; }
  var LAYOUTS = [
    { value: 1, label: 'Beginner', name: 'Little Pagoda', note: '36 tiles, 3 layers. Free tiles glow so you can spot them.', cols: 6, rows: 4,
      pos: [].concat(rect(0, 0, 0, 6, 4), rect(1, 1, 1, 4, 2), rect(2, 2, 1, 2, 2)) },
    { value: 2, label: 'Intermediate', name: 'Butterfly', note: '72 tiles, 4 layers. A relaxing middle ground.', cols: 8, rows: 5,
      pos: [].concat(rect(0, 0, 0, 8, 5), rect(1, 1, 1, 6, 3), rect(2, 2, 1, 4, 3), rect(3, 3, 2, 2, 1)) },
    { value: 3, label: 'Advanced', name: 'Grand Turtle', note: '108 tiles, 4 layers. Plan ahead or get stuck.', cols: 10, rows: 6,
      pos: [].concat(rect(0, 0, 0, 10, 6), rect(1, 1, 1, 8, 4), rect(2, 2, 2, 6, 2), rect(3, 4, 2, 2, 2)) }
  ];

  // ---------- Rules ----------
  function isFree(t, live) {
    var left = false, right = false;
    for (var i = 0; i < live.length; i++) {
      var o = live[i]; if (o === t) continue;
      if (o.z === t.z + 1 && Math.abs(o.x - t.x) < 2 && Math.abs(o.y - t.y) < 2) return false;
      if (o.z === t.z && Math.abs(o.y - t.y) < 2) { if (o.x === t.x - 2) left = true; if (o.x === t.x + 2) right = true; }
    }
    return !(left && right);
  }
  function freeTiles(tiles) { var live = tiles.filter(function (t) { return !t.gone; }); return live.filter(function (t) { return isFree(t, live); }); }
  function matches(a, b) { return a !== b && a.match === b.match; }
  function availablePairs(tiles) {
    var fr = freeTiles(tiles), out = [];
    for (var i = 0; i < fr.length; i++) for (var j = i + 1; j < fr.length; j++) if (matches(fr[i], fr[j])) out.push([fr[i], fr[j]]);
    return out;
  }

  function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // Pairs of faces for n tiles. Flowers match any flower; seasons match any season.
  function pairFaces(nPairs) {
    var pool = [];
    shuffled(KINDS).forEach(function (k) { pool.push([{ suit: k.suit, n: k.n, match: k.id }, { suit: k.suit, n: k.n, match: k.id }]); });
    var fl = shuffled([0, 1, 2, 3]), se = shuffled([0, 1, 2, 3]);
    pool.push([{ suit: 'flw', n: fl[0], match: 'flw' }, { suit: 'flw', n: fl[1], match: 'flw' }]);
    pool.push([{ suit: 'sea', n: se[0], match: 'sea' }, { suit: 'sea', n: se[1], match: 'sea' }]);
    pool = shuffled(pool);
    var out = [];
    for (var i = 0; out.length < nPairs; i++) out.push(pool[i % pool.length].map(function (f) { return { suit: f.suit, n: f.n, match: f.match }; }));
    return out;
  }

  // Deal so the board can always be solved: remove pairs of free tiles from the full
  // layout one at a time, giving each removed pair matching faces.
  function deal(positions, faces) {
    for (var attempt = 0; attempt < 400; attempt++) {
      var live = positions.map(function (p) { return { x: p.x, y: p.y, z: p.z }; });
      var all = live.slice(), ok = true, fs = shuffled(faces);
      for (var k = 0; k < fs.length; k++) {
        var fr = live.filter(function (t) { return isFree(t, live); });
        if (fr.length < 2) { ok = false; break; }
        var a = fr.splice(Math.floor(Math.random() * fr.length), 1)[0];
        live.splice(live.indexOf(a), 1);
        fr = live.filter(function (t) { return isFree(t, live); });
        if (!fr.length) { ok = false; break; }
        var b = fr[Math.floor(Math.random() * fr.length)];
        live.splice(live.indexOf(b), 1);
        a.face = fs[k][0]; b.face = fs[k][1];
      }
      if (ok) return all.map(function (t, i) { return { id: i, x: t.x, y: t.y, z: t.z, face: t.face, match: t.face.match }; });
    }
    return null;
  }
  function newGame(layout) { return deal(layout.pos, pairFaces(layout.pos.length / 2)); }

  // Reshuffle the tiles still on the board (still guaranteed solvable)
  function reshuffle(tiles) {
    var live = tiles.filter(function (t) { return !t.gone; });
    var groups = {};
    live.forEach(function (t) { (groups[t.match] = groups[t.match] || []).push(t.face); });
    var faces = [];
    Object.keys(groups).forEach(function (k) { var g = groups[k]; for (var i = 0; i + 1 < g.length; i += 2) faces.push([g[i], g[i + 1]]); });
    var dealt = deal(live, faces);
    if (!dealt) return false;
    dealt.forEach(function (d, i) { live[i].face = d.face; live[i].match = d.match; });
    // deal() returns tiles in the same order as the positions passed in
    return true;
  }

  // ---------- Board rendering ----------
  function board(el, tiles, opts) {
    el.innerHTML = '';
    var maxX = 0, maxY = 0, maxZ = 0;
    tiles.forEach(function (t) { maxX = Math.max(maxX, t.x + 2); maxY = Math.max(maxY, t.y + 2); maxZ = Math.max(maxZ, t.z); });
    var width = el.clientWidth || 340;
    var depth = Math.max(3, Math.round(width / 90));
    var tw = Math.floor((width - depth * (maxZ + 1) - 4) / (maxX / 2));
    var th = Math.round(tw * 1.32);
    el.style.height = (th * maxY / 2 + depth * (maxZ + 1) + 8) + 'px';
    el.style.setProperty('--tw', tw + 'px'); el.style.setProperty('--th', th + 'px'); el.style.setProperty('--depth', depth + 'px');
    var live = tiles.filter(function (t) { return !t.gone; });
    tiles.forEach(function (t) {
      if (t.gone) return;
      var free = isFree(t, live);
      var d = h('div', { class: 'mjtile' + (free ? ' free' : ' blocked') + (opts.glow && free ? ' glow' : '') + (opts.sel === t ? ' sel' : '') + (opts.hint && opts.hint.indexOf(t) >= 0 ? ' hint' : ''),
        html: '<div class="face">' + faceHTML(t.face) + '</div>' });
      d.style.left = (t.x / 2 * tw + (maxZ - t.z) * 0 + t.z * -depth + depth * maxZ + 2) + 'px';
      d.style.top = (t.y / 2 * th - t.z * depth + depth * maxZ + 2) + 'px';
      d.style.zIndex = t.z * 1000 + t.y * 20 + t.x;
      d.addEventListener('click', function () { opts.onTap(t, free, d); });
      t.el = d;
      el.appendChild(d);
    });
  }

  // ---------- Garden scene ----------
  function scene(root) {
    var sc = h('div', { class: 'fsscene theme-garden' });
    sc.appendChild(h('span', { class: 'gmoon' }));
    sc.appendChild(h('span', { class: 'gmount m1' })); sc.appendChild(h('span', { class: 'gmount m2' }));
    sc.appendChild(h('span', { class: 'gpond' }));
    [[6, 0x1F3EE], [80, 0x1F3EE], [44, 0x1F3EE]].forEach(function (l, k) { var e = h('span', { class: 'lantern', text: cp(l[1]) }); e.style.left = l[0] + '%'; e.style.animationDelay = (-k * 0.7) + 's'; sc.appendChild(e); });
    [0x1F338, 0x1F338, 0x1F33F, 0x1F338, 0x1FAB7, 0x1F338].forEach(function (c, k) { var e = h('span', { class: 'groundflower', text: cp(c) }); e.style.left = (4 + k * 17) + '%'; e.style.bottom = (1 + (k % 2) * 3) + '%'; sc.appendChild(e); });
    sc.appendChild(h('span', { class: 'decor gtree', text: cp(0x1F338) }));
    root.appendChild(sc);
    var timer = setInterval(function () {
      if (!document.body.contains(sc)) { clearInterval(timer); return; }
      if (document.hidden || sc.querySelectorAll('.petal').length > 9) return;
      var p = h('span', { class: 'mover petal', text: cp(Math.random() < 0.8 ? 0x1F338 : 0x1F343) });
      p.style.left = (Math.random() * 100) + '%'; p.style.fontSize = (12 + Math.random() * 12) + 'px';
      p.style.animationDuration = (8 + Math.random() * 6) + 's'; p.style.setProperty('--sway', (Math.random() * 120 - 60) + 'px');
      p.addEventListener('animationend', function () { p.remove(); });
      sc.appendChild(p);
      if (Math.random() < 0.15) { var k = h('span', { class: 'mover koi', text: cp(0x1F41F) }); k.addEventListener('animationend', function () { k.remove(); }); sc.appendChild(k); }
    }, 900);
    // Music belongs to this screen only
    Sound.playMusic('zen', sc);
    root.addEventListener('pointerdown', function first() {
      if (!document.body.contains(sc)) { root.removeEventListener('pointerdown', first); return; }
      Sound.playMusic('zen', sc);
    });
    return sc;
  }

  function fmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }

  // ---------- Screens ----------
  function setup(root) {
    scene(root);
    var cfg = UI.store('mj_cfg') || { level: 1 }, bests = UI.store('mj_best') || {};
    root.appendChild(UI.topbar('Mahjong', '#/', Swap.soundToggles()));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { var L = LAYOUTS[cfg.level - 1]; noteEl.textContent = L.name + ': ' + L.note + (bests[cfg.level] ? ' Best time ' + fmt(bests[cfg.level]) + '.' : ''); }
    root.appendChild(h('div', { class: 'panel glass' }, [h('h3', { text: 'Board' }), UI.seg(LAYOUTS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn mahjong', text: 'Play', onclick: function () { UI.store('mj_cfg', cfg); UI.store('mj_game', null); location.hash = '#/mahjong/play'; } }));
    var saved = UI.store('mj_game');
    if (saved && saved.tiles) root.appendChild(h('button', { class: 'ghostbtn glass', text: 'Continue your game (' + saved.tiles.filter(function (t) { return !t.gone; }).length + ' tiles left)', onclick: function () { location.hash = '#/mahjong/play'; } }));
    root.appendChild(h('button', { class: 'ghostbtn glass', text: '\uD83C\uDF93 Learn to play (2 minutes)', onclick: function () { location.hash = '#/mahjong/learn'; } }));
    if (!UI.store('mj_learned')) root.appendChild(h('p', { class: 'installtip', text: 'New to Mahjong? Start with Learn to play. It is easy, promise.' }));
  }

  function play(root) {
    scene(root);
    var cfg = UI.store('mj_cfg') || { level: 1 }, L = LAYOUTS[cfg.level - 1];
    root.appendChild(UI.topbar('Mahjong', '#/mahjong', Swap.soundToggles()));
    var bar = h('div', { class: 'sbar mjbar' }), boardEl = h('div', { class: 'mjboard' }), fx = h('div', { class: 'fxlayer' });
    root.appendChild(fx); root.appendChild(bar); root.appendChild(boardEl);
    var tiles, sel = null, hint = null, undo = [], time = 0, done = false, pairsMade = 0, lastMatchAt = 0, combo = 0;
    var saved = UI.store('mj_game');
    if (saved && saved.tiles && saved.level === cfg.level) { tiles = saved.tiles; time = saved.time || 0; pairsMade = saved.pairs || 0; }
    else { tiles = newGame(L); }
    root.appendChild(h('div', { class: 'toolbar' }, [
      UI.tbtn('&#8630;', 'Undo', function () {
        var u = undo.pop(); if (!u) return;
        u.forEach(function (t) { t.gone = false; }); pairsMade--; sel = null; hint = null; save(); draw();
      }),
      UI.tbtn('&#128161;', 'Hint', function () {
        var ps = availablePairs(tiles); if (!ps.length) { stuck(); return; }
        hint = ps[Math.floor(Math.random() * ps.length)]; sel = null; draw();
      }),
      UI.tbtn('&#128256;', 'Shuffle', function () { if (reshuffle(tiles)) { sel = null; hint = null; undo = []; Sound.play('swap'); save(); draw(); UI.toast('Tiles shuffled'); } }),
      UI.tbtn('&#127891;', 'How to', function () { location.hash = '#/mahjong/learn'; })]));

    var timer = setInterval(function () {
      if (!document.body.contains(boardEl)) { clearInterval(timer); return; }
      if (done || document.hidden) return; time++; drawBar(); if (time % 5 === 0) save();
    }, 1000);
    function save() { UI.store('mj_game', { level: cfg.level, tiles: tiles.map(function (t) { return { id: t.id, x: t.x, y: t.y, z: t.z, face: t.face, match: t.match, gone: !!t.gone }; }), time: time, pairs: pairsMade }); }
    function drawBar() {
      var left = tiles.filter(function (t) { return !t.gone; }).length, avail = availablePairs(tiles).length;
      bar.innerHTML = '';
      bar.appendChild(h('span', { text: 'Tiles left: ' + left }));
      bar.appendChild(h('span', { class: avail ? '' : 'warn', text: 'Matches: ' + avail }));
      bar.appendChild(h('span', { text: '\u23F1 ' + fmt(time) }));
    }
    function draw() { board(boardEl, tiles, { sel: sel, hint: hint, glow: cfg.level === 1, onTap: tap }); drawBar(); }

    function tap(t, free, el) {
      if (done) return;
      if (!free) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); Sound.play('nope'); UI.toast('That tile is blocked. Pick a glowing (free) tile.'); return; }
      if (!sel || sel === t) { sel = sel === t ? null : t; hint = null; Sound.play('land'); draw(); return; }
      if (matches(sel, t)) {
        var a = sel, b = t; sel = null; hint = null;
        var now = Date.now(); combo = now - lastMatchAt < 4000 ? combo + 1 : 1; lastMatchAt = now;
        [a, b].forEach(function (x) { if (x.el) x.el.classList.add('vanish'); });
        burst([a.el, b.el]);
        Sound.play('pop', combo); if (combo >= 3) { Sound.play('combo', combo); fxText('Combo x' + combo + '!', 'cheer'); }
        setTimeout(function () {
          a.gone = b.gone = true; undo.push([a, b]); pairsMade++; save(); draw();
          if (!tiles.some(function (x) { return !x.gone; })) win();
          else if (!availablePairs(tiles).length) stuck();
        }, 420);
      } else { sel = t; Sound.play('land'); draw(); }
    }
    function fxText(text, cls) { var e = h('div', { class: cls, text: text }); e.addEventListener('animationend', function () { e.remove(); }); fx.appendChild(e); }
    function burst(els) {
      els.forEach(function (el) {
        if (!el) return; var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        for (var k = 0; k < 8; k++) {
          var d = h('i', { class: 'particle' }), ang = Math.random() * Math.PI * 2, dist = 25 + Math.random() * 45;
          d.style.left = cx + 'px'; d.style.top = cy + 'px'; d.style.background = ['#ffcf3f', '#ff6f91', '#3ee08f', '#9be7ff'][k % 4];
          d.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); d.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
          d.style.width = d.style.height = (4 + Math.random() * 6) + 'px';
          d.addEventListener('animationend', function () { this.remove(); });
          fx.appendChild(d);
        }
      });
    }
    function stuck() {
      UI.modal({ big: '\uD83E\uDD14', title: 'No more matches', text: 'There are no free pairs left. Shuffle the tiles that are still on the board and keep going?',
        buttons: [{ label: 'Shuffle', cls: 'mahjong', fn: function () { reshuffle(tiles); sel = null; hint = null; save(); draw(); } }, { label: 'Undo last move', fn: function () { var u = undo.pop(); if (u) { u.forEach(function (x) { x.gone = false; }); save(); draw(); } } }] });
    }
    function win() {
      done = true; UI.store('mj_game', null);
      var bests = UI.store('mj_best') || {}, isBest = !bests[cfg.level] || time < bests[cfg.level];
      if (isBest) { bests[cfg.level] = time; UI.store('mj_best', bests); }
      UI.confetti(); Sound.play('win');
      UI.modal({ big: '\uD83C\uDFEE', title: 'Board cleared!', text: L.name + ' solved in ' + fmt(time) + '.' + (isBest ? ' New best time!' : ''),
        buttons: [{ label: 'Play again', cls: 'mahjong', fn: function () { location.hash = '#/mahjong'; } }, { label: 'Admire it' }] });
    }
    draw();
    window.addEventListener('resize', function rs() { if (!document.body.contains(boardEl)) { window.removeEventListener('resize', rs); return; } draw(); });
    if (!availablePairs(tiles).length) stuck();
  }

  // ---------- Learn to play ----------
  function learn(root) {
    scene(root);
    root.appendChild(UI.topbar('Learn Mahjong', '#/mahjong', Swap.soundToggles()));
    var steps = [
      { t: 'The goal', p: 'Mahjong Solitaire is a matching game for one player. The tiles are stacked in a pile. Clear the whole pile by removing matching pairs, two tiles at a time.' },
      { t: 'Free tiles', p: 'You can only pick a FREE tile. A tile is free when nothing is sitting on top of it, and its left side OR its right side is open. Free tiles glow in the Beginner board. Tiles in the middle of a row are stuck until you clear a side.' },
      { t: 'Making a match', p: 'Tap a free tile, then tap a free tile that matches it. They vanish. Identical tiles match. The only exceptions: any Flower matches any Flower, and any Season matches any Season.' },
      { t: 'Try it!', p: 'Clear this little practice pile. Start with the tile on top. Then work in from the open ends.', practice: true },
      { t: 'Winning tips', p: '1. Clear tiles on top of tall stacks first. 2. Open up long rows from the ends. 3. If all four of a tile are free, match them all. 4. If you get stuck, use Hint, Undo or Shuffle. There is no timer pressure, so relax.' }
    ];
    var cur = 0, card = h('div', { class: 'lessontext glass' }), area = h('div', { class: 'mjboard practice' }), nav = h('div', { class: 'lessonbtns' });
    root.appendChild(card); root.appendChild(area); root.appendChild(nav);
    var guide = h('div', { class: 'rules glass mjguide' });
    root.appendChild(guide);
    function showStep() {
      var s = steps[cur];
      card.innerHTML = '';
      card.appendChild(h('h3', { text: (cur + 1) + '. ' + s.t }));
      card.appendChild(h('div', { text: s.p }));
      area.innerHTML = ''; area.style.height = '';
      if (cur === 1 || cur === 2) demo(cur);
      if (s.practice) practice();
      nav.innerHTML = '';
      nav.appendChild(h('button', { text: 'Back', onclick: function () { if (cur > 0) { cur--; showStep(); } else location.hash = '#/mahjong'; } }));
      nav.appendChild(h('button', { text: 'Step ' + (cur + 1) + ' of ' + steps.length, disabled: true }));
      nav.appendChild(h('button', { class: 'primary', text: cur === steps.length - 1 ? 'Play!' : 'Next', onclick: function () {
        if (cur === steps.length - 1) { UI.store('mj_learned', true); location.hash = '#/mahjong'; } else { cur++; showStep(); }
      } }));
    }
    function demo(which) {
      var t = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }].map(function (p, i) {
        var f = which === 2 ? [{ suit: 'dot', n: 3 }, { suit: 'chr', n: 5 }, { suit: 'bam', n: 2 }, { suit: 'dot', n: 3 }, { suit: 'flw', n: 1 }][i] : { suit: 'drg', n: 'red' };
        return { id: i, x: p.x, y: p.y, z: p.z, face: f, match: f.suit + f.n };
      });
      board(area, t, { glow: true, onTap: function (tile, free) { UI.toast(free ? 'Free: ' + faceName(tile.face) : 'Blocked: something is on top or both sides are closed'); } });
    }
    function practice() {
      var faces = [{ suit: 'dot', n: 5 }, { suit: 'drg', n: 'green' }, { suit: 'chr', n: 3 }, { suit: 'bam', n: 7 }];
      var pos = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 4, y: 2, z: 0 }, { x: 6, y: 2, z: 0 }];
      // Mirrored rows (A B B A / C D D C): every match you can see is a right move, so a beginner can never get stuck
      var order = [0, 1, 1, 0, 2, 3, 3, 2];
      var tiles = pos.map(function (p, i) { var f = faces[order[i]]; return { id: i, x: p.x, y: p.y, z: p.z, face: { suit: f.suit, n: f.n }, match: f.suit + f.n }; }), sel = null;
      function draw() { board(area, tiles, { glow: true, sel: sel, onTap: tap }); }
      function tap(t, free) {
        if (!free) { UI.toast('Blocked. Pick a glowing tile.'); return; }
        if (!sel || sel === t) { sel = sel === t ? null : t; draw(); return; }
        if (matches(sel, t)) {
          sel.gone = t.gone = true; sel = null; Sound.play('pop', 1); draw();
          if (!tiles.some(function (x) { return !x.gone; })) { UI.confetti(); Sound.play('win'); UI.toast('You did it! Tap Next.'); }
        } else { sel = t; UI.toast('Those do not match. Find the twin of this one.'); draw(); }
      }
      draw();
    }
    // Tile guide
    var html = '<h3>Tile guide</h3><p>There are 7 kinds of tiles. Numbers go from 1 to 9.</p>';
    var groups = [
      ['Dots (circles)', [1, 2, 5, 9].map(function (n) { return { suit: 'dot', n: n }; })],
      ['Bamboo (sticks). The 1 is a bird', [1, 3, 6, 8].map(function (n) { return { suit: 'bam', n: n }; })],
      ['Characters (the red sign means 10,000; the black number on top is 1-9)', [1, 4, 7, 9].map(function (n) { return { suit: 'chr', n: n }; })],
      ['Winds: East, South, West, North', [0, 1, 2, 3].map(function (n) { return { suit: 'wind', n: n }; })],
      ['Dragons: Red, Green, White', ['red', 'green', 'white'].map(function (n) { return { suit: 'drg', n: n }; })],
      ['Flowers (any two match)', [0, 1, 2, 3].map(function (n) { return { suit: 'flw', n: n }; })],
      ['Seasons (any two match)', [0, 1, 2, 3].map(function (n) { return { suit: 'sea', n: n }; })]
    ];
    groups.forEach(function (g) {
      html += '<div class="guiderow"><b>' + g[0] + '</b><div class="guidetiles">' + g[1].map(function (f) { return '<div class="mjtile mini free"><div class="face">' + faceHTML(f) + '</div></div>'; }).join('') + '</div></div>';
    });
    guide.innerHTML = html;
    showStep();
  }

  return { setup: setup, play: play, learn: learn, _deal: deal, _newGame: newGame, _LAYOUTS: LAYOUTS, _available: availablePairs, _free: freeTiles, _reshuffle: reshuffle };
})();
if (typeof module !== 'undefined') module.exports = Mahjong;
