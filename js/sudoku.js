/* Sudoku: generator with a unique solution, notes, hints, timer */
var Sudoku = (function () {
  var h = UI.h;
  var LEVELS = [
    { value: 1, label: 'Beginner', givens: 40, note: 'Lots of numbers to start. Every move can be found by simple scanning.' },
    { value: 2, label: 'Intermediate', givens: 32, note: 'Fewer clues. You will want to use notes.' },
    { value: 3, label: 'Advanced', givens: 25, note: 'Sparse clues. Real thinking required.' }
  ];

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function ok(g, i, v) {
    var r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3;
    for (var k = 0; k < 9; k++) {
      if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false;
      if (g[(br + Math.floor(k / 3)) * 9 + bc + k % 3] === v) return false;
    }
    return true;
  }
  function fill(g) {
    var i = g.indexOf(0); if (i < 0) return true;
    var vals = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (var k = 0; k < 9; k++) { if (ok(g, i, vals[k])) { g[i] = vals[k]; if (fill(g)) return true; g[i] = 0; } }
    return false;
  }
  function countSolutions(g, limit) {
    // pick the empty cell with the fewest candidates
    var best = -1, bestC = null;
    for (var i = 0; i < 81; i++) {
      if (g[i]) continue;
      var cands = [];
      for (var v = 1; v <= 9; v++) if (ok(g, i, v)) cands.push(v);
      if (!cands.length) return 0;
      if (!bestC || cands.length < bestC.length) { best = i; bestC = cands; if (cands.length === 1) break; }
    }
    if (best < 0) return 1;
    var n = 0;
    for (var k = 0; k < bestC.length && n < limit; k++) {
      g[best] = bestC[k]; n += countSolutions(g, limit - n); g[best] = 0;
    }
    return n;
  }
  function generate(level) {
    var sol = new Array(81).fill(0); fill(sol);
    var puz = sol.slice(), target = LEVELS[level - 1].givens, filled = 81;
    var order = shuffle(Array.from({ length: 81 }, function (_, i) { return i; }));
    for (var k = 0; k < order.length && filled > target; k++) {
      var i = order[k], keep = puz[i];
      puz[i] = 0;
      if (countSolutions(puz.slice(), 2) !== 1) puz[i] = keep; else filled--;
    }
    return { puzzle: puz, solution: sol };
  }

  function fmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }

  function setup(root) {
    var cfg = UI.store('sd_cfg') || { level: 1 };
    var bests = UI.store('sd_best') || {};
    root.appendChild(UI.topbar('Sudoku', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note + (bests[cfg.level] ? ' Your best time: ' + fmt(bests[cfg.level]) + '.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn sudoku', text: 'New puzzle', onclick: function () {
      UI.store('sd_cfg', cfg);
      var p = generate(cfg.level);
      UI.store('sd_game', { level: cfg.level, puzzle: p.puzzle, solution: p.solution, cells: p.puzzle.slice(),
        notes: new Array(81).fill(0), time: 0, mistakes: 0, hints: 0 });
      location.hash = '#/sudoku/play';
    } }));
    var saved = UI.store('sd_game');
    if (saved && saved.cells) root.appendChild(h('button', { class: 'ghostbtn', text: 'Continue your puzzle (' + fmt(saved.time) + ')',
      onclick: function () { location.hash = '#/sudoku/play'; } }));
    root.appendChild(h('button', { class: 'ghostbtn', text: 'How to play', onclick: function () { location.hash = '#/sudoku/learn'; } }));
  }

  function play(root) {
    var g = UI.store('sd_game');
    if (!g) { location.hash = '#/sudoku'; return; }
    var sel = -1, notesMode = false, done = false, undoStack = [];
    root.appendChild(UI.topbar('Sudoku - ' + LEVELS[g.level - 1].label, '#/sudoku'));
    var bar = h('div', { class: 'sbar' }), grid = h('div', { class: 'sgrid' }), pad = h('div', { class: 'numpad' });
    var notesBtn;
    root.appendChild(bar); root.appendChild(grid); root.appendChild(pad);
    for (var n = 1; n <= 9; n++) (function (v) { pad.appendChild(h('button', { text: String(v), onclick: function () { enter(v); } })); })(n);
    notesBtn = UI.tbtn('&#9998;', 'Notes', function () { notesMode = !notesMode; draw(); });
    root.appendChild(h('div', { class: 'toolbar' }, [
      UI.tbtn('&#8630;', 'Undo', function () {
        var u = undoStack.pop(); if (!u) return;
        g.cells[u.i] = u.v; g.notes[u.i] = u.n; save(); draw();
      }),
      UI.tbtn('&#9003;', 'Erase', function () { if (sel >= 0 && !g.puzzle[sel]) { push(sel); g.cells[sel] = 0; g.notes[sel] = 0; save(); draw(); } }),
      notesBtn,
      UI.tbtn('&#128161;', 'Hint', hint)]));

    var timer = setInterval(function () {
      if (!document.body.contains(grid)) { clearInterval(timer); return; }
      if (done || document.hidden) return;
      g.time++; if (g.time % 5 === 0) save(); drawBar();
    }, 1000);

    function save() { UI.store('sd_game', g); }
    function push(i) { undoStack.push({ i: i, v: g.cells[i], n: g.notes[i] }); if (undoStack.length > 200) undoStack.shift(); }
    function drawBar() {
      bar.innerHTML = '';
      bar.appendChild(h('span', { text: 'Mistakes: ' + g.mistakes }));
      bar.appendChild(h('span', { text: 'Hints: ' + g.hints }));
      bar.appendChild(h('span', { text: '⏱ ' + fmt(g.time) }));
    }

    function draw() {
      drawBar();
      grid.innerHTML = '';
      var sr = Math.floor(sel / 9), sc = sel % 9, sv = sel >= 0 ? g.cells[sel] : 0;
      for (var i = 0; i < 81; i++) {
        var r = Math.floor(i / 9), c = i % 9, v = g.cells[i];
        var cls = 'cell' + (g.puzzle[i] ? ' given' : v ? ' user' : '');
        if (v && !g.puzzle[i] && v !== g.solution[i]) cls += ' err';
        if (c === 2 || c === 5) cls += ' bR';
        if (r === 2 || r === 5) cls += ' bB';
        if (i === sel) cls += ' selc';
        else if (sv && v === sv) cls += ' same';
        else if (sel >= 0 && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3)))) cls += ' peer';
        var cell = h('div', { class: cls });
        if (v) cell.textContent = String(v);
        else if (g.notes[i]) {
          var nt = h('div', { class: 'notes' });
          for (var k = 1; k <= 9; k++) nt.appendChild(h('span', { text: g.notes[i] & (1 << k) ? String(k) : '' }));
          cell.appendChild(nt);
        }
        (function (idx) { cell.addEventListener('click', function () { sel = idx; UI.vibrate(5); draw(); }); })(i);
        grid.appendChild(cell);
      }
      var counts = {};
      g.cells.forEach(function (v, i) { if (v && v === g.solution[i]) counts[v] = (counts[v] || 0) + 1; });
      Array.prototype.forEach.call(pad.children, function (b, k) { b.classList.toggle('done', counts[k + 1] === 9); });
      notesBtn.classList.toggle('on', notesMode);
    }

    function clearNotes(i, v) {
      var r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3, bit = 1 << v;
      for (var k = 0; k < 9; k++) {
        g.notes[r * 9 + k] &= ~bit; g.notes[k * 9 + c] &= ~bit;
        g.notes[(br + Math.floor(k / 3)) * 9 + bc + k % 3] &= ~bit;
      }
    }

    function enter(v) {
      if (done) return;
      if (sel < 0) { UI.toast('Tap a square first'); return; }
      if (g.puzzle[sel]) return;
      push(sel);
      if (notesMode) { if (!g.cells[sel]) g.notes[sel] ^= (1 << v); }
      else {
        if (g.cells[sel] === v) { g.cells[sel] = 0; }
        else {
          g.cells[sel] = v; g.notes[sel] = 0;
          if (v !== g.solution[sel]) { g.mistakes++; UI.vibrate([20, 40, 20]); }
          else clearNotes(sel, v);
        }
      }
      save(); draw(); check();
    }

    function hint() {
      if (done) return;
      var i = sel;
      if (i < 0 || g.puzzle[i] || g.cells[i] === g.solution[i]) {
        var empties = [];
        g.cells.forEach(function (v, k) { if (v !== g.solution[k]) empties.push(k); });
        if (!empties.length) return;
        i = empties[Math.floor(Math.random() * empties.length)];
      }
      push(i);
      g.cells[i] = g.solution[i]; g.notes[i] = 0; clearNotes(i, g.solution[i]); g.hints++; sel = i;
      save(); draw(); check();
    }

    function check() {
      for (var i = 0; i < 81; i++) if (g.cells[i] !== g.solution[i]) return;
      done = true;
      var bests = UI.store('sd_best') || {}, isBest = !bests[g.level] || g.time < bests[g.level];
      if (isBest && !g.hints) { bests[g.level] = g.time; UI.store('sd_best', bests); }
      UI.store('sd_game', null);
      UI.confetti();
      UI.modal({ big: '🎉', title: 'Solved!', text: 'Time ' + fmt(g.time) + ', ' + g.mistakes + (g.mistakes === 1 ? ' mistake, ' : ' mistakes, ') + g.hints + (g.hints === 1 ? ' hint.' : ' hints.') +
        (isBest && !g.hints ? ' New best time!' : ''),
        buttons: [{ label: 'Next puzzle', cls: 'sudoku', fn: function () { location.hash = '#/sudoku'; } }, { label: 'Admire it' }] });
    }

    draw();
  }

  function learn(root) {
    root.appendChild(UI.topbar('How to play sudoku', '#/sudoku'));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>The goal</h3><p>Fill every empty square with a number from 1 to 9 so that each row, each column and each 3 x 3 box has every number exactly once.</p>' +
      '<h3>How to enter numbers</h3><p>Tap a square, then tap a number below the grid. Tap the same number again to clear it. Wrong numbers turn red.</p>' +
      '<h3>Notes</h3><p>Turn on Notes to pencil in small candidate numbers. When you place a number, matching notes in the same row, column and box clear on their own.</p>' +
      '<h3>Three ways to find a number</h3><ul>' +
      '<li><b>Scan:</b> pick a number, say 5. Look at which rows and columns already have a 5. Often only one square in a box is left for it.</li>' +
      '<li><b>Last one left:</b> if a row, column or box has 8 numbers, the 9th is obvious.</li>' +
      '<li><b>Only fit:</b> look at one square and cross out every number already in its row, column and box. If one number is left, that is the answer.</li></ul>' +
      '<h3>Stuck?</h3><p>Tap Hint to fill in one correct square. Best times only count with no hints.</p>' }));
    root.appendChild(h('button', { class: 'bigbtn sudoku', text: 'Play sudoku', onclick: function () { location.hash = '#/sudoku'; } }));
  }

  return { setup: setup, play: play, learn: learn, _generate: generate, _count: countSolutions };
})();
if (typeof module !== 'undefined') module.exports = Sudoku;
