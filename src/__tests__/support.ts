import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { afterEach, vi } from 'vitest';
import { bootstrap } from '../bootstrap';

enableAutoUnmount(afterEach);

// O jsdom não implementa o diálogo modal.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};

export interface Call {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly token: string | null;
}

export type Answer = { status?: number; body?: unknown; headers?: Record<string, string> } | 'network';

export const TOKEN = 'T'.repeat(43);
export const OTHER_TOKEN = 'U'.repeat(43);

export function problem(status: number, code: string, headers: Record<string, string> = {}): Answer {
  return { status, headers, body: { type: 'urn:x', title: 'título', status, code, correlationId: 'corr-12345678' } };
}

export function sessionBody(profile: 'CUSTOMER' | 'FACILITATOR', extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    identityId: 'id', profile, workspaceId: profile === 'CUSTOMER' ? 'w' : null, passwordChangeRequired: false,
    idleExpiresAt: '2026-01-01T00:00:00.000Z', absoluteExpiresAt: '2026-01-01T00:00:00.000Z', ...extra,
  };
}

export const opened = (profile: 'CUSTOMER' | 'FACILITATOR', extra: Record<string, unknown> = {}) =>
  ({ body: sessionBody(profile, { csrfToken: OTHER_TOKEN, ...extra }) }) satisfies Answer;

/** API simulada: respostas por "MÉTODO caminho"; lista consumida em ordem, a última se repete. */
export function fakeApi(routes: Record<string, Answer | Answer[]>) {
  const calls: Call[] = [];
  const queues = new Map<string, Answer[]>(Object.entries({ 'GET /auth/csrf': { body: { csrfToken: TOKEN } }, ...routes }).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));
  const send = vi.fn((input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const path = String(input).replace('/api/v1', '');
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    calls.push({ method, path, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined, token: headers.get('X-CSRF-Token') });
    const queue = queues.get(`${method} ${path}`);
    if (queue === undefined) {
      return Promise.reject(new Error(`não simulado: ${method} ${path}`));
    }
    const answer = (queue.length > 1 ? queue.shift() : queue[0]) ?? 'network';
    if (answer === 'network') {
      return Promise.reject(new TypeError('rede'));
    }
    const status = answer.status ?? 200;
    return Promise.resolve(new Response(status === 204 ? null : typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body), { status, headers: answer.headers ?? {} }));
  });
  return { calls, send: send as unknown as typeof fetch, set: (key: string, answer: Answer) => queues.set(key, [answer]) };
}

const hosts: { unmount(): void }[] = [];
afterEach(() => {
  while (hosts.length > 0) {
    hosts.pop()?.unmount();
  }
  document.body.innerHTML = '';
});

export async function start(path: string, routes: Record<string, Answer | Answer[]>) {
  const api = fakeApi(routes);
  const { app, router, session } = bootstrap(createMemoryHistory(), { fetch: api.send });
  const host = document.createElement('div');
  document.body.appendChild(host);
  await router.push(path);
  app.mount(host);
  hosts.push(app);
  await flushPromises();
  return {
    ...api, router, session, host,
    path: () => router.currentRoute.value.path,
    text: () => host.textContent ?? '',
    find: <T extends HTMLElement = HTMLElement>(id: string) => host.querySelector<T>(`[data-testid="${id}"]`),
    all: (id: string) => [...host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)],
    async click(id: string, index = 0) {
      [...host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)][index]?.click();
      await flushPromises();
    },
    async fill(values: Record<string, string>) {
      for (const [id, value] of Object.entries(values)) {
        const input = host.querySelector<HTMLInputElement>(`[data-testid="field-${id}"]`);
        if (input === null) {
          throw new Error(`campo ausente: ${id}`);
        }
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
      await flushPromises();
    },
    async submit() {
      host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
      await flushPromises();
    },
    value: (id: string) => host.querySelector<HTMLInputElement>(`[data-testid="field-${id}"]`)?.value,
  };
}
