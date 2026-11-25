import { type InjectionKey, inject } from 'vue';
import type { Profile } from '../api/api';

export type TakeReturn = (profile: Profile) => { path: string } | { name: string };
export const TAKE_RETURN: InjectionKey<TakeReturn> = Symbol('take-return');

/** Destino depois de entrar: a rota própria pedida antes, se couber ao perfil, ou a área dele. */
export function useTakeReturn(): TakeReturn {
  const take = inject(TAKE_RETURN);
  if (take === undefined) {
    throw new Error('destino não fornecido');
  }
  return take;
}
