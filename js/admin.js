/* =====================================================
   JES 2026 — admin.js
   Painel do organizador/mesário (redesenhado):
   Mesa de jogo · Agenda · Classificação · Cadastros
   ===================================================== */
(function () {
  'use strict';

  var esc = JESUI.esc, ico = JESUI.ico;
  var S = { view: 'mesa', cad: 'equipes', jogoId: null, fData: 'all', fEsporte: 'all', fStatus: 'all', detalhe: null };
  var user = null, master = false, trava = false, brasaoTmp = '';

  /* ---------- início ---------- */
  JESUI.start({ noHeader: true, loadingMsg: 'Abrindo a mesa de jogo…' }, init);

  function init() {
    var sess = getSession();
    if (!sess) { location.replace('login.html'); return; }
    user = getUsuarioAtual();
    if (!user && !_db._error) { clearSession(); location.replace('login.html'); return; }
    user = user || { email: sess.email, role: sess.role, categoria: sess.categoria, nome: sess.email };
    master = user.role === 'master';
    if (!master && user.categoria && user.categoria !== 'ambas') setCategoria(user.categoria);

    shell();
    renderView();
    onSync(function () {
      var ativo = document.activeElement;
      if (ativo && ativo.matches && ativo.matches('#ad-view select')) return;   /* não fecha o menu aberto */
      renderView();
    });
    window.addEventListener('jes2026-categoria-changed', function () { S.jogoId = null; S.detalhe = null; JESUI.syncTurnoSwitches(); renderView(); });
    document.addEventListener('click', clique);
    document.getElementById('ad-view').addEventListener('change', filtro);
    setInterval(tick, 1000);
    window.addEventListener('offline', function () { redePill(false); JESUI.toast({ tone: 'warn', title: 'Sem internet', text: 'Os lances serão enviados quando a conexão voltar.' }); });
    window.addEventListener('online', function () { redePill(true); JESUI.toast({ tone: 'ok', title: 'Conexão restabelecida' }); });
    redePill(navigator.onLine);
  }

  function redePill(ok) {
    var p = document.getElementById('net-pill');
    if (p) { p.className = 'net-pill ' + (ok ? 'ok' : 'off'); p.lastChild.textContent = ok ? 'Sincronizado' : 'Sem internet'; }
  }

  /* ---------- estrutura ---------- */
  function shell() {
    var abas = [['mesa', 'whistle', 'Mesa de jogo'], ['agenda', 'cal', 'Agenda']];
    if (master) abas.push(['rank', 'rank', 'Classificação'], ['cad', 'users', 'Cadastros']);
    var travado = !master && user.categoria && user.categoria !== 'ambas';
    document.getElementById('admin-root').innerHTML =
      '<header class="ad-top"><a class="ad-brand" href="home.html" title="Ver o site"><img src="img/logo.png" alt=""><span><b>Mesa de jogo</b><small>JES 2026</small></span></a>' +
      '<nav class="ad-nav" aria-label="Seções">' + abas.map(function (a) {
        return '<button type="button" data-act="view" data-v="' + a[0] + '" class="' + (S.view === a[0] ? 'active' : '') + '">' + ico(a[1], 20) + '<span>' + a[2] + '</span></button>';
      }).join('') + '</nav>' +
      '<div class="ad-right">' + JESUI.turnoSwitchHTML({ locked: travado }) +
      '<span class="net-pill ok" id="net-pill"><i></i><b>Sincronizado</b></span>' +
      '<div class="user-chip"><span class="avatar">' + esc((user.nome || user.email || '?').charAt(0).toUpperCase()) + '</span><span class="u-txt"><b>' + esc(user.nome || user.email) + '</b><small>' + (master ? 'Administrador' : 'Mesário') + '</small></span></div>' +
      '<button type="button" class="icon-btn" data-act="sair" title="Sair" aria-label="Sair">' + ico('out', 20) + '</button></div></header>' +
      '<main class="ad-main"><div id="ad-view"></div></main>';
    JESUI.bindTurnoSwitch(document.getElementById('admin-root'));
  }

  function renderView() {
    var v = document.getElementById('ad-view');
    if (!v) return;
    document.querySelectorAll('.ad-nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.v === S.view); });
    var html = S.view === 'agenda' ? viewAgenda() : S.view === 'rank' && master ? viewRank() : S.view === 'cad' && master ? viewCad() : viewMesa();
    v.innerHTML = html;
  }

  /* ---------- eventos ---------- */
  var A = {};
  function clique(e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = A[el.dataset.act];
    if (fn) fn(el, e);
  }
  function filtro(e) {
    var k = e.target.getAttribute('data-filter');
    if (!k) return;
    S[k] = e.target.value; renderView();
  }
  function cur() { return S.jogoId ? getJogoById(S.jogoId) : null; }
  function tick() {
    var c = document.getElementById('cs-clock'), j = cur();
    if (c && j) c.textContent = formatarTempoJogo(getTempoJogo(j));
  }
  function minutoAtual(j) { return formatarTempoJogo(getTempoJogo(j)); }
  function antiToque() { if (trava) return true; trava = true; setTimeout(function () { trava = false; }, 220); return false; }

  /* =====================================================
     MESA DE JOGO
     ===================================================== */
  function viewMesa() {
    var j = cur();
    if (S.jogoId && !j) S.jogoId = null;
    return j ? consoleJogo(j) : seletorJogos();
  }

  function seletorJogos() {
    var hoje = hojeLocal(), jogos = getJogos();
    var ordem = function (a, b) { return (a.data + a.horario).localeCompare(b.data + b.horario); };
    var andamento = jogos.filter(function (j) { return j.status === 'AO VIVO' || j.status === 'PAUSADO'; }).sort(ordem);
    var hojeProx = jogos.filter(function (j) { return j.status === 'EM BREVE' && j.data === hoje; }).sort(ordem);
    var fimHoje = jogos.filter(function (j) { return j.status === 'FINALIZADO' && j.data === hoje; }).sort(ordem).reverse();
    var outros = (!andamento.length && !hojeProx.length) ? jogos.filter(function (j) { return j.status === 'EM BREVE'; }).sort(ordem).slice(0, 6) : [];
    var t = getCategoria();

    function grupo(titulo, lista, extra) {
      if (!lista.length) return '';
      return '<section class="pick-group"><h3>' + titulo + '<small>' + lista.length + '</small></h3><div class="pick-grid">' + lista.map(function (j) { return cartaoJogo(j, extra); }).join('') + '</div></section>';
    }
    var vazio = !andamento.length && !hojeProx.length && !outros.length && !fimHoje.length;
    return '<div class="ad-head"><div><h1>Mesa de jogo</h1><p class="muted">Turno da ' + TURNOS[t].nome.toLowerCase() + ' · ' + TURNOS[t].series + '. Escolha a partida que você vai conduzir.</p></div>' +
      (master ? '<button type="button" class="btn btn-primary" data-act="novoJogo">' + ico('plus', 18) + 'Novo jogo</button>' : '') + '</div>' +
      (vazio ? '<div class="empty"><span class="empty-ico">' + ico('whistle', 40) + '</span><h3>Nenhuma partida para conduzir</h3><p>' + (master ? 'Crie um jogo para começar.' : 'Peça ao organizador para cadastrar as partidas do turno.') + '</p></div>' : '') +
      grupo('Em andamento', andamento) + grupo('Hoje', hojeProx) + grupo('Próximas partidas', outros, true) + grupo('Encerradas hoje', fimHoje);
  }

  function pillStatus(j) {
    if (j.status === 'AO VIVO') return '<span class="pill pill-live"><i></i>Ao vivo</span>';
    if (j.status === 'PAUSADO') return '<span class="pill pill-pause">' + esc(labelPausa(j).titulo.charAt(0) + labelPausa(j).titulo.slice(1).toLowerCase()) + '</span>';
    if (j.status === 'FINALIZADO') return '<span class="pill pill-end">Encerrado</span>';
    return '<span class="pill">Em breve</span>';
  }
  function cartaoJogo(j, comData) {
    var r = resultado(j), d = j.data.split('-');
    return '<button type="button" class="pick-card" data-act="abrir" data-id="' + esc(j.id) + '" style="--c:' + JESUI.corModalidade(j) + '">' +
      '<span class="pc-top"><span class="sport-chip">' + esc(j.modalidade) + ' ' + JESUI.generoCurto(j.genero) + '</span>' + pillStatus(j) + '</span>' +
      '<span class="pc-teams"><span>' + JESUI.brasao(j.timeA, 'crest-sm') + '<b>' + esc(j.timeA) + '</b></span><em>' + (j.status === 'EM BREVE' ? 'vs' : r.a + ' × ' + r.b) + '</em><span><b>' + esc(j.timeB) + '</b>' + JESUI.brasao(j.timeB, 'crest-sm') + '</span></span>' +
      '<span class="pc-meta">' + ico('clock', 14) + (comData ? d[2] + '/' + d[1] + ' · ' : '') + esc(j.horario) + '<i></i>' + esc(j.local || 'Local a definir') + '</span></button>';
  }

  function consoleJogo(j) {
    var k = sportKind(j.modalidade), fim = j.status === 'FINALIZADO', rodando = j.status === 'AO VIVO';
    var bloqueado = fim || j.pausaMotivo === 'fim_set' || j.pausaMotivo === 'fim_periodo';
    var res = resultado(j);
    var centro;
    if (fim) {
      centro = '<div class="cs-done">' + ico('trophy', 30) + '<b>Partida encerrada</b><span>' + res.a + ' × ' + res.b + (res.unidade === 'sets' ? ' em sets' : '') + '</span>' +
        (master ? '<button type="button" class="btn btn-ghost btn-sm" data-act="reabrir">Reabrir partida</button>' : '') + '</div>';
    } else {
      centro = '<div class="cs-clock-wrap"><span id="cs-clock" class="cs-clock' + (rodando ? ' running' : '') + '">' + formatarTempoJogo(getTempoJogo(j)) + '</span>' + pillStatus(j) +
        (j.status === 'PAUSADO' ? '<span class="cs-reason">' + esc(labelPausa(j).sub) + '</span>' : '') + '</div>' +
        (rodando
          ? '<button type="button" class="btn btn-dark btn-xl" data-act="pausar">' + ico('pause', 22) + 'Pausar / encerrar período</button>'
          : '<button type="button" class="btn btn-primary btn-xl" data-act="retomar">' + ico('play', 22) + esc(labelRetomar(j)) + '</button>') +
        (j.status !== 'EM BREVE' ? '<button type="button" class="btn btn-danger-ghost" data-act="finalizar">' + ico('flag', 18) + 'Finalizar jogo</button>' : '');
    }
    var parciais = k === 'volei' && j.parciais.length ? '<div class="cs-parciais">' + j.parciais.map(function (p, i) {
      return '<span class="parcial ' + (p.a > p.b ? 'wa' : 'wb') + '"><small>Set ' + (i + 1) + '</small>' + p.a + ' – ' + p.b + '</span>';
    }).join('') + '</div>' : '';

    var eventos = j.eventos.slice().reverse().slice(0, 14);
    return '<section class="console" data-kind="' + k + '" data-status="' + esc(j.status) + '" style="--c:' + JESUI.corModalidade(j) + '">' +
      '<div class="cs-top"><button type="button" class="btn btn-ghost btn-sm" data-act="voltar">' + ico('back', 18) + 'Partidas</button>' +
      '<div class="cs-title"><span class="sport-chip">' + esc(j.modalidade) + ' ' + JESUI.generoCurto(j.genero) + '</span>' + (fim ? '' : '<span class="period-chip">' + esc(labelPeriodo(j)) + '</span>') + '</div>' +
      '<button type="button" class="icon-btn" data-act="maisOpcoes" aria-label="Mais opções">' + ico('more', 20) + '</button></div>' +
      '<div class="cs-grid">' + painelTime(j, 'A', bloqueado) + '<div class="cs-center">' + centro + parciais + '</div>' + painelTime(j, 'B', bloqueado) + '</div>' +
      (bloqueado && !fim ? '<p class="cs-hint">' + ico('info', 16) + 'Período encerrado. Use “' + esc(labelRetomar(j)) + '” para continuar marcando.</p>' : '') +
      '<div class="cs-feed"><div class="cs-feed-head"><h3>Lances</h3>' + (fim ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-act="outroLance">' + ico('plus', 16) + 'Cartão, substituição…</button>') + '</div>' +
      (eventos.length ? '<ul>' + eventos.map(function (ev) {
        var nome = ev.time === 'A' ? j.timeA : ev.time === 'B' ? j.timeB : '';
        var ic = ev.tipo === 'gol' || ev.tipo === 'ponto' ? 'ball' : ev.tipo === 'cartao' ? 'card' : ev.tipo === 'substituicao' ? 'swap' : ev.tipo === 'tempo' ? 'clock' : 'info';
        var pts = (ev.tipo === 'gol' || ev.tipo === 'ponto') && k === 'basquete' ? '<b class="feed-pts pts-' + ev.valor + '">+' + ev.valor + '</b>' : '';
        return '<li class="side-' + (ev.time || 'x') + '"><span class="feed-min">' + esc(ev.minuto || '—') + '</span><span class="feed-ico">' + ico(ic, 17) + '</span><span class="feed-txt">' + esc(ev.descricao) + (nome ? '<small>' + esc(nome) + '</small>' : '') + '</span>' + pts +
          (fim ? '' : '<button type="button" class="icon-btn sm" data-act="removerLance" data-ev="' + esc(ev.id) + '" aria-label="Remover lance" title="Remover lance">' + ico('x', 16) + '</button>') + '</li>';
      }).join('') + '</ul>' : '<p class="muted pad">Nenhum lance ainda. Marque o primeiro ponto!</p>') + '</div></section>';
  }

  function painelTime(j, lado, bloqueado) {
    var nome = lado === 'A' ? j.timeA : j.timeB, k = sportKind(j.modalidade), fim = j.status === 'FINALIZADO';
    var pontos = lado === 'A' ? j.placarA : j.placarB;
    var sets = lado === 'A' ? j.setsA : j.setsB;
    var botoes;
    var off = bloqueado ? ' disabled' : '';
    if (k === 'basquete') {
      botoes = '<div class="sc-btns three"><button type="button" class="sc sc-1" data-act="pt" data-time="' + lado + '" data-v="1"' + off + '><b>+1</b><span>Lance livre</span></button>' +
        '<button type="button" class="sc sc-2" data-act="pt" data-time="' + lado + '" data-v="2"' + off + '><b>+2</b><span>Cesta</span></button>' +
        '<button type="button" class="sc sc-3" data-act="pt" data-time="' + lado + '" data-v="3"' + off + '><b>+3</b><span>Três pontos</span></button></div>';
    } else {
      var rot = k === 'futsal' || k === 'handebol' ? 'Gol' : 'Ponto';
      botoes = '<div class="sc-btns one"><button type="button" class="sc sc-big" data-act="pt" data-time="' + lado + '" data-v="1"' + off + '><b>+1</b><span>' + rot + '</span></button></div>';
    }
    return '<div class="team-panel tp-' + lado + '"><div class="tp-id">' + JESUI.brasao(nome, 'crest-lg') + '<b>' + esc(nome) + '</b></div>' +
      (k === 'volei' ? '<div class="tp-sets"><span>Sets</span><div class="sets-pips">' + pipsHtml(sets) + '</div><b>' + sets + '</b></div>' : '') +
      '<div class="tp-score"><span class="num">' + String(pontos).padStart(2, '0') + '</span><small>' + (k === 'volei' ? 'pontos no set' : 'pontos') + '</small></div>' +
      (fim ? '' : botoes + '<button type="button" class="undo" data-act="desfazer" data-time="' + lado + '">' + ico('back', 15) + 'Desfazer último ponto</button>') + '</div>';
  }
  function pipsHtml(n) { var s = ''; for (var i = 0; i < REGRAS_VOLEI.setsParaVencer; i++) s += '<span class="pip' + (i < n ? ' on' : '') + '"></span>'; return s; }

  function descPonto(j, time, v) {
    var k = sportKind(j.modalidade), nome = time === 'A' ? j.timeA : j.timeB;
    if (k === 'basquete') return (v === 3 ? 'Cesta de 3 pontos' : v === 2 ? 'Cesta de 2 pontos' : 'Lance livre') + ' — ' + nome;
    if (k === 'futsal' || k === 'handebol') return 'Gol de ' + nome;
    return 'Ponto para ' + nome;
  }

  /* ações da mesa */
  A.view = function (el) { S.view = el.dataset.v; S.detalhe = null; renderView(); };
  A.sair = function () { clearSession(); location.href = 'home.html'; };
  A.abrir = function (el) { S.jogoId = el.dataset.id; renderView(); window.scrollTo({ top: 0 }); };
  A.voltar = function () { S.jogoId = null; renderView(); };
  A.reabrir = function () {
    var j = cur(); if (!j) return;
    JESUI.safe(function () { return alterarStatusJogo(j.id, 'PAUSADO', 'pausa'); }).then(function () { JESUI.toast({ tone: 'ok', title: 'Partida reaberta', text: 'Retome o jogo quando estiver pronto.' }); });
  };

  A.pt = function (el) {
    var j = cur(); if (!j || antiToque()) return;
    var time = el.dataset.time, v = parseInt(el.dataset.v, 10) || 1, k = sportKind(j.modalidade);
    var tipo = k === 'futsal' || k === 'handebol' ? 'gol' : 'ponto';
    var desc = descPonto(j, time, v), nome = time === 'A' ? j.timeA : j.timeB;
    if (navigator.vibrate) navigator.vibrate(18);
    JESUI.safe(function () { return adicionarEvento(j.id, tipo, time, desc, minutoAtual(j), v); }, 'Não foi possível registrar o ponto').then(function (ev) {
      if (!ev) return;
      JESUI.toast({ tone: 'ok', icon: 'ball', title: (k === 'basquete' ? '+' + v + ' · ' : '') + desc, text: nome + ' · ' + ev.minuto, ms: 5000, key: 'placar',
        action: { label: 'Desfazer', fn: function () { JESUI.safe(function () { return removerEvento(j.id, ev.id); }); } } });
    });
  };
  A.desfazer = function (el) {
    var j = cur(); if (!j || antiToque()) return;
    JESUI.safe(function () { return desfazerUltimoPonto(j.id, el.dataset.time); }).then(function (r) {
      if (!r) JESUI.toast({ tone: 'info', title: 'Nada para desfazer', text: 'Esta equipe ainda não tem pontos registrados.' });
    });
  };
  A.removerLance = function (el) {
    var j = cur(); if (!j) return;
    JESUI.safe(function () { return removerEvento(j.id, el.dataset.ev); });
  };

  A.retomar = function (el) {
    var j = cur(); if (!j || antiToque()) return;
    JESUI.busy(el, JESUI.safe(function () { return iniciarTemporizadorJogo(j.id); }));
  };
  A.pausar = function () {
    var j = cur(); if (!j) return;
    var k = sportKind(j.modalidade), op = [];
    if (k === 'basquete') op.push(['fim_periodo', j.periodo === 2 ? 'Intervalo' : j.periodo > 4 ? 'Fim da prorrogação' : 'Fim do ' + j.periodo + 'º quarto', j.periodo === 2 ? 'Fim do 2º quarto' : 'Encerra o período e para o relógio']);
    else if (k === 'futsal' || k === 'handebol') op.push(['fim_periodo', j.periodo === 1 ? 'Intervalo' : 'Fim do tempo regulamentar', j.periodo === 1 ? 'Fim do 1º tempo' : 'Encerra o período']);
    op.push(['pausa', 'Pausa / tempo técnico', 'Apenas para o relógio']);
    var m = openModal({ title: 'O que aconteceu?', small: true, body: '<div class="sheet">' + op.map(function (o) {
      return '<button type="button" class="sheet-btn" data-act="confirmaPausa" data-m="' + o[0] + '">' + ico(o[0] === 'pausa' ? 'pause' : 'whistle', 24) + '<span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></button>';
    }).join('') + '</div>' });
  };
  A.confirmaPausa = function (el) {
    var j = cur(); if (!j) return;
    closeModal();
    JESUI.safe(function () { return pausarTemporizadorJogo(j.id, el.dataset.m); });
  };
  A.finalizar = function () {
    var j = cur(); if (!j) return;
    var r = resultado(j);
    var aviso = r.a === r.b ? '<p class="warn-line">' + ico('alert', 16) + 'O resultado está empatado.</p>' : '';
    confirmar({ title: 'Finalizar partida?', okLabel: 'Finalizar jogo',
      text: '<div class="confirm-score"><span>' + esc(j.timeA) + '</span><b>' + r.a + ' × ' + r.b + '</b><span>' + esc(j.timeB) + '</span></div>' + aviso + '<p class="muted">O cronômetro será encerrado e o resultado aparece para todos como “Fim de jogo”.</p>',
      onOk: function () { return finalizarTemporizadorJogo(j.id).then(function () { S.jogoId = null; JESUI.toast({ tone: 'ok', icon: 'trophy', title: 'Partida finalizada', text: j.timeA + ' ' + r.a + ' × ' + r.b + ' ' + j.timeB }); renderView(); }); } });
  };

  A.outroLance = function () {
    var j = cur(); if (!j) return;
    formModal({ title: 'Registrar lance', okLabel: 'Registrar',
      body: field('Tipo', 'tipo', 'select', [['cartao_a', 'Cartão amarelo'], ['cartao_v', 'Cartão vermelho'], ['substituicao', 'Substituição'], ['tempo', 'Tempo técnico'], ['info', 'Informação']]) +
        field('Equipe', 'time', 'select', [['A', j.timeA], ['B', j.timeB]]) +
        field('Jogador ou detalhe (opcional)', 'detalhe', 'text', '', 'placeholder="Ex.: camisa 10"'),
      onSubmit: function (f) {
        var tipo = f.tipo.value, time = f.time.value, nome = time === 'A' ? j.timeA : j.timeB, det = f.detalhe.value.trim();
        var base = { cartao_a: 'Cartão amarelo', cartao_v: 'Cartão vermelho', substituicao: 'Substituição', tempo: 'Tempo técnico', info: 'Informação' }[tipo];
        var desc = base + ' — ' + nome + (det ? ' (' + det + ')' : '');
        return adicionarEvento(j.id, tipo.indexOf('cartao') === 0 ? 'cartao' : tipo, time, desc, minutoAtual(j), 0).then(function () { JESUI.toast({ tone: 'ok', title: 'Lance registrado', text: desc }); });
      } });
  };

  A.maisOpcoes = function () {
    var j = cur(); if (!j) return;
    openModal({ title: 'Mais opções', small: true, body: '<div class="sheet">' +
      (master ? '<button type="button" class="sheet-btn" data-act="editarJogoAtual">' + ico('edit', 24) + '<span><b>Editar dados do jogo</b><small>Horário, local, equipes, situação</small></span></button>' : '') +
      '<button type="button" class="sheet-btn danger" data-act="zerarJogo">' + ico('trash', 24) + '<span><b>Zerar placar e lances</b><small>Apaga todo o lance a lance desta partida</small></span></button></div>' });
  };
  A.editarJogoAtual = function () { closeModal(); var j = cur(); if (j) A.editarJogo({ dataset: { id: j.id } }); };
  A.zerarJogo = function () {
    var j = cur(); if (!j) return; closeModal();
    confirmar({ title: 'Zerar a partida?', okLabel: 'Zerar tudo', danger: true, text: '<p>O placar volta a 0 × 0 e todos os lances de <b>' + esc(j.timeA) + ' × ' + esc(j.timeB) + '</b> serão apagados. Isso não pode ser desfeito.</p>',
      onOk: function () { return limparEventos(j.id).then(function () { JESUI.toast({ tone: 'ok', title: 'Partida zerada' }); }); } });
  };

  /* =====================================================
     AGENDA
     ===================================================== */
  function viewAgenda() {
    var hoje = hojeLocal();
    var esportes = []; getModalidades().forEach(function (m) { if (esportes.indexOf(m.nome) < 0) esportes.push(m.nome); });
    var jogos = getJogos().filter(function (j) {
      if (S.fData === 'today' && j.data !== hoje) return false;
      if (S.fEsporte !== 'all' && j.modalidade !== S.fEsporte) return false;
      if (S.fStatus !== 'all' && j.status !== S.fStatus) return false;
      return true;
    }).sort(function (a, b) { return (a.data + a.horario).localeCompare(b.data + b.horario); });

    var grupos = {}; jogos.forEach(function (j) { (grupos[j.data] = grupos[j.data] || []).push(j); });
    var opt = function (v, t, atual) { return '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(t) + '</option>'; };

    return '<div class="ad-head"><div><h1>Agenda</h1><p class="muted">' + getJogos().length + ' jogos neste turno.</p></div>' +
      (master ? '<button type="button" class="btn btn-primary" data-act="novoJogo">' + ico('plus', 18) + 'Novo jogo</button>' : '') + '</div>' +
      '<div class="ad-filters"><select data-filter="fData" aria-label="Dia">' + opt('all', 'Todos os dias', S.fData) + opt('today', 'Só hoje', S.fData) + '</select>' +
      '<select data-filter="fEsporte" aria-label="Modalidade">' + opt('all', 'Todas as modalidades', S.fEsporte) + esportes.map(function (n) { return opt(n, n, S.fEsporte); }).join('') + '</select>' +
      '<select data-filter="fStatus" aria-label="Situação">' + opt('all', 'Todas as situações', S.fStatus) + opt('AO VIVO', 'Ao vivo', S.fStatus) + opt('PAUSADO', 'Pausado', S.fStatus) + opt('EM BREVE', 'Em breve', S.fStatus) + opt('FINALIZADO', 'Encerrado', S.fStatus) + '</select></div>' +
      (!jogos.length ? '<div class="empty"><span class="empty-ico">' + ico('cal', 40) + '</span><h3>Nenhum jogo encontrado</h3><p>Ajuste os filtros' + (master ? ' ou crie um novo jogo.' : '.') + '</p></div>' :
        Object.keys(grupos).sort().map(function (d) {
          var p = d.split('-');
          return '<section class="ag-day"><h3>' + p[2] + '/' + p[1] + (d === hoje ? '<em class="today-tag">Hoje</em>' : '') + '</h3>' + grupos[d].map(linhaAgenda).join('') + '</section>';
        }).join(''));
  }
  function linhaAgenda(j) {
    var r = resultado(j), ini = j.status !== 'EM BREVE';
    return '<div class="ag-row" style="--c:' + JESUI.corModalidade(j) + '"><span class="ag-time">' + esc(j.horario) + '</span>' +
      '<div class="ag-main"><span class="sport-chip">' + esc(j.modalidade) + ' ' + JESUI.generoCurto(j.genero) + '</span><b>' + esc(j.timeA) + ' <em>×</em> ' + esc(j.timeB) + '</b><small>' + esc(j.local || 'Local a definir') + '</small></div>' +
      '<span class="ag-score">' + (ini ? r.a + ' × ' + r.b : '—') + '</span>' + pillStatus(j) +
      '<div class="ag-actions">' + (j.status !== 'FINALIZADO' ? '<button type="button" class="btn btn-sm btn-primary" data-act="controlar" data-id="' + esc(j.id) + '">Controlar</button>' : '') +
      (master ? '<button type="button" class="icon-btn sm" data-act="editarJogo" data-id="' + esc(j.id) + '" aria-label="Editar jogo" title="Editar">' + ico('edit', 18) + '</button>' +
        '<button type="button" class="icon-btn sm danger" data-act="apagarJogo" data-id="' + esc(j.id) + '" aria-label="Apagar jogo" title="Apagar">' + ico('trash', 18) + '</button>' : '') + '</div></div>';
  }
  A.controlar = function (el) { S.jogoId = el.dataset.id; S.view = 'mesa'; renderView(); window.scrollTo({ top: 0 }); };

  A.novoJogo = function () { formJogo(null); };
  A.editarJogo = function (el) { var j = getJogoById(el.dataset.id); if (j) formJogo(j); };
  A.apagarJogo = function (el) {
    var j = getJogoById(el.dataset.id); if (!j) return;
    confirmar({ title: 'Apagar jogo?', okLabel: 'Apagar', danger: true, text: '<p><b>' + esc(j.timeA) + ' × ' + esc(j.timeB) + '</b> (' + esc(j.modalidade) + ', ' + esc(j.horario) + ') e todos os seus lances serão removidos.</p>',
      onOk: function () { return apagarJogo(j.id).then(function () { if (S.jogoId === j.id) S.jogoId = null; JESUI.toast({ tone: 'ok', title: 'Jogo apagado' }); }); } });
  };

  function formJogo(j) {
    var mods = getModalidades(), eqs = getEquipes().slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    if (!mods.length || eqs.length < 2) { JESUI.toast({ tone: 'warn', title: 'Cadastre antes', text: 'É preciso ter ao menos uma modalidade e duas equipes neste turno.', ms: 6000 }); return; }
    var modAtual = j ? (mods.find(function (m) { return m.nome === j.modalidade && m.genero === j.genero; }) || mods[0]) : mods[0];
    var volei = j && sportKind(j.modalidade) === 'volei';
    formModal({ title: j ? 'Editar jogo' : 'Novo jogo', okLabel: j ? 'Salvar alterações' : 'Criar jogo', wide: true,
      body: field('Modalidade', 'mod', 'select', mods.map(function (m) { return [m.id, m.nome + ' · ' + JESUI.generoCurto(m.genero)]; }), modAtual.id) +
        '<div class="row2">' + field('Data', 'data', 'date', j ? j.data : hojeLocal(), 'required') + field('Horário', 'horario', 'time', j ? j.horario : '', 'required') + '</div>' +
        field('Local', 'local', 'text', j ? j.local : '', 'placeholder="Ex.: Ginásio Central"') +
        '<div class="row2">' + field('Equipe 1', 'a', 'select', eqs.map(function (e) { return [e.nome, e.nome]; }), j ? j.timeA : eqs[0].nome) + field('Equipe 2', 'b', 'select', eqs.map(function (e) { return [e.nome, e.nome]; }), j ? j.timeB : eqs[1].nome) + '</div>' +
        (j ? field('Situação', 'status', 'select', [['EM BREVE', 'Em breve'], ['AO VIVO', 'Ao vivo'], ['PAUSADO', 'Pausado'], ['FINALIZADO', 'Encerrado']], j.status) +
          (volei ? '<div class="row2">' + field('Sets — ' + j.timeA, 'sa', 'number', j.setsA, 'min="0"') + field('Sets — ' + j.timeB, 'sb', 'number', j.setsB, 'min="0"') + '</div>'
            : '<div class="row2">' + field('Placar — ' + j.timeA, 'pa', 'number', j.placarA, 'min="0"') + field('Placar — ' + j.timeB, 'pb', 'number', j.placarB, 'min="0"') + '</div>') +
          '<p class="hint">Prefira marcar pontos pela mesa de jogo: assim o lance a lance fica correto. Use estes campos só para corrigir.</p>' : ''),
      onSubmit: function (f) {
        var m = mods.find(function (x) { return String(x.id) === f.mod.value; });
        if (f.a.value === f.b.value) { JESUI.toast({ tone: 'warn', title: 'Escolha equipes diferentes' }); return false; }
        var d = { modalidade: m.nome, genero: m.genero, modalidadeId: m.id, data: f.data.value, horario: f.horario.value, local: f.local.value.trim(), timeA: f.a.value, timeB: f.b.value };
        if (!j) { d.status = 'EM BREVE'; return criarJogo(d).then(function () { JESUI.toast({ tone: 'ok', title: 'Jogo criado' }); }); }
        d.status = f.status.value;
        if (volei) { d.setsA = f.sa.value; d.setsB = f.sb.value; d.placarA = j.placarA; d.placarB = j.placarB; }
        else { d.placarA = f.pa.value; d.placarB = f.pb.value; }
        return atualizarJogo(j.id, d).then(function () { JESUI.toast({ tone: 'ok', title: 'Jogo atualizado' }); });
      } });
  }

  /* =====================================================
     CLASSIFICAÇÃO
     ===================================================== */
  function viewRank() {
    var rows = getClassificacao();
    return '<div class="ad-head"><div><h1>Classificação</h1><p class="muted">Soma dos pontos lançados para cada equipe do turno.</p></div>' +
      '<button type="button" class="btn btn-primary" data-act="lancarPontos">' + ico('plus', 18) + 'Lançar pontos</button></div>' +
      (!rows.length ? '<div class="empty"><span class="empty-ico">' + ico('rank', 40) + '</span><h3>Nenhuma equipe neste turno</h3><p>Cadastre equipes em Cadastros.</p></div>' :
        '<div class="rank-admin">' + rows.map(function (r) {
          var aberto = S.detalhe === r.unidade;
          var pts = aberto ? getPontosPorEquipe(r.unidade) : [];
          return '<div class="ra-item' + (aberto ? ' open' : '') + '"><div class="ra-row"><span class="ra-pos">' + r.posicao + '</span>' + JESUI.brasao(r.unidade, 'crest-sm') + '<b>' + esc(r.unidade) + '</b><strong>' + r.pontos + '<small>pts</small></strong>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="detalhe" data-n="' + esc(r.unidade) + '">' + (aberto ? 'Fechar' : 'Ver lançamentos') + '</button></div>' +
            (aberto ? '<div class="ra-detail">' + (pts.length ? pts.map(function (p) {
              var jg = p.jogoId ? getJogoById(p.jogoId) : null;
              return '<div class="ra-line"><b>+' + p.pontos + '</b><span>' + esc(p.descricao || 'Sem descrição') + (jg ? '<small>' + esc(jg.modalidade + ' · ' + jg.timeA + ' × ' + jg.timeB) + '</small>' : '<small>Lançamento manual</small>') + '</span>' +
                '<button type="button" class="icon-btn sm danger" data-act="removerPonto" data-id="' + esc(p.id) + '" aria-label="Remover lançamento">' + ico('trash', 17) + '</button></div>';
            }).join('') : '<p class="muted pad">Nenhum ponto lançado ainda.</p>') + '</div>' : '') + '</div>';
        }).join('') + '</div>');
  }
  A.detalhe = function (el) { S.detalhe = S.detalhe === el.dataset.n ? null : el.dataset.n; renderView(); };
  A.removerPonto = function (el) {
    confirmar({ title: 'Remover lançamento?', okLabel: 'Remover', danger: true, text: '<p>Os pontos deste lançamento deixam de contar na classificação.</p>', onOk: function () { return removerPonto(el.dataset.id); } });
  };
  A.lancarPontos = function () {
    var eqs = getEquipes();
    if (!eqs.length) { JESUI.toast({ tone: 'warn', title: 'Sem equipes neste turno' }); return; }
    var m = formModal({ title: 'Lançar pontos', okLabel: 'Lançar',
      body: field('Equipe', 'eq', 'select', eqs.map(function (e) { return [e.nome, e.nome]; })) +
        '<label class="field"><span>Jogo de origem</span><select name="jogo" id="pt-jogo"></select></label>' +
        '<div class="row2">' + field('Pontos', 'pts', 'number', 3, 'min="1" required') + field('Descrição', 'desc', 'text', 'Vitória', '') + '</div>',
      onSubmit: function (f) { return adicionarPonto(f.eq.value, f.jogo.value, f.pts.value, f.desc.value.trim()).then(function () { JESUI.toast({ tone: 'ok', title: 'Pontos lançados', text: '+' + f.pts.value + ' para ' + f.eq.value }); }); } });
    function atualizarJogos() {
      var nome = m.querySelector('[name=eq]').value;
      var jogos = getJogos().filter(function (j) { return j.status === 'FINALIZADO' && (j.timeA === nome || j.timeB === nome); }).sort(function (a, b) { return (b.data + b.horario).localeCompare(a.data + a.horario); });
      m.querySelector('#pt-jogo').innerHTML = '<option value="">Lançamento manual</option>' + jogos.map(function (j) { var r = resultado(j); return '<option value="' + esc(j.id) + '">' + esc(j.modalidade + ' · ' + j.timeA + ' ' + r.a + '×' + r.b + ' ' + j.timeB) + '</option>'; }).join('');
    }
    m.querySelector('[name=eq]').addEventListener('change', atualizarJogos); atualizarJogos();
  };

  /* =====================================================
     CADASTROS (equipes · modalidades · usuários)
     ===================================================== */
  function viewCad() {
    var abas = [['equipes', 'Equipes'], ['modalidades', 'Modalidades'], ['usuarios', 'Usuários']];
    var t = getCategoria();
    var corpo = S.cad === 'modalidades' ? cadModalidades() : S.cad === 'usuarios' ? cadUsuarios() : cadEquipes();
    return '<div class="ad-head"><div><h1>Cadastros</h1><p class="muted">Turno da ' + TURNOS[t].nome.toLowerCase() + ' · ' + TURNOS[t].series + '.</p></div></div>' +
      '<div class="seg" role="tablist">' + abas.map(function (a) { return '<button type="button" role="tab" data-act="cad" data-v="' + a[0] + '" class="' + (S.cad === a[0] ? 'active' : '') + '">' + a[1] + '</button>'; }).join('') + '</div>' + corpo;
  }
  A.cad = function (el) { S.cad = el.dataset.v; renderView(); };

  function cadEquipes() {
    var eqs = getEquipes().slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    return '<div class="sub-head"><h2>Equipes <small>' + eqs.length + '</small></h2><button type="button" class="btn btn-primary btn-sm" data-act="novaEquipe">' + ico('plus', 16) + 'Nova equipe</button></div>' +
      (eqs.length ? '<div class="team-grid">' + eqs.map(function (e) {
        return '<div class="team-card">' + JESUI.brasao(e.nome, 'crest-lg') + '<div><b>' + esc(e.nome) + '</b><small>' + esc(e.turma || '') + '</small></div>' +
          '<div class="tc-actions"><button type="button" class="icon-btn sm" data-act="editarEquipe" data-id="' + esc(e.id) + '" aria-label="Editar">' + ico('edit', 18) + '</button><button type="button" class="icon-btn sm danger" data-act="apagarEquipe" data-id="' + esc(e.id) + '" aria-label="Apagar">' + ico('trash', 18) + '</button></div></div>';
      }).join('') + '</div>' : '<div class="empty"><span class="empty-ico">' + ico('users', 40) + '</span><h3>Nenhuma equipe neste turno</h3><p>Cadastre as turmas que vão competir.</p></div>');
  }
  A.novaEquipe = function () { formEquipe(null); };
  A.editarEquipe = function (el) { formEquipe(getEquipes().find(function (e) { return String(e.id) === el.dataset.id; })); };
  A.apagarEquipe = function (el) {
    var e = getEquipes().find(function (x) { return String(x.id) === el.dataset.id; }); if (!e) return;
    confirmar({ title: 'Apagar equipe?', okLabel: 'Apagar', danger: true, text: '<p><b>' + esc(e.nome) + '</b> será removida. Jogos já cadastrados continuam mostrando o nome.</p>', onOk: function () { return apagarEquipe(String(e.id)); } });
  };
  function formEquipe(e) {
    brasaoTmp = e ? e.brasao || '' : '';
    var t = TURNOS[getCategoria()];
    var m = formModal({ title: e ? 'Editar equipe' : 'Nova equipe', okLabel: e ? 'Salvar' : 'Cadastrar',
      body: '<div class="field"><span>Brasão</span><div class="crest-up"><div class="crest-prev" id="crest-prev"></div><div><label class="btn btn-ghost btn-sm" for="crest-file">Escolher imagem</label><input type="file" id="crest-file" accept="image/*" hidden><button type="button" class="btn btn-ghost btn-sm" id="crest-del" hidden>Remover</button><small class="hint">PNG ou JPG, até 2 MB.</small></div></div></div>' +
        field('Nome da equipe', 'nome', 'text', e ? e.nome : '', 'required placeholder="Ex.: 8º Ano A"') + field('Turma / série', 'turma', 'text', e ? e.turma : '', 'required placeholder="Ex.: Ensino Fundamental"') +
        '<p class="hint">' + ico('info', 14) + ' Será cadastrada no turno da ' + t.nome.toLowerCase() + ' (' + t.series + ').</p>',
      onSubmit: function (f) {
        var nome = f.nome.value.trim(), turma = f.turma.value.trim();
        if (!nome || !turma) { JESUI.toast({ tone: 'warn', title: 'Preencha nome e turma' }); return false; }
        return (e ? atualizarEquipe(String(e.id), { nome: nome, turma: turma, brasao: brasaoTmp }) : criarEquipe(nome, turma, brasaoTmp)).then(function () { JESUI.toast({ tone: 'ok', title: e ? 'Equipe atualizada' : 'Equipe cadastrada' }); });
      } });
    var prev = m.querySelector('#crest-prev'), del = m.querySelector('#crest-del');
    function pintar() { prev.innerHTML = brasaoTmp ? '<img src="' + esc(brasaoTmp) + '" alt="">' : ico('shield', 30); del.hidden = !brasaoTmp; }
    pintar();
    del.addEventListener('click', function () { brasaoTmp = ''; pintar(); });
    m.querySelector('#crest-file').addEventListener('change', function () {
      var file = this.files[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { JESUI.toast({ tone: 'warn', title: 'Imagem muito grande', text: 'Use um arquivo de até 2 MB.' }); return; }
      var rd = new FileReader();
      rd.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas'), s = Math.min(200 / img.width, 200 / img.height, 1);
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          brasaoTmp = c.toDataURL(/png|webp|svg/.test(file.type) ? 'image/png' : 'image/jpeg', 0.88); pintar();
        };
        img.src = ev.target.result;
      };
      rd.readAsDataURL(file);
    });
  }

  function cadModalidades() {
    var mods = getModalidades(), regs = getRegulamentos();
    return '<div class="sub-head"><h2>Modalidades <small>' + mods.length + '</small></h2><button type="button" class="btn btn-primary btn-sm" data-act="novaModalidade">' + ico('plus', 16) + 'Nova modalidade</button></div>' +
      (mods.length ? '<div class="list-rows">' + mods.map(function (m) {
        var tem = regs[m.nome];
        return '<div class="lr" style="--c:' + esc(m.cor) + '"><i class="dot"></i><div class="lr-main"><b>' + esc(m.nome) + '</b><small>' + JESUI.generoCurto(m.genero) + '</small></div>' +
          '<span class="pill ' + (tem ? 'pill-ok' : '') + '">' + (tem ? 'Regulamento ok' : 'Sem regulamento') + '</span>' +
          '<div class="lr-actions"><button type="button" class="btn btn-ghost btn-sm" data-act="regulamento" data-n="' + esc(m.nome) + '">' + ico('book', 16) + 'Regulamento</button>' +
          '<button type="button" class="icon-btn sm" data-act="editarModalidade" data-id="' + esc(m.id) + '" aria-label="Editar">' + ico('edit', 18) + '</button>' +
          '<button type="button" class="icon-btn sm danger" data-act="apagarModalidade" data-id="' + esc(m.id) + '" aria-label="Apagar">' + ico('trash', 18) + '</button></div></div>';
      }).join('') + '</div>' : '<div class="empty"><span class="empty-ico">' + ico('target', 40) + '</span><h3>Nenhuma modalidade neste turno</h3><p>Cadastre futsal, basquete, vôlei e as demais.</p></div>');
  }
  A.novaModalidade = function () { formModalidade(null); };
  A.editarModalidade = function (el) { formModalidade(getModalidades().find(function (m) { return String(m.id) === el.dataset.id; })); };
  A.apagarModalidade = function (el) {
    var m = getModalidades().find(function (x) { return String(x.id) === el.dataset.id; }); if (!m) return;
    confirmar({ title: 'Apagar modalidade?', okLabel: 'Apagar', danger: true, text: '<p><b>' + esc(m.nome) + ' · ' + JESUI.generoCurto(m.genero) + '</b> será removida.</p>',
      onOk: function () { return apagarModalidade(String(m.id)).then(function (ok) { if (!ok) JESUI.toast({ tone: 'warn', title: 'Não foi possível apagar', text: 'Já existem jogos cadastrados nesta modalidade.', ms: 6000 }); }); } });
  };
  function formModalidade(m) {
    formModal({ title: m ? 'Editar modalidade' : 'Nova modalidade', okLabel: m ? 'Salvar' : 'Cadastrar',
      body: field('Nome', 'nome', 'text', m ? m.nome : '', 'required placeholder="Ex.: Futsal"') + field('Gênero', 'genero', 'select', [['MASCULINO', 'Masculino'], ['FEMININO', 'Feminino'], ['MISTO', 'Misto']], m ? m.genero : 'MASCULINO') +
        field('Cor de identificação', 'cor', 'color', m ? m.cor : '#E10600'),
      onSubmit: function (f) {
        var d = { nome: f.nome.value.trim(), genero: f.genero.value, cor: f.cor.value };
        if (!d.nome) { JESUI.toast({ tone: 'warn', title: 'Informe o nome' }); return false; }
        return (m ? atualizarModalidade(String(m.id), d) : criarModalidade(d)).then(function () { JESUI.toast({ tone: 'ok', title: m ? 'Modalidade atualizada' : 'Modalidade criada' }); });
      } });
  }

  A.regulamento = function (el) {
    var nome = el.dataset.n, reg = getRegulamentos()[nome] || { visaoGeral: '', regras: [] };
    var icones = [['clock', 'Relógio'], ['users', 'Equipe'], ['triangle', 'Atenção'], ['shirt', 'Uniforme'], ['target', 'Alvo'], ['shield', 'Escudo'], ['info', 'Info']];
    function linha(r) {
      r = r || {};
      return '<div class="regra"><select class="r-ic" aria-label="Ícone">' + icones.map(function (i) { return '<option value="' + i[0] + '"' + (r.icone === i[0] ? ' selected' : '') + '>' + i[1] + '</option>'; }).join('') + '</select>' +
        '<input class="r-ti" type="text" placeholder="Título" value="' + esc(r.titulo || '') + '"><input class="r-de" type="text" placeholder="Descrição" value="' + esc(r.descricao || '') + '">' +
        '<button type="button" class="icon-btn sm danger" data-act="rmRegra" aria-label="Remover regra">' + ico('x', 16) + '</button></div>';
    }
    var m = formModal({ title: 'Regulamento — ' + nome, okLabel: 'Salvar regulamento', wide: true,
      body: '<label class="field"><span>Visão geral</span><textarea name="visao" rows="3">' + esc(reg.visaoGeral || '') + '</textarea></label><div class="field"><span>Regras</span><div id="regras">' + (reg.regras.length ? reg.regras : [{}]).map(linha).join('') + '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="add-regra">' + ico('plus', 16) + 'Adicionar regra</button></div>',
      onSubmit: function (f) {
        var regras = [].slice.call(m.querySelectorAll('.regra')).map(function (l) { return { icone: l.querySelector('.r-ic').value, titulo: l.querySelector('.r-ti').value.trim(), descricao: l.querySelector('.r-de').value.trim() }; })
          .filter(function (r) { return r.titulo && r.descricao; });
        return salvarRegulamento(nome, { visaoGeral: f.visao.value.trim(), regras: regras }).then(function () { JESUI.toast({ tone: 'ok', title: 'Regulamento salvo', text: nome }); });
      } });
    m.querySelector('#add-regra').addEventListener('click', function () { m.querySelector('#regras').insertAdjacentHTML('beforeend', linha()); });
  };
  A.rmRegra = function (el) { el.closest('.regra').remove(); };

  function cadUsuarios() {
    var us = _db.usuarios || [];
    return '<div class="sub-head"><h2>Usuários <small>' + us.length + '</small></h2><button type="button" class="btn btn-primary btn-sm" data-act="novoUsuario">' + ico('plus', 16) + 'Novo usuário</button></div>' +
      (us.length ? '<div class="list-rows">' + us.map(function (u) {
        var turno = u.categoria === 'manha' ? 'Manhã' : u.categoria === 'tarde' ? 'Tarde' : 'Os dois turnos';
        return '<div class="lr"><span class="avatar">' + esc((u.nome || u.email).charAt(0).toUpperCase()) + '</span><div class="lr-main"><b>' + esc(u.nome || u.email) + '</b><small>' + esc(u.email) + '</small></div>' +
          '<span class="pill ' + (u.role === 'master' ? 'pill-live' : '') + '">' + (u.role === 'master' ? 'Administrador' : 'Mesário') + '</span><span class="pill">' + turno + '</span>' +
          '<div class="lr-actions"><button type="button" class="icon-btn sm" data-act="editarUsuario" data-id="' + esc(u.id) + '" aria-label="Editar">' + ico('edit', 18) + '</button>' +
          (u.role !== 'master' ? '<button type="button" class="icon-btn sm danger" data-act="apagarUsuario" data-id="' + esc(u.id) + '" aria-label="Apagar">' + ico('trash', 18) + '</button>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty"><h3>Nenhum usuário</h3></div>');
  }
  A.novoUsuario = function () { formUsuario(null); };
  A.editarUsuario = function (el) { formUsuario((_db.usuarios || []).find(function (u) { return String(u.id) === el.dataset.id; })); };
  A.apagarUsuario = function (el) {
    var u = (_db.usuarios || []).find(function (x) { return String(x.id) === el.dataset.id; }); if (!u) return;
    confirmar({ title: 'Apagar usuário?', okLabel: 'Apagar', danger: true, text: '<p><b>' + esc(u.nome || u.email) + '</b> perde o acesso ao painel.</p>', onOk: function () { return apagarUsuario(String(u.id)); } });
  };
  function formUsuario(u) {
    formModal({ title: u ? 'Editar usuário' : 'Novo usuário', okLabel: u ? 'Salvar' : 'Criar usuário',
      body: field('Nome', 'nome', 'text', u ? u.nome : '', 'required') + field('E-mail', 'email', 'email', u ? u.email : '', 'required') +
        field(u ? 'Nova senha (deixe em branco para manter)' : 'Senha', 'senha', 'password', '', u ? 'autocomplete="new-password"' : 'required autocomplete="new-password"') +
        '<div class="row2">' + field('Perfil', 'role', 'select', [['mesario', 'Mesário (conduz partidas)'], ['master', 'Administrador (controle total)']], u ? u.role : 'mesario') +
        field('Turno', 'cat', 'select', [['ambas', 'Os dois turnos'], ['manha', 'Manhã'], ['tarde', 'Tarde']], u ? u.categoria : 'ambas') + '</div>',
      onSubmit: function (f) {
        var d = { nome: f.nome.value.trim(), email: f.email.value.trim(), senha: f.senha.value, role: f.role.value, categoria: f.cat.value };
        if (!d.email || (!u && !d.senha)) { JESUI.toast({ tone: 'warn', title: 'E-mail e senha são obrigatórios' }); return false; }
        if (u) return atualizarUsuario(String(u.id), d).then(function () { JESUI.toast({ tone: 'ok', title: 'Usuário atualizado' }); });
        return criarUsuario(d).then(function (ok) {
          if (!ok) { JESUI.toast({ tone: 'warn', title: 'E-mail já cadastrado' }); return false; }
          JESUI.toast({ tone: 'ok', title: 'Usuário criado' });
        });
      } });
  }

  /* =====================================================
     MODAIS
     ===================================================== */
  function field(label, name, type, valor, extra) {
    var attrs = extra || '';
    if (type === 'select') {
      var opts = valor, atual = attrs;      /* (label, name, 'select', opções, atual) */
      return '<label class="field"><span>' + label + '</span><select name="' + name + '">' + opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(atual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></label>';
    }
    return '<label class="field"><span>' + label + '</span><input type="' + type + '" name="' + name + '" value="' + esc(valor == null ? '' : valor) + '" ' + attrs + '></label>';
  }

  function openModal(o) {
    closeModal();
    var m = document.createElement('div');
    m.className = 'modal-scrim';
    m.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + (o.small ? ' small' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><header><h3>' + esc(o.title) + '</h3>' +
      '<button type="button" class="icon-btn sm" data-close aria-label="Fechar">' + ico('x', 18) + '</button></header><div class="modal-body">' + o.body + '</div></div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('in'); var f = m.querySelector('input:not([type=hidden]):not([type=file]),select,textarea'); if (f && !o.small && f.type !== 'color') f.focus(); });
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    document.addEventListener('keydown', escFecha);
    document.body.classList.add('modal-open');
    return m;
  }
  function escFecha(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    document.removeEventListener('keydown', escFecha);
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-scrim').forEach(function (m) { m.remove(); });
  }

  /* modal com <form>: onSubmit(form) retorna Promise (ou false para manter aberto) */
  function formModal(o) {
    var m = openModal({ title: o.title, wide: o.wide, body: '<form novalidate>' + o.body + '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-primary"><span>' + esc(o.okLabel || 'Salvar') + '</span></button></div></form>' });
    var form = m.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = [].slice.call(form.querySelectorAll('[required]')).find(function (i) { return !i.value; });
      if (bad) { bad.focus(); JESUI.toast({ tone: 'warn', title: 'Preencha os campos obrigatórios' }); return; }
      var btn = form.querySelector('[type=submit]');
      var r;
      try { r = o.onSubmit(form.elements); } catch (err) { console.error(err); r = false; }
      if (r === false) return;
      JESUI.busy(btn, Promise.resolve(r).then(function (res) { if (res !== false) closeModal(); }, function (err) {
        console.error(err); JESUI.toast({ tone: 'warn', title: 'Não foi possível salvar', text: 'Verifique a conexão e tente de novo.' });
      }));
    });
    return m;
  }

  function confirmar(o) {
    var m = openModal({ title: o.title, small: true, body: '<div class="confirm-body">' + o.text + '</div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="button" class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" id="ok-btn"><span>' + esc(o.okLabel || 'Confirmar') + '</span></button></div>' });
    m.querySelector('#ok-btn').addEventListener('click', function () {
      var b = this;
      JESUI.busy(b, Promise.resolve(o.onOk()).then(closeModal, function (err) { console.error(err); JESUI.toast({ tone: 'warn', title: 'Não foi possível concluir' }); }));
    });
  }
})();
