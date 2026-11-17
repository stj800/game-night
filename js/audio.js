/* Original music + sound effects, synthesized live with the Web Audio API (no audio files). */
var Sound = (function () {
  var ctx = null, master, musicBus, sfxBus, noiseBuf, comp;
  var prefs = (typeof UI !== 'undefined' && UI.store('sound')) || { music: true, sfx: true };
  var song = null, timer = null, step = 0, nextTime = 0;

  function save() { if (typeof UI !== 'undefined') UI.store('sound', prefs); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    comp = ctx.createDynamicsCompressor(); comp.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicLevel(); musicBus.connect(comp);
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
    blocks: { bpm: 138, shift: 2, lead: 'square', arp: 'sawtooth', swing: 0 },
    // Calm garden tune for Mahjong: pentatonic melody, soft pads, no drums
    zen: { bpm: 80, shift: 0, lead: 'sine', arp: 'triangle', swing: 0, calm: true,
      chords: [[45, 52, 57], [43, 50, 55], [41, 48, 53], [43, 50, 55]],
      melody: [[76, 0, 0, 0, 79, 0, 81, 0, 0, 0, 79, 0, 76, 0, 0, 0], [74, 0, 0, 0, 76, 0, 79, 0, 0, 0, 76, 0, 74, 0, 72, 0],
               [69, 0, 0, 0, 72, 0, 74, 0, 0, 0, 76, 0, 79, 0, 0, 0], [76, 0, 74, 0, 72, 0, 0, 0, 74, 0, 0, 0, 0, 0, 0, 0]],
      melodyB: [[81, 0, 0, 0, 84, 0, 81, 0, 79, 0, 0, 0, 76, 0, 0, 0], [79, 0, 0, 0, 81, 0, 79, 0, 76, 0, 74, 0, 0, 0, 0, 0],
               [72, 0, 74, 0, 76, 0, 0, 0, 79, 0, 0, 0, 81, 0, 0, 0], [79, 0, 0, 0, 76, 0, 0, 0, 74, 0, 0, 0, 0, 0, 0, 0]] },
    // Original Vegas-lounge swing for Rummy: walking bass, brushes + ride, jazz piano comping, muted-trumpet lead
    lounge: { bpm: 112, jazz: true }
  };

  // ---------- Lounge swing (original 8-bar tune, loops) ----------
  var CH = {
    F: { r: 41, q: 4, v: [57, 60, 64] }, D7: { r: 38, q: 4, v: [54, 60, 64] }, Gm: { r: 43, q: 3, v: [58, 62, 65] },
    C7: { r: 36, q: 4, v: [58, 64, 69] }, Am: { r: 45, q: 3, v: [55, 60, 64] }, Bb: { r: 46, q: 4, v: [57, 62, 65] }
  };
  var JZ = {
    bars: [[CH.F], [CH.D7], [CH.Gm], [CH.C7], [CH.Am, CH.D7], [CH.Gm, CH.C7], [CH.F, CH.Bb], [CH.Gm, CH.C7]],
    // [eighth-note slot 0-7, midi, length in eighths]
    lead: [
      [[0, 72, 2], [2, 69, 1], [3, 72, 3]],
      [[1, 74, 1], [2, 72, 1], [3, 69, 1], [4, 66, 3]],
      [[0, 67, 2], [2, 70, 1], [3, 74, 2], [6, 72, 1], [7, 70, 1]],
      [[0, 69, 3], [4, 64, 3]],
      [[0, 72, 1], [1, 76, 2], [3, 74, 1], [4, 72, 1], [5, 69, 1], [6, 66, 2]],
      [[0, 70, 2], [2, 74, 1], [3, 77, 2], [5, 76, 1], [6, 74, 1], [7, 72, 1]],
      [[0, 69, 4], [5, 72, 1], [6, 74, 2]],
      [[0, 70, 1], [1, 69, 1], [2, 67, 2], [4, 64, 3]]
    ]
  };
  function upright(t, m, dur) {
    [['triangle', 0, 0.42], ['sine', 12, 0.16]].forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = p[0]; o.frequency.setValueAtTime(hz(m + p[1]), t);
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(320, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p[2], t + 0.006); g.gain.exponentialRampToValueAtTime(p[2] * 0.4, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function keys(t, notes, dur) {
    notes.forEach(function (m) {
      [['sine', 0, 0.075], ['triangle', 12, 0.02]].forEach(function (p) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = p[0]; o.frequency.setValueAtTime(hz(m + p[1]), t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p[2], t + 0.01); g.gain.exponentialRampToValueAtTime(p[2] * 0.5, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }
  function horn(t, m, dur) {
    var o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(m - 0.3), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.06);
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz(m) * 0.012, t + Math.min(dur, 0.5)); lfo.connect(lg); lg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.04); g.gain.setValueAtTime(0.14, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  function ride(t, v) { noise(musicBus, t, 0.35, v, 'highpass', 6500); tone(musicBus, t, 99, 0.3, 'sine', v * 0.25); }
  function brush(t) { noise(musicBus, t, 0.18, 0.07, 'bandpass', 2600); }
  function jazz() {
    var bd = 60 / song.bpm;
    while (nextTime < ctx.currentTime + 0.25) {
      var b = step % 32, bar = Math.floor(b / 4), beat = b % 4, loop = Math.floor(step / 32), t = nextTime, off = t + bd * 2 / 3;
      var chs = JZ.bars[bar], two = chs.length > 1, cur = two && beat >= 2 ? chs[1] : chs[0];
      var nxt = two && beat < 2 ? chs[1] : JZ.bars[(bar + 1) % 8][0];
      // drums: ride "ding, ding-a ding", brushes on 2 and 4, feather kick on 1
      ride(t, beat === 0 ? 0.075 : 0.06);
      if (beat === 1 || beat === 3) { ride(off, 0.045); brush(t); }
      if (beat === 0) tone(musicBus, t, 33, 0.2, 'sine', 0.22, { slideTo: 28 });
      // walking bass
      var r = cur.r, note;
      if (two) note = beat % 2 === 0 ? r : (nxt.r > r ? nxt.r - 1 : nxt.r + 1);
      else note = [r, r + cur.q, r + 7, nxt.r > r ? nxt.r - 1 : nxt.r + 1][beat];
      upright(t, note, bd * 0.95);
      // piano comping (Charleston-ish)
      if (beat === 0) keys(t, cur.v, bd * 0.6);
      if (beat === 1) keys(off, cur.v, bd * 1.2);
      if (two && beat === 2) keys(t, cur.v, bd * 0.9);
      // lead: plays two choruses, then lets the band vamp for one
      if (loop % 3 !== 2) JZ.lead[bar].forEach(function (n) {
        if (Math.floor(n[0] / 2) !== beat) return;
        horn(n[0] % 2 ? off : t, n[1] + (loop % 3 === 1 && bar >= 4 ? 0 : 0), n[2] * bd / 2 * 0.92);
      });
      nextTime += bd; step++;
    }
  }

  function schedule() {
    if (!song || !ctx) return;
    // Music belongs to one screen: if that screen is gone, the music stops itself
    if (owner && !document.body.contains(owner)) { stopMusic(); return; }
    if (song.jazz) return jazz();
    var spb = 60 / song.bpm / 4; // seconds per 16th step
    while (nextTime < ctx.currentTime + 0.15) {
      var s = step % 128, bar = Math.floor(s / 16) % 4, i = s % 16, half = s >= 64, t = nextTime;
      if (i % 2 === 1) t += song.swing * spb;
      var sh = song.shift, ch = (song.chords || CHORDS)[bar];
      if (!song.calm) {
        if (i % 4 === 0) kick(t);
        if (i % 2 === 1) noise(musicBus, t, 0.04, 0.12, 'highpass', 8000);
        if (i === 4 || i === 12) noise(musicBus, t, 0.12, 0.22, 'bandpass', 1800);
      } else if (i === 0) {
        ch.forEach(function (n) { tone(musicBus, t, n + sh, spb * 15, 'sine', 0.07, { attack: 0.4, lp: 1600 }); });
      }
      // bass
      if (song.calm ? i === 0 || i === 8 : (i % 4 === 0 || i === 6 || i === 14)) tone(musicBus, t, ch[0] - 12 + sh, spb * (song.calm ? 7 : 1.8), 'triangle', song.calm ? 0.3 : 0.5, { lp: 900 });
      // arpeggio
      if (!song.calm || i % 2 === 0) tone(musicBus, t, ch[i % 3] + 12 + sh + (i % 6 === 5 ? 12 : 0), spb * (song.calm ? 3 : 0.9), song.arp, song.calm ? 0.05 : 0.08, { lp: 2400 });
      // lead
      var m = (half ? (song.melodyB || MELODY_B) : (song.melody || MELODY))[bar][i];
      if (m) tone(musicBus, t, m + sh, spb * (song.calm ? 5 : 1.9), song.lead, song.calm ? 0.16 : 0.2, { lp: 3800, detune: 4, attack: song.calm ? 0.05 : 0.008 });
      nextTime += spb; step++;
    }
  }

  // owner = the element of the screen the music belongs to. Only ONE song can ever run.
  var owner = null;
  var bc = null, myId = Math.random().toString(36).slice(2);
  try { bc = new BroadcastChannel('gamenight-music'); bc.onmessage = function (e) { if (e.data && e.data.playing && e.data.id !== myId && timer) stopMusic(true); }; } catch (err) {}
  function announce() { try { if (bc) bc.postMessage({ playing: true, id: myId }); } catch (err) {} }
  var lastStart = null; // how to resume the current screen's music after Music Off -> On
  function playMusic(name, ownerEl) {
    lastStart = { fn: playMusic, args: [name, ownerEl], el: ownerEl };
    if (!prefs.music) { stopMusic(true); return; }
    if (!init()) return;
    var next = SONGS[name] || SONGS.orchard;
    if (ownerEl) owner = ownerEl;
    if (song === next && timer) return;
    stopMusic(); if (ownerEl) owner = ownerEl;
    song = next; step = 0; nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25); announce();
  }
  function stopMusic(keepResume) { clearInterval(timer); timer = null; song = null; owner = null; clas = null; if (!keepResume) lastStart = null; }

  // ---------- Classical (public-domain pieces from classical.js, played on a soft piano voice) ----------
  var clas = null;
  // Plucked zither (guzheng-style): bright pluck that bends into pitch, long notes get the classic tremolo
  function zheng(t, m, dur, bass) {
    var plucks = (!bass && dur >= 0.6) ? Math.floor(dur / 0.09) : 1;
    for (var k = 0; k < plucks; k++) {
      var tt = t + k * (plucks > 1 ? 0.09 : 0), vol = (bass ? 0.2 : 0.3) * (k === 0 ? 1 : 0.45), len = plucks > 1 ? 0.22 : Math.min(1.6, dur + (bass ? 1.0 : 0.6));
      [['triangle', 0, 1], ['sawtooth', 0, 0.18], ['sine', 12, 0.25]].forEach(function (p) {
        var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
        o.type = p[0]; o.frequency.setValueAtTime(hz(m + p[1] + 0.35), tt); o.frequency.exponentialRampToValueAtTime(hz(m + p[1]), tt + 0.05);
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(bass ? 1400 : 4200, tt); fl.frequency.exponentialRampToValueAtTime(bass ? 400 : 1100, tt + len);
        var v = vol * p[2];
        g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(v, tt + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
        o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(tt); o.stop(tt + len + 0.05);
      });
    }
  }
  function woodblock(t) { tone(musicBus, t, 84, 0.06, 'sine', 0.12, { slideTo: 79 }); noise(musicBus, t, 0.03, 0.08, 'bandpass', 2500); }
  function gong(t) { [36, 43, 48.3].forEach(function (m, k) { tone(musicBus, t, m, 3.2, 'sine', 0.16 / (k + 1), { attack: 0.02, slideTo: m - 0.4 }); }); noise(musicBus, t, 1.2, 0.07, 'lowpass', 600); }

  function piano(t, m, dur, bass) {
    var vol = bass ? 0.16 : 0.26, len = Math.min(2.6, dur + (bass ? 1.2 : 0.7));
    [['triangle', 0, 1], ['sine', 12, 0.35]].forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = p[0]; o.frequency.setValueAtTime(hz(m + p[1]), t);
      f.type = 'lowpass'; f.frequency.setValueAtTime(bass ? 1200 : 3200, t); f.frequency.exponentialRampToValueAtTime(bass ? 500 : 900, t + len);
      var v = vol * p[2];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + len + 0.05);
    });
  }
  function startPiece(t0) {
    var p = clas.list[clas.pi];
    clas.voices = p.voices.map(function (v, k) { return { v: v, i: 0, t: t0, bass: k > 0 }; });
    if (p.inst === 'zheng') { clas.beat = t0; if (clas.rep === 0) gong(t0); }
    clas.end = t0 + p.voices[0].reduce(function (s2, n) { return s2 + n[1]; }, 0) * p.unit;
    if (clas.onPiece && clas.rep === 0) { var delay = Math.max(0, (t0 - ctx.currentTime) * 1000); var cb = clas.onPiece; setTimeout(function () { cb(p); }, delay); }
  }
  function schedClassical() {
    if (!clas || !ctx) return;
    if (owner && !document.body.contains(owner)) { stopMusic(); return; }
    var p = clas.list[clas.pi], horizon = ctx.currentTime + 0.35;
    if (p.inst === 'zheng') { while (clas.beat < Math.min(horizon, clas.end)) { woodblock(clas.beat); clas.beat += p.unit * 4; } }
    clas.voices.forEach(function (vc) {
      while (vc.i < vc.v.length && vc.t < horizon) {
        var n = vc.v[vc.i], d = n[1] * p.unit;
        if (n[0]) (p.inst === 'zheng' ? zheng : piano)(vc.t, n[0], d, vc.bass);
        vc.t += d; vc.i++;
      }
    });
    if (ctx.currentTime > clas.end - 0.3 && clas.voices.every(function (vc) { return vc.i >= vc.v.length; })) {
      clas.rep++;
      if (clas.rep < p.repeat) startPiece(clas.end);
      else { clas.pi = (clas.pi + 1) % clas.list.length; clas.rep = 0; startPiece(clas.end + 1.5); }
    }
  }
  // After every screen change: if no screen on display owns the music, stop it
  function checkOwner() { if (timer && (!owner || !document.body.contains(owner))) stopMusic(); if (chat && (!chatOwner || !document.body.contains(chatOwner))) stopChatter(); }
  // list = which playlist (Classical for chess, ChineseMusic for Mahjong)
  function playClassical(ownerEl, onPiece, list) {
    lastStart = { fn: playClassical, args: [ownerEl, onPiece, list], el: ownerEl };
    if (!prefs.music) { stopMusic(true); return; }
    list = list || (typeof Classical !== 'undefined' ? Classical : null);
    if (!list || !init()) return;
    if (clas && timer && clas.list === list) { owner = ownerEl; clas.onPiece = onPiece; if (onPiece) onPiece(list[clas.pi]); return; }
    stopMusic(); owner = ownerEl;
    clas = { list: list, pi: Math.floor(Math.random() * list.length), rep: 0, onPiece: onPiece };
    startPiece(ctx.currentTime + 0.25);
    timer = setInterval(schedClassical, 60); announce();
  }
  window.addEventListener('pagehide', function () { stopMusic(); stopChatter(); if (ctx) ctx.suspend(); });

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
    lose: function (t) { [67, 64, 60, 55].forEach(function (m, k) { tone(sfxBus, t + k * 0.18, m, 0.4, 'triangle', 0.25); }); },
    // Cards: a quick swish when a card is pulled, a crisp slap when it lands on the pile
    flick: function (t) { noise(sfxBus, t, 0.09, 0.28, 'highpass', 3500); noise(sfxBus, t + 0.02, 0.06, 0.12, 'bandpass', 6000); },
    slap: function (t) { noise(sfxBus, t, 0.07, 0.55, 'bandpass', 1500); noise(sfxBus, t, 0.03, 0.4, 'highpass', 5000); tone(sfxBus, t, 45, 0.09, 'sine', 0.35, { slideTo: 38 }); },
    chips: function (t) { for (var k = 0; k < 5; k++) { var tt = t + k * (0.035 + Math.random() * 0.03); noise(sfxBus, tt, 0.025, 0.25, 'highpass', 4200); tone(sfxBus, tt, 98 + Math.random() * 4, 0.04, 'sine', 0.05); } }
  };

  // ---------- Casino chatter: a murmuring crowd, chips clacking, a far-off slot bell. Own on/off + volume. ----------
  var chat = null, chatOwner = null, lastChatEl = null;
  function chatLevel() { var v = prefs.chatVol === undefined ? 0.6 : prefs.chatVol; return prefs.chat === false ? 0 : 0.55 * v; }
  function startChatter(ownerEl) {
    lastChatEl = ownerEl; chatOwner = ownerEl;
    if (prefs.chat === false || !init()) return;
    if (chat) return;
    var bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(comp);
    bus.gain.setTargetAtTime(chatLevel(), ctx.currentTime, 0.8);
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last; }
    var srcs = [], voices = [];
    // low room murmur
    var bed = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
    bed.buffer = buf; bed.loop = true; bf.type = 'lowpass'; bf.frequency.value = 450; bg.gain.value = 0.35;
    bed.connect(bf); bf.connect(bg); bg.connect(bus); bed.start(); srcs.push(bed);
    // several "talkers": noise through moving vowel-like filters, gated in syllables
    for (var k = 0; k < 6; k++) {
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4;
      f.type = 'bandpass'; f.frequency.value = 400 + Math.random() * 500; f.Q.value = 6;
      f2.type = 'bandpass'; f2.frequency.value = 1100 + Math.random() * 900; f2.Q.value = 5;
      g.gain.value = 0;
      s.connect(f); s.connect(f2); f.connect(g); f2.connect(g); g.connect(bus); s.start(k * 0.13);
      srcs.push(s); voices.push({ f: f, f2: f2, g: g, talk: Math.random() < 0.5, base: 0.6 + Math.random() * 0.8 });
    }
    var timer2 = setInterval(function () {
      if (!chat) return;
      if (chatOwner && !document.body.contains(chatOwner)) { stopChatter(); return; }
      var t = ctx.currentTime;
      voices.forEach(function (v) {
        if (Math.random() < 0.04) v.talk = !v.talk; // people start and stop talking
        var on = v.talk && Math.random() < 0.7;
        v.g.gain.setTargetAtTime(on ? v.base * (0.4 + Math.random() * 0.6) : 0.0001, t, 0.03);
        if (on) { v.f.frequency.setTargetAtTime(350 + Math.random() * 600, t, 0.05); v.f2.frequency.setTargetAtTime(1000 + Math.random() * 1300, t, 0.05); }
      });
      if (Math.random() < 0.012) { for (var c = 0; c < 4 + Math.floor(Math.random() * 4); c++) { var tt = t + c * (0.03 + Math.random() * 0.05); noise(bus, tt, 0.02, 0.35, 'highpass', 4500); } }
      if (Math.random() < 0.004) { [88, 91, 95, 100, 95, 100].forEach(function (m, j) { tone(bus, t + j * 0.11, m, 0.22, 'sine', 0.06); }); }
      if (Math.random() < 0.003) { var sw = ctx.createGain(); sw.gain.setValueAtTime(0.0001, t); sw.gain.exponentialRampToValueAtTime(0.5, t + 0.4); sw.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); sw.connect(bus);
        var sb = ctx.createBufferSource(), sf = ctx.createBiquadFilter(); sb.buffer = buf; sf.type = 'bandpass'; sf.frequency.value = 900; sf.Q.value = 0.8; sb.connect(sf); sf.connect(sw); sb.start(t); sb.stop(t + 1.7); } // a cheer down the room
    }, 110);
    chat = { bus: bus, srcs: srcs, timer: timer2 };
  }
  function stopChatter() {
    if (!chat) return;
    var c = chat; chat = null; clearInterval(c.timer);
    try { c.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); } catch (e) {}
    setTimeout(function () { c.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} }); try { c.bus.disconnect(); } catch (e) {} }, 700);
  }
  function setChat(on) {
    prefs.chat = on; save();
    if (!on) stopChatter();
    else if (lastChatEl && document.body.contains(lastChatEl)) startChatter(lastChatEl);
  }
  function setChatVol(v) { prefs.chatVol = Math.max(0, Math.min(1, v)); save(); if (chat) chat.bus.gain.setTargetAtTime(chatLevel(), ctx.currentTime, 0.05); }
  function getChatVol() { return prefs.chatVol === undefined ? 0.6 : prefs.chatVol; }
  // Gentle bell for Echo pads (a sound effect: follows the Sounds On/Off button)
  function chime(m, dur) { if (!prefs.sfx || !init()) return; var t0 = ctx.currentTime + 0.01; tone(sfxBus, t0, m, (dur || 0.4) + 0.35, 'sine', 0.4, { attack: 0.005 }); tone(sfxBus, t0, m + 12, dur || 0.4, 'triangle', 0.08, { attack: 0.005 }); }
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

  // Music volume 0-1 (remembered). 0.8 matches the original loudness.
  function musicLevel() { var v = prefs.vol === undefined ? 0.8 : prefs.vol; return prefs.music ? 0.28 * v : 0; }
  function setMusic(on) {
    prefs.music = on; save();
    if (ctx) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicLevel(), ctx.currentTime); }
    if (!on) stopMusic(true);
    else if (lastStart && lastStart.el && document.body.contains(lastStart.el)) lastStart.fn.apply(null, lastStart.args);
  }
  function setVolume(v) { prefs.vol = Math.max(0, Math.min(1, v)); save(); if (ctx) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.03); }
  function getVolume() { return prefs.vol === undefined ? 0.8 : prefs.vol; }
  function setSfx(on) { prefs.sfx = on; save(); if (ctx) { sfxBus.gain.cancelScheduledValues(ctx.currentTime); sfxBus.gain.setValueAtTime(on ? 0.55 : 0, ctx.currentTime); } if (!on && window.speechSynthesis) speechSynthesis.cancel(); if (ctx) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }

  function state() { return ctx ? { ctx: ctx.state, music: musicBus.gain.value, sfx: sfxBus.gain.value, playing: !!timer } : null; }
  return { init: init, playMusic: playMusic, stopMusic: stopMusic, play: play, prefs: prefs, setMusic: setMusic, setSfx: setSfx, state: state, chime: chime, say: say, setVolume: setVolume, getVolume: getVolume, playClassical: playClassical, checkOwner: checkOwner, unlockVoice: unlockVoice,
    startChatter: startChatter, stopChatter: stopChatter, setChat: setChat, setChatVol: setChatVol, getChatVol: getChatVol };
})();
