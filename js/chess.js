/* Chess screens: setup, game, tutorial */
var Chess = (function () {
  var E = ChessEngine, h = UI.h;
  var GLYPH = { K: '\u265A', Q: '\u265B', R: '\u265C', B: '\u265D', N: '\u265E', P: '\u265F' };
  var VS = '\uFE0E';
  var LEVELS = [
    { value: 1, label: 'Beginner', note: 'Plays fast and makes mistakes. Great for learning how the pieces move.' },
    { value: 2, label: 'Intermediate', note: 'Looks two moves ahead and grabs loose pieces. A fair fight.' },
    { value: 3, label: 'Advanced', note: 'Thinks several moves deep. Protect every piece and watch for tricks.' }
  ];

  function pieceEl(p) {
    return h('span', { class: 'piece ' + E.colorOf(p), text: GLYPH[E.typeOf(p)] + VS });
  }

  function renderBoard(el, s, o) {
    el.innerHTML = '';
    var checkSq = E.inCheck(s, s.turn) ? E.kingSq(s, s.turn) : -1;
    for (var k = 0; k < 64; k++) {
      var i = o.flipped ? 63 - k : k, r = Math.floor(i / 8), c = i % 8;
      var cls = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      if (o.last && (o.last.f === i || o.last.t === i)) cls += ' last';
      if (o.hint && (o.hint.f === i || o.hint.t === i)) cls += ' hint';
      if (o.sel === i) cls += ' sel';
      if (i === checkSq) cls += ' check';
      if (o.targets && o.targets.indexOf(i) >= 0) cls += ' target' + (s.b[i] || (o.epTarget === i) ? ' cap' : '');
      if (o.goals && o.goals.indexOf(i) >= 0 && !s.b[i]) cls += ' goal';
      var sq = h('div', { class: cls, 'data-i': i });
      if (s.b[i]) sq.appendChild(pieceEl(s.b[i]));
      var showFile = o.flipped ? r === 0 : r === 7, showRank = o.flipped ? c === 7 : c === 0;
      if (showFile) sq.appendChild(h('span', { class: 'coord file', text: 'abcdefgh'[c] }));
      if (showRank) sq.appendChild(h('span', { class: 'coord rank', text: String(8 - r) }));
      (function (idx) { sq.addEventListener('click', function () { o.onTap(idx); }); })(i);
      el.appendChild(sq);
    }
  }

  function askPromotion(color, cb) {
    var row = h('div', { class: 'promo' });
    ['Q', 'R', 'B', 'N'].forEach(function (t) {
      row.appendChild(h('button', { onclick: function () { UI.closeModal(); cb(t); } },
        pieceEl(color === 'w' ? t : t.toLowerCase())));
    });
    UI.modal({ title: 'Promote your pawn', text: 'Pick the piece it becomes. Most players pick the queen.', body: row, dismiss: false });
  }

  // ---------- Setup ----------
  function setup(root) {
    var cfg = UI.store('chess_cfg') || { mode: 'ai', level: 1, color: 'w' };
    var saved = UI.store('chess_game');
    root.appendChild(UI.topbar('Chess', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note; }
    var levelPanel = h('div', { class: 'panel' }, [h('h3', { text: 'Level' }),
      UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]);
    var colorPanel = h('div', { class: 'panel' }, [h('h3', { text: 'You play' }),
      UI.seg([{ value: 'w', label: 'White' }, { value: 'b', label: 'Black' }, { value: 'r', label: 'Random' }], cfg.color,
        function (v) { cfg.color = v; })]);
    function showAi() { levelPanel.style.display = colorPanel.style.display = cfg.mode === 'ai' ? '' : 'none'; }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Opponent' }),
      UI.seg([{ value: 'ai', label: 'Computer' }, { value: 'pp', label: 'Friend (same phone)' }], cfg.mode,
        function (v) { cfg.mode = v; showAi(); })]));
    root.appendChild(levelPanel);
    root.appendChild(colorPanel);
    setNote(); showAi();
    root.appendChild(h('button', { class: 'bigbtn chess', text: 'Start game', onclick: function () {
      UI.store('chess_cfg', cfg);
      var human = cfg.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : cfg.color;
      UI.store('chess_game', { mode: cfg.mode, level: cfg.level, human: human, moves: [] });
      location.hash = '#/chess/play';
    } }));
    if (saved && saved.moves && saved.moves.length) {
      root.appendChild(h('button', { class: 'ghostbtn', text: 'Continue your last game (' + saved.moves.length + ' moves)',
        onclick: function () { location.hash = '#/chess/play'; } }));
    }
    root.appendChild(h('button', { class: 'ghostbtn', text: 'Learn to play (tutorial)', onclick: function () { location.hash = '#/chess/learn'; } }));
  }

  // ---------- Game ----------
  function play(root) {
    var g = UI.store('chess_game');
    if (!g) { location.hash = '#/chess'; return; }
    var ai = g.mode === 'ai', human = g.human || 'w';
    var s = E.initial(), hist = [], reps = {}, sel = -1, targets = [], hint = null, thinking = false, over = false;
    var flipped = ai && human === 'b';
    reps[E.key(s)] = 1;
    g.moves.forEach(function (mv) {
      var m = E.legal(s, mv.f).filter(function (x) { return x.t === mv.t && (x.pr || null) === (mv.pr || null); })[0];
      if (m) applyMove(m, true);
    });

    var title = ai ? 'Chess vs Computer' : 'Chess - 2 players';
    root.appendChild(UI.topbar(title, '#/chess'));
    var topP = h('div', { class: 'players' }), botP = h('div', { class: 'players' });
    var statusEl = h('div', { class: 'status' });
    var boardEl = h('div', { class: 'board' });
    var moveList = h('div', { class: 'movelist' });
    var undoBtn = UI.tbtn('&#8630;', 'Undo', undo);
    var hintBtn = UI.tbtn('&#128161;', 'Hint', showHint);
    var tools = h('div', { class: 'toolbar' }, [undoBtn, hintBtn,
      UI.tbtn('&#8645;', 'Flip', function () { flipped = !flipped; draw(); }),
      UI.tbtn('&#10227;', 'New', function () {
        UI.modal({ title: 'Start a new game?', text: 'This game will end.', buttons: [
          { label: 'New game', fn: function () { location.hash = '#/chess'; } }, { label: 'Keep playing' }] });
      })]);
    root.appendChild(statusEl);
    root.appendChild(topP);
    root.appendChild(boardEl);
    root.appendChild(botP);
    root.appendChild(tools);
    root.appendChild(moveList);

    function nameOf(color) {
      if (!ai) return color === 'w' ? 'White' : 'Black';
      return color === human ? 'You' : 'Computer (' + LEVELS[g.level - 1].label + ')';
    }
    function capturedBy(color) {
      // pieces of the other color missing from the board
      var start = { P: 8, N: 2, B: 2, R: 2, Q: 1 }, have = { P: 0, N: 0, B: 0, R: 0, Q: 0 }, out = '';
      var other = color === 'w' ? 'b' : 'w';
      s.b.forEach(function (p) { if (p && E.colorOf(p) === other && E.typeOf(p) !== 'K') have[E.typeOf(p)]++; });
      ['Q', 'R', 'B', 'N', 'P'].forEach(function (t) {
        for (var i = 0; i < Math.max(0, start[t] - have[t]); i++) out += GLYPH[t] + VS;
      });
      return out;
    }
    function playerRow(el, color) {
      el.innerHTML = '';
      el.appendChild(h('div', { class: 'who' + (s.turn === color && !over ? ' active' : '') }, [
        h('span', { class: 'dot', style: 'background:' + (color === 'w' ? '#fff' : '#1d1638') }), nameOf(color)]));
      el.appendChild(h('div', { class: 'captures', text: capturedBy(color) }));
    }

    function applyMove(m, silent) {
      var sanTxt = E.san(s, m);
      hist.push({ s: s, m: m, san: sanTxt });
      s = E.make(s, m);
      var k = E.key(s); reps[k] = (reps[k] || 0) + 1;
      if (!silent) {
        g.moves.push({ f: m.f, t: m.t, pr: m.pr });
        UI.store('chess_game', g);
        UI.vibrate(m.c ? 25 : 10);
      }
    }

    function result() {
      var moves = E.legal(s);
      if (!moves.length) {
        if (E.inCheck(s, s.turn)) return { kind: 'mate', winner: s.turn === 'w' ? 'b' : 'w' };
        return { kind: 'draw', why: 'Stalemate. The player to move has no legal moves but is not in check.' };
      }
      if (s.half >= 100) return { kind: 'draw', why: '50 moves in a row with no capture or pawn move.' };
      if (reps[E.key(s)] >= 3) return { kind: 'draw', why: 'The same position came up three times.' };
      if (E.insufficient(s)) return { kind: 'draw', why: 'Not enough pieces left for anyone to checkmate.' };
      return null;
    }

    function draw() {
      renderBoard(boardEl, s, { flipped: flipped, sel: sel, targets: targets, hint: hint,
        last: hist.length ? hist[hist.length - 1].m : null, onTap: tap, epTarget: s.ep });
      playerRow(flipped ? botP : topP, 'b');
      playerRow(flipped ? topP : botP, 'w');
      var txt = '', alert = false, res = result();
      if (res) {
        txt = res.kind === 'mate' ? 'Checkmate! ' + nameOf(res.winner) + (ai && res.winner === human ? ' win!' : ' wins!') : 'Draw';
        alert = true;
      } else if (thinking) txt = 'Computer is thinking...';
      else {
        txt = (ai ? (s.turn === human ? 'Your move' : 'Computer to move') : nameOf(s.turn) + ' to move');
        if (E.inCheck(s, s.turn)) { txt = 'Check! ' + txt; alert = true; }
      }
      statusEl.innerHTML = '';
      statusEl.appendChild(thinking ? h('span', { class: 'thinking', text: txt }) : document.createTextNode(txt));
      statusEl.className = 'status' + (alert ? ' alert' : '');
      var parts = [];
      for (var i = 0; i < hist.length; i += 2) {
        parts.push((i / 2 + 1) + '. ' + hist[i].san + (hist[i + 1] ? ' ' + hist[i + 1].san : ''));
      }
      moveList.textContent = parts.join('   ');
      moveList.scrollTop = moveList.scrollHeight;
      undoBtn.disabled = thinking || !canUndo();
      hintBtn.disabled = thinking || over || (ai && s.turn !== human);
    }

    function finish() {
      var res = result();
      if (!res || over) return;
      over = true;
      UI.store('chess_game', null);
      var win = res.kind === 'mate' && (!ai || res.winner === human);
      if (win) UI.confetti();
      UI.modal({
        big: res.kind === 'mate' ? (win ? '\uD83C\uDFC6' : '\u265A') : '\uD83E\uDD1D',
        title: res.kind === 'mate' ? (ai ? (res.winner === human ? 'You win!' : 'The computer wins') : nameOf(res.winner) + ' wins!') : 'Draw',
        text: res.kind === 'mate' ? 'Checkmate in ' + Math.ceil(hist.length / 2) + ' moves.' : res.why,
        buttons: [{ label: 'Play again', fn: function () { location.hash = '#/chess'; } }, { label: 'Look at the board' }]
      });
    }

    function afterMove() {
      sel = -1; targets = []; hint = null;
      draw();
      if (result()) { setTimeout(finish, 400); return; }
      if (ai && s.turn !== human) computerMove();
    }

    function computerMove() {
      thinking = true; draw();
      setTimeout(function () {
        var m = E.bestMove(s, g.level, reps);
        thinking = false;
        if (!m || !document.body.contains(boardEl)) return;
        applyMove(m);
        afterMove();
      }, 350);
    }

    function tap(i) {
      if (thinking || over || (ai && s.turn !== human)) return;
      if (sel >= 0 && targets.indexOf(i) >= 0) {
        var opts = E.legal(s, sel).filter(function (m) { return m.t === i; });
        if (opts.length > 1) {
          askPromotion(s.turn, function (t) {
            applyMove(opts.filter(function (m) { return m.pr === t; })[0]);
            afterMove();
          });
        } else { applyMove(opts[0]); afterMove(); }
        return;
      }
      if (s.b[i] && E.colorOf(s.b[i]) === s.turn && sel !== i) {
        sel = i;
        targets = E.legal(s, i).map(function (m) { return m.t; });
        UI.vibrate(6);
      } else { sel = -1; targets = []; }
      draw();
    }

    function canUndo() {
      if (!ai) return hist.length > 0;
      return hist.some(function (x) { return x.s.turn === human; });
    }

    function undo() {
      if (thinking || !canUndo()) return;
      if (over) { over = false; UI.store('chess_game', g); }
      // Take back one move (friend mode) or back to your last move (vs computer).
      do {
        var k = E.key(s); reps[k]--;
        s = hist.pop().s;
        g.moves.pop();
      } while (ai && hist.length && s.turn !== human);
      UI.store('chess_game', g);
      sel = -1; targets = []; hint = null;
      draw();
    }

    function showHint() {
      if (thinking || over) return;
      hint = E.bestMove(s, 2, reps);
      sel = -1; targets = [];
      draw();
      if (hint) UI.toast('Try ' + E.san(s, hint));
    }

    draw();
    if (result()) finish();
    else if (ai && s.turn !== human) computerMove();
  }

  // ---------- Tutorial ----------
  var LESSONS = [
    { name: 'Board', title: 'The board and the goal',
      text: 'Chess is played on 8 x 8 squares. Each side starts with 16 pieces: 1 king, 1 queen, 2 rooks, 2 bishops, 2 knights and 8 pawns. White always moves first, then you take turns. You win by trapping the other king so it cannot escape. That is called checkmate.',
      rows: ['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'], view: true },
    { name: 'King', title: 'The king',
      text: 'The king moves one square in any direction. He is the most important piece: lose him and you lose the game. So he is slow and careful.',
      goal: 'Walk the king to the star.', rows: ['........', '........', '........', '........', '........', '........', '........', '....K...'],
      goals: ['e4'], check: 'reach' },
    { name: 'Rook', title: 'The rook',
      text: 'The rook moves in straight lines, up, down, left or right, as far as it likes. It cannot jump over pieces. You capture by landing on an enemy piece.',
      goal: 'Capture both black pawns.', rows: ['........', '........', 'p.......', '........', '........', '........', '........', 'R......p'], check: 'clear' },
    { name: 'Bishop', title: 'The bishop',
      text: 'The bishop moves diagonally as far as it likes. A bishop that starts on a light square stays on light squares for the whole game.',
      goal: 'Capture both black pawns.', rows: ['........', '........', '.......p', '........', '........', '....p...', '........', '..B.....'], check: 'clear' },
    { name: 'Queen', title: 'The queen',
      text: 'The queen is the strongest piece. She moves like a rook and a bishop combined: any straight line or diagonal, as far as she likes.',
      goal: 'Capture all three black pawns.', rows: ['........', '...p....', '........', '........', '........', 'p......p', '........', '...Q....'], check: 'clear' },
    { name: 'Knight', title: 'The knight',
      text: 'The knight moves in an L: two squares one way, then one square to the side. It is the only piece that can jump over other pieces.',
      goal: 'Capture all three black pawns.', rows: ['........', '........', '.....p..', '........', '....p...', '..p.....', '........', '.N......'], check: 'clear' },
    { name: 'Pawn', title: 'The pawn',
      text: 'Pawns move straight forward one square, or two squares on their very first move. They capture one square diagonally forward. A pawn that reaches the far side becomes any piece you want, usually a queen.',
      goal: 'Get your pawn to the far side. You will need a capture.', rows: ['........', '........', '........', '...pp...', '........', '........', '....P...', '........'], check: 'promote' },
    { name: 'Castling', title: 'Castling',
      text: 'Once per game you can castle: the king moves two squares toward a rook, and the rook hops to the other side of him. It tucks your king into safety. You can only castle if neither piece has moved, nothing is between them, and your king is not in check or passing through an attacked square.',
      goal: 'Tap the king, then tap two squares to the left or right.', rows: ['........', '........', '........', '........', '........', '........', 'PPP..PPP', 'R...K..R'],
      castle: { K: true, Q: true, k: false, q: false }, check: 'castle' },
    { name: 'En passant', title: 'En passant (a special pawn capture)',
      text: 'If an enemy pawn jumps two squares and lands right beside your pawn, you may capture it as if it had moved only one square. You must do it right away, on the very next move.',
      goal: 'Black just played d7 to d5. Capture it en passant.', rows: ['........', '........', '........', '...pP...', '........', '........', '........', '........'],
      ep: 'd6', check: 'ep' },
    { name: 'Check', title: 'Check',
      text: 'When a piece attacks the king, the king is in check. You must fix it right away. There are three ways: move the king, block the attack, or capture the attacker. The game will not let you make a move that leaves your king in check.',
      goal: 'Your king is in check from the rook. Get out of check.', rows: ['....r..k', '........', '........', '........', '........', '........', '...R....', '....K...'], check: 'any' },
    { name: 'Checkmate', title: 'Checkmate',
      text: 'Checkmate means the king is in check and there is no way out. That wins the game. A classic pattern is the back-rank mate: the king is trapped behind his own pawns.',
      goal: 'Deliver checkmate in one move.', rows: ['......k.', '.....ppp', '........', '........', '........', '........', '.....PPP', 'R.....K.'], check: 'mate' },
    { name: 'Tips', title: 'Five tips to win more',
      text: '1. Control the center squares with pawns and pieces. 2. Bring out knights and bishops early. 3. Castle in the first ten moves. 4. Do not bring the queen out too early. 5. Before every move ask: what is my opponent threatening? Piece values: pawn 1, knight 3, bishop 3, rook 5, queen 9.',
      rows: ['r.bqkb.r', 'pppp.ppp', '..n..n..', '....p...', '..B.P...', '.....N..', 'PPPP.PPP', 'RNBQK..R'], view: true }
  ];

  function idx(name) { return (8 - parseInt(name[1], 10)) * 8 + 'abcdefgh'.indexOf(name[0]); }

  function learn(root, startAt) {
    var done = UI.store('chess_lessons') || {};
    var cur = Math.min(Math.max(startAt || 0, 0), LESSONS.length - 1);
    root.appendChild(UI.topbar('Learn chess', '#/chess'));
    var nav = h('div', { class: 'lessonnav' });
    var textEl = h('div', { class: 'lessontext' });
    var boardEl = h('div', { class: 'board' });
    var btns = h('div', { class: 'lessonbtns' });
    root.appendChild(nav); root.appendChild(textEl); root.appendChild(boardEl); root.appendChild(btns);
    var L, s, sel, targets, last, solved;

    function load(n) {
      cur = n; L = LESSONS[n];
      s = E.fromPlacement(L.rows, 'w', L.castle);
      if (L.ep) s.ep = idx(L.ep);
      sel = -1; targets = []; last = null; solved = !!L.view;
      if (L.name === 'En passant') last = { f: idx('d7'), t: idx('d5') };
      render();
      var pill = nav.children[n]; if (pill && pill.scrollIntoView) pill.scrollIntoView({ inline: 'center', block: 'nearest' });
    }

    function blackCount() { return s.b.filter(function (p) { return p && E.colorOf(p) === 'b'; }).length; }

    function render() {
      nav.innerHTML = '';
      LESSONS.forEach(function (l, i) {
        nav.appendChild(h('button', { class: i === cur ? 'on' : '', text: (done[i] ? '\u2713 ' : '') + (i + 1) + '. ' + l.name,
          onclick: function () { load(i); } }));
      });
      textEl.innerHTML = '';
      textEl.appendChild(h('h3', { text: L.title }));
      textEl.appendChild(h('div', { text: L.text }));
      if (L.goal) textEl.appendChild(h('div', { class: 'goal', text: solved ? '\u2713 Nice work! Tap Next.' : 'Your turn: ' + L.goal }));
      renderBoard(boardEl, s, { sel: sel, targets: targets, last: last, onTap: tap, epTarget: s.ep,
        goals: (L.goals || []).map(idx) });
      btns.innerHTML = '';
      btns.appendChild(h('button', { text: 'Back', onclick: function () { if (cur > 0) load(cur - 1); else location.hash = '#/chess'; } }));
      btns.appendChild(h('button', { text: 'Reset', onclick: function () { load(cur); } }));
      btns.appendChild(h('button', { class: solved ? 'primary' : '', text: cur === LESSONS.length - 1 ? 'Play!' : 'Next',
        onclick: function () {
          if (cur === LESSONS.length - 1) location.hash = '#/chess';
          else load(cur + 1);
        } }));
    }

    function succeed() {
      solved = true; done[cur] = true; UI.store('chess_lessons', done);
      UI.vibrate(30);
      UI.toast('\u2713 Lesson complete!');
    }

    function doMove(m) {
      s = E.make(s, m); last = m; sel = -1; targets = [];
      var ok = false;
      if (L.check === 'reach') ok = s.b[idx(L.goals[0])] && E.colorOf(s.b[idx(L.goals[0])]) === 'w';
      else if (L.check === 'clear') ok = blackCount() === 0;
      else if (L.check === 'promote') ok = !!m.pr;
      else if (L.check === 'castle') ok = m.fl === 'ck' || m.fl === 'cq';
      else if (L.check === 'ep') ok = m.fl === 'ep';
      else if (L.check === 'any') ok = true;
      else if (L.check === 'mate') ok = s.turn === 'b' && E.inCheck(s, 'b') && E.legal(s).length === 0;
      if (ok && !solved) succeed();
      else if (!ok && (L.check === 'mate' || L.check === 'ep' || L.check === 'castle')) {
        UI.toast('Not quite. Tap Reset and try again.');
      }
      // keep it White's turn so the learner can keep moving
      if (!ok || L.check !== 'mate') { s.turn = 'w'; if (m.fl !== 'dbl') s.ep = -1; }
      render();
    }

    function tap(i) {
      if (L.view || (solved && (L.check === 'mate'))) return;
      if (sel >= 0 && targets.indexOf(i) >= 0) {
        var opts = E.legal(s, sel).filter(function (m) { return m.t === i; });
        if (opts.length > 1) askPromotion('w', function (t) { doMove(opts.filter(function (m) { return m.pr === t; })[0]); });
        else doMove(opts[0]);
        return;
      }
      if (s.b[i] && E.colorOf(s.b[i]) === 'w' && sel !== i) {
        sel = i; targets = E.legal(s, i).map(function (m) { return m.t; });
      } else { sel = -1; targets = []; }
      render();
    }
    load(cur);
  }

  return { setup: setup, play: play, learn: learn, renderBoard: renderBoard };
})();
