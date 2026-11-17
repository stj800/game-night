/* Shared UI helpers */
var UI = (function () {
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (kids !== undefined) {
      if (!Array.isArray(kids)) kids = [kids];
      kids.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }

  function store(key, val) {
    try {
      if (val === undefined) {
        var s = localStorage.getItem('gn_' + key);
        return s ? JSON.parse(s) : null;
      }
      if (val === null) localStorage.removeItem('gn_' + key);
      else localStorage.setItem('gn_' + key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  function closeModal() {
    var r = document.getElementById('modal-root');
    r.innerHTML = '';
  }

  function modal(opts) {
    closeModal();
    var root = document.getElementById('modal-root');
    var box = h('div', { class: 'modal' });
    if (opts.big) box.appendChild(h('div', { class: 'big', text: opts.big }));
    if (opts.title) box.appendChild(h('h2', { text: opts.title }));
    if (opts.text) box.appendChild(h('p', { text: opts.text }));
    if (opts.body) box.appendChild(opts.body);
    (opts.buttons || []).forEach(function (b, i) {
      box.appendChild(h('button', {
        class: i === 0 ? 'bigbtn ' + (b.cls || 'chess') : 'ghostbtn',
        text: b.label,
        onclick: function () { closeModal(); if (b.fn) b.fn(); }
      }));
    });
    var back = h('div', { class: 'modal-back', onclick: function (ev) {
      if (ev.target === back && opts.dismiss !== false) closeModal();
    } }, box);
    root.appendChild(back);
  }

  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = h('div', { class: 'toast', text: msg });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2200);
  }

  function confetti() {
    var c = h('div', { class: 'confetti' });
    var colors = ['#ffcf3f', '#e0407b', '#3ee08f', '#3fb4ff', '#7b3fe4', '#ff6a3d'];
    for (var i = 0; i < 90; i++) {
      var p = h('i');
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); }, 4200);
  }

  function seg(options, value, onChange) {
    var wrap = h('div', { class: 'seg' });
    options.forEach(function (o) {
      var b = h('button', { class: o.value === value ? 'on' : '', text: o.label, onclick: function () {
        Array.prototype.forEach.call(wrap.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        onChange(o.value);
      } });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function topbar(title, backTo, extra) {
    return h('div', { class: 'topbar' }, [
      h('button', { class: 'iconbtn', 'aria-label': 'Back', html: '&#8592;', onclick: function () { location.hash = backTo || '#/'; } }),
      h('h1', { text: title }),
      extra || null
    ]);
  }

  function tbtn(icon, label, fn, disabled) {
    return h('button', { onclick: fn, disabled: disabled ? true : null }, [h('span', { html: icon }), label]);
  }

  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {} }

  return { h: h, store: store, modal: modal, closeModal: closeModal, toast: toast, confetti: confetti,
    seg: seg, topbar: topbar, tbtn: tbtn, vibrate: vibrate };
})();
