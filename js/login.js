/* =====================================================
   JES 2026 — login.js
   Autenticação do organizador (tabela "usuarios" no Firestore)
   ===================================================== */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('login-form');
  if (!form) return;
  var erro = document.getElementById('login-error');
  var btn = form.querySelector('.btn-submit');

  function mostrarErro(msg) { erro.textContent = msg; erro.hidden = false; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); }
  function restaurar() { btn.disabled = false; btn.classList.remove('is-busy'); btn.querySelector('span').textContent = 'Entrar no painel'; }

  document.getElementById('toggle-senha').addEventListener('click', function () {
    var i = document.getElementById('senha');
    var mostrar = i.type === 'password';
    i.type = mostrar ? 'text' : 'password';
    this.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    this.classList.toggle('on', mostrar);
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    erro.hidden = true;
    var email = document.getElementById('email').value.trim();
    var senha = document.getElementById('senha').value;
    if (!email || !senha) { mostrarErro('Preencha e-mail e senha.'); return; }

    btn.disabled = true; btn.classList.add('is-busy'); btn.querySelector('span').textContent = 'Entrando…';
    try {
      var db = window.__firebase ? window.__firebase.db : null;
      if (!db) { mostrarErro('Sem conexão com o servidor. Tente novamente em instantes.'); restaurar(); return; }
      var fs = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
      var snap = await fs.getDocs(fs.query(fs.collection(db, 'usuarios'), fs.where('email', '==', email), fs.where('senha', '==', senha)));
      if (snap.empty) { mostrarErro('E-mail ou senha incorretos.'); restaurar(); return; }

      var u = snap.docs[0].data();
      setSession(u.email, u.role, u.categoria || 'ambas');
      if (u.categoria && u.categoria !== 'ambas') setCategoria(u.categoria);
      btn.querySelector('span').textContent = 'Tudo certo!';
      window.location.href = 'admin-master.html';
    } catch (err) {
      mostrarErro('Não foi possível entrar: ' + (err.message || 'tente novamente'));
      restaurar();
    }
  });
});
