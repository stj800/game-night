// One-off patch: coins, shop, pre-level boosters and permanent boss perks for Fruit Swap.
var fs = require('fs'), f = __dirname + '/../js/swap.js', s = fs.readFileSync(f, 'utf8');
function rep(a, b) { if (s.indexOf(a) < 0) throw new Error('missing: ' + a.slice(0, 80)); s = s.replace(a, b); }

rep("  var STAR = cp(0x1F31F),", "  var COIN = cp(0x1FA99), BOMB = cp(0x1F4A3), SHOP = cp(0x1F6D2);\n  var STAR = cp(0x1F31F),");

// progress gets coins, pre-level boosters, perks
rep("    p.boosters = p.boosters || { hammer: 2, moves: 1 }; p.gift = p.gift || '';",
    "    p.boosters = p.boosters || { hammer: 2, moves: 1 }; p.gift = p.gift || '';\n" +
    "    if (p.coins === undefined) p.coins = 150;\n" +
    "    p.pre = p.pre || { bomb: 0, stripe: 0, star: 0 }; p.perks = p.perks || {};\n");
rep("  function today() {",
    "  // Shop catalog (pretend coins earned by playing; no real money anywhere)\n" +
    "  var SHOP_ITEMS = [\n" +
    "    { id: 'hammer', icon: HAMMER, name: 'Hammer', desc: 'Smash any one fruit or crate.', price: 40, kind: 'boosters' },\n" +
    "    { id: 'moves', icon: '<b class=\"plus5\">+5</b>', name: '+5 Moves', desc: 'Five extra moves, any time.', price: 50, kind: 'boosters' },\n" +
    "    { id: 'stripe', icon: '<span class=\"stripeicon\">' + cp(0x1F353) + '</span>', name: 'Striped start', desc: 'Start a level with 2 striped fruits.', price: 45, kind: 'pre' },\n" +
    "    { id: 'bomb', icon: BOMB, name: 'Bomb start', desc: 'Start a level with 2 bomb fruits.', price: 60, kind: 'pre' },\n" +
    "    { id: 'star', icon: STAR, name: 'Star start', desc: 'Start a level with a star on the board.', price: 90, kind: 'pre' }\n" +
    "  ];\n" +
    "  var PERKS = { 8: { id: 'moves2', name: 'Green Thumb', desc: '+2 moves on every level, forever' }, 16: { id: 'stripe1', name: 'Lucky Seeds', desc: 'every level starts with a striped fruit, forever' } };\n\n" +
    "  function shop(onDone) {\n" +
    "    var P = prog(), list = h('div', { class: 'shoplist' });\n" +
    "    list.appendChild(h('div', { class: 'shopcoins', html: 'You have ' + COIN + ' <b>' + P.coins + '</b> coins' }));\n" +
    "    SHOP_ITEMS.forEach(function (it) {\n" +
    "      var owned = it.kind === 'pre' ? P.pre[it.id] : P.boosters[it.id];\n" +
    "      var can = P.coins >= it.price;\n" +
    "      list.appendChild(h('div', { class: 'shopitem' }, [\n" +
    "        h('div', { class: 'si', html: it.icon }),\n" +
    "        h('div', { class: 'sd', html: '<b>' + it.name + '</b><small>' + it.desc + ' You have ' + owned + '.</small>' }),\n" +
    "        h('button', { class: 'buy' + (can ? '' : ' cant'), html: COIN + ' ' + it.price, onclick: function () {\n" +
    "          var P2 = prog();\n" +
    "          if (P2.coins < it.price) { UI.toast('Not enough coins yet. Win levels to earn more!'); return; }\n" +
    "          P2.coins -= it.price; if (it.kind === 'pre') P2.pre[it.id]++; else P2.boosters[it.id]++;\n" +
    "          saveProg(P2); Sound.play('special'); UI.toast('Bought: ' + it.name); shop(onDone);\n" +
    "        } })\n" +
    "      ]));\n" +
    "    });\n" +
    "    var perks = Object.keys(PERKS).filter(function (k) { return P.perks[PERKS[k].id]; });\n" +
    "    if (perks.length) list.appendChild(h('div', { class: 'perklist', html: '<b>Your upgrades</b><br>' + perks.map(function (k) { return '\\u2714 ' + PERKS[k].name + ': ' + PERKS[k].desc; }).join('<br>') }));\n" +
    "    UI.modal({ big: SHOP, title: 'Fruit Shop', body: list, buttons: [{ label: 'Done', cls: 'swap', fn: onDone }] });\n" +
    "  }\n\n" +
    "  function today() {");

// map header: coins + shop + gift
rep("    root.appendChild(h('div', { class: 'maphead' }, [\n      h('div', { class: 'boostcount', html: HAMMER + ' <b>' + P.boosters.hammer + '</b> &nbsp; <span class=\"plus5\">+5</span> <b>' + P.boosters.moves + '</b>' }),",
    "    function refresh() { window.dispatchEvent(new HashChangeEvent('hashchange')); }\n" +
    "    root.appendChild(h('div', { class: 'maphead' }, [\n" +
    "      h('div', { class: 'boostcount', html: COIN + ' <b>' + P.coins + '</b> &nbsp; ' + HAMMER + ' <b>' + P.boosters.hammer + '</b> &nbsp; <span class=\"plus5\">+5</span> <b>' + P.boosters.moves + '</b>' }),\n" +
    "      h('button', { class: 'shopbtn', html: SHOP + ' Shop', onclick: function () { shop(refresh); } }),");
rep("      h('button', { class: 'giftbtn' + (giftReady ? ' ready' : ''), html: GIFT + ' ' + (giftReady ? 'Daily gift!' : 'Gift tomorrow'),",
    "      h('button', { class: 'giftbtn' + (giftReady ? ' ready' : ''), html: GIFT + (giftReady ? ' Gift!' : ''), 'aria-label': giftReady ? 'Daily gift' : 'Gift tomorrow',");
rep("      var P2 = prog(), kind = Math.random() < 0.5 ? 'hammer' : 'moves', n = Math.random() < 0.3 ? 2 : 1;\n      P2.boosters[kind] += n; P2.gift = today(); saveProg(P2);",
    "      var P2 = prog(), kind = Math.random() < 0.5 ? 'hammer' : 'moves', n = Math.random() < 0.3 ? 2 : 1;\n      P2.boosters[kind] += n; P2.coins += 50; P2.gift = today(); saveProg(P2);");
rep("'. Come back tomorrow for another.',", "' plus 50 coins ' + COIN + '. Come back tomorrow for another.',");

// level intro: pick pre-level boosters you own
rep("    if (L.tip) list.appendChild(h('p', { class: 'tip', text: 'Tip: ' + L.tip }));",
    "    if (L.tip) list.appendChild(h('p', { class: 'tip', text: 'Tip: ' + L.tip }));\n" +
    "    var P = prog(), chosen = {};\n" +
    "    var owned = SHOP_ITEMS.filter(function (it) { return it.kind === 'pre' && P.pre[it.id] > 0; });\n" +
    "    if (owned.length) {\n" +
    "      var row = h('div', { class: 'prerow' }, [h('small', { text: 'Use a starting booster:' })]);\n" +
    "      owned.forEach(function (it) {\n" +
    "        var b = h('button', { class: 'prebtn', html: it.icon + '<span>' + it.name + ' (' + P.pre[it.id] + ')</span>', onclick: function () { chosen[it.id] = !chosen[it.id]; b.classList.toggle('on', chosen[it.id]); } });\n" +
    "        row.appendChild(b);\n" +
    "      });\n" +
    "      list.appendChild(row);\n" +
    "    }");
rep("fn: function () { UI.store('fs_level', L.n); location.hash = '#/swap/play'; } }, { label: 'Not now' }] });",
    "fn: function () { UI.store('fs_level', L.n); UI.store('fs_pre', chosen); location.hash = '#/swap/play'; } }, { label: 'Not now' }] });");

// apply perks + pre-level boosters when a level starts
rep("    var tiles = [], st, stats, moves, busy, sel, hintTimer, done, hammerMode, extraUsed;",
    "    var tiles = [], st, stats, moves, busy, sel, hintTimer, done, hammerMode, extraUsed, firstStart = true;");
rep("      var all = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) all.push({ r: r, c: c, d: N });\n      paintBoosters(); render(all); resetHint();",
    "      // Permanent upgrades and starting boosters\n" +
    "      var P = prog(), gifts = [];\n" +
    "      if (P.perks.moves2) moves += 2;\n" +
    "      var want = { stripe: P.perks.stripe1 ? 1 : 0, bomb: 0, star: 0 };\n" +
    "      if (firstStart) {\n" +
    "        var pre = UI.store('fs_pre') || {};\n" +
    "        ['stripe', 'bomb', 'star'].forEach(function (k) { if (pre[k] && P.pre[k] > 0) { P.pre[k]--; want[k] += k === 'star' ? 1 : 2; gifts.push(k); } });\n" +
    "        saveProg(P); UI.store('fs_pre', null); firstStart = false;\n" +
    "      }\n" +
    "      var spots = [];\n" +
    "      for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) { var x2 = st.cells[r2][c2]; if (E.playable(st, r2, c2) && x2 && x2.t >= 0 && !x2.sp) spots.push([r2, c2]); }\n" +
    "      function place(sp) { if (!spots.length) return; var p = spots.splice(Math.floor(Math.random() * spots.length), 1)[0]; var cell = st.cells[p[0]][p[1]]; if (sp === 'star') { cell.t = -1; cell.sp = 'star'; } else cell.sp = sp === 'stripe' ? (Math.random() < 0.5 ? 'row' : 'col') : 'bomb'; }\n" +
    "      for (var q = 0; q < want.stripe; q++) place('stripe');\n" +
    "      for (q = 0; q < want.bomb; q++) place('bomb');\n" +
    "      for (q = 0; q < want.star; q++) place('star');\n" +
    "      var all = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) all.push({ r: r, c: c, d: N });\n" +
    "      paintBoosters(); render(all); resetHint();");

// coins + perks on a win
rep("      if (stars === 3 || (firstWin && L.n % 4 === 0)) {",
    "      var coins = 20 + stars * 10 + (firstWin ? 15 : 0) + (L.boss ? 100 : 0);\n" +
    "      P.coins += coins; reward = '+' + coins + ' coins ' + COIN;\n" +
    "      var perk = PERKS[L.n];\n" +
    "      if (perk && !P.perks[perk.id]) { P.perks[perk.id] = true; reward += '. NEW UPGRADE: ' + perk.name + ', ' + perk.desc; }\n" +
    "      if (stars === 3 || (firstWin && L.n % 4 === 0)) {");
rep("        reward = 'Reward: +1 ' + (kind === 'hammer' ? 'Hammer ' + HAMMER : '+5 Moves booster');",
    "        reward += '. Bonus: +1 ' + (kind === 'hammer' ? 'Hammer ' + HAMMER : '+5 Moves booster');");

fs.writeFileSync(f, s);
console.log('patched');
