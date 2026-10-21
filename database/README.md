# Banco de Dados — JES 2026

## Como visualizar no VS Code

1. Instale a extensão **PostgreSQL** (por Chris Kolkman ou Weijan Chen) no VS Code
2. Abra o arquivo `schema.sql` — ele contém toda a estrutura do banco
3. O banco está rodando na nuvem (Firebase Firestore) e conectado ao site automaticamente

## Como funciona

- O site se conecta ao banco de dados automaticamente quando abre
- **Tempo real**: quando alguém altera um placar no painel, todos os visitantes veem a mudança na hora — sem recarregar a página
- Múltiplos dispositivos podem acessar simultaneamente e ver os mesmos dados atualizados

## Tabelas

| Tabela | Descrição |
|--------|-----------|
| `modalidades` | Modalidades esportivas (ex: Futsal Masculino) |
| `equipes` | Equipes/unidades participantes |
| `jogos` | Partidas agendadas com placar e status |
| `eventos` | Lance-a-lance de cada jogo |
| `usuarios` | Contas de organizador (master/mesário) |
| `pontos_jogos` | Pontos da classificação geral |
| `modalidade_regulamentos` | Regulamentos de cada modalidade |

## Login do organizador

- Email: `organizador@jes2026.com`
- Senha: `jes2026`
