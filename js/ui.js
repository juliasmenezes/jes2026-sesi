/* =====================================================
   JES 2026 — ui.js
   Camada visual compartilhada por todas as páginas:
   cabeçalho, troca de turno/tema, loading, toasts,
   banners de lances, animações de estado e confete.
   ===================================================== */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function turnoAtual() { return (window.getCategoria ? window.getCategoria() : localStorage.getItem('jes2026_categoria')) || 'manha'; }

  /* ---------- ícones (traço, 24x24) ---------- */
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    moon: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.6-4 3.5-6 7.5-6s6.9 2 7.5 6"/>',
    lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>', flag: '<path d="M5 21V4M5 5h12l-2 4 2 4H5"/>',
    clock: '<circle cx="12" cy="12.5" r="8.5"/><path d="M12 8v4.5l3 2"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>', whistle: '<circle cx="9" cy="14.5" r="5.5"/><path d="M14 11.5l7-3.5v3.5l-6 2M9 10v4.5"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 21h8M9.5 18h5"/>',
    card: '<rect x="7" y="3.5" width="10" height="17" rx="2" fill="currentColor"/>', swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
    ball: '<circle cx="12" cy="12" r="9.5"/><path d="M12 2.5v19M2.5 12h19M5.2 5.2c3.2 3.2 3.2 10.4 0 13.6M18.8 5.2c-3.2 3.2-3.2 10.4 0 13.6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.5-3.4 2.9-5 6-5s5.5 1.6 6 5M16 5.5a3 3 0 0 1 0 5.8M18 14.7c1.8.6 2.7 2.2 3 4.8"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6"/>', cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    rank: '<path d="M4 20V11h5v9M9.5 20V5h5v15M15 20v-6h5v6"/>', book: '<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5zM5 17a3 3 0 0 1 3-3h10"/>',
    out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>', more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19L12 3.5zM12 10v4.5"/><circle cx="12" cy="17.3" r=".6" fill="currentColor"/>', shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6L12 3z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>', shirt: '<path d="M8 4l4 2 4-2 4 3-2 4-2-1v10H8V10l-2 1-2-4 4-3z"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4M5.5 3v4h4M18.5 21v-4h-4"/>'
  };
  function ico(name, size, cls) {
    return '<svg class="ico ' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg>';
  }

  /* escudo/brasão da equipe */
  function brasao(nome, cls) {
    var eq = window.getEquipeByNome ? window.getEquipeByNome(nome) : null;
    if (eq && eq.brasao) return '<img class="crest ' + (cls || '') + '" src="' + esc(eq.brasao) + '" alt="' + esc(nome) + '">';
    return '<span class="crest crest-fallback ' + (cls || '') + '" aria-hidden="true">' + esc(String(nome || '?').trim().charAt(0).toUpperCase()) + '</span>';
  }
  function corModalidade(jogo) {
    var m = window.getModalidades ? window.getModalidades().find(function (x) { return x.nome === jogo.modalidade && x.genero === jogo.genero; }) : null;
    return m && m.cor ? m.cor : '#E10600';
  }
  function generoCurto(g) { return g === 'MASCULINO' ? 'Masc.' : g === 'FEMININO' ? 'Fem.' : 'Misto'; }

  /* ---------- cabeçalho público ---------- */
  var NAV = [
    ['home.html', 'Ao vivo', 'home'], ['tabela-jogos.html', 'Jogos', 'jogos'],
    ['classificacao.html', 'Classificação', 'rank'], ['modalidades.html', 'Modalidades', 'mod']
  ];
  function turnoSwitchHTML(opts) {
    opts = opts || {};
    var t = turnoAtual();
    function btn(k, icon, nome, serie) {
      return '<button type="button" role="radio" aria-checked="' + (t === k) + '" data-turno-btn="' + k + '"' + (opts.locked && t !== k ? ' disabled' : '') + '>' +
        ico(icon, 16) + '<span class="ts-txt"><b>' + nome + '</b><small>' + serie + '</small></span></button>';
    }
    return '<div class="turno-switch' + (opts.locked ? ' is-locked' : '') + '" role="radiogroup" aria-label="Turno" data-pos="' + t + '">' +
      '<span class="ts-thumb"></span>' + btn('manha', 'sun', 'Manhã', '7º e 8º ano') + btn('tarde', 'moon', 'Tarde', '9º ao 3º EM') + '</div>';
  }
  function bindTurnoSwitch(root) {
    (root || document).querySelectorAll('.turno-switch').forEach(function (sw) {
      if (sw.__bound) return; sw.__bound = true;
      sw.addEventListener('click', function (e) {
        var b = e.target.closest('[data-turno-btn]');
        if (b && !b.disabled) setTurno(b.getAttribute('data-turno-btn'));
      });
    });
  }
  function syncTurnoSwitches() {
    var t = turnoAtual();
    document.querySelectorAll('.turno-switch').forEach(function (sw) {
      sw.setAttribute('data-pos', t);
      sw.querySelectorAll('[data-turno-btn]').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-turno-btn') === t)); });
    });
  }

  /* troca de turno com "cortina" diagonal (a cor do tema muda no meio da animação) */
  var trocando = false;
  function setTurno(novo) {
    if (novo === turnoAtual() || trocando) return;
    if (reduceMotion) { window.setCategoria(novo); return; }
    trocando = true;
    var w = document.createElement('div');
    w.className = 'turno-wipe to-' + novo;
    w.innerHTML = '<div class="tw-slash"></div><div class="tw-label">' + ico(novo === 'tarde' ? 'moon' : 'sun', 44) + '<span>Turno da ' + (novo === 'tarde' ? 'tarde' : 'manhã') + '</span><small>' + ((window.TURNOS && window.TURNOS[novo].series) || '') + '</small></div>';
    document.body.appendChild(w);
    setTimeout(function () { window.setCategoria(novo); }, 420);
    setTimeout(function () { w.classList.add('out'); }, 900);
    setTimeout(function () { w.remove(); trocando = false; }, 1350);
  }

  function mountHeader(active) {
    var host = document.getElementById('app-header');
    if (!host) return;
    host.innerHTML =
      '<header class="site-header"><div class="sh-inner">' +
      '<a class="brand" href="home.html" aria-label="JES 2026 — início"><img src="img/logo.png" alt=""><span class="brand-text"><b>JES 2026</b><small>Jogos Estudantis SESI</small></span></a>' +
      '<nav class="main-nav" id="main-nav" aria-label="Principal">' +
      NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[2] === active ? ' class="active" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('') +
      '<a class="nav-admin" href="login.html">' + ico('user', 18) + ' Organizador</a></nav>' +
      '<div class="sh-actions">' + turnoSwitchHTML() +
      '<a class="icon-btn hide-mobile" href="login.html" title="Área do organizador" aria-label="Área do organizador">' + ico('user', 20) + '</a>' +
      '<button class="icon-btn burger" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="main-nav"><span></span><span></span><span></span></button></div>' +
      '</div></header><div class="nav-scrim"></div>';
    bindTurnoSwitch(host);
    var burger = host.querySelector('.burger');
    function toggle(open) {
      var nav = host.querySelector('.main-nav');
      nav.classList.toggle('open', open); burger.classList.toggle('open', open);
      host.querySelector('.nav-scrim').classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open);
    }
    burger.addEventListener('click', function () { toggle(!burger.classList.contains('open')); });
    host.querySelector('.nav-scrim').addEventListener('click', function () { toggle(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
  }

  /* ---------- loading esportivo ---------- */
  var loaderEl = null, loaderTimer = null, loaderMsgTimer = null, loaderShownAt = 0;
  var MSGS = ['Sincronizando placares…', 'Buscando os jogos de hoje…', 'Aquecendo a quadra…', 'Conferindo a classificação…'];
  function showLoader(msg) {
    if (loaderEl) return;
    loaderShownAt = Date.now();
    loaderEl = document.createElement('div');
    loaderEl.className = 'jes-loader'; loaderEl.setAttribute('role', 'status'); loaderEl.setAttribute('aria-live', 'polite');
    loaderEl.innerHTML = '<div class="ld-stage"><div class="ld-ball-wrap"><svg class="ld-ball" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="var(--red)" stroke="#0b0b0d" stroke-width="3"/>' +
      '<path d="M24 3v42M3 24h42M8 9c8 7 8 23 0 30M40 9c-8 7-8 23 0 30" fill="none" stroke="#0b0b0d" stroke-width="2.4"/></svg><span class="ld-shadow"></span></div>' +
      '<div class="ld-track"><i></i></div><p class="ld-msg" id="ld-msg">' + esc(msg || MSGS[0]) + '</p>' +
      '<div class="ld-error" hidden><p>Não foi possível conectar ao servidor.</p><button type="button" class="btn btn-primary" onclick="location.reload()">Tentar novamente</button></div></div>';
    document.body.appendChild(loaderEl);
    var i = 0;
    loaderMsgTimer = setInterval(function () { var m = document.getElementById('ld-msg'); if (m) m.textContent = MSGS[++i % MSGS.length]; }, 1500);
    loaderTimer = setTimeout(function () {
      if (!loaderEl) return;
      loaderEl.classList.add('has-error');
      loaderEl.querySelector('.ld-error').hidden = false;
      loaderEl.querySelector('.ld-msg').hidden = true;
    }, 14000);
  }
  function hideLoader() {
    if (!loaderEl) return;
    var el = loaderEl; loaderEl = null;
    clearInterval(loaderMsgTimer); clearTimeout(loaderTimer);
    var wait = Math.max(0, 550 - (Date.now() - loaderShownAt));
    setTimeout(function () { el.classList.add('done'); setTimeout(function () { el.remove(); }, 450); }, wait);
  }
  function skeleton(n, cls) {
    var h = ''; for (var i = 0; i < (n || 3); i++) h += '<div class="skel ' + (cls || '') + '"></div>';
    return h;
  }

  /* ---------- toasts ---------- */
  function toastHost() {
    var h = document.querySelector('.toasts');
    if (!h) { h = document.createElement('div'); h.className = 'toasts'; h.setAttribute('aria-live', 'polite'); document.body.appendChild(h); }
    return h;
  }
  function toast(o) {
    o = o || {};
    var t = document.createElement('div');
    if (o.key) document.querySelectorAll('.toast[data-key="' + o.key + '"]').forEach(function (x) { x.remove(); });
    t.className = 'toast tone-' + (o.tone || 'info');
    if (o.key) t.setAttribute('data-key', o.key);
    t.innerHTML = '<span class="toast-ico">' + ico(o.icon || (o.tone === 'ok' ? 'check' : o.tone === 'warn' ? 'alert' : 'info'), 20) + '</span>' +
      '<div class="toast-body"><b>' + esc(o.title || '') + '</b>' + (o.text ? '<span>' + esc(o.text) + '</span>' : '') + '</div>' +
      (o.action ? '<button type="button" class="toast-action">' + esc(o.action.label) + '</button>' : '') + '<i class="toast-bar"></i>';
    var ms = o.ms || 4200;
    t.style.setProperty('--ms', ms + 'ms');
    var host = toastHost();
    host.appendChild(t);
    while (host.children.length > 4) host.firstChild.remove();
    function close() { t.classList.add('out'); setTimeout(function () { t.remove(); }, 260); }
    if (o.action) t.querySelector('.toast-action').addEventListener('click', function () { try { o.action.fn(); } catch (e) { console.error(e); } close(); });
    var timer = setTimeout(close, ms);
    t.addEventListener('click', function (e) { if (!e.target.closest('.toast-action')) { clearTimeout(timer); close(); } });
    return t;
  }
  /* executa uma operação assíncrona mostrando erro amigável se falhar */
  function safe(fn, msg) {
    return Promise.resolve().then(fn).catch(function (err) {
      console.error(err);
      toast({ tone: 'warn', title: msg || 'Não foi possível salvar', text: 'Verifique a conexão e tente de novo.' });
    });
  }
  function busy(btn, promise) {
    if (!btn) return promise;
    btn.classList.add('is-busy'); btn.disabled = true;
    return Promise.resolve(promise).finally(function () { btn.classList.remove('is-busy'); btn.disabled = false; });
  }

  /* ---------- banner de lance (gol, cesta, ponto) ---------- */
  var bannerQueue = [], bannerBusy = false;
  function goalBanner(o) {
    if (bannerQueue.length > 2) bannerQueue.shift();
    bannerQueue.push(o);
    if (!bannerBusy) nextBanner();
  }
  function nextBanner() {
    var o = bannerQueue.shift();
    if (!o) { bannerBusy = false; return; }
    bannerBusy = true;
    var el = document.createElement('div');
    el.className = 'goal-banner side-' + (o.side || 'A') + (o.big && o.big.length > 9 ? ' is-long' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="gb-shine"></div><div class="gb-ball">' + ico('ball', 34) + '</div>' +
      '<div class="gb-main"><strong>' + esc(o.big) + '</strong><span class="gb-team">' + esc(o.team || '') + (o.minuto ? ' · ' + esc(o.minuto) : '') + '</span></div>' +
      '<div class="gb-score"><span>' + esc(o.teamA) + '</span><b>' + esc(o.scoreA) + '</b><i>×</i><b>' + esc(o.scoreB) + '</b><span>' + esc(o.teamB) + '</span></div>';
    document.body.appendChild(el);
    var ms = reduceMotion ? 2600 : 4200;
    setTimeout(function () { el.classList.add('out'); }, ms);
    setTimeout(function () { el.remove(); nextBanner(); }, ms + 380);
  }

  /* ---------- banner de estado (intervalo, fim de set/quarto) ---------- */
  var stateEl = null;
  function stateBanner(o) {
    if (stateEl) stateEl.remove();
    var el = stateEl = document.createElement('div');
    el.className = 'state-banner kind-' + (o.chave || 'pausa');
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="sb-stripes"></div><div class="sb-card">' + '<span class="sb-ico">' + ico(o.chave === 'fim_set' ? 'flag' : 'whistle', 38) + '</span>' +
      '<div><strong>' + esc(o.titulo) + '</strong><span>' + esc(o.sub || '') + '</span></div>' +
      (o.jogo ? '<em>' + esc(o.jogo) + '</em>' : '') + '</div>';
    document.body.appendChild(el);
    var ms = reduceMotion ? 2800 : 4000;
    setTimeout(function () { el.classList.add('out'); }, ms);
    setTimeout(function () { el.remove(); if (stateEl === el) stateEl = null; }, ms + 420);
  }

  /* ---------- fim de jogo: celebração ---------- */
  function endCelebration(o) {
    var el = document.createElement('div');
    el.className = 'end-overlay';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Fim de jogo');
    var empate = o.vencedor === null;
    el.innerHTML = '<canvas class="confetti"></canvas><div class="end-card">' +
      '<div class="end-trophy">' + ico('trophy', 64) + '</div><span class="end-kicker">Fim de jogo</span>' +
      '<div class="end-score"><div class="end-team' + (o.vencedor === 'A' ? ' win' : '') + '">' + brasao(o.timeA, 'crest-lg') + '<span>' + esc(o.timeA) + '</span></div>' +
      '<div class="end-num"><b>' + esc(o.a) + '</b><i>×</i><b>' + esc(o.b) + '</b></div>' +
      '<div class="end-team' + (o.vencedor === 'B' ? ' win' : '') + '">' + brasao(o.timeB, 'crest-lg') + '<span>' + esc(o.timeB) + '</span></div></div>' +
      '<p class="end-winner">' + (empate ? 'Partida empatada' : 'Vitória de <b>' + esc(o.vencedor === 'A' ? o.timeA : o.timeB) + '</b>') + '</p>' +
      '<small class="end-sport">' + esc(o.esporte || '') + (o.parciais ? ' · ' + esc(o.parciais) : '') + '</small>' +
      '<button type="button" class="btn btn-primary end-close">Continuar</button></div>';
    document.body.appendChild(el);
    function close() { el.classList.add('out'); stopConfetti = true; setTimeout(function () { el.remove(); }, 420); }
    el.querySelector('.end-close').addEventListener('click', close);
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    var stopConfetti = false;
    if (!reduceMotion) runConfetti(el.querySelector('canvas'), function () { return stopConfetti; });
    setTimeout(close, 12000);
    return el;
  }
  function runConfetti(canvas, shouldStop) {
    var ctx = canvas.getContext('2d'), W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() { W = canvas.width = innerWidth * dpr; H = canvas.height = innerHeight * dpr; }
    size();
    var colors = ['#E10600', '#FFFFFF', '#FF6A5F', '#B00500', '#F2F2F2'];
    var parts = [];
    for (var i = 0; i < 150; i++) parts.push({
      x: Math.random() * W, y: -Math.random() * H * 0.6, w: (6 + Math.random() * 8) * dpr, h: (10 + Math.random() * 10) * dpr,
      vy: (2 + Math.random() * 4) * dpr, vx: (Math.random() - 0.5) * 3 * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0]
    });
    (function frame() {
      if (shouldStop() || !canvas.isConnected) return;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      requestAnimationFrame(frame);
    })();
  }

  /* ---------- monitor de lances ao vivo (páginas públicas) ---------- */
  function snapshotJogos() {
    var m = {};
    (window.getJogos ? window.getJogos() : []).forEach(function (j) {
      var ids = {}; j.eventos.forEach(function (e) { ids[e.id] = 1; });
      m[j.id] = { status: j.status, pausa: j.pausaMotivo, placarA: j.placarA, placarB: j.placarB, setsA: j.setsA, setsB: j.setsB, periodo: j.periodo, ev: ids };
    });
    return m;
  }
  function textoLance(jogo, ev) {
    var k = window.sportKind(jogo.modalidade);
    if (k === 'basquete') return ev.valor >= 3 ? 'CESTA DE 3!' : ev.valor === 2 ? 'CESTA DE 2!' : 'LANCE LIVRE!';
    if (k === 'futsal' || k === 'handebol') return 'GOL!';
    return 'PONTO!';
  }
  /* vôlei: se o ponto fechou o set, mostra o placar daquele set */
  function placarBanner(j) {
    if (window.sportKind(j.modalidade) === 'volei' && j.placarA + j.placarB === 0 && j.parciais.length) { var u = j.parciais[j.parciais.length - 1]; return { a: u.a, b: u.b }; }
    return { a: j.placarA, b: j.placarB };
  }
  function watchLive() {
    var prev = null, inicio = Date.now();
    function diff() {
      var cur = snapshotJogos();
      if (prev) {
        (window.getJogos() || []).forEach(function (j) {
          var a = prev[j.id], b = cur[j.id];
          if (!b) return;
          var nome = j.timeA + ' × ' + j.timeB;
          var res = window.resultado(j);
          /* lances novos */
          if (a) j.eventos.forEach(function (ev) {
            if (a.ev[ev.id] || ev.timestamp < inicio - 4000) return;
            var time = ev.time === 'A' ? j.timeA : j.timeB;
            if (ev.tipo === 'gol' || ev.tipo === 'ponto') {
              goalBanner({ big: textoLance(j, ev), team: time, minuto: ev.minuto, side: ev.time, teamA: j.timeA, teamB: j.timeB,
                scoreA: placarBanner(j).a, scoreB: placarBanner(j).b });
            } else if (ev.tipo === 'cartao') toast({ tone: 'warn', icon: 'card', title: ev.descricao, text: nome });
            else toast({ tone: 'info', icon: ev.tipo === 'substituicao' ? 'swap' : 'info', title: ev.descricao, text: nome });
          });
          /* mudanças de estado */
          if (a && a.status !== b.status) {
            if (b.status === 'FINALIZADO') {
              var vencedor = res.a > res.b ? 'A' : res.b > res.a ? 'B' : null;
              endCelebration({ timeA: j.timeA, timeB: j.timeB, a: res.a, b: res.b, vencedor: vencedor, esporte: j.modalidade + ' ' + generoCurto(j.genero),
                parciais: j.parciais && j.parciais.length ? j.parciais.map(function (p) { return p.a + '-' + p.b; }).join(' · ') : '' });
            } else if (b.status === 'PAUSADO') {
              var lp = window.labelPausa(j); lp.jogo = nome; stateBanner(lp);
            } else if (b.status === 'AO VIVO' && a.status === 'EM BREVE') {
              toast({ tone: 'ok', icon: 'play', title: 'Bola rolando!', text: nome + ' · ' + j.modalidade });
            } else if (b.status === 'AO VIVO' && a.status === 'PAUSADO') {
              toast({ tone: 'ok', icon: 'play', title: 'Jogo retomado', text: nome + ' · ' + window.labelPeriodo(j) });
            }
          }
        });
      }
      prev = cur;
    }
    window.addEventListener('jes2026-data-changed', diff);
    window.addEventListener('jes2026-categoria-changed', function () { prev = snapshotJogos(); inicio = Date.now(); });
    prev = snapshotJogos();
  }

  /* ---------- bootstrap de página ---------- */
  /* espera o módulo app.js (se o CDN falhar, o loader mostra o erro com "Tentar novamente") */
  function aguardarApp(cb) {
    if (window.onReady) { window.onReady(cb); return; }
    var n = 0, t = setInterval(function () { if (window.onReady) { clearInterval(t); window.onReady(cb); } else if (++n > 200) clearInterval(t); }, 100);
  }
  function start(opts, cb) {
    opts = opts || {};
    showLoader(opts.loadingMsg);
    function go() {
      if (!opts.noHeader) mountHeader(opts.page);
      window.addEventListener('jes2026-categoria-changed', syncTurnoSwitches);
      aguardarApp(function () {
        hideLoader();
        if (window._db && window._db._error) toast({ tone: 'warn', title: 'Conexão instável', text: 'Alguns dados podem estar desatualizados.', ms: 6000 });
        try { cb && cb(); } catch (e) { console.error(e); }
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }

  window.JESUI = {
    esc: esc, ico: ico, brasao: brasao, corModalidade: corModalidade, generoCurto: generoCurto,
    start: start, mountHeader: mountHeader, turnoSwitchHTML: turnoSwitchHTML, bindTurnoSwitch: bindTurnoSwitch, syncTurnoSwitches: syncTurnoSwitches,
    setTurno: setTurno, showLoader: showLoader, hideLoader: hideLoader, skeleton: skeleton,
    toast: toast, safe: safe, busy: busy, goalBanner: goalBanner, stateBanner: stateBanner, endCelebration: endCelebration, watchLive: watchLive
  };
})();
