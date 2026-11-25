# finbank-v2-web

Frontend Vue/TypeScript do FinBank V2. Este repositório é público e autossuficiente: setup, execução e testes dependem só dele. As referências a histórias (DEV-xxx) vêm da documentação interna da equipe e não são necessárias para usar o projeto.

Estado atual (DEV-021): autenticação de clientes e facilitadores (entrada, saída, troca e recuperação de senha), escolha de workspace e administração de clientes pelo facilitador. Sem cadastro, conta, saldo ou PIX. O navegador nunca é autoridade: a API decide cada operação, e esconder um botão não substitui a recusa dela.

| Rota | Tela |
|---|---|
| `/` | Código da turma e atalho do facilitador |
| `/t/:alias` | Entrada do cliente (link direto da turma) |
| `/facilitador` | Entrada do facilitador |
| `/inicio` | Área do cliente |
| `/facilitador/workspaces` e `/facilitador/workspaces/:workspaceId` | Workspaces e clientes |
| `/senha` | Troca de senha |
| `/recuperar` | Troca obrigatória após credencial temporária |

- **Mesma origem:** `/api/` vai à API por proxy (nginx na imagem; Vite em `dev` e `preview`, com `API_PROXY_TARGET`, padrão `http://127.0.0.1:13000`). O `Host` original é preservado. Sem CORS.
- **Segredos:** a sessão fica no cookie `HttpOnly`; token CSRF, senha e credencial temporária só em memória, nunca em URL, armazenamento do navegador ou console. Escritas não são reenviadas automaticamente.
- **Imagem:** o nginx envia CSP restrita e `no-store` no HTML, e sobe mesmo sem a API.

## Seletores estáveis

`data-testid` é contrato para automação; mudanças são registradas aqui. Campos e erros seguem `field-<campo>` e `error-<campo>`, com os campos alias, email, password, current-password, new-password e repeat-password.

<!-- seletores -->
`alias` `alias-form` `area-link` `cancel` `close` `confirm` `copy` `countdown` `credential` `customer` `customer-area` `customer-status` `customers` `dialog` `empty` `facilitator-link` `home-link` `issue-credential` `load-more` `login-form` `logout` `logout-all` `message` `nav-change-password` `notice` `password-form` `problem` `retry` `submit` `toggle-status` `workspace` `workspaces` `workspaces-link`
<!-- /seletores -->

## Runtime e versões

| Item | Versão |
|---|---|
| Node.js | 24.21.0 (`.nvmrc`; `engines: >=24.15.0 <25`) |
| npm | 11.19.0 (`packageManager`), lockfile versionado |
| Vue / `vue-router` | 3.5.45 / 4.6.5 (linha 4: a 5 declara ferramentas de build como dependências de produção) |
| Pact (`@pact-foundation/pact`, só desenvolvimento) | 17.1.4 |
| Vite / `@vitejs/plugin-vue` | 8.3.7 / 6.0.10 |
| TypeScript / `vue-tsc` / `@vue/tsconfig` | 6.0.3 / 3.3.14 / 0.9.1 |
| Vitest / `@vue/test-utils` / jsdom / axe-core | 4.1.12 / 2.5.1 / 30.1.3 / 4.14.0 |
| ESLint / `@eslint/js` / `typescript-eslint` / `eslint-plugin-vue` / `@vue/eslint-config-typescript` / `globals` | 10.15.0 / 10.0.1 / 8.72.2 / 10.12.1 / 14.9.0 / 17.14.0 |
| Cypress / `start-server-and-test` | 16.3.0 / 3.0.13 |

Dependências fixadas com versão exata (`.npmrc`: `save-exact=true`, `engine-strict=true`). Vitest alinhado com `finbank-v2-api`.

## Comandos

```sh
npm ci              # instala exatamente o lockfile
npm run dev         # servidor de desenvolvimento Vite
npm run lint        # ESLint (Vue essential + TypeScript), --max-warnings 0
npm run typecheck   # vue-tsc --build (app, testes, configs e Cypress)
npm run build       # typecheck + vite build em dist/
npm run preview     # serve dist/ localmente
npm test            # vitest run (jsdom)
npm run test:e2e    # build + vite preview (127.0.0.1:4173) + Cypress no navegador
npm run test:contract    # contrato do consumidor (Pact): regrava pacts/
npm run test:e2e:stack   # jornada real contra o Compose (veja abaixo)
npm run audit:prod  # npm audit --omit=dev --audit-level=high (requer rede)
npm run verify      # audit:prod + lint + typecheck + test + build (requer rede)
```

`npm test`, `test:contract` e `test:e2e` não precisam da API: usam respostas simuladas.

## Dependências e auditoria (DEV-013)

`npm run verify` começa por `audit:prod`, que falha com qualquer aviso alto ou crítico em dependências de produção. O passo consulta o registro do npm: sem rede, o `verify` falha nesse ponto, e um aviso publicado depois pode fazê-lo falhar sem mudança de código.

Overrides em `package.json`, restritos ao pacote que puxa a versão afetada (nunca globais) e com versões publicadas há pelo menos 7 dias quando adotadas:

| Pacote que puxa | Override | Motivo |
|---|---|---|
| `js-beautify` (`@vue/test-utils` 2.5.1) | `glob` 14.0.6, e `minimatch` 11.0.8 dentro dele | `glob` 13.0.7 e `minimatch` 10.2.6 afetados por avisos moderados |
| `editorconfig` (`js-beautify`) | `minimatch` 11.0.8 | `minimatch` 10.2.6 afetado por aviso moderado |
| `@typescript-eslint/typescript-estree` (`typescript-eslint` 8.72.2, `eslint-plugin-vue`) | `minimatch` 11.0.8 | idem; é a versão usada por `typescript-eslint` 8.73.0 e pelo ESLint |

Compatibilidade verificada com as suítes, o E2E e a CLI do `js-beautify` com `.editorconfig` e padrão glob (resolução de seções idêntica à da versão anterior). Ao atualizar `@vue/test-utils` ou `typescript-eslint`, remova o override correspondente se a nova versão já trouxer a dependência corrigida e confirme com `npm audit` e `npm ls glob minimatch`. Situação na adoção: `npm audit` sem avisos (produção e desenvolvimento). Não usar `npm audit fix`: as correções sugeridas rebaixam dependências diretas.

## E2E

- **`test:e2e`** (`cypress/e2e/`): navegador real, build servido por `vite preview` e API interceptada. Cobre as jornadas, teclado, foco, axe com contraste em cada tela e estado, e a ausência de segredos em URL, armazenamento e console.
- **`test:e2e:stack`** (`cypress/stack/`): jornada real contra o Compose, com a CSP do servidor ativa. **Altera senhas** das identidades usadas: use um projeto descartável. Prepare com `scripts/admin.sh` do `finbank-v2-infra` e informe `STACK_URL`, `STACK_ALIAS`, `STACK_CUSTOMER_EMAIL`, `STACK_FACILITATOR_EMAIL` e `STACK_PASSWORD` (a mesma para os dois).
- **Binário:** o npm 11 bloqueia o install script, então o binário é instalado com `npx cypress install`.
- **VS Code:** os scripts removem `ELECTRON_RUN_AS_NODE`, exportada pelos terminais da extensão do VS Code.
- **Artefatos:** screenshots de falha ficam em `cypress/screenshots/`, ignorado pelo Git.

## Contrato com a API (Pact)

`contract/` descreve as requisições que a interface faz e o que ela lê das respostas; `npm run test:contract` regrava `pacts/finbank-v2-web-finbank-v2-api.json`, versionado. Depois de mudá-lo, copie-o para `test/contract/pacts/` do `finbank-v2-api`, que o verifica contra a API real; o `verify.sh` do `finbank-v2-infra` acusa cópias diferentes. Usa binário nativo de dependência opcional; sem suporte à plataforma, só este comando não roda. A telemetria do pacote fica desligada.

**Qualidade:** ESLint com `--max-warnings 0`, typecheck estrito, Vitest e PostgreSQL real nos testes de integração. Os testes cobrem o comportamento correto. Não há meta percentual de cobertura.

## Acessibilidade

Idioma `pt-BR`, landmarks e um `h1` por tela; ao trocar de tela o foco vai ao título, e em erro ao primeiro campo; erros são anunciados; diálogos nativos prendem o foco e o devolvem. axe roda no jsdom (sem contraste) e no navegador (com contraste). Verificação automatizada não substitui leitor de tela.

## Imagem Docker (DEV-004)

`Dockerfile` multi-stage: `node:24.21.0-bookworm-slim` executa `npm ci` e `npm run build`, e `nginxinc/nginx-unprivileged:1.30.6-alpine` serve o `dist/` na porta 8080, sem root (`nginx.conf`, com proxy de `/api/` para `http://api:3000`). O `.dockerignore` exclui `node_modules`, `dist`, `.env` e Git. Orquestração em `../finbank-v2-infra`.
