/* Rummy 500: you against 1-3 computer players, or 2 vs 2 teams with a partner across the table. */
var Rummy = (function () {
  var h = UI.h, E = RummyEngine;
  var LEVELS = [
    { value: 1, label: 'Beginner', note: 'Computers miss melds and toss good cards. Great for learning.' },
    { value: 2, label: 'Intermediate', note: 'Solid players. They dig into the discard pile when it pays.' },
    { value: 3, label: 'Advanced', note: 'Sharp players. They watch what you can lay off and hold it back.' }
  ];
  var BOTS = [{ n: 'Ava', a: 0x1F469 }, { n: 'Leo', a: 0x1F468 }, { n: 'Mia', a: 0x1F467 }];
  var COLORS = ['#ffcf3f', '#ff6b8b', '#3ee08f', '#5fb6ff'];
  function cp(c) { return String.fromCodePoint(c); }

  function setup(root) {
    var cfg = UI.store('rum_cfg') || { mode: '1', target: 500, level: 1 };
    root.appendChild(UI.topbar('Rummy 500', '#/'));
    var saved = UI.store('rum_game');
    if (saved && saved.phase !== 'gameover') {
      var sd = E.sides(saved);
      root.appendChild(h('button', { class: 'bigbtn rummy', text: 'Continue game (' + sideName(saved, 0) + ' ' + sd[0].score + ', hand ' + saved.round + ')',
        onclick: function () { location.hash = '#/rummy/play'; } }));
    }
    var noteEl = h('p', { class: 'levelnote' });
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Players' }), UI.seg([
      { value: '1', label: 'You + 1' }, { value: '2', label: 'You + 2' }, { value: '3', label: 'You + 3' }, { value: 'team', label: 'Teams 2v2' }
    ], cfg.mode, function (v) { cfg.mode = v; }),
      h('p', { class: 'levelnote', text: 'Teams: you and a computer partner sit across from each other and share one score against two computers.' })]));
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Play to' }), UI.seg([
      { value: 200, label: '200' }, { value: 300, label: '300' }, { value: 400, label: '400' }, { value: 500, label: '500' }
    ], cfg.target, function (v) { cfg.target = v; }), h('p', { class: 'levelnote', text: '200 is a quick game (a few hands). 500 is the classic.' })]));
    var dealNote = h('p', { class: 'levelnote' });
    function setDeal() {
      var n = cfg.mode === 'team' ? 4 : +cfg.mode + 1, std = n === 2 ? 13 : 7, d = cfg.deal ? Math.min(cfg.deal, n === 2 ? 13 : n === 3 ? 10 : 7) : std;
      dealNote.textContent = (cfg.deal ? d + ' cards each.' : 'Standard: ' + std + ' cards each (13 with 2 players, 7 with 3 or 4).') +
        (d <= 7 ? ' Fewer cards = faster, lighter hands.' : ' More cards = more melds, bigger swings.') + (cfg.deal && d < cfg.deal ? ' (Capped so the deck does not run dry: 3 players max 10, 4 players 7.)' : '');
    }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Cards dealt' }), UI.seg([
      { value: 0, label: 'Standard' }, { value: 7, label: '7' }, { value: 10, label: '10' }, { value: 13, label: '13' }
    ], cfg.deal || 0, function (v) { cfg.deal = v; setDeal(); }), dealNote]));
    setDeal();
    Array.prototype.forEach.call(root.querySelector('.panel .seg').children, function (b) { b.addEventListener('click', function () { setTimeout(setDeal, 0); }); });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note; }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: saved && saved.phase !== 'gameover' ? 'ghostbtn' : 'bigbtn rummy', text: 'New game', onclick: function () {
      UI.store('rum_cfg', cfg);
      var names = ['You'], teams = cfg.mode === 'team', n = teams ? 3 : +cfg.mode;
      for (var i = 0; i < n; i++) names.push(BOTS[i].n);
      if (teams) names = ['You', BOTS[0].n, BOTS[1].n, BOTS[2].n]; // seat 2 (Leo) is your partner
      UI.store('rum_game', E.newGame({ names: names, target: cfg.target, teams: teams, level: cfg.level, deal: cfg.deal || 0 }));
      location.hash = '#/rummy/play';
    } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>The goal</h3><p>Score points by laying cards on the table in <b>melds</b>. First to the target score wins.</p>' +
      '<h3>Melds</h3><ul><li><b>Set:</b> 3 or 4 cards of the same rank (7 7 7).</li><li><b>Run:</b> 3 or more in a row, same suit (4 5 6 of hearts). Aces go low (A 2 3) or high (Q K A), not around the corner.</li></ul>' +
      '<h3>Your turn</h3><ol><li><b>Draw:</b> tap the deck, or tap any card in the discard pile. If you take a card that is not on top, you also take every card above it, and you must play that card in a meld right away.</li>' +
      '<li><b>Meld:</b> tap cards to select them, then tap Meld. To <b>lay off</b> a single card on any meld already on the table (anyone\'s), select it and tap that meld.</li>' +
      '<li><b>Discard:</b> select one card and tap Discard. That ends your turn.</li></ol>' +
      '<h3>Scoring</h3><p>Cards you put on the table count for you. Cards still in your hand when someone goes out count against you. Aces 15 (1 point in A 2 3), face cards and 10s are 10, other cards are their number. The hand also ends when the deck runs out.</p>' +
      '<h3>Tips</h3><ul><li>Lay down melds early so you are not caught with points in your hand.</li><li>A big discard pile can be a gold mine, but every extra card you pick up counts against you if you get stuck with it.</li><li>Do not throw a card the next player can lay off.</li></ul>' }));
  }

  function sideName(s, k) {
    if (!s.teams) return s.players[k].name;
    return k === s.players[0].team ? 'Your team' : 'Their team';
  }

  function cardEl(c, cls) {
    var r = E.RANKS[E.rank(c)], su = E.SUITS[E.suit(c)];
    return h('div', { class: 'pcard ' + (E.red(c) ? 'red ' : '') + (cls || '') }, [
      h('span', { class: 'pc-tl', html: r + '<br>' + su }), h('span', { class: 'pc-mid', text: su })
    ]);
  }

  function play(root) {
    var s = UI.store('rum_game');
    if (!s) { location.hash = '#/rummy'; return; }
    var scene = h('div', { class: 'rumscene' }); root.appendChild(scene);
    root.appendChild(UI.topbar('Rummy 500', '#/rummy', h('button', { class: 'iconbtn', html: '&#128202;', 'aria-label': 'Scores', onclick: scoreSheet })));
    var opp = h('div', { class: 'rumopp' }), status = h('div', { class: 'status rumstatus' }), table = h('div', { class: 'rumtable' });
    var piles = h('div', { class: 'rumpiles' }), stockEl = h('button', { class: 'rumstock' }), discEl = h('div', { class: 'rumdisc' });
    piles.appendChild(stockEl); piles.appendChild(discEl);
    var handEl = h('div', { class: 'rumhand' }), acts = h('div', { class: 'rumacts' });
    [opp, status, table, piles, handEl, acts].forEach(function (x) { root.appendChild(x); });
    var sel = [], sortMode = UI.store('rum_sort') || 'suit', busy = false, fresh = {}, alive = true, hint = [];
    var btnMeld = h('button', { text: 'Meld', onclick: doMeld }), btnDisc = h('button', { text: 'Discard', onclick: doDiscard });
    var btnSort = h('button', { onclick: function () { sortMode = sortMode === 'suit' ? 'rank' : 'suit'; UI.store('rum_sort', sortMode); render(); } });
    var btnHint = h('button', { text: 'Hint', onclick: doHint });
    [btnMeld, btnDisc, btnSort, btnHint].forEach(function (b) { acts.appendChild(b); });
    stockEl.addEventListener('click', function () { if (myDraw()) { var c = E.drawStock(s); fresh = {}; fresh[c] = 1; Sound.play('land'); after('You drew ' + E.label(c) + ' from the deck.'); } });

    function save() { UI.store('rum_game', s); }
    function me() { return s.players[0]; }
    function myTurn() { return s.turn === 0 && !busy && (s.phase === 'draw' || s.phase === 'play'); }
    function myDraw() { return myTurn() && s.phase === 'draw'; }
    function sorted(hand) {
      return hand.slice().sort(function (a, b) {
        if (sortMode === 'suit') return E.suit(a) - E.suit(b) || E.rank(a) - E.rank(b);
        return E.rank(a) - E.rank(b) || E.suit(a) - E.suit(b);
      });
    }
    function setStatus(t, alert) { status.textContent = t; status.classList.toggle('alert', !!alert); }
    function prompt() {
      if (s.phase === 'draw') return 'Your turn. Draw from the deck, or tap a card in the discard pile.';
      if (s.mustUse !== null) return 'You must play the ' + E.label(s.mustUse) + ' in a meld (or lay it off) this turn.';
      return 'Meld or lay off if you can, then discard one card.';
    }
    function after(msg) { sel = []; hint = []; save(); render(); setStatus(msg + ' ' + prompt()); }

    function render() {
      if (!alive) return;
      // opponents + score
      opp.innerHTML = '';
      var sd = E.sides(s);
      s.players.forEach(function (p, i) {
        if (i === 0) return;
        var partner = s.teams && p.team === me().team;
        opp.appendChild(h('div', { class: 'rumchip' + (s.turn === i && s.phase !== 'over' && s.phase !== 'gameover' ? ' on' : ''), style: '--c:' + COLORS[i] }, [
          h('b', { text: cp(BOTS[i - 1].a) + ' ' + p.name + (partner ? ' (partner)' : '') }),
          h('span', { text: p.hand.length + ' cards' + (s.teams ? '' : ' \u00B7 ' + p.score) })
        ]));
      });
      var scoreTxt = s.teams ? 'Your team ' + sd[me().team].score + ' \u00B7 Them ' + sd[1 - me().team].score : 'You ' + me().score;
      opp.appendChild(h('div', { class: 'rumscore', text: scoreTxt + ' / ' + s.target + ' \u00B7 Hand ' + s.round }));
      // table melds
      table.innerHTML = '';
      if (!s.melds.length) table.appendChild(h('p', { class: 'rumempty', text: 'Melds will show up here.' }));
      var one = sel.length === 1 ? sel[0] : null;
      s.melds.forEach(function (m, mi) {
        var ok = one !== null && myTurn() && s.phase === 'play' && E.layOffResult(m, one);
        var g = h('button', { class: 'rummeld' + (ok ? ' can' : ''), style: '--c:' + COLORS[m.by] });
        m.cards.forEach(function (c) { g.appendChild(cardEl(c, 'sm')); });
        g.addEventListener('click', function () {
          if (!myTurn() || s.phase !== 'play') return;
          if (one === null) { UI.toast('Select one card from your hand, then tap a meld to lay it off.'); return; }
          if (!ok) { UI.toast(E.label(one) + ' does not fit that meld.'); Sound.play('nope'); return; }
          E.layOff(s, one, mi); Sound.play('pop', 3);
          if (s.phase === 'over' || s.phase === 'gameover') return roundOver();
          after('Laid off ' + E.label(one) + '.');
        });
        table.appendChild(g);
      });
      // piles
      stockEl.innerHTML = ''; stockEl.appendChild(h('div', { class: 'pcard back' }, h('span', { class: 'pc-mid', text: s.stock.length })));
      stockEl.classList.toggle('glow', myDraw());
      discEl.innerHTML = '';
      s.discard.forEach(function (c, i) {
        var el = cardEl(c, 'sm' + (myDraw() ? ' tap' : ''));
        el.addEventListener('click', function () { takeDiscard(i); });
        discEl.appendChild(el);
      });
      discEl.scrollLeft = discEl.scrollWidth;
      // hand
      handEl.innerHTML = '';
      var cards = sorted(me().hand), W = handEl.clientWidth || 340, CW = 52, n = cards.length;
      var rows = n > 14 ? 2 : 1, perRow = Math.ceil(n / rows);
      var step = perRow > 1 ? Math.min(CW + 4, (W - CW) / (perRow - 1)) : 0;
      handEl.style.height = (rows * 84 + 18) + 'px';
      cards.forEach(function (c, k) {
        var row = Math.floor(k / perRow), col = k % perRow;
        var el = cardEl(c, (sel.indexOf(c) >= 0 ? 'sel ' : '') + (fresh[c] ? 'fresh ' : '') + (c === s.mustUse ? 'must ' : '') + (hint.indexOf(c) >= 0 ? 'hint' : ''));
        el.style.left = (col * step) + 'px'; el.style.top = (row * 84 + 14) + 'px'; el.style.zIndex = k + 1;
        el.addEventListener('click', function () {
          if (!myTurn()) return;
          if (s.phase === 'draw') { UI.toast('Draw first: tap the deck or the discard pile.'); return; }
          var i = sel.indexOf(c); if (i >= 0) sel.splice(i, 1); else sel.push(c);
          Sound.play('land'); render();
        });
        handEl.appendChild(el);
      });
      // buttons
      var playing = myTurn() && s.phase === 'play';
      btnMeld.disabled = !(playing && sel.length >= 3 && E.asMeld(sel));
      btnDisc.disabled = !(playing && sel.length === 1 && E.canDiscard(s, sel[0]));
      btnSort.textContent = sortMode === 'suit' ? 'Sort: suit' : 'Sort: rank';
      btnHint.disabled = !myTurn();
    }

    function takeDiscard(i) {
      if (!myDraw()) return;
      var top = i === s.discard.length - 1;
      function go() {
        var r = E.drawDiscard(s, i);
        if (!r.ok) { Sound.play('nope'); UI.toast('You can only take the ' + E.label(s.discard[i]) + ' if you can play it right away.'); return; }
        fresh = {}; r.picked.forEach(function (c) { fresh[c] = 1; });
        Sound.play('swap');
        after(top ? 'You took the ' + E.label(r.picked[0]) + '.' : 'You took ' + r.picked.length + ' cards.');
      }
      if (top) return go();
      var n = s.discard.length - i;
      UI.modal({ title: 'Take ' + n + ' cards?', text: 'You get the ' + E.label(s.discard[i]) + ' and the ' + (n - 1) + ' card' + (n > 2 ? 's' : '') + ' above it. You must play the ' + E.label(s.discard[i]) + ' this turn.',
        buttons: [{ label: 'Take them', cls: 'rummy', fn: go }, { label: 'Cancel' }] });
    }
    function doMeld() {
      var m = E.meld(s, sel.slice()); if (!m) return;
      Sound.play('combo', 2);
      if (s.phase === 'over' || s.phase === 'gameover') return roundOver();
      after('Nice ' + (m.type === 'set' ? 'set' : 'run') + ', +' + m.pts + '.');
    }
    function doDiscard() {
      var c = sel[0];
      if (!E.canDiscard(s, c)) {
        if (s.mustUse !== null) UI.toast('Play the ' + E.label(s.mustUse) + ' first.');
        else if (c === s.tookTop) UI.toast('You cannot throw back the card you just took.');
        return;
      }
      E.discard(s, c); Sound.play('land'); sel = []; fresh = {}; save();
      if (s.phase === 'over' || s.phase === 'gameover') return roundOver();
      render(); bots();
    }
    function doHint() {
      if (!myTurn()) return;
      var hand = me().hand;
      if (s.phase === 'draw') {
        var d = E.aiDraw(s);
        if (d.from === 'stock') setStatus('Hint: nothing in the discard pile helps you. Draw from the deck.', true);
        else setStatus('Hint: take the ' + E.label(s.discard[d.index]) + (d.index < s.discard.length - 1 ? ' (and the cards above it)' : '') + ' from the discard pile.', true);
        return;
      }
      var b = E.bestMelds(hand, s.mustUse !== null && E.layOffTarget(s.melds, s.mustUse) < 0 ? s.mustUse : undefined);
      if (b && b.melds.length) { hint = b.melds[0].cards.slice(); sel = hint.slice(); render(); setStatus('Hint: these cards make a ' + b.melds[0].type + '. Tap Meld.', true); return; }
      for (var i = 0; i < hand.length; i++) if (E.layOffTarget(s.melds, hand[i]) >= 0) {
        sel = [hand[i]]; hint = sel.slice(); render(); setStatus('Hint: ' + E.label(hand[i]) + ' can be laid off. Tap the glowing meld.', true); return;
      }
      var dc = E.aiDiscard(s); sel = [dc]; hint = [dc]; render(); setStatus('Hint: no melds right now. Discard the ' + E.label(dc) + '.', true);
    }

    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function bots() {
      if (!alive || s.turn === 0 || s.phase !== 'draw') { if (alive) { render(); if (s.turn === 0 && s.phase === 'draw') setStatus(prompt()); } return; }
      busy = true; render();
      var p = s.players[s.turn], who = p.name + (s.teams && p.team === me().team ? ' (partner)' : '');
      setStatus(who + ' is thinking...');
      wait(800).then(function () {
        if (!alive) return;
        var d = E.aiDraw(s), msg;
        if (d.from === 'stock') { E.drawStock(s); msg = who + ' drew from the deck.'; }
        else { var r = E.drawDiscard(s, d.index); msg = who + ' took ' + (r.picked.length === 1 ? 'the ' + E.label(r.picked[0]) : r.picked.length + ' cards from the pile') + '.'; }
        Sound.play('land'); render(); setStatus(msg);
        return wait(900).then(function () {
          if (!alive) return;
          var actions = E.aiPlay(s), lines = [];
          actions.forEach(function (a) {
            if (a.t === 'meld') lines.push('melded ' + a.cards.map(E.label).join(' '));
            if (a.t === 'layoff') lines.push('laid off ' + E.label(a.card));
            if (a.t === 'discard') lines.push('threw the ' + E.label(a.card));
          });
          if (actions.some(function (a) { return a.t !== 'discard'; })) Sound.play('combo', 1); else Sound.play('land');
          save(); busy = false; render();
          setStatus(who + ' ' + (lines.join(', ') || 'played') + '.');
          if (s.phase === 'over' || s.phase === 'gameover') return wait(900).then(roundOver);
          return wait(1100).then(bots);
        });
      });
    }

    function scoreTable() {
      var t = h('table', { class: 'rumtbl' }), rows = s.result ? s.result.rows : null;
      t.appendChild(h('tr', null, [h('th', { text: '' }), h('th', { text: 'Table' }), h('th', { text: 'Hand' }), h('th', { text: 'Total' })]));
      s.players.forEach(function (p, i) {
        var r = rows ? rows[i] : { table: p.table, hand: E.handPoints(p.hand) };
        t.appendChild(h('tr', null, [h('td', { text: p.name }), h('td', { text: '+' + r.table }), h('td', { text: '-' + r.hand }), h('td', { text: String(p.score) })]));
      });
      if (s.teams) {
        var sd = E.sides(s);
        sd.forEach(function (x, k) { t.appendChild(h('tr', { class: 'team' }, [h('td', { text: sideName(s, k) }), h('td'), h('td'), h('td', { text: String(x.score) })])); });
      }
      return t;
    }
    function scoreSheet() {
      UI.modal({ title: 'Scores \u00B7 Hand ' + s.round, body: scoreTable(), text: 'Playing to ' + s.target + '.', buttons: [{ label: 'Back to the game', cls: 'rummy' }] });
    }
    function roundOver() {
      save(); render();
      var res = s.result, outBy = s.players[res.by];
      var head = res.how === 'out' ? (res.by === 0 ? 'You went out!' : outBy.name + ' went out.') : 'The deck ran out.';
      if (s.phase === 'gameover') {
        var mine = s.winner === me().team || (!s.teams && s.winner === 0);
        if (mine) { UI.confetti(); Sound.play('win'); } else Sound.play('lose');
        var bests = UI.store('rum_wins') || { w: 0, l: 0 };
        if (!s.recorded) { s.recorded = true; if (mine) bests.w++; else bests.l++; UI.store('rum_wins', bests); save(); }
        UI.modal({ big: mine ? '\uD83C\uDFC6' : '\uD83C\uDCCF', title: mine ? (s.teams ? 'Your team wins!' : 'You win!') : sideName(s, s.winner) + ' wins.',
          text: head + ' Your record: ' + bests.w + ' wins, ' + bests.l + ' losses.', body: scoreTable(), dismiss: false,
          buttons: [{ label: 'New game', cls: 'rummy', fn: function () { UI.store('rum_game', null); location.hash = '#/rummy'; } }] });
        return;
      }
      UI.modal({ title: head, body: scoreTable(), dismiss: false,
        buttons: [{ label: 'Deal the next hand', cls: 'rummy', fn: function () { E.nextRound(s); fresh = {}; sel = []; save(); render(); bots(); } }] });
    }

    var watch = setInterval(function () { if (!document.body.contains(scene)) { alive = false; clearInterval(watch); } }, 500);
    window.addEventListener('resize', function () { if (alive) render(); });
    render();
    if (s.phase === 'over' || s.phase === 'gameover') roundOver();
    else if (s.turn !== 0) bots();
    else setStatus(prompt());
  }
  return { setup: setup, play: play };
})();
