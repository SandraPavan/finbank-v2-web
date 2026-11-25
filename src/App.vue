<script setup lang="ts">
import { nextTick } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import MessageView from './views/MessageView.vue';
import { useSession } from './session/session';
import { TEXTS } from './texts';

const session = useSession();
const router = useRouter();

// Ao trocar de tela, o foco vai para o título: quem usa leitor de tela percebe a mudança.
router.afterEach(async (to, from) => {
  if (from.matched.length > 0 && to.path !== from.path) {
    await nextTick();
    document.querySelector<HTMLElement>('main h1')?.focus();
  }
});

async function retry(): Promise<void> {
  try {
    await session.reload();
    // Reaplica as guardas com o estado agora conhecido.
    const { path } = router.currentRoute.value;
    await router.replace({ path, query: {}, force: true });
  } catch {
    // Continua indisponível.
  }
}
</script>

<template>
  <div class="layout">
    <AppHeader />
    <main class="content">
      <RouterView v-slot="{ Component, route }">
        <MessageView
          v-if="route.meta.access !== undefined && session.state.status === 'unknown'"
          title="Indisponível"
          :message="TEXTS.unavailable"
          retry
          @retry="retry"
        />
        <MessageView
          v-else-if="
            (route.meta.access === 'CUSTOMER' || route.meta.access === 'FACILITATOR') && session.state.status === 'active' && session.state.profile !== route.meta.access
          "
          title="Sem acesso"
          :message="TEXTS.forbidden"
        />
        <component :is="Component" v-else :key="route.path" />
      </RouterView>
    </main>
    <footer class="site-footer">
      <p>{{ TEXTS.notice }}</p>
    </footer>
  </div>
</template>
