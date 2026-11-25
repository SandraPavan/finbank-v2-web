import { defineConfig } from 'cypress';

// Jornada real contra o ambiente do Compose. Dados criados antes pela linha de comando do operador.
export default defineConfig({
  e2e: {
    baseUrl: process.env['STACK_URL'] ?? 'http://127.0.0.1:18080',
    specPattern: 'cypress/stack/**/*.cy.ts',
    supportFile: false,
    // A política do servidor vale também sob o Cypress, que por padrão a remove.
    experimentalCspAllowList: true,
  },
  expose: {
    alias: process.env['STACK_ALIAS'],
    customerEmail: process.env['STACK_CUSTOMER_EMAIL'],
    facilitatorEmail: process.env['STACK_FACILITATOR_EMAIL'],
    password: process.env['STACK_PASSWORD'],
  },
  video: false,
  screenshotOnRunFailure: false,
});
