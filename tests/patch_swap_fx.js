// One-off patch: adds themes, music, sound effects and on-board effects to Fruit Swap.
var fs = require('fs'), f = __dirname + '/../js/swap.js', s = fs.readFileSync(f, 'utf8');
function rep(a, b) { if (s.indexOf(a) < 0) throw new Error('missing: ' + a.slice(0, 70)); s = s.split(a).join(b); }

// 1) themes table
rep("  // ---------- pure game logic ----------",
"  var THEMES = {\n" +
"    1: { key: 'orchard', name: 'Sunny Orchard', song: 'orchard', floaters: [0x1F98B, 0x1F33C, 0x1F338, 0x1F353, 0x1F34F, 0x1FAE7], decor: [0x2601, 0x2601, 0x1F333, 0x1F333] },\n" +
"    2: { key: 'tropical', name: 'Tropical Sunset', song: 'tropical', floaters: [0x1FAE7, 0x1F33A, 0x1F34A, 0x1F34B, 0x2728, 0x1F41A], decor: [0x1F334, 0x1F334, 0x2600] },\n" +
"    3: { key: 'night', name: 'Berry Night', song: 'night', floaters: [0x2728, 0x2B50, 0x1F347, 0x1FAD0, 0x1F4AB, 0x2728], decor: [0x1F319] }\n" +
"  };\n" +
"  var PARTICLE = ['#ff3b5c', '#ffd23f', '#9b5de5', '#ff8c1a', '#4361ee', '#5fd35f'];\n" +
"  var CHEERS = ['Juicy!', 'Fresh!', 'Ripe!', 'Fruitastic!', 'Berry good!', 'Smoothie time!'];\n" +
"  function cp(c) { return String.fromCodePoint(c); }\n\n" +
"  // ---------- pure game logic ----------");

// 2) scene, fx layer, sound toggles, theme banner
rep("    root.appendChild(UI.topbar('Fruit Swap', '#/swap'));\n    var bar = h('div', { class: 'fsbar' }), meter = h('div', { class: 'fsmeter' }, h('i')), gridEl = h('div', { class: 'fsgrid' });",
"    var TH = THEMES[cfg.level] || THEMES[1];\n" +
"    var musicBtn = h('button', { class: 'iconbtn', 'aria-label': 'Music on or off' }), sfxBtn = h('button', { class: 'iconbtn', 'aria-label': 'Sound on or off' });\n" +
"    function paintToggles() {\n" +
"      musicBtn.innerHTML = Sound.prefs.music ? '&#127925;' : '<s>&#127925;</s>'; musicBtn.style.opacity = Sound.prefs.music ? 1 : 0.5;\n" +
"      sfxBtn.innerHTML = Sound.prefs.sfx ? '&#128266;' : '&#128263;';\n" +
"    }\n" +
"    musicBtn.addEventListener('click', function () { Sound.setMusic(!Sound.prefs.music); Sound.playMusic(TH.song); paintToggles(); });\n" +
"    sfxBtn.addEventListener('click', function () { Sound.setSfx(!Sound.prefs.sfx); paintToggles(); });\n" +
"    paintToggles();\n" +
"    var scene = h('div', { class: 'fsscene theme-' + TH.key });\n" +
"    TH.decor.forEach(function (c, k) { scene.appendChild(h('span', { class: 'decor d' + k, text: cp(c) })); });\n" +
"    if (TH.key === 'night') for (var st = 0; st < 40; st++) { var dot = h('i', { class: 'twinkle' }); dot.style.left = Math.random() * 100 + '%'; dot.style.top = Math.random() * 70 + '%'; dot.style.animationDelay = Math.random() * 3 + 's'; scene.appendChild(dot); }\n" +
"    root.appendChild(scene);\n" +
"    var fx = h('div', { class: 'fxlayer' });\n" +
"    root.appendChild(fx);\n" +
"    root.appendChild(UI.topbar('Fruit Swap', '#/swap', h('div', { class: 'fstoggles' }, [musicBtn, sfxBtn])));\n" +
"    var bar = h('div', { class: 'fsbar' }), meter = h('div', { class: 'fsmeter' }, h('i')), gridEl = h('div', { class: 'fsgrid' });\n" +
"    // Background life: things drift up the screen all the time\n" +
"    var floatTimer = setInterval(function () {\n" +
"      if (!document.body.contains(scene)) { clearInterval(floatTimer); Sound.stopMusic(); return; }\n" +
"      if (document.hidden) return;\n" +
"      var e = h('span', { class: 'floater', text: cp(TH.floaters[Math.floor(Math.random() * TH.floaters.length)]) });\n" +
"      e.style.left = (Math.random() * 96) + '%';\n" +
"      e.style.fontSize = (16 + Math.random() * 26) + 'px';\n" +
"      e.style.animationDuration = (7 + Math.random() * 7) + 's';\n" +
"      e.style.setProperty('--sway', (Math.random() * 60 - 30) + 'px');\n" +
"      e.addEventListener('animationend', function () { e.remove(); });\n" +
"      scene.appendChild(e);\n" +
"    }, 650);\n" +
"    // Browsers only allow sound after a tap, so music starts on the first touch.\n" +
"    root.addEventListener('pointerdown', function () { Sound.playMusic(TH.song); }, { once: true });\n" +
"    Sound.playMusic(TH.song);\n" +
"    function fxText(text, cls, x, y) {\n" +
"      var e = h('div', { class: cls, text: text });\n" +
"      if (x !== undefined) { e.style.left = x + 'px'; e.style.top = y + 'px'; }\n" +
"      e.addEventListener('animationend', function () { e.remove(); });\n" +
"      fx.appendChild(e);\n" +
"    }\n" +
"    function burst(cells, combo) {\n" +
"      var sx = 0, sy = 0;\n" +
"      cells.forEach(function (p) {\n" +
"        var r = tiles[p[0] * N + p[1]].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;\n" +
"        sx += cx; sy += cy;\n" +
"        var color = PARTICLE[p.was && p.was.t >= 0 ? p.was.t : Math.floor(Math.random() * 6)];\n" +
"        for (var k = 0; k < 7; k++) {\n" +
"          var d = h('i', { class: 'particle' }), ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 55;\n" +
"          d.style.left = cx + 'px'; d.style.top = cy + 'px'; d.style.background = color;\n" +
"          d.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); d.style.setProperty('--dy', Math.sin(ang) * dist + 'px');\n" +
"          var size = 5 + Math.random() * 7; d.style.width = d.style.height = size + 'px';\n" +
"          d.addEventListener('animationend', function () { this.remove(); });\n" +
"          fx.appendChild(d);\n" +
"        }\n" +
"      });\n" +
"      if (cells.length) fxText('+' + (cells.length * 60 * combo), 'scorefloat', sx / cells.length, sy / cells.length);\n" +
"    }\n" +
"    function shake(big) { gridEl.classList.remove('shake', 'shakebig'); void gridEl.offsetWidth; gridEl.classList.add(big ? 'shakebig' : 'shake'); }");

// 3) swap + nope sounds
rep("        swapCells(g, a, b); render();\n        if (!runs(g).length) {",
"        swapCells(g, a, b); render(); Sound.play('swap');\n        if (!runs(g).length) { Sound.play('nope');");

// 4) star blast effects
rep("        score += res.points; moves--; UI.vibrate(40);\n        render(null, res.cleared);\n        await wait(POP_MS);",
"        score += res.points; moves--; UI.vibrate(40);\n        render(null, res.cleared);\n        Sound.play('special'); fxText('Fruit storm!', 'cheer');\n        await wait(POP_MS * 0.72);\n        Sound.play('blast'); burst(res.cleared, 2); shake(true);\n        await wait(POP_MS * 0.28);");

// 5) cascade effects
rep("        if (combo >= 3) UI.toast(combo >= 5 ? 'Fruit frenzy! x' + combo : 'Combo x' + combo);\n        UI.vibrate(combo > 1 ? 20 : 10);\n        render(null, step.cleared.filter(function (p) { return !g[p[0]][p[1]]; }));\n        await wait(POP_MS);\n        render(gravity(g, L.kinds));\n        await wait(FALL_MS);",
"        UI.vibrate(combo > 1 ? 20 : 10);\n        var gone = step.cleared.filter(function (p) { return !g[p[0]][p[1]]; });\n        render(null, gone);\n        Sound.play('grow', combo);\n        if (step.created.length) Sound.play('special');\n        if (combo >= 2) { fxText(CHEERS[Math.min(combo - 2, CHEERS.length - 1)] + (combo >= 3 ? ' x' + combo : ''), 'cheer'); Sound.play('combo', combo); }\n        await wait(POP_MS * 0.72);\n        Sound.play('pop', combo); burst(gone, combo);\n        if (combo >= 3 || gone.length >= 6) shake(combo >= 4 || gone.length >= 10);\n        await wait(POP_MS * 0.28);\n        render(gravity(g, L.kinds));\n        setTimeout(function () { Sound.play('land'); }, FALL_MS * 0.55);\n        await wait(FALL_MS);");

// 6) win / lose sounds
rep("      if (won) UI.confetti();", "      if (won) { UI.confetti(); Sound.play('win'); } else Sound.play('lose');");

// 7) theme banner on start
rep("      render(all); resetHint();\n    }",
"      render(all); resetHint();\n      fxText('Level ' + cfg.level + ': ' + TH.name, 'banner');\n    }");

fs.writeFileSync(f, s);
console.log('patched');
