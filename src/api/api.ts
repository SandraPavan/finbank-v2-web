import { type Http, oneOf, record, text } from './http';

export type Profile = 'CUSTOMER' | 'FACILITATOR';
export type CustomerStatus = 'ACTIVE' | 'DISABLED';

export interface SessionInfo {
  readonly identityId: string;
  readonly profile: Profile;
  readonly workspaceId: string | null;
  readonly passwordChangeRequired: boolean;
}

export interface Workspace {
  readonly workspaceId: string;
  readonly alias: string | null;
}

export interface Customer {
  readonly customerId: string;
  readonly email: string;
  readonly status: CustomerStatus;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextOffset: number | null;
}

export interface IssuedCredential {
  readonly temporaryCredential: string;
  readonly expiresAt: string;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function session(value: unknown): SessionInfo {
  const body = record(value);
  if (typeof body['passwordChangeRequired'] !== 'boolean') {
    throw new TypeError('lógico esperado');
  }
  return {
    identityId: text(body['identityId']),
    profile: oneOf(body['profile'], ['CUSTOMER', 'FACILITATOR']),
    workspaceId: nullableText(body['workspaceId']),
    passwordChangeRequired: body['passwordChangeRequired'],
  };
}

/** Login, troca e conclusão sempre trazem o token do novo contexto. */
function openedSession(value: unknown): SessionInfo {
  text(record(value)['csrfToken']);
  return session(value);
}

function workspace(value: unknown): Workspace {
  const body = record(value);
  return { workspaceId: text(body['workspaceId']), alias: nullableText(body['alias']) };
}

const STATUS = ['ACTIVE', 'DISABLED'] as const;

function customer(value: unknown): Customer {
  const body = record(value);
  return { customerId: text(body['customerId']), email: text(body['email']), status: oneOf(body['status'], STATUS) };
}

function page<T>(item: (value: unknown) => T) {
  return (value: unknown): Page<T> => {
    const { items, nextOffset } = record(value);
    if (!Array.isArray(items) || !(nextOffset === null || Number.isSafeInteger(nextOffset))) {
      throw new TypeError('página esperada');
    }
    return { items: items.map(item), nextOffset: nextOffset as number | null };
  };
}

const nothing = (): void => undefined;
const segment = encodeURIComponent;

/** Operações da API usadas pela interface. */
export class Api {
  constructor(private readonly http: Http) {}

  me(): Promise<SessionInfo> {
    return this.http.get('/auth/me', session);
  }

  loginCustomer(alias: string, email: string, password: string): Promise<SessionInfo> {
    return this.http.post('/auth/customer/login', { alias, email, password }, openedSession);
  }

  loginFacilitator(email: string, password: string): Promise<SessionInfo> {
    return this.http.post('/auth/facilitator/login', { email, password }, openedSession);
  }

  async logout(): Promise<void> {
    await this.http.post('/auth/logout', undefined, nothing);
    this.http.forgetToken();
  }

  async logoutAll(): Promise<void> {
    await this.http.post('/auth/logout-all', undefined, nothing);
    this.http.forgetToken();
  }

  changePassword(currentPassword: string, newPassword: string): Promise<SessionInfo> {
    return this.http.post('/auth/password/change', { currentPassword, newPassword }, openedSession);
  }

  completeRecovery(newPassword: string): Promise<SessionInfo> {
    return this.http.post('/auth/password/recovery', { newPassword }, openedSession);
  }

  workspaces(offset: number): Promise<Page<Workspace>> {
    return this.http.get(`/facilitator/workspaces?offset=${offset}`, page(workspace));
  }

  workspace(workspaceId: string): Promise<Workspace> {
    return this.http.get(`/facilitator/workspaces/${segment(workspaceId)}`, workspace);
  }

  customers(workspaceId: string, offset: number): Promise<Page<Customer>> {
    return this.http.get(`/facilitator/workspaces/${segment(workspaceId)}/customers?offset=${offset}`, page(customer));
  }

  setCustomerStatus(workspaceId: string, customerId: string, status: CustomerStatus): Promise<CustomerStatus> {
    const action = status === 'ACTIVE' ? 'enable' : 'disable';
    return this.http.post(`${customerPath(workspaceId, customerId)}/${action}`, undefined, (value) => oneOf(record(value)['status'], STATUS));
  }

  resetCustomerPassword(workspaceId: string, customerId: string): Promise<IssuedCredential> {
    return this.http.post(`${customerPath(workspaceId, customerId)}/password-reset`, undefined, (value) => {
      const body = record(value);
      const expiresAt = text(body['expiresAt']);
      if (Number.isNaN(Date.parse(expiresAt))) {
        throw new TypeError('data esperada');
      }
      return { temporaryCredential: text(body['temporaryCredential']), expiresAt };
    });
  }
}

function customerPath(workspaceId: string, customerId: string): string {
  return `/facilitator/workspaces/${segment(workspaceId)}/customers/${segment(customerId)}`;
}
