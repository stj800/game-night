// One-off patch: boss fights on screen + richer scenes that grow level by level.
var fs = require('fs'), f = __dirname + '/../js/swap.js', s = fs.readFileSync(f, 'utf8');
function rep(a, b) { if (s.indexOf(a) < 0) throw new Error('missing: ' + a.slice(0, 80)); s = s.replace(a, b); }

// ---- 1) New scene builder ----
var a = s.indexOf('  function buildScene(root, W) {'), b = s.indexOf('  function soundToggles() {');
if (a < 0 || b < 0) throw new Error('scene block');
var scene =
"  // Living background. stage = level number inside the world (0-7): the world fills with more life as you go.\n" +
"  function buildScene(root, W, stage, boss) {\n" +
"    stage = stage || 0;\n" +
"    var scene = h('div', { class: 'fsscene theme-' + W.key + ' stage' + stage + (boss ? ' bossstage' : '') });\n" +
"    function add(cls, text, css) { var e = h('span', { class: cls, text: text || '' }); if (css) e.setAttribute('style', css); scene.appendChild(e); return e; }\n" +
"    if (W.key === 'orchard') {\n" +
"      add('sun'); add('sunrays');\n" +
"      if (stage >= 1) add('rainbow');\n" +
"      add('hill hb'); add('hill hm'); add('hill hf');\n" +
"      add('decor cloud c1', cp(0x2601)); add('decor cloud c2', cp(0x2601)); if (stage >= 2) add('decor cloud c3', cp(0x2601));\n" +
"      add('decor tree t1', cp(0x1F333)); add('decor tree t2', cp(0x1F333));\n" +
"      if (stage >= 3) { add('decor apple a1', cp(0x1F34E)); add('decor apple a2', cp(0x1F34E)); add('decor apple a3', cp(0x1F350)); }\n" +
"      if (stage >= 5) { add('decor house', cp(0x1F3E1)); add('decor sheep s1', cp(0x1F411)); add('decor sheep s2', cp(0x1F411)); }\n" +
"      if (stage >= 6) add('decor bigballoon', cp(0x1F388));\n" +
"      var flowers = [0x1F33C, 0x1F337, 0x1F338, 0x1F33B, 0x1F33A, 0x1F490];\n" +
"      var count = 8 + stage * 2;\n" +
"      for (var k = 0; k < count; k++) {\n" +
"        var fl = add('groundflower', cp(flowers[k % flowers.length]));\n" +
"        fl.style.left = (2 + (k * 97 / count) + Math.random() * 3) + '%'; fl.style.bottom = (Math.random() * 7) + '%';\n" +
"        fl.style.fontSize = (22 + Math.random() * 12) + 'px'; fl.style.animationDelay = (Math.random() * 2) + 's';\n" +
"      }\n" +
"    } else if (W.key === 'tropical') {\n" +
"      add('sun tropsun', '', 'top:' + (8 + stage * 4) + '%'); add('sunrays tropsun', '', 'top:' + (8 + stage * 4) + '%');\n" +
"      add('sea'); add('waves w1'); add('waves w2');\n" +
"      add('sand');\n" +
"      add('decor palm p1', cp(0x1F334)); add('decor palm p2', cp(0x1F334));\n" +
"      if (stage >= 2) add('decor palm p3', cp(0x1F334));\n" +
"      if (stage >= 2) add('decor umbrella', cp(0x26F1));\n" +
"      if (stage >= 4) add('decor island', cp(0x1F3DD));\n" +
"      var shells = [0x1F41A, 0x1F33A, 0x1F965, 0x1F33A, 0x1F41A];\n" +
"      for (var j = 0; j < 4 + stage; j++) { var sh = add('groundflower', cp(shells[j % shells.length])); sh.style.left = (4 + j * 92 / (4 + stage)) + '%'; sh.style.bottom = (1 + Math.random() * 4) + '%'; sh.style.fontSize = (18 + Math.random() * 10) + 'px'; }\n" +
"    } else {\n" +
"      if (stage >= 1) { add('aurora au1'); add('aurora au2'); }\n" +
"      add('decor moon', cp(0x1F315));\n" +
"      for (var st = 0; st < 40 + stage * 10; st++) {\n" +
"        var dot = add('twinkle'); dot.style.left = Math.random() * 100 + '%'; dot.style.top = Math.random() * 70 + '%';\n" +
"        dot.style.animationDelay = Math.random() * 3 + 's'; if (Math.random() < 0.3) { dot.style.width = dot.style.height = '4px'; dot.style.background = ['#ffe27a', '#9be7ff', '#ffb3f0'][st % 3]; }\n" +
"      }\n" +
"      add('nighthill');\n" +
"      add('decor pine pn1', cp(0x1F332)); add('decor pine pn2', cp(0x1F332)); add('decor pine pn3', cp(0x1F332));\n" +
"      if (stage >= 2) add('decor owl', cp(0x1F989));\n" +
"      if (boss) add('decor castle', cp(0x1F3F0));\n" +
"      var glow = [0x1F344, 0x1F33F, 0x1F344];\n" +
"      for (var q = 0; q < 3 + stage; q++) { var gq = add('groundflower', cp(glow[q % 3])); gq.style.left = (6 + q * 88 / (3 + stage)) + '%'; gq.style.bottom = (1 + Math.random() * 4) + '%'; }\n" +
"    }\n" +
"    if (boss) { add('bossglow'); add('lightning'); }\n" +
"    root.appendChild(scene);\n" +
"    var movers = W.movers.slice();\n" +
"    if (W.key === 'orchard') { if (stage >= 2) movers.push({ c: 0x1F426, k: 'fly' }, { c: 0x1F426, k: 'fly' }); if (stage >= 4) movers.push({ c: 0x1F388, k: 'balloon' }, { c: 0x1F388, k: 'balloon' }); }\n" +
"    if (W.key === 'tropical') { if (stage >= 1) movers.push({ c: 0x26F5, k: 'sail' }); if (stage >= 3) movers.push({ c: 0x1F42C, k: 'jump' }, { c: 0x1F420, k: 'jump' }); if (stage >= 5) movers.push({ c: 0x1F99C, k: 'fly' }); }\n" +
"    if (W.key === 'night') { if (stage >= 3) movers.push({ c: 0x1F3EE, k: 'balloon' }); if (stage >= 1) movers.push({ k: 'shoot' }); movers.push({ c: 0x1F987, k: 'fly' }); }\n" +
"    var maxMovers = 6 + Math.min(stage, 4);\n" +
"    var timer = setInterval(function () {\n" +
"      if (!document.body.contains(scene)) { clearInterval(timer); return; }\n" +
"      if (document.hidden || scene.querySelectorAll('.mover').length >= maxMovers) return;\n" +
"      var m = movers[Math.floor(Math.random() * movers.length)], e;\n" +
"      if (m.k === 'fly') {\n" +
"        var ltr = Math.random() < 0.5;\n" +
"        e = h('span', { class: 'mover fly' + (ltr ? ' ltr' : ' rtl') }, h('span', { class: 'bob', text: cp(m.c) }));\n" +
"        e.style.top = (Math.random() < 0.5 ? 2 + Math.random() * 14 : 70 + Math.random() * 10) + '%';\n" +
"        e.style.fontSize = (22 + Math.random() * 12) + 'px'; e.style.animationDuration = (11 + Math.random() * 8) + 's';\n" +
"      } else if (m.k === 'rise' || m.k === 'balloon') {\n" +
"        e = h('span', { class: 'mover ' + (m.k === 'balloon' ? 'balloon' : 'rise'), text: cp(m.c) });\n" +
"        e.style.left = (5 + Math.random() * 90) + '%'; e.style.fontSize = (m.k === 'balloon' ? 26 + Math.random() * 14 : 12 + Math.random() * 16) + 'px';\n" +
"        e.style.animationDuration = (m.k === 'balloon' ? 14 + Math.random() * 6 : 6 + Math.random() * 5) + 's';\n" +
"        e.style.setProperty('--sway', (Math.random() * 40 - 20) + 'px');\n" +
"        if (m.k === 'balloon' && W.key === 'orchard') e.style.filter = 'hue-rotate(' + Math.floor(Math.random() * 360) + 'deg)';\n" +
"      } else if (m.k === 'sail') {\n" +
"        e = h('span', { class: 'mover sail' + (Math.random() < 0.5 ? ' rtl' : ''), text: cp(m.c) }); e.style.animationDuration = (16 + Math.random() * 8) + 's';\n" +
"      } else if (m.k === 'jump') {\n" +
"        e = h('span', { class: 'mover jump', text: cp(m.c) }); e.style.left = (8 + Math.random() * 80) + '%';\n" +
"      } else if (m.k === 'firefly') {\n" +
"        e = h('i', { class: 'mover firefly' });\n" +
"        e.style.left = (5 + Math.random() * 90) + '%'; e.style.top = (10 + Math.random() * 80) + '%';\n" +
"        e.style.setProperty('--fx', (Math.random() * 80 - 40) + 'px'); e.style.setProperty('--fy', (Math.random() * 60 - 30) + 'px');\n" +
"        e.style.animationDuration = (4 + Math.random() * 3) + 's';\n" +
"      } else {\n" +
"        e = h('i', { class: 'mover shoot' }); e.style.left = (20 + Math.random() * 70) + '%'; e.style.top = (3 + Math.random() * 18) + '%';\n" +
"      }\n" +
"      e.addEventListener('animationend', function (ev) { if (ev.target === e) e.remove(); });\n" +
"      scene.appendChild(e);\n" +
"    }, 1200);\n" +
"    // Start music on the first tap INSIDE this screen only (a listener on #app would outlive the screen)\n" +
"    root.addEventListener('pointerdown', function first() {\n" +
"      if (!document.body.contains(scene)) { root.removeEventListener('pointerdown', first); return; }\n" +
"      Sound.playMusic(W.song); Sound.unlockVoice();\n" +
"    });\n" +
"    Sound.playMusic(W.song);\n" +
"    return scene;\n" +
"  }\n\n";
s = s.slice(0, a) + scene + s.slice(b);

// ---- 2) scene calls pass the stage ----
function stageOf(n) { return '((' + n + ' - 1) % 8)'; }
rep("    var P = prog(), cur = Math.min(P.unlocked, E.LEVELS.length), W = WORLDS[E.LEVELS[cur - 1].world];\n    buildScene(root, W);",
    "    var P = prog(), cur = Math.min(P.unlocked, E.LEVELS.length), W = WORLDS[E.LEVELS[cur - 1].world];\n    buildScene(root, W, (cur - 1) % 8, false);");
rep("    var W = WORLDS[L.world];\n    buildScene(root, W);",
    "    var W = WORLDS[L.world];\n    buildScene(root, W, (L.n - 1) % 8, !!L.boss);");

// ---- 3) goals know about bosses ----
rep("    var out = [], g = L.goals;\n    if (g.jelly)",
    "    var out = [], g = L.goals;\n    if (g.boss) out.push({ k: 'boss', icon: cp(g.boss.icon), label: 'Defeat ' + g.boss.name + ' (' + g.boss.hp + ' HP)' });\n    if (g.jelly)");
rep("      if (g.score) out.score = Math.max(0, g.score - score());\n      if (g.jelly)",
    "      if (g.score) out.score = Math.max(0, g.score - score());\n      if (g.boss) out.boss = Math.max(0, g.boss.hp - (stats.damage || 0));\n      if (g.jelly)");

// ---- 4) map nodes for bosses ----
rep("      var node = h('button', { class: 'mapnode w' + L.world + (locked ? ' locked' : '')",
    "      var node = h('button', { class: 'mapnode w' + L.world + (L.boss ? ' bossnode' : '') + (L.boss && L.boss.final ? ' finalnode' : '') + (locked ? ' locked' : '')");
rep("        h('span', { class: 'num', text: locked ? LOCK : String(L.n) }),",
    "        h('span', { class: 'num', text: L.boss ? cp(L.boss.icon) : locked ? LOCK : String(L.n) }),\n        L.boss ? h('span', { class: 'bosstag', text: L.boss.final ? 'FINAL BOSS' : 'BOSS' }) : null,");

// ---- 5) boss panel on the level screen ----
rep("    root.appendChild(goalsEl); root.appendChild(bar);",
    "    var bossEl = null, bossFace = null, bossHp = null, bossInfo = null, turns = 0;\n" +
    "    if (L.boss) {\n" +
    "      bossFace = h('div', { class: 'bossface', text: cp(L.boss.icon) });\n" +
    "      bossHp = h('i'); bossInfo = h('small');\n" +
    "      bossEl = h('div', { class: 'bosspanel' + (L.boss.final ? ' final' : '') }, [bossFace, h('div', { class: 'bossinfo' }, [h('b', { text: L.boss.name }), h('div', { class: 'hpbar' }, bossHp), bossInfo])]);\n" +
    "      root.appendChild(bossEl);\n" +
    "    } else root.appendChild(goalsEl);\n" +
    "    root.appendChild(bar);");
rep("      goalsEl.innerHTML = '';\n      var gs = goalState();",
    "      if (L.boss) {\n" +
    "        var hpLeft = Math.max(0, L.boss.hp - (stats.damage || 0));\n" +
    "        bossHp.style.width = (hpLeft / L.boss.hp * 100) + '%';\n" +
    "        bossHp.className = hpLeft / L.boss.hp < 0.3 ? 'low' : '';\n" +
    "        var nextAtk = L.boss.every - (turns % L.boss.every);\n" +
    "        bossInfo.textContent = 'HP ' + hpLeft + ' / ' + L.boss.hp + (hpLeft ? '  \\u2022  attacks in ' + nextAtk + ' move' + (nextAtk > 1 ? 's' : '') : '');\n" +
    "      }\n" +
    "      goalsEl.innerHTML = '';\n      var gs = goalState();");
// damage feedback after each pop
rep("      Sound.play('pop', combo); burst(gone, score() - before);",
    "      Sound.play('pop', combo); burst(gone, score() - before);\n      if (L.boss && res.damage) bossHit(res.damage);");
rep("    function shake(big) {",
    "    function bossHit(n) {\n" +
    "      if (!bossFace) return;\n" +
    "      bossFace.classList.remove('hit'); void bossFace.offsetWidth; bossFace.classList.add('hit');\n" +
    "      var r = bossFace.getBoundingClientRect();\n" +
    "      fxText('-' + n, 'dmgfloat', r.left + r.width / 2 + (Math.random() * 30 - 15), r.top + r.height / 2);\n" +
    "      render();\n" +
    "    }\n" +
    "    async function bossAttack() {\n" +
    "      bossFace.classList.remove('attack'); void bossFace.offsetWidth; bossFace.classList.add('attack');\n" +
    "      Sound.play('blast'); Sound.say(L.boss.taunt); fxText(L.boss.taunt, 'cheer bosscheer');\n" +
    "      await wait(650);\n" +
    "      var spots = E.bossAttack(st, L.boss.spawn);\n" +
    "      render();\n" +
    "      spots.forEach(function (p) { var tl = tiles[p[0] * N + p[1]]; tl.classList.add('goo'); });\n" +
    "      shake(true); UI.vibrate([30, 40, 30]);\n" +
    "      await wait(600);\n" +
    "      if (!E.findMove(st)) { E.shuffle(st); render(); }\n" +
    "    }\n" +
    "    function shake(big) {");
// count turns and let the boss strike back
rep("        moves--; UI.vibrate(40); combo.pointsBefore = before;", "        moves--; turns++; UI.vibrate(40); combo.pointsBefore = before;");
rep("        moves--;\n        await cascade([a, b], 1);", "        moves--; turns++;\n        await cascade([a, b], 1);");
rep("      if (goalsMet()) { await win(); return; }\n      if (moves <= 0)",
    "      if (goalsMet()) { await win(); return; }\n      if (L.boss && moves > 0 && turns > 0 && turns % L.boss.every === 0 && document.body.contains(gridEl)) await bossAttack();\n      if (moves <= 0)");
// boss defeated moment
rep("      Sound.play('win'); fxText('Level complete!', 'banner'); Sound.say('Level complete!');",
    "      if (L.boss) {\n" +
    "        bossFace.classList.add('defeated'); Sound.play('blast'); shake(true);\n" +
    "        fxText(L.boss.final ? 'FINAL BOSS DEFEATED!' : 'Boss defeated!', 'banner'); Sound.say(L.boss.final ? 'Final boss defeated! You are the champion!' : 'Boss defeated!');\n" +
    "        Sound.play('win'); await wait(1600);\n" +
    "      } else { Sound.play('win'); fxText('Level complete!', 'banner'); Sound.say('Level complete!'); }");
rep("      moves = L.moves; busy = false; sel = null; done = false; hammerMode = false; extraUsed = false;",
    "      moves = L.moves; busy = false; sel = null; done = false; hammerMode = false; extraUsed = false; turns = 0;\n      if (bossFace) bossFace.className = 'bossface';");
rep("      fxText('Level ' + L.n, 'banner');\n    }\n    start();",
    "      fxText(L.boss ? (L.boss.final ? 'FINAL BOSS: ' : 'BOSS: ') + L.boss.name : 'Level ' + L.n, 'banner');\n      if (L.boss) setTimeout(function () { Sound.say(L.boss.final ? 'Final boss! ' + L.boss.name : 'Boss fight! ' + L.boss.name); }, 400);\n    }\n    start();");
// title for boss levels
rep("    root.appendChild(UI.topbar('Level ' + L.n, '#/swap', soundToggles()));",
    "    root.appendChild(UI.topbar(L.boss ? 'Boss ' + L.n : 'Level ' + L.n, '#/swap', soundToggles()));");

fs.writeFileSync(f, s);
console.log('patched');
