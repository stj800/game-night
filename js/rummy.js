/* Rummy 500: you against 1-3 computer players, 2 vs 2 teams, or ONLINE with family on their own phones.
   Online: the host's phone runs the game (the "driver") and sends each player only their own hand.
   Phones connect directly through the free PeerJS service (no account needed). */
var Rummy = (function () {
  var h = UI.h, E = RummyEngine;
  var LEVELS = [
    { value: 1, label: 'Beginner', note: 'Computers miss melds and toss good cards. Great for learning.' },
    { value: 2, label: 'Intermediate', note: 'Solid players. They dig into the discard pile when it pays.' },
    { value: 3, label: 'Advanced', note: 'Sharp players. They watch what you can lay off and hold it back.' }
  ];
  var BOTS = ['Ava', 'Leo', 'Mia'];
  var AV = [0x1F60E, 0x1F469, 0x1F468, 0x1F467];
  var COLORS = ['#ffcf3f', '#ff6b8b', '#3ee08f', '#5fb6ff'];
  var PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', PREFIX = 'gamenight-rummy-';
  function cp(c) { return String.fromCodePoint(c); }
  function cfgGet() { var c = UI.store('rum_cfg') || {}; return { mode: c.mode || '1', target: c.target || 500, level: c.level || 1, deal: c.deal || 0 }; }
  function seatCount(mode) { return mode === 'team' ? 4 : +mode + 1; }

  // =================== Driver: owns the real game (local play, or the online host) ===================
  var D = null, onUpdate = null;
  function newDriver(s, seats, mode) { if (D) D.alive = false; D = { s: s, seats: seats, mode: mode, alive: true, msg: '', busy: false }; return D; }
  function pname(i) { return D.s.players[i].name; }
  function save() {
    if (!D) return;
    if (D.mode === 'local') UI.store('rum_game', D.s);
    else UI.store('rum_net', { s: D.s, code: N.code, seats: D.seats.map(function (st) { return { name: st.name, kind: st.kind, pid: st.pid || null }; }) });
  }
  function seatInfo() {
    return D.seats.map(function (st) { return { name: st.name, kind: st.kind, pid: st.pid || null, on: st.kind !== 'remote' || !!(st.conn && st.conn.open) }; });
  }
  function viewFor(i) {
    var v = JSON.parse(JSON.stringify(D.s));
    v.players.forEach(function (p, k) { if (k !== i) p.hand = p.hand.map(function () { return -1; }); });
    v.stock = v.stock.map(function () { return -1; });
    return v;
  }
  function publish() {
    if (!D) return;
    if (D.mode === 'host') D.seats.forEach(function (st, i) {
      if (st.kind === 'remote' && st.conn && st.conn.open) send(st.conn, { t: 'state', v: viewFor(i), seat: i, msg: D.msg, info: seatInfo(), code: N.code });
    });
    if (onUpdate) onUpdate();
  }
  function roundHead(s) {
    var r = s.result; if (!r) return '';
    return r.how === 'out' ? s.players[r.by].name + ' went out!' : 'The deck ran out.';
  }
  function commit(msg) {
    if (D.s.phase === 'over' || D.s.phase === 'gameover') msg += ' ' + roundHead(D.s);
    D.msg = msg; save(); publish();
    var d = D; setTimeout(function () { if (d === D) runBots(); }, CardPrefs.ms(1100));
  }
  // Apply a move for a seat. Returns an error message, or null when it worked.
  function apply(seat, a, x) {
    var s = D.s, msg, who = pname(seat);
    if (a === 'next') {
      if (s.phase !== 'over') return null;
      E.nextRound(s); msg = 'Hand ' + s.round + ' is dealt. ' + pname(s.turn) + ' goes first.';
    } else if (a === 'again') {
      if (s.phase !== 'gameover') return null;
      if (D.mode === 'host' && seat !== 0) return 'Only the host can start a new game.';
      D.s = s = E.newGame({ names: s.players.map(function (p) { return p.name; }), target: s.target, teams: s.teams, level: s.level, deal: s.deal });
      msg = 'New game! ' + pname(s.turn) + ' goes first.';
    } else {
      if (s.turn !== seat || (s.phase !== 'draw' && s.phase !== 'play')) return 'Hang on, it is not your turn.';
      if (a === 'stock') { if (E.drawStock(s) === null) return 'You already drew.'; msg = who + ' drew from the deck.'; }
      else if (a === 'pile') {
        var r = E.drawDiscard(s, x);
        if (!r.ok) return r.why === 'unusable' ? 'You can only take that card if you can play it right away.' : 'You already drew.';
        msg = who + ' took ' + (r.picked.length === 1 ? 'the ' + E.label(r.picked[0]) : r.picked.length + ' cards from the pile') + '.';
      }
      else if (a === 'meld') { var m = E.meld(s, x); if (!m) return 'Those cards do not make a meld.'; msg = who + ' melded ' + m.cards.map(E.label).join(' ') + ' (+' + m.pts + ').'; }
      else if (a === 'layoff') { if (!E.layOff(s, x[0], x[1])) return 'That card does not fit there.'; msg = who + ' laid off the ' + E.label(x[0]) + '.'; }
      else if (a === 'discard') {
        if (!E.canDiscard(s, x)) return s.mustUse !== null ? 'Play the ' + E.label(s.mustUse) + ' first.' : 'You cannot throw back the card you just took.';
        E.discard(s, x); msg = who + ' threw the ' + E.label(x) + '.';
      }
      else return 'Unknown move.';
    }
    commit(msg);
    return null;
  }
  // Computer plays a seat (a computer seat, or an online player who has been gone 45+ seconds)
  function runBots() {
    var d = D; if (!d || !d.alive || d.busy) return;
    var s = d.s; if (s.phase !== 'draw') return;
    var st = d.seats[s.turn], away = st.kind === 'remote' && !(st.conn && st.conn.open);
    if (away && Date.now() - (st.awayAt || 0) < 45000) { setTimeout(function () { if (d === D) runBots(); }, 3000); return; }
    if (st.kind !== 'bot' && !away) return;
    d.busy = true;
    var seat = s.turn, who = pname(seat) + (away ? ' (computer filling in)' : '');
    d.msg = who + ' is thinking...'; publish();
    setTimeout(function () {
      if (!d.alive || d !== D) return;
      var dr = E.aiDraw(s);
      if (dr.from === 'stock') { E.drawStock(s); d.msg = who + ' drew from the deck.'; }
      else { var r = E.drawDiscard(s, dr.index); d.msg = who + ' took ' + (r.picked.length === 1 ? 'the ' + E.label(r.picked[0]) : r.picked.length + ' cards from the pile') + '.'; }
      publish();
      setTimeout(function () {
        if (!d.alive || d !== D) return;
        var lines = [];
        E.aiPlay(s).forEach(function (a) {
          if (a.t === 'meld') lines.push('melded ' + a.cards.map(E.label).join(' '));
          if (a.t === 'layoff') lines.push('laid off the ' + E.label(a.card));
          if (a.t === 'discard') lines.push('threw the ' + E.label(a.card));
        });
        d.busy = false;
        commit(who + ' ' + (lines.join(', ') || 'played') + '.');
      }, CardPrefs.ms(900));
    }, CardPrefs.ms(800));
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
  function leaveOnline() { closeNet(); UI.store('rum_net', null); }

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
    var saved = UI.store('rum_net'); if (!saved) return false;
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
        if (i < 0) i = seats.findIndex(function (st) { return st.kind === 'bot'; }); // take over a computer seat
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
    var s = E.newGame({ names: seats.map(function (st) { return st.name; }), target: L.cfg.target, teams: L.cfg.mode === 'team', level: L.cfg.level, deal: L.cfg.deal });
    N.lobby = null;
    newDriver(s, seats, 'host');
    commit('Game on! ' + pname(s.turn) + ' goes first.');
    location.hash = '#/rummy/online';
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
          else { N.status = 'No game found with code ' + N.code + '. Check the code, and make sure the host has the Rummy game open.'; refresh(); }
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
      if (location.hash.indexOf('#/rummy') === 0 && location.hash !== '#/rummy/online') location.hash = '#/rummy/online';
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

  // =================== Records (saved on each phone, never cleared unless you reset) ===================
  function myPid() {
    var p = UI.store('rum_pid');
    if (!p) { p = ''; for (var i = 0; i < 12; i++) p += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]; UI.store('rum_pid', p); }
    return p;
  }
  function personKey(p) { return p.pid ? 'id:' + p.pid : 'name:' + String(p.n).toLowerCase(); }
  function recordGame(s, mySeat, info, online) {
    var log = UI.store('rum_log') || [];
    for (var k = 0; k < log.length; k++) if (log[k].gid === s.gid) return log[k];
    var my = s.players[mySeat], sd = E.sides(s), mine = sd[my.team].score, best = -Infinity;
    sd.forEach(function (x, i) { if (i !== my.team && x.score > best) best = x.score; });
    var bestHand = -Infinity; (s.history || []).forEach(function (row) { if (row[mySeat] > bestHand) bestHand = row[mySeat]; });
    var e = { gid: s.gid, t: Date.now(), online: !!online, teams: !!s.teams, target: s.target, hands: s.round, won: s.winner === my.team,
      seat: mySeat, myTeam: my.team, score: my.score, side: mine, margin: mine - best, bestHand: bestHand === -Infinity ? 0 : bestHand,
      outs: (s.outs || []).filter(function (x) { return x === mySeat; }).length,
      players: s.players.map(function (p, i) {
        var inf = info ? info[i] : null;
        return { n: p.name, pid: i === mySeat ? myPid() : inf ? inf.pid || null : null, bot: inf ? inf.kind === 'bot' : i !== mySeat, sc: p.score, tm: p.team };
      }) };
    log.unshift(e); if (log.length > 500) log.length = 500;
    UI.store('rum_log', log);
    return e;
  }
  function stats() {
    var log = (UI.store('rum_log') || []).slice().reverse(), old = UI.store('rum_wins') || { w: 0, l: 0 };
    var st = { games: 0, w: 0, l: 0, cpu: { w: old.w || 0, l: old.l || 0 }, net: { w: 0, l: 0 }, team: { w: 0, l: 0 }, solo: { w: 0, l: 0 },
      hi: null, margin: null, hand: null, fast: null, streak: 0, best: 0, cur: 0, outs: 0, pts: 0, handsPlayed: 0, people: {}, byTarget: {}, log: log };
    st.w = st.cpu.w; st.l = st.cpu.l; st.games = st.w + st.l;
    log.forEach(function (g) {
      st.games++; if (g.won) st.w++; else st.l++;
      var humans = g.players.some(function (p, i) { return i !== g.seat && !p.bot; });
      var b = humans ? st.net : st.cpu; if (g.won) b.w++; else b.l++;
      b = g.teams ? st.team : st.solo; if (g.won) b.w++; else b.l++;
      st.pts += g.score; st.handsPlayed += g.hands; st.outs += g.outs || 0;
      if (!st.hi || g.score > st.hi.v) st.hi = { v: g.score, g: g };
      if (g.won && (!st.margin || g.margin > st.margin.v)) st.margin = { v: g.margin, g: g };
      if (!st.hand || g.bestHand > st.hand.v) st.hand = { v: g.bestHand, g: g };
      if (g.won && (!st.fast || g.hands < st.fast.v)) st.fast = { v: g.hands, g: g };
      var bt = st.byTarget[g.target] = st.byTarget[g.target] || { w: 0, l: 0, hi: null };
      if (g.won) bt.w++; else bt.l++; if (bt.hi === null || g.score > bt.hi) bt.hi = g.score;
      if (g.won) { st.cur = st.cur > 0 ? st.cur + 1 : 1; } else { st.cur = st.cur < 0 ? st.cur - 1 : -1; }
      if (st.cur > st.best) st.best = st.cur;
      var me = g.players[g.seat];
      g.players.forEach(function (p, i) {
        if (i === g.seat || p.bot) return;
        var key = personKey(p), x = st.people[key] = st.people[key] || { n: p.n, vsW: 0, vsL: 0, wW: 0, wL: 0, games: 0 };
        x.n = p.n; x.games++;
        if (g.teams && p.tm === g.myTeam) { if (g.won) x.wW++; else x.wL++; }
        else if (g.teams) { if (g.won) x.vsW++; else x.vsL++; }
        else if (me.sc > p.sc) x.vsW++; else if (me.sc < p.sc) x.vsL++;
      });
    });
    return st;
  }
  function pct(w, l) { return w + l ? Math.round(100 * w / (w + l)) + '%' : '-'; }
  function when(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2); }

  function handHistory(s, mySeat) {
    var hist = s.history || [];
    if (!hist.length) return h('p', { class: 'levelnote', text: 'Hand-by-hand scores show up here after the first hand.' });
    var t = h('table', { class: 'rumtbl rumhist' }), cols;
    if (s.teams) {
      var sd = E.sides(s);
      cols = sd.map(function (x, k) { return { label: k === s.players[mySeat].team ? 'Us' : 'Them', seats: x.members }; });
    } else cols = s.players.map(function (p, i) { return { label: i === mySeat ? 'You' : p.name, seats: [i] }; });
    t.appendChild(h('tr', null, [h('th', { text: 'Hand' })].concat(cols.map(function (c) { return h('th', { text: c.label }); }))));
    var run = cols.map(function () { return 0; });
    hist.forEach(function (row, r) {
      t.appendChild(h('tr', null, [h('td', { text: String(r + 1) })].concat(cols.map(function (c, k) {
        var v = 0; c.seats.forEach(function (i) { v += row[i]; }); run[k] += v;
        return h('td', { html: (v >= 0 ? '+' : '') + v + '<small>' + run[k] + '</small>' });
      }))));
    });
    return h('div', null, [h('h3', { class: 'rumsub', text: 'Hand by hand' }), t]);
  }

  function statsScreen(root) {
    root.appendChild(UI.topbar('My Rummy record', '#/rummy'));
    var st = stats();
    if (!st.games) {
      root.appendChild(h('div', { class: 'panel' }, [h('p', { class: 'levelnote', style: 'margin:0', text: 'No finished games yet. Every game you finish on this phone, against the computer or online, is saved here for good.' })]));
      return;
    }
    function tile(big, small) { return h('div', { class: 'rumtile' }, [h('b', { text: big }), h('span', { text: small })]); }
    root.appendChild(h('div', { class: 'rumtiles' }, [tile(String(st.games), 'games'), tile(String(st.w), 'wins'), tile(String(st.l), 'losses'), tile(pct(st.w, st.l), 'win rate')]));
    function rec(label, b) { return h('div', { class: 'rumrow' }, [h('span', { text: label }), h('b', { text: b.w + b.l ? b.w + '-' + b.l + ' \u00B7 ' + pct(b.w, b.l) : '-' })]); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Win rate' }), rec('Against the computer', st.cpu), rec('Online with family', st.net), rec('Teams 2v2', st.team), rec('Free-for-all', st.solo)].concat(
      Object.keys(st.byTarget).sort(function (a, b) { return a - b; }).map(function (k) { var b = st.byTarget[k]; return h('div', { class: 'rumrow' }, [h('span', { text: 'Games to ' + k }), h('b', { text: b.w + '-' + b.l + ' \u00B7 high ' + b.hi })]); }))));
    function rr(label, v, extra) { return h('div', { class: 'rumrow' }, [h('span', { text: label }), h('b', { text: v === null || v === undefined ? '-' : v + (extra || '') })]); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'All-time records' }),
      rr('Highest final score', st.hi && st.hi.v, st.hi ? ' (' + when(st.hi.g.t) + ')' : ''),
      rr('Biggest win', st.margin && st.margin.v, st.margin ? ' points (' + when(st.margin.g.t) + ')' : ''),
      rr('Best single hand', st.hand && st.hand.v, st.hand ? ' points' : ''),
      rr('Fastest win', st.fast && st.fast.v, st.fast ? (st.fast.v === 1 ? ' hand' : ' hands') : ''),
      rr('Longest win streak', st.best, st.best === 1 ? ' game' : ' games'),
      rr('Current streak', st.cur > 0 ? st.cur + ' win' + (st.cur > 1 ? 's' : '') : st.cur < 0 ? -st.cur + ' loss' + (st.cur < -1 ? 'es' : '') : '-'),
      rr('Times you went out', st.outs),
      rr('Hands played', st.handsPlayed || null),
      rr('Total points, all time', st.pts)]));
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
    if (recent.length) {
      root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Recent games' })].concat(recent.map(function (g) {
        var who = g.players.map(function (p, i) { return (i === g.seat ? 'You' : p.n) + ' ' + p.sc; }).join(', ');
        return h('div', { class: 'rumgame' + (g.won ? ' won' : '') }, [
          h('b', { text: (g.won ? 'Won' : 'Lost') + ' \u00B7 ' + when(g.t) + ' \u00B7 to ' + g.target + (g.online ? ' \u00B7 online' : '') + (g.teams ? ' \u00B7 teams' : '') }),
          h('span', { text: who + ' (' + g.hands + ' hands)' })]);
      }))));
    }
    root.appendChild(h('button', { class: 'ghostbtn', text: 'Reset my record', onclick: function () {
      UI.modal({ title: 'Erase your record?', text: 'This wipes every saved Rummy game and record on this phone. It cannot be undone.',
        buttons: [{ label: 'Keep my record', cls: 'rummy' }, { label: 'Erase it', fn: function () { UI.store('rum_log', null); UI.store('rum_wins', null); location.reload(); } }] });
    } }));
  }

  // =================== Screens ===================
  function setup(root) {
    var cfg = cfgGet();
    root.appendChild(UI.topbar('Rummy 500', '#/'));
    var saved = UI.store('rum_game');
    if (N.role === 'client' && N.view) root.appendChild(h('button', { class: 'bigbtn rummy', text: 'Back to your online game', onclick: function () { location.hash = '#/rummy/online'; } }));
    else if (N.role === 'host' && D && D.mode === 'host') root.appendChild(h('button', { class: 'bigbtn rummy', text: 'Back to your online game (code ' + N.code + ')', onclick: function () { location.hash = '#/rummy/online'; } }));
    else if (saved && saved.phase !== 'gameover') {
      var sd = E.sides(saved);
      root.appendChild(h('button', { class: 'bigbtn rummy', text: 'Continue game (' + sideName(saved, 0, 0) + ' ' + sd[0].score + ', hand ' + saved.round + ')',
        onclick: function () { location.hash = '#/rummy/play'; } }));
    }
    var stq = stats();
    root.appendChild(h('button', { class: 'pill rumrecbtn', text: String.fromCodePoint(0x1F3C6) + ' My record' + (stq.games ? ': ' + stq.w + '-' + stq.l + ' (' + pct(stq.w, stq.l) + ')' : ''), onclick: function () { location.hash = '#/rummy/stats'; } }));
    var noteEl = h('p', { class: 'levelnote' }), dealNote = h('p', { class: 'levelnote' });
    function setDeal() {
      var n = seatCount(cfg.mode), std = n === 2 ? 13 : 7, d = cfg.deal ? Math.min(cfg.deal, n === 2 ? 13 : n === 3 ? 10 : 7) : std;
      dealNote.textContent = (cfg.deal ? d + ' cards each.' : 'Standard: ' + std + ' cards each (13 with 2 players, 7 with 3 or 4).') +
        (d <= 7 ? ' Fewer cards = faster, lighter hands.' : ' More cards = more melds, bigger swings.') +
        (cfg.deal && d < cfg.deal ? ' (Capped so the deck does not run dry: 3 players max 10, 4 players 7.)' : '');
    }
    function keep() { UI.store('rum_cfg', cfg); }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Players' }), UI.seg([
      { value: '1', label: 'You + 1' }, { value: '2', label: 'You + 2' }, { value: '3', label: 'You + 3' }, { value: 'team', label: 'Teams 2v2' }
    ], cfg.mode, function (v) { cfg.mode = v; setDeal(); keep(); }),
      h('p', { class: 'levelnote', text: 'Teams: you and your partner sit across from each other and share one score. Online, your partner can be a real person.' })]));
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Play to' }), UI.seg([
      { value: 200, label: '200' }, { value: 300, label: '300' }, { value: 400, label: '400' }, { value: 500, label: '500' }
    ], cfg.target, function (v) { cfg.target = v; keep(); }), h('p', { class: 'levelnote', text: '200 is a quick game (a few hands). 500 is the classic.' })]));
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Cards dealt' }), UI.seg([
      { value: 0, label: 'Standard' }, { value: 7, label: '7' }, { value: 10, label: '10' }, { value: 13, label: '13' }
    ], cfg.deal || 0, function (v) { cfg.deal = v; setDeal(); keep(); }), dealNote]));
    function setNote() { noteEl.textContent = LEVELS[cfg.level - 1].note; }
    root.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Computer level' }), UI.seg(LEVELS, cfg.level, function (v) { cfg.level = v; setNote(); keep(); }), noteEl]));
    setNote(); setDeal();
    root.appendChild(h('button', { class: 'bigbtn rummy', text: 'Play against the computer', onclick: function () {
      keep();
      var teams = cfg.mode === 'team', n = seatCount(cfg.mode), names = ['You'];
      for (var i = 1; i < n; i++) names.push(BOTS[i - 1]);
      UI.store('rum_game', E.newGame({ names: names, target: cfg.target, teams: teams, level: cfg.level, deal: cfg.deal || 0 }));
      location.hash = '#/rummy/play';
    } }));
    root.appendChild(h('div', { class: 'panel' }, [
      h('h3', { text: 'Play online with family' }),
      h('p', { class: 'levelnote', style: 'margin-top:0', text: 'Each person plays on their own phone. One person hosts and gets a 4-letter code; everyone else taps Join and types it in. Empty seats are filled by computers.' }),
      h('div', { class: 'rumtwo' }, [
        h('button', { class: 'bigbtn rummy', text: 'Host a game', onclick: function () { keep(); location.hash = '#/rummy/host'; } }),
        h('button', { class: 'bigbtn rummyalt', text: 'Join a game', onclick: function () { location.hash = '#/rummy/join'; } })
      ]),
      UI.store('rum_net') && !(N.role === 'host' && D) ? h('button', { class: 'ghostbtn', text: 'Reopen my last online table', onclick: function () { hostResume(); location.hash = '#/rummy/online'; } }) : null
    ]));
    root.appendChild(h('h3', { class: 'rumsub', text: 'Size and speed' }));
    root.appendChild(CardPrefs.panel());
    root.appendChild(h('div', { class: 'rules', html:
      '<h3>The goal</h3><p>Score points by laying cards on the table in <b>melds</b>. First to the target score wins.</p>' +
      '<h3>Melds</h3><ul><li><b>Set:</b> 3 or 4 cards of the same rank (7 7 7).</li><li><b>Run:</b> 3 or more in a row, same suit (4 5 6 of hearts). Aces go low (A 2 3) or high (Q K A), not around the corner.</li></ul>' +
      '<h3>Your turn</h3><ol><li><b>Draw:</b> tap the deck, or tap any card in the discard pile. Any card you take from the pile <b>must be played that same turn</b> (in a meld, or laid off). If it is not the top card, you also take every card above it. The game only lets you take a card you can play.</li>' +
      '<li><b>Meld:</b> tap cards to select them, then tap Meld. To <b>lay off</b> a single card on any meld already on the table (anyone\'s), select it and tap that meld.</li>' +
      '<li><b>Discard:</b> select one card and tap Discard. That ends your turn.</li></ol>' +
      '<h3>Scoring</h3><p>Cards you put on the table count for you. Cards still in your hand when someone goes out count against you. Aces 15 (1 point in A 2 3), face cards and 10s are 10, other cards are their number. The hand also ends when the deck runs out.</p>' +
      '<h3>Tips</h3><ul><li>Lay down melds early so you are not caught with points in your hand.</li><li>A big discard pile can be a gold mine, but every extra card you pick up counts against you if you get stuck with it.</li><li>Do not throw a card the next player can lay off.</li></ul>' }));
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
    root.appendChild(UI.topbar('Host online', '#/rummy'));
    if (D && D.mode === 'host' && N.role === 'host') { location.hash = '#/rummy/online'; return; }
    var body = h('div'); root.appendChild(body);
    function draw() {
      body.innerHTML = '';
      if (N.role !== 'host' || !N.lobby) {
        var inp = nameInput();
        body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Your name' }), inp]));
        var c = cfgGet();
        body.appendChild(h('p', { class: 'levelnote', text: (c.mode === 'team' ? 'Teams 2v2' : seatCount(c.mode) + ' players') + ', play to ' + c.target + '. Change these on the Rummy menu.' }));
        body.appendChild(h('button', { class: 'bigbtn rummy', text: 'Open my table', onclick: function () {
          if (!inp.value.trim()) { UI.toast('Type your name first.'); inp.focus(); return; }
          hostLobby(cleanName(inp.value)); draw();
        } }));
        return;
      }
      var L = N.lobby;
      body.appendChild(h('div', { class: 'panel rumcodebox' }, [
        h('h3', { text: 'Game code' }),
        h('div', { class: 'rumcode', text: N.status && !N.peer ? '....' : N.code }),
        h('p', { class: 'levelnote', text: N.status || 'Tell your family this code. They open Game Night, tap Rummy 500, then Join a game.' }),
        h('button', { class: 'ghostbtn', text: '\uD83D\uDCE4 Send the code', onclick: function () {
          var t = 'Join my Rummy 500 game on Game Night. Code: ' + N.code, url = location.origin + location.pathname + '#/rummy/join';
          if (navigator.share) navigator.share({ title: 'Rummy 500', text: t, url: url }).catch(function () {});
          else { try { navigator.clipboard.writeText(t + ' ' + url); UI.toast('Copied. Paste it in a text.'); } catch (e) { UI.toast(t); } }
        } })
      ]));
      body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Players' }), seatList(L.seats, L.cfg.mode === 'team', 0)]));
      body.appendChild(h('button', { class: 'bigbtn rummy', text: 'Start the game', onclick: hostStart }));
      body.appendChild(h('button', { class: 'ghostbtn', text: 'Cancel', onclick: function () { leaveOnline(); location.hash = '#/rummy'; } }));
    }
    onUpdate = function () { if (document.body.contains(body)) draw(); };
    draw();
  }

  function joinScreen(root) {
    root.appendChild(UI.topbar('Join a game', '#/rummy'));
    var body = h('div'); root.appendChild(body);
    function draw() {
      body.innerHTML = '';
      if (N.role === 'client' && N.lobby) {
        var L = N.lobby;
        body.appendChild(h('div', { class: 'panel rumcodebox' }, [h('h3', { text: 'Joined game ' + L.code }), h('p', { class: 'levelnote', text: 'You are in! Waiting for the host to start. Play to ' + L.cfg.target + '.' })]));
        body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Players' }), seatList(L.seats, L.cfg.mode === 'team', L.seat)]));
        body.appendChild(h('button', { class: 'ghostbtn', text: 'Leave', onclick: function () { closeNet(); location.hash = '#/rummy'; } }));
        return;
      }
      var nameI = nameInput();
      var codeI = h('input', { class: 'ruminput rumcodein', type: 'text', maxlength: 4, placeholder: 'CODE', autocomplete: 'off', autocapitalize: 'characters', value: N.role === 'client' ? N.code : '' });
      codeI.addEventListener('input', function () { codeI.value = codeI.value.toUpperCase(); });
      body.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Your name' }), nameI, h('h3', { text: 'Game code', style: 'margin-top:14px' }), codeI,
        N.status ? h('p', { class: 'levelnote rumwarn', text: N.status }) : null]));
      body.appendChild(h('button', { class: 'bigbtn rummy', text: 'Join', onclick: function () {
        if (!nameI.value.trim()) { UI.toast('Type your name first.'); return; }
        if (codeI.value.trim().length < 4) { UI.toast('The code has 4 letters or numbers.'); return; }
        join(codeI.value, nameI.value);
      } }));
    }
    onUpdate = function () { if (document.body.contains(body)) draw(); };
    draw();
  }

  function sideName(s, k, mySeat) {
    if (!s.teams) return s.players[k].name;
    return k === s.players[mySeat].team ? 'Your team' : 'Their team';
  }
  function cardEl(c, cls) {
    var r = E.RANKS[E.rank(c)], su = E.SUITS[E.suit(c)];
    return h('div', { class: 'pcard ' + (E.red(c) ? 'red ' : '') + (cls || ''), 'data-c': c }, [
      h('span', { class: 'pc-tl', html: r + '<br>' + su }), h('span', { class: 'pc-mid', text: su })
    ]);
  }

  // Local play on this phone
  function play(root) {
    var s = UI.store('rum_game');
    if (!s) { location.hash = '#/rummy'; return; }
    if (D && D.mode === 'host') { location.hash = '#/rummy/online'; return; }
    newDriver(s, s.players.map(function (p, i) { return { name: p.name, kind: i === 0 ? 'me' : 'bot' }; }), 'local');
    table(root, {
      back: '#/rummy', online: false,
      seat: function () { return 0; }, view: function () { return D.s; }, msg: function () { return D.msg; }, info: function () { return null; }, status: function () { return ''; },
      act: function (a, x) { var err = apply(0, a, x); if (err) UI.toast(err); }, isHost: true
    });
    if (D.s.phase === 'draw' && D.s.turn !== 0) runBots();
  }
  // Online play (host or guest)
  function online(root) {
    if (N.role === 'host' && D && D.mode === 'host') {
      table(root, {
        back: '#/rummy', online: true, isHost: true,
        seat: function () { return 0; }, view: function () { return D.s; }, msg: function () { return D.msg; }, info: seatInfo,
        status: function () { return N.status ? N.status : 'Code ' + N.code; },
        act: function (a, x) { var err = apply(0, a, x); if (err) UI.toast(err); }
      });
      return;
    }
    if (N.role === 'client' && N.view) {
      table(root, {
        back: '#/rummy', online: true, isHost: false,
        seat: function () { return N.seat; }, view: function () { return N.view; }, msg: function () { return N.msg; }, info: function () { return N.info; },
        status: function () { return N.status || 'Game ' + N.code; },
        act: function (a, x) { if (!(N.conn && N.conn.open)) { UI.toast('Reconnecting... try again in a moment.'); return; } send(N.conn, { t: 'act', a: a, x: x }); }
      });
      return;
    }
    location.hash = '#/rummy';
  }

  // The card table. src supplies the current view (full state for the host, private view for guests).
  function table(root, src) {
    var scene = h('div', { class: 'rumscene' }); root.appendChild(scene);
    root.appendChild(UI.topbar('Rummy 500', src.back, h('div', { class: 'rumtopbtns' }, [
      h('button', { class: 'iconbtn', html: '&#9881;&#65039;', 'aria-label': 'Settings: size, speed and sound', onclick: soundPanel }),
      h('button', { class: 'iconbtn', html: '&#128202;', 'aria-label': 'Scores', onclick: scoreSheet })])));
    var netEl = h('div', { class: 'rumnet' });
    var opp = h('div', { class: 'rumopp' }), status = h('div', { class: 'status rumstatus' }), tbl = h('div', { class: 'rumtable' });
    var piles = h('div', { class: 'rumpiles' }), stockEl = h('button', { class: 'rumstock' }), discEl = h('div', { class: 'rumdisc' });
    piles.appendChild(stockEl); piles.appendChild(discEl);
    var handEl = h('div', { class: 'rumhand' }), acts = h('div', { class: 'rumacts' });
    [netEl, opp, status, tbl, piles, handEl, acts].forEach(function (x) { root.appendChild(x); });
    if (!src.online) netEl.style.display = 'none';
    var sel = [], sortMode = UI.store('rum_sort') || 'suit', fresh = {}, prevHand = null, hint = [], hintMsg = '', shownKey = '', lastMsg = null;
    var btnMeld = h('button', { text: 'Meld', onclick: doMeld }), btnDisc = h('button', { text: 'Discard', onclick: doDiscard });
    var btnSort = h('button', { onclick: function () { sortMode = sortMode === 'suit' ? 'rank' : 'suit'; UI.store('rum_sort', sortMode); render(); } });
    var btnHint = h('button', { text: 'Hint', onclick: doHint });
    [btnMeld, btnDisc, btnSort, btnHint].forEach(function (b) { acts.appendChild(b); });
    stockEl.addEventListener('click', function () { if (myDraw()) src.act('stock'); });

    function S() { return src.view(); }
    function seat() { return src.seat(); }
    function me() { return S().players[seat()]; }
    function myTurn() { var s = S(); return s.turn === seat() && (s.phase === 'draw' || s.phase === 'play'); }
    function myDraw() { return myTurn() && S().phase === 'draw'; }
    function sorted(hand) {
      return hand.slice().sort(function (a, b) {
        if (sortMode === 'suit') return E.suit(a) - E.suit(b) || E.rank(a) - E.rank(b);
        return E.rank(a) - E.rank(b) || E.suit(a) - E.suit(b);
      });
    }
    function prompt() {
      var s = S();
      if (s.phase === 'draw') return 'Your turn. Draw from the deck, or tap a card in the discard pile.';
      if (s.mustUse !== null) return 'You must play the ' + E.label(s.mustUse) + ' in a meld (or lay it off) this turn.';
      return 'Meld or lay off if you can, then discard one card.';
    }
    function youify(m) {
      var nm = me().name;
      if (m && nm !== 'You' && m.indexOf(nm + ' ') === 0) m = 'You ' + m.slice(nm.length + 1).replace(/^is /, 'are ');
      return m || '';
    }

    // ---------- card motion: deals, draws, melds and the discard throw ----------
    var prevS = null, flying = {}, calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function rectOf(el, w) {
      if (!el) return null;
      var r = el.getBoundingClientRect(); if (!r.width && !r.height) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: w || el.offsetWidth || r.width };
    }
    function snap() {
      var b = { hand: {}, disc: {}, chip: {}, stock: rectOf(stockEl.firstChild), handBox: rectOf(handEl, 52 * CardPrefs.size()) };
      Array.prototype.forEach.call(handEl.querySelectorAll('.pcard'), function (el) { b.hand[el.getAttribute('data-c')] = rectOf(el); });
      Array.prototype.forEach.call(discEl.querySelectorAll('.pcard'), function (el) { b.disc[el.getAttribute('data-c')] = rectOf(el); });
      Array.prototype.forEach.call(opp.querySelectorAll('.rumchip'), function (el) { b.chip[el.getAttribute('data-seat')] = rectOf(el, 24); });
      return b;
    }
    function tiltOf(c) { return ((c * 37) % 13 - 6) * 0.9; }
    function hideFlying() {
      var now = Date.now();
      Object.keys(flying).forEach(function (c) {
        if (flying[c] < now) { delete flying[c]; return; }
        Array.prototype.forEach.call(root.querySelectorAll('.pcard[data-c="' + c + '"]:not(.flying)'), function (x) { x.style.visibility = 'hidden'; });
      });
    }
    function flyTo(el, from, o) {
      if (calm || !el || !from || !el.animate) return;
      var to = rectOf(el); if (!to) return;
      var c = el.getAttribute('data-c'), w = el.offsetWidth, hh = el.offsetHeight, g = el.cloneNode(true);
      g.classList.remove('sel', 'hint', 'must', 'tap', 'fresh'); g.classList.add('flying');
      g.style.cssText = 'position:fixed;margin:0;left:' + (to.x - w / 2) + 'px;top:' + (to.y - hh / 2) + 'px;width:' + w + 'px;height:' + hh + 'px;z-index:3000;pointer-events:none;';
      document.body.appendChild(g);
      el.style.visibility = 'hidden';
      var dx = from.x - to.x, dy = from.y - to.y, sc = from.w && w ? from.w / w : 1, tilt = o.tilt || 0, frames;
      o = { kind: o.kind, tilt: o.tilt, land: o.land, dur: CardPrefs.ms(o.dur), delay: CardPrefs.ms(o.delay || 0) };
      if (o.kind === 'throw') frames = [
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ') rotate(0deg)' },
        { offset: 0.5, transform: 'translate(' + dx * 0.45 + 'px,' + (dy * 0.45 - 80) + 'px) scale(1.3) rotate(220deg)' },
        { offset: 0.86, transform: 'translate(0px,-5px) scale(1.05) rotate(' + (352 + tilt) + 'deg)' },
        { transform: 'translate(0px,0px) scale(1) rotate(' + (360 + tilt) + 'deg)' }];
      else frames = [
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')' },
        { offset: 0.8, transform: 'translate(0px,-8px) scale(1.07)' },
        { transform: 'translate(0px,0px) scale(1)' }];
      flying[c] = Date.now() + (o.delay || 0) + o.dur + 50;
      var a = g.animate(frames, { duration: o.dur, delay: o.delay || 0, easing: o.kind === 'throw' ? 'cubic-bezier(.3,.6,.35,1)' : 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
      var done = false;
      function finish() {
        if (done) return; done = true;
        try { a.cancel(); } catch (e) {}
        g.remove(); delete flying[c];
        Array.prototype.forEach.call(root.querySelectorAll('.pcard[data-c="' + c + '"]'), function (x) { x.style.visibility = ''; });
        if (o.land) o.land();
      }
      a.onfinish = finish;
      // Safety net: if the phone pauses animations, the card still lands on time
      setTimeout(finish, (o.delay || 0) + o.dur + 250);
    }
    function ghost(el, from, to, dur, delay) {
      if (calm || !from || !to || !el.animate) return;
      dur = CardPrefs.ms(dur); delay = CardPrefs.ms(delay || 0);
      el.classList.add('flying');
      el.style.cssText = 'position:fixed;margin:0;left:' + (to.x - 19 * CardPrefs.size()) + 'px;top:' + (to.y - 27 * CardPrefs.size()) + 'px;z-index:3000;pointer-events:none;';
      document.body.appendChild(el);
      var a = el.animate([
        { transform: 'translate(' + (from.x - to.x) + 'px,' + (from.y - to.y) + 'px) scale(1)', opacity: 1 },
        { transform: 'translate(0px,0px) scale(0.55)', opacity: 0.15 }], { duration: dur, delay: delay || 0, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
      a.onfinish = function () { el.remove(); };
      setTimeout(function () { el.remove(); }, (delay || 0) + dur + 250);
    }
    function back() { return h('div', { class: 'pcard sm back' }); }
    function deal(b, s) {
      var mySeat = seat(), n = s.players.length, cards = Array.prototype.slice.call(handEl.querySelectorAll('.pcard')), per = cards.length, idx = 0;
      for (var k = 0; k < per; k++) for (var j = 0; j < n; j++) {
        var who = (s.dealer + 1 + j) % n, d = idx++ * 55;
        if (who === mySeat) flyTo(cards[k], b.stock, { dur: 380, delay: d });
        else if (k < s.players[who].hand.length) ghost(back(), b.stock, b.chip[who], 360, d);
        if (idx % 3 === 1) setTimeout(function () { Sound.play('flick'); }, CardPrefs.ms(d));
      }
    }
    function animate(b, s) {
      var mySeat = seat(), my = me(), tableNow = {};
      s.melds.forEach(function (m) { m.cards.forEach(function (c) { tableNow[c] = m; }); });
      var p = prevS;
      prevS = { gid: s.gid, round: s.round, turn: s.turn, disc: s.discard.slice(), stockN: s.stock.length, table: tableNow, hand: my.hand.slice() };
      if (!b.stock) return;
      if (!p || p.gid !== s.gid || p.round !== s.round) {
        if (!s.melds.length && s.discard.length === 1 && s.phase === 'draw') deal(b, s);
        return;
      }
      var actor = p.turn, actorFrom = actor === mySeat ? b.handBox : b.chip[actor], delay = 0;
      var stockDrop = p.stockN - s.stock.length;
      var pileTaken = p.disc.filter(function (c) { return s.discard.indexOf(c) < 0; });
      var gained = my.hand.filter(function (c) { return p.hand.indexOf(c) < 0; });
      if (gained.length) {
        gained.forEach(function (c, k) {
          flyTo(handEl.querySelector('.pcard[data-c="' + c + '"]'), pileTaken.indexOf(c) >= 0 ? b.disc[c] : b.stock, { dur: 420, delay: k * 70 });
        });
        Sound.play('flick');
      } else if (actor !== mySeat && actorFrom) {
        if (stockDrop > 0) { ghost(back(), b.stock, actorFrom, 420); Sound.play('flick'); }
        pileTaken.forEach(function (c, k) { if (b.disc[c]) ghost(cardEl(c, 'sm'), b.disc[c], actorFrom, 460, k * 60); });
        if (pileTaken.length) Sound.play('flick');
      }
      var newOnTable = Object.keys(tableNow).filter(function (c) { return !p.table[c]; });
      newOnTable.forEach(function (c, k) {
        var m = tableNow[c], who = m.lo && m.lo[c] !== undefined ? m.lo[c] : m.by;
        var from = who === mySeat ? (b.hand[c] || b.handBox) : b.chip[who];
        flyTo(tbl.querySelector('.pcard[data-c="' + c + '"]'), from, { dur: 460, delay: k * 50 });
      });
      if (newOnTable.length) { delay = 220 + newOnTable.length * 50; if (actor !== mySeat) setTimeout(function () { Sound.play('chips'); }, CardPrefs.ms(200)); }
      var top = s.discard[s.discard.length - 1];
      if (top !== undefined && p.disc.indexOf(top) < 0) {
        var from = actor === mySeat ? (b.hand[top] || b.handBox) : actorFrom;
        flyTo(discEl.lastChild, from, { dur: 620, delay: delay, kind: 'throw', tilt: tiltOf(top), land: function () { Sound.play('slap'); } });
      }
    }

    function render() {
      if (!document.body.contains(scene)) return;
      var before = snap();
      var s = S(), info = src.info(), mySeat = seat(), my = me();
      // fresh cards (just drawn)
      if (prevHand) {
        var added = my.hand.filter(function (c) { return prevHand.indexOf(c) < 0; });
        if (added.length) { fresh = {}; added.forEach(function (c) { fresh[c] = 1; }); }
      }
      prevHand = my.hand.slice();
      sel = sel.filter(function (c) { return my.hand.indexOf(c) >= 0; });
      hint = hint.filter(function (c) { return my.hand.indexOf(c) >= 0; });
      netEl.textContent = src.online ? (src.isHost ? '\uD83D\uDCF6 Hosting \u00B7 ' : '\uD83D\uDCF6 Online \u00B7 ') + src.status() : '';
      // players + score
      opp.innerHTML = '';
      var sd = E.sides(s);
      s.players.forEach(function (p, i) {
        if (i === mySeat) return;
        var partner = s.teams && p.team === my.team, inf = info ? info[i] : null;
        var tag = inf ? (inf.kind === 'bot' ? ' \u00B7 computer' : !inf.on ? ' \u00B7 away' : '') : '';
        opp.appendChild(h('div', { 'data-seat': i, class: 'rumchip' + (s.turn === i && (s.phase === 'draw' || s.phase === 'play') ? ' on' : '') + (inf && !inf.on ? ' away' : ''), style: '--c:' + COLORS[i] }, [
          h('b', { text: cp(AV[i]) + ' ' + p.name + (partner ? ' (partner)' : '') }),
          h('span', { text: p.hand.length + ' cards' + (s.teams ? '' : ' \u00B7 ' + p.score) + tag })
        ]));
      });
      var scoreTxt = s.teams ? 'Your team ' + sd[my.team].score + ' \u00B7 Them ' + sd[1 - my.team].score : 'You ' + my.score;
      opp.appendChild(h('div', { class: 'rumscore', text: scoreTxt + ' / ' + s.target + ' \u00B7 Hand ' + s.round }));
      // status
      var m = src.msg();
      if (m !== lastMsg) { lastMsg = m; hintMsg = ''; }
      var text = hintMsg || ((m ? youify(m) + ' ' : '') + (myTurn() ? prompt() : (s.phase === 'draw' || s.phase === 'play') && s.turn !== mySeat && m.indexOf('thinking') < 0 ? 'Waiting for ' + s.players[s.turn].name + '...' : ''));
      status.textContent = text; status.classList.toggle('alert', !!hintMsg || myTurn());
      // table melds
      tbl.innerHTML = '';
      var one = sel.length === 1 ? sel[0] : null;
      // One row per player (others first, you last): their melds plus what they scored on the table this hand
      var order = [];
      for (var k = 1; k <= s.players.length; k++) order.push((mySeat + k) % s.players.length);
      var rowsBy = {};
      order.forEach(function (i) {
        var p = s.players[i], partner = s.teams && i !== mySeat && p.team === my.team;
        var row = h('div', { class: 'rumgroup', style: '--c:' + COLORS[i] }, [
          h('div', { class: 'rumghead' }, [
            h('b', { text: (i === mySeat ? 'You' : cp(AV[i]) + ' ' + p.name + (partner ? ' (partner)' : '')) }),
            h('span', { text: p.table ? '+' + p.table + ' on the table this hand' : 'nothing down yet' })
          ]),
          h('div', { class: 'rumgmelds' })
        ]);
        rowsBy[i] = row.lastChild; tbl.appendChild(row);
      });
      // Like a real table: a meld sits in front of the player who made it, and a card laid off on someone
      // else's meld sits in front of the player who laid it off ("on Ava's 10s"). Tap either one to lay off.
      function meldName(md) {
        var owner = md.by === mySeat ? 'your' : s.players[md.by].name + "'s";
        var base = md.cards.filter(function (c) { return !(md.lo && md.lo[c] !== undefined && md.lo[c] !== md.by); });
        if (md.type === 'set') return 'on ' + owner + ' ' + E.RANKS[E.rank(md.cards[0])] + 's';
        return 'on ' + owner + ' ' + E.SUITS[E.suit(md.cards[0])] + ' run';
      }
      s.melds.forEach(function (md, mi) {
        var ok = one !== null && myTurn() && s.phase === 'play' && E.layOffResult(md, one);
        function tapMeld() {
          if (!myTurn() || S().phase !== 'play') return;
          if (one === null) { UI.toast('Select one card from your hand, then tap a meld to lay it off.'); return; }
          if (!ok) { UI.toast(E.label(one) + ' does not fit that meld.'); Sound.play('nope'); return; }
          Sound.play('pop', 3); sel = []; hintMsg = ''; src.act('layoff', [one, mi]);
        }
        var groups = {};
        md.cards.forEach(function (c) {
          var who = md.lo && md.lo[c] !== undefined ? md.lo[c] : md.by;
          (groups[who] = groups[who] || []).push(c);
        });
        Object.keys(groups).forEach(function (k) {
          var who = +k, isOwner = who === md.by;
          var g = h('button', { class: 'rummeld' + (isOwner ? '' : ' layoff') + (ok ? ' can' : ''), style: '--c:' + COLORS[md.by] });
          var cardsBox = h('span', { class: 'rummcards' });
          groups[k].forEach(function (c) { cardsBox.appendChild(cardEl(c, 'sm')); });
          g.appendChild(cardsBox);
          if (!isOwner) g.appendChild(h('span', { class: 'rumlotag', text: meldName(md) }));
          g.addEventListener('click', tapMeld);
          (rowsBy[who] || tbl).appendChild(g);
        });
      });
      // piles
      stockEl.innerHTML = ''; stockEl.appendChild(h('div', { class: 'pcard back' }, h('span', { class: 'pc-mid', text: s.stock.length })));
      stockEl.classList.toggle('glow', myDraw());
      discEl.innerHTML = '';
      s.discard.forEach(function (c, i) {
        var el = cardEl(c, 'sm' + (myDraw() ? ' tap' : '')); el.style.transform = 'rotate(' + tiltOf(c) + 'deg)';
        el.addEventListener('click', function () { takeDiscard(i); });
        discEl.appendChild(el);
      });
      discEl.scrollLeft = discEl.scrollWidth;
      // hand
      handEl.innerHTML = '';
      var cs = CardPrefs.size(), cards = sorted(my.hand), W = handEl.clientWidth || 340, CW = 52 * cs, RH = 84 * cs, n = cards.length;
      var rows = 1, perRow = n, step = 0;
      for (;;) {
        perRow = Math.ceil(n / rows);
        step = perRow > 1 ? Math.min(CW + 4, (W - CW) / (perRow - 1)) : 0;
        if (step >= 24 * cs || perRow <= 1 || rows >= 4) break;
        rows++;
      }
      handEl.style.height = (rows * RH + 18) + 'px';
      cards.forEach(function (c, k) {
        var row = Math.floor(k / perRow), col = k % perRow;
        var el = cardEl(c, (sel.indexOf(c) >= 0 ? 'sel ' : '') + (fresh[c] ? 'fresh ' : '') + (c === s.mustUse && myTurn() ? 'must ' : '') + (hint.indexOf(c) >= 0 ? 'hint' : ''));
        el.style.left = (col * step) + 'px'; el.style.top = (row * RH + 14) + 'px'; el.style.zIndex = k + 1;
        el.addEventListener('click', function () {
          if (!myTurn()) { UI.toast('Wait for your turn.'); return; }
          if (S().phase === 'draw') { UI.toast('Draw first: tap the deck or the discard pile.'); return; }
          var i = sel.indexOf(c); if (i >= 0) sel.splice(i, 1); else sel.push(c);
          Sound.play('land'); render();
        });
        handEl.appendChild(el);
      });
      var playing = myTurn() && s.phase === 'play';
      btnMeld.disabled = !(playing && sel.length >= 3 && E.asMeld(sel));
      btnDisc.disabled = !(playing && sel.length === 1 && E.canDiscard(s, sel[0]));
      btnSort.textContent = sortMode === 'suit' ? 'Sort: suit' : 'Sort: rank';
      btnHint.disabled = !myTurn();
      hideFlying();
      animate(before, s);
      // end of hand / game
      if (s.phase === 'over' || s.phase === 'gameover') {
        var key = s.round + s.phase + (s.gid || '');
        if (key !== shownKey) { shownKey = key; setTimeout(roundOver, CardPrefs.ms(700)); }
      } else if (shownKey && document.querySelector('.rumroundmodal')) { UI.closeModal(); shownKey = ''; }
    }

    function takeDiscard(i) {
      if (!myDraw()) return;
      var s = S(), top = i === s.discard.length - 1;
      var picked = s.discard.slice(i), card = picked[0];
      if (!E.canUse(me().hand.concat(picked), card, s.melds)) { Sound.play('nope'); UI.toast('You can only take the ' + E.label(card) + ' if you can play it this turn.'); return; }
      if (top) { src.act('pile', i); return; }
      var n = picked.length;
      UI.modal({ title: 'Take ' + n + ' cards?', text: 'You get the ' + E.label(card) + ' and the ' + (n - 1) + ' card' + (n > 2 ? 's' : '') + ' above it. You must play the ' + E.label(card) + ' this turn.',
        buttons: [{ label: 'Take them', cls: 'rummy', fn: function () { src.act('pile', i); } }, { label: 'Cancel' }] });
    }
    function doMeld() { var cards = sel.slice(); if (!E.asMeld(cards)) return; Sound.play('combo', 2); sel = []; hint = []; hintMsg = ''; src.act('meld', cards); }
    function doDiscard() {
      var s = S(), c = sel[0];
      if (!E.canDiscard(s, c)) {
        if (s.mustUse !== null) UI.toast('Play the ' + E.label(s.mustUse) + ' first.');
        else if (c === s.tookTop) UI.toast('You cannot throw back the card you just took.');
        return;
      }
      sel = []; fresh = {}; hint = []; hintMsg = ''; src.act('discard', c);
    }
    function doHint() {
      if (!myTurn()) return;
      var s = JSON.parse(JSON.stringify(S())), hand = me().hand;
      if (s.phase === 'draw') {
        var d = E.aiDraw(s);
        hintMsg = d.from === 'stock' ? 'Hint: nothing in the discard pile helps you. Draw from the deck.' :
          'Hint: take the ' + E.label(s.discard[d.index]) + (d.index < s.discard.length - 1 ? ' (and the cards above it)' : '') + ' from the discard pile.';
        render(); return;
      }
      var b = E.bestMelds(hand, s.mustUse !== null && E.layOffTarget(s.melds, s.mustUse) < 0 ? s.mustUse : undefined);
      if (b && b.melds.length) { hint = b.melds[0].cards.slice(); sel = hint.slice(); hintMsg = 'Hint: these cards make a ' + b.melds[0].type + '. Tap Meld.'; render(); return; }
      for (var i = 0; i < hand.length; i++) if (E.layOffTarget(s.melds, hand[i]) >= 0) {
        sel = [hand[i]]; hint = sel.slice(); hintMsg = 'Hint: the ' + E.label(hand[i]) + ' can be laid off. Tap the glowing meld.'; render(); return;
      }
      var dc = E.aiDiscard(s); sel = [dc]; hint = [dc]; hintMsg = 'Hint: no melds right now. Discard the ' + E.label(dc) + '.'; render();
    }

    function scoreTable() {
      var s = S(), t = h('table', { class: 'rumtbl' }), rows = s.result ? s.result.rows : null;
      t.appendChild(h('tr', null, [h('th', { text: '' }), h('th', { text: rows ? 'Table' : 'This hand' }), h('th', { text: rows ? 'Hand' : '' }), h('th', { text: 'Total' })]));
      s.players.forEach(function (p, i) {
        var r = rows ? rows[i] : null;
        t.appendChild(h('tr', null, [h('td', { text: p.name }), h('td', { text: '+' + (r ? r.table : p.table) }), h('td', { text: r ? '-' + r.hand : '' }), h('td', { text: String(p.score) })]));
      });
      if (s.teams) E.sides(s).forEach(function (x, k) { t.appendChild(h('tr', { class: 'team' }, [h('td', { text: sideName(s, k, seat()) }), h('td'), h('td'), h('td', { text: String(x.score) })])); });
      return t;
    }
    function scoreSheet() {
      var s = S();
      var body = h('div', null, [scoreTable(), handHistory(s, seat())]);
      UI.modal({ title: 'Scores \u00B7 Hand ' + s.round, body: body, text: 'Playing to ' + s.target + '.', buttons: [{ label: 'Back to the game', cls: 'rummy' }] });
    }
    function roundOver() {
      if (!document.body.contains(scene)) return;
      var s = S(); if (s.phase !== 'over' && s.phase !== 'gameover') return;
      var head = roundHead(s), wrap = h('div', { class: 'rumroundmodal' }, scoreTable());
      if (s.phase === 'gameover') {
        var mine = s.winner === me().team;
        if (mine) { UI.confetti(); Sound.play('win'); } else Sound.play('lose');
        var entry = recordGame(s, seat(), src.info(), src.online), st = stats(), recTxt = ' Your record: ' + st.w + (st.w === 1 ? ' win, ' : ' wins, ') + st.l + (st.l === 1 ? ' loss.' : ' losses.');
        entry.players.forEach(function (p, i) {
          if (i === entry.seat || p.bot) return;
          var x = st.people[personKey(p)]; if (!x) return;
          if (x.vsW + x.vsL && !(entry.teams && p.tm === entry.myTeam)) recTxt += ' Against ' + p.n + ': ' + x.vsW + '-' + x.vsL + '.';
          if (x.wW + x.wL && entry.teams && p.tm === entry.myTeam) recTxt += ' With ' + p.n + ': ' + x.wW + '-' + x.wL + '.';
        });
        wrap.appendChild(handHistory(s, seat()));
        wrap.appendChild(h('button', { class: 'ghostbtn', text: 'See my full record', onclick: function () { UI.closeModal(); location.hash = '#/rummy/stats'; } }));
        var btns = src.online && !src.isHost ? [{ label: 'OK', cls: 'rummy' }] :
          [{ label: src.online ? 'Play again (same players)' : 'New game', cls: 'rummy', fn: function () {
            if (src.online) src.act('again'); else { UI.store('rum_game', null); location.hash = '#/rummy'; }
          } }];
        if (src.online) btns.push({ label: 'Leave online game', fn: function () { if (src.isHost) leaveOnline(); else closeNet(); location.hash = '#/rummy'; } });
        UI.modal({ big: mine ? '\uD83C\uDFC6' : '\uD83C\uDCCF', title: mine ? (s.teams ? 'Your team wins!' : 'You win!') : sideName(s, s.winner, seat()) + ' wins.',
          text: head + recTxt + (src.online && !src.isHost ? ' The host can start another game.' : ''), body: wrap, dismiss: false, buttons: btns });
        return;
      }
      UI.modal({ title: head, body: wrap, dismiss: false,
        buttons: [{ label: 'Deal the next hand', cls: 'rummy', fn: function () { src.act('next'); } }] });
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
      body.appendChild(row('Card sounds', 'Shuffles, flicks and slaps', Sound.prefs.sfx, Sound.setSfx));
      UI.modal({ title: 'Settings', body: body, buttons: [{ label: 'Done', cls: 'rummy' }] });
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
