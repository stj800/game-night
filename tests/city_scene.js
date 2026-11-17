// One-off patch: replace the Mahjong garden with an ancient Chinese city at dusk.
var fs = require('fs'), f = __dirname + '/../js/mahjong.js', s = fs.readFileSync(f, 'utf8');
var a = s.indexOf('  function scene(root) {'), b = s.indexOf('    return sc;', a);
if (a < 0 || b < 0) throw new Error('scene not found');
var code =
"  // Ancient Chinese city at dusk: mountains, pagodas, a walled city with a gate, lantern strings, sky lanterns, fireworks\n" +
"  function pagoda(tiers, w, cls) {\n" +
"    var p = h('div', { class: 'pagoda ' + (cls || '') }); p.style.width = w + 'px';\n" +
"    p.appendChild(h('i', { class: 'spire' }));\n" +
"    for (var k = 0; k < tiers; k++) {\n" +
"      var tw = Math.round(w * (0.55 + 0.45 * (k + 1) / tiers));\n" +
"      var tier = h('div', { class: 'tier' }, [h('i', { class: 'roof' }), h('i', { class: 'body' }, h('b', { class: 'win' }))]);\n" +
"      tier.style.width = tw + 'px'; p.appendChild(tier);\n" +
"    }\n" +
"    return p;\n" +
"  }\n" +
"  function scene(root) {\n" +
"    var sc = h('div', { class: 'fsscene theme-city' });\n" +
"    sc.appendChild(h('span', { class: 'cmoon' }));\n" +
"    for (var st = 0; st < 26; st++) { var d = h('i', { class: 'twinkle' }); d.style.left = Math.random() * 100 + '%'; d.style.top = Math.random() * 30 + '%'; d.style.animationDelay = Math.random() * 3 + 's'; sc.appendChild(d); }\n" +
"    sc.appendChild(h('span', { class: 'cmount m1' })); sc.appendChild(h('span', { class: 'cmount m2' })); sc.appendChild(h('span', { class: 'cmount m3' }));\n" +
"    // distant skyline of pagodas\n" +
"    var far = h('div', { class: 'skyline far' });\n" +
"    [[3, 40], [5, 56], [2, 30], [4, 46], [3, 36], [6, 64], [2, 28], [4, 44]].forEach(function (t) { far.appendChild(pagoda(t[0], t[1], 'dark')); });\n" +
"    sc.appendChild(far);\n" +
"    // city wall with battlements and the great gate\n" +
"    var wall = h('div', { class: 'citywall' }, [h('div', { class: 'battlements' }), h('div', { class: 'gate' }, [h('i', { class: 'gateroof' }), h('i', { class: 'arch' })])]);\n" +
"    sc.appendChild(wall);\n" +
"    // near pagodas, red and gold\n" +
"    var left = pagoda(5, 96, 'near left'); var right = pagoda(4, 84, 'near right');\n" +
"    sc.appendChild(left); sc.appendChild(right);\n" +
"    // lantern strings across the top\n" +
"    [0, 1].forEach(function (row) {\n" +
"      var str = h('div', { class: 'lanternstring s' + row });\n" +
"      for (var k = 0; k < 7; k++) { var l = h('span', { class: 'hanglantern', text: cp(0x1F3EE) }); l.style.left = (4 + k * 15 + row * 7) + '%'; l.style.top = (Math.sin((k / 6) * Math.PI) * 18) + 'px'; l.style.animationDelay = (-k * 0.4) + 's'; str.appendChild(l); }\n" +
"      sc.appendChild(str);\n" +
"    });\n" +
"    root.appendChild(sc);\n" +
"    var timer = setInterval(function () {\n" +
"      if (!document.body.contains(sc)) { clearInterval(timer); return; }\n" +
"      if (document.hidden) return;\n" +
"      if (sc.querySelectorAll('.skylantern').length < 7) {\n" +
"        var sl = h('span', { class: 'mover skylantern' }); sl.style.left = (5 + Math.random() * 90) + '%';\n" +
"        sl.style.animationDuration = (12 + Math.random() * 8) + 's'; sl.style.setProperty('--sway', (Math.random() * 60 - 30) + 'px');\n" +
"        var sz = 10 + Math.random() * 10; sl.style.width = sz + 'px'; sl.style.height = (sz * 1.3) + 'px';\n" +
"        sl.addEventListener('animationend', function () { sl.remove(); }); sc.appendChild(sl);\n" +
"      }\n" +
"      if (Math.random() < 0.18) {\n" +
"        var fw = h('i', { class: 'firework' }); fw.style.left = (10 + Math.random() * 80) + '%'; fw.style.top = (6 + Math.random() * 22) + '%';\n" +
"        fw.style.setProperty('--c', ['#ffcf3f', '#ff4f6d', '#5fe3ff', '#b46bff', '#3ee08f'][Math.floor(Math.random() * 5)]);\n" +
"        fw.addEventListener('animationend', function () { fw.remove(); }); sc.appendChild(fw);\n" +
"      }\n" +
"      if (Math.random() < 0.04 && !sc.querySelector('.dragonkite')) {\n" +
"        var dk = h('span', { class: 'mover dragonkite', text: cp(0x1F409) }); dk.addEventListener('animationend', function () { dk.remove(); }); sc.appendChild(dk);\n" +
"      }\n" +
"    }, 1000);\n";
s = s.slice(0, a) + code + s.slice(b);
fs.writeFileSync(f, s);
console.log('patched');
