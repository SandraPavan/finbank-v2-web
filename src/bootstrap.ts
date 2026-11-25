import { type App as VueApp, createApp } from 'vue';
import type { RouterHistory } from 'vue-router';
import { Api } from './api/api';
import { Http, type HttpOptions } from './api/http';
import App from './App.vue';
import { createAppRouter } from './router';
import { Session, SESSION } from './session/session';
import { TAKE_RETURN } from './support/entry';

export function bootstrap(history: RouterHistory, options: HttpOptions = {}): { app: VueApp; session: Session; router: ReturnType<typeof createAppRouter>['router'] } {
  const session = new Session(new Api(new Http(options)));
  const { router, takeReturn } = createAppRouter(history, session);
  const app = createApp(App);
  app.provide(SESSION, session);
  app.provide(TAKE_RETURN, takeReturn);
  app.use(router);
  return { app, session, router };
}
