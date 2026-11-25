import { $, checkA11y, expectNoTraces, open, press } from '../support/helpers';

const PASSWORD = 'senha de teste longa';
const TOKEN = 'T'.repeat(43);
const CREDENTIAL = 'AAAA-BBBB-CCCC-DDDD-EEEE';

const session = (profile: string, extra: object = {}) => ({
  identityId: 'i', profile, workspaceId: profile === 'CUSTOMER' ? 'w' : null, passwordChangeRequired: false,
  idleExpiresAt: '2026-01-01T00:00:00.000Z', absoluteExpiresAt: '2026-01-01T00:00:00.000Z', ...extra,
});
const problem = (statusCode: number, code: string, headers: Record<string, string> = {}) => ({
  statusCode, headers: { 'content-type': 'application/problem+json', ...headers }, body: { status: statusCode, code, correlationId: 'corr-12345678' },
});
const api = (method: 'GET' | 'POST', path: string, reply: object) => cy.intercept(method, `/api/v1${path}`, reply);
const anonymous = () => api('GET', '/auth/me', problem(401, 'AUTH_SESSION_REQUIRED')).as('me');
const signedIn = (profile: string, extra: object = {}) => api('GET', '/auth/me', { body: session(profile, extra) }).as('me');

function workspaceA(): void {
  api('GET', '/facilitator/workspaces?offset=0', { body: { items: [{ workspaceId: 'w1', alias: 'turma-a' }], nextOffset: null } });
  api('GET', '/facilitator/workspaces/w1', { body: { workspaceId: 'w1', alias: 'turma-a' } });
  api('GET', '/facilitator/workspaces/w1/customers?offset=0', {
    body: { items: [{ customerId: 'c1', email: 'ana@example.test', status: 'ACTIVE' }, { customerId: 'c2', email: 'bia@example.test', status: 'DISABLED' }], nextOffset: null },
  });
}

beforeEach(() => {
  api('GET', '/auth/csrf', { body: { csrfToken: TOKEN } });
});

describe('entrada', () => {
  it('página servida com idioma, título e estrutura; sem chamadas externas', () => {
    anonymous();
    cy.request('/').its('status').should('eq', 200);
    open('/nada');
    cy.get($('message')).should('contain.text', 'não encontrado');
    checkA11y();
    open('/t/INVALIDO');
    cy.get($('problem')).should('be.visible');
    checkA11y();
    open('/facilitador');
    checkA11y();
    open('/');
    cy.document().its('documentElement.lang').should('eq', 'pt-BR');
    cy.title().should('eq', 'Entrar no FinBank V2 — FinBank V2');
    cy.get('h1').should('have.length', 1);
    cy.get('footer').should('contain.text', 'Ambiente educacional simulado');
    cy.window().then((win) => {
      const hosts = new Set(win.performance.getEntriesByType('resource').map((r) => new URL(r.name).host));
      expect([...hosts]).to.deep.equal([win.location.host]);
    });
    checkA11y();
  });

  it('cliente entra só com o teclado, da página inicial à própria área', () => {
    anonymous();
    api('POST', '/auth/customer/login', { body: session('CUSTOMER', { csrfToken: TOKEN }) }).as('login');
    open('/');
    cy.get('body').click(0, 0);
    press('Tab');
    cy.focused().should('have.attr', 'data-testid', 'field-alias').type('turma-a{enter}');
    cy.location('pathname').should('eq', '/t/turma-a');
    cy.focused().should('match', 'h1');
    press('Tab');
    cy.focused().should('have.attr', 'data-testid', 'field-email').type('ana@example.test');
    press('Tab');
    cy.focused().should('have.attr', 'data-testid', 'field-password').type(PASSWORD);
    checkA11y();
    press('Tab');
    cy.focused().should('have.attr', 'data-testid', 'submit').type('{enter}');
    cy.wait('@login').its('request.headers').should('include', { 'x-csrf-token': TOKEN });
    cy.location('pathname').should('eq', '/inicio');
    cy.focused().should('match', 'h1').and('contain.text', 'Sua área');
    checkA11y();
    expectNoTraces([PASSWORD, TOKEN]);
  });

  it('recusas e espera são anunciadas e acessíveis', () => {
    anonymous();
    open('/t/turma-a');
    cy.get($('submit')).click();
    cy.focused().should('have.attr', 'data-testid', 'field-email').and('have.attr', 'aria-invalid', 'true');
    checkA11y();
    api('POST', '/auth/customer/login', problem(401, 'AUTH_INVALID_CREDENTIALS'));
    cy.get($('field-email')).type('ana@example.test');
    cy.get($('field-password')).type(`${PASSWORD}{enter}`);
    cy.get(`${$('problem')} [role=alert]`).should('contain.text', 'Não foi possível entrar');
    cy.focused().should('have.attr', 'data-testid', 'field-password').and('have.value', '');
    checkA11y();
    api('POST', '/auth/customer/login', problem(429, 'RATE_LIMIT_EXCEEDED', { 'retry-after': '5' }));
    cy.get($('field-password')).type(`${PASSWORD}{enter}`);
    cy.get($('countdown')).should('contain.text', '3 segundos');
    cy.get(`${$('problem')} [role=alert]`).should('contain.text', '5 segundos');
    api('POST', '/auth/customer/login', { statusCode: 502, body: '<html></html>' });
    cy.get($('field-password')).type(`${PASSWORD}{enter}`);
    cy.get($('problem')).should('contain.text', 'indisponível');
    checkA11y();
    expectNoTraces([PASSWORD]);
  });
});

describe('sessão', () => {
  it('rota protegida leva ao login e é retomada; sair e voltar não mostra dados', () => {
    anonymous();
    workspaceA();
    api('POST', '/auth/facilitator/login', { body: session('FACILITATOR', { csrfToken: TOKEN }) });
    api('POST', '/auth/logout', { statusCode: 204 }).as('logout');
    open('/facilitador/workspaces/w1');
    cy.location('pathname').should('eq', '/facilitador');
    cy.get($('notice')).should('contain.text', 'Entre para continuar');
    checkA11y();
    cy.get($('field-email')).type('f@example.test');
    cy.get($('field-password')).type(`${PASSWORD}{enter}`);
    cy.location('pathname').should('eq', '/facilitador/workspaces/w1');
    cy.get($('customer')).should('have.length', 2);
    cy.get($('logout')).click();
    cy.wait('@logout');
    cy.location('pathname').should('eq', '/');
    cy.go('back');
    cy.get($('customer')).should('not.exist');
    cy.contains('ana@example.test').should('not.exist');
    expectNoTraces([PASSWORD, TOKEN]);
  });

  it('recarregar mantém; expirada avisa; perfil errado e API fora têm tela própria', () => {
    signedIn('CUSTOMER');
    open('/inicio');
    cy.reload();
    cy.get($('customer-area')).should('be.visible');
    open('/facilitador/workspaces');
    cy.get($('message')).should('contain.text', 'não tem acesso');
    checkA11y();
    api('GET', '/auth/me', problem(401, 'AUTH_SESSION_EXPIRED'));
    open('/inicio');
    cy.get($('notice')).should('contain.text', 'expirou');
    api('GET', '/auth/me', { forceNetworkError: true });
    open('/inicio');
    cy.get($('message')).should('contain.text', 'indisponível');
    checkA11y();
    signedIn('CUSTOMER');
    cy.get($('retry')).click();
    cy.get($('customer-area')).should('be.visible');
  });

  it('troca de senha: erros por campo, sucesso e limpeza', () => {
    signedIn('CUSTOMER');
    open('/senha');
    checkA11y();
    cy.get($('field-current-password')).type(PASSWORD);
    cy.get($('field-new-password')).type('nova senha bem longa');
    cy.get($('field-repeat-password')).type('diferente{enter}');
    cy.focused().should('have.attr', 'data-testid', 'field-repeat-password');
    checkA11y();
    api('POST', '/auth/password/change', { body: session('CUSTOMER', { csrfToken: 'U'.repeat(43) }) }).as('change');
    cy.get($('field-repeat-password')).clear().type('nova senha bem longa{enter}');
    cy.wait('@change');
    cy.get($('notice')).should('contain.text', 'Senha trocada');
    cy.get($('field-new-password')).should('have.value', '');
    checkA11y();
    expectNoTraces([PASSWORD, 'nova senha bem longa', 'U'.repeat(43)]);
  });

  it('recuperação: só a troca obrigatória é utilizável', () => {
    anonymous();
    api('POST', '/auth/customer/login', { body: session('CUSTOMER', { passwordChangeRequired: true, csrfToken: TOKEN }) });
    api('POST', '/auth/password/recovery', { body: session('CUSTOMER', { csrfToken: TOKEN }) });
    open('/t/turma-a');
    cy.get($('field-email')).type('ana@example.test');
    cy.get($('field-password')).type(`${CREDENTIAL}{enter}`);
    cy.location('pathname').should('eq', '/recuperar');
    checkA11y();
    signedIn('CUSTOMER', { passwordChangeRequired: true });
    open('/inicio');
    cy.location('pathname').should('eq', '/recuperar');
    cy.get($('field-new-password')).type(PASSWORD);
    cy.get($('field-repeat-password')).type(`${PASSWORD}{enter}`);
    cy.location('pathname').should('eq', '/inicio');
    expectNoTraces([CREDENTIAL, PASSWORD]);
  });
});

describe('facilitador', () => {
  beforeEach(() => {
    signedIn('FACILITATOR');
    workspaceA();
  });

  it('escolhe o workspace; estados vazios e listas acessíveis', () => {
    open('/facilitador/workspaces');
    cy.get($('workspace')).should('contain.text', 'turma-a');
    checkA11y();
    cy.get($('workspace')).click();
    cy.get($('customer')).should('have.length', 2);
    checkA11y();
    api('GET', '/facilitator/workspaces?offset=0', { body: { items: [], nextOffset: null } });
    open('/facilitador/workspaces');
    cy.get($('empty')).should('be.visible');
    checkA11y();
  });

  it('diálogo prende o foco, Esc cancela e o foco volta a quem abriu', () => {
    open('/facilitador/workspaces/w1');
    cy.get($('toggle-status')).first().focus().type('{enter}');
    cy.get($('dialog')).should('be.visible');
    checkA11y();
    for (let i = 0; i < 4; i += 1) {
      press('Tab');
      cy.document().then((doc) => {
        const inside = doc.activeElement?.closest('dialog') !== null || doc.activeElement === doc.body;
        expect(inside, 'foco no diálogo ou no navegador').to.equal(true);
      });
    }
    cy.get($('dialog')).trigger('cancel');
    cy.get($('dialog')).should('not.exist');
    cy.focused().should('have.attr', 'data-testid', 'toggle-status');
  });

  it('desativar confirma e envia uma vez', () => {
    let sent = 0;
    cy.intercept('POST', '/api/v1/facilitator/workspaces/w1/customers/c1/disable', (request) => {
      sent += 1;
      request.reply({ delay: 300, body: { customerId: 'c1', status: 'DISABLED' } });
    });
    open('/facilitador/workspaces/w1');
    cy.get($('toggle-status')).first().click();
    cy.get($('confirm')).dblclick();
    cy.get($('customer-status')).first().should('have.text', 'Desativado');
    cy.then(() => expect(sent).to.equal(1));
    checkA11y();
  });

  it('credencial aparece uma vez e não deixa rastro', () => {
    api('POST', '/facilitator/workspaces/w1/customers/c1/password-reset', {
      body: { customerId: 'c1', temporaryCredential: CREDENTIAL, expiresAt: '2026-11-25T12:00:00.000Z' },
    });
    open('/facilitador/workspaces/w1');
    cy.get($('issue-credential')).first().click();
    cy.get($('confirm')).click();
    cy.get($('credential')).should('have.text', CREDENTIAL);
    cy.focused().should('have.attr', 'data-testid', 'copy');
    checkA11y();
    expectNoTraces([CREDENTIAL]);
    cy.get($('close')).click();
    cy.contains(CREDENTIAL).should('not.exist');
    cy.reload();
    cy.contains(CREDENTIAL).should('not.exist');
    api('POST', '/facilitator/workspaces/w1/customers/c1/password-reset', problem(409, 'IDENTITY_STATE_CONFLICT'));
    cy.get($('issue-credential')).first().click();
    cy.get($('confirm')).click();
    cy.get($('problem')).should('contain.text', 'desativado ou não tem senha');
    checkA11y();
  });
});
