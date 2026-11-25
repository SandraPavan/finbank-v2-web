import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Answer, opened, problem, sessionBody, start } from './support';

const ANON = { 'GET /auth/me': problem(401, 'AUTH_SESSION_REQUIRED') };
const CUSTOMER = { 'GET /auth/me': { body: sessionBody('CUSTOMER') } };
const FACILITATOR = { 'GET /auth/me': { body: sessionBody('FACILITATOR') } };
const PASSWORD = 'senha de teste longa';
const LIST = 'GET /facilitator/workspaces?offset=0';
const W = { workspaceId: 'w1', alias: 'turma-a' };
const C = { customerId: 'c1', email: 'ana@example.test', status: 'ACTIVE' };
const customers = (items: unknown[] = [C], nextOffset: number | null = null): Record<string, Answer> => ({
  ...FACILITATOR, 'GET /facilitator/workspaces/w1': { body: W }, 'GET /facilitator/workspaces/w1/customers?offset=0': { body: { items, nextOffset } },
});
const RESET = 'POST /facilitator/workspaces/w1/customers/c1/password-reset';
const ISSUED = { body: { customerId: 'c1', temporaryCredential: 'AAAA-BBBB-CCCC-DDDD-EEEE', expiresAt: '2026-11-25T12:00:00.000Z' } };

afterEach(() => {
  vi.useRealTimers();
});

describe('entrada', () => {
  it('início leva ao login da turma e recusa código malformado com foco no campo', async () => {
    const s = await start('/', ANON);
    for (const bad of ['', 'AB', 'Turma', 'a b c', '-abc', 'a'.repeat(41)]) {
      await s.fill({ alias: bad });
      await s.submit();
      expect(s.find('error-alias')?.textContent).toMatch(/3 a 40/);
      expect(document.activeElement).toBe(s.find('field-alias'));
    }
    await s.fill({ alias: ' turma-a ' });
    await s.submit();
    expect(s.path()).toBe('/t/turma-a');
    expect(s.find('alias')?.textContent).toContain('turma-a');
    expect(s.calls.every((c) => c.path === '/auth/me')).toBe(true);
  });

  it('cliente entra pela turma do endereço e chega à própria área', async () => {
    const s = await start('/t/turma-a', { ...ANON, 'POST /auth/customer/login': opened('CUSTOMER') });
    await s.fill({ email: ' Ana@Example.test ', password: PASSWORD });
    await s.submit();
    expect(s.calls.at(-1)).toMatchObject({ path: '/auth/customer/login', body: { alias: 'turma-a', email: 'Ana@Example.test', password: PASSWORD } });
    expect(s.path()).toBe('/inicio');
    expect(s.find('customer-area')).not.toBeNull();
  });

  it('facilitador entra e chega aos workspaces', async () => {
    const s = await start('/facilitador', { ...ANON, 'POST /auth/facilitator/login': opened('FACILITATOR'), [LIST]: { body: { items: [], nextOffset: null } } });
    await s.fill({ email: 'f@example.test', password: PASSWORD });
    await s.submit();
    expect(s.path()).toBe('/facilitador/workspaces');
    expect(s.text()).toContain('Você ainda não tem workspaces');
  });

  it('endereço com código malformado não chama o login', async () => {
    const s = await start('/t/TURMA', ANON);
    expect(s.find('login-form')).toBeNull();
    expect(s.find('problem')?.textContent).toMatch(/3 a 40/);
  });

  it('recusa limpa a senha, mantém o e-mail e devolve o foco; HTML não é interpretado', async () => {
    const s = await start('/t/turma-a', { ...ANON, 'POST /auth/customer/login': problem(401, 'AUTH_INVALID_CREDENTIALS') });
    await s.fill({ email: '<img src=x>', password: PASSWORD });
    await s.submit();
    expect(s.find('problem')?.textContent).toContain('Não foi possível entrar');
    expect([s.value('email'), s.value('password')]).toEqual(['<img src=x>', '']);
    expect(document.activeElement).toBe(s.find('field-password'));
    expect(s.host.querySelector('img')).toBeNull();
    expect(s.session.state.status).toBe('anonymous');
  });

  it('campos vazios não chamam a API', async () => {
    const s = await start('/facilitador', ANON);
    await s.submit();
    expect(document.activeElement).toBe(s.find('field-email'));
    expect(s.calls).toHaveLength(1);
  });

  it('429 conta a espera sem reanunciar', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const s = await start('/facilitador', { ...ANON, 'POST /auth/facilitator/login': problem(429, 'RATE_LIMIT_EXCEEDED', { 'Retry-After': '3' }) });
    await s.fill({ email: 'f@x', password: PASSWORD });
    await s.submit();
    const alert = s.find('problem')?.querySelector('[role=alert]');
    expect(alert?.textContent).toContain('3 segundos');
    vi.advanceTimersByTime(2000);
    await flushPromises();
    expect(s.find('countdown')?.textContent).toContain('1 segundos');
    expect(s.find('countdown')?.getAttribute('aria-hidden')).toBe('true');
    expect(alert?.textContent).toContain('3 segundos');
    vi.advanceTimersByTime(9000);
    await flushPromises();
    expect(s.find('countdown')?.textContent).toContain(' 0 segundos');
  });

  it.each([
    ['indisponível', 'network' as Answer, 'Serviço indisponível'],
    ['inesperada', problem(500, 'INTERNAL_ERROR'), 'Código para suporte: corr-12345678'],
    ['CSRF', problem(403, 'CSRF_VALIDATION_FAILED'), 'mudou em outra aba'],
  ])('%s é distinguida e não reenvia', async (_label, answer, message) => {
    const s = await start('/facilitador', { ...ANON, 'POST /auth/facilitator/login': answer });
    await s.fill({ email: 'f@x', password: PASSWORD });
    await s.submit();
    expect(s.find('problem')?.textContent).toContain(message);
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('cliques repetidos enviam uma vez', async () => {
    const s = await start('/facilitador', { ...ANON, 'POST /auth/facilitator/login': problem(401, 'AUTH_INVALID_CREDENTIALS') });
    await s.fill({ email: 'f@x', password: PASSWORD });
    const form = s.host.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    await flushPromises();
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });
});

describe('sessão e guardas', () => {
  it.each([
    ['/inicio', '/'], ['/senha', '/'], ['/recuperar', '/'], ['/facilitador/workspaces', '/facilitador'], ['/facilitador/workspaces/w1', '/facilitador'],
  ])('sem sessão, %s leva a %s com aviso e sem dados', async (from, to) => {
    const s = await start(from, ANON);
    expect(s.path()).toBe(to);
    expect(s.find('notice')?.textContent).toBe('Entre para continuar.');
    expect(s.calls).toHaveLength(1);
  });

  it('sessão expirada tem aviso próprio', async () => {
    const s = await start('/inicio', { 'GET /auth/me': problem(401, 'AUTH_SESSION_EXPIRED') });
    expect(s.find('notice')?.textContent).toContain('expirou');
  });

  it('recarregar mantém a sessão; rota pedida antes é retomada, só se couber ao perfil', async () => {
    expect((await start('/inicio', CUSTOMER)).path()).toBe('/inicio');
    const s = await start('/facilitador/workspaces/w1', { ...customers(), ...ANON, 'POST /auth/facilitator/login': opened('FACILITATOR') });
    await s.fill({ email: 'f@x', password: PASSWORD });
    await s.submit();
    expect(s.path()).toBe('/facilitador/workspaces/w1');
  });

  it('destino nunca vem da URL', async () => {
    const s = await start('/t/turma-a?next=https://evil.example&redirect=//evil.example', { ...ANON, 'POST /auth/customer/login': opened('CUSTOMER') });
    await s.fill({ email: 'a@b', password: PASSWORD });
    await s.submit();
    expect(s.router.currentRoute.value.fullPath).toBe('/inicio');
  });

  it('rota pedida por outro perfil não é retomada', async () => {
    const s = await start('/facilitador/workspaces', { ...ANON, 'POST /auth/customer/login': opened('CUSTOMER') });
    await s.router.push('/t/turma-a');
    await flushPromises();
    await s.fill({ email: 'a@b', password: PASSWORD });
    await s.submit();
    expect(s.path()).toBe('/inicio');
  });

  it('perfil errado mostra sem acesso e não consulta dados', async () => {
    const s = await start('/facilitador/workspaces', CUSTOMER);
    expect(s.find('message')?.textContent).toContain('não tem acesso');
    expect(s.calls).toHaveLength(1);
    expect((await start('/inicio', FACILITATOR)).find('message')?.textContent).toContain('não tem acesso');
  });

  it('403 da API na própria tela é mostrado: a tela não decide', async () => {
    const s = await start('/facilitador/workspaces', { ...FACILITATOR, [LIST]: problem(403, 'ACCESS_DENIED') });
    expect(s.find('problem')?.textContent).toContain('não tem acesso');
  });

  it('API fora: mostra indisponibilidade e tenta de novo a pedido', async () => {
    const s = await start('/inicio', { 'GET /auth/me': ['network', 'network', 'network', { body: sessionBody('CUSTOMER') }] });
    expect(s.find('message')?.textContent).toContain('indisponível');
    s.set('GET /auth/me', { body: sessionBody('CUSTOMER') });
    await s.click('retry');
    expect(s.find('customer-area')).not.toBeNull();
    const off = await start('/inicio', { 'GET /auth/me': 'network' });
    off.set('GET /auth/me', problem(401, 'AUTH_SESSION_REQUIRED'));
    await off.click('retry');
    expect(off.path()).toBe('/');
  });

  it('página pública abre com a API fora', async () => {
    expect((await start('/t/turma-a', { 'GET /auth/me': 'network' })).find('login-form')).not.toBeNull();
  });

  it.each([['logout', '/auth/logout'], ['logout-all', '/auth/logout-all']])('%s leva ao início, mesmo com a sessão já encerrada', async (button, path) => {
    for (const answer of [{ status: 204 }, problem(401, 'AUTH_SESSION_REQUIRED')]) {
      const s = await start('/inicio', { ...CUSTOMER, [`POST ${path}`]: answer });
      await s.click(button);
      expect(s.path()).toBe('/');
      expect(s.find('logout')).toBeNull();
      expect(s.session.state).toMatchObject({ status: 'anonymous', profile: null });
      await s.router.push('/inicio');
      expect(s.path()).toBe('/');
    }
  });

  it('falha ao sair mantém a sessão e avisa', async () => {
    const s = await start('/inicio', { ...CUSTOMER, 'POST /auth/logout': 'network' });
    await s.click('logout');
    expect([s.path(), s.find('problem')?.textContent?.includes('indisponível')]).toEqual(['/inicio', true]);
  });

  it('título da página e foco no título ao trocar de tela', async () => {
    const s = await start('/', ANON);
    expect(document.title).toBe('Entrar no FinBank V2 — FinBank V2');
    await s.router.push('/facilitador');
    await flushPromises();
    expect(document.title).toBe('Entrar como facilitador — FinBank V2');
    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('endereço desconhecido', async () => {
    expect((await start('/nada/aqui', ANON)).find('message')?.textContent).toContain('não encontrado');
  });
});

describe('senha', () => {
  const change = 'POST /auth/password/change';

  it('confere repetição e tamanho antes de enviar, com foco no primeiro erro', async () => {
    const s = await start('/senha', CUSTOMER);
    await s.fill({ 'current-password': '', 'new-password': 'curta', 'repeat-password': 'x' });
    await s.submit();
    expect(document.activeElement).toBe(s.find('field-current-password'));
    await s.fill({ 'current-password': PASSWORD });
    await s.submit();
    expect(document.activeElement).toBe(s.find('field-new-password'));
    await s.fill({ 'new-password': '🙂'.repeat(12), 'repeat-password': 'outra' });
    await s.submit();
    expect(s.find('error-repeat-password')?.textContent).toContain('não coincidem');
    expect(document.activeElement).toBe(s.find('field-repeat-password'));
    expect(s.calls).toHaveLength(1);
  });

  async function changeWith(answer: Answer) {
    const s = await start('/senha', { ...CUSTOMER, [change]: answer });
    await s.fill({ 'current-password': PASSWORD, 'new-password': 'nova senha bem longa', 'repeat-password': 'nova senha bem longa' });
    await s.submit();
    expect([s.value('current-password'), s.value('new-password'), s.value('repeat-password')].every((v) => v === '' || v === undefined)).toBe(true);
    return s;
  }

  it('troca, avisa e continua na sessão', async () => {
    const s = await changeWith(opened('CUSTOMER'));
    expect(s.find('notice')?.textContent).toContain('Senha trocada');
    expect(s.session.state.status).toBe('active');
  });

  it.each([
    ['AUTH_CURRENT_PASSWORD_INVALID', 'error-current-password', 'Senha atual incorreta'],
    ['PASSWORD_POLICY_VIOLATION', 'error-new-password', '12 a 128'],
  ])('%s fica no campo e não perde a sessão', async (code, field, message) => {
    const s = await changeWith(problem(422, code));
    expect(s.find(field)?.textContent).toContain(message);
    expect([s.path(), s.session.state.status]).toEqual(['/senha', 'active']);
  });

  it('CSRF recusado mantém a tela, relê a sessão e não reenvia', async () => {
    const s = await changeWith(problem(403, 'CSRF_VALIDATION_FAILED'));
    expect(s.find('problem')?.textContent).toContain('outra aba');
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(s.calls.filter((c) => c.path === '/auth/me')).toHaveLength(2);
  });

  it('sessão perdida no envio volta ao login', async () => {
    const s = await changeWith(problem(401, 'AUTH_SESSION_EXPIRED'));
    expect([s.path(), s.find('notice')?.textContent?.includes('expirou')]).toEqual(['/', true]);
  });
});

describe('recuperação', () => {
  const RESTRICTED = { 'GET /auth/me': { body: sessionBody('FACILITATOR', { passwordChangeRequired: true }) } };

  it('login com credencial temporária leva à troca obrigatória e, depois, à área', async () => {
    const s = await start('/t/turma-a', {
      ...ANON, 'POST /auth/customer/login': opened('CUSTOMER', { passwordChangeRequired: true }), 'POST /auth/password/recovery': opened('CUSTOMER'),
    });
    await s.fill({ email: 'a@b', password: 'AAAA-BBBB-CCCC-DDDD-EEEE' });
    await s.submit();
    expect(s.path()).toBe('/recuperar');
    expect(s.find('field-current-password')).toBeNull();
    await s.fill({ 'new-password': PASSWORD, 'repeat-password': PASSWORD });
    await s.submit();
    expect(s.calls.at(-1)).toMatchObject({ path: '/auth/password/recovery', body: { newPassword: PASSWORD } });
    expect([s.path(), s.session.state.status]).toEqual(['/inicio', 'active']);
  });

  it.each(['/', '/t/turma-a', '/facilitador', '/inicio', '/senha', '/facilitador/workspaces', '/facilitador/workspaces/w1', '/nada'])(
    'sessão restrita só vê a troca obrigatória: %s',
    async (path) => {
      const s = await start(path, RESTRICTED);
      expect(s.path()).toBe('/recuperar');
      expect(s.find('nav-change-password')).toBeNull();
      expect(s.find('logout')).not.toBeNull();
    },
  );

  it('PASSWORD_CHANGE_REQUIRED em qualquer chamada leva à troca', async () => {
    const s = await start('/facilitador/workspaces', { ...FACILITATOR, [LIST]: problem(403, 'PASSWORD_CHANGE_REQUIRED') });
    expect(s.path()).toBe('/recuperar');
  });

  it('política diz que a senha deve ser diferente da credencial', async () => {
    const s = await start('/recuperar', { ...RESTRICTED, 'POST /auth/password/recovery': problem(422, 'PASSWORD_POLICY_VIOLATION') });
    await s.fill({ 'new-password': PASSWORD, 'repeat-password': PASSWORD });
    await s.submit();
    expect(s.find('error-new-password')?.textContent).toContain('diferente da credencial temporária');
  });

  it('sessão normal não fica na tela de recuperação', async () => {
    expect((await start('/recuperar', CUSTOMER)).path()).toBe('/inicio');
  });
});

describe('facilitador', () => {
  it('lista, pagina e leva aos clientes do workspace da rota', async () => {
    const s = await start('/facilitador/workspaces', {
      ...customers(), [LIST]: { body: { items: [W], nextOffset: 1 } },
      'GET /facilitator/workspaces?offset=1': { body: { items: [{ workspaceId: 'w2', alias: null }], nextOffset: null } },
    });
    await s.click('load-more');
    expect(s.all('workspace').map((e) => e.firstChild?.textContent?.trim())).toEqual(['turma-a', 'Sem código']);
    expect(s.find('load-more')).toBeNull();
    await s.click('workspace');
    expect(s.path()).toBe('/facilitador/workspaces/w1');
    expect(s.find('alias')?.textContent).toContain('turma-a');
    expect(s.all('customer')).toHaveLength(1);
  });

  it('mudar de workspace troca todos os dados', async () => {
    const s = await start('/facilitador/workspaces/w1', {
      ...customers(), 'GET /facilitator/workspaces/w2': { body: { workspaceId: 'w2', alias: 'turma-b' } },
      'GET /facilitator/workspaces/w2/customers?offset=0': { body: { items: [], nextOffset: null } },
    });
    await s.router.push('/facilitador/workspaces/w2');
    await flushPromises();
    expect(s.text()).not.toContain('ana@example.test');
    expect(s.find('empty')?.textContent).toContain('Nenhum cliente');
  });

  it('workspace alheio: não encontrado, sem detalhe', async () => {
    const s = await start('/facilitador/workspaces/w9', {
      ...FACILITATOR, 'GET /facilitator/workspaces/w9': problem(404, 'RESOURCE_NOT_FOUND'),
      'GET /facilitator/workspaces/w9/customers?offset=0': problem(404, 'RESOURCE_NOT_FOUND'),
    });
    expect(s.find('problem')?.textContent).toContain('não encontrado');
    expect(s.text()).not.toContain('w9');
  });

  it('e-mail é texto, nunca HTML', async () => {
    const s = await start('/facilitador/workspaces/w1', customers([{ ...C, email: '<img src=x onerror=alert(1)>@x' }]));
    expect(s.host.querySelector('img')).toBeNull();
    expect(s.find('customer')?.textContent).toContain('<img');
  });

  it('desativar confirma, envia uma vez e devolve o foco; reativar é direto', async () => {
    const base = '/facilitator/workspaces/w1/customers/c1';
    const s = await start('/facilitador/workspaces/w1', {
      ...customers(), [`POST ${base}/disable`]: { body: { customerId: 'c1', status: 'DISABLED' } }, [`POST ${base}/enable`]: { body: { customerId: 'c1', status: 'ACTIVE' } },
    });
    s.find('toggle-status')?.focus();
    await s.click('toggle-status');
    expect(s.find('dialog')?.textContent).toContain('Desativar ana@example.test? As sessões serão encerradas.');
    expect(s.calls.some((c) => c.method === 'POST')).toBe(false);
    s.find('cancel')?.focus();
    await s.click('cancel');
    expect(s.find('dialog')).toBeNull();
    expect(document.activeElement).toBe(s.find('toggle-status'));
    await s.click('toggle-status');
    s.find('confirm')?.click();
    s.find('confirm')?.click();
    await flushPromises();
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(s.find('customer-status')?.textContent).toBe('Desativado');
    await s.click('toggle-status');
    expect(s.find('customer-status')?.textContent).toBe('Ativo');
  });

  it('credencial aparece uma vez e some ao fechar, navegar e sair', async () => {
    const s = await start('/facilitador/workspaces/w1', { ...customers(), [RESET]: ISSUED, [LIST]: { body: { items: [W], nextOffset: null } }, 'POST /auth/logout': { status: 204 } });
    const credential = ISSUED.body.temporaryCredential;
    const issue = async () => {
      await s.click('issue-credential');
      expect(s.find('dialog')?.textContent).toContain('deixam de valer agora');
      await s.click('confirm');
      expect(s.find('credential')?.textContent).toBe(credential);
      expect(document.activeElement).toBe(s.find('copy'));
    };
    await issue();
    expect(s.find('dialog')?.textContent).toMatch(/não será mostrada de novo\. Vale até \d{2}\/\d{2}\/\d{4}/);
    await s.click('close');
    expect(s.text()).not.toContain(credential);
    await issue();
    await s.router.push('/facilitador/workspaces');
    await flushPromises();
    expect(document.body.textContent).not.toContain(credential);
    await s.router.back();
    await flushPromises();
    expect(document.body.textContent).not.toContain(credential);
    await issue();
    await s.click('logout');
    expect(document.body.textContent).not.toContain(credential);
    const everywhere = JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie, document.title, s.router.currentRoute.value.fullPath]);
    expect(everywhere).not.toContain(credential);
  });

  it('copiar usa a área de transferência', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const s = await start('/facilitador/workspaces/w1', { ...customers(), [RESET]: ISSUED });
    await s.click('issue-credential');
    await s.click('confirm');
    await s.click('copy');
    expect(writeText).toHaveBeenCalledExactlyOnceWith(ISSUED.body.temporaryCredential);
    vi.unstubAllGlobals();
  });

  it.each([
    ['conflito', problem(409, 'IDENTITY_STATE_CONFLICT'), 'desativado ou não tem senha'],
    ['cliente sumiu', problem(404, 'RESOURCE_NOT_FOUND'), 'não encontrado'],
    ['CSRF', problem(403, 'CSRF_VALIDATION_FAILED'), 'outra aba'],
    ['fora', 'network' as Answer, 'indisponível'],
  ])('emissão com %s fecha o diálogo, avisa e não repete', async (_label, answer, message) => {
    const s = await start('/facilitador/workspaces/w1', { ...customers(), [RESET]: answer });
    await s.click('issue-credential');
    await s.click('confirm');
    expect(s.find('dialog')).toBeNull();
    expect(s.find('problem')?.textContent).toContain(message);
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('identidade trocada em outra aba: a tela acompanha', async () => {
    const s = await start('/facilitador/workspaces/w1', { ...customers(), [RESET]: problem(403, 'CSRF_VALIDATION_FAILED'), 'GET /auth/me': [{ body: sessionBody('FACILITATOR') }, { body: sessionBody('CUSTOMER') }] });
    await s.click('issue-credential');
    await s.click('confirm');
    expect(s.text()).not.toContain('ana@example.test');
    expect(s.find('message')?.textContent).toContain('não tem acesso');
  });
});

describe('estrutura', () => {
  it.each<[string, Record<string, Answer | Answer[]>]>([
    ['/', ANON], ['/t/turma-a', ANON], ['/t/X', ANON], ['/facilitador', ANON], ['/inicio', CUSTOMER], ['/senha', CUSTOMER],
    ['/recuperar', { 'GET /auth/me': { body: sessionBody('CUSTOMER', { passwordChangeRequired: true }) } }],
    ['/facilitador/workspaces', { ...FACILITATOR, [LIST]: { body: { items: [W], nextOffset: 1 } } }],
    ['/facilitador/workspaces/w1', customers()], ['/nada', ANON], ['/inicio', FACILITATOR], ['/inicio', { 'GET /auth/me': 'network' }],
  ])('landmarks, um h1, aviso fixo e axe em %s', async (path, routes) => {
    const s = await start(path, routes);
    for (const tag of ['header', 'main', 'footer', 'h1']) {
      expect(s.host.querySelectorAll(tag), tag).toHaveLength(1);
    }
    expect(s.host.querySelector('footer')?.textContent).toContain('Ambiente educacional simulado. Use apenas dados fictícios.');
    expect(s.text()).not.toMatch(/R\$|\bsaldo\b|\bextrato\b|\bpix\b/i);
    const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === '__tests__' ? [] : sources(join(dir, e.name))) : [readFileSync(join(dir, e.name), 'utf8')],
    );

  it('sem HTML não confiável, armazenamento do navegador ou log no código', () => {
    for (const source of sources('src')) {
      expect(source).not.toMatch(/v-html|innerHTML|localStorage|sessionStorage|indexedDB|document\.cookie|console\./);
    }
  });

  it('seletores de teste correspondem exatamente à lista do README', () => {
    const used = new Set(sources('src').flatMap((s) => [...s.matchAll(/[^:]data-testid="([^"]+)"/g)].map((m) => m[1] ?? '')));
    const readme = readFileSync('README.md', 'utf8');
    const listed = /<!-- seletores -->([\s\S]*?)<!-- \/seletores -->/.exec(readme)?.[1] ?? '';
    expect([...listed.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).sort()).toEqual([...used].sort());
  });

  it('index.html declara idioma, título e viewport', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<html lang="pt-BR">/);
    expect(html).toMatch(/<title>FinBank V2<\/title>/);
    expect(html).toMatch(/<meta name="viewport"/);
  });
});
