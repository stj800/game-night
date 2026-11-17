/* Fruit Swap: level map + level screens (rules live in swap-engine.js) */
var Swap = (function () {
  var h = UI.h, E = SwapEngine, N = E.N;
  function cp(c) { return String.fromCodePoint(c); }
  var FRUIT = [0x1F353, 0x1F34C, 0x1F347, 0x1F34A, 0x1F349, 0x1F34F].map(cp);
  var FRUIT_NAME = ['strawberries', 'bananas', 'grapes', 'oranges', 'watermelons', 'apples'];
  var COIN = cp(0x1FA99), BOMB = cp(0x1F4A3), SHOP = cp(0x1F6D2);
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
    if (p.coins === undefined) p.coins = 150;
    p.pre = p.pre || { bomb: 0, stripe: 0, star: 0 }; p.perks = p.perks || {};

    return p;
  }
  function saveProg(p) { UI.store('fs_prog', p); }
  // Shop catalog (pretend coins earned by playing; no real money anywhere)
  var SHOP_ITEMS = [
    { id: 'hammer', icon: HAMMER, name: 'Hammer', desc: 'Smash any one fruit or crate.', price: 40, kind: 'boosters' },
    { id: 'moves', icon: '<b class="plus5">+5</b>', name: '+5 Moves', desc: 'Five extra moves, any time.', price: 50, kind: 'boosters' },
    { id: 'stripe', icon: '<span class="stripeicon">' + cp(0x1F353) + '</span>', name: 'Striped start', desc: 'Start a level with 2 striped fruits.', price: 45, kind: 'pre' },
    { id: 'bomb', icon: BOMB, name: 'Bomb start', desc: 'Start a level with 2 bomb fruits.', price: 60, kind: 'pre' },
    { id: 'star', icon: STAR, name: 'Star start', desc: 'Start a level with a star on the board.', price: 90, kind: 'pre' }
  ];
  var PERKS = { 8: { id: 'moves2', name: 'Green Thumb', desc: '+2 moves on every level, forever' }, 16: { id: 'stripe1', name: 'Lucky Seeds', desc: 'every level starts with a striped fruit, forever' } };

  function shop(onDone) {
    var P = prog(), list = h('div', { class: 'shoplist' });
    list.appendChild(h('div', { class: 'shopcoins', html: 'You have ' + COIN + ' <b>' + P.coins + '</b> coins' }));
    SHOP_ITEMS.forEach(function (it) {
      var owned = it.kind === 'pre' ? P.pre[it.id] : P.boosters[it.id];
      var can = P.coins >= it.price;
      list.appendChild(h('div', { class: 'shopitem' }, [
        h('div', { class: 'si', html: it.icon }),
        h('div', { class: 'sd', html: '<b>' + it.name + '</b><small>' + it.desc + ' You have ' + owned + '.</small>' }),
        h('button', { class: 'buy' + (can ? '' : ' cant'), html: COIN + ' ' + it.price, onclick: function () {
          var P2 = prog();
          if (P2.coins < it.price) { UI.toast('Not enough coins yet. Win levels to earn more!'); return; }
          P2.coins -= it.price; if (it.kind === 'pre') P2.pre[it.id]++; else P2.boosters[it.id]++;
          saveProg(P2); Sound.play('special'); UI.toast('Bought: ' + it.name); shop(onDone);
        } })
      ]));
    });
    var perks = Object.keys(PERKS).filter(function (k) { return P.perks[PERKS[k].id]; });
    if (perks.length) list.appendChild(h('div', { class: 'perklist', html: '<b>Your upgrades</b><br>' + perks.map(function (k) { return '\u2714 ' + PERKS[k].name + ': ' + PERKS[k].desc; }).join('<br>') }));
    UI.modal({ big: SHOP, title: 'Fruit Shop', body: list, buttons: [{ label: 'Done', cls: 'swap', fn: onDone }] });
  }

  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  // ---------- shared scene (themed living background) ----------
  // Living background. stage = level number inside the world (0-7): the world fills with more life as you go.
  function buildScene(root, W, stage, boss) {
    stage = stage || 0;
    var scene = h('div', { class: 'fsscene theme-' + W.key + ' stage' + stage + (boss ? ' bossstage' : '') });
    function add(cls, text, css) { var e = h('span', { class: cls, text: text || '' }); if (css) e.setAttribute('style', css); scene.appendChild(e); return e; }
    if (W.key === 'orchard') {
      add('sun'); add('sunrays');
      if (stage >= 1) add('rainbow');
      add('hill hb'); add('hill hm'); add('hill hf');
      add('decor cloud c1', cp(0x2601)); add('decor cloud c2', cp(0x2601)); if (stage >= 2) add('decor cloud c3', cp(0x2601));
      add('decor tree t1', cp(0x1F333)); add('decor tree t2', cp(0x1F333));
      if (stage >= 3) { add('decor apple a1', cp(0x1F34E)); add('decor apple a2', cp(0x1F34E)); add('decor apple a3', cp(0x1F350)); }
      if (stage >= 5) { add('decor house', cp(0x1F3E1)); add('decor sheep s1', cp(0x1F411)); add('decor sheep s2', cp(0x1F411)); }
      if (stage >= 6) add('decor bigballoon', cp(0x1F388));
      var flowers = [0x1F33C, 0x1F337, 0x1F338, 0x1F33B, 0x1F33A, 0x1F490];
      var count = 8 + stage * 2;
      for (var k = 0; k < count; k++) {
        var fl = add('groundflower', cp(flowers[k % flowers.length]));
        fl.style.left = (2 + (k * 97 / count) + Math.random() * 3) + '%'; fl.style.bottom = (Math.random() * 7) + '%';
        fl.style.fontSize = (22 + Math.random() * 12) + 'px'; fl.style.animationDelay = (Math.random() * 2) + 's';
      }
    } else if (W.key === 'tropical') {
      add('sun tropsun', '', 'top:' + (8 + stage * 4) + '%'); add('sunrays tropsun', '', 'top:' + (8 + stage * 4) + '%');
      add('sea'); add('waves w1'); add('waves w2');
      add('sand');
      add('decor palm p1', cp(0x1F334)); add('decor palm p2', cp(0x1F334));
      if (stage >= 2) add('decor palm p3', cp(0x1F334));
      if (stage >= 2) add('decor umbrella', cp(0x26F1));
      if (stage >= 4) add('decor island', cp(0x1F3DD));
      var shells = [0x1F41A, 0x1F33A, 0x1F965, 0x1F33A, 0x1F41A];
      for (var j = 0; j < 4 + stage; j++) { var sh = add('groundflower', cp(shells[j % shells.length])); sh.style.left = (4 + j * 92 / (4 + stage)) + '%'; sh.style.bottom = (1 + Math.random() * 4) + '%'; sh.style.fontSize = (18 + Math.random() * 10) + 'px'; }
    } else {
      if (stage >= 1) { add('aurora au1'); add('aurora au2'); }
      add('decor moon', cp(0x1F315));
      for (var st = 0; st < 40 + stage * 10; st++) {
        var dot = add('twinkle'); dot.style.left = Math.random() * 100 + '%'; dot.style.top = Math.random() * 70 + '%';
        dot.style.animationDelay = Math.random() * 3 + 's'; if (Math.random() < 0.3) { dot.style.width = dot.style.height = '4px'; dot.style.background = ['#ffe27a', '#9be7ff', '#ffb3f0'][st % 3]; }
      }
      add('nighthill');
      add('decor pine pn1', cp(0x1F332)); add('decor pine pn2', cp(0x1F332)); add('decor pine pn3', cp(0x1F332));
      if (stage >= 2) add('decor owl', cp(0x1F989));
      if (boss) add('decor castle', cp(0x1F3F0));
      var glow = [0x1F344, 0x1F33F, 0x1F344];
      for (var q = 0; q < 3 + stage; q++) { var gq = add('groundflower', cp(glow[q % 3])); gq.style.left = (6 + q * 88 / (3 + stage)) + '%'; gq.style.bottom = (1 + Math.random() * 4) + '%'; }
    }
    if (boss) { add('bossglow'); add('lightning'); }
    root.appendChild(scene);
    var movers = W.movers.slice();
    if (W.key === 'orchard') { if (stage >= 2) movers.push({ c: 0x1F426, k: 'fly' }, { c: 0x1F426, k: 'fly' }); if (stage >= 4) movers.push({ c: 0x1F388, k: 'balloon' }, { c: 0x1F388, k: 'balloon' }); }
    if (W.key === 'tropical') { if (stage >= 1) movers.push({ c: 0x26F5, k: 'sail' }); if (stage >= 3) movers.push({ c: 0x1F42C, k: 'jump' }, { c: 0x1F420, k: 'jump' }); if (stage >= 5) movers.push({ c: 0x1F99C, k: 'fly' }); }
    if (W.key === 'night') { if (stage >= 3) movers.push({ c: 0x1F3EE, k: 'balloon' }); if (stage >= 1) movers.push({ k: 'shoot' }); movers.push({ c: 0x1F987, k: 'fly' }); }
    var maxMovers = 6 + Math.min(stage, 4);
    var timer = setInterval(function () {
      if (!document.body.contains(scene)) { clearInterval(timer); return; }
      if (document.hidden || scene.querySelectorAll('.mover').length >= maxMovers) return;
      var m = movers[Math.floor(Math.random() * movers.length)], e;
      if (m.k === 'fly') {
        var ltr = Math.random() < 0.5;
        e = h('span', { class: 'mover fly' + (ltr ? ' ltr' : ' rtl') }, h('span', { class: 'bob', text: cp(m.c) }));
        e.style.top = (Math.random() < 0.5 ? 2 + Math.random() * 14 : 70 + Math.random() * 10) + '%';
        e.style.fontSize = (22 + Math.random() * 12) + 'px'; e.style.animationDuration = (11 + Math.random() * 8) + 's';
      } else if (m.k === 'rise' || m.k === 'balloon') {
        e = h('span', { class: 'mover ' + (m.k === 'balloon' ? 'balloon' : 'rise'), text: cp(m.c) });
        e.style.left = (5 + Math.random() * 90) + '%'; e.style.fontSize = (m.k === 'balloon' ? 26 + Math.random() * 14 : 12 + Math.random() * 16) + 'px';
        e.style.animationDuration = (m.k === 'balloon' ? 14 + Math.random() * 6 : 6 + Math.random() * 5) + 's';
        e.style.setProperty('--sway', (Math.random() * 40 - 20) + 'px');
        if (m.k === 'balloon' && W.key === 'orchard') e.style.filter = 'hue-rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      } else if (m.k === 'sail') {
        e = h('span', { class: 'mover sail' + (Math.random() < 0.5 ? ' rtl' : ''), text: cp(m.c) }); e.style.animationDuration = (16 + Math.random() * 8) + 's';
      } else if (m.k === 'jump') {
        e = h('span', { class: 'mover jump', text: cp(m.c) }); e.style.left = (8 + Math.random() * 80) + '%';
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
    }, 1200);
    // Start music on the first tap INSIDE this screen only (a listener on #app would outlive the screen)
    root.addEventListener('pointerdown', function first() {
      if (!document.body.contains(scene)) { root.removeEventListener('pointerdown', first); return; }
      Sound.playMusic(W.song, scene); Sound.unlockVoice();
    });
    Sound.playMusic(W.song, scene);
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
    if (g.boss) out.push({ k: 'boss', icon: cp(g.boss.icon), label: 'Defeat ' + g.boss.name + ' (' + g.boss.hp + ' HP)' });
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
    buildScene(root, W, (cur - 1) % 8, false);
    root.appendChild(h('div', { class: 'fxlayer' }));
    root.appendChild(UI.topbar('Fruit Swap', '#/', soundToggles()));
    var giftReady = P.gift !== today();
    function refresh() { window.dispatchEvent(new HashChangeEvent('hashchange')); }
    root.appendChild(h('div', { class: 'maphead' }, [
      h('div', { class: 'boostcount', html: COIN + ' <b>' + P.coins + '</b> &nbsp; ' + HAMMER + ' <b>' + P.boosters.hammer + '</b> &nbsp; <span class="plus5">+5</span> <b>' + P.boosters.moves + '</b>' }),
      h('button', { class: 'shopbtn', html: SHOP + ' Shop', onclick: function () { shop(refresh); } }),
      h('button', { class: 'giftbtn' + (giftReady ? ' ready' : ''), html: GIFT + (giftReady ? ' Gift!' : ''), 'aria-label': giftReady ? 'Daily gift' : 'Gift tomorrow',
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
      var node = h('button', { class: 'mapnode w' + L.world + (L.boss ? ' bossnode' : '') + (L.boss && L.boss.final ? ' finalnode' : '') + (locked ? ' locked' : '') + (L.n === cur && !P.stars[L.n] ? ' current' : '') + (stars ? ' done' : ''),
        style: 'left:' + x + '%', 'aria-label': 'Level ' + L.n + (locked ? ' locked' : ''),
        onclick: function () { if (locked) UI.toast('Beat level ' + (L.n - 1) + ' to unlock this one.'); else intro(L); } }, [
        h('span', { class: 'num', text: L.boss ? cp(L.boss.icon) : locked ? LOCK : String(L.n) }),
        L.boss ? h('span', { class: 'bosstag', text: L.boss.final ? 'FINAL BOSS' : 'BOSS' }) : null,
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
      P2.boosters[kind] += n; P2.coins += 50; P2.gift = today(); saveProg(P2);
      Sound.play('win'); UI.confetti(); Sound.say('Daily gift!');
      UI.modal({ big: GIFT, title: 'Daily gift!', text: 'You got ' + n + ' ' + (kind === 'hammer' ? 'Hammer' + (n > 1 ? 's' : '') + ' ' + HAMMER : 'extra-moves booster' + (n > 1 ? 's' : '') + ' (+5 moves)') + ' plus 50 coins ' + COIN + '. Come back tomorrow for another.',
        buttons: [{ label: 'Thanks!', cls: 'swap', fn: function () { window.dispatchEvent(new HashChangeEvent('hashchange')); } }] });
    }
  }

  function intro(L) {
    var list = h('div', { class: 'goallist' });
    goalChips(L).forEach(function (g) { list.appendChild(h('div', { class: 'goalline', html: '<span class="gi">' + g.icon + '</span>' + g.label })); });
    if (L.tip) list.appendChild(h('p', { class: 'tip', text: 'Tip: ' + L.tip }));
    var P = prog(), chosen = {};
    var owned = SHOP_ITEMS.filter(function (it) { return it.kind === 'pre' && P.pre[it.id] > 0; });
    if (owned.length) {
      var row = h('div', { class: 'prerow' }, [h('small', { text: 'Use a starting booster:' })]);
      owned.forEach(function (it) {
        var b = h('button', { class: 'prebtn', html: it.icon + '<span>' + it.name + ' (' + P.pre[it.id] + ')</span>', onclick: function () { chosen[it.id] = !chosen[it.id]; b.classList.toggle('on', chosen[it.id]); } });
        row.appendChild(b);
      });
      list.appendChild(row);
    }
    UI.modal({ title: 'Level ' + L.n, text: L.moves + ' moves', body: list,
      buttons: [{ label: 'Play', cls: 'swap', fn: function () { UI.store('fs_level', L.n); UI.store('fs_pre', chosen); location.hash = '#/swap/play'; } }, { label: 'Not now' }] });
  }

  // ---------- LEVEL ----------
  function play(root) {
    var lvl = UI.store('fs_level') || prog().unlocked, L = E.LEVELS[lvl - 1];
    if (!L) { location.hash = '#/swap'; return; }
    var W = WORLDS[L.world];
    buildScene(root, W, (L.n - 1) % 8, !!L.boss);
    var fx = h('div', { class: 'fxlayer' }); root.appendChild(fx);
    root.appendChild(UI.topbar(L.boss ? 'Boss ' + L.n : 'Level ' + L.n, '#/swap', soundToggles()));
    var goalsEl = h('div', { class: 'fsgoals' });
    var bar = h('div', { class: 'fsbar' }), meter = h('div', { class: 'fsmeter' }, [h('i'), h('b', { class: 'm1' }), h('b', { class: 'm2' }), h('b', { class: 'm3' })]);
    var gridEl = h('div', { class: 'fsgrid' });
    var hammerBtn = h('button', { class: 'boost' }), movesBtn = h('button', { class: 'boost' });
    var bossEl = null, bossFace = null, bossHp = null, bossInfo = null, turns = 0;
    if (L.boss) {
      bossFace = h('div', { class: 'bossface', text: cp(L.boss.icon) });
      bossHp = h('i'); bossInfo = h('small');
      bossEl = h('div', { class: 'bosspanel' + (L.boss.final ? ' final' : '') }, [bossFace, h('div', { class: 'bossinfo' }, [h('b', { text: L.boss.name }), h('div', { class: 'hpbar' }, bossHp), bossInfo])]);
      root.appendChild(bossEl);
    } else root.appendChild(goalsEl);
    root.appendChild(bar); root.appendChild(meter); root.appendChild(gridEl);
    root.appendChild(h('div', { class: 'boostbar' }, [hammerBtn, movesBtn,
      h('button', { class: 'boost', html: '&#128161;<span>Hint</span>', onclick: function () { showHint(true); } })]));

    var tiles = [], st, stats, moves, busy, sel, hintTimer, done, hammerMode, extraUsed, firstStart = true;
    for (var i = 0; i < N * N; i++) { var t = h('div', { class: 'fstile' }); tiles.push(t); gridEl.appendChild(t); }

    function score() { return stats.points; }
    function starsFor(sc) { return sc >= L.stars[2] ? 3 : sc >= L.stars[1] ? 2 : 1; }
    function goalState() {
      var g = L.goals, out = {};
      if (g.score) out.score = Math.max(0, g.score - score());
      if (g.boss) out.boss = Math.max(0, g.boss.hp - (stats.damage || 0));
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
      if (L.boss) {
        var hpLeft = Math.max(0, L.boss.hp - (stats.damage || 0));
        bossHp.style.width = (hpLeft / L.boss.hp * 100) + '%';
        bossHp.className = hpLeft / L.boss.hp < 0.3 ? 'low' : '';
        var nextAtk = L.boss.every - (turns % L.boss.every);
        bossInfo.textContent = 'HP ' + hpLeft + ' / ' + L.boss.hp + (hpLeft ? '  \u2022  attacks in ' + nextAtk + ' move' + (nextAtk > 1 ? 's' : '') : '');
      }
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
    function bossHit(n) {
      if (!bossFace) return;
      bossFace.classList.remove('hit'); void bossFace.offsetWidth; bossFace.classList.add('hit');
      var r = bossFace.getBoundingClientRect();
      fxText('-' + n, 'dmgfloat', r.left + r.width / 2 + (Math.random() * 30 - 15), r.top + r.height / 2);
      render();
    }
    async function bossAttack() {
      bossFace.classList.remove('attack'); void bossFace.offsetWidth; bossFace.classList.add('attack');
      Sound.play('blast'); Sound.say(L.boss.taunt); fxText(L.boss.taunt, 'cheer bosscheer');
      await wait(650);
      var spots = E.bossAttack(st, L.boss.spawn);
      render();
      spots.forEach(function (p) { var tl = tiles[p[0] * N + p[1]]; tl.classList.add('goo'); });
      shake(true); UI.vibrate([30, 40, 30]);
      await wait(600);
      if (!E.findMove(st)) { E.shuffle(st); render(); }
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
      if (L.boss && res.damage) bossHit(res.damage);
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
      if (L.boss && moves > 0 && turns > 0 && turns % L.boss.every === 0 && document.body.contains(gridEl)) await bossAttack();
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
        moves--; turns++; UI.vibrate(40); combo.pointsBefore = before; combo.label = stats.label;
        await animate(combo, 2); await cascade(null, 2);
      } else {
        E.swap(st, a, b); render(); Sound.play('swap');
        if (!E.runs(st).length) {
          Sound.play('nope');
          await wait(170); E.swap(st, a, b); render();
          [a, b].forEach(function (p) { tiles[p[0] * N + p[1]].classList.add('nope'); });
          UI.vibrate([10, 30, 10]); await wait(300); busy = false; resetHint(); return;
        }
        moves--; turns++;
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
      if (L.boss) {
        bossFace.classList.add('defeated'); Sound.play('blast'); shake(true);
        fxText(L.boss.final ? 'FINAL BOSS DEFEATED!' : 'Boss defeated!', 'banner'); Sound.say(L.boss.final ? 'Final boss defeated! You are the champion!' : 'Boss defeated!');
        Sound.play('win'); await wait(1600);
      } else { Sound.play('win'); fxText('Level complete!', 'banner'); Sound.say('Level complete!'); }
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
      var coins = 20 + stars * 10 + (firstWin ? 15 : 0) + (L.boss ? 100 : 0);
      P.coins += coins; reward = '+' + coins + ' coins ' + COIN;
      var perk = PERKS[L.n];
      if (perk && !P.perks[perk.id]) { P.perks[perk.id] = true; reward += '. NEW UPGRADE: ' + perk.name + ', ' + perk.desc; }
      if (stars === 3 || (firstWin && L.n % 4 === 0)) {
        var kind = Math.random() < 0.5 ? 'hammer' : 'moves'; P.boosters[kind]++;
        reward += '. Bonus: +1 ' + (kind === 'hammer' ? 'Hammer ' + HAMMER : '+5 Moves booster');
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
      moves = L.moves; busy = false; sel = null; done = false; hammerMode = false; extraUsed = false; turns = 0;
      if (bossFace) bossFace.className = 'bossface';
      // Permanent upgrades and starting boosters
      var P = prog(), gifts = [];
      if (P.perks.moves2) moves += 2;
      var want = { stripe: P.perks.stripe1 ? 1 : 0, bomb: 0, star: 0 };
      if (firstStart) {
        var pre = UI.store('fs_pre') || {};
        ['stripe', 'bomb', 'star'].forEach(function (k) { if (pre[k] && P.pre[k] > 0) { P.pre[k]--; want[k] += k === 'star' ? 1 : 2; gifts.push(k); } });
        saveProg(P); UI.store('fs_pre', null); firstStart = false;
      }
      var spots = [];
      for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) { var x2 = st.cells[r2][c2]; if (E.playable(st, r2, c2) && x2 && x2.t >= 0 && !x2.sp) spots.push([r2, c2]); }
      function place(sp) { if (!spots.length) return; var p = spots.splice(Math.floor(Math.random() * spots.length), 1)[0]; var cell = st.cells[p[0]][p[1]]; if (sp === 'star') { cell.t = -1; cell.sp = 'star'; } else cell.sp = sp === 'stripe' ? (Math.random() < 0.5 ? 'row' : 'col') : 'bomb'; }
      for (var q = 0; q < want.stripe; q++) place('stripe');
      for (q = 0; q < want.bomb; q++) place('bomb');
      for (q = 0; q < want.star; q++) place('star');
      var all = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) all.push({ r: r, c: c, d: N });
      paintBoosters(); render(all); resetHint();
      fxText(L.boss ? (L.boss.final ? 'FINAL BOSS: ' : 'BOSS: ') + L.boss.name : 'Level ' + L.n, 'banner');
      if (L.boss) setTimeout(function () { Sound.say(L.boss.final ? 'Final boss! ' + L.boss.name : 'Boss fight! ' + L.boss.name); }, 400);
    }
    start();
  }

  return { setup: setup, play: play, soundToggles: soundToggles };
})();
