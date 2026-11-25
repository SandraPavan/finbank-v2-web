<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSession } from '../session/session';
import { type Problem, problemOf } from '../support/problems';
import { TEXTS } from '../texts';
import ProblemMessage from './ProblemMessage.vue';

const session = useSession();
const router = useRouter();
const busy = ref(false);
const problem = ref<Problem | null>(null);

async function leave(all: boolean): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  problem.value = null;
  try {
    await session.logout(all);
    await router.replace({ name: 'home' });
  } catch (error) {
    problem.value = problemOf(error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <header class="site-header">
    <p class="brand">{{ TEXTS.product }}</p>
    <nav v-if="session.state.status === 'active' || session.state.status === 'restricted'" aria-label="Sessão">
      <RouterLink v-if="session.state.status === 'active'" :to="{ name: 'change-password' }" data-testid="nav-change-password">Trocar senha</RouterLink>
      <button type="button" class="secondary" data-testid="logout" :aria-disabled="busy" @click="leave(false)">Sair</button>
      <button type="button" class="secondary" data-testid="logout-all" :aria-disabled="busy" @click="leave(true)">Sair de todas as sessões</button>
    </nav>
    <ProblemMessage :problem="problem" />
  </header>
</template>
