<script setup lang="ts">
import { ref } from 'vue';
import NewPasswordForm from '../components/NewPasswordForm.vue';
import { homeOf } from '../support/home';
import { useSession } from '../session/session';
import { type Problem, useProblemHandler } from '../support/problems';
import { TEXTS } from '../texts';

const session = useSession();
const handle = useProblemHandler();
const done = ref(false);

async function save(current: string, next: string): Promise<Problem | null> {
  done.value = false;
  try {
    session.enter(await session.api.changePassword(current, next));
    done.value = true;
    return null;
  } catch (error) {
    return handle(error);
  }
}
</script>

<template>
  <h1 tabindex="-1">Trocar senha</h1>
  <p v-if="done" class="notice" role="status" data-testid="notice">{{ TEXTS.passwordChanged }}</p>
  <NewPasswordForm ask-current :policy="TEXTS.passwordPolicy" :save="save" />
  <p v-if="session.state.profile !== null"><RouterLink :to="homeOf(session.state.profile)" data-testid="area-link">Voltar para sua área</RouterLink></p>
</template>
