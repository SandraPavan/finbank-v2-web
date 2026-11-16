import type { AxeResults, RunOptions } from 'axe-core';

type WindowWithAxe = Window & { axe?: { run(context: Document, options: RunOptions): Promise<AxeResults> } };

describe('interface de fundação no navegador real', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.spy(win.console, 'error').as('consoleError');
      },
    });
  });

  it('serve a página com HTTP 200, idioma e título', () => {
    cy.request('/').its('status').should('eq', 200);
    cy.document().its('documentElement.lang').should('eq', 'pt-BR');
    cy.title().should('eq', 'FinBank V2');
  });

  it('renderiza a estrutura semântica neutra sem erros no console', () => {
    cy.get('header').should('have.length', 1);
    cy.get('main').should('have.length', 1);
    cy.get('footer').should('have.length', 1);
    cy.get('h1').should('have.length', 1).and('contain.text', 'FinBank V2');
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('não tem violações de acessibilidade do axe, incluindo contraste de cor', () => {
    cy.readFile('node_modules/axe-core/axe.min.js').then((source: string) => {
      cy.window().then((win) => {
        const script = win.document.createElement('script');
        script.textContent = source;
        win.document.head.appendChild(script);
      });
    });
    cy.window()
      .then((win) => {
        const axe = (win as WindowWithAxe).axe;
        if (axe === undefined) {
          throw new Error('axe-core não foi carregado');
        }
        return axe.run(win.document, { resultTypes: ['violations'] });
      })
      .then((results) => {
        expect(results.violations.map((violation) => violation.id)).to.deep.equal([]);
      });
  });
});
