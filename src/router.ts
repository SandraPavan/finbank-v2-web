import { createRouter, type Router, type RouteLocationNormalized, type RouteRecordRaw, type RouterHistory } from 'vue-router';
import type { Profile } from './api/api';
import { homeOf } from './support/home';
import type { Session } from './session/session';
import { TEXTS } from './texts';
import ChangePasswordView from './views/ChangePasswordView.vue';
import CustomerAreaView from './views/CustomerAreaView.vue';
import CustomerLoginView from './views/CustomerLoginView.vue';
import CustomersView from './views/CustomersView.vue';
import FacilitatorLoginView from './views/FacilitatorLoginView.vue';
import HomeView from './views/HomeView.vue';
import MessageView from './views/MessageView.vue';
import RecoveryView from './views/RecoveryView.vue';
import WorkspacesView from './views/WorkspacesView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    title: string;
    /** Perfil exigido; 'ANY' para qualquer sessão normal; ausente para pública. */
    access?: Profile | 'ANY' | 'RESTRICTED';
  }
}

export const ROUTES: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { title: 'Entrar no FinBank V2' } },
  { path: '/t/:alias', name: 'customer-login', component: CustomerLoginView, props: true, meta: { title: 'Entrar' } },
  { path: '/facilitador', name: 'facilitator-login', component: FacilitatorLoginView, meta: { title: 'Entrar como facilitador' } },
  { path: '/inicio', name: 'customer-area', component: CustomerAreaView, meta: { title: 'Sua área', access: 'CUSTOMER' } },
  { path: '/facilitador/workspaces', name: 'workspaces', component: WorkspacesView, meta: { title: 'Workspaces', access: 'FACILITATOR' } },
  {
    path: '/facilitador/workspaces/:workspaceId', name: 'customers', component: CustomersView, props: true,
    meta: { title: 'Clientes', access: 'FACILITATOR' },
  },
  { path: '/senha', name: 'change-password', component: ChangePasswordView, meta: { title: 'Trocar senha', access: 'ANY' } },
  { path: '/recuperar', name: 'recovery', component: RecoveryView, meta: { title: 'Defina uma nova senha', access: 'RESTRICTED' } },
  { path: '/:rest(.*)*', name: 'not-found', component: MessageView, props: { title: 'Não encontrado', message: TEXTS.notFound }, meta: { title: 'Não encontrado' } },
];

export function createAppRouter(history: RouterHistory, session: Session): { router: Router; takeReturn: (profile: Profile) => { path: string } | { name: string } } {
  const router = createRouter({ history, routes: ROUTES });
  // Só em memória e só rotas próprias: nada vindo da URL vira destino.
  let wanted: RouteLocationNormalized | null = null;

  router.beforeEach(async (to) => {
    const { access } = to.meta;
    try {
      await session.load();
    } catch {
      // Sem resposta da API: a tela protegida mostra a indisponibilidade.
      return true;
    }
    const { status, profile } = session.state;
    if (status === 'restricted') {
      return to.name === 'recovery' ? true : { name: 'recovery', replace: true };
    }
    if (access === undefined) {
      return true;
    }
    if (status !== 'active') {
      wanted = access === 'RESTRICTED' ? null : to;
      if (session.state.notice === null) {
        session.note(TEXTS.sessionRequired);
      }
      return { name: access === 'FACILITATOR' ? 'facilitator-login' : 'home', replace: true };
    }
    if (access === 'RESTRICTED' && profile !== null) {
      return { ...homeOf(profile), replace: true };
    }
    return true;
  });

  router.afterEach((to) => {
    document.title = `${to.meta.title} — ${TEXTS.product}`;
  });

  return {
    router,
    takeReturn(profile) {
      const target = wanted;
      wanted = null;
      const access = target?.meta.access;
      return target !== null && (access === profile || access === 'ANY') ? { path: target.path } : homeOf(profile);
    },
  };
}
