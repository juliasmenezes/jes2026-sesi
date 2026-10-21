-- =====================================================
-- JES 2026 — Estrutura completa do banco de dados
-- Estrutura original (Supabase/PostgreSQL) — migrada para Firebase Firestore em 16/10/2026
-- Para visualizar no VS Code: instale a extensão PostgreSQL
-- =====================================================

-- =====================================================
-- 1. SEQUÊNCIAS (auto-incremento)
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS modalidades_id_seq;
CREATE SEQUENCE IF NOT EXISTS equipes_id_seq;
CREATE SEQUENCE IF NOT EXISTS jogos_id_seq;
CREATE SEQUENCE IF NOT EXISTS eventos_id_seq;
CREATE SEQUENCE IF NOT EXISTS usuarios_id_seq;

-- =====================================================
-- 2. TABELAS
-- =====================================================

-- Modalidades esportivas (ex: Futsal Masculino, Vôlei Feminino)
CREATE TABLE IF NOT EXISTS modalidades (
  id      integer NOT NULL DEFAULT nextval('modalidades_id_seq'),
  nome    text    NOT NULL,
  genero  text    NOT NULL,
  cor     text    NOT NULL DEFAULT '#2563EB',
  PRIMARY KEY (id)
);

-- Equipes / Unidades participantes
CREATE TABLE IF NOT EXISTS equipes (
  id      integer NOT NULL DEFAULT nextval('equipes_id_seq'),
  nome    text    NOT NULL,
  turma   text    NOT NULL DEFAULT '',
  brasao  text    NOT NULL DEFAULT '',
  PRIMARY KEY (id)
);

-- Jogos / Partidas agendadas
CREATE TABLE IF NOT EXISTS jogos (
  id                integer     NOT NULL DEFAULT nextval('jogos_id_seq'),
  modalidade_id     integer,
  modalidade        text        NOT NULL,
  genero            text        NOT NULL,
  data              date        NOT NULL,
  horario           text        NOT NULL,
  local             text        NOT NULL DEFAULT '',
  time_a            text        NOT NULL,
  time_b            text        NOT NULL,
  placar_a          integer     NOT NULL DEFAULT 0,
  placar_b          integer     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'EM BREVE',
  tempo_decorrido   integer     NOT NULL DEFAULT 0,
  timer_state       text        NOT NULL DEFAULT 'paused',
  timer_started_at  bigint,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (modalidade_id) REFERENCES modalidades(id) ON DELETE SET NULL
);

-- Lance-a-lance (eventos de cada jogo)
CREATE TABLE IF NOT EXISTS eventos (
  id          integer     NOT NULL DEFAULT nextval('eventos_id_seq'),
  jogo_id     integer     NOT NULL,
  tipo        text        NOT NULL DEFAULT 'info',
  time        text        NOT NULL DEFAULT '',
  descricao   text        NOT NULL DEFAULT '',
  minuto      text        NOT NULL DEFAULT '',
  timestamp   bigint      NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (jogo_id) REFERENCES jogos(id) ON DELETE CASCADE
);

-- Usuários (organizadores / mesários)
CREATE TABLE IF NOT EXISTS usuarios (
  id      integer NOT NULL DEFAULT nextval('usuarios_id_seq'),
  email   text    NOT NULL UNIQUE,
  senha   text    NOT NULL,
  role    text    NOT NULL DEFAULT 'mesario',
  nome    text    NOT NULL DEFAULT '',
  PRIMARY KEY (id)
);

-- Pontos da classificação geral
CREATE TABLE IF NOT EXISTS pontos_jogos (
  id          bigint      NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * 1000)::bigint),
  equipe_nome text        NOT NULL,
  jogo_id     text        NOT NULL DEFAULT '',
  pontos      integer     NOT NULL DEFAULT 0,
  descricao   text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Regulamentos de cada modalidade
CREATE TABLE IF NOT EXISTS modalidade_regulamentos (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  modalidade   text        NOT NULL UNIQUE,
  visao_geral  text        NOT NULL DEFAULT '',
  regras       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS) — segurança por linhas
-- =====================================================

ALTER TABLE modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos_jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalidade_regulamentos ENABLE ROW LEVEL SECURITY;

-- --- Modalidades: CRUD público (anon + authenticated) ---
CREATE POLICY "anon_select_modalidades" ON modalidades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_modalidades" ON modalidades FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_modalidades" ON modalidades FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_modalidades" ON modalidades FOR DELETE TO anon, authenticated USING (true);

-- --- Equipes: CRUD público ---
CREATE POLICY "anon_select_equipes" ON equipes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_equipes" ON equipes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_equipes" ON equipes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_equipes" ON equipes FOR DELETE TO anon, authenticated USING (true);

-- --- Jogos: CRUD público ---
CREATE POLICY "anon_select_jogos" ON jogos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_jogos" ON jogos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_jogos" ON jogos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_jogos" ON jogos FOR DELETE TO anon, authenticated USING (true);

-- --- Eventos (lance-a-lance): CRUD público ---
CREATE POLICY "anon_select_eventos" ON eventos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_eventos" ON eventos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_eventos" ON eventos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_eventos" ON eventos FOR DELETE TO anon, authenticated USING (true);

-- --- Usuários: CRUD público ---
CREATE POLICY "anon_select_usuarios" ON usuarios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_usuarios" ON usuarios FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_usuarios" ON usuarios FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_usuarios" ON usuarios FOR DELETE TO anon, authenticated USING (true);

-- --- Pontos (classificação): CRUD público ---
CREATE POLICY "anon_select_pontos" ON pontos_jogos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_pontos" ON pontos_jogos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_pontos" ON pontos_jogos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_pontos" ON pontos_jogos FOR DELETE TO anon, authenticated USING (true);

-- --- Regulamentos: CRUD público ---
CREATE POLICY "Public can read modality regulations"  ON modalidade_regulamentos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can create modality regulations" ON modalidade_regulamentos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update modality regulations" ON modalidade_regulamentos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete modality regulations" ON modalidade_regulamentos FOR DELETE TO anon, authenticated USING (true);

-- =====================================================
-- 4. REALTIME (atualização em tempo real entre dispositivos)
-- =====================================================
-- No Firebase Firestore, o tempo real é automático via onSnapshot listeners.

-- =====================================================
-- 5. DADOS ATUAIS (SEED — snapshot de 15/10/2026)
-- =====================================================

-- --- Modalidades (10 registros) ---
INSERT INTO modalidades (id, nome, genero, cor) VALUES
  (1,  'Futsal',    'MASCULINO', '#2563EB'),
  (2,  'Futsal',    'FEMININO',  '#2563EB'),
  (3,  'Basquete',  'MASCULINO', '#D97706'),
  (4,  'Basquete',  'FEMININO',  '#D97706'),
  (5,  'Vôlei',     'MASCULINO', '#0F766E'),
  (6,  'Vôlei',     'FEMININO',  '#0F766E'),
  (7,  'Handebol',  'MASCULINO', '#059669'),
  (8,  'Handebol',  'FEMININO',  '#059669'),
  (9,  'Ping-Pong', 'MISTO',     '#DC2626'),
  (10, 'Pebolim',   'MISTO',     '#0891B2')
ON CONFLICT (id) DO NOTHING;

-- --- Equipes (4 registros) ---
INSERT INTO equipes (id, nome, turma, brasao) VALUES
  (7,  'França',     '9°s', ''),
  (8,  'Cabo Verde', '1°s', ''),
  (9,  'México',     '2°s', ''),
  (10, 'Brasil',     '3°s', '')
ON CONFLICT (id) DO NOTHING;

-- --- Usuário organizador ---
INSERT INTO usuarios (id, email, senha, role, nome) VALUES
  (1, 'organizador@jes2026.com', 'jes2026', 'master', 'Organizador')
ON CONFLICT (id) DO NOTHING;

-- --- Regulamentos (7 modalidades) ---
INSERT INTO modalidade_regulamentos (modalidade, visao_geral, regras) VALUES
  ('Futsal',
    'O futsal é um dos esportes mais tradicionais e dinâmicos disputados nos Jogos SESI. Jogado em quadra fechada com dimensões reduzidas e uma bola mais pesada, exige grande velocidade de raciocínio, técnica apurada e um intenso trabalho em equipe.',
    '[{"icone":"clock","titulo":"Tempo de Jogo e Formato","descricao":"As partidas consistem em 2 tempos de 15 minutos de bola rolando, com cronômetro corrido, com 5 minutos de intervalo. Nas fases finais eliminatórias, o cronômetro é travado exclusivamente nos últimos 2 minutos de cada tempo."},{"icone":"users","titulo":"Composição das Equipes e Substituições","descricao":"Cada equipe entra em quadra com 5 jogadores, sendo 1 goleiro e 4 na linha. São permitidas substituições ilimitadas durante o jogo."},{"icone":"triangle","titulo":"Faltas e Punições Disciplinares","descricao":"Há um limite de 5 faltas coletivas por equipe em cada período. A partir da 6ª falta, a equipe adversária terá direito a um tiro livre direto sem formação de barreira."},{"icone":"shirt","titulo":"Uniforme e Equipamentos de Segurança","descricao":"É estritamente obrigatório o uso de calçados fechados para todos os jogadores. É proibido atuar com adornos, acessórios ou objetos que ofereçam risco."}]'::jsonb),
  ('Basquete',
    'O basquete combina velocidade, estratégia e precisão. A modalidade valoriza o jogo coletivo, a leitura de espaço e a tomada de decisão em cada posse de bola.',
    '[{"icone":"clock","titulo":"Tempo de Jogo","descricao":"A partida é dividida em quatro períodos. O cronômetro e os intervalos seguem a programação oficial da competição."},{"icone":"users","titulo":"Composição das Equipes","descricao":"São 5 jogadores em quadra por equipe, com substituições permitidas durante as paralisações previstas na partida."},{"icone":"target","titulo":"Pontuação","descricao":"As cestas valem 1, 2 ou 3 pontos de acordo com a jogada e a região da quadra em que o arremesso é realizado."}]'::jsonb),
  ('Vôlei',
    'O vôlei é uma modalidade de cooperação, velocidade e precisão. As equipes precisam construir cada jogada com comunicação e organização para enviar a bola ao campo adversário.',
    '[{"icone":"clock","titulo":"Sistema de Partida","descricao":"A partida é disputada em melhor de 3 sets. Vence o set a equipe que alcançar 25 pontos com dois de vantagem."},{"icone":"users","titulo":"Composição das Equipes","descricao":"Cada equipe começa o rally com 6 jogadores em quadra. A rotação acontece sempre que a equipe recupera o direito de sacar."},{"icone":"target","titulo":"Toques e Rodízio","descricao":"Cada equipe pode realizar até 3 toques antes de devolver a bola. O mesmo jogador não pode tocar duas vezes seguidas, salvo após o bloqueio."}]'::jsonb),
  ('Handebol',
    'O handebol é uma modalidade de ataque e defesa em alta velocidade, que exige força, agilidade, arremesso e organização coletiva.',
    '[{"icone":"clock","titulo":"Tempo de Jogo","descricao":"As partidas são disputadas em dois períodos, com intervalo definido pela organização do evento."},{"icone":"users","titulo":"Composição das Equipes","descricao":"Cada equipe atua com 7 jogadores em quadra, incluindo o goleiro, e pode fazer substituições durante a partida."},{"icone":"shield","titulo":"Área do Goleiro","descricao":"Somente o goleiro pode permanecer dentro da área. Os demais jogadores devem finalizar a jogada respeitando a linha da área."}]'::jsonb),
  ('Ping-Pong',
    'O tênis de mesa é uma disputa de reflexo, controle e precisão. A competição valoriza a técnica, o respeito e a regularidade durante os pontos.',
    '[{"icone":"clock","titulo":"Formato da Partida","descricao":"Os jogos seguem o formato definido na tabela oficial e são vencidos pelo atleta ou dupla que alcançar a pontuação necessária primeiro."},{"icone":"target","titulo":"Saque","descricao":"O saque deve ser realizado atrás da linha de fundo e a bola precisa tocar primeiro o lado do sacador antes de cruzar a rede."}]'::jsonb),
  ('Pebolim',
    'O pebolim estimula a coordenação, a estratégia e o trabalho em dupla em partidas rápidas e cheias de decisões.',
    '[{"icone":"clock","titulo":"Formato da Partida","descricao":"As partidas seguem a pontuação prevista pela organização e são encerradas quando uma equipe atinge o limite estabelecido."},{"icone":"users","titulo":"Conduta","descricao":"Não é permitido girar as hastes de forma completa. A equipe deve manter o respeito e o controle do equipamento durante a partida."}]'::jsonb),
  ('Xadrez',
    'O xadrez desenvolve concentração, estratégia e tomada de decisão. Cada partida deve ser conduzida com silêncio e respeito ao adversário.',
    '[{"icone":"clock","titulo":"Tempo de Reflexão","descricao":"O relógio e o tempo de reflexão seguem o formato definido pela organização antes do início da rodada."},{"icone":"target","titulo":"Regras da Partida","descricao":"As jogadas devem seguir os movimentos oficiais das peças. O toque em uma peça pode caracterizar a obrigação de realizar a jogada, conforme o regulamento da rodada."}]'::jsonb)
ON CONFLICT (modalidade) DO NOTHING;

-- =====================================================
-- 6. RESUMO DAS TABELAS
-- =====================================================
-- modalidades              -> 10 registros (Futsal, Basquete, Vôlei, Handebol, Ping-Pong, Pebolim)
-- equipes                 -> 4 registros  (França, Cabo Verde, México, Brasil)
-- jogos                   -> 0 registros  (criados via painel admin)
-- eventos                 -> 0 registros  (lance-a-lance, criados durante jogos)
-- usuarios                -> 1 registro   (organizador@jes2026.com / master)
-- pontos_jogos            -> 0 registros  (pontos da classificação, adicionados via admin)
-- modalidade_regulamentos -> 7 registros  (regras de cada modalidade)
--
-- TODAS as tabelas têm:
--   - RLS habilitado (segurança por linhas)
--   - 4 políticas por tabela (SELECT, INSERT, UPDATE, DELETE)
--   - Permissão para anon e authenticated
--   - Realtime habilitado (atualização automática entre dispositivos)
--
-- LOGIN DO ORGANIZADOR:
--   Email: organizador@jes2026.com
--   Senha: jes2026
-- =====================================================
