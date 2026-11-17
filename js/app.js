/* Router + home screen */
(function () {
  var h = UI.h, app = document.getElementById('app');

  function share() {
    var data = { title: 'Game Night', text: 'Play chess, checkers and sudoku with me:', url: location.origin + location.pathname };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    try {
      navigator.clipboard.writeText(data.url).then(function () { UI.toast('Link copied. Text it to a friend!'); });
    } catch (e) { UI.toast(data.url); }
  }

  function home(root) {
    root.appendChild(h('div', { class: 'hero' }, [
      h('img', { class: 'logo', src: 'icon-180.png', alt: '', width: 84, height: 84 }),
      h('h1', { text: 'Game Night' }),
      h('p', { text: 'Classic games. Three levels each. Play the computer or a friend.' })
    ]));
    var cards = h('div', { class: 'gamecards' });
    [
      { id: 'chess', glyph: '♛︎', name: 'Chess', desc: 'With a full step-by-step tutorial' },
      { id: 'checkers', glyph: '⛂︎', name: 'Checkers', desc: 'Jumps, double jumps and kings' },
      { id: 'sudoku', glyph: '9', name: 'Sudoku', desc: 'Fresh puzzle every time, with notes and hints' }
    ].forEach(function (gm) {
      cards.appendChild(h('button', { class: 'gamecard ' + gm.id, onclick: function () { location.hash = '#/' + gm.id; } }, [
        h('div', { class: 'glyph', text: gm.glyph }),
        h('div', null, [h('h2', { text: gm.name }), h('p', { text: gm.desc })])
      ]));
    });
    root.appendChild(cards);
    root.appendChild(h('div', { class: 'homefoot' }, [
      h('button', { class: 'pill', text: '📤 Share with a friend', onclick: share }),
      h('button', { class: 'pill', text: '🎓 Learn chess', onclick: function () { location.hash = '#/chess/learn'; } })
    ]));
    var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!standalone) {
      root.appendChild(h('p', { class: 'installtip', html: 'Put it on your home screen: in Safari tap the Share button, then <b>Add to Home Screen</b>. It opens like an app and works offline.' }));
    }
  }

  var routes = {
    '': home,
    'chess': Chess.setup, 'chess/play': Chess.play, 'chess/learn': function (r) { Chess.learn(r, 0); },
    'checkers': Checkers.setup, 'checkers/play': Checkers.play, 'checkers/learn': Checkers.learn,
    'sudoku': Sudoku.setup, 'sudoku/play': Sudoku.play, 'sudoku/learn': Sudoku.learn
  };

  function route() {
    UI.closeModal();
    var path = location.hash.replace(/^#\/?/, '');
    var fn = routes[path] || home;
    app.innerHTML = '';
    fn(app);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
