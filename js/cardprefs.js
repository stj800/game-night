/* Shared settings for the card games (Rummy 500, High-Low Jack): card + text size and speed of play.
   Saved on this phone. Size sets CSS variables --cs (cards) and --ts (text); speed divides the computer's
   thinking time and the card animations. */
var CardPrefs = (function () {
  var h = UI.h;
  var SIZES = [{ value: 1, label: 'Normal' }, { value: 1.25, label: 'Large' }, { value: 1.5, label: 'Larger' }, { value: 1.75, label: 'Largest' }];
  var SPEEDS = [{ value: 1, label: '1x' }, { value: 1.25, label: '1.25x' }, { value: 1.5, label: '1.5x' }, { value: 2, label: '2x' }];
  function pick(list, v) { for (var i = 0; i < list.length; i++) if (list[i].value === v) return v; return 1; }
  function size() { return pick(SIZES, +UI.store('card_size') || 1); }
  function speed() { return pick(SPEEDS, +UI.store('card_speed') || 1); }
  function apply() {
    var cs = size(), r = document.documentElement.style;
    r.setProperty('--cs', String(cs));
    r.setProperty('--ts', String(Math.round((1 + (cs - 1) * 0.7) * 100) / 100));
  }
  function ms(x) { return Math.round(x / speed()); }
  function sizeNote() { return 'Makes the cards and the words on the table bigger. ' + (size() > 1.25 ? 'Your hand may use two rows.' : ''); }
  function speedNote() { var s = speed(); return s === 1 ? 'Normal pace.' : 'Computer turns and card moves run ' + s + ' times as fast.'; }
  // Two settings rows. onChange(kind) runs after a change so the screen can redraw.
  function rows(onChange) {
    var sn = h('span', { text: sizeNote() }), pn = h('span', { text: speedNote() });
    return [
      h('div', { class: 'rumsrow' }, [h('div', { class: 'rumslabel' }, [h('b', { text: 'Card and text size' }), sn]),
        UI.seg(SIZES, size(), function (v) { UI.store('card_size', v); apply(); sn.textContent = sizeNote(); if (onChange) onChange('size'); })]),
      h('div', { class: 'rumsrow' }, [h('div', { class: 'rumslabel' }, [h('b', { text: 'Speed of play' }), pn]),
        UI.seg(SPEEDS, speed(), function (v) { UI.store('card_speed', v); pn.textContent = speedNote(); if (onChange) onChange('speed'); })])
    ];
  }
  // A panel for a game's menu screen
  function panel() { return h('div', { class: 'panel rumsound cardprefs' }, rows()); }
  apply();
  return { size: size, speed: speed, apply: apply, ms: ms, rows: rows, panel: panel };
})();
