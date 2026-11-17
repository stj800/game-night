/* High-Low Jack (Pitch): you against computers, 2 vs 2 partners, or ONLINE with family on their own phones.
   Online works like Rummy 500: the host's phone runs the game and sends each player only their own hand,
   through the free PeerJS service (no account needed). */
var Pitch = (function () {
  var h = UI.h, E = PitchEngine;
  var LEVELS = [
    { value: 1, label: 'Beginner', note: 'Computers bid loosely and play some odd cards. Great for learning.' },
    { value: 2, label: 'Intermediate', note: 'Solid players. They bid what they hold and protect their Jack.' },
    { value: 3, label: 'Advanced', note: 'Sharp players. They count trump, pull it early and lean on their partner.' }
  ];
  var BOTS = ['Ava', 'Leo', 'Mia'];
  var AV = [0x1F60E, 0x1F469, 0x1F468, 0x1F467];
  var COLORS = ['#ffcf3f', '#ff6b8b', '#3ee08f', '#5fb6ff'];
  var PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', PREFIX = 'gamenight-pitch-';
  function cp(c) { return String.fromCodePoint(c); }
  function cfgGet() { var c = UI.store('pit_cfg') || {}; return { mode: c.mode || 'team', target: c.target || 11, level: c.level || 2 }; }
  function seatCount(mode) { return mode === 'team' ? 4 : +mode + 1; }
  function suitName(t) { return E.SUIT_NAMES[t]; }

  // =================== Driver: owns the real game (local play, or the online host) ===================
  var D = null, onUpdate = null;
  function newDriver(s, seats, mode) { if (D) D.alive = false; D = { s: s, seats: seats, mode: mode, alive: true, msg: '', busy: false }; return D; }
  function pname(i) { return D.s.players[i].name; }
  function save() {
    if (!D) return;
    if (D.mode === 'local') UI.store('pit_game', D.s);
    else UI.store('pit_net', { s: D.s, code: N.code, seats: D.seats.map(function (st) { return { name: st.name, kind: st.kind, pid: st.pid || null }; }) });
  }
  function seatInfo() {
    return D.seats.map(function (st) { return { name: st.name, kind: st.kind, pid: st.pid || null, on: st.kind !== 'remote' || !!(st.conn && st.conn.open) }; });
  }
  function viewFor(i) {
    var v = JSON.parse(JSON.stringify(D.s));
    v.players.forEach(function (p, k) { if (k !== i) p.hand = p.hand.map(function () { return -1; }); });
    return v;
  }
  function publish() {
    if (!D) return;
    if (D.mode === 'host') D.seats.forEach(function (st, i) {
      if (st.kind === 'remote' && st.conn && st.conn.open) send(st.conn, { t: 'state', v: viewFor(i), seat: i, msg: D.msg, info: seatInfo(), code: N.code });
    });
    if (onUpdate) onUpdate();
  }
  function bidWord(v) { return v ? 'bid ' + v : 'passed'; }
  function commit(msg) {
    D.msg = msg; save(); publish();
    var d = D; setTimeout(function () { if (d === D) runBots(); }, CardPrefs.ms(1000));
  }
  function afterPlay(seat, c) {
    var s = D.s, who = pname(seat), msg = who + ' played the ' + E.label(c) + '.';
    if (s.trick.length === 0 && s.lastTrick && s.lastTrick.cards.length && s.lastTrick.cards[s.lastTrick.cards.length - 1].c === c) {
      msg += ' ' + pname(s.lastTrick.w) + ' takes the trick.';
    }
    if (s.played.length === 1) msg = who + ' pitched the ' + E.label(c) + '. ' + suitName(s.trump).charAt(0).toUpperCase() + suitName(s.trump).slice(1) + ' are trump!';
    return msg;
  }
  // Apply a move for a seat. Returns an error message, or null when it worked.
  function apply(seat, a, x) {
    var s = D.s, msg;
    if (a === 'next') {
      if (s.phase !== 'over') return null;
      E.nextRound(s); msg = 'Hand ' + s.round + '. ' + pname(s.dealer) + ' dealt. ' + pname(s.turn) + ' bids first.';
    } else if (a === 'again') {
      if (s.phase !== 'gameover') return null;
      if (D.mode === 'host' && seat !== 0) return 'Only the host can start a new game.';
      D.s = s = E.newGame({ names: s.players.map(function (p) { return p.name; }), target: s.target, teams: s.teams, level: s.level });
      msg = 'New game! ' + pname(s.dealer) + ' dealt. ' + pname(s.turn) + ' bids first.';
    } else if (a === 'bid') {
      if (s.phase !== 'bid' || s.turn !== seat) return 'Hang on, it is not your turn to bid.';
      if (!E.bid(s, seat, x)) return x ? 'You have to bid at least ' + E.minBid(s) + '.' : 'Everyone passed, so the dealer has to bid.';
      msg = pname(seat) + ' ' + bidWord(x) + '.';
      if (s.phase === 'play') msg += ' ' + pname(s.bidder) + ' won the bid at ' + s.high + ' and leads.';
    } else if (a === 'card') {
      if (s.phase !== 'play' || s.turn !== seat) return 'Hang on, it is not your turn.';
      if (!E.play(s, seat, x)) return 'You have to follow suit (or play trump).';
      msg = afterPlay(seat, x);
    } else return 'Unknown move.';
    commit(msg);
    return null;
  }
  // Computer plays a seat (a computer seat, or an online player who has been gone 45+ seconds)
  function runBots() {
    var d = D; if (!d || !d.alive || d.busy) return;
    var s = d.s; if (s.phase !== 'bid' && s.phase !== 'play') return;
    var st = d.seats[s.turn], away = st.kind === 'remote' && !(st.conn && st.conn.open);
    if (away && Date.now() - (st.awayAt || 0) < 45000) { setTimeout(function () { if (d === D) runBots(); }, 3000); return; }
    if (st.kind !== 'bot' && !away) return;
    d.busy = true;
    var seat = s.turn;
    setTimeout(function () {
      if (!d.alive || d !== D) return;
      d.busy = false;
      if (s.phase === 'bid') apply(seat, 'bid', E.aiBid(s));
      else apply(seat, 'card', E.aiPlay(s));
    }, CardPrefs.ms(s.phase === 'bid' ? 500 : 350));
  }

  // =================== Network (PeerJS) ===================
  var N = { peer: null, role: null, code: null, conn: null, lobby: null, view: null, seat: 0, info: null, msg: '', name: '', status: '' };
  function send(conn, o) { try { if (conn && conn.open) conn.send(o); } catch (e) {} }
  function refresh() { if (onUpdate) onUpdate(); }
  function newCode() { var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', c = ''; for (var i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }
  function cleanName(n) { n = String(n || '').replace(/[^A-Za-z0-9 '.-]/g, '').trim().slice(0, 14); return n || 'Player'; }
  function loadPeer(cb) {
    if (window.Peer) return cb();
    var sc = document.createElement('script'); sc.src = PEERJS; sc.onload = cb;
    sc.onerror = function () { N.status = 'Could not reach the internet. Check your connection and try again.'; refresh(); };
    document.head.appendChild(sc);
  }
  function closeNet() {
    if (N.role === 'client' && N.conn) send(N.conn, { t: 'bye' });
    if (N.peer) { try { N.peer.destroy(); } catch (e) {} }
    N.peer = null; N.conn = null; N.role = null; N.lobby = null; N.view = null; N.status = '';
    if (D && D.mode === 'host') { D.alive = false; D = null; }
  }
  function leaveOnline() { closeNet(); UI.store('pit_net', null); }

  // ---- host ----
  function fillOrder(n, teams) { return teams ? [2, 1, 3] : [1, 2, 3].slice(0, n - 1); }
  function hostLobby(name) {
    closeNet();
    var cfg = cfgGet(), n = seatCount(cfg.mode), seats = [{ name: name, kind: 'me', pid: myPid() }];
    for (var i = 1; i < n; i++) seats.push({ name: '', kind: 'open' });
    N.role = 'host'; N.code = newCode(); N.lobby = { cfg: cfg, seats: seats }; N.status = 'Opening a table...';
    openHost(false);
  }
  function hostResume() {
    var saved = UI.store('pit_net'); if (!saved) return false;
    closeNet();
    N.role = 'host'; N.code = saved.code; N.status = 'Reopening your table...';
    var seats = saved.seats.map(function (st) { return { name: st.name, kind: st.kind, pid: st.pid || null, conn: null, awayAt: Date.now() }; });
    newDriver(saved.s, seats, 'host'); D.msg = 'Welcome back. Waiting for players to reconnect.';
    openHost(true);
    return true;
  }
  function openHost(resume) {
    var tries = 0;
    loadPeer(function () {
      (function open() {
        if (N.role !== 'host') return;
        var p = new Peer(PREFIX + N.code); N.peer = p;
        p.on('open', function () { N.status = ''; refresh(); if (D && D.mode === 'host') runBots(); });
        p.on('error', function (e) {
          if (e.type === 'unavailable-id') {
            try { p.destroy(); } catch (x) {}
            if (resume && tries++ < 15) { N.status = 'Reopening your table (code ' + N.code + ')...'; refresh(); setTimeout(open, 3000); }
            else { N.code = newCode(); open(); }
          } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') { N.status = 'Connection trouble. Retrying...'; refresh(); }
        });
        p.on('disconnected', function () { setTimeout(function () { try { if (!p.destroyed) p.reconnect(); } catch (x) {} }, 1500); });
        p.on('connection', function (conn) {
          conn.on('data', function (d) { hostRecv(conn, d); });
          conn.on('close', function () { hostDrop(conn); });
          conn.on('error', function () { hostDrop(conn); });
        });
      })();
    });
  }
  function lobbyBroadcast() {
    var L = N.lobby; if (!L) return;
    L.seats.forEach(function (st, i) { if (st.kind === 'remote') send(st.conn, { t: 'lobby', seats: L.seats.map(function (x) { return { name: x.name, kind: x.kind }; }), cfg: L.cfg, seat: i, code: N.code }); });
    refresh();
  }
  function hostRecv(conn, d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'hello') {
      var nm = cleanName(d.name), pid = String(d.pid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || null, i;
      if (D && D.mode === 'host') {
        var seats = D.seats, low = nm.toLowerCase();
        i = pid ? seats.findIndex(function (st) { return st.kind === 'remote' && st.pid === pid; }) : -1;
        if (i < 0) i = seats.findIndex(function (st) { return st.kind === 'remote' && st.name.toLowerCase() === low; });
        if (i < 0) i = seats.findIndex(function (st) { return st.kind === 'bot'; });
        if (i < 0) { send(conn, { t: 'full' }); return; }
        var back = seats[i].kind === 'remote';
        if (seats[i].conn && seats[i].conn !== conn) { try { seats[i].conn.close(); } catch (e) {} }
        seats[i].kind = 'remote'; seats[i].conn = conn; seats[i].name = nm; seats[i].pid = pid; D.s.players[i].name = nm; conn.seat = i;
        D.msg = nm + (back ? ' is back.' : ' joined and took over a computer seat.'); save(); publish(); runBots();
        return;
      }
      if (N.lobby) {
        var L = N.lobby;
        i = L.seats.findIndex(function (st) { return st.kind === 'remote' && ((pid && st.pid === pid) || st.name.toLowerCase() === nm.toLowerCase()); });
        if (i < 0) i = fillOrder(L.seats.length, L.cfg.mode === 'team').filter(function (k) { return L.seats[k] && L.seats[k].kind === 'open'; })[0];
        if (i === undefined || i < 0) { send(conn, { t: 'full' }); return; }
        L.seats[i] = { name: nm, kind: 'remote', conn: conn, pid: pid }; conn.seat = i;
        lobbyBroadcast();
      }
    } else if (d.t === 'act') {
      if (conn.seat === undefined || !D || D.mode !== 'host' || D.seats[conn.seat].conn !== conn) return;
      var err = apply(conn.seat, d.a, d.x);
      if (err) send(conn, { t: 'err', msg: err });
    } else if (d.t === 'bye') { hostDrop(conn, true); }
  }
  function hostDrop(conn, left) {
    var i = conn.seat; if (i === undefined) return;
    if (D && D.mode === 'host') {
      var st = D.seats[i]; if (st.conn !== conn) return;
      st.conn = null; st.awayAt = Date.now();
      D.msg = st.name + (left ? ' left the game. A computer will play for them.' : ' lost connection. Waiting a moment for them to come back.');
      if (left) st.awayAt = 0;
      publish(); runBots();
    } else if (N.lobby && N.lobby.seats[i] && N.lobby.seats[i].conn === conn) {
      N.lobby.seats[i] = { name: '', kind: 'open' }; lobbyBroadcast();
    }
  }
  function hostStart() {
    var L = N.lobby; if (!L) return;
    var used = {}; L.seats.forEach(function (st) { if (st.name) used[st.name.toLowerCase()] = 1; });
    var seats = L.seats.map(function (st, i) {
      if (st.kind !== 'open') return { name: st.name, kind: st.kind, conn: st.conn || null, pid: st.pid || null };
      var nm = BOTS[i - 1]; if (used[nm.toLowerCase()]) nm = nm + ' (cpu)';
      return { name: nm, kind: 'bot', conn: null };
    });
    var s = E.newGame({ names: seats.map(function (st) { return st.name; }), target: L.cfg.target, teams: L.cfg.mode === 'team', level: L.cfg.level });
    N.lobby = null;
    newDriver(s, seats, 'host');
    commit('Game on! ' + pname(s.dealer) + ' dealt. ' + pname(s.turn) + ' bids first.');
    location.hash = '#/pitch/online';
  }

  // ---- client ----
  function join(code, name) {
    closeNet();
    N.role = 'client'; N.code = code.toUpperCase().replace(/[^A-Z0-9]/g, ''); N.name = cleanName(name); N.status = 'Connecting...';
    refresh();
    loadPeer(function () {
      if (N.role !== 'client') return;
      var p = new Peer(); N.peer = p;
      p.on('open', connect);
      p.on('error', function (e) {
        if (e.type === 'peer-unavailable') {
          if (N.view) { N.status = 'Host is away. Retrying...'; refresh(); setTimeout(function () { if (N.role === 'client' && !(N.conn && N.conn.open)) connect(); }, 4000); }
          else { N.status = 'No game found with code ' + N.code + '. Check the code, and make sure the host has High-Low Jack open.'; refresh(); }
        } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') { N.status = 'Connection trouble. Retrying...'; refresh(); }
      });
      p.on('disconnected', function () { setTimeout(function () { try { if (!p.destroyed) p.reconnect(); } catch (x) {} }, 1500); });
    });
  }
  function connect() {
    if (N.role !== 'client' || !N.peer) return;
    var c = N.peer.connect(PREFIX + N.code, { reliable: true }); N.conn = c;
    c.on('open', function () { N.status = ''; send(c, { t: 'hello', name: N.name, pid: myPid() }); refresh(); });
    c.on('data', clientRecv);
    c.on('close', function () {
      if (N.role !== 'client' || N.conn !== c) return;
      N.status = 'Connection lost. Reconnecting...'; refresh();
      setTimeout(function () { if (N.role === 'client' && N.conn === c) connect(); }, 2500);
    });
  }
  function clientRecv(d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'lobby') { N.lobby = d; N.seat = d.seat; refresh(); }
    else if (d.t === 'state') {
      N.view = d.v; N.seat = d.seat; N.info = d.info; N.msg = d.msg; N.lobby = null; N.status = '';
      if (location.hash.indexOf('#/pitch') === 0 && location.hash !== '#/pitch/online') location.hash = '#/pitch/online';
      else refresh();
    }
    else if (d.t === 'err') UI.toast(d.msg);
    else if (d.t === 'full') { N.status = 'That game is full.'; refresh(); }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !N.peer) return;
    try { if (N.peer.disconnected && !N.peer.destroyed) N.peer.reconnect(); } catch (e) {}
    if (N.role === 'client' && !(N.conn && N.conn.open)) setTimeout(connect, 800);
  });

  // =================== Records (saved on each phone) ===================
  function myPid() {
    var p = UI.store('rum_pid'); // same player id as Rummy so family members match across games
    if (!p) { p = ''; for (var i = 0; i < 12; i++) p += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]; UI.store('rum_pid', p); }
    return p;
  }
  function personKey(p) { return p.pid ? 'id:' + p.pid : 'name:' + String(p.n).toLowerCase(); }
  function recordGame(s, mySeat, info, online) {
    var log = UI.store('pit_log') || [];
    for (var k = 0; k < log.length; k++) if (log[k].gid === s.gid) return log[k];
    var my = s.players[mySeat], best = -Infinity, mine = s.scores[my.team];
    s.scores.forEach(function (x, i) { if (i !== my.team && x > best) best = x; });
    var made = 0, set = 0, fours = 0, pts = { high: 0, low: 0, jack: 0, game: 0 };
    s.history.forEach(function (r) {
      if (r.bidder === mySeat) { if (r.made) { made++; if (r.bid === 4) fours++; } else set++; }
      if (r.high && r.high.s === mySeat) pts.high++;
      if (r.low && r.low.s === mySeat) pts.low++;
      if (r.jack && r.jack.s === mySeat) pts.jack++;
      if (r.game === my.team) pts.game++;
    });
    var e = { gid: s.gid, t: Date.now(), online: !!online, teams: !!s.teams, target: s.target, hands: s.round, won: s.winner === my.team,
      seat: mySeat, myTeam: my.team, side: mine, margin: mine - best, made: made, set: set, fours: fours, pts: pts,
      players: s.players.map(function (p, i) {
        var inf = info ? info[i] : null;
        return { n: p.name, pid: i === mySeat ? myPid() : inf ? inf.pid || null : null, bot: inf ? inf.kind === 'bot' : i !== mySeat, sc: s.scores[p.team], tm: p.team };
      }) };
    log.unshift(e); if (log.length > 500) log.length = 500;
    UI.store('pit_log', log);
    return e;
  }
  function stats() {
    var log = (UI.store('pit_log') || []).slice().reverse();
    var st = { games: 0, w: 0, l: 0, cpu: { w: 0, l: 0 }, net: { w: 0, l: 0 }, team: { w: 0, l: 0 }, solo: { w: 0, l: 0 },
      margin: null, fast: null, best: 0, cur: 0, made: 0, set: 0, fours: 0, high: 0, low: 0, jack: 0, game: 0, hands: 0, people: {}, log: log };
    log.forEach(function (g) {
      st.games++; if (g.won) st.w++; else st.l++;
      var humans = g.players.some(function (p, i) { return i !== g.seat && !p.bot; });
      var b = humans ? st.net : st.cpu; if (g.won) b.w++; else b.l++;
      b = g.teams ? st.team : st.solo; if (g.won) b.w++; else b.l++;
      st.made += g.made; st.set += g.set; st.fours += g.fours; st.hands += g.hands;
      st.high += g.pts.high; st.low += g.pts.low; st.jack += g.pts.jack; st.game += g.pts.game;
      if (g.won && (!st.margin || g.margin > st.margin.v)) st.margin = { v: g.margin, g: g };
      if (g.won && (!st.fast || g.hands < st.fast.v)) st.fast = { v: g.hands, g: g };
      if (g.won) st.cur = st.cur > 0 ? st.cur + 1 : 1; else st.cur = st.cur < 0 ? st.cur - 1 : -1;
      if (st.cur > st.best) st.best = st.cur;
      var me = g.players[g.seat];
      g.players.forEach(function (p, i) {
        if (i === g.seat || p.bot) return;
        var key = personKey(p), x = st.people[key] = st.people[key] || { n: p.n, vsW: 0, vsL: 0, wW: 0, wL: 0, games: 0 };
        x.n = p.n; x.games++;
        if (g.teams && p.tm === g.myTeam) { if (g.won) x.wW++; else x.wL++; }
        else if (g.won) x.vsW++; else if (me.sc < p.sc || g.teams) x.vsL++;
      });
    });
    return st;
  }
  function pct(w, l) { return w + l ? Math.round(100 * w / (w + l)) + '%' : '-'; }
  function when(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2); }

  function statsScreen(root) {
    root.appendChild(UI.topbar('My High-Low Jack record', '#/pitch'));
    var st = stats();
    if (!st.games) {
      root.appendChild(h('div', { class: 'panel' }, [h('p', { class: 'levelnote', style: 'margin:0', text: 'No finished games yet. Every game you finish on this phone, against the computer or online, is saved here for good.' })]));
      return;
    }
    function tile(big, small) { return h('div', { class: 'rumtile' }, [h('b', { text: big }), h('span', { text: small })]); }
    root.appendChild(h('div', { class: 'rumtiles' }, [tile(String(st.games), 'games'), tile(String(st.w), 'wins'), tile(String(st.l), 'losses'), tile(pct(st.w, st.l), 'win rate')]));
    function rec(label, b) { return h('div', { class: 'rumrow' }, [h('span', { text: label }), h('b', { text: b.w + b.l ? b.w + '-' + b.l + ' \u00B7 ' + pct(b.w, b.l) : '-' })]); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Win rate' }), rec('Against the computer', st.cpu), rec('Online with family', st.net), rec('Partners 2v2', st.team), rec('Every player for themselves', st.solo)]));
    function rr(label, v, extra) { return h('div', { class: 'rumrow' }, [h('span', { text: label }), h('b', { text: v === null || v === undefined ? '-' : v + (extra || '') })]); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'All-time records' }),
      rr('Bids made', st.made + st.set ? st.made + ' of ' + (st.made + st.set) + ' (' + pct(st.made, st.set) + ')' : null),
      rr('Times you got set', st.set),
      rr('Bid 4 and made it', st.fours),
      rr('High points won', st.high), rr('Low points won', st.low), rr('Jacks taken', st.jack), rr('Game points (your side)', st.game),
      rr('Biggest win', st.margin && st.margin.v, st.margin ? ' points (' + when(st.margin.g.t) + ')' : ''),
      rr('Fastest win', st.fast && st.fast.v, st.fast ? (st.fast.v === 1 ? ' hand' : ' hands') : ''),
      rr('Longest win streak', st.best, st.best === 1 ? ' game' : ' games'),
      rr('Current streak', st.cur > 0 ? st.cur + ' win' + (st.cur > 1 ? 's' : '') : st.cur < 0 ? -st.cur + ' loss' + (st.cur < -1 ? 'es' : '') : '-'),
      rr('Hands played', st.hands || null)]));
    var ppl = Object.keys(st.people).map(function (k) { return st.people[k]; }).sort(function (a, b) { return b.games - a.games; });
    if (ppl.length) {
      root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Head to head' })].concat(ppl.map(function (x) {
        var parts = [];
        if (x.vsW + x.vsL) parts.push('vs: you ' + x.vsW + ', ' + x.n + ' ' + x.vsL);
        if (x.wW + x.wL) parts.push('as partners: ' + x.wW + '-' + x.wL);
        return h('div', { class: 'rumrow' }, [h('span', { text: x.n }), h('b', { text: parts.join(' \u00B7 ') || x.games + ' games' })]);
      }))));
    }
    var recent = st.log.slice().reverse().slice(0, 25);
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Recent games' })].concat(recent.map(function (g) {
      var seen = {}, who = [];
      g.players.forEach(function (p, i) {
        if (g.teams) { if (seen[p.tm]) return; seen[p.tm] = 1; who.push((p.tm === g.myTeam ? 'Us' : 'Them') + ' ' + p.sc); }
        else who.push((i === g.seat ? 'You' : p.n) + ' ' + p.sc);
      });
      return h('div', { class: 'rumgame' + (g.won ? ' won' : '') }, [
        h('b', { text: (g.won ? 'Won' : 'Lost') + ' \u00B7 ' + when(g.t) + ' \u00B7 to ' + g.target + (g.online ? ' \u00B7 online' : '') + (g.teams ? ' \u00B7 partners' : '') }),
        h('span', { text: who.join(', ') + ' (' + g.hands + ' hands)' })]);
    }))));
    root.appendChild(h('button', { class: 'ghostbtn', text: 'Reset my record', onclick: function () {
      UI.modal({ title: 'Erase your record?', text: 'This wipes every saved High-Low Jack game on this phone. It cannot be undone.',
        buttons: [{ label: 'Keep my record', cls: 'pitch' }, { label: 'Erase it', fn: function () { UI.store('pit_log', null); location.reload(); } }] });
    } }));
  }

  // =================== Screens ===================
  function setup(root) {
    var cfg = cfgGet();
    root.appendChild(UI.topbar('High-Low Jack', '#/'));
    var saved = UI.store('pit_game');
    if (N.role === 'client' && N.view) root.appendChild(h('button', { class: 'bigbtn pitch', text: 'Back to your online game', onclick: function () { location.hash = '#/pitch/online'; } }));
    else if (N.role === 'host' && D && D.mode === 'host') root.appendChild(h('button', { class: 'bigbtn pitch', text: 'Back to your online game (code ' + N.code + ')', onclick: function () { location.hash = '#/pitch/online'; } }));
    else if (saved && saved.phase !== 'gameover') {
      root.appendChild(h('button', { class: 'bigbtn pitch', text: 'Continue game (' + (saved.teams ? 'Us ' + saved.scores[0] + ', Them ' + saved.scores[1] : 'You ' + saved.scores[0]) + ', hand ' + saved.round + ')',
        onclick: function () { location.hash = '#/pitch/play'; } }));
    }
    var stq = stats();
    root.appendChild(h('button', { class: 'pill rumrecbtn', text: String.fromCodePoint(0x1F3C6) + ' My record' + (stq.games ? ': ' + stq.w + '-' + stq.l + ' (' + pct(stq.w, stq.l) + ')' : ''), onclick: function () { location.hash = '#/pitch/stats'; } }));
    var noteEl = h('p', { class: 'levelnote' });
    function keep() { UI.store('pit_cfg', cfg); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Players' }), UI.seg([
      { value: 'team', label: 'Partners 2v2' }, { value: '1', label: 'You + 1' }, { value: '2', label: 'You + 2' }, { value: '3', label: 'You + 3' }
    ], cfg.mode, function (v) { cfg.mode = v; keep(); }),
      h('p', { class: 'levelnote', text: 'Partners is the classic: you and your partner sit across from each other and share one score. The others are every player for themselves (cutthroat).' })]));
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Play to' }), UI.seg([
      { value: 7, label: '7' }, { value: 11, label: '11' }, { value: 15, label: '15' }, { value: 21, label: '21' }
    ], cfg.target, function (v) { cfg.target = v; keep(); }), h('p', { class: 'levelnote', text: '11 is the usual game. 21 is a long one.' })]));
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note; }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Computer level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); keep(); }), noteEl]));
    setNote();
    root.appendChild(h('button', { class: 'bigbtn pitch', text: 'Play against the computer', onclick: function () {
      keep();
      var n = seatCount(cfg.mode), names = ['You'];
      for (var i = 1; i < n; i++) names.push(BOTS[i - 1]);
      UI.store('pit_game', E.newGame({ names: names, target: cfg.target, teams: cfg.mode === 'team', level: cfg.level }));
      location.hash = '#/pitch/play';
    } }));
    root.appendChild(h('div', { class: 'panel' }, [
      h('h3', { text: 'Play online with family' }),
      h('p', { class: 'levelnote', style: 'margin-top:0', text: 'Each person plays on their own phone. One person hosts and gets a 4-letter code; everyone else taps Join and types it in. Empty seats are filled by computers. In partners, the first person to join sits across from the host.' }),
      h('div', { class: 'rumtwo' }, [
        h('button', { class: 'bigbtn pitch', text: 'Host a game', onclick: function () { keep(); location.hash = '#/pitch/host'; } }),
        h('button', { class: 'bigbtn rummyalt', text: 'Join a game', onclick: function () { location.hash = '#/pitch/join'; } })
      ]),
      UI.store('pit_net') && !(N.role === 'host' && D) ? h('button', { class: 'ghostbtn', text: 'Reopen my last online table', onclick: function () { hostResume(); location.hash = '#/pitch/online'; } }) : null
    ]));
    root.appendChild(h('h3', { class: 'rumsub', text: 'Size and speed' }));
    root.appendChild(CardPrefs.panel());
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>The goal</h3><p>Also called <b>Pitch</b>. Each hand there are 4 points up for grabs. First side to the target score wins.</p>' +
      '<h3>The deal and the bid</h3><p>Everyone gets 6 cards. Going around once, each player bids <b>2, 3 or 4</b> (how many of the 4 points they think they can win) or passes. You have to beat the last bid. If everyone passes, the dealer is stuck with 2.</p>' +
      '<h3>The pitch</h3><p>The high bidder leads the first card. Its suit becomes <b>trump</b> for the hand.</p>' +
      '<h3>Playing tricks</h3><ul><li>Follow the suit that was led if you can. You may <b>always play trump</b> instead.</li><li>If you cannot follow suit, play anything.</li><li>Highest trump wins the trick. With no trump in it, the highest card of the suit led wins. Aces are high.</li><li>Whoever wins the trick leads the next one.</li></ul>' +
      '<h3>The 4 points</h3><ul><li><b>High:</b> the highest trump played.</li><li><b>Low:</b> the lowest trump played. It goes to whoever played it.</li><li><b>Jack:</b> whoever wins the Jack of trump in a trick. (No point if nobody was dealt it.)</li><li><b>Game:</b> whoever takes the most in tricks, counting 10s as 10, Aces 4, Kings 3, Queens 2, Jacks 1. A tie means nobody gets it.</li></ul>' +
      '<h3>Making your bid</h3><p>If the bidder wins at least as many points as they bid, they score them all. If not, they are <b>set</b>: the bid comes off their score (scores can go below zero). Everyone else always keeps what they win. If the bidder makes it and crosses the target, the bidder wins.</p>' +
      '<h3>Tips</h3><ul><li>Holding the Ace of a suit is a sure High. Holding the 2 is a sure Low.</li><li>Lead your big trumps early to pull out the Jack.</li><li>When your partner is winning a trick, throw them your 10s.</li></ul>' }));
  }

  function nameInput() {
    var inp = h('input', { class: 'ruminput', type: 'text', maxlength: 14, placeholder: 'Your name', value: UI.store('rum_name') || '', autocomplete: 'off' });
    inp.addEventListener('input', function () { UI.store('rum_name', inp.value); });
    return inp;
  }
  function seatList(seats, teams, mySeat) {
    var box = h('div', { class: 'rumseats' });
    seats.forEach(function (st, i) {
      var label = st.kind === 'open' ? 'Open seat (a computer plays if nobody joins)' : st.name + (i === mySeat ? ' (you)' : '') + (i === 0 ? ' \u00B7 host' : '');
      var tag = teams ? (i % 2 === 0 ? 'Team 1' : 'Team 2') : 'Seat ' + (i + 1);
      box.appendChild(h('div', { class: 'rumseat' + (st.kind === 'open' ? ' open' : ''), style: '--c:' + COLORS[i] }, [h('b', { text: tag }), h('span', { text: label })]));
    });
    return box;
  }
  function hostScreen(root) {
    root.appendChild(UI.topbar('Host online', '#/pitch'));
    if (D && D.mode === 'host' && N.role === 'host') { location.hash = '#/pitch/online'; return; }
    var body = h('div'); root.appendChild(body);
    function draw() {
      body.innerHTML = '';
      if (N.role !== 'host' || !N.lobby) {
        var inp = nameInput();
        body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Your name' }), inp]));
        var c = cfgGet();
        body.appendChild(h('p', { class: 'levelnote', text: (c.mode === 'team' ? 'Partners 2v2' : seatCount(c.mode) + ' players') + ', play to ' + c.target + '. Change these on the High-Low Jack menu.' }));
        body.appendChild(h('button', { class: 'bigbtn pitch', text: 'Open my table', onclick: function () {
          if (!inp.value.trim()) { UI.toast('Type your name first.'); inp.focus(); return; }
          hostLobby(cleanName(inp.value)); draw();
        } }));
        return;
      }
      var L = N.lobby;
      body.appendChild(h('div', { class: 'panel rumcodebox' }, [
        h('h3', { text: 'Game code' }),
        h('div', { class: 'rumcode', text: N.status && !N.peer ? '....' : N.code }),
        h('p', { class: 'levelnote', text: N.status || 'Tell your family this code. They open Game Night, tap High-Low Jack, then Join a game.' }),
        h('button', { class: 'ghostbtn', text: '\uD83D\uDCE4 Send the code', onclick: function () {
          var t = 'Join my High-Low Jack game on Game Night. Code: ' + N.code, url = location.origin + location.pathname + '#/pitch/join';
          if (navigator.share) navigator.share({ title: 'High-Low Jack', text: t, url: url }).catch(function () {});
          else { try { navigator.clipboard.writeText(t + ' ' + url); UI.toast('Copied. Paste it in a text.'); } catch (e) { UI.toast(t); } }
        } })
      ]));
      body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Players' }), seatList(L.seats, L.cfg.mode === 'team', 0)]));
      body.appendChild(h('button', { class: 'bigbtn pitch', text: 'Start the game', onclick: hostStart }));
      body.appendChild(h('button', { class: 'ghostbtn', text: 'Cancel', onclick: function () { leaveOnline(); location.hash = '#/pitch'; } }));
    }
    onUpdate = function () { if (document.body.contains(body)) draw(); };
    draw();
  }
  function joinScreen(root) {
    root.appendChild(UI.topbar('Join a game', '#/pitch'));
    var body = h('div'); root.appendChild(body);
    function draw() {
      body.innerHTML = '';
      if (N.role === 'client' && N.lobby) {
        var L = N.lobby;
        body.appendChild(h('div', { class: 'panel rumcodebox' }, [h('h3', { text: 'Joined game ' + L.code }), h('p', { class: 'levelnote', text: 'You are in! Waiting for the host to start. Play to ' + L.cfg.target + '.' })]));
        body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Players' }), seatList(L.seats, L.cfg.mode === 'team', L.seat)]));
        body.appendChild(h('button', { class: 'ghostbtn', text: 'Leave', onclick: function () { closeNet(); location.hash = '#/pitch'; } }));
        return;
      }
      var nameI = nameInput();
      var codeI = h('input', { class: 'ruminput rumcodein', type: 'text', maxlength: 4, placeholder: 'CODE', autocomplete: 'off', autocapitalize: 'characters', value: N.role === 'client' ? N.code : '' });
      codeI.addEventListener('input', function () { codeI.value = codeI.value.toUpperCase(); });
      body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Your name' }), nameI, h('h3', { text: 'Game code', style: 'margin-top:14px' }), codeI,
        N.status ? h('p', { class: 'levelnote rumwarn', text: N.status }) : null]));
      body.appendChild(h('button', { class: 'bigbtn pitch', text: 'Join', onclick: function () {
        if (!nameI.value.trim()) { UI.toast('Type your name first.'); return; }
        if (codeI.value.trim().length < 4) { UI.toast('The code has 4 letters or numbers.'); return; }
        join(codeI.value, nameI.value);
      } }));
    }
    onUpdate = function () { if (document.body.contains(body)) draw(); };
    draw();
  }

  function cardEl(c, cls) {
    var r = E.RANKS[E.rank(c)], su = E.SUITS[E.suit(c)];
    return h('div', { class: 'pcard ' + (E.red(c) ? 'red ' : '') + (cls || ''), 'data-c': c }, [
      h('span', { class: 'pc-tl', html: r + '<br>' + su }), h('span', { class: 'pc-mid', text: su })
    ]);
  }

  function play(root) {
    var s = UI.store('pit_game');
    if (!s) { location.hash = '#/pitch'; return; }
    if (D && D.mode === 'host') { location.hash = '#/pitch/online'; return; }
    newDriver(s, s.players.map(function (p, i) { return { name: p.name, kind: i === 0 ? 'me' : 'bot' }; }), 'local');
    if (!D.msg) D.msg = s.round === 1 && s.phase === 'bid' && s.bids.every(function (b) { return b === null; }) ? pname(s.dealer) + ' dealt. ' + pname(s.turn) + ' bids first.' : '';
    table(root, {
      back: '#/pitch', online: false, isHost: true,
      seat: function () { return 0; }, view: function () { return D.s; }, msg: function () { return D.msg; }, info: function () { return null; }, status: function () { return ''; },
      act: function (a, x) { var err = apply(0, a, x); if (err) UI.toast(err); }
    });
    runBots();
  }
  function online(root) {
    if (N.role === 'host' && D && D.mode === 'host') {
      table(root, {
        back: '#/pitch', online: true, isHost: true,
        seat: function () { return 0; }, view: function () { return D.s; }, msg: function () { return D.msg; }, info: seatInfo,
        status: function () { return N.status ? N.status : 'Code ' + N.code; },
        act: function (a, x) { var err = apply(0, a, x); if (err) UI.toast(err); }
      });
      return;
    }
    if (N.role === 'client' && N.view) {
      table(root, {
        back: '#/pitch', online: true, isHost: false,
        seat: function () { return N.seat; }, view: function () { return N.view; }, msg: function () { return N.msg; }, info: function () { return N.info; },
        status: function () { return N.status || 'Game ' + N.code; },
        act: function (a, x) { if (!(N.conn && N.conn.open)) { UI.toast('Reconnecting... try again in a moment.'); return; } send(N.conn, { t: 'act', a: a, x: x }); }
      });
      return;
    }
    location.hash = '#/pitch';
  }

  // The card table
  function table(root, src) {
    var scene = h('div', { class: 'rumscene' }); root.appendChild(scene);
    root.appendChild(UI.topbar('High-Low Jack', src.back, h('div', { class: 'rumtopbtns' }, [
      h('button', { class: 'iconbtn', html: '&#9881;&#65039;', 'aria-label': 'Settings: size, speed and sound', onclick: soundPanel }),
      h('button', { class: 'iconbtn', html: '&#128202;', 'aria-label': 'Scores', onclick: scoreSheet })])));
    var netEl = h('div', { class: 'rumnet' }), board = h('div', { class: 'pitboard' });
    var status = h('div', { class: 'status rumstatus' }), felt = h('div', { class: 'pitfelt' });
    var bidBar = h('div', { class: 'pitbids' }), handEl = h('div', { class: 'rumhand pithand' });
    [netEl, board, status, felt, bidBar, handEl].forEach(function (x) { root.appendChild(x); });
    if (!src.online) netEl.style.display = 'none';
    var lastMsg = null, shownKey = '', prev = null, calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function S() { return src.view(); }
    function seat() { return src.seat(); }
    function me() { return S().players[seat()]; }
    function myTurn() { var s = S(); return s.turn === seat() && (s.phase === 'bid' || s.phase === 'play'); }
    function youify(m) {
      var nm = me().name;
      if (m && nm !== 'You') m = m.split(nm + ' ').join('You ').replace(/You (is|was) /g, 'You are ');
      return (m || '').replace(/You takes/g, 'You take').replace(/You bids first/g, 'You bid first').replace(/You leads/g, 'You lead').replace(/(You won the bid at \d) and leads/g, '$1 and lead');
    }
    // seat position around the table, relative to me (bottom)
    function posOf(i) {
      var s = S(), n = s.players.length, k = (i - seat() + n) % n;
      if (n === 2) return ['s', 'n'][k];
      if (n === 3) return ['s', 'w', 'e'][k];
      return ['s', 'w', 'n', 'e'][k];
    }
    function sideLabel(t) { var s = S(); return s.teams ? (t === me().team ? 'Us' : 'Them') : (t === seat() ? 'You' : s.players[t].name); }
    function prompt() {
      var s = S();
      if (s.phase === 'bid') return E.canPass(s, seat()) ? (s.high ? 'Your bid. Beat ' + s.high + ', or pass.' : 'Your bid: 2, 3 or 4, or pass.') :'Everyone passed. As dealer you are stuck with a bid.';
      if (!s.trick.length && s.trump === null) return 'You won the bid. Lead a card: its suit becomes trump.';
      if (!s.trick.length) return 'Your lead. Play any card.';
      return 'Your turn. Follow ' + suitName(E.suit(s.trick[0].c)) + ' if you can, or play trump.';
    }

    function render() {
      if (!document.body.contains(scene)) return;
      var s = S(), info = src.info(), mySeat = seat(), my = me();
      netEl.textContent = src.online ? (src.isHost ? '\uD83D\uDCF6 Hosting \u00B7 ' : '\uD83D\uDCF6 Online \u00B7 ') + src.status() : '';
      // score + trump strip
      board.innerHTML = '';
      var sc = E.sides(s).map(function (x, t) { return sideLabel(t) + ' ' + x.score; }).join(' \u00B7 ');
      board.appendChild(h('div', { class: 'rumscore', text: sc + ' / ' + s.target + ' \u00B7 Hand ' + s.round }));
      var tline = s.trump !== null ? 'Trump: ' + E.SUITS[s.trump] + ' ' + suitName(s.trump) : s.phase === 'bid' ? 'Bidding' + (s.high ? ': high bid ' + s.high + ' (' + s.players[s.bidder].name + ')' : '') : 'Waiting for the pitch';
      if (s.phase === 'play' && s.bidder >= 0) tline += ' \u00B7 ' + (s.bidder === mySeat ? 'You' : s.players[s.bidder].name) + ' bid ' + s.high;
      board.appendChild(h('div', { class: 'pittrump' + (s.trump !== null && E.red(s.trump * 13) ? ' red' : ''), text: tline }));
      // status
      var m = src.msg();
      if (m !== lastMsg) lastMsg = m;
      var waiting = (s.phase === 'bid' || s.phase === 'play') && s.turn !== mySeat ? ' Waiting for ' + s.players[s.turn].name + '...' : '';
      status.textContent = (m ? youify(m) : '') + (myTurn() ? ' ' + prompt() : waiting);
      status.classList.toggle('alert', myTurn());
      // the felt: a seat badge for every player, and the card each has in the current trick
      felt.innerHTML = '';
      felt.className = 'pitfelt n' + s.players.length;
      var trickBy = {}, showing = s.trick, faded = false;
      if (!s.trick.length && s.lastTrick && (s.phase === 'play' || s.phase === 'over' || s.phase === 'gameover')) { showing = s.lastTrick.cards; faded = true; }
      showing.forEach(function (t) { trickBy[t.s] = t.c; });
      s.players.forEach(function (p, i) {
        var pos = posOf(i), inf = info ? info[i] : null, partner = s.teams && i !== mySeat && p.team === my.team;
        var tag = inf ? (inf.kind === 'bot' ? 'computer' : !inf.on ? 'away' : '') : '';
        var bidTxt = s.bids[i] === null || s.bids[i] === undefined ? '' : s.bids[i] ? 'bid ' + s.bids[i] : 'pass';
        var line = [p.hand.length + ' card' + (p.hand.length === 1 ? '' : 's'), bidTxt, i === s.dealer ? 'dealer' : '', tag].filter(Boolean).join(' \u00B7 ');
        felt.appendChild(h('div', { class: 'pitseat ' + pos + (s.turn === i && (s.phase === 'bid' || s.phase === 'play') ? ' on' : '') + (i === s.bidder && s.phase !== 'bid' ? ' bidder' : ''), 'data-seat': i, style: '--c:' + COLORS[i] }, [
          h('b', { text: i === mySeat ? 'You' : cp(AV[i]) + ' ' + p.name + (partner ? ' (partner)' : '') }),
          h('span', { text: line })
        ]));
        if (trickBy[i] !== undefined) {
          var won = faded && s.lastTrick.w === i;
          var el = cardEl(trickBy[i], 'sm pittc ' + pos + (faded ? ' old' : '') + (won ? ' won' : '') + (E.suit(trickBy[i]) === s.trump ? ' trump' : ''));
          felt.appendChild(el);
        }
      });
            // bid buttons
      bidBar.innerHTML = '';
      if (s.phase === 'bid' && myTurn()) {
        if (E.canPass(s, mySeat)) bidBar.appendChild(h('button', { class: 'pitbidbtn pass', text: 'Pass', onclick: function () { Sound.play('pop', 1); src.act('bid', 0); } }));
        [2, 3, 4].forEach(function (v) {
          var ok = v >= E.minBid(s);
          bidBar.appendChild(h('button', { class: 'pitbidbtn', text: 'Bid ' + v, disabled: !ok, onclick: function () { if (!ok) return; Sound.play('chips'); src.act('bid', v); } }));
        });
        var tip = E.bestSuit(my.hand.filter(function (c) { return c >= 0; }));
        bidBar.appendChild(h('button', { class: 'pitbidbtn hint', text: 'Hint', onclick: function () {
          var est = Math.floor(tip.value + 0.15);
          UI.toast(est >= E.minBid(s) ? 'Your best suit is ' + suitName(tip.suit) + '. It looks good for about ' + Math.min(4, est) + '.' : 'Your best suit is ' + suitName(tip.suit) + ', but it looks weak. ' + (E.canPass(s, mySeat) ? 'Passing is fine.' : 'Bid 2.'));
        } }));
      }
      // hand
      handEl.innerHTML = '';
      var legal = myTurn() && s.phase === 'play' ? E.legal(s, mySeat) : [];
      var cards = my.hand.slice().sort(function (a, b) {
        var ta = s.trump !== null && E.suit(a) === s.trump, tb = s.trump !== null && E.suit(b) === s.trump;
        return (tb - ta) || E.suit(a) - E.suit(b) || E.power(b) - E.power(a);
      });
      var cs = CardPrefs.size(), W = handEl.clientWidth || 340, CW = 58 * cs, n = cards.length;
      var step = n > 1 ? Math.min(CW + 6, (W - CW) / (n - 1)) : 0, left0 = Math.max(0, (W - (CW + step * (n - 1))) / 2);
      handEl.style.height = Math.round(84 * cs + 22) + 'px';
      cards.forEach(function (c, k) {
        var playable = legal.indexOf(c) >= 0;
        var el = cardEl(c, 'big' + (playable ? ' tap' : '') + (myTurn() && s.phase === 'play' && !playable ? ' dim' : '') + (s.trump !== null && E.suit(c) === s.trump ? ' trump' : ''));
        el.style.left = (left0 + k * step) + 'px'; el.style.top = '16px'; el.style.zIndex = k + 1;
        el.addEventListener('click', function () {
          var st = S();
          if (st.phase === 'bid') { UI.toast(myTurn() ? 'Bid first, using the buttons above your cards.' : 'Bidding is going on.'); return; }
          if (!myTurn()) { UI.toast('Wait for your turn.'); return; }
          if (!playable) { Sound.play('nope'); UI.toast('Follow ' + suitName(E.suit(st.trick[0].c)) + ' if you can, or play trump.'); return; }
          Sound.play('flick'); src.act('card', c);
        });
        handEl.appendChild(el);
      });
      animate(s);
      if (s.phase === 'over' || s.phase === 'gameover') {
        var key = s.round + s.phase + (s.gid || '');
        if (key !== shownKey) { shownKey = key; setTimeout(roundOver, CardPrefs.ms(1300)); }
      } else if (shownKey && document.querySelector('.pitroundmodal')) { UI.closeModal(); shownKey = ''; }
    }

    // ---------- card motion: a played card flies from the player to the middle ----------
    function animate(s) {
      var p = prev, cur = { gid: s.gid, round: s.round, played: s.played.length };
      prev = cur;
      if (calm || !p || p.gid !== s.gid || p.round !== s.round || s.played.length <= p.played) return;
      s.played.slice(p.played).forEach(function (t, k) {
        var el = felt.querySelector('.pittc[data-c="' + t.c + '"]'), from = felt.querySelector('.pitseat[data-seat="' + t.s + '"]');
        if (t.s === seat()) from = handEl;
        if (!el || !from || !el.animate) return;
        var a = el.getBoundingClientRect(), b = from.getBoundingClientRect();
        var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        el.animate([
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.7) rotate(-25deg)', opacity: 0.4 },
          { offset: 0.8, transform: 'translate(0,-6px) scale(1.08) rotate(4deg)', opacity: 1 },
          { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 }
        ], { duration: CardPrefs.ms(420), delay: CardPrefs.ms(k * 120), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
        setTimeout(function () { Sound.play('slap'); }, CardPrefs.ms(380 + k * 120));
      });
    }

    function pointRows(r) {
      var s = S(), t = h('table', { class: 'rumtbl' });
      function who(x) { return x ? (x.s === seat() ? 'You' : s.players[x.s].name) + ' (' + E.label(x.c) + ')' : 'Nobody (not dealt)'; }
      t.appendChild(h('tr', null, [h('th', { text: 'Point' }), h('th', { text: 'Won by' })]));
      t.appendChild(h('tr', null, [h('td', { text: 'High' }), h('td', { text: who(r.high) })]));
      t.appendChild(h('tr', null, [h('td', { text: 'Low' }), h('td', { text: who(r.low) })]));
      t.appendChild(h('tr', null, [h('td', { text: 'Jack' }), h('td', { text: who(r.jack) })]));
      var counts = r.counts.map(function (c, k) { return sideLabel(k) + ' ' + c; }).join(', ');
      t.appendChild(h('tr', null, [h('td', { text: 'Game' }), h('td', { text: (r.game === null ? 'Tie, nobody' : sideLabel(r.game)) + ' (' + counts + ')' })]));
      return t;
    }
    function totals(r) {
      var t = h('table', { class: 'rumtbl' });
      t.appendChild(h('tr', null, [h('th', { text: '' }), h('th', { text: 'This hand' }), h('th', { text: 'Total' })]));
      r.delta.forEach(function (d, k) { t.appendChild(h('tr', null, [h('td', { text: sideLabel(k) }), h('td', { text: (d >= 0 ? '+' : '') + d }), h('td', { text: String(r.scores[k]) })])); });
      return t;
    }
    function history() {
      var s = S(); if (!s.history.length) return h('p', { class: 'levelnote', text: 'Hand-by-hand scores show up here after the first hand.' });
      var t = h('table', { class: 'rumtbl rumhist' }), nt = E.teamCount(s);
      var head = [h('th', { text: 'Hand' }), h('th', { text: 'Bid' })];
      for (var k = 0; k < nt; k++) head.push(h('th', { text: sideLabel(k) }));
      t.appendChild(h('tr', null, head));
      s.history.forEach(function (r, i) {
        var row = [h('td', { text: String(i + 1) }), h('td', { text: (r.bidder === seat() ? 'You' : s.players[r.bidder].name) + ' ' + r.bid + ' ' + E.SUITS[r.trump] + (r.made ? '' : ' set') })];
        r.delta.forEach(function (d, k) { row.push(h('td', { html: (d >= 0 ? '+' : '') + d + '<small>' + r.scores[k] + '</small>' })); });
        t.appendChild(h('tr', null, row));
      });
      return h('div', null, [h('h3', { class: 'rumsub', text: 'Hand by hand' }), t]);
    }
    function scoreSheet() {
      var s = S(), body = h('div', null, [s.result ? pointRows(s.result) : null, history()]);
      UI.modal({ title: 'Scores \u00B7 Hand ' + s.round, body: body, text: E.sides(s).map(function (x, t) { return sideLabel(t) + ' ' + x.score; }).join(', ') + '. Playing to ' + s.target + '.', buttons: [{ label: 'Back to the game', cls: 'pitch' }] });
    }
    function roundOver() {
      if (!document.body.contains(scene)) return;
      var s = S(); if (s.phase !== 'over' && s.phase !== 'gameover') return;
      var r = s.result, bname = r.bidder === seat() ? 'You' : s.players[r.bidder].name;
      var head = bname + (r.made ? (bname === 'You' ? ' made your bid of ' : ' made the bid of ') + r.bid + '.' : (bname === 'You' ? ' got set! You bid ' : ' got set! Bid ') + r.bid + ', won ' + r.pts[s.players[r.bidder].team] + '.');
      var wrap = h('div', { class: 'pitroundmodal' }, [pointRows(r), totals(r)]);
      if (s.phase === 'gameover') {
        var mine = s.winner === me().team;
        if (mine) { UI.confetti(); Sound.play('win'); } else Sound.play('lose');
        var entry = recordGame(s, seat(), src.info(), src.online), st = stats(), recTxt = ' Your record: ' + st.w + (st.w === 1 ? ' win, ' : ' wins, ') + st.l + (st.l === 1 ? ' loss.' : ' losses.');
        entry.players.forEach(function (p, i) {
          if (i === entry.seat || p.bot) return;
          var x = st.people[personKey(p)]; if (!x) return;
          if (entry.teams && p.tm === entry.myTeam) { if (x.wW + x.wL) recTxt += ' With ' + p.n + ': ' + x.wW + '-' + x.wL + '.'; }
          else if (x.vsW + x.vsL) recTxt += ' Against ' + p.n + ': ' + x.vsW + '-' + x.vsL + '.';
        });
        wrap.appendChild(history());
        wrap.appendChild(h('button', { class: 'ghostbtn', text: 'See my full record', onclick: function () { UI.closeModal(); location.hash = '#/pitch/stats'; } }));
        var btns = src.online && !src.isHost ? [{ label: 'OK', cls: 'pitch' }] :
          [{ label: src.online ? 'Play again (same players)' : 'New game', cls: 'pitch', fn: function () {
            if (src.online) src.act('again'); else { UI.store('pit_game', null); location.hash = '#/pitch'; }
          } }];
        if (src.online) btns.push({ label: 'Leave online game', fn: function () { if (src.isHost) leaveOnline(); else closeNet(); location.hash = '#/pitch'; } });
        var wname = s.teams ? (mine ? 'Your team' : 'Their team') : (s.winner === seat() ? 'You' : s.players[s.winner].name);
        UI.modal({ big: mine ? '\uD83C\uDFC6' : '\uD83C\uDCCF', title: mine ? (s.teams ? 'Your team wins!' : 'You win!') : wname + ' wins.',
          text: head + recTxt + (src.online && !src.isHost ? ' The host can start another game.' : ''), body: wrap, dismiss: false, buttons: btns });
        return;
      }
      if (r.made && r.bidder === seat()) Sound.play('chips');
      UI.modal({ title: head, body: wrap, dismiss: false,
        buttons: [{ label: 'Deal the next hand', cls: 'pitch', fn: function () { src.act('next'); } }] });
    }

    function soundPanel() {
      var body = h('div', { class: 'rumsound' }, CardPrefs.rows(function () { render(); }));
      function row(label, note, on, setOn, vol, setVol) {
        var r = h('div', { class: 'rumsrow' }, [h('div', { class: 'rumslabel' }, [h('b', { text: label }), h('span', { text: note })]),
          UI.seg([{ value: true, label: 'On' }, { value: false, label: 'Off' }], on, function (v) { setOn(v); })]);
        if (setVol) {
          var sl = h('input', { type: 'range', min: 0, max: 100, value: Math.round(vol * 100), class: 'rumslider', 'aria-label': label + ' volume' });
          sl.addEventListener('input', function () { setVol(sl.value / 100); });
          r.appendChild(h('div', { class: 'rumvol' }, [h('span', { text: '\uD83D\uDD08' }), sl, h('span', { text: '\uD83D\uDD0A' })]));
        }
        return r;
      }
      body.appendChild(row('Music', 'Vegas lounge band', Sound.prefs.music, Sound.setMusic, Sound.getVolume(), Sound.setVolume));
      body.appendChild(row('Card sounds', 'Flicks, slaps and chips', Sound.prefs.sfx, Sound.setSfx));
      UI.modal({ title: 'Settings', body: body, buttons: [{ label: 'Done', cls: 'pitch' }] });
    }
    function startAudio() { Sound.playMusic('lounge', scene); }
    startAudio();
    root.addEventListener('pointerdown', function unlock() {
      if (!document.body.contains(scene)) { root.removeEventListener('pointerdown', unlock); return; }
      startAudio();
    });

    onUpdate = function () { render(); };
    window.addEventListener('resize', function () { if (document.body.contains(scene)) render(); });
    render();
  }

  return { setup: setup, play: play, online: online, host: hostScreen, join: joinScreen, stats: statsScreen,
    _net: N, _driver: function () { return D; } };
})();
