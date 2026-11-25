// Contrato do consumidor: as requisições que a interface faz e o que ela lê das respostas.
import { resolve } from 'node:path';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';
import { Api } from '../src/api/api';
import { ApiError, Http } from '../src/api/http';

const { regex, string, integer, eachLike, like } = MatchersV3;

const SECRET = 'S'.repeat(43);
const TOKEN = 'T'.repeat(43);
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const FACILITATOR = '33333333-3333-4333-8333-333333333333';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PASSWORD = 'senha de contrato longa';
const NEW_PASSWORD = 'outra senha de contrato';
/** Reconhecido pelo provedor como token propositalmente errado. */
const WRONG_TOKEN = 'X'.repeat(43);

const pact = new PactV3({ consumer: 'finbank-v2-web', provider: 'finbank-v2-api', dir: resolve('pacts'), logLevel: 'error' });

const token = regex('^[A-Za-z0-9_-]{43}$', TOKEN);
const json = { 'Content-Type': 'application/json; charset=utf-8' };
const sessionCookie = { Cookie: regex('^finbank_session=[A-Za-z0-9_-]{43}$', `finbank_session=${SECRET}`) };
const preauthCookie = { Cookie: regex('^finbank_preauth=[A-Za-z0-9_-]{43}$', `finbank_preauth=${SECRET}`) };
const csrf = { 'X-CSRF-Token': token };
const jsonRequest = { 'Content-Type': 'application/json' };

const info = (profile: 'CUSTOMER' | 'FACILITATOR', restricted = false) => ({
  identityId: regex(`^${UUID}$`, profile === 'CUSTOMER' ? CUSTOMER : FACILITATOR),
  profile,
  workspaceId: profile === 'CUSTOMER' ? regex(`^${UUID}$`, WORKSPACE) : null,
  passwordChangeRequired: restricted,
});
const opened = (profile: 'CUSTOMER' | 'FACILITATOR', restricted = false) => ({ ...info(profile, restricted), csrfToken: token });

const problem = (status: number, code: string, headers: Record<string, ReturnType<typeof regex>> = {}) => ({
  status,
  headers: { 'Content-Type': 'application/problem+json; charset=utf-8', ...headers },
  body: { code, correlationId: regex('^[A-Za-z0-9._-]{8,64}$', 'corr-12345678') },
});

type Headers = Record<string, string | ReturnType<typeof regex>>;
interface Case {
  readonly name: string;
  readonly state: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly query?: Record<string, string>;
  readonly headers?: Headers;
  readonly body?: Record<string, string>;
  readonly response: { status: number; headers?: Headers; body?: unknown };
  /** Cookie que o navegador enviaria. */
  readonly cookie?: string;
  readonly run: (api: Api) => Promise<unknown>;
  readonly expected?: unknown;
  readonly error?: Partial<ApiError>;
  readonly token?: string;
}

const A = '/api/v1';
const SESSION = `finbank_session=${SECRET}`;
const PREAUTH = `finbank_preauth=${SECRET}`;
const customerPath = `${A}/facilitator/workspaces/${WORKSPACE}/customers`;

const login = (kind: 'customer' | 'facilitator', name: string, state: string, body: Record<string, string>, response: Case['response'], run: Case['run'], rest: Partial<Case>): Case => ({
  name, state, method: 'POST', path: `${A}/auth/${kind}/login`, headers: { ...jsonRequest, ...preauthCookie, ...csrf }, body, response, cookie: PREAUTH, run, ...rest,
});
const customerLogin = { alias: 'turma-contrato', email: 'cliente@contrato.test', password: PASSWORD };
const facilitatorLogin = { email: 'facilitador@contrato.test', password: PASSWORD };
const asCustomer: Case['run'] = (api) => api.loginCustomer(customerLogin.alias, customerLogin.email, PASSWORD);
const asFacilitator: Case['run'] = (api) => api.loginFacilitator(facilitatorLogin.email, PASSWORD);

const read = (name: string, state: string, path: string, response: Case['response'], run: Case['run'], rest: Partial<Case>): Case => ({
  name, state, method: 'GET', path, headers: sessionCookie, response, cookie: SESSION, run, ...rest,
});
const write = (name: string, state: string, path: string, response: Case['response'], run: Case['run'], rest: Partial<Case>): Case => ({
  name, state, method: 'POST', path, headers: { ...(rest.body === undefined ? {} : jsonRequest), ...sessionCookie, ...csrf }, response, cookie: SESSION, run, ...rest,
});

const ok = (body: unknown) => ({ status: 200, headers: json, body });
const ME = `${A}/auth/me`;
const LIST = `${A}/facilitator/workspaces`;

const CASES: Case[] = [
  login('customer', 'login de cliente', 'cliente com senha', customerLogin, ok(opened('CUSTOMER')), asCustomer, { expected: { profile: 'CUSTOMER', passwordChangeRequired: false } }),
  login('customer', 'login de cliente recusado', 'cliente com outra senha', customerLogin, problem(401, 'AUTH_INVALID_CREDENTIALS'), asCustomer, { error: { code: 'AUTH_INVALID_CREDENTIALS' } }),
  login('customer', 'login de cliente restrito por tentativas', 'cliente com login restrito', customerLogin, problem(429, 'RATE_LIMIT_EXCEEDED', { 'Retry-After': regex('^[1-9][0-9]*$', '30') }), asCustomer, { error: { code: 'RATE_LIMIT_EXCEEDED', retryAfterSeconds: 30 } }),
  login('customer', 'login de cliente com credencial temporária', 'cliente cuja credencial temporária é a senha informada', customerLogin, ok(opened('CUSTOMER', true)), asCustomer, { expected: { profile: 'CUSTOMER', passwordChangeRequired: true } }),
  login('facilitator', 'login de facilitador', 'facilitador com senha', facilitatorLogin, ok(opened('FACILITATOR')), asFacilitator, { expected: { profile: 'FACILITATOR', workspaceId: null } }),
  login('facilitator', 'login com token de outro contexto', 'facilitador com senha', facilitatorLogin, problem(403, 'CSRF_VALIDATION_FAILED'), asFacilitator, {
    error: { code: 'CSRF_VALIDATION_FAILED' }, token: WRONG_TOKEN, headers: { ...jsonRequest, ...preauthCookie, 'X-CSRF-Token': WRONG_TOKEN },
  }),

  read('sessão de cliente', 'sessão de cliente', ME, ok(info('CUSTOMER')), (api) => api.me(), { expected: { profile: 'CUSTOMER', workspaceId: WORKSPACE } }),
  read('sessão de facilitador', 'sessão de facilitador', ME, ok(info('FACILITATOR')), (api) => api.me(), { expected: { profile: 'FACILITATOR' } }),
  read('sessão restrita', 'sessão restrita de cliente', ME, ok(info('CUSTOMER', true)), (api) => api.me(), { expected: { passwordChangeRequired: true } }),
  { name: 'sem sessão', state: 'sem sessão', method: 'GET', path: ME, response: problem(401, 'AUTH_SESSION_REQUIRED'), run: (api) => api.me(), error: { code: 'AUTH_SESSION_REQUIRED', correlationId: 'corr-12345678' } },
  read('sessão expirada', 'sessão expirada de cliente', ME, problem(401, 'AUTH_SESSION_EXPIRED'), (api) => api.me(), { error: { code: 'AUTH_SESSION_EXPIRED' } }),
  read('banco indisponível', 'sessão de cliente com banco indisponível', ME, problem(503, 'TEMPORARY_UNAVAILABLE'), (api) => api.me(), { error: { code: 'TEMPORARY_UNAVAILABLE' } }),

  write('sair', 'sessão de cliente', `${A}/auth/logout`, { status: 204 }, (api) => api.logout(), {}),
  write('sair de todas', 'sessão de cliente', `${A}/auth/logout-all`, { status: 204 }, (api) => api.logoutAll(), {}),
  write('trocar senha', 'sessão de cliente', `${A}/auth/password/change`, ok(opened('CUSTOMER')), (api) => api.changePassword(PASSWORD, NEW_PASSWORD), { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, expected: { passwordChangeRequired: false } }),
  write('trocar com senha atual errada', 'sessão de cliente', `${A}/auth/password/change`, problem(422, 'AUTH_CURRENT_PASSWORD_INVALID'), (api) => api.changePassword('senha errada longa', NEW_PASSWORD), { body: { currentPassword: 'senha errada longa', newPassword: NEW_PASSWORD }, error: { code: 'AUTH_CURRENT_PASSWORD_INVALID' } }),
  write('trocar por senha fora da política', 'sessão de cliente', `${A}/auth/password/change`, problem(422, 'PASSWORD_POLICY_VIOLATION'), (api) => api.changePassword(PASSWORD, 'curta'), { body: { currentPassword: PASSWORD, newPassword: 'curta' }, error: { code: 'PASSWORD_POLICY_VIOLATION' } }),
  write('concluir recuperação', 'sessão restrita de cliente', `${A}/auth/password/recovery`, ok(opened('CUSTOMER')), (api) => api.completeRecovery(NEW_PASSWORD), { body: { newPassword: NEW_PASSWORD }, expected: { passwordChangeRequired: false } }),
  write('concluir com a credencial temporária', 'sessão restrita de cliente', `${A}/auth/password/recovery`, problem(422, 'PASSWORD_POLICY_VIOLATION'), (api) => api.completeRecovery(PASSWORD), { body: { newPassword: PASSWORD }, error: { code: 'PASSWORD_POLICY_VIOLATION' } }),

  read('workspaces', 'sessão de facilitador', LIST, ok({ items: eachLike({ workspaceId: regex(`^${UUID}$`, WORKSPACE), alias: string('turma-contrato') }), nextOffset: null }), (api) => api.workspaces(0), { query: { offset: '0' }, expected: { items: [{ workspaceId: WORKSPACE, alias: 'turma-contrato' }], nextOffset: null } }),
  read('workspaces com mais páginas', 'sessão de facilitador com muitos workspaces', LIST, ok({ items: eachLike({ workspaceId: regex(`^${UUID}$`, WORKSPACE), alias: like(null) }, 20), nextOffset: integer(20) }), (api) => api.workspaces(0), { query: { offset: '0' }, expected: { nextOffset: 20 } }),
  read('workspaces por cliente', 'sessão de cliente', LIST, problem(403, 'ACCESS_DENIED'), (api) => api.workspaces(0), { query: { offset: '0' }, error: { code: 'ACCESS_DENIED' } }),
  read('workspaces em sessão restrita', 'sessão restrita de facilitador', LIST, problem(403, 'PASSWORD_CHANGE_REQUIRED'), (api) => api.workspaces(0), { query: { offset: '0' }, error: { code: 'PASSWORD_CHANGE_REQUIRED' } }),
  read('workspace', 'sessão de facilitador', `${LIST}/${WORKSPACE}`, ok({ workspaceId: WORKSPACE, alias: string('turma-contrato') }), (api) => api.workspace(WORKSPACE), { expected: { workspaceId: WORKSPACE, alias: 'turma-contrato' } }),
  read('workspace sem vínculo', 'sessão de facilitador sem vínculo', `${LIST}/${WORKSPACE}`, problem(404, 'RESOURCE_NOT_FOUND'), (api) => api.workspace(WORKSPACE), { error: { code: 'RESOURCE_NOT_FOUND' } }),

  read('clientes', 'sessão de facilitador', customerPath, ok({ items: eachLike({ customerId: regex(`^${UUID}$`, CUSTOMER), email: string('cliente@contrato.test'), status: regex('^(ACTIVE|DISABLED)$', 'ACTIVE') }), nextOffset: null }), (api) => api.customers(WORKSPACE, 0), { query: { offset: '0' }, expected: { items: [{ customerId: CUSTOMER, email: 'cliente@contrato.test', status: 'ACTIVE' }] } }),
  write('desativar cliente', 'sessão de facilitador', `${customerPath}/${CUSTOMER}/disable`, ok({ customerId: CUSTOMER, status: 'DISABLED' }), (api) => api.setCustomerStatus(WORKSPACE, CUSTOMER, 'DISABLED'), { expected: 'DISABLED' }),
  write('reativar cliente', 'sessão de facilitador com cliente desativado', `${customerPath}/${CUSTOMER}/enable`, ok({ customerId: CUSTOMER, status: 'ACTIVE' }), (api) => api.setCustomerStatus(WORKSPACE, CUSTOMER, 'ACTIVE'), { expected: 'ACTIVE' }),
  write('emitir credencial', 'sessão de facilitador', `${customerPath}/${CUSTOMER}/password-reset`, ok({ customerId: CUSTOMER, temporaryCredential: regex('^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$', 'AAAA-BBBB-CCCC-DDDD-EEEE'), expiresAt: regex('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$', '2026-11-25T12:00:00.000Z') }), (api) => api.resetCustomerPassword(WORKSPACE, CUSTOMER), { expected: { temporaryCredential: 'AAAA-BBBB-CCCC-DDDD-EEEE', expiresAt: '2026-11-25T12:00:00.000Z' } }),
  write('emitir para cliente desativado', 'sessão de facilitador com cliente desativado', `${customerPath}/${CUSTOMER}/password-reset`, problem(409, 'IDENTITY_STATE_CONFLICT'), (api) => api.resetCustomerPassword(WORKSPACE, CUSTOMER), { error: { code: 'IDENTITY_STATE_CONFLICT' } }),
  write('emitir sem vínculo', 'sessão de facilitador sem vínculo', `${customerPath}/${CUSTOMER}/password-reset`, problem(404, 'RESOURCE_NOT_FOUND'), (api) => api.resetCustomerPassword(WORKSPACE, CUSTOMER), { error: { code: 'RESOURCE_NOT_FOUND' } }),
];

/** Cliente da aplicação com o que o navegador faria: cookie anexado e token já obtido. */
function client(baseUrl: string, item: Case): Api {
  const send: typeof fetch = (input, init) => {
    if (String(input).endsWith('/auth/csrf') && item.path !== `${A}/auth/csrf`) {
      return Promise.resolve(Response.json({ csrfToken: item.token ?? TOKEN }));
    }
    return fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(item.cookie === undefined ? {} : { Cookie: item.cookie }) } });
  };
  return new Api(new Http({ baseUrl, fetch: send }));
}

describe('contrato da interface com a API', () => {
  it.each(CASES.map((item) => [item.name, item] as const))('%s', async (name, item) => {
    pact.addInteraction({
      states: [{ description: item.state }],
      uponReceiving: name,
      withRequest: {
        method: item.method, path: item.path,
        ...(item.query === undefined ? {} : { query: item.query }),
        ...(item.headers === undefined ? {} : { headers: item.headers }),
        ...(item.body === undefined ? {} : { body: item.body }),
      },
      willRespondWith: item.response as never,
    });
    await pact.executeTest(async (server) => {
      const result = item.run(client(server.url, item));
      if (item.error !== undefined) {
        await expect(result).rejects.toMatchObject(item.error);
      } else if (item.expected === undefined || typeof item.expected === 'string') {
        expect(await result).toBe(item.expected);
      } else {
        expect(await result).toMatchObject(item.expected as object);
      }
    });
  });

  it('token CSRF', async () => {
    pact.addInteraction({
      states: [{ description: 'sem sessão' }], uponReceiving: 'token do contexto pré-autenticado',
      withRequest: { method: 'GET', path: `${A}/auth/csrf` },
      willRespondWith: { status: 200, headers: json, body: { csrfToken: token } },
    });
    await pact.executeTest(async (server) => {
      const response = await fetch(`${server.url}${A}/auth/csrf`);
      expect(await response.json()).toEqual({ csrfToken: TOKEN });
    });
  });
});

