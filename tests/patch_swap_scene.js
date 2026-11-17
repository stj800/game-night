// One-off patch: background life that fits each scene (no fruit floating into the sky).
var fs = require('fs'), f = __dirname + '/../js/swap.js', s = fs.readFileSync(f, 'utf8');
function rep(a, b) { if (s.indexOf(a) < 0) throw new Error('missing: ' + a.slice(0, 70)); s = s.split(a).join(b); }
var start = s.indexOf('  var THEMES = {'), end = s.indexOf('  };', start) + 4;
s = s.slice(0, start) +
"  var THEMES = {\n" +
"    1: { key: 'orchard', name: 'Sunny Orchard', song: 'orchard', decor: [0x2601, 0x2601, 0x1F333, 0x1F333],\n" +
"         ground: [0x1F33C, 0x1F337, 0x1F338, 0x1F33C, 0x1F337, 0x1F33B], movers: [{ c: 0x1F98B, k: 'fly' }, { c: 0x1F98B, k: 'fly' }, { c: 0x1F41D, k: 'fly' }] },\n" +
"    2: { key: 'tropical', name: 'Tropical Sunset', song: 'tropical', decor: [0x1F334, 0x1F334, 0x2600],\n" +
"         ground: [], movers: [{ c: 0x1FAE7, k: 'rise' }, { c: 0x1FAE7, k: 'rise' }, { c: 0x1FAE7, k: 'rise' }, { c: 0x1F99C, k: 'fly' }] },\n" +
"    3: { key: 'night', name: 'Berry Night', song: 'night', decor: [0x1F319],\n" +
"         ground: [], movers: [{ k: 'firefly' }, { k: 'firefly' }, { k: 'firefly' }, { k: 'shoot' }] }\n" +
"  };" + s.slice(end);

rep("    TH.decor.forEach(function (c, k) { scene.appendChild(h('span', { class: 'decor d' + k, text: cp(c) })); });",
"    TH.decor.forEach(function (c, k) { scene.appendChild(h('span', { class: 'decor d' + k, text: cp(c) })); });\n" +
"    // Flowers planted along the hills (they sway, they do not float away)\n" +
"    TH.ground.forEach(function (c, k) {\n" +
"      var fl = h('span', { class: 'groundflower', text: cp(c) });\n" +
"      fl.style.left = (6 + k * (88 / Math.max(1, TH.ground.length - 1))) + '%';\n" +
"      fl.style.bottom = (1 + (k % 2) * 3 + Math.random() * 2) + '%';\n" +
"      fl.style.animationDelay = (Math.random() * 2) + 's';\n" +
"      scene.appendChild(fl);\n" +
"    });");

var a = s.indexOf("    // Background life: things drift up the screen all the time");
var b = s.indexOf("    }, 650);", a) + "    }, 650);".length;
if (a < 0 || b < a) throw new Error('floater block not found');
s = s.slice(0, a) +
"    // Background life that fits the scene: butterflies and parrots fly across, bubbles rise from the sea,\n" +
"    // fireflies blink, the odd shooting star. Kept to a handful at a time so it never gets busy.\n" +
"    var floatTimer = setInterval(function () {\n" +
"      if (!document.body.contains(scene)) { clearInterval(floatTimer); Sound.stopMusic(); return; }\n" +
"      if (document.hidden || scene.querySelectorAll('.mover').length >= 6) return;\n" +
"      var m = TH.movers[Math.floor(Math.random() * TH.movers.length)], e;\n" +
"      if (m.k === 'fly') {\n" +
"        var ltr = Math.random() < 0.5;\n" +
"        e = h('span', { class: 'mover fly' + (ltr ? ' ltr' : ' rtl') }, h('span', { class: 'bob', text: cp(m.c) }));\n" +
"        e.style.top = (6 + Math.random() * 26) + '%';\n" +
"        e.style.fontSize = (22 + Math.random() * 12) + 'px';\n" +
"        e.style.animationDuration = (11 + Math.random() * 8) + 's';\n" +
"      } else if (m.k === 'rise') {\n" +
"        e = h('span', { class: 'mover rise', text: cp(m.c) });\n" +
"        e.style.left = (5 + Math.random() * 90) + '%';\n" +
"        e.style.fontSize = (12 + Math.random() * 16) + 'px';\n" +
"        e.style.animationDuration = (6 + Math.random() * 5) + 's';\n" +
"        e.style.setProperty('--sway', (Math.random() * 40 - 20) + 'px');\n" +
"      } else if (m.k === 'firefly') {\n" +
"        e = h('i', { class: 'mover firefly' });\n" +
"        e.style.left = (5 + Math.random() * 90) + '%'; e.style.top = (10 + Math.random() * 80) + '%';\n" +
"        e.style.setProperty('--fx', (Math.random() * 80 - 40) + 'px'); e.style.setProperty('--fy', (Math.random() * 60 - 30) + 'px');\n" +
"        e.style.animationDuration = (4 + Math.random() * 3) + 's';\n" +
"      } else {\n" +
"        e = h('i', { class: 'mover shoot' });\n" +
"        e.style.left = (20 + Math.random() * 70) + '%'; e.style.top = (3 + Math.random() * 18) + '%';\n" +
"      }\n" +
"      e.addEventListener('animationend', function (ev) { if (ev.target === e) e.remove(); });\n" +
"      scene.appendChild(e);\n" +
"    }, 1400);" + s.slice(b);
fs.writeFileSync(f, s);
console.log('patched');
