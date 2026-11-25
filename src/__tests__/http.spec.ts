import { describe, expect, it } from 'vitest';
import { Api } from '../api/api';
import { ApiError, Http } from '../api/http';
import { type Answer, fakeApi, opened, OTHER_TOKEN, problem, sessionBody, TOKEN } from './support';

function setup(routes: Record<string, Answer | Answer[]>) {
  const fake = fakeApi(routes);
  return { ...fake, api: new Api(new Http({ fetch: fake.send })) };
}

async function failure(work: Promise<unknown>): Promise<ApiError> {
  const error = await work.then(() => undefined, (e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('token CSRF', () => {
  it('é obtido antes da primeira escrita e renovado pelo login', async () => {
    const s = setup({ 'POST /auth/customer/login': opened('CUSTOMER'), 'POST /auth/logout-all': { status: 204 } });
    await s.api.loginCustomer('turma', 'a@b', 'x');
    await s.api.logoutAll();
    expect(s.calls.map((c) => [c.method, c.path, c.token])).toEqual([
      ['GET', '/auth/csrf', null], ['POST', '/auth/customer/login', TOKEN], ['POST', '/auth/logout-all', OTHER_TOKEN],
    ]);
  });

  it('depois de sair é obtido de novo', async () => {
    const s = setup({ 'POST /auth/logout': { status: 204 }, 'POST /auth/facilitator/login': opened('FACILITATOR') });
    await s.api.logout();
    await s.api.loginFacilitator('a@b', 'x');
    expect(s.calls.map((c) => c.path)).toEqual(['/auth/csrf', '/auth/logout', '/auth/csrf', '/auth/facilitator/login']);
  });

  it('recusa renova o token e não reenvia a escrita', async () => {
    const s = setup({
      'GET /auth/csrf': [{ body: { csrfToken: TOKEN } }, { body: { csrfToken: OTHER_TOKEN } }],
      'POST /auth/password/change': [problem(403, 'CSRF_VALIDATION_FAILED'), opened('CUSTOMER')],
    });
    expect((await failure(s.api.changePassword('a', 'b'))).code).toBe('CSRF_VALIDATION_FAILED');
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    await s.api.changePassword('a', 'b');
    expect(s.calls.at(-1)?.token).toBe(OTHER_TOKEN);
  });

  it('leituras não levam token', async () => {
    const s = setup({ 'GET /auth/me': { body: sessionBody('CUSTOMER') } });
    await s.api.me();
    expect(s.calls[0]?.token).toBeNull();
  });
});

describe('requisições', () => {
  it('usam a própria origem, sem cache nem redirecionamento, e codificam o caminho', async () => {
    const s = setup({ 'GET /facilitator/workspaces/a%2F..%2Fb': { body: { workspaceId: 'x', alias: null } } });
    await s.api.workspace('a/../b');
    const [url, init] = (s.send as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/facilitator/workspaces/a%2F..%2Fb');
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
  });
});

describe('falhas', () => {
  it.each([
    ['rede', 'network', 'TEMPORARY_UNAVAILABLE'],
    ['proxy sem API', { status: 502, body: '<html>502</html>' }, 'TEMPORARY_UNAVAILABLE'],
    ['503 da API', problem(503, 'TEMPORARY_UNAVAILABLE'), 'TEMPORARY_UNAVAILABLE'],
    ['500', problem(500, 'INTERNAL_ERROR'), 'INTERNAL_ERROR'],
    ['404 sem problema', { status: 404, body: 'x' }, 'UNEXPECTED_RESPONSE'],
    ['código estranho', { status: 400, body: { code: '<b>x</b>' } }, 'UNEXPECTED_RESPONSE'],
    ['HTML com 200', { body: '<html></html>' }, 'UNEXPECTED_RESPONSE'],
    ['campo ausente', { body: { ...sessionBody('CUSTOMER'), profile: undefined } }, 'UNEXPECTED_RESPONSE'],
    ['perfil desconhecido', { body: { ...sessionBody('CUSTOMER'), profile: 'ADMIN' } }, 'UNEXPECTED_RESPONSE'],
    ['sinal ausente', { body: { ...sessionBody('CUSTOMER'), passwordChangeRequired: 'sim' } }, 'UNEXPECTED_RESPONSE'],
  ] as [string, Answer, string][])('%s', async (_label, answer, code) => {
    const s = setup({ 'GET /auth/me': answer });
    expect((await failure(s.api.me())).code).toBe(code);
  });

  it('correlação e espera só em formato conhecido', async () => {
    const s = setup({ 'GET /auth/me': [problem(429, 'RATE_LIMIT_EXCEEDED', { 'Retry-After': '30' }), { status: 429, headers: { 'Retry-After': 'amanhã', 'X-Correlation-ID': '<img>' }, body: { code: 'RATE_LIMIT_EXCEEDED' } }] });
    expect(await failure(s.api.me())).toMatchObject({ correlationId: 'corr-12345678', retryAfterSeconds: 30 });
    expect(await failure(s.api.me())).toMatchObject({ correlationId: null, retryAfterSeconds: null });
  });

  it.each([
    { items: {}, nextOffset: null }, { items: [], nextOffset: '20' }, { items: [{ workspaceId: 1, alias: null }], nextOffset: null },
  ])('página fora do contrato nunca vira dado parcial: %j', async (body) => {
    const s = setup({ 'GET /facilitator/workspaces?offset=0': { body } });
    expect((await failure(s.api.workspaces(0))).code).toBe('UNEXPECTED_RESPONSE');
  });

  it.each([{ temporaryCredential: 'X', expiresAt: 'x' }, { expiresAt: '2026-01-01T00:00:00Z' }])('credencial fora do contrato: %j', async (body) => {
    const s = setup({ 'POST /facilitator/workspaces/w/customers/c/password-reset': { body } });
    expect((await failure(s.api.resetCustomerPassword('w', 'c'))).code).toBe('UNEXPECTED_RESPONSE');
  });
});
