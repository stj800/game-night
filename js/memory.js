/* Memory games: Memory Match (find the pairs) and Echo (repeat the growing sequence). */
function cpx(c) { return String.fromCodePoint(c); }

var MemoryMatch = (function () {
  var h = UI.h;
  var LEVELS = [
    { value: 1, label: 'Beginner', pairs: 6, cols: 3, peek: 2500, note: '12 cards. A quick peek at the start.' },
    { value: 2, label: 'Intermediate', pairs: 10, cols: 4, peek: 1500, note: '20 cards. A short peek at the start.' },
    { value: 3, label: 'Advanced', pairs: 15, cols: 5, peek: 0, note: '30 cards. No peek. Pure memory.' }
  ];
  var THEMES = {
    animals: { name: 'Animals', icons: [0x1F436, 0x1F431, 0x1F98A, 0x1F43B, 0x1F43C, 0x1F428, 0x1F42F, 0x1F981, 0x1F438, 0x1F435, 0x1F984, 0x1F427, 0x1F989, 0x1F422, 0x1F419] },
    garden: { name: 'Garden', icons: [0x1F33B, 0x1F337, 0x1F339, 0x1F33A, 0x1F338, 0x1F33C, 0x1F340, 0x1F344, 0x1F98B, 0x1F41D, 0x1F41E, 0x1F34E, 0x1F352, 0x1F955, 0x1F349] },
    travel: { name: 'Travel', icons: [0x2708, 0x1F697, 0x1F6A2, 0x1F682, 0x1F6B2, 0x1F3D6, 0x1F5FD, 0x1F3D4, 0x1F3A1, 0x1F680, 0x1F681, 0x1F3F0, 0x26F5, 0x1F30B, 0x1F3DD] }
  };

  function setup(root) {
    var cfg = UI.store('mm_cfg') || { level: 1, theme: 'animals' }, bests = UI.store('mm_best') || {};
    root.appendChild(UI.topbar('Memory Match', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { var b = bests[cfg.level]; noteEl.textContent = LEVELS[cfg.level - 1].note + (b ? ' Your best: ' + b.flips + ' flips in ' + fmt(b.time) + '.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Pictures' }), UI.seg(Object.keys(THEMES).map(function (k) { return { value: k, label: THEMES[k].name }; }), cfg.theme, function (v) { cfg.theme = v; })]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn memory', text: 'Play', onclick: function () { UI.store('mm_cfg', cfg); location.hash = '#/memory/play'; } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>All the cards are face down. Tap two cards to flip them. If they match, they stay face up. If not, they flip back, so remember where each picture was. Find every pair.</p>' +
      '<h3>Why it helps</h3><p>Remembering where things are (short-term visual memory) is one of the skills that most benefits from regular practice. A few rounds a day keeps it sharp.</p>' +
      '<h3>Tips</h3><ul><li>Work in a pattern, row by row, so locations stick.</li><li>Say the pictures in your head ("dog, top left").</li><li>Fewer flips is the real score. Speed comes later.</li></ul>' }));
  }
  function fmt(s) { var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }

  function play(root) {
    var cfg = UI.store('mm_cfg') || { level: 1, theme: 'animals' }, L = LEVELS[cfg.level - 1], T = THEMES[cfg.theme] || THEMES.animals;
    var scene = h('div', { class: 'memscene' }); root.appendChild(scene);
    root.appendChild(UI.topbar('Memory Match', '#/memory', Swap.soundToggles()));
    var bar = h('div', { class: 'sbar memorybar' }), grid = h('div', { class: 'memgrid' }), fx = h('div', { class: 'fxlayer' });
    root.appendChild(fx); root.appendChild(bar); root.appendChild(grid);
    root.appendChild(h('button', { class: 'ghostbtn', text: 'New board', onclick: start }));
    var cards, first, second, lock, flips, matched, time, timer, startedAt;
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function drawBar() {
      bar.innerHTML = '';
      bar.appendChild(h('span', { text: 'Pairs: ' + matched + ' / ' + L.pairs }));
      bar.appendChild(h('span', { text: 'Flips: ' + flips }));
      bar.appendChild(h('span', { text: '\u23F1 ' + fmt(time) }));
    }
    function start() {
      UI.closeModal(); clearInterval(timer);
      var icons = shuffle(T.icons.slice()).slice(0, L.pairs);
      cards = shuffle(icons.concat(icons).map(function (c, i) { return { id: i, icon: c, up: false, done: false }; }));
      first = second = null; lock = true; flips = 0; matched = 0; time = 0; startedAt = 0;
      grid.innerHTML = ''; grid.style.gridTemplateColumns = 'repeat(' + L.cols + ', 1fr)';
      cards.forEach(function (c) {
        var el = h('button', { class: 'memcard', 'aria-label': 'Card' }, h('span', { class: 'mcin' }, [h('span', { class: 'mcback' }), h('span', { class: 'mcfront', text: cpx(c.icon) })]));
        el.addEventListener('click', function () { flip(c); });
        c.el = el; grid.appendChild(el);
      });
      drawBar();
      if (L.peek) {
        cards.forEach(function (c) { c.el.classList.add('up'); });
        setTimeout(function () { cards.forEach(function (c) { c.el.classList.remove('up'); }); lock = false; }, L.peek);
      } else lock = false;
      timer = setInterval(function () { if (!document.body.contains(grid)) { clearInterval(timer); return; } if (startedAt && !document.hidden && matched < L.pairs) { time++; drawBar(); } }, 1000);
    }
    function flip(c) {
      if (lock || c.done || c === first) return;
      if (!startedAt) startedAt = Date.now();
      c.el.classList.add('up'); Sound.play('land'); UI.vibrate(5);
      if (!first) { first = c; return; }
      second = c; flips++; lock = true; drawBar();
      if (first.icon === second.icon) {
        var a = first, b = second;
        setTimeout(function () {
          a.done = b.done = true; a.el.classList.add('done'); b.el.classList.add('done');
          matched++; Sound.play('pop', 2 + matched % 5); sparkle(a.el); sparkle(b.el); drawBar();
          first = second = null; lock = false;
          if (matched === L.pairs) win();
        }, 350);
      } else {
        var x = first, y = second;
        setTimeout(function () { x.el.classList.remove('up'); y.el.classList.remove('up'); x.el.classList.add('miss'); y.el.classList.add('miss');
          setTimeout(function () { x.el.classList.remove('miss'); y.el.classList.remove('miss'); }, 300);
          first = second = null; lock = false; }, 850);
      }
    }
    function sparkle(el) {
      var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var k = 0; k < 8; k++) {
        var d = h('i', { class: 'particle' }), ang = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 30;
        d.style.left = cx + 'px'; d.style.top = cy + 'px'; d.style.background = ['#ffcf3f', '#3ee08f', '#3fb4ff', '#ff6bd6'][k % 4];
        d.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); d.style.setProperty('--dy', Math.sin(ang) * dist + 'px'); d.style.width = d.style.height = '6px';
        d.addEventListener('animationend', function () { this.remove(); }); fx.appendChild(d);
      }
    }
    function win() {
      clearInterval(timer);
      var bests = UI.store('mm_best') || {}, b = bests[cfg.level], isBest = !b || flips < b.flips || (flips === b.flips && time < b.time);
      if (isBest) { bests[cfg.level] = { flips: flips, time: time }; UI.store('mm_best', bests); }
      var perfect = flips === L.pairs;
      UI.confetti(); Sound.play('win');
      setTimeout(function () {
        UI.modal({ big: perfect ? '\uD83E\uDDE0' : '\uD83C\uDF89', title: perfect ? 'Perfect memory!' : 'All pairs found!',
          text: flips + ' flips in ' + fmt(time) + '. The least possible is ' + L.pairs + '.' + (isBest ? ' New personal best!' : ''),
          buttons: [{ label: 'Play again', cls: 'memory', fn: start }, { label: 'Back to menu', fn: function () { location.hash = '#/memory'; } }] });
      }, 600);
    }
    start();
    Sound.playMusic('zen', scene);
    root.addEventListener('pointerdown', function first2() { if (!document.body.contains(scene)) { root.removeEventListener('pointerdown', first2); return; } Sound.playMusic('zen', scene); });
  }
  return { setup: setup, play: play };
})();

var Echo = (function () {
  var h = UI.h;
  var LEVELS = [
    { value: 1, label: 'Beginner', pads: 4, speed: 650, note: '4 pads, relaxed pace.' },
    { value: 2, label: 'Intermediate', pads: 6, speed: 520, note: '6 pads, a little quicker.' },
    { value: 3, label: 'Advanced', pads: 9, speed: 420, note: '9 pads, brisk pace.' }
  ];
  // Each pad: color, icon, musical note (pentatonic so any order sounds pleasant)
  var PADS = [
    { c: '#ff5d73', icon: 0x2B50, m: 60 }, { c: '#3fb4ff', icon: 0x1F319, m: 62 }, { c: '#3ee08f', icon: 0x1F340, m: 64 },
    { c: '#ffcf3f', icon: 0x2600, m: 67 }, { c: '#b06bff', icon: 0x1F48E, m: 69 }, { c: '#ff8a3d', icon: 0x1F525, m: 72 },
    { c: '#ff6bd6', icon: 0x1F338, m: 74 }, { c: '#12b6c9', icon: 0x1F4A7, m: 76 }, { c: '#9be35f', icon: 0x1F343, m: 79 }
  ];

  function setup(root) {
    var cfg = UI.store('ec_cfg') || { level: 1 }, bests = UI.store('ec_best') || {};
    root.appendChild(UI.topbar('Echo', '#/'));
    var noteEl = h('p', { class: 'levelnote' });
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note + (bests[cfg.level] ? ' Your record: ' + bests[cfg.level] + ' steps.' : ''); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn echo', text: 'Play', onclick: function () { UI.store('ec_cfg', cfg); location.hash = '#/echo/play'; } }));
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>How to play</h3><p>Watch and listen: the pads light up one at a time, each with its own tone. Then tap them back in the same order. Every round adds one more step. How long a sequence can you remember?</p>' +
      '<h3>Why it helps</h3><p>Holding a growing sequence in mind trains working memory and attention, the same skills used to remember a phone number or a list of errands.</p>' +
      '<h3>Tips</h3><ul><li>Hum the tones along with the lights. Sound helps memory.</li><li>Group the steps in threes, like a phone number.</li>' +
      '<li>A mistake is not the end: you get one free retry per game.</li></ul>' }));
  }

  function play(root) {
    var cfg = UI.store('ec_cfg') || { level: 1 }, L = LEVELS[cfg.level - 1];
    var scene = h('div', { class: 'memscene echoscene' }); root.appendChild(scene);
    root.appendChild(UI.topbar('Echo', '#/echo', Swap.soundToggles()));
    var status = h('div', { class: 'status echostatus' }), bar = h('div', { class: 'sbar memorybar' });
    var cols = L.pads === 4 ? 2 : 3, board = h('div', { class: 'echoboard', style: 'grid-template-columns: repeat(' + cols + ', 1fr)' });
    root.appendChild(bar); root.appendChild(status); root.appendChild(board);
    var startBtn = h('button', { class: 'bigbtn echo', text: 'Start' });
    root.appendChild(startBtn);
    var seq = [], pos = 0, accepting = false, retryUsed = false, best = (UI.store('ec_best') || {})[cfg.level] || 0, pads = [];
    for (var i = 0; i < L.pads; i++) (function (k) {
      var p = PADS[k], el = h('button', { class: 'echopad', style: '--c:' + p.c, 'aria-label': 'Pad ' + (k + 1) }, h('span', { text: cpx(p.icon) }));
      el.addEventListener('pointerdown', function (e) { e.preventDefault(); press(k); });
      pads.push(el); board.appendChild(el);
    })(i);
    function drawBar() {
      bar.innerHTML = '';
      bar.appendChild(h('span', { text: 'Step: ' + seq.length }));
      bar.appendChild(h('span', { text: 'Record: ' + best }));
      bar.appendChild(h('span', { text: retryUsed ? 'Retry used' : 'Retry: 1' }));
    }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function light(k, ms) {
      var el = pads[k]; el.classList.add('lit'); Sound.chime && Sound.chime(PADS[k].m, ms / 1000);
      setTimeout(function () { el.classList.remove('lit'); }, ms * 0.8);
    }
    async function playback() {
      accepting = false; status.textContent = 'Watch...'; status.className = 'status echostatus';
      await wait(600);
      var sp = Math.max(260, L.speed - seq.length * 12);
      for (var i = 0; i < seq.length; i++) {
        if (!document.body.contains(board)) return;
        light(seq[i], sp); await wait(sp + 120);
      }
      pos = 0; accepting = true; status.textContent = 'Your turn: ' + seq.length + (seq.length === 1 ? ' step' : ' steps');
    }
    async function nextRound() {
      seq.push(Math.floor(Math.random() * L.pads)); drawBar(); await playback();
    }
    async function press(k) {
      if (!accepting) return;
      light(k, 260); UI.vibrate(6);
      if (k === seq[pos]) {
        pos++;
        if (pos === seq.length) {
          accepting = false;
          if (seq.length > best) { best = seq.length; var b = UI.store('ec_best') || {}; b[cfg.level] = best; UI.store('ec_best', b); }
          status.textContent = seq.length % 5 === 0 ? 'Brilliant! ' + seq.length + ' in a row!' : 'Nice!'; status.className = 'status echostatus good';
          if (seq.length % 5 === 0) { Sound.play('combo', 3); UI.confetti(); }
          await wait(700); nextRound();
        }
      } else {
        accepting = false; Sound.play('nope'); board.classList.add('shake'); setTimeout(function () { board.classList.remove('shake'); }, 400);
        if (!retryUsed) {
          retryUsed = true; drawBar(); status.textContent = 'Oops! One free retry. Watch again.'; status.className = 'status echostatus alert';
          await wait(1100); playback();
        } else {
          var score = seq.length - 1;
          UI.modal({ big: score >= 10 ? '\uD83E\uDDE0' : '\uD83C\uDFB5', title: 'You remembered ' + score + (score === 1 ? ' step' : ' steps'),
            text: (score >= best && score > 0 ? 'That ties or beats your record! ' : 'Your record is ' + best + '. ') + 'Most people start around 7 or 8. Practice stretches it.',
            buttons: [{ label: 'Play again', cls: 'echo', fn: reset }, { label: 'Back to menu', fn: function () { location.hash = '#/echo'; } }] });
        }
      }
    }
    function reset() { UI.closeModal(); seq = []; retryUsed = false; startBtn.style.display = 'none'; drawBar(); nextRound(); }
    startBtn.addEventListener('click', function () { Sound.unlockVoice(); reset(); });
    status.textContent = 'Tap Start, then repeat the pattern.';
    drawBar();
    // No background music in Echo: the pad tones ARE the puzzle
  }
  return { setup: setup, play: play };
})();
