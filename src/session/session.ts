import { type InjectionKey, inject, reactive, readonly } from 'vue';
import type { Api, Profile, SessionInfo } from '../api/api';
import { ApiError } from '../api/http';
import { TEXTS } from '../texts';

export type SessionStatus = 'unknown' | 'anonymous' | 'restricted' | 'active';

export interface SessionState {
  status: SessionStatus;
  profile: Profile | null;
  /** Aviso para a próxima tela pública. */
  notice: string | null;
}

/** Estado da sessão na interface. Não é autoridade: a API decide cada operação. */
export class Session {
  private readonly writable = reactive<SessionState>({ status: 'unknown', profile: null, notice: null });
  readonly state = readonly(this.writable);

  constructor(readonly api: Api) {}

  /** Consulta a API só quando ainda não se sabe. */
  async load(): Promise<void> {
    if (this.writable.status === 'unknown') {
      await this.reload();
    }
  }

  async reload(): Promise<void> {
    try {
      this.enter(await this.api.me());
    } catch (error) {
      if (error instanceof ApiError && isSessionError(error)) {
        this.leave(error.code === 'AUTH_SESSION_EXPIRED' ? TEXTS.sessionExpired : null);
        return;
      }
      throw error;
    }
  }

  enter(info: SessionInfo): void {
    this.writable.status = info.passwordChangeRequired ? 'restricted' : 'active';
    this.writable.profile = info.profile;
    this.writable.notice = null;
  }

  leave(notice: string | null = null): void {
    this.writable.status = 'anonymous';
    this.writable.profile = null;
    this.writable.notice = notice;
  }

  restrict(): void {
    this.writable.status = 'restricted';
  }

  note(notice: string | null): void {
    this.writable.notice = notice;
  }

  /** Sair vale mesmo se a sessão já terminou. */
  async logout(all: boolean): Promise<void> {
    try {
      await (all ? this.api.logoutAll() : this.api.logout());
    } catch (error) {
      if (!(error instanceof ApiError && isSessionError(error))) {
        throw error;
      }
    }
    this.leave();
  }
}

export function isSessionError(error: ApiError): boolean {
  return error.code === 'AUTH_SESSION_REQUIRED' || error.code === 'AUTH_SESSION_EXPIRED';
}

export const SESSION: InjectionKey<Session> = Symbol('session');

export function useSession(): Session {
  const session = inject(SESSION);
  if (session === undefined) {
    throw new Error('sessão não fornecida');
  }
  return session;
}
