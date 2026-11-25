/** Falha de uma chamada, já reduzida ao que a interface distingue. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly correlationId: string | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Sem resposta utilizável: rede, proxy ou API fora. */
export const UNAVAILABLE = 'TEMPORARY_UNAVAILABLE';
/** Resposta fora do contrato: nunca vira dado parcial. */
export const UNEXPECTED = 'UNEXPECTED_RESPONSE';

const SAFE_CODE = /^[A-Z_]{3,60}$/;
const SAFE_CORRELATION = /^[A-Za-z0-9._-]{8,64}$/;
const GATEWAY = new Set([502, 503, 504]);

export type Parser<T> = (value: unknown) => T;

export interface HttpOptions {
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
}

/**
 * Cliente HTTP da API. O token CSRF fica só em memória e acompanha o contexto: é trocado sempre que
 * uma resposta traz outro. Nenhuma escrita é reenviada automaticamente.
 */
export class Http {
  private token: string | null = null;
  private readonly baseUrl: string;
  private readonly send: typeof fetch;

  constructor(options: HttpOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.send = options.fetch ?? ((input, init) => fetch(input, init));
  }

  get<T>(path: string, parse: Parser<T>): Promise<T> {
    return this.call('GET', path, undefined, parse);
  }

  async post<T>(path: string, body: Record<string, string> | undefined, parse: Parser<T>): Promise<T> {
    if (this.token === null) {
      await this.renewToken();
    }
    try {
      return await this.call('POST', path, body, parse);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CSRF_VALIDATION_FAILED') {
        this.token = null;
        await this.renewToken().catch(() => undefined);
      }
      throw error;
    }
  }

  forgetToken(): void {
    this.token = null;
  }

  private async renewToken(): Promise<void> {
    await this.call('GET', '/auth/csrf', undefined, (value) => text(record(value)['csrfToken']));
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body: Record<string, string> | undefined, parse: Parser<T>): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (method === 'POST' && this.token !== null) {
      headers['X-CSRF-Token'] = this.token;
    }
    let response: Response;
    try {
      response = await this.send(`${this.baseUrl}/api/v1${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError(UNAVAILABLE);
    }
    if (!response.ok) {
      throw await toError(response);
    }
    try {
      const value: unknown = response.status === 204 ? undefined : await response.json();
      const parsed = parse(value);
      const token = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['csrfToken'] : undefined;
      if (typeof token === 'string') {
        this.token = token;
      }
      return parsed;
    } catch {
      throw new ApiError(UNEXPECTED, correlation(response.headers.get('X-Correlation-ID')));
    }
  }
}

async function toError(response: Response): Promise<ApiError> {
  let problem: Record<string, unknown> = {};
  try {
    problem = record(await response.json());
  } catch {
    // Corpo que não é Problem Details (por exemplo, do proxy).
  }
  const code = problem['code'];
  const known = typeof code === 'string' && SAFE_CODE.test(code) ? code : null;
  const retryAfter = response.headers.get('Retry-After') ?? '';
  return new ApiError(
    known ?? (GATEWAY.has(response.status) ? UNAVAILABLE : UNEXPECTED),
    correlation(problem['correlationId'] ?? response.headers.get('X-Correlation-ID')),
    /^[1-9][0-9]{0,5}$/.test(retryAfter) ? Number(retryAfter) : null,
  );
}

function correlation(value: unknown): string | null {
  return typeof value === 'string' && SAFE_CORRELATION.test(value) ? value : null;
}

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('objeto esperado');
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('texto esperado');
  }
  return value;
}

export function oneOf<const T extends string>(value: unknown, options: readonly T[]): T {
  const found = options.find((option) => option === value);
  if (found === undefined) {
    throw new TypeError('valor inesperado');
  }
  return found;
}
