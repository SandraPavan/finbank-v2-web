import type { AxeResults, RunOptions } from 'axe-core';

type WindowWithAxe = Window & { axe?: { run(context: Document, options: RunOptions): Promise<AxeResults> } };

export const $ = (id: string): string => `[data-testid="${id}"]`;

export function checkA11y(): void {
  cy.readFile('node_modules/axe-core/axe.min.js').then((source: string) => {
    cy.window().then((win) => {
      (win as unknown as { eval(code: string): void }).eval(source);
    });
  });
  cy.window()
    .then((win) => {
      const { axe } = win as WindowWithAxe;
      if (axe === undefined) {
        throw new Error('axe-core não foi carregado');
      }
      return axe.run(win.document, { resultTypes: ['violations'] });
    })
    .then((results) => {
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`)).to.deep.equal([]);
    });
}

/** Nenhum segredo em URL, armazenamento, cookie legível, título ou console. */
export function expectNoTraces(secrets: string[]): void {
  cy.window().then((win) => {
    const places = JSON.stringify([win.location.href, { ...win.localStorage }, { ...win.sessionStorage }, win.document.cookie, win.document.title, win.history.state]);
    for (const secret of secrets) {
      expect(places).not.to.contain(secret);
    }
  });
  for (const method of ['log', 'error', 'warn', 'info', 'debug']) {
    cy.get<sinon.SinonSpy>(`@console.${method}`).then((spy) => {
      const written = JSON.stringify(spy.args);
      for (const secret of secrets) {
        expect(written).not.to.contain(secret);
      }
    });
  }
}

export function open(path: string): void {
  cy.visit(path, {
    onBeforeLoad(win) {
      for (const method of ['log', 'error', 'warn', 'info', 'debug'] as const) {
        cy.spy(win.console, method).as(`console.${method}`);
      }
    },
  });
}

/** Tab real do navegador, sem o simulado. */
export function press(key: 'Tab'): void {
  cy.press(key === 'Tab' ? Cypress.Keyboard.Keys.TAB : key);
}
