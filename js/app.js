/* =====================================================
   JES 2026 — app.js  (camada de dados · Firebase Firestore)
   - Cache em memória + listeners em tempo real (onSnapshot)
   - Regras esportivas: basquete (1/2/3 pts) e vôlei (sets)
   - API global (window.*) compatível com as páginas anteriores
   ===================================================== */

import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  query, where, onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const SESSION_KEY = 'jes2026_session';
const CATEGORIA_KEY = 'jes2026_categoria';
const CATEGORIAS = ['manha', 'tarde'];

/* Turnos → séries atendidas */
const TURNOS = {
  manha: { nome: 'Manhã', series: '7º e 8º anos' },
  tarde: { nome: 'Tarde', series: '9º ano ao 3º ano do Ensino Médio' }
};

/* Regras do vôlei (ajuste aqui se o regulamento mudar) */
const REGRAS_VOLEI = { pontosSet: 25, pontosTieBreak: 15, setsParaVencer: 2, diferencaMinima: 2 };

/* ---- Turno ativo ---- */
let _categoriaAtual = localStorage.getItem(CATEGORIA_KEY);
if (CATEGORIAS.indexOf(_categoriaAtual) === -1) _categoriaAtual = 'manha';
document.documentElement.setAttribute('data-turno', _categoriaAtual);
document.body.setAttribute('data-turno', _categoriaAtual);

function getCategoria() { return _categoriaAtual; }
function setCategoria(cat) {
  if (CATEGORIAS.indexOf(cat) === -1) return;
  _categoriaAtual = cat;
  localStorage.setItem(CATEGORIA_KEY, cat);
  document.documentElement.setAttribute('data-turno', cat);
  document.body.setAttribute('data-turno', cat);
  window.dispatchEvent(new Event('jes2026-categoria-changed'));
}

/* ---- Cache ---- */
const _db = {
  modalidades: [], equipes: [], jogos: [], usuarios: [], pontosJogos: [],
  regulamentos: {}, _loaded: false, _error: false
};
let _jogosRaw = [];          // [{ id, data }]
let _eventosPorJogo = {};    // dbId -> [evento]
/* A coleção "usuarios" (com senhas) só é carregada no painel — nunca nas páginas públicas */
const _isAdminPage = document.body.hasAttribute('data-admin');

const getDb = () => (window.__firebase ? window.__firebase.db : null);

/* ---- Ready / Sync ---- */
let _onReadyCallbacks = [];
let _readyFired = false;
function onReady(cb) { if (_readyFired) cb(); else _onReadyCallbacks.push(cb); }
function _fireReady() {
  if (_readyFired) return;
  _readyFired = true;
  _db._loaded = true;
  _onReadyCallbacks.forEach(function (cb) { try { cb(); } catch (e) { console.error(e); } });
  _onReadyCallbacks = [];
}
let _syncQueued = false;
function _notifySync() {
  if (_syncQueued) return;
  _syncQueued = true;
  setTimeout(function () {
    _syncQueued = false;
    window.dispatchEvent(new Event('jes2026-data-changed'));
  }, 16);
}
function onSync(cb) { window.addEventListener('jes2026-data-changed', function () { cb(); }); }

/* ---- Realtime: uma única fase (sem leituras duplicadas) ---- */
function _iniciar() {
  const db = getDb();
  if (!db) { _db._error = true; _fireReady(); return; }

  const pendentes = new Set(['modalidades', 'equipes', 'jogos', 'eventos', 'pontos', 'regs']);
  if (_isAdminPage) pendentes.add('usuarios');
  const concluir = function (nome) {
    pendentes.delete(nome);
    if (pendentes.size === 0) _fireReady();
  };
  const ouvir = function (nome, colecao, handler) {
    onSnapshot(collection(db, colecao), function (snap) {
      handler(snap);
      concluir(nome);
      _notifySync();
    }, function (err) {
      console.error('Firestore (' + colecao + '):', err);
      _db._error = true;
      concluir(nome);
    });
  };

  ouvir('modalidades', 'modalidades', function (s) { _db.modalidades = s.docs.map(_mapModalidade); });
  ouvir('equipes', 'equipes', function (s) { _db.equipes = s.docs.map(_mapEquipe); });
  ouvir('pontos', 'pontos_jogos', function (s) { _db.pontosJogos = s.docs.map(_mapPonto); });
  ouvir('regs', 'modalidade_regulamentos', function (s) {
    _db.regulamentos = {};
    s.docs.forEach(function (d) {
      const r = d.data();
      _db.regulamentos[r.modalidade] = { visaoGeral: r.visao_geral || '', regras: r.regras || [] };
    });
  });
  ouvir('jogos', 'jogos', function (s) {
    _jogosRaw = s.docs.map(function (d) { return { id: d.id, data: d.data() }; });
    _reconstruirJogos();
  });
  ouvir('eventos', 'eventos', function (s) {
    const mapa = {};
    s.docs.forEach(function (d) {
      const e = _mapEvento(Object.assign({ _id: d.id }, d.data()));
      const jid = d.data().jogo_id;
      (mapa[jid] = mapa[jid] || []).push(e);
    });
    Object.keys(mapa).forEach(function (k) { mapa[k].sort(function (a, b) { return a.timestamp - b.timestamp; }); });
    _eventosPorJogo = mapa;
    _reconstruirJogos();
  });
  if (_isAdminPage) {
    ouvir('usuarios', 'usuarios', function (s) { _db.usuarios = s.docs.map(_mapUsuario); });
  }

  /* Rede lenta/offline: libera a interface depois de 10s, sinalizando erro */
  setTimeout(function () { if (!_readyFired) { _db._error = true; _fireReady(); } }, 10000);
}

function _reconstruirJogos() {
  _db.jogos = _jogosRaw.map(function (r) { return _mapJogo(r.id, r.data, _eventosPorJogo[r.id] || []); });
}

/* ---- Mapeadores ---- */
function _mapModalidade(d) { const r = d.data(); return { id: d.id, nome: r.nome, genero: r.genero, cor: r.cor, categoria: r.categoria || 'manha' }; }
function _mapEquipe(d) { const r = d.data(); return { id: d.id, nome: r.nome, turma: r.turma, brasao: r.brasao || '', categoria: r.categoria || 'manha' }; }
function _mapUsuario(d) { const r = d.data(); return { id: d.id, email: r.email, senha: r.senha, role: r.role, nome: r.nome, categoria: r.categoria || 'ambas' }; }
function _mapPonto(d) {
  const r = d.data();
  return { id: d.id, equipeNome: r.equipe_nome, jogoId: r.jogo_id || '', pontos: r.pontos, descricao: r.descricao || '', categoria: r.categoria || 'manha' };
}
function _mapEvento(r) {
  return {
    id: 'ev-' + r._id, _dbId: r._id, tipo: r.tipo, time: r.time, descricao: r.descricao,
    minuto: r.minuto || '', timestamp: r.timestamp || 0, valor: r.valor === undefined ? 1 : r.valor, periodo: r.periodo || 1
  };
}
function _mapJogo(docId, r, eventos) {
  return {
    id: 'jogo-' + docId, _dbId: docId,
    modalidadeId: r.modalidade_id || null, modalidade: r.modalidade, genero: r.genero,
    data: r.data, horario: r.horario, local: r.local || '',
    timeA: r.time_a, timeB: r.time_b,
    placarA: r.placar_a || 0, placarB: r.placar_b || 0,
    status: r.status, categoria: r.categoria || 'manha',
    tempoDecorrido: r.tempo_decorrido || 0, timerState: r.timer_state || 'paused', timerStartedAt: r.timer_started_at || null,
    periodo: r.periodo || 1, pausaMotivo: r.pausa_motivo || '',
    setsA: r.sets_a || 0, setsB: r.sets_b || 0, parciais: r.parciais || [], setAtual: r.set_atual || 1,
    eventos: eventos
  };
}

/* ---- Sessão ---- */
function setSession(email, role, categoria) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email: email, role: role || 'master', categoria: categoria || 'ambas', timestamp: Date.now() }));
}
function getSession() { const raw = localStorage.getItem(SESSION_KEY); try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getUsuarioAtual() {
  const s = getSession();
  if (!s) return null;
  return _db.usuarios.find(function (c) { return c.email === s.email; }) || null;
}
function isMaster() { const u = getUsuarioAtual(); return !!(u && u.role === 'master'); }

/* ---- Leitura (filtrada pelo turno ativo) ---- */
function _filterCat(items) {
  return items.filter(function (i) { const c = i.categoria || 'manha'; return c === _categoriaAtual || c === 'ambas'; });
}
/* Data local (toISOString usa UTC e "pula" o dia após as 21h no Brasil) */
function hojeLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const getJogos = () => _filterCat(_db.jogos);
const getEquipes = () => _filterCat(_db.equipes);
const getModalidades = () => _filterCat(_db.modalidades);
const getRegulamentos = () => _db.regulamentos;
const getJogosAll = () => _db.jogos;
const getEquipesAll = () => _db.equipes;
const getModalidadesAll = () => _db.modalidades;
const getJogoById = (id) => _db.jogos.find(function (j) { return j.id === id; });
const getEquipeByNome = (nome) => _db.equipes.find(function (e) { return e.nome === nome; }) || null;
const getJogosHoje = () => getJogos().filter(function (j) { return j.data === hojeLocal(); });
const getHistorico = () => getJogos().filter(function (j) { return j.status === 'FINALIZADO'; })
  .sort(function (a, b) { return (b.data + b.horario).localeCompare(a.data + a.horario); });
const getPontosPorEquipe = (nome) => _filterCat(_db.pontosJogos).filter(function (p) { return p.equipeNome === nome; });

function getClassificacao() {
  const pontos = _filterCat(_db.pontosJogos);
  const lista = getEquipes().map(function (eq) {
    const total = pontos.filter(function (p) { return p.equipeNome === eq.nome; })
      .reduce(function (s, p) { return s + (parseInt(p.pontos, 10) || 0); }, 0);
    return { id: eq.id, unidade: eq.nome, pontos: total };
  });
  lista.sort(function (a, b) { return b.pontos - a.pontos || a.unidade.localeCompare(b.unidade); });
  lista.forEach(function (r, i) { r.posicao = i + 1; });
  return lista;
}

/* ---- Esportes e regras ---- */
function sportKind(nome) {
  const n = String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.indexOf('basquete') >= 0) return 'basquete';
  if (n.indexOf('volei') >= 0) return 'volei';
  if (n.indexOf('futsal') >= 0) return 'futsal';
  if (n.indexOf('handebol') >= 0) return 'handebol';
  return 'outro';
}

/* Resultado "principal": sets no vôlei, placar nos demais */
function resultado(jogo) {
  if (sportKind(jogo.modalidade) === 'volei') return { a: jogo.setsA, b: jogo.setsB, unidade: 'sets' };
  return { a: jogo.placarA, b: jogo.placarB, unidade: 'pontos' };
}

/* Vôlei: estado derivado do histórico de pontos (consistente ao desfazer lances) */
function calcularVolei(eventos) {
  const R = REGRAS_VOLEI;
  let setsA = 0, setsB = 0, a = 0, b = 0;
  const parciais = [];
  const pts = eventos.filter(function (e) { return e.tipo === 'ponto' || e.tipo === 'gol'; })
    .sort(function (x, y) { return x.timestamp - y.timestamp; });
  for (let i = 0; i < pts.length; i++) {
    if (setsA >= R.setsParaVencer || setsB >= R.setsParaVencer) break;
    if (pts[i].time === 'A') a++; else b++;
    const decisivo = (setsA + setsB + 1) === (R.setsParaVencer * 2 - 1);
    const alvo = decisivo ? R.pontosTieBreak : R.pontosSet;
    if ((a >= alvo || b >= alvo) && Math.abs(a - b) >= R.diferencaMinima) {
      parciais.push({ a: a, b: b });
      if (a > b) setsA++; else setsB++;
      a = 0; b = 0;
    }
  }
  return {
    setsA: setsA, setsB: setsB, parciais: parciais, placarA: a, placarB: b,
    setAtual: setsA + setsB + 1, encerrada: setsA >= R.setsParaVencer || setsB >= R.setsParaVencer
  };
}
function _camposVolei(st) {
  return { sets_a: st.setsA, sets_b: st.setsB, parciais: st.parciais, placar_a: st.placarA, placar_b: st.placarB, set_atual: Math.min(st.setAtual, REGRAS_VOLEI.setsParaVencer * 2 - 1) };
}

/* Rótulos de período / pausa (usados no painel e nas telas públicas) */
function labelPeriodo(jogo) {
  const k = sportKind(jogo.modalidade);
  if (k === 'volei') return 'Set ' + jogo.setAtual;
  if (k === 'basquete') return jogo.periodo <= 4 ? jogo.periodo + 'º quarto' : 'Prorrogação';
  if (k === 'futsal' || k === 'handebol') return jogo.periodo <= 2 ? jogo.periodo + 'º tempo' : 'Prorrogação';
  return '';
}
function labelPausa(jogo) {
  const k = sportKind(jogo.modalidade);
  const m = jogo.pausaMotivo;
  if (m === 'fim_set') {
    const ult = jogo.parciais[jogo.parciais.length - 1];
    return { chave: 'fim_set', titulo: 'FIM DE SET', sub: 'Set ' + jogo.parciais.length + (ult ? ' · ' + ult.a + ' × ' + ult.b : '') };
  }
  if (m === 'fim_periodo') {
    if (jogo.periodo > (k === 'basquete' ? 4 : 2)) return { chave: 'fim_quarto', titulo: 'FIM DA PRORROGAÇÃO', sub: 'Prorrogação encerrada' };
    if (k === 'basquete') {
      if (jogo.periodo === 2) return { chave: 'intervalo', titulo: 'INTERVALO', sub: 'Fim do 2º quarto' };
      return { chave: 'fim_quarto', titulo: 'FIM DE QUARTO', sub: 'Fim do ' + jogo.periodo + 'º quarto' };
    }
    if (jogo.periodo === 1) return { chave: 'intervalo', titulo: 'INTERVALO', sub: 'Fim do 1º tempo' };
    return { chave: 'fim_tempo', titulo: 'FIM DO TEMPO', sub: 'Tempo regulamentar encerrado' };
  }
  return { chave: 'pausa', titulo: 'JOGO PAUSADO', sub: 'A partida será retomada em instantes' };
}
function labelRetomar(jogo) {
  if (jogo.status === 'EM BREVE') return 'Iniciar partida';
  const k = sportKind(jogo.modalidade);
  if (jogo.pausaMotivo === 'fim_set') return 'Iniciar set ' + jogo.setAtual;
  if (jogo.pausaMotivo === 'fim_periodo') {
    if (k === 'basquete') return jogo.periodo < 4 ? 'Iniciar ' + (jogo.periodo + 1) + 'º quarto' : 'Iniciar prorrogação';
    return jogo.periodo < 2 ? 'Iniciar 2º tempo' : 'Iniciar prorrogação';
  }
  return 'Retomar jogo';
}

/* ---- Temporizador ---- */
function getTempoJogo(jogo, agora) {
  const t = Number(jogo && jogo.tempoDecorrido) || 0;
  if (!jogo || jogo.timerState !== 'running' || !jogo.timerStartedAt) return t;
  return t + Math.max(0, Math.floor(((agora || Date.now()) - jogo.timerStartedAt) / 1000));
}
function formatarTempoJogo(seg) {
  const t = Math.max(0, Number(seg) || 0);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
function atualizarTempoJogo(jogo) { if (jogo) { jogo.tempoDecorrido = getTempoJogo(jogo); jogo.timerStartedAt = null; } }
function sincronizarTemporizadorComStatus() { /* mantido por compatibilidade */ }

/* Campos de status/cronômetro a gravar (sem mutar o cache) */
function _camposStatus(jogo, status, motivo) {
  const f = { status: status };
  if (status === 'AO VIVO') {
    const rodando = jogo.timerState === 'running' && jogo.timerStartedAt;
    f.tempo_decorrido = jogo.tempoDecorrido;
    f.timer_state = 'running';
    f.timer_started_at = rodando ? jogo.timerStartedAt : Date.now();
    f.pausa_motivo = '';
    if (jogo.status === 'PAUSADO' && jogo.pausaMotivo === 'fim_periodo') f.periodo = (jogo.periodo || 1) + 1;
  } else if (status === 'FINALIZADO') {
    f.tempo_decorrido = getTempoJogo(jogo); f.timer_state = 'stopped'; f.timer_started_at = null; f.pausa_motivo = '';
  } else {
    f.tempo_decorrido = getTempoJogo(jogo); f.timer_state = 'paused'; f.timer_started_at = null;
    f.pausa_motivo = status === 'PAUSADO' ? (motivo || 'pausa') : '';
  }
  return f;
}
const _ref = (j) => doc(getDb(), 'jogos', j._dbId);

/* ---- CRUD Modalidades / Equipes / Usuários / Pontos ---- */
async function criarModalidade(d) {
  const row = { nome: d.nome.trim(), genero: d.genero, cor: d.cor || '#E10600', categoria: d.categoria || _categoriaAtual };
  const ref = await addDoc(collection(getDb(), 'modalidades'), row);
  return Object.assign({ id: ref.id }, row);
}
async function atualizarModalidade(id, d) {
  await updateDoc(doc(getDb(), 'modalidades', id), { nome: d.nome.trim(), genero: d.genero, cor: d.cor || '#E10600' });
}
async function apagarModalidade(id) {
  if (_db.jogos.some(function (j) { return j.modalidadeId === id; })) return false;
  await deleteDoc(doc(getDb(), 'modalidades', id));
  return true;
}
async function criarEquipe(nome, turma, brasao, categoria) {
  const ref = await addDoc(collection(getDb(), 'equipes'), { nome: nome, turma: turma, brasao: brasao || '', categoria: categoria || _categoriaAtual });
  return ref.id;
}
async function atualizarEquipe(id, d) {
  const row = {};
  if (d.nome !== undefined) row.nome = d.nome.trim();
  if (d.turma !== undefined) row.turma = d.turma.trim();
  if (d.brasao !== undefined) row.brasao = d.brasao;
  await updateDoc(doc(getDb(), 'equipes', id), row);
}
async function apagarEquipe(id) { await deleteDoc(doc(getDb(), 'equipes', id)); }

async function criarUsuario(d) {
  if (_db.usuarios.find(function (c) { return c.email === d.email.trim(); })) return false;
  await addDoc(collection(getDb(), 'usuarios'), {
    email: d.email.trim(), senha: d.senha, role: d.role || 'mesario',
    nome: d.nome || d.email.split('@')[0], categoria: d.categoria || 'ambas'
  });
  return true;
}
async function atualizarUsuario(id, d) {
  const row = {};
  if (d.email) row.email = d.email.trim();
  if (d.senha) row.senha = d.senha;
  if (d.role) row.role = d.role;
  if (d.nome) row.nome = d.nome.trim();
  if (d.categoria) row.categoria = d.categoria;
  await updateDoc(doc(getDb(), 'usuarios', id), row);
}
async function apagarUsuario(id) { await deleteDoc(doc(getDb(), 'usuarios', id)); }

async function adicionarPonto(equipeNome, jogoId, pontos, descricao) {
  await addDoc(collection(getDb(), 'pontos_jogos'), {
    equipe_nome: equipeNome, jogo_id: jogoId || '', pontos: Math.max(0, parseInt(pontos, 10) || 0),
    descricao: descricao || '', categoria: _categoriaAtual
  });
}
async function removerPonto(id) { await deleteDoc(doc(getDb(), 'pontos_jogos', String(id))); }

/* ---- CRUD Jogos ---- */
async function criarJogo(d) {
  const mod = _db.modalidades.find(function (m) { return m.nome === d.modalidade && m.genero === d.genero; });
  const aoVivo = d.status === 'AO VIVO';
  const row = {
    modalidade_id: mod ? mod.id : null, modalidade: d.modalidade, genero: d.genero,
    data: d.data, horario: d.horario, local: d.local || '', time_a: d.timeA, time_b: d.timeB,
    placar_a: 0, placar_b: 0, sets_a: 0, sets_b: 0, parciais: [], set_atual: 1, periodo: 1, pausa_motivo: '',
    status: d.status || 'EM BREVE', categoria: d.categoria || _categoriaAtual,
    tempo_decorrido: 0, timer_state: aoVivo ? 'running' : 'paused', timer_started_at: aoVivo ? Date.now() : null
  };
  const ref = await addDoc(collection(getDb(), 'jogos'), row);
  return _mapJogo(ref.id, row, []);
}

async function atualizarJogo(id, d) {
  const jogo = getJogoById(id);
  if (!jogo) return;
  const status = d.status || jogo.status;
  const row = Object.assign({
    modalidade: d.modalidade, genero: d.genero, modalidade_id: d.modalidadeId || jogo.modalidadeId,
    data: d.data, horario: d.horario, local: d.local || '', time_a: d.timeA, time_b: d.timeB,
    placar_a: Math.max(0, parseInt(d.placarA, 10) || 0), placar_b: Math.max(0, parseInt(d.placarB, 10) || 0)
  }, status !== jogo.status ? _camposStatus(jogo, status) : {});
  if (d.setsA !== undefined) row.sets_a = Math.max(0, parseInt(d.setsA, 10) || 0);
  if (d.setsB !== undefined) row.sets_b = Math.max(0, parseInt(d.setsB, 10) || 0);
  await updateDoc(_ref(jogo), row);
}

async function atualizarResultado(id, placarA, placarB, status) {
  const jogo = getJogoById(id);
  if (!jogo) return;
  const row = Object.assign({ placar_a: parseInt(placarA, 10) || 0, placar_b: parseInt(placarB, 10) || 0 },
    status !== jogo.status ? _camposStatus(jogo, status) : {});
  await updateDoc(_ref(jogo), row);
}

async function alterarStatusJogo(id, status, motivo) {
  const jogo = getJogoById(id);
  if (jogo) await updateDoc(_ref(jogo), _camposStatus(jogo, status, motivo));
}
async function iniciarTemporizadorJogo(id) {
  const j = getJogoById(id);
  if (j && j.status !== 'FINALIZADO' && j.status !== 'AO VIVO') await updateDoc(_ref(j), _camposStatus(j, 'AO VIVO'));
}
async function pausarTemporizadorJogo(id, motivo) {
  const j = getJogoById(id);
  if (j && j.status === 'AO VIVO') await updateDoc(_ref(j), _camposStatus(j, 'PAUSADO', motivo));
}
async function finalizarTemporizadorJogo(id) {
  const j = getJogoById(id);
  if (j) await updateDoc(_ref(j), _camposStatus(j, 'FINALIZADO'));
}

async function apagarJogo(id) {
  const j = getJogoById(id);
  if (!j) return;
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'eventos'), where('jogo_id', '==', j._dbId)));
  const batch = writeBatch(db);
  snap.docs.forEach(function (d) { batch.delete(d.ref); });
  batch.delete(_ref(j));
  await batch.commit();
}

/* ---- Lance a lance ---- */
let _lastTs = 0;
const _nowTs = () => (_lastTs = Math.max(Date.now(), _lastTs + 1));
const _pontua = (tipo) => tipo === 'gol' || tipo === 'ponto';

/* valor: pontos do lance (basquete 1/2/3). Evento + placar + status são gravados em UM lote atômico. */
async function adicionarEvento(jogoId, tipo, time, descricao, minuto, valor) {
  const jogo = getJogoById(jogoId);
  if (!jogo || jogo.status === 'FINALIZADO') return null;
  const db = getDb();
  const ref = doc(collection(db, 'eventos'));
  const v = _pontua(tipo) ? Math.max(1, parseInt(valor, 10) || 1) : 0;
  const row = { jogo_id: jogo._dbId, tipo: tipo, time: time, descricao: descricao, minuto: minuto || '', timestamp: _nowTs(), valor: v, periodo: jogo.periodo || 1 };
  const evento = _mapEvento(Object.assign({ _id: ref.id }, row));
  const upd = {};
  let statusFinal = jogo.status;

  if (_pontua(tipo)) {
    if (sportKind(jogo.modalidade) === 'volei') {
      const st = calcularVolei(jogo.eventos.concat([evento]));
      Object.assign(upd, _camposVolei(st));
      if (st.encerrada) { Object.assign(upd, _camposStatus(jogo, 'FINALIZADO')); statusFinal = 'FINALIZADO'; }
      else if (st.setsA + st.setsB > jogo.setsA + jogo.setsB) { Object.assign(upd, _camposStatus(jogo, 'PAUSADO', 'fim_set')); statusFinal = 'PAUSADO'; }
    } else if (time === 'A') upd.placar_a = jogo.placarA + v;
    else upd.placar_b = jogo.placarB + v;
  }
  if (jogo.status === 'EM BREVE' && statusFinal === 'EM BREVE') Object.assign(upd, _camposStatus(jogo, 'AO VIVO'));

  const batch = writeBatch(db);
  batch.set(ref, row);
  if (Object.keys(upd).length) batch.update(_ref(jogo), upd);
  await batch.commit();
  return evento;
}

async function removerEvento(jogoId, eventoId) {
  const jogo = getJogoById(jogoId);
  if (!jogo) return;
  const ev = jogo.eventos.find(function (e) { return e.id === eventoId; });
  if (!ev) return;
  const db = getDb();
  const upd = {};
  if (_pontua(ev.tipo)) {
    if (sportKind(jogo.modalidade) === 'volei') {
      const st = calcularVolei(jogo.eventos.filter(function (e) { return e.id !== eventoId; }));
      Object.assign(upd, _camposVolei(st));
      if (st.setsA + st.setsB < jogo.setsA + jogo.setsB) {
        if (jogo.status === 'FINALIZADO') Object.assign(upd, _camposStatus(jogo, 'AO VIVO'));
        else if (jogo.pausaMotivo === 'fim_set') upd.pausa_motivo = '';
      }
    } else if (ev.time === 'A') upd.placar_a = Math.max(0, jogo.placarA - (ev.valor || 1));
    else upd.placar_b = Math.max(0, jogo.placarB - (ev.valor || 1));
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, 'eventos', ev._dbId));
  if (Object.keys(upd).length) batch.update(_ref(jogo), upd);
  await batch.commit();
}

/* Desfaz o último lance pontuável de uma equipe (mantém o histórico coerente) */
async function desfazerUltimoPonto(jogoId, time) {
  const jogo = getJogoById(jogoId);
  if (!jogo) return null;
  const alvo = jogo.eventos.filter(function (e) { return _pontua(e.tipo) && e.time === time; }).pop();
  if (alvo) { await removerEvento(jogoId, alvo.id); return alvo; }
  const atual = time === 'A' ? jogo.placarA : jogo.placarB;
  if (atual > 0 && sportKind(jogo.modalidade) !== 'volei') {
    await updateDoc(_ref(jogo), time === 'A' ? { placar_a: atual - 1 } : { placar_b: atual - 1 });
    return { manual: true };
  }
  return null;
}

async function limparEventos(jogoId) {
  const jogo = getJogoById(jogoId);
  if (!jogo) return;
  const db = getDb();
  const batch = writeBatch(db);
  jogo.eventos.forEach(function (e) { batch.delete(doc(db, 'eventos', e._dbId)); });
  batch.update(_ref(jogo), { placar_a: 0, placar_b: 0, sets_a: 0, sets_b: 0, parciais: [], set_atual: 1, periodo: 1 });
  await batch.commit();
}

async function atualizarPlacarJogo(jogoId, a, b) {
  const jogo = getJogoById(jogoId);
  if (jogo) await updateDoc(_ref(jogo), { placar_a: a, placar_b: b });
}

/* ---- Compat: ids ---- */
const gerarIdJogo = () => 'jogo-' + Date.now();
const getClassificacaoLegacy = getClassificacao;
function initDB() {}

/* ---- Inicialização ---- */
if (window.__firebase) _iniciar();
else window.addEventListener('firebase-ready', _iniciar);

/* ---- Exposição global ---- */
Object.assign(window, {
  _db, TURNOS, REGRAS_VOLEI, onReady, onSync, initDB, setSession, getSession, clearSession, getUsuarioAtual, isMaster,
  getJogos, getEquipes, getModalidades, getRegulamentos, getJogoById, getEquipeByNome, getJogosHoje, getClassificacao,
  getHistorico, getPontosPorEquipe, getJogosAll, getEquipesAll, getModalidadesAll, getCategoria, setCategoria, hojeLocal,
  sportKind, resultado, calcularVolei, labelPeriodo, labelPausa, labelRetomar,
  getTempoJogo, formatarTempoJogo, atualizarTempoJogo, sincronizarTemporizadorComStatus,
  criarModalidade, atualizarModalidade, apagarModalidade, criarEquipe, atualizarEquipe, apagarEquipe,
  criarJogo, atualizarJogo, atualizarResultado, alterarStatusJogo, iniciarTemporizadorJogo, pausarTemporizadorJogo,
  finalizarTemporizadorJogo, apagarJogo, adicionarEvento, removerEvento, desfazerUltimoPonto, limparEventos,
  atualizarPlacarJogo, criarUsuario, atualizarUsuario, apagarUsuario, adicionarPonto, removerPonto,
  gerarIdJogo, getClassificacaoLegacy
});
