import { defineConfig } from 'vitest/config';

// Contratos do consumidor (Pact), fora do `npm test`: usam o servidor simulado nativo do Pact.
export default defineConfig({
  test: { environment: 'node', include: ['contract/**/*.pact.spec.ts'], testTimeout: 30_000, fileParallelism: false },
});
