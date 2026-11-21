# FinBank V2 — repositório filho

@../CLAUDE.md

Este repositório é público. Os caminhos `../` abaixo (import, rules e histórias) só existem no workspace interno da equipe; num clone isolado, siga o README.md.

Este diretório possui Git independente. Documentação oficial, regras e skills estão na coordenação, um nível acima. Não criar cópias locais do PRD ou backlog.

Antes de trabalhar, ler `../.claude/rules/` e a história solicitada em `../_bmad-output/implementation-artifacts/stories/`. Para descoberta consistente das skills compartilhadas, iniciar Claude na raiz da coordenação. Se a sessão foi aberta aqui, reabrir na raiz ou invocar a skill lendo seu caminho explicitamente; não presumir descoberta de catálogo entre repositórios.

Comandos Git e testes do componente executam neste diretório. Project-root do BMAD continua sendo a pasta pai, nunca instalar outra cópia aqui. Estado: DEV-002, DEV-007 e DEV-013 implementadas (bootstrap Vue, tela neutra acessível, ESLint, smoke Cypress e auditoria de produção no `verify`, que requer rede; overrides de dependências documentados no README.md); `npm run test:e2e` exige o binário do Cypress (`npx cypress install`); ainda sem rotas, cliente HTTP, autenticação ou fluxos bancários. Versões e comandos no README.md.
