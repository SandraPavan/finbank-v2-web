# finbank-v2-web

Frontend Vue/TypeScript do FinBank V2. Documentação oficial, regras e histórias ficam na coordenação (`../_bmad-output/`, `../.claude/rules/`).

Estado atual (DEV-002): somente bootstrap e uma tela neutra acessível. Sem rotas, cliente HTTP, autenticação, fluxos bancários ou valores financeiros. O navegador nunca é autoridade financeira; valores monetários futuros serão renderizados a partir de centavos inteiros recebidos da API.

## Runtime e versões

| Item | Versão |
|---|---|
| Node.js | 24.21.0 (`.nvmrc`; `engines: >=24.15.0 <25`) |
| npm | 11.19.0 (`packageManager`), lockfile versionado |
| Vue | 3.5.45 |
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
npm run verify      # lint + typecheck + test + build
```

Não há variáveis de ambiente nem dependência da API ou de credenciais nesta etapa.

## Smoke E2E (DEV-007)

`cypress/e2e/foundation.cy.ts` verifica no navegador real (Electron headless do Cypress 16.3.0, servindo o build por `vite preview`):

- HTTP 200, `lang="pt-BR"` e título;
- landmarks únicos e um único `h1`;
- ausência de `console.error`;
- axe-core **com** `color-contrast`, que o jsdom não mede.

Detalhes de execução:
- **Binário:** o npm 11 bloqueia o install script, então o binário é instalado com `npx cypress install`.
- **VS Code:** o script `cy:run` remove `ELECTRON_RUN_AS_NODE`, exportada pelos terminais da extensão do VS Code.
- **Artefatos:** screenshots de falha ficam em `cypress/screenshots/`, ignorado pelo Git.

Guia de qualidade: `../docs/quality.md`.

## Acessibilidade

A tela usa `lang="pt-BR"`, landmarks `header`/`main`/`footer`, um único `h1` e foco visível. O teste executa axe-core no jsdom; a regra `color-contrast` é desabilitada ali porque exige layout real (cores escolhidas: texto `#1a1a1a`/`#3d3d3d` sobre `#ffffff`/`#f2f2f2`). Verificação automatizada não substitui teste com teclado e leitor de tela quando houver elementos interativos.

## Imagem Docker (DEV-004)

`Dockerfile` multi-stage: `node:24.21.0-bookworm-slim` executa `npm ci` e `npm run build`, e `nginxinc/nginx-unprivileged:1.30.6-alpine` serve o `dist/` na porta 8080, sem root (`nginx.conf`, sem proxy para a API). O `.dockerignore` exclui `node_modules`, `dist`, `.env` e Git. Orquestração em `../finbank-v2-infra`.
