// One-off patch: remove "Friend (same phone)" pass-and-play from Chess and Checkers. Computer opponent only.
var fs = require('fs');
function patch(file, pairs) {
  var f = __dirname + '/../js/' + file, s = fs.readFileSync(f, 'utf8');
  pairs.forEach(function (p) { if (s.indexOf(p[0]) < 0) throw new Error(file + ' missing: ' + p[0].slice(0, 60)); s = s.split(p[0]).join(p[1]); });
  fs.writeFileSync(f, s);
}
patch('chess.js', [
  ["    function showAi() { levelPanel.style.display = colorPanel.style.display = cfg.mode === 'ai' ? '' : 'none'; }\n" +
   "    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Opponent' }),\n" +
   "      UI.seg([{ value: 'ai', label: 'Computer' }, { value: 'pp', label: 'Friend (same phone)' }], cfg.mode,\n" +
   "        function (v) { cfg.mode = v; showAi(); })]));\n", ""],
  ["    setNote(); showAi();", "    setNote();"],
  ["{ mode: cfg.mode, level: cfg.level, human: human, moves: [] }", "{ mode: 'ai', level: cfg.level, human: human, moves: [] }"],
  ["    var ai = g.mode === 'ai', human = g.human || 'w';", "    var ai = true, human = g.human || 'w'; // computer opponent only"]
]);
patch('checkers.js', [
  ["    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Opponent' }),\n" +
   "      UI.seg([{ value: 'ai', label: 'Computer' }, { value: 'pp', label: 'Friend (same phone)' }], cfg.mode,\n" +
   "        function (v) { cfg.mode = v; lp.style.display = v === 'ai' ? '' : 'none'; })]));\n", ""],
  ["    root.appendChild(lp); setNote(); lp.style.display = cfg.mode === 'ai' ? '' : 'none';", "    root.appendChild(lp); setNote();"],
  ["{ mode: cfg.mode, level: cfg.level, hist: [] }", "{ mode: 'ai', level: cfg.level, hist: [] }"],
  ["    var ai = g.mode === 'ai', s = initial()", "    var ai = true, s = initial()"]
]);
patch('app.js', [["Six games. Three levels each. Play the computer or a friend.", "Six games. Three levels each. Beat the computer, clear the board."]]);
console.log('patched');
