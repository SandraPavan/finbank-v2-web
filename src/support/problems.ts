import { useRouter } from 'vue-router';
import { ApiError, UNAVAILABLE } from '../api/http';
import { isSessionError, useSession } from '../session/session';
import { TEXTS } from '../texts';

export interface Problem {
  readonly message: string;
  /** Contagem regressiva, quando a API pede espera. */
  readonly waitSeconds: number | null;
}

const MESSAGES: Readonly<Record<string, string>> = {
  AUTH_INVALID_CREDENTIALS: TEXTS.loginRefused,
  AUTH_SESSION_REQUIRED: TEXTS.sessionRequired,
  AUTH_SESSION_EXPIRED: TEXTS.sessionExpired,
  AUTH_CURRENT_PASSWORD_INVALID: TEXTS.currentPasswordInvalid,
  PASSWORD_POLICY_VIOLATION: TEXTS.passwordPolicy,
  CSRF_VALIDATION_FAILED: TEXTS.csrf,
  ACCESS_DENIED: TEXTS.forbidden,
  RESOURCE_NOT_FOUND: TEXTS.notFound,
  IDENTITY_STATE_CONFLICT: TEXTS.conflict,
  [UNAVAILABLE]: TEXTS.unavailable,
};

export function problemOf(error: unknown): Problem {
  if (!(error instanceof ApiError)) {
    return { message: TEXTS.unexpected(null), waitSeconds: null };
  }
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    const waitSeconds = error.retryAfterSeconds ?? 1;
    return { message: TEXTS.rateLimited(waitSeconds), waitSeconds };
  }
  return { message: MESSAGES[error.code] ?? TEXTS.unexpected(error.correlationId), waitSeconds: null };
}

/**
 * Trata o que muda a tela (sessão perdida, troca obrigatória, contexto alterado) e devolve o que
 * resta mostrar, ou null se a navegação já resolveu.
 */
export function useProblemHandler(): (error: unknown) => Promise<Problem | null> {
  const session = useSession();
  const router = useRouter();
  return async (error) => {
    if (error instanceof ApiError) {
      if (isSessionError(error)) {
        const login = session.state.profile === 'FACILITATOR' ? 'facilitator-login' : 'home';
        session.leave(error.code === 'AUTH_SESSION_EXPIRED' ? TEXTS.sessionExpired : TEXTS.sessionRequired);
        await router.replace({ name: login });
        return null;
      }
      if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
        session.restrict();
        await router.replace({ name: 'recovery' });
        return null;
      }
      if (error.code === 'CSRF_VALIDATION_FAILED') {
        // Outra aba pode ter trocado a identidade: a tela acompanha, sem reenviar nada.
        await session.reload().catch(() => undefined);
      }
    }
    return problemOf(error);
  };
}
