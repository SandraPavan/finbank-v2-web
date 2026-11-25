// Jornada real contra o Compose: nginx com CSP, API e PostgreSQL. Altera as senhas das identidades usadas.
import { $, expectNoTraces, open } from '../support/helpers';

const { alias, customerEmail, facilitatorEmail, password } = Cypress.expose() as Record<string, string>;
const CHANGED = 'senha trocada na jornada';
const RECOVERED = 'senha recuperada na jornada';

function enter(path: string, email: string, secret: string): void {
  open(path);
  cy.get($('field-email')).type(email);
  cy.get($('field-password')).type(`${secret}{enter}`, { log: false });
}

it('entrada, troca, desativação, recuperação e saída de ponta a ponta', () => {
  cy.request('/').then(({ headers }) => {
    expect(headers['content-security-policy']).to.contain("default-src 'self'");
    expect(headers['cache-control']).to.equal('no-store');
  });

  // Turma inexistente e senha errada têm a mesma recusa.
  for (const path of ['/t/turma-que-nao-existe', `/t/${alias}`]) {
    enter(path, customerEmail ?? '', 'senha errada bem longa');
    cy.get($('problem')).should('contain.text', 'Não foi possível entrar');
  }

  enter(`/t/${alias}`, customerEmail ?? '', password ?? '');
  cy.get($('customer-area')).should('be.visible');
  cy.getCookie('finbank_session').should('include', { httpOnly: true, sameSite: 'strict' });
  cy.reload();
  cy.get($('customer-area')).should('be.visible');
  cy.get($('nav-change-password')).click();
  cy.get($('field-current-password')).type(password ?? '', { log: false });
  cy.get($('field-new-password')).type(CHANGED);
  cy.get($('field-repeat-password')).type(`${CHANGED}{enter}`);
  cy.get($('notice')).should('contain.text', 'Senha trocada');
  cy.get($('logout-all')).click();
  cy.location('pathname').should('eq', '/');
  cy.getCookie('finbank_session').should('not.exist');

  // Facilitador: desativa, reativa e emite.
  enter('/facilitador', facilitatorEmail ?? '', password ?? '');
  cy.get($('workspace')).contains(alias ?? '').click();
  cy.contains($('customer'), customerEmail ?? '').within(() => cy.get($('toggle-status')).click());
  cy.get($('confirm')).click();
  cy.contains($('customer'), customerEmail ?? '').find($('customer-status')).should('have.text', 'Desativado');
  cy.contains($('customer'), customerEmail ?? '').within(() => cy.get($('issue-credential')).click());
  cy.get($('confirm')).click();
  cy.get($('problem')).should('contain.text', 'desativado');
  cy.contains($('customer'), customerEmail ?? '').within(() => cy.get($('toggle-status')).click());
  cy.contains($('customer'), customerEmail ?? '').find($('customer-status')).should('have.text', 'Ativo');
  cy.contains($('customer'), customerEmail ?? '').within(() => cy.get($('issue-credential')).click());
  cy.get($('confirm')).click();
  cy.get($('credential'))
    .invoke('text')
    .then((credential) => {
      expect(credential).to.match(/^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$/);
      expectNoTraces([credential]);
      cy.get($('close')).click();
      cy.get($('logout')).click();
      cy.location('pathname').should('eq', '/');

      enter(`/t/${alias}`, customerEmail ?? '', CHANGED);
      cy.get($('problem')).should('contain.text', 'Não foi possível entrar');
      enter(`/t/${alias}`, customerEmail ?? '', credential);
      cy.location('pathname').should('eq', '/recuperar');
      cy.visit('/inicio');
      cy.location('pathname').should('eq', '/recuperar');
      cy.get($('field-new-password')).type(credential);
      cy.get($('field-repeat-password')).type(`${credential}{enter}`);
      cy.get($('error-new-password')).should('contain.text', 'diferente da credencial');
      cy.get($('field-new-password')).type(RECOVERED);
      cy.get($('field-repeat-password')).type(`${RECOVERED}{enter}`);
      cy.get($('customer-area')).should('be.visible');
      cy.get($('logout')).click();
      cy.location('pathname').should('eq', '/');
      cy.getCookie('finbank_session').should('not.exist');
    });
});
