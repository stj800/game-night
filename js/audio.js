/* Original music + sound effects, synthesized live with the Web Audio API (no audio files). */
var Sound = (function () {
  var ctx = null, master, musicBus, sfxBus, noiseBuf;
  var prefs = (typeof UI !== 'undefined' && UI.store('sound')) || { music: true, sfx: true };
  var song = null, timer = null, step = 0, nextTime = 0;

  function save() { if (typeof UI !== 'undefined') UI.store('sound', prefs); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? 0.22 : 0; musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 0.55 : 0; sfxBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    return true;
  }

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function tone(bus, t, midi, dur, type, vol, opts) {
    opts = opts || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(hz(midi), t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(hz(opts.slideTo), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    var a = opts.attack || 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var node = o;
    if (opts.lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(bus, t, dur, vol, type, freq) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }

  function kick(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.2);
  }

  // ---------- Songs (original). 16 steps per bar, 4 bars. ----------
  var MELODY = [
    [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0],
    [71, 0, 74, 0, 79, 0, 74, 0, 76, 0, 74, 0, 71, 0, 67, 0],
    [72, 0, 76, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 76, 0],
    [77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 0, 72, 0, 0, 0]
  ];
  var MELODY_B = [
    [79, 0, 0, 79, 81, 0, 79, 0, 76, 0, 0, 0, 72, 0, 74, 0],
    [74, 0, 0, 74, 76, 0, 74, 0, 71, 0, 0, 0, 67, 0, 71, 0],
    [76, 0, 0, 76, 79, 0, 81, 0, 84, 0, 81, 0, 79, 0, 76, 0],
    [77, 0, 79, 0, 81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 0, 0]
  ];
  var CHORDS = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]]; // C G Am F
  var SONGS = {
    orchard: { bpm: 116, shift: 0, lead: 'triangle', arp: 'square', swing: 0 },
    tropical: { bpm: 124, shift: 5, lead: 'square', arp: 'triangle', swing: 0.08 },
    night: { bpm: 104, shift: -3, lead: 'sine', arp: 'triangle', swing: 0 },
    blocks: { bpm: 138, shift: 2, lead: 'square', arp: 'sawtooth', swing: 0 }
  };

  function schedule() {
    if (!song || !ctx) return;
    var spb = 60 / song.bpm / 4; // seconds per 16th step
    while (nextTime < ctx.currentTime + 0.15) {
      var s = step % 128, bar = Math.floor(s / 16) % 4, i = s % 16, half = s >= 64, t = nextTime;
      if (i % 2 === 1) t += song.swing * spb;
      var sh = song.shift, ch = CHORDS[bar];
      // drums
      if (i % 4 === 0) kick(t);
      if (i % 2 === 1) noise(musicBus, t, 0.04, 0.12, 'highpass', 8000);
      if (i === 4 || i === 12) noise(musicBus, t, 0.12, 0.22, 'bandpass', 1800);
      // bass
      if (i % 4 === 0 || i === 6 || i === 14) tone(musicBus, t, ch[0] - 12 + sh, spb * 1.8, 'triangle', 0.5, { lp: 900 });
      // arpeggio
      tone(musicBus, t, ch[i % 3] + 12 + sh + (i % 6 === 5 ? 12 : 0), spb * 0.9, song.arp, 0.08, { lp: 2400 });
      // lead
      var m = (half ? MELODY_B : MELODY)[bar][i];
      if (m) tone(musicBus, t, m + sh, spb * 1.9, song.lead, 0.2, { lp: 3800, detune: 4 });
      nextTime += spb; step++;
    }
  }

  function playMusic(name) {
    if (!init()) return;
    var next = SONGS[name] || SONGS.orchard;
    if (song === next && timer) return;
    stopMusic();
    song = next; step = 0; nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }
  function stopMusic() { clearInterval(timer); timer = null; song = null; }

  // ---------- Sound effects ----------
  var sfx = {
    swap: function (t) { noise(sfxBus, t, 0.12, 0.3, 'bandpass', 1400); tone(sfxBus, t, 72, 0.1, 'sine', 0.2, { slideTo: 79 }); },
    nope: function (t) { tone(sfxBus, t, 50, 0.16, 'square', 0.15, { lp: 600 }); tone(sfxBus, t + 0.12, 47, 0.18, 'square', 0.15, { lp: 600 }); },
    grow: function (t, combo) { tone(sfxBus, t, 70 + combo * 2, 0.25, 'triangle', 0.15, { slideTo: 82 + combo * 2 }); },
    pop: function (t, combo) {
      var base = 76 + Math.min(combo, 8) * 2;
      for (var k = 0; k < 3; k++) tone(sfxBus, t + k * 0.04, base + k * 4, 0.14, 'sine', 0.35, { slideTo: base + k * 4 - 12 });
      noise(sfxBus, t, 0.08, 0.25, 'highpass', 3000);
    },
    land: function (t) { tone(sfxBus, t, 55, 0.08, 'sine', 0.25, { slideTo: 48 }); },
    special: function (t) { for (var k = 0; k < 6; k++) tone(sfxBus, t + k * 0.05, 72 + k * 3, 0.2, 'square', 0.12, { lp: 3000 }); },
    blast: function (t) { noise(sfxBus, t, 0.6, 0.6, 'lowpass', 900); tone(sfxBus, t, 60, 0.6, 'sawtooth', 0.25, { slideTo: 30, lp: 800 }); },
    combo: function (t, n) { [0, 4, 7, 12].forEach(function (s, k) { tone(sfxBus, t + k * 0.07, 72 + s + Math.min(n, 6), 0.3, 'triangle', 0.3); }); },
    win: function (t) { [60, 64, 67, 72, 76, 79, 84].forEach(function (m, k) { tone(sfxBus, t + k * 0.09, m, 0.5, 'square', 0.14, { lp: 3500 }); }); tone(sfxBus, t + 0.7, 84, 1.2, 'triangle', 0.3); },
    lose: function (t) { [67, 64, 60, 55].forEach(function (m, k) { tone(sfxBus, t + k * 0.18, m, 0.4, 'triangle', 0.25); }); }
  };
  function play(name, arg) { if (!prefs.sfx || !init() || !sfx[name]) return; sfx[name](ctx.currentTime + 0.01, arg || 1); }

  // ---------- Deep announcer voice (the phone's built-in speech, pitched way down) ----------
  var voice = null, voiceUnlocked = false;
  // Pick the smoothest natural male English voice the device has (Enhanced / Premium versions first).
  function pickVoice() {
    if (voice || !window.speechSynthesis) return voice;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
    var avoid = /Fred|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Junior|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Ralph|Kathy|Princess|Jester|Grandpa|Rocko|Eddy/i;
    vs = vs.filter(function (v) { return !avoid.test(v.name); });
    var male = ['Aaron', 'Arthur', 'Daniel', 'Nathan', 'Evan', 'Reed', 'Tom', 'Alex', 'Oliver', 'Gordon', 'Rishi',
      'Google UK English Male', 'Microsoft Andrew', 'Microsoft Guy', 'Microsoft Davis', 'Microsoft Christopher', 'Microsoft Eric', 'Microsoft Ryan', 'Microsoft David', 'Male'];
    function find(test) {
      for (var i = 0; i < male.length; i++) {
        var hit = vs.filter(function (v) { return v.name.indexOf(male[i]) >= 0 && test(v); })[0];
        if (hit) return hit;
      }
      return null;
    }
    voice = find(function (v) { return /Premium|Enhanced|Natural|Online/i.test(v.name); }) || find(function () { return true; }) || vs[0] || null;
    return voice;
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { voice = null; pickVoice(); };
  function unlockVoice() {
    if (voiceUnlocked || !window.speechSynthesis) return;
    voiceUnlocked = true;
    try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  }
  function say(text) {
    if (!prefs.sfx || !window.speechSynthesis || document.hidden) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var v = pickVoice(); if (v) u.voice = v;
      u.pitch = 0.78; u.rate = 0.9; u.volume = 1; // deep and smooth, not cartoonish
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function setMusic(on) { prefs.music = on; save(); if (ctx) musicBus.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.05); }
  function setSfx(on) { prefs.sfx = on; save(); if (!on && window.speechSynthesis) speechSynthesis.cancel(); if (ctx) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }

  function state() { return ctx ? { ctx: ctx.state, music: musicBus.gain.value, sfx: sfxBus.gain.value, playing: !!timer } : null; }
  return { init: init, playMusic: playMusic, stopMusic: stopMusic, play: play, prefs: prefs, setMusic: setMusic, setSfx: setSfx, state: state, say: say, unlockVoice: unlockVoice };
})();
