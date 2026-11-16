import { defineConfig } from 'cypress';

// Smoke E2E da interface de fundação (DEV-007), contra o build servido por `vite preview`.
export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:4173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false,
  },
  video: false,
  screenshotOnRunFailure: true,
  screenshotsFolder: 'cypress/screenshots',
  downloadsFolder: 'cypress/downloads',
});
