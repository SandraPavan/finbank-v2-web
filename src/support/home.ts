import type { Profile } from '../api/api';

/** Área de cada perfil depois de entrar. */
export function homeOf(profile: Profile): { name: string } {
  return { name: profile === 'CUSTOMER' ? 'customer-area' : 'workspaces' };
}
