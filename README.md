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

Dependências fixadas com versão exata (`.npmrc`: `save-exact=true`, `engine-strict=true`). Vitest alinhado com `finbank-v2-api`.

## Comandos

```sh
npm ci              # instala exatamente o lockfile
npm run dev         # servidor de desenvolvimento Vite
npm run typecheck   # vue-tsc --build (app, testes e config)
npm run build       # typecheck + vite build em dist/
npm run preview     # serve dist/ localmente
npm test            # vitest run (jsdom)
```

Não há variáveis de ambiente nem dependência da API ou de credenciais nesta etapa.

## Acessibilidade

A tela usa `lang="pt-BR"`, landmarks `header`/`main`/`footer`, um único `h1` e foco visível. O teste executa axe-core no jsdom; a regra `color-contrast` é desabilitada ali porque exige layout real (cores escolhidas: texto `#1a1a1a`/`#3d3d3d` sobre `#ffffff`/`#f2f2f2`). Verificação automatizada não substitui teste com teclado e leitor de tela quando houver elementos interativos.

## Imagem Docker (DEV-004)

`Dockerfile` multi-stage: `node:24.21.0-bookworm-slim` executa `npm ci` e `npm run build`, e `nginxinc/nginx-unprivileged:1.30.6-alpine` serve o `dist/` na porta 8080, sem root (`nginx.conf`, sem proxy para a API). O `.dockerignore` exclui `node_modules`, `dist`, `.env` e Git. Orquestração em `../finbank-v2-infra`.
